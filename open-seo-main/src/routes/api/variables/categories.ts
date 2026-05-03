/**
 * Variable Categories API Route
 * Phase 57-02: Variable System + Resolution Service
 *
 * GET /api/variables/categories - List all categories with metadata
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VariableDefinitionService } from "@/server/features/proposals/services/VariableDefinitionService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-variables-categories" });

const QuerySchema = z.object({
  locale: z.enum(["en", "lt"]).optional(),
});

export const Route = createFileRoute("/api/variables/categories")({
  server: {
    handlers: {
      /**
       * GET /api/variables/categories
       * List all variable categories with labels and colors.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          // Get auth context
          await requireApiAuth(request);

          // Parse query params
          const url = new URL(request.url);
          const params = QuerySchema.safeParse({
            locale: url.searchParams.get("locale") ?? "en",
          });

          if (!params.success) {
            return Response.json(
              { error: "Invalid query parameters" },
              { status: 400 }
            );
          }

          const categories = VariableDefinitionService.getCategories(
            (params.data.locale ?? "en") as "en" | "lt"
          );

          return Response.json({ data: categories });
        } catch (error) {
          log.error("GET failed", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { error: { code: "INTERNAL_ERROR", message: "Failed to fetch categories" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
