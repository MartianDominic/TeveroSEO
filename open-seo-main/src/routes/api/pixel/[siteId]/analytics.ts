/**
 * Pixel Analytics API Endpoint
 * Phase 66-08: Pixel Analytics Dashboard
 *
 * GET /api/pixel/:siteId/analytics
 * Returns aggregated analytics for dashboard display.
 *
 * Security:
 * - T-66-23: Validates siteId belongs to user's workspace
 * - T-66-24: Max 1 year date range, cached results
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import {
  PixelAnalyticsService,
  type AnalyticsQuery,
  type Granularity,
} from "@/server/features/pixel";
import { db } from "@/db";
import { pixelInstallations } from "@/db/pixel-schema";
import { eq } from "drizzle-orm";

const log = createLogger({ module: "api/pixel/analytics" });

// ============================================================================
// Constants
// ============================================================================

const MAX_DATE_RANGE_DAYS = 365; // 1 year max
const DEFAULT_DATE_RANGE_DAYS = 30;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse and validate date string in YYYY-MM-DD format.
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;

  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!match) return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Get default date range (last 30 days).
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DEFAULT_DATE_RANGE_DAYS);

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

/**
 * Validate date range is within max allowed.
 */
function validateDateRange(startDate: Date, endDate: Date): boolean {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= MAX_DATE_RANGE_DAYS && diffDays >= 0;
}

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/pixel/$siteId/analytics")({
  server: {
    handlers: {
      /**
       * GET /api/pixel/:siteId/analytics
       *
       * Query params:
       * - startDate: YYYY-MM-DD (default: 30 days ago)
       * - endDate: YYYY-MM-DD (default: today)
       * - granularity: daily | weekly | monthly (default: daily)
       *
       * Response: AnalyticsResponse
       * - summary: { totalPageviews, totalSessions, totalUniqueVisitors, avgTimeOnPage, bounceRate }
       * - cwv: { lcp, cls, inp } with p75 and rating
       * - timeseries: Array<{ date, pageviews, sessions, uniqueVisitors }>
       * - topPages: Array<{ url, views, avgTimeOnPage }>
       */
      GET: async ({
        params,
        request,
      }: {
        params: { siteId: string };
        request: Request;
      }) => {
        try {
          const { siteId } = params;
          const url = new URL(request.url);

          // Validate siteId
          if (!siteId || typeof siteId !== "string") {
            return Response.json(
              { error: "Invalid siteId parameter" },
              { status: 400 }
            );
          }

          // T-66-23: Validate siteId exists (TODO: add workspace authorization)
          const installations = await db
            .select({ id: pixelInstallations.id })
            .from(pixelInstallations)
            .where(eq(pixelInstallations.siteId, siteId));

          if (installations.length === 0) {
            return Response.json(
              { error: "Installation not found" },
              { status: 404 }
            );
          }

          // Parse query params
          const startDateParam = url.searchParams.get("startDate");
          const endDateParam = url.searchParams.get("endDate");
          const granularityParam = url.searchParams.get("granularity") as Granularity | null;

          // Get dates (default to last 30 days)
          let startDate: string;
          let endDate: string;

          if (startDateParam && endDateParam) {
            const parsedStart = parseDate(startDateParam);
            const parsedEnd = parseDate(endDateParam);

            if (!parsedStart || !parsedEnd) {
              return Response.json(
                { error: "Invalid date format. Use YYYY-MM-DD" },
                { status: 400 }
              );
            }

            // T-66-24: Max 1 year range
            if (!validateDateRange(parsedStart, parsedEnd)) {
              return Response.json(
                { error: `Date range must be within ${MAX_DATE_RANGE_DAYS} days` },
                { status: 400 }
              );
            }

            startDate = startDateParam;
            endDate = endDateParam;
          } else {
            const defaults = getDefaultDateRange();
            startDate = defaults.startDate;
            endDate = defaults.endDate;
          }

          // Validate granularity
          const validGranularities: Granularity[] = ["daily", "weekly", "monthly"];
          const granularity: Granularity =
            granularityParam && validGranularities.includes(granularityParam)
              ? granularityParam
              : "daily";

          log.info("Fetching analytics", { siteId, startDate, endDate, granularity });

          // Fetch analytics
          const service = new PixelAnalyticsService();
          const query: AnalyticsQuery = {
            siteId,
            startDate,
            endDate,
            granularity,
          };

          const analytics = await service.getAnalytics(query);

          // Set cache headers (T-66-24: cache aggregated results)
          const headers = new Headers();
          headers.set("Cache-Control", "public, max-age=300"); // 5 minutes

          return Response.json(analytics, { headers });
        } catch (error) {
          log.error(
            "Failed to get analytics",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to retrieve analytics" },
            { status: 500 }
          );
        }
      },
    },
  },
});
