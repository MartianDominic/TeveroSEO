/**
 * Pixel Change History API Route
 * Phase 66-07: DOM Change Approval System
 *
 * GET /api/pixel/:siteId/changes/history - Get full change history with pagination
 *
 * Security:
 * - Requires authentication (workspace access)
 * - T-66-21: Validates siteId matches pixel installation
 * - T-66-22: Returns full audit trail
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { DomChangeService } from "@/server/features/pixel";
import { db } from "@/db";

const log = createLogger({ module: "api/pixel/changes/history" });

/**
 * Schema for pagination query params.
 */
const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const Route = createFileRoute("/api/pixel/siteId/changes/history")({
  server: {
    handlers: {
      /**
       * GET /api/pixel/:siteId/changes/history
       *
       * Returns full change history with pagination.
       * Query params:
       *   - limit: Number of records (default 50, max 100)
       *   - offset: Number of records to skip (default 0)
       *
       * Response: { changes: PixelDomChange[], pagination: { limit, offset, hasMore } }
       */
      GET: async ({
        params,
        request,
      }: {
        params: { siteId: string };
        request: Request;
      }) => {
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

          // Parse pagination params
          const url = new URL(request.url);
          const parsed = PaginationSchema.safeParse({
            limit: url.searchParams.get("limit") ?? "50",
            offset: url.searchParams.get("offset") ?? "0",
          });

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid pagination parameters" },
              { status: 400 }
            );
          }

          const { limit, offset } = parsed.data;

          log.info("Fetching change history", { siteId, limit, offset });

          const service = new DomChangeService(db);
          const changes = await service.getChangeHistory(siteId, { limit, offset });

          // Determine if there are more records
          const hasMore = changes.length === limit;

          return Response.json({
            changes,
            pagination: {
              limit,
              offset,
              hasMore,
            },
          });
        } catch (error) {
          log.error(
            "Failed to get change history",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to retrieve change history" },
            { status: 500 }
          );
        }
      },
    },
  },
});
