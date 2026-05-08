/**
 * CannibalizationService - Re-export from Unified Service
 * Phase 35-05: Cannibalization Detection
 *
 * This file is maintained for backward compatibility.
 * The unified CannibalizationService is now located at:
 * @see src/server/features/analytics/services/CannibalizationService.ts
 *
 * @deprecated Import from @/server/features/analytics/services/CannibalizationService instead
 */

// Re-export everything from the unified service
export {
  CannibalizationService,
  getCannibalizationService,
  resetCannibalizationService,
  detectCannibalization,
  getCannibalizationForQuery,
  getSeverityBreakdown,
  detectKeywordCannibalization,
  isTargetCannibalized,
} from "@/server/features/analytics/services/CannibalizationService";

export type {
  CannibalizationResult,
  CannibalizingPage,
  CannibalizationFilters,
  SeverityBreakdown,
  CannibalizationIssue,
  DetectionOptions,
  DetectionResult,
  DetectionSummary,
  DetectionMetadata,
  ImpactEstimate,
  Recommendation,
} from "@/server/features/analytics/services/CannibalizationService";
