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
 * - AUTH-CRIT-01 FIX: User identity verified via JWT, NOT from X-User-Id header
 * - T-62-06-01: Workspace validation with authenticated user context
 */

import { createFileRoute } from "@tanstack/react-router";
import { getQuickActionService } from "@/server/features/command-center/services/QuickActionService";
import { createLogger } from "@/server/lib/logger";
import { authenticateCommandCenterRequest } from "@/server/features/command-center/api/auth";

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
          // AUTH-CRIT-01 FIX: Authenticate via JWT/API key, not trusted headers
          const auth = await authenticateCommandCenterRequest(request);
          if (!auth.success) {
            return Response.json(
              { error: auth.error },
              { status: auth.status }
            );
          }

          const { userId, workspaceId } = auth;

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
