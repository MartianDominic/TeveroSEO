/**
 * BullMQ Queue definition for pipeline metrics computation.
 * Phase 62-04: Pipeline Metrics Computation Worker
 *
 * - `pipelineMetricsQueue` - primary queue for metrics jobs
 * - Handles single workspace computation and batch stale refresh
 * - Scheduled refresh every 5 minutes per D-07
 *
 * Job types:
 * - compute_workspace: Compute metrics for a single workspace
 * - compute_all_stale: Find and refresh all stale workspaces
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "pipelineMetricsQueue" });

export const PIPELINE_METRICS_QUEUE_NAME = "pipeline-metrics" as const;

/**
 * Job data types for pipeline metrics queue.
 */
export interface PipelineMetricsJobData {
  type: "compute_workspace" | "compute_all_stale";
  workspaceId?: string;
}

/**
 * Dead-letter queue job data for failed pipeline metrics jobs.
 */
export interface PipelineMetricsDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: PipelineMetricsJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 * Metrics computation is idempotent so retries are safe.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  attempts: 2,
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
});

/**
 * Pipeline metrics queue.
 * Uses shared BullMQ connection for Redis.
 */
export const pipelineMetricsQueue = new Queue<
  PipelineMetricsJobData | PipelineMetricsDLQJobData
>(PIPELINE_METRICS_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:pipeline-metrics"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Initialize the pipeline metrics queue with scheduled jobs.
 * - Refresh all stale metrics every 5 minutes
 */
export async function initPipelineMetricsQueue(): Promise<void> {
  // Add scheduled refresh every 5 minutes
  await pipelineMetricsQueue.add(
    "refresh-all-stale",
    { type: "compute_all_stale" },
    {
      repeat: {
        every: 5 * 60 * 1000, // 5 minutes
      },
      jobId: "pipeline-metrics-refresh",
    }
  );

  // Clean up old repeatable jobs
  const repeatableJobs = await pipelineMetricsQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id !== "pipeline-metrics-refresh") {
      await pipelineMetricsQueue.removeRepeatableByKey(job.key);
    }
  }

  log.info("Pipeline metrics queue initialized with 5-minute refresh schedule");
}

/**
 * Schedule a pipeline metrics refresh (called from initPipelineMetricsQueue).
 * This is the function exported per the plan spec.
 */
export async function schedulePipelineMetricsRefresh(): Promise<void> {
  await initPipelineMetricsQueue();
}

/**
 * Enqueue metrics computation for a single workspace.
 * Used when metrics are requested but stale/missing.
 *
 * @param workspaceId - Workspace to compute metrics for
 */
export async function enqueueWorkspaceMetrics(
  workspaceId: string
): Promise<void> {
  await pipelineMetricsQueue.add(
    "compute-workspace",
    { type: "compute_workspace", workspaceId },
    {
      jobId: `compute-${workspaceId}-${Date.now()}`,
    }
  );
  log.debug("Workspace metrics computation enqueued", { workspaceId });
}

/**
 * Enqueue computation for all stale workspaces.
 * Used by scheduled job to refresh outdated metrics.
 */
export async function enqueueStaleRefresh(): Promise<void> {
  await pipelineMetricsQueue.add(
    "refresh-stale",
    { type: "compute_all_stale" },
    {
      jobId: `refresh-stale-${Date.now()}`,
    }
  );
  log.debug("Stale metrics refresh enqueued");
}

/**
 * Get queue metrics for monitoring.
 */
export async function getPipelineMetricsQueueMetrics(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    pipelineMetricsQueue.getWaitingCount(),
    pipelineMetricsQueue.getActiveCount(),
    pipelineMetricsQueue.getCompletedCount(),
    pipelineMetricsQueue.getFailedCount(),
    pipelineMetricsQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}
