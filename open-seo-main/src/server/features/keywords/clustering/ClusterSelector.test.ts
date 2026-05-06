/**
 * ClusterSelector Tests
 * Phase 86-06: Semantic Intelligence Pipeline
 *
 * Tests cluster-based keyword selection with diversity constraints.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  HierarchicalCluster,
  ClusteringInput,
  ClusterSelectionConfig,
} from './types';
import { ClusterSelector, selectFromClusters } from './ClusterSelector';

describe('ClusterSelector', () => {
  let mockClusters: HierarchicalCluster[];
  let mockKeywords: ClusteringInput[];

  beforeEach(() => {
    // Create 10 mock clusters, each with 20 keywords
    mockKeywords = createMockKeywords(200);
    mockClusters = createMockClusters(mockKeywords, 10);
  });

  describe('select()', () => {
    it('should select exactly targetCount keywords (default 100)', () => {
      const selector = new ClusterSelector();
      const result = selector.select(mockClusters);

      expect(result.selected.length).toBe(100);
    });

    it('should select custom targetCount keywords', () => {
      const selector = new ClusterSelector({ targetCount: 150 });
      const result = selector.select(mockClusters);

      expect(result.selected.length).toBe(150);
    });

    it('should have at least minClusters (5) represented in selection', () => {
      const selector = new ClusterSelector({ targetCount: 100, minClusters: 5 });
      const result = selector.select(mockClusters);

      // Count clusters with selected keywords
      const clustersWithSelection = result.scoredClusters.filter(
        (c) => c.selectedKeywords.length > 0
      );

      expect(clustersWithSelection.length).toBeGreaterThanOrEqual(5);
    });

    it('should generate backfill pool of specified size (default 200)', () => {
      const selector = new ClusterSelector();
      const result = selector.select(mockClusters);

      expect(result.backfillPool.length).toBeLessThanOrEqual(200);
      expect(result.backfillPool.length).toBeGreaterThan(0);
    });

    it('should prioritize higher-scored clusters', () => {
      // Create clusters with varying difficulty (lower = better)
      const easyCluster: HierarchicalCluster = {
        ...mockClusters[0],
        clusterId: 99,
        averageDifficulty: 20, // Easy to rank
        totalVolume: 50000,
      };

      const hardCluster: HierarchicalCluster = {
        ...mockClusters[1],
        clusterId: 100,
        averageDifficulty: 80, // Hard to rank
        totalVolume: 50000,
      };

      const selector = new ClusterSelector({ targetCount: 20, minClusters: 2 });
      const result = selector.select([easyCluster, hardCluster]);

      // Easy cluster should have more selected keywords
      const easySelected =
        result.scoredClusters.find((c) => c.clusterId === 99)
          ?.selectedKeywords.length || 0;
      const hardSelected =
        result.scoredClusters.find((c) => c.clusterId === 100)
          ?.selectedKeywords.length || 0;

      expect(easySelected).toBeGreaterThan(hardSelected);
    });

    it('should prioritize quick-win keywords (position 11-50)', () => {
      const keywordsWithPositions: ClusteringInput[] = [
        createMockKeyword('quick-win-1', { position: 15, volume: 1000 }), // Quick-win
        createMockKeyword('quick-win-2', { position: 25, volume: 1000 }), // Quick-win
        createMockKeyword('top-10', { position: 5, volume: 1000 }), // Already ranking
        createMockKeyword('not-ranking', { position: null, volume: 1000 }), // Not ranking
        createMockKeyword('far-away', { position: 80, volume: 1000 }), // Too far
      ];

      const cluster: HierarchicalCluster = {
        clusterId: 1,
        tier: 'pillar',
        labelLt: 'Test',
        labelEn: 'Test',
        suggestedUrl: '/test',
        labelConfidence: 0.9,
        labelMethod: 'centroid_nearest',
        keywords: keywordsWithPositions,
        centroid: new Array(768).fill(0),
        totalVolume: 5000,
        averageDifficulty: 30,
        dominantFunnel: 'mofu',
        funnelBreakdown: { bofu: 0, mofu: 5, tofu: 0 },
        parentId: null,
        childIds: [],
      };

      const selector = new ClusterSelector({ targetCount: 3, minClusters: 1 });
      const result = selector.select([cluster]);

      // Top 3 should include the 2 quick-wins
      const quickWinCount = result.selected.filter(
        (k) => k.position !== null && k.position >= 11 && k.position <= 50
      ).length;

      expect(quickWinCount).toBeGreaterThanOrEqual(2);
    });

    it('should return immutable result (not mutate input clusters)', () => {
      const originalClusters = JSON.parse(JSON.stringify(mockClusters));
      const selector = new ClusterSelector();

      selector.select(mockClusters);

      // Input clusters should be unchanged
      expect(mockClusters).toEqual(originalClusters);
    });

    it('should include stats with expected properties', () => {
      const selector = new ClusterSelector();
      const result = selector.select(mockClusters);

      expect(result.stats).toMatchObject({
        selectedCount: expect.any(Number),
        backfillCount: expect.any(Number),
        clustersUsed: expect.any(Number),
        avgClusterScore: expect.any(Number),
      });

      expect(result.stats.selectedCount).toBe(100);
      expect(result.stats.clustersUsed).toBeGreaterThanOrEqual(5);
    });
  });

  describe('selectFromClusters() factory', () => {
    it('should work as factory function with default config', () => {
      const result = selectFromClusters(mockClusters);

      expect(result.selected.length).toBe(100);
      expect(result.backfillPool.length).toBeLessThanOrEqual(200);
    });

    it('should accept custom config', () => {
      const result = selectFromClusters(mockClusters, {
        targetCount: 50,
        backfillPoolSize: 100,
        minClusters: 3,
      });

      expect(result.selected.length).toBe(50);
      expect(result.backfillPool.length).toBeLessThanOrEqual(100);
    });
  });
});

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockKeywords(count: number): ClusteringInput[] {
  return Array.from({ length: count }, (_, i) => createMockKeyword(`keyword-${i}`));
}

function createMockKeyword(
  keyword: string,
  overrides?: Partial<ClusteringInput>
): ClusteringInput {
  return {
    keyword,
    embedding: new Array(768).fill(Math.random()),
    volume: overrides?.volume ?? Math.floor(Math.random() * 10000) + 100,
    difficulty: overrides?.difficulty ?? Math.floor(Math.random() * 100),
    funnelStage: overrides?.funnelStage ?? 'mofu',
    funnelConfidence: overrides?.funnelConfidence ?? 0.7,
    geoCity: overrides?.geoCity ?? null,
    compositeScore: overrides?.compositeScore ?? Math.random() * 100,
    position: overrides?.position !== undefined ? overrides.position : null,
  };
}

function createMockClusters(
  keywords: ClusteringInput[],
  clusterCount: number
): HierarchicalCluster[] {
  const keywordsPerCluster = Math.floor(keywords.length / clusterCount);

  return Array.from({ length: clusterCount }, (_, i) => {
    const clusterKeywords = keywords.slice(
      i * keywordsPerCluster,
      (i + 1) * keywordsPerCluster
    );

    const totalVolume = clusterKeywords.reduce((sum, k) => sum + k.volume, 0);
    const averageDifficulty =
      clusterKeywords.reduce((sum, k) => sum + k.difficulty, 0) /
      clusterKeywords.length;

    return {
      clusterId: i,
      tier: i < 2 ? 'pillar' : i < 5 ? 'subtopic' : 'longtail',
      labelLt: `Klasteris ${i}`,
      labelEn: `Cluster ${i}`,
      suggestedUrl: `/cluster-${i}`,
      labelConfidence: 0.8,
      labelMethod: 'centroid_nearest' as const,
      keywords: clusterKeywords,
      centroid: new Array(768).fill(0),
      totalVolume,
      averageDifficulty,
      dominantFunnel: 'mofu' as const,
      funnelBreakdown: { bofu: 0, mofu: clusterKeywords.length, tofu: 0 },
      parentId: null,
      childIds: [],
    };
  });
}
