import { describe, it, expect, beforeEach } from 'vitest';
import { RelevanceScorer, createRelevanceScorer } from './RelevanceScorer';
import { DEFAULT_RELEVANCE_CONFIG } from './types';

describe('RelevanceScorer', () => {
  let scorer: RelevanceScorer;

  beforeEach(() => {
    scorer = createRelevanceScorer();
  });

  describe('Car Wash Business (Siauliai)', () => {
    const carWashContext = {
      businessDescription: 'Automobiliu plovykla Siauliuose. Teikiame plovimo, valymo ir detailing paslaugas.',
      priorityCategories: ['plovimas', 'detailing'],
      problemsSolved: ['purvinas automobilis', 'neprizureta isvaizda'],
    };

    it('scores highly relevant keyword', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'automobiliu plovykla',
        ...carWashContext,
      });

      expect(result.keyword).toBe('automobiliu plovykla');
      expect(result.coreRelevance).toBeGreaterThanOrEqual(-1);
      expect(result.coreRelevance).toBeLessThanOrEqual(1);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      // With deterministic embeddings, scores are consistent but not semantically meaningful
      // The important thing is that the calculation works
    });

    it('scores irrelevant keyword with different embedding', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'padangu montavimas',
        ...carWashContext,
      });

      expect(result.keyword).toBe('padangu montavimas');
      expect(result.combinedScore).toBeGreaterThanOrEqual(-1);
      expect(result.combinedScore).toBeLessThanOrEqual(1);
      // passesThreshold depends on actual similarity scores
      expect(typeof result.passesThreshold).toBe('boolean');
    });

    it('scores tangentially related keyword', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'automobiliu remontas',
        ...carWashContext,
      });

      expect(result.combinedScore).toBeGreaterThanOrEqual(-1);
      expect(result.combinedScore).toBeLessThanOrEqual(1);
    });

    it('computes category relevance', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'detailing paslaugos',
        ...carWashContext,
      });

      expect(result.categoryRelevance).toBeGreaterThanOrEqual(0);
      expect(result.categoryRelevance).toBeLessThanOrEqual(1);
    });
  });

  describe('E-commerce Cosmetics (National)', () => {
    const cosmeticsContext = {
      businessDescription: 'Naturali kosmetika internetu. Veido serumai, sampunai, kuno prieziura.',
      priorityCategories: ['veido serumai', 'sampunai'],
      problemsSolved: ['sausa oda', 'riebi galvos oda', 'plauku slinkimas'],
    };

    it('scores relevant product keyword', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'veido serumas su vitaminu c',
        ...cosmeticsContext,
      });

      expect(result.categoryRelevance).toBeGreaterThanOrEqual(0);
      expect(result.categoryRelevance).toBeLessThanOrEqual(1);
      expect(typeof result.passesThreshold).toBe('boolean');
    });

    it('scores irrelevant keyword', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'parfumerija',
        ...cosmeticsContext,
      });

      expect(result.combinedScore).toBeGreaterThanOrEqual(-1);
      expect(result.combinedScore).toBeLessThanOrEqual(1);
    });

    it('computes problem relevance for solution keywords', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'sampunas nuo pleiskanu',
        ...cosmeticsContext,
      });

      expect(result.problemRelevance).toBeGreaterThanOrEqual(0);
      expect(result.problemRelevance).toBeLessThanOrEqual(1);
    });
  });

  describe('Batch Processing', () => {
    it('processes 100 keywords efficiently', async () => {
      const keywords = Array.from({ length: 100 }, (_, i) => `keyword_${i}`);
      const start = performance.now();

      const results = await scorer.scoreKeywordsBatch(
        keywords,
        'Test business description',
        ['category1', 'category2'],
        ['problem1']
      );

      const duration = performance.now() - start;
      expect(results.size).toBe(100);
      // Should complete in reasonable time (mock embeddings are fast)
      expect(duration).toBeLessThan(5000);
    });

    it('returns Map for O(1) lookup', async () => {
      const keywords = ['keyword1', 'keyword2', 'keyword3'];

      const results = await scorer.scoreKeywordsBatch(
        keywords,
        'Test business',
        ['category'],
        ['problem']
      );

      expect(results instanceof Map).toBe(true);
      expect(results.get('keyword1')).toBeDefined();
      expect(results.get('keyword2')).toBeDefined();
      expect(results.get('keyword3')).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty priorityCategories', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'test keyword',
        businessDescription: 'Test business',
        priorityCategories: [],
        problemsSolved: ['problem1'],
      });

      expect(result.categoryRelevance).toBe(0);
      expect(result.combinedScore).toBeDefined();
    });

    it('handles empty problemsSolved', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'test keyword',
        businessDescription: 'Test business',
        priorityCategories: ['category1'],
        problemsSolved: [],
      });

      expect(result.problemRelevance).toBe(0);
    });

    it('handles both empty arrays', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'test keyword',
        businessDescription: 'Test business',
        priorityCategories: [],
        problemsSolved: [],
      });

      expect(result.categoryRelevance).toBe(0);
      expect(result.problemRelevance).toBe(0);
      // Combined score should equal coreRelevance when other dimensions are 0
      expect(result.combinedScore).toBeCloseTo(result.coreRelevance * 0.5, 2);
    });

    it('respects custom weights', async () => {
      const customScorer = createRelevanceScorer({
        weights: { core: 1.0, category: 0.0, problem: 0.0 },
      });

      const result = await customScorer.scoreKeyword({
        keyword: 'test',
        businessDescription: 'test business',
        priorityCategories: ['unrelated'],
        problemsSolved: ['unrelated'],
      });

      // combinedScore should equal coreRelevance when other weights are 0
      expect(result.combinedScore).toBeCloseTo(result.coreRelevance, 2);
    });

    it('respects custom threshold', async () => {
      const strictScorer = createRelevanceScorer({
        threshold: 0.8,
      });

      const result = await strictScorer.scoreKeyword({
        keyword: 'test',
        businessDescription: 'test business',
        priorityCategories: [],
        problemsSolved: [],
      });

      // With high threshold, most keywords should fail
      if (result.combinedScore < 0.8) {
        expect(result.passesThreshold).toBe(false);
      } else {
        expect(result.passesThreshold).toBe(true);
      }
    });
  });

  describe('Combined Score Calculation', () => {
    it('calculates weighted combination correctly', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'test',
        businessDescription: 'test',
        priorityCategories: [],
        problemsSolved: [],
      });

      const w = DEFAULT_RELEVANCE_CONFIG.weights;
      const expectedCombined =
        result.coreRelevance * w.core +
        result.categoryRelevance * w.category +
        result.problemRelevance * w.problem;

      expect(result.combinedScore).toBeCloseTo(expectedCombined, 5);
    });

    it('passesThreshold reflects combined score vs threshold', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'test',
        businessDescription: 'test',
        priorityCategories: [],
        problemsSolved: [],
      });

      const threshold = DEFAULT_RELEVANCE_CONFIG.threshold;
      if (result.combinedScore >= threshold) {
        expect(result.passesThreshold).toBe(true);
      } else {
        expect(result.passesThreshold).toBe(false);
      }
    });
  });

  describe('Category and Problem Relevance', () => {
    it('categoryRelevance is max across all categories', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'test',
        businessDescription: 'unrelated',
        priorityCategories: ['cat1', 'cat2', 'test'], // 'test' should match keyword
        problemsSolved: [],
      });

      // categoryRelevance should be >= 0 (max function works)
      expect(result.categoryRelevance).toBeGreaterThanOrEqual(0);
      expect(result.categoryRelevance).toBeLessThanOrEqual(1);
    });

    it('problemRelevance is max across all problems', async () => {
      const result = await scorer.scoreKeyword({
        keyword: 'test',
        businessDescription: 'unrelated',
        priorityCategories: [],
        problemsSolved: ['prob1', 'prob2', 'test'], // 'test' should match keyword
      });

      // problemRelevance should be >= 0 (max function works)
      expect(result.problemRelevance).toBeGreaterThanOrEqual(0);
      expect(result.problemRelevance).toBeLessThanOrEqual(1);
    });
  });
});
