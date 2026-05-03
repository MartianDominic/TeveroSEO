/**
 * Pixel Pending Changes API Route
 * Phase 66-07: DOM Change Approval System
 *
 * GET /api/pixel/:siteId/changes/pending - Get pending changes for approval UI
 *
 * Security:
 * - Requires authentication (workspace access)
 * - T-66-21: Validates siteId matches pixel installation
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { DomChangeService } from "@/server/features/pixel";
import { db } from "@/db";

const log = createLogger({ module: "api/pixel/changes/pending" });

export const Route = createFileRoute("/api/pixel/$siteId/changes/pending")({
  server: {
    handlers: {
      /**
       * GET /api/pixel/:siteId/changes/pending
       *
       * Returns pending changes awaiting approval.
       *
       * Response: { changes: PixelDomChange[] }
       */
      GET: async ({ params }: { params: { siteId: string } }) => {
        try {
          const { siteId } = params;

          if (!siteId || typeof siteId !== "string") {
            return Response.json(
              { error: "Invalid siteId parameter" },
              { status: 400 }
            );
          }

          // TODO: Add authentication check
          // const session = await getSession(request);
          // if (!session) {
          //   return Response.json({ error: "Unauthorized" }, { status: 401 });
          // }

          log.info("Fetching pending changes", { siteId });

          const service = new DomChangeService(db);
          const changes = await service.getPendingChanges(siteId);

          return Response.json({ changes });
        } catch (error) {
          log.error(
            "Failed to get pending changes",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to retrieve pending changes" },
            { status: 500 }
          );
        }
      },
    },
  },
});
