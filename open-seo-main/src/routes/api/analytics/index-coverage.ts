/**
 * Index Coverage API Route
 * Phase 96-04: URL Inspection + Index Coverage
 *
 * GET /api/analytics/index-coverage - Get coverage stats
 * GET /api/analytics/index-coverage/quota - Get quota usage
 * POST /api/analytics/index-coverage/inspect - Inspect single URL
 * POST /api/analytics/index-coverage/batch-inspect - Batch inspect URLs (rate limited: 100/hour)
 * POST /api/analytics/index-coverage/request-indexing - Request indexing
 */
import { createFileRoute } from "@tanstack/react-router";
import { IndexCoverageService } from "@/server/features/analytics/services/IndexCoverageService";
import {
  authenticateAnalyticsRequest,
  verifySiteOwnership,
  siteNotFoundResponse,
} from "@/server/features/analytics/auth/analytics-auth";
import { z } from "zod";
import {
  analyticsBatchRateLimiter,
  analyticsStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware";

const statsQuerySchema = z.object({
  siteId: z.string(),
});

const inspectBodySchema = z.object({
  siteId: z.string(),
  siteUrl: z.string().url(),
  pageUrl: z.string().url(),
});

const batchInspectBodySchema = z.object({
  siteId: z.string(),
  siteUrl: z.string().url(),
  urls: z.array(z.string().url()).min(1).max(100),
});

const requestIndexingBodySchema = z.object({
  siteId: z.string(),
  pageUrl: z.string().url(),
  requestType: z.enum(["URL_UPDATED", "URL_DELETED"]),
});

const priorityQuerySchema = z.object({
  siteId: z.string(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

async function getGscAccessToken(_siteId: string): Promise<string | null> {
  // TODO: Retrieve from OAuth tokens stored for this site
  return null;
}

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/index-coverage")({
  loader: async ({ request }: any) => {
    // Authenticate request and get verified workspace context
    const auth = await authenticateAnalyticsRequest(request);

    const url = new URL(request.url);
    const method = request.method;

    const service = new IndexCoverageService();

    // GET - Stats, quota, or priority URLs
    if (method === "GET") {
      const params = Object.fromEntries(url.searchParams);

      // Quota usage
      if (url.pathname.endsWith("/quota")) {
        const parsed = statsQuerySchema.safeParse(params);
        if (!parsed.success) {
          return Response.json(
            { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
        if (!siteVerified) {
          return siteNotFoundResponse();
        }

        const quota = await service.getQuota(parsed.data.siteId);
        return Response.json({ success: true, data: quota });
      }

      // Priority URLs for inspection
      if (url.pathname.endsWith("/priority")) {
        const parsed = priorityQuerySchema.safeParse(params);
        if (!parsed.success) {
          return Response.json(
            { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
        if (!siteVerified) {
          return siteNotFoundResponse();
        }

        const priority = await service.getPriorityUrls(
          parsed.data.siteId,
          parsed.data.limit || 100
        );
        return Response.json({ success: true, data: priority });
      }

      // Coverage stats
      const parsed = statsQuerySchema.safeParse(params);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
      if (!siteVerified) {
        return siteNotFoundResponse();
      }

      const stats = await service.getIndexCoverageStats(parsed.data.siteId);
      return Response.json({ success: true, data: stats });
    }

    // POST - Inspect, batch inspect, or request indexing
    if (method === "POST") {
      const body = await request.json();

      // Single URL inspection
      if (url.pathname.endsWith("/inspect")) {
        const parsed = inspectBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
        if (!siteVerified) {
          return siteNotFoundResponse();
        }

        // Get GSC access token
        const accessToken = await getGscAccessToken(parsed.data.siteId);
        if (!accessToken) {
          return Response.json(
            { success: false, error: "GSC not connected. Please connect Google Search Console." },
            { status: 403 }
          );
        }

        service.setAccessToken(accessToken);

        try {
          const result = await service.inspectUrl(
            parsed.data.siteId,
            parsed.data.siteUrl,
            parsed.data.pageUrl
          );
          return Response.json({ success: true, data: result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Inspection failed";
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      }

      // Batch inspection - rate limited: 100 batch ops per hour per workspace
      if (url.pathname.endsWith("/batch-inspect")) {
        // Rate limit check for batch operations
        const rateLimitResult = await analyticsBatchRateLimiter(auth.workspaceId);
        if (!rateLimitResult.allowed) {
          return rateLimitExceededResponse(rateLimitResult);
        }

        const parsed = batchInspectBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
        if (!siteVerified) {
          return siteNotFoundResponse();
        }

        const accessToken = await getGscAccessToken(parsed.data.siteId);
        if (!accessToken) {
          return Response.json(
            { success: false, error: "GSC not connected. Please connect Google Search Console." },
            { status: 403 }
          );
        }

        service.setAccessToken(accessToken);

        const result = await service.batchInspect(
          parsed.data.siteId,
          parsed.data.siteUrl,
          parsed.data.urls
        );
        const response = Response.json({ success: true, data: result });
        return addRateLimitHeaders(response, rateLimitResult);
      }

      // Request indexing
      if (url.pathname.endsWith("/request-indexing")) {
        const parsed = requestIndexingBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
        if (!siteVerified) {
          return siteNotFoundResponse();
        }

        const accessToken = await getGscAccessToken(parsed.data.siteId);
        if (!accessToken) {
          return Response.json(
            { success: false, error: "GSC not connected. Please connect Google Search Console." },
            { status: 403 }
          );
        }

        service.setAccessToken(accessToken);

        const result = await service.requestIndexing(
          parsed.data.siteId,
          parsed.data.pageUrl,
          parsed.data.requestType
        );
        return Response.json({ success: true, data: result });
      }

      return Response.json({ success: false, error: "Invalid POST target" }, { status: 400 });
    }

    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  },
});
