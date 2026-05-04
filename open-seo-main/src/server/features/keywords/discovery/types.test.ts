/**
 * Discovery Types Tests
 *
 * Tests for side keyword expansion types.
 */

import { describe, it, expect } from 'vitest';
import type {
  SideKeywordExpansion,
  SideKeyword,
  SideKeywordExpanderConfig,
} from './types';

describe('Discovery Types', () => {
  it('should define SideKeywordExpansion type', () => {
    const expansion: SideKeywordExpansion = {
      source: 'problem',
      seedTerm: 'sausa oda',
      discoveredKeywords: [],
      expansionMethod: 'dataforseo_keyword_ideas',
    };

    expect(expansion.source).toBe('problem');
    expect(expansion.seedTerm).toBe('sausa oda');
    expect(expansion.discoveredKeywords).toEqual([]);
    expect(expansion.expansionMethod).toBe('dataforseo_keyword_ideas');
  });

  it('should define SideKeyword type', () => {
    const keyword: SideKeyword = {
      keyword: 'drėkinamasis kremas sausai odai',
      volume: 210,
      difficulty: 45,
      relevanceScore: 0.75,
      passesFilters: true,
      discoverySource: 'sausa oda',
    };

    expect(keyword.keyword).toBe('drėkinamasis kremas sausai odai');
    expect(keyword.volume).toBe(210);
    expect(keyword.difficulty).toBe(45);
    expect(keyword.relevanceScore).toBe(0.75);
    expect(keyword.passesFilters).toBe(true);
    expect(keyword.discoverySource).toBe('sausa oda');
  });

  it('should define SideKeywordExpanderConfig type', () => {
    const config: SideKeywordExpanderConfig = {
      locationCode: 2440,
      languageCode: 'lt',
      limit: 100,
      relevanceThreshold: 0.4,
    };

    expect(config.locationCode).toBe(2440);
    expect(config.languageCode).toBe('lt');
    expect(config.limit).toBe(100);
    expect(config.relevanceThreshold).toBe(0.4);
  });

  it('should allow source variants: problem, solution, related', () => {
    const problemExpansion: SideKeywordExpansion = {
      source: 'problem',
      seedTerm: 'test',
      discoveredKeywords: [],
      expansionMethod: 'test',
    };

    const solutionExpansion: SideKeywordExpansion = {
      source: 'solution',
      seedTerm: 'test',
      discoveredKeywords: [],
      expansionMethod: 'test',
    };

    const relatedExpansion: SideKeywordExpansion = {
      source: 'related',
      seedTerm: 'test',
      discoveredKeywords: [],
      expansionMethod: 'test',
    };

    expect(problemExpansion.source).toBe('problem');
    expect(solutionExpansion.source).toBe('solution');
    expect(relatedExpansion.source).toBe('related');
  });

  it('should allow discoveredKeywords array in expansion', () => {
    const keywords: SideKeyword[] = [
      {
        keyword: 'keyword 1',
        volume: 100,
        difficulty: 30,
        relevanceScore: 0.8,
        passesFilters: true,
        discoverySource: 'seed',
      },
      {
        keyword: 'keyword 2',
        volume: 200,
        difficulty: 40,
        relevanceScore: 0.6,
        passesFilters: false,
        discoverySource: 'seed',
      },
    ];

    const expansion: SideKeywordExpansion = {
      source: 'problem',
      seedTerm: 'seed',
      discoveredKeywords: keywords,
      expansionMethod: 'dataforseo_keyword_ideas',
    };

    expect(expansion.discoveredKeywords).toHaveLength(2);
    expect(expansion.discoveredKeywords[0].keyword).toBe('keyword 1');
    expect(expansion.discoveredKeywords[1].keyword).toBe('keyword 2');
  });
});
