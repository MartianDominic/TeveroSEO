import { describe, it, expect, beforeEach } from 'vitest';
import { ConstraintFilter, createConstraintFilter } from './ConstraintFilter';
import type {
  FilterConstraints,
  ClassifiedKeywordInput,
  FilterResult,
  CategoryPriorityInput,
} from './types';

describe('ConstraintFilter', () => {
  describe('Pipeline Orchestration', () => {
    it('should pass keyword through all 4 stages successfully', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        negativeFilters: {
          excludeTerms: ['savitarna'],
          excludeBrands: [],
          excludeIntents: [],
          defaultPatterns: false,
        },
        audienceConstraints: {
          b2bOnly: true,
          b2cAllowed: false,
        },
        relevanceThreshold: 0.4,
      };

      const filter = new ConstraintFilter({ constraints });
      const input: ClassifiedKeywordInput = {
        keyword: 'plovykla įmonėms šiauliuose',
        geoClassification: {
          passesGeoFilter: true,
          city: 'šiauliai',
          geoScore: 1.0,
        },
        relevanceScores: {
          combinedScore: 0.75,
        },
        funnelStage: 'bofu',
        volume: 320,
        position: 15,
      };

      const result = filter.filter(input);
      expect(result.passed).toBe(true);
      expect(result.keyword).toBe('plovykla įmonėms šiauliuose');
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.exclusionReason).toBeUndefined();
      expect(result.exclusionStage).toBeUndefined();
    });

    it('should exclude keyword at geo filter stage (early exit)', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        relevanceThreshold: 0.4,
      };

      const filter = new ConstraintFilter({ constraints });
      const input: ClassifiedKeywordInput = {
        keyword: 'plovykla kaune',
        geoClassification: {
          passesGeoFilter: false,
          city: 'kaunas',
          geoScore: 0.0,
        },
        relevanceScores: {
          combinedScore: 0.75, // High score, but geo filter fails first
        },
      };

      const result = filter.filter(input);
      expect(result.passed).toBe(false);
      expect(result.exclusionReason).toBe('geo:wrong_city:kaunas');
      expect(result.exclusionStage).toBe('geo');
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should exclude keyword at negative filter stage', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        negativeFilters: {
          excludeTerms: ['savitarna'],
          excludeBrands: [],
          excludeIntents: [],
          defaultPatterns: false,
        },
        relevanceThreshold: 0.4,
      };

      const filter = new ConstraintFilter({ constraints });
      const input: ClassifiedKeywordInput = {
        keyword: 'savitarnos plovykla šiauliuose',
        geoClassification: {
          passesGeoFilter: true,
          city: 'šiauliai',
          geoScore: 1.0,
        },
        relevanceScores: {
          combinedScore: 0.75,
        },
      };

      const result = filter.filter(input);
      expect(result.passed).toBe(false);
      expect(result.exclusionReason).toBe('negative:term:savitarna');
      expect(result.exclusionStage).toBe('negative');
    });

    it('should exclude keyword at audience filter stage', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        audienceConstraints: {
          b2bOnly: true,
          b2cAllowed: false,
        },
        relevanceThreshold: 0.4,
      };

      const filter = new ConstraintFilter({ constraints });
      const input: ClassifiedKeywordInput = {
        keyword: 'plovykla šeimai šiauliuose',
        geoClassification: {
          passesGeoFilter: true,
          city: 'šiauliai',
          geoScore: 1.0,
        },
        relevanceScores: {
          combinedScore: 0.75,
        },
      };

      const result = filter.filter(input);
      expect(result.passed).toBe(false);
      expect(result.exclusionReason).toBe('audience:b2c_excluded');
      expect(result.exclusionStage).toBe('audience');
    });

    it('should exclude keyword at relevance filter stage', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        relevanceThreshold: 0.4,
      };

      const filter = new ConstraintFilter({ constraints });
      const input: ClassifiedKeywordInput = {
        keyword: 'plovykla šiauliuose',
        geoClassification: {
          passesGeoFilter: true,
          city: 'šiauliai',
          geoScore: 1.0,
        },
        relevanceScores: {
          combinedScore: 0.32, // Below threshold
        },
      };

      const result = filter.filter(input);
      expect(result.passed).toBe(false);
      expect(result.exclusionReason).toBe('relevance:below_threshold:0.32');
      expect(result.exclusionStage).toBe('relevance');
    });
  });

  describe('Batch Processing', () => {
    it('should process array of keywords and return results', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        relevanceThreshold: 0.4,
      };

      const filter = new ConstraintFilter({ constraints });
      const inputs: ClassifiedKeywordInput[] = [
        {
          keyword: 'plovykla šiauliuose',
          geoClassification: { passesGeoFilter: true, city: 'šiauliai', geoScore: 1.0 },
          relevanceScores: { combinedScore: 0.75 },
        },
        {
          keyword: 'plovykla kaune',
          geoClassification: { passesGeoFilter: false, city: 'kaunas', geoScore: 0.0 },
          relevanceScores: { combinedScore: 0.75 },
        },
        {
          keyword: 'detailing šiauliuose',
          geoClassification: { passesGeoFilter: true, city: 'šiauliai', geoScore: 1.0 },
          relevanceScores: { combinedScore: 0.32 },
        },
      ];

      const results = filter.filterBatch(inputs);
      expect(results).toHaveLength(3);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
      expect(results[1].exclusionStage).toBe('geo');
      expect(results[2].passed).toBe(false);
      expect(results[2].exclusionStage).toBe('relevance');
    });
  });

  describe('Statistics Tracking', () => {
    it('should track statistics correctly', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        negativeFilters: {
          excludeTerms: ['savitarna'],
          excludeBrands: [],
          excludeIntents: [],
          defaultPatterns: false,
        },
        audienceConstraints: {
          b2bOnly: true,
          b2cAllowed: false,
        },
        relevanceThreshold: 0.4,
      };

      const filter = new ConstraintFilter({ constraints });
      const inputs: ClassifiedKeywordInput[] = [
        {
          keyword: 'plovykla įmonėms šiauliuose',
          geoClassification: { passesGeoFilter: true, city: 'šiauliai', geoScore: 1.0 },
          relevanceScores: { combinedScore: 0.75 },
        },
        {
          keyword: 'plovykla kaune',
          geoClassification: { passesGeoFilter: false, city: 'kaunas', geoScore: 0.0 },
          relevanceScores: { combinedScore: 0.75 },
        },
        {
          keyword: 'savitarnos plovykla šiauliuose',
          geoClassification: { passesGeoFilter: true, city: 'šiauliai', geoScore: 1.0 },
          relevanceScores: { combinedScore: 0.75 },
        },
        {
          keyword: 'plovykla šeimai šiauliuose',
          geoClassification: { passesGeoFilter: true, city: 'šiauliai', geoScore: 1.0 },
          relevanceScores: { combinedScore: 0.75 },
        },
        {
          keyword: 'detailing šiauliuose',
          geoClassification: { passesGeoFilter: true, city: 'šiauliai', geoScore: 1.0 },
          relevanceScores: { combinedScore: 0.32 },
        },
      ];

      filter.filterBatch(inputs);
      const stats = filter.getStats();

      expect(stats.total).toBe(5);
      expect(stats.passed).toBe(1);
      expect(stats.excludedByGeo).toBe(1);
      expect(stats.excludedByNegative).toBe(1);
      expect(stats.excludedByAudience).toBe(1);
      expect(stats.excludedByRelevance).toBe(1);
    });
  });

  describe('Exclusion Export', () => {
    it('should generate human-readable exclusion exports', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        relevanceThreshold: 0.4,
      };

      const filter = new ConstraintFilter({ constraints });
      const inputs: ClassifiedKeywordInput[] = [
        {
          keyword: 'plovykla šiauliuose',
          geoClassification: { passesGeoFilter: true, city: 'šiauliai', geoScore: 1.0 },
          relevanceScores: { combinedScore: 0.75 },
        },
        {
          keyword: 'plovykla kaune',
          geoClassification: { passesGeoFilter: false, city: 'kaunas', geoScore: 0.0 },
          relevanceScores: { combinedScore: 0.75 },
        },
      ];

      const results = filter.filterBatch(inputs);
      const exports = filter.getExclusionExports(results);

      expect(exports).toHaveLength(1);
      expect(exports[0].keyword).toBe('plovykla kaune');
      expect(exports[0].reason).toBe('geo:wrong_city:kaunas');
      expect(exports[0].humanReadable).toBe('Excluded: wrong city (kaunas)');
      expect(exports[0].stage).toBe('geo');
      expect(exports[0].details).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    it('should create filter with default threshold', () => {
      const filter = createConstraintFilter();
      const input: ClassifiedKeywordInput = {
        keyword: 'plovykla',
        relevanceScores: { combinedScore: 0.35 }, // Below default 0.4
      };

      const result = filter.filter(input);
      expect(result.passed).toBe(false);
      expect(result.exclusionReason).toBe('relevance:below_threshold:0.35');
    });

    it('should create filter with custom constraints', () => {
      const filter = createConstraintFilter({
        constraints: {
          relevanceThreshold: 0.6,
          geoConstraints: {
            includeCities: ['vilnius'],
            excludeCities: [],
            genericAllowed: true,
          },
        },
      });

      const input: ClassifiedKeywordInput = {
        keyword: 'plovykla vilniuje',
        geoClassification: { passesGeoFilter: true, city: 'vilnius', geoScore: 1.0 },
        relevanceScores: { combinedScore: 0.5 }, // Below 0.6
      };

      const result = filter.filter(input);
      expect(result.passed).toBe(false);
      expect(result.exclusionStage).toBe('relevance');
    });
  });

  describe('Composite Scoring Integration', () => {
    it('should add compositeScore to passed keywords', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        relevanceThreshold: 0.4,
      };

      const filter = new ConstraintFilter({ constraints });
      const input: ClassifiedKeywordInput = {
        keyword: 'plovykla šiauliuose',
        geoClassification: {
          passesGeoFilter: true,
          city: 'šiauliai',
          geoScore: 1.0,
        },
        relevanceScores: { combinedScore: 0.75 },
        funnelStage: 'bofu',
        funnelConfidence: 0.9,
        volume: 320,
        position: 15,
      };

      const result = filter.filter(input);

      expect(result.passed).toBe(true);
      expect(result.compositeScore).toBeDefined();
      expect(result.compositeScore?.baseScore).toBeGreaterThan(0);
      expect(result.compositeScore?.priorityMultiplier).toBe(1.0); // No priorities
      expect(result.compositeScore?.quickWinBonus).toBe(0.2); // Position 15, volume >= 100
      expect(result.compositeScore?.finalScore).toBeGreaterThan(0);
    });

    it('should include classification details for passed keywords', () => {
      const filter = new ConstraintFilter({
        constraints: { relevanceThreshold: 0.4 },
      });
      const input: ClassifiedKeywordInput = {
        keyword: 'detailing šiauliuose',
        geoClassification: {
          passesGeoFilter: true,
          city: 'šiauliai',
          geoScore: 1.0,
        },
        relevanceScores: { combinedScore: 0.8 },
        funnelStage: 'bofu',
        volume: 500,
      };

      const result = filter.filter(input);

      expect(result.classification).toBeDefined();
      expect(result.classification?.funnelStage).toBe('bofu');
      expect(result.classification?.geoCity).toBe('šiauliai');
      expect(result.classification?.relevanceScore).toBe(0.8);
    });

    it('should apply priority multiplier when priorities provided', () => {
      const priorities: CategoryPriorityInput[] = [
        { category: 'detailing', weightMultiplier: 1.5 },
      ];

      const filter = new ConstraintFilter({
        constraints: { relevanceThreshold: 0.4 },
        priorities,
      });

      const input: ClassifiedKeywordInput = {
        keyword: 'detailing paslaugos šiauliuose',
        geoClassification: {
          passesGeoFilter: true,
          city: 'šiauliai',
          geoScore: 1.0,
        },
        relevanceScores: { combinedScore: 0.75 },
        funnelConfidence: 0.9,
        volume: 320,
        position: 15,
      };

      const result = filter.filter(input);

      expect(result.compositeScore?.priorityMultiplier).toBe(1.5);
      expect(result.compositeScore?.finalScore).toBeGreaterThan(1.0); // Boosted by priority
    });

    it('should match CONTEXT.md full example', () => {
      const priorities: CategoryPriorityInput[] = [
        { category: 'detailing', weightMultiplier: 1.5 },
      ];

      const filter = new ConstraintFilter({
        constraints: { relevanceThreshold: 0.4 },
        priorities,
      });

      const input: ClassifiedKeywordInput = {
        keyword: 'detailing paslaugos šiauliuose',
        geoClassification: {
          passesGeoFilter: true,
          city: 'šiauliai',
          geoScore: 1.0,
        },
        relevanceScores: { combinedScore: 0.75 },
        funnelStage: 'bofu',
        funnelConfidence: 0.9,
        volume: 320,
        position: 15,
      };

      const result = filter.filter(input);

      expect(result.passed).toBe(true);
      expect(result.compositeScore?.baseScore).toBeCloseTo(0.833, 1);
      expect(result.compositeScore?.priorityMultiplier).toBe(1.5);
      expect(result.compositeScore?.quickWinBonus).toBe(0.2);
      expect(result.compositeScore?.finalScore).toBeCloseTo(1.45, 1);
    });

    it('should not add compositeScore to excluded keywords', () => {
      const filter = new ConstraintFilter({
        constraints: { relevanceThreshold: 0.4 },
      });

      const input: ClassifiedKeywordInput = {
        keyword: 'plovykla',
        relevanceScores: { combinedScore: 0.3 }, // Below threshold
      };

      const result = filter.filter(input);

      expect(result.passed).toBe(false);
      expect(result.compositeScore).toBeUndefined();
      expect(result.classification).toBeUndefined();
    });
  });

  describe('sortByScore', () => {
    it('should sort passed keywords by finalScore descending', () => {
      const filter = new ConstraintFilter({
        constraints: { relevanceThreshold: 0.4 },
      });

      const inputs: ClassifiedKeywordInput[] = [
        {
          keyword: 'low score',
          relevanceScores: { combinedScore: 0.5 },
          volume: 100,
        },
        {
          keyword: 'high score',
          relevanceScores: { combinedScore: 0.9 },
          volume: 1000,
        },
        {
          keyword: 'medium score',
          relevanceScores: { combinedScore: 0.7 },
          volume: 500,
        },
      ];

      const results = filter.filterBatch(inputs);
      const sorted = filter.sortByScore(results);

      expect(sorted).toHaveLength(3);
      expect(sorted[0].keyword).toBe('high score');
      expect(sorted[2].keyword).toBe('low score');
      expect(sorted[0].compositeScore?.finalScore).toBeGreaterThan(
        sorted[1].compositeScore?.finalScore ?? 0
      );
      expect(sorted[1].compositeScore?.finalScore).toBeGreaterThan(
        sorted[2].compositeScore?.finalScore ?? 0
      );
    });

    it('should filter out excluded keywords', () => {
      const filter = new ConstraintFilter({
        constraints: { relevanceThreshold: 0.4 },
      });

      const inputs: ClassifiedKeywordInput[] = [
        {
          keyword: 'passed',
          relevanceScores: { combinedScore: 0.8 },
        },
        {
          keyword: 'excluded',
          relevanceScores: { combinedScore: 0.3 }, // Below threshold
        },
      ];

      const results = filter.filterBatch(inputs);
      const sorted = filter.sortByScore(results);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].keyword).toBe('passed');
    });

    it('should return empty array when no passed keywords', () => {
      const filter = new ConstraintFilter({
        constraints: { relevanceThreshold: 0.4 },
      });

      const inputs: ClassifiedKeywordInput[] = [
        {
          keyword: 'excluded1',
          relevanceScores: { combinedScore: 0.3 },
        },
        {
          keyword: 'excluded2',
          relevanceScores: { combinedScore: 0.2 },
        },
      ];

      const results = filter.filterBatch(inputs);
      const sorted = filter.sortByScore(results);

      expect(sorted).toHaveLength(0);
    });
  });
});
