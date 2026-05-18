/**
 * Analytics Sync Worker
 * Phase 102-06: Redis to Postgres sync
 *
 * Syncs Redis counters to Postgres block_variants table.
 * Runs every 5 minutes using setInterval (not BullMQ since apps/web doesn't have it).
 *
 * Uses GETSET pattern for atomic read-and-reset of counters.
 * This ensures no analytics data is lost during sync.
 *
 * Key patterns synced:
 * - block:{blockId}:variant:{variantId}:views -> impressions column
 * - block:{blockId}:variant:{variantId}:conversions -> conversions column
 */

import { eq, sql } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import { db } from "@/db";
import { blockVariants } from "@/db/schema/document-builder";

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  /** Number of Redis keys processed */
  keysProcessed: number;
  /** Number of DB updates performed */
  updatesPerformed: number;
  /** Errors encountered during sync */
  errors: string[];
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Parsed Redis key components.
 */
interface ParsedKey {
  blockId: string;
  variantId: string;
  metric: "views" | "conversions";
}

// =============================================================================
// Constants
// =============================================================================

/** Sync interval: 5 minutes */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Batch size for DB updates */
const BATCH_SIZE = 50;

/** Maximum retry attempts before moving to DLQ */
const MAX_RETRIES = 3;

/** Dead letter queue key prefix */
const DLQ_PREFIX = "dlq:analytics-sync:";

/** TTL for DLQ entries: 7 days */
const DLQ_TTL_SECONDS = 7 * 24 * 60 * 60;

// =============================================================================
// Key Parsing
// =============================================================================

/**
 * Parse Redis key into components.
 *
 * Supports keys like:
 * - block:{blockId}:variant:{variantId}:views
 * - block:{blockId}:variant:{variantId}:conversions
 *
 * @param key - Redis key
 * @returns Parsed components or null if invalid
 */
function parseRedisKey(key: string): ParsedKey | null {
  // Match: block:{blockId}:variant:{variantId}:{metric}
  const variantMatch = key.match(
    /^block:([^:]+):variant:([^:]+):(views|conversions)$/
  );

  if (variantMatch) {
    return {
      blockId: variantMatch[1],
      variantId: variantMatch[2],
      metric: variantMatch[3] as "views" | "conversions",
    };
  }

  return null;
}

// =============================================================================
// SCAN Helper
// =============================================================================

/**
 * Scan Redis for analytics keys using cursor iteration.
 *
 * @param pattern - Key pattern to match
 * @returns Array of matching keys
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];

  const stream = redis.scanStream({
    match: pattern,
    count: 100,
  });

  return new Promise((resolve, reject) => {
    stream.on("data", (batch: string[]) => {
      keys.push(...batch);
    });

    stream.on("end", () => {
      resolve(keys);
    });

    stream.on("error", (err: Error) => {
      logger.error("[analytics-sync] SCAN error", { error: err.message });
      reject(err);
    });
  });
}

// =============================================================================
// Dead Letter Queue Helpers
// =============================================================================

/**
 * Get the retry count for a variant from Redis.
 *
 * @param variantId - Variant ID
 * @returns Current retry count
 */
