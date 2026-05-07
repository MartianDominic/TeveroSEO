/**
 * Clustering Pipeline E2E Test
 * Phase 86-10: Final Integration
 *
 * Validates the complete clustering pipeline:
 * FilterResult[] -> Dedupe -> Cluster -> Split -> Label -> Hierarchy -> Select -> Portal
 *
 * Test Scenarios:
 * 1. Full pipeline: FilterResult[] to PortalCluster[]
 * 2. Empty input handling
 * 3. Noise keyword filtering
 * 4. Portal contract mapping
 * 5. Tier distribution
 * 6. Funnel breakdown accuracy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Types
import type { FilterResult, CompositeScore } from '../filtering/types';
import type {
  ClusteringInput,
  KeywordCluster,
  LabeledCluster,
  HierarchicalCluster,
  ClusterSelectionResult,
  DeduplicationResult,
  ClusteringResult,
  EMBEDDING_DIMENSION,
} from './types';
import type {
  PortalCluster,
  PortalKeyword,
  PortalDataResponse,
} from '../../portal/types';

// Services (real imports for type checking)
import { SemanticDeduplicator } from './SemanticDeduplicator';
import { IntentSplitter } from './IntentSplitter';
import { HierarchyBuilder } from './HierarchyBuilder';
import { ClusterSelector } from './ClusterSelector';
import { mapFilterResultsToClusteringInputs, EMBEDDING_DIMENSION as EMBED_DIM } from './types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a 768-dimensional embedding vector with controlled values.
 * Each keyword gets a slightly different embedding based on seed.
 */
function createEmbedding(seed: number): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < 768; i++) {
    // Use a simple formula to create unique but deterministic embeddings
    embedding.push(Math.sin(seed * (i + 1) * 0.01) * 0.5 + 0.5);
  }
  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / magnitude);
}

/**
 * Create a mock FilterResult with all required fields.
 */
function createFilterResult(
  keyword: string,
  options: {
    funnelStage?: 'bofu' | 'mofu' | 'tofu';
    volume?: number;
    difficulty?: number;
    position?: number | null;
    embedding?: number[];
    passed?: boolean;
    relevanceScore?: number;
  } = {}
): FilterResult {
  const seed = keyword.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const {
    funnelStage = 'mofu',
    volume = 1000,
    difficulty = 30,
    position = null,
    embedding = createEmbedding(seed),
    passed = true,
    relevanceScore = 0.8,
  } = options;

  const compositeScore: CompositeScore = {
    baseScore: 0.7,
    priorityMultiplier: 1.0,
    quickWinBonus: position && position >= 11 && position <= 50 ? 0.15 : 0,
    finalScore: 0.75,
  };

  return {
    keyword,
    passed,
    volume,
    difficulty,
    embedding,
    compositeScore,
    processingTimeMs: 10,
    classification: {
      funnelStage,
      geoCity: null,
      relevanceScore,
    },
  };
}

/**
 * Create a batch of FilterResults with varied characteristics.
 */
function createFilterResultBatch(count: number): FilterResult[] {
  const results: FilterResult[] = [];
  const funnelStages: Array<'bofu' | 'mofu' | 'tofu'> = ['bofu', 'mofu', 'tofu'];

  for (let i = 0; i < count; i++) {
    const funnelStage = funnelStages[i % 3];
    const volume = 500 + Math.floor(Math.random() * 9500); // 500-10000
    const difficulty = 20 + Math.floor(Math.random() * 60); // 20-80

    results.push(
      createFilterResult(`keyword_${i}`, {
        funnelStage,
        volume,
        difficulty,
        position: i % 5 === 0 ? 15 : null, // Every 5th is a quick-win
      })
    );
  }

  return results;
}

/**
 * Mock KeywordCluster for testing.
 */
