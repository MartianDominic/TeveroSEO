/**
 * Tests for BoundedCache
 * HIGH-CACHE-02 FIX: Pattern-based invalidation
 * MED-CACHE-02 FIX: LRU eviction
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BoundedCache } from "./bounded-cache";

describe("BoundedCache", () => {
  let cache: BoundedCache<string, string>;

  beforeEach(() => {
    cache = new BoundedCache<string, string>({
      maxSize: 5,
      defaultTTLMs: 1000,
      name: "test-cache",
    });
  });

  describe("basic operations", () => {
    it("should set and get values", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return undefined for non-existent keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should delete values", () => {
      cache.set("key1", "value1");
      expect(cache.delete("key1")).toBe(true);
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should clear all values", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.clear();
      expect(cache.size).toBe(0);
    });

    it("should return correct size", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      expect(cache.size).toBe(2);
    });
  });

  describe("name", () => {
    it("should return the cache name", () => {
      expect(cache.getName()).toBe("test-cache");
    });

    it("should default to 'unnamed' when no name provided", () => {
      const unnamedCache = new BoundedCache<string, string>();
      expect(unnamedCache.getName()).toBe("unnamed");
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", async () => {
      const shortTTLCache = new BoundedCache<string, string>({
        maxSize: 5,
        defaultTTLMs: 50,
      });

      shortTTLCache.set("key1", "value1");
      expect(shortTTLCache.get("key1")).toBe("value1");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(shortTTLCache.get("key1")).toBeUndefined();
    });

    it("should allow custom TTL per entry", async () => {
      cache.set("key1", "value1", 50); // 50ms TTL

      expect(cache.get("key1")).toBe("value1");

      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(cache.get("key1")).toBeUndefined();
    });
  });

  describe("LRU eviction", () => {
    it("should evict oldest entry when at capacity", () => {
      // Fill cache to capacity
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      cache.set("key4", "value4");
      cache.set("key5", "value5");

      // Add one more - should evict key1 (oldest)
      cache.set("key6", "value6");

      expect(cache.get("key1")).toBeUndefined(); // Evicted
      expect(cache.get("key6")).toBe("value6"); // New entry
      expect(cache.size).toBe(5);
    });

    it("should update position on access", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      cache.set("key4", "value4");
      cache.set("key5", "value5");

      // Access key1 to make it most recently used
      cache.get("key1");

      // Add new entry - should evict key2 (now oldest)
      cache.set("key6", "value6");

      expect(cache.get("key1")).toBe("value1"); // Still present
      expect(cache.get("key2")).toBeUndefined(); // Evicted
    });
  });

  describe("clearPattern (HIGH-CACHE-02)", () => {
    beforeEach(() => {
      cache.set("serp:client-123:mapping-1:keyword1", "v1");
      cache.set("serp:client-123:mapping-2:keyword2", "v2");
      cache.set("serp:client-456:mapping-3:keyword3", "v3");
      cache.set("kw:client-123:data", "v4");
      cache.set("other:data", "v5");
    });

    it("should clear entries matching pattern with suffix wildcard", () => {
      const cleared = cache.clearPattern("serp:client-123:*");

      expect(cleared).toBe(2);
      expect(cache.get("serp:client-123:mapping-1:keyword1")).toBeUndefined();
      expect(cache.get("serp:client-123:mapping-2:keyword2")).toBeUndefined();
      expect(cache.get("serp:client-456:mapping-3:keyword3")).toBe("v3");
    });

    it("should clear entries matching pattern with middle wildcard", () => {
      const cleared = cache.clearPattern("*:client-123:*");

      expect(cleared).toBe(3);
      expect(cache.get("serp:client-123:mapping-1:keyword1")).toBeUndefined();
      expect(cache.get("serp:client-123:mapping-2:keyword2")).toBeUndefined();
      expect(cache.get("kw:client-123:data")).toBeUndefined();
    });

    it("should return 0 when no entries match", () => {
      const cleared = cache.clearPattern("nonexistent:*");
      expect(cleared).toBe(0);
    });

    it("should handle exact match pattern", () => {
      const cleared = cache.clearPattern("other:data");
      expect(cleared).toBe(1);
      expect(cache.get("other:data")).toBeUndefined();
    });

    it("should handle empty pattern", () => {
      const cleared = cache.clearPattern("");
      expect(cleared).toBe(0);
    });

    it("should handle invalid pattern type", () => {
      const cleared = cache.clearPattern(null as unknown as string);
      expect(cleared).toBe(0);
    });

    it("should escape regex special characters", () => {
      cache.set("test.key[0]", "value");
      cache.set("test.key[1]", "value2");

      // Pattern with special regex chars should be escaped
      const cleared = cache.clearPattern("test.key[*]");
      expect(cleared).toBe(2);
    });
  });

  describe("has", () => {
    it("should return true for existing key", () => {
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);
    });

    it("should return false for non-existent key", () => {
      expect(cache.has("nonexistent")).toBe(false);
    });

    it("should return false for expired key", async () => {
      const shortTTLCache = new BoundedCache<string, string>({
        defaultTTLMs: 50,
      });
      shortTTLCache.set("key1", "value1");

      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(shortTTLCache.has("key1")).toBe(false);
    });
  });

  describe("keys", () => {
    it("should return all valid keys", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });

    it("should exclude expired keys", async () => {
      const shortTTLCache = new BoundedCache<string, string>({
        defaultTTLMs: 50,
      });
      shortTTLCache.set("key1", "value1");
      shortTTLCache.set("key2", "value2", 5000); // Longer TTL

      await new Promise((resolve) => setTimeout(resolve, 60));

      const keys = shortTTLCache.keys();
      expect(keys).toHaveLength(1);
      expect(keys).toContain("key2");
    });
  });

  describe("prune", () => {
    it("should remove expired entries", async () => {
      const shortTTLCache = new BoundedCache<string, string>({
        defaultTTLMs: 50,
      });
      shortTTLCache.set("key1", "value1");
      shortTTLCache.set("key2", "value2");

      await new Promise((resolve) => setTimeout(resolve, 60));

      const pruned = shortTTLCache.prune();
      expect(pruned).toBe(2);
      expect(shortTTLCache.size).toBe(0);
    });

    it("should not remove non-expired entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const pruned = cache.prune();
      expect(pruned).toBe(0);
      expect(cache.size).toBe(2);
    });
  });

  describe("stats", () => {
    it("should return correct stats", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const stats = cache.stats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
      expect(stats.name).toBe("test-cache");
    });
  });
});
