/**
 * Client Events Webhook Handler - FIX-03: CRIT-CW-02
 *
 * Receives client lifecycle events from AI-Writer and handles:
 * - Cache invalidation for archived/deleted clients
 * - Local data cleanup or marking as inactive
 * - Synchronization state updates
 *
 * Event Types:
 * - client.created: Sync new client to local database
 * - client.updated: Update local client metadata
 * - client.archived: Mark local client as churned, clean up related data
 * - client.restored: Reactivate local client
 * - client.deleted: Hard delete local client data (if enabled)
 */

import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "ClientEventsWebhook" });

// Event type enum matching AI-Writer's ClientEventType
const ClientEventType = z.enum([
  "client.created",
  "client.updated",
  "client.archived",
  "client.restored",
  "client.deleted",
]);

// Event payload schema
const ClientEventSchema = z.object({
  event_type: ClientEventType,
  client_id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable().optional(),
  timestamp: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  correlation_id: z.string().uuid().optional(),
});

type ClientEvent = z.infer<typeof ClientEventSchema>;

/**
 * Handle client.archived event.
 * Marks local client as churned and optionally cleans up related data.
 */
async function handleClientArchived(event: ClientEvent): Promise<void> {
  const { client_id, data } = event;

  log.info("Processing client.archived event", {
    clientId: client_id,
    archivedBy: data?.archived_by,
  });

  // Update local client status to churned
  const result = await db
    .update(clients)
    .set({
      status: "churned",
      updatedAt: new Date(),
    })
    .where(eq(clients.id, client_id))
    .returning({ id: clients.id });

  if (result.length > 0) {
    log.info("Marked local client as churned", { clientId: client_id });
  } else {
    log.debug("Client not found locally (may not exist)", { clientId: client_id });
  }

  // TODO: Add cleanup of related data (audits, reports, etc.) if needed
  // For now, we keep data but mark client as churned
}

/**
 * Handle client.created event.
 * Syncs new client to local database.
 */
async function handleClientCreated(event: ClientEvent): Promise<void> {
  const { client_id, workspace_id, data } = event;

  if (!workspace_id) {
    log.warn("client.created event missing workspace_id", { clientId: client_id });
    return;
  }

  log.info("Processing client.created event", {
    clientId: client_id,
    workspaceId: workspace_id,
  });

  // Extract domain from name or data if available
  const domain = (data?.domain as string) || "pending.setup";
  const name = (data?.name as string) || "New Client";

  try {
    await db
      .insert(clients)
      .values({
        id: client_id,
        workspaceId: workspace_id,
        name,
        domain,
        status: "onboarding",
        contactEmail: null,
        contactName: null,
        industry: null,
      })
      .onConflictDoNothing({ target: clients.id });

    log.info("Created local client from event", { clientId: client_id });
  } catch (error) {
    log.error("Failed to create local client", error instanceof Error ? error : new Error(String(error)), {
      clientId: client_id,
    });
  }
}

/**
 * Handle client.updated event.
 * Updates local client metadata.
 */
async function handleClientUpdated(event: ClientEvent): Promise<void> {
  const { client_id, data } = event;

  log.info("Processing client.updated event", { clientId: client_id });

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data?.name) {
    updates.name = data.name;
  }
  if (data?.domain) {
    updates.domain = data.domain;
  }

  if (Object.keys(updates).length > 1) {
    await db
      .update(clients)
      .set(updates)
      .where(eq(clients.id, client_id));

    log.info("Updated local client", { clientId: client_id, updates: Object.keys(updates) });
  }
}

/**
 * Handle client.restored event.
 * Reactivates local client.
 */
async function handleClientRestored(event: ClientEvent): Promise<void> {
  const { client_id } = event;

  log.info("Processing client.restored event", { clientId: client_id });

  await db
    .update(clients)
    .set({
      status: "active",
      isDeleted: false,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, client_id));

  log.info("Restored local client", { clientId: client_id });
}

/**
 * Handle client.deleted event.
 * Soft-deletes local client (hard delete is too destructive).
 */
async function handleClientDeleted(event: ClientEvent): Promise<void> {
  const { client_id } = event;

  log.info("Processing client.deleted event", { clientId: client_id });

  // Soft delete to preserve data integrity
  await db
    .update(clients)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      status: "churned",
      updatedAt: new Date(),
    })
    .where(eq(clients.id, client_id));

  log.info("Soft-deleted local client", { clientId: client_id });
}

/**
 * POST /api/clients/events
 *
 * Webhook endpoint for receiving client lifecycle events from AI-Writer.
 *
 * Security: This endpoint should be protected by:
 * 1. Internal network only (via nginx)
 * 2. Shared secret in header (optional)
 *
 * Note: We don't require user authentication because this is a
 * service-to-service webhook, not a user-initiated request.
 */
export const Route = createFileRoute("/api/clients/events")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Optional: Validate shared secret
        const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET;
        if (expectedSecret) {
          const providedSecret = request.headers.get("X-Webhook-Secret");
          if (providedSecret !== expectedSecret) {
            log.warn("Invalid webhook secret");
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        // Validate event schema
        const parseResult = ClientEventSchema.safeParse(body);
        if (!parseResult.success) {
          log.warn("Invalid event payload", { issues: parseResult.error.issues });
          return Response.json(
            { error: "Invalid event payload", details: parseResult.error.issues },
            { status: 400 }
          );
        }

        const event = parseResult.data;

        log.info("Received client event", {
          eventType: event.event_type,
          clientId: event.client_id,
          correlationId: event.correlation_id,
        });

        try {
          switch (event.event_type) {
            case "client.created":
              await handleClientCreated(event);
              break;
            case "client.updated":
              await handleClientUpdated(event);
              break;
            case "client.archived":
              await handleClientArchived(event);
              break;
            case "client.restored":
              await handleClientRestored(event);
              break;
            case "client.deleted":
              await handleClientDeleted(event);
              break;
            default:
              log.warn("Unknown event type", { eventType: event.event_type });
          }

          return Response.json({
            success: true,
            eventType: event.event_type,
            clientId: event.client_id,
            correlationId: event.correlation_id,
          });
        } catch (error) {
          log.error(
            "Failed to process event",
            error instanceof Error ? error : new Error(String(error)),
            { eventType: event.event_type, clientId: event.client_id }
          );

          return Response.json(
            { error: "Event processing failed", eventType: event.event_type },
            { status: 500 }
          );
        }
      },
    },
  },
});
