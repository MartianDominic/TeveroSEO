/**
 * SideKeywordExpander Tests
 *
 * Tests for side keyword discovery via DataForSEO keyword ideas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverSideKeywords, SideKeywordExpander } from './SideKeywordExpander';
import type { SideKeywordExpanderConfig } from './types';
import * as dataforseo from '@/server/lib/dataforseo';

// Mock DataForSEO
vi.mock('@/server/lib/dataforseo', () => ({
  fetchKeywordIdeasRaw: vi.fn(),
}));

describe('SideKeywordExpander', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('discoverSideKeywords', () => {
    it('should discover keywords from DataForSEO for single problem term', async () => {
      // Mock DataForSEO response
      vi.mocked(dataforseo.fetchKeywordIdeasRaw).mockResolvedValue({
        data: [
          {
            keyword: 'drėkinamasis kremas sausai odai',
            keyword_info: { search_volume: 210, cpc: 1.5, competition: 0.45 },
            keyword_properties: { keyword_difficulty: 45 },
            search_intent_info: null,
            keyword_info_normalized_with_clickstream: null,
          },
          {
            keyword: 'veido serumas sausai odai',
            keyword_info: { search_volume: 250, cpc: 2.0, competition: 0.50 },
            keyword_properties: { keyword_difficulty: 35 },
            search_intent_info: null,
            keyword_info_normalized_with_clickstream: null,
          },
        ],
        billing: { cost: 0.01, path: ['test'] },
      });

      const constraints = {
        businessContext: {
          businessType: 'service' as const,
          productCategories: [],
          problemsSolved: ['sausa oda'],
        },
        geoConstraints: { scope: 'national' as const, country: 'lithuania' },
        audienceConstraints: { targetTypes: ['b2c' as const] },
        funnelConfig: { primary: 'bofu' as const },
        priorities: [],
        negativeFilters: { terms: [], brands: [], intents: [] },
        specialModes: {},
      };

      const result = await discoverSideKeywords(constraints, new Set(), {
        locationCode: 2440,
        languageCode: 'lt',
        limit: 100,
        relevanceThreshold: 0.4,
      });

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('problem');
      expect(result[0].seedTerm).toBe('sausa oda');
      expect(result[0].discoveredKeywords).toHaveLength(2);
      expect(result[0].expansionMethod).toBe('dataforseo_keyword_ideas');
    });

    it('should exclude keywords already in existingKeywords set', async () => {
      vi.mocked(dataforseo.fetchKeywordIdeasRaw).mockResolvedValue({
        data: [
          {
            keyword: 'drėkinamasis kremas sausai odai',
            keyword_info: { search_volume: 210, cpc: 1.5, competition: 0.45 },
            keyword_properties: { keyword_difficulty: 45 },
            search_intent_info: null,
            keyword_info_normalized_with_clickstream: null,
          },
          {
            keyword: 'existing keyword',
            keyword_info: { search_volume: 300, cpc: 1.0, competition: 0.30 },
            keyword_properties: { keyword_difficulty: 30 },
            search_intent_info: null,
            keyword_info_normalized_with_clickstream: null,
          },
        ],
        billing: { cost: 0.01, path: ['test'] },
      });

      const constraints = {
        businessContext: {
          businessType: 'service' as const,
          productCategories: [],
          problemsSolved: ['sausa oda'],
        },
        geoConstraints: { scope: 'national' as const, country: 'lithuania' },
        audienceConstraints: { targetTypes: ['b2c' as const] },
        funnelConfig: { primary: 'bofu' as const },
        priorities: [],
        negativeFilters: { terms: [], brands: [], intents: [] },
        specialModes: {},
      };

      const existingKeywords = new Set(['existing keyword']);

      const result = await discoverSideKeywords(constraints, existingKeywords, {
        locationCode: 2440,
        languageCode: 'lt',
        limit: 100,
        relevanceThreshold: 0.4,
      });

      expect(result[0].discoveredKeywords).toHaveLength(1);
      expect(result[0].discoveredKeywords[0].keyword).toBe('drėkinamasis kremas sausai odai');
    });

    it('should filter keywords below relevanceThreshold', async () => {
      vi.mocked(dataforseo.fetchKeywordIdeasRaw).mockResolvedValue({
        data: [
          {
            keyword: 'high volume keyword',
            keyword_info: { search_volume: 1000, cpc: 1.5, competition: 0.20 },
            keyword_properties: { keyword_difficulty: 20 },
            search_intent_info: null,
            keyword_info_normalized_with_clickstream: null,
          },
          {
            keyword: 'low volume keyword',
            keyword_info: { search_volume: 10, cpc: 0.1, competition: 0.80 },
            keyword_properties: { keyword_difficulty: 80 },
            search_intent_info: null,
            keyword_info_normalized_with_clickstream: null,
          },
        ],
        billing: { cost: 0.01, path: ['test'] },
      });

      const constraints = {
        businessContext: {
          businessType: 'service' as const,
          productCategories: [],
          problemsSolved: ['test problem'],
        },
        geoConstraints: { scope: 'national' as const, country: 'lithuania' },
        audienceConstraints: { targetTypes: ['b2c' as const] },
        funnelConfig: { primary: 'bofu' as const },
        priorities: [],
        negativeFilters: { terms: [], brands: [], intents: [] },
        specialModes: {},
      };

      const result = await discoverSideKeywords(constraints, new Set(), {
        locationCode: 2440,
        languageCode: 'lt',
        limit: 100,
        relevanceThreshold: 0.4, // High threshold - should filter low quality keyword
      });

      // Stub relevance scoring: volume/difficulty ratio
      // High: 1000/20 = 50 (normalized > 0.4) ✓
      // Low: 10/80 = 0.125 (normalized < 0.4) ✗
      expect(result[0].discoveredKeywords.length).toBeGreaterThan(0);
      expect(result[0].discoveredKeywords.every(k => k.relevanceScore >= 0.4)).toBe(true);
    });

    it('should set correct source and seedTerm for each expansion', async () => {
      vi.mocked(dataforseo.fetchKeywordIdeasRaw).mockResolvedValue({
        data: [
          {
            keyword: 'test keyword',
            keyword_info: { search_volume: 500, cpc: 1.0, competition: 0.40 },
            keyword_properties: { keyword_difficulty: 25 },
            search_intent_info: null,
            keyword_info_normalized_with_clickstream: null,
          },
        ],
        billing: { cost: 0.01, path: ['test'] },
      });

      const constraints = {
        businessContext: {
          businessType: 'service' as const,
          productCategories: [],
          problemsSolved: ['plaukų slinkimas'],
        },
        geoConstraints: { scope: 'national' as const, country: 'lithuania' },
        audienceConstraints: { targetTypes: ['b2c' as const] },
        funnelConfig: { primary: 'bofu' as const },
        priorities: [],
        negativeFilters: { terms: [], brands: [], intents: [] },
        specialModes: {},
      };

      const result = await discoverSideKeywords(constraints, new Set(), {
        locationCode: 2440,
        languageCode: 'lt',
        limit: 100,
        relevanceThreshold: 0.4,
      });

      expect(result[0].source).toBe('problem');
      expect(result[0].seedTerm).toBe('plaukų slinkimas');
      expect(result[0].discoveredKeywords[0].discoverySource).toBe('plaukų slinkimas');
    });

    it('should use dataforseo_keyword_ideas as expansionMethod', async () => {
      vi.mocked(dataforseo.fetchKeywordIdeasRaw).mockResolvedValue({
        data: [
          {
            keyword: 'test keyword',
            keyword_info: { search_volume: 500, cpc: 1.0, competition: 0.40 },
            keyword_properties: { keyword_difficulty: 20 },
            search_intent_info: null,
            keyword_info_normalized_with_clickstream: null,
          },
        ],
        billing: { cost: 0.01, path: ['test'] },
      });

      const constraints = {
        businessContext: {
          businessType: 'service' as const,
          productCategories: [],
          problemsSolved: ['test'],
        },
        geoConstraints: { scope: 'national' as const, country: 'lithuania' },
        audienceConstraints: { targetTypes: ['b2c' as const] },
        funnelConfig: { primary: 'bofu' as const },
        priorities: [],
        negativeFilters: { terms: [], brands: [], intents: [] },
        specialModes: {},
      };

      const result = await discoverSideKeywords(constraints, new Set(), {
        locationCode: 2440,
        languageCode: 'lt',
        limit: 100,
        relevanceThreshold: 0.4,
      });

      expect(result[0].expansionMethod).toBe('dataforseo_keyword_ideas');
    });
  });

  describe('SideKeywordExpander class', () => {
    it('should initialize with config', () => {
      const config: SideKeywordExpanderConfig = {
        locationCode: 2440,
        languageCode: 'lt',
        limit: 100,
        relevanceThreshold: 0.5,
      };

      const expander = new SideKeywordExpander(config);

      expect(expander).toBeDefined();
    });

    it('should call discoverSideKeywords via expand method', async () => {
      vi.mocked(dataforseo.fetchKeywordIdeasRaw).mockResolvedValue({
        data: [],
        billing: { cost: 0.01, path: ['test'] },
      });

      const config: SideKeywordExpanderConfig = {
        locationCode: 2440,
        languageCode: 'lt',
        limit: 50,
        relevanceThreshold: 0.3,
      };

      const expander = new SideKeywordExpander(config);

      const constraints = {
        businessContext: {
          businessType: 'service' as const,
          productCategories: [],
          problemsSolved: ['test'],
        },
        geoConstraints: { scope: 'national' as const, country: 'lithuania' },
        audienceConstraints: { targetTypes: ['b2c' as const] },
        funnelConfig: { primary: 'bofu' as const },
        priorities: [],
        negativeFilters: { terms: [], brands: [], intents: [] },
        specialModes: {},
      };

      const result = await expander.expand(constraints, new Set());

      expect(result).toHaveLength(1);
      expect(result[0].discoveredKeywords).toEqual([]);
      expect(dataforseo.fetchKeywordIdeasRaw).toHaveBeenCalledWith(
        'test',
        2440,
        'lt',
        50,
      );
    });
  });
});
