/**
 * REST API wrapper for keyword serverFunctions.
 * Phase 10: Exposed for Next.js server actions to call.
 */
import { createFileRoute } from "@tanstack/react-router";
import { KeywordResearchService } from "@/server/features/keywords/services/KeywordResearchService";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import {
  researchKeywordsSchema,
  saveKeywordsSchema,
  removeSavedKeywordSchema,
  serpAnalysisSchema,
} from "@/types/schemas/keywords";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import { rateLimit, rateLimitExceededResponse } from "@/server/middleware/rate-limit";

const log = createLogger({ module: "api/seo/keywords" });

/** Rate limit config for keyword operations: 10 requests per hour per user (external API costs) */
const KEYWORD_RATE_LIMIT = {
  limit: 10,
  window: 3600, // 1 hour in seconds
};

async function getProjectContext(request: Request) {
  const auth = await requireApiAuth(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");
  const clientId = await resolveClientId(request.headers, request.url);

  if (!projectId) {
    throw new AppError("VALIDATION_ERROR", "project_id query parameter required");
  }

  return { ...auth, projectId, clientId };
}

export const Route = createFileRoute("/api/seo/keywords")({
  server: {
    handlers: {
      // GET /api/seo/keywords - Get saved keywords
      GET: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getProjectContext(request);
          const result = await KeywordResearchService.getSavedKeywords({
            projectId: ctx.projectId,
          });
          return Response.json(result);
        } catch (error) {
          if (error instanceof AppError) {
            const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error("GET error", error instanceof Error ? error : new Error(String(error)));
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      // POST /api/seo/keywords - Research, save, remove, or SERP analysis
      POST: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getProjectContext(request);
          const body = (await request.json()) as Record<string, unknown>;
          const action = (body.action as string) ?? "research";

          // Rate limit external API calls (research and serp actions)
          if (action === "research" || action === "serp") {
            const rateLimitResult = await rateLimit({
              key: `keywords:${action}:${ctx.userId}`,
              ...KEYWORD_RATE_LIMIT,
            });
            if (!rateLimitResult.allowed) {
              return rateLimitExceededResponse(rateLimitResult);
            }
          }

          if (action === "save") {
            const parsed = saveKeywordsSchema.safeParse(body);
            if (!parsed.success) {
              return Response.json({ error: parsed.error.message }, { status: 400 });
            }
            const result = await KeywordResearchService.saveKeywords({
              ...parsed.data,
              projectId: ctx.projectId,
            });
            return Response.json(result);
          }

          if (action === "remove") {
            const parsed = removeSavedKeywordSchema.safeParse(body);
            if (!parsed.success) {
              return Response.json({ error: parsed.error.message }, { status: 400 });
            }
            const result = await KeywordResearchService.removeSavedKeyword(
              ctx.projectId,
              parsed.data
            );
            return Response.json(result);
          }

          if (action === "serp") {
            const parsed = serpAnalysisSchema.safeParse(body);
            if (!parsed.success) {
              return Response.json({ error: parsed.error.message }, { status: 400 });
            }
            const result = await KeywordResearchService.getSerpAnalysis(
              { ...parsed.data, projectId: ctx.projectId },
              ctx
            );
            return Response.json(result);
          }

          // Default: research
          const parsed = researchKeywordsSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json({ error: parsed.error.message }, { status: 400 });
          }
          const result = await KeywordResearchService.research(
            { ...parsed.data, projectId: ctx.projectId },
            ctx
          );
          return Response.json(result);
        } catch (error) {
          if (error instanceof AppError) {
            const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error("POST error", error instanceof Error ? error : new Error(String(error)));
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
