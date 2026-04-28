/**
 * Tests for Sales Analytics.
 * Phase 30-08: Pipeline & Automation
 *
 * TDD: Tests written FIRST before implementation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock database queries
const mockProposals = [
  {
    id: "proposal-1",
    workspaceId: "workspace-1",
    status: "sent",
    monthlyFeeCents: 150000,
    sentAt: new Date("2026-04-01"),
    firstViewedAt: null,
    acceptedAt: null,
    paidAt: null,
    declinedReason: null,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-05"),
  },
  {
    id: "proposal-2",
    workspaceId: "workspace-1",
    status: "viewed",
    monthlyFeeCents: 200000,
    sentAt: new Date("2026-04-02"),
    firstViewedAt: new Date("2026-04-03"),
    acceptedAt: null,
    paidAt: null,
    declinedReason: null,
    createdAt: new Date("2026-04-02"),
    updatedAt: new Date("2026-04-03"),
  },
  {
    id: "proposal-3",
    workspaceId: "workspace-1",
    status: "paid",
    monthlyFeeCents: 180000,
    sentAt: new Date("2026-03-15"),
    firstViewedAt: new Date("2026-03-16"),
    acceptedAt: new Date("2026-03-20"),
    paidAt: new Date("2026-03-25"),
    declinedReason: null,
    createdAt: new Date("2026-03-15"),
    updatedAt: new Date("2026-03-25"),
  },
  {
    id: "proposal-4",
    workspaceId: "workspace-1",
    status: "declined",
    monthlyFeeCents: 120000,
    sentAt: new Date("2026-04-01"),
    firstViewedAt: new Date("2026-04-02"),
    acceptedAt: null,
    paidAt: null,
    declinedReason: "price",
    declinedNotes: "Too expensive for our budget",
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-05"),
  },
  {
    id: "proposal-5",
    workspaceId: "workspace-1",
    status: "onboarded",
    monthlyFeeCents: 250000,
    sentAt: new Date("2026-03-01"),
    firstViewedAt: new Date("2026-03-02"),
    acceptedAt: new Date("2026-03-05"),
    paidAt: new Date("2026-03-10"),
    declinedReason: null,
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-03-15"),
  },
];

vi.mock("@/db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(mockProposals)),
      })),
    })),
  },
}));

describe("Sales Analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateSalesAnalytics", () => {
    it("should calculate pipeline value from active proposals", async () => {
      const { calculateSalesAnalytics } = await import("./analytics");

      const result = await calculateSalesAnalytics("workspace-1", {
        start: new Date("2026-03-01"),
        end: new Date("2026-04-30"),
      });

      // Active proposals: sent (150000) + viewed (200000) = 350000 cents = 3500 EUR
      expect(result.pipelineValue).toBe(3500);
    });

    it("should calculate count of proposals sent", async () => {
      const { calculateSalesAnalytics } = await import("./analytics");

      const result = await calculateSalesAnalytics("workspace-1", {
        start: new Date("2026-03-01"),
        end: new Date("2026-04-30"),
      });

      // All proposals have sentAt, so all 5 were sent
      expect(result.proposalsSent).toBe(5);
    });

    it("should calculate view rate as percentage", async () => {
      const { calculateSalesAnalytics } = await import("./analytics");

      const result = await calculateSalesAnalytics("workspace-1", {
        start: new Date("2026-03-01"),
        end: new Date("2026-04-30"),
      });

      // 4 out of 5 were viewed (all except proposal-1)
      // 4/5 * 100 = 80%
      expect(result.viewRate).toBe(80);
    });

    it("should calculate win rate from closed deals", async () => {
      const { calculateSalesAnalytics } = await import("./analytics");

      const result = await calculateSalesAnalytics("workspace-1", {
        start: new Date("2026-03-01"),
        end: new Date("2026-04-30"),
      });

      // Won: paid (1) + onboarded (1) = 2
      // Lost: declined (1) = 1
      // Win rate: 2 / (2+1) * 100 = 66.67%
      expect(result.winRate).toBeCloseTo(66.67, 1);
    });

    it("should calculate average deal size from won deals", async () => {
      const { calculateSalesAnalytics } = await import("./analytics");

      const result = await calculateSalesAnalytics("workspace-1", {
        start: new Date("2026-03-01"),
        end: new Date("2026-04-30"),
      });

      // Won deals: 180000 + 250000 = 430000 cents
      // Average: 430000 / 2 / 100 = 2150 EUR
      expect(result.avgDealSize).toBe(2150);
    });

    it("should aggregate loss reasons", async () => {
      const { calculateSalesAnalytics } = await import("./analytics");

      const result = await calculateSalesAnalytics("workspace-1", {
        start: new Date("2026-03-01"),
        end: new Date("2026-04-30"),
      });

      expect(result.lossReasons).toEqual([{ reason: "price", count: 1 }]);
    });

    it("should calculate average time to close in days", async () => {
      const { calculateSalesAnalytics } = await import("./analytics");

      const result = await calculateSalesAnalytics("workspace-1", {
        start: new Date("2026-03-01"),
        end: new Date("2026-04-30"),
      });

      // proposal-3: sent 2026-03-15, paid 2026-03-25 = 10 days
      // proposal-5: sent 2026-03-01, paid 2026-03-10 = 9 days
      // Average: (10 + 9) / 2 = 9.5 days
      expect(result.avgTimeToClose).toBeCloseTo(9.5, 1);
    });

    it("should handle empty dataset gracefully", async () => {
      // Test the utility functions directly for empty data handling
      const { calculateAvgTimeToClose, aggregateLossReasons } = await import("./analytics");

      // Empty won proposals
      expect(calculateAvgTimeToClose([])).toBe(0);

      // Empty declined proposals
      expect(aggregateLossReasons([])).toEqual([]);
    });
  });

  describe("aggregateLossReasons", () => {
    it("should group and count loss reasons", async () => {
      const { aggregateLossReasons } = await import("./analytics");

      const declined = [
        { declinedReason: "price" },
        { declinedReason: "price" },
        { declinedReason: "competitor" },
        { declinedReason: "timing" },
        { declinedReason: null },
      ] as Array<{ declinedReason: string | null }>;

      const result = aggregateLossReasons(declined);

      expect(result).toContainEqual({ reason: "price", count: 2 });
      expect(result).toContainEqual({ reason: "competitor", count: 1 });
      expect(result).toContainEqual({ reason: "timing", count: 1 });
      // Null reasons should be excluded or counted as "unknown"
    });

    it("should sort by count descending", async () => {
      const { aggregateLossReasons } = await import("./analytics");

      const declined = [
        { declinedReason: "price" },
        { declinedReason: "price" },
        { declinedReason: "price" },
        { declinedReason: "competitor" },
        { declinedReason: "timing" },
      ] as Array<{ declinedReason: string | null }>;

      const result = aggregateLossReasons(declined);

      expect(result[0].reason).toBe("price");
      expect(result[0].count).toBe(3);
    });
  });

  describe("calculateAvgTimeToClose", () => {
    it("should calculate average days from sent to paid", async () => {
      const { calculateAvgTimeToClose } = await import("./analytics");

      const won = [
        {
          sentAt: new Date("2026-03-01"),
          paidAt: new Date("2026-03-11"), // 10 days
        },
        {
          sentAt: new Date("2026-03-15"),
          paidAt: new Date("2026-03-20"), // 5 days
        },
      ];

      const result = calculateAvgTimeToClose(won);

      expect(result).toBeCloseTo(7.5, 1);
    });

    it("should return 0 for empty array", async () => {
      const { calculateAvgTimeToClose } = await import("./analytics");

      const result = calculateAvgTimeToClose([]);

      expect(result).toBe(0);
    });

    it("should skip proposals without sentAt or paidAt", async () => {
      const { calculateAvgTimeToClose } = await import("./analytics");

      const won = [
        {
          sentAt: new Date("2026-03-01"),
          paidAt: new Date("2026-03-06"), // 5 days
        },
        {
          sentAt: null,
          paidAt: new Date("2026-03-10"),
        },
        {
          sentAt: new Date("2026-03-01"),
          paidAt: null,
        },
      ];

      const result = calculateAvgTimeToClose(won);

      // Only first proposal counts: 5 days
      expect(result).toBe(5);
    });
  });
});

describe("Loss Reasons", () => {
  describe("LOSS_REASONS constant", () => {
    it("should define predefined loss reasons", async () => {
      const { LOSS_REASONS } = await import("./analytics");

      expect(LOSS_REASONS).toContainEqual(
        expect.objectContaining({ id: "price", label: expect.any(String) })
      );
      expect(LOSS_REASONS).toContainEqual(
        expect.objectContaining({ id: "competitor", label: expect.any(String) })
      );
      expect(LOSS_REASONS).toContainEqual(
        expect.objectContaining({ id: "timing", label: expect.any(String) })
      );
      expect(LOSS_REASONS).toContainEqual(
        expect.objectContaining({ id: "no_response", label: expect.any(String) })
      );
      expect(LOSS_REASONS).toContainEqual(
        expect.objectContaining({ id: "internal", label: expect.any(String) })
      );
      expect(LOSS_REASONS).toContainEqual(
        expect.objectContaining({ id: "other", label: expect.any(String) })
      );
    });
  });
});
