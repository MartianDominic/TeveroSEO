/**
 * BullMQ queue for portal notifications.
 * Phase 90-01: Trust Foundation
 *
 * Queues notification jobs for async delivery via email, Slack, push.
 * Follows alertQueue.ts pattern for consistency.
 */
import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";
import type { NotificationType, NotificationChannel, NotificationPayload } from "@/db";

const log = createLogger({ module: "notificationQueue" });

export const NOTIFICATION_QUEUE_NAME = "portal-notifications";

/**
 * Job data for notification processing.
 */
export interface NotificationJobData {
  /** Database notification ID */
  notificationId: string;
  /** Client UUID */
  clientId: string;
  /** Notification type: win, alert, update, digest */
  type: NotificationType;
  /** Delivery channel: in_app, email, slack, push */
  channel: NotificationChannel;
  /** Notification payload (varies by type) */
  payload: NotificationPayload;
  /** Client email for email channel */
  recipientEmail?: string;
  /** Slack webhook URL for slack channel */
  slackWebhookUrl?: string;
}

/**
 * Default job options for notification processing.
 * Uses standard retry config: exponential backoff with 1s base, 60s max.
 */
const defaultJobOptions: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
});

let notificationQueue: Queue<NotificationJobData> | null = null;

/**
 * Get or create the notification queue singleton.
 */
export function getNotificationQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
      connection: getSharedBullMQConnection("queue:notification"),
      defaultJobOptions,
    });
    log.info("Notification queue initialized", { name: NOTIFICATION_QUEUE_NAME });
  }
  return notificationQueue;
}

/**
 * Manually trigger a notification for testing.
 */
export async function triggerNotification(
  data: NotificationJobData
): Promise<string> {
  const queue = getNotificationQueue();
  const job = await queue.add(data.type, data, {
    jobId: `notif-${data.notificationId}`,
  });
  log.info("Notification triggered", {
    jobId: job.id,
    notificationId: data.notificationId,
    type: data.type,
    channel: data.channel,
  });
  return job.id ?? "";
}

/**
 * Close the queue connection.
 */
export async function closeNotificationQueue(): Promise<void> {
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
    log.info("Notification queue closed");
  }
}
