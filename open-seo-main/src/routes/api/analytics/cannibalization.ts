/**
 * Cannibalization API Route
 * Phase 96-03: GET /api/analytics/cannibalization
 * Detects keyword cannibalization using GSC data analysis
 * Rate limited: 30 requests per minute per workspace (expensive analytics).
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateAnalyticsRequest,
  getClientIdFromSite,
  siteNotFoundResponse,
} from "@/server/features/analytics/auth/analytics-auth";
import { getCannibalizationService } from "@/server/features/analytics";
import {
  analyticsExpensiveRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";
import { z } from "zod";

const querySchema = z.object({
  siteId: z.string().uuid(),
  query: z.string().optional(), // If provided, get details for specific query
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minImpressions: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  summaryOnly: z.coerce.boolean().optional(), // If true, only return severity breakdown
});

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/cannibalization")({
  loader: async ({ request }: any) => {
    // Authenticate request and get verified workspace context
    const auth = await authenticateAnalyticsRequest(request);

    // Rate limit check: 30 requests per minute per workspace (expensive analytics)
    const rateLimitResult = await analyticsExpensiveRateLimiter(auth.workspaceId);
    if (!rateLimitResult.allowed) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);

    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Invalid parameters", details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) },
        { status: 400 }
      );
    }

    // Get clientId from siteId with workspace verification
    const clientId = await getClientIdFromSite(parsed.data.siteId, auth.workspaceId);
    if (!clientId) {
      return siteNotFoundResponse();
    }

    const service = getCannibalizationService();
    const { siteId, query, startDate, endDate, minImpressions, limit, summaryOnly } = parsed.data;

    // Use the unified detect() method with appropriate options
    const detectionResult = await service.detect(siteId, {
      startDate,
      endDate,
      minImpressions,
      limit: summaryOnly ? 1000 : limit, // Use higher limit for summary-only mode
      mode: 'stored',
      persist: false,
    });

    // Summary-only mode: just return severity breakdown
    if (summaryOnly) {
      const response = Response.json({
        success: true,
        data: {
          summary: {
            total: detectionResult.summary.total,
            high: detectionResult.summary.bySeverity.high,
            medium: detectionResult.summary.bySeverity.medium,
            low: detectionResult.summary.bySeverity.low,
            critical: detectionResult.summary.bySeverity.critical,
          },
        },
      });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    // Specific query mode: filter results for the specific query
    if (query) {
      const matchingIssue = detectionResult.issues.find(
        issue => issue.query.toLowerCase() === query.toLowerCase()
      );
      if (!matchingIssue) {
        const response = Response.json({
          success: true,
          data: {
            issue: null,
            message: "No cannibalization detected for this query",
          },
        });
        return addRateLimitHeaders(response, rateLimitResult);
      }
      const response = Response.json({
        success: true,
        data: {
          issue: {
            query: matchingIssue.query,
            pages: matchingIssue.pages,
            severity: matchingIssue.severity,
            impactEstimate: matchingIssue.impactEstimate.dailyLostClicks,
            recommendation: matchingIssue.recommendation.rationale,
          },
        },
      });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    // Default mode: return all cannibalization issues
    const issues = detectionResult.issues.map(issue => ({
      query: issue.query,
      pages: issue.pages,
      severity: issue.severity,
      impactEstimate: issue.impactEstimate.dailyLostClicks,
      recommendation: issue.recommendation.rationale,
    }));

    const response = Response.json({
      success: true,
      data: {
        issues,
        summary: {
          total: detectionResult.summary.total,
          high: detectionResult.summary.bySeverity.high,
          medium: detectionResult.summary.bySeverity.medium,
          low: detectionResult.summary.bySeverity.low,
          totalImpactEstimate: detectionResult.summary.totalMonthlyImpact,
        },
      },
    });
    return addRateLimitHeaders(response, rateLimitResult);
  },
});
