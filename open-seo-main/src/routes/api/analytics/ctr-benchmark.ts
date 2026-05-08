/**
 * CTR Benchmark API Route
 * Phase 96-05: GET /api/analytics/ctr-benchmark/:clientId
 *
 * Returns CTR comparison against industry benchmarks for client's pages.
 * Rate limited: 60 requests per minute per workspace (standard analytics).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { getCtrBenchmarkService } from "@/server/features/analytics/services/CtrBenchmarkService";
import { getClientVisibilityService } from "@/server/features/analytics/services/ClientVisibilityService";
import { authenticateAnalyticsRequest } from "@/server/features/analytics/auth/analytics-auth";
import { seoGscQueryAnalytics } from "@/db/gsc-analytics-schema";
import { siteConnections } from "@/db/connection-schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  analyticsStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.string().transform(Number).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/ctr-benchmark/$clientId")({
  loader: async ({ params, request }: any) => {
    try {
      const { clientId } = params;

      // Authenticate request and get verified workspace context
      const auth = await authenticateAnalyticsRequest(request);

      // Rate limit check: 60 requests per minute per workspace (standard analytics)
      const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
      if (!rateLimitResult.allowed) {
        return rateLimitExceededResponse(rateLimitResult);
      }

      // Validate workspace access
      const visibilityService = await getClientVisibilityService();
      const hasAccess = await visibilityService.validateWorkspaceAccess(clientId, auth.workspaceId);
      if (!hasAccess) {
        return Response.json(
          { success: false, error: "ACCESS_DENIED", message: "Client not in your workspace" },
          { status: 403 }
        );
      }

      // Parse query parameters
      const url = new URL(request.url);
      const params2 = Object.fromEntries(url.searchParams);
      const parsed = querySchema.safeParse(params2);

      const startDate = parsed.data?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const endDate = parsed.data?.endDate || new Date().toISOString().split("T")[0];
      const limit = parsed.data?.limit || 100;

      // Get client's site connection
      const connection = await db
        .select({ siteId: siteConnections.id })
        .from(siteConnections)
        .where(eq(siteConnections.clientId, clientId))
        .limit(1);

      if (!connection[0]?.siteId) {
        return Response.json({
          success: true,
          data: {
            pages: [],
            curve: getCtrBenchmarkService().generateCtrCurve(),
            opportunities: { belowBenchmark: [], atOrAboveBenchmark: [] },
          },
        });
      }

      // Fetch page metrics with aggregated position and CTR
      const pageMetrics = await db
        .select({
          pageUrl: seoGscQueryAnalytics.pageUrl,
          clicks: sql<number>`SUM(${seoGscQueryAnalytics.clicks})`,
          impressions: sql<number>`SUM(${seoGscQueryAnalytics.impressions})`,
          avgPosition: sql<number>`AVG(${seoGscQueryAnalytics.position})`,
        })
        .from(seoGscQueryAnalytics)
        .where(
          and(
            eq(seoGscQueryAnalytics.siteId, connection[0].siteId),
            gte(seoGscQueryAnalytics.queryTime, new Date(startDate)),
            lte(seoGscQueryAnalytics.queryTime, new Date(endDate))
          )
        )
        .groupBy(seoGscQueryAnalytics.pageUrl)
        .orderBy(sql`SUM(${seoGscQueryAnalytics.clicks}) DESC`)
        .limit(limit);

      const ctrService = getCtrBenchmarkService();

      // Calculate CTR and compare to benchmark
      const pages = pageMetrics.map((page) => {
        const clicks = Number(page.clicks);
        const impressions = Number(page.impressions);
        const position = Math.round(Number(page.avgPosition));
        const ctr = impressions > 0 ? clicks / impressions : 0;

        const comparison = ctrService.compareActualToBenchmark(position, ctr);

        return {
          url: page.pageUrl,
          clicks,
          impressions,
          position,
          ctr,
          comparison,
        };
      });

      // Get visibility config and filter response
      const visibilityConfig = await visibilityService.getVisibilityConfig(clientId, auth.workspaceId);

      // Filter pages based on visibility
      const filteredPages = pages.map((page) => {
        const filtered: Record<string, unknown> = {
          url: page.url,
          comparison: page.comparison,
        };

        if (visibilityConfig.showClicks) filtered.clicks = page.clicks;
        if (visibilityConfig.showImpressions) filtered.impressions = page.impressions;
        if (visibilityConfig.showPosition) filtered.position = page.position;
        if (visibilityConfig.showCtr) filtered.ctr = page.ctr;

        return filtered;
      });

      // Analyze opportunities (filter out pages with null URLs)
      const pagesForAnalysis = pages
        .filter((p): p is typeof p & { url: string } => p.url !== null)
        .map((p) => ({
          url: p.url,
          position: p.position,
          ctr: p.ctr,
        }));
      const opportunities = ctrService.analyzePositionOpportunities(pagesForAnalysis);

      // Generate benchmark curve
      const curve = ctrService.generateCtrCurve();

      const response = Response.json({
        success: true,
        data: {
          pages: filteredPages,
          curve,
          opportunities: visibilityConfig.showCtr ? opportunities : undefined,
        },
      });
      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[ctr-benchmark] GET error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});

// GET handler for CTR curve only (no client context needed)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CurveRoute = (createFileRoute as any)("/api/analytics/ctr-curve")({
  loader: async () => {
    const ctrService = getCtrBenchmarkService();
    const curve = ctrService.generateCtrCurve();
    const benchmarks = ctrService.getIndustryBenchmarks();

    return Response.json({
      success: true,
      data: {
        curve,
        benchmarks,
      },
    });
  },
});
