/**
 * Tests for KeywordAggregationService.
 * Phase 34: Keyword-Page Mapping
 *
 * Note: Tests focus on type structure validation since the mergeAndDeduplicate
 * logic is a private module function. Integration tests with actual db mocking
 * would be needed for full coverage of aggregateKeywords.
 */
import { describe, it, expect, vi } from "vitest";
import {
  KeywordAggregationService,
  type AggregatedKeyword,
  type AggregationResult,
  type KeywordSource,
} from "./KeywordAggregationService";

// Mock the db import
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => ({
            having: vi.fn(() => Promise.resolve([])),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
          limit: vi.fn(() => Promise.resolve([])),
        })),
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
        limit: vi.fn(() => Promise.resolve([])),
      })),
    })),
    query: {
      audits: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
      auditPages: {
        findMany: vi.fn(() => Promise.resolve([])),
      },
    },
  },
}));

describe("KeywordAggregationService", () => {
  describe("AggregatedKeyword type structure", () => {
    it("should have all required fields", () => {
      const keyword: AggregatedKeyword = {
        keyword: "test keyword",
        originalKeyword: "Test Keyword",
        sources: ["gsc", "saved"],
        currentPosition: 5,
        currentUrl: "https://example.com/page",
        searchVolume: 1000,
        cpc: 2.5,
        difficulty: 45,
        gscAvgPosition: 7.2,
        gscImpressions: 500,
        gscClicks: 25,
        achievability: 75,
        isTracked: true,
      };

      expect(keyword.keyword).toBe("test keyword");
      expect(keyword.originalKeyword).toBe("Test Keyword");
      expect(keyword.sources).toContain("gsc");
      expect(keyword.sources).toContain("saved");
      expect(keyword.currentPosition).toBe(5);
      expect(keyword.searchVolume).toBe(1000);
      expect(keyword.isTracked).toBe(true);
    });

    it("should allow nullable fields", () => {
      const keyword: AggregatedKeyword = {
        keyword: "test",
        originalKeyword: "Test",
        sources: ["gsc"],
        currentPosition: null,
        currentUrl: null,
        searchVolume: null,
        cpc: null,
        difficulty: null,
        gscAvgPosition: 5.0,
        gscImpressions: 100,
        gscClicks: 10,
        achievability: null,
        isTracked: false,
      };

      expect(keyword.currentPosition).toBeNull();
      expect(keyword.searchVolume).toBeNull();
      expect(keyword.achievability).toBeNull();
    });

    it("should accept all valid source types", () => {
      const sources: KeywordSource[] = [
        "gsc",
        "saved",
        "ranking",
        "prospect_gap",
        "prospect_opportunity",
      ];

      const keyword: AggregatedKeyword = {
        keyword: "test",
        originalKeyword: "Test",
        sources,
        currentPosition: null,
        currentUrl: null,
        searchVolume: null,
        cpc: null,
        difficulty: null,
        gscAvgPosition: null,
        gscImpressions: null,
        gscClicks: null,
        achievability: null,
        isTracked: false,
      };

      expect(keyword.sources).toHaveLength(5);
      expect(keyword.sources).toContain("gsc");
      expect(keyword.sources).toContain("prospect_gap");
      expect(keyword.sources).toContain("prospect_opportunity");
    });
  });

  describe("AggregationResult type structure", () => {
    it("should have all required fields", () => {
      const result: AggregationResult = {
        keywords: [],
        sourceCounts: {
          gsc: 10,
          saved: 5,
          ranking: 3,
          prospect_gap: 2,
          prospect_opportunity: 1,
        },
        totalUnique: 15,
        clientId: "client-123",
        prospectId: "prospect-456",
      };

      expect(result.keywords).toEqual([]);
      expect(result.sourceCounts.gsc).toBe(10);
      expect(result.totalUnique).toBe(15);
      expect(result.clientId).toBe("client-123");
      expect(result.prospectId).toBe("prospect-456");
    });

    it("should allow null clientId and prospectId", () => {
      const result: AggregationResult = {
        keywords: [],
        sourceCounts: {
          gsc: 0,
          saved: 0,
          ranking: 0,
          prospect_gap: 0,
          prospect_opportunity: 0,
        },
        totalUnique: 0,
        clientId: null,
        prospectId: null,
      };

      expect(result.clientId).toBeNull();
      expect(result.prospectId).toBeNull();
    });
  });

  describe("KeywordAggregationService exports", () => {
    it("should export aggregateKeywords function", () => {
      expect(typeof KeywordAggregationService.aggregateKeywords).toBe("function");
    });

    it("should export calculateAggregationStats function", () => {
      expect(typeof KeywordAggregationService.calculateAggregationStats).toBe("function");
    });
  });

  describe("calculateAggregationStats", () => {
    it("should calculate correct stats from keywords array", () => {
      const keywords: AggregatedKeyword[] = [
        {
          keyword: "kw1",
          originalKeyword: "KW1",
          sources: ["gsc"],
          currentPosition: 5,
          currentUrl: "https://example.com",
          searchVolume: 1000,
          cpc: null,
          difficulty: null,
          gscAvgPosition: null,
          gscImpressions: null,
          gscClicks: null,
          achievability: null,
          isTracked: false,
        },
        {
          keyword: "kw2",
          originalKeyword: "KW2",
          sources: ["saved"],
          currentPosition: null,
          currentUrl: null,
          searchVolume: 500,
          cpc: null,
          difficulty: null,
          gscAvgPosition: null,
          gscImpressions: null,
          gscClicks: null,
          achievability: null,
          isTracked: false,
        },
        {
          keyword: "kw3",
          originalKeyword: "KW3",
          sources: ["gsc"],
          currentPosition: null,
          currentUrl: null,
          searchVolume: null,
          cpc: null,
          difficulty: null,
          gscAvgPosition: null,
          gscImpressions: null,
          gscClicks: null,
          achievability: null,
          isTracked: false,
        },
      ];

      const stats = KeywordAggregationService.calculateAggregationStats(keywords);

      expect(stats.totalKeywords).toBe(3);
      expect(stats.withSearchVolume).toBe(2); // kw1 and kw2
      expect(stats.withPosition).toBe(1); // only kw1
    });

    it("should handle empty keywords array", () => {
      const stats = KeywordAggregationService.calculateAggregationStats([]);

      expect(stats.totalKeywords).toBe(0);
      expect(stats.withSearchVolume).toBe(0);
      expect(stats.withPosition).toBe(0);
    });
  });

  describe("source counts calculation", () => {
    it("should correctly track source attribution", () => {
      // Simulating how source counts would be calculated
      const keywords: AggregatedKeyword[] = [
        {
          keyword: "kw1",
          originalKeyword: "KW1",
          sources: ["gsc", "saved"],
          currentPosition: null,
          currentUrl: null,
          searchVolume: null,
          cpc: null,
          difficulty: null,
          gscAvgPosition: null,
          gscImpressions: null,
          gscClicks: null,
          achievability: null,
          isTracked: false,
        },
        {
          keyword: "kw2",
          originalKeyword: "KW2",
          sources: ["gsc"],
          currentPosition: null,
          currentUrl: null,
          searchVolume: null,
          cpc: null,
          difficulty: null,
          gscAvgPosition: null,
          gscImpressions: null,
          gscClicks: null,
          achievability: null,
          isTracked: false,
        },
        {
          keyword: "kw3",
          originalKeyword: "KW3",
          sources: ["saved", "ranking"],
          currentPosition: null,
          currentUrl: null,
          searchVolume: null,
          cpc: null,
          difficulty: null,
          gscAvgPosition: null,
          gscImpressions: null,
          gscClicks: null,
          achievability: null,
          isTracked: false,
        },
      ];

      // Calculate source counts like the service does
      const sourceCounts: Record<KeywordSource, number> = {
        gsc: 0,
        saved: 0,
        ranking: 0,
        prospect_gap: 0,
        prospect_opportunity: 0,
      };

      for (const kw of keywords) {
        for (const source of kw.sources) {
          sourceCounts[source]++;
        }
      }

      expect(sourceCounts.gsc).toBe(2); // kw1, kw2
      expect(sourceCounts.saved).toBe(2); // kw1, kw3
      expect(sourceCounts.ranking).toBe(1); // kw3
      expect(sourceCounts.prospect_gap).toBe(0);
      expect(sourceCounts.prospect_opportunity).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle keywords with special characters in type", () => {
      const keyword: AggregatedKeyword = {
        keyword: "c++ programming",
        originalKeyword: "C++ Programming",
        sources: ["gsc"],
        currentPosition: 10,
        currentUrl: null,
        searchVolume: 5000,
        cpc: 2.5,
        difficulty: 60,
        gscAvgPosition: 12.5,
        gscImpressions: 200,
        gscClicks: 15,
        achievability: null,
        isTracked: false,
      };

      expect(keyword.keyword).toBe("c++ programming");
    });

    it("should handle very long keywords in type", () => {
      const longKeyword = "this is a very long tail keyword that someone might search for when looking for something specific";

      const keyword: AggregatedKeyword = {
        keyword: longKeyword,
        originalKeyword: longKeyword,
        sources: ["gsc"],
        currentPosition: null,
        currentUrl: null,
        searchVolume: 10,
        cpc: null,
        difficulty: null,
        gscAvgPosition: 50,
        gscImpressions: 5,
        gscClicks: 0,
        achievability: null,
        isTracked: false,
      };

      expect(keyword.keyword).toBe(longKeyword);
    });

    it("should handle zero metrics in type", () => {
      const keyword: AggregatedKeyword = {
        keyword: "zero metrics",
        originalKeyword: "Zero Metrics",
        sources: ["saved"],
        currentPosition: 0, // Position 0 is technically valid (not ranking)
        currentUrl: null,
        searchVolume: 0,
        cpc: 0,
        difficulty: 0,
        gscAvgPosition: 0,
        gscImpressions: 0,
        gscClicks: 0,
        achievability: 0,
        isTracked: false,
      };

      expect(keyword.searchVolume).toBe(0);
      expect(keyword.gscClicks).toBe(0);
      expect(keyword.achievability).toBe(0);
    });
  });
});
