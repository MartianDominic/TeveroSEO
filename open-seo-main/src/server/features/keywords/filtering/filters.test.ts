import { describe, it, expect } from 'vitest';
import {
  checkGeoFilter,
  checkNegativeFilter,
  checkAudienceFilter,
  checkRelevanceFilter,
  DEFAULT_NEGATIVE_PATTERNS,
  B2C_PATTERNS,
  B2B_PATTERNS,
} from './filters';
import type { GeoConstraints, NegativeFilters, AudienceConstraints } from './types';

describe('Filter Functions', () => {
  describe('checkGeoFilter', () => {
    it('should pass when no constraints provided', () => {
      const result = checkGeoFilter('plovykla šiauliuose', undefined, undefined);
      expect(result.passes).toBe(true);
    });

    it('should exclude wrong city keyword', () => {
      const geoClassification = {
        passesGeoFilter: false,
        city: 'kaunas',
        geoScore: 0.0,
      };
      const constraints: GeoConstraints = {
        includeCities: ['šiauliai'],
        excludeCities: [],
        genericAllowed: false,
      };
      const result = checkGeoFilter('plovykla kaune', geoClassification, constraints);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('geo:wrong_city:kaunas');
    });

    it('should pass target city keyword', () => {
      const geoClassification = {
        passesGeoFilter: true,
        city: 'šiauliai',
        geoScore: 1.0,
      };
      const constraints: GeoConstraints = {
        includeCities: ['šiauliai'],
        excludeCities: [],
        genericAllowed: false,
      };
      const result = checkGeoFilter('plovykla šiauliuose', geoClassification, constraints);
      expect(result.passes).toBe(true);
    });

    it('should exclude generic when not allowed', () => {
      const geoClassification = {
        passesGeoFilter: true,
        city: undefined,
        geoScore: 0.5,
      };
      const constraints: GeoConstraints = {
        includeCities: ['šiauliai'],
        excludeCities: [],
        genericAllowed: false,
      };
      const result = checkGeoFilter('plovykla', geoClassification, constraints);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('geo:generic_not_allowed');
    });

    it('should pass generic when allowed', () => {
      const geoClassification = {
        passesGeoFilter: true,
        city: undefined,
        geoScore: 0.5,
      };
      const constraints: GeoConstraints = {
        includeCities: ['šiauliai'],
        excludeCities: [],
        genericAllowed: true,
      };
      const result = checkGeoFilter('plovykla', geoClassification, constraints);
      expect(result.passes).toBe(true);
    });

    it('should exclude city not in target list', () => {
      const geoClassification = {
        passesGeoFilter: false,
        city: 'vilnius',
        geoScore: 0.3,
      };
      const constraints: GeoConstraints = {
        includeCities: ['šiauliai'],
        excludeCities: [],
        genericAllowed: false,
      };
      const result = checkGeoFilter('plovykla vilniuje', geoClassification, constraints);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('geo:wrong_city:vilnius');
    });
  });

  describe('checkNegativeFilter', () => {
    it('should pass when no filters provided', () => {
      const result = checkNegativeFilter('plovykla šiauliuose', undefined);
      expect(result.passes).toBe(true);
    });

    it('should exclude keyword with negative term', () => {
      const filters: NegativeFilters = {
        excludeTerms: ['savitarna'],
        excludeBrands: [],
        excludeIntents: [],
        defaultPatterns: false,
      };
      const result = checkNegativeFilter('savitarnos plovykla', filters);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('negative:term:savitarna');
    });

    it('should exclude keyword with competitor brand', () => {
      const filters: NegativeFilters = {
        excludeTerms: [],
        excludeBrands: ['Lidl'],
        excludeIntents: [],
        defaultPatterns: false,
      };
      const result = checkNegativeFilter('plovykla Lidl', filters);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('negative:brand:lidl');
    });

    it('should exclude keyword with negative intent', () => {
      const filters: NegativeFilters = {
        excludeTerms: [],
        excludeBrands: [],
        excludeIntents: ['diy'],
        defaultPatterns: false,
      };
      const result = checkNegativeFilter('plovykla diy', filters);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('negative:intent:diy');
    });

    it('should exclude with default patterns when enabled', () => {
      const filters: NegativeFilters = {
        excludeTerms: [],
        excludeBrands: [],
        excludeIntents: [],
        defaultPatterns: true,
      };
      const result = checkNegativeFilter('plovykla pačiam', filters);
      expect(result.passes).toBe(false);
      expect(result.reason).toContain('negative:');
    });

    it('should be case-insensitive', () => {
      const filters: NegativeFilters = {
        excludeTerms: ['savitarna'],
        excludeBrands: [],
        excludeIntents: [],
        defaultPatterns: false,
      };
      const result = checkNegativeFilter('SAVITARNOS plovykla', filters);
      expect(result.passes).toBe(false);
    });

    it('should pass keyword without negative patterns', () => {
      const filters: NegativeFilters = {
        excludeTerms: ['savitarna'],
        excludeBrands: [],
        excludeIntents: [],
        defaultPatterns: false,
      };
      const result = checkNegativeFilter('plovykla įmonėms', filters);
      expect(result.passes).toBe(true);
    });
  });

  describe('checkAudienceFilter', () => {
    it('should pass when no constraints provided', () => {
      const result = checkAudienceFilter('plovykla šiauliuose', undefined);
      expect(result.passes).toBe(true);
    });

    it('should exclude B2C pattern when b2bOnly is true', () => {
      const constraints: AudienceConstraints = {
        b2bOnly: true,
        b2cAllowed: false,
      };
      const result = checkAudienceFilter('plovykla šeimai', constraints);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('audience:b2c_excluded');
    });

    it('should pass B2B pattern when b2bOnly is true', () => {
      const constraints: AudienceConstraints = {
        b2bOnly: true,
        b2cAllowed: false,
      };
      const result = checkAudienceFilter('plovykla įmonėms', constraints);
      expect(result.passes).toBe(true);
    });

    it('should pass both B2B and B2C when b2bOnly is false', () => {
      const constraints: AudienceConstraints = {
        b2bOnly: false,
        b2cAllowed: true,
      };
      const b2cResult = checkAudienceFilter('plovykla namų', constraints);
      const b2bResult = checkAudienceFilter('plovykla verslui', constraints);
      expect(b2cResult.passes).toBe(true);
      expect(b2bResult.passes).toBe(true);
    });

    it('should detect multiple B2C patterns', () => {
      const constraints: AudienceConstraints = {
        b2bOnly: true,
        b2cAllowed: false,
      };
      const patterns = ['asmeninis', 'namų', 'šeimai', 'vaikams'];
      patterns.forEach(pattern => {
        const result = checkAudienceFilter(`plovykla ${pattern}`, constraints);
        expect(result.passes).toBe(false);
      });
    });
  });

  describe('checkRelevanceFilter', () => {
    it('should pass when combinedScore is undefined', () => {
      const result = checkRelevanceFilter(undefined, 0.4);
      expect(result.passes).toBe(true);
    });

    it('should exclude when combinedScore below threshold', () => {
      const result = checkRelevanceFilter(0.32, 0.4);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('relevance:below_threshold:0.32');
    });

    it('should pass when combinedScore equals threshold', () => {
      const result = checkRelevanceFilter(0.4, 0.4);
      expect(result.passes).toBe(true);
    });

    it('should pass when combinedScore above threshold', () => {
      const result = checkRelevanceFilter(0.75, 0.4);
      expect(result.passes).toBe(true);
    });

    it('should handle different threshold values', () => {
      const belowResult = checkRelevanceFilter(0.5, 0.6);
      const aboveResult = checkRelevanceFilter(0.7, 0.6);
      expect(belowResult.passes).toBe(false);
      expect(aboveResult.passes).toBe(true);
    });
  });

  describe('Pattern Constants', () => {
    it('should export DEFAULT_NEGATIVE_PATTERNS with 5 Lithuanian patterns', () => {
      expect(DEFAULT_NEGATIVE_PATTERNS).toHaveLength(5);
      expect(DEFAULT_NEGATIVE_PATTERNS[0].test('plovykla pačiam')).toBe(true);
      expect(DEFAULT_NEGATIVE_PATTERNS[1].test('savitarnos plovykla')).toBe(true);
      expect(DEFAULT_NEGATIVE_PATTERNS[2].test('plovykla namų sąlygomis')).toBe(true);
      expect(DEFAULT_NEGATIVE_PATTERNS[3].test('plovykla nemokamai')).toBe(true);
      expect(DEFAULT_NEGATIVE_PATTERNS[4].test('kaip padaryti plovyklą')).toBe(true);
    });

    it('should export B2C_PATTERNS with 4 personal/home patterns', () => {
      expect(B2C_PATTERNS).toHaveLength(4);
      expect(B2C_PATTERNS[0].test('asmeninis')).toBe(true);
      expect(B2C_PATTERNS[1].test('namų')).toBe(true);
      expect(B2C_PATTERNS[2].test('šeimai')).toBe(true);
      expect(B2C_PATTERNS[3].test('vaikams')).toBe(true);
    });

    it('should export B2B_PATTERNS with 5 business patterns', () => {
      expect(B2B_PATTERNS).toHaveLength(5);
      expect(B2B_PATTERNS[0].test('įmonėms')).toBe(true);
      expect(B2B_PATTERNS[1].test('verslui')).toBe(true);
      expect(B2B_PATTERNS[2].test('korporatyvinis')).toBe(true);
      expect(B2B_PATTERNS[3].test('autoparkui')).toBe(true);
      expect(B2B_PATTERNS[4].test('flotai')).toBe(true);
    });
  });
});
