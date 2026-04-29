/**
 * Idempotency utilities for server actions.
 *
 * DB-H08 FIX: Provides consistent idempotency key generation to prevent
 * duplicate mutations from rapid double-submissions or network retries.
 *
 * Usage:
 *   const key = generateIdempotencyKey('createWebhook', { clientId, name, url });
 *   // Pass key to backend which uses it to deduplicate requests
 */

import { createHash } from 'crypto';

/**
 * Time window duration in milliseconds for idempotency.
 * Requests with same operation + params within this window are considered duplicates.
 * 30 seconds provides good balance between deduplication and allowing intentional retries.
 */
const IDEMPOTENCY_WINDOW_MS = 30000;

/**
 * Generate an idempotency key from operation name and parameters.
 *
 * The key is a SHA-256 hash (truncated to 16 chars) of:
 * - Operation name (e.g., 'createWebhook', 'updateAlert')
 * - Relevant parameters (clientId, resource IDs, etc.)
 * - Time window (30-second buckets)
 *
 * This ensures:
 * - Same operation with same params in same time window = same key (deduplicated)
 * - Different operations or params = different key (processed normally)
 * - After time window expires, operation can be retried
 *
 * @param operation - Name of the operation (e.g., 'createWebhook')
 * @param params - Parameters that uniquely identify the operation
 * @returns 16-character hex string suitable for idempotency key header
 */
export function generateIdempotencyKey(
  operation: string,
  params: Record<string, unknown>
): string {
  // Use 30-second time windows to allow deduplication while permitting retries
  const timeWindow = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS);

  // Create deterministic string from operation and params
  const data = JSON.stringify({ operation, ...params, timeWindow });

  // SHA-256 hash truncated to 16 chars (64 bits of entropy - sufficient for dedup)
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Generate idempotency key for webhook operations.
 */
export function generateWebhookIdempotencyKey(
  operation: 'create' | 'update' | 'delete',
  params: {
    clientId?: string;
    webhookId?: string;
    name?: string;
    url?: string;
  }
): string {
  return generateIdempotencyKey(`webhook:${operation}`, params);
}

/**
 * Generate idempotency key for alert operations.
 */
export function generateAlertIdempotencyKey(
  operation: 'create' | 'update' | 'delete',
  params: {
    clientId: string;
    alertId?: string;
    ruleId?: string;
    alertType?: string;
  }
): string {
  return generateIdempotencyKey(`alert:${operation}`, params);
}

/**
 * Generate idempotency key for audit operations.
 */
export function generateAuditIdempotencyKey(
  operation: 'start' | 'delete',
  params: {
    clientId: string;
    projectId: string;
    auditId?: string;
    startUrl?: string;
  }
): string {
  return generateIdempotencyKey(`audit:${operation}`, params);
}
