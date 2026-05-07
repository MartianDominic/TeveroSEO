/**
 * L1 Memory Cache Tests
 * Phase 95-02: Multi-Level Caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { L1Cache, createL1Cache, resetL1CacheInstance } from "../L1Cache";
import type { CachedPage } from "../types";

// =============================================================================
// Test Helpers
// =============================================================================

function createMockPage(overrides: Partial<CachedPage> = {}): CachedPage {
  return {
    html: "<html><body><h1>Test</h1><p>Content here</p></body></html>",
    contentHash: "abc123def456gh78",
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    tierUsed: "direct",
    statusCode: 200,
    pageSizeBytes: 1000,
    ...overrides,
  };
}

function createLargePage(sizeKb: number): CachedPage {
  const html = "x".repeat(sizeKb * 1024);
  return createMockPage({
    html,
    pageSizeBytes: sizeKb * 1024,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("L1Cache", () => {
  let cache: L1Cache;

  beforeEach(() => {
    resetL1CacheInstance();
    cache = createL1Cache({
      maxSizeBytes: 1024 * 1024, // 1MB for testing
      maxItems: 100,
      defaultTtlMs: 60000, // 1 minute
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe("basic operations", () => {
    it("should return null for non-existent key", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should store and retrieve a page", async () => {
      const page = createMockPage();
      await cache.set("test-hash", page);

      const result = await cache.get("test-hash");
      expect(result).not.toBeNull();
      expect(result?.html).toBe(page.html);
      expect(result?.contentHash).toBe(page.contentHash);
    });

    it("should check if key exists with has()", async () => {
      expect(await cache.has("test-hash")).toBe(false);

      await cache.set("test-hash", createMockPage());

      expect(await cache.has("test-hash")).toBe(true);
    });

    it("should delete a key", async () => {
      await cache.set("test-hash", createMockPage());
      expect(await cache.has("test-hash")).toBe(true);

      await cache.delete("test-hash");
      expect(await cache.has("test-hash")).toBe(false);
    });

    it("should clear all entries", async () => {
      await cache.set("hash1", createMockPage());
      await cache.set("hash2", createMockPage());
      await cache.set("hash3", createMockPage());

      expect(cache.getItemCount()).toBe(3);

      await cache.clear();

      expect(cache.getItemCount()).toBe(0);
    });
  });

  describe("TTL expiration", () => {
    it("should expire items after TTL", async () => {
      const shortTtlCache = createL1Cache({
        maxSizeBytes: 1024 * 1024,
        maxItems: 100,
        defaultTtlMs: 50, // 50ms - very short for testing
      });

      await shortTtlCache.set("test-hash", createMockPage());

      // Should exist immediately
      expect(await shortTtlCache.get("test-hash")).not.toBeNull();

      // Wait for TTL to expire (using real timer)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be expired
      expect(await shortTtlCache.get("test-hash")).toBeNull();
    });

    it("should use custom TTL when provided", async () => {
      const page = createMockPage();

      // Set with custom 50ms TTL
      await cache.set("test-hash", page, 50);

      // Should exist immediately
      expect(await cache.get("test-hash")).not.toBeNull();

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be expired
      expect(await cache.get("test-hash")).toBeNull();
    });

    it("should return remaining TTL for an item", async () => {
      await cache.set("test-hash", createMockPage(), 1000);

      const remaining = cache.getRemainingTtl("test-hash");
      expect(remaining).toBeDefined();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(1000);
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used items when max items reached", async () => {
      const smallCache = createL1Cache({
        maxSizeBytes: 10 * 1024 * 1024, // 10MB (won't hit)
        maxItems: 3, // Only 3 items
        defaultTtlMs: 60000,
      });

      await smallCache.set("hash1", createMockPage());
      await smallCache.set("hash2", createMockPage());
      await smallCache.set("hash3", createMockPage());

      // Access hash1 and hash2 to make them more recent
      await smallCache.get("hash1");
      await smallCache.get("hash2");

      // Add hash4 - should evict hash3 (least recently used)
      await smallCache.set("hash4", createMockPage());

      expect(await smallCache.has("hash1")).toBe(true);
      expect(await smallCache.has("hash2")).toBe(true);
      expect(await smallCache.has("hash3")).toBe(false); // Evicted
      expect(await smallCache.has("hash4")).toBe(true);
    });

    it("should evict items when max size reached", async () => {
      const smallCache = createL1Cache({
        maxSizeBytes: 50 * 1024, // 50KB
        maxItems: 1000,
        defaultTtlMs: 60000,
      });

      // Add 10KB pages until we exceed limit
      await smallCache.set("hash1", createLargePage(10));
      await smallCache.set("hash2", createLargePage(10));
      await smallCache.set("hash3", createLargePage(10));
      await smallCache.set("hash4", createLargePage(10));
      await smallCache.set("hash5", createLargePage(10));

      // Adding 6th 10KB page should trigger eviction
      await smallCache.set("hash6", createLargePage(10));

      // Some early items should be evicted
      const totalItems = smallCache.getItemCount();
      expect(totalItems).toBeLessThan(6);

      // Cache size should be within limit
      const currentSize = smallCache.getCurrentSize();
      expect(currentSize).toBeLessThanOrEqual(50 * 1024);
    });
  });

  describe("statistics tracking", () => {
    it("should track hits and misses", async () => {
      await cache.set("existing", createMockPage());

      // Generate hits
      await cache.get("existing");
      await cache.get("existing");

      // Generate misses
      await cache.get("nonexistent1");
      await cache.get("nonexistent2");
      await cache.get("nonexistent3");

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(3);
      expect(stats.hitRate).toBeCloseTo(0.4); // 2 / 5
    });

    it("should calculate hit rate correctly", async () => {
      await cache.set("key1", createMockPage());
      await cache.set("key2", createMockPage());

      // 4 hits
      await cache.get("key1");
      await cache.get("key1");
      await cache.get("key2");
      await cache.get("key2");

      // 1 miss
      await cache.get("nonexistent");

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.8); // 4 / 5
    });

    it("should track average latency", async () => {
      await cache.set("key", createMockPage());
      await cache.get("key");
      await cache.get("nonexistent");

      const stats = cache.getStats();
      expect(stats.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should track size and item count", async () => {
      await cache.set("hash1", createMockPage({ html: "a".repeat(1000) }));
      await cache.set("hash2", createMockPage({ html: "b".repeat(2000) }));

      const stats = cache.getStats();
      expect(stats.itemCount).toBe(2);
      expect(stats.sizeBytes).toBeGreaterThan(3000);
    });

    it("should reset statistics", async () => {
      await cache.set("key", createMockPage());
      await cache.get("key");
      await cache.get("nonexistent");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe("capacity monitoring", () => {
    it("should report current size", async () => {
      expect(cache.getCurrentSize()).toBe(0);

      await cache.set("hash1", createLargePage(10)); // 10KB
      expect(cache.getCurrentSize()).toBeGreaterThan(10000);
    });

    it("should report remaining capacity", async () => {
      const maxSize = 1024 * 1024; // 1MB
      const initialRemaining = cache.getRemainingCapacity();
      expect(initialRemaining).toBe(maxSize);

      await cache.set("hash1", createLargePage(100)); // 100KB

      const afterRemaining = cache.getRemainingCapacity();
      expect(afterRemaining).toBeLessThan(maxSize);
    });

    it("should detect when near capacity", async () => {
      const smallCache = createL1Cache({
        maxSizeBytes: 100 * 1024, // 100KB
        maxItems: 1000,
        defaultTtlMs: 60000,
      });

      expect(smallCache.isNearCapacity()).toBe(false);

      // Fill to 90%
      await smallCache.set("hash1", createLargePage(90)); // 90KB

      expect(smallCache.isNearCapacity()).toBe(true);
    });
  });

  describe("peek without updating recency", () => {
    it("should peek without affecting LRU order", async () => {
      const smallCache = createL1Cache({
        maxSizeBytes: 10 * 1024 * 1024,
        maxItems: 2,
        defaultTtlMs: 60000,
      });

      await smallCache.set("hash1", createMockPage());
      await smallCache.set("hash2", createMockPage());

      // Peek at hash1 (should NOT make it more recent)
      const peeked = smallCache.peek("hash1");
      expect(peeked).not.toBeUndefined();

      // Add hash3 - should evict hash1 (still LRU since peek doesn't update)
      await smallCache.set("hash3", createMockPage());

      expect(await smallCache.has("hash1")).toBe(false); // Evicted
      expect(await smallCache.has("hash2")).toBe(true);
      expect(await smallCache.has("hash3")).toBe(true);
    });
  });

  describe("key listing", () => {
    it("should list all cached keys", async () => {
      await cache.set("hash1", createMockPage());
      await cache.set("hash2", createMockPage());
      await cache.set("hash3", createMockPage());

      const keys = cache.getKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain("html:hash1");
      expect(keys).toContain("html:hash2");
      expect(keys).toContain("html:hash3");
    });
  });

  describe("level property", () => {
    it("should have level L1", () => {
      expect(cache.level).toBe("L1");
    });
  });

  describe("size calculation with parsed data", () => {
    it("should include parsed data in size calculation", async () => {
      const pageWithoutParsed = createMockPage({ html: "x".repeat(1000) });
      const pageWithParsed = createMockPage({
        html: "x".repeat(1000),
        parsedData: {
          title: "Test Title",
          metaDescription: "A long description for the page",
          canonical: "https://example.com/page",
          h1: ["Main Heading"],
          h2: ["Sub Heading 1", "Sub Heading 2"],
          wordCount: 500,
          internalLinks: 10,
          externalLinks: 5,
          images: 3,
          hasSchema: true,
        },
      });

      await cache.set("without-parsed", pageWithoutParsed);
      const sizeWithout = cache.getCurrentSize();

      await cache.clear();

      await cache.set("with-parsed", pageWithParsed);
      const sizeWith = cache.getCurrentSize();

      // Page with parsed data should be larger
      expect(sizeWith).toBeGreaterThan(sizeWithout);
    });
  });
});

describe("createL1Cache factory", () => {
  it("should create cache with custom config", () => {
    const cache = createL1Cache({
      maxSizeBytes: 50 * 1024 * 1024,
      maxItems: 500,
    });

    expect(cache).toBeInstanceOf(L1Cache);
  });

  it("should use default config when not specified", () => {
    const cache = createL1Cache();
    expect(cache).toBeInstanceOf(L1Cache);
  });
});
