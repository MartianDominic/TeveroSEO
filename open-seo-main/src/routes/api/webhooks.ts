/**
 * Webhook management API routes.
 * Phase 18.5: CRUD operations for webhooks.
 * Phase 68-03: Zod validation + optimistic locking + standardized error envelope.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { successResponse, errorResponse } from "@/server/lib/response";
import { validateWebhookUrl } from "@/server/lib/webhook-url-policy";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess, AuthorizationError } from "@/server/middleware/authz";
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

/**
 * Zod schemas for webhook validation.
 * Phase 68-03: API Contract Alignment.
 */
const webhookScopeSchema = z.enum(["global", "workspace", "client"]);

const createWebhookSchema = z.object({
  scope: webhookScopeSchema,
  scopeId: z.string().optional(),
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  url: z.string().url("Invalid webhook URL"),
  events: z.array(z.string()).min(1, "At least one event required"),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url("Invalid webhook URL").optional(),
  events: z.array(z.string()).min(1, "At least one event required").optional(),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

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
            return successResponse({
              events: getAllEvents(),
              categories: getEventCategories(),
            });
          }

          // Return webhooks for scope
          if (!scope) {
            return errorResponse(400, "scope parameter required", {
              code: "VALIDATION_ERROR",
            });
          }

          const webhookList = await getWebhooksByScope(
            scope,
            scopeId ?? undefined,
          );

          return successResponse(
            webhookList.map((w) => ({
              id: w.id,
              scope: w.scope,
              scopeId: w.scopeId,
              name: w.name,
              url: w.url,
              events: w.events,
              enabled: w.enabled,
              version: w.version,
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
            return errorResponse(status, err.message, { code: err.code });
          }
          log.error(
            "List webhooks failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return errorResponse(500, "Internal error", { code: "INTERNAL_ERROR" });
        }
      },

      // POST /api/webhooks - Create webhook
      POST: async ({ request }: { request: Request }) => {
        try {
          const authContext = await requireApiAuth(request);

          const rawBody = await request.json();
          const validation = createWebhookSchema.safeParse(rawBody);

          if (!validation.success) {
            return errorResponse(400, "Validation failed", {
              code: "VALIDATION_ERROR",
              details: validation.error.flatten(),
            });
          }

          const body = validation.data;

          // SECURITY: Validate scopeId ownership for client-scoped webhooks (CRIT-03-D fix)
          if (body.scope === "client" && body.scopeId) {
            await requireClientAccess(authContext.userId, body.scopeId);
          } else if (body.scope === "workspace" && body.scopeId) {
            // Workspace-scoped: verify user belongs to this workspace
            if (body.scopeId !== authContext.organizationId) {
              throw new AppError("FORBIDDEN", "Access denied to this workspace");
            }
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

          if (!webhook) {
            return errorResponse(404, "Webhook not found after creation", {
              code: "NOT_FOUND",
            });
          }

          return successResponse({
            id: webhook.id,
            secret: webhook.secret,
            message: "Webhook created. Save the secret - it won't be shown again.",
          });
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return errorResponse(403, err.message, { code: "FORBIDDEN" });
          }
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return errorResponse(status, err.message, { code: err.code });
          }
          log.error(
            "Create webhook failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return errorResponse(500, "Internal error", { code: "INTERNAL_ERROR" });
        }
      },

      // PATCH /api/webhooks - Update webhook with optimistic locking
      PATCH: async ({ request }: { request: Request }) => {
        try {
          const authContext = await requireApiAuth(request);

          const url = new URL(request.url);
          const webhookId = url.searchParams.get("id");

          if (!webhookId) {
            return errorResponse(400, "Webhook ID required", {
              code: "VALIDATION_ERROR",
            });
          }

          const rawBody = await request.json();
          const validation = updateWebhookSchema.safeParse(rawBody);

          if (!validation.success) {
            return errorResponse(400, "Validation failed", {
              code: "VALIDATION_ERROR",
              details: validation.error.flatten(),
            });
          }

          const { expectedVersion, ...updateData } = validation.data;

          // Validate URL if provided
          if (updateData.url) {
            await validateWebhookUrl(updateData.url);
          }

          // Get current webhook for ownership validation
          const existing = await getWebhookById(webhookId);
          if (!existing) {
            return errorResponse(404, "Webhook not found", { code: "NOT_FOUND" });
          }

          // Validate ownership
          if (existing.scope === "client" && existing.scopeId) {
            await requireClientAccess(authContext.userId, existing.scopeId);
          } else if (existing.scope === "workspace" && existing.scopeId) {
            if (existing.scopeId !== authContext.organizationId) {
              return errorResponse(403, "Access denied to this workspace", {
                code: "FORBIDDEN",
              });
            }
          }

          // Optimistic locking: check version if provided
          if (expectedVersion !== undefined && existing.version !== expectedVersion) {
            return errorResponse(409, "Version conflict - webhook was modified", {
              code: "VERSION_MISMATCH",
              details: {
                expectedVersion,
                currentVersion: existing.version,
              },
            });
          }

          // Update with version increment
          const updated = await updateWebhook(
            webhookId,
            updateData,
            existing.scope,
            existing.scopeId ?? undefined,
          );

          if (!updated) {
            return errorResponse(409, "Update failed - concurrent modification", {
              code: "VERSION_MISMATCH",
            });
          }

          const webhook = await getWebhookById(webhookId);

          return successResponse({
            id: webhook?.id,
            version: webhook?.version,
            message: "Webhook updated successfully",
          });
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return errorResponse(403, err.message, { code: "FORBIDDEN" });
          }
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return errorResponse(status, err.message, { code: err.code });
          }
          log.error(
            "Update webhook failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return errorResponse(500, "Internal error", { code: "INTERNAL_ERROR" });
        }
      },
    },
  },
});
