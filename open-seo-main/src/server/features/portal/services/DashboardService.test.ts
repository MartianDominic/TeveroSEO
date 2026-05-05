/**
 * DashboardService tests - GSC data aggregation for client portal.
 * Phase 90-01: Trust Foundation
 *
 * Tests dashboard metrics, recent wins, and needs attention keywords.
 * All data sourced from verified GSC snapshots only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DashboardService } from "./DashboardService";
import type { SeoGscDailySnapshotSelect, SeoGscQuerySnapshotSelect } from "@/db";

// Track mock call responses for sequential db.select() calls
let mockCallResponses: unknown[] = [];
let mockCallIndex = 0;

// Create chainable mock that returns next response in sequence
function createChainableMock() {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      const response = mockCallResponses[mockCallIndex] ?? [];
      mockCallIndex++;
      return Promise.resolve(response);
    }),
  };
}

// Mock the database module
vi.mock("@/db", () => {
  const chainMock = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      const response = mockCallResponses[mockCallIndex] ?? [];
      mockCallIndex++;
      return Promise.resolve(response);
    }),
  };

  return {
    db: {
      select: vi.fn().mockReturnValue(chainMock),
    },
    seoGscDailySnapshots: {
      clientId: Symbol("clientId"),
      date: Symbol("date"),
      isDeleted: Symbol("isDeleted"),
      position: Symbol("position"),
    },
    seoGscQuerySnapshots: {
      clientId: Symbol("clientId"),
      date: Symbol("date"),
      query: Symbol("query"),
      position: Symbol("position"),
    },
  };
});

// Import mocked module after vi.mock
import { db } from "@/db";

// Helper to set mock responses for sequential db.select() calls
function setMockResponses(...responses: unknown[]) {
  mockCallResponses = responses;
  mockCallIndex = 0;
}

describe("DashboardService", () => {
  const testClientId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallResponses = [];
    mockCallIndex = 0;
    // Mock Date.now to return a fixed date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getDashboardMetrics", () => {
    it("returns aggregated clicks, impressions, position for last 30 days", async () => {
      // Mock GSC daily snapshots for current period (last 30 days)
      const currentPeriodData: Partial<SeoGscDailySnapshotSelect>[] = [
        { date: "2026-04-10", clicks: 100, impressions: 1000, position: 8.5 },
        { date: "2026-04-15", clicks: 150, impressions: 1500, position: 7.2 },
        { date: "2026-04-20", clicks: 200, impressions: 2000, position: 6.8 },
      ];

      // Mock previous period data (30-60 days ago)
      const previousPeriodData: Partial<SeoGscDailySnapshotSelect>[] = [
        { date: "2026-03-10", clicks: 80, impressions: 900, position: 10.5 },
        { date: "2026-03-15", clicks: 100, impressions: 1200, position: 9.8 },
        { date: "2026-03-20", clicks: 120, impressions: 1400, position: 9.2 },
      ];

      // Mock top 10 count query result
      const top10CountResult = [{ count: 15 }];

      // Set responses for: 1) current period, 2) previous period, 3) top 10 count
      setMockResponses(currentPeriodData, previousPeriodData, top10CountResult);

      const result = await DashboardService.getDashboardMetrics(testClientId);

      // Total clicks: 100 + 150 + 200 = 450
      expect(result.clicks).toBe(450);
      // Total impressions: 1000 + 1500 + 2000 = 4500
      expect(result.impressions).toBe(4500);
      // Average position: (8.5 + 7.2 + 6.8) / 3 = 7.5
      expect(result.avgPosition).toBeCloseTo(7.5, 1);
      // CTR: clicks / impressions * 100 = 10%
      expect(result.ctr).toBeCloseTo(10, 1);
    });

    it("calculates delta vs previous period (30-60 days ago)", async () => {
      // Current period: 450 clicks
      const currentPeriodData: Partial<SeoGscDailySnapshotSelect>[] = [
        { date: "2026-04-10", clicks: 150, impressions: 1500, position: 7.0 },
        { date: "2026-04-20", clicks: 300, impressions: 3000, position: 6.0 },
      ];

      // Previous period: 300 clicks (50% lower)
      const previousPeriodData: Partial<SeoGscDailySnapshotSelect>[] = [
        { date: "2026-03-10", clicks: 100, impressions: 1000, position: 10.0 },
        { date: "2026-03-20", clicks: 200, impressions: 2000, position: 9.0 },
      ];

      // Mock top 10 count query result
      const top10CountResult = [{ count: 10 }];

      // Set responses for: 1) current period, 2) previous period, 3) top 10 count
      setMockResponses(currentPeriodData, previousPeriodData, top10CountResult);

      const result = await DashboardService.getDashboardMetrics(testClientId);

      // Delta should be positive (improvement)
      // Current: 450, Previous: 300 => delta = (450-300)/300 * 100 = 50%
      expect(result.clicksDelta).toBe(50);
      // Position delta should be negative (lower is better, so improvement is negative delta)
      // Current avg: 6.5, Previous avg: 9.5 => delta = (6.5-9.5)/9.5 * 100 = -31.6%
      expect(result.positionDelta).toBeLessThan(0);
    });
  });

  describe("getRecentWins", () => {
    it("returns keywords that entered top 10 in last 7 days", async () => {
      // Mock: keyword "best seo tool" was position 15, now position 8
      const recentData: Partial<SeoGscQuerySnapshotSelect>[] = [
        { date: "2026-05-01", query: "best seo tool", position: 8, clicks: 50, impressions: 500 },
        { date: "2026-05-02", query: "best seo tool", position: 7, clicks: 60, impressions: 550 },
        { date: "2026-05-01", query: "seo checker", position: 5, clicks: 100, impressions: 800 },
      ];

      const previousData: Partial<SeoGscQuerySnapshotSelect>[] = [
        { date: "2026-04-20", query: "best seo tool", position: 15, clicks: 10, impressions: 200 },
        { date: "2026-04-20", query: "seo checker", position: 4, clicks: 90, impressions: 750 },
      ];

      // Set responses for: 1) recent data, 2) previous data
      setMockResponses(recentData, previousData);

      const result = await DashboardService.getRecentWins(testClientId, 7);

      // "best seo tool" should be a win (entered top 10 from position 15)
      expect(result.length).toBeGreaterThanOrEqual(1);
      const win = result.find((w) => w.keyword === "best seo tool");
      expect(win).toBeDefined();
      expect(win?.currentPosition).toBeLessThanOrEqual(10);
      expect(win?.previousPosition).toBeGreaterThan(10);
    });
  });

  describe("getNeedsAttention", () => {
    it("returns keywords that dropped >5 positions", async () => {
      // Mock: keyword "seo tips" dropped from position 5 to position 12
      const recentData: Partial<SeoGscQuerySnapshotSelect>[] = [
        { date: "2026-05-01", query: "seo tips", position: 12, clicks: 20, impressions: 300 },
        { date: "2026-05-01", query: "rank tracker", position: 3, clicks: 150, impressions: 1000 },
      ];

      const previousData: Partial<SeoGscQuerySnapshotSelect>[] = [
        { date: "2026-04-20", query: "seo tips", position: 5, clicks: 80, impressions: 600 },
        { date: "2026-04-20", query: "rank tracker", position: 4, clicks: 140, impressions: 950 },
      ];

      // Set responses for: 1) recent data, 2) previous data
      setMockResponses(recentData, previousData);

      const result = await DashboardService.getNeedsAttention(testClientId);

      // "seo tips" should need attention (dropped 7 positions)
      expect(result.length).toBeGreaterThanOrEqual(1);
      const attention = result.find((a) => a.keyword === "seo tips");
      expect(attention).toBeDefined();
      expect(attention?.positionDrop).toBeGreaterThan(5);
    });
  });

  describe("empty data handling", () => {
    it("returns empty results gracefully when no GSC data exists", async () => {
      // Set all responses to empty arrays
      // getDashboardMetrics makes 3 calls, getRecentWins makes 2, getNeedsAttention makes 2
      setMockResponses([], [], [{ count: 0 }], [], [], [], []);

      const metrics = await DashboardService.getDashboardMetrics(testClientId);
      const wins = await DashboardService.getRecentWins(testClientId);
      const attention = await DashboardService.getNeedsAttention(testClientId);

      // Should return zero/empty values without throwing
      expect(metrics.clicks).toBe(0);
      expect(metrics.impressions).toBe(0);
      expect(metrics.avgPosition).toBe(0);
      expect(metrics.clicksDelta).toBe(0);
      expect(wins).toEqual([]);
      expect(attention).toEqual([]);
    });
  });
});
