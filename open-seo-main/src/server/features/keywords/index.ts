/**
 * Keyword Intelligence Module
 *
 * Main entry point for the keyword intelligence system.
 * Exports all services, types, and factory functions.
 *
 * @example
 * ```typescript
 * import {
 *   createKeywordIntelligence,
 *   KeywordIntelligenceService,
 *   type KeywordAnalysisResult,
 * } from '@/server/features/keywords';
 *
 * const service = createKeywordIntelligence({
 *   clientId: 'client-123',
 *   claudeApiKey: process.env.ANTHROPIC_API_KEY,
 * });
 *
 * const results = await service.analyzeKeywords(
 *   'client-123',
 *   ['šampūnas', 'kondicionierius'],
 *   ['Hair Care', 'Styling'],
 * );
 * ```
 */

// =============================================================================
// Main Service (Primary Entry Point)
// =============================================================================
export {
  createKeywordIntelligence,
  createKeywordIntelligenceFromEnv,
  KeywordIntelligenceService,
} from './services/KeywordIntelligenceService';

// =============================================================================
// Individual Services (For Direct Use)
// =============================================================================

// Content Hashing - Delta crawling optimization
export { ContentHasher } from './services/ContentHasher';

// Embeddings - Semantic matching
export {
  cosineSimilarity,
  findTopK,
  getEmbeddingService,
  lightragEmbeddingFunc,
  resetEmbeddingService,
  UnifiedEmbeddingService,
} from './services/EmbeddingService';

// Lithuanian Normalization - Morphology handling
export {
  lithuanianNormalizer,
  LithuanianNormalizer,
  type LemmatizationResult,
  type LithuanianNormalizerOptions,
} from './services/LithuanianNormalizer';

// Page Validation - Consent/challenge detection
export {
  pageValidator,
  PageValidator,
} from './services/PageValidator';

// Task Routing - Data source optimization
export {
  createTaskRouter,
  TaskRouter,
  type BacklinksResult,
  type CrawlResult,
  type Crawler,
  type DataForSEOClient,
  type KeywordsForDomainResult,
  type SerpResult,
  type TaskCache,
  type TaskRouterConfig,
} from './services/TaskRouter';

// Classification Singleflight - Cross-tenant deduplication
export { ClassificationSingleflight } from './services/ClassificationSingleflight';

// Resilient Classifier - Fault-tolerant classification
export {
  createResilientClassifier,
  ResilientClassifier,
  RuleBasedClassifier,
  type ClassificationResult as ResilientClassificationResult,
  type ClassifierBackend,
  type ClassifierConfig,
} from './services/ResilientClassifier';

// Circuit Breaker - Graceful degradation
export {
  CircuitBreaker,
  CircuitOpenError,
  CircuitState,
  type CircuitBreakerConfig as ServiceCircuitBreakerConfig,
} from './services/CircuitBreaker';

// Business Priority Parser
export {
  BusinessPriorityParser,
  createBusinessPriorityParser,
  getDefaultParser,
} from './services/BusinessPriorityParser';

// Conversation Intelligence - Constraint extraction from conversations
export {
  ConstraintExtractor,
  createConstraintExtractor,
  getDefaultExtractor,
  type ExtractorConfig,
  type AnalysisConstraints,
  type BusinessContext,
  type GeoConstraints,
  type AudienceConstraints,
  type FunnelConfig,
  type Priority,
  type NegativeFilters,
  type SpecialModes,
  type ConfidenceScores,
  type ExtractionResult,
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
  CONSTRAINT_EXTRACTION_PROMPT,
  buildExtractionPrompt,
} from './conversation';

// =============================================================================
// Configuration
// =============================================================================

// Embedding configuration
export {
  EMBEDDING_CONFIG,
  EMBEDDING_CONFIG_COMPACT,
  EMBEDDING_CONFIG_E5,
  EMBEDDING_CONFIG_HIGH_QUALITY,
  getEmbeddingConfig,
  getNativeDim,
  getPassagePrefix,
  getQueryPrefix,
  getStorageDim,
  LIGHTRAG_EMBEDDING_DIM,
  LIGHTRAG_EMBEDDING_MODEL,
  VECTOR_DIMENSION,
} from './config/embeddings';

// Routing configuration
export {
  CACHE_TTL_PER_SOURCE,
  calculateSavings,
  COST_PER_SOURCE,
  createCacheTTLConfig,
  createCostConfig,
  createRoutingConfig,
  DATAFORSEO_PRICING,
  estimateBatchCost,
  getCacheTTL,
  LITHUANIAN_MARKET,
  RATE_LIMITS,
  requiresCrawling,
  ROUTING_TABLE,
  TARGET_DISTRIBUTION,
} from './config/routing';

// =============================================================================
// Data (Reference Data)
// =============================================================================

// Consent signatures for page validation
export {
  BOT_CHALLENGE_SIGNATURES,
  CONSENT_DOM_SELECTORS,
  CONSENT_SIGNATURES,
  MAIN_CONTENT_SELECTORS,
  PRODUCT_PAGE_INDICATORS,
} from './data/consent-signatures';

// Lithuanian lemmas for normalization
export {
  getLemmaMapStats,
  LEMMA_MAP,
  LITHUANIAN_DIACRITIC_MAP,
} from './data/lithuanian-lemmas';

// =============================================================================
// Types (Re-exported from types/index.ts)
// =============================================================================
export * from './types';

// =============================================================================
// Phase 77: Geographic Intelligence
// =============================================================================
export * from './geo';
