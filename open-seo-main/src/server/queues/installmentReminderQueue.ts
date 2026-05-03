/**
 * BullMQ Queue for installment payment reminders.
 * Phase 60-05: Automated reminder emails for split payments.
 *
 * Runs daily at 9 AM to check for:
 * - Installments due in 3 days (reminder)
 * - Installments due today (urgent)
 * - Overdue installments (1 day, 7 days)
 *
 * Per D-17: Daily 9 AM schedule for reminder processing.
 */
import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "installmentReminderQueue" });

export const INSTALLMENT_REMINDER_QUEUE_NAME = "installment-reminders" as const;

/**
 * Job data for daily installment reminder check.
 */
export interface InstallmentReminderJobData {
  type: "daily-check";
  triggeredAt: string; // ISO timestamp
}

/**
 * Dead-letter queue job data for failed reminder jobs.
 */
export interface InstallmentReminderDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: InstallmentReminderJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options for reminder checks.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
});

/**
 * Installment reminder queue.
 * Uses shared BullMQ connection for Redis.
 */
export const installmentReminderQueue = new Queue<
  InstallmentReminderJobData | InstallmentReminderDLQJobData
>(INSTALLMENT_REMINDER_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:installment-reminders"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Initialize the installment reminder queue with a repeatable job.
 * Per D-17: Runs daily at 9 AM.
 */
export async function initInstallmentReminderQueue(): Promise<void> {
  // Add repeatable job FIRST (safe if duplicate briefly exists)
  await installmentReminderQueue.add(
    "daily-check",
    {
      type: "daily-check",
      triggeredAt: new Date().toISOString(),
    },
    {
      repeat: {
        pattern: "0 9 * * *", // Daily at 9 AM
      },
      jobId: "installment-reminder-check",
    }
  );

  // Remove old duplicates (any repeatable jobs with different keys)
  const repeatableJobs = await installmentReminderQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id !== "installment-reminder-check") {
      await installmentReminderQueue.removeRepeatableByKey(job.key);
    }
  }

  log.info("Installment reminder queue initialized with daily 9 AM job");
}

/**
 * Manually trigger an installment reminder check.
 * Useful for testing or immediate processing.
 */
export async function triggerInstallmentReminderCheck(): Promise<void> {
  await installmentReminderQueue.add(
    "daily-check",
    {
      type: "daily-check",
      triggeredAt: new Date().toISOString(),
    },
    {
      jobId: `manual-check-${Date.now()}`,
    }
  );
  log.info("Manual installment reminder check triggered");
}
