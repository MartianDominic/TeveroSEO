/**
 * Dashboard API Route
 * Phase 90-02: Client Portal API Routes
 *
 * GET /api/portal/dashboard/:clientId - Get dashboard metrics, wins, and alerts
 *
 * Returns verified GSC data with deltas vs previous period.
 * Per D-01 (trust hierarchy): Only shows verified GSC data.
 */
import { createFileRoute } from "@tanstack/react-router";
import { portalTokenService } from "@/server/services/PortalTokenService";
import { DashboardService } from "@/server/features/portal/services/DashboardService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "portal/dashboard" });

/**
 * Extract token from Authorization header or query param.
 */
function extractToken(request: Request, query: URLSearchParams): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Fall back to query param
  return query.get("token");
}

// @ts-expect-error - Route not in FileRoutesByPath until generated
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

          // Verify clientId matches token (T-90-08: prevent cross-client access)
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

          // Fetch dashboard data
          const [metrics, recentWins, needsAttention] = await Promise.all([
            DashboardService.getDashboardMetrics(clientId),
            DashboardService.getRecentWins(clientId, 7),
            DashboardService.getNeedsAttention(clientId, 5),
          ]);

          // Transform to API response format
          const response = {
            success: true,
            data: {
              metrics: {
                clicks: metrics.clicks,
                impressions: metrics.impressions,
                avgPosition: metrics.avgPosition,
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
                date: new Date().toISOString().split("T")[0], // Current date as proxy
              })),
              needsAttention: needsAttention.map((item) => ({
                keyword: item.keyword,
                position: item.currentPosition,
                previousPosition: item.previousPosition,
                dropAmount: item.positionDrop,
              })),
              lastUpdated: new Date().toISOString(),
            },
          };

          log.debug("Dashboard data retrieved", {
            clientId,
            metrics: {
              clicks: metrics.clicks,
              wins: recentWins.length,
              alerts: needsAttention.length,
            },
          });

          return Response.json(response);
        } catch (error) {
          log.error("Dashboard API error", {
            error: error instanceof Error ? error.message : String(error),
            clientId: params.clientId,
          });
          return Response.json(
            { success: false, error: "Failed to fetch dashboard data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
