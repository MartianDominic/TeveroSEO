/**
 * Hierarchy Builder
 * Phase 86-05: Semantic Intelligence Pipeline
 *
 * Builds pillar/subtopic/longtail hierarchy from labeled clusters.
 * Parent-child relationships established via centroid similarity.
 *
 * CRITICAL THRESHOLDS (from 86-CONTEXT.md):
 * - Pillar: totalVolume > 10K (NOT keyword count)
 * - Subtopic: totalVolume 2K-10K
 * - Longtail: totalVolume < 2K
 * - Parent-child: centroid similarity > 0.7
 * - Target: 5-7 pillars per 1000 keywords
 */

import type {
  LabeledCluster,
  HierarchicalCluster,
  ClusterHierarchy,
  HierarchyTier,
  HierarchyThresholds,
  HierarchyStats,
} from './types';
import { DEFAULT_HIERARCHY_THRESHOLDS } from './types';
import { cosineSimilarity } from '@/server/features/keywords/services/EmbeddingService';

/**
 * Hierarchy builder for cluster organization.
 *
 * Classification by totalVolume (not keyword count):
 * - Pillar: totalVolume > pillarMinVolume (default 10K)
 * - Subtopic: totalVolume >= subtopicMinVolume (default 2K)
 * - Longtail: totalVolume < subtopicMinVolume
 *
 * Parent-child linking:
 * - Uses centroid cosine similarity > parentSimilarityThreshold (default 0.7)
 * - Subtopics link to pillars
 * - Longtails link to subtopics or pillars
 * - Orphan subtopics (no parent match) promoted to pillars
 */
export class HierarchyBuilder {
  private thresholds: HierarchyThresholds;

  constructor(thresholds: Partial<HierarchyThresholds> = {}) {
    this.thresholds = { ...DEFAULT_HIERARCHY_THRESHOLDS, ...thresholds };
  }

  /**
   * Build hierarchy from labeled clusters.
   *
   * Process:
   * 1. Classify each cluster by tier (based on totalVolume)
   * 2. Link subtopics to pillars (centroid similarity > 0.7)
   * 3. Link longtails to subtopics or pillars
   * 4. Promote orphan subtopics to pillars
   *
   * @param clusters - Labeled clusters from ClusterLabeler (86-04)
   * @returns ClusterHierarchy with parent-child relationships
   */
  build(clusters: LabeledCluster[]): ClusterHierarchy {
    if (clusters.length === 0) {
      return {
        clusters: [],
        pillars: [],
        stats: {
          pillarCount: 0,
          subtopicCount: 0,
          longtailCount: 0,
          avgChildrenPerPillar: 0,
        },
      };
    }

    // Step 1: Classify each cluster by tier using totalVolume
    const classified = clusters.map(c => this.classify(c));

    // Step 2: Separate by tier
    const pillars = classified.filter(c => c.tier === 'pillar');
    const subtopics = classified.filter(c => c.tier === 'subtopic');
    const longtails = classified.filter(c => c.tier === 'longtail');

    // Step 3: Link subtopics to pillars via centroid similarity
    this.linkSubtopicsToPillars(subtopics, pillars);

    // Step 4: Link longtails to subtopics or pillars
    this.linkLongtails(longtails, subtopics, pillars);

    // Step 5: Promote orphan subtopics (no parent match) to pillars
    this.promoteOrphans(subtopics, pillars);

    // Build statistics
    const stats = this.calculateStats(pillars, subtopics, longtails);

    return {
      clusters: [...pillars, ...subtopics, ...longtails],
      pillars,
      stats,
    };
  }

  /**
   * Classify cluster by tier based on totalVolume.
   *
   * CRITICAL: Uses totalVolume, NOT keyword count.
   * - totalVolume > 10K = pillar
   * - totalVolume >= 2K = subtopic
   * - totalVolume < 2K = longtail
   */
  private classify(cluster: LabeledCluster): HierarchicalCluster {
    let tier: HierarchyTier;

    // Classification based on totalVolume (NOT keyword count)
    if (cluster.totalVolume > this.thresholds.pillarMinVolume) {
      tier = 'pillar';
    } else if (cluster.totalVolume >= this.thresholds.subtopicMinVolume) {
      tier = 'subtopic';
    } else {
      tier = 'longtail';
    }

    return {
      ...cluster,
      tier,
      parentId: null,
      childIds: [],
    };
  }

