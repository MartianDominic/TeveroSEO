/**
 * StrikingDistanceService Tests
 * Phase 96-03: Quick Win Opportunity Detection
 *
 * Tests updated to handle CachedData<StrikingDistanceResult> wrapper.
 * Services return { data: StrikingDistanceResult, metadata: CacheMetadata }.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StrikingDistanceFilters } from '../types';

// Mock the database module before importing the service
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

// Now import after mocking
const { StrikingDistanceService } = await import('./StrikingDistanceService');
const { db: mockDb } = await import('@/db');

describe('StrikingDistanceService', () => {
  let service: StrikingDistanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StrikingDistanceService(mockDb);
  });

  describe('getStrikingDistancePages', () => {
    it('should return only pages with avg position 11-20', async () => {
      // Mock data: pages in striking distance (positions 11-20)
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/page-1',
            avg_position: 11.5,
            total_impressions: 5000,
            total_clicks: 100,
            top_queries: [
              { query: 'seo tips', position: 11, impressions: 2000, clicks: 40 },
              { query: 'seo guide', position: 12, impressions: 1500, clicks: 30 },
            ],
          },
          {
            page_url: 'https://example.com/page-2',
            avg_position: 18.2,
            total_impressions: 3000,
            total_clicks: 30,
            top_queries: [
              { query: 'marketing tips', position: 18, impressions: 1500, clicks: 15 },
            ],
          },
        ],
      });

      const result = await service.getStrikingDistancePages('site-123');

      // Service returns CachedData<StrikingDistanceResult>, access via .data
      expect(result.data.pages).toHaveLength(2);
      expect(result.data.pages[0].avgPosition).toBeGreaterThanOrEqual(11);
      expect(result.data.pages[0].avgPosition).toBeLessThanOrEqual(20);
    });

    it('should calculate potentialClicks as impressions * CTR_at_position_3', async () => {
      // CTR at position 3 = 11.01% (0.1101)
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/page',
            avg_position: 15.0,
            total_impressions: 10000,
            total_clicks: 150,
            top_queries: [],
          },
        ],
      });

      const result = await service.getStrikingDistancePages('site-123');

      // Expected: 10000 * 0.1101 = 1101 clicks
      // Service returns CachedData<StrikingDistanceResult>, access via .data
      expect(result.data.pages[0].potentialClicks).toBeCloseTo(1101, 0);
    });

    it('should calculate clickGain as potentialClicks - currentClicks', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/page',
            avg_position: 15.0,
            total_impressions: 10000,
            total_clicks: 150,
            top_queries: [],
          },
        ],
      });

      const result = await service.getStrikingDistancePages('site-123');

      // Expected: 1101 - 150 = 951 clicks gain
      // Service returns CachedData<StrikingDistanceResult>, access via .data
      expect(result.data.pages[0].clickGain).toBeCloseTo(951, 0);
    });

    it('should assign difficulty based on position (easy: 11-13, medium: 14-17, hard: 18-20)', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/easy',
            avg_position: 12.0,
            total_impressions: 1000,
            total_clicks: 20,
            top_queries: [],
          },
          {
            page_url: 'https://example.com/medium',
            avg_position: 15.0,
            total_impressions: 1000,
            total_clicks: 15,
            top_queries: [],
          },
          {
            page_url: 'https://example.com/hard',
            avg_position: 19.0,
            total_impressions: 1000,
            total_clicks: 10,
            top_queries: [],
          },
        ],
      });

      const result = await service.getStrikingDistancePages('site-123');

      // Service returns CachedData<StrikingDistanceResult>, access via .data
      expect(result.data.pages[0].difficulty).toBe('easy');
      expect(result.data.pages[1].difficulty).toBe('medium');
      expect(result.data.pages[2].difficulty).toBe('hard');
    });

    it('should sort pages by clickGain descending (biggest opportunity first)', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/page-1',
            avg_position: 15.0,
            total_impressions: 10000, // High gain
            total_clicks: 100,
            top_queries: [],
          },
          {
            page_url: 'https://example.com/page-2',
            avg_position: 12.0,
            total_impressions: 2000, // Low gain
            total_clicks: 50,
            top_queries: [],
          },
        ],
      });

      const result = await service.getStrikingDistancePages('site-123');

      // SQL already sorts by clickGain DESC, so verify order is preserved
      // Service returns CachedData<StrikingDistanceResult>, access via .data
      expect(result.data.pages[0].clickGain).toBeGreaterThan(result.data.pages[1].clickGain);
    });

    it('should filter pages with minimum impressions (>50)', async () => {
      // SQL query already filters by minImpressions in HAVING clause
      mockDb.execute.mockResolvedValueOnce({
        rows: [], // No rows with impressions < 50
      });

      const result = await service.getStrikingDistancePages('site-123', { minImpressions: 50 });

      // Service returns CachedData<StrikingDistanceResult>, access via .data
      expect(result.data.pages).toHaveLength(0);
    });

    it('should aggregate multiple queries per page correctly', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/page',
            avg_position: 15.0,
            total_impressions: 5000,
            total_clicks: 100,
            top_queries: [
              { query: 'query 1', position: 14, impressions: 2000, clicks: 50 },
              { query: 'query 2', position: 16, impressions: 1500, clicks: 30 },
              { query: 'query 3', position: 15, impressions: 1000, clicks: 20 },
            ],
          },
        ],
      });

      const result = await service.getStrikingDistancePages('site-123');

      // Service returns CachedData<StrikingDistanceResult>, access via .data
      expect(result.data.pages[0].topQueries).toHaveLength(3);
      expect(result.data.pages[0].topQueries[0].query).toBe('query 1');
    });
  });

  describe('Metadata', () => {
    it('should calculate totalPotentialClicks across all pages', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/page-1',
            avg_position: 15.0,
            total_impressions: 10000,
            total_clicks: 100,
            top_queries: [],
          },
          {
            page_url: 'https://example.com/page-2',
            avg_position: 12.0,
            total_impressions: 5000,
            total_clicks: 50,
            top_queries: [],
          },
        ],
      });

      const result = await service.getStrikingDistancePages('site-123');

      // Expected: (10000 * 0.1101) + (5000 * 0.1101) = 1651.5
      // Service returns CachedData<StrikingDistanceResult>, access via .data
      expect(result.data.meta.totalPotentialClicks).toBeGreaterThan(1500);
    });

    it('should calculate avgDifficulty (1=easy, 2=medium, 3=hard)', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/easy',
            avg_position: 12.0,
            total_impressions: 1000,
            total_clicks: 20,
            top_queries: [],
          },
          {
            page_url: 'https://example.com/hard',
            avg_position: 19.0,
            total_impressions: 1000,
            total_clicks: 10,
            top_queries: [],
          },
        ],
      });

      const result = await service.getStrikingDistancePages('site-123');

      // Expected: (1 + 3) / 2 = 2.0
      // Service returns CachedData<StrikingDistanceResult>, access via .data
      expect(result.data.meta.avgDifficulty).toBeCloseTo(2.0, 1);
    });
  });
});
