/**
 * BullMQ Worker for portfolio aggregates computation.
 * Runs every 5 minutes to pre-compute workspace-level aggregates.
 *
 * Phase 23: Performance & Scale
 */

import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  PORTFOLIO_AGGREGATES_QUEUE_NAME,
  initPortfolioAggregatesScheduler,
  portfolioAggregatesQueue,
  type PortfolioAggregatesJobData,
  type PortfolioAggregatesDLQJobData,
} from "@/server/queues/portfolioAggregatesQueue";
import { processPortfolioAggregates } from "./portfolio-aggregates-processor";

const workerLogger = createLogger({ module: "portfolio-aggregates-worker" });

const LOCK_DURATION_MS = 300_000; // 5 minutes
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

let worker: Worker<PortfolioAggregatesJobData | PortfolioAggregatesDLQJobData> | null = null;

export async function startPortfolioAggregatesWorker(): Promise<
  Worker<PortfolioAggregatesJobData | PortfolioAggregatesDLQJobData>
> {
  if (worker) return worker;

  // Initialize the scheduler
  await initPortfolioAggregatesScheduler();

  worker = new Worker<PortfolioAggregatesJobData | PortfolioAggregatesDLQJobData>(
    PORTFOLIO_AGGREGATES_QUEUE_NAME,
    async (job) => {
      if (job.name === "dlq:portfolio-aggregates") {
        workerLogger.warn("DLQ job received", { jobId: job.id, data: job.data });
        return;
      }
      await processPortfolioAggregates(job as Job<PortfolioAggregatesJobData>);
    },
    {
      connection: getSharedBullMQConnection("worker:portfolio-aggregates"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1,
    },
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: PORTFOLIO_AGGREGATES_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err);
  });

  worker.on(
    "failed",
    async (
      job: Job<PortfolioAggregatesJobData | PortfolioAggregatesDLQJobData> | undefined,
      err: Error,
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "portfolio-aggregates-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // Move to DLQ after max retries
      if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
        try {
          const dlqData: PortfolioAggregatesDLQJobData = {
            originalJobId: job.id,
            originalJobName: job.name,
            data: job.data as PortfolioAggregatesJobData,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
            attemptsMade: job.attemptsMade,
          };
          await portfolioAggregatesQueue.add("dlq:portfolio-aggregates", dlqData, {
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
      module: "portfolio-aggregates-worker",
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

export async function stopPortfolioAggregatesWorker(): Promise<void> {
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
}
