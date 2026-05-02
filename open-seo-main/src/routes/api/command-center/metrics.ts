/**
 * API endpoint for command center dashboard metrics.
 * Phase 62-04: Pipeline Metrics Computation Worker
 *
 * GET /api/command-center/metrics
 * Returns formatted pipeline metrics for dashboard display.
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 * T-62-04-01: Workspace scoping via session validation
 * T-62-04-02: Rate limiting via queue (1 computation per workspace per minute)
 */
import { createFileRoute } from "@tanstack/react-router";
import { getDashboardMetrics } from "@/server/features/command-center/api/metrics";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/command-center/metrics" });

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/command-center/metrics")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          // T-62-04-01: Use organizationId from session for workspace scoping
          const workspaceId = auth.organizationId;
          if (!workspaceId) {
            return Response.json(
              { success: false, error: "Missing workspace" },
              { status: 400 }
            );
          }

          log.debug("Fetching dashboard metrics", {
            userId: auth.userId,
            workspaceId,
          });

          const data = await getDashboardMetrics(workspaceId);

          return Response.json({
            success: true,
            data: {
              pending: data.pending,
              metrics: data.metrics,
              computedAt: data.computedAt?.toISOString() ?? null,
              isStale: data.isStale ?? false,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            if (error.code === "UNAUTHENTICATED") {
              return Response.json(
                { success: false, error: error.message },
                { status: 401 }
              );
            }
          }

          log.error(
            "Failed to get dashboard metrics",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Failed to get dashboard metrics" },
            { status: 500 }
          );
        }
      },
    },
  },
});
