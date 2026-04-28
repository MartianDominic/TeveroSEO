/**
 * API endpoint for sales analytics.
 * Phase 30-08: Pipeline & Automation
 *
 * GET /api/proposals/analytics - Get sales analytics for workspace
 *
 * Security: Requires authentication. WorkspaceId access validated.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  calculateSalesAnalytics,
  getPipelineDistribution,
  getPipelineValueByStage,
} from "@/server/features/proposals/analytics";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-proposals-analytics" });

const QuerySchema = z.object({
  workspaceId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const Route = createFileRoute("/api/proposals/analytics")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);

          const url = new URL(request.url);
          const query = QuerySchema.parse({
            workspaceId: url.searchParams.get("workspaceId"),
            startDate: url.searchParams.get("startDate"),
            endDate: url.searchParams.get("endDate"),
          });

          // 2. Validate workspace access - workspaceId should match user's organizationId
          // This ensures users can only access analytics for their own workspace
          if (query.workspaceId !== authContext.organizationId) {
            log.warn("Workspace access denied", {
              userId: authContext.userId,
              requestedWorkspaceId: query.workspaceId,
              userOrganizationId: authContext.organizationId,
            });
            throw new AppError("FORBIDDEN", "Access denied to this workspace");
          }

          // Default to last 30 days if no dates provided
          const now = new Date();
          const endDate = query.endDate ? new Date(query.endDate) : now;
          const startDate = query.startDate
            ? new Date(query.startDate)
            : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

          // Get all analytics in parallel
          const [analytics, distribution, valueByStage] = await Promise.all([
            calculateSalesAnalytics(query.workspaceId, {
              start: startDate,
              end: endDate,
            }),
            getPipelineDistribution(query.workspaceId),
            getPipelineValueByStage(query.workspaceId),
          ]);

          return Response.json({
            success: true,
            data: {
              ...analytics,
              distribution,
              valueByStage,
              period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
              },
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          if (error instanceof z.ZodError) {
            return Response.json(
              { success: false, error: error.issues },
              { status: 400 }
            );
          }

          log.error(
            "Analytics fetch failed",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
