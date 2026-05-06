/**
 * Tests for IntentSplitter
 * Phase 86-03: Intent Splitting
 *
 * Splits clusters with mixed funnel stages (>20% variance).
 */

import { describe, it, expect } from 'vitest';
import { IntentSplitter, splitByIntent } from './IntentSplitter';
import type { ClusteringInput, KeywordCluster, IntentSplitConfig } from './types';

// Helper to create test input
function createInput(
  keyword: string,
  funnelStage: 'bofu' | 'mofu' | 'tofu',
  volume: number = 100
): ClusteringInput {
  return {
    keyword,
    embedding: Array(768).fill(0.5),
    volume,
    difficulty: 30,
    funnelStage,
    funnelConfidence: 0.8,
    geoCity: null,
    compositeScore: 0.7,
  };
}

// Helper to create test cluster
function createCluster(
  clusterId: number,
  keywords: ClusteringInput[]
): KeywordCluster {
  const totalVolume = keywords.reduce((sum, k) => sum + k.volume, 0);
  const avgDifficulty = keywords.reduce((sum, k) => sum + k.difficulty, 0) / keywords.length;

  // Calculate funnel breakdown
  const funnelBreakdown = {
    bofu: keywords.filter(k => k.funnelStage === 'bofu').length / keywords.length,
    mofu: keywords.filter(k => k.funnelStage === 'mofu').length / keywords.length,
    tofu: keywords.filter(k => k.funnelStage === 'tofu').length / keywords.length,
  };

  // Find dominant funnel
  const dominantFunnel = (Object.entries(funnelBreakdown) as Array<['bofu' | 'mofu' | 'tofu', number]>)
    .reduce((max, [stage, ratio]) => ratio > funnelBreakdown[max] ? stage : max, 'mofu' as 'bofu' | 'mofu' | 'tofu');

  return {
    clusterId,
    keywords,
    centroid: Array(768).fill(0.5),
    totalVolume,
    averageDifficulty: avgDifficulty,
    dominantFunnel,
    funnelBreakdown,
  };
}

