/**
 * Tests for SemanticDeduplicator
 * Phase 86-01: Semantic Deduplication
 *
 * TDD: Tests written first, implementation follows.
 *
 * CRITICAL: Tests include embedding dimension validation (768-dim for jina-v5-text-nano)
 * per 86-RESEARCH.md Pitfall 1: Embedding Dimension Mismatch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticDeduplicator, deduplicate } from './SemanticDeduplicator';
import type { ClusteringInput, DeduplicationConfig } from './types';
import { EMBEDDING_DIMENSION } from './types';

// Mock embedding service
vi.mock('@/server/lib/embeddings/UnifiedEmbeddingService', () => ({
  cosineSimilarity: vi.fn((a: number[], b: number[]) => {
    // Simple mock: same arrays return 1.0, otherwise calculate based on first element
    if (a === b) return 1.0;
    if (JSON.stringify(a) === JSON.stringify(b)) return 1.0;
    // Use first element to simulate similarity for testing
    const sim = 1 - Math.abs(a[0] - b[0]);
    return Math.max(0, Math.min(1, sim));
  }),
}));

describe('SemanticDeduplicator', () => {
  // Helper to create test input with 768-dim embedding (first element varies for similarity control)
  function createInput(
    keyword: string,
    similarityValue: number,  // First element of embedding (0-1) for mock similarity calculation
    volume: number,
    difficulty: number = 30
  ): ClusteringInput {
    // Create 768-dim embedding with the similarity value as first element
    const embedding = new Array(EMBEDDING_DIMENSION).fill(0);
    embedding[0] = similarityValue;

    return {
      keyword,
      embedding,
      volume,
      difficulty,
      funnelStage: 'bofu',
      funnelConfidence: 0.8,
      geoCity: null,
      compositeScore: 0.7,
    };
  }

  // Helper to create input with specific embedding array (for dimension tests)
  function createInputWithEmbedding(
    keyword: string,
    embedding: number[],
    volume: number,
    difficulty: number = 30
  ): ClusteringInput {
    return {
      keyword,
      embedding,
      volume,
      difficulty,
      funnelStage: 'bofu',
      funnelConfidence: 0.8,
      geoCity: null,
      compositeScore: 0.7,
    };
  }

  describe('EMBEDDING_DIMENSION constant', () => {
    it('should be 768 for jina-v5-text-nano', () => {
      expect(EMBEDDING_DIMENSION).toBe(768);
    });
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const dedup = new SemanticDeduplicator();
      expect(dedup).toBeInstanceOf(SemanticDeduplicator);
    });

    it('should accept custom config', () => {
      const config: DeduplicationConfig = {
        similarityThreshold: 0.95,
        canonicalStrategy: 'shortest',
      };
      const dedup = new SemanticDeduplicator(config);
      expect(dedup).toBeInstanceOf(SemanticDeduplicator);
    });
  });

  describe('embedding validation', () => {
    let dedup: SemanticDeduplicator;

    beforeEach(() => {
      dedup = new SemanticDeduplicator({
        similarityThreshold: 0.92,
        canonicalStrategy: 'highest_volume',
      });
    });

    it('should throw clear error for wrong embedding dimension', () => {
      const wrongDimInput = createInputWithEmbedding('test', new Array(512).fill(0), 100);

      expect(() => dedup.deduplicate([wrongDimInput])).toThrow(
        /expected 768.*got 512/i
      );
    });

    it('should throw for embedding dimension 1024 (wrong model)', () => {
      const wrongDimInput = createInputWithEmbedding('test', new Array(1024).fill(0), 100);

      expect(() => dedup.deduplicate([wrongDimInput])).toThrow(
        /expected 768.*got 1024/i
      );
    });

    it('should skip keywords with missing embeddings and log warning', () => {
      const inputWithoutEmbedding = {
        keyword: 'missing-embedding',
        embedding: undefined as unknown as number[],
        volume: 100,
        difficulty: 30,
        funnelStage: 'bofu' as const,
        funnelConfidence: 0.8,
        geoCity: null,
        compositeScore: 0.7,
      };

      const validInput = createInput('valid', 0.5, 200);

      const result = dedup.deduplicate([inputWithoutEmbedding, validInput]);

      // Valid input should be processed
      expect(result.canonicals).toHaveLength(1);
      expect(result.canonicals[0].keyword).toBe('valid');

      // Skipped count should be tracked
      expect(result.stats.skippedInvalidEmbeddings).toBe(1);
    });

    it('should reject embeddings with NaN values', () => {
      const embedding = new Array(768).fill(0);
      embedding[100] = NaN;
      const nanInput = createInputWithEmbedding('nan-embedding', embedding, 100);

      expect(() => dedup.deduplicate([nanInput])).toThrow(/invalid embedding value/i);
    });

    it('should reject embeddings with Infinity values', () => {
      const embedding = new Array(768).fill(0);
      embedding[50] = Infinity;
      const infInput = createInputWithEmbedding('inf-embedding', embedding, 100);

      expect(() => dedup.deduplicate([infInput])).toThrow(/invalid embedding value/i);
    });
  });

  describe('deduplicate', () => {
    let dedup: SemanticDeduplicator;

    beforeEach(() => {
      dedup = new SemanticDeduplicator({
        similarityThreshold: 0.92,
        canonicalStrategy: 'highest_volume',
      });
    });

    it('should return empty result for empty input', () => {
      const result = dedup.deduplicate([]);

      expect(result.canonicals).toHaveLength(0);
      expect(result.merged).toHaveLength(0);
      expect(result.stats.inputCount).toBe(0);
      expect(result.stats.outputCount).toBe(0);
    });

    it('should return single keyword unchanged', () => {
      const input = [createInput('sampunas', 0.5, 1000)];
      const result = dedup.deduplicate(input);

      expect(result.canonicals).toHaveLength(1);
      expect(result.canonicals[0].keyword).toBe('sampunas');
      expect(result.stats.mergedCount).toBe(0);
    });

    it('should merge near-duplicates with similarity > threshold', () => {
      // Embeddings with 0.05 difference = 0.95 similarity (above 0.92)
      const input = [
        createInput('sampunas plaukams', 0.50, 500),
        createInput('plauku sampunas', 0.55, 800), // Higher volume, should be canonical
      ];

      const result = dedup.deduplicate(input);

      expect(result.canonicals).toHaveLength(1);
      expect(result.canonicals[0].keyword).toBe('plauku sampunas'); // Higher volume
      expect(result.stats.mergedCount).toBe(1);
      expect(result.stats.reductionPercent).toBeCloseTo(50, 0);
    });

    it('should keep keywords separate when similarity < threshold', () => {
      // Embeddings with 0.2 difference = 0.8 similarity (below 0.92)
      const input = [
        createInput('sampunas', 0.50, 500),
        createInput('kondicionierius', 0.70, 800),
      ];

      const result = dedup.deduplicate(input);

      expect(result.canonicals).toHaveLength(2);
      expect(result.stats.mergedCount).toBe(0);
    });

    it('should select canonical with highest volume', () => {
      const input = [
        createInput('variant_a', 0.50, 100),
        createInput('variant_b', 0.52, 500), // Highest volume
        createInput('variant_c', 0.54, 300),
      ];

      const result = dedup.deduplicate(input);

      expect(result.canonicals).toHaveLength(1);
      expect(result.canonicals[0].keyword).toBe('variant_b');
    });

    it('should sum volumes of merged keywords', () => {
      const input = [
        createInput('variant_a', 0.50, 100),
        createInput('variant_b', 0.52, 500),
        createInput('variant_c', 0.54, 300),
      ];

      const result = dedup.deduplicate(input);

      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].combinedVolume).toBe(900); // 100 + 500 + 300
    });

    it('should average difficulties of merged keywords', () => {
      const input = [
        createInput('variant_a', 0.50, 100, 20),
        createInput('variant_b', 0.52, 500, 40),
        createInput('variant_c', 0.54, 300, 30),
      ];

      const result = dedup.deduplicate(input);

      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].averageDifficulty).toBe(30); // (20 + 40 + 30) / 3
    });

    it('should track merged variants', () => {
      const input = [
        createInput('variant_a', 0.50, 100),
        createInput('variant_b', 0.52, 500),
      ];

      const result = dedup.deduplicate(input);

      expect(result.merged[0].mergedFrom).toContain('variant_a');
      expect(result.merged[0].mergedFrom).toContain('variant_b');
      expect(result.merged[0].variantCount).toBe(2);
    });

    it('should build merge map for all keywords', () => {
      const input = [
        createInput('canonical', 0.50, 500),
        createInput('variant', 0.52, 100),
      ];

      const result = dedup.deduplicate(input);

      expect(result.mergeMap.get('variant')).toBe('canonical');
      expect(result.mergeMap.get('canonical')).toBe('canonical');
    });

    it('should handle multiple separate merge groups', () => {
      const input = [
        // Group 1: sampunas variants (close embeddings)
        createInput('sampunas a', 0.20, 500),
        createInput('sampunas b', 0.22, 300),
        // Group 2: kondicionierius variants (far from group 1)
        createInput('kondicionierius a', 0.80, 400),
        createInput('kondicionierius b', 0.82, 200),
      ];

      const result = dedup.deduplicate(input);

      expect(result.canonicals).toHaveLength(2);
      expect(result.merged).toHaveLength(2);
    });

    it('should report accurate statistics', () => {
      const input = [
        createInput('a', 0.50, 100),
        createInput('b', 0.52, 200),
        createInput('c', 0.90, 300), // Far from a/b
      ];

      const result = dedup.deduplicate(input);

      expect(result.stats.inputCount).toBe(3);
      expect(result.stats.outputCount).toBe(2); // a/b merged, c separate
      expect(result.stats.mergedCount).toBe(1); // 1 merge operation
      expect(result.stats.reductionPercent).toBeCloseTo(33.33, 1);
    });

    it('should handle identical embeddings (self-similarity = 1.0)', () => {
      const embedding = new Array(768).fill(0.5);
      const input = [
        createInputWithEmbedding('same_a', [...embedding], 100),
        createInputWithEmbedding('same_b', [...embedding], 200),
      ];

      const result = dedup.deduplicate(input);

      expect(result.canonicals).toHaveLength(1);
      expect(result.canonicals[0].keyword).toBe('same_b'); // Higher volume
    });
  });

  describe('deduplicate factory function', () => {
    it('should work with default config', () => {
      const input = [createInput('test', 0.5, 100)];
      const result = deduplicate(input);

      expect(result.canonicals).toHaveLength(1);
    });

    it('should accept custom config', () => {
      const input = [
        createInput('a', 0.50, 100),
        createInput('b', 0.55, 200), // 0.95 similarity
      ];

      // With 0.96 threshold, these should NOT merge
      const result = deduplicate(input, {
        similarityThreshold: 0.96,
        canonicalStrategy: 'highest_volume',
      });

      expect(result.canonicals).toHaveLength(2);
    });
  });

  describe('performance', () => {
    it('should process 1000 keywords in reasonable time', () => {
      // Create 1000 keywords with 768-dim embeddings
      const input: ClusteringInput[] = Array.from({ length: 1000 }, (_, i) => {
        const embedding = new Array(768).fill(0);
        embedding[0] = i / 1000;  // Spread out similarity values
        return {
          keyword: `keyword_${i}`,
          embedding,
          volume: 100 + i,
          difficulty: 30,
          funnelStage: 'bofu' as const,
          funnelConfidence: 0.8,
          geoCity: null,
          compositeScore: 0.7,
        };
      });

      const dedup = new SemanticDeduplicator();
      const startTime = Date.now();
      const result = dedup.deduplicate(input);
      const elapsed = Date.now() - startTime;

      // Should complete in < 5 seconds (generous for test environment)
      expect(elapsed).toBeLessThan(5000);
      expect(result.canonicals.length).toBeGreaterThan(0);
    });
  });
});
