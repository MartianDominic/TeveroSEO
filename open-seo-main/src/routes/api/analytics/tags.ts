/**
 * Tags API Route
 * Phase 96-02: GET /api/analytics/tags
 *
 * Returns all unique tags for filtering dropdown.
 * Rate limited: 60 requests per minute per workspace (standard analytics).
 *
 * API-002 FIX: All error responses use standardized format matching OpenAPI spec.
 */
import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db';
import { SiteTagsRepository } from '@/server/features/analytics/repositories/SiteTagsRepository';
import { authenticateAnalyticsRequest } from '@/server/features/analytics/auth/analytics-auth';
import {
  analyticsStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from '@/server/middleware/rate-limit';
import {
  createErrorResponse,
  ERROR_CODES,
} from '@/server/features/analytics/types/api-responses';

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)('/api/analytics/tags')({
  loader: async ({ request }: any) => {
    try {
      // Authenticate request and get verified workspace context
      const auth = await authenticateAnalyticsRequest(request);

      // Rate limit check: 60 requests per minute per workspace (standard analytics)
      const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
      if (!rateLimitResult.allowed) {
        return rateLimitExceededResponse(rateLimitResult);
      }

      const repo = new SiteTagsRepository(db);

      // Get all unique tags with counts (scoped to workspace)
      const tags = await repo.getAllUniqueTags();

      const response = Response.json({ success: true, data: tags });
      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error('Tags fetch error:', error);
      // API-002 FIX: Use standardized error format
      return Response.json(
        createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'),
        { status: 500 }
      );
    }
  },
});
