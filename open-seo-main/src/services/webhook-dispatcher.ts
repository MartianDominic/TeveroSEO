/**
 * Webhook event dispatcher.
 * Phase 18.5: Emits events to matching webhooks.
 */
import { randomBytes } from "crypto";
import { createLogger } from "@/server/lib/logger";
import {
  enqueueWebhookDelivery,
  type WebhookPayload,
} from "@/server/queues/webhookQueue";
import {
  findMatchingWebhooks,
  createDeliveryRecord,
} from "./webhooks";

const log = createLogger({ module: "webhook-dispatcher" });

const WEBHOOK_API_VERSION = "2024-04-01";
// APP_URL must be set in production - no hardcoded fallback to avoid env-specific bugs
const APP_URL = process.env.APP_URL;
if (!APP_URL) {
  throw new Error("APP_URL environment variable is required");
}

interface EmitEventParams {
  type: string;
  data: Record<string, unknown>;
  scope: {
    level: "global" | "workspace" | "client";
    workspaceId?: string;
    clientId?: string;
  };
  context?: {
    projectName?: string;
    clientName?: string;
    workspaceName?: string;
  };
  links?: {
    dashboard?: string;
    api?: string;
  };
  idempotencyKey?: string;
}

/**
 * Generate a unique event ID.
 */
function generateEventId(): string {
  return `evt_${randomBytes(10).toString("hex")}`;
}

/**
 * Generate an idempotency key if not provided.
 */
function generateIdempotencyKey(
  eventType: string,
  clientId?: string,
): string {
  const date = new Date().toISOString().split("T")[0];
  const random = randomBytes(4).toString("hex");
  const prefix = clientId ? `${clientId}-` : "";
  return `${prefix}${eventType.replace(".", "-")}-${date}-${random}`;
}

/**
 * Build the full webhook payload.
 */
function buildPayload(
  eventId: string,
  params: EmitEventParams,
): WebhookPayload {
  return {
    id: eventId,
    type: params.type,
    version: WEBHOOK_API_VERSION,
    created_at: new Date().toISOString(),
    idempotency_key:
      params.idempotencyKey ??
      generateIdempotencyKey(params.type, params.scope.clientId),
    scope: {
      level: params.scope.level,
      workspace_id: params.scope.workspaceId,
      client_id: params.scope.clientId,
    },
    data: params.data,
    context: {
      project_name: params.context?.projectName,
      client_name: params.context?.clientName,
      workspace_name: params.context?.workspaceName,
    },
    links: {
      dashboard: params.links?.dashboard,
      api: params.links?.api,
    },
  };
}

/**
 * Emit an event to all matching webhooks.
 *
 * 1. Generate event ID and build payload
 * 2. Find matching webhooks (client > workspace > global)
 * 3. Create delivery records
 * 4. Enqueue delivery jobs
 *
 * Returns the event ID and number of webhooks dispatched to.
 */
export async function emitEvent(
  params: EmitEventParams,
): Promise<{ eventId: string; deliveries: number }> {
  const eventId = generateEventId();
  const payload = buildPayload(eventId, params);

  log.info("Emitting webhook event", {
    eventId,
    type: params.type,
    scope: params.scope.level,
    clientId: params.scope.clientId,
  });

  // Find all matching webhooks
  const matchingWebhooks = await findMatchingWebhooks(
    params.type,
    params.scope.clientId,
    params.scope.workspaceId,
  );

  if (matchingWebhooks.length === 0) {
    log.debug("No matching webhooks for event", { eventId, type: params.type });
    return { eventId, deliveries: 0 };
  }

  log.info("Found matching webhooks", {
    eventId,
    count: matchingWebhooks.length,
  });

  // Create deliveries and enqueue jobs
  let deliveries = 0;
  for (const webhook of matchingWebhooks) {
    try {
      // Create delivery record with idempotency check
      const deliveryId = await createDeliveryRecord({
        webhookId: webhook.id,
        eventId,
        eventType: params.type,
        payload: payload as unknown as Record<string, unknown>,
        idempotencyKey: payload.idempotency_key,
      });

      // Skip if duplicate delivery (idempotency check failed)
      if (deliveryId === null) {
        log.debug("Duplicate delivery skipped", {
          eventId,
          webhookId: webhook.id,
          idempotencyKey: payload.idempotency_key,
        });
        continue;
      }

      // Enqueue delivery job
      // SECURITY: Secret is NOT included in job payload - fetched at delivery time via webhookId
      await enqueueWebhookDelivery({
        deliveryId,
        webhookId: webhook.id,
        url: webhook.url,
        headers: (webhook.headers as Record<string, string>) ?? {},
        payload,
        attempt: 0,
      });

      deliveries++;
    } catch (err) {
      log.error(
        "Failed to dispatch webhook",
        err instanceof Error ? err : new Error(String(err)),
        { eventId, webhookId: webhook.id },
      );
    }
  }

  log.info("Webhook event dispatched", {
    eventId,
    type: params.type,
    deliveries,
  });

  return { eventId, deliveries };
}

