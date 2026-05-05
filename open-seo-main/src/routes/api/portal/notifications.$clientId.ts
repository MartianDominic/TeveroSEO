/**
 * Notifications API Route
 * Phase 90-02: Client Portal API Routes
 *
 * GET /api/portal/notifications/:clientId - Get in-app notifications
 *
 * Returns notifications for display in portal notification center.
 * Unread notifications first, then read, sorted by createdAt desc.
 */
import { createFileRoute } from "@tanstack/react-router";
import { portalTokenService } from "@/server/services/PortalTokenService";
import { NotificationService } from "@/server/features/portal/services/NotificationService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "portal/notifications" });

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

// @ts-expect-error - Route not in FileRoutesByPath until generated
export const Route = createFileRoute("/api/portal/notifications/$clientId")({
  server: {
    handlers: {
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

          // Parse limit from query params
          const limit = Math.min(
            Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1),
            100
          );

          // Fetch notifications (in_app channel only)
          const notifications =
            await NotificationService.getClientNotifications(clientId, limit);

          // Transform to API response format
          const formattedNotifications = notifications.map((n) => ({
            id: n.id,
            type: n.type,
            payload: n.payload,
            createdAt: n.createdAt.toISOString(),
            isRead: n.status === "sent", // Consider "sent" as read for in_app
          }));

          // Count unread (pending notifications)
          const unreadCount = notifications.filter(
            (n) => n.status === "pending"
          ).length;

          log.debug("Notifications data retrieved", {
            clientId,
            total: notifications.length,
            unread: unreadCount,
          });

          return Response.json({
            success: true,
            data: {
              notifications: formattedNotifications,
              unreadCount,
            },
          });
        } catch (error) {
          log.error("Notifications API error", {
            error: error instanceof Error ? error.message : String(error),
            clientId: params.clientId,
          });
          return Response.json(
            { success: false, error: "Failed to fetch notifications" },
            { status: 500 }
          );
        }
      },
    },
  },
});
