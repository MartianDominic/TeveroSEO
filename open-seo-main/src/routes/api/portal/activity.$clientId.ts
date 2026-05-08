/**
 * Activity API Route
 * Phase 90-02: Client Portal API Routes
 * Phase 96-05: Added ClientVisibilityService filtering
 *
 * GET /api/portal/activity/:clientId - Get activity feed with pagination
 *
 * Returns work entries (content, technical, links, tracking, analytics, communication)
 * for display in portal activity feed.
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
import { ActivityService } from "@/server/features/portal/services/ActivityService";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/db/portal-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "portal/activity" });

/**
 * Group activities by date for frontend rendering.
 */
function groupActivitiesByDate(
  activities: Array<{
    id: string;
    category: string;
    title: string;
    description: string | null;
    artifacts: Array<{ label: string; url: string }> | null;
    createdAt: Date;
    createdBy: string | null;
  }>
): {
  today: typeof activities;
  yesterday: typeof activities;
  thisWeek: typeof activities;
  older: typeof activities;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups = {
    today: [] as typeof activities,
    yesterday: [] as typeof activities,
    thisWeek: [] as typeof activities,
    older: [] as typeof activities,
  };

  for (const activity of activities) {
    const activityDate = new Date(activity.createdAt);
    const activityDay = new Date(
      activityDate.getFullYear(),
      activityDate.getMonth(),
      activityDate.getDate()
    );

    if (activityDay.getTime() === today.getTime()) {
      groups.today.push(activity);
    } else if (activityDay.getTime() === yesterday.getTime()) {
      groups.yesterday.push(activity);
    } else if (activityDay.getTime() > weekAgo.getTime()) {
      groups.thisWeek.push(activity);
    } else {
      groups.older.push(activity);
    }
  }

  return groups;
}

export const Route = createFileRoute("/api/portal/activity/$clientId")({
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
            log.warn("Portal activity rate limit exceeded", {
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

          // Step 5: Parse query params
          const url = new URL(request.url);
          const limit = Math.min(
            Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1),
            100
          );
          const offset = Math.max(
            parseInt(url.searchParams.get("offset") || "0", 10),
            0
          );
          const categoryParam = url.searchParams.get("category");
          const category =
            categoryParam &&
            ACTIVITY_CATEGORIES.includes(categoryParam as ActivityCategory)
              ? (categoryParam as ActivityCategory)
              : undefined;

          // Step 6: Fetch activities
          const [activities, total] = await Promise.all([
            ActivityService.getClientActivities(clientId, {
              category,
              limit,
              offset,
            }),
            ActivityService.countActivities(clientId, category),
          ]);

          // Step 7: Transform to API response format
          const formattedActivities = activities.map((activity) => ({
            id: activity.id,
            category: activity.category,
            title: activity.title,
            description: activity.description,
            artifacts: activity.artifacts || [],
            createdAt: activity.createdAt.toISOString(),
            createdBy: activity.createdBy,
          }));

          // Step 8: Group by date for frontend convenience
          const grouped = groupActivitiesByDate(
            activities.map((a) => ({
              ...a,
              artifacts: a.artifacts || [],
            }))
          );

          // Step 9: Build raw response data
          const rawData = {
            activities: formattedActivities,
            grouped: {
              today: grouped.today.map((a) => a.id),
              yesterday: grouped.yesterday.map((a) => a.id),
              thisWeek: grouped.thisWeek.map((a) => a.id),
              older: grouped.older.map((a) => a.id),
            },
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + limit < total,
            },
          };

          // Step 10: Apply visibility filtering to response
          const filteredData = visibilityService.filterByVisibility(
            rawData,
            visibility
          );

          log.debug("Activity data retrieved", {
            clientId,
            workspaceId: authResult.data.workspaceId,
            total,
            returned: activities.length,
            category,
          });

          // Step 11: Build response with rate limit headers
          const response = Response.json({
            success: true,
            data: filteredData,
          });

          return addRateLimitHeaders(response, rateLimitResult);
        } catch (error) {
          log.error(
            "Activity API error",
            error instanceof Error ? error : undefined,
            { clientId: params.clientId }
          );
          return Response.json(
            { success: false, error: "Failed to fetch activity data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
