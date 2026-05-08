/**
 * Portal Analytics API Route
 * Phase 96-05: Client Portal P96 Analytics Integration
 *
 * GET /api/portal/analytics/:clientId - Get filtered P96 analytics data
 *
 * Provides portal access to Phase 96 analytics features:
 * - Trends (growing/decaying pages)
 * - Cannibalization detection
 * - Striking distance opportunities
 *
 * All responses are filtered through ClientVisibilityService to enforce
 * per-client metric visibility settings.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  validatePortalAuth,
  verifyClientIdMatch,
  requirePortalPermission,
  portalAuthErrorResponse,
} from "@/server/middleware/portal-auth";
import {
  portalExpensiveRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";
import { getClientVisibilityService } from "@/server/features/analytics/services/ClientVisibilityService";
import { analyzePageTrends } from "@/server/features/analytics/services/TrendDetectionService";
import { getCannibalizationService } from "@/server/features/analytics";
import { getStrikingDistancePages } from "@/server/features/analytics/services/StrikingDistanceService";
import type { TrendAnalysis } from "@/server/features/analytics/types";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "portal/analytics" });

/**
 * Query parameter schema for analytics endpoint.
 */
const querySchema = z.object({
  // Analytics type to fetch
  type: z.enum(["trends", "cannibalization", "striking-distance", "summary"]),

  // Common filters
  periodDays: z.coerce.number().min(7).max(90).optional().default(30),
  limit: z.coerce.number().min(1).max(100).optional().default(20),

  // Trends filters
  trend: z.enum(["growing", "decaying", "all"]).optional().default("all"),

  // Striking distance filters
  minPosition: z.coerce.number().min(1).max(100).optional().default(11),
  maxPosition: z.coerce.number().min(1).max(100).optional().default(20),
});

/**
 * Get site ID for a client.
 * Returns the primary site connection ID for analytics queries.
 */
