/**
 * Prediction types for predictive alerts and goal projections.
 * Phase 25: Team & Intelligence
 */

/**
 * Prediction severity levels for UI display.
 */
export type PredictionSeverity = "info" | "warning" | "critical";

/**
 * Types of predictions the system can generate.
 */
export type PredictionType =
  | "traffic_decline"
  | "goal_at_risk"
  | "goal_achievable"
  | "ranking_drop"
  | "ctr_decline";

/**
 * Trend direction for goal projections.
 */
export type TrendDirection = "accelerating" | "steady" | "decelerating" | "declining";

/**
 * Goal projection with estimated completion date and confidence.
 */
export interface GoalProjection {
  goalId: string;
  goalName: string;
  currentValue: number;
  targetValue: number;
  attainmentPct: number;
  trend: TrendDirection;
  projectedDate: string | null; // ISO8601 date string
  daysToTarget: number | null;
  confidence: number; // 0-100
  weeklyVelocity: number;
}

/**
 * Predictive alert for potential issues.
 */
export interface PredictiveAlert {
  id: string;
  clientId: string;
  clientName?: string;
  type: PredictionType;
  title: string;
  description: string;
  probability: number; // 0-100
  severity: PredictionSeverity;
  timeframe: string; // Human-readable timeframe e.g., "2 weeks"
  predictedDate?: string; // ISO8601 date string
  currentValue: number;
  predictedValue: number;
  createdAt: string; // ISO8601 date string
}

/**
 * Traffic trend data point for prediction calculations.
 */
export interface TrafficDataPoint {
  date: string; // ISO8601 date string
  clicks: number;
  impressions: number;
}

/**
 * Linear regression result for trend analysis.
 */
export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number; // R-squared coefficient of determination
}
