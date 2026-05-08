/**
 * ContentInsightsService Tests
 * Phase 96 AI-Writer Integration
 *
 * Tests for the ContentInsightsService which aggregates P96 analytics insights
 * for AI-Writer content workflows: brief, voice, optimization, check.
 *
 * The service depends on:
 * - TrendDetectionService (returns CachedData<TrendResult>)
 * - StrikingDistanceService (returns CachedData<StrikingDistanceResult>)
 * - CannibalizationService
 * - TopicClusterService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbClient } from '@/db';
import { wrapCachedData } from '../test-utils';

// Mock dependencies before importing the service
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock('./TrendDetectionService', () => ({
  TrendDetectionService: vi.fn().mockImplementation(() => ({
    analyzePageTrends: vi.fn(),
  })),
  getTrendDetectionService: vi.fn(),
}));

vi.mock('./StrikingDistanceService', () => ({
  StrikingDistanceService: vi.fn().mockImplementation(() => ({
    getStrikingDistancePages: vi.fn(),
  })),
  getStrikingDistanceService: vi.fn(),
}));

vi.mock('./CannibalizationService', () => ({
  CannibalizationService: vi.fn().mockImplementation(() => ({
    getCannibalizationForQuery: vi.fn(),
    detect: vi.fn(),
  })),
  getCannibalizationService: vi.fn(),
}));

vi.mock('./TopicClusterService', () => ({
  TopicClusterService: vi.fn().mockImplementation(() => ({
    getClusters: vi.fn(),
  })),
}));

// Import after mocking
const { ContentInsightsService } = await import('./ContentInsightsService');
const { db: mockDb } = await import('@/db');

describe('ContentInsightsService', () => {
  let service: ContentInsightsService;
  let mockTrendService: any;
  let mockStrikingService: any;
  let mockCannibalizationService: any;
  let mockTopicClusterService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock services
    mockTrendService = {
      analyzePageTrends: vi.fn(),
    };

    mockStrikingService = {
      getStrikingDistancePages: vi.fn(),
    };

    mockCannibalizationService = {
      getCannibalizationForQuery: vi.fn(),
      detect: vi.fn(),
    };

    mockTopicClusterService = {
      getClusters: vi.fn(),
    };

    // Instantiate with mocked dependencies
    service = new ContentInsightsService(
      mockDb as unknown as DbClient,
      mockTrendService,
      mockStrikingService,
      mockCannibalizationService,
      mockTopicClusterService
    );
  });

  describe('getBriefInsights', () => {
    it('should return trending topics from TrendDetectionService', async () => {
      // Mock TrendDetectionService returns CachedData<TrendResult>
      mockTrendService.analyzePageTrends.mockResolvedValue(
        wrapCachedData({
          pages: [
            {
              pageUrl: 'https://example.com/trending-page',
              currentClicks: 750,
              previousClicks: 500,
              currentImpressions: 10000,
              previousImpressions: 8000,
              currentPosition: 5.2,
              previousPosition: 6.1,
              changePercent: 50,
              trend: 'growing',
              confidence: 'high',
              topQueries: ['seo tips', 'marketing guide'],
            },
          ],
          meta: {
            totalAnalyzed: 1,
            growingCount: 1,
            decayingCount: 0,
            stableCount: 0,
            periodDays: 21,
            threshold: 0.10,
          },
        })
      );

      mockTopicClusterService.getClusters.mockResolvedValue([]);

      const result = await service.getBriefInsights('site-123');

      expect(result.trendingTopics).toHaveLength(1);
      expect(result.trendingTopics[0].keyword).toBe('seo tips');
      expect(result.trendingTopics[0].trend).toBe('rising');
      expect(result.trendingTopics[0].opportunity).toBeDefined();
    });

    it('should extract content gaps from topic clusters', async () => {
      mockTrendService.analyzePageTrends.mockResolvedValue(
        wrapCachedData({
          pages: [],
          meta: { totalAnalyzed: 0, growingCount: 0, decayingCount: 0, stableCount: 0, periodDays: 21, threshold: 0.10 },
        })
      );

      mockTopicClusterService.getClusters.mockResolvedValue([
        {
          id: 'cluster-1',
          name: 'SEO Fundamentals',
          hubPage: { url: 'https://example.com/seo-guide' },
          spokePages: [{ url: 'https://example.com/seo-tips' }],
          coverage: 0.8,
          totalImpressions: 5000,
          gaps: ['technical seo', 'local seo'],
        },
      ]);

      const result = await service.getBriefInsights('site-123');

      expect(result.contentGaps).toHaveLength(2);
      expect(result.contentGaps[0].topic).toBe('technical seo');
      expect(result.contentGaps[0].relatedCluster).toBe('SEO Fundamentals');
    });

    it('should format related clusters correctly', async () => {
      mockTrendService.analyzePageTrends.mockResolvedValue(
        wrapCachedData({
          pages: [],
          meta: { totalAnalyzed: 0, growingCount: 0, decayingCount: 0, stableCount: 0, periodDays: 21, threshold: 0.10 },
        })
      );

      mockTopicClusterService.getClusters.mockResolvedValue([
        {
          id: 'cluster-1',
          name: 'Marketing Automation',
          hubPage: { url: 'https://example.com/marketing-hub' },
          spokePages: [
            { url: 'https://example.com/email-marketing' },
            { url: 'https://example.com/social-marketing' },
          ],
          coverage: 0.75,
          totalImpressions: 10000,
          gaps: [],
        },
      ]);

      const result = await service.getBriefInsights('site-123');

      expect(result.relatedClusters).toHaveLength(1);
      expect(result.relatedClusters[0].clusterId).toBe('cluster-1');
      expect(result.relatedClusters[0].clusterName).toBe('Marketing Automation');
      expect(result.relatedClusters[0].pageCount).toBe(3); // hub + 2 spokes
      expect(result.relatedClusters[0].hubUrl).toBe('https://example.com/marketing-hub');
    });

    it('should extract suggested keywords from top queries', async () => {
      mockTrendService.analyzePageTrends.mockResolvedValue(
        wrapCachedData({
          pages: [
            {
              pageUrl: 'https://example.com/page-1',
              topQueries: ['keyword-1', 'keyword-2', 'keyword-3'],
              currentClicks: 100,
              previousClicks: 80,
              currentImpressions: 1000,
              previousImpressions: 800,
              currentPosition: 5,
              previousPosition: 6,
              changePercent: 25,
              trend: 'growing',
              confidence: 'high',
            },
            {
              pageUrl: 'https://example.com/page-2',
              topQueries: ['keyword-4', 'keyword-5'],
              currentClicks: 50,
              previousClicks: 40,
              currentImpressions: 500,
              previousImpressions: 400,
              currentPosition: 8,
              previousPosition: 9,
              changePercent: 25,
              trend: 'growing',
              confidence: 'medium',
            },
          ],
          meta: { totalAnalyzed: 2, growingCount: 2, decayingCount: 0, stableCount: 0, periodDays: 21, threshold: 0.10 },
        })
      );

      mockTopicClusterService.getClusters.mockResolvedValue([]);

      const result = await service.getBriefInsights('site-123');

      expect(result.suggestedKeywords.length).toBeGreaterThan(0);
      expect(result.suggestedKeywords).toContain('keyword-1');
    });

    it('should return empty insights on service error', async () => {
      mockTrendService.analyzePageTrends.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.getBriefInsights('site-123');

      expect(result.trendingTopics).toEqual([]);
      expect(result.contentGaps).toEqual([]);
      expect(result.relatedClusters).toEqual([]);
      expect(result.suggestedKeywords).toEqual([]);
    });
  });

  describe('getVoiceInsights', () => {
    it('should return top performing content from database', async () => {
      (mockDb as any).execute.mockResolvedValue({
        rows: [
          {
            page_url: 'https://example.com/best-page',
            total_clicks: 500,
            total_impressions: 5000,
            avg_position: 3.5,
            top_queries: ['top query 1', 'top query 2'],
          },
          {
            page_url: 'https://example.com/second-best',
            total_clicks: 300,
            total_impressions: 4000,
            avg_position: 5.2,
            top_queries: ['other query'],
          },
        ],
      });

      const result = await service.getVoiceInsights('site-123');

      expect(result.topPerformingContent).toHaveLength(2);
      expect(result.topPerformingContent[0].url).toBe('https://example.com/best-page');
      expect(result.topPerformingContent[0].clicks).toBe(500);
      expect(result.topPerformingContent[0].ctr).toBeCloseTo(0.1, 2);
    });

    it('should calculate engagement metrics correctly', async () => {
      (mockDb as any).execute.mockResolvedValue({
        rows: [
          {
            page_url: 'https://example.com/page-1',
            total_clicks: 100,
            total_impressions: 1000,
            avg_position: 5.0,
            top_queries: [],
          },
          {
            page_url: 'https://example.com/page-2',
            total_clicks: 200,
            total_impressions: 2000,
            avg_position: 3.0,
            top_queries: [],
          },
        ],
      });

      const result = await service.getVoiceInsights('site-123');

      // avgClicks: (100 + 200) / 2 = 150
      expect(result.engagementMetrics.avgClicks).toBe(150);
      // avgCtr: (0.1 + 0.1) / 2 = 0.1
      expect(result.engagementMetrics.avgCtr).toBeCloseTo(0.1, 2);
      // avgPosition: (5.0 + 3.0) / 2 = 4.0
      expect(result.engagementMetrics.avgPosition).toBe(4.0);
    });

    it('should include date range in response', async () => {
      (mockDb as any).execute.mockResolvedValue({ rows: [] });

      const result = await service.getVoiceInsights('site-123');

      expect(result.dateRange).toBeDefined();
      expect(result.dateRange.start).toBeDefined();
      expect(result.dateRange.end).toBeDefined();
    });

    it('should return empty insights on database error', async () => {
      (mockDb as any).execute.mockRejectedValue(new Error('Database error'));

      const result = await service.getVoiceInsights('site-123');

      expect(result.topPerformingContent).toEqual([]);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('getOptimizationInsights', () => {
    it('should return striking distance keywords from StrikingDistanceService', async () => {
      // Mock StrikingDistanceService returns CachedData<StrikingDistanceResult>
      mockStrikingService.getStrikingDistancePages.mockResolvedValue(
        wrapCachedData({
          pages: [
            {
              pageUrl: 'https://example.com/page',
              avgPosition: 12.5,
              impressions: 5000,
              currentClicks: 100,
              potentialClicks: 550,
              clickGain: 450,
              difficulty: 'easy',
              topQueries: [
                { query: 'seo optimization', position: 12, impressions: 2000, clicks: 40 },
                { query: 'seo tips', position: 13, impressions: 1500, clicks: 30 },
              ],
            },
          ],
          meta: {
            totalPages: 1,
            totalPotentialClicks: 550,
            avgDifficulty: 1,
          },
        })
      );

      const result = await service.getOptimizationInsights('site-123');

      expect(result.strikingDistanceKeywords.length).toBeGreaterThan(0);
      expect(result.strikingDistanceKeywords[0].keyword).toBe('seo optimization');
      expect(result.strikingDistanceKeywords[0].pageUrl).toBe('https://example.com/page');
      expect(result.strikingDistanceKeywords[0].currentPosition).toBe(12);
    });

    it('should calculate difficulty based on position', async () => {
      mockStrikingService.getStrikingDistancePages.mockResolvedValue(
        wrapCachedData({
          pages: [
            {
              pageUrl: 'https://example.com/page',
              avgPosition: 12.0,
              impressions: 3000,
              currentClicks: 50,
              potentialClicks: 330,
              clickGain: 280,
              difficulty: 'easy',
              topQueries: [
                { query: 'easy keyword', position: 12, impressions: 1000, clicks: 20 },
                { query: 'medium keyword', position: 15, impressions: 1000, clicks: 15 },
                { query: 'hard keyword', position: 18, impressions: 1000, clicks: 10 },
              ],
            },
          ],
          meta: { totalPages: 1, totalPotentialClicks: 330, avgDifficulty: 1 },
        })
      );

      const result = await service.getOptimizationInsights('site-123');

      const easyKeyword = result.strikingDistanceKeywords.find(k => k.keyword === 'easy keyword');
      const mediumKeyword = result.strikingDistanceKeywords.find(k => k.keyword === 'medium keyword');
      const hardKeyword = result.strikingDistanceKeywords.find(k => k.keyword === 'hard keyword');

      expect(easyKeyword?.difficulty).toBe('easy');
      expect(mediumKeyword?.difficulty).toBe('medium');
      expect(hardKeyword?.difficulty).toBe('hard');
    });

    it('should sort keywords by potential clicks descending', async () => {
      mockStrikingService.getStrikingDistancePages.mockResolvedValue(
        wrapCachedData({
          pages: [
            {
              pageUrl: 'https://example.com/page',
              avgPosition: 12.0,
              impressions: 6000,
              currentClicks: 100,
              potentialClicks: 660,
              clickGain: 560,
              difficulty: 'easy',
              topQueries: [
                { query: 'low potential', position: 12, impressions: 500, clicks: 10 },
                { query: 'high potential', position: 12, impressions: 5000, clicks: 80 },
              ],
            },
          ],
          meta: { totalPages: 1, totalPotentialClicks: 660, avgDifficulty: 1 },
        })
      );

      const result = await service.getOptimizationInsights('site-123');

      // Should be sorted by potentialClicks descending
      expect(result.strikingDistanceKeywords[0].potentialClicks).toBeGreaterThan(
        result.strikingDistanceKeywords[1].potentialClicks
      );
    });

    it('should count quick wins correctly', async () => {
      mockStrikingService.getStrikingDistancePages.mockResolvedValue(
        wrapCachedData({
          pages: [
            {
              pageUrl: 'https://example.com/page',
              avgPosition: 12.0,
              impressions: 3000,
              currentClicks: 50,
              potentialClicks: 330,
              clickGain: 280,
              difficulty: 'easy',
              topQueries: [
                { query: 'easy1', position: 11, impressions: 1000, clicks: 20 },
                { query: 'easy2', position: 13, impressions: 1000, clicks: 15 },
                { query: 'hard1', position: 19, impressions: 1000, clicks: 10 },
              ],
            },
          ],
          meta: { totalPages: 1, totalPotentialClicks: 330, avgDifficulty: 1 },
        })
      );

      const result = await service.getOptimizationInsights('site-123');

      // 2 easy keywords (positions 11, 13)
      expect(result.quickWinCount).toBe(2);
    });

    it('should return empty insights on service error', async () => {
      mockStrikingService.getStrikingDistancePages.mockRejectedValue(new Error('Service error'));

      const result = await service.getOptimizationInsights('site-123');

      expect(result.strikingDistanceKeywords).toEqual([]);
      expect(result.quickWinCount).toBe(0);
      expect(result.totalPotentialClicks).toBe(0);
    });
  });

  describe('getPrePublishCheck', () => {
    it('should return no risk when no conflicts found', async () => {
      // detect() returns issues array - empty means no conflicts
      mockCannibalizationService.detect.mockResolvedValue({
        issues: [],
        summary: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } },
        metadata: { mode: 'stored', dateRange: { start: '2026-05-01', end: '2026-05-07' } },
      });

      const result = await service.getPrePublishCheck('site-123', ['new keyword']);

      expect(result.cannibalizationRisk.hasRisk).toBe(false);
      expect(result.cannibalizationRisk.riskLevel).toBe('none');
      expect(result.safeToPublish).toBe(true);
    });

    it('should detect cannibalization conflicts', async () => {
      // detect() returns issues that match the keyword
      mockCannibalizationService.detect.mockResolvedValue({
        issues: [
          {
            query: 'target keyword',
            severity: 'high',
            pages: [
              {
                pageUrl: 'https://example.com/existing-page',
                avgPosition: 5,
                impressions: 1000,
                clicks: 50,
                ctr: 0.05,
                impressionShare: 1.0,
              },
            ],
            impactEstimate: { dailyLostClicks: 10, monthlyLostClicks: 300, confidence: 'medium' },
            recommendation: { action: 'canonical', primaryPage: 'https://example.com/existing-page', secondaryPages: [], rationale: 'test', priority: 50 },
          },
        ],
        summary: { total: 1, bySeverity: { critical: 0, high: 1, medium: 0, low: 0 } },
        metadata: { mode: 'stored', dateRange: { start: '2026-05-01', end: '2026-05-07' } },
      });

      const result = await service.getPrePublishCheck('site-123', ['target keyword']);

      expect(result.cannibalizationRisk.hasRisk).toBe(true);
      expect(result.cannibalizationRisk.conflictingPages).toHaveLength(1);
      expect(result.cannibalizationRisk.conflictingPages[0].url).toBe('https://example.com/existing-page');
    });

    it('should determine correct risk level based on severity', async () => {
      mockCannibalizationService.detect.mockResolvedValue({
        issues: [
          {
            query: 'critical keyword',
            severity: 'high',
            pages: [{ pageUrl: 'https://example.com/page', avgPosition: 2, impressions: 5000, clicks: 250, ctr: 0.05, impressionShare: 1.0 }],
            impactEstimate: { dailyLostClicks: 50, monthlyLostClicks: 1500, confidence: 'high' },
            recommendation: { action: 'canonical', primaryPage: 'https://example.com/page', secondaryPages: [], rationale: 'test', priority: 70 },
          },
        ],
        summary: { total: 1, bySeverity: { critical: 0, high: 1, medium: 0, low: 0 } },
        metadata: { mode: 'stored', dateRange: { start: '2026-05-01', end: '2026-05-07' } },
      });

      const result = await service.getPrePublishCheck('site-123', ['critical keyword']);

      expect(result.cannibalizationRisk.riskLevel).toBe('high');
      expect(result.safeToPublish).toBe(false);
    });

    it('should suggest safe focus keywords (those without conflicts)', async () => {
      // detect() returns only the conflicted keyword, safe keyword has no match
      mockCannibalizationService.detect.mockResolvedValue({
        issues: [
          {
            query: 'conflicted keyword',
            severity: 'medium',
            pages: [{ pageUrl: 'https://example.com/page', avgPosition: 8, impressions: 500, clicks: 25, ctr: 0.05, impressionShare: 1.0 }],
            impactEstimate: { dailyLostClicks: 5, monthlyLostClicks: 150, confidence: 'medium' },
            recommendation: { action: 'canonical', primaryPage: 'https://example.com/page', secondaryPages: [], rationale: 'test', priority: 50 },
          },
        ],
        summary: { total: 1, bySeverity: { critical: 0, high: 0, medium: 1, low: 0 } },
        metadata: { mode: 'stored', dateRange: { start: '2026-05-01', end: '2026-05-07' } },
      });

      const result = await service.getPrePublishCheck('site-123', [
        'conflicted keyword',
        'safe keyword',
      ]);

      expect(result.suggestedFocus).toContain('safe keyword');
      expect(result.suggestedFocus).not.toContain('conflicted keyword');
    });

    it('should return safe when no keywords provided', async () => {
      const result = await service.getPrePublishCheck('site-123', []);

      expect(result.safeToPublish).toBe(true);
      expect(result.cannibalizationRisk.hasRisk).toBe(false);
    });

    it('should limit keyword checks to first 10 keywords', async () => {
      const manyKeywords = Array.from({ length: 15 }, (_, i) => `keyword-${i}`);
      mockCannibalizationService.detect.mockResolvedValue({
        issues: [],
        summary: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } },
        metadata: { mode: 'stored', dateRange: { start: '2026-05-01', end: '2026-05-07' } },
      });

      await service.getPrePublishCheck('site-123', manyKeywords);

      // detect() is called once with all keywords, but only first 10 are checked
      expect(mockCannibalizationService.detect).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
      mockCannibalizationService.detect.mockRejectedValue(
        new Error('Service error')
      );

      const result = await service.getPrePublishCheck('site-123', ['keyword']);

      expect(result.safeToPublish).toBe(true);
      expect(result.cannibalizationRisk.recommendation).toContain('Unable to check');
    });
  });

  describe('Private Helper Methods', () => {
    it('should calculate opportunity correctly based on impressions and change', async () => {
      mockTrendService.analyzePageTrends.mockResolvedValue(
        wrapCachedData({
          pages: [
            {
              pageUrl: 'https://example.com/high-opp',
              currentClicks: 600,
              previousClicks: 400,
              currentImpressions: 2000, // High impressions + high change = high opportunity
              previousImpressions: 1500,
              currentPosition: 5,
              previousPosition: 6,
              changePercent: 50, // >20% change
              trend: 'growing',
              confidence: 'high',
              topQueries: ['high opp keyword'],
            },
            {
              pageUrl: 'https://example.com/medium-opp',
              currentClicks: 300,
              previousClicks: 270,
              currentImpressions: 600, // Medium impressions
              previousImpressions: 550,
              currentPosition: 8,
              previousPosition: 9,
              changePercent: 11, // 10-20% change
              trend: 'growing',
              confidence: 'medium',
              topQueries: ['medium opp keyword'],
            },
            {
              pageUrl: 'https://example.com/low-opp',
              currentClicks: 50,
              previousClicks: 48,
              currentImpressions: 300, // Low impressions + low change = low opportunity
              previousImpressions: 290,
              currentPosition: 12,
              previousPosition: 13,
              changePercent: 4, // <10% change
              trend: 'stable',
              confidence: 'low',
              topQueries: ['low opp keyword'],
            },
          ],
          meta: { totalAnalyzed: 3, growingCount: 2, decayingCount: 0, stableCount: 1, periodDays: 21, threshold: 0.10 },
        })
      );

      mockTopicClusterService.getClusters.mockResolvedValue([]);

      const result = await service.getBriefInsights('site-123');

      const highOpp = result.trendingTopics.find(t => t.keyword === 'high opp keyword');
      const mediumOpp = result.trendingTopics.find(t => t.keyword === 'medium opp keyword');

      expect(highOpp?.opportunity).toBe('high');
      expect(mediumOpp?.opportunity).toBe('medium');
    });

    it('should extract keyword from URL when no top queries available', async () => {
      mockTrendService.analyzePageTrends.mockResolvedValue(
        wrapCachedData({
          pages: [
            {
              pageUrl: 'https://example.com/seo-optimization-guide',
              currentClicks: 100,
              previousClicks: 50,
              currentImpressions: 1000,
              previousImpressions: 500,
              currentPosition: 5,
              previousPosition: 8,
              changePercent: 100,
              trend: 'growing',
              confidence: 'high',
              topQueries: [], // No top queries
            },
          ],
          meta: { totalAnalyzed: 1, growingCount: 1, decayingCount: 0, stableCount: 0, periodDays: 21, threshold: 0.10 },
        })
      );

      mockTopicClusterService.getClusters.mockResolvedValue([]);

      const result = await service.getBriefInsights('site-123');

      // Should extract keyword from URL slug
      expect(result.trendingTopics[0].keyword).toContain('seo');
    });
  });
});
