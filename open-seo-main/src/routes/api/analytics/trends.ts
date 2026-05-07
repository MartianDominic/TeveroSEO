/**
 * Trends API Route
 * Phase 96-03: GET /api/analytics/trends
 * Returns growing/decaying pages with trend analysis
 */
import { createFileRoute } from "@tanstack/react-router";
import { getTrendDetectionService } from "@/server/features/analytics/services/TrendDetectionService";
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

// Placeholder auth helpers (would be in @/server/lib/auth in real implementation)
async function getWorkspaceIdFromRequest(_request: Request): Promise<string | null> {
  // TODO: Extract from session/JWT
  return 'workspace-placeholder';
}

async function verifySiteOwnership(_siteId: string, _workspaceId: string): Promise<boolean> {
  // TODO: Query database to verify site belongs to workspace
  return true;
}

export const Route = createFileRoute("/api/analytics/trends")({
  loader: async ({ request }) => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);

    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const workspaceId = await getWorkspaceIdFromRequest(request);
    if (!workspaceId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Verify site belongs to workspace
    const siteVerified = await verifySiteOwnership(parsed.data.siteId, workspaceId);
    if (!siteVerified) {
      return Response.json({ success: false, error: "Site not found" }, { status: 404 });
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

    return Response.json({ success: true, data: result });
  },
});
