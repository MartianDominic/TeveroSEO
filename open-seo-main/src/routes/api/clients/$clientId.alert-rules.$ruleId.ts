/**
 * Individual alert rule API route.
 * Phase 18: Configure alert rules per client.
 *
 * PATCH /api/clients/:clientId/alert-rules/:ruleId - Update alert rule
 * DELETE /api/clients/:clientId/alert-rules/:ruleId - Delete alert rule
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { updateAlertRuleById, deleteAlertRuleById } from "@/services/alerts";

const log = createLogger({ module: "api/clients/:clientId/alert-rules/:ruleId" });

export const Route = createFileRoute("/api/clients/$clientId/alert-rules/$ruleId")({
  server: {
    handlers: {
      // PATCH /api/clients/:clientId/alert-rules/:ruleId - Update alert rule
      PATCH: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string; ruleId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { clientId, ruleId } = params;
          const body = (await request.json()) as {
            enabled?: boolean;
            threshold?: number | null;
            severity?: "info" | "warning" | "critical";
            emailNotify?: boolean;
          };

          await updateAlertRuleById(ruleId, clientId, {
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
                  : err.code === "NOT_FOUND"
                    ? 404
                    : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Update alert rule failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // DELETE /api/clients/:clientId/alert-rules/:ruleId - Delete alert rule
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string; ruleId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { clientId, ruleId } = params;

          await deleteAlertRuleById(ruleId, clientId);

          return Response.json({ success: true });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : err.code === "NOT_FOUND"
                    ? 404
                    : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Delete alert rule failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
