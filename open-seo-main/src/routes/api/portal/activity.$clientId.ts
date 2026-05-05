/**
 * Activity API Route
 * Phase 90-02: Client Portal API Routes
 *
 * GET /api/portal/activity/:clientId - Get activity feed with pagination
 *
 * Returns work entries (content, technical, links, tracking, analytics, communication)
 * for display in portal activity feed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { portalTokenService } from "@/server/services/PortalTokenService";
import { ActivityService } from "@/server/features/portal/services/ActivityService";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/db/portal-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "portal/activity" });

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

// @ts-expect-error - Route not in FileRoutesByPath until generated
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

          // Parse query params
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

          // Fetch activities
          const [activities, total] = await Promise.all([
            ActivityService.getClientActivities(clientId, {
              category,
              limit,
              offset,
            }),
            ActivityService.countActivities(clientId, category),
          ]);

          // Transform to API response format
          const formattedActivities = activities.map((activity) => ({
            id: activity.id,
            category: activity.category,
            title: activity.title,
            description: activity.description,
            artifacts: activity.artifacts || [],
            createdAt: activity.createdAt.toISOString(),
            createdBy: activity.createdBy,
          }));

          // Group by date for frontend convenience
          const grouped = groupActivitiesByDate(
            activities.map((a) => ({
              ...a,
              artifacts: a.artifacts || [],
            }))
          );

          log.debug("Activity data retrieved", {
            clientId,
            total,
            returned: activities.length,
            category,
          });

          return Response.json({
            success: true,
            data: {
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
            },
          });
        } catch (error) {
          log.error("Activity API error", {
            error: error instanceof Error ? error.message : String(error),
            clientId: params.clientId,
          });
          return Response.json(
            { success: false, error: "Failed to fetch activity data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
