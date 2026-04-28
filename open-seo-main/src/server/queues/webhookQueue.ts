/**
 * Webhook delivery queue.
 * Phase 18.5: Async webhook delivery with exponential backoff.
 */
import { Queue } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  addJobWithBackpressure,
  QueueBackpressureError,
} from "@/server/lib/queue-utils";

const log = createLogger({ module: "webhook-queue" });

export interface WebhookPayload {
  id: string;
  type: string;
  version: string;
  created_at: string;
  idempotency_key: string;
  scope: {
    level: "global" | "workspace" | "client";
    workspace_id?: string;
    client_id?: string;
  };
  data: Record<string, unknown>;
  context: {
    project_name?: string;
    client_name?: string;
    workspace_name?: string;
  };
  links: {
    dashboard?: string;
    api?: string;
  };
}

export interface WebhookDeliveryJobData {
  deliveryId: string;
  webhookId: string;
  url: string;
  /** @deprecated Use webhookId to fetch secret at delivery time. Removed for security. */
  secret?: never;
  headers: Record<string, string>;
  payload: WebhookPayload;
  attempt: number;
}

let webhookQueue: Queue<WebhookDeliveryJobData> | null = null;

/**
 * Get or create the webhook delivery queue.
 */
export function getWebhookQueue(): Queue<WebhookDeliveryJobData> {
  if (!webhookQueue) {
    webhookQueue = new Queue<WebhookDeliveryJobData>("webhook-delivery", {
      connection: getSharedBullMQConnection("queue:webhook"),
      // Job timeout controlled via Worker lockDuration (set to 60s in webhook-worker.ts)
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000, // 1m base, then ~5m, ~30m
        },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 500 }, // Keep 7 days or 500 jobs max
      },
    });
    log.info("Webhook delivery queue initialized");
  }
  return webhookQueue;
}

/**
 * Enqueue a webhook delivery job with backpressure protection.
 *
 * @throws QueueBackpressureError if queue is at capacity
 */
export async function enqueueWebhookDelivery(
  data: WebhookDeliveryJobData,
): Promise<string> {
  const queue = getWebhookQueue();
  const job = await addJobWithBackpressure(
    queue,
    `deliver:${data.deliveryId}`,
    data,
    { jobId: data.deliveryId },
    { maxQueueSize: 10000, allowDegradedMode: true },
  );
  log.info("Webhook delivery enqueued", {
    deliveryId: data.deliveryId,
    webhookId: data.webhookId,
    eventType: data.payload.type,
  });
  return job.id ?? data.deliveryId;
}

// Re-export for caller convenience
export { QueueBackpressureError };

/**
 * Close the queue connection.
 */
export async function closeWebhookQueue(): Promise<void> {
  if (webhookQueue) {
    await webhookQueue.close();
    webhookQueue = null;
    log.info("Webhook delivery queue closed");
  }
}
