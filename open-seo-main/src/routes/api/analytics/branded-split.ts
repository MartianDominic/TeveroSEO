/**
 * Branded Split API Route
 * Phase 96-05: GET /api/analytics/branded-split/:clientId
 *
 * Returns branded vs non-branded keyword split for a client.
 * Supports brand term management (add/remove).
 * Rate limited: 60 requests per minute per workspace (standard analytics).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { getBrandedKeywordService } from "@/server/features/analytics/services/BrandedKeywordService";
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

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/branded-split/$clientId")({
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

      // Parse date range from URL
      const url = new URL(request.url);
      const params2 = Object.fromEntries(url.searchParams);
      const parsed = dateRangeSchema.safeParse(params2);

      const startDate = parsed.data?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const endDate = parsed.data?.endDate || new Date().toISOString().split("T")[0];

      // Get brand terms
      const brandService = await getBrandedKeywordService();
      const brandTerms = await brandService.getBrandTerms(clientId);
      const termStrings = brandTerms.map((t) => t.term);

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
            branded: [],
            nonBranded: [],
            brandedPercent: 0,
            nonBrandedPercent: 0,
            brandTerms,
          },
        });
      }

      // Fetch query metrics
      const queryMetrics = await db
        .select({
          query: seoGscQueryAnalytics.query,
          clicks: sql<number>`SUM(${seoGscQueryAnalytics.clicks})`,
          impressions: sql<number>`SUM(${seoGscQueryAnalytics.impressions})`,
        })
        .from(seoGscQueryAnalytics)
        .where(
          and(
            eq(seoGscQueryAnalytics.siteId, connection[0].siteId),
            gte(seoGscQueryAnalytics.queryTime, new Date(startDate)),
            lte(seoGscQueryAnalytics.queryTime, new Date(endDate))
          )
        )
        .groupBy(seoGscQueryAnalytics.query);

      // Split by branded/non-branded
      const split = brandService.splitMetricsByBranded(
        queryMetrics.map((m) => ({
          query: m.query,
          clicks: Number(m.clicks),
          impressions: Number(m.impressions),
        })),
        termStrings
      );

      // Apply visibility filtering
      const visibilityConfig = await visibilityService.getVisibilityConfig(clientId, auth.workspaceId);

      // Filter response based on visibility
      const responseData: Record<string, unknown> = {
        brandedPercent: split.brandedPercent,
        nonBrandedPercent: split.nonBrandedPercent,
        brandTerms,
      };

      if (visibilityConfig.showQueries) {
        responseData.branded = split.branded;
        responseData.nonBranded = split.nonBranded;
      } else {
        // Only show aggregates, not individual queries
        responseData.brandedClicks = split.branded.reduce((sum, m) => sum + m.clicks, 0);
        responseData.nonBrandedClicks = split.nonBranded.reduce((sum, m) => sum + m.clicks, 0);
        responseData.brandedImpressions = split.branded.reduce((sum, m) => sum + m.impressions, 0);
        responseData.nonBrandedImpressions = split.nonBranded.reduce((sum, m) => sum + m.impressions, 0);
      }

      const response = Response.json({ success: true, data: responseData });
      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[branded-split] GET error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});

// POST handler for adding brand term
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = async (request: Request, { params }: { params: { clientId: string } }) => {
  try {
    const { clientId } = params;

    // Authenticate request and get verified workspace context
    const auth = await authenticateAnalyticsRequest(request);

    // Rate limit check: 60 requests per minute per workspace (standard analytics)
    const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
    if (!rateLimitResult.allowed) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    const body = await request.json() as { term?: string };
    const term = body.term?.trim();

    if (!term) {
      return Response.json(
        { success: false, error: "Brand term required" },
        { status: 400 }
      );
    }

    // Validate workspace access
    const visibilityService = await getClientVisibilityService();
    const hasAccess = await visibilityService.validateWorkspaceAccess(clientId, auth.workspaceId);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "ACCESS_DENIED" },
        { status: 403 }
      );
    }

    const brandService = await getBrandedKeywordService();
    const newTerm = await brandService.addBrandTerm(clientId, term, false);

    const response = Response.json({ success: true, data: newTerm });
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error("[branded-split] POST error:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
};
