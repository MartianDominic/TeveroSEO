/**
 * SEO Checks Index
 * Phase 32: 107 SEO Checks Implementation
 *
 * Central export for all check tiers, runner, and scoring.
 */

// Import tier modules to trigger check registration
import "./tier1";
import "./tier2";
import "./tier3";
import "./tier4";
import "./tier5";

// Re-export registry functions
export {
  registerCheck,
  getChecksByTier,
  getChecksByCategory,
  getCheckById,
  getAllChecks,
  clearRegistry,
} from "./registry";

// Import for use in verifyAllRegistration
import { getChecksByTier } from "./registry";

// Re-export types
export type {
  CheckResult,
  CheckContext,
  CheckDefinition,
  CheckSeverity,
  CheckTier,
  CheckCategory,
  ScoreResult,
  ScoreBreakdown,
  RunChecksOptions,
  SiteContext,
  ExtendedPageAnalysis,
} from "./types";

// Re-export runner functions
export {
  runChecks,
  runTier1Checks,
  runTier2Checks,
  runLocalChecks,
  runTier5Checks,
  runTier5ChecksWithContext,
} from "./runner";
export type { ExtendedRunChecksOptions, Tier5ChecksOptions } from "./runner";

// Re-export scoring and quality gate functions
export {
  calculateOnPageScore,
  passesQualityGate,
  evaluateQualityGate,
  QUALITY_GATE_THRESHOLD,
} from "./scoring";
export type { QualityGateResult } from "./scoring";

// Re-export tier-specific functions
export { tier1Checks, TIER1_CHECK_COUNT } from "./tier1";
export { getTier2Checks, TIER_2_CHECK_IDS, verifyTier2Registration } from "./tier2";
export { getTier3Checks, TIER_3_CHECK_IDS, verifyTier3Registration, clearCruxCache } from "./tier3";
export { getTier4Checks, TIER_4_CHECK_IDS, verifyTier4Registration } from "./tier4";
export { getTier5Checks, TIER_5_CHECK_IDS, verifyTier5Registration, TIER5_CHECK_COUNT } from "./tier5";

/**
 * Total expected checks across all tiers.
 * Tier 1: 84 checks (T1-01 to T1-68 + T1-70 to T1-85 Phase 92 page structure)
 * Tier 2: 21 checks (T2-01 to T2-21)
 * Tier 3: 13 checks (T3-01 to T3-13)
 * Tier 4: 7 checks (T4-01 to T4-07)
 * Tier 5: 13 checks (T5-01 to T5-13, LLM-based quality checks)
 * Total: 138 checks
 */
export const TOTAL_CHECK_COUNT = 138;

/**
 * Check count by tier for documentation and validation.
 */
export const CHECK_COUNTS_BY_TIER = {
  1: 84, // T1-01 to T1-68 + T1-70 to T1-85 (Phase 92 page structure)
  2: 21, // T2-01 to T2-21
  3: 13, // T3-01 to T3-13
  4: 7, // T4-01 to T4-07
  5: 13, // T5-01 to T5-13 (LLM-based quality checks)
} as const;

/**
 * Verify all checks are registered.
 * Returns detailed information about registered vs expected checks.
 */
export function verifyAllRegistration(): {
  valid: boolean;
  totalRegistered: number;
  totalExpected: number;
  byTier: Record<number, { registered: number; expected: number; valid: boolean }>;
  missingCount: number;
  extraCount: number;
} {
  const tier1 = getChecksByTier(1).length;
  const tier2 = getChecksByTier(2).length;
  const tier3 = getChecksByTier(3).length;
  const tier4 = getChecksByTier(4).length;
  const tier5 = getChecksByTier(5).length;
  const total = tier1 + tier2 + tier3 + tier4 + tier5;

  const byTier = {
    1: { registered: tier1, expected: CHECK_COUNTS_BY_TIER[1], valid: tier1 === CHECK_COUNTS_BY_TIER[1] },
    2: { registered: tier2, expected: CHECK_COUNTS_BY_TIER[2], valid: tier2 === CHECK_COUNTS_BY_TIER[2] },
    3: { registered: tier3, expected: CHECK_COUNTS_BY_TIER[3], valid: tier3 === CHECK_COUNTS_BY_TIER[3] },
    4: { registered: tier4, expected: CHECK_COUNTS_BY_TIER[4], valid: tier4 === CHECK_COUNTS_BY_TIER[4] },
    5: { registered: tier5, expected: CHECK_COUNTS_BY_TIER[5], valid: tier5 === CHECK_COUNTS_BY_TIER[5] },
  };

  const missingCount = Math.max(0, TOTAL_CHECK_COUNT - total);
  const extraCount = Math.max(0, total - TOTAL_CHECK_COUNT);

  return {
    valid: total === TOTAL_CHECK_COUNT,
    totalRegistered: total,
    totalExpected: TOTAL_CHECK_COUNT,
    byTier,
    missingCount,
    extraCount,
  };
}
