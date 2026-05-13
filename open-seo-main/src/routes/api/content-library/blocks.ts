/**
 * Content Library Blocks API
 * Phase 101-04: Content Library
 *
 * GET /api/content-library/blocks - Search/list content blocks
 * POST /api/content-library/blocks - Create a new content block
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

const log = createLogger({ module: "api/content-library/blocks" });

/**
 * Query params for GET (search)
 */
const searchQuerySchema = z.object({
  query: z.string().optional(),
  category: z.enum(CONTENT_BLOCK_CATEGORIES).optional(),
  tags: z.string().optional(), // comma-separated
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Body schema for POST (create)
 */
const createBlockSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: z.enum(CONTENT_BLOCK_CATEGORIES),
  content: z.string().min(1, "Content is required"),
  contentEn: z.string().optional(),
  contentLt: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
export const Route = createFileRoute("/api/content-library/blocks")({
  server: {
    handlers: {
      /**
       * GET /api/content-library/blocks
       *
       * Search content blocks with optional filters.
       * Query params: query, category, tags (comma-separated), limit
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);

          // 2. Parse query params
          const url = new URL(request.url);
          const parseResult = searchQuerySchema.safeParse({
            query: url.searchParams.get("query") ?? undefined,
            category: url.searchParams.get("category") ?? undefined,
            tags: url.searchParams.get("tags") ?? undefined,
            limit: url.searchParams.get("limit") ?? 50,
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

          const query = parseResult.data;

          // 3. Search blocks
          const blocks = await ContentLibraryService.search(
            authContext.organizationId,
            {
              query: query.query,
              category: query.category,
              tags: query.tags ? query.tags.split(",").filter(Boolean) : undefined,
              limit: query.limit,
            }
          );

          log.debug("Searched content blocks", {
            workspaceId: authContext.organizationId,
            resultCount: blocks.length,
          });

          return Response.json({
            success: true,
            data: blocks,
          });
        } catch (error) {
          if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
            return Response.json(
              { success: false, error: error.message },
              { status: 401 }
            );
          }

          log.error("Failed to search content blocks", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },

      /**
       * POST /api/content-library/blocks
       *
       * Create a new content block.
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);

          // 2. Parse and validate body
          const body = await request.json();
          const parseResult = createBlockSchema.safeParse(body);

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

          // 3. Create block
          const block = await ContentLibraryService.create(
            input,
            authContext.organizationId,
            authContext.userId
          );

          log.info("Created content block", {
            blockId: block.id,
            category: input.category,
            workspaceId: authContext.organizationId,
          });

          return Response.json(
            {
              success: true,
              data: block,
            },
            { status: 201 }
          );
        } catch (error) {
          if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
            return Response.json(
              { success: false, error: error.message },
              { status: 401 }
            );
          }

          log.error("Failed to create content block", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
