/**
 * AnalyticsService Tests
 * Phase 62-08: Win/Loss Analytics and Final Phase Completion
 *
 * Tests for:
 * - getDealOutcomes: aggregated win/loss counts for date range
 * - getLossReasonDistribution: groups by loss_reason
 * - getTopCompetitors: returns competitor names sorted by frequency
 * - getAvgCycleTime: calculates mean cycle_days
 * - getWinLossAnalytics: combined analytics payload
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
        groupBy: vi.fn(() => Promise.resolve([])),
      })),
    })),
    query: {
      dealOutcomes: {
        findMany: vi.fn(() => Promise.resolve([])),
      },
    },
  },
  dealOutcomes: {
    workspaceId: "workspace_id",
    outcome: "outcome",
    lossReason: "loss_reason",
    competitorName: "competitor_name",
    outcomeAt: "outcome_at",
    cycleDays: "cycle_days",
  },
}));

// Import after mocks
import { AnalyticsService, type WinLossAnalyticsResult } from "./AnalyticsService";
import { type DealOutcomeRepositoryInterface } from "../repositories/DealOutcomeRepository";

// Mock repository
function createMockRepository(overrides: Partial<DealOutcomeRepositoryInterface> = {}): DealOutcomeRepositoryInterface {
  return {
    findByWorkspace: vi.fn().mockResolvedValue([]),
    countByOutcome: vi.fn().mockResolvedValue({ won: 0, lost: 0 }),
    groupByLossReason: vi.fn().mockResolvedValue([]),
    getTopCompetitors: vi.fn().mockResolvedValue([]),
    getAvgCycleDays: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: "test-id" }),
    ...overrides,
  };
}

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let mockRepo: DealOutcomeRepositoryInterface;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new AnalyticsService(mockRepo);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getDealOutcomes", () => {
    it("returns aggregated win/loss counts for date range", async () => {
      const mockCounts = { won: 10, lost: 5 };
      mockRepo.countByOutcome = vi.fn().mockResolvedValue(mockCounts);

      const dateRange = {
        from: new Date("2026-01-01"),
        to: new Date("2026-01-31"),
      };

      const result = await service.getDealOutcomes("workspace-1", dateRange);

      expect(mockRepo.countByOutcome).toHaveBeenCalledWith("workspace-1", dateRange);
      expect(result.won).toBe(10);
      expect(result.lost).toBe(5);
      expect(result.total).toBe(15);
    });

    it("returns zero counts when no deals exist", async () => {
      mockRepo.countByOutcome = vi.fn().mockResolvedValue({ won: 0, lost: 0 });

      const result = await service.getDealOutcomes("workspace-1");

      expect(result.won).toBe(0);
      expect(result.lost).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getLossReasonDistribution", () => {
    it("groups deals by loss_reason with percentages", async () => {
      const mockDistribution = [
        { reason: "too_expensive", count: 5 },
        { reason: "bad_timing", count: 3 },
        { reason: "chose_competitor", count: 2 },
      ];
      mockRepo.groupByLossReason = vi.fn().mockResolvedValue(mockDistribution);
      mockRepo.countByOutcome = vi.fn().mockResolvedValue({ won: 5, lost: 10 });

      const result = await service.getLossReasonDistribution("workspace-1");

      expect(mockRepo.groupByLossReason).toHaveBeenCalledWith("workspace-1");
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        reason: "too_expensive",
        count: 5,
        percentage: 50, // 5/10 * 100
      });
      expect(result[1]).toEqual({
        reason: "bad_timing",
        count: 3,
        percentage: 30,
      });
      expect(result[2]).toEqual({
        reason: "chose_competitor",
        count: 2,
        percentage: 20,
      });
    });

    it("returns empty array when no lost deals", async () => {
      mockRepo.groupByLossReason = vi.fn().mockResolvedValue([]);
      mockRepo.countByOutcome = vi.fn().mockResolvedValue({ won: 5, lost: 0 });

      const result = await service.getLossReasonDistribution("workspace-1");

      expect(result).toEqual([]);
    });

    it("handles zero total lost deals without division error", async () => {
      const mockDistribution = [{ reason: "unknown", count: 0 }];
      mockRepo.groupByLossReason = vi.fn().mockResolvedValue(mockDistribution);
      mockRepo.countByOutcome = vi.fn().mockResolvedValue({ won: 0, lost: 0 });

      const result = await service.getLossReasonDistribution("workspace-1");

      expect(result[0].percentage).toBe(0);
    });
  });

  describe("getTopCompetitors", () => {
    it("returns competitor names sorted by frequency", async () => {
      const mockCompetitors = [
        { name: "SEO Agency A", count: 5 },
        { name: "SEO Agency B", count: 3 },
        { name: "Internal Team", count: 2 },
      ];
      mockRepo.getTopCompetitors = vi.fn().mockResolvedValue(mockCompetitors);

      const result = await service.getTopCompetitors("workspace-1", 5);

      expect(mockRepo.getTopCompetitors).toHaveBeenCalledWith("workspace-1", 5);
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("SEO Agency A");
      expect(result[0].count).toBe(5);
    });

    it("returns empty array when no competitors", async () => {
      mockRepo.getTopCompetitors = vi.fn().mockResolvedValue([]);

      const result = await service.getTopCompetitors("workspace-1");

      expect(result).toEqual([]);
    });

    it("defaults to limit 5 when not specified", async () => {
      mockRepo.getTopCompetitors = vi.fn().mockResolvedValue([]);

      await service.getTopCompetitors("workspace-1");

      expect(mockRepo.getTopCompetitors).toHaveBeenCalledWith("workspace-1", 5);
    });
  });

  describe("getAvgCycleTime", () => {
    it("calculates mean cycle_days for won deals", async () => {
      mockRepo.getAvgCycleDays = vi.fn().mockResolvedValue(14);

      const result = await service.getAvgCycleTime("workspace-1");

      expect(mockRepo.getAvgCycleDays).toHaveBeenCalledWith("workspace-1", undefined);
      expect(result).toBe(14);
    });

    it("returns 0 when no won deals exist", async () => {
      mockRepo.getAvgCycleDays = vi.fn().mockResolvedValue(0);

      const result = await service.getAvgCycleTime("workspace-1");

      expect(result).toBe(0);
    });

    it("filters by date range when provided", async () => {
      const dateRange = {
        from: new Date("2026-01-01"),
        to: new Date("2026-01-31"),
      };
      mockRepo.getAvgCycleDays = vi.fn().mockResolvedValue(21);

      await service.getAvgCycleTime("workspace-1", dateRange);

      expect(mockRepo.getAvgCycleDays).toHaveBeenCalledWith("workspace-1", dateRange);
    });
  });

  describe("getWinLossAnalytics", () => {
    it("returns combined analytics payload", async () => {
      mockRepo.countByOutcome = vi.fn().mockResolvedValue({ won: 10, lost: 5 });
      mockRepo.groupByLossReason = vi.fn().mockResolvedValue([
        { reason: "too_expensive", count: 3 },
        { reason: "bad_timing", count: 2 },
      ]);
      mockRepo.getTopCompetitors = vi.fn().mockResolvedValue([
        { name: "Competitor A", count: 2 },
      ]);
      mockRepo.getAvgCycleDays = vi.fn().mockResolvedValue(14);

      const result = await service.getWinLossAnalytics("workspace-1");

      expect(result.summary).toEqual({
        totalDeals: 15,
        won: 10,
        lost: 5,
        winRate: 66.67, // 10/15 * 100, rounded to 2 decimals
        avgCycleDays: 14,
      });
      expect(result.lossReasons).toHaveLength(2);
      expect(result.topCompetitors).toHaveLength(1);
    });

    it("calculates win rate as 0 when no deals", async () => {
      mockRepo.countByOutcome = vi.fn().mockResolvedValue({ won: 0, lost: 0 });
      mockRepo.groupByLossReason = vi.fn().mockResolvedValue([]);
      mockRepo.getTopCompetitors = vi.fn().mockResolvedValue([]);
      mockRepo.getAvgCycleDays = vi.fn().mockResolvedValue(0);

      const result = await service.getWinLossAnalytics("workspace-1");

      expect(result.summary.winRate).toBe(0);
      expect(result.summary.totalDeals).toBe(0);
    });

    it("runs queries in parallel for performance", async () => {
      const startTime = Date.now();

      // All queries take 50ms
      mockRepo.countByOutcome = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ won: 1, lost: 1 }), 50))
      );
      mockRepo.groupByLossReason = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 50))
      );
      mockRepo.getTopCompetitors = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 50))
      );
      mockRepo.getAvgCycleDays = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(0), 50))
      );

      await service.getWinLossAnalytics("workspace-1");

      const elapsed = Date.now() - startTime;
      // If parallel, should be ~50-60ms. If sequential, would be ~200ms
      expect(elapsed).toBeLessThan(150);
    });
  });
});
