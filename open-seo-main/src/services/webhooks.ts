/**
 * Webhook management service.
 * Phase 18.5: CRUD operations for webhooks.
 */
import { randomBytes } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { webhooks, webhookDeliveries } from "@/db/webhook-schema";
import { matchesAnyPattern } from "./event-registry";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";

const logger = createLogger({ module: "webhooks" });

type WebhookScope = "global" | "workspace" | "client";

interface CreateWebhookParams {
  scope: WebhookScope;
  scopeId?: string;
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  enabled?: boolean;
}

interface UpdateWebhookParams {
  name?: string;
  url?: string;
  events?: string[];
  headers?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Generate a secure webhook secret.
 */
function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

/**
 * Create a new webhook.
 */
export async function createWebhook(
  params: CreateWebhookParams,
): Promise<string> {
  const secret = generateWebhookSecret();

  const [result] = await db
    .insert(webhooks)
    .values({
      scope: params.scope,
      scopeId: params.scopeId ?? null,
      name: params.name,
      url: params.url,
      secret,
      events: params.events,
      headers: params.headers ?? null,
      enabled: params.enabled ?? true,
    })
    .returning({ id: webhooks.id });

  return result.id;
}

/**
 * Update an existing webhook with optional ownership validation.
 *
 * TOCTOU FIX: When expectedScope/expectedScopeId are provided, the function
 * validates ownership atomically within the same query by including the scope
 * conditions in the WHERE clause. This prevents race conditions where ownership
 * could change between a check and the actual update.
 *
 * @param webhookId - The webhook ID to update
 * @param params - Update parameters
 * @param expectedScope - If provided, webhook must match this scope
 * @param expectedScopeId - If provided, webhook must match this scopeId
 * @returns true if update succeeded, false if webhook not found or scope mismatch
 */
export async function updateWebhook(
  webhookId: string,
  params: UpdateWebhookParams,
  expectedScope?: WebhookScope,
  expectedScopeId?: string,
): Promise<boolean> {
  // Build WHERE conditions - always include webhookId
  const conditions = [eq(webhooks.id, webhookId)];

  // TOCTOU FIX: Add scope conditions to WHERE clause for atomic ownership validation
  if (expectedScope !== undefined) {
    conditions.push(eq(webhooks.scope, expectedScope));
  }
  if (expectedScopeId !== undefined) {
    conditions.push(eq(webhooks.scopeId, expectedScopeId));
  }

  const result = await db
    .update(webhooks)
    .set({
      ...(params.name !== undefined && { name: params.name }),
      ...(params.url !== undefined && { url: params.url }),
      ...(params.events !== undefined && { events: params.events }),
      ...(params.headers !== undefined && { headers: params.headers }),
      ...(params.enabled !== undefined && { enabled: params.enabled }),
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({ id: webhooks.id });

  // Return false if no rows updated (webhook not found or scope mismatch)
  return result.length > 0;
}

/**
 * Delete a webhook and all its deliveries.
 * Uses transaction to ensure atomic cascade delete.
 *
 * TOCTOU FIX: When expectedScope/expectedScopeId are provided, the function
 * validates ownership atomically within the transaction. This prevents race
 * conditions where ownership could change between a check and the actual delete.
 *
 * @param webhookId - The webhook ID to delete
 * @param expectedScope - If provided, webhook must match this scope
 * @param expectedScopeId - If provided, webhook must match this scopeId
 * @returns true if delete succeeded, false if webhook not found or scope mismatch
 */
export async function deleteWebhook(
  webhookId: string,
  expectedScope?: WebhookScope,
  expectedScopeId?: string,
): Promise<boolean> {
  try {
    let deleted = false;

    await db.transaction(async (tx) => {
      // Build WHERE conditions for atomic ownership validation
      const conditions = [eq(webhooks.id, webhookId)];

      // TOCTOU FIX: Add scope conditions to WHERE clause for atomic ownership validation
      if (expectedScope !== undefined) {
        conditions.push(eq(webhooks.scope, expectedScope));
      }
      if (expectedScopeId !== undefined) {
        conditions.push(eq(webhooks.scopeId, expectedScopeId));
      }

      // Delete deliveries first (even though schema has onDelete: cascade,
      // explicit deletion provides better control and logging)
      await tx.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, webhookId));

      // Delete webhook with ownership validation in WHERE clause
      const result = await tx
        .delete(webhooks)
        .where(and(...conditions))
        .returning({ id: webhooks.id });

      deleted = result.length > 0;
    });

    return deleted;
  } catch (error) {
    logger.error("Failed to delete webhook", error instanceof Error ? error : undefined, {
      webhookId,
    });
    throw new AppError("WEBHOOK_DELETE_FAILED", "Failed to delete webhook and its deliveries");
  }
}

/**
 * Get a webhook by ID.
 */
export async function getWebhookById(webhookId: string) {
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId));
  return webhook ?? null;
}

