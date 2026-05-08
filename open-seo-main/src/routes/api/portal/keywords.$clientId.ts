/**
 * Keywords API Route
 * Phase 90-02: Client Portal API Routes
 * Phase 96-05: Added ClientVisibilityService filtering + striking distance data
 *
 * GET /api/portal/keywords/:clientId - Get keyword rankings with pagination
 *
 * Returns tracked keywords with position data from GSC.
 * Per D-02: Volume/CPC data marked with isEstimated flag.
 * Per P96-05: All responses filtered through ClientVisibilityService.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  validatePortalAuth,
  verifyClientIdMatch,
  portalAuthErrorResponse,
} from "@/server/middleware/portal-auth";
import {
  portalStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";
import { getClientVisibilityService } from "@/server/features/analytics/services/ClientVisibilityService";
import { db } from "@/db";
import { seoGscQuerySnapshots } from "@/db/schema/seo-gsc-snapshots";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "portal/keywords" });

/**
 * Striking distance keyword - position 11-20 with improvement potential.
 */
interface StrikingDistanceKeyword {
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  potentialClicks: number;
}

/**
 * Keyword data structure for API response.
 */
interface KeywordData {
  keyword: string;
  position: number;
  previousPosition: number;
  change: number;
  clicks: number;
  impressions: number;
  ctr: number;
  volume: number | null;
  isEstimated: boolean;
}

/**
 * Query aggregated keyword metrics from GSC snapshots.
 */
async function getKeywordMetrics(
  clientId: string,
  startDate: string,
  endDate: string,
  previousStartDate: string,
  previousEndDate: string,
  options: {
    limit: number;
    offset: number;
    sort: "position" | "clicks" | "change";
    filter: "all" | "top10" | "improving" | "declining";
  }
): Promise<{ keywords: KeywordData[]; total: number; summary: Record<string, number> }> {
  // Fetch current period data
  const currentData = await db
    .select({
      query: seoGscQuerySnapshots.query,
      position: sql<number>`min(${seoGscQuerySnapshots.position})`,
      clicks: sql<number>`sum(${seoGscQuerySnapshots.clicks})`,
      impressions: sql<number>`sum(${seoGscQuerySnapshots.impressions})`,
    })
    .from(seoGscQuerySnapshots)
    .where(
      and(
        eq(seoGscQuerySnapshots.clientId, clientId),
        gte(seoGscQuerySnapshots.date, startDate),
        lte(seoGscQuerySnapshots.date, endDate)
      )
    )
    .groupBy(seoGscQuerySnapshots.query);

  // Fetch previous period data for comparison
  const previousData = await db
    .select({
      query: seoGscQuerySnapshots.query,
      position: sql<number>`min(${seoGscQuerySnapshots.position})`,
    })
    .from(seoGscQuerySnapshots)
    .where(
      and(
        eq(seoGscQuerySnapshots.clientId, clientId),
        gte(seoGscQuerySnapshots.date, previousStartDate),
        lte(seoGscQuerySnapshots.date, previousEndDate)
      )
    )
    .groupBy(seoGscQuerySnapshots.query);

  // Create lookup for previous positions
  const previousPositions = new Map<string, number>();
  for (const row of previousData) {
    previousPositions.set(row.query, Number(row.position) || 100);
  }

  // Transform and enrich keyword data
  let keywords: KeywordData[] = currentData.map((row) => {
    const position = Number(row.position) || 100;
    const previousPosition = previousPositions.get(row.query) ?? 100;
    const clicks = Number(row.clicks) || 0;
    const impressions = Number(row.impressions) || 0;

    return {
      keyword: row.query,
      position,
      previousPosition,
      change: previousPosition - position, // Positive = improved
      clicks,
      impressions,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      volume: null, // No DataForSEO integration yet
      isEstimated: false, // Volume would be estimated when available
    };
  });

  // Calculate summary stats
  const summary = {
    top10: keywords.filter((k) => k.position <= 10).length,
    improving: keywords.filter((k) => k.change > 0).length,
    declining: keywords.filter((k) => k.change < 0).length,
    unchanged: keywords.filter((k) => k.change === 0).length,
  };

  // Apply filter
  if (options.filter === "top10") {
    keywords = keywords.filter((k) => k.position <= 10);
  } else if (options.filter === "improving") {
    keywords = keywords.filter((k) => k.change > 0);
  } else if (options.filter === "declining") {
    keywords = keywords.filter((k) => k.change < 0);
  }

  // Sort
  if (options.sort === "position") {
    keywords.sort((a, b) => a.position - b.position);
  } else if (options.sort === "clicks") {
    keywords.sort((a, b) => b.clicks - a.clicks);
  } else if (options.sort === "change") {
    keywords.sort((a, b) => b.change - a.change);
  }

  const total = keywords.length;

  // Apply pagination
  keywords = keywords.slice(options.offset, options.offset + options.limit);

  return { keywords, total, summary };
}

/**
 * Get striking distance keywords (positions 11-20).
 */
async function getStrikingDistanceKeywords(
  clientId: string,
  startDate: string,
  endDate: string,
  limit: number
): Promise<StrikingDistanceKeyword[]> {
  const data = await db
    .select({
      query: seoGscQuerySnapshots.query,
      position: sql<number>`min(${seoGscQuerySnapshots.position})`,
      clicks: sql<number>`sum(${seoGscQuerySnapshots.clicks})`,
      impressions: sql<number>`sum(${seoGscQuerySnapshots.impressions})`,
    })
    .from(seoGscQuerySnapshots)
    .where(
      and(
        eq(seoGscQuerySnapshots.clientId, clientId),
        gte(seoGscQuerySnapshots.date, startDate),
        lte(seoGscQuerySnapshots.date, endDate)
      )
    )
    .groupBy(seoGscQuerySnapshots.query);

  // Filter to positions 11-20 and calculate potential
  return data
    .filter((row) => {
      const position = Number(row.position) || 100;
      return position >= 11 && position <= 20;
    })
    .map((row) => {
      const position = Number(row.position) || 100;
      const impressions = Number(row.impressions) || 0;
      // Estimate potential clicks if moved to position 3 (avg ~10% CTR)
      const potentialClicks = Math.round(impressions * 0.1);
      return {
        keyword: row.query,
        position,
        clicks: Number(row.clicks) || 0,
        impressions,
        potentialClicks,
      };
    })
    .sort((a, b) => b.potentialClicks - a.potentialClicks)
    .slice(0, limit);
}

