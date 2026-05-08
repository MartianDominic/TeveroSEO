/**
 * Tests for PortfolioMetricsService
 * Phase 96-05: Cross-client portfolio aggregation
 *
 * TDD RED phase - tests for workspace-level metrics
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PortfolioMetricsService } from "./PortfolioMetricsService";

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  execute: vi.fn(),
};

describe("PortfolioMetricsService", () => {
  let service: PortfolioMetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PortfolioMetricsService(mockDb as any);
  });

  describe("getPortfolioSummary", () => {
    it("should aggregate all client metrics in workspace", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          totalClicks: 50000,
          totalImpressions: 1000000,
          avgPosition: 12.5,
          avgCtr: 0.05,
          clientCount: 5,
          totalQueries: 2500,
          totalPages: 150,
        }],
      });

      const summary = await service.getPortfolioSummary("workspace-123");

      expect(summary.totalClicks).toBe(50000);
      expect(summary.totalImpressions).toBe(1000000);
      expect(summary.avgPosition).toBe(12.5);
      expect(summary.clientCount).toBe(5);
    });

    it("should filter by date range when provided", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          totalClicks: 10000,
          totalImpressions: 200000,
          avgPosition: 10.0,
          avgCtr: 0.05,
          clientCount: 3,
          totalQueries: 500,
          totalPages: 50,
        }],
      });

      const summary = await service.getPortfolioSummary("workspace-123", {
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      });

      expect(summary.totalClicks).toBe(10000);
    });

    it("should return zero values for empty workspace", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          totalClicks: 0,
          totalImpressions: 0,
          avgPosition: 0,
          avgCtr: 0,
          clientCount: 0,
          totalQueries: 0,
          totalPages: 0,
        }],
      });

      const summary = await service.getPortfolioSummary("empty-workspace");

      expect(summary.totalClicks).toBe(0);
      expect(summary.clientCount).toBe(0);
    });

    it("should handle null aggregation results", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ totalClicks: null, totalImpressions: null }],
      });

      const summary = await service.getPortfolioSummary("workspace-123");

      expect(summary.totalClicks).toBe(0);
      expect(summary.totalImpressions).toBe(0);
    });
  });

  describe("getPortfolioTrends", () => {
    it("should return daily trend data", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { date: "2024-01-01", clicks: 1000, impressions: 20000, avgPosition: 10.5 },
          { date: "2024-01-02", clicks: 1100, impressions: 22000, avgPosition: 10.2 },
          { date: "2024-01-03", clicks: 1050, impressions: 21000, avgPosition: 10.3 },
        ],
      });

      const trends = await service.getPortfolioTrends("workspace-123", "day");

      expect(trends.length).toBe(3);
      expect(trends[0].date).toBe("2024-01-01");
      expect(trends[0].clicks).toBe(1000);
    });

    it("should return weekly trend data", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { date: "2024-W01", clicks: 7000, impressions: 140000, avgPosition: 10.5 },
          { date: "2024-W02", clicks: 7500, impressions: 150000, avgPosition: 10.2 },
        ],
      });

      const trends = await service.getPortfolioTrends("workspace-123", "week");

      expect(trends.length).toBe(2);
    });

    it("should return monthly trend data", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { date: "2024-01", clicks: 30000, impressions: 600000, avgPosition: 10.5 },
        ],
      });

      const trends = await service.getPortfolioTrends("workspace-123", "month");

      expect(trends.length).toBe(1);
    });

    it("should handle empty trends", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [],
      });

      const trends = await service.getPortfolioTrends("workspace-123", "day");

      expect(trends).toEqual([]);
    });
  });

  describe("getTopPerformingClients", () => {
    it("should return top clients sorted by clicks", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { clientId: "c1", clientName: "Client A", domain: "a.com", clicks: 10000, impressions: 200000, position: 8.5, changePercent: 15 },
          { clientId: "c2", clientName: "Client B", domain: "b.com", clicks: 8000, impressions: 160000, position: 9.2, changePercent: 10 },
          { clientId: "c3", clientName: "Client C", domain: "c.com", clicks: 6000, impressions: 120000, position: 10.1, changePercent: -5 },
        ],
      });

      const top = await service.getTopPerformingClients("workspace-123");

      expect(top.length).toBe(3);
      expect(top[0].clientName).toBe("Client A");
      expect(top[0].clicks).toBe(10000);
    });

    it("should respect limit parameter", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { clientId: "c1", clientName: "Client A", domain: "a.com", clicks: 10000, impressions: 200000, position: 8.5, changePercent: 15 },
          { clientId: "c2", clientName: "Client B", domain: "b.com", clicks: 8000, impressions: 160000, position: 9.2, changePercent: 10 },
        ],
      });

      const top = await service.getTopPerformingClients("workspace-123", 2);

      expect(top.length).toBe(2);
    });

    it("should return empty array for workspace with no clients", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [],
      });

      const top = await service.getTopPerformingClients("workspace-123");

      expect(top).toEqual([]);
    });
  });

  describe("getUnderperformingClients", () => {
    it("should return clients with declining metrics", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { clientId: "c1", clientName: "Client X", domain: "x.com", clicks: 1000, impressions: 20000, position: 15.5, changePercent: -25 },
          { clientId: "c2", clientName: "Client Y", domain: "y.com", clicks: 500, impressions: 10000, position: 18.2, changePercent: -15 },
        ],
      });

      const underperforming = await service.getUnderperformingClients("workspace-123");

      expect(underperforming.length).toBe(2);
      expect(underperforming[0].changePercent).toBeLessThan(0);
    });

    it("should sort by decline severity (most negative first)", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { clientId: "c1", clientName: "Client X", domain: "x.com", clicks: 1000, impressions: 20000, position: 15.5, changePercent: -25 },
          { clientId: "c2", clientName: "Client Y", domain: "y.com", clicks: 500, impressions: 10000, position: 18.2, changePercent: -15 },
        ],
      });

      const underperforming = await service.getUnderperformingClients("workspace-123");

      // Most negative first
      expect(underperforming[0].changePercent).toBeLessThan(underperforming[1].changePercent);
    });

    it("should handle workspace with no underperforming clients", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [],
      });

      const underperforming = await service.getUnderperformingClients("workspace-123");

      expect(underperforming).toEqual([]);
    });
  });

  describe("getClientComparison", () => {
    it("should return all clients with metrics for comparison", async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          { clientId: "c1", clientName: "Client A", domain: "a.com", clicks: 10000, impressions: 200000, position: 8.5, ctr: 0.05 },
          { clientId: "c2", clientName: "Client B", domain: "b.com", clicks: 5000, impressions: 100000, position: 12.0, ctr: 0.05 },
        ],
      });

      const comparison = await service.getClientComparison("workspace-123");

      expect(comparison.length).toBe(2);
      expect(comparison[0]).toHaveProperty("clientId");
      expect(comparison[0]).toHaveProperty("clicks");
      expect(comparison[0]).toHaveProperty("ctr");
    });
  });
});
