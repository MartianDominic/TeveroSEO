/**
 * Pixel CWV Trend API Endpoint
 * Phase 66-08: Pixel Analytics Dashboard
 *
 * GET /api/pixel/:siteId/analytics/cwv
 * Returns Core Web Vitals trend for charting.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { PixelAnalyticsService } from "@/server/features/pixel";
import { db } from "@/db";
import { pixelInstallations } from "@/db/pixel-schema";
import { eq } from "drizzle-orm";

const log = createLogger({ module: "api/pixel/analytics/cwv" });

// ============================================================================
// Constants
// ============================================================================

const MAX_DATE_RANGE_DAYS = 365;
const DEFAULT_DATE_RANGE_DAYS = 30;

// ============================================================================
// Helpers
// ============================================================================

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DEFAULT_DATE_RANGE_DAYS);
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

function validateDateRange(startDate: Date, endDate: Date): boolean {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= MAX_DATE_RANGE_DAYS && diffDays >= 0;
}

// ============================================================================
// Route Handler
// ============================================================================

export const Route = createFileRoute("/api/pixel/siteId/analytics/cwv")({
  server: {
    handlers: {
      /**
       * GET /api/pixel/:siteId/analytics/cwv
       *
       * Query params:
       * - startDate: YYYY-MM-DD (default: 30 days ago)
       * - endDate: YYYY-MM-DD (default: today)
       *
       * Response: Array<{ date, lcp, cls, inp }>
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

          if (!siteId || typeof siteId !== "string") {
            return Response.json(
              { error: "Invalid siteId parameter" },
              { status: 400 }
            );
          }

          // Validate siteId exists
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

          log.info("Fetching CWV trend", { siteId, startDate, endDate });

          const service = new PixelAnalyticsService();
          const trend = await service.getCwvTrend(siteId, startDate, endDate);

          const headers = new Headers();
          headers.set("Cache-Control", "public, max-age=300");

          return Response.json(trend, { headers });
        } catch (error) {
          log.error(
            "Failed to get CWV trend",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Failed to retrieve CWV trend" },
            { status: 500 }
          );
        }
      },
    },
  },
});
