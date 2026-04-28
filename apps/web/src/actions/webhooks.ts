"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo, postOpenSeo, patchOpenSeo, deleteOpenSeo } from "@/lib/server-fetch";
import { rateLimitAction } from "@/lib/middleware/rate-limit";

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
export async function getClientWebhooks(clientId: string): Promise<Webhook[]> {
  const validated = clientIdSchema.parse(clientId);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated, auth);
  return getOpenSeo<Webhook[]>(
    `/api/webhooks?scope=client&scope_id=${validated}`,
  );
}

/**
 * Get webhook by ID with optional deliveries.
 * Validates client ownership if webhook is client-scoped.
 */
export async function getWebhook(
  webhookId: string,
  includeDeliveries = false,
): Promise<Webhook & { deliveries?: WebhookDelivery[] }> {
  const validated = webhookIdSchema.parse(webhookId);
  const auth = await requireActionAuth();
  const query = includeDeliveries ? "?deliveries=true" : "";
  const webhook = await getOpenSeo<Webhook & { deliveries?: WebhookDelivery[] }>(
    `/api/webhooks/${validated}${query}`
  );

  // Validate ownership for client-scoped webhooks
  if (webhook.scope === "client" && webhook.scopeId) {
    await validateClientOwnership(webhook.scopeId, auth);
  }

  return webhook;
}

/**
 * Get event registry.
 */
export async function getEventRegistry(): Promise<{
  events: WebhookEvent[];
  categories: string[];
}> {
  await requireActionAuth();
  return getOpenSeo("/api/webhooks?events=true");
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
}): Promise<{ id: string; secret: string }> {
  const validated = createWebhookSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  // Rate limit: 10 creates per minute
  await rateLimitAction("webhook:create", auth.userId, WEBHOOK_RATE_LIMITS.create);

  return postOpenSeo("/api/webhooks", {
    scope: "client",
    scopeId: validated.clientId,
    name: validated.name,
    url: validated.url,
    events: validated.events,
    headers: validated.headers,
  });
}

/**
 * Update a webhook.
 * Validates client ownership if webhook is client-scoped.
 *
 * TOCTOU FIX: Passes expectedScope and expectedScopeId to backend for atomic
 * ownership validation within the update query. This prevents race conditions
 * where ownership could change between the frontend check and backend mutation.
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
): Promise<{ success: boolean; secret?: string }> {
  const validated = updateWebhookSchema.parse({ webhookId, params });
  const auth = await requireActionAuth();

  // Rate limit: 20 updates per minute
  await rateLimitAction("webhook:update", auth.userId, WEBHOOK_RATE_LIMITS.update);

  // Fetch webhook first to validate ownership and get scope info
  const webhook = await getOpenSeo<Webhook>(`/api/webhooks/${validated.webhookId}`);
  if (webhook.scope === "client" && webhook.scopeId) {
    await validateClientOwnership(webhook.scopeId, auth);
  }

  // TOCTOU FIX: Pass scope info to backend for atomic ownership validation
  return patchOpenSeo(`/api/webhooks/${validated.webhookId}`, {
    ...validated.params,
    // Backend will validate these atomically in the WHERE clause
    expectedScope: webhook.scope,
    expectedScopeId: webhook.scopeId,
  });
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
): Promise<{ success: boolean }> {
  const validated = webhookIdSchema.parse(webhookId);
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

  return deleteOpenSeo(`/api/webhooks/${validated}?${queryParams.toString()}`);
}

/**
 * Get webhook deliveries.
 * Validates client ownership if webhook is client-scoped.
 */
export async function getWebhookDeliveries(
  webhookId: string,
): Promise<WebhookDelivery[]> {
  const validated = webhookIdSchema.parse(webhookId);
  const auth = await requireActionAuth();
  const result = await getOpenSeo<Webhook & { deliveries: WebhookDelivery[] }>(
    `/api/webhooks/${validated}?deliveries=true`,
  );

  // Validate ownership for client-scoped webhooks
  if (result.scope === "client" && result.scopeId) {
    await validateClientOwnership(result.scopeId, auth);
  }

  return result.deliveries ?? [];
}
