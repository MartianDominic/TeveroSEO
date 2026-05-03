/**
 * Client alerts API route.
 * Phase 18: List and manage alerts for a client.
 *
 * GET /api/clients/:clientId/alerts - List alerts
 * PATCH /api/clients/:clientId/alerts - Update alert status
 *
 * MEDIUM-02 FIX: Added Zod validation for PATCH request body.
 * MEDIUM-03 FIX: Added path parameter validation.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
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

/**
 * MEDIUM-03 FIX: Validate clientId format (UUID or CUID).
 */
const ClientIdSchema = z.string().min(1).max(128).regex(
  /^[a-zA-Z0-9_-]+$/,
  "Invalid clientId format"
);

/**
 * MEDIUM-02 FIX: Zod schema for PATCH request body validation.
 */
const UpdateAlertSchema = z.object({
  alertId: z.string().min(1).max(128).regex(
    /^[a-zA-Z0-9_-]+$/,
    "Invalid alertId format"
  ),
  action: z.enum(["acknowledge", "resolve", "dismiss"]),
});

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

          // MEDIUM-03 FIX: Validate path parameter
          const clientIdParsed = ClientIdSchema.safeParse(params.clientId);
          if (!clientIdParsed.success) {
            return Response.json(
              { success: false, error: "Invalid clientId format" },
              { status: 400 }
            );
          }

          const clientId = clientIdParsed.data;
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
            // MEDIUM-01 FIX: Standardized response envelope
            return Response.json({ success: true, data: { count } });
          }

          const alerts = await getClientAlerts(clientId, {
            status: status ?? undefined,
            limit: 50,
          });

          // MEDIUM-01 FIX: Standardized response envelope
          return Response.json({
            success: true,
            data: alerts.map((a) => ({
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
          });
        } catch (err) {
          // MEDIUM-04 FIX: Handle AppError with proper status codes
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : err.code === "NOT_FOUND"
                    ? 404
                    : 400;
            return Response.json(
              { success: false, error: err.message },
              { status }
            );
          }
          log.error(
            "List alerts failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json(
            { success: false, error: "Internal error" },
            { status: 500 }
          );
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

          // MEDIUM-03 FIX: Validate path parameter
          const clientIdParsed = ClientIdSchema.safeParse(params.clientId);
          if (!clientIdParsed.success) {
            return Response.json(
              { success: false, error: "Invalid clientId format" },
              { status: 400 }
            );
          }

          const clientId = clientIdParsed.data;
          await requireClientAccess(authContext.userId, clientId);

          // MEDIUM-02 FIX: Use Zod schema for body validation
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = UpdateAlertSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid request body",
                details: parsed.error.issues.map((issue) => ({
                  field: issue.path.join("."),
                  message: issue.message,
                })),
              },
              { status: 400 }
            );
          }

          const { alertId, action } = parsed.data;

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
          }

          // MEDIUM-01 FIX: Standardized response envelope
          return Response.json({ success: true, data: null });
        } catch (err) {
          // MEDIUM-04 FIX: Handle AppError with proper status codes
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : err.code === "NOT_FOUND"
                    ? 404
                    : 400;
            return Response.json(
              { success: false, error: err.message },
              { status }
            );
          }
          log.error(
            "Update alert failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json(
            { success: false, error: "Internal error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
