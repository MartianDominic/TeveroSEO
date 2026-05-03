"use server";

import { z } from "zod";
import { logger } from '@/lib/logger';
import {
  requireActionAuth,
  validateClientOwnership,
  type ActionResult,
} from "@/lib/auth/action-auth";
import { getOpenSeo, postOpenSeo, patchOpenSeo, deleteOpenSeo } from "@/lib/server-fetch";
import { rateLimitAction } from "@/lib/middleware/rate-limit";
import { generateWebhookIdempotencyKey } from "@/lib/utils/idempotency";

/** Rate limit configs for webhook mutations */
const WEBHOOK_RATE_LIMITS = {
  create: { limit: 10, windowMs: 60000 },  // 10 per minute
  update: { limit: 20, windowMs: 60000 },  // 20 per minute
  delete: { limit: 10, windowMs: 60000 },  // 10 per minute
};

// Validation schemas
const clientIdSchema = z.string().uuid("Invalid client ID format");
const webhookIdSchema = z.string().uuid("Invalid webhook ID format");

const webhookUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .max(2048, "URL too long")
  .refine(
    (url) => url.startsWith("https://"),
    "Webhook URL must use HTTPS"
  );

const webhookEventsSchema = z
  .array(z.string().min(1).max(100))
  .min(1, "At least one event is required")
  .max(50, "Maximum 50 events allowed");

const webhookHeadersSchema = z
  .record(
    z.string().max(100, "Header name too long"),
    z.string().max(1000, "Header value too long")
  )
  .optional();

const createWebhookSchema = z.object({
  clientId: clientIdSchema,
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  url: webhookUrlSchema,
  events: webhookEventsSchema,
  headers: webhookHeadersSchema,
});

const updateWebhookSchema = z.object({
  webhookId: webhookIdSchema,
  expectedVersion: z.number().int().min(0).optional(), // Optimistic locking version
  params: z.object({
    name: z.string().min(1).max(100, "Name too long").optional(),
    url: webhookUrlSchema.optional(),
    events: webhookEventsSchema.optional(),
    headers: webhookHeadersSchema,
    enabled: z.boolean().optional(),
    regenerateSecret: z.boolean().optional(),
  }),
});

