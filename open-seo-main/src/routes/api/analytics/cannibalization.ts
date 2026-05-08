/**
 * Cannibalization API Route
 * Phase 96-03: GET /api/analytics/cannibalization
 * Detects keyword cannibalization using GSC data analysis
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateAnalyticsRequest,
  getClientIdFromSite,
  siteNotFoundResponse,
} from "@/server/features/analytics/auth/analytics-auth";
import {
  getCannibalizationService,
  getSeverityBreakdown,
} from "@/server/features/analytics";
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

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);

    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
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

    // Summary-only mode: just return severity breakdown
    if (summaryOnly) {
      const breakdown = await getSeverityBreakdown(siteId);
      return Response.json({
        success: true,
        data: {
          summary: breakdown,
        },
      });
    }

    // Specific query mode: get cannibalization details for one query
    if (query) {
      const result = await service.getCannibalizationForQuery(siteId, query);
      if (!result) {
        return Response.json({
          success: true,
          data: {
            issue: null,
            message: "No cannibalization detected for this query",
          },
        });
      }
      return Response.json({
        success: true,
        data: {
          issue: result,
        },
      });
    }

    // Default mode: detect all cannibalization issues
    const issues = await service.detectCannibalization(siteId, {
      startDate,
      endDate,
      minImpressions,
      limit,
    });

    // Calculate summary stats
    const summary = {
      total: issues.length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      totalImpactEstimate: issues.reduce((sum, i) => sum + i.impactEstimate, 0),
    };

    return Response.json({
      success: true,
      data: {
        issues,
        summary,
      },
    });
  },
});
