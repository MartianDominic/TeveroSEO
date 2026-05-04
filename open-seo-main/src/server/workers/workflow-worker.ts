/**
 * BullMQ Worker for engagement workflow jobs.
 * Phase 62-03: Engagement Workflow Engine
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 120_000 (workflows may involve external calls)
 *   - maxStalledCount: 2
 *   - Sandboxed processor via file path
 *   - concurrency: 5 (parallel workflow executions)
 *   - Graceful shutdown with 30s timeout
 *   - Dead-letter queue for failed jobs after max retries
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  WORKFLOW_QUEUE_NAME,
  initWorkflowQueue,
  type WorkflowJobData,
} from "@/server/queues/workflowQueue";
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";

const workerLogger = createLogger({ module: "workflow-worker" });

const LOCK_DURATION_MS = 120_000; // Longer for external calls (email, webhook)
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 30_000;
const CONCURRENCY = 5;

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./workflow-processor.js", import.meta.url),
);

let worker: Worker<WorkflowJobData> | null = null;

export async function startWorkflowWorker(): Promise<
  Worker<WorkflowJobData>
> {
  if (worker) return worker;

  // Initialize the repeatable jobs (weekly touch reset)
  await initWorkflowQueue();

  worker = new Worker<WorkflowJobData>(
    WORKFLOW_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:workflow"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: CONCURRENCY,
    },
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: WORKFLOW_QUEUE_NAME, concurrency: CONCURRENCY });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<WorkflowJobData> | undefined,
      err: Error,
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "workflow-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
        type: job.data.type,
      });

      // H-BULL-01 FIX: Use centralized DLQ instead of same-queue dlq: prefix
      if (job.attemptsMade >= maxAttempts) {
        try {
          const dlqQueue = getDLQQueue();
          const dlqData: DLQJobData = {
            originalQueue: WORKFLOW_QUEUE_NAME,
            jobId: job.id,
            jobData: job.data,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
          };
          await dlqQueue.add(`dlq:${WORKFLOW_QUEUE_NAME}:${job.id}`, dlqData);
          jobLogger.info("Job moved to centralized DLQ", {
            attemptsMade: job.attemptsMade,
            type: job.data.type,
          });
        } catch (dlqErr) {
          jobLogger.error("Failed to move job to DLQ", dlqErr as Error);
        }
      }
    },
  );

  worker.on("completed", (job) => {
    const jobLogger = createLogger({
      module: "workflow-worker",
      jobId: job.id,
    });
    jobLogger.debug("Job completed", {
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
      type: job.data.type,
    });
  });

  worker.on("stalled", (jobId) => {
    workerLogger.warn("Job stalled", { jobId, queue: WORKFLOW_QUEUE_NAME });
  });

  return worker;
}

export async function stopWorkflowWorker(): Promise<void> {
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
  } else {
    workerLogger.info("Worker stopped gracefully");
  }
}
