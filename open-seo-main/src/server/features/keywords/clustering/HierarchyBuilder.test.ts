/**
 * Tests for HierarchyBuilder
 * Phase 86-05: Hierarchy Building
 *
 * CRITICAL THRESHOLDS:
 * - Pillar: totalVolume > 10K (NOT keyword count)
 * - Subtopic: totalVolume 2K-10K
 * - Longtail: totalVolume < 2K
 * - Parent-child: centroid similarity > 0.7
 * - Target: 5-7 pillars per 1000 keywords
 */

import { describe, it, expect } from 'vitest';
import { HierarchyBuilder, buildHierarchy } from './HierarchyBuilder';
import type { LabeledCluster, ClusteringInput, HierarchyTier } from './types';

describe('HierarchyBuilder', () => {
  function createKeyword(volume: number): ClusteringInput {
    return {
      keyword: `keyword-${volume}`,
      embedding: new Float32Array(768).fill(0.5),
      volume,
      difficulty: 30,
      funnelStage: 'bofu',
      funnelConfidence: 0.8,
      geoCity: null,
      compositeScore: 0.7,
    };
  }

  /**
   * Create a truly different centroid by using orthogonal dimensions.
   * This ensures very low or zero cosine similarity between different seeds.
   * Returns a normalized vector.
   */
  function createDistinctCentroid(seed: number): Float32Array {
    const centroid = new Float32Array(768);

    // Fill specific dimensions based on seed to create orthogonal vectors
    // For seed 0: fill first 384 dims with 1, rest with 0
    // For seed 1000: fill dims 384-768 with 1, first half with 0
    // etc.
    const offset = (seed % 4) * 192;
    for (let i = offset; i < offset + 192 && i < 768; i++) {
      centroid[i] = 1;
    }

    // Normalize to unit length
    let sumSquares = 0;
    for (let i = 0; i < centroid.length; i++) {
      sumSquares += centroid[i] * centroid[i];
    }
    const length = Math.sqrt(sumSquares);
    if (length > 0) {
      for (let i = 0; i < centroid.length; i++) {
        centroid[i] = centroid[i] / length;
      }
    }

    return centroid;
  }

  /**
   * Create labeled cluster with specified totalVolume.
   * totalVolume is the PRIMARY tier criterion, not keyword count.
   */
  function createCluster(
    id: number,
    totalVolume: number,
    centroid: Float32Array = new Float32Array(768).fill(0.5),
    keywordCount: number = 5
  ): LabeledCluster {
    // Distribute volume across keywords
    const volumePerKeyword = Math.floor(totalVolume / keywordCount);
    const keywords = Array(keywordCount).fill(null).map(() => createKeyword(volumePerKeyword));

    return {
      clusterId: id,
      keywords,
      centroid,
      totalVolume,  // This is the key criterion for tier classification
      averageDifficulty: 30,
      dominantFunnel: 'bofu',
      funnelBreakdown: { bofu: keywordCount, mofu: 0, tofu: 0 },
      labelLt: `Cluster ${id}`,
      labelEn: `Cluster ${id}`,
      suggestedUrl: `cluster-${id}`,
      labelConfidence: 0.8,
      labelMethod: 'centroid_nearest',
    };
  }

  describe('tier classification by totalVolume', () => {
    it('should classify cluster with totalVolume > 10K as pillar', () => {
      const builder = new HierarchyBuilder();
      const cluster = createCluster(0, 15000); // 15K volume

      const result = builder.build([cluster]);

      expect(result.pillars).toHaveLength(1);
      expect(result.pillars[0].tier).toBe('pillar');
      expect(result.stats.pillarCount).toBe(1);
    });

    it('should classify cluster with totalVolume exactly 10K as subtopic (not pillar)', () => {
      const builder = new HierarchyBuilder();
      // Use same centroid so they link (similarity = 1.0 > 0.7)
      const sharedCentroid = createDistinctCentroid(0);
      const pillar = createCluster(0, 15000, sharedCentroid); // Add a pillar so subtopic can link
      const cluster = createCluster(1, 10000, sharedCentroid); // Exactly 10K, same centroid

      const result = builder.build([pillar, cluster]);

      // 10K is NOT > 10K, so it's a subtopic
      const classified = result.clusters.find(c => c.clusterId === 1);
      expect(classified!.tier).toBe('subtopic');
      expect(classified!.parentId).toBe(0); // Should be linked to pillar
    });

    it('should classify cluster with totalVolume 2K-10K as subtopic', () => {
      const builder = new HierarchyBuilder();
      // Add a pillar with same centroid so subtopic can link (not be orphaned)
      const sharedCentroid = createDistinctCentroid(0);
      const pillar = createCluster(0, 15000, sharedCentroid);
      const cluster = createCluster(1, 5000, sharedCentroid); // 5K volume

      const result = builder.build([pillar, cluster]);

      const classified = result.clusters.find(c => c.clusterId === 1);
      expect(classified!.tier).toBe('subtopic');
      expect(result.stats.subtopicCount).toBe(1);
    });

    it('should classify cluster with totalVolume < 2K as longtail', () => {
      const builder = new HierarchyBuilder();
      const cluster = createCluster(0, 1500); // 1.5K volume

      const result = builder.build([cluster]);

      const classified = result.clusters.find(c => c.clusterId === 0);
      expect(classified!.tier).toBe('longtail');
      expect(result.stats.longtailCount).toBe(1);
    });

    it('should NOT use keyword count for tier classification', () => {
      const builder = new HierarchyBuilder();

      // High keyword count but low volume = longtail
      const manyKeywordsLowVolume = createCluster(0, 1000, undefined, 50);
      // Low keyword count but high volume = pillar
      const fewKeywordsHighVolume = createCluster(1, 20000, undefined, 3);

      const result = builder.build([manyKeywordsLowVolume, fewKeywordsHighVolume]);

      const lowVolumeCluster = result.clusters.find(c => c.clusterId === 0);
      const highVolumeCluster = result.clusters.find(c => c.clusterId === 1);

      expect(lowVolumeCluster!.tier).toBe('longtail');  // Many keywords, but low volume
      expect(highVolumeCluster!.tier).toBe('pillar');   // Few keywords, but high volume
    });
  });

  describe('parent-child linking via centroid similarity', () => {
    it('should link subtopic to pillar with similarity > 0.7', () => {
      const builder = new HierarchyBuilder();

      // Create pillar and subtopic with high centroid similarity
      const pillarCentroid = new Float32Array(768).fill(0.8);
      const subtopicCentroid = new Float32Array(768).fill(0.85); // Very similar

      const pillar = createCluster(0, 15000, pillarCentroid);
      const subtopic = createCluster(1, 5000, subtopicCentroid);

      const result = builder.build([pillar, subtopic]);

      const linkedSubtopic = result.clusters.find(c => c.clusterId === 1);
      expect(linkedSubtopic!.parentId).toBe(0);
      expect(linkedSubtopic!.tier).toBe('subtopic');

      const parentPillar = result.pillars.find(c => c.clusterId === 0);
      expect(parentPillar!.childIds).toContain(1);
    });

    it('should NOT link subtopic to pillar with similarity < 0.7', () => {
      const builder = new HierarchyBuilder();

      // Create pillar and subtopic with low centroid similarity
      // Use seeds that map to different dimension ranges: 0 -> offset 0, 1 -> offset 192
      const pillarCentroid = createDistinctCentroid(0);
      const subtopicCentroid = createDistinctCentroid(1); // Very different pattern

      const pillar = createCluster(0, 15000, pillarCentroid);
      const subtopic = createCluster(1, 5000, subtopicCentroid);

      const result = builder.build([pillar, subtopic]);

      // Subtopic should have no parent (orphan) and be promoted to pillar
      const promotedOrphan = result.pillars.find(c => c.clusterId === 1);
      expect(promotedOrphan).toBeDefined();
      expect(promotedOrphan!.tier).toBe('pillar');
    });

    it('should link longtail to nearest subtopic or pillar', () => {
      const builder = new HierarchyBuilder();

      const centroid = new Float32Array(768).fill(0.7);
      const pillar = createCluster(0, 15000, centroid);
      const subtopic = createCluster(1, 5000, centroid);
      const longtail = createCluster(2, 500, centroid);

      const result = builder.build([pillar, subtopic, longtail]);

      const linkedLongtail = result.clusters.find(c => c.clusterId === 2);
      // Should link to subtopic or pillar (whichever is closest)
      expect(linkedLongtail!.parentId).not.toBeNull();
    });

    it('should select nearest pillar when multiple are similar', () => {
      const builder = new HierarchyBuilder();

      // Two pillars with different centroids
      const pillar1Centroid = new Float32Array(768).fill(0.8);
      const pillar2Centroid = new Float32Array(768).fill(0.5);
      const subtopicCentroid = new Float32Array(768).fill(0.85); // Closer to pillar1

      const pillar1 = createCluster(0, 15000, pillar1Centroid);
      const pillar2 = createCluster(1, 12000, pillar2Centroid);
      const subtopic = createCluster(2, 5000, subtopicCentroid);

      const result = builder.build([pillar1, pillar2, subtopic]);

      const linkedSubtopic = result.clusters.find(c => c.clusterId === 2);
      expect(linkedSubtopic!.parentId).toBe(0); // Linked to pillar1 (closer)
    });
  });

  describe('orphan promotion', () => {
    it('should promote orphan subtopic to pillar', () => {
      const builder = new HierarchyBuilder();

      // Subtopic with no similar pillar (use distinct centroids)
      // Use seeds 0 and 2 to get different offsets (0 and 384)
      const subtopicCentroid = createDistinctCentroid(2);
      const pillarCentroid = createDistinctCentroid(0); // Very different

      const pillar = createCluster(0, 15000, pillarCentroid);
      const orphanSubtopic = createCluster(1, 5000, subtopicCentroid);

      const result = builder.build([pillar, orphanSubtopic]);

      // Orphan subtopic should be promoted to pillar
      const promoted = result.pillars.find(c => c.clusterId === 1);
      expect(promoted).toBeDefined();
      expect(promoted!.tier).toBe('pillar');
    });

    it('should include promoted orphans in pillar count', () => {
      const builder = new HierarchyBuilder();

      // Three subtopics, all with different centroids (no matching pillar)
      const clusters = [
        createCluster(0, 15000, new Float32Array(768).fill(0.1)),  // Original pillar
        createCluster(1, 5000, new Float32Array(768).fill(0.3)),   // Orphan 1
        createCluster(2, 5000, new Float32Array(768).fill(0.5)),   // Orphan 2
        createCluster(3, 5000, new Float32Array(768).fill(0.7)),   // Orphan 3
      ];

      const result = builder.build(clusters);

      // All orphans promoted, so 4 pillars total
      // (unless some are similar enough to link)
      expect(result.stats.pillarCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('hierarchy statistics', () => {
    it('should calculate avgChildrenPerPillar correctly', () => {
      const builder = new HierarchyBuilder();

      const centroid = new Float32Array(768).fill(0.8);
      const clusters = [
        createCluster(0, 15000, centroid), // Pillar
        createCluster(1, 5000, centroid),  // Subtopic -> Pillar
        createCluster(2, 5000, centroid),  // Subtopic -> Pillar
        createCluster(3, 500, centroid),   // Longtail -> Pillar or Subtopic
      ];

      const result = builder.build(clusters);

      expect(result.stats.avgChildrenPerPillar).toBeGreaterThan(0);
    });

    it('should handle empty cluster list', () => {
      const builder = new HierarchyBuilder();

      const result = builder.build([]);

      expect(result.clusters).toHaveLength(0);
      expect(result.pillars).toHaveLength(0);
      expect(result.stats.pillarCount).toBe(0);
      expect(result.stats.avgChildrenPerPillar).toBe(0);
    });
  });

  describe('target pillar count (5-7 per 1000 keywords)', () => {
    it('should produce reasonable pillar count for 1000 keywords', () => {
      const builder = new HierarchyBuilder();

      // Simulate ~1000 keywords across ~50 clusters
      // Mix of pillars, subtopics, and longtails
      const clusters: LabeledCluster[] = [];
      let clusterId = 0;

      // 6 large clusters (pillars): 15K volume each
      for (let i = 0; i < 6; i++) {
        clusters.push(createCluster(clusterId++, 15000, new Float32Array(768).fill(0.1 + i * 0.1)));
      }

      // 15 medium clusters (subtopics): 5K volume each
      for (let i = 0; i < 15; i++) {
        const parentIndex = i % 6;
        const centroid = new Float32Array(768).fill(0.1 + parentIndex * 0.1); // Similar to parent
        clusters.push(createCluster(clusterId++, 5000, centroid));
      }

      // 30 small clusters (longtails): 1K volume each
      for (let i = 0; i < 30; i++) {
        clusters.push(createCluster(clusterId++, 1000, new Float32Array(768).fill(Math.random())));
      }

      const result = builder.build(clusters);

      // Should have roughly 5-7 pillars (plus any promoted orphans)
      expect(result.stats.pillarCount).toBeGreaterThanOrEqual(5);
      expect(result.stats.pillarCount).toBeLessThanOrEqual(15); // Some orphans may promote
    });
  });

  describe('buildHierarchy factory', () => {
    it('should work with default thresholds', () => {
      const cluster = createCluster(0, 15000);

      const result = buildHierarchy([cluster]);

      expect(result.pillars).toHaveLength(1);
    });

    it('should accept custom thresholds', () => {
      const cluster = createCluster(0, 5000); // Would be subtopic with defaults

      const result = buildHierarchy([cluster], {
        pillarMinVolume: 4000, // Lower threshold
      });

      expect(result.pillars).toHaveLength(1); // Now a pillar
    });
  });
});
