/**
 * BullMQ Worker for maintenance jobs.
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 120_000 (enough for cleanup operations)
 *   - maxStalledCount: 2
 *   - Sandboxed processor via file path
 *   - concurrency: 1 (single maintenance task at a time)
 *   - Graceful shutdown with 25s timeout
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  MAINTENANCE_QUEUE_NAME,
  initMaintenanceQueue,
  type CacheCleanupJobData,
} from "@/server/queues/maintenanceQueue";
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";

const workerLogger = createLogger({ module: "maintenance-worker" });

const LOCK_DURATION_MS = 120_000; // Enough for cleanup operations
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./maintenance-processor.js", import.meta.url),
);

let worker: Worker<CacheCleanupJobData> | null = null;

export async function startMaintenanceWorker(): Promise<Worker<CacheCleanupJobData>> {
  if (worker) return worker;

  // Initialize the repeatable jobs
  await initMaintenanceQueue();

  worker = new Worker<CacheCleanupJobData>(
    MAINTENANCE_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:maintenance"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1, // Single maintenance task at a time
    },
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: MAINTENANCE_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (job: Job<CacheCleanupJobData> | undefined, err: Error) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "maintenance-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // Move to DLQ after max retries, skip DLQ jobs (HIGH-BQ-01 fix)
      if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
        try {
          const dlqPayload: DLQJobData = {
            originalQueue: MAINTENANCE_QUEUE_NAME,
            jobId: job.id,
            jobData: job.data,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
          };
          const dlqQueue = getDLQQueue();
          await dlqQueue.add(`dlq:maintenance:${job.id}`, dlqPayload, {
            removeOnComplete: { age: 604800 }, // 7 days
            removeOnFail: { age: 604800 }, // 7 days
          });
          jobLogger.info("Job moved to DLQ", { attemptsMade: job.attemptsMade });
        } catch (dlqErr) {
          jobLogger.error("Failed to move job to DLQ", dlqErr as Error);
        }
      }
    },
  );

  worker.on("completed", (job) => {
    const jobLogger = createLogger({
      module: "maintenance-worker",
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
    workerLogger.warn("Job stalled", { jobId, queue: MAINTENANCE_QUEUE_NAME });
  });

  return worker;
}

export async function stopMaintenanceWorker(): Promise<void> {
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
