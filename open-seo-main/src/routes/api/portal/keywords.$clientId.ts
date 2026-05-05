/**
 * Keywords API Route
 * Phase 90-02: Client Portal API Routes
 *
 * GET /api/portal/keywords/:clientId - Get keyword rankings with pagination
 *
 * Returns tracked keywords with position data from GSC.
 * Per D-02: Volume/CPC data marked with isEstimated flag.
 */
import { createFileRoute } from "@tanstack/react-router";
import { portalTokenService } from "@/server/services/PortalTokenService";
import { db } from "@/db";
import { seoGscQuerySnapshots } from "@/db/schema/seo-gsc-snapshots";
import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "portal/keywords" });

/**
 * Extract token from Authorization header or query param.
 */
function extractToken(request: Request, query: URLSearchParams): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return query.get("token");
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

// @ts-expect-error - Route not in FileRoutesByPath until generated
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
          const url = new URL(request.url);
          const token = extractToken(request, url.searchParams);

          // Validate token presence
          if (!token) {
            return Response.json(
              { success: false, error: "Missing authentication token" },
              { status: 401 }
            );
          }

          // Validate token
          const validation = await portalTokenService.validateToken(token);
          if (!validation.valid) {
            log.warn("Invalid token attempt", {
              clientId,
              error: validation.error,
            });
            return Response.json(
              {
                success: false,
                error:
                  validation.error === "expired"
                    ? "Token has expired"
                    : validation.error === "revoked"
                      ? "Token has been revoked"
                      : "Invalid token",
              },
              { status: 401 }
            );
          }

          // Verify clientId matches token (T-90-08)
          if (validation.clientId !== clientId) {
            log.warn("Client ID mismatch", {
              tokenClientId: validation.clientId,
              requestedClientId: clientId,
            });
            return Response.json(
              { success: false, error: "Access denied" },
              { status: 403 }
            );
          }

          // Parse query params
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
          const filter = ["all", "top10", "improving", "declining"].includes(
            filterParam
          )
            ? (filterParam as "all" | "top10" | "improving" | "declining")
            : "all";

          // Calculate date ranges (accounting for 3-day GSC delay)
          const now = new Date();
          const endDate = new Date(now);
          endDate.setDate(endDate.getDate() - 3);

          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 7);

          const previousEndDate = new Date(startDate);
          previousEndDate.setDate(previousEndDate.getDate() - 1);
          const previousStartDate = new Date(previousEndDate);
          previousStartDate.setDate(previousStartDate.getDate() - 7);

          // Fetch keyword data
          const { keywords, total, summary } = await getKeywordMetrics(
            clientId,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
            previousStartDate.toISOString().split("T")[0],
            previousEndDate.toISOString().split("T")[0],
            { limit, offset, sort, filter }
          );

          log.debug("Keywords data retrieved", {
            clientId,
            total,
            returned: keywords.length,
          });

          return Response.json({
            success: true,
            data: {
              keywords,
              pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
              },
              summary,
            },
          });
        } catch (error) {
          log.error("Keywords API error", {
            error: error instanceof Error ? error.message : String(error),
            clientId: params.clientId,
          });
          return Response.json(
            { success: false, error: "Failed to fetch keyword data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
