/**
 * Notification service for agency alerts.
 * Phase 30-07: Auto-Onboarding
 *
 * Supports:
 * - Slack webhook notifications with timeouts
 */

import { createLogger } from "@/server/lib/logger";
import { sendWebhook, TimeoutError, HttpError } from "@/server/lib/http-client";

const log = createLogger({ module: "onboarding-notifications" });

/**
 * Agency notification data
 */
export interface AgencyNotificationData {
  clientName: string;
  domain: string;
  monthlyValue: number;
  projectId: string;
}

/**
 * Slack message format
 */
export interface SlackMessage {
  text: string;
  blocks?: Array<{
    type: string;
    text?: { type: string; text: string };
    fields?: Array<{ type: string; text: string }>;
  }>;
}

/**
 * Format Slack notification message.
 */
export function formatSlackNotification(data: AgencyNotificationData): SlackMessage {
  const { clientName, domain, monthlyValue, projectId } = data;

  return {
    text: `Naujas klientas: ${clientName} (${monthlyValue} EUR/men.)`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Naujas klientas: ${clientName}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Svetaine:*\n${domain}`,
          },
          {
            type: "mrkdwn",
            text: `*Menesinis mokestis:*\n${monthlyValue} EUR`,
          },
          {
            type: "mrkdwn",
            text: `*Projekto ID:*\n${projectId}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Klientas gavo GSC kvietima ir susitikimo nuoroda.",
        },
      },
    ],
  };
}

/**
 * Send Slack notification via webhook.
 * Skips silently if SLACK_WEBHOOK_URL is not configured.
 * Uses 10 second timeout and 2 retries for reliability.
 */
export async function notifyAgencySlack(data: AgencyNotificationData): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    log.info("SLACK_WEBHOOK_URL not configured, skipping Slack notification");
    return false;
  }

  const message = formatSlackNotification(data);

  try {
    await sendWebhook(webhookUrl, message, {
      timeout: 10000, // 10 second timeout
      retries: 2,
    });

    log.info("Slack notification sent", { clientName: data.clientName });
    return true;
  } catch (error) {
    if (error instanceof TimeoutError) {
      log.error("Slack notification timed out", undefined, {
        clientName: data.clientName,
        timeout: error.timeoutMs,
      });
    } else if (error instanceof HttpError) {
      log.error("Slack notification failed", undefined, {
        status: error.status,
        clientName: data.clientName,
      });
    } else {
      log.error(
        "Slack notification error",
        error instanceof Error ? error : new Error(String(error)),
        { clientName: data.clientName }
      );
    }
    return false;
  }
}
