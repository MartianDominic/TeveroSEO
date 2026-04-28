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
} from "./runner";

// Re-export scoring
export { calculateOnPageScore } from "./scoring";

// Re-export tier-specific functions
export { tier1Checks, TIER1_CHECK_COUNT } from "./tier1";
export { getTier2Checks, TIER_2_CHECK_IDS, verifyTier2Registration } from "./tier2";
export { getTier3Checks, TIER_3_CHECK_IDS, verifyTier3Registration } from "./tier3";
export { getTier4Checks, TIER_4_CHECK_IDS, verifyTier4Registration } from "./tier4";

/** Total expected checks across all tiers */
export const TOTAL_CHECK_COUNT = 107;

/**
 * Verify all checks are registered.
 */
export function verifyAllRegistration(): {
  valid: boolean;
  totalRegistered: number;
  byTier: Record<number, number>;
} {
  const tier1 = getChecksByTier(1).length;
  const tier2 = getChecksByTier(2).length;
  const tier3 = getChecksByTier(3).length;
  const tier4 = getChecksByTier(4).length;
  const total = tier1 + tier2 + tier3 + tier4;

  return {
    valid: total === TOTAL_CHECK_COUNT,
    totalRegistered: total,
    byTier: { 1: tier1, 2: tier2, 3: tier3, 4: tier4 },
  };
}
