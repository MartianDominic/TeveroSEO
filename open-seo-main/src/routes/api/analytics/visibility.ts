/**
 * Client Visibility API Route
 * Phase 96-05: GET/PUT /api/analytics/visibility/:clientId
 *
 * Manages per-client visibility configuration for the client portal.
 * Rate limited: 60 requests per minute per workspace (standard analytics).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getClientVisibilityService } from "@/server/features/analytics/services/ClientVisibilityService";
import { authenticateAnalyticsRequest } from "@/server/features/analytics/auth/analytics-auth";
import {
  analyticsStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";

const visibilitySchema = z.object({
  showClicks: z.boolean().optional(),
  showImpressions: z.boolean().optional(),
  showPosition: z.boolean().optional(),
  showCtr: z.boolean().optional(),
  showQueries: z.boolean().optional(),
  showPages: z.boolean().optional(),
  showCompetitors: z.boolean().optional(),
  canViewGrowing: z.boolean().optional(),
  canViewDecaying: z.boolean().optional(),
  canViewCannibalization: z.boolean().optional(),
  canExport: z.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/visibility/$clientId")({
  // GET - Fetch visibility config for client
  loader: async ({ params, request }: any) => {
    try {
      const { clientId } = params;

      // Authenticate request and get verified workspace context
      const auth = await authenticateAnalyticsRequest(request);

      // Rate limit check: 60 requests per minute per workspace (standard analytics)
      const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
      if (!rateLimitResult.allowed) {
        return rateLimitExceededResponse(rateLimitResult);
      }

      const service = await getClientVisibilityService();

      // Validate workspace owns this client
      const hasAccess = await service.validateWorkspaceAccess(clientId, auth.workspaceId);
      if (!hasAccess) {
        return Response.json(
          { success: false, error: "ACCESS_DENIED", message: "Client not in your workspace" },
          { status: 403 }
        );
      }

      const config = await service.getVisibilityConfig(clientId, auth.workspaceId);

      const response = Response.json({ success: true, data: config });
      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[visibility] GET error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});

// PUT handler for updating visibility config
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PUT = async (request: Request, { params }: { params: { clientId: string } }) => {
  try {
    const { clientId } = params;

    // Authenticate request and get verified workspace context
    const auth = await authenticateAnalyticsRequest(request);

    // Rate limit check: 60 requests per minute per workspace (standard analytics)
    const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
    if (!rateLimitResult.allowed) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    const body = await request.json();
    const parsed = visibilitySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const service = await getClientVisibilityService();

    // Validate workspace owns this client
    const hasAccess = await service.validateWorkspaceAccess(clientId, auth.workspaceId);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "ACCESS_DENIED", message: "Client not in your workspace" },
        { status: 403 }
      );
    }

    const config = await service.updateVisibilityConfig(clientId, auth.workspaceId, parsed.data);

    const response = Response.json({ success: true, data: config });
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error("[visibility] PUT error:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
};
