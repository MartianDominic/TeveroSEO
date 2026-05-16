/**
 * Analytics Sync Worker for Document Builder
 * Phase 102-04: Analytics Pipeline and Heatmap Visualization
 *
 * BullMQ repeatable job that syncs Redis counters to Postgres every 5 minutes (per D-04).
 *
 * Process:
 * 1. Scans Redis keys matching block:*:views
 * 2. For each key:
 *    - GETSET to atomically read and reset counter
 *    - UPDATE Postgres persuasionBlocks.viewCount or blockVariants.impressions
 * 3. Logs sync stats (blocks updated, total impressions synced)
 */

import { Worker, Queue, type Job } from "bullmq";
import { createLogger } from "@/server/lib/logger";
import {
  redis,
  getSharedBullMQConnection,
  WORKER_CONCURRENCY_LIMITS,
} from "@/server/lib/redis";
import { db } from "@/db";
import { sql } from "drizzle-orm";

// =============================================================================
// Constants
// =============================================================================

const QUEUE_NAME = "document-builder-analytics-sync";
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes per D-04
const LOCK_DURATION_MS = 120_000; // 2 minutes
const MAX_STALLED_COUNT = 2;

const workerLog = createLogger({ module: "analytics-sync-worker" });

// =============================================================================
// Types
// =============================================================================

interface SyncJobData {
  triggeredAt: number;
}

interface SyncStats {
  blocksUpdated: number;
  impressionsSynced: number;
  dwellTimeSynced: number;
  variantsUpdated: number;
  duration: number;
}

// =============================================================================
// Queue Setup
// =============================================================================

let queue: Queue<SyncJobData> | null = null;
let worker: Worker<SyncJobData> | null = null;

/**
 * Get or create the analytics sync queue.
 */
export function getAnalyticsSyncQueue(): Queue<SyncJobData> {
  if (queue) return queue;

  queue = new Queue<SyncJobData>(QUEUE_NAME, {
    connection: getSharedBullMQConnection("queue:analytics-sync"),
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  });

  return queue;
}

/**
 * Schedule the repeatable sync job.
 *
 * Call this on application startup to ensure the sync job runs every 5 minutes.
 */
export async function scheduleAnalyticsSync(): Promise<void> {
  const q = getAnalyticsSyncQueue();

  // Remove existing repeatable jobs first to avoid duplicates
  const repeatableJobs = await q.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === "sync") {
      await q.removeRepeatableByKey(job.key);
    }
  }

  // Schedule new repeatable job - every 5 minutes per D-04
  await q.add(
    "sync",
    { triggeredAt: Date.now() },
    {
      repeat: {
        every: SYNC_INTERVAL_MS,
      },
      jobId: "analytics-sync-repeatable",
    }
  );

  workerLog.info("Analytics sync job scheduled", {
    intervalMs: SYNC_INTERVAL_MS,
    intervalMinutes: SYNC_INTERVAL_MS / 60000,
  });
}

// =============================================================================
// Worker
// =============================================================================

/**
 * Start the analytics sync worker.
 */
