/**
 * Trends API Route
 * Phase 96-03: GET /api/analytics/trends
 * Returns growing/decaying pages with trend analysis
 * Rate limited: 30 requests per minute per workspace (expensive analytics).
 */
import { createFileRoute } from "@tanstack/react-router";
import { getTrendDetectionService } from "@/server/features/analytics/services/TrendDetectionService";
import {
  authenticateAnalyticsRequest,
  verifySiteOwnership,
  siteNotFoundResponse,
} from "@/server/features/analytics/auth/analytics-auth";
import {
  analyticsExpensiveRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";
import { validationErrorResponse } from "@/server/lib/api-response";
import { z } from "zod";

const querySchema = z.object({
  siteId: z.string().uuid(),
  periodDays: z.coerce.number().min(7).max(90).optional(),
  threshold: z.coerce.number().min(0.01).max(1).optional(),
  minImpressions: z.coerce.number().min(0).optional(),
  trend: z.enum(['growing', 'decaying', 'all']).optional(),
  includeTerms: z.string().optional(),  // Comma-separated
  excludeTerms: z.string().optional(),  // Comma-separated
  queryMode: z.enum(['and', 'or']).optional(),
});

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/trends")({
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
      return validationErrorResponse(parsed.error);
    }

    // Verify site belongs to authenticated workspace
    const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
    if (!siteVerified) {
      return siteNotFoundResponse();
    }

    const service = getTrendDetectionService();
    const filters = {
      periodDays: parsed.data.periodDays,
      threshold: parsed.data.threshold,
      minImpressions: parsed.data.minImpressions,
      trend: parsed.data.trend,
      queryFilter: parsed.data.includeTerms || parsed.data.excludeTerms ? {
        include: parsed.data.includeTerms?.split(',').filter(Boolean),
        exclude: parsed.data.excludeTerms?.split(',').filter(Boolean),
        mode: parsed.data.queryMode,
      } : undefined,
    };

    const result = await service.analyzePageTrends(parsed.data.siteId, filters);

    const response = Response.json({ success: true, data: result });
    return addRateLimitHeaders(response, rateLimitResult);
  },
});
