/**
 * Client alert rules API route.
 * Phase 18: Configure alert rules per client.
 *
 * GET /api/clients/:clientId/alert-rules - List alert rules
 * POST /api/clients/:clientId/alert-rules - Create alert rule
 * PUT /api/clients/:clientId/alert-rules - Upsert alert rule
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess } from "@/server/middleware/authz";
import { getClientAlertRules, upsertAlertRule, createAlertRule } from "@/services/alerts";

const log = createLogger({ module: "api/clients/:clientId/alert-rules" });

export const Route = createFileRoute("/api/clients/$clientId/alert-rules")({
  server: {
    handlers: {
      // GET /api/clients/:clientId/alert-rules - List alert rules
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

          const rules = await getClientAlertRules(clientId);

          return Response.json(
            rules.map((r) => ({
              id: r.id,
              clientId: r.clientId,
              alertType: r.alertType,
              enabled: r.enabled,
              threshold: r.threshold,
              severity: r.severity,
              emailNotify: r.emailNotify,
              createdAt: r.createdAt.toISOString(),
              updatedAt: r.updatedAt.toISOString(),
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
            "List alert rules failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // POST /api/clients/:clientId/alert-rules - Create alert rule
      POST: async ({
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
            alertType: string;
            enabled: boolean;
            threshold?: number | null;
            severity: "info" | "warning" | "critical";
            emailNotify: boolean;
          };

          if (!body.alertType) {
            throw new AppError("VALIDATION_ERROR", "alertType required");
          }
          if (body.severity === undefined) {
            throw new AppError("VALIDATION_ERROR", "severity required");
          }

          const rule = await createAlertRule({
            clientId,
            alertType: body.alertType,
            enabled: body.enabled ?? true,
            threshold: body.threshold,
            severity: body.severity,
            emailNotify: body.emailNotify ?? false,
          });

          return Response.json({
            id: rule.id,
            clientId: rule.clientId,
            alertType: rule.alertType,
            enabled: rule.enabled,
            threshold: rule.threshold,
            severity: rule.severity,
            emailNotify: rule.emailNotify,
            createdAt: rule.createdAt.toISOString(),
            updatedAt: rule.updatedAt.toISOString(),
          }, { status: 201 });
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
            "Create alert rule failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // PUT /api/clients/:clientId/alert-rules - Upsert alert rule
      PUT: async ({
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
            alertType: "ranking_drop" | "sync_failure" | "connection_expiry";
            enabled?: boolean;
            threshold?: number;
            severity?: "info" | "warning" | "critical";
            emailNotify?: boolean;
          };

          if (!body.alertType) {
            throw new AppError("VALIDATION_ERROR", "alertType required");
          }

          await upsertAlertRule({
            clientId,
            alertType: body.alertType,
            enabled: body.enabled,
            threshold: body.threshold,
            severity: body.severity,
            emailNotify: body.emailNotify,
          });

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
            "Upsert alert rule failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