async function getClientSiteId(clientId: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT id FROM site_connections
    WHERE client_id = ${clientId}
    ORDER BY created_at ASC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].id as string;
}

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/portal/analytics/$clientId")({
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

          // Step 1: Validate portal authentication
          const authResult = await validatePortalAuth(request);
          if (!authResult.success) {
            return portalAuthErrorResponse(authResult);
          }

          // Step 2: Verify clientId matches token
          const clientVerification = verifyClientIdMatch(authResult, clientId);
          if (!clientVerification.success) {
            return portalAuthErrorResponse(clientVerification);
          }

          // Step 3: Check rate limit (30 req/min per clientId)
          const rateLimitResult = await portalExpensiveRateLimiter(clientId);
          if (!rateLimitResult.allowed) {
            log.warn("Portal analytics rate limit exceeded", {
              clientId,
              current: rateLimitResult.current,
              limit: rateLimitResult.limit,
              retryAfter: rateLimitResult.retryAfter,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          // Step 4: Check analytics permission (requires email_verify or higher)
          const permissionCheck = requirePortalPermission(
            authResult,
            "canViewAnalytics",
            "analytics"
          );
          if (!permissionCheck.success) {
            return portalAuthErrorResponse(permissionCheck);
          }

          // Step 5: Parse query parameters
          const url = new URL(request.url);
          const rawParams = Object.fromEntries(url.searchParams);
          const parsed = querySchema.safeParse(rawParams);

          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid parameters",
                details: parsed.error.flatten(),
              },
              { status: 400 }
            );
          }

          const { type, periodDays, limit, trend, minPosition, maxPosition } =
            parsed.data;

          // Step 6: Get site ID for analytics queries
          const siteId = await getClientSiteId(clientId);
          if (!siteId) {
            return Response.json(
              {
                success: false,
                error: "No site connection found for this client",
              },
              { status: 404 }
            );
          }

          // Step 7: Get visibility configuration
          const visibilityService = await getClientVisibilityService();
          const visibility = await visibilityService.getVisibilityConfig(
            clientId,
            authResult.data.workspaceId
          );

          // Step 8: Fetch analytics data based on type
          let rawData: Record<string, unknown>;

          switch (type) {
            case "trends": {
              // Check visibility permission for growing/decaying
              if (trend === "growing" && !visibility.canViewGrowing) {
                return Response.json(
                  {
                    success: false,
                    error: "Access to growing trends is restricted",
                  },
                  { status: 403 }
                );
              }
              if (trend === "decaying" && !visibility.canViewDecaying) {
                return Response.json(
                  {
                    success: false,
                    error: "Access to decaying trends is restricted",
                  },
                  { status: 403 }
                );
              }

              // Use backward-compatible function that returns TrendResult directly
              const trendResult = await analyzePageTrends(siteId, {
                periodDays,
                trend: trend === "all" ? undefined : trend,
              });

              // Filter based on visibility if "all" trends requested
              let filteredPages = trendResult.pages;
              if (trend === "all") {
                filteredPages = trendResult.pages.filter((page: TrendAnalysis) => {
                  if (page.trend === "growing" && !visibility.canViewGrowing) {
                    return false;
                  }
                  if (page.trend === "decaying" && !visibility.canViewDecaying) {
                    return false;
                  }
                  return true;
                });
              }

              rawData = {
                pages: filteredPages.slice(0, limit),
                summary: {
                  total: filteredPages.length,
                  growing: visibility.canViewGrowing
                    ? filteredPages.filter((p: TrendAnalysis) => p.trend === "growing").length
                    : null,
                  decaying: visibility.canViewDecaying
                    ? filteredPages.filter((p: TrendAnalysis) => p.trend === "decaying").length
                    : null,
                },
                periodDays,
              };
              break;
            }

            case "cannibalization": {
              // Check visibility permission
              if (!visibility.canViewCannibalization) {
                return Response.json(
                  {
                    success: false,
                    error: "Access to cannibalization data is restricted",
                  },
                  { status: 403 }
                );
              }

              const cannibService = getCannibalizationService();
              const detectionResult = await cannibService.detect(siteId, {
                limit,
                mode: 'stored',
                persist: false,
              });

              rawData = {
                issues: detectionResult.issues.slice(0, limit),
                summary: {
                  total: detectionResult.summary.total,
                  high: detectionResult.summary.bySeverity.high,
                  medium: detectionResult.summary.bySeverity.medium,
                  low: detectionResult.summary.bySeverity.low,
                },
              };
              break;
            }

            case "striking-distance": {
              // Use backward-compatible function that returns StrikingDistanceResult directly
              const strikingResult = await getStrikingDistancePages(
                siteId,
                {
                  minPosition,
                  maxPosition,
                  limit,
                }
              );

              rawData = {
                pages: strikingResult.pages,
                summary: {
                  total: strikingResult.meta.totalPages,
                  totalPotentialClicks: strikingResult.meta.totalPotentialClicks,
                  avgDifficulty: strikingResult.meta.avgDifficulty,
                },
              };
              break;
            }

            case "summary": {
              // Summary combines key metrics from all analytics types
              // Use backward-compatible functions that return raw data directly
              const cannibService = getCannibalizationService();

              const [trendResult, cannibResult, strikingResult] =
                await Promise.all([
                  analyzePageTrends(siteId, { periodDays }),
                  visibility.canViewCannibalization
                    ? cannibService.detect(siteId, { limit: 100, mode: 'stored', persist: false })
                    : Promise.resolve({ issues: [], summary: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, totalMonthlyImpact: 0, topPriorityIssues: [] }, metadata: { mode: 'stored' as const, dateRange: { start: '', end: '' }, queryCount: 0, executionTimeMs: 0 } }),
                  getStrikingDistancePages(siteId, {
                    minPosition: 11,
                    maxPosition: 20,
                    limit: 100,
                  }),
                ]);

              rawData = {
                trends: {
                  growing: visibility.canViewGrowing
                    ? trendResult.pages.filter((p: TrendAnalysis) => p.trend === "growing")
                        .length
                    : null,
                  decaying: visibility.canViewDecaying
                    ? trendResult.pages.filter((p: TrendAnalysis) => p.trend === "decaying")
                        .length
                    : null,
                },
                cannibalization: visibility.canViewCannibalization
                  ? {
                      total: cannibResult.summary.total,
                      highSeverity: cannibResult.summary.bySeverity.high,
                    }
                  : null,
                strikingDistance: {
                  total: strikingResult.meta.totalPages,
                  potentialClicks: strikingResult.meta.totalPotentialClicks,
                },
              };
              break;
            }

            default:
              return Response.json(
                { success: false, error: "Invalid analytics type" },
                { status: 400 }
              );
          }

          // Step 9: Apply field-level visibility filtering
          const filteredData = visibilityService.filterByVisibility(
            rawData,
            visibility
          );

          log.debug("Portal analytics data retrieved", {
            clientId,
            type,
            resultCount:
              "pages" in filteredData
                ? (filteredData.pages as unknown[])?.length
                : "issues" in filteredData
                  ? (filteredData.issues as unknown[])?.length
                  : "N/A",
          });

          // Step 10: Build response with rate limit headers
          const response = Response.json({
            success: true,
            data: filteredData,
            meta: {
              type,
              periodDays,
              clientId,
              generatedAt: new Date().toISOString(),
            },
          });

          return addRateLimitHeaders(response, rateLimitResult);
        } catch (error) {
          log.error(
            "Portal analytics API error",
            error instanceof Error ? error : undefined,
            { clientId: params.clientId }
          );
          return Response.json(
            { success: false, error: "Failed to fetch analytics data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
