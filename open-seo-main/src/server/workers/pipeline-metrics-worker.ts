/**
 * BullMQ Worker for pipeline metrics jobs.
 * Phase 62-04: Pipeline Metrics Computation Worker
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 60_000 (metrics computation is fast)
 *   - maxStalledCount: 2
 *   - Sandboxed processor via file path
 *   - concurrency: 3 (parallel workspace computations)
 *   - Graceful shutdown with 30s timeout
 *   - Dead-letter queue for failed jobs after max retries
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  PIPELINE_METRICS_QUEUE_NAME,
  pipelineMetricsQueue,
  initPipelineMetricsQueue,
  type PipelineMetricsDLQJobData,
  type PipelineMetricsJobData,
} from "@/server/queues/pipelineMetricsQueue";

const workerLogger = createLogger({ module: "pipeline-metrics-worker" });

const LOCK_DURATION_MS = 60_000; // 1 minute for metrics computation
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 30_000;
const CONCURRENCY = 3;

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./pipeline-metrics-processor.js", import.meta.url)
);

let worker: Worker<PipelineMetricsJobData | PipelineMetricsDLQJobData> | null =
  null;

export async function startPipelineMetricsWorker(): Promise<
  Worker<PipelineMetricsJobData | PipelineMetricsDLQJobData>
> {
  if (worker) return worker;

  // Initialize the repeatable jobs (5-minute refresh)
  await initPipelineMetricsQueue();

  worker = new Worker<PipelineMetricsJobData | PipelineMetricsDLQJobData>(
    PIPELINE_METRICS_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:pipeline-metrics"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: CONCURRENCY,
    }
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", {
      queue: PIPELINE_METRICS_QUEUE_NAME,
      concurrency: CONCURRENCY,
    });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<PipelineMetricsJobData | PipelineMetricsDLQJobData> | undefined,
      err: Error
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "pipeline-metrics-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
        type: (job.data as PipelineMetricsJobData).type,
      });

      // Move to DLQ after max retries, skip DLQ jobs
      if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
        try {
          const dlqData: PipelineMetricsDLQJobData = {
            originalJobId: job.id,
            originalJobName: job.name,
            data: job.data as PipelineMetricsJobData,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
            attemptsMade: job.attemptsMade,
          };
          await pipelineMetricsQueue.add("dlq:pipeline-metrics", dlqData, {
            removeOnComplete: { age: 604800 }, // 7 days
            removeOnFail: { age: 604800 },
            attempts: 1,
          });
          jobLogger.info("Job moved to DLQ", {
            attemptsMade: job.attemptsMade,
            type: (job.data as PipelineMetricsJobData).type,
          });
        } catch (dlqErr) {
          jobLogger.error("Failed to move job to DLQ", dlqErr as Error);
        }
      }
    }
  );

  worker.on("completed", (job) => {
    const jobLogger = createLogger({
      module: "pipeline-metrics-worker",
      jobId: job.id,
    });
    jobLogger.debug("Job completed", {
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
      type: (job.data as PipelineMetricsJobData).type,
    });
  });

  worker.on("stalled", (jobId) => {
    workerLogger.warn("Job stalled", {
      jobId,
      queue: PIPELINE_METRICS_QUEUE_NAME,
    });
  });

  return worker;
}

export async function stopPipelineMetricsWorker(): Promise<void> {
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
  } else {
    workerLogger.info("Worker stopped gracefully");
  }
}
