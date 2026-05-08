/**
 * BullMQ Worker for report generation jobs.
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 90_000 (60s render + 30s buffer)
 *   - maxStalledCount: 2
 *   - Sandboxed processor via file path
 *   - concurrency: 2 (limit concurrent PDF renders - per RESEARCH.md)
 *   - Graceful shutdown with 25s timeout
 *   - Dead-letter queue for failed jobs after max retries
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection, WORKER_CONCURRENCY_LIMITS } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  REPORT_QUEUE_NAME,
  type ReportJobData,
} from "@/server/queues/reportQueue";
// SCR-01 CONSOLIDATION: Use DB-based DLQ instead of Redis
import { moveJobToDeadLetter } from "@/server/lib/dead-letter-queue";

const workerLogger = createLogger({ module: "report-worker" });

const LOCK_DURATION_MS = 90_000; // 60s render + 30s buffer
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./report-processor.js", import.meta.url),
);

let worker: Worker<ReportJobData> | null = null;

export async function startReportWorker(): Promise<
  Worker<ReportJobData>
> {
  if (worker) return worker;

  worker = new Worker<ReportJobData>(
    REPORT_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:report"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      // H-BULL-02 FIX: Use centralized concurrency limits instead of hardcoded value
      concurrency: WORKER_CONCURRENCY_LIMITS.report,
    },
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: REPORT_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<ReportJobData> | undefined,
      err: Error,
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "report-worker",
        jobId: job.id,
        reportId: job.data.reportId,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // SCR-01 CONSOLIDATION: Use DB-based DLQ for persistence across restarts
      if (job.attemptsMade >= maxAttempts) {
        await moveJobToDeadLetter(job, err, REPORT_QUEUE_NAME);
      }
    },
  );

  worker.on("completed", (job) => {
    const jobLogger = createLogger({
      module: "report-worker",
      jobId: job.id,
      reportId: job.data.reportId,
    });
    jobLogger.info("Job completed", {
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
    });
  });

  worker.on("stalled", (jobId) => {
    workerLogger.warn("Job stalled", { jobId, queue: REPORT_QUEUE_NAME });
  });

  return worker;
}

export async function stopReportWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    workerLogger.error(
      "Graceful shutdown timeout exceeded, forcing close",
      undefined,
      {
        timeoutMs: SHUTDOWN_TIMEOUT_MS,
      },
    );
    await current.close(true);
  }
}
