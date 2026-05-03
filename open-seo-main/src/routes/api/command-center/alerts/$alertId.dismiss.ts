/**
 * Dismiss Alert API Route
 * Phase 62-06: Quick Actions
 *
 * POST /api/command-center/alerts/:alertId/dismiss
 * Dismisses a smart alert from the dashboard.
 *
 * Response:
 * { success: true }
 *
 * SECURITY:
 * - T-62-06-01: Workspace validation via X-Workspace-Id header
 */

import { createFileRoute } from "@tanstack/react-router";
import { getQuickActionService } from "@/server/features/command-center/services/QuickActionService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "dismiss-alert" });

export const Route = createFileRoute(
  "/api/command-center/alerts/$alertId/dismiss"
)({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { alertId: string };
      }) => {
        try {
          const workspaceId = request.headers.get("X-Workspace-Id");
          const userId = request.headers.get("X-User-Id") ?? "system";

          if (!workspaceId) {
            return Response.json(
              { error: "Workspace ID required" },
              { status: 401 }
            );
          }

          const { alertId } = params;
          if (!alertId) {
            return Response.json(
              { error: "Alert ID required" },
              { status: 400 }
            );
          }

          const quickActionService = getQuickActionService();
          await quickActionService.dismissAlert(workspaceId, userId, alertId);

          return Response.json({ success: true });
        } catch (error) {
          log.error("Failed to dismiss alert", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            {
              error: {
                code: "INTERNAL_ERROR",
                message: error instanceof Error ? error.message : "Failed to dismiss alert",
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
