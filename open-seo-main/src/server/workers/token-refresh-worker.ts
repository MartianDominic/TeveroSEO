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
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";
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
  dlqMoved: number;
  lastRunAt: string | null;
}

const metrics: WorkerMetrics = {
  success: 0,
  failed: 0,
  dlqMoved: 0,
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
    async (job: Job<CheckExpiringTokensJobData> | undefined, err: Error) => {
      metrics.failed++;

      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      workerLogger.error("Job failed", err, {
        jobId: job.id,
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // JOB-CRIT-01 FIX: Move to DLQ after exhausting retries
      // Token refresh failures are critical - users lose platform access silently
      if (job.attemptsMade >= maxAttempts) {
        try {
          const dlqQueue = getDLQQueue();
          const dlqData: DLQJobData = {
            originalQueue: TOKEN_REFRESH_QUEUE_NAME,
            jobId: job.id,
            jobData: job.data,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
          };
          await dlqQueue.add(`dlq:${TOKEN_REFRESH_QUEUE_NAME}`, dlqData, {
            removeOnComplete: { age: 604800 }, // 7 days
            removeOnFail: { age: 604800 },
            attempts: 1,
          });
          metrics.dlqMoved++;
          workerLogger.warn("Token refresh job moved to DLQ", {
            jobId: job.id,
            attemptsMade: job.attemptsMade,
          });
        } catch (dlqErr) {
          workerLogger.error(
            "Failed to move token refresh job to DLQ",
            dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)),
            { jobId: job.id }
          );
        }
      }
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
 * JOB-CRIT-01: DLQ processor for token refresh failures.
 * Notifies users when their platform tokens could not be refreshed.
 *
 * This is registered as a handler in the DLQ worker to process
 * token-refresh specific failures and send user notifications.
 */
export async function handleTokenRefreshDLQ(
  jobData: DLQJobData
): Promise<void> {
  const dlqLogger = createLogger({
    module: "token-refresh-dlq",
    originalJobId: jobData.jobId,
  });

  dlqLogger.warn("Processing token refresh DLQ entry", {
    error: jobData.error,
    failedAt: jobData.failedAt,
  });

  // TODO: Implement user notification when email service is available
  // For now, log for ops alerting via structured logs
  dlqLogger.error("Token refresh permanently failed - user notification required", undefined, {
    originalQueue: jobData.originalQueue,
    jobId: jobData.jobId,
    error: jobData.error,
    failedAt: jobData.failedAt,
    action: "USER_NOTIFICATION_REQUIRED",
  });
}

/**
 * Get current worker metrics.
 * Useful for monitoring and health checks.
 */
export function getTokenRefreshMetrics(): Readonly<WorkerMetrics> {
  return { ...metrics };
}
