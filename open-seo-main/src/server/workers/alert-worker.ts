/**
 * BullMQ worker for alert processing.
 * Phase 18: Monitoring & Alerts
 */
import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  ALERT_QUEUE_NAME,
  initAlertScheduler,
  closeAlertQueue,
  getAlertQueue,
  type AlertJobData,
  type AlertDLQJobData,
} from "@/server/queues/alertQueue";
import processor from "./alert-processor";

const log = createLogger({ module: "alert-worker" });

const SHUTDOWN_TIMEOUT_MS = 25_000;

let alertWorker: Worker<AlertJobData> | null = null;

/**
 * Start the alert worker.
 */
export async function startAlertWorker(): Promise<void> {
  if (alertWorker) {
    log.warn("Alert worker already running");
    return;
  }

  // Initialize the scheduler for repeatable jobs
  await initAlertScheduler();

  alertWorker = new Worker<AlertJobData>(
    ALERT_QUEUE_NAME,
    processor,
    {
      connection: getSharedBullMQConnection("worker:alert"),
      lockDuration: 60_000, // 1 minute
      maxStalledCount: 2,
      concurrency: 1,
    },
  );

  alertWorker.on("completed", (job, result) => {
    log.info("Alert job completed", {
      jobId: job.id,
      type: job.data.type,
      alertsCreated: result?.alertsCreated?.length ?? 0,
    });
  });

  alertWorker.on("failed", async (job: Job<AlertJobData> | undefined, err: Error) => {
    if (!job) {
      log.error("Alert job failed with no job context", err);
      return;
    }

    const maxAttempts = job.opts.attempts ?? 3;
    const jobLogger = createLogger({
      module: "alert-worker",
      jobId: job.id,
    });

    jobLogger.error("Alert job failed", err, {
      type: job.data.type,
      attempt: job.attemptsMade,
      maxAttempts,
    });

    // Move to DLQ after max retries, skip DLQ jobs
    if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
      try {
        const dlqData: AlertDLQJobData = {
          ...job.data,
          originalJobId: job.id,
          failedAt: new Date().toISOString(),
          error: err.message,
        };
        const queue = getAlertQueue();
        await queue.add("dlq:alert-processing", dlqData, {
          removeOnComplete: false,
          removeOnFail: false,
          attempts: 1,
        });
        jobLogger.info("Alert job moved to DLQ", { attemptsMade: job.attemptsMade });
      } catch (dlqErr) {
        jobLogger.error("Failed to move alert job to DLQ", dlqErr as Error);
      }
    }
  });

  alertWorker.on("error", (err) => {
    log.error("Alert worker error", err);
  });

  // Wait for ready before returning
  await new Promise<void>((resolve) => {
    alertWorker!.on("ready", () => {
      log.info("Alert worker ready");
      resolve();
    });
  });

  log.info("Alert worker started");
}

/**
 * Stop the alert worker gracefully.
 */
export async function stopAlertWorker(): Promise<void> {
  if (alertWorker) {
    const current = alertWorker;
    alertWorker = null;

    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
    );
    const closed = current.close().then(() => "closed" as const);
    const result = await Promise.race([closed, timeout]);

    if (result === "timeout") {
      log.error("Graceful shutdown timeout exceeded, forcing close", undefined, {
        timeoutMs: SHUTDOWN_TIMEOUT_MS,
      });
      await current.close(true);
    }

    log.info("Alert worker stopped");
  }

  await closeAlertQueue();
}
