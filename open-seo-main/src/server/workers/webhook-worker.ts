/**
 * Webhook delivery worker.
 * Phase 18.5: Processes webhook delivery queue.
 */
import { Worker, type Processor, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { type WebhookDeliveryJobData } from "@/server/queues/webhookQueue";
// SCR-01 CONSOLIDATION: Use DB-based DLQ instead of Redis
import { moveToDeadLetter } from "@/server/lib/dead-letter-queue";

const log = createLogger({ module: "webhook-worker" });

const SHUTDOWN_TIMEOUT_MS = 25_000;

const WEBHOOK_QUEUE_NAME = "webhook-delivery" as const;

/**
 * Sanitized job data for DLQ (secrets removed).
 * SECURITY: Uses sanitized data - secrets are never stored in DLQ.
 */
interface SanitizedWebhookJobData {
  deliveryId: string;
  webhookId: string;
  url: string;
  headers: Record<string, string>;
  payload: unknown;
  attempt: number;
}

let webhookWorker: Worker<WebhookDeliveryJobData> | null = null;

/**
 * Start the webhook delivery worker.
 */
export async function startWebhookWorker(): Promise<void> {
  if (webhookWorker) {
    log.warn("Webhook worker already running");
    return;
  }

  const processorPath = new URL("./webhook-processor.js", import.meta.url)
    .pathname;

  webhookWorker = new Worker<WebhookDeliveryJobData>(
    "webhook-delivery",
    processorPath as unknown as Processor<WebhookDeliveryJobData>,
    {
      connection: getSharedBullMQConnection("worker:webhook"),
      concurrency: 5,
      lockDuration: 60000, // 1 minute lock
      maxStalledCount: 2,
    },
  );

  webhookWorker.on("ready", () => {
    log.info("Webhook worker ready");
  });

  webhookWorker.on("completed", (job, result) => {
    log.info("Webhook job completed", {
      jobId: job.id,
      deliveryId: job.data.deliveryId,
      delivered: result?.delivered,
    });
  });

  webhookWorker.on("failed", async (job: Job<WebhookDeliveryJobData> | undefined, err: Error) => {
    if (!job) {
      log.error("Webhook job failed with no job context", err);
      return;
    }

    const maxAttempts = job.opts.attempts ?? 3;
    const jobLogger = createLogger({
      module: "webhook-worker",
      jobId: job.id,
    });

    jobLogger.warn("Webhook job failed", {
      deliveryId: job.data.deliveryId,
      attempt: job.attemptsMade,
      maxAttempts,
      error: err.message,
    });

    // SCR-01 CONSOLIDATION: Use DB-based DLQ for persistence across restarts
    if (job.attemptsMade >= maxAttempts) {
      try {
        // SECURITY: Sanitize job data before storing in DLQ - remove any secrets
        const sanitizedData: SanitizedWebhookJobData = {
          deliveryId: job.data.deliveryId,
          webhookId: job.data.webhookId,
          url: job.data.url,
          headers: job.data.headers,
          payload: job.data.payload,
          attempt: job.data.attempt,
          // Note: secret field is intentionally NOT included
        };
        await moveToDeadLetter({
          jobId: job.id ?? `unknown-${Date.now()}`,
          queue: WEBHOOK_QUEUE_NAME,
          jobName: job.name,
          data: sanitizedData, // Use sanitized data, not raw job.data
          error: err.message,
          // Only include stack in non-production to prevent info leakage
          stackTrace: process.env.NODE_ENV === "development" ? err.stack : undefined,
          retryCount: job.attemptsMade,
        });
        jobLogger.info("Webhook job moved to DB-based DLQ", { attemptsMade: job.attemptsMade });
      } catch (dlqErr) {
        jobLogger.error("Failed to move webhook job to DLQ", dlqErr as Error);
      }
    }
  });

  webhookWorker.on("error", (err) => {
    log.error("Webhook worker error", err);
  });

  webhookWorker.on("stalled", (jobId) => {
    log.warn("Webhook job stalled", { jobId, queue: "webhook-delivery" });
  });

  log.info("Webhook worker started");
}

/**
 * Stop the webhook worker gracefully.
 */
export async function stopWebhookWorker(): Promise<void> {
  if (!webhookWorker) {
    return;
  }

  log.info("Stopping webhook worker...");

  const current = webhookWorker;
  webhookWorker = null;

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

  log.info("Webhook worker stopped");
}

/**
 * Check if webhook worker is running.
 */
export function isWebhookWorkerRunning(): boolean {
  return webhookWorker !== null;
}
