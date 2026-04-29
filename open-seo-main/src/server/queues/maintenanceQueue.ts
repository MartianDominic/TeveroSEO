/**
 * BullMQ Queue definition for maintenance tasks.
 *
 * - `maintenanceQueue` - queue for system maintenance jobs
 * - Runs daily maintenance tasks like cache cleanup
 *
 * Job types:
 * - cache-cleanup: Clean up expired cache files
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "maintenanceQueue" });

export const MAINTENANCE_QUEUE_NAME = "maintenance" as const;

/**
 * Job data for cache cleanup.
 */
export interface CacheCleanupJobData {
  triggeredAt: string; // ISO timestamp
}

/**
 * Default job options.
 * 3 attempts with exponential backoff.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5_000, // 5s, 10s, 20s
  },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};

/**
 * Maintenance queue.
 * Uses shared BullMQ connection for Redis.
 */
export const maintenanceQueue = new Queue<CacheCleanupJobData>(
  MAINTENANCE_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:maintenance"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Initialize the maintenance queue with repeatable jobs.
 * - Cache cleanup runs daily at 3 AM
 */
export async function initMaintenanceQueue(): Promise<void> {
  // Add repeatable cache cleanup job (daily at 3 AM)
  await maintenanceQueue.add(
    "cache-cleanup",
    { triggeredAt: new Date().toISOString() },
    {
      repeat: {
        pattern: "0 3 * * *", // Daily at 3 AM
      },
      jobId: "cache-cleanup-daily",
    },
  );

  // Remove any stale repeatable jobs
  const repeatableJobs = await maintenanceQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id !== "cache-cleanup-daily") {
      await maintenanceQueue.removeRepeatableByKey(job.key);
    }
  }

  log.info("Maintenance queue initialized with daily cache cleanup job");
}

/**
 * Manually trigger a cache cleanup.
 * Useful for testing or immediate cleanup.
 */
export async function triggerCacheCleanup(): Promise<void> {
  await maintenanceQueue.add(
    "cache-cleanup",
    { triggeredAt: new Date().toISOString() },
    {
      jobId: `manual-cleanup-${Date.now()}`,
    },
  );
  log.info("Manual cache cleanup triggered");
}
