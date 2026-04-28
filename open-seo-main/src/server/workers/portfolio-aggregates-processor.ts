/**
 * Processor for portfolio-level aggregates computation.
 *
 * Aggregates client_dashboard_metrics per workspace into
 * portfolio_aggregates for instant dashboard header stats.
 *
 * Phase 23: Performance & Scale
 */

import type { Job } from "bullmq";
import { db } from "@/db";
import { clientDashboardMetrics, portfolioAggregates } from "@/db/dashboard-schema";
import { projects } from "@/db/app.schema";
import { eq, sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import type { PortfolioAggregatesJobData } from "@/server/queues/portfolioAggregatesQueue";

/**
 * Main processor function for portfolio aggregates computation.
 */
export async function processPortfolioAggregates(
  job: Job<PortfolioAggregatesJobData>,
): Promise<void> {
  const jobLogger = createLogger({
    module: "portfolio-aggregates-processor",
    jobId: job.id,
  });
  jobLogger.info("Starting portfolio aggregates computation", {
    triggeredAt: job.data.triggeredAt,
  });

  // Get all unique organization IDs (workspaces)
  const workspaces = await db
    .selectDistinct({ organizationId: projects.organizationId })
    .from(projects);

  const workspaceIds = workspaces.map((w) => w.organizationId);
  jobLogger.info(`Processing ${workspaceIds.length} workspaces`);

  let processed = 0;
  let failed = 0;

  for (const workspaceId of workspaceIds) {
    try {
      await computeWorkspaceAggregates(workspaceId, jobLogger);
      processed++;
    } catch (error) {
      failed++;
      jobLogger.error(
        `Failed to compute aggregates for workspace ${workspaceId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  jobLogger.info("Portfolio aggregates computation complete", {
    workspaceCount: workspaceIds.length,
    processed,
    failed,
    jobId: job.id,
  });
}

/**
 * Compute aggregates for a single workspace.
 */
async function computeWorkspaceAggregates(
  workspaceId: string,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const startTime = Date.now();

  // Get all client IDs for this workspace (via projects)
  const clientProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.organizationId, workspaceId));

  const clientIds = clientProjects.map((p) => p.id);

  if (clientIds.length === 0) {
    logger.info("No clients for workspace, skipping", { workspaceId });
    return;
  }

  // Get all client metrics for this workspace
  const clientMetrics = await db
    .select()
    .from(clientDashboardMetrics)
    .where(sql`${clientDashboardMetrics.clientId} = ANY(${clientIds})`);

  // Compute client distribution
  const totalClients = clientMetrics.length;
  const clientsOnTrack = clientMetrics.filter(
    (c) => Number(c.goalAttainmentPct ?? 0) >= 80,
  ).length;
  const clientsWatching = clientMetrics.filter((c) => {
    const pct = Number(c.goalAttainmentPct ?? 0);
    return pct >= 60 && pct < 80;
  }).length;
  const clientsCritical = clientMetrics.filter(
    (c) => Number(c.goalAttainmentPct ?? 0) < 60 && (c.goalsTotalCount ?? 0) > 0,
  ).length;
  const clientsNoGoals = clientMetrics.filter(
    (c) => (c.goalsTotalCount ?? 0) === 0,
  ).length;

  // Goal aggregates
  const totalGoals = clientMetrics.reduce(
    (sum, c) => sum + (c.goalsTotalCount ?? 0),
    0,
  );
  const goalsMet = clientMetrics.reduce(
    (sum, c) => sum + (c.goalsMetCount ?? 0),
    0,
  );
  const clientsWithGoals = clientMetrics.filter(
    (c) => (c.goalsTotalCount ?? 0) > 0,
  );
  const avgGoalAttainment =
    clientsWithGoals.length > 0
      ? clientsWithGoals.reduce(
          (sum, c) => sum + Number(c.goalAttainmentPct ?? 0),
          0,
        ) / clientsWithGoals.length
      : 0;

  // Traffic aggregates
  const totalClicks30d = clientMetrics.reduce(
    (sum, c) => sum + (c.trafficCurrent ?? 0),
    0,
  );
  const totalImpressions30d = 0; // Placeholder - needs additional column in metrics
  const avgCtr =
    totalImpressions30d > 0 ? (totalClicks30d / totalImpressions30d) * 100 : 0;

  // Keyword aggregates
  const keywordsTotal = clientMetrics.reduce(
    (sum, c) => sum + (c.keywordsTotal ?? 0),
    0,
  );
  const keywordsTop10 = clientMetrics.reduce(
    (sum, c) => sum + (c.keywordsTop10 ?? 0),
    0,
  );
  const keywordsTop3 = clientMetrics.reduce(
    (sum, c) => sum + (c.keywordsTop3 ?? 0),
    0,
  );
  const keywordsPosition1 = clientMetrics.reduce(
    (sum, c) => sum + (c.keywordsPosition1 ?? 0),
    0,
  );

  // Alert aggregates
  const alertsCriticalTotal = clientMetrics.reduce(
    (sum, c) => sum + (c.alertsCritical ?? 0),
    0,
  );
  const alertsWarningTotal = clientMetrics.reduce(
    (sum, c) => sum + (c.alertsOpen ?? 0) - (c.alertsCritical ?? 0),
    0,
  );
  const clientsWithCriticalAlerts = clientMetrics.filter(
    (c) => (c.alertsCritical ?? 0) > 0,
  ).length;

  const computationDurationMs = Date.now() - startTime;

  // Upsert aggregates
  const id = `agg-${workspaceId}`;
  await db
    .insert(portfolioAggregates)
    .values({
      id,
      workspaceId,
      totalClients,
      clientsOnTrack,
      clientsWatching,
      clientsCritical,
      clientsNoGoals,
      totalGoals,
      goalsMet,
      avgGoalAttainment: String(avgGoalAttainment),
      totalClicks30d,
      totalImpressions30d,
      avgCtr: String(avgCtr),
      totalKeywordsTracked: keywordsTotal,
      keywordsTop10,
      keywordsTop3,
      keywordsPosition1,
      alertsCriticalTotal,
      alertsWarningTotal,
      clientsWithCriticalAlerts,
      computedAt: new Date(),
      computationDurationMs,
    })
    .onConflictDoUpdate({
      target: portfolioAggregates.workspaceId,
      set: {
        totalClients,
        clientsOnTrack,
        clientsWatching,
        clientsCritical,
        clientsNoGoals,
        totalGoals,
        goalsMet,
        avgGoalAttainment: String(avgGoalAttainment),
        totalClicks30d,
        totalImpressions30d,
        avgCtr: String(avgCtr),
        totalKeywordsTracked: keywordsTotal,
        keywordsTop10,
        keywordsTop3,
        keywordsPosition1,
        alertsCriticalTotal,
        alertsWarningTotal,
        clientsWithCriticalAlerts,
        computedAt: new Date(),
        computationDurationMs,
      },
    });

  logger.info("Workspace aggregates computed", {
    workspaceId,
    totalClients,
    avgGoalAttainment: avgGoalAttainment.toFixed(1),
    computationDurationMs,
  });
}
