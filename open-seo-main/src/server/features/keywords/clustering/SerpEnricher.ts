/**
 * SERP Enricher
 * Phase 86-06b: Semantic Intelligence Pipeline
 *
 * Post-clustering SERP enrichment for selected keywords.
 * Fetches position data and identifies quick-win opportunities.
 *
 * Cost: $4-10 per prospect (position-only endpoint)
 * NOT used for clustering -- enrichment for proposal only.
 */

import type { ClusteringInput } from './types';

export interface SerpEnrichmentConfig {
  /** Domain to check rankings for */
  domain: string;
  /** Location code for SERP (default: Lithuania) */
  locationCode?: number;
  /** Language code (default: lt) */
  languageCode?: string;
  /** Max keywords per API batch */
  batchSize?: number;
  /** Delay between batches (ms) */
  batchDelayMs?: number;
}

export interface EnrichedKeyword extends ClusteringInput {
  /** Current ranking position (null if not ranking) */
  currentPosition: number | null;
  /** Whether this is a quick-win (position 11-50) */
  isQuickWin: boolean;
  /** Opportunity score: higher = better opportunity */
  opportunityScore: number;
  /** SERP features present */
  serpFeatures?: string[];
}

export interface SerpEnrichmentResult {
  keywords: EnrichedKeyword[];
  stats: {
    totalKeywords: number;
    ranking: number;
    notRanking: number;
    quickWins: number;
    avgPosition: number | null;
  };
}

const DEFAULT_CONFIG: Required<Omit<SerpEnrichmentConfig, 'domain'>> = {
  locationCode: 2440, // Lithuania
  languageCode: 'lt',
  batchSize: 100,
  batchDelayMs: 1000,
};

/**
 * SERP Enricher for post-clustering keyword analysis.
 * IMMUTABLE: Returns new EnrichedKeyword objects.
 */
export class SerpEnricher {
  private config: Required<SerpEnrichmentConfig>;

  constructor(config: SerpEnrichmentConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<SerpEnrichmentConfig>;
  }

  /**
   * Enrich keywords with SERP position data.
   * Returns NEW array of EnrichedKeyword (IMMUTABLE).
   */
  async enrich(keywords: readonly ClusteringInput[]): Promise<SerpEnrichmentResult> {
    const enriched: EnrichedKeyword[] = [];

    // Process in batches
    for (let i = 0; i < keywords.length; i += this.config.batchSize) {
      const batch = keywords.slice(i, i + this.config.batchSize);
      const batchResults = await this.fetchBatchPositions(batch);
      enriched.push(...batchResults);

      // Rate limiting delay between batches
      if (i + this.config.batchSize < keywords.length) {
        await this.delay(this.config.batchDelayMs);
      }
    }

    // Calculate stats
    const ranking = enriched.filter((k) => k.currentPosition !== null);
    const quickWins = enriched.filter((k) => k.isQuickWin);
    const avgPosition =
      ranking.length > 0
        ? ranking.reduce((sum, k) => sum + (k.currentPosition || 0), 0) / ranking.length
        : null;

    return {
      keywords: enriched,
      stats: {
        totalKeywords: enriched.length,
        ranking: ranking.length,
        notRanking: enriched.length - ranking.length,
        quickWins: quickWins.length,
        avgPosition,
      },
    };
  }

  /**
   * Fetch positions for a batch of keywords via DataForSEO.
   * Returns NEW EnrichedKeyword objects (IMMUTABLE).
   */
  private async fetchBatchPositions(
    batch: readonly ClusteringInput[]
  ): Promise<EnrichedKeyword[]> {
    // TODO: Integrate with DataForSEO position-only endpoint
    // For now, return placeholder with null positions
    return batch.map((keyword) => this.enrichKeyword(keyword, null));
  }

  /**
   * Enrich a single keyword with position data.
   * Returns NEW object (IMMUTABLE).
   */
  private enrichKeyword(
    keyword: ClusteringInput,
    position: number | null
  ): EnrichedKeyword {
    const isQuickWin = position !== null && position >= 11 && position <= 50;
    const opportunityScore = this.calculateOpportunityScore(keyword, position, isQuickWin);

    // Return NEW object (IMMUTABLE)
    return {
      ...keyword,
      currentPosition: position,
      isQuickWin,
      opportunityScore,
    };
  }

  /**
   * Calculate opportunity score based on position and volume.
   * Higher score = better opportunity.
   */
  private calculateOpportunityScore(
    keyword: ClusteringInput,
    position: number | null,
    isQuickWin: boolean
  ): number {
    // Base score from volume (log scale, 0-40 points)
    const volumeScore = Math.min(Math.log10((keyword.volume || 0) + 1) * 10, 40);

    // Position score (0-40 points)
    let positionScore = 0;
    if (position === null) {
      // Not ranking: moderate opportunity
      positionScore = 15;
    } else if (isQuickWin) {
      // Quick-win: high opportunity (closer to page 1 = higher score)
      positionScore = 40 - (position - 11) * 0.75;
    } else if (position <= 10) {
      // Already ranking well: lower priority
      positionScore = 10 - position;
    } else {
      // Position > 50: lower opportunity
      positionScore = Math.max(0, 10 - (position - 50) * 0.2);
    }

    // Difficulty penalty (0-20 points penalty)
    const difficultyPenalty = ((keyword.difficulty || 50) / 100) * 20;

    return Math.max(0, volumeScore + positionScore - difficultyPenalty);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function for SERP enrichment.
 */
export async function enrichWithSerp(
  keywords: readonly ClusteringInput[],
  config: SerpEnrichmentConfig
): Promise<SerpEnrichmentResult> {
  const enricher = new SerpEnricher(config);
  return enricher.enrich(keywords);
}
