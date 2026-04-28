/**
 * KeywordIntelligenceService - Main Orchestration Service
 *
 * Orchestrates all keyword intelligence components:
 * - ContentHasher for change detection
 * - EmbeddingService for semantic matching
 * - LithuanianNormalizer for morphology
 * - PageValidator for consent detection
 * - TaskRouter for data source routing
 * - ClassificationSingleflight for cross-tenant dedup
 * - ResilientClassifier for fault-tolerant classification
 *
 * This is the main entry point for keyword analysis operations.
 *
 * @example
 * ```typescript
 * const service = createKeywordIntelligence({
 *   clientId: 'client-123',
 *   claudeApiKey: process.env.ANTHROPIC_API_KEY,
 * });
 *
 * const results = await service.analyzeKeywords(
 *   'client-123',
 *   ['šampūnas dažytiems plaukams', 'kondicionierius'],
 * );
 * ```
 */

import type { Redis } from 'ioredis';

import type {
  BatchAnalysisResult,
  ClassificationResult,
  GapResult,
  KeywordAnalysisInput,
  KeywordAnalysisResult,
  KeywordIntelligenceConfig,
  KeywordIntelligenceStats,
  ProductMatch,
  ProductMatchInput,
} from '../types';
import { DEFAULT_KEYWORD_INTELLIGENCE_CONFIG } from '../types';

import { ContentHasher } from './ContentHasher';
import { ClassificationSingleflight } from './ClassificationSingleflight';
import { UnifiedEmbeddingService, cosineSimilarity } from './EmbeddingService';
import { LithuanianNormalizer } from './LithuanianNormalizer';
import { ResilientClassifier, type ClassificationResult as ResilientClassificationResult } from './ResilientClassifier';

// =============================================================================
// KeywordIntelligenceService
// =============================================================================

export class KeywordIntelligenceService {
  private readonly config: KeywordIntelligenceConfig;
  private readonly normalizer: LithuanianNormalizer;
  private readonly hasher: ContentHasher;
  private readonly embedder: UnifiedEmbeddingService;
  private readonly classifier: ResilientClassifier;
  private readonly singleflight: ClassificationSingleflight | null;

  // Statistics tracking
  private stats: KeywordIntelligenceStats = {
    totalKeywordsAnalyzed: 0,
    successfulClassifications: 0,
    cacheHits: 0,
    gapsDetected: 0,
    productsMatched: 0,
    totalProcessingTimeMs: 0,
    averageConfidence: 0,
    circuitStates: { claude: 'closed', openai: 'closed' },
  };

  constructor(config: KeywordIntelligenceConfig, redis?: Redis) {
    this.config = {
      ...DEFAULT_KEYWORD_INTELLIGENCE_CONFIG,
      ...config,
    };

    // Initialize individual services
    this.normalizer = new LithuanianNormalizer();
    this.hasher = new ContentHasher();
    this.embedder = new UnifiedEmbeddingService();
    this.classifier = new ResilientClassifier({
      claudeApiKey: config.claudeApiKey,
      openaiApiKey: config.openaiApiKey,
    });

    // Initialize singleflight if Redis is provided
    this.singleflight = redis && config.useSingleflight !== false
      ? new ClassificationSingleflight(redis)
      : null;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Analyze a list of keywords against available categories.
   *
   * @param clientId - Client identifier
   * @param keywords - Keywords to analyze
   * @param categories - Available categories for classification (optional)
   * @returns Array of keyword analysis results
   */
  async analyzeKeywords(
    clientId: string,
    keywords: string[],
    categories: string[] = []
  ): Promise<KeywordAnalysisResult[]> {
    const startTime = performance.now();
    const results: KeywordAnalysisResult[] = [];

    // Process keywords in batches
    const batchSize = this.config.maxBatchSize ?? 100;

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch, categories);
      results.push(...batchResults);
    }

    // Update stats
    const processingTime = performance.now() - startTime;
    this.updateStats(results, processingTime);

