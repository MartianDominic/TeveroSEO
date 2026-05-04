/**
 * RelevanceScorer - Multi-dimensional keyword relevance scoring
 *
 * Filters semantically irrelevant keywords using embedding similarity across
 * three dimensions:
 * 1. Core relevance: keyword ↔ business description
 * 2. Category relevance: keyword ↔ priority categories (max)
 * 3. Problem relevance: keyword ↔ problems solved (max)
 *
 * Combined score is weighted combination with configurable threshold.
 *
 * @example
 * ```typescript
 * const scorer = createRelevanceScorer();
 *
 * const result = await scorer.scoreKeyword({
 *   keyword: 'automobiliu plovykla',
 *   businessDescription: 'Car wash in Siauliai',
 *   priorityCategories: ['washing', 'detailing'],
 *   problemsSolved: ['dirty car'],
 * });
 *
 * if (result.passesThreshold) {
 *   console.log(`Relevant keyword: ${result.keyword} (${result.combinedScore})`);
 * }
 * ```
 */

import {
  UnifiedEmbeddingService,
  cosineSimilarity,
  getEmbeddingService,
} from '../services/EmbeddingService';
import type { EmbeddingCache } from '../types/embeddings';
import {
  RelevanceConfig,
  RelevanceInput,
  RelevanceOutput,
  RelevanceScores,
  DEFAULT_RELEVANCE_CONFIG,
} from './types';

/**
 * RelevanceScorer service.
 *
 * Scores keywords across multiple dimensions using embedding similarity.
 * Pre-embeds reference texts for efficiency.
 */
export class RelevanceScorer {
  private embeddingService: UnifiedEmbeddingService;
  private config: RelevanceConfig;
  private referenceEmbeddingsCache: Map<string, Float32Array>;

  constructor(config?: Partial<RelevanceConfig>, embeddingService?: UnifiedEmbeddingService) {
    this.config = { ...DEFAULT_RELEVANCE_CONFIG, ...config };
    this.embeddingService = embeddingService ?? getEmbeddingService();
    this.referenceEmbeddingsCache = new Map();
  }

  /**
   * Set the embedding cache for Redis-backed caching.
   */
  setCache(cache: EmbeddingCache): void {
    this.embeddingService.setCache(cache);
  }

  /**
   * Score a single keyword against business context.
   *
   * @param input - Keyword and business context
   * @returns RelevanceOutput with scores and metadata
   */
  async scoreKeyword(input: RelevanceInput): Promise<RelevanceOutput> {
    const startTime = performance.now();

    // Embed keyword
    const keywordEmbedding = await this.embeddingService.embedQuery(input.keyword);

    // Embed business description (or retrieve from cache)
    const businessEmbedding = await this.getOrEmbedText(
      input.businessDescription,
      'business'
    );

    // Compute core relevance
    const coreRelevance = cosineSimilarity(keywordEmbedding, businessEmbedding);

    // Compute category relevance (max across all categories)
    let categoryRelevance = 0;
    if (input.priorityCategories.length > 0) {
      const categoryEmbeddings = await Promise.all(
        input.priorityCategories.map((cat) => this.getOrEmbedText(cat, 'passage'))
      );

      const categorySimilarities = categoryEmbeddings.map((catEmb) =>
        cosineSimilarity(keywordEmbedding, catEmb)
      );

      categoryRelevance = Math.max(...categorySimilarities);
    }

    // Compute problem relevance (max across all problems)
    let problemRelevance = 0;
    if (input.problemsSolved.length > 0) {
      const problemEmbeddings = await Promise.all(
        input.problemsSolved.map((prob) => this.getOrEmbedText(prob, 'passage'))
      );

      const problemSimilarities = problemEmbeddings.map((probEmb) =>
        cosineSimilarity(keywordEmbedding, probEmb)
      );

      problemRelevance = Math.max(...problemSimilarities);
    }

    // Compute combined score
    const combinedScore = this.computeCombinedScore(
      coreRelevance,
      categoryRelevance,
      problemRelevance
    );

    // Check threshold
    const passesThreshold = combinedScore >= this.config.threshold;

    const processingTimeMs = performance.now() - startTime;

    return {
      keyword: input.keyword,
      coreRelevance,
      categoryRelevance,
      problemRelevance,
      combinedScore,
      passesThreshold,
      processingTimeMs,
    };
  }

