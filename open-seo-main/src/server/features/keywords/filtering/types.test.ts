import { describe, it, expect } from 'vitest';
import type {
  GeoConstraints,
  NegativeFilters,
  AudienceConstraints,
  FilterConstraints,
  ExclusionReason,
  FilterResult,
  ExclusionExport,
  ClassifiedKeywordInput,
  CompositeScore,
  CategoryPriorityInput,
  QuickWinConfig,
} from './types';
import { humanReadableReason, SCORING_WEIGHTS } from './types';

describe('Filtering Types', () => {
  describe('Type Compilation', () => {
    it('should compile GeoConstraints interface', () => {
      const geo: GeoConstraints = {
        includeCities: ['šiauliai', 'vilnius'],
        excludeCities: ['kaunas'],
        genericAllowed: true,
      };
      expect(geo.includeCities).toHaveLength(2);
    });

    it('should compile NegativeFilters interface', () => {
      const negative: NegativeFilters = {
        excludeTerms: ['savitarna', 'nemokamai'],
        excludeBrands: ['Lidl', 'Maxima'],
        excludeIntents: ['diy', 'kaip pačiam'],
        defaultPatterns: true,
      };
      expect(negative.excludeTerms).toHaveLength(2);
    });

    it('should compile AudienceConstraints interface', () => {
      const audience: AudienceConstraints = {
        b2bOnly: true,
        b2cAllowed: false,
      };
      expect(audience.b2bOnly).toBe(true);
    });

    it('should compile FilterConstraints interface', () => {
      const constraints: FilterConstraints = {
        geoConstraints: {
          includeCities: ['šiauliai'],
          excludeCities: [],
          genericAllowed: false,
        },
        negativeFilters: {
          excludeTerms: [],
          excludeBrands: [],
          excludeIntents: [],
          defaultPatterns: true,
        },
        audienceConstraints: {
          b2bOnly: true,
          b2cAllowed: false,
        },
        relevanceThreshold: 0.4,
      };
      expect(constraints.relevanceThreshold).toBe(0.4);
    });

    it('should compile FilterResult interface', () => {
      const result: FilterResult = {
        keyword: 'plovykla šiauliuose',
        passed: true,
        processingTimeMs: 1.5,
      };
      expect(result.passed).toBe(true);

      const excludedResult: FilterResult = {
        keyword: 'plovykla kaune',
        passed: false,
        exclusionReason: 'geo:wrong_city:kaunas',
        exclusionStage: 'geo',
        processingTimeMs: 0.8,
      };
      expect(excludedResult.passed).toBe(false);
    });

    it('should compile ClassifiedKeywordInput interface', () => {
      const input: ClassifiedKeywordInput = {
        keyword: 'detailing šiauliuose',
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
      expect(input.keyword).toBe('detailing šiauliuose');
    });
  });

  describe('ExclusionReason Template Literal Type', () => {
    it('should accept valid geo exclusion reasons', () => {
      const reasons: ExclusionReason[] = [
        'geo:wrong_city:kaunas',
        'geo:not_in_target_list',
        'geo:generic_not_allowed',
      ];
      expect(reasons).toHaveLength(3);
    });

    it('should accept valid negative exclusion reasons', () => {
      const reasons: ExclusionReason[] = [
        'negative:term:savitarna',
        'negative:brand:Lidl',
        'negative:intent:diy',
      ];
      expect(reasons).toHaveLength(3);
    });

    it('should accept valid audience exclusion reasons', () => {
      const reasons: ExclusionReason[] = [
        'audience:b2c_excluded',
        'audience:b2b_excluded',
      ];
      expect(reasons).toHaveLength(2);
    });

    it('should accept valid relevance exclusion reasons', () => {
      const reason: ExclusionReason = 'relevance:below_threshold:0.32';
      expect(reason).toContain('0.32');
    });
  });

  describe('humanReadableReason', () => {
    it('should format geo wrong_city reason', () => {
      const result = humanReadableReason('geo:wrong_city:kaunas');
      expect(result).toBe('Excluded: wrong city (kaunas)');
    });

    it('should format geo not_in_target_list reason', () => {
      const result = humanReadableReason('geo:not_in_target_list');
      expect(result).toBe('Excluded: not in target city list');
    });

    it('should format geo generic_not_allowed reason', () => {
      const result = humanReadableReason('geo:generic_not_allowed');
      expect(result).toBe('Excluded: generic keyword not allowed');
    });

    it('should format negative term reason', () => {
      const result = humanReadableReason('negative:term:savitarna');
      expect(result).toBe('Excluded: negative term (savitarna)');
    });

    it('should format negative brand reason', () => {
      const result = humanReadableReason('negative:brand:Lidl');
      expect(result).toBe('Excluded: competitor brand (Lidl)');
    });

    it('should format negative intent reason', () => {
      const result = humanReadableReason('negative:intent:diy');
      expect(result).toBe('Excluded: negative intent (diy)');
    });

    it('should format audience b2c_excluded reason', () => {
      const result = humanReadableReason('audience:b2c_excluded');
      expect(result).toBe('Excluded: B2C pattern (B2B only mode)');
    });

    it('should format audience b2b_excluded reason', () => {
      const result = humanReadableReason('audience:b2b_excluded');
      expect(result).toBe('Excluded: B2B pattern (B2C only mode)');
    });

    it('should format relevance below_threshold reason', () => {
      const result = humanReadableReason('relevance:below_threshold:0.32');
      expect(result).toBe('Excluded: relevance score below threshold (0.32)');
    });
  });

  describe('ExclusionExport', () => {
    it('should compile ExclusionExport interface', () => {
      const exportItem: ExclusionExport = {
        keyword: 'plovykla kaune',
        reason: 'geo:wrong_city:kaunas',
        humanReadable: 'Excluded: wrong city (kaunas)',
        stage: 'geo',
        details: { city: 'kaunas', targetCities: ['šiauliai'] },
      };
      expect(exportItem.keyword).toBe('plovykla kaune');
      expect(exportItem.stage).toBe('geo');
    });
  });

  describe('CompositeScore Type', () => {
    it('should have all required fields', () => {
      const score: CompositeScore = {
        baseScore: 0.75,
        priorityMultiplier: 1.5,
        quickWinBonus: 0.2,
        finalScore: 1.325,
      };

      expect(score.baseScore).toBe(0.75);
      expect(score.priorityMultiplier).toBe(1.5);
      expect(score.quickWinBonus).toBe(0.2);
      expect(score.finalScore).toBe(1.325);
    });
  });

  describe('SCORING_WEIGHTS', () => {
    it('should have all 4 weight components', () => {
      expect(SCORING_WEIGHTS).toHaveProperty('relevance');
      expect(SCORING_WEIGHTS).toHaveProperty('funnelConfidence');
      expect(SCORING_WEIGHTS).toHaveProperty('geoScore');
      expect(SCORING_WEIGHTS).toHaveProperty('volumeNormalized');
    });

    it('should have weights that sum to 1.0', () => {
      const sum =
        SCORING_WEIGHTS.relevance +
        SCORING_WEIGHTS.funnelConfidence +
        SCORING_WEIGHTS.geoScore +
        SCORING_WEIGHTS.volumeNormalized;

      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('should have correct individual weights per CONTEXT.md', () => {
      expect(SCORING_WEIGHTS.relevance).toBe(0.4);
      expect(SCORING_WEIGHTS.funnelConfidence).toBe(0.3);
      expect(SCORING_WEIGHTS.geoScore).toBe(0.2);
      expect(SCORING_WEIGHTS.volumeNormalized).toBe(0.1);
    });
  });

  describe('CategoryPriorityInput Type', () => {
    it('should accept valid priority configuration', () => {
      const priority: CategoryPriorityInput = {
        category: 'detailing',
        categoryLt: 'detalės',
        weightMultiplier: 1.5,
      };

      expect(priority.category).toBe('detailing');
      expect(priority.categoryLt).toBe('detalės');
      expect(priority.weightMultiplier).toBe(1.5);
    });

    it('should allow optional categoryLt', () => {
      const priority: CategoryPriorityInput = {
        category: 'detailing',
        weightMultiplier: 1.5,
      };

      expect(priority.category).toBe('detailing');
      expect(priority.categoryLt).toBeUndefined();
    });
  });

  describe('QuickWinConfig Type', () => {
    it('should have striking distance configuration', () => {
      const config: QuickWinConfig = {
        strikingDistance: { minPos: 11, maxPos: 20, minVolume: 100, bonus: 0.2 },
        opportunity: { minPos: 21, maxPos: 50, minVolume: 200, bonus: 0.15 },
        defaultBonus: { minVolume: 50, bonus: 0.1 },
      };

      expect(config.strikingDistance.minPos).toBe(11);
      expect(config.strikingDistance.maxPos).toBe(20);
      expect(config.strikingDistance.minVolume).toBe(100);
      expect(config.strikingDistance.bonus).toBe(0.2);
    });

    it('should have opportunity configuration', () => {
      const config: QuickWinConfig = {
        strikingDistance: { minPos: 11, maxPos: 20, minVolume: 100, bonus: 0.2 },
        opportunity: { minPos: 21, maxPos: 50, minVolume: 200, bonus: 0.15 },
        defaultBonus: { minVolume: 50, bonus: 0.1 },
      };

      expect(config.opportunity.minPos).toBe(21);
      expect(config.opportunity.maxPos).toBe(50);
      expect(config.opportunity.minVolume).toBe(200);
      expect(config.opportunity.bonus).toBe(0.15);
    });

    it('should have default bonus configuration', () => {
      const config: QuickWinConfig = {
        strikingDistance: { minPos: 11, maxPos: 20, minVolume: 100, bonus: 0.2 },
        opportunity: { minPos: 21, maxPos: 50, minVolume: 200, bonus: 0.15 },
        defaultBonus: { minVolume: 50, bonus: 0.1 },
      };

      expect(config.defaultBonus.minVolume).toBe(50);
      expect(config.defaultBonus.bonus).toBe(0.1);
    });
  });

  describe('FilterResult with compositeScore', () => {
    it('should allow compositeScore field in FilterResult', () => {
      const result: FilterResult = {
        keyword: 'detailing paslaugos',
        passed: true,
        compositeScore: {
          baseScore: 0.75,
          priorityMultiplier: 1.5,
          quickWinBonus: 0.2,
          finalScore: 1.325,
        },
        classification: {
          funnelStage: 'bofu',
          geoCity: 'šiauliai',
          relevanceScore: 0.8,
        },
        processingTimeMs: 1.2,
      };

      expect(result.compositeScore).toBeDefined();
      expect(result.compositeScore?.finalScore).toBe(1.325);
      expect(result.classification?.funnelStage).toBe('bofu');
    });

    it('should allow FilterResult without compositeScore (excluded keyword)', () => {
      const result: FilterResult = {
        keyword: 'plovykla kaune',
        passed: false,
        exclusionReason: 'geo:wrong_city:kaunas',
        exclusionStage: 'geo',
        processingTimeMs: 0.5,
      };

      expect(result.compositeScore).toBeUndefined();
      expect(result.exclusionReason).toBe('geo:wrong_city:kaunas');
    });
  });

  describe('ClassifiedKeywordInput with funnelConfidence', () => {
    it('should accept funnelConfidence field', () => {
      const input: ClassifiedKeywordInput = {
        keyword: 'detailing šiauliuose',
        geoClassification: {
          passesGeoFilter: true,
          city: 'šiauliai',
          geoScore: 1.0,
        },
        relevanceScores: {
          combinedScore: 0.75,
        },
        funnelStage: 'bofu',
        funnelConfidence: 0.9,
        volume: 320,
        position: 15,
      };

      expect(input.funnelConfidence).toBe(0.9);
    });
  });
});
