/**
 * Velocity-based ETA calculator for pipeline execution.
 *
 * Tracks plan completion times to estimate remaining duration.
 * Uses rolling average of recent completions for accuracy.
 */
import { differenceInMinutes, addMinutes } from "date-fns";
import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "eta-calculator" });

const VELOCITY_KEY_PREFIX = "pipeline:velocity:";
const MAX_HISTORY = 10;
const DEFAULT_MINUTES_PER_PLAN = 30; // Pessimistic default

export interface VelocityMetric {
  planId: string;
  durationMinutes: number;
  completedAt: string;
}

export interface ETAResult {
  eta: Date;
  remainingMinutes: number;
  confidence: "low" | "medium" | "high";
  basedOnSamples: number;
}

/**
 * Calculate ETA for remaining plans based on velocity history.
 */
export async function calculateETA(
  workspaceId: string,
  remainingPlans: number
): Promise<ETAResult> {
  const metrics = await getVelocityHistory(workspaceId);

  if (metrics.length === 0) {
    // No history: pessimistic estimate
    const remainingMinutes = remainingPlans * DEFAULT_MINUTES_PER_PLAN;
    return {
      eta: addMinutes(new Date(), remainingMinutes),
      remainingMinutes,
      confidence: "low",
      basedOnSamples: 0,
    };
  }

  // Calculate average duration
  const totalMinutes = metrics.reduce((sum, m) => sum + m.durationMinutes, 0);
  const avgMinutesPerPlan = totalMinutes / metrics.length;
  const remainingMinutes = Math.round(remainingPlans * avgMinutesPerPlan);

  // Confidence based on sample size
  const confidence: ETAResult["confidence"] =
    metrics.length >= 5 ? "high" : metrics.length >= 2 ? "medium" : "low";

  return {
    eta: addMinutes(new Date(), remainingMinutes),
    remainingMinutes,
    confidence,
    basedOnSamples: metrics.length,
  };
}

/**
 * Record a plan completion for velocity tracking.
 */
export async function recordVelocity(
  workspaceId: string,
  planId: string,
  startedAt: Date,
  completedAt: Date
): Promise<void> {
  const durationMinutes = differenceInMinutes(completedAt, startedAt);

  const metric: VelocityMetric = {
    planId,
    durationMinutes: Math.max(1, durationMinutes), // At least 1 minute
    completedAt: completedAt.toISOString(),
  };

  const key = `${VELOCITY_KEY_PREFIX}${workspaceId}`;

  // Push to list and trim to max history
  await redis.lpush(key, JSON.stringify(metric));
  await redis.ltrim(key, 0, MAX_HISTORY - 1);

  // Set expiry (30 days)
  await redis.expire(key, 30 * 24 * 60 * 60);

  log.info("Recorded velocity", {
    workspaceId,
    planId,
    durationMinutes: metric.durationMinutes,
  });
}

/**
 * Get velocity history for a workspace.
 */
async function getVelocityHistory(workspaceId: string): Promise<VelocityMetric[]> {
  const key = `${VELOCITY_KEY_PREFIX}${workspaceId}`;
  const items = await redis.lrange(key, 0, MAX_HISTORY - 1);

  // H-VAL-03 FIX: Guard JSON.parse to handle malformed cached data
  const metrics: VelocityMetric[] = [];
  for (const item of items) {
    try {
      metrics.push(JSON.parse(item) as VelocityMetric);
    } catch {
      log.warn("Failed to parse velocity metric, skipping", {
        workspaceId,
        preview: item.substring(0, 100),
      });
    }
  }
  return metrics;
}

/**
 * Clear velocity history (for testing or reset).
 */
export async function clearVelocity(workspaceId: string): Promise<void> {
  const key = `${VELOCITY_KEY_PREFIX}${workspaceId}`;
  await redis.del(key);
}
