/**
 * Proposal Service Adapter
 * Phase 86-07: Backward Compatibility Layer
 *
 * Maps between new ScoredCluster[] format and legacy ProposalContent.opportunities.
 * Ensures existing proposal views continue to work during migration.
 *
 * IMMUTABLE: All methods return NEW objects.
 */

import type { ScoredCluster, ClusteringInput } from '../clustering/types';
import type { ProposalContent, OpportunityDifficulty } from '../../../../db/proposal-schema';

/**
 * Opportunity format for ProposalContent.opportunities (legacy).
 */
interface LegacyOpportunity {
  keyword: string;
  volume: number;
  difficulty: OpportunityDifficulty;
  potential: number;
}

/**
 * Adapter for mapping between cluster and opportunity formats.
 */
export class ProposalServiceAdapter {
  /**
   * Convert ScoredCluster[] to ProposalContent.opportunities.
   * IMMUTABLE: Returns NEW array.
   *
   * @param clusters - Scored clusters from clustering pipeline
   * @returns Legacy opportunities array for ProposalContent
   */
  static clustersToOpportunities(
    clusters: readonly ScoredCluster[]
  ): LegacyOpportunity[] {
    const opportunities: LegacyOpportunity[] = [];

    for (const cluster of clusters) {
      for (const keyword of cluster.selectedKeywords) {
        opportunities.push({
          keyword: keyword.keyword,
          volume: keyword.volume,
          difficulty: mapDifficultyToLevel(keyword.difficulty),
          potential: calculatePotential(keyword),
        });
      }
    }

    // Sort by potential descending
    return opportunities.sort((a, b) => b.potential - a.potential);
  }

  /**
   * Convert legacy opportunities back to ClusteringInput[].
   * Used when loading old proposals that lack clusters column.
   * IMMUTABLE: Returns NEW array.
   *
   * @param opportunities - Legacy opportunities from ProposalContent
   * @returns ClusteringInput array (without embeddings - for display only)
   */
  static opportunitiesToKeywords(
    opportunities: readonly LegacyOpportunity[]
  ): ClusteringInput[] {
    return opportunities.map(opp => ({
      keyword: opp.keyword,
      embedding: [], // No embedding available from legacy format
      volume: opp.volume,
      difficulty: mapLevelToDifficulty(opp.difficulty),
      funnelStage: 'mofu' as const, // Default, unknown from legacy
      funnelConfidence: 0.5, // Default confidence
      geoCity: null, // Unknown from legacy
      compositeScore: opp.potential / 100,
      position: null, // Unknown from legacy
    }));
  }

  /**
   * Sync clusters changes back to ProposalContent.opportunities.
   * Call this after any cluster edit to maintain backward compatibility.
   * IMMUTABLE: Returns NEW ProposalContent.
   *
   * @param content - Existing ProposalContent
   * @param clusters - Updated clusters
   * @returns NEW ProposalContent with updated opportunities
   */
  static syncOpportunities(
    content: ProposalContent,
    clusters: readonly ScoredCluster[]
  ): ProposalContent {
    const newOpportunities = this.clustersToOpportunities(clusters);

    // Return NEW object (IMMUTABLE)
    return {
      ...content,
      opportunities: newOpportunities,
    };
  }

  /**
   * Check if proposal has cluster data or only legacy opportunities.
   */
  static hasClusterData(
    clusters: readonly ScoredCluster[] | null | undefined
  ): boolean {
    return clusters !== null && clusters !== undefined && clusters.length > 0;
  }
}

/**
 * Map numeric difficulty (0-100) to level string.
 */
function mapDifficultyToLevel(difficulty: number): OpportunityDifficulty {
  if (difficulty < 30) return 'easy';
  if (difficulty < 70) return 'medium';
  return 'hard';
}

/**
 * Map difficulty level string to numeric (midpoint).
 */
function mapLevelToDifficulty(level: OpportunityDifficulty): number {
  switch (level) {
    case 'easy': return 15;
    case 'medium': return 50;
    case 'hard': return 85;
  }
}

/**
 * Calculate potential score (0-100) from keyword metrics.
 */
function calculatePotential(keyword: ClusteringInput): number {
  // Volume component (0-50 points, log scale)
  const volumeScore = Math.min(Math.log10((keyword.volume || 0) + 1) * 12.5, 50);

  // Difficulty component (0-30 points, inverted)
  const difficultyScore = (1 - (keyword.difficulty || 50) / 100) * 30;

  // Position component (0-20 points if quick-win)
  let positionScore = 10; // Default for unknown position
  if (keyword.position !== undefined && keyword.position !== null) {
    if (keyword.position >= 11 && keyword.position <= 50) {
      // Quick-win bonus
      positionScore = 20;
    } else if (keyword.position <= 10) {
      // Already ranking
      positionScore = 5;
    } else {
      positionScore = 10;
    }
  }

  return Math.round(volumeScore + difficultyScore + positionScore);
}

// Export factory function for convenience
export function clustersToOpportunities(
  clusters: readonly ScoredCluster[]
): LegacyOpportunity[] {
  return ProposalServiceAdapter.clustersToOpportunities(clusters);
}
