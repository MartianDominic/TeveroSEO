/**
 * IntentSplitter
 * Phase 86-03: Intent Splitting
 *
 * Splits clusters with mixed funnel stages (>20% variance).
 *
 * Per 86-RESEARCH.md:
 * - If no single funnel stage dominates (>80%), split by intent
 * - Preserve cluster metadata when splitting
 * - Recalculate centroids for split clusters
 */

import type {
  KeywordCluster,
  ClusteringInput,
  IntentSplitConfig,
} from './types';
import { DEFAULT_INTENT_SPLIT_CONFIG } from './types';

/**
 * Result of intent splitting.
 */
export interface IntentSplitResult {
  /**
   * Clusters after intent splitting.
   */
  clusters: KeywordCluster[];

  /**
   * Splitting statistics.
   */
  stats: IntentSplitStats;
}

export interface IntentSplitStats {
  inputClusters: number;
  outputClusters: number;
  splitCount: number;
  processingTimeMs: number;
}

/**
 * IntentSplitter splits clusters with mixed funnel stages.
 *
 * If a cluster has >20% variance in funnel stages (no single stage dominates at >80%),
 * split it into separate clusters by funnel stage.
 */
export class IntentSplitter {
  private config: IntentSplitConfig;

  constructor(config: Partial<IntentSplitConfig> = {}) {
    this.config = { ...DEFAULT_INTENT_SPLIT_CONFIG, ...config };
  }

  /**
   * Split clusters by funnel intent.
   *
   * @param clusters - Input clusters to split
   * @returns Clusters after intent splitting
   */
  splitClusters(clusters: KeywordCluster[]): IntentSplitResult {
    const startTime = performance.now();

    if (clusters.length === 0) {
      return {
        clusters: [],
        stats: {
          inputClusters: 0,
          outputClusters: 0,
          splitCount: 0,
          processingTimeMs: 0,
        },
      };
    }

    const result: KeywordCluster[] = [];
    let splitCount = 0;
    let nextClusterId = 0;

    for (const cluster of clusters) {
      // Check if cluster needs splitting
      const maxFunnelRatio = Math.max(
        cluster.funnelBreakdown.bofu,
        cluster.funnelBreakdown.mofu,
        cluster.funnelBreakdown.tofu
      );

      const dominanceThreshold = 1 - this.config.funnelVarianceThreshold;

      if (maxFunnelRatio >= dominanceThreshold) {
        // Single funnel dominates - keep cluster as is
        result.push({
          ...cluster,
          clusterId: nextClusterId++,
        });
      } else {
        // Mixed funnel - split by intent
        splitCount++;

        // Group keywords by funnel stage
        const bofuKeywords = cluster.keywords.filter(k => k.funnelStage === 'bofu');
        const mofuKeywords = cluster.keywords.filter(k => k.funnelStage === 'mofu');
        const tofuKeywords = cluster.keywords.filter(k => k.funnelStage === 'tofu');

        // Create sub-cluster for each funnel stage (if non-empty)
        if (bofuKeywords.length > 0) {
          result.push(this.createSubCluster(nextClusterId++, bofuKeywords, 'bofu'));
        }
        if (mofuKeywords.length > 0) {
          result.push(this.createSubCluster(nextClusterId++, mofuKeywords, 'mofu'));
        }
        if (tofuKeywords.length > 0) {
          result.push(this.createSubCluster(nextClusterId++, tofuKeywords, 'tofu'));
        }
      }
    }

    const endTime = performance.now();

    return {
      clusters: result,
      stats: {
        inputClusters: clusters.length,
        outputClusters: result.length,
        splitCount,
        processingTimeMs: endTime - startTime,
      },
    };
  }

  /**
   * Create a sub-cluster from keywords with a single funnel stage.
   *
   * Recalculates centroid, volume, difficulty, and funnel breakdown.
   */
  private createSubCluster(
    clusterId: number,
    keywords: ClusteringInput[],
    dominantFunnel: 'bofu' | 'mofu' | 'tofu'
  ): KeywordCluster {
    // Calculate centroid (mean of embeddings)
    const centroid = this.calculateCentroid(keywords.map(k => k.embedding));

    // Calculate metrics
    const totalVolume = keywords.reduce((sum, k) => sum + k.volume, 0);
    const averageDifficulty = keywords.reduce((sum, k) => sum + k.difficulty, 0) / keywords.length;

    // Calculate funnel breakdown (should be 100% for the dominant funnel, but verify)
    const funnelBreakdown = {
      bofu: keywords.filter(k => k.funnelStage === 'bofu').length / keywords.length,
      mofu: keywords.filter(k => k.funnelStage === 'mofu').length / keywords.length,
      tofu: keywords.filter(k => k.funnelStage === 'tofu').length / keywords.length,
    };

    return {
      clusterId,
      keywords,
      centroid,
      totalVolume,
      averageDifficulty,
      dominantFunnel,
      funnelBreakdown,
    };
  }

  /**
   * Calculate centroid (mean embedding vector).
   */
  private calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      return [];
    }

    const dimensions = embeddings[0].length;
    const centroid: number[] = new Array(dimensions).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += embedding[i];
      }
    }

    // Divide by count to get mean
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }
}

/**
 * Convenience function to split clusters by intent.
 *
 * @param clusters - Input clusters
 * @param config - Optional config override
 * @returns Clusters after intent splitting
 */
export function splitByIntent(
  clusters: KeywordCluster[],
  config?: Partial<IntentSplitConfig>
): IntentSplitResult {
  const splitter = new IntentSplitter(config);
  return splitter.splitClusters(clusters);
}
