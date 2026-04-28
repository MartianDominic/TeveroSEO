/**
 * Cannibalization Issues API Route.
 * Phase 35-05: Link Health Dashboard API
 *
 * GET /api/seo/links/cannibalization/:clientId - Returns cannibalization issues
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { keywordCannibalization } from "@/db/link-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/links/cannibalization" });

interface CannibalizationResponse {
  success: boolean;
  data?: typeof keywordCannibalization.$inferSelect[];
  error?: string;
}

export const Route = createFileRoute("/api/seo/links/cannibalization/$clientId")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }): Promise<Response> => {
        try {
          await requireApiAuth(request);
        } catch {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies CannibalizationResponse,
            { status: 401 }
          );
        }

        const { clientId } = params;

        try {
          // Get active cannibalization issues
          const issues = await db
            .select()
            .from(keywordCannibalization)
            .where(
              and(
                eq(keywordCannibalization.clientId, clientId),
                inArray(keywordCannibalization.status, ["detected", "monitoring"])
              )
            )
            .orderBy(
              sql`CASE ${keywordCannibalization.severity}
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                ELSE 4
              END`
            );

          log.info("Cannibalization issues retrieved", { clientId, count: issues.length });

          return Response.json({
            success: true,
            data: issues,
          } satisfies CannibalizationResponse);
        } catch (error) {
          log.error(
            "Failed to get cannibalization issues",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" } satisfies CannibalizationResponse,
            { status: 500 }
          );
        }
      },
    },
  },
});
