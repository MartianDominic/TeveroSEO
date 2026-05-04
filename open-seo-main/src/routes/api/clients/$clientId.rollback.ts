/**
 * Client Rollback Endpoint - FIX-03: CRIT-CW-03
 *
 * Handles saga compensation when client creation fails.
 * Marks the local client as failed/deleted to maintain consistency.
 *
 * This endpoint is called during saga rollback (compensation phase)
 * when a step after client creation fails.
 */

import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "ClientRollback" });

// Schema for rollback request
const RollbackRequestSchema = z.object({
  reason: z.string().optional(),
  sagaId: z.string().uuid().optional(),
});

/**
 * DELETE /api/clients/:clientId/rollback
 *
 * Roll back a client creation by marking it as deleted.
 * This is called during saga compensation.
 */
export const Route = createFileRoute("/api/clients/$clientId/rollback")({
  server: {
    handlers: {
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        const { clientId } = params;

        // Validate internal webhook secret
        const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET;
        if (expectedSecret) {
          const providedSecret = request.headers.get("X-Webhook-Secret");
          if (providedSecret !== expectedSecret) {
            log.warn("Invalid webhook secret for rollback request");
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
        }

        // Parse optional body
        let reason = "saga_rollback";
        let sagaId: string | undefined;
        try {
          const body = await request.json();
          const parsed = RollbackRequestSchema.safeParse(body);
          if (parsed.success) {
            reason = parsed.data.reason ?? reason;
            sagaId = parsed.data.sagaId;
          }
        } catch {
          // Body is optional for DELETE
        }

        log.info("Processing client rollback", { clientId, reason, sagaId });

        try {
          // Soft delete the client
          const result = await db
            .update(clients)
            .set({
              isDeleted: true,
              deletedAt: new Date(),
              status: "churned",
              updatedAt: new Date(),
            })
            .where(eq(clients.id, clientId))
            .returning({ id: clients.id });

          if (result.length === 0) {
            // Client didn't exist locally - that's fine for rollback
            log.debug("Client not found for rollback (may not have been synced)", { clientId });
            return Response.json({ success: true, found: false });
          }

          log.info("Client rollback completed", { clientId, reason });
          return Response.json({ success: true, found: true });
        } catch (error) {
          log.error(
            "Client rollback failed",
            error instanceof Error ? error : new Error(String(error)),
            { clientId }
          );

          return Response.json({ error: "Rollback failed" }, { status: 500 });
        }
      },
    },
  },
});
