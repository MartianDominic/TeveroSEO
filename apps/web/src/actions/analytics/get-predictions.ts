"use server";

/**
 * Server actions for predictive alerts and goal projections.
 * Phase 25: Team & Intelligence - Predictive Alerts + Goal Projection
 */

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
  validateWorkspaceMembership,
} from "@/lib/auth/action-auth";
import { getFastApi } from "@/lib/server-fetch";
import { mlPredictionsLimiter, checkRateLimit } from "@/lib/rate-limit";
import { deduplicateRequest, createRequestHash } from "@/lib/dedup";

// Validation schemas
const clientIdSchema = z.string().uuid("Invalid client ID");
const workspaceIdSchema = z.string().uuid("Invalid workspace ID");
import { cacheGet, cacheSet, cacheTags, getCachedWithSingleflight } from "@/lib/cache";
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

// FIX: ClientAnalytics from main /analytics endpoint doesn't include gsc_daily.
// The backend ClientAnalyticsResponse has: client_id, articles_published_this_month,
// total_word_count_this_month, failed_count_this_month, last_published_at, cms_type.
// GSC data must be fetched from a separate endpoint.
interface ClientAnalytics {
  gsc_daily?: Array<{ date: string; clicks: number; impressions: number }>;
}

// Response shape from dedicated GSC daily endpoint
interface GscDailyResponse {
  data?: Array<{ date: string; clicks: number; impressions: number }>;
}

/**
 * Get goal projections for a specific client.
 * Projects when each goal will be achieved based on historical data.
 */
