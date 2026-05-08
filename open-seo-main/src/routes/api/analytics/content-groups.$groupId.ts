/**
 * Content Group Detail API Route
 * Phase 96-04: Single Group Operations
 *
 * GET /api/analytics/content-groups/:groupId - Get group with metrics (60 req/min)
 * PUT /api/analytics/content-groups/:groupId - Update group (60 req/min)
 * DELETE /api/analytics/content-groups/:groupId - Delete group (60 req/min)
 * POST /api/analytics/content-groups/:groupId/pages - Add page to group (60 req/min)
 * DELETE /api/analytics/content-groups/:groupId/pages/:pageUrl - Remove page (60 req/min)
 * CSRF protected: PUT/POST/DELETE require valid CSRF token.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ContentGroupService } from "@/server/features/analytics/services/ContentGroupService";
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

const updateBodySchema = z.object({
  siteId: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  matchPattern: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const addPageBodySchema = z.object({
  pageUrl: z.string().url(),
});

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/content-groups/$groupId")({
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
    const { groupId } = params;

    const service = new ContentGroupService();

    // GET - Get group with metrics
    if (method === "GET") {
      const siteId = url.searchParams.get("siteId");
      if (!siteId) {
        return Response.json({ success: false, error: "siteId required" }, { status: 400 });
      }

      const siteVerified = await verifySiteOwnership(siteId, auth.workspaceId);
      if (!siteVerified) {
        return siteNotFoundResponse();
      }

      const group = await service.getGroupWithMetrics(groupId, siteId);
      if (!group) {
        return Response.json({ success: false, error: "Group not found" }, { status: 404 });
      }

      const response = Response.json({ success: true, data: group });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    // PUT - Update group
    if (method === "PUT") {
      // CSRF protection for state-changing request
      const csrfError = csrfProtect(request);
      if (csrfError) return csrfError;

      const body = await request.json();
      const parsed = updateBodySchema.safeParse(body);
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

      const group = await service.updateGroup(groupId, parsed.data.siteId, {
        name: parsed.data.name,
        description: parsed.data.description,
        matchPattern: parsed.data.matchPattern,
        color: parsed.data.color,
      });

      if (!group) {
        return Response.json({ success: false, error: "Group not found" }, { status: 404 });
      }

      const response = Response.json({ success: true, data: group });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    // DELETE - Delete group
    if (method === "DELETE") {
      // CSRF protection for state-changing request
      const csrfError = csrfProtect(request);
      if (csrfError) return csrfError;

      const siteId = url.searchParams.get("siteId");
      if (!siteId) {
        return Response.json({ success: false, error: "siteId required" }, { status: 400 });
      }

      const siteVerified = await verifySiteOwnership(siteId, auth.workspaceId);
      if (!siteVerified) {
        return siteNotFoundResponse();
      }

      const deleted = await service.deleteGroup(groupId);
      if (!deleted) {
        return Response.json({ success: false, error: "Group not found" }, { status: 404 });
      }

      const response = Response.json({ success: true, data: { deleted: true } });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    // POST to /pages - Add page to group
    if (method === "POST" && url.pathname.endsWith("/pages")) {
      // CSRF protection for state-changing request
      const csrfError = csrfProtect(request);
      if (csrfError) return csrfError;

      const body = await request.json();
      const siteId = url.searchParams.get("siteId");
      if (!siteId) {
        return Response.json({ success: false, error: "siteId required" }, { status: 400 });
      }

      const parsed = addPageBodySchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const siteVerified = await verifySiteOwnership(siteId, auth.workspaceId);
      if (!siteVerified) {
        return siteNotFoundResponse();
      }

      await service.addPageToGroup(groupId, parsed.data.pageUrl);
      const response = Response.json({ success: true, data: { added: true } }, { status: 201 });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  },
});
