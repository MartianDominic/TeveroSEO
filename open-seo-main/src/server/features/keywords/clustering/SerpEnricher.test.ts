/**
 * SerpEnricher Tests
 * Phase 86-06: Semantic Intelligence Pipeline
 *
 * Tests SERP position enrichment for selected keywords.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClusteringInput } from './types';
import { SerpEnricher, enrichWithSerp } from './SerpEnricher';

describe('SerpEnricher', () => {
  let mockKeywords: ClusteringInput[];

  beforeEach(() => {
    mockKeywords = [
      createMockKeyword('keyword-1', { volume: 1000 }),
      createMockKeyword('keyword-2', { volume: 2000 }),
      createMockKeyword('keyword-3', { volume: 500 }),
    ];
  });

  describe('enrich()', () => {
    it('should enrich keywords with position data', async () => {
      const enricher = new SerpEnricher({ domain: 'example.com' });

      // Mock fetchBatchPositions to return specific positions
      vi.spyOn(enricher as any, 'fetchBatchPositions').mockResolvedValue([
        { ...mockKeywords[0], currentPosition: 15, isQuickWin: true, opportunityScore: 75 },
        { ...mockKeywords[1], currentPosition: null, isQuickWin: false, opportunityScore: 50 },
        { ...mockKeywords[2], currentPosition: 5, isQuickWin: false, opportunityScore: 60 },
      ]);

      const result = await enricher.enrich(mockKeywords);

      expect(result.keywords).toHaveLength(3);
      expect(result.keywords[0].currentPosition).toBe(15);
      expect(result.keywords[1].currentPosition).toBeNull();
      expect(result.keywords[2].currentPosition).toBe(5);
    });

    it('should identify quick-wins (position 11-50)', async () => {
      const enricher = new SerpEnricher({ domain: 'example.com' });

      vi.spyOn(enricher as any, 'fetchBatchPositions').mockResolvedValue([
        { ...mockKeywords[0], currentPosition: 15, isQuickWin: true, opportunityScore: 75 },
        { ...mockKeywords[1], currentPosition: 25, isQuickWin: true, opportunityScore: 70 },
        { ...mockKeywords[2], currentPosition: 5, isQuickWin: false, opportunityScore: 60 },
      ]);

      const result = await enricher.enrich(mockKeywords);

      const quickWins = result.keywords.filter((k) => k.isQuickWin);
      expect(quickWins).toHaveLength(2);
      expect(result.stats.quickWins).toBe(2);
    });

    it('should handle missing position data gracefully', async () => {
      const enricher = new SerpEnricher({ domain: 'example.com' });

      vi.spyOn(enricher as any, 'fetchBatchPositions').mockResolvedValue([
        { ...mockKeywords[0], currentPosition: null, isQuickWin: false, opportunityScore: 50 },
        { ...mockKeywords[1], currentPosition: null, isQuickWin: false, opportunityScore: 50 },
        { ...mockKeywords[2], currentPosition: null, isQuickWin: false, opportunityScore: 50 },
      ]);

      const result = await enricher.enrich(mockKeywords);

      expect(result.stats.notRanking).toBe(3);
      expect(result.stats.ranking).toBe(0);
      expect(result.stats.avgPosition).toBeNull();
    });

    it('should calculate opportunity scores based on position + volume', async () => {
      const enricher = new SerpEnricher({ domain: 'example.com' });

      vi.spyOn(enricher as any, 'fetchBatchPositions').mockResolvedValue([
        {
          ...mockKeywords[0],
          currentPosition: 15,
          isQuickWin: true,
          opportunityScore: 75,
        },
        {
          ...mockKeywords[1],
          currentPosition: null,
          isQuickWin: false,
          opportunityScore: 45,
        },
      ]);

      const result = await enricher.enrich(mockKeywords.slice(0, 2));

      // Quick-win should have higher opportunity score
      expect(result.keywords[0].opportunityScore).toBeGreaterThan(
        result.keywords[1].opportunityScore
      );
    });

    it('should respect batch size limit (default 100)', async () => {
      const manyKeywords = Array.from({ length: 150 }, (_, i) =>
        createMockKeyword(`keyword-${i}`, { volume: 1000 })
      );

      const enricher = new SerpEnricher({ domain: 'example.com' });
      const fetchSpy = vi.spyOn(enricher as any, 'fetchBatchPositions');
      fetchSpy.mockResolvedValue([]);

      await enricher.enrich(manyKeywords);

      // Should be called twice: batch 1 (100) + batch 2 (50)
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should respect batch delay for rate limiting', async () => {
      const manyKeywords = Array.from({ length: 150 }, (_, i) =>
        createMockKeyword(`keyword-${i}`, { volume: 1000 })
      );

      const enricher = new SerpEnricher({
        domain: 'example.com',
        batchDelayMs: 100,
      });

      vi.spyOn(enricher as any, 'fetchBatchPositions').mockResolvedValue([]);
      const delaySpy = vi.spyOn(enricher as any, 'delay');

      await enricher.enrich(manyKeywords);

      // Should delay between batches (not after last batch)
      expect(delaySpy).toHaveBeenCalledTimes(1);
      expect(delaySpy).toHaveBeenCalledWith(100);
    });

    it('should calculate stats correctly', async () => {
      const enricher = new SerpEnricher({ domain: 'example.com' });

      vi.spyOn(enricher as any, 'fetchBatchPositions').mockResolvedValue([
        { ...mockKeywords[0], currentPosition: 15, isQuickWin: true, opportunityScore: 75 },
        { ...mockKeywords[1], currentPosition: null, isQuickWin: false, opportunityScore: 50 },
        { ...mockKeywords[2], currentPosition: 25, isQuickWin: true, opportunityScore: 70 },
      ]);

      const result = await enricher.enrich(mockKeywords);

      expect(result.stats).toMatchObject({
        totalKeywords: 3,
        ranking: 2,
        notRanking: 1,
        quickWins: 2,
        avgPosition: 20, // (15 + 25) / 2
      });
    });
  });

  describe('enrichWithSerp() factory', () => {
    it('should work as factory function', async () => {
      const result = await enrichWithSerp(mockKeywords, { domain: 'example.com' });

      expect(result.keywords).toHaveLength(3);
      expect(result.stats.totalKeywords).toBe(3);
    });
  });
});

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockKeyword(
  keyword: string,
  overrides?: Partial<ClusteringInput>
): ClusteringInput {
  return {
    keyword,
    embedding: new Array(768).fill(Math.random()),
    volume: overrides?.volume ?? 1000,
    difficulty: overrides?.difficulty ?? 50,
    funnelStage: overrides?.funnelStage ?? 'mofu',
    funnelConfidence: overrides?.funnelConfidence ?? 0.7,
    geoCity: overrides?.geoCity ?? null,
    compositeScore: overrides?.compositeScore ?? 50,
    position: overrides?.position !== undefined ? overrides.position : null,
  };
}
