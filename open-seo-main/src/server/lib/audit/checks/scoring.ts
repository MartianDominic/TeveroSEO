/**
 * SEO score calculator with hard gates.
 * Phase 32: 107 SEO Checks Implementation
 *
 * Scoring formula:
 * - Base: 60 points (fundamentals present)
 * - Tier 1: +0.3 per pass, max 20 points
 * - Tier 2: +0.5 per pass, max 10 points
 * - Tier 3: +0.8 per pass, max 10 points
 *
 * Hard gates (cap score regardless of other factors):
 * - noindex (T1-67 fail) -> max 0
 * - CWV Poor (T3-01/02/03 critical fail) -> max 75
 * - No author on YMYL (T1-68 fail) -> max 60
 * - Duplicate content >60% (T4-06 fail with duplicatePercent > 60) -> max 50
 */
import type { CheckResult, ScoreResult, ScoreBreakdown } from "./types";

/**
 * Tier weights for score calculation.
 * Updated to include Tier 4 (Architecture & Quality).
 * Total weights: 0.3 + 0.5 + 0.8 + 0.4 = 2.0
 * Normalized in max calculation below.
 */
const TIER_WEIGHTS = {
  1: 0.3,
  2: 0.5,
  3: 0.8,
  4: 0.4, // Tier 4: Architecture & Quality
} as const;

/**
 * Tier max point contributions.
 * Updated to include Tier 4 checks.
 */
const TIER_MAXES = {
  1: 20,
  2: 10,
  3: 10,
  4: 4, // Tier 4: 9 checks * 0.4 weight, capped at 4 points
} as const;

/** Base score for fundamentals */
const BASE_SCORE = 60;

/**
 * Calculate on-page SEO score from check results.
 */
export function calculateOnPageScore(results: CheckResult[]): ScoreResult {
  const gates: string[] = [];

  // Count passed checks by tier (extract tier from checkId: "T1-01" -> 1)
  const tier1Passed = results.filter((r) => r.checkId.startsWith("T1-") && r.passed).length;
  const tier2Passed = results.filter((r) => r.checkId.startsWith("T2-") && r.passed).length;
  const tier3Passed = results.filter((r) => r.checkId.startsWith("T3-") && r.passed).length;
  const tier4Passed = results.filter((r) => r.checkId.startsWith("T4-") && r.passed).length;

  // Calculate tier contributions
  const tier1Points = Math.min(TIER_MAXES[1], tier1Passed * TIER_WEIGHTS[1]);
  const tier2Points = Math.min(TIER_MAXES[2], tier2Passed * TIER_WEIGHTS[2]);
  const tier3Points = Math.min(TIER_MAXES[3], tier3Passed * TIER_WEIGHTS[3]);
  const tier4Points = Math.min(TIER_MAXES[4], tier4Passed * TIER_WEIGHTS[4]);

  const breakdown: ScoreBreakdown = {
    base: BASE_SCORE,
    tier1: tier1Points,
    tier2: tier2Points,
    tier3: tier3Points,
    tier4: tier4Points,
  };

  // Raw score before gates (max: 60 + 20 + 10 + 10 + 4 = 104, normalized to 100)
  let score = BASE_SCORE + tier1Points + tier2Points + tier3Points + tier4Points;

  // Apply hard gates (check BEFORE final score)

  // Gate 1: noindex (T1-67 fail) -> cap at 0
  // T1-67 specifically checks for noindex meta tag
  const noindexCheck = results.find((r) => r.checkId === "T1-67");
  if (noindexCheck && !noindexCheck.passed) {
    score = 0;
    gates.push("noindex");
    // Return early - no point calculating further
    return { score: 0, gates, breakdown };
  }

  // Gate 2: Duplicate content >60% -> cap at 50
  // T4-06 returns duplicatePercent in details when comparison data is available
  const duplicateCheck = results.find((r) => r.checkId === "T4-06");
  if (duplicateCheck && !duplicateCheck.passed) {
    const details = duplicateCheck.details as { duplicatePercent?: number } | undefined;
    if (details?.duplicatePercent && details.duplicatePercent > 60) {
      score = Math.min(50, score);
      gates.push("duplicate-content");
    }
  }

  // Gate 3: No author on YMYL (T1-68 fail) -> cap at 60
  // T1-68 checks for author attribution on YMYL pages
  const ymylAuthorCheck = results.find((r) => r.checkId === "T1-68");
  if (ymylAuthorCheck && !ymylAuthorCheck.passed) {
    score = Math.min(60, score);
    gates.push("ymyl-no-author");
  }

  // Gate 4: CWV Poor (T3-01/02/03 critical fail) -> cap at 75
  // CWV checks return severity "critical" when metrics are in "poor" range
  const cwvChecks = results.filter((r) => ["T3-01", "T3-02", "T3-03"].includes(r.checkId));
  if (cwvChecks.some((r) => !r.passed && r.severity === "critical")) {
    score = Math.min(75, score);
    gates.push("cwv-poor");
  }

  return {
    score: Math.round(score),
    gates,
    breakdown,
  };
}
