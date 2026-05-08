/**
 * Content Groups API Route
 * Phase 96-04: Content Groups CRUD + Auto-Grouping
 *
 * GET /api/analytics/content-groups - List groups with metrics (60 req/min)
 * POST /api/analytics/content-groups - Create group (60 req/min)
 * POST /api/analytics/content-groups/auto-generate - Auto-generate from folders (60 req/min)
 * CSRF protected: POST requires valid CSRF token.
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
import { validationErrorResponse } from "@/server/lib/api-response";

const listQuerySchema = z.object({
  siteId: z.string(),
});

const createBodySchema = z.object({
  siteId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  matchType: z.enum(["folder", "regex", "manual"]),
  matchPattern: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const autoGenerateBodySchema = z.object({
  siteId: z.string(),
});

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/content-groups")({
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

    const service = new ContentGroupService();

    // GET - List groups
    if (method === "GET") {
      const params = Object.fromEntries(url.searchParams);
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

      const groups = await service.getGroups(parsed.data.siteId);
      const response = Response.json({ success: true, data: groups });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    // POST - Create group or auto-generate
    if (method === "POST") {
      // CSRF protection for state-changing request
      const csrfError = csrfProtect(request);
      if (csrfError) return csrfError;

      const body = await request.json();

      // Check if this is an auto-generate request
      if (url.pathname.endsWith("/auto-generate")) {
        const parsed = autoGenerateBodySchema.safeParse(body);
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

        const result = await service.autoGenerateGroups(parsed.data.siteId);
        const response = Response.json({ success: true, data: result });
        return addRateLimitHeaders(response, rateLimitResult);
      }

      // Regular create
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

      const group = await service.createGroup(parsed.data.siteId, {
        name: parsed.data.name,
        description: parsed.data.description,
        matchType: parsed.data.matchType,
        matchPattern: parsed.data.matchPattern,
        color: parsed.data.color,
      });

      const response = Response.json({ success: true, data: group }, { status: 201 });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  },
});
