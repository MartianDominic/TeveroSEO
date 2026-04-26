/**
 * QuickCheckService Tests
 *
 * Tests for no-workspace keyword validation with caching and sharing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis
vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

// Mock DataForSEO
vi.mock("@/server/lib/dataforseo", () => ({
  fetchKeywordMetrics: vi.fn(),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "mock-token-12345"),
}));

describe("QuickCheckService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: checkKeywords() accepts 1-20 keywords, rejects >20
  describe("keyword limit validation", () => {
    it("should accept 1-20 keywords", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);

      const { fetchKeywordMetrics } = await import("@/server/lib/dataforseo");
      const mockFetch = fetchKeywordMetrics as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([
        {
          keyword: "test keyword",
          searchVolume: 1000,
          cpc: 1.5,
          competition: 0.5,
          competitionLevel: "medium",
        },
      ]);

      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      const result = await service.checkKeywords(["test keyword"]);

      expect(result.keywords.length).toBeGreaterThanOrEqual(1);
    });

    it("should reject empty keyword array", async () => {
      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      await expect(service.checkKeywords([])).rejects.toThrow(
        "At least one keyword is required"
      );
    });

    it("should reject more than 20 keywords", async () => {
      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      const keywords = Array.from({ length: 21 }, (_, i) => `keyword ${i}`);

      await expect(service.checkKeywords(keywords)).rejects.toThrow(
        "Maximum 20 keywords allowed"
      );
    });
  });

  // Test 2: Results include volume, difficulty, CPC, competition level
  describe("result metrics", () => {
    it("should return keyword metrics including volume, difficulty, CPC, competition", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);

      const { fetchKeywordMetrics } = await import("@/server/lib/dataforseo");
      const mockFetch = fetchKeywordMetrics as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([
        {
          keyword: "seo tools",
          searchVolume: 5000,
          cpc: 2.5,
          competition: 0.7,
          competitionLevel: "high",
        },
      ]);

      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      const result = await service.checkKeywords(["seo tools"]);

      expect(result.keywords[0]).toMatchObject({
        keyword: "seo tools",
        searchVolume: 5000,
        cpc: 2.5,
        competitionLevel: "high",
      });
      expect(result.keywords[0].keywordDifficulty).toBeDefined();
    });
  });

  // Test 3: Results cached in Redis for 7 days
  describe("caching", () => {
    it("should cache results in Redis for 7 days", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const { fetchKeywordMetrics } = await import("@/server/lib/dataforseo");
      const mockFetch = fetchKeywordMetrics as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([
        {
          keyword: "cached keyword",
          searchVolume: 1000,
          cpc: 1.0,
          competition: 0.3,
          competitionLevel: "low",
        },
      ]);

      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      await service.checkKeywords(["cached keyword"]);

      // Verify setex was called with 7 days TTL (604800 seconds)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining("kw-metrics:"),
        604800,
        expect.any(String)
      );
    });

    it("should return cached results without API call", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          searchVolume: 2000,
          keywordDifficulty: 60,
          cpc: 1.8,
          competition: 0.6,
        })
      );

      const { fetchKeywordMetrics } = await import("@/server/lib/dataforseo");
      const mockFetch = fetchKeywordMetrics as ReturnType<typeof vi.fn>;

      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      const result = await service.checkKeywords(["cached"]);

      // Should not call API
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.cached).toBe(1);
      expect(result.enriched).toBe(0);
    });
  });

  // Test 4: generateShareLink() creates unique token for public access
  describe("share link generation", () => {
    it("should generate share link with unique token", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.setex.mockResolvedValue("OK");

      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      const mockResult = {
        keywords: [
          {
            keyword: "test",
            searchVolume: 100,
            keywordDifficulty: 30,
            cpc: 0.5,
            competition: 0.3,
            competitionLevel: "low" as const,
          },
        ],
        totalVolume: 100,
        costCents: 0.5,
        cached: 0,
        enriched: 1,
      };

      const shareResult = await service.generateShareLink(mockResult);

      expect(shareResult.token).toBeDefined();
      expect(shareResult.shareUrl).toContain("/share/quick-check/");
      expect(shareResult.expiresAt).toBeInstanceOf(Date);
    });

    it("should store share data with 30-day TTL", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.setex.mockResolvedValue("OK");

      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      const mockResult = {
        keywords: [],
        totalVolume: 0,
        costCents: 0,
        cached: 0,
        enriched: 0,
      };

      await service.generateShareLink(mockResult);

      // 30 days = 2592000 seconds
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining("quick-check:"),
        2592000,
        expect.any(String)
      );
    });
  });

  // Test 5: getSharedResults() retrieves results by token
  describe("retrieve shared results", () => {
    it("should retrieve shared results by token", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };

      const storedResult = {
        result: {
          keywords: [
            {
              keyword: "shared keyword",
              searchVolume: 500,
              keywordDifficulty: 40,
              cpc: 1.0,
              competition: 0.4,
              competitionLevel: "medium",
            },
          ],
          totalVolume: 500,
          costCents: 0.5,
          cached: 0,
          enriched: 1,
        },
        createdAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(storedResult));

      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      const result = await service.getSharedResults("valid-token");

      expect(result).not.toBeNull();
      expect(result?.keywords[0].keyword).toBe("shared keyword");
    });

    it("should return null for invalid token", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);

      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      const result = await service.getSharedResults("invalid-token");

      expect(result).toBeNull();
    });
  });

  // Test: Competition level calculation
  describe("competition level calculation", () => {
    it("should calculate competition level correctly", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);

      const { fetchKeywordMetrics } = await import("@/server/lib/dataforseo");
      const mockFetch = fetchKeywordMetrics as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([
        { keyword: "low comp", searchVolume: 100, cpc: 1, competition: 0.2, competitionLevel: "low" },
        { keyword: "med comp", searchVolume: 100, cpc: 1, competition: 0.5, competitionLevel: "medium" },
        { keyword: "high comp", searchVolume: 100, cpc: 1, competition: 0.8, competitionLevel: "high" },
      ]);

      const { QuickCheckService } = await import("./QuickCheckService");
      const service = new QuickCheckService();

      const result = await service.checkKeywords(["low comp", "med comp", "high comp"]);

      const low = result.keywords.find(k => k.keyword === "low comp");
      const med = result.keywords.find(k => k.keyword === "med comp");
      const high = result.keywords.find(k => k.keyword === "high comp");

      expect(low?.competitionLevel).toBe("low");
      expect(med?.competitionLevel).toBe("medium");
      expect(high?.competitionLevel).toBe("high");
    });
  });
});
