/**
 * Topic Cluster Detail API Route
 * Phase 96-04: Single Cluster Operations
 *
 * GET /api/analytics/topic-clusters/:clusterId - Get cluster with pages (60 req/min)
 * GET /api/analytics/topic-clusters/:clusterId/coverage - Analyze coverage (60 req/min)
 * GET /api/analytics/topic-clusters/:clusterId/gaps - Get content gaps (60 req/min)
 * POST /api/analytics/topic-clusters/:clusterId/spokes - Add spoke page (60 req/min)
 * DELETE /api/analytics/topic-clusters/:clusterId - Delete cluster (60 req/min)
 * CSRF protected: POST/DELETE require valid CSRF token.
 */
import { createFileRoute } from "@tanstack/react-router";
import { TopicClusterService } from "@/server/features/analytics/services/TopicClusterService";
import {
  authenticateAnalyticsRequest,
  verifySiteOwnership,
  siteNotFoundResponse,
} from "@/server/features/analytics/auth/analytics-auth";
import { z } from "zod";
import {
  analyticsStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";
import { csrfProtect } from "@/server/middleware/csrf";

const addSpokeBodySchema = z.object({
  pageUrl: z.string().url(),
  topic: z.string().optional(),
  linksToHub: z.boolean().optional(),
});

const updateGapsBodySchema = z.object({
  gaps: z.array(z.string()),
});

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/topic-clusters/$clusterId")({
  loader: async ({ request, params }: any) => {
    // Authenticate request and get verified workspace context
    const auth = await authenticateAnalyticsRequest(request);

    // Rate limit check: 60 requests per minute per workspace (standard analytics)
    const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
    if (!rateLimitResult.allowed) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    const url = new URL(request.url);
    const method = request.method;
    const { clusterId } = params;

    const service = new TopicClusterService();
    const siteId = url.searchParams.get("siteId");

    if (!siteId) {
      return Response.json({ success: false, error: "siteId required" }, { status: 400 });
    }

    const siteVerified = await verifySiteOwnership(siteId, auth.workspaceId);
    if (!siteVerified) {
      return siteNotFoundResponse();
    }

    // GET - Get cluster, coverage, or gaps
    if (method === "GET") {
      // Coverage analysis
      if (url.pathname.endsWith("/coverage")) {
        const coverage = await service.analyzeClusterCoverage(clusterId, siteId);
        const response = Response.json({ success: true, data: coverage });
        return addRateLimitHeaders(response, rateLimitResult);
      }

      // Gap analysis
      if (url.pathname.endsWith("/gaps")) {
        const gaps = await service.getClusterGaps(clusterId, siteId);
        const response = Response.json({ success: true, data: gaps });
        return addRateLimitHeaders(response, rateLimitResult);
      }

      // Get cluster with pages
      const cluster = await service.getClusterWithPages(clusterId, siteId);
      if (!cluster) {
        return Response.json({ success: false, error: "Cluster not found" }, { status: 404 });
      }

      const response = Response.json({ success: true, data: cluster });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    // POST - Add spoke or update gaps
    if (method === "POST") {
      // CSRF protection for state-changing request
      const csrfError = csrfProtect(request);
      if (csrfError) return csrfError;

      // Add spoke page
      if (url.pathname.endsWith("/spokes")) {
        const body = await request.json();
        const parsed = addSpokeBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        await service.addSpokeToCluster(
          clusterId,
          parsed.data.pageUrl,
          parsed.data.topic || null,
          parsed.data.linksToHub || false
        );

        const response = Response.json({ success: true, data: { added: true } }, { status: 201 });
        return addRateLimitHeaders(response, rateLimitResult);
      }

      // Update gaps
      if (url.pathname.endsWith("/gaps")) {
        const body = await request.json();
        const parsed = updateGapsBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        await service.updateClusterGaps(clusterId, parsed.data.gaps);
        const response = Response.json({ success: true, data: { updated: true } });
        return addRateLimitHeaders(response, rateLimitResult);
      }

      // Refresh metrics
      if (url.pathname.endsWith("/refresh")) {
        await service.updateClusterMetrics(clusterId, siteId);
        const cluster = await service.getClusterWithPages(clusterId, siteId);
        const response = Response.json({ success: true, data: cluster });
        return addRateLimitHeaders(response, rateLimitResult);
      }

      return Response.json({ success: false, error: "Invalid POST target" }, { status: 400 });
    }

    // DELETE - Delete cluster
    if (method === "DELETE") {
      // CSRF protection for state-changing request
      const csrfError = csrfProtect(request);
      if (csrfError) return csrfError;

      const deleted = await service.deleteCluster(clusterId);
      if (!deleted) {
        return Response.json({ success: false, error: "Cluster not found" }, { status: 404 });
      }

      const response = Response.json({ success: true, data: { deleted: true } });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  },
});