export async function getGoalProjections(
  clientId: string
): Promise<GoalProjection[]> {
  // Validate clientId format
  const validatedClientId = clientIdSchema.parse(clientId);

  const auth = await requireActionAuth();
  await validateClientOwnership(validatedClientId, auth);

  try {
    // Fetch client goals
    const goalsResponse = await getFastApi<{ goals: GoalWithTemplate[] }>(
      `/api/clients/${clientId}/goals`
    );
    const goals = goalsResponse.goals ?? [];

    if (goals.length === 0) {
      return [];
    }

    // BATCH FETCH: Get all goal snapshots in a single request
    // This prevents N+1 queries (1 request for N goals instead of N requests)
    const goalIds = goals.map(({ goal }) => goal.id);
    let snapshotsByGoalId: Map<string, { date: string; value: number }[]> = new Map();

    try {
      // Batch endpoint: fetch snapshots for all goals at once
      const batchSnapshots = await getFastApi<{
        snapshots: { goalId: string; snapshotDate: string; currentValue: string }[];
      }>(`/api/clients/${clientId}/goals/snapshots/batch?goalIds=${goalIds.join(",")}&days=30`);

      // Group snapshots by goalId
      for (const snapshot of batchSnapshots.snapshots ?? []) {
        const existing = snapshotsByGoalId.get(snapshot.goalId) ?? [];
        existing.push({
          date: snapshot.snapshotDate,
          value: Number(snapshot.currentValue ?? 0),
        });
        snapshotsByGoalId.set(snapshot.goalId, existing);
      }
    } catch {
      // Fallback: If batch endpoint unavailable, fetch individually (legacy support)
      // This is slower but ensures backwards compatibility
      for (const { goal } of goals) {
        try {
          const snapshots = await getFastApi<{ snapshots: GoalSnapshot[] }>(
            `/api/clients/${clientId}/goals/${goal.id}/snapshots?days=30`
          );
          snapshotsByGoalId.set(
            goal.id,
            (snapshots.snapshots ?? []).map((s) => ({
              date: s.snapshotDate,
              value: Number(s.currentValue ?? 0),
            }))
          );
        } catch {
          // Individual goal fetch failed, will use synthetic history
        }
      }
    }

    // Build projections using batched snapshot data
    const projections: GoalProjection[] = [];

    for (const { goal, template } of goals) {
      let history = snapshotsByGoalId.get(goal.id) ?? [];

      // If no snapshots available, create synthetic history from current value
      if (history.length === 0) {
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
 *
 * Rate limited: 10 predictions per minute per user.
 * Deduplicated: Identical requests within 60s share the same result.
 */
export async function getClientPredictions(
  clientId: string
): Promise<PredictiveAlert[]> {
  // Validate clientId format
  const validatedClientId = clientIdSchema.parse(clientId);

  const auth = await requireActionAuth();
  await validateClientOwnership(validatedClientId, auth);

  // Rate limit expensive ML prediction operations
  await checkRateLimit(mlPredictionsLimiter, auth.userId);

  // Deduplicate identical requests within 60s window
  const requestHash = createRequestHash({ clientId: validatedClientId, type: "client-predictions" });

  return deduplicateRequest(`predictions:client:${requestHash}`, async () => {
    return executeClientPredictions(validatedClientId);
  });
}

/**
 * Internal: Execute client predictions logic.
 * Separated for deduplication wrapper.
 */
async function executeClientPredictions(clientId: string): Promise<PredictiveAlert[]> {
  const alerts: PredictiveAlert[] = [];

  try {
    // FIX: Fetch GSC daily data from dedicated endpoint, not /analytics
    // The main /analytics endpoint doesn't include gsc_daily field.
    let gscDaily: Array<{ date: string; clicks: number; impressions: number }> = [];
    try {
      const gscResponse = await getFastApi<GscDailyResponse>(
        `/api/clients/${clientId}/gsc/daily?days=30`
      );
      gscDaily = gscResponse.data ?? [];
    } catch {
      // GSC endpoint may not exist or client may not have GSC connected
      // Gracefully continue without traffic predictions
    }

    if (gscDaily.length >= 7) {
      const trafficHistory: TrafficDataPoint[] = gscDaily.map((d) => ({
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
 * Concurrency limit for parallel client prediction fetches.
 * Balances throughput vs API/memory pressure.
 */
const PREDICTION_CONCURRENCY_LIMIT = 5;

/**
 * Maximum clients to process for workspace predictions.
 * Prevents unbounded processing time for large workspaces.
 */
const MAX_CLIENTS_FOR_PREDICTIONS = 50;

/**
 * Get predictive alerts across all clients in a workspace.
 * Aggregates predictions from all clients for dashboard display.
 *
 * Uses controlled concurrency to avoid overwhelming the API while
 * still providing good throughput.
 */
export async function getWorkspacePredictions(
  workspaceId: string
): Promise<PredictiveAlert[]> {
  // Validate workspaceId format
  const validatedWorkspaceId = workspaceIdSchema.parse(workspaceId);

  const auth = await requireActionAuth();

  // Validate workspace membership before accessing workspace data
  await validateWorkspaceMembership(validatedWorkspaceId, auth);

  const cacheKey = `predictions:workspace:${validatedWorkspaceId}`;

  try {
    // Use singleflight to prevent cache stampede:
    // Multiple concurrent requests for same workspace share a single fetch
    return await getCachedWithSingleflight<PredictiveAlert[]>(
      cacheKey,
      300, // 5 minute TTL
      async () => {
        // Fetch all client metrics to get client IDs and names
        const metrics = await getFastApi<ClientMetrics[]>("/api/dashboard/metrics");

        if (!metrics.length) {
          return [];
        }

        const allPredictions: PredictiveAlert[] = [];
        const clientsToProcess = metrics.slice(0, MAX_CLIENTS_FOR_PREDICTIONS);

        // Process clients with controlled concurrency using Promise.all + chunking
        // This is more efficient than sequential processing while avoiding API overload
        for (let i = 0; i < clientsToProcess.length; i += PREDICTION_CONCURRENCY_LIMIT) {
          const batch = clientsToProcess.slice(i, i + PREDICTION_CONCURRENCY_LIMIT);

          // Use deduplication-aware fetching - identical client predictions
          // within the same request window will share results
          const batchResults = await Promise.all(
            batch.map(async (client) => {
              try {
                // getClientPredictions already uses deduplicateRequest internally,
                // so concurrent calls for the same client will share results
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

        return allPredictions;
      },
      cacheGet,
      cacheSet,
      [cacheTags.workspace(validatedWorkspaceId)]
    );
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
  try {
    // Validate workspaceId format (getWorkspacePredictions also validates, but fail fast here)
    workspaceIdSchema.parse(workspaceId);

    await requireActionAuth();
    const predictions = await getWorkspacePredictions(workspaceId);
    const critical = predictions.filter((p) => p.severity === "critical").length;
    const warning = predictions.filter((p) => p.severity === "warning").length;
    return { critical, warning, total: predictions.length };
  } catch {
    return { critical: 0, warning: 0, total: 0 };
  }
}