  /**
   * Link subtopics to nearest pillar by centroid similarity.
   * Only links if similarity > parentSimilarityThreshold (default 0.7).
   */
  private linkSubtopicsToPillars(
    subtopics: HierarchicalCluster[],
    pillars: HierarchicalCluster[]
  ): void {
    if (pillars.length === 0) return;

    for (const subtopic of subtopics) {
      const { bestMatch, bestSimilarity } = this.findBestParent(subtopic, pillars);

      if (bestMatch && bestSimilarity > this.thresholds.parentSimilarityThreshold) {
        subtopic.parentId = bestMatch.clusterId;
        bestMatch.childIds.push(subtopic.clusterId);
      }
      // If no match >= threshold, subtopic remains orphan (will be promoted later)
    }
  }

  /**
   * Link longtails to nearest subtopic or pillar.
   * Prefers subtopics over pillars if both are similar.
   */
  private linkLongtails(
    longtails: HierarchicalCluster[],
    subtopics: HierarchicalCluster[],
    pillars: HierarchicalCluster[]
  ): void {
    // Combine subtopics and pillars as potential parents
    const parentCandidates = [...subtopics, ...pillars];

    if (parentCandidates.length === 0) return;

    for (const longtail of longtails) {
      const { bestMatch, bestSimilarity } = this.findBestParent(longtail, parentCandidates);

      if (bestMatch && bestSimilarity > this.thresholds.parentSimilarityThreshold) {
        longtail.parentId = bestMatch.clusterId;
        bestMatch.childIds.push(longtail.clusterId);
      }
      // Longtails without parent match remain unlinked (acceptable)
    }
  }

  /**
   * Find best parent candidate by centroid similarity.
   * Returns the candidate with highest cosine similarity.
   */
  private findBestParent(
    child: HierarchicalCluster,
    candidates: HierarchicalCluster[]
  ): { bestMatch: HierarchicalCluster | null; bestSimilarity: number } {
    let bestMatch: HierarchicalCluster | null = null;
    let bestSimilarity = -1;

    for (const candidate of candidates) {
      const similarity = cosineSimilarity(
        new Float32Array(child.centroid),
        new Float32Array(candidate.centroid)
      );
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = candidate;
      }
    }

    return { bestMatch, bestSimilarity };
  }

  /**
   * Promote orphan subtopics (no pillar match >= 0.7) to standalone pillars.
   * This ensures all meaningful clusters have a place in the hierarchy.
   */
  private promoteOrphans(
    subtopics: HierarchicalCluster[],
    pillars: HierarchicalCluster[]
  ): void {
    for (const subtopic of subtopics) {
      if (subtopic.parentId === null) {
        // No parent match, promote to pillar
        subtopic.tier = 'pillar';
        pillars.push(subtopic);
      }
    }
  }

  /**
   * Calculate hierarchy statistics.
   */
  private calculateStats(
    pillars: HierarchicalCluster[],
    subtopics: HierarchicalCluster[],
    longtails: HierarchicalCluster[]
  ): HierarchyStats {
    // Count linked subtopics (not promoted orphans)
    const linkedSubtopicCount = subtopics.filter(s => s.parentId !== null).length;

    // Average children per pillar
    const totalChildren = pillars.reduce((sum, p) => sum + p.childIds.length, 0);
    const avgChildrenPerPillar = pillars.length > 0
      ? totalChildren / pillars.length
      : 0;

    return {
      pillarCount: pillars.length,
      subtopicCount: linkedSubtopicCount,
      longtailCount: longtails.length,
      avgChildrenPerPillar,
    };
  }
}

/**
 * Factory function for hierarchy building.
 *
 * Default thresholds:
 * - Pillar: totalVolume > 10K
 * - Subtopic: totalVolume >= 2K
 * - Longtail: totalVolume < 2K
 * - Parent-child similarity: > 0.7
 *
 * @param clusters - Labeled clusters from ClusterLabeler
 * @param thresholds - Optional custom thresholds
 * @returns ClusterHierarchy with 5-7 pillars per 1000 keywords
 */
export function buildHierarchy(
  clusters: LabeledCluster[],
  thresholds?: Partial<HierarchyThresholds>
): ClusterHierarchy {
  const builder = new HierarchyBuilder(thresholds);
  return builder.build(clusters);
}