export function startAnalyticsSyncWorker(): Worker<SyncJobData> {
  if (worker) return worker;

  worker = new Worker<SyncJobData>(
    QUEUE_NAME,
    async (job: Job<SyncJobData>) => {
      const jobLog = createLogger({
        module: "analytics-sync-worker",
        jobId: job.id,
      });

      jobLog.info("Starting analytics sync");
      const startTime = Date.now();

      try {
        const stats = await syncAnalyticsToPostgres();

        jobLog.info("Analytics sync completed", {
          ...stats,
          durationMs: Date.now() - startTime,
        });

        return stats;
      } catch (error) {
        jobLog.error(
          "Analytics sync failed",
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    },
    {
      connection: getSharedBullMQConnection("worker:analytics-sync"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1, // Single concurrent sync to avoid race conditions
    }
  );

  worker.on("ready", () => {
    workerLog.info("Worker ready", { queue: QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLog.error(
      "Worker error",
      err instanceof Error ? err : new Error(String(err))
    );
  });

  worker.on("completed", (job) => {
    workerLog.info("Job completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    workerLog.error("Job failed", err instanceof Error ? err : new Error(String(err)), {
      jobId: job?.id,
    });
  });

  return worker;
}

/**
 * Stop the analytics sync worker.
 */
export async function stopAnalyticsSyncWorker(): Promise<void> {
  if (!worker) return;

  const current = worker;
  worker = null;

  try {
    await current.close();
    workerLog.info("Worker stopped");
  } catch (error) {
    workerLog.error(
      "Error stopping worker",
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

// =============================================================================
// Sync Logic
// =============================================================================

/**
 * Sync analytics data from Redis to Postgres.
 *
 * Uses GETSET to atomically read and reset counters.
 */
async function syncAnalyticsToPostgres(): Promise<SyncStats> {
  const stats: SyncStats = {
    blocksUpdated: 0,
    impressionsSynced: 0,
    dwellTimeSynced: 0,
    variantsUpdated: 0,
    duration: 0,
  };

  const startTime = Date.now();

  // 1. Sync view counters
  const viewKeys = await scanKeys("block:*:views");
  for (const key of viewKeys) {
    // Skip time-series keys
    if (key.endsWith(":ts")) continue;

    // GETSET atomically reads and resets
    const countStr = await redis.getset(key, "0");
    const count = parseInt(countStr || "0", 10);

    if (count > 0) {
      const { blockId, variantId } = parseKey(key);

      if (variantId) {
        // Update variant impressions
        await updateVariantImpressions(variantId, count);
        stats.variantsUpdated++;
      } else if (blockId) {
        // Update block view count
        await updateBlockViewCount(blockId, count);
        stats.blocksUpdated++;
      }

      stats.impressionsSynced += count;
    }
  }

  // 2. Sync dwell time counters
  const dwellKeys = await scanKeys("block:*:dwell");
  for (const key of dwellKeys) {
    // Skip dwell count keys
    if (key.endsWith(":count")) continue;

    const dwellStr = await redis.getset(key, "0");
    const dwellMs = parseInt(dwellStr || "0", 10);

    if (dwellMs > 0) {
      const { blockId, variantId } = parseKey(key);

      if (blockId) {
        await updateBlockDwellTime(blockId, variantId, dwellMs);
        stats.dwellTimeSynced += dwellMs;
      }
    }
  }

  // 3. Sync conversion counters
  const conversionKeys = await scanKeys("block:*:conversions");
  for (const key of conversionKeys) {
    const countStr = await redis.getset(key, "0");
    const count = parseInt(countStr || "0", 10);

    if (count > 0) {
      const { blockId, variantId } = parseKey(key);

      if (variantId) {
        await updateVariantConversions(variantId, count);
      }
    }
  }

  stats.duration = Date.now() - startTime;
  return stats;
}

/**
 * Scan Redis keys matching a pattern using SCAN (production-safe).
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  return keys;
}

/**
 * Parse a Redis key to extract blockId and variantId.
 */
function parseKey(key: string): { blockId: string | null; variantId: string | null } {
  // Pattern: block:{blockId}:views or block:{blockId}:variant:{variantId}:views
  const parts = key.split(":");

  if (parts.length >= 2 && parts[0] === "block") {
    const blockId = parts[1];

    if (parts.length >= 4 && parts[2] === "variant") {
      return { blockId, variantId: parts[3] };
    }

    return { blockId, variantId: null };
  }

  return { blockId: null, variantId: null };
}

/**
 * Update block view count in Postgres.
 */
async function updateBlockViewCount(blockId: string, increment: number): Promise<void> {
  try {
    // Use raw SQL for atomic increment (persuasion_blocks table from 102-01)
    await db.execute(sql`
      UPDATE persuasion_blocks
      SET view_count = view_count + ${increment}
      WHERE id = ${blockId}::uuid
    `);
  } catch (error) {
    workerLog.error("Failed to update block view count", error instanceof Error ? error : new Error(String(error)), {
      blockId,
      increment,
    });
  }
}

/**
 * Update variant impressions in Postgres.
 */
async function updateVariantImpressions(variantId: string, increment: number): Promise<void> {
  try {
    // block_variants table from 102-01
    await db.execute(sql`
      UPDATE block_variants
      SET impressions = impressions + ${increment}
      WHERE id = ${variantId}::uuid
    `);
  } catch (error) {
    workerLog.error("Failed to update variant impressions", error instanceof Error ? error : new Error(String(error)), {
      variantId,
      increment,
    });
  }
}

/**
 * Update variant conversions in Postgres.
 */
async function updateVariantConversions(variantId: string, increment: number): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE block_variants
      SET conversions = conversions + ${increment}
      WHERE id = ${variantId}::uuid
    `);
  } catch (error) {
    workerLog.error("Failed to update variant conversions", error instanceof Error ? error : new Error(String(error)), {
      variantId,
      increment,
    });
  }
}

/**
 * Update block dwell time in Postgres.
 */
async function updateBlockDwellTime(
  blockId: string,
  variantId: string | null,
  incrementMs: number
): Promise<void> {
  try {
    if (variantId) {
      // Update variant-specific dwell time
      await db.execute(sql`
        UPDATE block_variants
        SET dwell_time_ms = COALESCE(dwell_time_ms, 0) + ${incrementMs}
        WHERE id = ${variantId}::uuid
      `);
    } else {
      // Update block-level dwell time
      await db.execute(sql`
        UPDATE persuasion_blocks
        SET dwell_time_ms = COALESCE(dwell_time_ms, 0) + ${incrementMs}
        WHERE id = ${blockId}::uuid
      `);
    }
  } catch (error) {
    workerLog.error("Failed to update dwell time", error instanceof Error ? error : new Error(String(error)), {
      blockId,
      variantId,
      incrementMs,
    });
  }
}

// =============================================================================
// Exports
// =============================================================================

export const analyticsSyncWorker = {
  start: startAnalyticsSyncWorker,
  stop: stopAnalyticsSyncWorker,
  schedule: scheduleAnalyticsSync,
  getQueue: getAnalyticsSyncQueue,
};
