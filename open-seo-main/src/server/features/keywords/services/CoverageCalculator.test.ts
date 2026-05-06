import { describe, it, expect, beforeEach, vi } from "vitest";
import { CoverageCalculator, type CoverageSummary } from "./CoverageCalculator";
import { db } from "@/db";

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("CoverageCalculator", () => {
  let calculator: CoverageCalculator;

  beforeEach(() => {
    calculator = new CoverageCalculator();
    vi.clearAllMocks();
  });

  describe("calculateCoverage", () => {
    it("returns empty summary for prospect with no keywords", async () => {
      // Mock: No keywords found
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: total count
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          } as any;
        } else if (callCount === 2) {
          // Second call: tier stats
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue([]),
          } as any;
        } else {
          // Third call: last research session
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          } as any;
        }
      });

      const result = await calculator.calculateCoverage("prospect-1");

      expect(result.totalKeywords).toBe(0);
      expect(result.totalActiveKeywords).toBe(0);
      expect(result.tiers).toEqual([]);
      expect(result.lastResearchedAt).toBeNull();
    });

    it("excludes tier='excluded' keywords from active count", async () => {
      // Mock: Total count = 150, but 50 are excluded
      const mockTotalCount = [{ count: 150 }];
      const mockTierStats = [
        { tier: "must_do", keywordCount: 60, avgVolume: 500 },
        { tier: "should_do", keywordCount: 40, avgVolume: 300 },
        // No "excluded" tier should appear in tier stats due to WHERE filter
      ];

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: total count
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(mockTotalCount),
          } as any;
        } else if (callCount === 2) {
          // Second call: tier stats (excludes excluded/ignore)
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue(mockTierStats),
          } as any;
        } else {
          // Third call: last research session
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          } as any;
        }
      });

      const result = await calculator.calculateCoverage("prospect-1");

      expect(result.totalKeywords).toBe(150);
      expect(result.totalActiveKeywords).toBe(100); // 60 + 40
      expect(result.tiers.length).toBe(2);
      expect(result.tiers.find((t) => t.tier === "excluded")).toBeUndefined();
    });

    it("classifies coverage levels correctly", async () => {
      const mockTotalCount = [{ count: 250 }];
      const mockTierStats = [
        { tier: "must_do", keywordCount: 120, avgVolume: 800 }, // comprehensive (>= 100)
        { tier: "should_do", keywordCount: 50, avgVolume: 500 }, // moderate (>= 30)
        { tier: "nice_to_have", keywordCount: 15, avgVolume: 200 }, // minimal (>= 10)
        { tier: null, keywordCount: 5, avgVolume: 100 }, // missing (< 10)
      ];

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(mockTotalCount),
          } as any;
        } else if (callCount === 2) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue(mockTierStats),
          } as any;
        } else {
          // Third call: last research session (none)
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          } as any;
        }
      });

      const result = await calculator.calculateCoverage("prospect-1");

      expect(result.tiers[0].coverageLevel).toBe("comprehensive");
      expect(result.tiers[1].coverageLevel).toBe("moderate");
      expect(result.tiers[2].coverageLevel).toBe("minimal");
      expect(result.tiers[3].coverageLevel).toBe("missing");
    });

    it("fetches lastResearchedAt from research_sessions table", async () => {
      const mockTotalCount = [{ count: 50 }];
      const mockTierStats = [
        { tier: "must_do", keywordCount: 50, avgVolume: 500 },
      ];
      const mockLastSession = [
        { createdAt: new Date("2026-04-15T10:00:00Z") },
      ];

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(mockTotalCount),
          } as any;
        } else if (callCount === 2) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue(mockTierStats),
          } as any;
        } else {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue(mockLastSession),
          } as any;
        }
      });

      const result = await calculator.calculateCoverage("prospect-1");

      expect(result.lastResearchedAt).toEqual(
        new Date("2026-04-15T10:00:00Z")
      );
    });

    it("computes suggestedAction based on coverage state", async () => {
      // Test case 1: No keywords (totalActiveKeywords = 0)
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          } as any;
        } else if (callCount === 2) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue([]),
          } as any;
        } else {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          } as any;
        }
      });

      const result1 = await calculator.calculateCoverage("prospect-1");
      expect(result1.suggestedAction).toContain("EXPAND mode");

      // Test case 2: Minimal coverage (< 30)
      const mockMinimal = [{ count: 20 }];
      const mockMinimalTiers = [
        { tier: "must_do", keywordCount: 20, avgVolume: 300 },
      ];

      callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(mockMinimal),
          } as any;
        } else if (callCount === 2) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue(mockMinimalTiers),
          } as any;
        } else {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          } as any;
        }
      });

      const result2 = await calculator.calculateCoverage("prospect-2");
      expect(result2.suggestedAction).toContain("Consider EXPAND");
    });

    it("handles null tier as 'unclassified'", async () => {
      const mockTotalCount = [{ count: 25 }];
      const mockTierStats = [{ tier: null, keywordCount: 25, avgVolume: 300 }];

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(mockTotalCount),
          } as any;
        } else if (callCount === 2) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue(mockTierStats),
          } as any;
        } else {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          } as any;
        }
      });

      const result = await calculator.calculateCoverage("prospect-1");

      expect(result.tiers[0].tier).toBe("unclassified");
    });
  });
});
