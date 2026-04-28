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
 * Default job options.
 * 3 attempts with exponential backoff.
 */
/**
 * Default job options for schedule checks.
 * Job timeout is controlled via Worker lockDuration (set to 60s in schedule-worker.ts).
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
 * Runs every 5 minutes to check for due schedules.
 */
export async function initScheduleQueue(): Promise<void> {
  // Add repeatable job FIRST (safe if duplicate briefly exists)
  // This ensures the scheduler is never lost even if we crash during init
  await scheduleQueue.add(
    "check-schedules",
    { triggeredAt: new Date().toISOString() },
    {
      repeat: {
        pattern: "*/5 * * * *", // Every 5 minutes
      },
      jobId: "schedule-check",
    },
  );

  // THEN remove old duplicates (any repeatable jobs with different keys)
  const repeatableJobs = await scheduleQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    // Keep the one we just added, remove any stale ones
    if (job.id !== "schedule-check") {
      await scheduleQueue.removeRepeatableByKey(job.key);
    }
  }

  log.info("Schedule queue initialized with 5-minute repeatable job");
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
