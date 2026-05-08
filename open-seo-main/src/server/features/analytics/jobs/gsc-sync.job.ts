/**
 * GSC Sync Job Queue
 * Phase 96-01 Task 4: BullMQ queue for GSC sync orchestration
 * Phase 96-Queue: Enhanced with rate limiting and DLQ integration
 *
 * Creates queue with:
 * - 50 req/min global rate limiting (respects GSC API limits)
 * - Daily 3 AM UTC repeatable job
 * - Exponential backoff on failures (3 attempts)
 * - DLQ integration for failed jobs
 */

import { Queue } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";

/**
 * Job data for GSC sync jobs.
 */
export interface GscSyncJobData {
  syncType: "full" | "incremental";
  siteId?: string; // Optional: sync specific site only
}

/**
 * Job result returned after sync completes.
 */
export interface GscSyncJobResult {
  sitesProcessed: number;
  totalRowsInserted: number;
  errors: string[];
  durationMs: number;
}

/**
 * GSC API rate limit configuration.
 * Google Search Console API allows 1200 queries/min per project,
 * but we use a conservative 50/min to leave headroom for other services.
 */
export const GSC_RATE_LIMIT = {
  max: 50, // Maximum requests per duration
  duration: 60000, // Duration in ms (1 minute)
} as const;

/**
 * Job priority levels for BullMQ.
 * BMQ-003 FIX: Explicit priority levels for job ordering.
 * Lower number = higher priority (1 is highest).
 */
export const JOB_PRIORITY = {
  HIGH: 1,    // Critical jobs: GSC sync, GA4 sync
  MEDIUM: 2,  // Important jobs: Trend calculation, analytics
  LOW: 3,     // Maintenance jobs: DLQ cleanup, cache cleanup
} as const;

/**
 * GSC sync queue with rate limiting and retry configuration.
 *
 * Rate limiting is enforced at the worker level (see gsc-sync.worker.ts),
 * but we define the constants here for consistency.
 *
 * BMQ-003 FIX: HIGH priority (1) for critical data sync jobs.
 */
export const gscSyncQueue = new Queue<GscSyncJobData, GscSyncJobResult>("gsc-sync", {
  connection: getSharedBullMQConnection("queue:gsc-sync"),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 }, // 24 hours, keep 1000 recent
    removeOnFail: { age: 604800, count: 5000 }, // 7 days, keep 5000 recent
    priority: JOB_PRIORITY.HIGH, // BMQ-003: Critical sync jobs get highest priority
  },
});

/**
 * Schedule daily full GSC sync at 2:15 AM UTC.
 * Idempotent: Uses jobId to prevent duplicate repeatable jobs.
 *
 * SCRAPE-03 FIX: Staggered from 3 AM to 2:15 AM to prevent collision with
 * other jobs (GA4 at 2:30, trend at 2:45, analytics at 3:00).
 *
 * QUEUE-04 FIX: Uses date-based jobId for deduplication - prevents multiple
 * concurrent syncs for the same day.
 *
 * NOTE: This scheduler is now managed by the centralized queue-scheduler.ts.
 * This function is kept for backward compatibility.
 */
export async function scheduleGscSync(): Promise<void> {
  const dateStr = new Date().toISOString().split("T")[0];
  await gscSyncQueue.add(
    "full-sync",
    { syncType: "full" },
    {
      repeat: {
        pattern: "15 2 * * *", // 2:15 AM UTC daily (SCRAPE-03 fix)
        tz: "UTC",
      },
      jobId: `gsc-sync:system:${dateStr}`, // QUEUE-04 fix: date-based deduplication
    }
  );
}
