"use server";

/**
 * Server actions for predictive alerts and goal projections.
 * Phase 25: Team & Intelligence - Predictive Alerts + Goal Projection
 */

import { auth } from "@clerk/nextjs/server";
import { getFastApi } from "@/lib/server-fetch";
import { cacheGet, cacheSet, cacheKeys, cacheTags } from "@/lib/cache";
import {
  projectGoalCompletion,
  predictTrafficDecline,
  formatTimeframe,
} from "@/lib/analytics/predictions";
import type { GoalProjection, PredictiveAlert, TrafficDataPoint } from "@/types/predictions";
import type { ClientGoalSelect, GoalTemplateSelect } from "@/types/goals";
import type { ClientMetrics } from "@/lib/dashboard/types";

interface GoalWithTemplate {
  goal: ClientGoalSelect;
  template: GoalTemplateSelect;
}

interface GoalSnapshot {
  snapshotDate: string;
  currentValue: string;
}

interface ClientAnalytics {
  gsc_daily?: Array<{ date: string; clicks: number; impressions: number }>;
}

/**
 * Get goal projections for a specific client.
 * Projects when each goal will be achieved based on historical data.
 */
export async function getGoalProjections(
  clientId: string
): Promise<GoalProjection[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Fetch client goals
    const goalsResponse = await getFastApi<{ goals: GoalWithTemplate[] }>(
      `/api/clients/${clientId}/goals`
    );
    const goals = goalsResponse.goals ?? [];

    if (goals.length === 0) {
      return [];
    }

    // Fetch goal snapshots for historical data (last 30 days)
    const projections: GoalProjection[] = [];

    for (const { goal, template } of goals) {
      // Fetch goal history from snapshots endpoint
      let history: { date: string; value: number }[] = [];
      try {
        const snapshots = await getFastApi<{ snapshots: GoalSnapshot[] }>(
          `/api/clients/${clientId}/goals/${goal.id}/snapshots?days=30`
        );
        history = (snapshots.snapshots ?? []).map((s) => ({
          date: s.snapshotDate,
          value: Number(s.currentValue ?? 0),
        }));
      } catch {
        // If no snapshots endpoint, create synthetic history from current value
        // This ensures we can still show projections even without historical data
        const currentValue = Number(goal.currentValue ?? 0);
        const today = new Date();
        history = Array.from({ length: 7 }, (_, i) => ({
          date: new Date(today.getTime() - i * 86400000).toISOString().split("T")[0],
          value: currentValue,
        })).reverse();
      }

      const projection = projectGoalCompletion(goal, history);
      projections.push({
        ...projection,
        goalName: goal.customName ?? template.name,
      });
    }

    return projections;
  } catch (error) {
    console.error("[get-predictions] Error fetching goal projections:", error);
    return [];
  }
}

/**
 * Get predictive alerts for a specific client.
 * Generates alerts for declining traffic, goals at risk, etc.
 */
