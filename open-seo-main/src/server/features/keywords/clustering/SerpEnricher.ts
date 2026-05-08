/**
 * SERP Enricher
 * Phase 86-06b: Semantic Intelligence Pipeline
 * Phase 95: GAP-K2 - DataForSEO SERP Integration
 *
 * Post-clustering SERP enrichment for selected keywords.
 * Fetches position data and identifies quick-win opportunities.
 *
 * Cost: ~$0.002 per keyword (SERP API live endpoint)
 * NOT used for clustering -- enrichment for proposal only.
 */

import type { ClusteringInput } from './types';
import { fetchLiveSerpItemsRaw, dataForSeoRateLimiter } from '@/server/lib/dataforseo';
import type { SerpLiveItem } from '@/server/lib/dataforseoSchemas';
import { db } from '@/db/index';
import { getDfsCostTracker } from '@/server/features/scraping/providers/DfsCostTracker';
import { createComponentLogger } from '@/server/features/scraping/logging';

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

// =============================================================================
// Logger
// =============================================================================

const logger = createComponentLogger('serp-enricher');

// =============================================================================
// SERP Position Types (GAP-K2)
// =============================================================================

/**
 * Result for a single keyword's SERP position lookup.
 */
export interface SerpPositionResult {
  keyword: string;
  positions: Array<{
    url: string;
    position: number;
    title?: string;
  }>;
  locationCode: number;
  languageCode: string;
}

/**
 * Options for batch position fetching.
 */
export interface FetchBatchPositionsOptions {
  keywords: string[];
  locationCode?: number;
  languageCode?: string;
  depth?: number;
  clientId?: string;
  workspaceId?: string;
}

/**
 * SERP Enricher for post-clustering keyword analysis.
 * IMMUTABLE: Returns new EnrichedKeyword objects.
 */
export class SerpEnricher {
  private config: Required<SerpEnrichmentConfig>;
  private costTracker: ReturnType<typeof getDfsCostTracker>;

