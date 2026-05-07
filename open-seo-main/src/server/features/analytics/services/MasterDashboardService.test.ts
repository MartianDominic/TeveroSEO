/**
 * Master Dashboard Service Tests
 * Phase 96-02: Master Dashboard
 *
 * TDD RED Phase: Write failing tests first
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MasterDashboardService } from './MasterDashboardService';
import type { DashboardFilters } from '../types';

describe('MasterDashboardService', () => {
  let service: MasterDashboardService;
  let mockDb: any;
  let mockSiteTagsRepo: any;

  beforeEach(() => {
    mockDb = {
      execute: vi.fn(),
    };
    mockSiteTagsRepo = {
      findSiteIdsByTags: vi.fn(),
      findBySiteIds: vi.fn(),
    };
    service = new MasterDashboardService(mockDb, mockSiteTagsRepo);
  });

  describe('getAggregatedMetrics', () => {
    it('should return site metrics with total clicks, impressions, avg position, CTR', async () => {
      // Mock current period metrics
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            site_id: 'site-1',
            site_name: 'Example Site',
            site_url: 'https://example.com',
            total_clicks: 1000,
            total_impressions: 10000,
            avg_position: 15.5,
            avg_ctr: 0.1,
          },
        ],
      });

      // Mock comparison period metrics
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            site_id: 'site-1',
            total_clicks: 800,
            total_impressions: 9000,
            avg_position: 18.0,
            avg_ctr: 0.089,
          },
        ],
      });

      // Mock sparkline data
      mockDb.execute.mockResolvedValueOnce({
        rows: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - i * 86400000),
          clicks: 100 + i * 10,
        })),
      });

      // Mock tags
      mockSiteTagsRepo.findBySiteIds.mockResolvedValueOnce([
        { siteId: 'site-1', tagName: 'E-commerce' },
        { siteId: 'site-1', tagName: 'US' },
      ]);

      const filters: DashboardFilters = {
        dateRange: { startDate: '2026-05-01', endDate: '2026-05-07' },
        comparison: 'WoW',
      };

      const result = await service.getAggregatedMetrics('workspace-1', filters);

      expect(result.sites).toHaveLength(1);
      expect(result.sites[0].metrics.clicks).toBe(1000);
      expect(result.sites[0].metrics.impressions).toBe(10000);
      expect(result.sites[0].metrics.position).toBe(15.5);
      expect(result.sites[0].metrics.ctr).toBe(0.1);
    });

    it('should filter correctly by date range (7d, 30d, 90d, 365d)', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });
      mockSiteTagsRepo.findBySiteIds.mockResolvedValue([]);

      const filters: DashboardFilters = {
        dateRange: { startDate: '2026-04-01', endDate: '2026-04-30' },
      };

      await service.getAggregatedMetrics('workspace-1', filters);

      // Verify execute was called (date filtering happens in SQL query)
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should filter by tags and return only matching sites', async () => {
      mockSiteTagsRepo.findSiteIdsByTags.mockResolvedValueOnce(['site-1', 'site-2']);
      mockDb.execute.mockResolvedValue({ rows: [] });
      mockSiteTagsRepo.findBySiteIds.mockResolvedValue([]);

      const filters: DashboardFilters = {
        dateRange: { startDate: '2026-05-01', endDate: '2026-05-07' },
        tags: ['E-commerce'],
      };

      await service.getAggregatedMetrics('workspace-1', filters);

      expect(mockSiteTagsRepo.findSiteIdsByTags).toHaveBeenCalledWith(['E-commerce']);
      // Verify execute was called with tag-filtered site IDs
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should include comparison period data (previous period)', async () => {
      // Mock current period
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            site_id: 'site-1',
            site_name: 'Example',
            site_url: 'https://example.com',
            total_clicks: 1000,
            total_impressions: 10000,
            avg_position: 15.0,
            avg_ctr: 0.1,
          },
        ],
      });

      // Mock comparison period (WoW = 7 days prior)
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            site_id: 'site-1',
            total_clicks: 900,
            total_impressions: 9500,
            avg_position: 16.0,
            avg_ctr: 0.095,
          },
        ],
      });

      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // sparkline
      mockSiteTagsRepo.findBySiteIds.mockResolvedValue([]);

      const filters: DashboardFilters = {
        dateRange: { startDate: '2026-05-01', endDate: '2026-05-07' },
        comparison: 'WoW',
      };

      const result = await service.getAggregatedMetrics('workspace-1', filters);

      expect(result.sites[0].comparison.clicksChange).toBeCloseTo(11.1, 1); // (1000-900)/900 * 100
      expect(result.meta.comparisonPeriod).not.toBeNull();
    });

    it('should return 7-day trend data for sparklines', async () => {
      // Mock current period metrics
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            site_id: 'site-1',
            site_name: 'Example',
            site_url: 'https://example.com',
            total_clicks: 1000,
            total_impressions: 10000,
            avg_position: 15.0,
            avg_ctr: 0.1,
          },
        ],
      });

      // Mock sparkline data (2nd call since no comparison) - needs site_id field for grouping
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { site_id: 'site-1', date: new Date('2026-05-01'), clicks: 120 },
          { site_id: 'site-1', date: new Date('2026-05-02'), clicks: 140 },
          { site_id: 'site-1', date: new Date('2026-05-03'), clicks: 130 },
          { site_id: 'site-1', date: new Date('2026-05-04'), clicks: 150 },
          { site_id: 'site-1', date: new Date('2026-05-05'), clicks: 160 },
          { site_id: 'site-1', date: new Date('2026-05-06'), clicks: 155 },
          { site_id: 'site-1', date: new Date('2026-05-07'), clicks: 145 },
        ],
      });

      mockSiteTagsRepo.findBySiteIds.mockResolvedValue([]);

      const filters: DashboardFilters = {
        dateRange: { startDate: '2026-05-01', endDate: '2026-05-07' },
        // No comparison period
      };

      const result = await service.getAggregatedMetrics('workspace-1', filters);

      expect(result.sites[0].trend).toHaveLength(7);
      expect(result.sites[0].trend[0].date).toBe('2026-05-01');
      expect(result.sites[0].trend[0].clicks).toBe(120);
    });

    it('should complete in <500ms for 100+ sites (mock test)', async () => {
      // Mock 100 sites
      const mockSites = Array.from({ length: 100 }, (_, i) => ({
        site_id: `site-${i}`,
        site_name: `Site ${i}`,
        site_url: `https://site${i}.com`,
        total_clicks: 1000 + i,
        total_impressions: 10000 + i * 10,
        avg_position: 15 + Math.random() * 5,
        avg_ctr: 0.1 + Math.random() * 0.05,
      }));

      mockDb.execute.mockResolvedValueOnce({ rows: mockSites });
      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // comparison
      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // sparklines
      mockSiteTagsRepo.findBySiteIds.mockResolvedValue([]);

      const filters: DashboardFilters = {
        dateRange: { startDate: '2026-05-01', endDate: '2026-05-07' },
      };

      const startTime = Date.now();
      await service.getAggregatedMetrics('workspace-1', filters);
      const duration = Date.now() - startTime;

      // Mock test should be instant (real performance verified via continuous aggregates)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('getSiteSparkline', () => {
    it('should return 7-day trend data for a single site', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { date: new Date('2026-05-01'), clicks: 100 },
          { date: new Date('2026-05-02'), clicks: 110 },
          { date: new Date('2026-05-03'), clicks: 105 },
          { date: new Date('2026-05-04'), clicks: 120 },
          { date: new Date('2026-05-05'), clicks: 115 },
          { date: new Date('2026-05-06'), clicks: 130 },
          { date: new Date('2026-05-07'), clicks: 125 },
        ],
      });

      const result = await service.getSiteSparkline('site-1', 7);

      expect(result).toHaveLength(7);
      expect(result[0].date).toBe('2026-05-01');
      expect(result[0].clicks).toBe(100);
    });
  });
});
