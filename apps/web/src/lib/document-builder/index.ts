/**
 * Document Builder Public API
 * Phase 102: Barrel file for document-builder module
 *
 * Exports only the public API for external consumers.
 * Internal utilities should not be imported directly from submodules.
 */

// ---------------------------------------------------------------------------
// Types - Core type definitions
// ---------------------------------------------------------------------------

export type {
  PersuasionBlockType,
  PersuasionMeta,
  ExtendedEditorSection,
  TemplateContentMode,
  TipTapContent,
  TemplateBlock,
  BlockStyling,
  BlockVariantStatus,
  BlockVariant,
  StructureBlockRef,
  FrameworkValidation,
  StructureLayer,
  ContentBlock,
  ContentLayer,
  ProspectContext,
  StyleReference,
  PreviousSuccess,
  ContextLayer,
  DocumentState,
  FrameworkTemplate,
  PersuasionBlock,
  // Block-specific content types
  PainAmplifierContent,
  VillainStoryContent,
  CredibilityContent,
  SocialProofContent,
  ProcessRevealContent,
  OfferStackContent,
  RiskReversalContent,
  ObjectionHandlerContent,
  UrgencyContent,
  CtaContent,
  CustomBlockContent,
  BlockSpecificContent,
  // Discriminated block types
  PainAmplifierBlock,
  VillainStoryBlock,
  CredibilityBlock,
  SocialProofBlock,
  ProcessRevealBlock,
  OfferStackBlock,
  RiskReversalBlock,
  ObjectionHandlerBlock,
  UrgencyBlock,
  CtaBlock,
  CustomBlock,
  TypedPersuasionBlock,
} from "./types";

export {
  PERSUASION_BLOCK_TYPES_ARRAY,
  // Type guards
  isBlockType,
  isPainAmplifierBlock,
  isSocialProofBlock,
  isCtaBlock,
  isCredibilityBlock,
  isOfferStackBlock,
} from "./types";

// ---------------------------------------------------------------------------
// Persuasion Blocks - Block metadata and templates
// ---------------------------------------------------------------------------

export {
  PERSUASION_BLOCK_TYPES,
  FRAMEWORK_TEMPLATES,
  getBlockTemplate,
  getBlockMetadata,
  getBlockDisplayInfo,
  getFrameworkTemplate,
  validateFrameworkCompliance,
  getFrameworkSequence,
  type PersuasionBlockMetadata,
  type BlockTypeDefinition,
  type BlockTypeColor,
} from "./persuasion-blocks";

// ---------------------------------------------------------------------------
// AI Generator - Content generation
// ---------------------------------------------------------------------------

export {
  generateBlockContent,
  buildPrompt,
  type GenerationRequest,
  type GenerationResponse,
} from "./ai-generator";

// ---------------------------------------------------------------------------
// Analytics Service - Block analytics and tracking
// ---------------------------------------------------------------------------

export {
  recordBlockView,
  recordBlockDwell,
  getBlockAnalytics,
  calculateCorrelation,
  markConversion,
  processBatchedEvents,
  getAnalyticsKeys,
  type BlockAnalytics,
  type CorrelationResult,
  type BlockInteraction,
} from "./analytics-service";

// ---------------------------------------------------------------------------
// Template Service - Framework templates
// ---------------------------------------------------------------------------

export {
  getAllFrameworkTemplates,
  applyFrameworkToCanvas,
  validateCanvasCompliance,
  getCanvasFrameworkSequence,
  isBlockRequired,
  getSuggestedNextBlock,
  type FrameworkValidationResult,
  type CanvasBlock,
} from "./template-service";

// ---------------------------------------------------------------------------
// Input Sanitizer - Security utilities (public for testing/reuse)
// ---------------------------------------------------------------------------

export {
  sanitizeForPrompt,
  containsInjectionPatterns,
} from "./input-sanitizer";

// ---------------------------------------------------------------------------
// Heatmap Calculator - Engagement scoring and visualization
// ---------------------------------------------------------------------------

export {
  calculateEngagementScore,
  getHeatLevel,
  getHeatColor,
  getHeatLabel,
  calculateHeatmapData,
  getHeatGradient,
  clearHeatmapCache,
  type HeatLevel,
  type HeatmapData,
} from "./heatmap-calculator";

// ---------------------------------------------------------------------------
// Analytics Sync Worker - Redis to Postgres sync
// ---------------------------------------------------------------------------

export {
  syncAnalytics,
  analyticsSyncWorker,
  type SyncResult,
} from "./analytics-sync-worker";

// ---------------------------------------------------------------------------
// Version Diff - Block and text diff utilities
// ---------------------------------------------------------------------------

export {
  computeBlockDiff,
  computeTextDiff,
  extractTextFromContent,
  getDiffSummary,
  hasChanges,
  type BlockDiffStatus,
  type TextDiffStatus,
  type BlockDiffItem,
  type TextDiffSegment,
  type BlockForDiff,
} from "./version-diff";

// ---------------------------------------------------------------------------
// A/B Testing Service - Variant assignment and significance
// ---------------------------------------------------------------------------

export {
  getVariantForProspect,
  calculateSignificance,
  normalizeWeights,
  validateWeights,
  canDeclareWinner,
  getStatusLabel,
  type ABTestResult,
  type CreateVariantRequest,
  type UpdateWeightsRequest,
} from "./ab-testing-service";
