/**
 * Shared Quality Gate & Scoring Constants
 * FIX-14: Quality Gate & Scoring Standardization
 *
 * Single source of truth for quality thresholds across the platform.
 * Used by: open-seo-main, AI-Writer, apps/web
 *
 * THRESHOLD POLICY:
 * - All quality gates use 80 as the pass threshold
 * - Score color coding: Red (0-49), Yellow (50-79), Green (80-100)
 * - Scores are always integers (0-100) displayed with 0 decimal places for UI,
 *   or 1 decimal place (.0) for detailed breakdowns
 */

/**
 * Quality gate thresholds for auto-publish eligibility.
 * Content must score >= PASS to be eligible for auto-publishing.
 */
export const QUALITY_THRESHOLDS = {
  /** Score required to pass quality gate (auto-publish eligible) */
  PASS: 80,
  /** Score at which warnings begin (needs attention) */
  WARN: 50,
  /** Minimum score (fail state) */
  FAIL: 0,
} as const;

/**
 * Score color mapping for consistent UI display.
 * Red: 0-49 (fail), Yellow: 50-79 (warn), Green: 80-100 (pass)
 */
export const SCORE_COLORS = {
  /** Color for passing scores (>= 80) */
  PASS: "green",
  /** Color for warning scores (50-79) */
  WARN: "yellow",
  /** Color for failing scores (< 50) */
  FAIL: "red",
} as const;

/**
 * Score labels for UI display.
 */
export const SCORE_LABELS = {
  /** Label for excellent scores (>= 90) */
  EXCELLENT: "Excellent",
  /** Label for good/passing scores (80-89) */
  GOOD: "Good",
  /** Label for needs attention scores (50-79) */
  NEEDS_ATTENTION: "Needs Attention",
  /** Label for poor/failing scores (< 50) */
  POOR: "Poor",
} as const;

/**
 * Check status types for audit results.
 * SKIP and N/A do NOT count toward score reduction.
 */
export type CheckStatus = "PASS" | "FAIL" | "SKIP" | "N/A";

/**
 * Determine score color based on threshold boundaries.
 * @param score - Score value (0-100)
 * @returns Color string for UI
 */
export function getScoreColorFromThreshold(
  score: number
): (typeof SCORE_COLORS)[keyof typeof SCORE_COLORS] {
  if (score >= QUALITY_THRESHOLDS.PASS) return SCORE_COLORS.PASS;
  if (score >= QUALITY_THRESHOLDS.WARN) return SCORE_COLORS.WARN;
  return SCORE_COLORS.FAIL;
}

/**
 * Determine score label based on score value.
 * @param score - Score value (0-100)
 * @returns Human-readable label
 */
export function getScoreLabelFromValue(
  score: number
): (typeof SCORE_LABELS)[keyof typeof SCORE_LABELS] {
  if (score >= 90) return SCORE_LABELS.EXCELLENT;
  if (score >= QUALITY_THRESHOLDS.PASS) return SCORE_LABELS.GOOD;
  if (score >= QUALITY_THRESHOLDS.WARN) return SCORE_LABELS.NEEDS_ATTENTION;
  return SCORE_LABELS.POOR;
}

/**
 * Check if a score passes the quality gate.
 * @param score - Score value (0-100)
 * @returns true if score >= QUALITY_THRESHOLDS.PASS (80)
 */
export function passesQualityGate(score: number): boolean {
  return score >= QUALITY_THRESHOLDS.PASS;
}

/**
 * Format score for display with consistent decimal places.
 * @param score - Raw score value
 * @param detailed - If true, shows 1 decimal place; otherwise integer
 * @returns Formatted score string
 */
export function formatScore(score: number, detailed = false): string {
  if (detailed) {
    return score.toFixed(1);
  }
  return Math.round(score).toString();
}

/**
 * Safe score calculation that guards against NaN and infinity.
 * @param numerator - The numerator
 * @param denominator - The denominator
 * @param fallback - Fallback value if division fails (default: 0)
 * @returns Safe score value
 */
export function safeScoreCalc(
  numerator: number,
  denominator: number,
  fallback = 0
): number {
  if (denominator === 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Clamp score to valid range (0-100).
 * @param score - Raw score value
 * @returns Score clamped to 0-100
 */
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

export type ScoreColor = (typeof SCORE_COLORS)[keyof typeof SCORE_COLORS];
export type ScoreLabel = (typeof SCORE_LABELS)[keyof typeof SCORE_LABELS];
