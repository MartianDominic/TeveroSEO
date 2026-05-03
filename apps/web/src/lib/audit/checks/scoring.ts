/**
 * SEO Score Calculator
 *
 * Calculates overall SEO score from check results.
 * Aligns with open-seo-main scoring formula.
 * FIX-14: Quality Gate & Scoring Standardization
 */

import type { CheckResult, ScoreResult, ScoreBreakdown, CheckTier } from "./types";
import { QUALITY_THRESHOLDS, clampScore } from "@tevero/types";

/**
 * Tier weights for score calculation (points per passed check)
 * Aligns with open-seo-main scoring formula
 */
const TIER_WEIGHTS = {
  1: 0.3, // T1: max 20 points
  2: 0.5, // T2: max 10 points
  3: 0.8, // T3: max 10 points
  4: 0.0, // T4: gates only, no direct score contribution
};

/**
 * Tier maximums for score contribution
 */
const TIER_MAXES = {
  1: 20,
  2: 10,
  3: 10,
  4: 0,
};

/**
 * Base score for fundamentals
 */
const BASE_SCORE = 60;

/**
 * Gates that block a good score if failed
 */
const GATE_CHECKS = [
  "T1-01", // Title Present
  "T1-02", // Meta Description Present
  "T1-03", // H1 Present
  "T3-06", // Broken Internal Links
  "T3-19", // Robots Meta Tag
  "T3-22", // No Noindex
  "T4-11", // Mobile Friendly
  "T4-16", // HTTPS Enabled
];

/**
 * Calculate tier points (capped at tier max)
 */
function calculateTierPoints(results: CheckResult[], tier: CheckTier): number {
  const tierPrefix = `T${tier}-`;
  const passed = results.filter(
    (r) => r.checkId.startsWith(tierPrefix) && r.passed
  ).length;

  const points = passed * TIER_WEIGHTS[tier];
  return Math.min(TIER_MAXES[tier], points);
}

/**
 * Identify failed gates
 */
function getFailedGates(results: CheckResult[]): string[] {
  const gates: string[] = [];

  for (const checkId of GATE_CHECKS) {
    const result = results.find((r) => r.checkId === checkId);
    if (result && !result.passed) {
      gates.push(checkIdToGateName(checkId));
    }
  }

  return gates;
}

/**
 * Convert check ID to human-readable gate name
 */
function checkIdToGateName(checkId: string): string {
  const gateNames: Record<string, string> = {
    "T1-01": "missing-title",
    "T1-02": "missing-meta-description",
    "T1-03": "missing-h1",
    "T3-06": "broken-internal-links",
    "T3-19": "robots-blocked",
    "T3-22": "noindexed",
    "T4-11": "not-mobile-friendly",
    "T4-16": "not-https",
  };

  return gateNames[checkId] ?? checkId;
}

/**
 * Calculate overall SEO score from check results
 * Aligns with open-seo-main scoring formula:
 * - Base: 60 points (fundamentals present)
 * - Tier 1: +0.3 per pass, max 20 points
 * - Tier 2: +0.5 per pass, max 10 points
 * - Tier 3: +0.8 per pass, max 10 points
 */
export function calculateOnPageScore(results: CheckResult[]): ScoreResult {
  const gates: string[] = [];

  // Calculate tier contributions
  const tier1Points = calculateTierPoints(results, 1);
  const tier2Points = calculateTierPoints(results, 2);
  const tier3Points = calculateTierPoints(results, 3);
  const tier4Points = calculateTierPoints(results, 4);

  const breakdown: ScoreBreakdown = {
    base: BASE_SCORE,
    tier1: tier1Points,
    tier2: tier2Points,
    tier3: tier3Points,
    tier4: tier4Points,
  };

  // Raw score before gates
  let score = BASE_SCORE + tier1Points + tier2Points + tier3Points;

  // Apply hard gates

  // Gate 1: noindex (T1-55 fail) -> cap at 0
  const noindexCheck = results.find((r) => r.checkId === "T1-55");
  if (noindexCheck && !noindexCheck.passed) {
    return { score: 0, gates: ["noindex"], breakdown };
  }

  // Gate 2: Duplicate content >60% -> cap at 50
  const duplicateCheck = results.find((r) => r.checkId === "T4-06");
  if (duplicateCheck && !duplicateCheck.passed) {
    const details = duplicateCheck.details as { duplicatePercent?: number } | undefined;
    if (details?.duplicatePercent && details.duplicatePercent > 60) {
      score = Math.min(50, score);
      gates.push("duplicate-content");
    }
  }

  // Gate 3: No author on YMYL -> cap at 60
  const ymylAuthorCheck = results.find((r) => r.checkId === "T2-17");
  if (ymylAuthorCheck && !ymylAuthorCheck.passed) {
    score = Math.min(60, score);
    gates.push("ymyl-no-author");
  }

  // Gate 4: CWV Poor (T3-01/02/03 critical fail) -> cap at 75
  const cwvChecks = results.filter((r) => ["T3-01", "T3-02", "T3-03"].includes(r.checkId));
  if (cwvChecks.some((r) => !r.passed && r.severity === "critical")) {
    score = Math.min(75, score);
    gates.push("cwv-poor");
  }

  // Add legacy gate checks for backwards compatibility
  const legacyGates = getFailedGates(results);
  for (const gate of legacyGates) {
    if (!gates.includes(gate)) {
      gates.push(gate);
    }
  }

  return {
    score: Math.round(score),
    gates,
    breakdown,
  };
}

/**
 * Get score grade from numeric score
 */
export function getScoreGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Get score color for UI
 * FIX-14: Standardized color thresholds (Red: 0-49, Yellow: 50-79, Green: 80-100)
 */
export function getScoreColor(score: number): "green" | "yellow" | "red" {
  if (score >= QUALITY_THRESHOLDS.PASS) return "green";  // >= 80
  if (score >= QUALITY_THRESHOLDS.WARN) return "yellow"; // >= 50
  return "red"; // < 50
}