describe('IntentSplitter', () => {
  describe('constructor', () => {
    it('should create instance with default config', () => {
      const splitter = new IntentSplitter();
      expect(splitter).toBeInstanceOf(IntentSplitter);
    });

    it('should accept custom config', () => {
      const splitter = new IntentSplitter({ funnelVarianceThreshold: 0.3 });
      expect(splitter).toBeInstanceOf(IntentSplitter);
    });
  });

  describe('splitClusters', () => {
    it('should return empty result for empty input', () => {
      const splitter = new IntentSplitter();
      const result = splitter.splitClusters([]);

      expect(result.clusters).toHaveLength(0);
      expect(result.stats.inputClusters).toBe(0);
      expect(result.stats.outputClusters).toBe(0);
      expect(result.stats.splitCount).toBe(0);
    });

    it('should not split cluster with dominant funnel (>80%)', () => {
      const keywords = [
        createInput('buy widget', 'bofu'),
        createInput('widget price', 'bofu'),
        createInput('widget for sale', 'bofu'),
        createInput('cheap widget', 'bofu'),
        createInput('widget comparison', 'mofu'), // 20% variance - exactly at threshold
      ];

      const cluster = createCluster(0, keywords);
      const splitter = new IntentSplitter();
      const result = splitter.splitClusters([cluster]);

      expect(result.clusters).toHaveLength(1);
      expect(result.stats.splitCount).toBe(0);
      expect(result.clusters[0].keywords).toHaveLength(5);
      expect(result.clusters[0].dominantFunnel).toBe('bofu');
    });

    it('should split cluster with mixed funnel (>20% variance)', () => {
      const keywords = [
        createInput('buy widget', 'bofu'),
        createInput('widget price', 'bofu'),
        createInput('widget benefits', 'mofu'),
        createInput('widget comparison', 'mofu'),
        createInput('what is widget', 'tofu'),
      ];

      const cluster = createCluster(0, keywords);
      const splitter = new IntentSplitter();
      const result = splitter.splitClusters([cluster]);

      // Should split into 3 clusters (one per funnel stage)
      expect(result.clusters.length).toBeGreaterThan(1);
      expect(result.stats.splitCount).toBe(1);

      // Each new cluster should have single dominant funnel
      for (const c of result.clusters) {
        const maxRatio = Math.max(
          c.funnelBreakdown.bofu,
          c.funnelBreakdown.mofu,
          c.funnelBreakdown.tofu
        );
        expect(maxRatio).toBeGreaterThan(0.8);
      }
    });

    it('should preserve cluster metadata after split', () => {
      const keywords = [
        createInput('buy widget', 'bofu', 1000),
        createInput('widget benefits', 'mofu', 500),
      ];

      const cluster = createCluster(0, keywords);
      const splitter = new IntentSplitter();
      const result = splitter.splitClusters([cluster]);

      // Total volume should be preserved
      const totalVolume = result.clusters.reduce((sum, c) => sum + c.totalVolume, 0);
      expect(totalVolume).toBe(1500);

      // All keywords should be preserved
      const totalKeywords = result.clusters.reduce((sum, c) => sum + c.keywords.length, 0);
      expect(totalKeywords).toBe(2);
    });

    it('should assign new cluster IDs after split', () => {
      const keywords = [
        createInput('buy widget', 'bofu'),
        createInput('widget benefits', 'mofu'),
        createInput('what is widget', 'tofu'),
      ];

      const cluster = createCluster(0, keywords);
      const splitter = new IntentSplitter();
      const result = splitter.splitClusters([cluster]);

      // Should have unique, sequential cluster IDs
      const clusterIds = result.clusters.map(c => c.clusterId);
      expect(new Set(clusterIds).size).toBe(clusterIds.length); // All unique
      expect(Math.min(...clusterIds)).toBe(0); // Start from 0
    });

    it('should use custom variance threshold', () => {
      const keywords = [
        createInput('buy widget', 'bofu'),
        createInput('buy widget now', 'bofu'),
        createInput('buy widget cheap', 'bofu'),
        createInput('widget benefits', 'mofu'), // 25% variance - below 0.3 threshold
      ];

      const cluster = createCluster(0, keywords);
      const splitter = new IntentSplitter({ funnelVarianceThreshold: 0.3 });
      const result = splitter.splitClusters([cluster]);

      // Should NOT split because 75% dominant (below 0.3 threshold)
      expect(result.clusters).toHaveLength(1);
      expect(result.stats.splitCount).toBe(0);
    });

    it('should handle multiple clusters', () => {
      const cluster1 = createCluster(0, [
        createInput('buy widget', 'bofu'),
        createInput('widget benefits', 'mofu'),
      ]);

      const cluster2 = createCluster(1, [
        createInput('buy gadget', 'bofu'),
        createInput('gadget price', 'bofu'),
        createInput('gadget reviews', 'bofu'),
      ]);

      const splitter = new IntentSplitter();
      const result = splitter.splitClusters([cluster1, cluster2]);

      // cluster1 should split (mixed), cluster2 should not (dominant bofu)
      expect(result.clusters.length).toBeGreaterThan(2);
      expect(result.stats.splitCount).toBe(1);
    });

    it('should recalculate cluster centroid after split', () => {
      const keywords = [
        createInput('buy widget', 'bofu'),
        createInput('widget benefits', 'mofu'),
      ];

      const cluster = createCluster(0, keywords);
      const splitter = new IntentSplitter();
      const result = splitter.splitClusters([cluster]);

      // Each split cluster should have a centroid
      for (const c of result.clusters) {
        expect(c.centroid).toBeDefined();
        expect(c.centroid.length).toBe(768);
      }
    });
  });

  describe('splitByIntent (convenience function)', () => {
    it('should use default config', () => {
      const keywords = [
        createInput('buy widget', 'bofu'),
        createInput('widget benefits', 'mofu'),
      ];

      const cluster = createCluster(0, keywords);
      const result = splitByIntent([cluster]);

      expect(result.clusters.length).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
    });

    it('should accept custom config', () => {
      const keywords = [
        createInput('buy widget', 'bofu'),
        createInput('buy widget now', 'bofu'),
        createInput('buy widget cheap', 'bofu'),
        createInput('widget benefits', 'mofu'),
      ];

      const cluster = createCluster(0, keywords);
      const result = splitByIntent([cluster], { funnelVarianceThreshold: 0.3 });

      // With threshold 0.3, should NOT split (75% bofu is > 70% threshold)
      expect(result.clusters).toHaveLength(1);
    });
  });
});
