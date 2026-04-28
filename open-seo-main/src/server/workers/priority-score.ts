/**
 * Priority score computation for client urgency ranking.
 * Phase 22: Goal-Based Metrics System
 */
import { db } from "@/db";
import { clientDashboardMetrics } from "@/db/dashboard-schema";
import { alerts } from "@/db/alert-schema";
import { eq, sql } from "drizzle-orm";

interface PriorityInputs {
  alertsCritical: number;
  alertsWarning: number;
  goalAttainmentPct: number;
  trafficTrendPct: number;
  daysSinceTouch: number;
  daysUntilRenewal?: number;
}

/**
 * Compute priority score based on multiple urgency factors.
 *
 * Score tiers:
 * - Tier 1: Critical alerts (1000+ range)
 * - Tier 2: Warning alerts (100+ range)
 * - Tier 3: Goal gaps (0-50 range)
 * - Tier 4: Negative momentum (50-200 range)
 * - Tier 5: Neglect (1-14 range)
 * - Tier 6: Revenue at risk (500 bonus)
 */
export function computePriorityScore(inputs: PriorityInputs): number {
  let priority = 0;

  // Tier 1: Active critical problems (1000+ range)
  priority += inputs.alertsCritical * 1000;

  // Tier 2: Active warnings (100+ range)
  priority += inputs.alertsWarning * 100;

  // Tier 3: Goal gaps (0-50 range)
  const goalGap = Math.max(0, 100 - inputs.goalAttainmentPct);
  priority += goalGap * 0.5;

  // Tier 4: Negative momentum (adds 50-200)
  if (inputs.trafficTrendPct < -20) {
    priority += 200;
  } else if (inputs.trafficTrendPct < -10) {
    priority += 50;
  }

  // Tier 5: Neglect (1-14 range)
  priority += Math.min(14, inputs.daysSinceTouch);

  // Tier 6: Revenue at risk (contract expiring + poor performance)
  if (
    inputs.daysUntilRenewal !== undefined &&
    inputs.daysUntilRenewal < 30 &&
    inputs.goalAttainmentPct < 80
  ) {
    priority += 500;
  }

  return Math.round(priority);
}

/**
 * Update priority score for a specific client.
 */
export async function updateClientPriorityScore(
  clientId: string,
): Promise<void> {
  // Get current metrics
  const metrics = await db
    .select()
    .from(clientDashboardMetrics)
    .where(eq(clientDashboardMetrics.clientId, clientId))
    .limit(1);

  if (!metrics[0]) return;

  // Get alert counts
  const alertCounts = await db
    .select({
      critical: sql<number>`COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'pending')`,
      warning: sql<number>`COUNT(*) FILTER (WHERE severity = 'warning' AND status = 'pending')`,
    })
    .from(alerts)
    .where(eq(alerts.clientId, clientId));

  const priorityScore = computePriorityScore({
    alertsCritical: Number(alertCounts[0]?.critical ?? 0),
    alertsWarning: Number(alertCounts[0]?.warning ?? 0),
    goalAttainmentPct: Number(metrics[0].goalAttainmentPct ?? 100),
    trafficTrendPct: Number(metrics[0].trafficTrendPct ?? 0),
    daysSinceTouch: 0, // TODO: Implement when client_touches table exists
    daysUntilRenewal: undefined, // TODO: Implement when client_contracts table exists
  });

  await db
    .update(clientDashboardMetrics)
    .set({ priorityScore })
    .where(eq(clientDashboardMetrics.clientId, clientId));
}
