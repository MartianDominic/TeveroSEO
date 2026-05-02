/**
 * Alert Detection Worker
 * Phase 62-07: Smart Alert Detection
 *
 * BullMQ worker that processes alert detection jobs.
 * Runs detection every 5 minutes for all active workspaces.
 *
 * Features:
 * - Parallel workspace processing with concurrency limit
 * - Error isolation per workspace
 * - Integration with Socket.IO for real-time notifications
 * - Dead-letter queue support for failed jobs
 */

import { Worker, type Job, type Processor } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";
import {
  ALERT_DETECTION_QUEUE_NAME,
  type AlertDetectionJobData,
} from "@/server/queues/alertDetectionQueue";
import { processAlertDetection } from "./alert-detection-processor";

const log = createLogger({ module: "alert-detection-worker" });

let worker: Worker<AlertDetectionJobData> | null = null;

/**
 * Worker processor function.
 */
const processor: Processor<AlertDetectionJobData> = async (
  job: Job<AlertDetectionJobData>
) => {
  await processAlertDetection(job);
};

/**
 * Start the alert detection worker.
 */
export function startAlertDetectionWorker(): void {
  if (worker) {
    log.warn("Alert detection worker already started");
    return;
  }

  worker = new Worker(ALERT_DETECTION_QUEUE_NAME, processor, {
    connection: getSharedBullMQConnection("worker:alert-detection"),
    concurrency: 1, // Process one job at a time to avoid rate limit issues
    limiter: {
      max: 10,
      duration: 60000, // Max 10 jobs per minute
    },
  });

  // Error handler
  worker.on("error", (error) => {
    log.error(
      "Alert detection worker error",
      error instanceof Error ? error : new Error(String(error))
    );
  });

  // Failed job handler - send to DLQ
  worker.on("failed", async (job, error) => {
    if (!job) return;

    log.warn("Alert detection job failed", {
      jobId: job.id,
      jobName: job.name,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });

    // Send to dead-letter queue after all attempts exhausted
    if (job.attemptsMade >= (job.opts.attempts ?? 2)) {
      try {
        const dlqData: DLQJobData = {
          originalQueue: ALERT_DETECTION_QUEUE_NAME,
          jobId: job.id,
          jobData: job.data,
          error: error.message,
          stack: error.stack,
          failedAt: new Date().toISOString(),
        };

        await getDLQQueue().add("alert-detection-dlq", dlqData, {
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        });

        log.info("Failed alert detection job sent to DLQ", {
          originalJobId: job.id,
        });
      } catch (dlqError) {
        log.error(
          "Failed to send job to DLQ",
          dlqError instanceof Error ? dlqError : new Error(String(dlqError)),
          { jobId: job.id }
        );
      }
    }
  });

  // Completed job handler
  worker.on("completed", (job) => {
    log.debug("Alert detection job completed", {
      jobId: job.id,
      jobName: job.name,
    });
  });

  log.info("Alert detection worker started");
}

/**
 * Stop the alert detection worker.
 */
export async function stopAlertDetectionWorker(): Promise<void> {
  if (!worker) {
    log.warn("Alert detection worker not started");
    return;
  }

  await worker.close();
  worker = null;

  log.info("Alert detection worker stopped");
}

/**
 * Get worker status for monitoring.
 */
export function getAlertDetectionWorkerStatus(): {
  isRunning: boolean;
  isPaused: boolean;
} {
  return {
    isRunning: worker !== null,
    isPaused: worker?.isPaused() ?? false,
  };
}
