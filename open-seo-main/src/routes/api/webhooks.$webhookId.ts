/**
 * Single webhook API routes.
 * Phase 18.5: Get, update, delete webhook.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { validateWebhookUrl } from "@/server/lib/webhook-url-policy";
import { requireApiAuth, type ApiAuthContext } from "@/routes/api/seo/-middleware";
import { requireClientAccess, AuthorizationError } from "@/server/middleware/authz";
import {
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  regenerateWebhookSecret,
  getWebhookDeliveries,
} from "@/services/webhooks";

/**
 * Validate user has access to the webhook based on its scope.
 * - client scope: user must have access to the client
 * - workspace scope: user must belong to the workspace (checked via organizationId)
 * - global scope: only system admins (not implemented, deny by default)
 */
async function validateWebhookAccess(
  webhook: { scope: string; scopeId: string | null },
  authContext: ApiAuthContext
): Promise<void> {
  if (webhook.scope === "client" && webhook.scopeId) {
    // Client-scoped webhook: validate user has access to this client
    await requireClientAccess(authContext.userId, webhook.scopeId);
  } else if (webhook.scope === "workspace" && webhook.scopeId) {
    // Workspace-scoped webhook: user must belong to this workspace
    if (authContext.organizationId !== webhook.scopeId) {
      throw new AuthorizationError(
        authContext.userId,
        webhook.scopeId,
        "not_member"
      );
    }
  } else if (webhook.scope === "global") {
    // Global webhooks require special admin permissions (not implemented)
    // For now, deny access to non-admin users
    throw new AppError("FORBIDDEN", "Global webhooks require admin access");
  }
}

const log = createLogger({ module: "api/webhooks/:webhookId" });

export const Route = createFileRoute("/api/webhooks/$webhookId")({
  server: {
    handlers: {
      // GET /api/webhooks/:webhookId - Get webhook details
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { webhookId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);

          const { webhookId } = params;
          const url = new URL(request.url);
          const includeDeliveries =
            url.searchParams.get("deliveries") === "true";

          const webhook = await getWebhookById(webhookId);

          if (!webhook) {
            throw new AppError("NOT_FOUND", "Webhook not found");
          }

          // SECURITY: Validate user has access to this webhook (CRITICAL-AUTH-002 fix)
          await validateWebhookAccess(webhook, authContext);

          const response: Record<string, unknown> = {
            id: webhook.id,
            scope: webhook.scope,
            scopeId: webhook.scopeId,
            name: webhook.name,
            url: webhook.url,
            events: webhook.events,
            headers: webhook.headers,
            enabled: webhook.enabled,
            createdAt: webhook.createdAt.toISOString(),
            updatedAt: webhook.updatedAt.toISOString(),
          };

          if (includeDeliveries) {
            const deliveries = await getWebhookDeliveries(webhookId, 20);
            response.deliveries = deliveries.map((d) => ({
              id: d.id,
              eventId: d.eventId,
              eventType: d.eventType,
              status: d.status,
              attempts: d.attempts,
              lastAttemptAt: d.lastAttemptAt?.toISOString(),
              deliveredAt: d.deliveredAt?.toISOString(),
              createdAt: d.createdAt.toISOString(),
            }));
          }

          return Response.json(response);
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return Response.json({ error: "Access denied" }, { status: 403 });
          }
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "NOT_FOUND"
                  ? 404
                  : err.code === "FORBIDDEN"
                    ? 403
                    : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Get webhook failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // PATCH /api/webhooks/:webhookId - Update webhook
      PATCH: async ({
        request,
        params,
      }: {
        request: Request;
        params: { webhookId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);

          const { webhookId } = params;
          const body = (await request.json()) as {
            name?: string;
            url?: string;
            events?: string[];
            headers?: Record<string, string>;
            enabled?: boolean;
            regenerateSecret?: boolean;
          };

          const webhook = await getWebhookById(webhookId);
          if (!webhook) {
            throw new AppError("NOT_FOUND", "Webhook not found");
          }

          // SECURITY: Validate user has access to this webhook (CRITICAL-AUTH-002 fix)
          await validateWebhookAccess(webhook, authContext);

          // SECURITY: Validate webhook URL to prevent SSRF attacks
          if (body.url) {
            await validateWebhookUrl(body.url);
          }

          // Regenerate secret if requested
          let newSecret: string | undefined;
          if (body.regenerateSecret) {
            newSecret = await regenerateWebhookSecret(webhookId);
          }

          // Update other fields
          await updateWebhook(webhookId, {
            name: body.name,
            url: body.url,
            events: body.events,
            headers: body.headers,
            enabled: body.enabled,
          });

          const response: Record<string, unknown> = { success: true };
          if (newSecret) {
            response.secret = newSecret;
            response.message = "Secret regenerated. Save it - it won't be shown again.";
          }

          return Response.json(response);
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return Response.json({ error: "Access denied" }, { status: 403 });
          }
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "NOT_FOUND"
                  ? 404
                  : err.code === "FORBIDDEN"
                    ? 403
                    : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Update webhook failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // DELETE /api/webhooks/:webhookId - Delete webhook
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { webhookId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);

          const { webhookId } = params;

          const webhook = await getWebhookById(webhookId);
          if (!webhook) {
            throw new AppError("NOT_FOUND", "Webhook not found");
          }

          // SECURITY: Validate user has access to this webhook (CRITICAL-AUTH-002 fix)
          await validateWebhookAccess(webhook, authContext);

          await deleteWebhook(webhookId);

          return Response.json({ success: true });
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return Response.json({ error: "Access denied" }, { status: 403 });
          }
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "NOT_FOUND"
                  ? 404
                  : err.code === "FORBIDDEN"
                    ? 403
                    : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Delete webhook failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