  constructor(config: SerpEnrichmentConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<SerpEnrichmentConfig>;
    this.costTracker = getDfsCostTracker(db);
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
   * Fetch positions for a batch of keywords via DataForSEO SERP API.
   * Returns NEW EnrichedKeyword objects (IMMUTABLE).
   *
   * Phase 95 GAP-K2: Full DataForSEO integration with cost tracking.
   *
   * @param batch - Keywords to fetch positions for
   * @param options - Optional clientId/workspaceId for cost attribution
   */
  private async fetchBatchPositions(
    batch: readonly ClusteringInput[],
    options?: { clientId?: string; workspaceId?: string }
  ): Promise<EnrichedKeyword[]> {
    const results: EnrichedKeyword[] = [];
    const { clientId, workspaceId } = options ?? {};

    // Process each keyword individually (DataForSEO SERP API is per-keyword)
    for (const keywordInput of batch) {
      const startTime = Date.now();
      let position: number | null = null;

      try {
        // Fetch SERP data from DataForSEO
        const response = await fetchLiveSerpItemsRaw(
          keywordInput.keyword,
          this.config.locationCode,
          this.config.languageCode
        );

        // Find our domain's position in organic results
        position = this.findDomainPosition(response.data, this.config.domain);

        // Record cost (fire-and-forget pattern from SerpAnalyzer)
        this.costTracker
          .recordCost({
            url: keywordInput.keyword, // Use keyword as "url" for SERP calls
            domain: 'serp-api',
            mode: 'basic',
            usedStandardQueue: false,
            estimatedCost: 0.002, // SERP API cost per query
            actualCost: response.billing?.costUsd ?? 0.002,
            success: true,
            responseTimeMs: Date.now() - startTime,
            clientId,
            workspaceId,
            jobId: `serp-enricher:${this.config.domain}`,
          })
          .catch((err) => {
            logger.warn(
              { error: err instanceof Error ? err.message : String(err), keyword: keywordInput.keyword },
              'Failed to record DFS cost for SERP enrichment'
            );
          });

        logger.debug(
          { keyword: keywordInput.keyword, position, responseTimeMs: Date.now() - startTime },
          'SERP position fetched'
        );
      } catch (error) {
        // Record cost even on failure
        this.costTracker
          .recordCost({
            url: keywordInput.keyword,
            domain: 'serp-api',
            mode: 'basic',
            usedStandardQueue: false,
            estimatedCost: 0.002,
            actualCost: 0.002,
            success: false,
            errorMessage: error instanceof Error ? error.message : String(error),
            responseTimeMs: Date.now() - startTime,
            clientId,
            workspaceId,
            jobId: `serp-enricher:${this.config.domain}`,
          })
          .catch((err) => {
            logger.warn(
              { error: err instanceof Error ? err.message : String(err), keyword: keywordInput.keyword },
              'Failed to record DFS cost for SERP failure'
            );
          });

        // Log error but continue with other keywords (partial success pattern)
        logger.error(
          { error: error instanceof Error ? error.message : String(error), keyword: keywordInput.keyword },
          'SERP fetch failed for keyword'
        );
        // Keep position as null for failed fetches
      }

      results.push(this.enrichKeyword(keywordInput, position));
    }

    return results;
  }

  /**
   * Find the position of our domain in SERP organic results.
   *
   * @param items - SERP items from DataForSEO
   * @param domain - Domain to find (without protocol/www)
   * @returns Position (1-indexed) or null if not found
   */
  private findDomainPosition(items: SerpLiveItem[], domain: string): number | null {
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

    for (const item of items) {
      if (item.type !== 'organic' || !item.url) {
        continue;
      }

      try {
        const itemDomain = new URL(item.url).hostname.toLowerCase().replace(/^www\./, '');
        if (itemDomain === normalizedDomain || itemDomain.endsWith(`.${normalizedDomain}`)) {
          // rank_group is the position in organic results (1-indexed)
          return item.rank_group ?? null;
        }
      } catch {
        // Invalid URL, skip
        continue;
      }
    }

    return null;
  }

  /**
   * Fetch SERP positions for multiple keywords with cost tracking.
   * Public API for external callers (e.g., clustering pipeline).
   *
   * Phase 95 GAP-K2: Full implementation with DataForSEO integration.
   *
   * @param options - Batch fetch options
   * @returns Array of SERP position results
   */
  async fetchBatchPositionsPublic(options: FetchBatchPositionsOptions): Promise<SerpPositionResult[]> {
    const {
      keywords,
      locationCode = this.config.locationCode,
      languageCode = this.config.languageCode,
      depth = 100, // Default to top 100 results
      clientId,
      workspaceId,
    } = options;

    if (keywords.length === 0) {
      return [];
    }

    const results: SerpPositionResult[] = [];
    const BATCH_SIZE = this.config.batchSize;

    // Process in batches with rate limiting
    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      const batch = keywords.slice(i, i + BATCH_SIZE);

      for (const keyword of batch) {
        const startTime = Date.now();

        try {
          const response = await fetchLiveSerpItemsRaw(keyword, locationCode, languageCode);

          // Transform to SerpPositionResult format
          const positions = response.data
            .filter((item): item is SerpLiveItem & { url: string } =>
              item.type === 'organic' && typeof item.url === 'string'
            )
            .slice(0, depth)
            .map((item) => ({
              url: item.url,
              position: item.rank_group ?? 0,
              title: item.title ?? undefined,
            }));

          results.push({
            keyword,
            positions,
            locationCode,
            languageCode,
          });

          // Record cost
          this.costTracker
            .recordCost({
              url: keyword,
              domain: 'serp-api',
              mode: 'basic',
              usedStandardQueue: false,
              estimatedCost: 0.002,
              actualCost: response.billing?.costUsd ?? 0.002,
              success: true,
              responseTimeMs: Date.now() - startTime,
              clientId,
              workspaceId,
              jobId: 'serp-enricher-batch',
            })
            .catch((err) => {
              logger.warn(
                { error: err instanceof Error ? err.message : String(err), keyword },
                'Failed to record DFS cost for batch SERP'
              );
            });
        } catch (error) {
          // Record failure cost
          this.costTracker
            .recordCost({
              url: keyword,
              domain: 'serp-api',
              mode: 'basic',
              usedStandardQueue: false,
              estimatedCost: 0.002,
              actualCost: 0.002,
              success: false,
              errorMessage: error instanceof Error ? error.message : String(error),
              responseTimeMs: Date.now() - startTime,
              clientId,
              workspaceId,
              jobId: 'serp-enricher-batch',
            })
            .catch((err) => {
              logger.warn(
                { error: err instanceof Error ? err.message : String(err), keyword },
                'Failed to record DFS cost for batch SERP failure'
              );
            });

          logger.error(
            { error: error instanceof Error ? error.message : String(error), keyword },
            'Batch SERP fetch failed for keyword'
          );

          // Add empty result for failed keyword (partial success)
          results.push({
            keyword,
            positions: [],
            locationCode,
            languageCode,
          });
        }
      }

      // Rate limiting delay between batches
      if (i + BATCH_SIZE < keywords.length) {
        await this.delay(this.config.batchDelayMs);
      }
    }

    return results;
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
