/**
 * BullMQ Worker for follow-up jobs.
 * Phase 62-02: Follow-up system with rules engine
 *
 * Configuration:
 * - lockDuration: 60s (enough for DB operations)
 * - maxStalledCount: 2
 * - concurrency: 2 (parallel processing)
 * - Graceful shutdown with 25s timeout
 * - Dead-letter queue for failed jobs after max retries
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  FOLLOW_UP_QUEUE_NAME,
  scheduleFollowUpProcessing,
  type FollowUpJobData,
} from "@/server/queues/followUpQueue";
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";

const workerLogger = createLogger({ module: "follow-up-worker" });

const LOCK_DURATION_MS = 60_000;
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;
const CONCURRENCY = 2;

// URL-based resolution works in both Node ESM and built output
const PROCESSOR_PATH = fileURLToPath(
  new URL("./follow-up-processor.js", import.meta.url)
);

let worker: Worker<FollowUpJobData> | null = null;

/**
 * Start the follow-up worker.
 */
export async function startFollowUpWorker(): Promise<
  Worker<FollowUpJobData>
> {
  if (worker) return worker;

  // Initialize the recurring job
  await scheduleFollowUpProcessing();

  worker = new Worker<FollowUpJobData>(
    FOLLOW_UP_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:follow-up"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: CONCURRENCY,
    }
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: FOLLOW_UP_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<FollowUpJobData> | undefined,
      err: Error
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "follow-up-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // H-BULL-01 FIX: Use centralized DLQ instead of same-queue dlq: prefix
      if (job.attemptsMade >= maxAttempts) {
        try {
          const dlqQueue = getDLQQueue();
          const dlqData: DLQJobData = {
            originalQueue: FOLLOW_UP_QUEUE_NAME,
            jobId: job.id,
            jobData: job.data,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
          };
          await dlqQueue.add(`dlq:${FOLLOW_UP_QUEUE_NAME}:${job.id}`, dlqData);
          jobLogger.info("Job moved to centralized DLQ", { attemptsMade: job.attemptsMade });
        } catch (dlqErr) {
          jobLogger.error("Failed to move job to DLQ", dlqErr as Error);
        }
      }
    }
  );

  worker.on("completed", (job) => {
    const jobLogger = createLogger({
      module: "follow-up-worker",
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
    workerLogger.warn("Job stalled", { jobId, queue: FOLLOW_UP_QUEUE_NAME });
  });

  return worker;
}

/**
 * Stop the follow-up worker gracefully.
 */
export async function stopFollowUpWorker(): Promise<void> {
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
      { timeoutMs: SHUTDOWN_TIMEOUT_MS }
    );
    await current.close(true);
  }
}
