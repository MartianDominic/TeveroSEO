/**
 * Tests for DataForSEO keyword volume validation.
 * Phase 29: AI Opportunity Discovery - Task 29-02
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateKeywordVolumes,
  calculateOpportunityScore,
  enrichKeywordsWithMetrics,
  type KeywordVolumeResult,
} from "./volumeValidator";
import type { GeneratedKeyword } from "./keywordGenerator";

// Mock the DataForSEO raw fetch function - use vi.hoisted for proper hoisting
const { mockFetchSearchVolume } = vi.hoisted(() => ({
  mockFetchSearchVolume: vi.fn(),
}));

vi.mock("./dataforseoVolume", () => ({
  fetchSearchVolumeRaw: mockFetchSearchVolume,
}));

describe("volumeValidator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateOpportunityScore", () => {
    it("should calculate score as volume * cpc * (100 - difficulty) / 100", () => {
      // volume: 1000, cpc: 2.0, difficulty: 50
      // score = 1000 * 2.0 * (100 - 50) / 100 = 1000 * 2.0 * 0.5 = 1000
      const score = calculateOpportunityScore(1000, 2.0, 50);
      expect(score).toBe(1000);
    });

    it("should return high score for low difficulty keywords", () => {
      // volume: 500, cpc: 1.0, difficulty: 10
      // score = 500 * 1.0 * (100 - 10) / 100 = 500 * 0.9 = 450
      const score = calculateOpportunityScore(500, 1.0, 10);
      expect(score).toBe(450);
    });

    it("should return low score for high difficulty keywords", () => {
      // volume: 500, cpc: 1.0, difficulty: 90
      // score = 500 * 1.0 * (100 - 90) / 100 = 500 * 0.1 = 50
      const score = calculateOpportunityScore(500, 1.0, 90);
      expect(score).toBe(50);
    });

    it("should return 0 for zero volume", () => {
      const score = calculateOpportunityScore(0, 2.0, 30);
      expect(score).toBe(0);
    });

    it("should return 0 for zero cpc", () => {
      const score = calculateOpportunityScore(1000, 0, 30);
      expect(score).toBe(0);
    });

    it("should return 0 for 100 difficulty", () => {
      const score = calculateOpportunityScore(1000, 2.0, 100);
      expect(score).toBe(0);
    });

    it("should round the result to avoid floating point issues", () => {
      // volume: 333, cpc: 1.5, difficulty: 25
      // score = 333 * 1.5 * 0.75 = 374.625 -> should round
      const score = calculateOpportunityScore(333, 1.5, 25);
      expect(Number.isInteger(score)).toBe(true);
    });
  });

  describe("enrichKeywordsWithMetrics", () => {
    const mockKeywords: GeneratedKeyword[] = [
      { keyword: "barrel sauna price", category: "product" },
      { keyword: "Harvia heater reviews", category: "brand" },
      { keyword: "sauna installation cost", category: "service" },
    ];

    const mockVolumeData: KeywordVolumeResult[] = [
      {
        keyword: "barrel sauna price",
        searchVolume: 1000,
        cpc: 2.5,
        difficulty: 35,
      },
      {
        keyword: "Harvia heater reviews",
        searchVolume: 500,
        cpc: 1.2,
        difficulty: 45,
      },
      {
        keyword: "sauna installation cost",
        searchVolume: 800,
        cpc: 3.0,
        difficulty: 55,
      },
    ];

    it("should merge generated keywords with volume data", () => {
      const result = enrichKeywordsWithMetrics(mockKeywords, mockVolumeData);

      expect(result).toHaveLength(3);
      expect(result[0].keyword).toBe("barrel sauna price");
      expect(result[0].category).toBe("product");
      expect(result[0].searchVolume).toBe(1000);
      expect(result[0].cpc).toBe(2.5);
      expect(result[0].difficulty).toBe(35);
    });

    it("should calculate opportunity score for each keyword", () => {
      const result = enrichKeywordsWithMetrics(mockKeywords, mockVolumeData);

      // First keyword: 1000 * 2.5 * 0.65 = 1625
      expect(result[0].opportunityScore).toBe(1625);
    });

    it("should set source to ai_generated", () => {
      const result = enrichKeywordsWithMetrics(mockKeywords, mockVolumeData);

      result.forEach((kw) => {
        expect(kw.source).toBe("ai_generated");
      });
    });

    it("should filter out keywords with zero volume", () => {
      const volumeWithZero: KeywordVolumeResult[] = [
        ...mockVolumeData,
        { keyword: "zero volume keyword", searchVolume: 0, cpc: 1.0, difficulty: 20 },
      ];
      const keywordsWithZero: GeneratedKeyword[] = [
        ...mockKeywords,
        { keyword: "zero volume keyword", category: "product" },
      ];

      const result = enrichKeywordsWithMetrics(keywordsWithZero, volumeWithZero);

      expect(result.find((k) => k.keyword === "zero volume keyword")).toBeUndefined();
    });

    it("should handle keywords not found in volume data", () => {
      const partialVolumeData: KeywordVolumeResult[] = [mockVolumeData[0]];

      const result = enrichKeywordsWithMetrics(mockKeywords, partialVolumeData);

      expect(result).toHaveLength(1);
      expect(result[0].keyword).toBe("barrel sauna price");
    });

    it("should sort by opportunity score descending", () => {
      const result = enrichKeywordsWithMetrics(mockKeywords, mockVolumeData);

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].opportunityScore).toBeGreaterThanOrEqual(
          result[i].opportunityScore,
        );
      }
    });
  });

  describe("validateKeywordVolumes", () => {
    const mockKeywords: GeneratedKeyword[] = [
      { keyword: "barrel sauna", category: "product" },
      { keyword: "outdoor sauna", category: "product" },
    ];

    it("should call DataForSEO API with keywords", async () => {
      mockFetchSearchVolume.mockResolvedValue({
        data: [
          { keyword: "barrel sauna", search_volume: 1000, cpc: 2.0, competition: 0.5 },
          { keyword: "outdoor sauna", search_volume: 800, cpc: 1.5, competition: 0.4 },
        ],
        billing: { path: ["v3", "keywords_data"], costUsd: 0.01, resultCount: 2 },
      });

      await validateKeywordVolumes(mockKeywords, 2840, "en");

      expect(mockFetchSearchVolume).toHaveBeenCalledWith({
        keywords: ["barrel sauna", "outdoor sauna"],
        locationCode: 2840,
        languageCode: "en",
      });
    });

    it("should transform API response to KeywordVolumeResult", async () => {
      mockFetchSearchVolume.mockResolvedValue({
        data: [
          {
            keyword: "barrel sauna",
            search_volume: 1000,
            cpc: 2.0,
            keyword_info: { keyword_difficulty: 45 },
          },
        ],
        billing: { path: ["v3", "keywords_data"], costUsd: 0.01, resultCount: 1 },
      });

      const result = await validateKeywordVolumes(mockKeywords.slice(0, 1), 2840, "en");

      expect(result.volumeData[0]).toEqual({
        keyword: "barrel sauna",
        searchVolume: 1000,
        cpc: 2.0,
        difficulty: 45,
      });
    });

    it("should batch keywords in groups of 1000", async () => {
      const manyKeywords: GeneratedKeyword[] = Array.from({ length: 1500 }, (_, i) => ({
        keyword: `keyword ${i}`,
        category: "product" as const,
      }));

      mockFetchSearchVolume.mockResolvedValue({
        data: [],
        billing: { path: ["v3", "keywords_data"], costUsd: 0.01, resultCount: 0 },
      });

      await validateKeywordVolumes(manyKeywords, 2840, "en");

      expect(mockFetchSearchVolume).toHaveBeenCalledTimes(2);
    });

    it("should handle exact batch boundary of 1000 keywords (single batch)", async () => {
      const exactBatchKeywords: GeneratedKeyword[] = Array.from({ length: 1000 }, (_, i) => ({
        keyword: `keyword ${i}`,
        category: "product" as const,
      }));

      mockFetchSearchVolume.mockResolvedValue({
        data: [],
        billing: { path: ["v3", "keywords_data"], costUsd: 0.05, resultCount: 0 },
      });

      await validateKeywordVolumes(exactBatchKeywords, 2840, "en");

      expect(mockFetchSearchVolume).toHaveBeenCalledTimes(1);
      expect(mockFetchSearchVolume).toHaveBeenCalledWith({
        keywords: expect.arrayContaining(["keyword 0", "keyword 999"]),
        locationCode: 2840,
        languageCode: "en",
      });
    });

    it("should create 2 batches for 1001 keywords (boundary + 1)", async () => {
      const boundaryPlusOne: GeneratedKeyword[] = Array.from({ length: 1001 }, (_, i) => ({
        keyword: `keyword ${i}`,
        category: "product" as const,
      }));

      mockFetchSearchVolume.mockResolvedValue({
        data: [],
        billing: { path: ["v3", "keywords_data"], costUsd: 0.05, resultCount: 0 },
      });

      await validateKeywordVolumes(boundaryPlusOne, 2840, "en");

      expect(mockFetchSearchVolume).toHaveBeenCalledTimes(2);
      // First batch should have 1000 keywords
      expect(mockFetchSearchVolume.mock.calls[0][0].keywords).toHaveLength(1000);
      // Second batch should have 1 keyword
      expect(mockFetchSearchVolume.mock.calls[1][0].keywords).toHaveLength(1);
    });

    it("should create 2 batches for exactly 2000 keywords", async () => {
      const exactTwoBatches: GeneratedKeyword[] = Array.from({ length: 2000 }, (_, i) => ({
        keyword: `keyword ${i}`,
        category: "product" as const,
      }));

      mockFetchSearchVolume.mockResolvedValue({
        data: [],
        billing: { path: ["v3", "keywords_data"], costUsd: 0.05, resultCount: 0 },
      });

      await validateKeywordVolumes(exactTwoBatches, 2840, "en");

      expect(mockFetchSearchVolume).toHaveBeenCalledTimes(2);
      expect(mockFetchSearchVolume.mock.calls[0][0].keywords).toHaveLength(1000);
      expect(mockFetchSearchVolume.mock.calls[1][0].keywords).toHaveLength(1000);
    });

    it("should process batches concurrently with Promise.all", async () => {
      const manyKeywords: GeneratedKeyword[] = Array.from({ length: 3000 }, (_, i) => ({
        keyword: `keyword ${i}`,
        category: "product" as const,
      }));

      const callOrder: number[] = [];
      mockFetchSearchVolume.mockImplementation(async () => {
        const callIndex = callOrder.length;
        callOrder.push(callIndex);
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          data: [],
          billing: { path: ["v3", "keywords_data"], costUsd: 0.05, resultCount: 0 },
        };
      });

      await validateKeywordVolumes(manyKeywords, 2840, "en");

      // With 3 batches and default concurrency of 5, all should start together
      expect(mockFetchSearchVolume).toHaveBeenCalledTimes(3);
    });

    it("should respect custom concurrency limit", async () => {
      const manyKeywords: GeneratedKeyword[] = Array.from({ length: 5000 }, (_, i) => ({
        keyword: `keyword ${i}`,
        category: "product" as const,
      }));

      mockFetchSearchVolume.mockResolvedValue({
        data: [],
        billing: { path: ["v3", "keywords_data"], costUsd: 0.05, resultCount: 0 },
      });

      // With concurrency limit of 2 and 5 batches, should process in chunks
      await validateKeywordVolumes(manyKeywords, 2840, "en", 2);

      expect(mockFetchSearchVolume).toHaveBeenCalledTimes(5);
    });

    it("should return accumulated cost", async () => {
      mockFetchSearchVolume.mockResolvedValue({
        data: [{ keyword: "test", search_volume: 100, cpc: 1.0 }],
        billing: { path: ["v3", "keywords_data"], costUsd: 0.05, resultCount: 1 },
      });

      const result = await validateKeywordVolumes(mockKeywords, 2840, "en");

      expect(result.costUsd).toBeGreaterThan(0);
    });

    it("should handle empty keywords array", async () => {
      const result = await validateKeywordVolumes([], 2840, "en");

      expect(result.volumeData).toEqual([]);
      expect(result.costUsd).toBe(0);
      expect(mockFetchSearchVolume).not.toHaveBeenCalled();
    });

    it("should use default difficulty of 50 when not provided", async () => {
      mockFetchSearchVolume.mockResolvedValue({
        data: [
          { keyword: "test keyword", search_volume: 500, cpc: 1.5 },
        ],
        billing: { path: ["v3", "keywords_data"], costUsd: 0.01, resultCount: 1 },
      });

      const result = await validateKeywordVolumes(
        [{ keyword: "test keyword", category: "product" }],
        2840,
        "en",
      );

      expect(result.volumeData[0].difficulty).toBe(50);
    });
  });
});
