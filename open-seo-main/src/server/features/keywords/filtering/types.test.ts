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
} from './types';
import { humanReadableReason } from './types';

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
});
