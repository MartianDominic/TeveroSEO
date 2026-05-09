/**
 * CacheManager Tests
 * Phase 95-02: Multi-Level Caching
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Redis } from "ioredis";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { CacheManager, createCacheManager } from "../CacheManager";
import type { CachedPage } from "../types";

// =============================================================================
// Mock Dependencies
// =============================================================================

// Mock L1Cache
vi.mock("../L1Cache", () => ({
  L1Cache: vi.fn(),
  createL1Cache: vi.fn(() => ({
    level: "L1",
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getStats: vi.fn(() => ({ hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 })),
    resetStats: vi.fn(),
    clear: vi.fn(),
    getKeys: vi.fn(() => []),
    getCurrentSize: vi.fn(() => 0),
    getItemCount: vi.fn(() => 0),
  })),
}));

// Mock L2Cache
vi.mock("../L2Cache", () => ({
  L2Cache: vi.fn(),
  createL2Cache: vi.fn(() => ({
    level: "L2",
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getStats: vi.fn(() => ({ hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 })),
    resetStats: vi.fn(),
    clear: vi.fn(),
    shouldSkipCache: vi.fn().mockResolvedValue(false),
    markSkipCache: vi.fn(),
    getRevalidationHeaders: vi.fn().mockResolvedValue(null),
  })),
}));

// Mock L3Cache
vi.mock("../L3Cache", () => ({
  L3Cache: vi.fn(),
  createL3Cache: vi.fn(() => ({
    level: "L3",
    get: vi.fn(),
    set: vi.fn(),
    setWithUrl: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getStats: vi.fn(() => ({ hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 })),
    resetStats: vi.fn(),
    clear: vi.fn(),
    mget: vi.fn().mockResolvedValue(new Map()),
    deleteExpired: vi.fn().mockResolvedValue(0),
    getStorageStats: vi.fn().mockResolvedValue({
      totalEntries: 0,
      totalAliases: 0,
      totalSizeBytes: 0,
      avgSizeBytes: 0,
      oldestEntry: null,
      newestEntry: null,
    }),
  })),
}));

// Mock L4Cache
vi.mock("../L4Cache", () => ({
  L4Cache: vi.fn(),
  createL4Cache: vi.fn(() => ({
    level: "L4",
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getStats: vi.fn(() => ({ hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 })),
    resetStats: vi.fn(),
    clear: vi.fn(),
    getStorageStats: vi.fn().mockResolvedValue({
      totalObjects: 0,
      totalSizeBytes: 0,
    }),
  })),
}));

// Import mocked modules
import { createL1Cache } from "../L1Cache";
import { createL2Cache } from "../L2Cache";
import { createL3Cache } from "../L3Cache";
import { createL4Cache } from "../L4Cache";

// =============================================================================
// Test Helpers
// =============================================================================

function createMockRedis(): Redis {
  return {
    sadd: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  } as unknown as Redis;
}

function createMockDb(): PostgresJsDatabase {
  return {} as PostgresJsDatabase;
}

function createMockPage(overrides: Partial<CachedPage> = {}): CachedPage {
  return {
    html: "<html><body><h1>Test</h1></body></html>",
    contentHash: "abc123def456gh78",
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
    tierUsed: "direct",
    statusCode: 200,
    pageSizeBytes: 1000,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("CacheManager", () => {
  let manager: CacheManager;
  let mockRedis: Redis;
  let mockDb: PostgresJsDatabase;
  let mockL1: ReturnType<typeof createL1Cache>;
  let mockL2: ReturnType<typeof createL2Cache>;
  let mockL3: ReturnType<typeof createL3Cache>;
  let mockL4: ReturnType<typeof createL4Cache>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedis = createMockRedis();
    mockDb = createMockDb();

    manager = createCacheManager({
      redis: mockRedis,
      db: mockDb,
    });

    // Get mock instances
    mockL1 = (createL1Cache as any).mock.results[0].value;
    mockL2 = (createL2Cache as any).mock.results[0].value;
    mockL3 = (createL3Cache as any).mock.results[0].value;
    mockL4 = (createL4Cache as any).mock.results[0].value;
  });

  describe("factory", () => {
    it("should create CacheManager instance", () => {
      expect(manager).toBeInstanceOf(CacheManager);
    });

    it("should initialize all cache levels", () => {
      expect(createL1Cache).toHaveBeenCalled();
      expect(createL2Cache).toHaveBeenCalled();
      expect(createL3Cache).toHaveBeenCalled();
      expect(createL4Cache).toHaveBeenCalled();
    });

    it("should accept custom config", () => {
      const customManager = createCacheManager({
        redis: mockRedis,
        db: mockDb,
        config: {
          l1: {
            maxSizeBytes: 50 * 1024 * 1024,
            maxItems: 2000,
            defaultTtlMs: 5 * 60 * 1000,
            updateAgeOnGet: true,
          },
        },
      });
      expect(customManager).toBeInstanceOf(CacheManager);
    });
  });

  describe("get", () => {
    it("should return L1 hit when available", async () => {
      const mockPage = createMockPage();
      mockL1.get = vi.fn().mockResolvedValue(mockPage);

      const result = await manager.get("https://example.com/page");

      expect(result.hit).toBe(true);
      expect(result.level).toBe("L1");
      expect(result.data).toBe(mockPage);
      expect(mockL1.get).toHaveBeenCalled();
      expect(mockL2.get).not.toHaveBeenCalled();
    });

    it("should check L2 when L1 misses", async () => {
      const mockPage = createMockPage();
      mockL1.get = vi.fn().mockResolvedValue(null);
      mockL2.get = vi.fn().mockResolvedValue(mockPage);

      const result = await manager.get("https://example.com/page");

      expect(result.hit).toBe(true);
      expect(result.level).toBe("L2");
      expect(mockL1.get).toHaveBeenCalled();
      expect(mockL2.get).toHaveBeenCalled();
    });

    it("should check L3 when L1 and L2 miss", async () => {
      const mockPage = createMockPage();
      mockL1.get = vi.fn().mockResolvedValue(null);
      mockL2.get = vi.fn().mockResolvedValue(null);
      mockL3.get = vi.fn().mockResolvedValue(mockPage);

      const result = await manager.get("https://example.com/page");

      expect(result.hit).toBe(true);
      expect(result.level).toBe("L3");
    });

    it("should check L4 when L1, L2, L3 miss", async () => {
      const mockPage = createMockPage();
      mockL1.get = vi.fn().mockResolvedValue(null);
      mockL2.get = vi.fn().mockResolvedValue(null);
      mockL3.get = vi.fn().mockResolvedValue(null);
      mockL4.get = vi.fn().mockResolvedValue(mockPage);

      const result = await manager.get("https://example.com/page");

      expect(result.hit).toBe(true);
      expect(result.level).toBe("L4");
    });

    it("should return miss when all levels miss", async () => {
      mockL1.get = vi.fn().mockResolvedValue(null);
      mockL2.get = vi.fn().mockResolvedValue(null);
      mockL3.get = vi.fn().mockResolvedValue(null);
      mockL4.get = vi.fn().mockResolvedValue(null);

      const result = await manager.get("https://example.com/page");

      expect(result.hit).toBe(false);
      expect(result.level).toBeUndefined();
      expect(result.data).toBeUndefined();
    });

    it("should promote L2 hit to L1", async () => {
      const mockPage = createMockPage();
      mockL1.get = vi.fn().mockResolvedValue(null);
      mockL2.get = vi.fn().mockResolvedValue(mockPage);

      await manager.get("https://example.com/page");

      expect(mockL1.set).toHaveBeenCalled();
    });

    it("should promote L3 hit to L1 and L2", async () => {
      const mockPage = createMockPage();
      mockL1.get = vi.fn().mockResolvedValue(null);
      mockL2.get = vi.fn().mockResolvedValue(null);
      mockL3.get = vi.fn().mockResolvedValue(mockPage);

      await manager.get("https://example.com/page");

      expect(mockL1.set).toHaveBeenCalled();
      expect(mockL2.set).toHaveBeenCalled();
    });

    it("should promote L4 hit to L1, L2, and L3", async () => {
      const mockPage = createMockPage();
      mockL1.get = vi.fn().mockResolvedValue(null);
      mockL2.get = vi.fn().mockResolvedValue(null);
      mockL3.get = vi.fn().mockResolvedValue(null);
      mockL4.get = vi.fn().mockResolvedValue(mockPage);

      await manager.get("https://example.com/page");

      expect(mockL1.set).toHaveBeenCalled();
      expect(mockL2.set).toHaveBeenCalled();
      expect(mockL3.setWithUrl).toHaveBeenCalled();
    });

    it("should respect maxLevel option", async () => {
      mockL1.get = vi.fn().mockResolvedValue(null);
      mockL2.get = vi.fn().mockResolvedValue(null);

      const result = await manager.get("https://example.com/page", {
        maxLevel: "L2",
      });

      expect(result.hit).toBe(false);
      expect(mockL1.get).toHaveBeenCalled();
      expect(mockL2.get).toHaveBeenCalled();
      expect(mockL3.get).not.toHaveBeenCalled();
    });

    it("should respect skipLevels option", async () => {
      const mockPage = createMockPage();
      mockL2.get = vi.fn().mockResolvedValue(mockPage);

      const result = await manager.get("https://example.com/page", {
        skipLevels: ["L1"],
      });

      expect(result.hit).toBe(true);
      expect(result.level).toBe("L2");
      expect(mockL1.get).not.toHaveBeenCalled();
    });

    it("should skip cache when marked", async () => {
      mockL2.shouldSkipCache = vi.fn().mockResolvedValue(true);

      const result = await manager.get("https://example.com/page");

      expect(result.hit).toBe(false);
      expect(mockL1.get).not.toHaveBeenCalled();
    });

    it("should reject expired pages without acceptStale", async () => {
      const expiredPage = createMockPage({
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      mockL1.get = vi.fn().mockResolvedValue(expiredPage);
      mockL2.get = vi.fn().mockResolvedValue(null);
      mockL3.get = vi.fn().mockResolvedValue(null);
      mockL4.get = vi.fn().mockResolvedValue(null);

      const result = await manager.get("https://example.com/page");

      expect(result.hit).toBe(false);
    });

    it("should accept expired pages with acceptStale", async () => {
      const expiredPage = createMockPage({
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      mockL1.get = vi.fn().mockResolvedValue(expiredPage);

      const result = await manager.get("https://example.com/page", {
        acceptStale: true,
      });

      expect(result.hit).toBe(true);
      expect(result.level).toBe("L1");
    });

    it("should track latency", async () => {
      mockL1.get = vi.fn().mockResolvedValue(null);
      mockL2.get = vi.fn().mockResolvedValue(null);
      mockL3.get = vi.fn().mockResolvedValue(null);
      mockL4.get = vi.fn().mockResolvedValue(null);

      const result = await manager.get("https://example.com/page");

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("set", () => {
    it("should store in all levels by default", async () => {
      const mockPage = createMockPage();

      await manager.set("https://example.com/page", mockPage);

      expect(mockL1.set).toHaveBeenCalled();
      expect(mockL2.set).toHaveBeenCalled();
      expect(mockL3.setWithUrl).toHaveBeenCalled();
      expect(mockL4.set).toHaveBeenCalled();
    });

    it("should respect skipLevels option", async () => {
      const mockPage = createMockPage();

      await manager.set("https://example.com/page", mockPage, {
        skipLevels: ["L1", "L4"],
      });

      expect(mockL1.set).not.toHaveBeenCalled();
      expect(mockL2.set).toHaveBeenCalled();
      expect(mockL3.setWithUrl).toHaveBeenCalled();
      expect(mockL4.set).not.toHaveBeenCalled();
    });

    it("should apply content-type TTL", async () => {
      const mockPage = createMockPage({ contentType: "blog_post" });

      await manager.set("https://example.com/blog/post", mockPage);

      // L1 set should be called with TTL
      expect(mockL1.set).toHaveBeenCalled();
      const l1Call = (mockL1.set as any).mock.calls[0];
      expect(l1Call[2]).toBeGreaterThan(0); // TTL arg
    });

    it("should respect custom ttlMs option", async () => {
      const mockPage = createMockPage();
      const customTtl = 1000;

      await manager.set("https://example.com/page", mockPage, {
        ttlMs: customTtl,
      });

      expect(mockL1.set).toHaveBeenCalled();
    });

    it("should track domain-to-hash mapping in Redis", async () => {
      const mockPage = createMockPage();

      await manager.set("https://example.com/page", mockPage);

      // Should add hash to domain SET
      expect(mockRedis.sadd).toHaveBeenCalled();
      const saddCall = (mockRedis.sadd as any).mock.calls[0];
      expect(saddCall[0]).toBe("osm:scrape:domain:example.com");

      // Should set TTL on domain SET (30 days = 2592000 seconds)
      expect(mockRedis.expire).toHaveBeenCalled();
      const expireCall = (mockRedis.expire as any).mock.calls[0];
      expect(expireCall[0]).toBe("osm:scrape:domain:example.com");
      expect(expireCall[1]).toBe(30 * 24 * 60 * 60); // 30 days in seconds
    });

    it("should handle domain tracking errors gracefully", async () => {
      const mockPage = createMockPage();
      (mockRedis.sadd as any).mockRejectedValue(new Error("Redis error"));

      // Should not throw - domain tracking is non-critical
      await expect(
        manager.set("https://example.com/page", mockPage)
      ).resolves.not.toThrow();

      // Cache should still be stored in all levels
      expect(mockL1.set).toHaveBeenCalled();
      expect(mockL2.set).toHaveBeenCalled();
      expect(mockL3.setWithUrl).toHaveBeenCalled();
      expect(mockL4.set).toHaveBeenCalled();
    });
  });

  describe("invalidate", () => {
    it("should invalidate from L1, L2, L3", async () => {
      await manager.invalidate("https://example.com/page");

      expect(mockL1.delete).toHaveBeenCalled();
      expect(mockL2.delete).toHaveBeenCalled();
      expect(mockL3.delete).toHaveBeenCalled();
      // L4 is archive - should not be deleted
    });

    it("should not delete from L4 archive", async () => {
      await manager.invalidate("https://example.com/page");

      expect(mockL4.delete).not.toHaveBeenCalled();
    });
  });

  describe("invalidateDomain", () => {
    it("should clear L1 cache", async () => {
      await manager.invalidateDomain("example.com");

      expect(mockL1.clear).toHaveBeenCalled();
    });

    it("should query Redis for domain hashes", async () => {
      await manager.invalidateDomain("example.com");

      expect(mockRedis.smembers).toHaveBeenCalledWith("osm:scrape:domain:example.com");
    });

    it("should clear L2, L3, L4 when domain has tracked hashes", async () => {
      // Mock Redis to return tracked hashes
      (mockRedis.smembers as any).mockResolvedValue(["hash1", "hash2", "hash3"]);

      await manager.invalidateDomain("example.com");

      // Should clear L1
      expect(mockL1.clear).toHaveBeenCalled();

      // Should delete each hash from L2, L3, L4
      expect(mockL2.delete).toHaveBeenCalledWith("hash1");
      expect(mockL2.delete).toHaveBeenCalledWith("hash2");
      expect(mockL2.delete).toHaveBeenCalledWith("hash3");
      expect(mockL3.delete).toHaveBeenCalledWith("hash1");
      expect(mockL3.delete).toHaveBeenCalledWith("hash2");
      expect(mockL3.delete).toHaveBeenCalledWith("hash3");
      expect(mockL4.delete).toHaveBeenCalledWith("hash1");
      expect(mockL4.delete).toHaveBeenCalledWith("hash2");
      expect(mockL4.delete).toHaveBeenCalledWith("hash3");

      // Should delete the domain tracking SET
      expect(mockRedis.del).toHaveBeenCalledWith("osm:scrape:domain:example.com");
    });

    it("should not call L2-L4 delete when no tracked hashes exist", async () => {
      // Mock Redis to return empty array
      (mockRedis.smembers as any).mockResolvedValue([]);

      await manager.invalidateDomain("example.com");

      // Should still clear L1
      expect(mockL1.clear).toHaveBeenCalled();

      // Should not delete from L2-L4
      expect(mockL2.delete).not.toHaveBeenCalled();
      expect(mockL3.delete).not.toHaveBeenCalled();
      expect(mockL4.delete).not.toHaveBeenCalled();

      // Should not delete domain SET (nothing to clean up)
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("should handle Redis errors gracefully", async () => {
      // Mock Redis to throw an error
      (mockRedis.smembers as any).mockRejectedValue(new Error("Redis connection error"));

      // Should not throw
      await expect(manager.invalidateDomain("example.com")).resolves.not.toThrow();

      // L1 should still be cleared (partial success)
      expect(mockL1.clear).toHaveBeenCalled();
    });
  });

  describe("prewarm", () => {
    it("should call mget on L3", async () => {
      await manager.prewarm([
        "https://example.com/page1",
        "https://example.com/page2",
      ]);

      expect(mockL3.mget).toHaveBeenCalled();
    });

    it("should promote L3 hits to L1 and L2", async () => {
      const mockPage = createMockPage();
      mockL3.mget = vi.fn().mockResolvedValue(
        new Map([["somehash", mockPage]])
      );

      await manager.prewarm(["https://example.com/page"]);

      expect(mockL1.set).toHaveBeenCalled();
      expect(mockL2.set).toHaveBeenCalled();
    });
  });

  describe("getStats", () => {
    it("should aggregate stats from all levels", () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty("l1");
      expect(stats).toHaveProperty("l2");
      expect(stats).toHaveProperty("l3");
      expect(stats).toHaveProperty("l4");
      expect(stats).toHaveProperty("totalHitRate");
      expect(stats).toHaveProperty("avgLatencyMs");
      expect(stats).toHaveProperty("totalRequests");
      expect(stats).toHaveProperty("lastResetAt");
    });

    it("should calculate total hit rate", () => {
      mockL1.getStats = vi.fn().mockReturnValue({
        hits: 10,
        misses: 5,
        hitRate: 0.67,
        avgLatencyMs: 1,
      });
      mockL2.getStats = vi.fn().mockReturnValue({
        hits: 5,
        misses: 5,
        hitRate: 0.5,
        avgLatencyMs: 5,
      });
      mockL3.getStats = vi.fn().mockReturnValue({
        hits: 0,
        misses: 10,
        hitRate: 0,
        avgLatencyMs: 50,
      });
      mockL4.getStats = vi.fn().mockReturnValue({
        hits: 0,
        misses: 5,
        hitRate: 0,
        avgLatencyMs: 200,
      });

      const stats = manager.getStats();

      // Total hits: 15, total misses: 25, total: 40
      // Hit rate: 15/40 = 0.375
      expect(stats.totalHitRate).toBeCloseTo(0.375, 2);
    });
  });

  describe("resetStats", () => {
    it("should reset stats on all levels", () => {
      manager.resetStats();

      expect(mockL1.resetStats).toHaveBeenCalled();
      expect(mockL2.resetStats).toHaveBeenCalled();
      expect(mockL3.resetStats).toHaveBeenCalled();
      expect(mockL4.resetStats).toHaveBeenCalled();
    });
  });

  describe("getLevel", () => {
    it("should return L1 instance", () => {
      const level = manager.getLevel("L1");
      expect(level).toBe(mockL1);
    });

    it("should return L2 instance", () => {
      const level = manager.getLevel("L2");
      expect(level).toBe(mockL2);
    });

    it("should return L3 instance", () => {
      const level = manager.getLevel("L3");
      expect(level).toBe(mockL3);
    });

    it("should return L4 instance", () => {
      const level = manager.getLevel("L4");
      expect(level).toBe(mockL4);
    });
  });

  describe("getStorageStats", () => {
    it("should return stats from all levels", async () => {
      const stats = await manager.getStorageStats();

      expect(stats).toHaveProperty("l1");
      expect(stats).toHaveProperty("l3");
      expect(stats).toHaveProperty("l4");
      expect(mockL1.getCurrentSize).toHaveBeenCalled();
      expect(mockL3.getStorageStats).toHaveBeenCalled();
      expect(mockL4.getStorageStats).toHaveBeenCalled();
    });
  });

  describe("runMaintenance", () => {
    it("should run deleteExpired on L3", async () => {
      mockL3.deleteExpired = vi.fn().mockResolvedValue(5);

      const result = await manager.runMaintenance();

      expect(mockL3.deleteExpired).toHaveBeenCalled();
      expect(result.l3DeletedCount).toBe(5);
    });
  });

  describe("handleInvalidation", () => {
    it("should handle url_changed event", async () => {
      await manager.handleInvalidation({
        type: "url_changed",
        url: "https://example.com/page",
      });

      expect(mockL1.delete).toHaveBeenCalled();
      expect(mockL2.delete).toHaveBeenCalled();
      expect(mockL3.delete).toHaveBeenCalled();
    });

    it("should handle domain_updated event", async () => {
      await manager.handleInvalidation({
        type: "domain_updated",
        domain: "example.com",
      });

      expect(mockL1.clear).toHaveBeenCalled();
    });

    it("should handle audit_started event with prewarm", async () => {
      await manager.handleInvalidation({
        type: "audit_started",
        urls: ["https://example.com/page1", "https://example.com/page2"],
      });

      expect(mockL3.mget).toHaveBeenCalled();
    });

    it("should handle force_refresh event", async () => {
      await manager.handleInvalidation({
        type: "force_refresh",
        url: "https://example.com/page",
      });

      expect(mockL2.markSkipCache).toHaveBeenCalled();
    });

    it("should handle ttl_expired event (no-op)", async () => {
      // This event is handled by individual levels' TTL mechanisms
      await manager.handleInvalidation({
        type: "ttl_expired",
        url: "https://example.com/page",
      });

      // No specific action expected
      expect(mockL1.delete).not.toHaveBeenCalled();
    });
  });

  describe("getRevalidationHeaders", () => {
    it("should delegate to L2", async () => {
      mockL2.getRevalidationHeaders = vi.fn().mockResolvedValue({
        etag: '"abc123"',
        lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
      });

      const headers = await manager.getRevalidationHeaders(
        "https://example.com/page"
      );

      expect(mockL2.getRevalidationHeaders).toHaveBeenCalled();
      expect(headers).toEqual({
        etag: '"abc123"',
        lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
      });
    });
  });

  describe("shouldSkipCache", () => {
    it("should delegate to L2", async () => {
      mockL2.shouldSkipCache = vi.fn().mockResolvedValue(true);

      const result = await manager.shouldSkipCache("https://example.com/page");

      expect(mockL2.shouldSkipCache).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
