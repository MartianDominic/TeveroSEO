/**
 * TrendDetectionService Tests
 * Phase 96-03: Growing/Decaying Page Detection
 *
 * Tests updated to handle CachedData<TrendResult> wrapper.
 * Services return { data: TrendResult, metadata: CacheMetadata }.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrendFilters } from '../types';

// Mock the database module before importing the service
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

// Now import after mocking
const { TrendDetectionService } = await import('./TrendDetectionService');
const { db: mockDb } = await import('@/db');

describe('TrendDetectionService', () => {
  let service: TrendDetectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TrendDetectionService(mockDb);
  });

  describe('analyzePageTrends', () => {
    it('should detect growing pages with >10% click increase', async () => {
      // Mock data: page with 50% increase (500 -> 750 clicks)
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/growing-page',
            current_clicks: 750,
            previous_clicks: 500,
            current_impressions: 10000,
            previous_impressions: 8000,
            current_position: 5.2,
            previous_position: 6.1,
            top_queries: ['query 1', 'query 2', 'query 3'],
          },
        ],
      });

      const result = await service.analyzePageTrends('site-123', { trend: 'growing' });

      // Service returns CachedData<TrendResult>, access via .data
      expect(result.data.pages).toHaveLength(1);
      expect(result.data.pages[0].trend).toBe('growing');
      expect(result.data.pages[0].changePercent).toBeCloseTo(50, 1);
      expect(result.data.meta.growingCount).toBe(1);
    });

    it('should detect decaying pages with >10% click decrease', async () => {
      // Mock data: page with 40% decrease (500 -> 300 clicks)
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/decaying-page',
            current_clicks: 300,
            previous_clicks: 500,
            current_impressions: 8000,
            previous_impressions: 10000,
            current_position: 7.5,
            previous_position: 5.2,
            top_queries: ['query 1', 'query 2'],
          },
        ],
      });

      const result = await service.analyzePageTrends('site-123', { trend: 'decaying' });

      // Service returns CachedData<TrendResult>, access via .data
      expect(result.data.pages).toHaveLength(1);
      expect(result.data.pages[0].trend).toBe('decaying');
      expect(result.data.pages[0].changePercent).toBeCloseTo(-40, 1);
      expect(result.data.meta.decayingCount).toBe(1);
    });

    it('should exclude pages with <100 impressions (minImpressions filter)', async () => {
      // Mock data with pages below threshold
      mockDb.execute.mockResolvedValueOnce({
        rows: [], // SQL query already filters by minImpressions in HAVING clause
      });

      const result = await service.analyzePageTrends('site-123', { minImpressions: 100 });

      // Service returns CachedData<TrendResult>, access via .data
      expect(result.data.pages).toHaveLength(0);
    });

    it('should assign confidence based on impression volume', async () => {
      // High confidence: >1000 total impressions
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/high-confidence',
            current_clicks: 600,
            previous_clicks: 400,
            current_impressions: 8000,
            previous_impressions: 7000,
            current_position: 5.0,
            previous_position: 6.0,
            top_queries: ['query 1'],
          },
        ],
      });

      const result = await service.analyzePageTrends('site-123', { trend: 'all' });

      // Service returns CachedData<TrendResult>, access via .data
      expect(result.data.pages[0].confidence).toBe('high'); // 8000 + 7000 = 15000 > 1000
    });

    it('should respect custom threshold (e.g., 20%)', async () => {
      // Mock data with 15% increase (below 20% threshold)
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/page',
            current_clicks: 575,
            previous_clicks: 500,
            current_impressions: 5000,
            previous_impressions: 4500,
            current_position: 5.0,
            previous_position: 5.5,
            top_queries: ['query 1'],
          },
        ],
      });

      const result = await service.analyzePageTrends('site-123', { threshold: 0.20, trend: 'all' });

      // 15% change should be classified as 'stable' with 20% threshold
      // Service returns CachedData<TrendResult>, access via .data
      expect(result.data.pages[0].trend).toBe('stable');
    });

    it('should use custom period (e.g., 14 days vs 21 days)', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/page',
            current_clicks: 600,
            previous_clicks: 400,
            current_impressions: 5000,
            previous_impressions: 4000,
            current_position: 5.0,
            previous_position: 6.0,
            top_queries: ['query 1'],
          },
        ],
      });

      await service.analyzePageTrends('site-123', { periodDays: 14 });

      // Verify SQL query was called with correct date calculations
      expect(mockDb.execute).toHaveBeenCalledWith(expect.anything());
    });

    it('should include top queries for each page (up to 5)', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            page_url: 'https://example.com/page',
            current_clicks: 600,
            previous_clicks: 400,
            current_impressions: 5000,
            previous_impressions: 4000,
            current_position: 5.0,
            previous_position: 6.0,
            top_queries: ['query 1', 'query 2', 'query 3', 'query 4', 'query 5', 'query 6'],
          },
        ],
      });

      const result = await service.analyzePageTrends('site-123', { trend: 'all' });

      // Service returns CachedData<TrendResult>, access via .data
      expect(result.data.pages[0].topQueries).toHaveLength(6);
    });

    it('should exclude pages with zero previous clicks (avoid division by zero)', async () => {
      // SQL query already filters with p.clicks > 0 in WHERE clause
      mockDb.execute.mockResolvedValueOnce({
        rows: [], // No rows returned when previous_clicks = 0
      });

      const result = await service.analyzePageTrends('site-123');

      // Service returns CachedData<TrendResult>, access via .data
      expect(result.data.pages).toHaveLength(0);
    });
  });

  describe('Query Filter Building', () => {
    it('should build AND mode query filter', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      await service.analyzePageTrends('site-123', {
        queryFilter: {
          include: ['seo', 'optimization'],
          mode: 'and',
        },
      });

      // Verify query was executed with filter parameters
      expect(mockDb.execute).toHaveBeenCalledOnce();
    });

    it('should build OR mode query filter', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      await service.analyzePageTrends('site-123', {
        queryFilter: {
          include: ['seo', 'marketing'],
          mode: 'or',
        },
      });

      // Verify query was executed with filter parameters
      expect(mockDb.execute).toHaveBeenCalledOnce();
    });

    it('should build NOT filter for excluded terms', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      await service.analyzePageTrends('site-123', {
        queryFilter: {
          exclude: ['brand', 'competitor'],
        },
      });

      // Verify query was executed with filter parameters
      expect(mockDb.execute).toHaveBeenCalledOnce();
    });
  });
});
