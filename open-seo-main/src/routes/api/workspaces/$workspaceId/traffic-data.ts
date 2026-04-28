/**
 * Workspace traffic data API endpoint.
 * Phase 41-02: Pattern Detection with Real GSC Data
 *
 * GET /api/workspaces/{workspaceId}/traffic-data
 * Returns aggregated GSC traffic data for all clients in a workspace.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { gscSnapshots } from "@/db/analytics-schema";
import { clients } from "@/db/client-schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/workspaces/traffic-data" });

/**
 * Client traffic status based on week-over-week change.
 */
type TrafficStatus = "dropped" | "growing" | "stable";

/**
 * Response structure for client traffic data.
 */
interface ClientTrafficResponse {
  clientId: string;
  clientName: string;
  weeklyClicks: number[];
  currentWeekTotal: number;
  previousWeekTotal: number;
  changePercent: number;
  status: TrafficStatus;
}

/**
 * Aggregate snapshots into weekly totals.
 * Returns array of 4 weeks [oldest, ..., newest].
 */
function aggregateByWeek(
  snapshots: Array<{ clicks: number; date: string }>
): number[] {
  const weeks: number[] = [0, 0, 0, 0];
  const now = new Date();

  for (const snapshot of snapshots) {
    const snapshotDate = new Date(snapshot.date);
    const daysDiff = Math.floor(
      (now.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weekIndex = 3 - Math.floor(daysDiff / 7); // 3 = current week, 0 = 4 weeks ago

    if (weekIndex >= 0 && weekIndex < 4) {
      weeks[weekIndex] += snapshot.clicks;
    }
  }

  return weeks;
}

/**
 * Calculate week-over-week trend percentage.
 */
function calculateTrend(currentWeek: number, previousWeek: number): number {
  if (previousWeek === 0) return 0;
  return Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
}

/**
 * Determine traffic status from trend percentage.
 */
function getTrafficStatus(trend: number): TrafficStatus {
  if (trend <= -20) return "dropped";
  if (trend >= 10) return "growing";
  return "stable";
}

export const Route = createFileRoute(
  "/api/workspaces/$workspaceId/traffic-data"
)({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { workspaceId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { workspaceId } = params;

          if (!workspaceId) {
            return Response.json(
              { error: "workspaceId is required" },
              { status: 400 }
            );
          }

          // Get all clients in workspace
          const workspaceClients = await db
            .select({
              id: clients.id,
              name: clients.name,
            })
            .from(clients)
            .where(eq(clients.workspaceId, workspaceId));

          if (workspaceClients.length === 0) {
            return Response.json([]);
          }

          // Calculate date 28 days ago
          const fourWeeksAgo = new Date();
          fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
          const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0];

          // Fetch traffic data for each client
          const trafficData: ClientTrafficResponse[] = await Promise.all(
            workspaceClients.map(async (client) => {
              const snapshots = await db
                .select({
                  clicks: gscSnapshots.clicks,
                  date: gscSnapshots.date,
                })
                .from(gscSnapshots)
                .where(
                  and(
                    eq(gscSnapshots.clientId, client.id),
                    gte(gscSnapshots.date, fourWeeksAgoStr)
                  )
                )
                .orderBy(desc(gscSnapshots.date))
                .limit(28);

              const weeklyClicks = aggregateByWeek(snapshots);
              const currentWeekTotal = weeklyClicks[3];
              const previousWeekTotal = weeklyClicks[2];
              const changePercent = calculateTrend(
                currentWeekTotal,
                previousWeekTotal
              );
              const status = getTrafficStatus(changePercent);

              return {
                clientId: client.id,
                clientName: client.name,
                weeklyClicks,
                currentWeekTotal,
                previousWeekTotal,
                changePercent,
                status,
              };
            })
          );

          log.info("Traffic data retrieved", {
            workspaceId,
            clientCount: trafficData.length,
          });

          return Response.json(trafficData);
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
            "Failed to fetch traffic data",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