export interface Webhook {
  id: string;
  scope: "global" | "workspace" | "client";
  scopeId: string | null;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  eventType: string;
  status: "pending" | "delivered" | "failed" | "exhausted";
  attempts: number;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface WebhookEvent {
  type: string;
  category: string;
  tier: number;
  description: string;
  samplePayload: Record<string, unknown>;
}

/**
 * Get all webhooks for a client.
 */
export async function getClientWebhooks(clientId: string): Promise<ActionResult<Webhook[]>> {
  const parseResult = clientIdSchema.safeParse(clientId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid client ID" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated, auth);
    const data = await getOpenSeo<Webhook[]>(
      `/api/webhooks?scope=client&scope_id=${validated}`,
    );
    return { success: true, data };
  } catch (error) {
    logger.error("[getClientWebhooks] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to fetch webhooks" };
  }
}

/**
 * Get webhook by ID with optional deliveries.
 * Validates client ownership if webhook is client-scoped.
 *
 * IDOR FIX: Backend must enforce ownership atomically in the query by accepting
 * userId and only returning webhooks that belong to clients the user owns.
 * The frontend passes auth context to enable backend-side ownership validation.
 */
export async function getWebhook(
  webhookId: string,
  includeDeliveries = false,
): Promise<ActionResult<Webhook & { deliveries?: WebhookDelivery[] }>> {
  const parseResult = webhookIdSchema.safeParse(webhookId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid webhook ID" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();

    // IDOR FIX: Pass userId to backend for atomic ownership validation in the query.
    // Backend should JOIN with client ownership and return 404 if not owned.
    const query = new URLSearchParams();
    if (includeDeliveries) query.set("deliveries", "true");
    query.set("userId", auth.userId);

    const webhook = await getOpenSeo<Webhook & { deliveries?: WebhookDelivery[] }>(
      `/api/webhooks/${validated}?${query.toString()}`
    );

    // Secondary validation: ensure client-scoped webhooks are owned by user.
    // This is defense-in-depth; backend should enforce atomically.
    if (webhook.scope === "client" && webhook.scopeId) {
      await validateClientOwnership(webhook.scopeId, auth);
    }

    return { success: true, data: webhook };
  } catch (error) {
    logger.error("[getWebhook] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to fetch webhook" };
  }
}

/**
 * Get event registry.
 */
export async function getEventRegistry(): Promise<ActionResult<{
  events: WebhookEvent[];
  categories: string[];
}>> {
  try {
    await requireActionAuth();
    const data = await getOpenSeo<{ events: WebhookEvent[]; categories: string[] }>("/api/webhooks?events=true");
    return { success: true, data };
  } catch (error) {
    logger.error("[getEventRegistry] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to fetch event registry" };
  }
}

/**
 * Create a webhook.
 */
export async function createWebhook(params: {
  clientId: string;
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
}): Promise<ActionResult<{ id: string; secret: string }>> {
  const parseResult = createWebhookSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid webhook parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: 10 creates per minute
    await rateLimitAction("webhook:create", auth.userId, WEBHOOK_RATE_LIMITS.create);

    // DB-H08 FIX: Generate idempotency key to prevent duplicate webhook creation
    const idempotencyKey = generateWebhookIdempotencyKey('create', {
      clientId: validated.clientId,
      name: validated.name,
      url: validated.url,
    });

    const data = await postOpenSeo<{ id: string; secret: string }>("/api/webhooks", {
      scope: "client",
      scopeId: validated.clientId,
      name: validated.name,
      url: validated.url,
      events: validated.events,
      headers: validated.headers,
      idempotencyKey, // Backend should use this to deduplicate
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[createWebhook] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to create webhook" };
  }
}

/**
 * Update a webhook.
 * Validates client ownership if webhook is client-scoped.
 *
 * TOCTOU FIX: Uses optimistic locking with expectedVersion parameter.
 * Backend validates version in WHERE clause: UPDATE ... WHERE id = ? AND version = ?
 * If version mismatch, backend returns 409 Conflict, preventing lost updates.
 *
 * Also passes expectedScope and expectedScopeId to backend for atomic
 * ownership validation within the update query.
 */
export async function updateWebhook(
  webhookId: string,
  params: {
    name?: string;
    url?: string;
    events?: string[];
    headers?: Record<string, string>;
    enabled?: boolean;
    regenerateSecret?: boolean;
  },
  expectedVersion?: number,
): Promise<ActionResult<{ success: boolean; secret?: string; newVersion?: number }>> {
  const parseResult = updateWebhookSchema.safeParse({ webhookId, expectedVersion, params });
  if (!parseResult.success) {
    return { success: false, error: "Invalid webhook parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();

    // Rate limit: 20 updates per minute
    await rateLimitAction("webhook:update", auth.userId, WEBHOOK_RATE_LIMITS.update);

    // IDOR FIX: Pass userId to backend for atomic ownership validation in the query.
    const query = new URLSearchParams();
    query.set("userId", auth.userId);

    // Fetch webhook first to validate ownership and get scope info
    const webhook = await getOpenSeo<Webhook & { version?: number }>(`/api/webhooks/${validated.webhookId}?${query.toString()}`);
    if (webhook.scope === "client" && webhook.scopeId) {
      await validateClientOwnership(webhook.scopeId, auth);
    }

    // Use version from webhook if not explicitly provided
    const versionToUse = validated.expectedVersion ?? webhook.version;

    // TOCTOU FIX: Pass version and scope info to backend for atomic validation
    const data = await patchOpenSeo<{ success: boolean; secret?: string; newVersion?: number }>(`/api/webhooks/${validated.webhookId}`, {
      ...validated.params,
      // Backend will validate version atomically in WHERE clause (optimistic locking)
      expectedVersion: versionToUse,
      // Backend will validate these atomically in the WHERE clause
      expectedScope: webhook.scope,
      expectedScopeId: webhook.scopeId,
      userId: auth.userId, // For atomic ownership check
    });
    return { success: true, data };
  } catch (error) {
    // Check for version conflict (409 Conflict from backend)
    if (error instanceof Error && error.message.includes("409")) {
      return { success: false, error: "Webhook was modified by another request. Please refresh and try again." };
    }
    logger.error("[updateWebhook] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to update webhook" };
  }
}

/**
 * Delete a webhook.
 * Validates client ownership if webhook is client-scoped.
 *
 * TOCTOU FIX: Passes expectedScope and expectedScopeId to backend for atomic
 * ownership validation within the delete query. This prevents race conditions
 * where ownership could change between the frontend check and backend mutation.
 */
export async function deleteWebhookAction(
  webhookId: string,
): Promise<ActionResult<{ success: boolean }>> {
  const parseResult = webhookIdSchema.safeParse(webhookId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid webhook ID" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();

    // Rate limit: 10 deletes per minute
    await rateLimitAction("webhook:delete", auth.userId, WEBHOOK_RATE_LIMITS.delete);

    // Fetch webhook first to validate ownership and get scope info
    const webhook = await getOpenSeo<Webhook>(`/api/webhooks/${validated}`);
    if (webhook.scope === "client" && webhook.scopeId) {
      await validateClientOwnership(webhook.scopeId, auth);
    }

    // TOCTOU FIX: Pass scope info to backend for atomic ownership validation
    // Backend will validate these atomically in the WHERE clause
    const queryParams = new URLSearchParams();
    queryParams.set("expectedScope", webhook.scope);
    if (webhook.scopeId) {
      queryParams.set("expectedScopeId", webhook.scopeId);
    }

    const data = await deleteOpenSeo<{ success: boolean }>(`/api/webhooks/${validated}?${queryParams.toString()}`);
    return { success: true, data };
  } catch (error) {
    logger.error("[deleteWebhookAction] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to delete webhook" };
  }
}

/**
 * Get webhook deliveries.
 * Validates client ownership if webhook is client-scoped.
 *
 * IDOR FIX: Backend must enforce ownership atomically in the query by accepting
 * userId and only returning webhooks that belong to clients the user owns.
 */
export async function getWebhookDeliveries(
  webhookId: string,
): Promise<ActionResult<WebhookDelivery[]>> {
  const parseResult = webhookIdSchema.safeParse(webhookId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid webhook ID" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();

    // IDOR FIX: Pass userId to backend for atomic ownership validation in the query.
    // Backend should JOIN with client ownership and return 404 if not owned.
    const query = new URLSearchParams();
    query.set("deliveries", "true");
    query.set("userId", auth.userId);

    const result = await getOpenSeo<Webhook & { deliveries: WebhookDelivery[] }>(
      `/api/webhooks/${validated}?${query.toString()}`,
    );

    // Secondary validation: ensure client-scoped webhooks are owned by user.
    // This is defense-in-depth; backend should enforce atomically.
    if (result.scope === "client" && result.scopeId) {
      await validateClientOwnership(result.scopeId, auth);
    }

    return { success: true, data: result.deliveries ?? [] };
  } catch (error) {
    logger.error("[getWebhookDeliveries] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to fetch webhook deliveries" };
  }
}
