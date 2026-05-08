/**
 * Internal linking feature exports.
 * Phase 35-04 & 35-05
 */

// Services
export { VelocityService, checkLinkVelocity } from "./services/VelocityService";
export type {
  LinkVelocitySettings,
  VelocityCheckResult,
  VelocityStats,
} from "./services/VelocityService";

export { LinkSuggestionService } from "./services/LinkSuggestionService";
export type {
  GenerateSuggestionParams,
  AutoApplicableParams,
  InsertionMethod,
} from "./services/LinkSuggestionService";

export { LinkApplyService } from "./services/LinkApplyService";
export type { ApplyResult, ConnectionService } from "./services/LinkApplyService";

// Re-export unified CannibalizationService from analytics module
// Phase 35 service is now unified with Phase 96 in analytics/services/CannibalizationService.ts
export {
  CannibalizationService,
  getCannibalizationService,
  detectKeywordCannibalization,
  isTargetCannibalized,
} from "@/server/features/analytics/services/CannibalizationService";
export type {
  CannibalizationIssue,
  DetectionResult as CannibalizationResult,
  DetectionOptions,
  CannibalizingPage,
} from "@/server/features/analytics/services/CannibalizationService";

// Repositories
export { LinkRepository, createLinkRepository } from "./repositories/LinkRepository";
