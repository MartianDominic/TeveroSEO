/**
 * BullMQ Worker for Revolut polling jobs.
 * Phase 101: Direct Proposal & Manual Deal Pipeline
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 120_000 (2 min - API calls may be slow)
 *   - maxStalledCount: 2
 *   - Sandboxed processor via file path
 *   - concurrency: 5 (multiple workspaces can poll in parallel)
 *   - Graceful shutdown with 25s timeout
 *
 * Implements D-03: Revolut polling every 15 minutes to catch missed webhooks.
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { moveJobToDeadLetter } from "@/server/lib/dead-letter-queue";
import {
  REVOLUT_POLLING_QUEUE_NAME,
  initRevolutPollingScheduler,
  type RevolutPollingJobData,
} from "@/server/queues/revolutPollingQueue";

// Module-level logger for worker lifecycle events
const workerLogger = createLogger({ module: "revolut-polling-worker" });

const LOCK_DURATION_MS = 120_000; // 2 minutes (API calls may be slow)
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000; // 25 seconds

/**
 * Simple in-memory metrics for Revolut polling worker.
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
  new URL("./revolut-polling-processor.js", import.meta.url)
);

let worker: Worker<RevolutPollingJobData> | null = null;

/**
 * Start the Revolut polling worker.
 * Initializes the scheduler and starts processing jobs.
 *
 * @returns The BullMQ worker instance
 */
export async function startRevolutPollingWorker(): Promise<
  Worker<RevolutPollingJobData>
> {
  if (worker) return worker;

  // Initialize the 15-minute scheduler first
  await initRevolutPollingScheduler();

  worker = new Worker<RevolutPollingJobData>(
    REVOLUT_POLLING_QUEUE_NAME,
    PROCESSOR_PATH, // Sandboxed processor
    {
      connection: getSharedBullMQConnection("worker:revolut-polling"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 5, // Multiple workspaces can poll in parallel
    }
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: REVOLUT_POLLING_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (job: Job<RevolutPollingJobData> | undefined, err: Error) => {
      metrics.failed++;

      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 5;
      workerLogger.error("Job failed", err, {
        jobId: job.id,
        attempt: job.attemptsMade,
        maxAttempts,
        workspaceId: job.data.workspaceId,
      });

      // Move to DLQ after exhausting retries
      // Payment polling failures may indicate credential issues
      if (job.attemptsMade >= maxAttempts) {
        const dlqId = await moveJobToDeadLetter(job, err, REVOLUT_POLLING_QUEUE_NAME);
        if (dlqId) {
          metrics.dlqMoved++;
          workerLogger.warn("Job moved to DLQ", {
            jobId: job.id,
            dlqId,
            workspaceId: job.data.workspaceId,
          });
        }
      }
    }
  );

  worker.on("completed", (job) => {
    metrics.success++;
    metrics.lastRunAt = new Date().toISOString();

    workerLogger.info("Job completed", {
      jobId: job.id,
      type: job.data.type,
      workspaceId: job.data.workspaceId,
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
    });
  });

  worker.on("stalled", (jobId) => {
    workerLogger.warn("Job stalled", { jobId, queue: REVOLUT_POLLING_QUEUE_NAME });
  });

  return worker;
}

/**
 * Stop the Revolut polling worker gracefully.
 * Waits up to 25 seconds for jobs to complete before forcing close.
 */
export async function stopRevolutPollingWorker(): Promise<void> {
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
 * DLQ handler for Revolut polling failures.
 * Called by DLQ worker to process permanently failed polling jobs.
 *
 * Actions:
 * - Log critical failure for ops alerting
 * - Could potentially disable workspace Revolut integration after repeated failures
 */
export async function handleRevolutPollingDLQ(
  jobData: {
    jobId?: string;
    error?: string;
    failedAt?: string;
    originalQueue?: string;
    data?: RevolutPollingJobData;
  }
): Promise<void> {
  const dlqLogger = createLogger({
    module: "revolut-polling-dlq",
    originalJobId: jobData.jobId,
  });

  dlqLogger.warn("Processing Revolut polling DLQ entry", {
    error: jobData.error,
    failedAt: jobData.failedAt,
    workspaceId: jobData.data?.workspaceId,
  });

  // Log for ops alerting - repeated failures may indicate credential issues
  dlqLogger.error(
    "Revolut polling permanently failed - credential check required",
    undefined,
    {
      originalQueue: jobData.originalQueue,
      jobId: jobData.jobId,
      error: jobData.error,
      failedAt: jobData.failedAt,
      workspaceId: jobData.data?.workspaceId,
      action: "CREDENTIAL_CHECK_REQUIRED",
    }
  );
}

/**
 * Get current worker metrics.
 * Useful for monitoring and health checks.
 */
export function getRevolutPollingMetrics(): Readonly<WorkerMetrics> {
  return { ...metrics };
}
