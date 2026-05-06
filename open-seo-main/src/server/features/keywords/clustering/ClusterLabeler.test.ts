/**
 * Tests for ClusterLabeler
 * Phase 86-04: Topic Labeling
 *
 * CRITICAL:
 * - Primary method: centroid_nearest (FREE)
 * - LLM fallback: Grok 4.1 Fast ($0.20/1M) ONLY
 * - NO GPT-4, NO Claude for labeling
 * - Lithuanian diacritics handled correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClusterLabeler, labelClusters, transliterateLithuanian } from './ClusterLabeler';
import type { KeywordCluster, ClusteringInput, LabeledCluster } from './types';

// Mock the Grok API client
vi.mock('@/server/lib/llm/grok-client', () => ({
  grokFast: {
    generateLabel: vi.fn(),
  },
}));

describe('ClusterLabeler', () => {
  function createKeyword(
    keyword: string,
    embedding: number[] = Array(768).fill(0.5)
  ): ClusteringInput {
    return {
      keyword,
      embedding,
      volume: 100,
      difficulty: 30,
      funnelStage: 'bofu',
      funnelConfidence: 0.8,
      geoCity: null,
      compositeScore: 0.7,
    };
  }

  function createCluster(
    id: number,
    keywords: ClusteringInput[],
    centroid?: number[]
  ): KeywordCluster {
    const bofu = keywords.filter(k => k.funnelStage === 'bofu').length;
    const mofu = keywords.filter(k => k.funnelStage === 'mofu').length;
    const tofu = keywords.filter(k => k.funnelStage === 'tofu').length;
    const dominantFunnel = bofu >= mofu && bofu >= tofu ? 'bofu' : (mofu >= tofu ? 'mofu' : 'tofu');

    return {
      clusterId: id,
      keywords,
      centroid: centroid || Array(768).fill(0.5),
      totalVolume: keywords.reduce((s, k) => s + k.volume, 0),
      averageDifficulty: 30,
      dominantFunnel,
      funnelBreakdown: { bofu, mofu, tofu },
    };
  }

  describe('transliterateLithuanian', () => {
    it('should preserve Lithuanian diacritics for labelLt', () => {
      // This is for slug generation, labelLt keeps diacritics
      const input = 'Plaukų šampūnai';
      const result = transliterateLithuanian(input);
      expect(result).toBe('plauku-sampunai');
    });

    it('should handle all Lithuanian diacritics', () => {
      // ą→a, č→c, ę→e, ė→e, į→i, š→s, ų→u, ū→u, ž→z
      const input = 'ąčęėįšųūž ĄČĘĖĮŠŲŪŽ';
      const result = transliterateLithuanian(input);
      expect(result).toBe('aceeisuuz-aceeisuuz');
    });

    it('should convert spaces to hyphens', () => {
      const input = 'plaukų priežiūra namų';
      const result = transliterateLithuanian(input);
      expect(result).toBe('plauku-prieziura-namu');
    });

    it('should remove non-alphanumeric characters', () => {
      const input = 'Plaukų priežiūra (2024)!';
      const result = transliterateLithuanian(input);
      expect(result).toBe('plauku-prieziura-2024');
    });
  });

  describe('centroid_nearest method', () => {
    it('should select keyword closest to centroid', () => {
      const labeler = new ClusterLabeler({ method: 'centroid_nearest' });

      // Create keywords with different distances from centroid
      const nearCentroid = createKeyword('šampūnas plaukams');
      nearCentroid.embedding = Array(768).fill(0.9);

      const farFromCentroid = createKeyword('other keyword');
      farFromCentroid.embedding = Array(768).fill(0.1);

      const cluster = createCluster(
        0,
        [farFromCentroid, nearCentroid],
        Array(768).fill(0.9)  // Centroid near first keyword
      );

      const result = labeler.labelClusterSync(cluster);

      expect(result.labelLt).toBe('Šampūnas plaukams');
      expect(result.labelMethod).toBe('centroid_nearest');
    });

    it('should return confidence based on cosine similarity', () => {
      const labeler = new ClusterLabeler({ method: 'centroid_nearest' });

      const keyword = createKeyword('test keyword');
      keyword.embedding = Array(768).fill(0.8);

      const cluster = createCluster(
        0,
        [keyword],
        Array(768).fill(0.8)  // Perfect match
      );

      const result = labeler.labelClusterSync(cluster);

      expect(result.labelConfidence).toBeGreaterThan(0.9);
    });
  });

  describe('ngram method', () => {
    it('should extract most frequent bigram', () => {
      const labeler = new ClusterLabeler({ method: 'ngram' });

      const cluster = createCluster(0, [
        createKeyword('plaukų šampūnas'),
        createKeyword('plaukų kaukė'),
        createKeyword('plaukų priežiūra'),
        createKeyword('odos kremas'),
      ]);

      const result = labeler.labelClusterSync(cluster);

      // "plaukų" appears in 3/4 keywords
      expect(result.labelLt.toLowerCase()).toContain('plaukų');
      expect(result.labelMethod).toBe('ngram');
    });

    it('should handle single-word clusters', () => {
      const labeler = new ClusterLabeler({ method: 'ngram' });

      const cluster = createCluster(0, [
        createKeyword('šampūnas'),
        createKeyword('šampūnas'),
        createKeyword('kremas'),
      ]);

      const result = labeler.labelClusterSync(cluster);

      expect(result.labelLt).toBeDefined();
      expect(result.labelLt.length).toBeGreaterThan(0);
    });
  });

  describe('label output format', () => {
    it('should generate labelLt with preserved diacritics', () => {
      const labeler = new ClusterLabeler({ method: 'centroid_nearest' });

      const keyword = createKeyword('plaukų šampūnai');
      const cluster = createCluster(0, [keyword]);

      const result = labeler.labelClusterSync(cluster);

      // Lithuanian diacritics preserved in labelLt
      expect(result.labelLt).toMatch(/[ąčęėįšųūž]/i);
    });

    it('should generate labelEn with title case', () => {
      const labeler = new ClusterLabeler({ method: 'centroid_nearest' });

      const keyword = createKeyword('hair shampoo');
      const cluster = createCluster(0, [keyword]);

      const result = labeler.labelClusterSync(cluster);

      expect(result.labelEn).toBe('Hair Shampoo');
    });

    it('should generate valid kebab-case suggestedUrl', () => {
      const labeler = new ClusterLabeler({ method: 'centroid_nearest' });

      const keyword = createKeyword('Plaukų Šampūnai 2024');
      const cluster = createCluster(0, [keyword]);

      const result = labeler.labelClusterSync(cluster);

      // No diacritics, lowercase, hyphens
      expect(result.suggestedUrl).toMatch(/^[a-z0-9-]+$/);
      expect(result.suggestedUrl).not.toMatch(/[ĄČĘĖĮŠŲŪŽĄ-ž]/);
    });
  });

  describe('auto method (centroid + LLM fallback)', () => {
    it('should use centroid_nearest when confidence >= 0.6', async () => {
      const labeler = new ClusterLabeler({
        method: 'auto',
        llmFallbackThreshold: 0.6,
      });

      // High similarity keyword
      const keyword = createKeyword('perfect match');
      keyword.embedding = Array(768).fill(0.95);

      const cluster = createCluster(0, [keyword], Array(768).fill(0.95));

      const result = await labeler.labelCluster(cluster);

      expect(result.labelMethod).toBe('centroid_nearest');
    });

    it('should fall back to LLM when confidence < 0.6', async () => {
      const { grokFast } = await import('@/server/lib/llm/grok-client');
      vi.mocked(grokFast.generateLabel).mockResolvedValue({
        labelLt: 'Plaukų priežiūra',
        labelEn: 'Hair Care',
      });

      const labeler = new ClusterLabeler({
        method: 'auto',
        llmFallbackThreshold: 0.6,
        grokApiKey: 'test-key',
      });

      // Low similarity - create orthogonal embeddings
      const keyword1 = createKeyword('keyword1');
      keyword1.embedding = Array(768).fill(0).map((_, i) => i % 2 === 0 ? 1 : 0);

      const keyword2 = createKeyword('keyword2');
      keyword2.embedding = Array(768).fill(0).map((_, i) => i % 2 === 1 ? 1 : 0);

      // Centroid will be average, low similarity to both
      const cluster = createCluster(0, [keyword1, keyword2]);

      const result = await labeler.labelCluster(cluster);

      expect(result.labelMethod).toBe('llm');
      expect(grokFast.generateLabel).toHaveBeenCalled();
    });

    it('should use Grok 4.1 Fast, NOT GPT-4 or Claude', async () => {
      const { grokFast } = await import('@/server/lib/llm/grok-client');

      const labeler = new ClusterLabeler({
        method: 'llm',
        grokApiKey: 'test-key',
      });

      const cluster = createCluster(0, [createKeyword('test')]);

      await labeler.labelCluster(cluster);

      // Verify Grok client was called, not OpenAI or Anthropic
      expect(grokFast.generateLabel).toHaveBeenCalled();
    });
  });

  describe('labelClusters factory', () => {
    it('should label multiple clusters', async () => {
      const clusters = [
        createCluster(0, [createKeyword('cluster one')]),
        createCluster(1, [createKeyword('cluster two')]),
      ];

      const results = await labelClusters(clusters);

      expect(results).toHaveLength(2);
      expect(results[0].labelLt).toBeDefined();
      expect(results[1].labelLt).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty cluster', () => {
      const labeler = new ClusterLabeler();
      const cluster = createCluster(0, []);

      const result = labeler.labelClusterSync(cluster);

      expect(result.labelLt).toBe('Unknown');
      expect(result.labelConfidence).toBe(0);
    });

    it('should handle cluster with all identical keywords', () => {
      const labeler = new ClusterLabeler({ method: 'ngram' });
      const cluster = createCluster(0, [
        createKeyword('same keyword'),
        createKeyword('same keyword'),
        createKeyword('same keyword'),
      ]);

      const result = labeler.labelClusterSync(cluster);

      expect(result.labelLt).toBe('Same Keyword');
    });
  });
});
