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
 * - noindex (T1-55 fail) -> max 0
 * - CWV Poor (T3-01/02/03 critical fail) -> max 75
 * - No author on YMYL -> max 60
 * - Duplicate content >60% -> max 50
 */
import type { CheckResult, ScoreResult, ScoreBreakdown } from "./types";

/** Tier weights */
const TIER_WEIGHTS = {
  1: 0.3,
  2: 0.5,
  3: 0.8,
} as const;

/** Tier maximums */
const TIER_MAXES = {
  1: 20,
  2: 10,
  3: 10,
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

  // Calculate tier contributions
  const tier1Points = Math.min(TIER_MAXES[1], tier1Passed * TIER_WEIGHTS[1]);
  const tier2Points = Math.min(TIER_MAXES[2], tier2Passed * TIER_WEIGHTS[2]);
  const tier3Points = Math.min(TIER_MAXES[3], tier3Passed * TIER_WEIGHTS[3]);

  const breakdown: ScoreBreakdown = {
    base: BASE_SCORE,
    tier1: tier1Points,
    tier2: tier2Points,
    tier3: tier3Points,
  };

  // Raw score before gates
  let score = BASE_SCORE + tier1Points + tier2Points + tier3Points;

  // Apply hard gates (check BEFORE final score)

  // Gate 1: noindex (T1-55 fail) -> cap at 0
  const noindexCheck = results.find((r) => r.checkId === "T1-55");
  if (noindexCheck && !noindexCheck.passed) {
    score = 0;
    gates.push("noindex");
    // Return early - no point calculating further
    return { score: 0, gates, breakdown };
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

  return {
    score: Math.round(score),
    gates,
    breakdown,
  };
}