export async function getClientPredictions(
  clientId: string
): Promise<PredictiveAlert[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const alerts: PredictiveAlert[] = [];

  try {
    // Fetch traffic data for decline detection
    const analytics = await getFastApi<ClientAnalytics>(
      `/api/clients/${clientId}/analytics`
    );

    if (analytics.gsc_daily && analytics.gsc_daily.length >= 7) {
      const trafficHistory: TrafficDataPoint[] = analytics.gsc_daily.map((d) => ({
        date: d.date,
        clicks: d.clicks,
        impressions: d.impressions,
      }));

      const trafficPrediction = predictTrafficDecline(trafficHistory);

      if (trafficPrediction?.isDecreasing && trafficPrediction.declinePercent > 10) {
        alerts.push({
          id: `pred-traffic-${clientId}`,
          clientId,
          type: "traffic_decline",
          title: "Traffic Decline Predicted",
          description: `Based on the last 30 days, traffic is projected to decline ${trafficPrediction.declinePercent.toFixed(0)}% over the next 2 weeks.`,
          probability: trafficPrediction.confidence,
          severity: trafficPrediction.declinePercent > 25 ? "critical" : "warning",
          timeframe: "2 weeks",
          currentValue: trafficPrediction.currentAvg,
          predictedValue: trafficPrediction.predictedInTwoWeeks,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Fetch goal projections for at-risk alerts
    const projections = await getGoalProjections(clientId);

    for (const projection of projections) {
      if (projection.trend === "declining") {
        alerts.push({
          id: `pred-goal-risk-${projection.goalId}`,
          clientId,
          type: "goal_at_risk",
          title: `Goal "${projection.goalName}" at Risk`,
          description: `Progress is declining. Current attainment: ${projection.attainmentPct.toFixed(0)}%`,
          probability: projection.confidence,
          severity: "critical",
          timeframe: "ongoing",
          currentValue: projection.currentValue,
          predictedValue: projection.targetValue,
          createdAt: new Date().toISOString(),
        });
      } else if (projection.daysToTarget && projection.daysToTarget > 90) {
        alerts.push({
          id: `pred-goal-slow-${projection.goalId}`,
          clientId,
          type: "goal_at_risk",
          title: `Goal "${projection.goalName}" Slow Progress`,
          description: `At current pace, goal won't be reached for ${projection.daysToTarget} days.`,
          probability: projection.confidence,
          severity: "warning",
          timeframe: formatTimeframe(projection.daysToTarget),
          currentValue: projection.currentValue,
          predictedValue: projection.targetValue,
          createdAt: new Date().toISOString(),
        });
      } else if (
        projection.daysToTarget !== null &&
        projection.daysToTarget <= 30 &&
        projection.confidence >= 70
      ) {
        alerts.push({
          id: `pred-goal-achievable-${projection.goalId}`,
          clientId,
          type: "goal_achievable",
          title: `Goal "${projection.goalName}" Within Reach`,
          description: `On track to achieve goal in ~${projection.daysToTarget} days with ${projection.confidence.toFixed(0)}% confidence.`,
          probability: projection.confidence,
          severity: "info",
          timeframe: formatTimeframe(projection.daysToTarget),
          predictedDate: projection.projectedDate ?? undefined,
          currentValue: projection.currentValue,
          predictedValue: projection.targetValue,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Sort by severity (critical first) then by probability
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.probability - a.probability;
    });

    return alerts;
  } catch (error) {
    console.error("[get-predictions] Error fetching client predictions:", error);
    return [];
  }
}

/**
 * Get predictive alerts across all clients in a workspace.
 * Aggregates predictions from all clients for dashboard display.
 */
export async function getWorkspacePredictions(
  workspaceId: string
): Promise<PredictiveAlert[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Check cache first
  const cacheKey = `predictions:workspace:${workspaceId}`;
  const cached = await cacheGet<PredictiveAlert[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch all client metrics to get client IDs and names
    const metrics = await getFastApi<ClientMetrics[]>("/api/dashboard/metrics");

    if (!metrics.length) {
      return [];
    }

    const allPredictions: PredictiveAlert[] = [];

    // Process clients in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < Math.min(metrics.length, 50); i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (client) => {
          try {
            const predictions = await getClientPredictions(client.clientId);
            return predictions.map((p) => ({
              ...p,
              clientName: client.clientName,
            }));
          } catch {
            return [];
          }
        })
      );
      allPredictions.push(...batchResults.flat());
    }

    // Sort by severity and probability
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    allPredictions.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.probability - a.probability;
    });

    // Cache for 5 minutes
    await cacheSet(cacheKey, allPredictions, {
      ttl: 300,
      tags: [cacheTags.workspace(workspaceId)],
    });

    return allPredictions;
  } catch (error) {
    console.error("[get-predictions] Error fetching workspace predictions:", error);
    return [];
  }
}

/**
 * Get prediction count for badge display.
 * Returns count of critical and warning predictions.
 */
export async function getPredictionCounts(
  workspaceId: string
): Promise<{ critical: number; warning: number; total: number }> {
  const { userId } = await auth();
  if (!userId) {
    return { critical: 0, warning: 0, total: 0 };
  }

  try {
    const predictions = await getWorkspacePredictions(workspaceId);
    const critical = predictions.filter((p) => p.severity === "critical").length;
    const warning = predictions.filter((p) => p.severity === "warning").length;
    return { critical, warning, total: predictions.length };
  } catch {
    return { critical: 0, warning: 0, total: 0 };
  }
}
