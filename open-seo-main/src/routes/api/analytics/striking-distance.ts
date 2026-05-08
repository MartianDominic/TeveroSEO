/**
 * Striking Distance API Route
 * Phase 96-03: GET /api/analytics/striking-distance
 * Returns positions 11-20 opportunities with CTR potential
 * Rate limited: 60 requests per minute per workspace (standard analytics).
 */
import { createFileRoute } from "@tanstack/react-router";
import { getStrikingDistanceService } from "@/server/features/analytics/services/StrikingDistanceService";
import {
  authenticateAnalyticsRequest,
  verifySiteOwnership,
  siteNotFoundResponse,
} from "@/server/features/analytics/auth/analytics-auth";
import {
  analyticsStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";
import { validationErrorResponse } from "@/server/lib/api-response";
import { z } from "zod";

const querySchema = z.object({
  siteId: z.string().uuid(),
  minPosition: z.coerce.number().min(1).max(100).optional(),
  maxPosition: z.coerce.number().min(1).max(100).optional(),
  minImpressions: z.coerce.number().min(0).optional(),
  targetPosition: z.coerce.number().min(1).max(10).optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
});

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/striking-distance")({
  loader: async ({ request }: any) => {
    // Authenticate request and get verified workspace context
    const auth = await authenticateAnalyticsRequest(request);

    // Rate limit check: 60 requests per minute per workspace (standard analytics)
    const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
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

    const service = getStrikingDistanceService();
    const result = await service.getStrikingDistancePages(parsed.data.siteId, {
      minPosition: parsed.data.minPosition,
      maxPosition: parsed.data.maxPosition,
      minImpressions: parsed.data.minImpressions,
      targetPosition: parsed.data.targetPosition,
      limit: parsed.data.limit,
    });

    const response = Response.json({ success: true, data: result });
    return addRateLimitHeaders(response, rateLimitResult);
  },
});
