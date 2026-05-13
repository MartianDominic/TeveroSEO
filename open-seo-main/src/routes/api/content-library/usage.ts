/**
 * Content Library Usage API
 * Phase 101-04: Content Library
 *
 * GET /api/content-library/usage - Get popular blocks
 * POST /api/content-library/usage - Record block usage
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContentLibraryService } from "@/server/features/content-library/services/ContentLibraryService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/content-library/usage" });

/**
 * Query params for GET (popular blocks)
 */
const popularQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Body schema for POST (record usage)
 */
const recordUsageSchema = z.object({
  blockId: z.string().min(1, "blockId is required"),
  entityType: z.enum(["proposal", "contract", "document"]),
  entityId: z.string().min(1, "entityId is required"),
});

// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
export const Route = createFileRoute("/api/content-library/usage")({
  server: {
    handlers: {
      /**
       * GET /api/content-library/usage
       *
       * Get most popular content blocks by usage count.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);

          // 2. Parse query params
          const url = new URL(request.url);
          const parseResult = popularQuerySchema.safeParse({
            limit: url.searchParams.get("limit") ?? 10,
          });

          if (!parseResult.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid query parameters",
                details: parseResult.error.issues,
              },
              { status: 400 }
            );
          }

          const { limit } = parseResult.data;

          // 3. Get popular blocks
          const popular = await ContentLibraryService.getPopularBlocks(
            authContext.organizationId,
            limit
          );

          log.debug("Fetched popular content blocks", {
            workspaceId: authContext.organizationId,
            resultCount: popular.length,
          });

          return Response.json({
            success: true,
            data: popular,
          });
        } catch (error) {
          if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
            return Response.json(
              { success: false, error: error.message },
              { status: 401 }
            );
          }

          log.error("Failed to get popular blocks", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },

      /**
       * POST /api/content-library/usage
       *
       * Record usage of a content block when inserted into a document.
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);

          // 2. Parse and validate body
          const body = await request.json();
          const parseResult = recordUsageSchema.safeParse(body);

          if (!parseResult.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid request body",
                details: parseResult.error.issues,
              },
              { status: 400 }
            );
          }

          const { blockId, entityType, entityId } = parseResult.data;

          // 3. Record usage
          await ContentLibraryService.recordUsage(
            blockId,
            authContext.organizationId,
            entityType,
            entityId,
            authContext.userId
          );

          log.debug("Recorded content block usage", {
            blockId,
            entityType,
            entityId,
            workspaceId: authContext.organizationId,
          });

          return Response.json({
            success: true,
          });
        } catch (error) {
          if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
            return Response.json(
              { success: false, error: error.message },
              { status: 401 }
            );
          }

          log.error("Failed to record block usage", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
