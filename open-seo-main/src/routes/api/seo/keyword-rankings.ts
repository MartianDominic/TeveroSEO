/**
 * REST API for keyword ranking history.
 * Phase 17: Provides endpoints for sparklines and position charts.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  getKeywordRankingHistory,
  getKeywordLatestRanking,
  getSavedKeywordsWithRankings,
} from "@/server/features/keywords/services/ranking-history";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/keyword-rankings" });

async function getContext(request: Request) {
  const auth = await requireApiAuth(request);
  const url = new URL(request.url);
  const clientId = await resolveClientId(request.headers, request.url);
  return { ...auth, clientId, url };
}

export const Route = createFileRoute("/api/seo/keyword-rankings")({
  server: {
    handlers: {
      /**
       * GET /api/seo/keyword-rankings
       * Query params:
       * - keyword_id: string (required) - The keyword ID
       * - action: "history" | "latest" | "with-rankings" (default: "history")
       * - days: number (default: 30, for history action)
       * - project_id: string (required for with-rankings action)
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getContext(request);
          const keywordId = ctx.url.searchParams.get("keyword_id");
          const action = ctx.url.searchParams.get("action") ?? "history";
          const projectId = ctx.url.searchParams.get("project_id");

          // Parse days with NaN check and bounds validation
          const daysParam = ctx.url.searchParams.get("days");
          let days = 30; // Default
          if (daysParam) {
            const parsed = parseInt(daysParam, 10);
            if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 365) {
              days = parsed;
            }
          }

          if (action === "with-rankings") {
            if (!projectId) {
              throw new AppError(
                "VALIDATION_ERROR",
                "project_id required for with-rankings action",
              );
            }
            const result = await getSavedKeywordsWithRankings({ projectId });
            return Response.json(result);
          }

          if (!keywordId) {
            throw new AppError(
              "VALIDATION_ERROR",
              "keyword_id query parameter required",
            );
          }

          if (action === "latest") {
            const result = await getKeywordLatestRanking({ keywordId });
            return Response.json(result);
          }

          // Default: history
          const result = await getKeywordRankingHistory({ keywordId, days });
          return Response.json(result);
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "GET error",
            error instanceof Error ? error : new Error(String(error)),
          );
          return Response.json(
            { error: "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
