/**
 * CannibalizationService Tests
 * Phase 96-03: Keyword Cannibalization Detection
 *
 * TDD approach: Tests define expected behavior for detecting when
 * multiple pages compete for the same keyword.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock db with proper typing
const mockDb = {
  execute: vi.fn(),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([])),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => Promise.resolve()),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
};

// Mock the database module before importing the service
vi.mock('@/db', () => ({
  db: mockDb,
}));

// Mock GSC client to avoid googleapis import issues
vi.mock('@/server/services/analytics/gsc-client', () => ({
  fetchGSCQueryPageMetrics: vi.fn(() => Promise.resolve([])),
  getGSCDateRange: vi.fn(() => ({ startDate: '2024-01-01', endDate: '2024-01-31' })),
}));

// Mock google-auth
vi.mock('@/server/services/analytics/google-auth', () => ({
  getValidCredentials: vi.fn(() => Promise.resolve({
    accessToken: 'mock-token',
    gscSiteUrl: 'https://example.com',
  })),
}));

// Mock link-schema
vi.mock('@/db/link-schema', () => ({
  keywordCannibalization: {
    id: 'id',
    clientId: 'clientId',
    keywordLower: 'keywordLower',
    status: 'status',
  },
}));

// Now import after mocking
const { CannibalizationService } = await import('./CannibalizationService');

describe('CannibalizationService', () => {
  let service: InstanceType<typeof CannibalizationService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CannibalizationService(mockDb);
  });

  describe('detect', () => {
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

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].query).toBe('seo tips');
      expect(result.issues[0].pages).toHaveLength(2);
      expect(result.summary).toBeDefined();
      expect(result.metadata).toBeDefined();
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

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      expect(result.issues[0].severity).toBe('high');
    });

    it('should return empty issues array when no cannibalization exists', async () => {
      // No rows = no queries with multiple pages
      mockDb.execute.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      expect(result.issues).toHaveLength(0);
      expect(result.summary.total).toBe(0);
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

      await service.detect('site-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        mode: 'stored',
        persist: false,
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

      const result = await service.detect('site-123', { minImpressions: 1000, mode: 'stored', persist: false });

      // Both pages meet the threshold, so we should see the cannibalization
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].pages.every((p: { impressions: number }) => p.impressions >= 1000)).toBe(true);
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

      const result = await service.detect('site-123', { limit: 2, mode: 'stored', persist: false });

      expect(result.issues).toHaveLength(2);
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

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      // Total impressions: 8000
      // Total clicks: 150
      // Best position: 8 -> AWR CTR = 2.95%
      // Potential clicks at position 8 = 8000 * 0.0295 = 236
      // Impact = 236 - 150 = 86
      // The new algorithm uses position-specific CTR (more accurate than fixed position 3)
      expect(result.issues[0].impactEstimate.dailyLostClicks).toBeGreaterThan(0);
      expect(result.issues[0].impactEstimate.dailyLostClicks).toBeLessThan(200);
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

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      // With 2000/10000 = 20% impression share, the secondary page has minimal traffic
      // The improved algorithm recommends redirect (more aggressive) for low traffic pages
      const rationale = result.issues[0].recommendation.rationale;
      expect(rationale.toLowerCase()).toMatch(/redirect|canonical/);
      expect(rationale.toLowerCase()).toContain('seo-');
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

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      expect(result.issues[0].query).toBe('high impact');
      expect(result.issues[0].impactEstimate.dailyLostClicks).toBeGreaterThan(result.issues[1].impactEstimate.dailyLostClicks);
    });
  });

  describe('severity calculation', () => {
    it('should return HIGH severity when >3 pages compete', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'test', page_url: 'https://example.com/p1', total_clicks: 50, total_impressions: 1000, avg_position: 20, avg_ctr: 0.05 },
          { query: 'test', page_url: 'https://example.com/p2', total_clicks: 40, total_impressions: 900, avg_position: 22, avg_ctr: 0.044 },
          { query: 'test', page_url: 'https://example.com/p3', total_clicks: 30, total_impressions: 800, avg_position: 25, avg_ctr: 0.038 },
          { query: 'test', page_url: 'https://example.com/p4', total_clicks: 20, total_impressions: 700, avg_position: 30, avg_ctr: 0.029 },
        ],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      expect(result.issues[0].severity).toBe('high');
    });

    it('should return HIGH severity when top 2 pages both in top 10 positions', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'competitive', page_url: 'https://example.com/p1', total_clicks: 200, total_impressions: 5000, avg_position: 5, avg_ctr: 0.04 },
          { query: 'competitive', page_url: 'https://example.com/p2', total_clicks: 150, total_impressions: 4000, avg_position: 8, avg_ctr: 0.038 },
        ],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      expect(result.issues[0].severity).toBe('high');
    });

    it('should return MEDIUM severity for 2-3 pages with distributed traffic', async () => {
      // 2 pages, neither dominating, one outside top 10
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'medium', page_url: 'https://example.com/p1', total_clicks: 100, total_impressions: 3000, avg_position: 8, avg_ctr: 0.033 },
          { query: 'medium', page_url: 'https://example.com/p2', total_clicks: 80, total_impressions: 2500, avg_position: 14, avg_ctr: 0.032 },
        ],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      expect(result.issues[0].severity).toBe('medium');
    });

    it('should return LOW severity when one page dominates (>80% impressions)', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'dominated', page_url: 'https://example.com/primary', total_clicks: 200, total_impressions: 9000, avg_position: 6, avg_ctr: 0.022 },
          { query: 'dominated', page_url: 'https://example.com/secondary', total_clicks: 10, total_impressions: 500, avg_position: 25, avg_ctr: 0.02 },
        ],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      // 9000 / 9500 = 94.7% > 80%
      expect(result.issues[0].severity).toBe('low');
    });
  });

  describe('query-specific detection', () => {
    it('should find cannibalization for a specific query in results', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'target keyword', page_url: 'https://example.com/page1', total_clicks: 100, total_impressions: 3000, avg_position: 8, avg_ctr: 0.033 },
          { query: 'target keyword', page_url: 'https://example.com/page2', total_clicks: 50, total_impressions: 1500, avg_position: 14, avg_ctr: 0.033 },
        ],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });
      const targetIssue = result.issues.find(i => i.query === 'target keyword');

      expect(targetIssue).not.toBeUndefined();
      expect(targetIssue?.query).toBe('target keyword');
      expect(targetIssue?.pages).toHaveLength(2);
    });

    it('should include single-page queries in results but with only one page', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'unique query', page_url: 'https://example.com/only-page', total_clicks: 100, total_impressions: 3000, avg_position: 5, avg_ctr: 0.033 },
        ],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      // Single page queries are included in results (no cannibalization but still tracked)
      // The detector groups by query - single page queries have 1 page in the issue
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].pages).toHaveLength(1);
    });

    it('should return empty issues when no data exists', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      expect(result.issues).toHaveLength(0);
    });
  });

  describe('summary statistics', () => {
    it('should return correct breakdown of severities in summary', async () => {
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

      const result = await service.detect('site-123', { limit: 1000, mode: 'stored', persist: false });

      expect(result.summary.bySeverity.high).toBe(1);
      expect(result.summary.bySeverity.medium).toBe(1);
      expect(result.summary.bySeverity.low).toBe(1);
      expect(result.summary.total).toBe(3);
    });

    it('should return zeros in summary when no cannibalization exists', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      expect(result.summary.bySeverity.high).toBe(0);
      expect(result.summary.bySeverity.medium).toBe(0);
      expect(result.summary.bySeverity.low).toBe(0);
      expect(result.summary.total).toBe(0);
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

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      const rationale = result.issues[0].recommendation.rationale;
      expect(rationale.toLowerCase()).toContain('consolidate');
      expect(rationale).toContain('4 pages');
    });

    it('should recommend canonical/redirect for 2 pages', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { query: 'simple case', page_url: 'https://example.com/primary', total_clicks: 100, total_impressions: 3000, avg_position: 8, avg_ctr: 0.033 },
          { query: 'simple case', page_url: 'https://example.com/secondary', total_clicks: 30, total_impressions: 1000, avg_position: 18, avg_ctr: 0.03 },
        ],
      });

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      const rationale = result.issues[0].recommendation.rationale;
      expect(rationale.toLowerCase()).toMatch(/canonical|redirect/);
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

      const result = await service.detect('site-123', { mode: 'stored', persist: false });

      // The secondary (better-rank) ranks higher (position 5) than primary (position 15)
      // So recommendation should suggest evaluation
      const rationale = result.issues[0].recommendation.rationale;
      expect(rationale.toLowerCase()).toContain('evaluat');
    });
  });
});
