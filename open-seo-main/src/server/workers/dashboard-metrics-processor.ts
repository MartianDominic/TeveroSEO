/**
 * Processor for dashboard metrics computation.
 *
 * Queries all active clients, computes health score and aggregated metrics,
 * and stores in client_dashboard_metrics table.
 *
 * Phase 21: Agency Command Center
 */

import type { Job } from "bullmq";
import { db } from "@/db";
import { clientDashboardMetrics } from "@/db/dashboard-schema";
import { alerts } from "@/db/alert-schema";
import { savedKeywords } from "@/db/app.schema";
import { keywordRankings } from "@/db/ranking-schema";
import { gscSnapshots } from "@/db/analytics-schema";
import { computeHealthScore } from "@/lib/dashboard/health-score";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import type { DashboardMetricsJobData } from "@/server/queues/dashboardMetricsQueue";
import { processClientGoals } from "@/server/queues/goalQueue";
import { updateClientPriorityScore } from "./priority-score";

const log = createLogger({ module: "dashboard-metrics-processor" });

/**
 * Main processor function for dashboard metrics computation.
 */
export async function processDashboardMetrics(
  job: Job<DashboardMetricsJobData>,
): Promise<void> {
  const jobLogger = createLogger({
    module: "dashboard-metrics-processor",
    jobId: job.id,
  });
  jobLogger.info("Starting dashboard metrics computation", {
    triggeredAt: job.data.triggeredAt,
  });

  // Get all unique client IDs from alerts table (proxy for active clients)
  // In production, this should query the clients table from AI-Writer
  const clientsResult = await db
    .selectDistinct({ clientId: alerts.clientId })
    .from(alerts);

  const clientIds = clientsResult.map((r) => r.clientId);
  jobLogger.info(`Processing ${clientIds.length} clients`);

  let processed = 0;
  let failed = 0;

  for (const clientId of clientIds) {
    try {
      await computeClientMetrics(clientId, jobLogger);
      processed++;
    } catch (error) {
      failed++;
      jobLogger.error(
        `Failed to compute metrics for client ${clientId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      // Continue with other clients
    }
  }

  jobLogger.info("Dashboard metrics computation complete", {
    clientCount: clientIds.length,
    processed,
    failed,
    jobId: job.id,
  });
}

/**
 * Compute metrics for a single client.
 */
async function computeClientMetrics(
  clientId: string,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // 1. Get traffic data (last 30 days vs previous 30 days)
  const trafficCurrent = await db
    .select({ total: sql<number>`COALESCE(SUM(${gscSnapshots.clicks}), 0)` })
    .from(gscSnapshots)
    .where(
      and(
        eq(gscSnapshots.clientId, clientId),
        gte(gscSnapshots.date, thirtyDaysAgo.toISOString().split("T")[0]),
      ),
    );

  const trafficPrevious = await db
    .select({ total: sql<number>`COALESCE(SUM(${gscSnapshots.clicks}), 0)` })
    .from(gscSnapshots)
    .where(
      and(
        eq(gscSnapshots.clientId, clientId),
        gte(gscSnapshots.date, sixtyDaysAgo.toISOString().split("T")[0]),
        sql`${gscSnapshots.date} < ${thirtyDaysAgo.toISOString().split("T")[0]}`,
      ),
    );

  const currentClicks = Number(trafficCurrent[0]?.total ?? 0);
  const previousClicks = Number(trafficPrevious[0]?.total ?? 0);
  const trafficTrendPct =
    previousClicks > 0 ? (currentClicks - previousClicks) / previousClicks : 0;

  // 2. Get keyword stats
  const keywordStats = await db
    .select({
      total: sql<number>`COUNT(*)`,
    })
    .from(savedKeywords)
    .where(eq(savedKeywords.projectId, clientId)); // Note: may need to join projects if clientId != projectId

  const keywordsTotal = Number(keywordStats[0]?.total ?? 0);

  // Get latest rankings for position distribution
  // Simplified: in production, join with latest ranking per keyword
  // For now, use placeholder values
  const top10Count = 0; // Placeholder - needs ranking join
  const top3Count = 0;
  const position1Count = 0;

  // 3. Get alert counts
  const alertCounts = await db
    .select({
      severity: alerts.severity,
      count: sql<number>`COUNT(*)`,
    })
    .from(alerts)
    .where(and(eq(alerts.clientId, clientId), eq(alerts.status, "pending")))
    .groupBy(alerts.severity);

  const alertsCritical = Number(
    alertCounts.find((a) => a.severity === "critical")?.count ?? 0,
  );
  const alertsWarning = Number(
    alertCounts.find((a) => a.severity === "warning")?.count ?? 0,
  );
  const alertsOpen =
    alertsCritical +
    alertsWarning +
    Number(alertCounts.find((a) => a.severity === "info")?.count ?? 0);

  // 4. Compute health score
  const healthResult = computeHealthScore({
    trafficTrend: trafficTrendPct,
    alertsCritical,
    alertsWarning,
    keywordsTop10Pct: keywordsTotal > 0 ? (top10Count / keywordsTotal) * 100 : 100,
    backlinksLostPct: 0, // Placeholder - needs backlink data
    lastReportDaysAgo: 0, // Placeholder - needs report query
    connectionStale: false, // Placeholder - needs OAuth token check
  });

  // 5. Upsert metrics
  const id = crypto.randomUUID();
  await db
    .insert(clientDashboardMetrics)
    .values({
      id,
      clientId,
      healthScore: healthResult.score,
      healthBreakdown: healthResult.breakdown,
      trafficCurrent: currentClicks,
      trafficPrevious: previousClicks,
      trafficTrendPct: trafficTrendPct.toFixed(4),
      keywordsTotal,
      keywordsTop10: top10Count,
      keywordsTop3: top3Count,
      keywordsPosition1: position1Count,
      keywordsDistribution: { top10: top10Count, top3: top3Count, position1: position1Count },
      backlinksTotal: 0,
      backlinksNewMonth: 0,
      alertsOpen,
      alertsCritical,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: clientDashboardMetrics.clientId,
      set: {
        healthScore: healthResult.score,
        healthBreakdown: healthResult.breakdown,
        trafficCurrent: currentClicks,
        trafficPrevious: previousClicks,
        trafficTrendPct: trafficTrendPct.toFixed(4),
        keywordsTotal,
        keywordsTop10: top10Count,
        keywordsTop3: top3Count,
        keywordsPosition1: position1Count,
        keywordsDistribution: { top10: top10Count, top3: top3Count, position1: position1Count },
        alertsOpen,
        alertsCritical,
        computedAt: new Date(),
      },
    });

  logger.info("Client metrics computed", {
    clientId,
    healthScore: healthResult.score,
    trafficCurrent: currentClicks,
    trafficTrendPct: trafficTrendPct.toFixed(4),
    alertsOpen,
  });

  // Process goals and update priority score (Phase 22)
  await processClientGoals(clientId);
  await updateClientPriorityScore(clientId);
}
