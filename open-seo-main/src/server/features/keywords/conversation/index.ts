/**
 * Conversation Intelligence Module
 *
 * Extracts structured AnalysisConstraints from client conversations
 * using Claude Sonnet 4.6.
 *
 * @module conversation
 */

// Type exports
export type {
  AnalysisConstraints,
  BusinessContext,
  GeoConstraints,
  AudienceConstraints,
  FunnelConfig,
  Priority,
  NegativeFilters,
  SpecialModes,
  ConfidenceScores,
  ExtractionResult,
} from "./types";

// Schema exports
export {
  AnalysisConstraintsSchema,
  BusinessContextSchema,
  GeoConstraintsSchema,
  AudienceConstraintsSchema,
  FunnelConfigSchema,
  PrioritySchema,
  NegativeFiltersSchema,
  SpecialModesSchema,
  ConfidenceScoresSchema,
  ExtractionResultSchema,
  isValidAnalysisConstraints,
} from "./types";

// Prompt exports
export { CONSTRAINT_EXTRACTION_PROMPT, buildExtractionPrompt } from "./prompts";

// Service exports
export type { ExtractorConfig } from "./ConstraintExtractor";
export {
  ConstraintExtractor,
  createConstraintExtractor,
  getDefaultExtractor,
} from "./ConstraintExtractor";
