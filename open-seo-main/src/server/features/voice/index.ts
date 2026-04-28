/**
 * Voice feature barrel export.
 * Phase 37: Brand Voice Management
 */

// Types
export type {
  ExtractedVoiceDimensions,
  VoiceExtractionResult,
  VoiceAnalysisJobData,
  VoiceAnalysisProgress,
  VoiceAnalysisDLQJobData,
} from "./types";

// Phase 37-04: Compliance and constraint types
export type {
  ComplianceScore,
  ComplianceViolation,
} from "./services/VoiceComplianceService";

export type { VoiceConstraintOptions } from "./services/VoiceConstraintBuilder";

// Services
export { analyzePageVoice, aggregateVoiceResults, buildVoicePrompt } from "./services/VoiceAnalyzer";

// Phase 37-03: Profile and rules services
export { voiceProfileService } from "./services/VoiceProfileService";
export { protectionRulesService } from "./services/ProtectionRulesService";
export { voiceTemplateService } from "./services/VoiceTemplateService";

// Phase 37-04: Compliance and constraint services
export {
  VoiceComplianceService,
  voiceComplianceService,
} from "./services/VoiceComplianceService";

export {
  VoiceConstraintBuilder,
  buildVoiceConstraints,
} from "./services/VoiceConstraintBuilder";
