/**
 * BullMQ Queue definition for portfolio aggregates computation.
 *
 * - Runs every 5 minutes to pre-compute workspace-level aggregates
 * - Aggregates client_dashboard_metrics into portfolio_aggregates
 *
 * Phase 23: Performance & Scale
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "portfolioAggregatesQueue" });

export const PORTFOLIO_AGGREGATES_QUEUE_NAME = "portfolio-aggregates" as const;

/**
 * Job data for portfolio aggregates computation.
 */
export interface PortfolioAggregatesJobData {
  triggeredAt: string; // ISO timestamp
}

/**
 * Dead-letter queue job data for failed jobs.
 */
export interface PortfolioAggregatesDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: PortfolioAggregatesJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options.
 * 3 attempts with exponential backoff (30s, 60s, 120s).
 */
/**
 * Default job options for portfolio aggregates.
 * Job timeout is controlled via Worker lockDuration in portfolio-aggregates-worker.ts.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 30_000,
  },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};

/**
 * Portfolio aggregates queue.
 */
export const portfolioAggregatesQueue = new Queue<
  PortfolioAggregatesJobData | PortfolioAggregatesDLQJobData
>(PORTFOLIO_AGGREGATES_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:portfolio-aggregates"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Initialize the portfolio aggregates queue with a repeatable job.
 * Runs every 5 minutes to compute aggregates for all workspaces.
 */
export async function initPortfolioAggregatesScheduler(): Promise<void> {
  // Remove any existing repeatable jobs first to avoid duplicates
  const repeatableJobs = await portfolioAggregatesQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await portfolioAggregatesQueue.removeRepeatableByKey(job.key);
  }

  // Add repeatable job that runs every 5 minutes
  await portfolioAggregatesQueue.add(
    "compute-aggregates",
    { triggeredAt: new Date().toISOString() },
    {
      repeat: {
        pattern: "*/5 * * * *", // Every 5 minutes
      },
      jobId: "portfolio-aggregates-compute",
    },
  );

  log.info("Portfolio aggregates queue initialized with 5-minute repeatable job");
}

/**
 * Manually trigger an aggregates computation.
 */
export async function triggerPortfolioAggregatesCompute(): Promise<void> {
  await portfolioAggregatesQueue.add(
    "compute-aggregates",
    { triggeredAt: new Date().toISOString() },
    {
      jobId: `manual-aggregates-${Date.now()}`,
    },
  );
  log.info("Manual portfolio aggregates computation triggered");
}
