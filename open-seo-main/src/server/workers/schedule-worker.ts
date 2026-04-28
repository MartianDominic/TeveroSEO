/**
 * BullMQ Worker for schedule check jobs.
 *
 * Wires:
 *   - Shared Redis connection via getSharedBullMQConnection()
 *   - lockDuration: 60_000 (enough for DB queries)
 *   - maxStalledCount: 2
 *   - Sandboxed processor via file path
 *   - concurrency: 1 (single scheduler - no parallel schedule checks)
 *   - Graceful shutdown with 25s timeout
 *   - Dead-letter queue for failed jobs after max retries
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  SCHEDULE_QUEUE_NAME,
  scheduleQueue,
  initScheduleQueue,
  type ScheduleDLQJobData,
  type ScheduleJobData,
} from "@/server/queues/scheduleQueue";

const workerLogger = createLogger({ module: "schedule-worker" });

const LOCK_DURATION_MS = 60_000; // Enough for DB queries
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./schedule-processor.js", import.meta.url),
);

let worker: Worker<ScheduleJobData | ScheduleDLQJobData> | null = null;

export async function startScheduleWorker(): Promise<
  Worker<ScheduleJobData | ScheduleDLQJobData>
> {
  if (worker) return worker;

  // Initialize the repeatable job
  await initScheduleQueue();

  worker = new Worker<ScheduleJobData | ScheduleDLQJobData>(
    SCHEDULE_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:schedule"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1, // Single scheduler - no parallel schedule checks
    },
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: SCHEDULE_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<ScheduleJobData | ScheduleDLQJobData> | undefined,
      err: Error,
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const jobLogger = createLogger({
        module: "schedule-worker",
        jobId: job.id,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // Move to DLQ after max retries, skip DLQ jobs
      if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
        try {
          const dlqData: ScheduleDLQJobData = {
            originalJobId: job.id,
            originalJobName: job.name,
            data: job.data as ScheduleJobData,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
            attemptsMade: job.attemptsMade,
          };
          await scheduleQueue.add("dlq:report-scheduler", dlqData, {
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
      module: "schedule-worker",
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

export async function stopScheduleWorker(): Promise<void> {
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
      {
        timeoutMs: SHUTDOWN_TIMEOUT_MS,
      },
    );
    await current.close(true);
  }
}
