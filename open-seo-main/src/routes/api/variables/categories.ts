/**
 * Variable Categories API Route
 * Phase 57-02: Variable System + Resolution Service
 *
 * GET /api/variables/categories - List all categories with metadata
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VariableDefinitionService } from "@/server/features/proposals/services/VariableDefinitionService";
import { getClerkAuth } from "@/server/lib/clerk-auth";

const QuerySchema = z.object({
  locale: z.enum(["en", "lt"]).optional().default("en"),
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
          const auth = await getClerkAuth(request);
          if (!auth?.userId || !auth?.orgId) {
            return Response.json(
              { error: "Unauthorized" },
              { status: 401 }
            );
          }

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
            params.data.locale as "en" | "lt"
          );

          return Response.json({ data: categories });
        } catch (error) {
          console.error("[api/variables/categories] GET failed:", error);
          return Response.json(
            { error: "Failed to fetch categories" },
            { status: 500 }
          );
        }
      },
    },
  },
});
