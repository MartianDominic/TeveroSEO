/**
 * Keyword Intelligence Module - Server-Only Exports
 *
 * This file exports code that requires Node.js runtime (crypto, fs, DB, Redis).
 * ONLY import from this file in server contexts (API handlers, server functions).
 *
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !!! DO NOT import this file in client-side code or route components       !!!
 * !!! Use '@/server/features/keywords' for browser-safe exports             !!!
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *
 * @example Server-only usage:
 * ```typescript
 * // In API route handler or server function
 * import {
 *   UnifiedEmbeddingService,
 *   getEmbeddingService,
 *   ClassificationSingleflight,
 * } from '@/server/features/keywords/server';
 * ```
 */

// =============================================================================
// Embedding Service (uses Node.js crypto for cache keys)
// =============================================================================
export {
  cosineSimilarity,
  findTopK,
  getEmbeddingService,
  lightragEmbeddingFunc,
  resetEmbeddingService,
  UnifiedEmbeddingService,
} from './services/EmbeddingService';

// =============================================================================
// Classification Services (use crypto, Redis)
// =============================================================================
export { ClassificationSingleflight } from './services/ClassificationSingleflight';

export {
  createResilientClassifier,
  ResilientClassifier,
  RuleBasedClassifier,
  type ClassificationResult as ResilientClassificationResult,
  type ClassifierBackend,
  type ClassifierConfig,
} from './services/ResilientClassifier';

// =============================================================================
// Circuit Breaker (pure but typically server-side pattern)
// Re-exported from canonical location in scraping/resilience/
// =============================================================================
export {
  CircuitBreaker,
  CircuitOpenError,
  createCircuitBreaker,
  type CircuitState,
  type CircuitBreakerConfig as ServiceCircuitBreakerConfig,
} from '@/server/features/scraping/resilience/CircuitBreaker';

// =============================================================================
// Business Priority Parser (uses fs, path, crypto)
// =============================================================================
export {
  BusinessPriorityParser,
  createBusinessPriorityParser,
  getDefaultParser,
} from './services/BusinessPriorityParser';

// =============================================================================
// Task Router (server-side orchestration)
// =============================================================================
export {
  createTaskRouter,
  TaskRouter,
} from './services/TaskRouter';

// =============================================================================
// Relevance Scoring (uses EmbeddingService)
// =============================================================================
export { RelevanceScorer, createRelevanceScorer } from './relevance/RelevanceScorer';

// =============================================================================
// Conversation Intelligence (uses Anthropic SDK)
// =============================================================================
export {
  ConstraintExtractor,
  createConstraintExtractor,
  getDefaultExtractor,
  type ExtractorConfig,
} from './conversation';

// =============================================================================
// Content Hashing (uses crypto)
// =============================================================================
export { ContentHasher } from './services/ContentHasher';

// =============================================================================
// Keyword Intelligence Service (uses crypto, embeddings, classification)
// =============================================================================
export {
  createKeywordIntelligence,
  createKeywordIntelligenceFromEnv,
  KeywordIntelligenceService,
} from './services/KeywordIntelligenceService';

// =============================================================================
// Re-export types for convenience (these are also in main barrel)
// =============================================================================
export type {
  BacklinksResult,
  CrawlResult,
  Crawler,
  DataForSEOClient,
  KeywordsForDomainResult,
  SerpResult,
  TaskCache,
  TaskRouterConfig,
} from './services/TaskRouter';

export type {
  RelevanceScores,
  RelevanceWeights,
  RelevanceConfig,
  RelevanceInput,
  RelevanceOutput,
} from './relevance/types';
