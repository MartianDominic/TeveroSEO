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

export {
  CannibalizationService,
  detectKeywordCannibalization,
} from "./services/CannibalizationService";
export type {
  CannibalizationIssue,
  CannibalizationResult,
} from "./services/CannibalizationService";

// Repositories
export { LinkRepository, createLinkRepository } from "./repositories/LinkRepository";