    return results;
  }

  /**
   * Classify a single keyword into the most appropriate category.
   *
   * @param keyword - Keyword to classify
   * @param categories - Available categories
   * @returns Classification result
   */
  async classifyKeyword(
    keyword: string,
    categories: string[]
  ): Promise<ClassificationResult> {
    const startTime = performance.now();

    // Normalize the keyword using Lithuanian morphology
    const normalizedKeyword = this.config.useLithuanianNormalizer
      ? this.normalizer.normalizeForSearch(keyword)
      : keyword.toLowerCase();

    // Use singleflight if available, otherwise classify directly
    let result: ClassificationResult;

    if (this.singleflight) {
      result = await this.singleflight.classify(
        normalizedKeyword,
        categories,
        async (kw, cats) => this.classifyDirect(kw, cats)
      );
    } else {
      result = await this.classifyDirect(normalizedKeyword, categories);
    }

    // Update stats
    if (result.fromCache) {
      this.stats.cacheHits++;
    }
    this.stats.successfulClassifications++;

    return result;
  }

  /**
   * Detect category gaps from a set of keywords.
   * Gaps are keywords that don't match any existing category well.
   *
   * @param keywords - Keywords to analyze
   * @param existingCategories - Existing categories
   * @returns Array of detected gaps with suggested categories
   */
  async detectGaps(
    keywords: string[],
    existingCategories: string[]
  ): Promise<GapResult[]> {
    const minConfidence = this.config.minConfidence ?? 0.5;
    const minClusterSize = this.config.gapMinClusterSize ?? 3;
    const minTotalVolume = this.config.gapMinTotalVolume ?? 100;

    // Classify all keywords
    const classificationResults = await Promise.all(
      keywords.map(async (keyword) => ({
        keyword,
        classification: await this.classifyKeyword(keyword, existingCategories),
      }))
    );

    // Find low-confidence classifications (potential gaps)
    const gapCandidates = classificationResults.filter(
      (r) => r.classification.confidence < minConfidence
    );

    if (gapCandidates.length === 0) {
      return [];
    }

    // Cluster gap candidates by normalized form
    const clusters = this.clusterKeywords(
      gapCandidates.map((c) => c.keyword)
    );

    // Convert clusters to GapResult
    const gaps: GapResult[] = [];

    for (const cluster of clusters) {
      if (cluster.length >= minClusterSize) {
        // Find candidate keywords in this cluster
        const clusterKeywords = classificationResults.filter((r) =>
          cluster.includes(this.normalizer.normalizeForSearch(r.keyword))
        );

        const totalVolume = 0; // Would come from search volume data

        if (totalVolume >= minTotalVolume || cluster.length >= minClusterSize) {
          const suggestedCategory = this.suggestCategoryName(cluster);
          const avgConfidence = clusterKeywords.reduce(
            (sum, r) => sum + r.classification.confidence,
            0
          ) / clusterKeywords.length;

          gaps.push({
            keywords: cluster,
            totalSearchVolume: totalVolume,
            suggestedCategory,
            confidence: 1 - avgConfidence, // Higher confidence for lower classification confidence
            keywordCount: cluster.length,
            topKeywords: cluster.slice(0, 5).map((kw) => ({
              keyword: kw,
              searchVolume: 0, // Would come from search volume data
            })),
            reasoning: `${cluster.length} keywords with average classification confidence of ${(avgConfidence * 100).toFixed(1)}%`,
          });
        }
      }
    }

    this.stats.gapsDetected += gaps.length;
    return gaps;
  }

  /**
   * Extract product matches for a keyword from a product list.
   *
   * @param keyword - Keyword to match
   * @param products - Products to search through
   * @returns Array of matched products
   */
  async extractProductMatches(
    keyword: string,
    products: ProductMatchInput['products']
  ): Promise<ProductMatch[]> {
    const maxMatches = 10;
    const minScore = 0.3;

    if (products.length === 0) {
      return [];
    }

    // Normalize keyword
    const normalizedKeyword = this.config.useLithuanianNormalizer
      ? this.normalizer.normalizeForSearch(keyword)
      : keyword.toLowerCase();

    const matches: ProductMatch[] = [];

    // Get keyword embedding
    const keywordEmbedding = await this.embedder.embedQuery(normalizedKeyword);

    // Get product embeddings
    const productTexts = products.map((p) =>
      [p.name, p.description, p.brand].filter(Boolean).join(' ')
    );
    const productEmbeddings = await this.embedder.embedPassages(productTexts);

    // Calculate similarity scores
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const embedding = productEmbeddings[i];

      // Calculate semantic similarity
      const semanticScore = cosineSimilarity(keywordEmbedding, embedding);

      // Check for exact match in name
      const exactMatch = product.name.toLowerCase().includes(normalizedKeyword) ||
        normalizedKeyword.includes(product.name.toLowerCase());

      // Check for brand match
      const brandMatch = product.brand &&
        (product.brand.toLowerCase().includes(normalizedKeyword) ||
         normalizedKeyword.includes(product.brand.toLowerCase()));

      // Calculate final score
      let finalScore = semanticScore;
      let matchReason: ProductMatch['matchReason'] = 'semantic';

      if (exactMatch) {
        finalScore = Math.max(finalScore, 0.9);
        matchReason = 'exact';
      } else if (brandMatch) {
        finalScore = Math.max(finalScore, 0.8);
        matchReason = 'brand';
      } else if (product.categories?.some((c) =>
        c.toLowerCase().includes(normalizedKeyword)
      )) {
        finalScore = Math.max(finalScore, 0.7);
        matchReason = 'category';
      }

      if (finalScore >= minScore) {
        matches.push({
          productId: product.id,
          productName: product.name,
          matchScore: finalScore,
          matchReason,
          productUrl: product.url,
          categories: product.categories,
          brand: product.brand,
        });
      }
    }

    // Sort by score and limit
    matches.sort((a, b) => b.matchScore - a.matchScore);
    const topMatches = matches.slice(0, maxMatches);

    this.stats.productsMatched += topMatches.length;
    return topMatches;
  }

  /**
   * Run full batch analysis with gap detection.
   *
   * @param input - Batch analysis input
   * @returns Batch analysis result with gaps and stats
   */
  async analyzeBatch(input: KeywordAnalysisInput): Promise<BatchAnalysisResult> {
    const startTime = performance.now();

    // Analyze all keywords
    const results = await this.analyzeKeywords(
      this.config.clientId,
      input.keywords,
      input.categories
    );

    // Enrich with search volume data if provided
    if (input.searchVolumes) {
      for (const result of results) {
        result.searchVolume = input.searchVolumes[result.keyword];
      }
    }

    if (input.competitions) {
      for (const result of results) {
        result.competition = input.competitions[result.keyword];
      }
    }

    // Detect gaps
    const gaps = await this.detectGaps(input.keywords, input.categories);

    const processingTimeMs = performance.now() - startTime;

    // Calculate stats
    const classified = results.filter((r) => !r.isGap).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
      results,
      gaps,
      stats: {
        total: results.length,
        classified,
        gaps: gaps.length,
        averageConfidence: avgConfidence,
        processingTimeMs,
      },
    };
  }

  /**
   * Get current statistics.
   */
  getStats(): KeywordIntelligenceStats {
    const circuitStates = this.classifier.getCircuitStates();
    return {
      ...this.stats,
      circuitStates,
    };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalKeywordsAnalyzed: 0,
      successfulClassifications: 0,
      cacheHits: 0,
      gapsDetected: 0,
      productsMatched: 0,
      totalProcessingTimeMs: 0,
      averageConfidence: 0,
      circuitStates: { claude: 'closed', openai: 'closed' },
    };
  }

  /**
   * Reset circuit breakers.
   */
  resetCircuits(): void {
    this.classifier.resetCircuits();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Process a batch of keywords.
   */
  private async processBatch(
    keywords: string[],
    categories: string[]
  ): Promise<KeywordAnalysisResult[]> {
    const results: KeywordAnalysisResult[] = [];

    for (const keyword of keywords) {
      const startTime = performance.now();

      // Normalize keyword
      const normalizedKeyword = this.config.useLithuanianNormalizer
        ? this.normalizer.normalizeForSearch(keyword)
        : keyword.toLowerCase();

      // Classify
      const classification = await this.classifyKeyword(keyword, categories);

      const processingTimeMs = performance.now() - startTime;
      const minConfidence = this.config.minConfidence ?? 0.5;

      results.push({
        keyword,
        normalizedKeyword,
        classification,
        isGap: classification.confidence < minConfidence,
        confidence: classification.confidence,
        suggestedCategory: classification.confidence < minConfidence
          ? this.suggestCategoryName([normalizedKeyword])
          : undefined,
        source: classification.source ?? 'unknown',
        processingTimeMs,
      });
    }

    return results;
  }

  /**
   * Direct classification without singleflight.
   */
  private async classifyDirect(
    keyword: string,
    categories: string[]
  ): Promise<ClassificationResult> {
    const result: ResilientClassificationResult = await this.classifier.classify(keyword, categories);

    return {
      category: result.category,
      subcategory: result.secondaryCategories?.[0],
      confidence: result.confidence,
      reasoning: result.reasoning ?? '',
      fromCache: false,
      source: result.source,
    };
  }

  /**
   * Cluster keywords by similarity.
   * Simple implementation - groups by common prefix/stem.
   */
  private clusterKeywords(keywords: string[]): string[][] {
    const normalized = keywords.map((kw) =>
      this.config.useLithuanianNormalizer
        ? this.normalizer.normalizeForSearch(kw)
        : kw.toLowerCase()
    );

    // Simple clustering by common prefix (3+ chars)
    const clusters = new Map<string, string[]>();

    for (const kw of normalized) {
      const prefix = kw.substring(0, 3);
      if (!clusters.has(prefix)) {
        clusters.set(prefix, []);
      }
      clusters.get(prefix)!.push(kw);
    }

    return Array.from(clusters.values()).filter((c) => c.length > 1);
  }

  /**
   * Suggest a category name from a cluster of keywords.
   */
  private suggestCategoryName(keywords: string[]): string {
    if (keywords.length === 0) {
      return 'New Category';
    }

    // Find the most common words
    const wordCounts = new Map<string, number>();

    for (const kw of keywords) {
      const words = kw.split(/\s+/);
      for (const word of words) {
        if (word.length >= 3) {
          wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
        }
      }
    }

    // Sort by frequency
    const sortedWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);

    // Capitalize first letter
    return sortedWords
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Update statistics after processing.
   */
  private updateStats(results: KeywordAnalysisResult[], processingTimeMs: number): void {
    this.stats.totalKeywordsAnalyzed += results.length;
    this.stats.totalProcessingTimeMs += processingTimeMs;

    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
    const newAvg = totalConfidence / results.length;

    // Running average
    if (this.stats.totalKeywordsAnalyzed > results.length) {
      const prevCount = this.stats.totalKeywordsAnalyzed - results.length;
      this.stats.averageConfidence =
        (this.stats.averageConfidence * prevCount + newAvg * results.length) /
        this.stats.totalKeywordsAnalyzed;
    } else {
      this.stats.averageConfidence = newAvg;
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a KeywordIntelligenceService with the provided configuration.
 *
 * @param config - Configuration options
 * @param redis - Optional Redis client for singleflight deduplication
 * @returns Configured KeywordIntelligenceService instance
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 *
 * const redis = new Redis(process.env.REDIS_URL);
 * const service = createKeywordIntelligence({
 *   clientId: 'client-123',
 *   claudeApiKey: process.env.ANTHROPIC_API_KEY,
 * }, redis);
 * ```
 */
export function createKeywordIntelligence(
  config: KeywordIntelligenceConfig,
  redis?: Redis
): KeywordIntelligenceService {
  return new KeywordIntelligenceService(config, redis);
}

/**
 * Create a KeywordIntelligenceService with environment-based configuration.
 *
 * @param clientId - Client identifier
 * @param redis - Optional Redis client
 * @returns Configured KeywordIntelligenceService instance
 */
export function createKeywordIntelligenceFromEnv(
  clientId: string,
  redis?: Redis
): KeywordIntelligenceService {
  return createKeywordIntelligence(
    {
      clientId,
      claudeApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
    },
    redis
  );
}