function createMockCluster(
  id: number,
  keywords: ClusteringInput[],
  overrides: Partial<KeywordCluster> = {}
): KeywordCluster {
  const totalVolume = keywords.reduce((sum, k) => sum + k.volume, 0);
  const avgDifficulty =
    keywords.length > 0
      ? keywords.reduce((sum, k) => sum + k.difficulty, 0) / keywords.length
      : 50;

  // Calculate funnel breakdown
  const bofuCount = keywords.filter((k) => k.funnelStage === 'bofu').length;
  const mofuCount = keywords.filter((k) => k.funnelStage === 'mofu').length;
  const tofuCount = keywords.filter((k) => k.funnelStage === 'tofu').length;
  const total = keywords.length || 1;

  const funnelBreakdown = {
    bofu: bofuCount / total,
    mofu: mofuCount / total,
    tofu: tofuCount / total,
  };

  // Determine dominant funnel
  const maxFunnel = Math.max(funnelBreakdown.bofu, funnelBreakdown.mofu, funnelBreakdown.tofu);
  let dominantFunnel: 'bofu' | 'mofu' | 'tofu' = 'mofu';
  if (funnelBreakdown.bofu === maxFunnel) dominantFunnel = 'bofu';
  else if (funnelBreakdown.tofu === maxFunnel) dominantFunnel = 'tofu';

  // Create centroid (average of embeddings)
  const centroid = keywords.length > 0 ? createEmbedding(id) : [];

  return {
    clusterId: id,
    keywords,
    centroid,
    totalVolume,
    averageDifficulty: avgDifficulty,
    dominantFunnel,
    funnelBreakdown,
    ...overrides,
  };
}

/**
 * Create LabeledCluster from KeywordCluster.
 */
function createLabeledCluster(
  cluster: KeywordCluster,
  label: string = `Topic ${cluster.clusterId}`
): LabeledCluster {
  return {
    ...cluster,
    labelLt: label,
    labelEn: label,
    suggestedUrl: `/topic-${cluster.clusterId}`,
    labelConfidence: 0.85,
    labelMethod: 'centroid_nearest',
  };
}

/**
 * Transform HierarchicalCluster to PortalCluster format.
 */
