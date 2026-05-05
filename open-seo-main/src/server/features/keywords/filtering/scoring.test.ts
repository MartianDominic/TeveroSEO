/**
 * Tests for CompositeScorer and scoring functions
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeVolume,
  computeBaseScore,
  computePriorityMultiplier,
  computeQuickWinBonus,
  CompositeScorer,
} from './scoring';
import type { CategoryPriorityInput, ClassifiedKeywordInput } from './types';
import { SCORING_WEIGHTS } from './types';

describe('Scoring Functions', () => {
  describe('normalizeVolume', () => {
    it('should return 0 for volume 0', () => {
      expect(normalizeVolume(0)).toBe(0);
    });

    it('should return ~0.5 for volume 100', () => {
      // log10(100) = 2, 2/4 = 0.5
      expect(normalizeVolume(100)).toBeCloseTo(0.5, 2);
    });

    it('should return 1.0 for volume 10000', () => {
      // log10(10000) = 4, 4/4 = 1.0
      expect(normalizeVolume(10000)).toBe(1.0);
    });

    it('should cap at 1.0 for volumes > 10000', () => {
      expect(normalizeVolume(100000)).toBe(1.0);
    });

    it('should return 0 for negative volumes', () => {
      expect(normalizeVolume(-100)).toBe(0);
    });

    it('should handle volume 1000 correctly', () => {
      // log10(1000) = 3, 3/4 = 0.75
      expect(normalizeVolume(1000)).toBeCloseTo(0.75, 2);
    });
  });

  describe('computeBaseScore', () => {
    it('should compute weighted sum correctly', () => {
      const result = computeBaseScore({
        relevanceScore: 0.8,
        funnelConfidence: 0.9,
        geoScore: 1.0,
        volume: 1000, // normalizes to 0.75
      });

      // 0.8*0.4 + 0.9*0.3 + 1.0*0.2 + 0.75*0.1 = 0.32 + 0.27 + 0.2 + 0.075 = 0.865
      expect(result).toBeCloseTo(0.865, 2);
    });

    it('should use default 0.5 for missing scores', () => {
      const result = computeBaseScore({});

      // All defaults: 0.5*0.4 + 0.5*0.3 + 0.5*0.2 + 0.0*0.1 = 0.2 + 0.15 + 0.1 + 0 = 0.45
      expect(result).toBeCloseTo(0.45, 2);
    });

    it('should apply correct weights from SCORING_WEIGHTS', () => {
      const result = computeBaseScore({
        relevanceScore: 1.0,
        funnelConfidence: 0.0,
        geoScore: 0.0,
        volume: 0,
      });

      // Only relevance: 1.0*0.4 = 0.4
      expect(result).toBeCloseTo(SCORING_WEIGHTS.relevance, 2);
    });

    it('should handle CONTEXT.md example (detailing keyword)', () => {
      const result = computeBaseScore({
        relevanceScore: 0.75,
        funnelConfidence: 0.9,
        geoScore: 1.0,
        volume: 320, // log10(320) ≈ 2.505, 2.505/4 ≈ 0.626
      });

      // 0.75*0.4 + 0.9*0.3 + 1.0*0.2 + 0.626*0.1 ≈ 0.3 + 0.27 + 0.2 + 0.063 = 0.833
      expect(result).toBeCloseTo(0.833, 1);
    });
  });

  describe('computePriorityMultiplier', () => {
    const priorities: CategoryPriorityInput[] = [
      { category: 'detailing', weightMultiplier: 1.5 },
      { category: 'wash', categoryLt: 'plovykla', weightMultiplier: 1.2 },
      { category: 'tinting', weightMultiplier: 2.0 },
    ];

    it('should return 1.0 for no priority match', () => {
      expect(computePriorityMultiplier('random keyword', priorities)).toBe(1.0);
    });

    it('should match category case-insensitively', () => {
      expect(computePriorityMultiplier('DETAILING paslaugos', priorities)).toBe(1.5);
      expect(computePriorityMultiplier('detailing šiauliuose', priorities)).toBe(1.5);
    });

    it('should match Lithuanian variant', () => {
      expect(computePriorityMultiplier('plovykla šiauliuose', priorities)).toBe(1.2);
      expect(computePriorityMultiplier('Plovykla ŠIAULIUOSE', priorities)).toBe(1.2);
    });

    it('should return first matching priority', () => {
      // Both detailing and wash could match, but detailing comes first
      const keyword = 'detailing wash service';
      expect(computePriorityMultiplier(keyword, priorities)).toBe(1.5);
    });

    it('should handle empty priorities array', () => {
      expect(computePriorityMultiplier('any keyword', [])).toBe(1.0);
    });

    it('should handle substring matching', () => {
      expect(computePriorityMultiplier('auto detailing center', priorities)).toBe(1.5);
    });
  });

  describe('computeQuickWinBonus', () => {
    describe('striking distance (11-20)', () => {
      it('should return 0.2 for position 15 with volume >= 100', () => {
        expect(computeQuickWinBonus(15, 100)).toBe(0.2);
        expect(computeQuickWinBonus(15, 320)).toBe(0.2);
      });

      it('should return 0.15 for position 15 with volume 50-99', () => {
        expect(computeQuickWinBonus(15, 50)).toBe(0.15);
        expect(computeQuickWinBonus(15, 99)).toBe(0.15);
      });

      it('should return 0.1 for position 15 with volume < 50', () => {
        expect(computeQuickWinBonus(15, 10)).toBe(0.1);
        expect(computeQuickWinBonus(15, 49)).toBe(0.1);
      });

      it('should apply to position 11', () => {
        expect(computeQuickWinBonus(11, 100)).toBe(0.2);
      });

      it('should apply to position 20', () => {
        expect(computeQuickWinBonus(20, 100)).toBe(0.2);
      });
    });

    describe('opportunity (21-50)', () => {
      it('should return 0.15 for position 30 with volume >= 500', () => {
        expect(computeQuickWinBonus(30, 500)).toBe(0.15);
        expect(computeQuickWinBonus(30, 1000)).toBe(0.15);
      });

      it('should return 0.1 for position 30 with volume 200-499', () => {
        expect(computeQuickWinBonus(30, 200)).toBe(0.1);
        expect(computeQuickWinBonus(30, 499)).toBe(0.1);
      });

      it('should return 0 for position 30 with volume < 200', () => {
        expect(computeQuickWinBonus(30, 100)).toBe(0);
        expect(computeQuickWinBonus(30, 199)).toBe(0);
      });

      it('should apply to position 21', () => {
        expect(computeQuickWinBonus(21, 500)).toBe(0.15);
      });

      it('should apply to position 50', () => {
        expect(computeQuickWinBonus(50, 500)).toBe(0.15);
      });
    });

    describe('edge cases', () => {
      it('should return 0 for null position', () => {
        expect(computeQuickWinBonus(null, 1000)).toBe(0);
      });

      it('should return 0 for undefined position', () => {
        expect(computeQuickWinBonus(undefined, 1000)).toBe(0);
      });

      it('should return 0 for position < 11', () => {
        expect(computeQuickWinBonus(10, 1000)).toBe(0);
        expect(computeQuickWinBonus(1, 1000)).toBe(0);
      });

      it('should return 0 for position > 50', () => {
        expect(computeQuickWinBonus(51, 1000)).toBe(0);
        expect(computeQuickWinBonus(100, 1000)).toBe(0);
      });

      it('should handle undefined volume as 0', () => {
        expect(computeQuickWinBonus(15, undefined)).toBe(0.1);
      });
    });
  });

  describe('CompositeScorer', () => {
    describe('basic scoring', () => {
      it('should compute score without priorities', () => {
        const scorer = new CompositeScorer();
        const input: ClassifiedKeywordInput = {
          keyword: 'test keyword',
          relevanceScores: { combinedScore: 0.8 },
          funnelConfidence: 0.9,
          geoClassification: { passesGeoFilter: true, geoScore: 1.0 },
          volume: 1000,
          position: null,
        };

        const result = scorer.score(input);

        // baseScore ≈ 0.865 (from computeBaseScore test)
        // priorityMultiplier = 1.0 (no match)
        // quickWinBonus = 0 (no position)
        // finalScore = 0.865 * 1.0 + 0 = 0.865
        expect(result.baseScore).toBeCloseTo(0.865, 2);
        expect(result.priorityMultiplier).toBe(1.0);
        expect(result.quickWinBonus).toBe(0);
        expect(result.finalScore).toBeCloseTo(0.865, 2);
      });

      it('should apply priority multiplier', () => {
        const priorities: CategoryPriorityInput[] = [
          { category: 'detailing', weightMultiplier: 1.5 },
        ];
        const scorer = new CompositeScorer(priorities);
        const input: ClassifiedKeywordInput = {
          keyword: 'detailing paslaugos',
          relevanceScores: { combinedScore: 0.8 },
          funnelConfidence: 0.9,
          geoClassification: { passesGeoFilter: true, geoScore: 1.0 },
          volume: 1000,
          position: null,
        };

        const result = scorer.score(input);

        // baseScore ≈ 0.865
        // priorityMultiplier = 1.5 (detailing match)
        // quickWinBonus = 0 (no position)
        // finalScore = 0.865 * 1.5 + 0 ≈ 1.298
        expect(result.priorityMultiplier).toBe(1.5);
        expect(result.finalScore).toBeCloseTo(1.298, 2);
      });

      it('should add quick win bonus', () => {
        const scorer = new CompositeScorer();
        const input: ClassifiedKeywordInput = {
          keyword: 'test keyword',
          relevanceScores: { combinedScore: 0.8 },
          funnelConfidence: 0.9,
          geoClassification: { passesGeoFilter: true, geoScore: 1.0 },
          volume: 320,
          position: 15,
        };

        const result = scorer.score(input);

        // baseScore ≈ 0.853 (0.8*0.4 + 0.9*0.3 + 1.0*0.2 + normalized(320)*0.1)
        // priorityMultiplier = 1.0
        // quickWinBonus = 0.2 (position 15, volume >= 100)
        // finalScore = 0.853 * 1.0 + 0.2 ≈ 1.053
        expect(result.quickWinBonus).toBe(0.2);
        expect(result.finalScore).toBeCloseTo(1.053, 2);
      });
    });

    describe('CONTEXT.md full test case', () => {
      it('should match CONTEXT.md example (detailing keyword)', () => {
        const priorities: CategoryPriorityInput[] = [
          { category: 'detailing', weightMultiplier: 1.5 },
        ];
        const scorer = new CompositeScorer(priorities);
        const input: ClassifiedKeywordInput = {
          keyword: 'detailing paslaugos šiauliuose',
          relevanceScores: { combinedScore: 0.75 },
          funnelConfidence: 0.9,
          geoClassification: { passesGeoFilter: true, city: 'šiauliai', geoScore: 1.0 },
          volume: 320,
          position: 15,
        };

        const result = scorer.score(input);

        // Expected from CONTEXT.md:
        // baseScore ≈ 0.833 (0.75*0.4 + 0.9*0.3 + 1.0*0.2 + normalized(320)*0.1)
        // priorityMultiplier = 1.5
        // quickWinBonus = 0.2
        // finalScore ≈ 0.833 * 1.5 + 0.2 ≈ 1.45
        expect(result.baseScore).toBeCloseTo(0.833, 1);
        expect(result.priorityMultiplier).toBe(1.5);
        expect(result.quickWinBonus).toBe(0.2);
        expect(result.finalScore).toBeCloseTo(1.45, 1);
      });
    });

    describe('edge cases', () => {
      it('should handle missing scores gracefully', () => {
        const scorer = new CompositeScorer();
        const input: ClassifiedKeywordInput = {
          keyword: 'minimal keyword',
        };

        const result = scorer.score(input);

        // All defaults: baseScore ≈ 0.45
        // No priority, no quick win
        expect(result.baseScore).toBeCloseTo(0.45, 2);
        expect(result.priorityMultiplier).toBe(1.0);
        expect(result.quickWinBonus).toBe(0);
        expect(result.finalScore).toBeCloseTo(0.45, 2);
      });

      it('should handle empty priorities array', () => {
        const scorer = new CompositeScorer([]);
        const input: ClassifiedKeywordInput = {
          keyword: 'detailing paslaugos',
          relevanceScores: { combinedScore: 0.8 },
        };

        const result = scorer.score(input);

        expect(result.priorityMultiplier).toBe(1.0);
      });
    });
  });
});
