/**
 * L2 Redis Cache Tests
 * Phase 95-02: Multi-Level Caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Redis } from "ioredis";
import { L2Cache, createL2Cache } from "../L2Cache";
import type { CachedPage } from "../types";

// =============================================================================
// Mock Redis
// =============================================================================

function createMockRedis(): Redis {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  const hashes = new Map<string, Map<string, string>>();

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),

    setex: vi.fn(async (key: string, ttl: number, value: string) => {
      store.set(key, value);
      ttls.set(key, ttl);
      return "OK";
    }),

    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (store.delete(key)) deleted++;
        ttls.delete(key);
        hashes.delete(key);
      }
      return deleted;
    }),

    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),

    expire: vi.fn(async (key: string, ttl: number) => {
      if (store.has(key)) {
        ttls.set(key, ttl);
        return 1;
      }
      return 0;
    }),

    ttl: vi.fn(async (key: string) => ttls.get(key) ?? -2),

    mget: vi.fn(async (...keys: string[]) =>
      keys.map((key) => store.get(key) ?? null)
    ),

    hset: vi.fn(async (key: string, field: string, value: string) => {
      if (!hashes.has(key)) {
        hashes.set(key, new Map());
      }
      const existed = hashes.get(key)!.has(field);
      hashes.get(key)!.set(field, value);
      return existed ? 0 : 1;
    }),

    hgetall: vi.fn(async (key: string) => {
      const hash = hashes.get(key);
      if (!hash) return {};
      return Object.fromEntries(hash.entries());
    }),

    scan: vi.fn(async (cursor: string, _match: string, pattern: string) => {
      const keys = Array.from(store.keys()).filter((k) =>
        k.startsWith(pattern.replace("*", ""))
      );
      return ["0", keys];
    }),

    info: vi.fn(async () => `
used_memory:104857600
used_memory_peak:209715200
mem_fragmentation_ratio:1.05
`),

    // Helper to clear mock for testing
    __clear: () => {
      store.clear();
      ttls.clear();
      hashes.clear();
    },
  } as unknown as Redis;
}

// =============================================================================
// Test Helpers
// =============================================================================

function createMockPage(overrides: Partial<CachedPage> = {}): CachedPage {
  return {
    html: "<html><body><h1>Test</h1><p>Content here with enough text to trigger compression</p></body></html>",
    contentHash: "abc123def456gh78",
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    tierUsed: "direct",
    statusCode: 200,
    pageSizeBytes: 1000,
    ...overrides,
  };
}

function createLargePage(): CachedPage {
  // Create HTML large enough to benefit from compression
  const html = `
    <html>
    <head><title>Test Page</title></head>
    <body>
      <header><nav>${"<a>Link</a>".repeat(100)}</nav></header>
      <main>
        <h1>Main Heading</h1>
        ${"<p>This is a paragraph with some content that will be repeated many times.</p>".repeat(50)}
      </main>
      <footer>Footer content</footer>
    </body>
    </html>
  `;
  return createMockPage({ html, pageSizeBytes: html.length });
}

// =============================================================================
// Tests
// =============================================================================

describe("L2Cache", () => {
  let redis: Redis;
  let cache: L2Cache;

  beforeEach(() => {
    redis = createMockRedis();
    cache = createL2Cache(redis, { keyPrefix: "test:" });
  });

  afterEach(async () => {
    (redis as any).__clear?.();
  });

  describe("basic operations", () => {
    it("should return null for non-existent key", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should store and retrieve a page", async () => {
      const page = createMockPage();
      await cache.set("test-hash", page, 60000);

      const result = await cache.get("test-hash");
      expect(result).not.toBeNull();
      expect(result?.html).toBe(page.html);
      expect(result?.contentHash).toBe(page.contentHash);
      expect(result?.statusCode).toBe(page.statusCode);
    });

    it("should check if key exists with has()", async () => {
      expect(await cache.has("test-hash")).toBe(false);

      await cache.set("test-hash", createMockPage(), 60000);

      expect(await cache.has("test-hash")).toBe(true);
    });

    it("should delete a key", async () => {
      await cache.set("test-hash", createMockPage(), 60000);
      expect(await cache.has("test-hash")).toBe(true);

      await cache.delete("test-hash");
      expect(await cache.has("test-hash")).toBe(false);
    });

    it("should use correct TTL when setting", async () => {
      await cache.set("test-hash", createMockPage(), 60000); // 60 seconds

      expect(redis.setex).toHaveBeenCalledWith(
        "test:html:test-hash",
        60,
        expect.any(String)
      );
    });
  });

  describe("compression", () => {
    it("should compress large HTML content", async () => {
      const largePage = createLargePage();
      await cache.set("large-hash", largePage, 60000);

      // Get the stored value
      const storedData = await redis.get("test:html:large-hash");
      expect(storedData).not.toBeNull();

      const parsed = JSON.parse(storedData!);
      expect(parsed.compressed).toBe(true);

      // Stored data should be smaller than original
      expect(storedData!.length).toBeLessThan(largePage.html.length);
    });

    it("should decompress data on retrieval", async () => {
      const largePage = createLargePage();
      await cache.set("large-hash", largePage, 60000);

      const result = await cache.get("large-hash");
      expect(result?.html).toBe(largePage.html);
    });

    it("should not compress small content", async () => {
      const smallPage = createMockPage({ html: "<h1>Hi</h1>" });
      await cache.set("small-hash", smallPage, 60000);

      const storedData = await redis.get("test:html:small-hash");
      const parsed = JSON.parse(storedData!);
      expect(parsed.compressed).toBe(false);
    });

    it("should handle compression disabled", async () => {
      const noCompressCache = createL2Cache(redis, {
        keyPrefix: "test:",
        compressionEnabled: false,
      });

      const largePage = createLargePage();
      await noCompressCache.set("large-hash", largePage, 60000);

      const storedData = await redis.get("test:html:large-hash");
      const parsed = JSON.parse(storedData!);
      expect(parsed.compressed).toBe(false);
    });
  });

  describe("revalidation headers", () => {
    it("should store and retrieve ETag", async () => {
      await cache.setRevalidationHeaders("test-hash", {
        etag: '"abc123"',
      });

      const headers = await cache.getRevalidationHeaders("test-hash");
      expect(headers?.etag).toBe('"abc123"');
    });

    it("should store and retrieve Last-Modified", async () => {
      await cache.setRevalidationHeaders("test-hash", {
        lastModified: "Wed, 07 May 2026 12:00:00 GMT",
      });

      const headers = await cache.getRevalidationHeaders("test-hash");
      expect(headers?.lastModified).toBe("Wed, 07 May 2026 12:00:00 GMT");
    });

    it("should store both headers together", async () => {
      await cache.setRevalidationHeaders("test-hash", {
        etag: '"xyz789"',
        lastModified: "Wed, 07 May 2026 12:00:00 GMT",
      });

      const headers = await cache.getRevalidationHeaders("test-hash");
      expect(headers?.etag).toBe('"xyz789"');
      expect(headers?.lastModified).toBe("Wed, 07 May 2026 12:00:00 GMT");
    });

    it("should return null for non-existent headers", async () => {
      const headers = await cache.getRevalidationHeaders("nonexistent");
      expect(headers).toBeNull();
    });

    it("should auto-store headers when setting page with etag", async () => {
      const page = createMockPage({
        etag: '"page-etag"',
        lastModified: "Wed, 07 May 2026 15:00:00 GMT",
      });
      await cache.set("test-hash", page, 60000);

      expect(redis.hset).toHaveBeenCalledWith(
        "test:etag:test-hash",
        "etag",
        '"page-etag"'
      );
    });
  });

  describe("skip cache", () => {
    it("should mark URL to skip cache", async () => {
      await cache.markSkipCache("test-hash");

      const shouldSkip = await cache.shouldSkipCache("test-hash");
      expect(shouldSkip).toBe(true);
    });

    it("should return false for non-marked URLs", async () => {
      const shouldSkip = await cache.shouldSkipCache("unmarked-hash");
      expect(shouldSkip).toBe(false);
    });
  });

  describe("TTL management", () => {
    it("should extend TTL for existing key", async () => {
      await cache.set("test-hash", createMockPage(), 60000);

      const extended = await cache.extendTtl("test-hash", 120);
      expect(extended).toBe(true);
      expect(redis.expire).toHaveBeenCalledWith("test:html:test-hash", 120);
    });

    it("should return false when extending TTL for non-existent key", async () => {
      const extended = await cache.extendTtl("nonexistent", 120);
      expect(extended).toBe(false);
    });

    it("should get remaining TTL", async () => {
      await cache.set("test-hash", createMockPage(), 60000);

      const ttl = await cache.getRemainingTtl("test-hash");
      expect(ttl).toBe(60); // 60 seconds
    });

    it("should return null for non-existent key TTL", async () => {
      const ttl = await cache.getRemainingTtl("nonexistent");
      expect(ttl).toBeNull();
    });
  });

  describe("bulk operations", () => {
    it("should get multiple items at once", async () => {
      await cache.set("hash1", createMockPage({ contentHash: "hash1content" }), 60000);
      await cache.set("hash2", createMockPage({ contentHash: "hash2content" }), 60000);
      await cache.set("hash3", createMockPage({ contentHash: "hash3content" }), 60000);

      const results = await cache.mget(["hash1", "hash2", "hash3", "nonexistent"]);

      expect(results.size).toBe(3);
      expect(results.get("hash1")?.contentHash).toBe("hash1content");
      expect(results.get("hash2")?.contentHash).toBe("hash2content");
      expect(results.get("hash3")?.contentHash).toBe("hash3content");
      expect(results.has("nonexistent")).toBe(false);
    });

    it("should handle empty mget", async () => {
      const results = await cache.mget([]);
      expect(results.size).toBe(0);
    });

    it("should track hits and misses in mget", async () => {
      await cache.set("existing", createMockPage(), 60000);

      await cache.mget(["existing", "missing1", "missing2"]);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
    });
  });

  describe("statistics tracking", () => {
    it("should track hits and misses", async () => {
      await cache.set("existing", createMockPage(), 60000);

      // Generate hits
      await cache.get("existing");
      await cache.get("existing");

      // Generate misses
      await cache.get("nonexistent1");
      await cache.get("nonexistent2");

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it("should track average latency", async () => {
      await cache.set("key", createMockPage(), 60000);
      await cache.get("key");

      const stats = cache.getStats();
      expect(stats.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should reset statistics", async () => {
      await cache.set("key", createMockPage(), 60000);
      await cache.get("key");
      await cache.get("nonexistent");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe("memory info", () => {
    it("should get Redis memory info", async () => {
      const info = await cache.getMemoryInfo();

      expect(info).not.toBeNull();
      expect(info?.used).toBe(104857600); // 100MB
      expect(info?.peak).toBe(209715200); // 200MB
      expect(info?.fragmentation).toBeCloseTo(1.05);
    });
  });

  describe("serialization edge cases", () => {
    it("should handle page with all optional fields", async () => {
      const fullPage = createMockPage({
        etag: '"full-etag"',
        lastModified: "Wed, 07 May 2026 12:00:00 GMT",
        contentType: "blog_post",
        parsedData: {
          title: "Test Title",
          metaDescription: "A description",
          canonical: "https://example.com/page",
          h1: ["Main Heading"],
          h2: ["Sub 1", "Sub 2"],
          wordCount: 500,
          internalLinks: 10,
          externalLinks: 5,
          images: 3,
          hasSchema: true,
        },
      });

      await cache.set("full-hash", fullPage, 60000);
      const result = await cache.get("full-hash");

      expect(result?.etag).toBe('"full-etag"');
      expect(result?.contentType).toBe("blog_post");
      expect(result?.parsedData?.title).toBe("Test Title");
      expect(result?.parsedData?.h1).toEqual(["Main Heading"]);
      expect(result?.parsedData?.wordCount).toBe(500);
    });

    it("should handle dates correctly", async () => {
      const page = createMockPage({
        fetchedAt: new Date("2026-05-07T12:00:00Z"),
        expiresAt: new Date("2026-05-07T13:00:00Z"),
      });

      await cache.set("date-hash", page, 60000);
      const result = await cache.get("date-hash");

      expect(result?.fetchedAt.toISOString()).toBe("2026-05-07T12:00:00.000Z");
      expect(result?.expiresAt.toISOString()).toBe("2026-05-07T13:00:00.000Z");
    });
  });

  describe("level property", () => {
    it("should have level L2", () => {
      expect(cache.level).toBe("L2");
    });
  });

  describe("clear", () => {
    it("should clear all cache entries", async () => {
      await cache.set("hash1", createMockPage(), 60000);
      await cache.set("hash2", createMockPage(), 60000);

      await cache.clear();

      expect(await cache.has("hash1")).toBe(false);
      expect(await cache.has("hash2")).toBe(false);
    });
  });
});

describe("createL2Cache factory", () => {
  it("should create cache with custom config", () => {
    const redis = createMockRedis();
    const cache = createL2Cache(redis, {
      keyPrefix: "custom:",
      compressionEnabled: false,
    });

    expect(cache).toBeInstanceOf(L2Cache);
  });
});
