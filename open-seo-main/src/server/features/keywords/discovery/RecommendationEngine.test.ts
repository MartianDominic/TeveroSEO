/**
 * RecommendationEngine Tests
 *
 * Tests for generating prioritized discovery recommendations.
 */

import { describe, it, expect } from 'vitest';
import { generateDiscoveryResult } from './RecommendationEngine';
import type { PSEOCluster, SideKeywordExpansion } from './types';
import type { ProductLinkage } from './ProductLinker';

describe('RecommendationEngine', () => {
  it('Test 1: PSEOCluster with opportunityScore > 0.7 generates high priority recommendation', () => {
    const pseoOpportunities: PSEOCluster[] = [
      {
        pattern: 'plovykla [CITY]',
        template: '/plovykla/{city}',
        keywords: ['plovykla vilniuje', 'plovykla kaune'],
        cities: ['vilnius', 'kaunas'],
        estimatedPages: 50,
        totalVolume: 960,
        avgDifficulty: 42,
        opportunityScore: 0.75,
      },
    ];

    const result = generateDiscoveryResult(pseoOpportunities, [], []);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].priority).toBe('high');
    expect(result.recommendations[0].type).toBe('pseo_template');
  });

  it('Test 2: Recommendation type is pseo_template for pSEO clusters', () => {
    const pseoOpportunities: PSEOCluster[] = [
      {
        pattern: 'serumas [CITY]',
        template: '/serumas/{city}',
        keywords: ['serumas vilniuje'],
        cities: ['vilnius'],
        estimatedPages: 20,
        totalVolume: 320,
        avgDifficulty: 38,
        opportunityScore: 0.5,
      },
    ];

    const result = generateDiscoveryResult(pseoOpportunities, [], []);

    expect(result.recommendations[0].type).toBe('pseo_template');
    expect(result.recommendations[0].title).toContain('pSEO');
  });

  it('Test 3: DiscoveryResult.metadata has correct totals', () => {
    const pseoOpportunities: PSEOCluster[] = [
      {
        pattern: 'test [CITY]',
        template: '/test/{city}',
        keywords: ['test1', 'test2'],
        cities: ['city1', 'city2'],
        estimatedPages: 30,
        totalVolume: 500,
        avgDifficulty: 40,
        opportunityScore: 0.6,
      },
    ];

    const sideKeywords: SideKeywordExpansion[] = [
      {
        source: 'problem',
        seedTerm: 'sausa oda',
        discoveredKeywords: [
          {
            keyword: 'kremas sausai odai',
            volume: 180,
            difficulty: 42,
            relevanceScore: 0.85,
            passesFilters: true,
            discoverySource: 'sausa oda',
          },
        ],
        expansionMethod: 'dataforseo_keyword_ideas',
      },
    ];

    const linkages: ProductLinkage[] = [
      {
        keyword: 'test1',
        linkedProducts: [{ productName: 'Product A', category: 'cat1', matchReason: 'direct_match' }],
        linkageConfidence: 0.8,
        suggestedLandingPage: '/products/cat1',
      },
      {
        keyword: 'test2',
        linkedProducts: [],
        linkageConfidence: 0.3,
        suggestedLandingPage: '/products',
      },
    ];

    const result = generateDiscoveryResult(pseoOpportunities, sideKeywords, linkages);

    expect(result.metadata.totalPSEOPages).toBe(30);
    expect(result.metadata.totalSideKeywords).toBe(1);
    expect(result.metadata.linkageRate).toBeCloseTo(0.5, 1); // 1 of 2 keywords linked
  });

  it('Test 4: Recommendations sorted by priority (high > medium > low)', () => {
    const pseoOpportunities: PSEOCluster[] = [
      {
        pattern: 'low [CITY]',
        template: '/low/{city}',
        keywords: ['low'],
        cities: ['city'],
        estimatedPages: 10,
        totalVolume: 100,
        avgDifficulty: 50,
        opportunityScore: 0.3, // Low priority
      },
      {
        pattern: 'high [CITY]',
        template: '/high/{city}',
        keywords: ['high1', 'high2'],
        cities: ['city1', 'city2'],
        estimatedPages: 50,
        totalVolume: 900,
        avgDifficulty: 35,
        opportunityScore: 0.8, // High priority
      },
      {
        pattern: 'medium [CITY]',
        template: '/medium/{city}',
        keywords: ['medium'],
        cities: ['city'],
        estimatedPages: 25,
        totalVolume: 400,
        avgDifficulty: 42,
        opportunityScore: 0.55, // Medium priority
      },
    ];

    const result = generateDiscoveryResult(pseoOpportunities, [], []);

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].priority).toBe('high');
    expect(result.recommendations[1].priority).toBe('medium');
    expect(result.recommendations[2].priority).toBe('low');
  });
});
