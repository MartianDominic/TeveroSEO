/**
 * BullMQ Worker for dashboard metrics computation.
 * Runs every 5 minutes to pre-compute client dashboard metrics.
 *
 * Phase 21: Agency Command Center
 */

import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  DASHBOARD_METRICS_QUEUE_NAME,
  initDashboardMetricsScheduler,
  dashboardMetricsQueue,
  closeDashboardMetricsQueue,
  type DashboardMetricsJobData,
  type DashboardMetricsDLQJobData,
} from "@/server/queues/dashboardMetricsQueue";
import { processDashboardMetrics } from "./dashboard-metrics-processor";

const workerLogger = createLogger({ module: "dashboard-metrics-worker" });

const LOCK_DURATION_MS = 300_000; // 5 minutes (must complete before next run)
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

let worker: Worker<DashboardMetricsJobData | DashboardMetricsDLQJobData> | null = null;

export async function startDashboardMetricsWorker(): Promise<
  Worker<DashboardMetricsJobData | DashboardMetricsDLQJobData>
> {
  if (worker) return worker;

  // Initialize the scheduler
  await initDashboardMetricsScheduler();

  worker = new Worker<DashboardMetricsJobData | DashboardMetricsDLQJobData>(
    DASHBOARD_METRICS_QUEUE_NAME,
    async (job) => {
      if (job.name === "dlq:dashboard-metrics") {
        workerLogger.warn("DLQ job received", { jobId: job.id, data: job.data });
        return;
      }
      await processDashboardMetrics(job as Job<DashboardMetricsJobData>);
    },
    {
      connection: getSharedBullMQConnection("worker:dashboard-metrics"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1, // Single metrics computation at a time
    },
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: DASHBOARD_METRICS_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err);
  });

  worker.on(
    "failed",
    async (
      job: Job<DashboardMetricsJobData | DashboardMetricsDLQJobData> | undefined,
      err: Error,
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "dashboard-metrics-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // Move to DLQ after max retries, skip DLQ jobs
      if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
        try {
          const dlqData: DashboardMetricsDLQJobData = {
            originalJobId: job.id,
            originalJobName: job.name,
            data: job.data as DashboardMetricsJobData,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
            attemptsMade: job.attemptsMade,
          };
          await dashboardMetricsQueue.add("dlq:dashboard-metrics", dlqData, {
            removeOnComplete: false,
            removeOnFail: false,
            attempts: 1,
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
      module: "dashboard-metrics-worker",
      jobId: job.id,
    });
    jobLogger.info("Job completed", {
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
    });
  });

  return worker;
}

export async function stopDashboardMetricsWorker(): Promise<void> {
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

  // Close the queue to prevent connection leaks
  await closeDashboardMetricsQueue();
}
