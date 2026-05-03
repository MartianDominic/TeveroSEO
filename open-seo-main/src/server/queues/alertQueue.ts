/**
 * BullMQ queue for alert processing.
 * Phase 18: Monitoring & Alerts
 */
import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "alertQueue" });

export const ALERT_QUEUE_NAME = "alert-processing";

export type AlertJobType = "process_drop_events" | "check_sync_failures" | "check_connection_expiry";

export interface AlertJobData {
  type: AlertJobType;
  triggeredAt: string;
  clientId?: string; // Optional: process specific client only
}

export interface AlertDLQJobData extends AlertJobData {
  originalJobId?: string;
  failedAt: string;
  error: string;
}

/**
 * Default job options for alert processing.
 * Job timeout is controlled via Worker lockDuration (set to 60s in alert-worker.ts).
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const defaultJobOptions: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
});

let alertQueue: Queue<AlertJobData> | null = null;

export function getAlertQueue(): Queue<AlertJobData> {
  if (!alertQueue) {
    alertQueue = new Queue<AlertJobData>(ALERT_QUEUE_NAME, {
      connection: getSharedBullMQConnection("queue:alert"),
      defaultJobOptions,
    });
  }
  return alertQueue;
}

/**
 * Initialize repeatable job for alert processing.
 * Runs every 5 minutes to process drop events.
 */
export async function initAlertScheduler(): Promise<void> {
  const queue = getAlertQueue();

  // Add repeatable job FIRST (safe if duplicate briefly exists)
  // This ensures the scheduler is never lost even if we crash during init
  const addedJob = await queue.add(
    "process_drop_events",
    {
      type: "process_drop_events",
      triggeredAt: new Date().toISOString(),
    },
    {
      repeat: {
        pattern: "*/5 * * * *", // Every 5 minutes
      },
      jobId: "alert-scheduler-5min",
    },
  );

  // THEN remove old duplicates (any repeatable jobs with different keys)
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    // Keep the one we just added, remove any stale ones
    if (job.id !== "alert-scheduler-5min") {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  log.info("Alert scheduler initialized", { pattern: "*/5 * * * *", jobId: addedJob.id });
}

/**
 * Manually trigger alert processing for testing.
 */
export async function triggerAlertProcessing(
  type: AlertJobType = "process_drop_events",
  clientId?: string,
): Promise<string> {
  const queue = getAlertQueue();
  const job = await queue.add(
    type,
    {
      type,
      triggeredAt: new Date().toISOString(),
      clientId,
    },
  );
  log.info("Alert processing triggered", { jobId: job.id, type, clientId });
  return job.id ?? "";
}

/**
 * Close the queue connection.
 */
export async function closeAlertQueue(): Promise<void> {
  if (alertQueue) {
    await alertQueue.close();
    alertQueue = null;
    log.info("Alert queue closed");
  }
}
