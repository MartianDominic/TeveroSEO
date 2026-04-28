/**
 * BullMQ Worker for prospect analysis jobs.
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 300_000 (5 min - analysis takes time)
 *   - maxStalledCount: 2
 *   - Sandboxed processor via file path
 *   - concurrency: 2 (max 2 parallel analyses)
 *   - Graceful shutdown with 25s timeout
 *   - Dead-letter queue for failed jobs after max retries
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  PROSPECT_ANALYSIS_QUEUE_NAME,
  prospectAnalysisQueue,
  type ProspectAnalysisDLQJobData,
  type ProspectAnalysisJobData,
} from "@/server/queues/prospectAnalysisQueue";

const workerLogger = createLogger({ module: "prospect-analysis-worker" });

const LOCK_DURATION_MS = 300_000; // 5 minutes - analysis takes time
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./prospect-analysis-processor.js", import.meta.url),
);

let worker: Worker<ProspectAnalysisJobData | ProspectAnalysisDLQJobData> | null =
  null;

export async function startProspectAnalysisWorker(): Promise<
  Worker<ProspectAnalysisJobData | ProspectAnalysisDLQJobData>
> {
  if (worker) return worker;

  worker = new Worker<ProspectAnalysisJobData | ProspectAnalysisDLQJobData>(
    PROSPECT_ANALYSIS_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:prospect-analysis"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 2, // Max 2 parallel analyses
    },
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: PROSPECT_ANALYSIS_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<ProspectAnalysisJobData | ProspectAnalysisDLQJobData> | undefined,
      err: Error,
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "prospect-analysis-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // Move to DLQ after max retries, skip DLQ jobs
      if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
        try {
          const dlqData: ProspectAnalysisDLQJobData = {
            originalJobId: job.id,
            originalJobName: job.name,
            data: job.data as ProspectAnalysisJobData,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
            attemptsMade: job.attemptsMade,
          };
          await prospectAnalysisQueue.add("dlq:prospect-analysis", dlqData, {
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
      module: "prospect-analysis-worker",
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

export async function stopProspectAnalysisWorker(): Promise<void> {
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
