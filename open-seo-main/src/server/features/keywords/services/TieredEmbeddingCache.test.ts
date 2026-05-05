import { describe, it, expect, vi, beforeEach } from "vitest";
import { TieredEmbeddingCache, type RedisClient } from "./TieredEmbeddingCache";

describe("TieredEmbeddingCache", () => {
  const mockVector = [0.1, 0.2, 0.3, 0.4, 0.5];

  describe("L1-only mode (no Redis)", () => {
    it("returns null for uncached text", async () => {
      const cache = new TieredEmbeddingCache();
      const result = await cache.get("test keyword");
      expect(result).toBeNull();
    });

    it("returns cached vector after set", async () => {
      const cache = new TieredEmbeddingCache();
      await cache.set("test keyword", mockVector);
      const result = await cache.get("test keyword");
      expect(result).toEqual(mockVector);
    });

    it("tracks L1 hits in stats", async () => {
      const cache = new TieredEmbeddingCache();
      await cache.set("test keyword", mockVector);
      await cache.get("test keyword");
      await cache.get("test keyword");

      const stats = cache.getStats();
      expect(stats.l1Hits).toBe(2);
      expect(stats.l2Hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(1);
    });

    it("tracks misses in stats", async () => {
      const cache = new TieredEmbeddingCache();
      await cache.get("nonexistent");
      await cache.get("another nonexistent");

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe("L1 + L2 mode (with Redis)", () => {
    let mockRedis: RedisClient;

    beforeEach(() => {
      mockRedis = {
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn().mockResolvedValue("OK"),
        mget: vi.fn().mockResolvedValue([]),
      };
    });

    it("writes to Redis on set", async () => {
      const cache = new TieredEmbeddingCache(mockRedis);
      await cache.set("test keyword", mockVector);

      // Wait for async Redis write
      await new Promise((r) => setTimeout(r, 10));

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^emb:v5:/),
        expect.any(Number),
        JSON.stringify(mockVector)
      );
    });

    it("reads from Redis on L1 miss", async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockVector));

      const cache = new TieredEmbeddingCache(mockRedis);
      const result = await cache.get("test keyword");

      expect(result).toEqual(mockVector);
      expect(mockRedis.get).toHaveBeenCalled();

      const stats = cache.getStats();
      expect(stats.l2Hits).toBe(1);
    });

    it("promotes L2 hit to L1", async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockVector));

      const cache = new TieredEmbeddingCache(mockRedis);

      // First get - from Redis
      await cache.get("test keyword");
      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      // Reset mock
      vi.mocked(mockRedis.get).mockClear();

      // Second get - should be from L1
      const result = await cache.get("test keyword");
      expect(result).toEqual(mockVector);
      expect(mockRedis.get).not.toHaveBeenCalled(); // Should not hit Redis

      const stats = cache.getStats();
      expect(stats.l1Hits).toBe(1);
      expect(stats.l2Hits).toBe(1);
    });

    it("handles Redis errors gracefully", async () => {
      vi.mocked(mockRedis.get).mockRejectedValue(new Error("Redis connection failed"));

      const cache = new TieredEmbeddingCache(mockRedis);
      const result = await cache.get("test keyword");

      expect(result).toBeNull();
      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
    });
  });

  describe("getMany", () => {
    it("returns multiple results", async () => {
      const cache = new TieredEmbeddingCache();
      await cache.set("keyword1", [0.1, 0.2]);
      await cache.set("keyword2", [0.3, 0.4]);

      const results = await cache.getMany(["keyword1", "keyword2", "keyword3"]);

      expect(results[0]).toEqual([0.1, 0.2]);
      expect(results[1]).toEqual([0.3, 0.4]);
      expect(results[2]).toBeNull();
    });

    it("uses Redis mget for batch lookups", async () => {
      const mockRedis: RedisClient = {
        get: vi.fn(),
        setex: vi.fn().mockResolvedValue("OK"),
        mget: vi.fn().mockResolvedValue([JSON.stringify([0.5, 0.6]), null]),
      };

      const cache = new TieredEmbeddingCache(mockRedis);
      const results = await cache.getMany(["keyword1", "keyword2"]);

      expect(mockRedis.mget).toHaveBeenCalled();
      expect(results[0]).toEqual([0.5, 0.6]);
      expect(results[1]).toBeNull();
    });
  });

  describe("setMany", () => {
    it("sets multiple values", async () => {
      const cache = new TieredEmbeddingCache();
      await cache.setMany(["k1", "k2"], [[0.1], [0.2]]);

      const r1 = await cache.get("k1");
      const r2 = await cache.get("k2");

      expect(r1).toEqual([0.1]);
      expect(r2).toEqual([0.2]);
    });
  });

  describe("hit rate calculation", () => {
    it("calculates correct hit rate", async () => {
      const cache = new TieredEmbeddingCache();
      await cache.set("hit1", mockVector);
      await cache.set("hit2", mockVector);

      await cache.get("hit1"); // L1 hit
      await cache.get("hit2"); // L1 hit
      await cache.get("miss1"); // miss
      await cache.get("miss2"); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.5); // 2 hits / 4 total
    });
  });

  describe("resetStats", () => {
    it("resets all stats to zero", async () => {
      const cache = new TieredEmbeddingCache();
      await cache.set("test", mockVector);
      await cache.get("test");
      await cache.get("miss");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.l1Hits).toBe(0);
      expect(stats.l2Hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});
