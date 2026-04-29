/**
 * Client alerts API route.
 * Phase 18: List and manage alerts for a client.
 *
 * GET /api/clients/:clientId/alerts - List alerts
 * PATCH /api/clients/:clientId/alerts - Update alert status
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess } from "@/server/middleware/authz";
import {
  getClientAlerts,
  getUnacknowledgedCount,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
} from "@/services/alerts";

const log = createLogger({ module: "api/clients/:clientId/alerts" });

export const Route = createFileRoute("/api/clients/$clientId/alerts")({
  server: {
    handlers: {
      // GET /api/clients/:clientId/alerts - List alerts
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);

          const { clientId } = params;
          await requireClientAccess(authContext.userId, clientId);

          const url = new URL(request.url);
          const status = url.searchParams.get("status") as
            | "pending"
            | "acknowledged"
            | "resolved"
            | "dismissed"
            | null;
          const countOnly = url.searchParams.get("count_only") === "true";

          if (countOnly) {
            const count = await getUnacknowledgedCount(clientId);
            return Response.json({ count });
          }

          const alerts = await getClientAlerts(clientId, {
            status: status ?? undefined,
            limit: 50,
          });

          return Response.json(
            alerts.map((a) => ({
              id: a.id,
              clientId: a.clientId,
              alertType: a.alertType,
              severity: a.severity,
              status: a.status,
              title: a.title,
              message: a.message,
              metadata: a.metadata,
              createdAt: a.createdAt.toISOString(),
              acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
              resolvedAt: a.resolvedAt?.toISOString() ?? null,
              emailSentAt: a.emailSentAt?.toISOString() ?? null,
            })),
          );
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "List alerts failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // PATCH /api/clients/:clientId/alerts - Update alert status
      PATCH: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);

          const { clientId } = params;
          await requireClientAccess(authContext.userId, clientId);

          const body = (await request.json()) as {
            alertId: string;
            action: "acknowledge" | "resolve" | "dismiss";
          };

          const { alertId, action } = body;

          if (!alertId || !action) {
            throw new AppError("VALIDATION_ERROR", "alertId and action required");
          }

          switch (action) {
            case "acknowledge":
              await acknowledgeAlert(alertId);
              break;
            case "resolve":
              await resolveAlert(alertId);
              break;
            case "dismiss":
              await dismissAlert(alertId);
              break;
            default:
              throw new AppError("VALIDATION_ERROR", "Invalid action");
          }

          return Response.json({ success: true });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Update alert failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
