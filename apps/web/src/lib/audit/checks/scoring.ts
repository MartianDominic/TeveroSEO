/**
 * SEO Score Calculator
 *
 * Calculates overall SEO score from check results.
 * Uses weighted scoring by tier and severity.
 */

import type { CheckResult, ScoreResult, ScoreBreakdown, CheckTier } from "./types";
import { getTierFromCheckId, CHECK_COUNTS } from "./definitions";

/**
 * Severity weights for score calculation
 */
const SEVERITY_WEIGHTS = {
  critical: 10,
  high: 5,
  medium: 3,
  low: 1,
  info: 0,
};

/**
 * Tier weights for score calculation
 */
const TIER_WEIGHTS = {
  1: 1.5, // T1 checks are most important
  2: 1.2, // T2 checks are important
  3: 1.0, // T3 checks are standard
  4: 0.8, // T4 checks are advanced
};

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
 * Calculate score breakdown by tier
 */
function calculateTierScore(results: CheckResult[], tier: CheckTier): number {
  const tierResults = results.filter(
    (r) => getTierFromCheckId(r.checkId) === tier
  );

  if (tierResults.length === 0) {
    return 100;
  }

  const passed = tierResults.filter((r) => r.passed).length;
  return Math.round((passed / tierResults.length) * 100);
}

/**
 * Calculate weighted score from results
 */
function calculateWeightedScore(results: CheckResult[]): number {
  if (results.length === 0) {
    return 100;
  }

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const result of results) {
    const tier = getTierFromCheckId(result.checkId);
    const severityWeight = SEVERITY_WEIGHTS[result.severity];
    const tierWeight = TIER_WEIGHTS[tier];
    const checkWeight = severityWeight * tierWeight;

    totalWeight += checkWeight;

    if (result.passed) {
      earnedWeight += checkWeight;
    }
  }

  if (totalWeight === 0) {
    return 100;
  }

  return Math.round((earnedWeight / totalWeight) * 100);
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
 */
export function calculateOnPageScore(results: CheckResult[]): ScoreResult {
  // Calculate score breakdown by tier
  const breakdown: ScoreBreakdown = {
    tier1: calculateTierScore(results, 1),
    tier2: calculateTierScore(results, 2),
    tier3: calculateTierScore(results, 3),
    tier4: calculateTierScore(results, 4),
  };

  // Calculate weighted overall score
  let score = calculateWeightedScore(results);

  // Get failed gates
  const gates = getFailedGates(results);

  // Apply gate penalties
  // Each gate failure reduces max possible score
  if (gates.length > 0) {
    const gatePenalty = gates.length * 5;
    score = Math.max(0, score - gatePenalty);
  }

  return {
    score,
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
 */
export function getScoreColor(score: number): "green" | "yellow" | "orange" | "red" {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}
