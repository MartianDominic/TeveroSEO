/**
 * Tests for SERP analyzer service with competitor extraction.
 * Phase 36: Content Brief Generation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SerpLiveItem } from "@/server/lib/dataforseoSchemas";

// Mock dependencies
vi.mock("@/server/lib/dataforseo", () => ({
  fetchLiveSerpItemsRaw: vi.fn(),
}));

vi.mock("@/server/lib/cache/serp-cache", () => ({
  buildSerpCacheKey: vi.fn((mappingId, keyword) => `serp:${mappingId}:${keyword}`),
  getCachedSerp: vi.fn(),
  setCachedSerp: vi.fn(),
}));

describe("SerpAnalyzer", () => {
  const mockSerpItems: SerpLiveItem[] = [
    {
      type: "organic",
      rank_absolute: 1,
      domain: "example1.com",
      title: "Complete Guide to SEO Tools - Best Practices",
      description: "Learn about the best SEO tools available in 2026. This comprehensive guide covers everything you need to know about SEO optimization.",
      url: "https://example1.com/seo-tools",
    },
    {
      type: "organic",
      rank_absolute: 2,
      domain: "example2.com",
      title: "Top 10 SEO Tools for Agencies",
      description: "Discover the most powerful SEO tools for agencies and enterprise teams.",
      url: "https://example2.com/tools",
    },
    {
      type: "people_also_ask",
      title: "What are the best SEO tools?",
      description: null,
      url: null,
    },
    {
      type: "people_also_ask",
      title: "How do SEO tools work?",
      description: null,
      url: null,
    },
    {
      type: "people_also_ask",
      title: "Are free SEO tools effective?",
      description: null,
      url: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractPAAQuestions", () => {
    it("should extract all PAA questions from SERP items", async () => {
      const { extractPAAQuestions } = await import("./SerpAnalyzer");
      const questions = extractPAAQuestions(mockSerpItems);

      expect(questions).toHaveLength(3);
      expect(questions).toContain("What are the best SEO tools?");
      expect(questions).toContain("How do SEO tools work?");
      expect(questions).toContain("Are free SEO tools effective?");
    });

    it("should return empty array when no PAA items exist", async () => {
      const { extractPAAQuestions } = await import("./SerpAnalyzer");
      const organicOnly: SerpLiveItem[] = [
        {
          type: "organic",
          rank_absolute: 1,
          title: "Test",
          description: "Test description",
          url: "https://test.com",
        },
      ];

      const questions = extractPAAQuestions(organicOnly);
      expect(questions).toEqual([]);
    });

    it("should handle items without titles", async () => {
      const { extractPAAQuestions } = await import("./SerpAnalyzer");
      const paaWithoutTitle: SerpLiveItem[] = [
        {
          type: "people_also_ask",
          title: null,
          description: null,
          url: null,
        },
      ];

      const questions = extractPAAQuestions(paaWithoutTitle);
      expect(questions).toEqual([]);
    });
  });

  describe("calculateMetaLengths", () => {
    it("should calculate average title and description lengths", async () => {
      const { calculateMetaLengths } = await import("./SerpAnalyzer");
      const lengths = calculateMetaLengths(mockSerpItems);

      expect(lengths.title).toBeGreaterThan(0);
      expect(lengths.description).toBeGreaterThan(0);
    });

    it("should handle items without titles or descriptions", async () => {
      const { calculateMetaLengths } = await import("./SerpAnalyzer");
      const incomplete: SerpLiveItem[] = [
        {
          type: "organic",
          rank_absolute: 1,
          title: null,
          description: null,
          url: "https://test.com",
        },
      ];

      const lengths = calculateMetaLengths(incomplete);
      expect(lengths.title).toBe(0);
      expect(lengths.description).toBe(0);
    });

    it("should only consider organic results", async () => {
      const { calculateMetaLengths } = await import("./SerpAnalyzer");
      const lengths = calculateMetaLengths(mockSerpItems);

      // Should only count the 2 organic items
      expect(lengths.title).toBe(
        Math.round(
          ("Complete Guide to SEO Tools - Best Practices".length +
            "Top 10 SEO Tools for Agencies".length) /
            2
        )
      );
    });
  });

  describe("analyzeSerpForKeyword", () => {
    beforeEach(async () => {
      const { getCachedSerp, setCachedSerp } = await import(
        "@/server/lib/cache/serp-cache"
      );
      const { fetchLiveSerpItemsRaw } = await import(
        "@/server/lib/dataforseo"
      );

      vi.mocked(getCachedSerp).mockResolvedValue(null);
      vi.mocked(setCachedSerp).mockResolvedValue(undefined);
      vi.mocked(fetchLiveSerpItemsRaw).mockResolvedValue({
        version: "0.1.0",
        status_code: 20000,
        status_message: "Ok.",
        time: "1.234",
        cost: 0.005,
        tasks_count: 1,
        tasks_error: 0,
        tasks: [
          {
            id: "test-task-id",
            status_code: 20000,
            status_message: "Ok.",
            time: "1.234",
            cost: 0.005,
            result_count: 1,
            path: [],
            data: {},
            result: [
              {
                keyword: "seo tools",
                location_code: 2840,
                language_code: "en",
                items: mockSerpItems,
              },
            ],
          },
        ],
      });
    });

    it("should return cached data when available", async () => {
      const { getCachedSerp } = await import("@/server/lib/cache/serp-cache");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      const cachedData = {
        commonH2s: [{ heading: "Cached H2", frequency: 5 }],
        paaQuestions: ["Cached question?"],
        competitorWordCounts: [1500],
        metaLengths: { title: 60, description: 155 },
        analyzedAt: "2026-04-23T12:00:00Z",
        location: "United States",
      };

      vi.mocked(getCachedSerp).mockResolvedValue(cachedData);

      const result = await analyzeSerpForKeyword("mapping_123", "seo tools");

      expect(result).toEqual(cachedData);
      expect(getCachedSerp).toHaveBeenCalledWith("serp:mapping_123:seo tools");
    });

    it("should fetch from DataForSEO when cache misses", async () => {
      const { fetchLiveSerpItemsRaw } = await import(
        "@/server/lib/dataforseo"
      );
      const { getCachedSerp } = await import("@/server/lib/cache/serp-cache");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      vi.mocked(getCachedSerp).mockResolvedValue(null);

      await analyzeSerpForKeyword("mapping_123", "seo tools");

      expect(getCachedSerp).toHaveBeenCalled();
      expect(fetchLiveSerpItemsRaw).toHaveBeenCalledWith(
        "seo tools",
        2840,
        "en"
      );
    });

    it("should cache result after API call", async () => {
      const { setCachedSerp } = await import("@/server/lib/cache/serp-cache");
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      await analyzeSerpForKeyword("mapping_123", "seo tools");

      expect(setCachedSerp).toHaveBeenCalledWith(
        "serp:mapping_123:seo tools",
        expect.objectContaining({
          paaQuestions: expect.any(Array),
          metaLengths: expect.any(Object),
          analyzedAt: expect.any(String),
          location: expect.any(String),
        })
      );
    });

    it("should include analyzed timestamp in result", async () => {
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      const result = await analyzeSerpForKeyword("mapping_123", "seo tools");

      expect(result.analyzedAt).toBeDefined();
      expect(new Date(result.analyzedAt).getTime()).toBeGreaterThan(0);
    });

    it("should use default location code 2840 (US)", async () => {
      const { fetchLiveSerpItemsRaw } = await import(
        "@/server/lib/dataforseo"
      );
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      await analyzeSerpForKeyword("mapping_123", "seo tools");

      expect(fetchLiveSerpItemsRaw).toHaveBeenCalledWith(
        "seo tools",
        2840,
        "en"
      );
    });

    it("should accept custom location code", async () => {
      const { fetchLiveSerpItemsRaw } = await import(
        "@/server/lib/dataforseo"
      );
      const { analyzeSerpForKeyword } = await import("./SerpAnalyzer");

      await analyzeSerpForKeyword("mapping_123", "seo tools", 2826); // UK

      expect(fetchLiveSerpItemsRaw).toHaveBeenCalledWith(
        "seo tools",
        2826,
        "en"
      );
    });
  });
});