/**
 * Emit an alert.triggered event.
 */
export async function emitAlertTriggered(params: {
  alertId: string;
  alertType: string;
  severity: string;
  title: string;
  clientId: string;
  workspaceId?: string;
  clientName?: string;
}): Promise<{ eventId: string; deliveries: number }> {
  return emitEvent({
    type: "alert.triggered",
    data: {
      alertId: params.alertId,
      alertType: params.alertType,
      severity: params.severity,
      title: params.title,
    },
    scope: {
      level: "client",
      clientId: params.clientId,
      workspaceId: params.workspaceId,
    },
    context: {
      clientName: params.clientName,
    },
    links: {
      dashboard: `${APP_URL}/clients/${params.clientId}/alerts`,
    },
  });
}

/**
 * Emit a ranking.drop event.
 */
export async function emitRankingDrop(params: {
  keyword: string;
  previousPosition: number;
  currentPosition: number;
  dropAmount: number;
  clientId: string;
  workspaceId?: string;
  clientName?: string;
  keywordId?: string;
}): Promise<{ eventId: string; deliveries: number }> {
  return emitEvent({
    type: "ranking.drop",
    data: {
      keyword: params.keyword,
      previousPosition: params.previousPosition,
      currentPosition: params.currentPosition,
      dropAmount: params.dropAmount,
      keywordId: params.keywordId,
    },
    scope: {
      level: "client",
      clientId: params.clientId,
      workspaceId: params.workspaceId,
    },
    context: {
      clientName: params.clientName,
    },
    links: {
      dashboard: `${APP_URL}/clients/${params.clientId}/seo/keywords`,
    },
    idempotencyKey: `rank-${params.keywordId ?? params.keyword}-${new Date().toISOString().split("T")[0]}`,
  });
}

/**
 * Emit a report.generated event.
 */
export async function emitReportGenerated(params: {
  reportId: string;
  reportType: string;
  period: string;
  clientId: string;
  workspaceId?: string;
  clientName?: string;
}): Promise<{ eventId: string; deliveries: number }> {
  return emitEvent({
    type: "report.generated",
    data: {
      reportId: params.reportId,
      reportType: params.reportType,
      period: params.period,
    },
    scope: {
      level: "client",
      clientId: params.clientId,
      workspaceId: params.workspaceId,
    },
    context: {
      clientName: params.clientName,
    },
    links: {
      dashboard: `${APP_URL}/clients/${params.clientId}/reports/${params.reportId}`,
    },
  });
}

/**
 * Emit a sync.completed event.
 */
export async function emitSyncCompleted(params: {
  syncType: "gsc" | "ga4" | "rankings";
  recordsSynced: number;
  clientId: string;
  workspaceId?: string;
  clientName?: string;
}): Promise<{ eventId: string; deliveries: number }> {
  return emitEvent({
    type: "sync.completed",
    data: {
      syncType: params.syncType,
      recordsSynced: params.recordsSynced,
    },
    scope: {
      level: "client",
      clientId: params.clientId,
      workspaceId: params.workspaceId,
    },
    context: {
      clientName: params.clientName,
    },
  });
}

/**
 * Emit a connection.new event.
 */
export async function emitConnectionNew(params: {
  provider: string;
  properties?: string[];
  clientId: string;
  workspaceId?: string;
  clientName?: string;
}): Promise<{ eventId: string; deliveries: number }> {
  return emitEvent({
    type: "connection.new",
    data: {
      provider: params.provider,
      properties: params.properties ?? [],
    },
    scope: {
      level: "client",
      clientId: params.clientId,
      workspaceId: params.workspaceId,
    },
    context: {
      clientName: params.clientName,
    },
    links: {
      dashboard: `${APP_URL}/clients/${params.clientId}/connections`,
    },
  });
}