async function getRetryCount(variantId: string): Promise<number> {
  const count = await redis.get(`${DLQ_PREFIX}retry:${variantId}`);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Increment retry count for a variant.
 *
 * @param variantId - Variant ID
 * @returns New retry count
 */
async function incrementRetryCount(variantId: string): Promise<number> {
  const key = `${DLQ_PREFIX}retry:${variantId}`;
  const count = await redis.incr(key);
  await redis.expire(key, DLQ_TTL_SECONDS);
  return count;
}

/**
 * Clear retry count for a variant after successful sync.
 *
 * @param variantId - Variant ID
 */
async function clearRetryCount(variantId: string): Promise<void> {
  await redis.del(`${DLQ_PREFIX}retry:${variantId}`);
}

/**
 * Move failed analytics data to the dead letter queue.
 *
 * Stores the failed data with metadata for later inspection/replay.
 *
 * @param variantId - Variant ID
 * @param blockId - Block ID
 * @param data - Failed update data
 * @param error - Error message
 */
async function moveToDeadLetterQueue(
  variantId: string,
  blockId: string,
  data: { impressionsDelta: number; conversionsDelta: number },
  error: string
): Promise<void> {
  const dlqEntry = {
    variantId,
    blockId,
    impressionsDelta: data.impressionsDelta,
    conversionsDelta: data.conversionsDelta,
    error,
    failedAt: new Date().toISOString(),
    retryCount: MAX_RETRIES,
  };

  const dlqKey = `${DLQ_PREFIX}failed:${variantId}:${Date.now()}`;
  await redis.setex(dlqKey, DLQ_TTL_SECONDS, JSON.stringify(dlqEntry));

  // Clear retry counter since we moved to DLQ
  await redis.del(`${DLQ_PREFIX}retry:${variantId}`);

  logger.warn("[analytics-sync] Moved to dead letter queue", {
    variantId,
    blockId,
    impressionsDelta: data.impressionsDelta,
    conversionsDelta: data.conversionsDelta,
    error,
  });
}

// =============================================================================
// Core Sync Function
// =============================================================================

/**
 * Sync Redis analytics counters to Postgres.
 *
 * Uses GETSET pattern to atomically read and reset counters:
 * 1. GETSET key 0 - Gets current value and sets to 0 atomically
 * 2. Parse value and update Postgres
 * 3. If DB update fails, restore Redis value
 *
 * This ensures no data loss even during sync.
 *
 * @returns Sync result with statistics
 */
export async function syncAnalytics(): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    keysProcessed: 0,
    updatesPerformed: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    // Scan for view keys
    const viewKeys = await scanKeys("block:*:variant:*:views");
    const conversionKeys = await scanKeys("block:*:variant:*:conversions");
    const allKeys = [...viewKeys, ...conversionKeys];

    logger.debug("[analytics-sync] Found keys to sync", {
      viewKeys: viewKeys.length,
      conversionKeys: conversionKeys.length,
    });

    // Group updates by variant for batching
    // Track blockId per variant for proper key restoration on failure
    const variantUpdates = new Map<
      string,
      { blockId: string; impressionsDelta: number; conversionsDelta: number }
    >();

    // Process each key with GETSET
    for (const key of allKeys) {
      try {
        // Atomic read and reset
        const value = await redis.getset(key, "0");

        if (value === null || value === "0") {
          result.keysProcessed++;
          continue;
        }

        const delta = parseInt(value, 10);
        if (isNaN(delta) || delta === 0) {
          result.keysProcessed++;
          continue;
        }

        const parsed = parseRedisKey(key);
        if (!parsed) {
          logger.warn("[analytics-sync] Invalid key format", { key });
          result.keysProcessed++;
          continue;
        }

        // Accumulate updates per variant (store blockId for key restoration)
        const existing = variantUpdates.get(parsed.variantId) || {
          blockId: parsed.blockId,
          impressionsDelta: 0,
          conversionsDelta: 0,
        };

        if (parsed.metric === "views") {
          existing.impressionsDelta += delta;
        } else {
          existing.conversionsDelta += delta;
        }

        variantUpdates.set(parsed.variantId, existing);
        result.keysProcessed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Key ${key}: ${errorMsg}`);
      }
    }

    // Batch update Postgres
    const variantIds = Array.from(variantUpdates.keys());

    for (let i = 0; i < variantIds.length; i += BATCH_SIZE) {
      const batch = variantIds.slice(i, i + BATCH_SIZE);

      for (const variantId of batch) {
        const updates = variantUpdates.get(variantId)!;

        try {
          // Use SQL increment to avoid race conditions
          await db
            .update(blockVariants)
            .set({
              impressions: sql`${blockVariants.impressions} + ${updates.impressionsDelta}`,
              conversions: sql`${blockVariants.conversions} + ${updates.conversionsDelta}`,
            })
            .where(eq(blockVariants.id, variantId));

          result.updatesPerformed++;

          // Clear retry count on success
          await clearRetryCount(variantId);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Variant ${variantId}: ${errorMsg}`);

          const failedUpdates = variantUpdates.get(variantId)!;

          // Check retry count and decide: restore to Redis or move to DLQ
          const retryCount = await incrementRetryCount(variantId);

          if (retryCount >= MAX_RETRIES) {
            // Max retries exceeded - move to dead letter queue
            await moveToDeadLetterQueue(
              variantId,
              failedUpdates.blockId,
              {
                impressionsDelta: failedUpdates.impressionsDelta,
                conversionsDelta: failedUpdates.conversionsDelta,
              },
              errorMsg
            );
          } else {
            // Restore Redis values for retry on next sync cycle
            logger.warn("[analytics-sync] DB update failed, will retry", {
              variantId,
              retryCount,
              maxRetries: MAX_RETRIES,
              error: errorMsg,
            });

            if (failedUpdates.impressionsDelta > 0) {
              await redis.incrby(
                `block:${failedUpdates.blockId}:variant:${variantId}:views`,
                failedUpdates.impressionsDelta
              );
            }
            if (failedUpdates.conversionsDelta > 0) {
              await redis.incrby(
                `block:${failedUpdates.blockId}:variant:${variantId}:conversions`,
                failedUpdates.conversionsDelta
              );
            }
          }
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Sync failed: ${errorMsg}`);
    logger.error("[analytics-sync] Sync failed", { error: errorMsg });
  }

  result.durationMs = Date.now() - startTime;

  logger.info("[analytics-sync] Sync complete", {
    keysProcessed: result.keysProcessed,
    updatesPerformed: result.updatesPerformed,
    errorCount: result.errors.length,
    durationMs: result.durationMs,
  });

  return result;
}

// =============================================================================
// DLQ Inspection
// =============================================================================

/**
 * Dead letter queue entry structure.
 */
export interface DLQEntry {
  variantId: string;
  blockId: string;
  impressionsDelta: number;
  conversionsDelta: number;
  error: string;
  failedAt: string;
  retryCount: number;
}

/**
 * Get all entries in the dead letter queue.
 *
 * Useful for monitoring and manual intervention.
 *
 * @returns Array of DLQ entries
 */
export async function getDeadLetterQueueEntries(): Promise<DLQEntry[]> {
  const keys = await scanKeys(`${DLQ_PREFIX}failed:*`);
  const entries: DLQEntry[] = [];

  for (const key of keys) {
    const value = await redis.get(key);
    if (value) {
      try {
        entries.push(JSON.parse(value) as DLQEntry);
      } catch {
        logger.warn("[analytics-sync] Invalid DLQ entry", { key });
      }
    }
  }

  return entries;
}

/**
 * Get the count of entries in the dead letter queue.
 *
 * @returns Number of DLQ entries
 */
export async function getDeadLetterQueueCount(): Promise<number> {
  const keys = await scanKeys(`${DLQ_PREFIX}failed:*`);
  return keys.length;
}

// =============================================================================
// Worker Management
// =============================================================================

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Analytics sync worker that runs every 5 minutes.
 */
export const analyticsSyncWorker = {
  /**
   * Start the sync worker.
   */
  start(): void {
    if (syncInterval) {
      logger.warn("[analytics-sync] Worker already running");
      return;
    }

    logger.info("[analytics-sync] Starting worker", {
      intervalMs: SYNC_INTERVAL_MS,
    });

    syncInterval = setInterval(async () => {
      if (isRunning) {
        logger.warn("[analytics-sync] Previous sync still running, skipping");
        return;
      }

      isRunning = true;
      try {
        await syncAnalytics();
      } finally {
        isRunning = false;
      }
    }, SYNC_INTERVAL_MS);

    // Run initial sync after 10 seconds
    setTimeout(() => {
      if (!isRunning) {
        isRunning = true;
        syncAnalytics().finally(() => {
          isRunning = false;
        });
      }
    }, 10000);
  },

  /**
   * Stop the sync worker.
   */
  stop(): void {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
      logger.info("[analytics-sync] Worker stopped");
    }
  },

  /**
   * Check if worker is running.
   */
  isRunning(): boolean {
    return syncInterval !== null;
  },
};
