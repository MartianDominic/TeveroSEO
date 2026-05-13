/**
 * Content Library Single Block API
 * Phase 101-04: Content Library
 *
 * GET /api/content-library/:blockId - Get single block
 * PATCH /api/content-library/:blockId - Update block
 * DELETE /api/content-library/:blockId - Soft delete block
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContentLibraryService } from "@/server/features/content-library/services/ContentLibraryService";
import { CONTENT_BLOCK_CATEGORIES } from "@/db/content-library-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/content-library/[blockId]" });

/**
 * Body schema for PATCH (update)
 */
const updateBlockSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(CONTENT_BLOCK_CATEGORIES).optional(),
  content: z.string().min(1).optional(),
  contentEn: z.string().optional(),
  contentLt: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
export const Route = createFileRoute("/api/content-library/$blockId")({
  server: {
    handlers: {
      /**
       * GET /api/content-library/:blockId
       *
       * Get a single content block by ID.
       */
      GET: async ({ request, params }: { request: Request; params: { blockId: string } }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);

          // 2. Get block
          const block = await ContentLibraryService.getById(
            params.blockId,
            authContext.organizationId
          );

          if (!block) {
            return Response.json(
              { success: false, error: "Block not found" },
              { status: 404 }
            );
          }

          return Response.json({
            success: true,
            data: block,
          });
        } catch (error) {
          if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
            return Response.json(
              { success: false, error: error.message },
              { status: 401 }
            );
          }

          log.error("Failed to get content block", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },

      /**
       * PATCH /api/content-library/:blockId
       *
       * Update a content block.
       */
      PATCH: async ({ request, params }: { request: Request; params: { blockId: string } }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);

          // 2. Parse and validate body
          const body = await request.json();
          const parseResult = updateBlockSchema.safeParse(body);

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

          const input = parseResult.data;

          // 3. Update block
          const block = await ContentLibraryService.update(
            params.blockId,
            authContext.organizationId,
            input
          );

          if (!block) {
            return Response.json(
              { success: false, error: "Block not found" },
              { status: 404 }
            );
          }

          log.info("Updated content block", {
            blockId: params.blockId,
            workspaceId: authContext.organizationId,
          });

          return Response.json({
            success: true,
            data: block,
          });
        } catch (error) {
          if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
            return Response.json(
              { success: false, error: error.message },
              { status: 401 }
            );
          }

          log.error("Failed to update content block", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },

      /**
       * DELETE /api/content-library/:blockId
       *
       * Soft delete a content block.
       */
      DELETE: async ({ request, params }: { request: Request; params: { blockId: string } }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);

          // 2. Delete block
          await ContentLibraryService.delete(
            params.blockId,
            authContext.organizationId,
            authContext.userId
          );

          log.info("Deleted content block", {
            blockId: params.blockId,
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

          log.error("Failed to delete content block", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
