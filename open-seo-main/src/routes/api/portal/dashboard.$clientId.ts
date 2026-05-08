/**
 * Dashboard API Route
 * Phase 90-02: Client Portal API Routes
 * Phase 96-05: Added ClientVisibilityService filtering
 *
 * GET /api/portal/dashboard/:clientId - Get dashboard metrics, wins, and alerts
 *
 * Returns verified GSC data with deltas vs previous period.
 * Per D-01 (trust hierarchy): Only shows verified GSC data.
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
import { DashboardService } from "@/server/features/portal/services/DashboardService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "portal/dashboard" });

export const Route = createFileRoute("/api/portal/dashboard/$clientId")({
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

          // Step 2: Verify clientId matches token (T-90-08: prevent cross-client access)
          const clientVerification = verifyClientIdMatch(authResult, clientId);
          if (!clientVerification.success) {
            return portalAuthErrorResponse(clientVerification);
          }

          // Step 3: Check rate limit (60 req/min per clientId)
          const rateLimitResult = await portalStandardRateLimiter(clientId);
          if (!rateLimitResult.allowed) {
            log.warn("Portal dashboard rate limit exceeded", {
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

          // Step 5: Fetch dashboard data
          const [metrics, recentWins, needsAttention] = await Promise.all([
            DashboardService.getDashboardMetrics(clientId),
            DashboardService.getRecentWins(clientId, 7),
            DashboardService.getNeedsAttention(clientId, 5),
          ]);

          // Step 6: Build raw response data
          const rawData = {
            metrics: {
              clicks: metrics.clicks,
              impressions: metrics.impressions,
              avgPosition: metrics.avgPosition,
              ctr: metrics.ctr,
              top10Count: metrics.top10Count,
              deltas: {
                clicks: metrics.clicksDelta,
                impressions: metrics.impressionsDelta,
                avgPosition: metrics.positionDelta,
                top10Count: 0, // Not tracked in current implementation
              },
            },
            recentWins: recentWins.map((win) => ({
              keyword: win.keyword,
              position: win.currentPosition,
              previousPosition: win.previousPosition,
              clicks: win.clicks,
              impressions: win.impressions,
              date: new Date().toISOString().split("T")[0],
            })),
            needsAttention: needsAttention.map((item) => ({
              keyword: item.keyword,
              position: item.currentPosition,
              previousPosition: item.previousPosition,
              dropAmount: item.positionDrop,
              clicks: item.clicks,
              impressions: item.impressions,
            })),
            // P96 widgets - summary data from analytics services
            analyticsWidgets: {
              trendsAvailable: visibility.canViewGrowing || visibility.canViewDecaying,
              cannibalizationAvailable: visibility.canViewCannibalization,
              exportEnabled: visibility.canExport,
            },
            lastUpdated: new Date().toISOString(),
          };

          // Step 7: Apply visibility filtering to response
          const filteredData = visibilityService.filterByVisibility(
            rawData,
            visibility
          );

          log.debug("Dashboard data retrieved", {
            clientId,
            workspaceId: authResult.data.workspaceId,
            metrics: {
              clicks: metrics.clicks,
              wins: recentWins.length,
              alerts: needsAttention.length,
            },
          });

          // Step 8: Build response with rate limit headers
          const response = Response.json({
            success: true,
            data: filteredData,
          });

          return addRateLimitHeaders(response, rateLimitResult);
        } catch (error) {
          log.error(
            "Dashboard API error",
            error instanceof Error ? error : undefined,
            { clientId: params.clientId }
          );
          return Response.json(
            { success: false, error: "Failed to fetch dashboard data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
