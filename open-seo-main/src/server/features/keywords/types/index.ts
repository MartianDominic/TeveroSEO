/**
 * Keyword Intelligence Types - Central Export
 *
 * Re-exports all types from the keyword intelligence system.
 * Import from this file for clean, single-point type access.
 *
 * @example
 * ```typescript
 * import {
 *   KeywordAnalysisResult,
 *   ClassificationResult,
 *   ContentHashes,
 *   DataSource,
 * } from '@/server/features/keywords/types';
 * ```
 */

// =============================================================================
// Content Hashing Types
// =============================================================================
export {
  ChangeType,
  DEFAULT_HASH_FIELD_CONFIG,
  type HashFieldConfig,
  type HashResult,
  type ProductData,
} from './hashing';

// =============================================================================
// Embedding Types
// =============================================================================
export {
  EmbeddingModel,
  EmbeddingType,
  isNormalized,
  isValidEmbeddingConfig,
  isValidEmbeddingModel,
  validateDimension,
  type BatchEmbeddingResult,
  type EmbedOptions,
  type EmbeddingCache,
  type EmbeddingConfig,
  type EmbeddingMetadata,
  type EmbeddingModelProvider,
  type EmbeddingResult,
} from './embeddings';

// =============================================================================
// Validation Types
// =============================================================================
export {
  DEFAULT_VALIDATION_CONFIG,
  type SuggestedAction,
  type ValidationConfig,
  type ValidationReason,
  type ValidationResult,
} from './validation';

// =============================================================================
// Task Routing Types
// =============================================================================
export {
  accumulateCost,
  createCostAccumulator,
  DataSource,
  generateCacheKey,
  isValidDataSource,
  isValidTask,
  isValidTaskType,
  type CacheTTLTable,
  type CostAccumulator,
  type CostTable,
  type KeywordTask,
  type RoutingTable,
  type TaskResult,
  type TaskType,
} from './tasks';

// =============================================================================
// Singleflight Types
// =============================================================================
export {
  DEFAULT_SINGLEFLIGHT_CONFIG,
  SINGLEFLIGHT_KEYS,
  type CacheKeyComponents,
  type ClassificationResult,
  type ClassifierFn,
  type SingleflightConfig,
  type SingleflightEvent,
  type SingleflightRole,
} from './singleflight';

// =============================================================================
// Circuit Breaker Types
// =============================================================================
export {
  CircuitBreakerOpenError,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type CircuitState,
} from './circuit-breaker';

// =============================================================================
// Focus Directive Types
// =============================================================================
export {
  getActiveItems,
  isValidFocusDirective,
  requiresReview,
  toScoringWeights,
  type Ambiguity,
  type AttributePriority,
  type AttributeSuppression,
  type BrandAction,
  type BrandPriority,
  type BrandSuppression,
  type CategoryPriority,
  type CategorySuppression,
  type Contradiction,
  type FocusDirective,
  type FocusDirectiveMetadata,
  type LithuanianVariant,
  type LithuanianVariants,
  type NormalizedPriorityItem,
  type Priorities,
  type Quarter,
  type ScoringWeights,
  type Season,
  type Suppressions,
  type TemporalContext,
  type TemporalScope,
  type VolumePreference,
  type VolumeStrategy,
} from './focus-directive';

// =============================================================================
// Orchestration Types (Main Service)
// =============================================================================
export {
  DEFAULT_KEYWORD_INTELLIGENCE_CONFIG,
  type BatchAnalysisResult,
  type GapResult,
  type KeywordAnalysisInput,
  type KeywordAnalysisResult,
  type KeywordIntelligenceConfig,
  type KeywordIntelligenceStats,
  type ProductMatch,
  type ProductMatchInput,
} from './orchestration';
