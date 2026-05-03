/**
 * BullMQ Worker for keyword ranking check jobs.
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 300_000 (5 min - allows processing many keywords)
 *   - maxStalledCount: 2
 *   - Sandboxed processor via file path
 *   - concurrency: 1 (single ranking check at a time)
 *   - Graceful shutdown with 25s timeout
 *   - Dead-letter queue for failed jobs after max retries
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  RANKING_QUEUE_NAME,
  initRankingScheduler,
  type RankingJobData,
} from "@/server/queues/rankingQueue";
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";

const workerLogger = createLogger({ module: "ranking-worker" });

const LOCK_DURATION_MS = 300_000; // 5 minutes - batch processing takes time
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./ranking-processor.js", import.meta.url),
);

let worker: Worker<RankingJobData> | null = null;

export async function startRankingWorker(): Promise<Worker<RankingJobData>> {
  if (worker) return worker;

  // Initialize the daily scheduler
  await initRankingScheduler();

  worker = new Worker<RankingJobData>(
    RANKING_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:ranking"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1, // Single ranking check at a time
    },
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: RANKING_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<RankingJobData> | undefined,
      err: Error,
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "ranking-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // HIGH-QUEUE-01 FIX: Use centralized DLQ infrastructure instead of custom dlq: prefix
      if (job.attemptsMade >= maxAttempts) {
        try {
          const dlqQueue = getDLQQueue();
          const dlqData: DLQJobData = {
            originalQueue: RANKING_QUEUE_NAME,
            jobId: job.id,
            jobData: job.data,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
          };
          await dlqQueue.add("ranking-worker-failed", dlqData, {
            // DLQ retention is handled by dlq.ts default job options
          });
          jobLogger.info("Job moved to centralized DLQ", { attemptsMade: job.attemptsMade });
        } catch (dlqErr) {
          jobLogger.error("Failed to move job to DLQ", dlqErr as Error);
        }
      }
    },
  );

  worker.on("completed", (job) => {
    const jobLogger = createLogger({
      module: "ranking-worker",
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
    workerLogger.warn("Job stalled", { jobId, queue: RANKING_QUEUE_NAME });
  });

  return worker;
}

export async function stopRankingWorker(): Promise<void> {
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
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
    );
    await current.close(true);
  }
}
