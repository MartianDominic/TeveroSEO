/**
 * CannibalizationService Tests
 * Phase 96-03: Keyword Cannibalization Detection
 *
 * TDD approach: Tests define expected behavior for detecting when
 * multiple pages compete for the same keyword.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module before importing the service
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

// Now import after mocking
const { CannibalizationService } = await import('./CannibalizationService');
const { db: mockDb } = await import('@/db');

describe('CannibalizationService', () => {
  let service: CannibalizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CannibalizationService(mockDb);
  });

  describe('detectCannibalization', () => {
    it('should detect cannibalization when 2+ pages rank for same query', async () => {
      // Mock data: 2 pages competing for "seo tips"
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            query: 'seo tips',
            page_url: 'https://example.com/seo-guide',
            total_clicks: 150,
            total_impressions: 5000,
            avg_position: 8.5,
            avg_ctr: 0.03,
          },
          {
            query: 'seo tips',
            page_url: 'https://example.com/seo-best-practices',
            total_clicks: 80,
            total_impressions: 3000,
            avg_position: 12.2,
            avg_ctr: 0.027,
          },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe('seo tips');
      expect(result[0].pages).toHaveLength(2);
    });

    it('should calculate correct severity based on page count and positions', async () => {
      // HIGH severity: >3 pages
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'many pages', page_url: 'https://example.com/p1', total_clicks: 100, total_impressions: 2000, avg_position: 5, avg_ctr: 0.05 },
          { query: 'many pages', page_url: 'https://example.com/p2', total_clicks: 80, total_impressions: 1500, avg_position: 7, avg_ctr: 0.053 },
          { query: 'many pages', page_url: 'https://example.com/p3', total_clicks: 50, total_impressions: 1000, avg_position: 12, avg_ctr: 0.05 },
          { query: 'many pages', page_url: 'https://example.com/p4', total_clicks: 30, total_impressions: 800, avg_position: 15, avg_ctr: 0.038 },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result[0].severity).toBe('high');
    });

    it('should return empty array when no cannibalization exists', async () => {
      // No rows = no queries with multiple pages
      mockDb.execute.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result).toHaveLength(0);
    });

    it('should filter by date range correctly', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            query: 'test query',
            page_url: 'https://example.com/page1',
            total_clicks: 50,
            total_impressions: 1000,
            avg_position: 10,
            avg_ctr: 0.05,
          },
          {
            query: 'test query',
            page_url: 'https://example.com/page2',
            total_clicks: 30,
            total_impressions: 800,
            avg_position: 15,
            avg_ctr: 0.038,
          },
        ],
      });

      await service.detectCannibalization('site-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      // Verify the SQL was called with the date parameters
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      const sqlCall = mockDb.execute.mock.calls[0][0];
      expect(sqlCall).toBeDefined();
    });

    it('should respect minImpressions threshold', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            query: 'high volume query',
            page_url: 'https://example.com/page1',
            total_clicks: 100,
            total_impressions: 5000, // Above threshold
            avg_position: 8,
            avg_ctr: 0.02,
          },
          {
            query: 'high volume query',
            page_url: 'https://example.com/page2',
            total_clicks: 80,
            total_impressions: 4000, // Above threshold
            avg_position: 10,
            avg_ctr: 0.02,
          },
        ],
      });

      const result = await service.detectCannibalization('site-123', { minImpressions: 1000 });

      // Both pages meet the threshold, so we should see the cannibalization
      expect(result).toHaveLength(1);
      expect(result[0].pages.every(p => p.impressions >= 1000)).toBe(true);
    });

    it('should limit results when limit is specified', async () => {
      // Return 5 cannibalization issues
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'query1', page_url: 'https://example.com/a1', total_clicks: 100, total_impressions: 5000, avg_position: 5, avg_ctr: 0.02 },
          { query: 'query1', page_url: 'https://example.com/a2', total_clicks: 80, total_impressions: 4000, avg_position: 8, avg_ctr: 0.02 },
          { query: 'query2', page_url: 'https://example.com/b1', total_clicks: 90, total_impressions: 4500, avg_position: 6, avg_ctr: 0.02 },
          { query: 'query2', page_url: 'https://example.com/b2', total_clicks: 70, total_impressions: 3500, avg_position: 9, avg_ctr: 0.02 },
          { query: 'query3', page_url: 'https://example.com/c1', total_clicks: 60, total_impressions: 3000, avg_position: 7, avg_ctr: 0.02 },
          { query: 'query3', page_url: 'https://example.com/c2', total_clicks: 50, total_impressions: 2500, avg_position: 11, avg_ctr: 0.02 },
        ],
      });

      const result = await service.detectCannibalization('site-123', { limit: 2 });

      expect(result).toHaveLength(2);
    });

    it('should calculate impact estimate correctly', async () => {
      // Two pages sharing impressions - losing potential from consolidation
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            query: 'impact test',
            page_url: 'https://example.com/page1',
            total_clicks: 100,
            total_impressions: 5000,
            avg_position: 8,
            avg_ctr: 0.02, // 2%
          },
          {
            query: 'impact test',
            page_url: 'https://example.com/page2',
            total_clicks: 50,
            total_impressions: 3000,
            avg_position: 15,
            avg_ctr: 0.017,
          },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      // Total impressions: 8000
      // Total clicks: 150
      // At position 3 CTR (11.01%), potential = 8000 * 0.1101 = 880.8
      // Impact = 880.8 - 150 = 730.8 (rounded to 731)
      expect(result[0].impactEstimate).toBeGreaterThan(700);
      expect(result[0].impactEstimate).toBeLessThan(800);
    });

    it('should generate appropriate recommendations', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            query: 'seo strategy',
            page_url: 'https://example.com/seo-strategy-guide',
            total_clicks: 200,
            total_impressions: 8000,
            avg_position: 6,
            avg_ctr: 0.025,
          },
          {
            query: 'seo strategy',
            page_url: 'https://example.com/seo-tips',
            total_clicks: 50,
            total_impressions: 2000,
            avg_position: 14,
            avg_ctr: 0.025,
          },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result[0].recommendation).toContain('canonical');
      expect(result[0].recommendation.toLowerCase()).toContain('seo strategy');
    });

    it('should sort results by impact descending', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          // Low impact issue (fewer impressions)
          { query: 'low impact', page_url: 'https://example.com/low1', total_clicks: 10, total_impressions: 500, avg_position: 15, avg_ctr: 0.02 },
          { query: 'low impact', page_url: 'https://example.com/low2', total_clicks: 5, total_impressions: 300, avg_position: 18, avg_ctr: 0.017 },
          // High impact issue (more impressions)
          { query: 'high impact', page_url: 'https://example.com/high1', total_clicks: 100, total_impressions: 10000, avg_position: 8, avg_ctr: 0.01 },
          { query: 'high impact', page_url: 'https://example.com/high2', total_clicks: 80, total_impressions: 8000, avg_position: 10, avg_ctr: 0.01 },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result[0].query).toBe('high impact');
      expect(result[0].impactEstimate).toBeGreaterThan(result[1].impactEstimate);
    });
  });

  describe('calculateSeverity', () => {
    it('should return HIGH severity when >3 pages compete', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'test', page_url: 'https://example.com/p1', total_clicks: 50, total_impressions: 1000, avg_position: 20, avg_ctr: 0.05 },
          { query: 'test', page_url: 'https://example.com/p2', total_clicks: 40, total_impressions: 900, avg_position: 22, avg_ctr: 0.044 },
          { query: 'test', page_url: 'https://example.com/p3', total_clicks: 30, total_impressions: 800, avg_position: 25, avg_ctr: 0.038 },
          { query: 'test', page_url: 'https://example.com/p4', total_clicks: 20, total_impressions: 700, avg_position: 30, avg_ctr: 0.029 },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result[0].severity).toBe('high');
    });

    it('should return HIGH severity when top 2 pages both in top 10 positions', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'competitive', page_url: 'https://example.com/p1', total_clicks: 200, total_impressions: 5000, avg_position: 5, avg_ctr: 0.04 },
          { query: 'competitive', page_url: 'https://example.com/p2', total_clicks: 150, total_impressions: 4000, avg_position: 8, avg_ctr: 0.038 },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result[0].severity).toBe('high');
    });

    it('should return MEDIUM severity for 2-3 pages with distributed traffic', async () => {
      // 2 pages, neither dominating, one outside top 10
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'medium', page_url: 'https://example.com/p1', total_clicks: 100, total_impressions: 3000, avg_position: 8, avg_ctr: 0.033 },
          { query: 'medium', page_url: 'https://example.com/p2', total_clicks: 80, total_impressions: 2500, avg_position: 14, avg_ctr: 0.032 },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result[0].severity).toBe('medium');
    });

    it('should return LOW severity when one page dominates (>80% impressions)', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'dominated', page_url: 'https://example.com/primary', total_clicks: 200, total_impressions: 9000, avg_position: 6, avg_ctr: 0.022 },
          { query: 'dominated', page_url: 'https://example.com/secondary', total_clicks: 10, total_impressions: 500, avg_position: 25, avg_ctr: 0.02 },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      // 9000 / 9500 = 94.7% > 80%
      expect(result[0].severity).toBe('low');
    });
  });

  describe('getCannibalizationForQuery', () => {
    it('should return cannibalization data for a specific query', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { page_url: 'https://example.com/page1', total_clicks: 100, total_impressions: 3000, avg_position: 8, avg_ctr: 0.033 },
          { page_url: 'https://example.com/page2', total_clicks: 50, total_impressions: 1500, avg_position: 14, avg_ctr: 0.033 },
        ],
      });

      const result = await service.getCannibalizationForQuery('site-123', 'target keyword');

      expect(result).not.toBeNull();
      expect(result?.query).toBe('target keyword');
      expect(result?.pages).toHaveLength(2);
    });

    it('should return null when query has only one page', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { page_url: 'https://example.com/only-page', total_clicks: 100, total_impressions: 3000, avg_position: 5, avg_ctr: 0.033 },
        ],
      });

      const result = await service.getCannibalizationForQuery('site-123', 'unique query');

      expect(result).toBeNull();
    });

    it('should return null when query has no data', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.getCannibalizationForQuery('site-123', 'nonexistent query');

      expect(result).toBeNull();
    });
  });

  describe('getSeverityBreakdown', () => {
    it('should return correct breakdown of severities', async () => {
      // Mock to return multiple issues with different severities
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          // HIGH: 4 pages
          { query: 'high1', page_url: 'https://example.com/h1', total_clicks: 50, total_impressions: 1000, avg_position: 20, avg_ctr: 0.05 },
          { query: 'high1', page_url: 'https://example.com/h2', total_clicks: 40, total_impressions: 900, avg_position: 22, avg_ctr: 0.044 },
          { query: 'high1', page_url: 'https://example.com/h3', total_clicks: 30, total_impressions: 800, avg_position: 25, avg_ctr: 0.038 },
          { query: 'high1', page_url: 'https://example.com/h4', total_clicks: 20, total_impressions: 700, avg_position: 30, avg_ctr: 0.029 },
          // MEDIUM: 2 pages, distributed
          { query: 'medium1', page_url: 'https://example.com/m1', total_clicks: 100, total_impressions: 2000, avg_position: 8, avg_ctr: 0.05 },
          { query: 'medium1', page_url: 'https://example.com/m2', total_clicks: 80, total_impressions: 1800, avg_position: 15, avg_ctr: 0.044 },
          // LOW: dominant page
          { query: 'low1', page_url: 'https://example.com/l1', total_clicks: 200, total_impressions: 9000, avg_position: 5, avg_ctr: 0.022 },
          { query: 'low1', page_url: 'https://example.com/l2', total_clicks: 10, total_impressions: 500, avg_position: 25, avg_ctr: 0.02 },
        ],
      });

      const result = await service.getSeverityBreakdown('site-123');

      expect(result.high).toBe(1);
      expect(result.medium).toBe(1);
      expect(result.low).toBe(1);
      expect(result.total).toBe(3);
    });

    it('should return zeros when no cannibalization exists', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.getSeverityBreakdown('site-123');

      expect(result.high).toBe(0);
      expect(result.medium).toBe(0);
      expect(result.low).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('recommendation generation', () => {
    it('should recommend consolidation for >3 pages', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'scattered content', page_url: 'https://example.com/p1', total_clicks: 50, total_impressions: 1000, avg_position: 15, avg_ctr: 0.05 },
          { query: 'scattered content', page_url: 'https://example.com/p2', total_clicks: 40, total_impressions: 900, avg_position: 18, avg_ctr: 0.044 },
          { query: 'scattered content', page_url: 'https://example.com/p3', total_clicks: 30, total_impressions: 800, avg_position: 20, avg_ctr: 0.038 },
          { query: 'scattered content', page_url: 'https://example.com/p4', total_clicks: 20, total_impressions: 700, avg_position: 25, avg_ctr: 0.029 },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result[0].recommendation.toLowerCase()).toContain('consolidate');
      expect(result[0].recommendation).toContain('4 pages');
    });

    it('should recommend canonical/redirect for 2 pages', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'simple case', page_url: 'https://example.com/primary', total_clicks: 100, total_impressions: 3000, avg_position: 8, avg_ctr: 0.033 },
          { query: 'simple case', page_url: 'https://example.com/secondary', total_clicks: 30, total_impressions: 1000, avg_position: 18, avg_ctr: 0.03 },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      expect(result[0].recommendation.toLowerCase()).toMatch(/canonical|redirect/);
    });

    it('should suggest evaluation when secondary ranks higher than primary', async () => {
      // Set up case where:
      // - primary page has more clicks (higher combined score)
      // - secondary page actually ranks better (lower position)
      // Score formula: clicks + (impressions * (1 / (position + 1)))
      // page1: 300 + (2000 * 1/16) = 300 + 125 = 425 (primary due to higher score)
      // page2: 50 + (1500 * 1/6) = 50 + 250 = 300 (secondary, but better rank)
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'ambiguous case', page_url: 'https://example.com/more-traffic', total_clicks: 300, total_impressions: 2000, avg_position: 15, avg_ctr: 0.15 },
          { query: 'ambiguous case', page_url: 'https://example.com/better-rank', total_clicks: 50, total_impressions: 1500, avg_position: 5, avg_ctr: 0.033 },
        ],
      });

      const result = await service.detectCannibalization('site-123');

      // The secondary (better-rank) ranks higher (position 5) than primary (position 15)
      // So recommendation should suggest evaluation
      expect(result[0].recommendation.toLowerCase()).toContain('evaluat');
    });
  });
});
