/**
 * Cluster Selector
 * Phase 86-06: Semantic Intelligence Pipeline
 *
 * Selects 100 keywords from top-ranked clusters with diversity.
 * Generates 200-keyword backfill pool for editing.
 *
 * IMMUTABILITY: All operations return NEW objects, never mutate input.
 */

import type {
  HierarchicalCluster,
  ClusterSelectionConfig,
  ClusterSelectionResult,
  ClusterSelectionStats,
  ScoredCluster,
  ClusteringInput,
} from './types';
import { DEFAULT_SELECTION_CONFIG } from './types';

/**
 * Cluster selector with diversity constraints.
 * Ensures minimum 5 clusters represented in 100-keyword selection.
 */
export class ClusterSelector {
  private config: ClusterSelectionConfig;

  constructor(config: Partial<ClusterSelectionConfig> = {}) {
    this.config = { ...DEFAULT_SELECTION_CONFIG, ...config };
  }

  /**
   * Select keywords from hierarchy with diversity.
   * IMMUTABLE: Returns new objects, does not mutate input clusters.
   */
  select(clusters: readonly HierarchicalCluster[]): ClusterSelectionResult {
    // Step 1: Score all clusters (creates NEW array)
    const scored: ScoredCluster[] = clusters.map((c) => this.scoreCluster(c));

    // Step 2: Sort by rankability score (new sorted array)
    const sortedScored = [...scored].sort(
      (a, b) => b.rankabilityScore - a.rankabilityScore
    );

    // Step 3: Allocate keywords per cluster (diversity-aware)
    const allocation = this.allocateKeywords(sortedScored);

    // Step 4: Select keywords from each cluster (IMMUTABLE)
    const selected: ClusteringInput[] = [];
    const backfillPool: ClusteringInput[] = [];
    const finalScoredClusters: ScoredCluster[] = [];

    for (const cluster of sortedScored) {
      const clusterAllocation = allocation.get(cluster.clusterId) || 0;
      const sortedKeywords = this.sortKeywordsInCluster([...cluster.keywords]);

      // Take allocated count for selection
      const clusterSelected = sortedKeywords.slice(0, clusterAllocation);
      selected.push(...clusterSelected);

      // Remaining go to backfill
      const remaining = sortedKeywords.slice(clusterAllocation);
      const backfillCount = Math.min(
        remaining.length,
        Math.floor(this.config.backfillPoolSize / sortedScored.length)
      );
      const clusterBackfill = remaining.slice(0, backfillCount);
      backfillPool.push(...clusterBackfill);

      // Create NEW scored cluster with selections (IMMUTABLE)
      finalScoredClusters.push({
        ...cluster,
        selectedKeywords: clusterSelected,
        backfillKeywords: clusterBackfill,
      });
    }

    // Step 5: Calculate stats
    const clustersUsed = finalScoredClusters.filter(
      (c) => c.selectedKeywords.length > 0
    ).length;
    const stats: ClusterSelectionStats = {
      selectedCount: selected.length,
      backfillCount: Math.min(backfillPool.length, this.config.backfillPoolSize),
      clustersUsed,
      avgClusterScore:
        finalScoredClusters.reduce((s, c) => s + c.rankabilityScore, 0) /
        finalScoredClusters.length,
    };

    return {
      selected,
      backfillPool: backfillPool.slice(0, this.config.backfillPoolSize),
      scoredClusters: finalScoredClusters,
      stats,
    };
  }

  /**
   * Score cluster by rankability factors.
   * Returns NEW ScoredCluster object.
   */
  private scoreCluster(cluster: HierarchicalCluster): ScoredCluster {
    // Factors:
    // 1. Lower average difficulty = easier to rank (weight: 0.4)
    // 2. Quick-win potential = keywords in striking distance (weight: 0.3)
    // 3. Volume = search demand (weight: 0.2)
    // 4. Diversity = unique funnel coverage (weight: 0.1)

    // Normalize difficulty (invert: lower is better)
    const difficultyScore = 1 - cluster.averageDifficulty / 100;

    // Quick-win: count keywords with position 11-50
    const quickWinCount = cluster.keywords.filter(
      (k) =>
        k.position !== undefined &&
        k.position !== null &&
        k.position >= 11 &&
        k.position <= 50
    ).length;
    const quickWinScore =
      cluster.keywords.length > 0
        ? Math.min(quickWinCount / cluster.keywords.length, 1)
        : 0;

    // Volume: normalize to 0-1 (log scale)
    const volumeScore = Math.min(Math.log10(cluster.totalVolume + 1) / 5, 1);

    // Diversity: bonus for mixed funnel
    const funnelTypes = Object.values(cluster.funnelBreakdown).filter(
      (v) => v > 0
    ).length;
    const diversityScore = funnelTypes / 3;

    const rankabilityScore =
      difficultyScore * 0.4 +
      quickWinScore * 0.3 +
      volumeScore * 0.2 +
      diversityScore * 0.1;

    // Return NEW object (IMMUTABLE)
    return {
      ...cluster,
      rankabilityScore,
      selectedKeywords: [],
      backfillKeywords: [],
    };
  }

