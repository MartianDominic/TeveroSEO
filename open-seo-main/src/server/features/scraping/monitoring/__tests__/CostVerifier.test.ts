import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostVerifier } from '../CostVerifier';
import type { Pool } from 'pg';

describe('CostVerifier', () => {
  let costVerifier: CostVerifier;
  let mockCostTracker: any;
  let mockDfsClient: any;
  let mockWebshareClient: any;
  let mockGeonodeClient: any;
  let mockPg: Pool;
  let mockAlertManager: any;

  beforeEach(() => {
    mockCostTracker = {
      getReport: vi.fn(),
    };

    mockDfsClient = {
      getUsage: vi.fn(),
    };

    mockWebshareClient = {
      getUsage: vi.fn(),
    };

    mockGeonodeClient = {
      getUsage: vi.fn(),
    };

    mockPg = {
      query: vi.fn(),
    } as any;

    mockAlertManager = {
      fire: vi.fn(),
    };

    costVerifier = new CostVerifier({
      costTracker: mockCostTracker,
      dfsClient: mockDfsClient,
      webshareClient: mockWebshareClient,
      geonodeClient: mockGeonodeClient,
      pg: mockPg,
      alertManager: mockAlertManager,
    });
  });

  describe('generateReport', () => {
    it('should generate accurate cost report', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');

      mockCostTracker.getReport.mockResolvedValue({
        totalCost: 13.9,
        totalRequests: 5000,
        costByTier: { direct: 2.0, webshare: 3.5, dfs_basic: 8.4 },
        costByConsumer: { 'site-audit': 10.0, 'prospect-analysis': 3.9 },
      });

      mockDfsClient.getUsage.mockResolvedValue({ cost: 10.5 });
      mockWebshareClient.getUsage.mockResolvedValue({ cost: 2.25 });
      mockGeonodeClient.getUsage.mockResolvedValue({ cost: 1.15 });

      const report = await costVerifier.generateReport(start, end);

      expect(report.period.start).toEqual(start);
      expect(report.period.end).toEqual(end);
      expect(report.tracked.totalCost).toBe(13.9);
      expect(report.actual.dataForSeo).toBe(10.5);
      expect(report.actual.webshare).toBe(2.25);
      expect(report.actual.geonode).toBe(1.15);
    });

    it('should calculate discrepancy correctly', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');

      mockCostTracker.getReport.mockResolvedValue({
        totalCost: 100.0,
        totalRequests: 5000,
        costByTier: {},
        costByConsumer: {},
      });

      mockDfsClient.getUsage.mockResolvedValue({ cost: 95.0 });
      mockWebshareClient.getUsage.mockResolvedValue({ cost: 0 });
      mockGeonodeClient.getUsage.mockResolvedValue({ cost: 0 });

      const report = await costVerifier.generateReport(start, end);

      expect(report.discrepancy.absolute).toBe(5.0);
      expect(report.discrepancy.percentage).toBe(5.0);
      expect(report.discrepancy.withinTolerance).toBe(true);
    });

    it('should calculate savings vs legacy', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');

      mockCostTracker.getReport.mockResolvedValue({
        totalCost: 2.0,
        totalRequests: 5000,
        costByTier: {},
        costByConsumer: {},
      });

      mockDfsClient.getUsage.mockResolvedValue({ cost: 2.0 });
      mockWebshareClient.getUsage.mockResolvedValue({ cost: 0 });
      mockGeonodeClient.getUsage.mockResolvedValue({ cost: 0 });

      const report = await costVerifier.generateReport(start, end);

      // Legacy: 5000 * $0.02 = $100
      // Current: $2
      // Savings: $98 (98%)
      expect(report.savings.vsLegacy).toBe(98);
      expect(report.savings.percentage).toBe(98);
    });

    it('should mark high discrepancy as out of tolerance', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');

      mockCostTracker.getReport.mockResolvedValue({
        totalCost: 100.0,
        totalRequests: 5000,
        costByTier: {},
        costByConsumer: {},
      });

      mockDfsClient.getUsage.mockResolvedValue({ cost: 150.0 });
      mockWebshareClient.getUsage.mockResolvedValue({ cost: 0 });
      mockGeonodeClient.getUsage.mockResolvedValue({ cost: 0 });

      const report = await costVerifier.generateReport(start, end);

      expect(report.discrepancy.percentage).toBe(50);
      expect(report.discrepancy.withinTolerance).toBe(false);
    });

    it('should handle provider API failures gracefully', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');

      mockCostTracker.getReport.mockResolvedValue({
        totalCost: 10.0,
        totalRequests: 500,
        costByTier: {},
        costByConsumer: {},
      });

      mockDfsClient.getUsage.mockRejectedValue(new Error('API error'));
      mockWebshareClient.getUsage.mockResolvedValue({ cost: 5.0 });
      mockGeonodeClient.getUsage.mockResolvedValue({ cost: 5.0 });

      const report = await costVerifier.generateReport(start, end);

      expect(report.actual.dataForSeo).toBe(0);
      expect(report.actual.webshare).toBe(5.0);
      expect(report.actual.geonode).toBe(5.0);
    });
  });

  describe('verifyDailyReports', () => {
    it('should fire alert on high discrepancy', async () => {
      mockCostTracker.getReport.mockResolvedValue({
        totalCost: 100.0,
        totalRequests: 5000,
        costByTier: {},
        costByConsumer: {},
      });

      mockDfsClient.getUsage.mockResolvedValue({ cost: 150.0 });
      mockWebshareClient.getUsage.mockResolvedValue({ cost: 0 });
      mockGeonodeClient.getUsage.mockResolvedValue({ cost: 0 });

      (mockPg.query as any).mockResolvedValue({ rowCount: 1 });

      await costVerifier.verifyDailyReports();

      expect(mockAlertManager.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cost-tracking-discrepancy',
          severity: 'warning',
          message: expect.stringContaining('50.0%'),
        })
      );
    });

    it('should not fire alert when discrepancy within tolerance', async () => {
      mockCostTracker.getReport.mockResolvedValue({
        totalCost: 100.0,
        totalRequests: 5000,
        costByTier: {},
        costByConsumer: {},
      });

      mockDfsClient.getUsage.mockResolvedValue({ cost: 98.0 });
      mockWebshareClient.getUsage.mockResolvedValue({ cost: 0 });
      mockGeonodeClient.getUsage.mockResolvedValue({ cost: 0 });

      (mockPg.query as any).mockResolvedValue({ rowCount: 1 });

      await costVerifier.verifyDailyReports();

      expect(mockAlertManager.fire).not.toHaveBeenCalled();
    });

    it('should store report in database', async () => {
      mockCostTracker.getReport.mockResolvedValue({
        totalCost: 10.0,
        totalRequests: 500,
        costByTier: {},
        costByConsumer: {},
      });

      mockDfsClient.getUsage.mockResolvedValue({ cost: 10.0 });
      mockWebshareClient.getUsage.mockResolvedValue({ cost: 0 });
      mockGeonodeClient.getUsage.mockResolvedValue({ cost: 0 });

      (mockPg.query as any).mockResolvedValue({ rowCount: 1 });

      await costVerifier.verifyDailyReports();

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cost_verification_reports'),
        expect.arrayContaining([
          expect.any(Date),
          10.0,
          10.0,
          0,
          expect.any(Number),
          expect.any(String),
        ])
      );
    });

    it('should handle verification errors gracefully', async () => {
      mockCostTracker.getReport.mockRejectedValue(new Error('Tracker error'));

      await expect(costVerifier.verifyDailyReports()).resolves.not.toThrow();
    });
  });

  describe('getHistoricalReports', () => {
    it('should retrieve historical reports', async () => {
      const mockReports = [
        { report_data: { period: { start: new Date() }, savings: { percentage: 95 } } },
        { report_data: { period: { start: new Date() }, savings: { percentage: 97 } } },
      ];

      (mockPg.query as any).mockResolvedValue({ rows: mockReports });

      const reports = await costVerifier.getHistoricalReports(30);

      expect(reports).toHaveLength(2);
      expect(reports[0].savings.percentage).toBe(95);
      expect(reports[1].savings.percentage).toBe(97);
    });

    it('should use correct date range', async () => {
      (mockPg.query as any).mockResolvedValue({ rows: [] });

      await costVerifier.getHistoricalReports(30);

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE date >= $1'),
        [expect.any(Date)]
      );
    });
  });
});