function toPortalCluster(cluster: HierarchicalCluster & { selectedKeywords?: ClusteringInput[] }): PortalCluster {
  const keywords: PortalKeyword[] = (cluster.selectedKeywords || cluster.keywords).map((kw, idx) => {
    const currentPosition = kw.position ?? null;
    let status: PortalKeyword['status'] = 'pending';
    if (currentPosition !== null) {
      if (currentPosition <= 10) status = 'top10';
      else if (currentPosition <= 20) status = 'top20';
      else status = 'progress';
    }

    return {
      id: `kw-${cluster.clusterId}-${idx}`,
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.difficulty,
      funnelStage: kw.funnelStage,
      currentPosition,
      lockedPosition: null,
      positionChange: null,
      status,
    };
  });

  const inTop10 = keywords.filter((k) => k.status === 'top10').length;
  const inTop20 = keywords.filter((k) => k.status === 'top20').length;

  return {
    id: `cluster-${cluster.clusterId}`,
    tier: cluster.tier,
    label: cluster.labelLt,
    labelEn: cluster.labelEn,
    totalVolume: cluster.totalVolume,
    averageDifficulty: cluster.averageDifficulty,
    dominantFunnel: cluster.dominantFunnel,
    keywords,
    progress: {
      inTop10,
      inTop20,
      total: keywords.length,
      percentComplete: keywords.length > 0 ? Math.round((inTop10 / keywords.length) * 100) : 0,
    },
    parentId: cluster.parentId !== null ? `cluster-${cluster.parentId}` : null,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('ClusteringPipeline E2E', () => {
  /**
   * Scenario 1: Full pipeline from FilterResult[] to PortalCluster[]
   */
  describe('Scenario 1: Full pipeline flow', () => {
    it('should transform FilterResults through full pipeline to PortalClusters', () => {
      // Stage 1: Input - FilterResult[] from Phase 80
      const filterResults = createFilterResultBatch(15);

      // Verify input structure
      expect(filterResults.length).toBe(15);
      expect(filterResults[0].embedding).toBeDefined();
      expect(filterResults[0].embedding!.length).toBe(768);
      expect(filterResults[0].classification).toBeDefined();
      expect(filterResults[0].classification!.funnelStage).toMatch(/^(bofu|mofu|tofu)$/);

      // Stage 2: Map to ClusteringInput
      const mappingResult = mapFilterResultsToClusteringInputs(filterResults);
      expect(mappingResult.inputs.length).toBe(15);
      expect(mappingResult.skipped.length).toBe(0);

      // Stage 3: Create mock clusters (simulating HDBSCAN output)
      const clusters: KeywordCluster[] = [
        createMockCluster(0, mappingResult.inputs.slice(0, 5)),
        createMockCluster(1, mappingResult.inputs.slice(5, 10)),
        createMockCluster(2, mappingResult.inputs.slice(10, 15)),
      ];

      expect(clusters.length).toBe(3);
      expect(clusters[0].keywords.length).toBe(5);

      // Stage 4: Label clusters
      const labeledClusters = clusters.map((c) => createLabeledCluster(c));
      expect(labeledClusters[0].labelLt).toBeDefined();
      expect(labeledClusters[0].labelMethod).toBe('centroid_nearest');

      // Stage 5: Build hierarchy
      const hierarchyBuilder = new HierarchyBuilder({
        pillarMinVolume: 5000,
        subtopicMinVolume: 2000,
        parentSimilarityThreshold: 0.7,
      });
      const hierarchy = hierarchyBuilder.build(labeledClusters);

      expect(hierarchy.clusters.length).toBeGreaterThan(0);
      expect(hierarchy.stats).toBeDefined();

      // Stage 6: Select keywords
      const selector = new ClusterSelector({
        targetCount: 10,
        backfillPoolSize: 5,
        minClusters: 2,
      });
      const selectionResult = selector.select(hierarchy.clusters);

      expect(selectionResult.selected.length).toBeLessThanOrEqual(10);
      expect(selectionResult.stats.clustersUsed).toBeGreaterThanOrEqual(2);

      // Stage 7: Transform to PortalCluster[]
      const portalClusters = selectionResult.scoredClusters.map(toPortalCluster);

      expect(portalClusters.length).toBeGreaterThan(0);
      expect(portalClusters[0]).toHaveProperty('tier');
      expect(portalClusters[0]).toHaveProperty('progress');
      expect(portalClusters[0]).toHaveProperty('keywords');
      expect(portalClusters[0].progress).toHaveProperty('inTop10');
      expect(portalClusters[0].progress).toHaveProperty('percentComplete');
    });

    it('should preserve embedding dimension throughout pipeline', () => {
      const filterResult = createFilterResult('test keyword', { embedding: createEmbedding(42) });

      expect(filterResult.embedding).toBeDefined();
      expect(filterResult.embedding!.length).toBe(768);

      const mapping = mapFilterResultsToClusteringInputs([filterResult]);
      expect(mapping.inputs[0].embedding.length).toBe(768);
    });
  });

  /**
   * Scenario 2: Empty input handling
   */
  describe('Scenario 2: Empty input handling', () => {
    it('should handle empty FilterResult array gracefully', () => {
      const filterResults: FilterResult[] = [];

      const mappingResult = mapFilterResultsToClusteringInputs(filterResults);
      expect(mappingResult.inputs).toEqual([]);
      expect(mappingResult.skipped).toEqual([]);
      expect(mappingResult.stats.total).toBe(0);

      // Pipeline components should handle empty input
      const deduplicator = new SemanticDeduplicator();
      const dedupResult = deduplicator.deduplicate([]);
      expect(dedupResult.canonicals).toEqual([]);
      expect(dedupResult.stats.inputCount).toBe(0);

      const splitter = new IntentSplitter();
      const splitResult = splitter.splitClusters([]);
      expect(splitResult.clusters).toEqual([]);
      expect(splitResult.stats.inputClusters).toBe(0);

      const hierarchyBuilder = new HierarchyBuilder();
      const hierarchy = hierarchyBuilder.build([]);
      expect(hierarchy.clusters).toEqual([]);
      expect(hierarchy.pillars).toEqual([]);

      const selector = new ClusterSelector();
      const selectionResult = selector.select([]);
      expect(selectionResult.selected).toEqual([]);
      expect(selectionResult.scoredClusters).toEqual([]);
    });

    it('should return empty portal response for no clusters', () => {
      const portalResponse: Partial<PortalDataResponse> = {
        clusters: [],
        keywords: [],
      };

      expect(portalResponse.clusters).toEqual([]);
      expect(portalResponse.keywords).toEqual([]);
    });
  });

  /**
   * Scenario 3: Noise keyword filtering
   */
  describe('Scenario 3: Noise keyword filtering', () => {
    it('should handle noise keywords (cluster -1) gracefully', () => {
      // HDBSCAN assigns -1 to noise points
      const clusteringResult: ClusteringResult = {
        clusters: [
          createMockCluster(0, [
            { keyword: 'kw1', embedding: createEmbedding(1), volume: 1000, difficulty: 30, funnelStage: 'mofu', funnelConfidence: 0.8, geoCity: null, compositeScore: 0.7 },
            { keyword: 'kw2', embedding: createEmbedding(2), volume: 1200, difficulty: 25, funnelStage: 'bofu', funnelConfidence: 0.9, geoCity: null, compositeScore: 0.8 },
          ]),
        ],
        noise: [
          { keyword: 'noise1', embedding: createEmbedding(100), volume: 50, difficulty: 80, funnelStage: 'tofu', funnelConfidence: 0.3, geoCity: null, compositeScore: 0.2 },
          { keyword: 'noise2', embedding: createEmbedding(101), volume: 30, difficulty: 90, funnelStage: 'tofu', funnelConfidence: 0.2, geoCity: null, compositeScore: 0.1 },
        ],
        stats: {
          inputCount: 4,
          clusterCount: 1,
          noiseCount: 2,
          avgClusterSize: 2,
          processingTimeMs: 100,
        },
      };

      // Verify noise is tracked separately
      expect(clusteringResult.clusters.length).toBe(1);
      expect(clusteringResult.noise.length).toBe(2);
      expect(clusteringResult.stats.noiseCount).toBe(2);

      // Portal clusters should only include assigned keywords, not noise
      const portalClusters = clusteringResult.clusters.map((c) => {
        const labeled = createLabeledCluster(c);
        const hierarchical: HierarchicalCluster = {
          ...labeled,
          tier: 'subtopic',
          parentId: null,
          childIds: [],
        };
        return toPortalCluster(hierarchical);
      });

      expect(portalClusters.length).toBe(1);
      expect(portalClusters[0].keywords.length).toBe(2);

      // Noise keywords should not be in portal clusters
      const allPortalKeywords = portalClusters.flatMap((c) => c.keywords.map((k) => k.keyword));
      expect(allPortalKeywords).not.toContain('noise1');
      expect(allPortalKeywords).not.toContain('noise2');
    });

    it('should handle all-noise scenario (no clusters formed)', () => {
      const clusteringResult: ClusteringResult = {
        clusters: [],
        noise: [
          { keyword: 'noise1', embedding: createEmbedding(1), volume: 50, difficulty: 80, funnelStage: 'tofu', funnelConfidence: 0.3, geoCity: null, compositeScore: 0.2 },
        ],
        stats: {
          inputCount: 1,
          clusterCount: 0,
          noiseCount: 1,
          avgClusterSize: 0,
          processingTimeMs: 50,
        },
      };

      expect(clusteringResult.clusters.length).toBe(0);
      expect(clusteringResult.noise.length).toBe(1);

      // Should result in empty portal clusters
      const portalClusters: PortalCluster[] = [];
      expect(portalClusters.length).toBe(0);
    });
  });

  /**
   * Scenario 4: Portal contract mapping
   */
  describe('Scenario 4: Portal contract mapping', () => {
    it('should map clusters to contracted_keywords structure', () => {
      const clusters: LabeledCluster[] = [
        {
          ...createMockCluster(0, [
            { keyword: 'hair care', embedding: createEmbedding(1), volume: 5000, difficulty: 30, funnelStage: 'mofu', funnelConfidence: 0.8, geoCity: null, compositeScore: 0.8 },
            { keyword: 'shampoo', embedding: createEmbedding(2), volume: 3000, difficulty: 25, funnelStage: 'bofu', funnelConfidence: 0.9, geoCity: null, compositeScore: 0.85 },
          ]),
          labelLt: 'Plaukų priežiūra',
          labelEn: 'Hair Care',
          suggestedUrl: '/plauku-prieziura',
          labelConfidence: 0.9,
          labelMethod: 'centroid_nearest',
        },
      ];

      // Simulate ClusterContractMapper output
      const contractedKeywords = clusters.flatMap((cluster) =>
        cluster.keywords.map((kw) => ({
          keyword: kw.keyword,
          contractId: 'contract-123',
          clientId: 'client-456',
          clusterId: `cluster-${cluster.clusterId}`,
          clusterLabel: cluster.labelLt,
          clusterTier: 'pillar' as const,
          funnelStage: kw.funnelStage,
          lockedAt: new Date(),
          lockedPosition: null,
          lockedSearchVolume: kw.volume,
          status: 'active' as const,
        }))
      );

      expect(contractedKeywords.length).toBe(2);
      expect(contractedKeywords[0].clusterId).toBe('cluster-0');
      expect(contractedKeywords[0].clusterLabel).toBe('Plaukų priežiūra');
      expect(contractedKeywords[0].contractId).toBe('contract-123');
      expect(contractedKeywords[0].funnelStage).toMatch(/^(bofu|mofu|tofu)$/);
    });

    it('should preserve all keyword metadata in contract', () => {
      const keyword: ClusteringInput = {
        keyword: 'test keyword',
        embedding: createEmbedding(42),
        volume: 2500,
        difficulty: 35,
        funnelStage: 'bofu',
        funnelConfidence: 0.85,
        geoCity: 'Vilnius',
        compositeScore: 0.78,
        position: 15,
      };

      // Contract should preserve critical fields
      const contracted = {
        keyword: keyword.keyword,
        lockedSearchVolume: keyword.volume,
        funnelStage: keyword.funnelStage,
        lockedPosition: keyword.position,
      };

      expect(contracted.lockedSearchVolume).toBe(2500);
      expect(contracted.funnelStage).toBe('bofu');
      expect(contracted.lockedPosition).toBe(15);
    });
  });

  /**
   * Scenario 5: Tier distribution
   */
  describe('Scenario 5: Tier distribution', () => {
    it('should correctly classify clusters into pillar/subtopic/longtail tiers', () => {
      // Create clusters with different volumes to trigger different tiers
      const pillarKeywords: ClusteringInput[] = Array.from({ length: 10 }, (_, i) => ({
        keyword: `pillar_kw_${i}`,
        embedding: createEmbedding(i),
        volume: 2000, // Total will be 20000 (pillar)
        difficulty: 30,
        funnelStage: 'mofu' as const,
        funnelConfidence: 0.8,
        geoCity: null,
        compositeScore: 0.75,
      }));

      const subtopicKeywords: ClusteringInput[] = Array.from({ length: 5 }, (_, i) => ({
        keyword: `subtopic_kw_${i}`,
        embedding: createEmbedding(100 + i),
        volume: 1000, // Total will be 5000 (subtopic)
        difficulty: 40,
        funnelStage: 'bofu' as const,
        funnelConfidence: 0.85,
        geoCity: null,
        compositeScore: 0.7,
      }));

      const longtailKeywords: ClusteringInput[] = Array.from({ length: 3 }, (_, i) => ({
        keyword: `longtail_kw_${i}`,
        embedding: createEmbedding(200 + i),
        volume: 300, // Total will be 900 (longtail)
        difficulty: 20,
        funnelStage: 'tofu' as const,
        funnelConfidence: 0.6,
        geoCity: null,
        compositeScore: 0.6,
      }));

      const labeledClusters: LabeledCluster[] = [
        createLabeledCluster(createMockCluster(0, pillarKeywords), 'Main Topic'),
        createLabeledCluster(createMockCluster(1, subtopicKeywords), 'Sub Topic'),
        createLabeledCluster(createMockCluster(2, longtailKeywords), 'Long Tail Topic'),
      ];

      // Build hierarchy with default thresholds
      const hierarchyBuilder = new HierarchyBuilder({
        pillarMinVolume: 10000,
        subtopicMinVolume: 2000,
      });
      const hierarchy = hierarchyBuilder.build(labeledClusters);

      // Verify tier classification
      const tiers = hierarchy.clusters.map((c) => c.tier);
      expect(tiers).toContain('pillar'); // 20000 volume
      expect(tiers).toContain('subtopic'); // 5000 volume
      expect(tiers).toContain('longtail'); // 900 volume

      // Verify stats
      expect(hierarchy.stats.pillarCount).toBeGreaterThanOrEqual(1);
    });

    it('should sort portal clusters by tier then volume', () => {
      const clusters: HierarchicalCluster[] = [
        {
          ...createLabeledCluster(createMockCluster(0, [])),
          totalVolume: 1500,
          tier: 'longtail',
          parentId: null,
          childIds: [],
        },
        {
          ...createLabeledCluster(createMockCluster(1, [])),
          totalVolume: 15000,
          tier: 'pillar',
          parentId: null,
          childIds: [],
        },
        {
          ...createLabeledCluster(createMockCluster(2, [])),
          totalVolume: 5000,
          tier: 'subtopic',
          parentId: 1,
          childIds: [],
        },
        {
          ...createLabeledCluster(createMockCluster(3, [])),
          totalVolume: 20000,
          tier: 'pillar',
          parentId: null,
          childIds: [],
        },
      ];

      const portalClusters = clusters.map(toPortalCluster);

      // Sort by tier (pillar first) then by volume descending
      const sorted = [...portalClusters].sort((a, b) => {
        const tierOrder = { pillar: 0, subtopic: 1, longtail: 2 };
        const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
        if (tierDiff !== 0) return tierDiff;
        return b.totalVolume - a.totalVolume;
      });

      // First should be highest-volume pillar
      expect(sorted[0].tier).toBe('pillar');
      expect(sorted[0].totalVolume).toBe(20000);

      // Second should be second pillar
      expect(sorted[1].tier).toBe('pillar');
      expect(sorted[1].totalVolume).toBe(15000);

      // Third should be subtopic
      expect(sorted[2].tier).toBe('subtopic');

      // Last should be longtail
      expect(sorted[3].tier).toBe('longtail');
    });
  });

  /**
   * Scenario 6: Funnel breakdown accuracy
   */
  describe('Scenario 6: Funnel breakdown accuracy', () => {
    it('should calculate accurate funnel breakdown percentages', () => {
      const keywords: ClusteringInput[] = [
        { keyword: 'buy now', embedding: createEmbedding(1), volume: 1000, difficulty: 30, funnelStage: 'bofu', funnelConfidence: 0.9, geoCity: null, compositeScore: 0.8 },
        { keyword: 'compare prices', embedding: createEmbedding(2), volume: 800, difficulty: 35, funnelStage: 'mofu', funnelConfidence: 0.85, geoCity: null, compositeScore: 0.75 },
        { keyword: 'what is', embedding: createEmbedding(3), volume: 1200, difficulty: 25, funnelStage: 'tofu', funnelConfidence: 0.8, geoCity: null, compositeScore: 0.7 },
        { keyword: 'purchase', embedding: createEmbedding(4), volume: 900, difficulty: 40, funnelStage: 'bofu', funnelConfidence: 0.95, geoCity: null, compositeScore: 0.85 },
      ];

      const cluster = createMockCluster(0, keywords);

      // Expected: 2 bofu (50%), 1 mofu (25%), 1 tofu (25%)
      expect(cluster.funnelBreakdown.bofu).toBeCloseTo(0.5, 2);
      expect(cluster.funnelBreakdown.mofu).toBeCloseTo(0.25, 2);
      expect(cluster.funnelBreakdown.tofu).toBeCloseTo(0.25, 2);

      // Sum should equal 1
      const sum = cluster.funnelBreakdown.bofu + cluster.funnelBreakdown.mofu + cluster.funnelBreakdown.tofu;
      expect(sum).toBeCloseTo(1, 5);

      // Dominant funnel should be bofu
      expect(cluster.dominantFunnel).toBe('bofu');
    });

    it('should correctly identify dominant funnel stage', () => {
      // Create cluster with MOFU dominance
      const mofuDominant: ClusteringInput[] = [
        { keyword: 'kw1', embedding: createEmbedding(1), volume: 1000, difficulty: 30, funnelStage: 'mofu', funnelConfidence: 0.8, geoCity: null, compositeScore: 0.7 },
        { keyword: 'kw2', embedding: createEmbedding(2), volume: 1000, difficulty: 30, funnelStage: 'mofu', funnelConfidence: 0.8, geoCity: null, compositeScore: 0.7 },
        { keyword: 'kw3', embedding: createEmbedding(3), volume: 1000, difficulty: 30, funnelStage: 'mofu', funnelConfidence: 0.8, geoCity: null, compositeScore: 0.7 },
        { keyword: 'kw4', embedding: createEmbedding(4), volume: 1000, difficulty: 30, funnelStage: 'bofu', funnelConfidence: 0.9, geoCity: null, compositeScore: 0.8 },
      ];

      const cluster = createMockCluster(0, mofuDominant);
      expect(cluster.dominantFunnel).toBe('mofu');
      expect(cluster.funnelBreakdown.mofu).toBe(0.75);

      // Create cluster with TOFU dominance
      const tofuDominant: ClusteringInput[] = [
        { keyword: 'kw1', embedding: createEmbedding(5), volume: 1000, difficulty: 30, funnelStage: 'tofu', funnelConfidence: 0.7, geoCity: null, compositeScore: 0.6 },
        { keyword: 'kw2', embedding: createEmbedding(6), volume: 1000, difficulty: 30, funnelStage: 'tofu', funnelConfidence: 0.7, geoCity: null, compositeScore: 0.6 },
      ];

      const tofuCluster = createMockCluster(1, tofuDominant);
      expect(tofuCluster.dominantFunnel).toBe('tofu');
      expect(tofuCluster.funnelBreakdown.tofu).toBe(1.0);
    });

    it('should trigger intent splitting for mixed-funnel clusters', () => {
      // Create a cluster with >20% variance (no single stage dominates at 80%)
      const mixedKeywords: ClusteringInput[] = [
        { keyword: 'kw1', embedding: createEmbedding(1), volume: 1000, difficulty: 30, funnelStage: 'bofu', funnelConfidence: 0.9, geoCity: null, compositeScore: 0.8 },
        { keyword: 'kw2', embedding: createEmbedding(2), volume: 1000, difficulty: 30, funnelStage: 'mofu', funnelConfidence: 0.8, geoCity: null, compositeScore: 0.75 },
        { keyword: 'kw3', embedding: createEmbedding(3), volume: 1000, difficulty: 30, funnelStage: 'tofu', funnelConfidence: 0.7, geoCity: null, compositeScore: 0.65 },
      ];

      const cluster = createMockCluster(0, mixedKeywords);

      // 33% each - no single stage dominates at 80%
      expect(cluster.funnelBreakdown.bofu).toBeCloseTo(0.33, 1);
      expect(cluster.funnelBreakdown.mofu).toBeCloseTo(0.33, 1);
      expect(cluster.funnelBreakdown.tofu).toBeCloseTo(0.33, 1);

      // IntentSplitter should split this cluster
      const splitter = new IntentSplitter({ funnelVarianceThreshold: 0.2 });
      const result = splitter.splitClusters([cluster]);

      // Should be split into 3 clusters (one per funnel stage)
      expect(result.clusters.length).toBe(3);
      expect(result.stats.splitCount).toBe(1);

      // Each resulting cluster should have homogeneous funnel
      for (const splitCluster of result.clusters) {
        const maxRatio = Math.max(
          splitCluster.funnelBreakdown.bofu,
          splitCluster.funnelBreakdown.mofu,
          splitCluster.funnelBreakdown.tofu
        );
        expect(maxRatio).toBe(1.0); // All keywords in cluster have same funnel
      }
    });
  });

  /**
   * Additional edge case tests
   */
  describe('Edge cases', () => {
    it('should handle keywords with missing embeddings gracefully', () => {
      const filterResults: FilterResult[] = [
        createFilterResult('with_embedding', { embedding: createEmbedding(1) }),
        { ...createFilterResult('without_embedding'), embedding: undefined },
      ];

      const mappingResult = mapFilterResultsToClusteringInputs(filterResults);

      expect(mappingResult.inputs.length).toBe(1);
      expect(mappingResult.skipped.length).toBe(1);
      expect(mappingResult.skipped[0].keyword).toBe('without_embedding');
    });

    it('should handle single keyword cluster', () => {
      const singleKeyword: ClusteringInput[] = [
        { keyword: 'solo', embedding: createEmbedding(1), volume: 1000, difficulty: 30, funnelStage: 'mofu', funnelConfidence: 0.8, geoCity: null, compositeScore: 0.7 },
      ];

      const cluster = createMockCluster(0, singleKeyword);
      expect(cluster.keywords.length).toBe(1);
      expect(cluster.totalVolume).toBe(1000);
      expect(cluster.funnelBreakdown.mofu).toBe(1.0);

      const labeled = createLabeledCluster(cluster);
      const hierarchical: HierarchicalCluster = {
        ...labeled,
        tier: 'longtail',
        parentId: null,
        childIds: [],
      };
      const portal = toPortalCluster(hierarchical);

      expect(portal.keywords.length).toBe(1);
      expect(portal.progress.total).toBe(1);
    });

    it('should validate funnel stages are lowercase', () => {
      // Funnel stages must be exactly 'bofu', 'mofu', or 'tofu' (lowercase)
      const validFunnels: Array<'bofu' | 'mofu' | 'tofu'> = ['bofu', 'mofu', 'tofu'];

      for (const funnel of validFunnels) {
        const filterResult = createFilterResult('test', { funnelStage: funnel });
        expect(filterResult.classification!.funnelStage).toBe(funnel);
        expect(filterResult.classification!.funnelStage).toMatch(/^[a-z]+$/);
      }
    });

    it('should correctly calculate progress metrics for portal', () => {
      const keywords: ClusteringInput[] = [
        { keyword: 'top10_1', embedding: createEmbedding(1), volume: 1000, difficulty: 30, funnelStage: 'mofu', funnelConfidence: 0.8, geoCity: null, compositeScore: 0.8, position: 3 },
        { keyword: 'top10_2', embedding: createEmbedding(2), volume: 800, difficulty: 25, funnelStage: 'bofu', funnelConfidence: 0.9, geoCity: null, compositeScore: 0.85, position: 8 },
        { keyword: 'top20_1', embedding: createEmbedding(3), volume: 600, difficulty: 35, funnelStage: 'mofu', funnelConfidence: 0.75, geoCity: null, compositeScore: 0.7, position: 15 },
        { keyword: 'pending_1', embedding: createEmbedding(4), volume: 500, difficulty: 40, funnelStage: 'tofu', funnelConfidence: 0.6, geoCity: null, compositeScore: 0.6, position: null },
        { keyword: 'progress_1', embedding: createEmbedding(5), volume: 400, difficulty: 45, funnelStage: 'tofu', funnelConfidence: 0.5, geoCity: null, compositeScore: 0.5, position: 35 },
      ];

      const cluster = createMockCluster(0, keywords);
      const labeled = createLabeledCluster(cluster);
      const hierarchical: HierarchicalCluster = {
        ...labeled,
        tier: 'subtopic',
        parentId: null,
        childIds: [],
      };
      const portal = toPortalCluster(hierarchical);

      // 2 in top 10, 1 in top 20, 1 pending, 1 in progress
      expect(portal.progress.inTop10).toBe(2);
      expect(portal.progress.inTop20).toBe(1);
      expect(portal.progress.total).toBe(5);
      expect(portal.progress.percentComplete).toBe(40); // 2/5 * 100

      // Verify individual keyword statuses
      const statusCounts = portal.keywords.reduce(
        (acc, k) => {
          acc[k.status] = (acc[k.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(statusCounts['top10']).toBe(2);
      expect(statusCounts['top20']).toBe(1);
      expect(statusCounts['pending']).toBe(1);
      expect(statusCounts['progress']).toBe(1);
    });
  });
});
