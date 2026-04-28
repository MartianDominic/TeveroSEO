/**
 * CompetitorSpyService Tests
 *
 * Tests for competitor keyword extraction with caching.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis
vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

// Mock DataForSEO organic keywords
vi.mock("@/server/lib/dataforseo-organic", () => ({
  fetchOrganicKeywords: vi.fn(),
}));

describe("CompetitorSpyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: spyOnCompetitor() fetches top 100 keywords for a domain
  describe("spyOnCompetitor", () => {
    it("should fetch top keywords for a domain", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const { fetchOrganicKeywords } = await import(
        "@/server/lib/dataforseo-organic"
      );
      const mockFetch = fetchOrganicKeywords as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([
        {
          keyword: "competitor keyword 1",
          position: 1,
          searchVolume: 5000,
          cpc: 2.0,
          url: "https://competitor.com/page1",
        },
        {
          keyword: "competitor keyword 2",
          position: 3,
          searchVolume: 3000,
          cpc: 1.5,
          url: "https://competitor.com/page2",
        },
      ]);

      const { CompetitorSpyService } = await import("./CompetitorSpyService");
      const service = new CompetitorSpyService();

      const result = await service.spyOnCompetitor("competitor.com");

      expect(result.domain).toBe("competitor.com");
      expect(result.keywords.length).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        "competitor.com",
        expect.any(Number),
        expect.any(String),
        100
      );
    });

    it("should normalize domain input", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const { fetchOrganicKeywords } = await import(
        "@/server/lib/dataforseo-organic"
      );
      const mockFetch = fetchOrganicKeywords as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([]);

      const { CompetitorSpyService } = await import("./CompetitorSpyService");
      const service = new CompetitorSpyService();

      await service.spyOnCompetitor("https://EXAMPLE.COM/path/page");

      expect(mockFetch).toHaveBeenCalledWith(
        "example.com",
        expect.any(Number),
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  // Test 2: Results include position, volume, CPC, URL
  describe("result structure", () => {
    it("should return keyword details with position, volume, CPC, URL", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const { fetchOrganicKeywords } = await import(
        "@/server/lib/dataforseo-organic"
      );
      const mockFetch = fetchOrganicKeywords as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([
        {
          keyword: "test keyword",
          position: 2,
          searchVolume: 1000,
          cpc: 1.5,
          url: "https://test.com/page",
        },
      ]);

      const { CompetitorSpyService } = await import("./CompetitorSpyService");
      const service = new CompetitorSpyService();

      const result = await service.spyOnCompetitor("test.com");

      expect(result.keywords[0]).toMatchObject({
        keyword: "test keyword",
        position: 2,
        searchVolume: 1000,
        cpc: 1.5,
        url: "https://test.com/page",
      });
      expect(result.keywords[0].trafficShare).toBeDefined();
    });
  });

  // Test 3: Keywords sorted by search volume (highest first)
  describe("sorting", () => {
    it("should sort keywords by search volume descending", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const { fetchOrganicKeywords } = await import(
        "@/server/lib/dataforseo-organic"
      );
      const mockFetch = fetchOrganicKeywords as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([
        { keyword: "low volume", position: 1, searchVolume: 100, cpc: 1, url: "" },
        { keyword: "high volume", position: 5, searchVolume: 5000, cpc: 1, url: "" },
        { keyword: "med volume", position: 3, searchVolume: 1000, cpc: 1, url: "" },
      ]);

      const { CompetitorSpyService } = await import("./CompetitorSpyService");
      const service = new CompetitorSpyService();

      const result = await service.spyOnCompetitor("test.com");

      expect(result.keywords[0].keyword).toBe("high volume");
      expect(result.keywords[1].keyword).toBe("med volume");
      expect(result.keywords[2].keyword).toBe("low volume");
    });
  });

  // Test 4: Cost tracked accurately (~$0.02 per domain)
  describe("cost tracking", () => {
    it("should track cost at 2 cents per domain", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const { fetchOrganicKeywords } = await import(
        "@/server/lib/dataforseo-organic"
      );
      const mockFetch = fetchOrganicKeywords as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([]);

      const { CompetitorSpyService } = await import("./CompetitorSpyService");
      const service = new CompetitorSpyService();

      const result = await service.spyOnCompetitor("test.com");

      expect(result.costCents).toBe(2);
      expect(result.cached).toBe(false);
    });
  });

  // Test: Caching behavior
  describe("caching", () => {
    it("should cache results for 24 hours", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const { fetchOrganicKeywords } = await import(
        "@/server/lib/dataforseo-organic"
      );
      const mockFetch = fetchOrganicKeywords as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([]);

      const { CompetitorSpyService } = await import("./CompetitorSpyService");
      const service = new CompetitorSpyService();

      await service.spyOnCompetitor("test.com");

      // 24 hours = 86400 seconds
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining("competitor-spy:"),
        86400,
        expect.any(String)
      );
    });

    it("should return cached results without API call", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          domain: "cached.com",
          keywords: [{ keyword: "cached kw", position: 1, searchVolume: 500, cpc: 1, url: "", trafficShare: 140 }],
          totalKeywords: 1,
          estimatedTraffic: 140,
        })
      );

      const { fetchOrganicKeywords } = await import(
        "@/server/lib/dataforseo-organic"
      );
      const mockFetch = fetchOrganicKeywords as ReturnType<typeof vi.fn>;

      const { CompetitorSpyService } = await import("./CompetitorSpyService");
      const service = new CompetitorSpyService();

      const result = await service.spyOnCompetitor("cached.com");

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.cached).toBe(true);
      expect(result.costCents).toBe(0);
    });
  });

  // Test: Traffic estimation
  describe("traffic estimation", () => {
    it("should estimate traffic based on position and volume", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const { fetchOrganicKeywords } = await import(
        "@/server/lib/dataforseo-organic"
      );
      const mockFetch = fetchOrganicKeywords as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([
        { keyword: "pos 1", position: 1, searchVolume: 1000, cpc: 1, url: "" },
        { keyword: "pos 10", position: 10, searchVolume: 1000, cpc: 1, url: "" },
      ]);

      const { CompetitorSpyService } = await import("./CompetitorSpyService");
      const service = new CompetitorSpyService();

      const result = await service.spyOnCompetitor("test.com");

      // Position 1 CTR ~28%, Position 10 CTR ~2%
      const pos1 = result.keywords.find((k) => k.keyword === "pos 1");
      const pos10 = result.keywords.find((k) => k.keyword === "pos 10");

      expect(pos1?.trafficShare).toBeGreaterThan(pos10?.trafficShare || 0);
      expect(result.estimatedTraffic).toBeGreaterThan(0);
    });
  });

  // Test: Compare competitors
  describe("compareCompetitors", () => {
    it("should compare multiple domains", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const { fetchOrganicKeywords } = await import(
        "@/server/lib/dataforseo-organic"
      );
      const mockFetch = fetchOrganicKeywords as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue([
        { keyword: "kw", position: 1, searchVolume: 100, cpc: 1, url: "" },
      ]);

      const { CompetitorSpyService } = await import("./CompetitorSpyService");
      const service = new CompetitorSpyService();

      const results = await service.compareCompetitors(["a.com", "b.com"]);

      expect(results.length).toBe(2);
      expect(results[0].domain).toBe("a.com");
      expect(results[1].domain).toBe("b.com");
    });
  });
});
