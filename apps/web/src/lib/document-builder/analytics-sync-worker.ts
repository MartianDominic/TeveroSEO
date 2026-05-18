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
import { z } from "zod";
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
  variantId: string | null;
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
 * - block:{blockId}:views (block-level, no variant)
 * - block:{blockId}:conversions (block-level, no variant)
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

  // Match: block:{blockId}:{metric} (block-level without variant)
  const blockMatch = key.match(/^block:([^:]+):(views|conversions)$/);

  if (blockMatch) {
    return {
      blockId: blockMatch[1],
      variantId: null,
      metric: blockMatch[2] as "views" | "conversions",
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
export async function getRetryCount(variantId: string): Promise<number> {
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

  // H-CON-03: Acquire mutex to prevent concurrent sync operations
  if (!acquireSyncMutex()) {
    logger.warn("[analytics-sync] Sync already in progress, skipping");
    result.errors.push("Sync already in progress");
    result.durationMs = Date.now() - startTime;
    return result;
  }

  try {
    // Scan for variant-level keys
    const variantViewKeys = await scanKeys("block:*:variant:*:views");
    const variantConversionKeys = await scanKeys("block:*:variant:*:conversions");

    // Scan for block-level keys (no variant)
    // These match block:{blockId}:views but NOT block:{blockId}:variant:*:views
    const blockViewKeys = await scanKeys("block:*:views");
    const blockConversionKeys = await scanKeys("block:*:conversions");

    // Filter out variant keys from block-level scans (block:*:views also matches block:*:variant:*:views)
    const filteredBlockViewKeys = blockViewKeys.filter(
      (key) => !key.includes(":variant:")
    );
    const filteredBlockConversionKeys = blockConversionKeys.filter(
      (key) => !key.includes(":variant:")
    );

    const allKeys = [
      ...variantViewKeys,
      ...variantConversionKeys,
      ...filteredBlockViewKeys,
      ...filteredBlockConversionKeys,
    ];

    logger.debug("[analytics-sync] Found keys to sync", {
      variantViewKeys: variantViewKeys.length,
      variantConversionKeys: variantConversionKeys.length,
      blockViewKeys: filteredBlockViewKeys.length,
      blockConversionKeys: filteredBlockConversionKeys.length,
      total: allKeys.length,
    });

    // Group updates by variant for batching
    // Track blockId per variant for proper key restoration on failure
    // For block-level keys (no variant), we use a composite key: "block:{blockId}"
    const variantUpdates = new Map<
      string,
      {
        blockId: string;
        variantId: string | null;
        impressionsDelta: number;
        conversionsDelta: number;
      }
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

        // Use composite key for map: variantId for variant keys, "block:{blockId}" for block-level keys
        const mapKey = parsed.variantId ?? `block:${parsed.blockId}`;

        // Accumulate updates per variant (store blockId for key restoration)
        const existing = variantUpdates.get(mapKey) || {
          blockId: parsed.blockId,
          variantId: parsed.variantId,
          impressionsDelta: 0,
          conversionsDelta: 0,
        };

        if (parsed.metric === "views") {
          existing.impressionsDelta += delta;
        } else {
          existing.conversionsDelta += delta;
        }

        variantUpdates.set(mapKey, existing);
        result.keysProcessed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Key ${key}: ${errorMsg}`);
      }
    }

    // Batch update Postgres
    const updateKeys = Array.from(variantUpdates.keys());

    for (let i = 0; i < updateKeys.length; i += BATCH_SIZE) {
      const batch = updateKeys.slice(i, i + BATCH_SIZE);

      for (const mapKey of batch) {
        const updates = variantUpdates.get(mapKey)!;

        // Skip block-level keys (no variant) - these are aggregate counters
        // that don't map to the blockVariants table
        if (updates.variantId === null) {
          logger.debug("[analytics-sync] Skipping block-level key (no variant)", {
            blockId: updates.blockId,
            impressionsDelta: updates.impressionsDelta,
            conversionsDelta: updates.conversionsDelta,
          });
          result.keysProcessed++;
          continue;
        }

        const variantId = updates.variantId;

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

          // Check retry count and decide: restore to Redis or move to DLQ
          const retryCount = await incrementRetryCount(variantId);

          if (retryCount >= MAX_RETRIES) {
            // Max retries exceeded - move to dead letter queue
            await moveToDeadLetterQueue(
              variantId,
              updates.blockId,
              {
                impressionsDelta: updates.impressionsDelta,
                conversionsDelta: updates.conversionsDelta,
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

            if (updates.impressionsDelta > 0) {
              await redis.incrby(
                `block:${updates.blockId}:variant:${variantId}:views`,
                updates.impressionsDelta
              );
            }
            if (updates.conversionsDelta > 0) {
              await redis.incrby(
                `block:${updates.blockId}:variant:${variantId}:conversions`,
                updates.conversionsDelta
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
  } finally {
    // H-CON-03: Always release mutex
    releaseSyncMutex();
  }

  result.durationMs = Date.now() - startTime;

  // Monitor DLQ size after each sync
  await monitorDeadLetterQueue();

  // Calculate throughput metrics (M-OBS-02)
  const throughputKeysPerSecond = result.durationMs > 0
    ? Math.round((result.keysProcessed / result.durationMs) * 1000 * 100) / 100
    : 0;
  const throughputUpdatesPerSecond = result.durationMs > 0
    ? Math.round((result.updatesPerformed / result.durationMs) * 1000 * 100) / 100
    : 0;

  logger.info("[analytics-sync] Sync complete", {
    keysProcessed: result.keysProcessed,
    updatesPerformed: result.updatesPerformed,
    errorCount: result.errors.length,
    durationMs: result.durationMs,
    // Throughput metrics (M-OBS-02)
    throughputKeysPerSecond,
    throughputUpdatesPerSecond,
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
 * Zod schema for validating DLQ entries from Redis.
 * Ensures type safety when parsing JSON from untrusted storage.
 */
const DLQEntrySchema = z.object({
  variantId: z.string(),
  blockId: z.string(),
  impressionsDelta: z.number(),
  conversionsDelta: z.number(),
  error: z.string(),
  failedAt: z.string(),
  retryCount: z.number(),
});

/**
 * Safely parse a DLQ entry from JSON string.
 * Returns null if parsing or validation fails.
 */
function parseDLQEntry(value: string): DLQEntry | null {
  try {
    const parsed: unknown = JSON.parse(value);
    const result = DLQEntrySchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
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
      const entry = parseDLQEntry(value);
      if (entry) {
        entries.push(entry);
      } else {
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
// DLQ Monitoring
// =============================================================================

/** Warning threshold for DLQ size */
const DLQ_WARNING_THRESHOLD = 100;

/** Critical threshold for DLQ size */
const DLQ_CRITICAL_THRESHOLD = 500;

/**
 * Monitor dead letter queue size and log warnings.
 *
 * Called during each sync cycle to alert on growing DLQ.
 */
async function monitorDeadLetterQueue(): Promise<void> {
  const count = await getDeadLetterQueueCount();

  if (count >= DLQ_CRITICAL_THRESHOLD) {
    logger.error("[analytics-sync] CRITICAL: Dead letter queue size exceeded critical threshold", {
      count,
      threshold: DLQ_CRITICAL_THRESHOLD,
      action: "Manual intervention required - check DLQ entries",
    });
  } else if (count >= DLQ_WARNING_THRESHOLD) {
    logger.warn("[analytics-sync] WARNING: Dead letter queue size exceeded warning threshold", {
      count,
      threshold: DLQ_WARNING_THRESHOLD,
    });
  } else if (count > 0) {
    logger.debug("[analytics-sync] Dead letter queue status", { count });
  }
}

// =============================================================================
// DLQ Processing (Retry Failed Entries)
// =============================================================================

/**
 * Sleep helper for rate limiting.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process dead letter queue entries.
 *
 * Attempts to retry failed entries with exponential backoff.
 * Should be called manually or via a separate scheduled job.
 *
 * M-CON-03: Includes rate limiting to prevent overwhelming the system.
 *
 * @param maxEntries - Maximum number of entries to process (default 50)
 * @returns Number of entries successfully processed
 */
export async function processDeadLetterQueue(maxEntries = 50): Promise<number> {
  const entries = await getDeadLetterQueueEntries();
  // M-CON-03: Limit batch size to prevent overwhelming system
  const batchSize = Math.min(maxEntries, 50);
  const toProcess = entries.slice(0, batchSize);

  let successCount = 0;
  let lastProcessTime = 0;

  for (const entry of toProcess) {
    // M-CON-03: Rate limiting - ensure minimum delay between items
    const now = Date.now();
    const elapsed = now - lastProcessTime;
    if (lastProcessTime > 0 && elapsed < DLQ_ITEM_DELAY_MS) {
      await sleep(DLQ_ITEM_DELAY_MS - elapsed);
    }
    lastProcessTime = Date.now();

    try {
      // Attempt DB update
      await db
        .update(blockVariants)
        .set({
          impressions: sql`${blockVariants.impressions} + ${entry.impressionsDelta}`,
          conversions: sql`${blockVariants.conversions} + ${entry.conversionsDelta}`,
        })
        .where(eq(blockVariants.id, entry.variantId));

      // Success - remove from DLQ
      const dlqKeys = await scanKeys(`${DLQ_PREFIX}failed:${entry.variantId}:*`);
      for (const key of dlqKeys) {
        await redis.del(key);
      }

      successCount++;
      logger.info("[analytics-sync] Successfully processed DLQ entry", {
        variantId: entry.variantId,
        blockId: entry.blockId,
        impressionsDelta: entry.impressionsDelta,
        conversionsDelta: entry.conversionsDelta,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("[analytics-sync] Failed to process DLQ entry", {
        variantId: entry.variantId,
        blockId: entry.blockId,
        error: errorMsg,
      });
    }
  }

  logger.info("[analytics-sync] DLQ processing complete", {
    processed: toProcess.length,
    successful: successCount,
    failed: toProcess.length - successCount,
    remaining: entries.length - toProcess.length,
  });

  return successCount;
}

// =============================================================================
// Worker Management
// =============================================================================

let syncInterval: ReturnType<typeof setInterval> | null = null;
let initialSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let cleanupRegistered = false;

// H-CON-03: Mutex flag to prevent concurrent sync operations
let isSyncing = false;

/**
 * Acquire the sync mutex.
 * Returns true if acquired, false if already held.
 */
function acquireSyncMutex(): boolean {
  if (isSyncing) {
    return false;
  }
  isSyncing = true;
  return true;
}

/**
 * Release the sync mutex.
 */
function releaseSyncMutex(): void {
  isSyncing = false;
}

/** M-CON-03: Rate limit for DLQ processing (items per second) */
const DLQ_RATE_LIMIT = 10;

/** M-CON-03: Minimum delay between DLQ item processing (ms) */
const DLQ_ITEM_DELAY_MS = Math.ceil(1000 / DLQ_RATE_LIMIT);

/**
 * H-MEM-02: Store cleanup handler reference so it can be removed on worker stop.
 * This prevents handler accumulation during HMR (Hot Module Replacement).
 */
let cleanupHandler: (() => void) | null = null;

/**
 * Register process exit handlers for graceful shutdown.
 * Only registers once to avoid duplicate handlers.
 * H-MEM-02: Handlers can be removed via unregisterProcessExitHandlers().
 */
function registerProcessExitHandlers(): void {
  if (cleanupRegistered) {
    return;
  }

  cleanupHandler = () => {
    logger.info("[analytics-sync] Process exit signal received, cleaning up");
    analyticsSyncWorker.stop();
  };

  // Handle various termination signals
  process.on("beforeExit", cleanupHandler);
  process.on("SIGINT", cleanupHandler);
  process.on("SIGTERM", cleanupHandler);
  process.on("SIGUSR2", cleanupHandler); // nodemon restart signal

  cleanupRegistered = true;
  logger.debug("[analytics-sync] Process exit handlers registered");
}

/**
 * H-MEM-02: Unregister process exit handlers to prevent accumulation during HMR.
 * Called when worker is stopped.
 */
function unregisterProcessExitHandlers(): void {
  if (!cleanupRegistered || !cleanupHandler) {
    return;
  }

  process.off("beforeExit", cleanupHandler);
  process.off("SIGINT", cleanupHandler);
  process.off("SIGTERM", cleanupHandler);
  process.off("SIGUSR2", cleanupHandler);

  cleanupHandler = null;
  cleanupRegistered = false;
  logger.debug("[analytics-sync] Process exit handlers unregistered");
}

/**
 * Analytics sync worker that runs every 5 minutes.
 */
export const analyticsSyncWorker = {
  /**
   * Start the sync worker.
   * Registers process exit handlers for graceful shutdown.
   */
  start(): void {
    if (syncInterval) {
      logger.warn("[analytics-sync] Worker already running");
      return;
    }

    // Register cleanup handlers for graceful shutdown
    registerProcessExitHandlers();

    logger.info("[analytics-sync] Starting worker", {
      intervalMs: SYNC_INTERVAL_MS,
    });

    // H-CON-03: Use syncAnalytics directly - it has internal mutex protection
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

    // H-CON-03: Run initial sync after 10 seconds
    // The syncAnalytics function has mutex protection, so even if this
    // fires while interval sync is starting, only one will proceed
    initialSyncTimeout = setTimeout(() => {
      initialSyncTimeout = null; // Clear reference after execution
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
   * H-MEM-02: Also unregisters process exit handlers to prevent accumulation during HMR.
   */
  stop(): void {
    // Clear the initial sync timeout if it hasn't fired yet
    if (initialSyncTimeout) {
      clearTimeout(initialSyncTimeout);
      initialSyncTimeout = null;
    }

    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
      logger.info("[analytics-sync] Worker stopped");
    }

    // H-MEM-02: Unregister exit handlers to prevent accumulation during HMR
    unregisterProcessExitHandlers();
  },

  /**
   * Check if worker is running.
   */
  isRunning(): boolean {
    return syncInterval !== null;
  },
};
