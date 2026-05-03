/**
 * Tests for SERP cache service with Redis TTL.
 * Phase 36: Content Brief Generation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Redis } from "ioredis";

// Mock redis before importing serp-cache
vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  } as Partial<Redis>,
}));

describe("SerpCache", () => {
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    setex: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    // Reset mocks before each test
    const { redis } = await import("@/server/lib/redis");
    mockRedis = redis as unknown as typeof mockRedis;
    vi.clearAllMocks();
  });

  describe("SERP_CACHE_TTL", () => {
    it("should be 24 hours in seconds", async () => {
      const { SERP_CACHE_TTL } = await import("./serp-cache");
      expect(SERP_CACHE_TTL).toBe(86400); // 24 * 60 * 60
    });
  });

  describe("buildSerpCacheKey", () => {
    it("should generate correct cache key format with clientId", async () => {
      const { buildSerpCacheKey } = await import("./serp-cache");
      const key = buildSerpCacheKey("client_abc", "mapping_123", "seo tools");
      // Key should include osm:serp: prefix for proper namespacing
      expect(key).toBe("osm:serp:client_abc:mapping_123:seo tools");
    });

    it("should include clientId in key for tenant isolation", async () => {
      const { buildSerpCacheKey } = await import("./serp-cache");
      const key = buildSerpCacheKey("client_xyz", "mapping_456", "keyword");
      expect(key).toContain("client_xyz");
    });

    it("should include mappingId in key", async () => {
      const { buildSerpCacheKey } = await import("./serp-cache");
      const key = buildSerpCacheKey("client_abc", "mapping_456", "keyword");
      expect(key).toContain("mapping_456");
    });

    it("should include keyword in key", async () => {
      const { buildSerpCacheKey } = await import("./serp-cache");
      const key = buildSerpCacheKey("client_abc", "mapping_123", "test keyword");
      expect(key).toContain("test keyword");
    });

    it("should use osm:serp namespace prefix", async () => {
      const { buildSerpCacheKey } = await import("./serp-cache");
      const key = buildSerpCacheKey("client_abc", "mapping_123", "keyword");
      expect(key.startsWith("osm:serp:")).toBe(true);
    });
  });

  describe("getCachedSerp", () => {
    it("should return null when key does not exist", async () => {
      mockRedis.get.mockResolvedValue(null);
      const { getCachedSerp } = await import("./serp-cache");

      const result = await getCachedSerp("serp:mapping_123:keyword");

      expect(mockRedis.get).toHaveBeenCalledWith("serp:mapping_123:keyword");
      expect(result).toBeNull();
    });

    it("should return parsed SERP data when cached", async () => {
      const cachedData = {
        commonH2s: [{ heading: "Test", frequency: 5 }],
        paaQuestions: ["What is test?"],
        competitorWordCounts: [1500],
        metaLengths: { title: 60, description: 155 },
        analyzedAt: "2026-04-23T12:00:00Z",
        location: "United States",
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const { getCachedSerp } = await import("./serp-cache");
      const result = await getCachedSerp("serp:mapping_123:keyword");

      expect(result).toEqual(cachedData);
    });

    it("should handle JSON parse errors gracefully", async () => {
      // The L1 cache may still have the previous valid entry from other tests
      // Clear the mock and set up invalid JSON for L2
      mockRedis.get.mockResolvedValue("invalid json");
      mockRedis.del.mockResolvedValue(1);

      const { getCachedSerp } = await import("./serp-cache");

      // With safeJsonParse, corrupted cache returns null instead of throwing
      // and the corrupted entry is deleted
      const result = await getCachedSerp("osm:serp:mapping_123:keyword_invalid");
      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe("setCachedSerp", () => {
    it("should call redis.setex with correct TTL", async () => {
      const serpData = {
        commonH2s: [],
        paaQuestions: [],
        competitorWordCounts: [],
        metaLengths: { title: 60, description: 155 },
        analyzedAt: "2026-04-23T12:00:00Z",
        location: "United States",
      };
      mockRedis.setex.mockResolvedValue("OK");

      const { setCachedSerp, SERP_CACHE_TTL } = await import("./serp-cache");
      await setCachedSerp("serp:mapping_123:keyword", serpData);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "serp:mapping_123:keyword",
        SERP_CACHE_TTL,
        JSON.stringify(serpData)
      );
    });

    it("should store data with 24h TTL", async () => {
      const serpData = {
        commonH2s: [],
        paaQuestions: [],
        competitorWordCounts: [],
        metaLengths: { title: 60, description: 155 },
        analyzedAt: "2026-04-23T12:00:00Z",
        location: "United States",
      };
      mockRedis.setex.mockResolvedValue("OK");

      const { setCachedSerp } = await import("./serp-cache");
      await setCachedSerp("serp:key", serpData);

      const call = mockRedis.setex.mock.calls[0];
      expect(call[1]).toBe(86400); // 24 hours
    });
  });

  describe("invalidateSerpCache", () => {
    it("should call redis.del with correct key", async () => {
      mockRedis.del.mockResolvedValue(1);

      const { invalidateSerpCache } = await import("./serp-cache");
      await invalidateSerpCache("serp:mapping_123:keyword");

      expect(mockRedis.del).toHaveBeenCalledWith("serp:mapping_123:keyword");
    });

    it("should handle deletion of non-existent key", async () => {
      mockRedis.del.mockResolvedValue(0);

      const { invalidateSerpCache } = await import("./serp-cache");
      const result = await invalidateSerpCache("serp:nonexistent");

      expect(mockRedis.del).toHaveBeenCalledWith("serp:nonexistent");
      expect(result).toBeUndefined();
    });
  });
});
