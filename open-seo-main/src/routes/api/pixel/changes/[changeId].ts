/**
 * Pixel Individual Change API Route
 * Phase 66-07: DOM Change Approval System
 *
 * GET /api/pixel/changes/:changeId - Get single change details
 * PATCH /api/pixel/changes/:changeId - Approve or reject change
 * DELETE /api/pixel/changes/:changeId - Rollback a live change
 *
 * Security:
 * - T-66-20: Require workspace owner/admin role for approval
 * - T-66-22: Full audit trail with userId and timestamps
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { DomChangeService } from "@/server/features/pixel";
import { pixelDomChanges } from "@/db/pixel-schema";
import { db } from "@/db";

const log = createLogger({ module: "api/pixel/changes/[changeId]" });

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for approve/reject action.
 */
const ActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
});

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/pixel/changes/$changeId")({
  server: {
    handlers: {
      /**
       * GET /api/pixel/changes/:changeId
       *
       * Get details for a single change.
       *
       * Response: { change: PixelDomChange }
       */
      GET: async ({ params }: { params: { changeId: string } }) => {
        try {
          const { changeId } = params;

          if (!changeId || typeof changeId !== "string") {
            return Response.json(
              { error: "Invalid changeId parameter" },
              { status: 400 }
            );
          }

          log.info("Fetching change details", { changeId });

          const change = await db.query.pixelDomChanges.findFirst({
            where: eq(pixelDomChanges.id, changeId),
          });

          if (!change) {
            return Response.json(
              { error: "Change not found" },
              { status: 404 }
            );
          }

          return Response.json({ change });
        } catch (error) {
          log.error(
            "Failed to get change details",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to retrieve change" },
            { status: 500 }
          );
        }
      },

      /**
       * PATCH /api/pixel/changes/:changeId
       *
       * Approve or reject a pending change.
       * Requires authentication (workspace owner/admin - T-66-20).
       *
       * Request body:
       *   - action: 'approve' | 'reject'
       *   - reason?: string (for rejection)
       *
       * Response: { change: PixelDomChange }
       */
      PATCH: async ({
        params,
        request,
      }: {
        params: { changeId: string };
        request: Request;
      }) => {
        try {
          const { changeId } = params;

          if (!changeId || typeof changeId !== "string") {
            return Response.json(
              { error: "Invalid changeId parameter" },
              { status: 400 }
            );
          }

          // TODO: Add authentication check (T-66-20)
          // const session = await getSession(request);
          // if (!session) {
          //   return Response.json({ error: "Unauthorized" }, { status: 401 });
          // }
          // const userId = session.userId;
          const userId = "system"; // Placeholder until auth is wired

          const body = await request.json();
          const parsed = ActionSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const { action, reason } = parsed.data;
          const service = new DomChangeService(db);

          if (action === "approve") {
            log.info("Approving change", { changeId, userId });
            const change = await service.approveChange(changeId, userId);
            log.info("Change approved", { changeId, userId });
            return Response.json({ change });
          } else {
            log.info("Rejecting change", { changeId, userId, reason });
            await service.rejectChange(changeId, userId, reason);

            // Fetch the updated change to return
            const change = await db.query.pixelDomChanges.findFirst({
              where: eq(pixelDomChanges.id, changeId),
            });

            log.info("Change rejected", { changeId, userId });
            return Response.json({ change });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Handle known error types
          if (errorMessage === "Change not found") {
            return Response.json(
              { error: "Change not found" },
              { status: 404 }
            );
          }

          if (errorMessage === "Change is not pending") {
            return Response.json(
              { error: "Change is not pending - cannot approve/reject" },
              { status: 400 }
            );
          }

          log.error(
            "Failed to process change action",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to process change action" },
            { status: 500 }
          );
        }
      },

      /**
       * DELETE /api/pixel/changes/:changeId
       *
       * Rollback a live change to its previous value.
       * Requires authentication (workspace owner/admin - T-66-20).
       *
       * Response: { oldChange: PixelDomChange, newChange: PixelDomChange }
       */
      DELETE: async ({
        params,
        request,
      }: {
        params: { changeId: string };
        request: Request;
      }) => {
        try {
          const { changeId } = params;

          if (!changeId || typeof changeId !== "string") {
            return Response.json(
              { error: "Invalid changeId parameter" },
              { status: 400 }
            );
          }

          // TODO: Add authentication check (T-66-20)
          // const session = await getSession(request);
          // if (!session) {
          //   return Response.json({ error: "Unauthorized" }, { status: 401 });
          // }
          // const userId = session.userId;
          const userId = "system"; // Placeholder until auth is wired

          log.info("Rolling back change", { changeId, userId });

          // Get the original change before rollback
          const oldChange = await db.query.pixelDomChanges.findFirst({
            where: eq(pixelDomChanges.id, changeId),
          });

          if (!oldChange) {
            return Response.json(
              { error: "Change not found" },
              { status: 404 }
            );
          }

          const service = new DomChangeService(db);
          const newChange = await service.rollbackChange(changeId, userId);

          // Fetch the updated old change (now rolled_back status)
          const updatedOldChange = await db.query.pixelDomChanges.findFirst({
            where: eq(pixelDomChanges.id, changeId),
          });

          log.info("Change rolled back", { oldChangeId: changeId, newChangeId: newChange.id });

          return Response.json({
            oldChange: updatedOldChange,
            newChange,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Handle known error types
          if (errorMessage === "Change not found") {
            return Response.json(
              { error: "Change not found" },
              { status: 404 }
            );
          }

          if (errorMessage === "Can only rollback live changes") {
            return Response.json(
              { error: "Can only rollback live changes" },
              { status: 400 }
            );
          }

          if (errorMessage === "No previous value to restore") {
            return Response.json(
              { error: "No previous value to restore" },
              { status: 400 }
            );
          }

          log.error(
            "Failed to rollback change",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to rollback change" },
            { status: 500 }
          );
        }
      },
    },
  },
});
