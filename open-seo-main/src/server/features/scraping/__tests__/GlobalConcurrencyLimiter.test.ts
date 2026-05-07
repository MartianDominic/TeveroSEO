/**
 * GlobalConcurrencyLimiter Unit Tests.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GlobalConcurrencyLimiter } from "../ratelimit/GlobalConcurrencyLimiter";

// Mock Redis client
function createMockRedis() {
  const sortedSet: { score: number; member: string }[] = [];

  return {
    zremrangebyscore: vi.fn(async (key: string, min: string, max: string) => {
      const maxScore = parseFloat(max);
      const removed = sortedSet.filter((e) => e.score <= maxScore).length;
      sortedSet.splice(
        0,
        sortedSet.length,
        ...sortedSet.filter((e) => e.score > maxScore)
      );
      return removed;
    }),
    zcard: vi.fn(async () => sortedSet.length),
    zadd: vi.fn(async (key: string, score: string, member: string) => {
      sortedSet.push({ score: parseFloat(score), member });
      sortedSet.sort((a, b) => a.score - b.score);
      return 1;
    }),
    zrank: vi.fn(async (key: string, member: string) => {
      const index = sortedSet.findIndex((e) => e.member === member);
      return index >= 0 ? index : null;
    }),
    zrem: vi.fn(async (key: string, member: string) => {
      const index = sortedSet.findIndex((e) => e.member === member);
      if (index >= 0) {
        sortedSet.splice(index, 1);
        return 1;
      }
      return 0;
    }),
    zrange: vi.fn(async () => sortedSet.map((e) => e.member)),
    del: vi.fn(async () => {
      const count = sortedSet.length;
      sortedSet.length = 0;
      return count;
    }),
    // Test helpers
    _sortedSet: sortedSet,
    _clear: () => (sortedSet.length = 0),
  };
}

describe("GlobalConcurrencyLimiter", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let limiter: GlobalConcurrencyLimiter;

  beforeEach(() => {
    mockRedis = createMockRedis();
    limiter = new GlobalConcurrencyLimiter(mockRedis as never, {
      maxConcurrent: 3,
      defaultTimeoutMs: 5_000,
      staleThresholdMs: 300_000,
      retryIntervalMs: 10, // Fast for testing
    });
  });

  describe("acquire", () => {
    it("should acquire slot when under limit", async () => {
      const result = await limiter.acquire("request-1");

      expect(result.acquired).toBe(true);
      expect(result.position).toBe(0);
      expect(result.waitedMs).toBeGreaterThanOrEqual(0);
    });

    it("should acquire multiple slots up to limit", async () => {
      await limiter.acquire("request-1");
      await limiter.acquire("request-2");
      const result = await limiter.acquire("request-3");

      expect(result.acquired).toBe(true);
      expect(result.position).toBe(2);
    });

    it("should fail to acquire when at limit and timeout", async () => {
      // Fill up slots
      await limiter.acquire("request-1");
      await limiter.acquire("request-2");
      await limiter.acquire("request-3");

      // Try to acquire 4th slot with short timeout
      const result = await limiter.acquire("request-4", 50);

      expect(result.acquired).toBe(false);
      expect(result.waitedMs).toBeGreaterThanOrEqual(50);
    });

    it("should add entry to Redis sorted set", async () => {
      await limiter.acquire("request-1");

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "scrape:concurrency:global",
        expect.any(String),
        "request-1"
      );
    });

    it("should clean up stale entries", async () => {
      await limiter.acquire("request-1");

      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
    });
  });

  describe("release", () => {
    it("should remove entry from sorted set", async () => {
      await limiter.acquire("request-1");
      await limiter.release("request-1");

      expect(mockRedis.zrem).toHaveBeenCalledWith(
        "scrape:concurrency:global",
        "request-1"
      );
    });

    it("should allow new acquire after release", async () => {
      await limiter.acquire("request-1");
      await limiter.acquire("request-2");
      await limiter.acquire("request-3");
      // At limit

      await limiter.release("request-1");

      const result = await limiter.acquire("request-4", 100);
      expect(result.acquired).toBe(true);
    });
  });

  describe("getCurrentLoad", () => {
    it("should return correct load stats", async () => {
      await limiter.acquire("request-1");
      await limiter.acquire("request-2");

      const load = await limiter.getCurrentLoad();

      expect(load.current).toBe(2);
      expect(load.max).toBe(3);
      expect(load.utilization).toBeCloseTo(2 / 3, 2);
    });

    it("should return 0 utilization when empty", async () => {
      const load = await limiter.getCurrentLoad();

      expect(load.current).toBe(0);
      expect(load.utilization).toBe(0);
    });
  });

  describe("isAtCapacity", () => {
    it("should return false when under limit", async () => {
      await limiter.acquire("request-1");

      const atCapacity = await limiter.isAtCapacity();

      expect(atCapacity).toBe(false);
    });

    it("should return true when at limit", async () => {
      await limiter.acquire("request-1");
      await limiter.acquire("request-2");
      await limiter.acquire("request-3");

      const atCapacity = await limiter.isAtCapacity();

      expect(atCapacity).toBe(true);
    });
  });

  describe("getAvailableSlots", () => {
    it("should return correct available slots", async () => {
      await limiter.acquire("request-1");

      const available = await limiter.getAvailableSlots();

      expect(available).toBe(2);
    });

    it("should return 0 when at capacity", async () => {
      await limiter.acquire("request-1");
      await limiter.acquire("request-2");
      await limiter.acquire("request-3");

      const available = await limiter.getAvailableSlots();

      expect(available).toBe(0);
    });
  });

  describe("getActiveRequests", () => {
    it("should return all active request IDs", async () => {
      await limiter.acquire("request-1");
      await limiter.acquire("request-2");

      const active = await limiter.getActiveRequests();

      expect(active).toContain("request-1");
      expect(active).toContain("request-2");
    });
  });

  describe("forceReleaseAll", () => {
    it("should release all slots and return count", async () => {
      await limiter.acquire("request-1");
      await limiter.acquire("request-2");

      const released = await limiter.forceReleaseAll();

      expect(released).toBe(2);
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe("withSlot", () => {
    it("should acquire slot, run function, then release", async () => {
      let ranInSlot = false;

      await limiter.withSlot("request-1", async () => {
        ranInSlot = true;
        const load = await limiter.getCurrentLoad();
        expect(load.current).toBe(1);
        return "result";
      });

      expect(ranInSlot).toBe(true);
      const loadAfter = await limiter.getCurrentLoad();
      expect(loadAfter.current).toBe(0);
    });

    it("should release slot even on error", async () => {
      await expect(
        limiter.withSlot("request-1", async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");

      const load = await limiter.getCurrentLoad();
      expect(load.current).toBe(0);
    });

    it("should throw when cannot acquire slot", async () => {
      // Fill up slots
      await limiter.acquire("request-1");
      await limiter.acquire("request-2");
      await limiter.acquire("request-3");

      await expect(
        limiter.withSlot(
          "request-4",
          async () => "should not run",
          50
        )
      ).rejects.toThrow("Failed to acquire concurrency slot");
    });
  });

  describe("configuration", () => {
    it("should return config via getConfig", () => {
      const config = limiter.getConfig();

      expect(config.maxConcurrent).toBe(3);
      expect(config.defaultTimeoutMs).toBe(5_000);
    });

    it("should allow updating config", () => {
      limiter.updateConfig({ maxConcurrent: 5 });

      const config = limiter.getConfig();
      expect(config.maxConcurrent).toBe(5);
    });
  });
});
