/**
 * BullMQ Queue definitions for the analytics sync system.
 *
 * - `analyticsQueue` - primary queue for analytics sync jobs
 * - `initAnalyticsScheduler` - sets up nightly cron via upsertJobScheduler
 *
 * Job types:
 * - sync-all-clients: Master job that fans out to per-client jobs
 * - sync-client-analytics: Per-client sync (GSC + GA4)
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  addJobWithBackpressure,
  generateJobId,
  QueueBackpressureError,
} from "@/server/lib/queue-utils";

const log = createLogger({ module: "analyticsQueue" });

export const ANALYTICS_QUEUE_NAME = "analytics-sync" as const;

/**
 * Sync stage for checkpoint-based progress tracking.
 * Stages are processed in order: gsc -> queries -> ga4 -> complete
 */
export type SyncStage = "gsc" | "queries" | "ga4" | "complete";

/**
 * Progress checkpoint for resumable job processing.
 * Stored in job data so jobs can resume from last successful chunk on retry.
 */
export interface SyncProgress {
  stage: SyncStage;
  chunksCompleted: number;
}

export interface AnalyticsSyncJobData {
  clientId: string;
  provider: "google";
  mode: "incremental" | "backfill";
  /** Checkpoint for resuming from last successful chunk on retry */
  progress?: SyncProgress;
}

export interface SyncAllClientsJobData {
  mode: "incremental" | "backfill";
}

/**
 * Dead-letter queue job data for failed analytics sync jobs.
 * Jobs moved here after exhausting all retry attempts for manual inspection.
 */
export interface AnalyticsDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: AnalyticsSyncJobData | SyncAllClientsJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options for analytics sync.
 * Job timeout is controlled via Worker lockDuration (set to 120s in analytics-worker.ts).
 *
 * NOTE: Analytics queue intentionally uses longer retry delays (10s base) than the
 * standard configuration (1s base). This is because:
 * - Analytics sync calls Google APIs (GSC, GA4) with strict rate limits
 * - Google APIs may throttle requests, requiring longer backoff windows
 * - Backfill operations process large datasets that benefit from spaced retries
 *
 * See queue-utils.ts for the standard retry configuration used by internal queues.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s (longer delays for Google API rate limits)
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export const analyticsQueue = new Queue<
  AnalyticsSyncJobData | SyncAllClientsJobData | AnalyticsDLQJobData
>(ANALYTICS_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:analytics"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Initialize the nightly analytics sync scheduler.
 * Uses upsertJobScheduler for idempotent cron setup.
 * Call once on worker startup.
 *
 * SCRAPE-02/SCRAPE-03 FIX: Moved from 2:00 AM to 3:00 AM to stagger with GSC sync.
 * GSC sync runs at 2:15 AM, GA4 sync at 2:30 AM, trend calculation at 2:45 AM.
 * This master job fans out to per-client jobs.
 *
 * NOTE: This scheduler is now managed by the centralized queue-scheduler.ts.
 * This function is kept for backward compatibility but defers to the central scheduler.
 */
export async function initAnalyticsScheduler(): Promise<void> {
  await analyticsQueue.upsertJobScheduler(
    "nightly-analytics-sync",
    { pattern: "0 3 * * *" }, // 03:00 UTC daily (SCRAPE-03 fix: staggered from 2 AM)
    {
      name: "sync-all-clients",
      data: { mode: "incremental" },
      opts: {
        attempts: 1, // Master job spawns per-client jobs
        removeOnComplete: { count: 30 },
      },
    },
  );
  log.info("Nightly scheduler initialized", { schedule: "03:00 UTC" });
}

/**
 * Queue a backfill job for a single client with backpressure protection.
 * Called from OAuth callback when a new connection is established.
 *
 * @throws QueueBackpressureError if queue is at capacity
 */
export async function queueBackfillJob(clientId: string): Promise<void> {
  await addJobWithBackpressure(
    analyticsQueue,
    "sync-client-analytics",
    {
      clientId,
      provider: "google",
      mode: "backfill",
    },
    {
      jobId: generateJobId("backfill", clientId, true),
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
    },
    { maxQueueSize: 5000, allowDegradedMode: true },
  );
  log.info("Backfill job queued", { clientId });
}

// Re-export for caller convenience
export { QueueBackpressureError };
