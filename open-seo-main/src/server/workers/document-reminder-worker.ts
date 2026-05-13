/**
 * BullMQ worker for document reminder processing.
 * Phase 101: Document Management (D-04)
 */
import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  DOCUMENT_REMINDER_QUEUE_NAME,
  initDocumentReminderScheduler,
  closeDocumentReminderQueue,
  getDocumentReminderQueue,
  type DocumentReminderJobData,
  type DocumentReminderDLQJobData,
} from "@/server/queues/documentReminderQueue";
import { ReminderSchedulingService } from "@/server/features/documents/services/ReminderSchedulingService";
import { db } from "@/db";
import { organization } from "@/db/user-schema";

const log = createLogger({ module: "document-reminder-worker" });

const SHUTDOWN_TIMEOUT_MS = 25_000;

let documentReminderWorker: Worker<DocumentReminderJobData> | null = null;

/**
 * Process a document reminder job.
 */
async function processor(job: Job<DocumentReminderJobData>): Promise<{ processed: boolean; details?: string }> {
  const jobLog = createLogger({
    module: "document-reminder-worker",
    jobId: job.id,
  });

  jobLog.info("Processing document reminder job", {
    type: job.data.type,
    documentId: job.data.documentId,
  });

  switch (job.data.type) {
    case "process_pending_reminders": {
      const processedCount = await ReminderSchedulingService.processDueReminders();
      return { processed: true, details: `Processed ${processedCount} reminders` };
    }

    case "check_unopened_documents": {
      // Get all workspaces and schedule unopened reminders
      const workspaces = await db.select({ id: organization.id }).from(organization);
      let totalScheduled = 0;

      for (const workspace of workspaces) {
        const scheduled = await ReminderSchedulingService.scheduleUnopenedReminders(
          workspace.id
        );
        totalScheduled += scheduled;
      }

      return { processed: true, details: `Scheduled ${totalScheduled} unopened reminders` };
    }

    case "check_expiring_documents": {
      // Placeholder for expiring documents check
      // Would integrate with document expiration metadata
      jobLog.info("Expiring documents check - not yet implemented");
      return { processed: true, details: "Expiring check not yet implemented" };
    }

    case "send_reminder": {
      if (!job.data.reminderId) {
        throw new Error("Missing reminderId for send_reminder job");
      }

      // Mark reminder as sent (notification integration would go here)
      await ReminderSchedulingService.markReminderSent(job.data.reminderId);
      return { processed: true, details: `Sent reminder ${job.data.reminderId}` };
    }

    case "schedule_reminder": {
      // One-off reminder scheduling handled by the queue itself
      return { processed: true, details: "Schedule reminder processed" };
    }

    default: {
      jobLog.warn("Unknown job type", { type: job.data.type });
      return { processed: false, details: `Unknown job type: ${job.data.type}` };
    }
  }
}

/**
 * Start the document reminder worker.
 */
export async function startDocumentReminderWorker(): Promise<void> {
  if (documentReminderWorker) {
    log.warn("Document reminder worker already running");
    return;
  }

  // Initialize the scheduler for repeatable jobs
  await initDocumentReminderScheduler();

  documentReminderWorker = new Worker<DocumentReminderJobData>(
    DOCUMENT_REMINDER_QUEUE_NAME,
    processor,
    {
      connection: getSharedBullMQConnection("worker:document-reminder"),
      lockDuration: 60_000, // 1 minute
      maxStalledCount: 2,
      concurrency: 2,
    }
  );

  documentReminderWorker.on("completed", (job, result) => {
    log.info("Document reminder job completed", {
      jobId: job.id,
      type: job.data.type,
      result,
    });
  });

  documentReminderWorker.on("failed", async (job: Job<DocumentReminderJobData> | undefined, err: Error) => {
    if (!job) {
      log.error("Document reminder job failed with no job context", err);
      return;
    }

    const maxAttempts = job.opts.attempts ?? 3;
    const jobLogger = createLogger({
      module: "document-reminder-worker",
      jobId: job.id,
    });

    jobLogger.error("Document reminder job failed", err, {
      type: job.data.type,
      attempt: job.attemptsMade,
      maxAttempts,
    });

    // Move to DLQ after max retries
    if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
      try {
        const dlqData: DocumentReminderDLQJobData = {
          ...job.data,
          originalJobId: job.id,
          failedAt: new Date().toISOString(),
          error: err.message,
        };

        const queue = getDocumentReminderQueue();
        await queue.add(`dlq:${job.name}`, dlqData, {
          removeOnComplete: false,
          removeOnFail: false,
        });

        jobLogger.warn("Moved failed job to DLQ", {
          originalJobId: job.id,
        });
      } catch (dlqErr) {
        jobLogger.error(
          "Failed to move job to DLQ",
          dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr))
        );
      }
    }
  });

  log.info("Document reminder worker started");
}

/**
 * Stop the document reminder worker gracefully.
 */
export async function stopDocumentReminderWorker(): Promise<void> {
  if (!documentReminderWorker) {
    return;
  }

  log.info("Stopping document reminder worker...");

  try {
    // Close worker with timeout
    await Promise.race([
      documentReminderWorker.close(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Worker shutdown timeout")),
          SHUTDOWN_TIMEOUT_MS
        )
      ),
    ]);
  } catch (err) {
    log.warn("Worker shutdown issue", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  documentReminderWorker = null;

  // Close the queue
  await closeDocumentReminderQueue();

  log.info("Document reminder worker stopped");
}
