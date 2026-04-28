/**
 * BullMQ Worker for analytics sync jobs.
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 120_000 (BQ-05)
 *   - maxStalledCount: 2 (BQ-06)
 *   - Sandboxed processor via file path
 *   - concurrency: 5 (respect Google API rate limits)
 *   - Graceful shutdown with 25s timeout
 *   - Dead-letter queue for failed jobs after max retries
 *   - Simple metrics tracking (success/failure counts)
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  ANALYTICS_QUEUE_NAME,
  analyticsQueue,
  initAnalyticsScheduler,
  type AnalyticsDLQJobData,
  type AnalyticsSyncJobData,
  type SyncAllClientsJobData,
} from "@/server/queues/analyticsQueue";

// Module-level logger for worker lifecycle events
const workerLogger = createLogger({ module: "analytics-worker" });

const LOCK_DURATION_MS = 120_000; // BQ-05
const MAX_STALLED_COUNT = 2; // BQ-06
const SHUTDOWN_TIMEOUT_MS = 25_000; // BQ-06
const METRICS_LOG_INTERVAL_MS = 300_000; // 5 minutes

/**
 * Simple in-memory metrics for analytics worker.
 * Emitted to stdout every 5 minutes for log aggregation.
 */
interface WorkerMetrics {
  success: number;
  failed: number;
  durations: number[]; // Last 100 job durations in ms
}

const metrics: WorkerMetrics = {
  success: 0,
  failed: 0,
  durations: [],
};

let metricsInterval: ReturnType<typeof setInterval> | null = null;

function recordDuration(durationMs: number): void {
  metrics.durations.push(durationMs);
  // Keep only last 100 durations to prevent memory growth
  if (metrics.durations.length > 100) {
    metrics.durations.shift();
  }
}

function getAverageDuration(): number | null {
  if (metrics.durations.length === 0) return null;
  const sum = metrics.durations.reduce((a, b) => a + b, 0);
  return Math.round(sum / metrics.durations.length);
}

function emitMetrics(): void {
  const avgDuration = getAverageDuration();
  workerLogger.info("Worker metrics", {
    type: "metrics",
    success: metrics.success,
    failed: metrics.failed,
    avgDurationMs: avgDuration,
    totalProcessed: metrics.success + metrics.failed,
  });
}

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./analytics-processor.js", import.meta.url),
);

let worker: Worker<AnalyticsSyncJobData | SyncAllClientsJobData | AnalyticsDLQJobData> | null = null;

export async function startAnalyticsWorker(): Promise<
  Worker<AnalyticsSyncJobData | SyncAllClientsJobData | AnalyticsDLQJobData>
> {
  if (worker) return worker;

  // Initialize the nightly scheduler first
  await initAnalyticsScheduler();

  worker = new Worker<AnalyticsSyncJobData | SyncAllClientsJobData | AnalyticsDLQJobData>(
    ANALYTICS_QUEUE_NAME,
    PROCESSOR_PATH, // Sandboxed processor
    {
      connection: getSharedBullMQConnection("worker:analytics"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 5, // Lower than audit to respect Google API rate limits
    },
  );

  // Start metrics emission interval
  if (!metricsInterval) {
    metricsInterval = setInterval(emitMetrics, METRICS_LOG_INTERVAL_MS);
  }

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: ANALYTICS_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<AnalyticsSyncJobData | SyncAllClientsJobData | AnalyticsDLQJobData> | undefined,
      err: Error,
    ) => {
      metrics.failed++;

      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "analytics-worker",
        jobId: job.id,
        clientId: (job.data as AnalyticsSyncJobData).clientId,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // Move to dead-letter queue after max retries exhausted
      // Skip DLQ jobs themselves to avoid infinite loops
      if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
        try {
          const dlqData: AnalyticsDLQJobData = {
            originalJobId: job.id,
            originalJobName: job.name,
            data: job.data as AnalyticsSyncJobData | SyncAllClientsJobData,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
            attemptsMade: job.attemptsMade,
          };
          await analyticsQueue.add("dlq:analytics-sync", dlqData, {
            removeOnComplete: false, // Keep DLQ jobs for manual inspection
            removeOnFail: false,
            attempts: 1, // DLQ jobs should not retry
          });
          jobLogger.info("Job moved to DLQ", {
            attemptsMade: job.attemptsMade,
          });
        } catch (dlqErr) {
          jobLogger.error("Failed to move job to DLQ", dlqErr as Error);
        }
      }
    },
  );

  worker.on("completed", (job) => {
    metrics.success++;
    // Record duration if available
    if (job.processedOn && job.finishedOn) {
      recordDuration(job.finishedOn - job.processedOn);
    }
    const jobLogger = createLogger({
      module: "analytics-worker",
      jobId: job.id,
      clientId: (job.data as AnalyticsSyncJobData).clientId,
    });
    jobLogger.info("Job completed", {
      durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined,
    });
  });

  return worker;
}

export async function stopAnalyticsWorker(): Promise<void> {
  // Stop metrics emission
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
    // Emit final metrics before shutdown
    emitMetrics();
  }

  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    workerLogger.error("Graceful shutdown timeout exceeded, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }
}
