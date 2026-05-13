/**
 * BullMQ queue for document reminder scheduling.
 * Phase 101: Document Management (D-04)
 *
 * Handles smart automation for document follow-ups:
 * - Unopened document reminders
 * - Document expiration alerts
 * - Scheduled follow-ups
 * - Re-engagement notifications
 */
import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "documentReminderQueue" });

export const DOCUMENT_REMINDER_QUEUE_NAME = "document-reminders";

export type DocumentReminderJobType =
  | "process_pending_reminders"
  | "schedule_reminder"
  | "send_reminder"
  | "check_unopened_documents"
  | "check_expiring_documents";

export interface DocumentReminderJobData {
  type: DocumentReminderJobType;
  triggeredAt: string;
  workspaceId?: string;
  documentId?: string;
  reminderId?: string;
  reminderType?: "unopened" | "expiring" | "follow_up" | "re_engagement";
}

export interface DocumentReminderDLQJobData extends DocumentReminderJobData {
  originalJobId?: string;
  failedAt: string;
  error: string;
}

/**
 * Default job options for document reminder processing.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const defaultJobOptions: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
});

let documentReminderQueue: Queue<DocumentReminderJobData> | null = null;

export function getDocumentReminderQueue(): Queue<DocumentReminderJobData> {
  if (!documentReminderQueue) {
    documentReminderQueue = new Queue<DocumentReminderJobData>(
      DOCUMENT_REMINDER_QUEUE_NAME,
      {
        connection: getSharedBullMQConnection("queue:document-reminder"),
        defaultJobOptions,
      }
    );
  }
  return documentReminderQueue;
}

/**
 * Initialize repeatable jobs for document reminder processing.
 * Runs every hour to check for pending reminders.
 */
export async function initDocumentReminderScheduler(): Promise<void> {
  const queue = getDocumentReminderQueue();

  // Process pending reminders every hour
  await queue.add(
    "process_pending_reminders",
    {
      type: "process_pending_reminders",
      triggeredAt: new Date().toISOString(),
    },
    {
      repeat: {
        pattern: "0 * * * *", // Every hour at minute 0
      },
      jobId: "document-reminder-hourly",
    }
  );

  // Check for unopened documents daily at 9 AM
  await queue.add(
    "check_unopened_documents",
    {
      type: "check_unopened_documents",
      triggeredAt: new Date().toISOString(),
    },
    {
      repeat: {
        pattern: "0 9 * * *", // Daily at 9 AM
      },
      jobId: "document-unopened-daily",
    }
  );

  // Check for expiring documents daily at 8 AM
  await queue.add(
    "check_expiring_documents",
    {
      type: "check_expiring_documents",
      triggeredAt: new Date().toISOString(),
    },
    {
      repeat: {
        pattern: "0 8 * * *", // Daily at 8 AM
      },
      jobId: "document-expiring-daily",
    }
  );

  // Remove stale repeatable jobs
  const repeatableJobs = await queue.getRepeatableJobs();
  const validJobIds = [
    "document-reminder-hourly",
    "document-unopened-daily",
    "document-expiring-daily",
  ];
  for (const job of repeatableJobs) {
    if (job.id && !validJobIds.includes(job.id)) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  log.info("Document reminder scheduler initialized");
}

/**
 * Schedule a one-time reminder for a document.
 */
export async function scheduleDocumentReminder(
  documentId: string,
  reminderId: string,
  reminderType: DocumentReminderJobData["reminderType"],
  scheduledFor: Date
): Promise<string> {
  const queue = getDocumentReminderQueue();

  const delay = Math.max(0, scheduledFor.getTime() - Date.now());

  const job = await queue.add(
    "send_reminder",
    {
      type: "send_reminder",
      triggeredAt: new Date().toISOString(),
      documentId,
      reminderId,
      reminderType,
    },
    {
      delay,
      jobId: `reminder-${reminderId}`,
    }
  );

  log.info("Scheduled document reminder", {
    documentId,
    reminderId,
    reminderType,
    scheduledFor: scheduledFor.toISOString(),
    delay,
  });

  return job.id ?? reminderId;
}

/**
 * Cancel a scheduled reminder.
 */
export async function cancelDocumentReminder(reminderId: string): Promise<boolean> {
  const queue = getDocumentReminderQueue();
  const jobId = `reminder-${reminderId}`;

  try {
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      log.info("Cancelled document reminder", { reminderId });
      return true;
    }
    return false;
  } catch (err) {
    log.warn("Failed to cancel document reminder", {
      reminderId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Close the queue gracefully.
 */
export async function closeDocumentReminderQueue(): Promise<void> {
  if (documentReminderQueue) {
    await documentReminderQueue.close();
    documentReminderQueue = null;
    log.info("Document reminder queue closed");
  }
}