  /**
   * Score multiple keywords in batch for efficiency.
   *
   * Pre-embeds all reference texts once, then processes keywords in batches.
   *
   * @param keywords - Array of keywords to score
   * @param businessDescription - Business description
   * @param priorityCategories - Priority categories
   * @param problemsSolved - Problems the business solves
   * @param config - Optional config override
   * @returns Map of keyword -> RelevanceOutput for O(1) lookup
   */
  async scoreKeywordsBatch(
    keywords: string[],
    businessDescription: string,
    priorityCategories: string[],
    problemsSolved: string[],
    config?: Partial<RelevanceConfig>
  ): Promise<Map<string, RelevanceOutput>> {
    // Merge config if provided
    const effectiveConfig = config ? { ...this.config, ...config } : this.config;

    // Pre-embed all reference texts
    const businessEmbedding = await this.embeddingService.embedQuery(businessDescription);

    const categoryEmbeddings =
      priorityCategories.length > 0
        ? await this.embeddingService.embedPassages(priorityCategories)
        : [];

    const problemEmbeddings =
      problemsSolved.length > 0
        ? await this.embeddingService.embedPassages(problemsSolved)
        : [];

    // Batch embed keywords (in chunks of 100)
    const BATCH_SIZE = 100;
    const keywordEmbeddings: Float32Array[] = [];

    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      const batch = keywords.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await Promise.all(
        batch.map((kw) => this.embeddingService.embedQuery(kw))
      );
      keywordEmbeddings.push(...batchEmbeddings);
    }

    // Compute all scores
    const results = new Map<string, RelevanceOutput>();

    for (let i = 0; i < keywords.length; i++) {
      const startTime = performance.now();
      const keyword = keywords[i];
      const keywordEmb = keywordEmbeddings[i];

      // Core relevance
      const coreRelevance = cosineSimilarity(keywordEmb, businessEmbedding);

      // Category relevance (max)
      let categoryRelevance = 0;
      if (categoryEmbeddings.length > 0) {
        const categorySimilarities = categoryEmbeddings.map((catEmb) =>
          cosineSimilarity(keywordEmb, catEmb)
        );
        categoryRelevance = Math.max(...categorySimilarities);
      }

      // Problem relevance (max)
      let problemRelevance = 0;
      if (problemEmbeddings.length > 0) {
        const problemSimilarities = problemEmbeddings.map((probEmb) =>
          cosineSimilarity(keywordEmb, probEmb)
        );
        problemRelevance = Math.max(...problemSimilarities);
      }

      // Combined score
      const combinedScore = this.computeCombinedScoreWithWeights(
        coreRelevance,
        categoryRelevance,
        problemRelevance,
        effectiveConfig.weights
      );

      // Check threshold
      const passesThreshold = combinedScore >= effectiveConfig.threshold;

      const processingTimeMs = performance.now() - startTime;

      results.set(keyword, {
        keyword,
        coreRelevance,
        categoryRelevance,
        problemRelevance,
        combinedScore,
        passesThreshold,
        processingTimeMs,
      });
    }

    return results;
  }

  /**
   * Get or embed text with caching.
   * Uses in-memory cache to avoid re-embedding same reference texts.
   */
  private async getOrEmbedText(text: string, type: 'query' | 'passage' | 'business'): Promise<Float32Array> {
    const cacheKey = `${type}:${text}`;

    if (this.referenceEmbeddingsCache.has(cacheKey)) {
      return this.referenceEmbeddingsCache.get(cacheKey)!;
    }

    const embedding =
      type === 'query'
        ? await this.embeddingService.embedQuery(text)
        : await this.embeddingService.embedPassages([text]).then((embs) => embs[0]);

    this.referenceEmbeddingsCache.set(cacheKey, embedding);

    return embedding;
  }

  /**
   * Compute weighted combination of relevance scores.
   */
  private computeCombinedScore(
    core: number,
    category: number,
    problem: number
  ): number {
    return this.computeCombinedScoreWithWeights(core, category, problem, this.config.weights);
  }

  /**
   * Compute weighted combination with explicit weights.
   */
  private computeCombinedScoreWithWeights(
    core: number,
    category: number,
    problem: number,
    weights: { core: number; category: number; problem: number }
  ): number {
    return core * weights.core + category * weights.category + problem * weights.problem;
  }
}

/**
 * Factory function to create a RelevanceScorer instance.
 *
 * @param config - Optional configuration overrides
 * @returns New RelevanceScorer instance
 */
export function createRelevanceScorer(config?: Partial<RelevanceConfig>): RelevanceScorer {
  return new RelevanceScorer(config);
}
