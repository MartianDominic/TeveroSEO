/**
 * Keyword Services Barrel Export
 *
 * Re-exports all keyword-related services and utilities.
 */

// Deduplicator
export {
  KeywordDeduplicator,
  keywordDeduplicator,
  normalizeKeyword,
  type DeduplicationResult,
} from "./KeywordDeduplicator";

// Enrichment
export {
  KeywordEnrichmentService,
  keywordEnrichmentService,
  CACHE_PREFIX,
  CACHE_TTL_SECONDS,
  BATCH_SIZE,
  COST_PER_KEYWORD_CENTS,
  type EnrichmentResult,
} from "./KeywordEnrichmentService";

// Input orchestrator
export {
  KeywordInputService,
  keywordInputService,
  type KeywordEntryPoint,
  type AddKeywordsInput,
  type AddKeywordsResult,
} from "./KeywordInputService";
