/**
 * BullMQ worker for portal notification delivery.
 * Phase 90-01: Trust Foundation
 *
 * Processes notification jobs from the notification queue.
 * Delivers via appropriate channel: email (Resend), Slack, push.
 *
 * Per D-06 (Resend for email): Uses existing Resend configuration.
 * Per D-07 (BullMQ for async): All notification sends are queued.
 */
import { Worker, type Job } from "bullmq";
import { Resend } from "resend";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  NOTIFICATION_QUEUE_NAME,
  type NotificationJobData,
} from "@/server/queues/notificationQueue";
import { NotificationService } from "@/server/features/portal/services/NotificationService";

const log = createLogger({ module: "notification-worker" });

/** Lock duration for jobs (60 seconds) */
const LOCK_DURATION_MS = 60_000;

/** Resend API client */
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

/**
 * Process a notification job.
 *
 * Routes to appropriate channel handler.
 */
async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { notificationId, clientId, type, channel, payload, recipientEmail, slackWebhookUrl } =
    job.data;

  log.info("Processing notification", {
    jobId: job.id,
    notificationId,
    type,
    channel,
  });

  try {
    switch (channel) {
      case "email":
        await sendEmailNotification(job.data);
        break;
      case "slack":
        await sendSlackNotification(job.data);
        break;
      case "push":
        await sendPushNotification(job.data);
        break;
      case "in_app":
        // in_app notifications are already stored in DB, just mark as sent
        break;
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }

    // Mark as sent on success
    await NotificationService.markNotificationSent(notificationId);

    log.info("Notification delivered", {
      jobId: job.id,
      notificationId,
      type,
      channel,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error("Notification delivery failed", new Error(errorMessage), {
      jobId: job.id,
      notificationId,
      type,
      channel,
    });

    // Mark as failed
    await NotificationService.markNotificationFailed(notificationId, errorMessage);

    // Re-throw to trigger BullMQ retry
    throw error;
  }
}

/**
 * Send email notification via Resend.
 */
async function sendEmailNotification(data: NotificationJobData): Promise<void> {
  const { type, payload, recipientEmail } = data;

  if (!recipientEmail) {
    throw new Error("No recipient email provided");
  }

  const client = getResendClient();
  const fromAddress = process.env.EMAIL_FROM ?? "notifications@tevero.io";

  // Build email content based on type
  const { subject, html } = buildEmailContent(type, payload);

  const { error } = await client.emails.send({
    from: fromAddress,
    to: [recipientEmail],
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

/**
 * Send Slack notification via webhook.
 */
async function sendSlackNotification(data: NotificationJobData): Promise<void> {
  const { type, payload, slackWebhookUrl } = data;

  if (!slackWebhookUrl) {
    throw new Error("No Slack webhook URL configured");
  }

  const message = buildSlackMessage(type, payload);

  const response = await fetch(slackWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook error: ${response.status} ${response.statusText}`);
  }
}

/**
 * Send push notification.
 *
 * TODO: Implement web push via PWA service worker.
 * For now, this is a placeholder that logs the notification.
 */
async function sendPushNotification(data: NotificationJobData): Promise<void> {
  const { type, payload } = data;

  // TODO: Implement actual web push
  log.info("Push notification (not implemented)", {
    type,
    keyword: payload.keyword,
  });
}

/**
 * Build email subject and HTML based on notification type.
 */
function buildEmailContent(
  type: string,
  payload: NotificationJobData["payload"]
): { subject: string; html: string } {
  switch (type) {
    case "win":
      return {
        subject: `[Trophy] Your keyword "${payload.keyword}" hit position ${payload.position}!`,
        html: `
          <h1>SEO Win!</h1>
          <p>Your keyword <strong>"${payload.keyword}"</strong> has reached position <strong>${payload.position}</strong>!</p>
          ${payload.previousPosition ? `<p>Previous position: ${payload.previousPosition}</p>` : ""}
          ${payload.monthlyVolume ? `<p>Monthly search volume: ${payload.monthlyVolume}</p>` : ""}
          <p><a href="${payload.portalUrl ?? "#"}">View in portal</a></p>
        `,
      };

    case "alert":
      return {
        subject: `[Warning] Keyword "${payload.keyword}" dropped ${payload.dropAmount} positions`,
        html: `
          <h1>Position Alert</h1>
          <p>Your keyword <strong>"${payload.keyword}"</strong> dropped by <strong>${payload.dropAmount}</strong> positions.</p>
          <p>Current position: ${payload.position}</p>
          <p><a href="${payload.portalUrl ?? "#"}">View in portal</a></p>
        `,
      };

    case "digest":
      const summary = payload.summary ?? { clicks: 0, impressions: 0, top10Count: 0, winsCount: 0 };
      return {
        subject: `[Chart] Your weekly SEO digest`,
        html: `
          <h1>Weekly SEO Summary</h1>
          <ul>
            <li>Clicks: ${summary.clicks}</li>
            <li>Impressions: ${summary.impressions}</li>
            <li>Keywords in Top 10: ${summary.top10Count}</li>
            <li>New wins this week: ${summary.winsCount}</li>
          </ul>
          <p><a href="${payload.portalUrl ?? "#"}">View full report in portal</a></p>
        `,
      };

    case "update":
    default:
      return {
        subject: `[Info] Work update for your SEO campaign`,
        html: `
          <h1>Work Update</h1>
          <p>New work has been completed on your SEO campaign.</p>
          <p><a href="${payload.portalUrl ?? "#"}">View details in portal</a></p>
        `,
      };
  }
}

/**
 * Build Slack message based on notification type.
 */
function buildSlackMessage(
  type: string,
  payload: NotificationJobData["payload"]
): Record<string, unknown> {
  const emoji = type === "win" ? ":trophy:" : type === "alert" ? ":warning:" : ":chart_with_upwards_trend:";
  const color = type === "win" ? "#1B6E45" : type === "alert" ? "#9B2C2C" : "#0F4F3D";

  let text = "";
  switch (type) {
    case "win":
      text = `Keyword "${payload.keyword}" hit position ${payload.position}!`;
      break;
    case "alert":
      text = `Keyword "${payload.keyword}" dropped ${payload.dropAmount} positions`;
      break;
    case "digest":
      const s = payload.summary ?? { clicks: 0, impressions: 0, top10Count: 0, winsCount: 0 };
      text = `Weekly: ${s.clicks} clicks, ${s.impressions} impressions, ${s.top10Count} in Top 10`;
      break;
    default:
      text = "New SEO work update";
  }

  return {
    attachments: [
      {
        color,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *${type.charAt(0).toUpperCase() + type.slice(1)}*\n${text}`,
            },
          },
        ],
      },
    ],
  };
}

// ============================================================================
// Worker Instance
// ============================================================================

let worker: Worker<NotificationJobData> | null = null;

/**
 * Start the notification worker.
 */
export function startNotificationWorker(): Worker<NotificationJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<NotificationJobData>(
    NOTIFICATION_QUEUE_NAME,
    processNotificationJob,
    {
      connection: getSharedBullMQConnection("worker:notification"),
      lockDuration: LOCK_DURATION_MS,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    log.debug("Notification job completed", { jobId: job.id });
  });

  worker.on("failed", (job, error) => {
    log.error("Notification job failed", error, { jobId: job?.id });
  });

  log.info("Notification worker started", {
    queue: NOTIFICATION_QUEUE_NAME,
    concurrency: 5,
  });

  return worker;
}

/**
 * Stop the notification worker gracefully.
 */
export async function stopNotificationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info("Notification worker stopped");
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  log.info("SIGTERM received, stopping notification worker");
  await stopNotificationWorker();
});

process.on("SIGINT", async () => {
  log.info("SIGINT received, stopping notification worker");
  await stopNotificationWorker();
});
