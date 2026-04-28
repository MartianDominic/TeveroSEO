/**
 * Tests for EngagementSignals.
 * Phase 30-04: Engagement Analytics
 *
 * TDD: Tests written FIRST before implementation.
 * Tests engagement signal calculation including hot prospect detection,
 * pricing focus, and ready-to-close scoring.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock database - using a variable to store mock data
let mockViewsData: unknown[] = [];

vi.mock("@/db/index", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(mockViewsData),
        }),
      }),
    }),
  },
}));

// Helper to set mock data
function setMockViews(views: unknown[]) {
  mockViewsData = views;
}

describe("EngagementSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockViewsData = [];
  });

  describe("calculateEngagementSignals", () => {
    it("should return engagement signals object", async () => {
      setMockViews([]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("hot");
      expect(result).toHaveProperty("pricingFocused");
      expect(result).toHaveProperty("calculatedRoi");
      expect(result).toHaveProperty("readyToClose");
      expect(result).toHaveProperty("score");
    });

    it("should detect hot prospect (3+ views in 24h)", async () => {
      const now = Date.now();
      setMockViews([
        { id: "v1", viewedAt: new Date(now - 1000), sectionsViewed: [] },
        { id: "v2", viewedAt: new Date(now - 2000), sectionsViewed: [] },
        { id: "v3", viewedAt: new Date(now - 3000), sectionsViewed: [] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.hot).toBe(true);
    });

    it("should not detect hot prospect with fewer than 3 views in 24h", async () => {
      const now = Date.now();
      setMockViews([
        { id: "v1", viewedAt: new Date(now - 1000), sectionsViewed: [] },
        { id: "v2", viewedAt: new Date(now - 2000), sectionsViewed: [] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.hot).toBe(false);
    });

    it("should not count views older than 24h for hot prospect", async () => {
      const now = Date.now();
      const oneDayAgo = 25 * 60 * 60 * 1000; // 25 hours
      setMockViews([
        { id: "v1", viewedAt: new Date(now - 1000), sectionsViewed: [] },
        { id: "v2", viewedAt: new Date(now - 2000), sectionsViewed: [] },
        { id: "v3", viewedAt: new Date(now - oneDayAgo), sectionsViewed: [] }, // Old view
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.hot).toBe(false);
    });

    it("should detect pricing focused (3+ pricing section views)", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: ["investment"] },
        { id: "v2", viewedAt: new Date(), sectionsViewed: ["investment", "hero"] },
        { id: "v3", viewedAt: new Date(), sectionsViewed: ["investment", "roi"] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.pricingFocused).toBe(true);
    });

    it("should not detect pricing focused with fewer than 3 views", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: ["investment"] },
        { id: "v2", viewedAt: new Date(), sectionsViewed: ["investment"] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.pricingFocused).toBe(false);
    });

    it("should detect ROI calculator usage", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: [], roiCalculatorUsed: true },
        { id: "v2", viewedAt: new Date(), sectionsViewed: [], roiCalculatorUsed: false },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.calculatedRoi).toBe(true);
    });

    it("should not detect ROI calculator usage if never used", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: [], roiCalculatorUsed: false },
        { id: "v2", viewedAt: new Date(), sectionsViewed: [], roiCalculatorUsed: false },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.calculatedRoi).toBe(false);
    });

    it("should detect ready to close (2+ CTA visits + 2+ pricing visits)", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: ["cta", "investment"] },
        { id: "v2", viewedAt: new Date(), sectionsViewed: ["cta", "investment"] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.readyToClose).toBe(true);
    });

    it("should not detect ready to close without sufficient visits", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: ["cta", "investment"] },
        { id: "v2", viewedAt: new Date(), sectionsViewed: ["hero"] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.readyToClose).toBe(false);
    });
  });

  describe("engagement score calculation", () => {
    it("should return score between 0 and 100", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: [] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should return 0 score for no views", async () => {
      setMockViews([]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.score).toBe(0);
    });

    it("should cap score at 100", async () => {
      // Create many views with all engagement signals
      const now = Date.now();
      setMockViews(Array.from({ length: 10 }, (_, i) => ({
        id: `v${i}`,
        viewedAt: new Date(now - i * 1000),
        sectionsViewed: ["investment", "cta", "hero", "opportunities"],
        roiCalculatorUsed: true,
      })));

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.score).toBe(100);
    });

    it("should add points for total views (up to 30)", async () => {
      // 3 views = 30 points for views
      setMockViews([
        { id: "v1", viewedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), sectionsViewed: [] },
        { id: "v2", viewedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), sectionsViewed: [] },
        { id: "v3", viewedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), sectionsViewed: [] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      // Should have 30 points from views
      expect(result.score).toBeGreaterThanOrEqual(30);
    });

    it("should add points for recency (up to 30)", async () => {
      // 2 recent views
      const now = Date.now();
      setMockViews([
        { id: "v1", viewedAt: new Date(now - 1000), sectionsViewed: [] },
        { id: "v2", viewedAt: new Date(now - 2000), sectionsViewed: [] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      // Should have points from views (20) and recency (30)
      expect(result.score).toBeGreaterThanOrEqual(20);
    });

    it("should add 20 points for ROI calculator usage", async () => {
      const now = Date.now();
      setMockViews([
        { id: "v1", viewedAt: new Date(now - 48 * 60 * 60 * 1000), sectionsViewed: [], roiCalculatorUsed: true },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      // Should have 10 (view) + 20 (roi) = 30
      expect(result.score).toBeGreaterThanOrEqual(30);
    });

    it("should add points for pricing focus (up to 20)", async () => {
      const now = Date.now();
      setMockViews([
        { id: "v1", viewedAt: new Date(now - 48 * 60 * 60 * 1000), sectionsViewed: ["investment"] },
        { id: "v2", viewedAt: new Date(now - 48 * 60 * 60 * 1000), sectionsViewed: ["investment"] },
        { id: "v3", viewedAt: new Date(now - 48 * 60 * 60 * 1000), sectionsViewed: ["investment"] },
        { id: "v4", viewedAt: new Date(now - 48 * 60 * 60 * 1000), sectionsViewed: ["investment"] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      // Should have 40 (views) + 20 (pricing) = 60, but capped to 30 for views
      expect(result.score).toBeGreaterThanOrEqual(40);
    });
  });

  describe("edge cases", () => {
    it("should handle null sectionsViewed", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: null },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result).toBeDefined();
      expect(result.pricingFocused).toBe(false);
    });

    it("should handle undefined roiCalculatorUsed", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: [] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.calculatedRoi).toBe(false);
    });

    it("should handle empty sectionsViewed array", async () => {
      setMockViews([
        { id: "v1", viewedAt: new Date(), sectionsViewed: [] },
      ]);

      const { calculateEngagementSignals } = await import("./EngagementSignals");

      const result = await calculateEngagementSignals("proposal-123");

      expect(result.pricingFocused).toBe(false);
      expect(result.readyToClose).toBe(false);
    });
  });
});

describe("EngagementSignals types", () => {
  it("should export EngagementSignals interface", async () => {
    const module = await import("./EngagementSignals");

    // TypeScript will catch if the type doesn't exist at compile time
    // This runtime check ensures the export exists
    expect(module.calculateEngagementSignals).toBeDefined();
  });
});