export const Route = createFileRoute("/api/portal/keywords/$clientId")({
  server: {
    handlers: {
      GET: async ({
        params,
        request,
      }: {
        params: { clientId: string };
        request: Request;
      }) => {
        try {
          const { clientId } = params;

          // Step 1: Validate portal authentication using new middleware
          const authResult = await validatePortalAuth(request);
          if (!authResult.success) {
            return portalAuthErrorResponse(authResult);
          }

          // Step 2: Verify clientId matches token (T-90-08)
          const clientVerification = verifyClientIdMatch(authResult, clientId);
          if (!clientVerification.success) {
            return portalAuthErrorResponse(clientVerification);
          }

          // Step 3: Check rate limit (60 req/min per clientId)
          const rateLimitResult = await portalStandardRateLimiter(clientId);
          if (!rateLimitResult.allowed) {
            log.warn("Portal keywords rate limit exceeded", {
              clientId,
              current: rateLimitResult.current,
              limit: rateLimitResult.limit,
              retryAfter: rateLimitResult.retryAfter,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          // Step 4: Get visibility configuration for filtering
          const visibilityService = await getClientVisibilityService();
          const visibility = await visibilityService.getVisibilityConfig(
            clientId,
            authResult.data.workspaceId
          );

          // Step 5: Parse query params
          const url = new URL(request.url);
          const limit = Math.min(
            Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
            200
          );
          const offset = Math.max(
            parseInt(url.searchParams.get("offset") || "0", 10),
            0
          );
          const sortParam = url.searchParams.get("sort") || "position";
          const sort = ["position", "clicks", "change"].includes(sortParam)
            ? (sortParam as "position" | "clicks" | "change")
            : "position";
          const filterParam = url.searchParams.get("filter") || "all";
          const filter = ["all", "top10", "improving", "declining", "striking"].includes(
            filterParam
          )
            ? (filterParam as "all" | "top10" | "improving" | "declining" | "striking")
            : "all";

          // Step 6: Calculate date ranges (accounting for 3-day GSC delay)
          const now = new Date();
          const endDate = new Date(now);
          endDate.setDate(endDate.getDate() - 3);

          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 7);

          const previousEndDate = new Date(startDate);
          previousEndDate.setDate(previousEndDate.getDate() - 1);
          const previousStartDate = new Date(previousEndDate);
          previousStartDate.setDate(previousStartDate.getDate() - 7);

          // Step 7: Fetch keyword data
          const { keywords, total, summary } = await getKeywordMetrics(
            clientId,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
            previousStartDate.toISOString().split("T")[0],
            previousEndDate.toISOString().split("T")[0],
            { limit, offset, sort, filter: filter === "striking" ? "all" : filter }
          );

          // Step 8: Get striking distance keywords if requested or for summary
          let strikingDistanceKeywords: StrikingDistanceKeyword[] = [];
          if (filter === "striking" || filter === "all") {
            strikingDistanceKeywords = await getStrikingDistanceKeywords(
              clientId,
              startDate.toISOString().split("T")[0],
              endDate.toISOString().split("T")[0],
              filter === "striking" ? limit : 5 // Full list if filtering, top 5 for summary
            );
          }

          // Step 9: Build raw response data
          const rawData = {
            keywords: filter === "striking"
              ? strikingDistanceKeywords.map((k) => ({
                  keyword: k.keyword,
                  position: k.position,
                  previousPosition: k.position, // No previous for striking distance view
                  change: 0,
                  clicks: k.clicks,
                  impressions: k.impressions,
                  ctr: k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0,
                  volume: null,
                  isEstimated: false,
                  potentialClicks: k.potentialClicks,
                }))
              : keywords,
            pagination: {
              total: filter === "striking" ? strikingDistanceKeywords.length : total,
              limit,
              offset,
              hasMore: filter === "striking"
                ? false
                : offset + limit < total,
            },
            summary: {
              ...summary,
              strikingDistance: strikingDistanceKeywords.length,
              totalPotentialClicks: strikingDistanceKeywords.reduce(
                (sum, k) => sum + k.potentialClicks,
                0
              ),
            },
            // P96 striking distance highlight
            strikingDistanceHighlights:
              filter !== "striking" && strikingDistanceKeywords.length > 0
                ? strikingDistanceKeywords.slice(0, 3)
                : undefined,
          };

          // Step 10: Apply visibility filtering to response
          const filteredData = visibilityService.filterByVisibility(
            rawData,
            visibility
          );

          log.debug("Keywords data retrieved", {
            clientId,
            workspaceId: authResult.data.workspaceId,
            total,
            returned: keywords.length,
            strikingDistance: strikingDistanceKeywords.length,
          });

          // Step 11: Build response with rate limit headers
          const response = Response.json({
            success: true,
            data: filteredData,
          });

          return addRateLimitHeaders(response, rateLimitResult);
        } catch (error) {
          log.error(
            "Keywords API error",
            error instanceof Error ? error : undefined,
            { clientId: params.clientId }
          );
          return Response.json(
            { success: false, error: "Failed to fetch keyword data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
