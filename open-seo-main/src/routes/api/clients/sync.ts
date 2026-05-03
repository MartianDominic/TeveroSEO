/**
 * Client Sync Endpoint - FIX-03: CRIT-CW-03
 *
 * Receives sync requests from AI-Writer's client creation saga.
 * Creates or updates local client records to maintain consistency.
 *
 * This endpoint is called during:
 * 1. Saga step 2: Initial client sync after AI-Writer creation
 * 2. Manual refresh: User-triggered sync
 * 3. Rollback: Saga compensation to clean up failed creations
 */

import { json } from "@tanstack/start";
import { createAPIFileRoute } from "@tanstack/start/api";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "ClientSync" });

// Schema for sync request
const SyncRequestSchema = z.object({
  clientId: z.string().uuid(),
  workspaceId: z.string(),
  name: z.string(),
  domain: z.string().nullable().optional(),
  status: z.enum(["onboarding", "active", "paused", "churned"]).optional(),
});

// Schema for rollback request
const RollbackRequestSchema = z.object({
  reason: z.string().optional(),
});

/**
 * POST /api/clients/sync
 *
 * Sync a client from AI-Writer to open-seo-main.
 * Uses upsert to handle both creation and updates.
 */
export const APIRoute = createAPIFileRoute("/api/clients/sync")({
  POST: async ({ request }) => {
    // Validate internal webhook secret
    const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET;
    if (expectedSecret) {
      const providedSecret = request.headers.get("X-Webhook-Secret");
      if (providedSecret !== expectedSecret) {
        log.warn("Invalid webhook secret for sync request");
        return json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = SyncRequestSchema.safeParse(body);
    if (!parseResult.success) {
      log.warn("Invalid sync request payload", { issues: parseResult.error.issues });
      return json(
        { error: "Invalid request payload", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { clientId, workspaceId, name, domain, status } = parseResult.data;

    log.info("Processing client sync request", { clientId, workspaceId, name });

    try {
      // Upsert: create if not exists, update if exists
      const result = await db
        .insert(clients)
        .values({
          id: clientId,
          workspaceId,
          name,
          domain: domain ?? "pending.setup",
          status: status ?? "onboarding",
          contactEmail: null,
          contactName: null,
          industry: null,
        })
        .onConflictDoUpdate({
          target: clients.id,
          set: {
            name,
            domain: domain ?? "pending.setup",
            status: status ?? "onboarding",
            updatedAt: new Date(),
          },
        })
        .returning({
          id: clients.id,
          name: clients.name,
          status: clients.status,
        });

      log.info("Client sync completed", {
        clientId,
        action: result.length > 0 ? "upserted" : "no_change",
      });

      return json({
        success: true,
        client: result[0] ?? { id: clientId, name, status: status ?? "onboarding" },
      });
    } catch (error) {
      log.error(
        "Client sync failed",
        error instanceof Error ? error : new Error(String(error)),
        { clientId }
      );

      return json({ error: "Sync failed" }, { status: 500 });
    }
  },
});
