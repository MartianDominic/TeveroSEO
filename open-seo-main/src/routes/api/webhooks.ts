/**
 * Webhook management API routes.
 * Phase 18.5: CRUD operations for webhooks.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { validateWebhookUrl } from "@/server/lib/webhook-url-policy";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookById,
  getWebhooksByScope,
  regenerateWebhookSecret,
  getWebhookDeliveries,
} from "@/services/webhooks";
import { getAllEvents, getEventCategories } from "@/services/event-registry";

const log = createLogger({ module: "api/webhooks" });

export const Route = createFileRoute("/api/webhooks")({
  server: {
    handlers: {
      // GET /api/webhooks - List webhooks or get event registry
      GET: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          const url = new URL(request.url);
          const scope = url.searchParams.get("scope") as
            | "global"
            | "workspace"
            | "client"
            | null;
          const scopeId = url.searchParams.get("scope_id");
          const eventsOnly = url.searchParams.get("events") === "true";

          // Return event registry
          if (eventsOnly) {
            return Response.json({
              events: getAllEvents(),
              categories: getEventCategories(),
            });
          }

          // Return webhooks for scope
          if (!scope) {
            throw new AppError("VALIDATION_ERROR", "scope parameter required");
          }

          const webhooks = await getWebhooksByScope(
            scope,
            scopeId ?? undefined,
          );

          return Response.json(
            webhooks.map((w) => ({
              id: w.id,
              scope: w.scope,
              scopeId: w.scopeId,
              name: w.name,
              url: w.url,
              events: w.events,
              enabled: w.enabled,
              createdAt: w.createdAt.toISOString(),
              updatedAt: w.updatedAt.toISOString(),
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
            "List webhooks failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // POST /api/webhooks - Create webhook
      POST: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          const body = (await request.json()) as {
            scope: "global" | "workspace" | "client";
            scopeId?: string;
            name: string;
            url: string;
            events: string[];
            headers?: Record<string, string>;
            enabled?: boolean;
          };

          if (!body.scope || !body.name || !body.url || !body.events) {
            throw new AppError(
              "VALIDATION_ERROR",
              "scope, name, url, and events required",
            );
          }

          // SECURITY: Validate webhook URL to prevent SSRF attacks
          await validateWebhookUrl(body.url);

          const webhookId = await createWebhook({
            scope: body.scope,
            scopeId: body.scopeId,
            name: body.name,
            url: body.url,
            events: body.events,
            headers: body.headers,
            enabled: body.enabled,
          });

          const webhook = await getWebhookById(webhookId);

          return Response.json({
            id: webhook!.id,
            secret: webhook!.secret,
            message: "Webhook created. Save the secret - it won't be shown again.",
          });
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
            "Create webhook failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
