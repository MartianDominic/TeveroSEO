/**
 * Notification Settings API Route
 * Phase 90-02: Client Portal API Routes
 *
 * GET /api/portal/notifications/settings/:clientId - Get notification settings
 * PUT /api/portal/notifications/settings/:clientId - Update notification settings
 *
 * Per T-90-07: Validate settings payload with known fields only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { portalTokenService } from "@/server/services/PortalTokenService";
import {
  NotificationService,
  type NotificationSettingsUpdate,
} from "@/server/features/portal/services/NotificationService";
import {
  portalStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "portal/notifications/settings" });

/**
 * Extract token from Authorization header or query param.
 */
function extractToken(request: Request, query: URLSearchParams): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return query.get("token");
}

/**
 * Zod schema for notification settings update (T-90-07 mitigation).
 * Only known fields are allowed, unknown fields are stripped.
 */
const settingsUpdateSchema = z
  .object({
    winEmail: z.boolean().optional(),
    winSlack: z.boolean().optional(),
    winPush: z.boolean().optional(),
    alertEmail: z.boolean().optional(),
    alertSlack: z.boolean().optional(),
    alertPush: z.boolean().optional(),
    updatePush: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    digestDay: z.number().int().min(1).max(7).optional(),
  })
  .strict(); // Reject unknown fields per T-90-07

export const Route = createFileRoute(
  "/api/portal/notifications/settings/$clientId"
)({
  server: {
    handlers: {
      /**
       * GET - Retrieve current notification settings.
       */
      GET: async ({
        params,
        request,
      }: {
        params: { clientId: string };
        request: Request;
      }) => {
        try {
          const { clientId } = params;
          const url = new URL(request.url);
          const token = extractToken(request, url.searchParams);

          // Validate token presence
          if (!token) {
            return Response.json(
              { success: false, error: "Missing authentication token" },
              { status: 401 }
            );
          }

          // Validate token
          const validation = await portalTokenService.validateToken(token);
          if (!validation.valid) {
            log.warn("Invalid token attempt", {
              clientId,
              error: validation.error,
            });
            return Response.json(
              {
                success: false,
                error:
                  validation.error === "expired"
                    ? "Token has expired"
                    : validation.error === "revoked"
                      ? "Token has been revoked"
                      : "Invalid token",
              },
              { status: 401 }
            );
          }

          // Verify clientId matches token (T-90-08)
          if (validation.clientId !== clientId) {
            log.warn("Client ID mismatch", {
              tokenClientId: validation.clientId,
              requestedClientId: clientId,
            });
            return Response.json(
              { success: false, error: "Access denied" },
              { status: 403 }
            );
          }

          // Check rate limit (60 req/min per clientId)
          const rateLimitResult = await portalStandardRateLimiter(clientId);
          if (!rateLimitResult.allowed) {
            log.warn("Portal notification settings rate limit exceeded", {
              clientId,
              current: rateLimitResult.current,
              limit: rateLimitResult.limit,
              retryAfter: rateLimitResult.retryAfter,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          // Fetch settings
          const settings =
            await NotificationService.getNotificationSettings(clientId);

          log.debug("Notification settings retrieved", { clientId });

          const response = Response.json({
            success: true,
            data: {
              winEmail: settings.winEmail,
              winSlack: settings.winSlack,
              winPush: settings.winPush,
              alertEmail: settings.alertEmail,
              alertSlack: settings.alertSlack,
              alertPush: settings.alertPush,
              updatePush: settings.updatePush,
              weeklyDigest: settings.weeklyDigest,
              digestDay: settings.digestDay,
            },
          });

          return addRateLimitHeaders(response, rateLimitResult);
        } catch (error) {
          log.error(
            "Notification settings GET error",
            error instanceof Error ? error : undefined,
            { clientId: params.clientId }
          );
          return Response.json(
            { success: false, error: "Failed to fetch notification settings" },
            { status: 500 }
          );
        }
      },

      /**
       * PUT - Update notification settings (partial update).
       */
      PUT: async ({
        params,
        request,
      }: {
        params: { clientId: string };
        request: Request;
      }) => {
        try {
          const { clientId } = params;
          const url = new URL(request.url);
          const token = extractToken(request, url.searchParams);

          // Validate token presence
          if (!token) {
            return Response.json(
              { success: false, error: "Missing authentication token" },
              { status: 401 }
            );
          }

          // Validate token
          const validation = await portalTokenService.validateToken(token);
          if (!validation.valid) {
            log.warn("Invalid token attempt", {
              clientId,
              error: validation.error,
            });
            return Response.json(
              {
                success: false,
                error:
                  validation.error === "expired"
                    ? "Token has expired"
                    : validation.error === "revoked"
                      ? "Token has been revoked"
                      : "Invalid token",
              },
              { status: 401 }
            );
          }

          // Verify clientId matches token (T-90-08)
          if (validation.clientId !== clientId) {
            log.warn("Client ID mismatch", {
              tokenClientId: validation.clientId,
              requestedClientId: clientId,
            });
            return Response.json(
              { success: false, error: "Access denied" },
              { status: 403 }
            );
          }

          // Check rate limit (60 req/min per clientId)
          const rateLimitResult = await portalStandardRateLimiter(clientId);
          if (!rateLimitResult.allowed) {
            log.warn("Portal notification settings PUT rate limit exceeded", {
              clientId,
              current: rateLimitResult.current,
              limit: rateLimitResult.limit,
              retryAfter: rateLimitResult.retryAfter,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          // Parse and validate request body (T-90-07)
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { success: false, error: "Invalid JSON body" },
              { status: 400 }
            );
          }

          const parseResult = settingsUpdateSchema.safeParse(body);
          if (!parseResult.success) {
            log.warn("Invalid settings payload", {
              clientId,
              errors: parseResult.error.issues,
            });
            return Response.json(
              {
                success: false,
                error: "Invalid settings payload",
                details: parseResult.error.issues.map((e) => ({
                  field: e.path.join("."),
                  message: e.message,
                })),
              },
              { status: 400 }
            );
          }

          const updates = parseResult.data as NotificationSettingsUpdate;

          // Update settings
          const updatedSettings =
            await NotificationService.updateNotificationSettings(
              clientId,
              updates
            );

          log.info("Notification settings updated", {
            clientId,
            updates: Object.keys(updates),
          });

          const response = Response.json({
            success: true,
            data: {
              winEmail: updatedSettings.winEmail,
              winSlack: updatedSettings.winSlack,
              winPush: updatedSettings.winPush,
              alertEmail: updatedSettings.alertEmail,
              alertSlack: updatedSettings.alertSlack,
              alertPush: updatedSettings.alertPush,
              updatePush: updatedSettings.updatePush,
              weeklyDigest: updatedSettings.weeklyDigest,
              digestDay: updatedSettings.digestDay,
            },
          });

          return addRateLimitHeaders(response, rateLimitResult);
        } catch (error) {
          log.error(
            "Notification settings PUT error",
            error instanceof Error ? error : undefined,
            { clientId: params.clientId }
          );
          return Response.json(
            { success: false, error: "Failed to update notification settings" },
            { status: 500 }
          );
        }
      },
    },
  },
});
