/**
 * Proposal generation utilities.
 * Phase 30-02: AI Lithuanian Generation
 *
 * Exports the Gemini-based Lithuanian proposal content generator.
 */

export {
  // Client
  getGeminiClient,
  resetGeminiClient,
  checkRateLimit,

  // Brand Voice
  LITHUANIAN_TERMINOLOGY,
  TERMS_KEEP_ENGLISH,
  FORBIDDEN_PHRASES,
  ENTHUSIASM_LEVELS,
  FORMALITY_LEVELS,
  DEFAULT_TONE_GUIDELINES,
  validateBrandVoiceConfig,
  buildSystemPrompt,

  // Data Transformation
  transformProspectToGenerationData,

  // Prompt Builders
  buildHeroPrompt,
  buildCurrentStatePrompt,
  buildOpportunitiesPrompt,
  buildRoiPrompt,
  buildInvestmentPrompt,
  buildNextStepsPrompt,

  // Generation Service
  generateProposalSegment,
  generateFullProposal,
  generateProposalContent,

  // Types
  type BrandVoiceConfig,
  type ToneGuidelines,
  type EnthusiasmLevel,
  type FormalityLevel,
  type ProspectGenerationData,
  type PricingConfig,
  type SegmentType,
  type GeneratedProposalContent,
} from "./gemini";
