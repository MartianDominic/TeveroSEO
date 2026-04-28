/**
 * Orchestration Types for Keyword Intelligence Service
 *
 * Types for the main KeywordIntelligenceService that orchestrates
 * all individual services (hashing, embedding, classification, routing).
 */

import type { ClassificationResult } from './singleflight';

/**
 * Result of analyzing a single keyword.
 */
export interface KeywordAnalysisResult {
  /** The keyword that was analyzed */
  keyword: string;

  /** Normalized form of the keyword (lemmatized) */
  normalizedKeyword: string;

  /** Classification result with category assignment */
  classification: ClassificationResult;

  /** Whether this keyword represents a gap (no matching category) */
  isGap: boolean;

  /** Confidence score for the analysis (0-1) */
  confidence: number;

  /** Suggested category if this is a gap */
  suggestedCategory?: string;

  /** Search volume if available */
  searchVolume?: number;

  /** Competition score if available */
  competition?: number;

  /** Source of the data (cache, api, crawl) */
  source: string;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Result of gap detection analysis.
 */
export interface GapResult {
  /** Keywords that represent this gap */
  keywords: string[];

  /** Total search volume for gap keywords */
  totalSearchVolume: number;

  /** Suggested category name for this gap */
  suggestedCategory: string;

  /** Confidence that this is a valid gap (0-1) */
  confidence: number;

  /** Number of keywords in this cluster */
  keywordCount: number;

  /** Top keywords by search volume */
  topKeywords: Array<{
    keyword: string;
    searchVolume: number;
  }>;

  /** Reasoning for the gap suggestion */
  reasoning?: string;
}

/**
 * Result of product matching for a keyword.
 */
export interface ProductMatch {
  /** The product identifier */
  productId: string;

  /** Product name */
  productName: string;

  /** Match score (0-1) */
  matchScore: number;

  /** Why this product was matched */
  matchReason: 'exact' | 'semantic' | 'brand' | 'category' | 'fuzzy';

  /** Product URL if available */
  productUrl?: string;

  /** Product categories */
  categories?: string[];

  /** Brand name */
  brand?: string;
}

/**
 * Configuration for the KeywordIntelligenceService.
 */
export interface KeywordIntelligenceConfig {
  /** Client identifier for multi-tenant operations */
  clientId: string;

  /** Redis connection URL (for singleflight) */
  redisUrl?: string;

  /** Claude API key for classification */
  claudeApiKey?: string;

  /** OpenAI API key for fallback classification */
  openaiApiKey?: string;

  /** Whether to enable cost tracking */
  trackCosts?: boolean;

  /** Minimum confidence threshold for classification (default: 0.5) */
  minConfidence?: number;

  /** Maximum keywords to process in a single batch */
  maxBatchSize?: number;

  /** Whether to use Lithuanian normalization (default: true) */
  useLithuanianNormalizer?: boolean;

  /** Whether to enable singleflight deduplication (default: true) */
  useSingleflight?: boolean;

  /** Gap detection minimum cluster size (default: 3) */
  gapMinClusterSize?: number;

  /** Gap detection minimum total volume (default: 100) */
  gapMinTotalVolume?: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_KEYWORD_INTELLIGENCE_CONFIG: Required<Omit<KeywordIntelligenceConfig, 'clientId' | 'redisUrl' | 'claudeApiKey' | 'openaiApiKey'>> = {
  trackCosts: true,
  minConfidence: 0.5,
  maxBatchSize: 100,
  useLithuanianNormalizer: true,
  useSingleflight: true,
  gapMinClusterSize: 3,
  gapMinTotalVolume: 100,
};

/**
 * Statistics for keyword intelligence operations.
 */
export interface KeywordIntelligenceStats {
  /** Total keywords analyzed */
  totalKeywordsAnalyzed: number;

  /** Keywords classified successfully */
  successfulClassifications: number;

  /** Cache hits */
  cacheHits: number;

  /** Gaps detected */
  gapsDetected: number;

  /** Products matched */
  productsMatched: number;

  /** Total processing time in ms */
  totalProcessingTimeMs: number;

  /** Average confidence score */
  averageConfidence: number;

  /** Circuit breaker states */
  circuitStates: {
    claude: string;
    openai: string;
  };
}

/**
 * Input for batch keyword analysis.
 */
export interface KeywordAnalysisInput {
  /** Keywords to analyze */
  keywords: string[];

  /** Available categories for classification */
  categories: string[];

  /** Optional search volume data keyed by keyword */
  searchVolumes?: Record<string, number>;

  /** Optional competition data keyed by keyword */
  competitions?: Record<string, number>;
}

/**
 * Result of batch keyword analysis.
 */
export interface BatchAnalysisResult {
  /** Individual keyword results */
  results: KeywordAnalysisResult[];

  /** Detected gaps */
  gaps: GapResult[];

  /** Summary statistics */
  stats: {
    total: number;
    classified: number;
    gaps: number;
    averageConfidence: number;
    processingTimeMs: number;
  };
}

/**
 * Input for product matching.
 */
export interface ProductMatchInput {
  /** Keyword to match */
  keyword: string;

  /** Products to search through */
  products: Array<{
    id: string;
    name: string;
    description?: string;
    categories?: string[];
    brand?: string;
    url?: string;
  }>;

  /** Maximum number of matches to return */
  maxMatches?: number;

  /** Minimum match score (default: 0.3) */
  minScore?: number;
}
