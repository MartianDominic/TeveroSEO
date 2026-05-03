/**
 * BullMQ Queue definition for scheduled report generation.
 *
 * - `scheduleQueue` - primary queue for scheduler jobs
 * - Runs every 5 minutes to check for due schedules
 *
 * Job types:
 * - check-schedules: Check for due schedules and enqueue report generation
 * - dlq:report-scheduler: Dead-letter queue for failed jobs
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "scheduleQueue" });

export const SCHEDULE_QUEUE_NAME = "report-scheduler" as const;

/**
 * Job data for schedule check.
 */
export interface ScheduleJobData {
  triggeredAt: string; // ISO timestamp
}

/**
 * Dead-letter queue job data for failed schedule jobs.
 */
export interface ScheduleDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: ScheduleJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options for schedule checks.
 * Job timeout is controlled via Worker lockDuration (set to 60s in schedule-worker.ts).
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
});

/**
 * Schedule queue.
 * Uses shared BullMQ connection for Redis.
 */
export const scheduleQueue = new Queue<ScheduleJobData | ScheduleDLQJobData>(
  SCHEDULE_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:schedule"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Initialize the schedule queue with a repeatable job.
 * MED-36 fix: Uses upsertJobScheduler() instead of deprecated repeat option.
 * Runs every 5 minutes to check for due schedules.
 */
export async function initScheduleQueue(): Promise<void> {
  // Use upsertJobScheduler for idempotent cron setup (BullMQ v5 pattern)
  await scheduleQueue.upsertJobScheduler(
    "schedule-check", // Scheduler ID
    { pattern: "*/5 * * * *" }, // Every 5 minutes
    {
      name: "check-schedules",
      data: { triggeredAt: new Date().toISOString() },
      opts: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    },
  );

  log.info("Schedule queue initialized with 5-minute scheduler", { pattern: "*/5 * * * *" });
}

/**
 * Manually trigger a schedule check.
 * Useful for testing or immediate schedule processing.
 */
export async function triggerScheduleCheck(): Promise<void> {
  await scheduleQueue.add(
    "check-schedules",
    { triggeredAt: new Date().toISOString() },
    {
      jobId: `manual-check-${Date.now()}`,
    },
  );
  log.info("Manual schedule check triggered");
}
