/**
 * Topic Clusters API Route
 * Phase 96-04: Topic Clusters CRUD + Hub Detection
 *
 * GET /api/analytics/topic-clusters - List clusters with pages (60 req/min)
 * POST /api/analytics/topic-clusters - Create cluster (60 req/min)
 * GET /api/analytics/topic-clusters/detect-hubs - Find potential hub pages (60 req/min)
 * CSRF protected: POST requires valid CSRF token.
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

const listQuerySchema = z.object({
  siteId: z.string(),
});

const createBodySchema = z.object({
  siteId: z.string(),
  name: z.string().min(1).max(100),
  hubPageUrl: z.url(),
  hubTopic: z.string().min(1).max(100),
});

const detectHubsQuerySchema = z.object({
  siteId: z.string(),
  minHubLinks: z.coerce.number().min(1).max(100).optional(),
});

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/topic-clusters")({
  loader: async ({ request }: any) => {
    // Authenticate request and get verified workspace context
    const auth = await authenticateAnalyticsRequest(request);

    // Rate limit check: 60 requests per minute per workspace (standard analytics)
    const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
    if (!rateLimitResult.allowed) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    const url = new URL(request.url);
    const method = request.method;

    const service = new TopicClusterService();

    // GET - List clusters or detect hubs
    if (method === "GET") {
      const params = Object.fromEntries(url.searchParams);

      // Check if this is a detect-hubs request
      if (url.pathname.endsWith("/detect-hubs")) {
        const parsed = detectHubsQuerySchema.safeParse(params);
        if (!parsed.success) {
          return Response.json(
            { success: false, error: "Invalid parameters", details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) },
            { status: 400 }
          );
        }

        const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
        if (!siteVerified) {
          return siteNotFoundResponse();
        }

        const hubs = await service.detectHubPages(parsed.data.siteId, {
          minHubLinks: parsed.data.minHubLinks,
        });
        const response = Response.json({ success: true, data: hubs });
        return addRateLimitHeaders(response, rateLimitResult);
      }

      // Regular list
      const parsed = listQuerySchema.safeParse(params);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid parameters", details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) },
          { status: 400 }
        );
      }

      const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
      if (!siteVerified) {
        return siteNotFoundResponse();
      }

      const clusters = await service.getClusters(parsed.data.siteId);
      const response = Response.json({ success: true, data: clusters });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    // POST - Create cluster
    if (method === "POST") {
      // CSRF protection for state-changing request
      const csrfError = csrfProtect(request);
      if (csrfError) return csrfError;

      const body = await request.json();
      const parsed = createBodySchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid parameters", details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) },
          { status: 400 }
        );
      }

      const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
      if (!siteVerified) {
        return siteNotFoundResponse();
      }

      const cluster = await service.createCluster(parsed.data.siteId, {
        name: parsed.data.name,
        hubPageUrl: parsed.data.hubPageUrl,
        hubTopic: parsed.data.hubTopic,
      });

      const response = Response.json({ success: true, data: cluster }, { status: 201 });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  },
});
