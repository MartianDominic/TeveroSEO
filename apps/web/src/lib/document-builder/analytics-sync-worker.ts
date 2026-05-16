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
    const variantUpdates = new Map<
      string,
      { impressionsDelta: number; conversionsDelta: number }
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

        // Accumulate updates per variant
        const existing = variantUpdates.get(parsed.variantId) || {
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
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Variant ${variantId}: ${errorMsg}`);

          // Restore Redis values on DB failure
          const updates2 = variantUpdates.get(variantId)!;
          if (updates2.impressionsDelta > 0) {
            await redis.incrby(
              `block:placeholder:variant:${variantId}:views`,
              updates2.impressionsDelta
            );
          }
          if (updates2.conversionsDelta > 0) {
            await redis.incrby(
              `block:placeholder:variant:${variantId}:conversions`,
              updates2.conversionsDelta
            );
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
