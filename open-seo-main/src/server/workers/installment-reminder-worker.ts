/**
 * BullMQ Worker for installment payment reminders.
 * Phase 60-05: Automated reminder emails for split payments.
 *
 * Follows schedule-worker.ts pattern:
 * - Shared Redis connection
 * - Sandboxed processor
 * - Graceful shutdown
 * - Dead-letter queue for failed jobs
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  INSTALLMENT_REMINDER_QUEUE_NAME,
  initInstallmentReminderQueue,
  type InstallmentReminderJobData,
} from "@/server/queues/installmentReminderQueue";
// SCR-01 CONSOLIDATION: Use DB-based DLQ instead of Redis
import { moveJobToDeadLetter } from "@/server/lib/dead-letter-queue";

const workerLogger = createLogger({ module: "installment-reminder-worker" });

const LOCK_DURATION_MS = 120_000; // 2 min for email sending
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./installment-reminder-processor.js", import.meta.url)
);

let worker: Worker<InstallmentReminderJobData> | null = null;

export async function startInstallmentReminderWorker(): Promise<
  Worker<InstallmentReminderJobData>
> {
  if (worker) return worker;

  // Initialize the repeatable job
  await initInstallmentReminderQueue();

  worker = new Worker<InstallmentReminderJobData>(
    INSTALLMENT_REMINDER_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:installment-reminders"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1, // Single processor - no parallel reminder checks
    }
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: INSTALLMENT_REMINDER_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<InstallmentReminderJobData> | undefined,
      err: Error
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "installment-reminder-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // SCR-01 CONSOLIDATION: Use DB-based DLQ for persistence across restarts
      if (job.attemptsMade >= maxAttempts) {
        await moveJobToDeadLetter(job, err, INSTALLMENT_REMINDER_QUEUE_NAME);
      }
    }
  );

  worker.on("completed", (job) => {
    const jobLogger = createLogger({
      module: "installment-reminder-worker",
      jobId: job.id,
    });
    jobLogger.info("Job completed", {
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
    });
  });

  worker.on("stalled", (jobId) => {
    workerLogger.warn("Job stalled", {
      jobId,
      queue: INSTALLMENT_REMINDER_QUEUE_NAME,
    });
  });

  return worker;
}

export async function stopInstallmentReminderWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    workerLogger.error(
      "Graceful shutdown timeout exceeded, forcing close",
      undefined,
      {
        timeoutMs: SHUTDOWN_TIMEOUT_MS,
      }
    );
    await current.close(true);
  }
}
