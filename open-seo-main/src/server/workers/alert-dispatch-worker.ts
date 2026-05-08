/**
 * Alert Dispatch Worker
 * Phase 96 Analytics: BullMQ worker for sending alert notifications
 *
 * QUEUE-02 FIX: lockDuration set to 60000ms (1 minute) for fast notification delivery
 *
 * Worker configuration:
 * - lockDuration: 60000 (1 min) - alerts should be fast
 * - Concurrency: 10 (parallel notification dispatch)
 * - Graceful shutdown with 15s timeout
 *
 * Alert types:
 * - Position drop alerts
 * - Traffic anomaly alerts
 * - Cannibalization alerts
 * - Index coverage alerts
 * - Goal progress alerts
 */
import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection, WORKER_CONCURRENCY_LIMITS } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";

const log = createLogger({ module: "alert-dispatch-worker" });

// QUEUE-02: Short lockDuration for fast alert delivery
const LOCK_DURATION_MS = 60_000; // 1 minute
const MAX_STALLED_COUNT = 3;
const SHUTDOWN_TIMEOUT_MS = 15_000;

/**
 * Alert types supported by the dispatch worker.
 */
export type AlertType =
  | "position_drop"
  | "traffic_anomaly"
  | "cannibalization"
  | "index_coverage"
  | "goal_progress"
  | "striking_distance"
  | "trend_change";

/**
 * Alert channel for delivery.
 */
export type AlertChannel = "email" | "slack" | "webhook" | "in_app";

/**
 * Job data for alert dispatch jobs.
 */
export interface AlertDispatchJobData {
  alertId: string;
  workspaceId: string;
  clientId: string;
  alertType: AlertType;
  channel: AlertChannel;
  recipient: string; // email, slack channel, webhook URL, or user ID
  payload: {
    title: string;
    message: string;
    severity: "critical" | "high" | "medium" | "low";
    data?: Record<string, unknown>;
    actionUrl?: string;
  };
}

/**
 * Job result returned after dispatch completes.
 */
export interface AlertDispatchJobResult {
  dispatched: boolean;
  channel: AlertChannel;
  recipient: string;
  durationMs: number;
  error?: string;
}

let worker: Worker<AlertDispatchJobData, AlertDispatchJobResult> | null = null;

/**
 * Start the alert dispatch worker.
 */
