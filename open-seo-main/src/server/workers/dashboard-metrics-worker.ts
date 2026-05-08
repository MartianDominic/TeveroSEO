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
  closeDashboardMetricsQueue,
  type DashboardMetricsJobData,
} from "@/server/queues/dashboardMetricsQueue";
// SCR-01 CONSOLIDATION: Use DB-based DLQ instead of Redis
import { moveJobToDeadLetter } from "@/server/lib/dead-letter-queue";
import { processDashboardMetrics } from "./dashboard-metrics-processor";

const workerLogger = createLogger({ module: "dashboard-metrics-worker" });

const LOCK_DURATION_MS = 300_000; // 5 minutes (must complete before next run)
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

let worker: Worker<DashboardMetricsJobData> | null = null;

export async function startDashboardMetricsWorker(): Promise<
  Worker<DashboardMetricsJobData>
> {
  if (worker) return worker;

  // Initialize the scheduler
  await initDashboardMetricsScheduler();

  worker = new Worker<DashboardMetricsJobData>(
    DASHBOARD_METRICS_QUEUE_NAME,
    async (job) => {
      await processDashboardMetrics(job);
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
      job: Job<DashboardMetricsJobData> | undefined,
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

      // SCR-01 CONSOLIDATION: Use DB-based DLQ for persistence across restarts
      if (job.attemptsMade >= maxAttempts) {
        await moveJobToDeadLetter(job, err, DASHBOARD_METRICS_QUEUE_NAME);
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

  worker.on("stalled", (jobId) => {
    workerLogger.warn("Job stalled", { jobId, queue: DASHBOARD_METRICS_QUEUE_NAME });
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
