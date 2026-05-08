/**
 * Portfolio Metrics API Route
 * Phase 96-05: GET /api/analytics/portfolio
 *
 * Returns aggregated metrics across all clients in workspace.
 * Rate limited: 60 requests per minute per workspace (standard analytics).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPortfolioMetricsService } from "@/server/features/analytics/services/PortfolioMetricsService";
import { authenticateAnalyticsRequest } from "@/server/features/analytics/auth/analytics-auth";
import {
  analyticsStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period: z.enum(["day", "week", "month"]).optional(),
  limit: z.string().transform(Number).optional(),
});

// Main portfolio summary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/portfolio")({
  loader: async ({ request }: any) => {
    try {
      // Authenticate request and get verified workspace context
      const auth = await authenticateAnalyticsRequest(request);

      // Rate limit check: 60 requests per minute per workspace (standard analytics)
      const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
      if (!rateLimitResult.allowed) {
        return rateLimitExceededResponse(rateLimitResult);
      }

      // Parse query parameters
      const url = new URL(request.url);
      const params = Object.fromEntries(url.searchParams);
      const parsed = querySchema.safeParse(params);

      const dateRange = parsed.data?.startDate && parsed.data?.endDate
        ? {
            startDate: new Date(parsed.data.startDate),
            endDate: new Date(parsed.data.endDate),
          }
        : undefined;

      const service = await getPortfolioMetricsService();
      const summary = await service.getPortfolioSummary(auth.workspaceId, dateRange);

      const response = Response.json({ success: true, data: summary });
      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[portfolio] GET error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});

// Portfolio trends
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TrendsRoute = (createFileRoute as any)("/api/analytics/portfolio/trends")({
  loader: async ({ request }: any) => {
    try {
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

      const period = parsed.data?.period || "day";
      const dateRange = parsed.data?.startDate && parsed.data?.endDate
        ? {
            startDate: new Date(parsed.data.startDate),
            endDate: new Date(parsed.data.endDate),
          }
        : undefined;

      const service = await getPortfolioMetricsService();
      const trends = await service.getPortfolioTrends(auth.workspaceId, period, dateRange);

      const response = Response.json({ success: true, data: trends });
      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[portfolio/trends] GET error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});

// Top performing clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TopClientsRoute = (createFileRoute as any)("/api/analytics/portfolio/top-clients")({
  loader: async ({ request }: any) => {
    try {
      // Authenticate request and get verified workspace context
      const auth = await authenticateAnalyticsRequest(request);

      // Rate limit check: 60 requests per minute per workspace (standard analytics)
      const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
      if (!rateLimitResult.allowed) {
        return rateLimitExceededResponse(rateLimitResult);
      }

      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);

      const service = await getPortfolioMetricsService();
      const topClients = await service.getTopPerformingClients(auth.workspaceId, limit);

      const response = Response.json({ success: true, data: topClients });
      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[portfolio/top-clients] GET error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});

// Underperforming clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const UnderperformingRoute = (createFileRoute as any)("/api/analytics/portfolio/underperforming")({
  loader: async ({ request }: any) => {
    try {
      // Authenticate request and get verified workspace context
      const auth = await authenticateAnalyticsRequest(request);

      // Rate limit check: 60 requests per minute per workspace (standard analytics)
      const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
      if (!rateLimitResult.allowed) {
        return rateLimitExceededResponse(rateLimitResult);
      }

      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);

      const service = await getPortfolioMetricsService();
      const underperforming = await service.getUnderperformingClients(auth.workspaceId, limit);

      const response = Response.json({ success: true, data: underperforming });
      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[portfolio/underperforming] GET error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});

// Client comparison
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ComparisonRoute = (createFileRoute as any)("/api/analytics/portfolio/comparison")({
  loader: async ({ request }: any) => {
    try {
      // Authenticate request and get verified workspace context
      const auth = await authenticateAnalyticsRequest(request);

      // Rate limit check: 60 requests per minute per workspace (standard analytics)
      const rateLimitResult = await analyticsStandardRateLimiter(auth.workspaceId);
      if (!rateLimitResult.allowed) {
        return rateLimitExceededResponse(rateLimitResult);
      }

      const service = await getPortfolioMetricsService();
      const comparison = await service.getClientComparison(auth.workspaceId);

      const response = Response.json({ success: true, data: comparison });
      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[portfolio/comparison] GET error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});
