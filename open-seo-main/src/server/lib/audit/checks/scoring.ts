/**
 * SEO score calculator with hard gates.
 * Phase 32: 107 SEO Checks Implementation
 *
 * Scoring formula:
 * - Base: 60 points (fundamentals present)
 * - Tier 1: +0.3 per pass, max 20 points
 * - Tier 2: +0.5 per pass, max 10 points
 * - Tier 3: +0.8 per pass, max 6 points
 * - Tier 4: +0.4 per pass, max 4 points
 * - Total max: 60 + 20 + 10 + 6 + 4 = 100 (normalized)
 *
 * Hard gates (cap score regardless of other factors) - evaluated in precedence order:
 * 1. noindex (T1-67 fail) -> max 0 (highest priority)
 * 2. Duplicate content >60% (T4-06 fail with duplicatePercent > 60) -> max 50
 * 3. No author on YMYL (T1-68 fail) -> max 60
 * 4. CWV Poor (T3-01/02/03 critical fail, not skipped) -> max 75 (lowest priority)
 *
 * Note: Skipped checks (severity="info" with skipped=true in details) are excluded
 * from scoring and do not trigger gates.
 */
import type { CheckResult, ScoreResult, ScoreBreakdown } from "./types";

/**
 * Quality gate threshold for auto-publish eligibility.
 * Content must score >= 80 to be eligible for auto-publishing.
 */
export const QUALITY_GATE_THRESHOLD = 80;

/**
 * Tier weights for score calculation.
 * Updated to include Tier 4 (Architecture & Quality).
 */
const TIER_WEIGHTS = {
  1: 0.3,
  2: 0.5,
  3: 0.8,
  4: 0.4, // Tier 4: Architecture & Quality
} as const;

/**
 * Tier max point contributions.
 * Normalized so total max = 100 (60 base + 40 variable).
 * Variable: 20 + 10 + 6 + 4 = 40 points
 */
const TIER_MAXES = {
  1: 20, // Tier 1: 67 checks * 0.3 weight, capped at 20
  2: 10, // Tier 2: 20 checks * 0.5 weight, capped at 10
  3: 6, // Tier 3: 13 checks * 0.8 weight = 10.4, capped at 6 (normalized)
  4: 4, // Tier 4: 7 checks * 0.4 weight = 2.8, capped at 4 (normalized)
} as const;

/** Base score for fundamentals */
const BASE_SCORE = 60;

/** Maximum possible raw score before normalization */
const MAX_RAW_SCORE = BASE_SCORE + TIER_MAXES[1] + TIER_MAXES[2] + TIER_MAXES[3] + TIER_MAXES[4];

/**
 * Check if a result represents a skipped check.
 * Skipped checks should not affect scoring.
 */
function isSkippedCheck(result: CheckResult): boolean {
  const details = result.details as { skipped?: boolean } | undefined;
  return result.severity === "info" && details?.skipped === true;
}

/**
 * Calculate on-page SEO score from check results.
 * Skipped checks are excluded from scoring calculations.
 * Score is normalized to never exceed 100.
 */
export function calculateOnPageScore(results: CheckResult[]): ScoreResult {
  const gates: string[] = [];

  // Filter out skipped checks for scoring purposes
  const activeResults = results.filter((r) => !isSkippedCheck(r));

  // Count passed checks by tier (extract tier from checkId: "T1-01" -> 1)
  const tier1Passed = activeResults.filter((r) => r.checkId.startsWith("T1-") && r.passed).length;
  const tier2Passed = activeResults.filter((r) => r.checkId.startsWith("T2-") && r.passed).length;
  const tier3Passed = activeResults.filter((r) => r.checkId.startsWith("T3-") && r.passed).length;
  const tier4Passed = activeResults.filter((r) => r.checkId.startsWith("T4-") && r.passed).length;

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

  // Calculate raw score and normalize to 100 max
  const rawScore = BASE_SCORE + tier1Points + tier2Points + tier3Points + tier4Points;
  let score = Math.min(100, rawScore);

  // Apply hard gates in precedence order (highest priority first)
  // Gates are applied to the already-capped score

  // Gate 1 (highest priority): noindex (T1-67 fail) -> cap at 0
  // T1-67 specifically checks for noindex meta tag
  // Only trigger if not skipped
  const noindexCheck = activeResults.find((r) => r.checkId === "T1-67");
  if (noindexCheck && !noindexCheck.passed) {
    score = 0;
    gates.push("noindex");
    // Return early - no point calculating further
    return { score: 0, gates, breakdown };
  }

  // Gate 2: Duplicate content >60% -> cap at 50
  // T4-06 returns duplicatePercent in details when comparison data is available
  // Only trigger if not skipped
  const duplicateCheck = activeResults.find((r) => r.checkId === "T4-06");
  if (duplicateCheck && !duplicateCheck.passed) {
    const details = duplicateCheck.details as { duplicatePercent?: number } | undefined;
    if (details?.duplicatePercent && details.duplicatePercent > 60) {
      score = Math.min(50, score);
      gates.push("duplicate-content");
    }
  }

  // Gate 3: No author on YMYL (T1-68 fail) -> cap at 60
  // T1-68 checks for author attribution on YMYL pages
  // Only trigger if not skipped
  const ymylAuthorCheck = activeResults.find((r) => r.checkId === "T1-68");
  if (ymylAuthorCheck && !ymylAuthorCheck.passed) {
    score = Math.min(60, score);
    gates.push("ymyl-no-author");
  }

  // Gate 4 (lowest priority): CWV Poor (T3-01/02/03 critical fail) -> cap at 75
  // CWV checks return severity "critical" when metrics are in "poor" range
  // Skipped CWV checks (no API key or no data) do NOT trigger this gate
  const cwvChecks = activeResults.filter((r) => ["T3-01", "T3-02", "T3-03"].includes(r.checkId));
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

/**
 * Check if a score passes the quality gate for auto-publishing.
 * @param score The SEO score (0-100)
 * @returns true if score >= QUALITY_GATE_THRESHOLD (80)
 */
export function passesQualityGate(score: number): boolean {
  return score >= QUALITY_GATE_THRESHOLD;
}

/**
 * Quality gate result with detailed information.
 */
export interface QualityGateResult {
  /** Whether the content passes the quality gate */
  passed: boolean;
  /** The SEO score */
  score: number;
  /** The quality gate threshold */
  threshold: number;
  /** Points needed to pass (0 if already passing) */
  pointsNeeded: number;
  /** Active gates that may be capping the score */
  gates: string[];
  /** Whether auto-publish is eligible */
  autoPublishEligible: boolean;
}

/**
 * Evaluate quality gate for auto-publish eligibility.
 * Returns detailed information about whether content can be auto-published.
 */
export function evaluateQualityGate(scoreResult: ScoreResult): QualityGateResult {
  const passed = passesQualityGate(scoreResult.score);
  const pointsNeeded = passed ? 0 : QUALITY_GATE_THRESHOLD - scoreResult.score;

  return {
    passed,
    score: scoreResult.score,
    threshold: QUALITY_GATE_THRESHOLD,
    pointsNeeded,
    gates: scoreResult.gates,
    // Auto-publish is only eligible if score passes AND no blocking gates are active
    autoPublishEligible: passed && scoreResult.gates.length === 0,
  };
}
