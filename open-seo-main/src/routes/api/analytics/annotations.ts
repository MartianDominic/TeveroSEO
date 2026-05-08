/**
 * Annotations API Route
 * Phase 96-03: GET/POST /api/analytics/annotations
 * Timeline annotations management
 * Rate limited: 60 requests per minute per workspace (standard analytics).
 * CSRF protected: POST/PUT/DELETE require valid CSRF token.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AnnotationsRepository } from "@/server/features/analytics/repositories/AnnotationsRepository";
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
import { csrfProtect } from "@/server/middleware/csrf";
import { z } from "zod";
import { db } from "@/db";

const getQuerySchema = z.object({
  siteId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  types: z.string().optional(), // Comma-separated
  includeGlobal: z.coerce.boolean().optional(),
});

const postBodySchema = z.object({
  siteId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  impact: z.enum(['positive', 'negative', 'neutral']),
});

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/annotations")({
  loader: async ({ request }: any) => {
    // Authenticate request and get verified workspace context
    const auth = await authenticateAnalyticsRequest(request);

    // Rate limit check: 60 requests per minute per workspace (standard analytics)
    const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
    if (!rateLimitResult.allowed) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const params = Object.fromEntries(url.searchParams);

      const parsed = getQuerySchema.safeParse(params);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      // If siteId provided, verify ownership
      if (parsed.data.siteId) {
        const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
        if (!siteVerified) {
          return siteNotFoundResponse();
        }
      }

      const repo = new AnnotationsRepository(db);
      const annotations = await repo.findByFilters(auth.workspaceId, {
        siteId: parsed.data.siteId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        types: parsed.data.types?.split(',').filter(Boolean) as any,
        includeGlobal: parsed.data.includeGlobal ?? true,
      });

      const response = Response.json({ success: true, data: annotations });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    if (request.method === 'POST') {
      // CSRF protection for state-changing request
      const csrfError = csrfProtect(request);
      if (csrfError) return csrfError;

      const body = await request.json();
      const parsed = postBodySchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid body", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      // Verify site ownership
      const siteVerified = await verifySiteOwnership(parsed.data.siteId, auth.workspaceId);
      if (!siteVerified) {
        return siteNotFoundResponse();
      }

      const repo = new AnnotationsRepository(db);
      const annotation = await repo.createCustom(auth.workspaceId, parsed.data.siteId, {
        date: new Date(parsed.data.date),
        title: parsed.data.title,
        description: parsed.data.description,
        impact: parsed.data.impact,
        createdBy: auth.userId,
      });

      const response = Response.json({ success: true, data: annotation }, { status: 201 });
      return addRateLimitHeaders(response, rateLimitResult);
    }

    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  },
});
