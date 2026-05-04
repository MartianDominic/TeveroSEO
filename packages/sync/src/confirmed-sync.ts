/**
 * Confirmed Cross-Service Synchronization
 * FIX-08: H-SYNC-01, H-SYNC-02, H-SYNC-03
 *
 * Implements confirmation-based sync for cross-service client operations.
 * Ensures that navigation only happens after all services have confirmed sync.
 *
 * Architecture:
 * - AI-Writer creates client (source of truth)
 * - This service calls open-seo-main sync endpoint and waits for confirmation
 * - Implements retry with exponential backoff
 * - Returns sync status for UI feedback
 */

import { z } from "zod";

/**
 * Retry configuration for sync operations.
 * H-SYNC-03: Configurable retry with exponential backoff.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 8000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Optional timeout for the entire sync operation in milliseconds */
  timeoutMs?: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
  timeoutMs: 30000,
};

/**
 * Sync status for UI feedback.
 * H-SYNC-04: Visible sync status.
 */
export enum SyncStatus {
  /** Sync not started */
  PENDING = "pending",
  /** Sync in progress */
  SYNCING = "syncing",
  /** Sync completed successfully */
  SUCCESS = "success",
  /** Sync failed after retries */
  FAILED = "failed",
  /** Sync timed out */
  TIMEOUT = "timeout",
}

/**
 * Sync result with detailed status.
 */
export interface SyncResult {
  /** Overall sync status */
  status: SyncStatus;
  /** Client ID that was synced */
  clientId: string;
  /** Workspace ID */
  workspaceId: string;
  /** Number of retry attempts made */
  attempts: number;
  /** Total time taken in milliseconds */
  durationMs: number;
  /** Error message if sync failed */
  error?: string;
  /** Idempotency key used for this sync */
  idempotencyKey: string;
}

/**
 * Sync progress event for real-time UI updates.
 */
export interface SyncProgressEvent {
  /** Current status */
  status: SyncStatus;
  /** Current attempt number (1-based) */
  attempt: number;
  /** Maximum attempts */
  maxAttempts: number;
  /** Error from last attempt if any */
  lastError?: string;
}

/**
 * Client sync data schema.
 */
export const ClientSyncDataSchema = z.object({
  clientId: z.string().uuid(),
  workspaceId: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  status: z.enum(["active", "churned", "paused"]).default("active"),
  createdBy: z.string().optional(),
});

export type ClientSyncData = z.infer<typeof ClientSyncDataSchema>;

/**
 * Sync confirmation response schema.
 * M-SYNC-01: Includes idempotency for safe retries.
 */
export const SyncConfirmationSchema = z.object({
  success: z.boolean(),
  clientId: z.string().uuid(),
  syncedAt: z.string().datetime(),
  idempotencyKey: z.string(),
});

export type SyncConfirmation = z.infer<typeof SyncConfirmationSchema>;

/**
 * Generate an idempotency key for a sync operation.
 * M-SYNC-01: Idempotent sync handlers.
 */
export function generateIdempotencyKey(
  clientId: string,
  operation: "create" | "update" | "archive"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `sync-${operation}-${clientId}-${timestamp}-${random}`;
}

/**
 * Calculate exponential backoff delay with jitter.
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const jitter = Math.random() * 0.2 * exponentialDelay; // 20% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a confirmed sync function with retry logic.
 * H-SYNC-01: Wait for confirmation before proceeding.
 * H-SYNC-03: Retry with exponential backoff.
 *
 * @param syncFn - The actual sync function to call
 * @param config - Retry configuration
 * @param onProgress - Optional callback for progress updates
 * @returns A wrapped function that retries on failure
 */
export function createConfirmedSync<T extends ClientSyncData>(
  syncFn: (
    data: T,
    idempotencyKey: string
  ) => Promise<SyncConfirmation>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onProgress?: (event: SyncProgressEvent) => void
): (data: T) => Promise<SyncResult> {
  return async (data: T): Promise<SyncResult> => {
    const startTime = Date.now();
    const idempotencyKey = generateIdempotencyKey(data.clientId, "create");
    let lastError: string | undefined;

    // Emit initial progress
    onProgress?.({
      status: SyncStatus.SYNCING,
      attempt: 1,
      maxAttempts: config.maxAttempts,
    });

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        // Check timeout
        if (config.timeoutMs) {
          const elapsed = Date.now() - startTime;
          if (elapsed >= config.timeoutMs) {
            return {
              status: SyncStatus.TIMEOUT,
              clientId: data.clientId,
              workspaceId: data.workspaceId,
              attempts: attempt - 1,
              durationMs: elapsed,
              error: `Sync timed out after ${config.timeoutMs}ms`,
              idempotencyKey,
            };
          }
        }

        // Attempt sync
        const confirmation = await syncFn(data, idempotencyKey);

        // Validate confirmation
        const parsed = SyncConfirmationSchema.safeParse(confirmation);
        if (!parsed.success) {
          throw new Error(`Invalid sync confirmation: ${parsed.error.message}`);
        }

        // Success!
        onProgress?.({
          status: SyncStatus.SUCCESS,
          attempt,
          maxAttempts: config.maxAttempts,
        });

        return {
          status: SyncStatus.SUCCESS,
          clientId: data.clientId,
          workspaceId: data.workspaceId,
          attempts: attempt,
          durationMs: Date.now() - startTime,
          idempotencyKey,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        // Emit progress with error
        onProgress?.({
          status: SyncStatus.SYNCING,
          attempt,
          maxAttempts: config.maxAttempts,
          lastError,
        });

        // Don't retry on last attempt
        if (attempt < config.maxAttempts) {
          const delay = calculateBackoffDelay(attempt, config);
          await sleep(delay);
        }
      }
    }

    // All retries exhausted
    onProgress?.({
      status: SyncStatus.FAILED,
      attempt: config.maxAttempts,
      maxAttempts: config.maxAttempts,
      lastError,
    });

    return {
      status: SyncStatus.FAILED,
      clientId: data.clientId,
      workspaceId: data.workspaceId,
      attempts: config.maxAttempts,
      durationMs: Date.now() - startTime,
      error: lastError ?? "Sync failed after all retry attempts",
      idempotencyKey,
    };
  };
}

/**
 * Type for the sync function that can be passed to createConfirmedSync.
 */
export type SyncFunction<T extends ClientSyncData> = (
  data: T,
  idempotencyKey: string
) => Promise<SyncConfirmation>;
