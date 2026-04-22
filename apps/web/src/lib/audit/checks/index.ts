/**
 * SEO Checks Module
 *
 * Exports the runAllChecks facade and supporting types/utilities.
 */

// Main facade
export { runAllChecks } from "./facade";

// Types
export type {
  CheckSeverity,
  CheckTier,
  CheckCategory,
  CheckResult,
  ScoreResult,
  ScoreBreakdown,
  PageAnalysis,
  SiteContext,
  CheckOptions,
  CheckDefinition,
  AllChecksResult,
} from "./types";

// Runner (for advanced usage)
export { runChecks, parseHtml } from "./runner";

// Scoring (for advanced usage)
export { calculateOnPageScore, getScoreGrade, getScoreColor } from "./scoring";

// Definitions (for UI rendering)
export {
  CHECK_DEFINITIONS,
  getCheckById,
  getChecksByTier,
  getChecksByCategory,
  getTierFromCheckId,
  CHECK_COUNTS,
} from "./definitions";
