/**
 * Striking Distance API Route
 * Phase 96-03: GET /api/analytics/striking-distance
 * Returns positions 11-20 opportunities with CTR potential
 */
import { createFileRoute } from "@tanstack/react-router";
import { getStrikingDistanceService } from "@/server/features/analytics/services/StrikingDistanceService";
import { z } from "zod";

const querySchema = z.object({
  siteId: z.string().uuid(),
  minPosition: z.coerce.number().min(1).max(100).optional(),
  maxPosition: z.coerce.number().min(1).max(100).optional(),
  minImpressions: z.coerce.number().min(0).optional(),
  targetPosition: z.coerce.number().min(1).max(10).optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
});

// Placeholder auth helpers
async function getWorkspaceIdFromRequest(_request: Request): Promise<string | null> {
  return 'workspace-placeholder';
}

async function verifySiteOwnership(_siteId: string, _workspaceId: string): Promise<boolean> {
  return true;
}

export const Route = createFileRoute("/api/analytics/striking-distance")({
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

    const workspaceId = await getWorkspaceIdFromRequest(request);
    if (!workspaceId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const siteVerified = await verifySiteOwnership(parsed.data.siteId, workspaceId);
    if (!siteVerified) {
      return Response.json({ success: false, error: "Site not found" }, { status: 404 });
    }

    const service = getStrikingDistanceService();
    const result = await service.getStrikingDistancePages(parsed.data.siteId, {
      minPosition: parsed.data.minPosition,
      maxPosition: parsed.data.maxPosition,
      minImpressions: parsed.data.minImpressions,
      targetPosition: parsed.data.targetPosition,
      limit: parsed.data.limit,
    });

    return Response.json({ success: true, data: result });
  },
});
