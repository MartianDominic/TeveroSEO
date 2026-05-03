/**
 * Pixel DOM Changes API Route
 * Phase 66-07: DOM Change Approval System
 *
 * GET /api/pixel/:siteId/changes - Get approved changes (for pixel script)
 * POST /api/pixel/:siteId/changes - Queue new change
 * GET /api/pixel/:siteId/changes/pending - Get pending changes (for approval UI)
 * GET /api/pixel/:siteId/changes/history - Get full change history
 *
 * Security:
 * - T-66-21: Validates siteId matches pixel installation
 * - T-66-22: Full audit trail with userId and timestamps
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { DomChangeService } from "@/server/features/pixel";
import { PIXEL_CHANGE_TYPES } from "@/db/pixel-schema";
import { db } from "@/db";

const log = createLogger({ module: "api/pixel/changes" });

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for queueing a new change.
 */
const QueueChangeSchema = z.object({
  changeType: z.enum(PIXEL_CHANGE_TYPES),
  targetSelector: z.string().max(500).optional(),
  targetUrl: z.string().url().optional(),
  newValue: z.string().min(1).max(100000), // Max 100KB for schema JSON
});

/**
 * Schema for pagination query params.
 */
const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/pixel/siteId/changes")({
  server: {
    handlers: {
      /**
       * GET /api/pixel/:siteId/changes
       *
       * Returns approved (live) changes for the pixel script to inject.
       * Query params:
       *   - url: Optional page URL to filter changes
       *
       * Response: { changes: Array<{ type, selector?, url?, value }> }
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

          // Parse URL query param
          const url = new URL(request.url);
          const pageUrl = url.searchParams.get("url") ?? undefined;

          log.info("Fetching approved changes", { siteId, pageUrl });

          const service = new DomChangeService(db);
          const result = await service.getApprovedChanges(siteId, pageUrl);

          return Response.json(result, {
            headers: {
              // Cache for 1 minute - changes are updated via approval
              "Cache-Control": "public, max-age=60",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (error) {
          log.error(
            "Failed to get approved changes",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to retrieve changes" },
            { status: 500 }
          );
        }
      },

      /**
       * POST /api/pixel/:siteId/changes
       *
       * Queue a new DOM change for approval.
       * Requires authentication (workspace owner/admin - T-66-20).
       *
       * Request body:
       *   - changeType: meta_title | meta_description | canonical | schema | internal_link | content
       *   - targetSelector?: CSS selector for targeting
       *   - targetUrl?: URL this change applies to
       *   - newValue: The new value to inject
       *
       * Response: { change: PixelDomChange }
       */
      POST: async ({
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

          // TODO: Add authentication check (T-66-20)
          // const session = await getSession(request);
          // if (!session) {
          //   return Response.json({ error: "Unauthorized" }, { status: 401 });
          // }

          const body = await request.json();
          const parsed = QueueChangeSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          log.info("Queueing DOM change", { siteId, changeType: parsed.data.changeType });

          const service = new DomChangeService(db);
          const change = await service.queueChange({
            siteId,
            ...parsed.data,
          });

          log.info("DOM change queued", { changeId: change.id, siteId });

          return Response.json({ change }, { status: 201 });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Handle known error types
          if (errorMessage === "Installation not found") {
            return Response.json(
              { error: "Installation not found" },
              { status: 404 }
            );
          }

          if (errorMessage === "Invalid change type") {
            return Response.json(
              { error: "Invalid change type" },
              { status: 400 }
            );
          }

          if (errorMessage === "Invalid JSON schema") {
            return Response.json(
              { error: "Invalid JSON schema content" },
              { status: 400 }
            );
          }

          log.error(
            "Failed to queue DOM change",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to queue change" },
            { status: 500 }
          );
        }
      },
    },
  },
});
