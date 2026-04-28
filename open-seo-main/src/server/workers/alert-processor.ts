/**
 * Sandboxed processor for alert processing.
 * Phase 18: Converts drop events into alerts.
 */
import type { Job } from "bullmq";
import { isNull, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { rankDropEvents } from "@/db/rank-events-schema";
import { createLogger } from "@/server/lib/logger";
import type { AlertJobData } from "@/server/queues/alertQueue";
import { createAlert, getAlertRule } from "@/services/alerts";
import { markDropEventsProcessed } from "@/services/rank-events";
import { shouldSendEmail, sendAlertEmail } from "@/services/alert-notifications";
import { alerts } from "@/db/alert-schema";
import { emitAlertTriggered, emitRankingDrop } from "@/services/webhook-dispatcher";

const log = createLogger({ module: "alert-processor" });

interface CreatedAlert {
  id: string;
  clientId: string;
  alertType: string;
  severity: string;
  title: string;
}

/**
 * Process unprocessed rank drop events into alerts.
 */
async function processDropEvents(clientId?: string): Promise<CreatedAlert[]> {
  const createdAlerts: CreatedAlert[] = [];

  // Query unprocessed drop events
  let query = db
    .select()
    .from(rankDropEvents)
    .where(isNull(rankDropEvents.processedAt));

  if (clientId) {
    query = db
      .select()
      .from(rankDropEvents)
      .where(
        and(
          eq(rankDropEvents.clientId, clientId),
          isNull(rankDropEvents.processedAt),
        ),
      );
  }

  const events = await query;

  if (events.length === 0) {
    log.info("No unprocessed drop events found");
    return createdAlerts;
  }

  log.info("Processing drop events", { count: events.length });

  // Group events by client for batch processing
  const eventsByClient = new Map<string, typeof events>();
  for (const event of events) {
    const key = event.clientId ?? "unknown";
    const existing = eventsByClient.get(key) ?? [];
    existing.push(event);
    eventsByClient.set(key, existing);
  }

  for (const [eventClientId, clientEvents] of eventsByClient) {
    if (eventClientId === "unknown") {
      // Mark events without clientId as processed but don't create alerts
      await markDropEventsProcessed(
        clientEvents.map((e) => e.id),
        "alert_processor_skipped",
      );
      continue;
    }

    // Get alert rule for this client
    const rule = await getAlertRule(eventClientId, "ranking_drop");

    // If no rule or rule disabled, still mark as processed
    if (!rule || !rule.enabled) {
      await markDropEventsProcessed(
        clientEvents.map((e) => e.id),
        "alert_processor_rule_disabled",
      );
      log.info("Rule disabled, skipping alerts", { clientId: eventClientId });
      continue;
    }

    // Create alerts for qualifying events
    for (const event of clientEvents) {
      // Check if drop exceeds rule threshold
      const ruleThreshold = rule.threshold ?? 5;
      if (event.dropAmount < ruleThreshold) {
        await markDropEventsProcessed([event.id], "alert_processor_below_threshold");
        continue;
      }

      // Create alert
      const alertId = await createAlert({
        clientId: eventClientId,
        ruleId: rule.id,
        alertType: "ranking_drop",
        severity: rule.severity,
        title: `Ranking dropped for "${event.keyword}"`,
        message: `Position dropped from ${event.previousPosition} to ${event.currentPosition} (${event.dropAmount} positions)`,
        metadata: {
          keywordId: event.keywordId,
          keyword: event.keyword,
          previousPosition: event.previousPosition,
          currentPosition: event.currentPosition,
          dropAmount: event.dropAmount,
        },
        sourceEventId: event.id,
      });

      createdAlerts.push({
        id: alertId,
        clientId: eventClientId,
        alertType: "ranking_drop",
        severity: rule.severity,
        title: `Ranking dropped for "${event.keyword}"`,
      });

      // Mark event as processed
      await markDropEventsProcessed([event.id], "alert_processor");

      log.info("Alert created for drop event", {
        alertId,
        eventId: event.id,
        keyword: event.keyword,
        dropAmount: event.dropAmount,
      });

      // Emit webhook events
      await emitAlertTriggered({
        alertId,
        alertType: "ranking_drop",
        severity: rule.severity,
        title: `Ranking dropped for "${event.keyword}"`,
        clientId: eventClientId,
      });

      await emitRankingDrop({
        keyword: event.keyword,
        previousPosition: event.previousPosition,
        currentPosition: event.currentPosition,
        dropAmount: event.dropAmount,
        clientId: eventClientId,
        keywordId: event.keywordId,
      });

      // Send email notification if enabled
      if (rule.emailNotify && (rule.severity === "warning" || rule.severity === "critical")) {
        // Fetch the alert we just created for email
        const [createdAlert] = await db
          .select()
          .from(alerts)
          .where(eq(alerts.id, alertId));

        if (createdAlert && shouldSendEmail(createdAlert, rule)) {
          // TODO: Fetch client email from clients table (requires AI-Writer integration)
          // For now, log the notification intent
          const dashboardUrl = `${process.env.APP_URL ?? "https://app.tevero.lt"}/clients/${eventClientId}/alerts`;
          log.info("Email notification pending", {
            alertId,
            severity: rule.severity,
            dashboardUrl,
            note: "Client email lookup not yet implemented",
          });
          // When client email is available:
          // await sendAlertEmail(createdAlert, clientEmail, dashboardUrl);
        }
      }
    }
  }

  return createdAlerts;
}

/**
 * Main processor function.
 */
export default async function processor(job: Job<AlertJobData>): Promise<{ alertsCreated: CreatedAlert[] }> {
  const jobLogger = createLogger({ module: "alert-processor", jobId: job.id });
  jobLogger.info("Starting alert processing", { type: job.data.type, clientId: job.data.clientId });

  let alertsCreated: CreatedAlert[] = [];

  switch (job.data.type) {
    case "process_drop_events":
      alertsCreated = await processDropEvents(job.data.clientId);
      break;

    case "check_sync_failures":
      // TODO: Implement in Phase 18.5 or future
      jobLogger.info("check_sync_failures not yet implemented");
      break;

    case "check_connection_expiry":
      // TODO: Implement in Phase 18.5 or future
      jobLogger.info("check_connection_expiry not yet implemented");
      break;

    default:
      jobLogger.warn("Unknown alert job type", { type: job.data.type });
  }

  jobLogger.info("Alert processing completed", { alertsCreated: alertsCreated.length });

  return { alertsCreated };
}
