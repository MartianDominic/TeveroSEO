/**
 * BullMQ Queue definition for dashboard metrics computation.
 *
 * - `dashboardMetricsQueue` - primary queue for metrics computation
 * - Runs every 5 minutes to pre-compute client dashboard metrics
 *
 * Job types:
 * - compute-metrics: Process all clients and update metrics
 * - dlq:dashboard-metrics: Dead-letter queue for failed jobs
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "dashboardMetricsQueue" });

export const DASHBOARD_METRICS_QUEUE_NAME = "dashboard-metrics" as const;

/**
 * Job data for metrics computation.
 */
export interface DashboardMetricsJobData {
  triggeredAt: string; // ISO timestamp
}

/**
 * Dead-letter queue job data for failed metrics jobs.
 */
export interface DashboardMetricsDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: DashboardMetricsJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options for dashboard metrics.
 * Job timeout is controlled via Worker lockDuration in dashboard-metrics-worker.ts.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
});

/**
 * Dashboard metrics queue.
 * Uses shared BullMQ connection for Redis.
 */
export const dashboardMetricsQueue = new Queue<
  DashboardMetricsJobData | DashboardMetricsDLQJobData
>(DASHBOARD_METRICS_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:dashboard-metrics"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Initialize the dashboard metrics queue with a repeatable job.
 * Runs every 5 minutes to compute metrics for all clients.
 */
export async function initDashboardMetricsScheduler(): Promise<void> {
  // Remove any existing repeatable jobs first to avoid duplicates
  const repeatableJobs = await dashboardMetricsQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await dashboardMetricsQueue.removeRepeatableByKey(job.key);
  }

  // Add repeatable job that runs every 5 minutes
  await dashboardMetricsQueue.add(
    "compute-metrics",
    { triggeredAt: new Date().toISOString() },
    {
      repeat: {
        pattern: "*/5 * * * *", // Every 5 minutes
      },
      jobId: "dashboard-metrics-compute",
    },
  );

  log.info("Dashboard metrics queue initialized with 5-minute repeatable job");
}

/**
 * Manually trigger a metrics computation.
 * Useful for testing or immediate metrics updates.
 */
export async function triggerDashboardMetricsCompute(): Promise<void> {
  await dashboardMetricsQueue.add(
    "compute-metrics",
    { triggeredAt: new Date().toISOString() },
    {
      jobId: `manual-metrics-${Date.now()}`,
    },
  );
  log.info("Manual metrics computation triggered");
}

/**
 * Close the dashboard metrics queue connection.
 * Call this during application shutdown to prevent connection leaks.
 */
export async function closeDashboardMetricsQueue(): Promise<void> {
  await dashboardMetricsQueue.close();
  log.info("Dashboard metrics queue closed");
}
