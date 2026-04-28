/**
 * REST API for keyword-to-page mapping.
 * Phase 34: Provides endpoints for mapping operations.
 */
import { createFileRoute } from "@tanstack/react-router";
import { MappingService, type KeywordData } from "@/server/features/mapping/services/MappingService";
import { type PageContent } from "@/server/features/mapping/services/relevance";
import { KeywordAggregationService } from "@/server/services/keyword-aggregation/KeywordAggregationService";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { auditPages, audits } from "@/db/app.schema";
import { eq, desc } from "drizzle-orm";

const log = createLogger({ module: "api/seo/keyword-mapping" });

interface MappingQuery {
  project_id: string;
  client_id: string;
  action?: string;
}

interface SuggestMappingsBody {
  action: "suggest";
  includeGsc?: boolean;
  includeSaved?: boolean;
  includeProspect?: boolean;
}

interface OverrideMappingBody {
  action: "override";
  keyword: string;
  newTargetUrl: string | null;
}

type RequestBody = SuggestMappingsBody | OverrideMappingBody;

/**
 * Extract project context from request.
 */
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

/**
 * Extract H1 from headingOrderJson array.
 */
function extractH1FromHeadingOrder(
  headingOrderJson: unknown
): string | null {
  if (!Array.isArray(headingOrderJson)) return null;

  const h1 = headingOrderJson.find(
    (h: unknown) => {
      const heading = h as { level?: number; text?: string };
      return heading.level === 1;
    }
  );

  return (h1 as { text?: string })?.text ?? null;
}

export const Route = createFileRoute("/api/seo/keyword-mapping")({
  server: {
    handlers: {
      /**
       * GET /api/seo/keyword-mapping
       * Returns all mappings for a project, optionally filtered by action.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getProjectContext(request);
          const url = new URL(request.url);
          const actionFilter = url.searchParams.get("action") as "optimize" | "create" | null;

          const mappings = await MappingService.getMappings(ctx.projectId, {
            action: actionFilter ?? undefined,
          });

          const stats = await MappingService.getMappingStats(ctx.projectId);

          return Response.json({ mappings, stats });
        } catch (error) {
          if (error instanceof AppError) {
            const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error("GET error", error instanceof Error ? error : new Error(String(error)));
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      /**
       * POST /api/seo/keyword-mapping
       * Handles suggest and override actions.
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getProjectContext(request);
          const body = (await request.json()) as RequestBody;

          if (body.action === "suggest") {
            return await handleSuggestMappings(ctx.projectId, body);
          }

          if (body.action === "override") {
            return await handleOverrideMapping(ctx.projectId, body);
          }

          throw new AppError("VALIDATION_ERROR", "Invalid action. Use 'suggest' or 'override'.");
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

/**
 * Suggest mappings for all aggregated keywords.
 */
async function handleSuggestMappings(
  projectId: string,
  options: SuggestMappingsBody
): Promise<Response> {
  // 1. Aggregate keywords from all sources
  const aggregationResult = await KeywordAggregationService.aggregateKeywords(projectId, {
    includeProspectKeywords: options.includeProspect ?? true,
  });

  const aggregatedKeywords = aggregationResult.keywords;

  if (aggregatedKeywords.length === 0) {
    return Response.json({
      mapped: 0,
      message: "No keywords found to map. Add keywords via GSC connection or keyword research.",
    });
  }

  // 2. Get page inventory from latest audit
  const latestAudit = await db.query.audits.findFirst({
    where: eq(audits.projectId, projectId),
    orderBy: desc(audits.completedAt),
  });

  const pages: PageContent[] = [];
  if (latestAudit) {
    const auditPageRows = await db.query.auditPages.findMany({
      where: eq(auditPages.auditId, latestAudit.id),
    });

    for (const p of auditPageRows) {
      pages.push({
        url: p.url,
        title: p.title,
        h1: extractH1FromHeadingOrder(p.headingOrderJson),
        content: undefined, // We don't store full content, but title/H1/URL usually sufficient
        wordCount: p.wordCount ?? 0,
      });
    }
  }

  // 3. Convert aggregated keywords to KeywordData format
  const keywordData: KeywordData[] = aggregatedKeywords.map((kw) => ({
    keyword: kw.keyword,
    searchVolume: kw.searchVolume ?? undefined,
    difficulty: kw.difficulty ?? undefined,
    currentPosition: kw.currentPosition ?? undefined,
    currentUrl: kw.currentUrl ?? undefined,
  }));

  // 4. Map keywords to pages
  const mappingResults = MappingService.mapKeywordsToPages(keywordData, pages);

  // 5. Save mappings
  const keywordDataMap = new Map(keywordData.map((k) => [k.keyword, k]));
  await MappingService.saveMappings(projectId, mappingResults, keywordDataMap);

  // 6. Return stats
  const stats = await MappingService.getMappingStats(projectId);

  return Response.json({
    mapped: mappingResults.length,
    stats,
    aggregationStats: {
      totalKeywords: aggregationResult.totalUnique,
      bySource: aggregationResult.sourceCounts,
      withSearchVolume: aggregatedKeywords.filter((k) => k.searchVolume !== null).length,
      withPosition: aggregatedKeywords.filter((k) => k.currentPosition !== null).length,
    },
    message: `Mapped ${mappingResults.length} keywords. ${stats.optimize} to optimize, ${stats.create} need new content.`,
  });
}

/**
 * Override a single mapping.
 */
async function handleOverrideMapping(
  projectId: string,
  body: OverrideMappingBody
): Promise<Response> {
  const { keyword, newTargetUrl } = body;

  if (!keyword) {
    throw new AppError("VALIDATION_ERROR", "keyword is required");
  }

  await MappingService.overrideMapping(projectId, keyword, newTargetUrl);

  return Response.json({
    success: true,
    message: newTargetUrl
      ? `Keyword "${keyword}" now targets "${newTargetUrl}"`
      : `Keyword "${keyword}" flagged for new content creation`,
  });
}
