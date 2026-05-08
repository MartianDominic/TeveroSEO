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
 * Job priority levels for BullMQ.
 * BMQ-003 FIX: Explicit priority levels for job ordering.
 * Lower number = higher priority (1 is highest).
 */
const JOB_PRIORITY = {
  HIGH: 1,    // Critical jobs: GSC sync, GA4 sync
  MEDIUM: 2,  // Important jobs: Trend calculation, analytics
  LOW: 3,     // Maintenance jobs: DLQ cleanup, cache cleanup
} as const;

/**
 * Default job options.
 * 3 attempts with exponential backoff.
 * BMQ-003 FIX: LOW priority for maintenance jobs.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5_000, // 5s, 10s, 20s
  },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
  priority: JOB_PRIORITY.LOW, // BMQ-003: Maintenance jobs run at low priority
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
 * - Cache cleanup runs daily at 4 AM
 *
 * SCRAPE-03 FIX: Moved from 3 AM to 4 AM to prevent collision with
 * analytics jobs (GSC 2:15, GA4 2:30, trend 2:45, analytics 3:00,
 * cannibalization 3:15, content-audit 3:30).
 *
 * NOTE: This scheduler is now managed by the centralized queue-scheduler.ts.
 * This function is kept for backward compatibility.
 */
export async function initMaintenanceQueue(): Promise<void> {
  const dateStr = new Date().toISOString().split("T")[0];

  // Add repeatable cache cleanup job (daily at 4 AM)
  await maintenanceQueue.add(
    "cache-cleanup",
    { triggeredAt: new Date().toISOString() },
    {
      repeat: {
        pattern: "0 4 * * *", // Daily at 4 AM (SCRAPE-03 fix)
      },
      jobId: `maintenance:system:${dateStr}`, // QUEUE-04 fix: date-based deduplication
    },
  );

  // Remove any stale repeatable jobs (including old 3 AM jobs)
  const repeatableJobs = await maintenanceQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    // Remove legacy schedulers with old patterns
    if (job.id === "cache-cleanup-daily" || job.pattern === "0 3 * * *") {
      await maintenanceQueue.removeRepeatableByKey(job.key);
      log.info("Removed legacy maintenance scheduler", { key: job.key, pattern: job.pattern });
    }
  }

  log.info("Maintenance queue initialized with daily cache cleanup job", { schedule: "04:00 UTC" });
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
