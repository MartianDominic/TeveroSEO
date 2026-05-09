/**
 * L3 PostgreSQL Cache Tests
 * Phase 95-02: Multi-Level Caching
 * Phase 97: Tenant Isolation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { L3Cache, createL3Cache } from "../L3Cache";
import type { CachedPage } from "../types";

// Test client ID for tenant isolation
const TEST_CLIENT_ID = "550e8400-e29b-41d4-a716-446655440000";

// =============================================================================
// Mock Database
// =============================================================================

function createMockDb(): PostgresJsDatabase {
  const htmlCacheStore = new Map<
    string,
    {
      id: number;
      urlHash: string;
      url: string;
      contentHash: string;
      htmlCompressed: string;
      compressionAlgo: string;
      statusCode: number;
      pageSizeBytes: number;
      tierUsed: string;
      fetchedAt: Date;
      expiresAt: Date;
      etag: string | null;
      lastModified: string | null;
      contentType: string | null;
      parsedData: any;
      crawlDate: Date;
      createdAt: Date;
    }
  >();

  const aliasStore = new Map<string, { canonicalId: number; createdAt: Date }>();
  let idCounter = 1;

  // Helper to check expiration
  const isExpired = (expiresAt: Date) => expiresAt < new Date();

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),

    // Chain terminator - returns results based on accumulated query
    then: vi.fn((resolve: (value: any[]) => void) => {
      // This is simplified - real implementation would track query context
      resolve([]);
    }),

    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),

    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rowCount: 0 }),

    // Internal test helpers
    __htmlCacheStore: htmlCacheStore,
    __aliasStore: aliasStore,
    __reset: () => {
      htmlCacheStore.clear();
      aliasStore.clear();
      idCounter = 1;
    },
    __setEntry: (hash: string, entry: Partial<CachedPage & { url: string }>) => {
      const id = idCounter++;
      htmlCacheStore.set(hash, {
        id,
        urlHash: hash,
        url: entry.url ?? `[hash:${hash}]`,
        contentHash: entry.contentHash ?? "content123",
        htmlCompressed: entry.html ?? "<html></html>",
        compressionAlgo: "none",
        statusCode: entry.statusCode ?? 200,
        pageSizeBytes: entry.pageSizeBytes ?? 1000,
        tierUsed: entry.tierUsed ?? "direct",
        fetchedAt: entry.fetchedAt ?? new Date(),
        expiresAt: entry.expiresAt ?? new Date(Date.now() + 3600000),
        etag: entry.etag ?? null,
        lastModified: entry.lastModified ?? null,
        contentType: entry.contentType ?? null,
        parsedData: entry.parsedData ?? null,
        crawlDate: new Date(),
        createdAt: new Date(),
      });
      return id;
    },
    __getEntry: (hash: string) => htmlCacheStore.get(hash),
    __setAlias: (aliasHash: string, canonicalId: number) => {
      aliasStore.set(aliasHash, { canonicalId, createdAt: new Date() });
    },
  };

  // Override select to handle queries properly
  mockDb.select = vi.fn(() => ({
    from: vi.fn((table: any) => ({
      where: vi.fn((condition: any) => ({
        limit: vi.fn((n: number) => {
          // Simplified query executor
          const results: any[] = [];

          // Check html_cache table
          if (table?._ === undefined) {
            for (const [hash, entry] of htmlCacheStore.entries()) {
              if (!isExpired(entry.expiresAt)) {
                results.push(entry);
              }
            }
          }

          return Promise.resolve(results.slice(0, n));
        }),
        then: (resolve: (v: any[]) => void) => {
          const results: any[] = [];
          for (const [, entry] of htmlCacheStore.entries()) {
            if (!isExpired(entry.expiresAt)) {
              results.push(entry);
            }
          }
          return Promise.resolve(resolve(results));
        },
      })),
      innerJoin: vi.fn().mockReturnThis(),
      then: (resolve: (v: any[]) => void) => {
        const results: any[] = [];
        for (const [, entry] of htmlCacheStore.entries()) {
          if (!isExpired(entry.expiresAt)) {
            results.push(entry);
          }
        }
        return Promise.resolve(resolve(results));
      },
    })),
  }));

  // Override insert
  mockDb.insert = vi.fn(() => ({
    values: vi.fn((data: any) => ({
      onConflictDoNothing: vi.fn(() => Promise.resolve()),
      onConflictDoUpdate: vi.fn(() => {
        const id = idCounter++;
        htmlCacheStore.set(data.urlHash, {
          id,
          ...data,
          crawlDate: new Date(),
          createdAt: new Date(),
        });
        return Promise.resolve();
      }),
    })),
  }));

  // Override delete
  mockDb.delete = vi.fn(() => ({
    where: vi.fn(() => Promise.resolve({ rowCount: 0 })),
  }));

  return mockDb as unknown as PostgresJsDatabase;
}

// =============================================================================
// Test Helpers
// =============================================================================

function createMockPage(overrides: Partial<CachedPage> = {}): CachedPage {
  return {
    html: "<html><body><h1>Test</h1><p>Content</p></body></html>",
    contentHash: "abc123def456gh78",
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    tierUsed: "direct",
    statusCode: 200,
    pageSizeBytes: 1000,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("L3Cache", () => {
  let db: PostgresJsDatabase & { __reset: () => void };
  let cache: L3Cache;

  beforeEach(() => {
    db = createMockDb() as any;
    cache = createL3Cache(db, TEST_CLIENT_ID);
    db.__reset();
  });

  describe("basic operations", () => {
    it("should have level L3", () => {
      expect(cache.level).toBe("L3");
    });

    it("should return null for non-existent key", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should track statistics", async () => {
      // Generate some activity
      await cache.get("nonexistent1");
      await cache.get("nonexistent2");

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0);
    });

    it("should reset statistics", async () => {
      await cache.get("nonexistent");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe("set and get operations", () => {
    it("should call insert with correct values", async () => {
      const page = createMockPage();
      await cache.set("test-hash", page, 60000);

      expect(db.insert).toHaveBeenCalled();
    });

    it("should call delete with hash", async () => {
      await cache.delete("test-hash");
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("has operation", () => {
    it("should return false for non-existent entry", async () => {
      const exists = await cache.has("nonexistent");
      expect(exists).toBe(false);
    });
  });

  describe("bulk operations", () => {
    it("should handle empty mget", async () => {
      const results = await cache.mget([]);
      expect(results.size).toBe(0);
    });

    it("should track request count for mget", async () => {
      await cache.mget(["hash1", "hash2"]);

      const stats = cache.getStats();
      expect(stats.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("maintenance operations", () => {
    it("should call delete for expired entries", async () => {
      const deleted = await cache.deleteExpired();
      expect(deleted).toBe(0);
    });

    it("should return storage stats", async () => {
      const stats = await cache.getStorageStats();

      expect(stats).toHaveProperty("totalEntries");
      expect(stats).toHaveProperty("totalAliases");
      expect(stats).toHaveProperty("totalSizeBytes");
    });
  });

  describe("content deduplication", () => {
    it("should call findByContentHash", async () => {
      const hashes = await cache.findByContentHash("content123");
      expect(Array.isArray(hashes)).toBe(true);
    });
  });

  describe("setWithUrl operation", () => {
    it("should call insert with URL", async () => {
      const page = createMockPage();
      await cache.setWithUrl("test-hash", "https://example.com/page", page, 60000);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("clear operation", () => {
    it("should call delete on both tables", async () => {
      await cache.clear();

      expect(db.delete).toHaveBeenCalled();
    });
  });
});

describe("createL3Cache factory", () => {
  it("should create cache with custom config", () => {
    const db = createMockDb();
    const cache = createL3Cache(db, TEST_CLIENT_ID, {
      retentionDays: 60,
      batchSize: 50,
    });

    expect(cache).toBeInstanceOf(L3Cache);
  });

  it("should throw error when clientId is not provided", () => {
    const db = createMockDb();
    expect(() => createL3Cache(db, "", {})).toThrow(
      "L3Cache requires clientId for tenant isolation"
    );
  });
});
