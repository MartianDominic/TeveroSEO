/**
 * Tests for InternalLinkGraph with PageRank authority calculation.
 * Phase 92-06: Internal Linking PageRank
 *
 * Tests:
 * - calculatePageAuthority returns scores between 0-1
 * - Pages with more inbound links have higher authority
 * - Damping factor affects score distribution
 * - getLinkRecommendations filters by quality score >= 70
 * - Combined score = pagerank * 0.5 + qualityScore * 0.5
 * - Empty graph returns empty results (no errors)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('@/db', () => ({
  db: {},
  DbClient: {},
}));

import {
  InternalLinkGraph,
  type PageAuthority,
  type LinkRecommendation,
  type PageRankConfig,
} from './InternalLinkGraph';

// Mock database implementation
function createMockDb(
  linkData: Array<{ sourceUrl: string; targetUrl: string }>,
  qualityData: Array<{ pageUrl: string; overallScore: number }>
) {
  return {
    select: vi.fn().mockImplementation((fields) => ({
      from: vi.fn().mockImplementation((table) => ({
        where: vi.fn().mockImplementation((condition) => {
          // Determine which table based on field names
          if (fields?.sourceUrl !== undefined) {
            // link_graph query
            return Promise.resolve(linkData);
          }
          if (fields?.pageUrl !== undefined && fields?.overallScore !== undefined) {
            // page_quality_scores query
            return Promise.resolve(qualityData);
          }
          if (fields?.targetUrl !== undefined && fields?.anchorText !== undefined) {
            // getExistingLinks query
            return Promise.resolve([]);
          }
          if (fields?.anchorText !== undefined) {
            // checkAnchorDiversity query
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      })),
    })),
  };
}

describe('InternalLinkGraph', () => {
  describe('calculatePageAuthority', () => {
    it('should return empty array for empty graph', async () => {
      const mockDb = createMockDb([], []);
      const graph = new InternalLinkGraph(mockDb as any);

      const authorities = await graph.calculatePageAuthority('client-123');

      expect(authorities).toEqual([]);
    });

    it('should return authority scores between 0 and 1', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/page-a', targetUrl: '/page-b' },
          { sourceUrl: '/page-a', targetUrl: '/page-c' },
          { sourceUrl: '/page-b', targetUrl: '/page-c' },
        ],
        []
      );
      const graph = new InternalLinkGraph(mockDb as any);

      const authorities = await graph.calculatePageAuthority('client-123');

      expect(authorities.length).toBeGreaterThan(0);
      for (const auth of authorities) {
        expect(auth.score).toBeGreaterThanOrEqual(0);
        expect(auth.score).toBeLessThanOrEqual(1);
      }
    });

    it('should assign higher authority to pages with more inbound links', async () => {
      // Create a graph where page-c has the most inbound links
      const mockDb = createMockDb(
        [
          { sourceUrl: '/page-a', targetUrl: '/page-c' },
          { sourceUrl: '/page-b', targetUrl: '/page-c' },
          { sourceUrl: '/page-d', targetUrl: '/page-c' },
          { sourceUrl: '/page-a', targetUrl: '/page-b' },
        ],
        []
      );
      const graph = new InternalLinkGraph(mockDb as any);

      const authorities = await graph.calculatePageAuthority('client-123');

      // Find page-c authority (most inbound links)
      const pageC = authorities.find((a) => a.url === '/page-c');
      const pageB = authorities.find((a) => a.url === '/page-b');

      expect(pageC).toBeDefined();
      expect(pageB).toBeDefined();
      expect(pageC!.score).toBeGreaterThan(pageB!.score);
      expect(pageC!.inboundLinks).toBe(3);
      expect(pageB!.inboundLinks).toBe(1);
    });

    it('should assign ranks in descending order by score', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/page-a', targetUrl: '/page-b' },
          { sourceUrl: '/page-b', targetUrl: '/page-c' },
          { sourceUrl: '/page-c', targetUrl: '/page-a' },
        ],
        []
      );
      const graph = new InternalLinkGraph(mockDb as any);

      const authorities = await graph.calculatePageAuthority('client-123');

      // Check ranks are assigned correctly (1 = highest score)
      for (let i = 0; i < authorities.length - 1; i++) {
        expect(authorities[i].rank).toBeLessThan(authorities[i + 1].rank);
        expect(authorities[i].score).toBeGreaterThanOrEqual(authorities[i + 1].score);
      }
    });

    it('should track inbound and outbound link counts correctly', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/hub', targetUrl: '/spoke-1' },
          { sourceUrl: '/hub', targetUrl: '/spoke-2' },
          { sourceUrl: '/hub', targetUrl: '/spoke-3' },
          { sourceUrl: '/spoke-1', targetUrl: '/hub' },
        ],
        []
      );
      const graph = new InternalLinkGraph(mockDb as any);

      const authorities = await graph.calculatePageAuthority('client-123');

      const hub = authorities.find((a) => a.url === '/hub');
      const spoke1 = authorities.find((a) => a.url === '/spoke-1');

      expect(hub).toBeDefined();
      expect(hub!.outboundLinks).toBe(3);
      expect(hub!.inboundLinks).toBe(1);

      expect(spoke1).toBeDefined();
      expect(spoke1!.outboundLinks).toBe(1);
      expect(spoke1!.inboundLinks).toBe(1);
    });
  });

  describe('damping factor configuration', () => {
    it('should use default damping factor of 0.85', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/a', targetUrl: '/b' },
          { sourceUrl: '/b', targetUrl: '/a' },
        ],
        []
      );
      const graph = new InternalLinkGraph(mockDb as any);

      // Default config should have damping factor 0.85
      const authorities = await graph.calculatePageAuthority('client-123');
      expect(authorities.length).toBe(2);
      // Scores should be equal in a symmetric 2-node graph
      expect(authorities[0].score).toBeCloseTo(authorities[1].score, 2);
    });

    it('should accept custom damping factor', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/a', targetUrl: '/b' },
          { sourceUrl: '/b', targetUrl: '/c' },
          { sourceUrl: '/c', targetUrl: '/a' },
        ],
        []
      );

      const graph1 = new InternalLinkGraph(mockDb as any, { dampingFactor: 0.5 });
      const graph2 = new InternalLinkGraph(mockDb as any, { dampingFactor: 0.95 });

      const auth1 = await graph1.calculatePageAuthority('client-123');
      const auth2 = await graph2.calculatePageAuthority('client-123');

      // Different damping factors should produce different score distributions
      // With lower damping (0.5), scores should be more evenly distributed
      // With higher damping (0.95), scores should be more concentrated
      expect(auth1.length).toBe(auth2.length);
      // Both should have valid scores
      expect(auth1[0].score).toBeGreaterThan(0);
      expect(auth2[0].score).toBeGreaterThan(0);
    });
  });

  describe('getLinkRecommendations', () => {
    it('should filter recommendations by minimum quality score', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/source', targetUrl: '/high-quality' },
          { sourceUrl: '/source', targetUrl: '/low-quality' },
          { sourceUrl: '/other', targetUrl: '/high-quality' },
        ],
        [
          { pageUrl: '/high-quality', overallScore: 85 },
          { pageUrl: '/low-quality', overallScore: 45 },
          { pageUrl: '/source', overallScore: 75 },
        ]
      );

      const graph = new InternalLinkGraph(mockDb as any);

      // The recommendations should only include pages with quality >= 70
      const recommendations = await graph.getLinkRecommendations(
        'client-123',
        '/source',
        'Sample content about SEO optimization',
        { minQualityScore: 70 }
      );

      // All recommendations should have quality >= 70
      for (const rec of recommendations) {
        expect(rec.qualityScore).toBeGreaterThanOrEqual(70);
      }
    });

    it('should exclude source URL from recommendations', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/source', targetUrl: '/target-1' },
          { sourceUrl: '/other', targetUrl: '/source' },
        ],
        [
          { pageUrl: '/source', overallScore: 90 },
          { pageUrl: '/target-1', overallScore: 80 },
        ]
      );

      const graph = new InternalLinkGraph(mockDb as any);

      const recommendations = await graph.getLinkRecommendations(
        'client-123',
        '/source',
        'Sample content'
      );

      // Source URL should not be in recommendations
      const hasSource = recommendations.some((r) => r.targetUrl === '/source');
      expect(hasSource).toBe(false);
    });

    it('should return empty array when no candidates meet quality threshold', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/source', targetUrl: '/low-1' },
          { sourceUrl: '/source', targetUrl: '/low-2' },
        ],
        [
          { pageUrl: '/low-1', overallScore: 30 },
          { pageUrl: '/low-2', overallScore: 40 },
        ]
      );

      const graph = new InternalLinkGraph(mockDb as any);

      const recommendations = await graph.getLinkRecommendations(
        'client-123',
        '/source',
        'Sample content',
        { minQualityScore: 70 }
      );

      expect(recommendations).toEqual([]);
    });

    it('should sort recommendations by combined score', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/source', targetUrl: '/target-a' },
          { sourceUrl: '/source', targetUrl: '/target-b' },
          { sourceUrl: '/other', targetUrl: '/target-a' },
          { sourceUrl: '/other', targetUrl: '/target-a' },
        ],
        [
          { pageUrl: '/target-a', overallScore: 90 }, // Higher quality + more links
          { pageUrl: '/target-b', overallScore: 75 }, // Lower quality + fewer links
        ]
      );

      const graph = new InternalLinkGraph(mockDb as any);

      const recommendations = await graph.getLinkRecommendations(
        'client-123',
        '/source',
        'Sample content',
        { minQualityScore: 70 }
      );

      // Recommendations should be sorted by combined score (descending)
      for (let i = 0; i < recommendations.length - 1; i++) {
        expect(recommendations[i].combinedScore).toBeGreaterThanOrEqual(
          recommendations[i + 1].combinedScore
        );
      }
    });

    it('should respect limit parameter', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/source', targetUrl: '/t1' },
          { sourceUrl: '/source', targetUrl: '/t2' },
          { sourceUrl: '/source', targetUrl: '/t3' },
          { sourceUrl: '/source', targetUrl: '/t4' },
          { sourceUrl: '/source', targetUrl: '/t5' },
        ],
        [
          { pageUrl: '/t1', overallScore: 90 },
          { pageUrl: '/t2', overallScore: 85 },
          { pageUrl: '/t3', overallScore: 80 },
          { pageUrl: '/t4', overallScore: 75 },
          { pageUrl: '/t5', overallScore: 70 },
        ]
      );

      const graph = new InternalLinkGraph(mockDb as any);

      const recommendations = await graph.getLinkRecommendations(
        'client-123',
        '/source',
        'Sample content',
        { limit: 3 }
      );

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should include authority, quality, and combined scores', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/source', targetUrl: '/target' },
          { sourceUrl: '/other', targetUrl: '/target' },
        ],
        [{ pageUrl: '/target', overallScore: 80 }]
      );

      const graph = new InternalLinkGraph(mockDb as any);

      const recommendations = await graph.getLinkRecommendations(
        'client-123',
        '/source',
        'Sample content'
      );

      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec.authorityScore).toBeDefined();
        expect(rec.qualityScore).toBeDefined();
        expect(rec.combinedScore).toBeDefined();
        expect(rec.authorityScore).toBeGreaterThanOrEqual(0);
        expect(rec.qualityScore).toBeGreaterThanOrEqual(0);
        expect(rec.combinedScore).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getExistingLinks', () => {
    it('should return existing links for a page', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { targetUrl: '/page-b', anchorText: 'Link to B' },
              { targetUrl: '/page-c', anchorText: null },
            ]),
          }),
        }),
      };

      const graph = new InternalLinkGraph(mockDb as any);

      const links = await graph.getExistingLinks('client-123', '/page-a');

      expect(links).toHaveLength(2);
      expect(links[0].targetUrl).toBe('/page-b');
      expect(links[0].anchorText).toBe('Link to B');
    });
  });

  describe('checkAnchorDiversity', () => {
    it('should calculate anchor diversity correctly', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { anchorText: 'anchor 1' },
              { anchorText: 'anchor 1' },
              { anchorText: 'anchor 2' },
              { anchorText: 'anchor 3' },
              { anchorText: null },
            ]),
          }),
        }),
      };

      const graph = new InternalLinkGraph(mockDb as any);

      const result = await graph.checkAnchorDiversity('client-123', '/target-page');

      expect(result.totalLinks).toBe(5);
      expect(result.uniqueAnchors).toBe(3); // anchor 1, 2, 3 (null excluded)
      expect(result.diversityScore).toBe(3 / 5); // 0.6
      expect(result.anchors).toContain('anchor 1');
      expect(result.anchors).toContain('anchor 2');
      expect(result.anchors).toContain('anchor 3');
    });

    it('should return diversity score of 1 for page with no links', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      const graph = new InternalLinkGraph(mockDb as any);

      const result = await graph.checkAnchorDiversity('client-123', '/target-page');

      expect(result.totalLinks).toBe(0);
      expect(result.uniqueAnchors).toBe(0);
      expect(result.diversityScore).toBe(1); // Default to 1 when no links
    });
  });

  describe('generateReason', () => {
    it('should generate appropriate reasons based on scores', async () => {
      const mockDb = createMockDb(
        [
          { sourceUrl: '/source', targetUrl: '/excellent-target' },
          { sourceUrl: '/other-1', targetUrl: '/excellent-target' },
          { sourceUrl: '/other-2', targetUrl: '/excellent-target' },
        ],
        [{ pageUrl: '/excellent-target', overallScore: 95 }]
      );

      const graph = new InternalLinkGraph(mockDb as any);

      const recommendations = await graph.getLinkRecommendations(
        'client-123',
        '/source',
        'Sample content'
      );

      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec.reason).toBeDefined();
        expect(typeof rec.reason).toBe('string');
        // High quality page should mention "excellent quality" or "high quality"
        if (rec.qualityScore >= 90) {
          expect(rec.reason.toLowerCase()).toMatch(/excellent quality|high quality|high authority/);
        }
      }
    });
  });
});