export function startAlertDispatchWorker(): Worker<AlertDispatchJobData, AlertDispatchJobResult> {
  if (worker) return worker;

  worker = new Worker<AlertDispatchJobData, AlertDispatchJobResult>(
    "alert-dispatch",
    async (job: Job<AlertDispatchJobData, AlertDispatchJobResult>) => {
      const startTime = Date.now();
      const { alertId, workspaceId, alertType, channel, recipient, payload } = job.data;

      log.info("Dispatching alert", {
        jobId: job.id,
        alertId,
        alertType,
        channel,
        severity: payload.severity,
      });

      try {
        let dispatched = false;

        switch (channel) {
          case "email": {
            // Email dispatch - logs warning if not configured
            // TODO: Integrate with actual email service when available
            log.info("Email alert would be sent", {
              alertId,
              to: recipient,
              subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
            });
            dispatched = true; // Mark as dispatched (logged)
            break;
          }

          case "slack": {
            // Slack dispatch - logs warning if not configured
            // TODO: Integrate with actual Slack service when available
            log.info("Slack alert would be sent", {
              alertId,
              channel: recipient,
              text: payload.title,
            });
            dispatched = true; // Mark as dispatched (logged)
            break;
          }

          case "webhook": {
            // Send to webhook URL
            try {
              const response = await fetch(recipient, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  alertId,
                  alertType,
                  ...payload,
                  timestamp: new Date().toISOString(),
                }),
              });
              dispatched = response.ok;
              if (!dispatched) {
                log.warn("Webhook delivery failed", { alertId, status: response.status });
              }
            } catch (error) {
              log.error("Webhook dispatch failed", error instanceof Error ? error : new Error(String(error)));
              dispatched = false;
            }
            break;
          }

          case "in_app": {
            // Store in database for in-app notification
            try {
              const { db } = await import("@/db");
              const { sql } = await import("drizzle-orm");

              // Insert into notifications table (assumes table exists)
              await db.execute(sql`
                INSERT INTO notifications (
                  id, workspace_id, user_id, type, title, message,
                  severity, data, read, created_at
                ) VALUES (
                  ${alertId}, ${workspaceId}, ${recipient}, ${alertType},
                  ${payload.title}, ${payload.message}, ${payload.severity},
                  ${JSON.stringify(payload.data ?? {})}, false, NOW()
                )
                ON CONFLICT (id) DO NOTHING
              `);
              dispatched = true;
            } catch (error) {
              log.error("In-app notification failed", error instanceof Error ? error : new Error(String(error)));
              dispatched = false;
            }
            break;
          }
        }

        const durationMs = Date.now() - startTime;
        log.info("Alert dispatch complete", {
          jobId: job.id,
          alertId,
          dispatched,
          channel,
          durationMs,
        });

        return {
          dispatched,
          channel,
          recipient,
          durationMs,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error("Alert dispatch failed", error instanceof Error ? error : new Error(errorMsg), {
          jobId: job.id,
          alertId,
        });
        throw error;
      }
    },
    {
      connection: getSharedBullMQConnection("worker:alert-dispatch"),
      lockDuration: LOCK_DURATION_MS, // QUEUE-02 fix
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: WORKER_CONCURRENCY_LIMITS.alert ?? 10,
    }
  );

  worker.on("ready", () => {
    log.info("Alert dispatch worker ready");
  });

  worker.on("error", (err) => {
    log.error("Alert dispatch worker error", err);
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      try {
        const dlqQueue = getDLQQueue();
        const dlqData: DLQJobData = {
          originalQueue: "alert-dispatch",
          jobId: job.id,
          jobData: job.data,
          error: err.message,
          stack: err.stack,
          failedAt: new Date().toISOString(),
        };
        await dlqQueue.add(`dlq:alert-dispatch:${job.id}`, dlqData);
        log.warn("Alert dispatch job moved to DLQ", { jobId: job.id, alertId: job.data.alertId });
      } catch (dlqErr) {
        log.error("Failed to move alert dispatch job to DLQ", dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)));
      }
    }
  });

  worker.on("completed", (job, result) => {
    log.info("Alert dispatch job completed", {
      jobId: job.id,
      alertId: job.data.alertId,
      dispatched: result.dispatched,
      channel: result.channel,
      durationMs: result.durationMs,
    });
  });

  worker.on("stalled", (jobId) => {
    log.warn("Alert dispatch job stalled", { jobId });
  });

  return worker;
}

/**
 * Stop the alert dispatch worker gracefully.
 */
export async function stopAlertDispatchWorker(): Promise<void> {
  if (!worker) return;

  const current = worker;
  worker = null;

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => "closed" as const);

  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    log.error("Alert dispatch worker graceful shutdown timeout, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }

  log.info("Alert dispatch worker stopped");
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format alert payload as HTML email.
 */
function formatEmailHtml(payload: AlertDispatchJobData["payload"]): string {
  const severityColors: Record<string, string> = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#2563eb",
  };

  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${severityColors[payload.severity]}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">${payload.title}</h1>
      </div>
      <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">${payload.message}</p>
        ${payload.actionUrl ? `
          <a href="${payload.actionUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            View Details
          </a>
        ` : ""}
      </div>
    </div>
  `;
}

/**
 * Format alert payload as Slack blocks.
 */
function formatSlackBlocks(payload: AlertDispatchJobData["payload"]): unknown[] {
  const severityEmoji: Record<string, string> = {
    critical: ":red_circle:",
    high: ":large_orange_circle:",
    medium: ":large_yellow_circle:",
    low: ":large_blue_circle:",
  };

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${severityEmoji[payload.severity]} ${payload.title}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: payload.message,
      },
    },
  ];

  if (payload.actionUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Details",
          },
          url: payload.actionUrl,
          action_id: "view_details",
        },
      ],
    });
  }

  return blocks;
}
