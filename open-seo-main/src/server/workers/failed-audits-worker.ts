/**
 * BullMQ Worker for the failed-audits dead-letter queue.
 *
 * Processes terminally failed audit jobs for:
 * - Logging and alerting
 * - Potential cleanup operations
 * - Future: User notification, Slack alerts, etc.
 *
 * This worker exists to handle DLQ jobs that were enqueued by audit-worker.ts
 * when an audit job exhausted all retries.
 */
import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  FAILED_AUDITS_QUEUE_NAME,
  type FailedAuditJobData,
} from "@/server/queues/auditQueue";

const workerLog = createLogger({ module: "failed-audits-worker" });

const SHUTDOWN_TIMEOUT_MS = 10_000;

let worker: Worker<FailedAuditJobData> | null = null;

export function startFailedAuditsWorker(): Worker<FailedAuditJobData> {
  if (worker) return worker;

  worker = new Worker<FailedAuditJobData>(
    FAILED_AUDITS_QUEUE_NAME,
    async (job: Job<FailedAuditJobData>) => {
      const { auditId, projectId, originalJobId, failedAt, error, attemptsMade } = job.data;
      const jobLog = createLogger({
        module: "failed-audits-worker",
        jobId: job.id,
        auditId,
      });

      jobLog.info("Processing failed audit from DLQ", {
        projectId,
        originalJobId,
        failedAt: new Date(failedAt).toISOString(),
        error,
        attemptsMade,
      });

      // The audit has already been marked as failed in the database by audit-worker.ts
      // This worker is for additional processing like:
      // 1. Sending notifications (email, Slack, etc.)
      // 2. Recording metrics for failure analysis
      // 3. Triggering cleanup operations

      // TODO: Implement notification system
      // await notifyAuditFailed(auditId, projectId, error);

      // TODO: Implement Slack alerting for critical failures
      // if (attemptsMade >= 3) {
      //   await sendSlackAlert(`Audit ${auditId} failed after ${attemptsMade} attempts: ${error}`);
      // }

      jobLog.info("DLQ job processed successfully", { auditId });
    },
    {
      connection: getSharedBullMQConnection("worker:failed-audits"),
      concurrency: 5, // DLQ processing is lightweight, can handle more concurrent jobs
      maxStalledCount: 2,
    },
  );

  worker.on("ready", () => {
    workerLog.info("Worker ready", { queue: FAILED_AUDITS_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLog.error("Worker error", err instanceof Error ? err : new Error(String(err)));
  });

  worker.on("failed", (job, err) => {
    const jobLog = createLogger({
      module: "failed-audits-worker",
      jobId: job?.id,
      auditId: job?.data.auditId,
    });
    jobLog.error("DLQ job processing failed", err instanceof Error ? err : new Error(String(err)));
  });

  worker.on("completed", (job) => {
    const jobLog = createLogger({
      module: "failed-audits-worker",
      jobId: job.id,
      auditId: job.data.auditId,
    });
    jobLog.info("DLQ job completed");
  });

  worker.on("stalled", (jobId) => {
    workerLog.warn("DLQ job stalled", { jobId, queue: FAILED_AUDITS_QUEUE_NAME });
  });

  return worker;
}

export async function stopFailedAuditsWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    workerLog.error("Graceful shutdown timeout exceeded, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }
}
