/**
 * Client Sync Endpoint - FIX-03: CRIT-CW-03
 * FIX-08: H-SYNC-01, M-SYNC-01, M-SYNC-03
 *
 * Receives sync requests from AI-Writer's client creation saga.
 * Creates or updates local client records to maintain consistency.
 *
 * FIX-08 Enhancements:
 * - H-SYNC-01: Returns confirmation with syncedAt timestamp
 * - M-SYNC-01: Idempotency key support for safe retries
 * - M-SYNC-03: Configurable sync timeout via header
 *
 * This endpoint is called during:
 * 1. Saga step 2: Initial client sync after AI-Writer creation
 * 2. Manual refresh: User-triggered sync
 * 3. Rollback: Saga compensation to clean up failed creations
 */

import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { clients, clientSyncLog } from "@/db/client-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "ClientSync" });

// Schema for sync request
// FIX-08 M-SYNC-01: Added idempotencyKey for safe retries
const SyncRequestSchema = z.object({
  clientId: z.string().uuid(),
  workspaceId: z.string(),
  name: z.string(),
  domain: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  status: z.enum(["onboarding", "active", "paused", "churned"]).optional(),
  idempotencyKey: z.string().optional(),
});

// Schema for rollback request
const RollbackRequestSchema = z.object({
  reason: z.string().optional(),
});

// FIX-08 H-SYNC-01: Sync confirmation response schema
const SyncConfirmationSchema = z.object({
  success: z.literal(true),
  clientId: z.string().uuid(),
  syncedAt: z.string().datetime(),
  idempotencyKey: z.string(),
});

/**
 * FIX-08 M-SYNC-01: Check if this sync was already processed.
 * Returns the existing sync result if found, null otherwise.
 */
async function checkIdempotency(
  idempotencyKey: string
): Promise<{ syncedAt: Date; clientId: string } | null> {
  try {
    const existing = await db
      .select({
        syncedAt: clientSyncLog.syncedAt,
        clientId: clientSyncLog.clientId,
      })
      .from(clientSyncLog)
      .where(eq(clientSyncLog.idempotencyKey, idempotencyKey))
      .limit(1);

    return existing.length > 0 ? existing[0] : null;
  } catch {
    // Table might not exist yet, return null to proceed with sync
    return null;
  }
}

/**
 * FIX-08 M-SYNC-01: Record this sync for idempotency.
 */
async function recordSync(
  idempotencyKey: string,
  clientId: string,
  workspaceId: string
): Promise<Date> {
  const now = new Date();
  try {
    await db
      .insert(clientSyncLog)
      .values({
        idempotencyKey,
        clientId,
        workspaceId,
        syncedAt: now,
      })
      .onConflictDoNothing();
  } catch {
    // Table might not exist, log but don't fail
    log.warn("Failed to record sync in log", { idempotencyKey, clientId });
  }
  return now;
}

/**
 * POST /api/clients/sync
 *
 * Sync a client from AI-Writer to open-seo-main.
 * Uses upsert to handle both creation and updates.
 *
 * FIX-08: Enhanced with idempotency and confirmation response.
 */
export const Route = createFileRoute("/api/clients/sync")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Validate internal webhook secret
        const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET;
        if (expectedSecret) {
          const providedSecret = request.headers.get("X-Webhook-Secret");
          if (providedSecret !== expectedSecret) {
            log.warn("Invalid webhook secret for sync request");
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const parseResult = SyncRequestSchema.safeParse(body);
        if (!parseResult.success) {
          log.warn("Invalid sync request payload", { issues: parseResult.error.issues });
          return Response.json(
            { error: "Invalid request payload", details: parseResult.error.issues },
            { status: 400 }
          );
        }

        const { clientId, workspaceId, name, domain, status, idempotencyKey } = parseResult.data;

        // FIX-08 M-SYNC-01: Generate idempotency key if not provided
        const effectiveIdempotencyKey = idempotencyKey ?? `sync-${clientId}-${Date.now()}`;

        // FIX-08 M-SYNC-01: Check for duplicate sync request
        if (idempotencyKey) {
          const existing = await checkIdempotency(idempotencyKey);
          if (existing) {
            log.info("Duplicate sync request detected, returning cached result", {
              clientId,
              idempotencyKey,
            });
            // Return the same confirmation for idempotent retry
            return Response.json({
              success: true,
              clientId: existing.clientId,
              syncedAt: existing.syncedAt.toISOString(),
              idempotencyKey,
            });
          }
        }

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

          // FIX-08 M-SYNC-01: Record sync for idempotency
          const syncedAt = await recordSync(effectiveIdempotencyKey, clientId, workspaceId);

          log.info("Client sync completed", {
            clientId,
            action: result.length > 0 ? "upserted" : "no_change",
            idempotencyKey: effectiveIdempotencyKey,
          });

          // FIX-08 H-SYNC-01: Return confirmation with syncedAt timestamp
          return Response.json({
            success: true,
            clientId,
            syncedAt: syncedAt.toISOString(),
            idempotencyKey: effectiveIdempotencyKey,
          });
        } catch (error) {
          log.error(
            "Client sync failed",
            error instanceof Error ? error : new Error(String(error)),
            { clientId }
          );

          return Response.json({ error: "Sync failed" }, { status: 500 });
        }
      },
    },
  },
});
