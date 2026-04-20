/**
 * Prediction utilities for goal projections and traffic decline detection.
 * Phase 25: Team & Intelligence
 *
 * Uses simple linear extrapolation for projections.
 */

import type {
  GoalProjection,
  RegressionResult,
  TrafficDataPoint,
  TrendDirection,
} from "@/types/predictions";
import type { ClientGoalSelect } from "@/types/goals";

/**
 * Simple linear regression for trend prediction.
 * Returns slope, intercept, and R-squared coefficient.
 */
export function linearRegression(
  data: { x: number; y: number }[]
): RegressionResult {
  const n = data.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const sumX = data.reduce((sum, p) => sum + p.x, 0);
  const sumY = data.reduce((sum, p) => sum + p.y, 0);
  const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = data.reduce((sum, p) => sum + p.x * p.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, r2: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared calculation
  const meanY = sumY / n;
  const ssTotal = data.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const ssResidual = data.reduce(
    (sum, p) => sum + Math.pow(p.y - (slope * p.x + intercept), 2),
    0
  );
  const r2 = ssTotal === 0 ? 0 : Math.max(0, 1 - ssResidual / ssTotal);

  return { slope, intercept, r2 };
}

/**
 * Calculate confidence score based on data quality.
 * More data points and better R-squared = higher confidence.
 */
export function calculateConfidence(
  dataPointCount: number,
  r2: number
): number {
  // Base confidence from data points (max 50 points for 50% contribution)
  const dataConfidence = Math.min(dataPointCount / 50, 1) * 50;

  // R-squared contribution (50% max)
  const fitConfidence = r2 * 50;

  return Math.min(95, Math.round(dataConfidence + fitConfidence));
}

/**
 * Determine trend direction from slope and acceleration.
 */
export function determineTrend(
  slope: number,
  previousSlope?: number
): TrendDirection {
  if (slope < -0.5) return "declining";
  if (slope < 0.5) return "steady";

  // Check for acceleration if we have previous slope
  if (previousSlope !== undefined && slope > previousSlope * 1.2) {
    return "accelerating";
  }

  if (previousSlope !== undefined && slope < previousSlope * 0.8) {
    return "decelerating";
  }

  return "steady";
}

/**
 * Project goal completion date based on historical progress.
 */
export function projectGoalCompletion(
  goal: ClientGoalSelect,
  history: { date: string; value: number }[]
): GoalProjection {
  const currentValue = Number(goal.currentValue ?? 0);
  const targetValue = Number(goal.targetValue);
  const attainmentPct = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  const goalName = goal.customName ?? "Goal";

  // Insufficient data case
  if (history.length < 7) {
    return {
      goalId: goal.id,
      goalName,
      currentValue,
      targetValue,
      attainmentPct,
      trend: "steady",
      projectedDate: null,
      daysToTarget: null,
      confidence: calculateConfidence(history.length, 0),
      weeklyVelocity: 0,
    };
  }

  // Convert to regression data (x = day index, y = value)
  const data = history.map((h, i) => ({
    x: i,
    y: h.value,
  }));

  const { slope, r2 } = linearRegression(data);

  // Calculate weekly velocity (slope * 7 days)
  const weeklyVelocity = slope * 7;

  // Determine trend
  const trend = determineTrend(slope);

  // Project completion date
  let projectedDate: string | null = null;
  let daysToTarget: number | null = null;

  if (slope > 0 && currentValue < targetValue) {
    const remaining = targetValue - currentValue;
    daysToTarget = Math.ceil(remaining / slope);

    if (daysToTarget > 0 && daysToTarget < 365) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysToTarget);
      projectedDate = futureDate.toISOString().split("T")[0];
    }
  } else if (currentValue >= targetValue) {
    // Goal already met
    daysToTarget = 0;
    projectedDate = new Date().toISOString().split("T")[0];
  }

  return {
    goalId: goal.id,
    goalName,
    currentValue,
    targetValue,
    attainmentPct,
    trend,
    projectedDate,
    daysToTarget,
    confidence: calculateConfidence(history.length, r2),
    weeklyVelocity,
  };
}

/**
 * Detect declining traffic trends early.
 * Returns predicted decline percentage if trend is negative.
 */
export function predictTrafficDecline(
  trafficHistory: TrafficDataPoint[]
): {
  isDecreasing: boolean;
  declinePercent: number;
  confidence: number;
  predictedInTwoWeeks: number;
  currentAvg: number;
} | null {
  if (trafficHistory.length < 7) {
    return null;
  }

  // Convert to regression data
  const data = trafficHistory.map((t, i) => ({
    x: i,
    y: t.clicks,
  }));

  const { slope, r2 } = linearRegression(data);

  // Only consider declining if negative slope and reasonable fit
  if (slope >= 0 || r2 < 0.3) {
    return {
      isDecreasing: false,
      declinePercent: 0,
      confidence: calculateConfidence(trafficHistory.length, r2),
      predictedInTwoWeeks: 0,
      currentAvg: 0,
    };
  }

  // Calculate current 7-day average
  const recent = data.slice(-7);
  const currentAvg = recent.reduce((sum, p) => sum + p.y, 0) / recent.length;

  // Predict value in 2 weeks
  const predictedInTwoWeeks = Math.max(0, currentAvg + slope * 14);

  // Calculate decline percentage
  const declinePercent =
    currentAvg > 0 ? ((currentAvg - predictedInTwoWeeks) / currentAvg) * 100 : 0;

  return {
    isDecreasing: declinePercent > 10,
    declinePercent,
    confidence: calculateConfidence(trafficHistory.length, r2),
    predictedInTwoWeeks,
    currentAvg,
  };
}

/**
 * Generate a human-readable timeframe string.
 */
export function formatTimeframe(days: number): string {
  if (days <= 7) return "1 week";
  if (days <= 14) return "2 weeks";
  if (days <= 30) return "1 month";
  if (days <= 60) return "2 months";
  if (days <= 90) return "3 months";
  return `${Math.ceil(days / 30)} months`;
}
