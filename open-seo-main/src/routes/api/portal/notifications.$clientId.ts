/**
 * Notifications API Route
 * Phase 90-02: Client Portal API Routes
 * Phase 96-05: Added ClientVisibilityService filtering
 *
 * GET /api/portal/notifications/:clientId - Get in-app notifications
 *
 * Returns notifications for display in portal notification center.
 * Unread notifications first, then read, sorted by createdAt desc.
 * Per P96-05: All responses filtered through ClientVisibilityService.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  validatePortalAuth,
  verifyClientIdMatch,
  portalAuthErrorResponse,
} from "@/server/middleware/portal-auth";
import {
  portalStandardRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";
import { getClientVisibilityService } from "@/server/features/analytics/services/ClientVisibilityService";
import { NotificationService } from "@/server/features/portal/services/NotificationService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "portal/notifications" });

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

          // Step 1: Validate portal authentication using new middleware
          const authResult = await validatePortalAuth(request);
          if (!authResult.success) {
            return portalAuthErrorResponse(authResult);
          }

          // Step 2: Verify clientId matches token (T-90-08)
          const clientVerification = verifyClientIdMatch(authResult, clientId);
          if (!clientVerification.success) {
            return portalAuthErrorResponse(clientVerification);
          }

          // Step 3: Check rate limit (60 req/min per clientId)
          const rateLimitResult = await portalStandardRateLimiter(clientId);
          if (!rateLimitResult.allowed) {
            log.warn("Portal notifications rate limit exceeded", {
              clientId,
              current: rateLimitResult.current,
              limit: rateLimitResult.limit,
              retryAfter: rateLimitResult.retryAfter,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          // Step 4: Get visibility configuration for filtering
          const visibilityService = await getClientVisibilityService();
          const visibility = await visibilityService.getVisibilityConfig(
            clientId,
            authResult.data.workspaceId
          );

          // Step 5: Parse limit from query params
          const url = new URL(request.url);
          const limit = Math.min(
            Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1),
            100
          );

          // Step 6: Fetch notifications (in_app channel only)
          const notifications =
            await NotificationService.getClientNotifications(clientId, limit);

          // Step 7: Transform to API response format
          const formattedNotifications = notifications.map((n) => ({
            id: n.id,
            type: n.type,
            payload: n.payload,
            createdAt: n.createdAt.toISOString(),
            isRead: n.status === "sent", // Consider "sent" as read for in_app
          }));

          // Step 8: Count unread (pending notifications)
          const unreadCount = notifications.filter(
            (n) => n.status === "pending"
          ).length;

          // Step 9: Build raw response data
          const rawData = {
            notifications: formattedNotifications,
            unreadCount,
          };

          // Step 10: Apply visibility filtering to response
          // Note: Notification payloads may contain metrics that should be filtered
          const filteredData = visibilityService.filterByVisibility(
            rawData,
            visibility
          );

          log.debug("Notifications data retrieved", {
            clientId,
            workspaceId: authResult.data.workspaceId,
            total: notifications.length,
            unread: unreadCount,
          });

          // Step 11: Build response with rate limit headers
          const response = Response.json({
            success: true,
            data: filteredData,
          });

          return addRateLimitHeaders(response, rateLimitResult);
        } catch (error) {
          log.error(
            "Notifications API error",
            error instanceof Error ? error : undefined,
            { clientId: params.clientId }
          );
          return Response.json(
            { success: false, error: "Failed to fetch notifications" },
            { status: 500 }
          );
        }
      },
    },
  },
});