  /**
   * Allocate keywords per cluster ensuring diversity.
   * Guarantees at least minClusters (5) are represented.
   */
  private allocateKeywords(scored: readonly ScoredCluster[]): Map<number, number> {
    const allocation = new Map<number, number>();
    const totalTarget = this.config.targetCount;
    const minClusters = Math.min(this.config.minClusters, scored.length);

    if (scored.length === 0) return allocation;

    // Step 1: Distribute proportionally by score across ALL clusters
    const totalScore = scored.reduce((s, c) => s + c.rankabilityScore, 0);

    for (const cluster of scored) {
      const proportional =
        totalScore > 0
          ? Math.floor((cluster.rankabilityScore / totalScore) * totalTarget)
          : Math.floor(totalTarget / scored.length);
      const count = Math.min(proportional, cluster.keywords.length);

      allocation.set(cluster.clusterId, count);
    }

    // Step 2: Ensure minClusters have at least 1 keyword (borrow from others if needed)
    for (let i = 0; i < minClusters; i++) {
      const cluster = scored[i];
      const current = allocation.get(cluster.clusterId) || 0;
      if (current === 0 && cluster.keywords.length > 0) {
        allocation.set(cluster.clusterId, 1);
        // Take 1 from the largest allocated cluster to maintain target
        const largestId = Array.from(allocation.entries())
          .filter(([id]) => id !== cluster.clusterId)
          .sort((a, b) => b[1] - a[1])[0]?.[0];
        if (largestId !== undefined) {
          const largestCurrent = allocation.get(largestId) || 0;
          if (largestCurrent > 1) {
            allocation.set(largestId, largestCurrent - 1);
          }
        }
      }
    }

    // Step 3: Distribute any remaining to top clusters to reach exact target
    let allocated = Array.from(allocation.values()).reduce((sum, v) => sum + v, 0);
    let remaining = totalTarget - allocated;

    // If we're over, reduce from lowest-scored clusters
    if (remaining < 0) {
      for (let i = scored.length - 1; i >= 0 && remaining < 0; i--) {
        const cluster = scored[i];
        const current = allocation.get(cluster.clusterId) || 0;
        const toRemove = Math.min(current, Math.abs(remaining));
        allocation.set(cluster.clusterId, current - toRemove);
        remaining += toRemove;
      }
    }

    // If we're under, add to highest-scored clusters
    for (const cluster of scored) {
      if (remaining <= 0) break;

      const current = allocation.get(cluster.clusterId) || 0;
      const available = cluster.keywords.length - current;

      if (available > 0) {
        const toAdd = Math.min(available, remaining);
        allocation.set(cluster.clusterId, current + toAdd);
        remaining -= toAdd;
      }
    }

    return allocation;
  }

  /**
   * Sort keywords within cluster prioritizing quick-wins, then composite score.
   * Returns NEW sorted array (IMMUTABLE).
   */
  private sortKeywordsInCluster(keywords: ClusteringInput[]): ClusteringInput[] {
    return [...keywords].sort((a, b) => {
      // Prioritize quick-wins (position 11-50)
      const aPos = a.position ?? null;
      const bPos = b.position ?? null;
      const aIsQuickWin = aPos !== null && aPos >= 11 && aPos <= 50;
      const bIsQuickWin = bPos !== null && bPos >= 11 && bPos <= 50;

      if (aIsQuickWin && !bIsQuickWin) return -1;
      if (!aIsQuickWin && bIsQuickWin) return 1;

      // If both are quick-wins, prioritize closer to page 1
      if (aIsQuickWin && bIsQuickWin) {
        return (a.position || 50) - (b.position || 50);
      }

      // Otherwise sort by composite score
      return b.compositeScore - a.compositeScore;
    });
  }
}

/**
 * Factory function for cluster selection.
 */
export function selectFromClusters(
  clusters: readonly HierarchicalCluster[],
  config?: Partial<ClusterSelectionConfig>
): ClusterSelectionResult {
  const selector = new ClusterSelector(config);
  return selector.select(clusters);
}