/**
 * List webhooks by scope.
 */
export async function getWebhooksByScope(
  scope: WebhookScope,
  scopeId?: string,
) {
  if (scope === "global") {
    return db.select().from(webhooks).where(eq(webhooks.scope, "global"));
  }
  return db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.scope, scope), eq(webhooks.scopeId, scopeId ?? "")));
}

/**
 * Find all webhooks matching an event type and scope hierarchy.
 * Returns webhooks from most specific (client) to least specific (global).
 */
export async function findMatchingWebhooks(
  eventType: string,
  clientId?: string,
  workspaceId?: string,
): Promise<typeof webhooks.$inferSelect[]> {
  const matchingWebhooks: (typeof webhooks.$inferSelect)[] = [];

  // 1. Client-level webhooks (most specific)
  if (clientId) {
    const clientWebhooks = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.scope, "client"),
          eq(webhooks.scopeId, clientId),
          eq(webhooks.enabled, true),
        ),
      );

    for (const webhook of clientWebhooks) {
      const events = webhook.events as string[];
      if (matchesAnyPattern(eventType, events)) {
        matchingWebhooks.push(webhook);
      }
    }
  }

  // 2. Workspace-level webhooks
  if (workspaceId) {
    const workspaceWebhooks = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.scope, "workspace"),
          eq(webhooks.scopeId, workspaceId),
          eq(webhooks.enabled, true),
        ),
      );

    for (const webhook of workspaceWebhooks) {
      const events = webhook.events as string[];
      if (matchesAnyPattern(eventType, events)) {
        matchingWebhooks.push(webhook);
      }
    }
  }

  // 3. Global webhooks (least specific)
  const globalWebhooks = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.scope, "global"), eq(webhooks.enabled, true)));

  for (const webhook of globalWebhooks) {
    const events = webhook.events as string[];
    if (matchesAnyPattern(eventType, events)) {
      matchingWebhooks.push(webhook);
    }
  }

  return matchingWebhooks;
}

/**
 * Regenerate a webhook's secret.
 */
export async function regenerateWebhookSecret(
  webhookId: string,
): Promise<string> {
  const newSecret = generateWebhookSecret();

  await db
    .update(webhooks)
    .set({
      secret: newSecret,
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, webhookId));

  return newSecret;
}

/**
 * Get delivery history for a webhook.
 */
export async function getWebhookDeliveries(
  webhookId: string,
  limit = 50,
  offset = 0,
) {
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(webhookDeliveries.createdAt)
    .limit(limit)
    .offset(offset);
}

/**
 * Create a delivery record with idempotency check.
 * Returns null if a delivery with the same idempotency key already exists.
 */
export async function createDeliveryRecord(params: {
  webhookId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<string | null> {
  // If idempotency key provided, check for existing delivery
  if (params.idempotencyKey) {
    const existing = await db
      .select({ id: webhookDeliveries.id })
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.webhookId, params.webhookId),
          eq(webhookDeliveries.idempotencyKey, params.idempotencyKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Already processed - skip duplicate delivery
      return null;
    }
  }

  // Create new delivery record with ON CONFLICT DO NOTHING for extra safety
  const result = await db
    .insert(webhookDeliveries)
    .values({
      webhookId: params.webhookId,
      eventId: params.eventId,
      eventType: params.eventType,
      idempotencyKey: params.idempotencyKey ?? null,
      payload: params.payload,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning({ id: webhookDeliveries.id });

  // If no rows returned, concurrent insert won the race
  if (result.length === 0) {
    return null;
  }

  return result[0].id;
}

/**
 * Update delivery status.
 */
export async function updateDeliveryStatus(
  deliveryId: string,
  status: "pending" | "delivered" | "failed" | "exhausted",
  details?: {
    responseStatus?: number;
    responseBody?: string;
    error?: string;
  },
): Promise<void> {
  await db
    .update(webhookDeliveries)
    .set({
      status,
      attempts: sql`${webhookDeliveries.attempts} + 1`,
      lastAttemptAt: new Date(),
      ...(details?.responseStatus !== undefined && {
        lastResponseStatus: details.responseStatus,
      }),
      ...(details?.responseBody !== undefined && {
        lastResponseBody: details.responseBody,
      }),
      ...(details?.error !== undefined && { lastError: details.error }),
      ...(status === "delivered" && { deliveredAt: new Date() }),
    })
    .where(eq(webhookDeliveries.id, deliveryId));
}
