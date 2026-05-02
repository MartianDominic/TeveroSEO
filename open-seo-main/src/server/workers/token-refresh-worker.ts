/**
 * BullMQ Worker for token refresh jobs.
 * Phase 61-06: Platform Integration Excellence
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 60_000 (1 minute - token refresh is fast)
 *   - maxStalledCount: 2
 *   - Sandboxed processor via file path
 *   - concurrency: 1 (single thread sufficient for periodic refresh)
 *   - Graceful shutdown with 15s timeout
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  TOKEN_REFRESH_QUEUE_NAME,
  initTokenRefreshScheduler,
  type CheckExpiringTokensJobData,
} from "@/server/queues/tokenRefreshQueue";

// Module-level logger for worker lifecycle events
const workerLogger = createLogger({ module: "token-refresh-worker" });

const LOCK_DURATION_MS = 60_000; // 1 minute (token refresh is quick)
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 15_000; // 15 seconds

/**
 * Simple in-memory metrics for token refresh worker.
 */
interface WorkerMetrics {
  success: number;
  failed: number;
  lastRunAt: string | null;
}

const metrics: WorkerMetrics = {
  success: 0,
  failed: 0,
  lastRunAt: null,
};

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./token-refresh-processor.js", import.meta.url)
);

let worker: Worker<CheckExpiringTokensJobData> | null = null;

/**
 * Start the token refresh worker.
 * Initializes the scheduler and starts processing jobs.
 *
 * @returns The BullMQ worker instance
 */
export async function startTokenRefreshWorker(): Promise<
  Worker<CheckExpiringTokensJobData>
> {
  if (worker) return worker;

  // Initialize the 15-minute scheduler first
  await initTokenRefreshScheduler();

  worker = new Worker<CheckExpiringTokensJobData>(
    TOKEN_REFRESH_QUEUE_NAME,
    PROCESSOR_PATH, // Sandboxed processor
    {
      connection: getSharedBullMQConnection("worker:token-refresh"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1, // Token refresh is periodic, single thread is sufficient
    }
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: TOKEN_REFRESH_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    (job: Job<CheckExpiringTokensJobData> | undefined, err: Error) => {
      metrics.failed++;

      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      workerLogger.error("Job failed", err, {
        jobId: job.id,
        attempt: job.attemptsMade,
        maxAttempts: job.opts.attempts ?? 1,
      });
    }
  );

  worker.on("completed", (job) => {
    metrics.success++;
    metrics.lastRunAt = new Date().toISOString();

    workerLogger.info("Job completed", {
      jobId: job.id,
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
    });
  });

  worker.on("stalled", (jobId) => {
    workerLogger.warn("Job stalled", { jobId, queue: TOKEN_REFRESH_QUEUE_NAME });
  });

  return worker;
}

/**
 * Stop the token refresh worker gracefully.
 * Waits up to 15 seconds for jobs to complete before forcing close.
 */
export async function stopTokenRefreshWorker(): Promise<void> {
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

  workerLogger.info("Worker stopped", { metrics });
}

/**
 * Get current worker metrics.
 * Useful for monitoring and health checks.
 */
export function getTokenRefreshMetrics(): Readonly<WorkerMetrics> {
  return { ...metrics };
}
