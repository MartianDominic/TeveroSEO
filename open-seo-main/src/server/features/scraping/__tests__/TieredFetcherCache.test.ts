/**
 * TieredFetcher Cache Integration Tests
 * Phase 95-02: Multi-Level Caching - Task 8
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TieredFetcher, createTieredFetcher } from "../TieredFetcher";
import type { CacheManager, CachedPage, CacheResult } from "../cache";

// =============================================================================
// Mock Setup
// =============================================================================

// Mock domain learning service
vi.mock("../DomainLearningService", () => ({
  domainLearningService: {
    getConfig: vi.fn().mockResolvedValue(null),
    fetch: vi.fn().mockResolvedValue({
      success: true,
      html: "<html><body><h1>Test Page</h1><p>Content here</p></body></html>",
      statusCode: 200,
      tier: "direct",
      responseTimeMs: 100,
      responseSizeBytes: 1000,
      costUsd: 0,
    }),
    discover: vi.fn().mockResolvedValue({
      domain: "example.com",
      optimalTier: "direct",
      technologies: [],
    }),
  },
  normalizeDomain: vi.fn((url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }),
}));

// Mock content quality assessor
vi.mock("../ContentQualityAssessor", () => ({
  contentQualityAssessor: {
    assess: vi.fn().mockReturnValue({
      score: 85,
      acceptable: true,
      metrics: {
        wordCount: 100,
        textRatio: 0.3,
      },
    }),
  },
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createMockCacheManager(): CacheManager & {
  _mockGet: ReturnType<typeof vi.fn>;
  _mockSet: ReturnType<typeof vi.fn>;
} {
  const mockGet = vi.fn().mockResolvedValue({ hit: false, latencyMs: 1 });
  const mockSet = vi.fn().mockResolvedValue(undefined);

  return {
    get: mockGet,
    set: mockSet,
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidateDomain: vi.fn().mockResolvedValue(undefined),
    prewarm: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      l1: { hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 },
      l2: { hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 },
      l3: { hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 },
      l4: { hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 },
      totalHitRate: 0,
      avgLatencyMs: 0,
      totalRequests: 0,
      lastResetAt: new Date(),
    }),
    resetStats: vi.fn(),
    shouldSkipCache: vi.fn().mockResolvedValue(false),
    getRevalidationHeaders: vi.fn().mockResolvedValue(null),
    handleInvalidation: vi.fn().mockResolvedValue(undefined),
    _mockGet: mockGet,
    _mockSet: mockSet,
  } as any;
}

function createMockCachedPage(overrides: Partial<CachedPage> = {}): CachedPage {
  return {
    html: "<html><body><h1>Cached Page</h1></body></html>",
    contentHash: "abc123",
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    tierUsed: "direct",
    statusCode: 200,
    pageSizeBytes: 500,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("TieredFetcher Cache Integration", () => {
  let fetcher: TieredFetcher;
  let mockCacheManager: ReturnType<typeof createMockCacheManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetcher = createTieredFetcher();
    mockCacheManager = createMockCacheManager();
    fetcher.setCacheManager(mockCacheManager as any);
  });

  describe("cache hits", () => {
    it("should return cached result on cache hit", async () => {
      const cachedPage = createMockCachedPage();
      mockCacheManager._mockGet.mockResolvedValueOnce({
        hit: true,
        level: "L1",
        data: cachedPage,
        latencyMs: 1,
      });

      const result = await fetcher.fetch("https://example.com/page");

      expect(result.fromCache).toBe(true);
      expect(result.cacheLevel).toBe("L1");
      expect(result.html).toBe(cachedPage.html);
      expect(result.estimatedCostUsd).toBe(0); // Free!
      expect(result.success).toBe(true);
    });

    it("should return L2 cache hit correctly", async () => {
      const cachedPage = createMockCachedPage({ tierUsed: "webshare" });
      mockCacheManager._mockGet.mockResolvedValueOnce({
        hit: true,
        level: "L2",
        data: cachedPage,
        latencyMs: 3,
      });

      const result = await fetcher.fetch("https://example.com/page");

      expect(result.fromCache).toBe(true);
      expect(result.cacheLevel).toBe("L2");
      expect(result.tierUsed).toBe("webshare");
    });

    it("should return L3 cache hit correctly", async () => {
      const cachedPage = createMockCachedPage();
      mockCacheManager._mockGet.mockResolvedValueOnce({
        hit: true,
        level: "L3",
        data: cachedPage,
        latencyMs: 15,
      });

      const result = await fetcher.fetch("https://example.com/page");

      expect(result.cacheLevel).toBe("L3");
    });

    it("should return L4 cache hit correctly", async () => {
      const cachedPage = createMockCachedPage();
      mockCacheManager._mockGet.mockResolvedValueOnce({
        hit: true,
        level: "L4",
        data: cachedPage,
        latencyMs: 150,
      });

      const result = await fetcher.fetch("https://example.com/page");

      expect(result.cacheLevel).toBe("L4");
    });

    it("should not check cache when skipCache is true", async () => {
      await fetcher.fetch("https://example.com/page", { skipCache: true });

      expect(mockCacheManager._mockGet).not.toHaveBeenCalled();
    });

    it("should include quality metrics from cached page", async () => {
      const cachedPage = createMockCachedPage();
      mockCacheManager._mockGet.mockResolvedValueOnce({
        hit: true,
        level: "L1",
        data: cachedPage,
        latencyMs: 1,
      });

      const result = await fetcher.fetch("https://example.com/page");

      expect(result.quality).toBeDefined();
      expect(result.quality?.score).toBe(85);
      expect(result.quality?.acceptable).toBe(true);
    });
  });

  describe("cache misses", () => {
    it("should fetch from network on cache miss", async () => {
      mockCacheManager._mockGet.mockResolvedValueOnce({
        hit: false,
        latencyMs: 5,
      });

      const result = await fetcher.fetch("https://example.com/page");

      expect(result.fromCache).toBe(false);
      expect(result.success).toBe(true);
      expect(result.html).toContain("Test Page");
    });

    it("should store result in cache after successful fetch", async () => {
      mockCacheManager._mockGet.mockResolvedValueOnce({
        hit: false,
        latencyMs: 5,
      });

      await fetcher.fetch("https://example.com/page");

      expect(mockCacheManager._mockSet).toHaveBeenCalled();
      const setCall = mockCacheManager._mockSet.mock.calls[0];
      expect(setCall[0]).toBe("https://example.com/page");
      expect(setCall[1]).toHaveProperty("html");
      expect(setCall[1]).toHaveProperty("contentHash");
    });

    it("should not store failed results in cache", async () => {
      const { domainLearningService } = await import("../DomainLearningService");
      (domainLearningService.fetch as any).mockResolvedValueOnce({
        success: false,
        statusCode: 500,
        tier: "direct",
        responseTimeMs: 100,
        responseSizeBytes: 0,
        costUsd: 0,
        error: { message: "Server error" },
      });

      mockCacheManager._mockGet.mockResolvedValueOnce({
        hit: false,
        latencyMs: 5,
      });

      await fetcher.fetch("https://example.com/page");

      expect(mockCacheManager._mockSet).not.toHaveBeenCalled();
    });
  });

  describe("without cache manager", () => {
    it("should work without cache manager set", async () => {
      const uncachedFetcher = createTieredFetcher();
      // Don't set cache manager

      const result = await uncachedFetcher.fetch("https://example.com/page");

      expect(result.fromCache).toBe(false);
      expect(result.success).toBe(true);
    });
  });

  describe("content type detection", () => {
    it("should detect content type and pass to cache", async () => {
      mockCacheManager._mockGet.mockResolvedValueOnce({
        hit: false,
        latencyMs: 5,
      });

      await fetcher.fetch("https://example.com/blog/my-post");

      expect(mockCacheManager._mockSet).toHaveBeenCalled();
      const setOptions = mockCacheManager._mockSet.mock.calls[0][2];
      expect(setOptions).toHaveProperty("contentType");
    });
  });

  describe("batch fetching", () => {
    it("should check cache for each URL in batch", async () => {
      const cachedPage = createMockCachedPage();

      // First URL is cached, second is not
      mockCacheManager._mockGet
        .mockResolvedValueOnce({ hit: true, level: "L1", data: cachedPage, latencyMs: 1 })
        .mockResolvedValueOnce({ hit: false, latencyMs: 5 });

      const results = await fetcher.fetchBatch([
        "https://example.com/page1",
        "https://example.com/page2",
      ]);

      expect(results.size).toBe(2);
      expect(results.get("https://example.com/page1")?.fromCache).toBe(true);
      expect(results.get("https://example.com/page2")?.fromCache).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle cache errors gracefully", async () => {
      mockCacheManager._mockGet.mockRejectedValueOnce(new Error("Redis connection failed"));

      // Should still work by fetching from network
      const result = await fetcher.fetch("https://example.com/page");

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
    });

    it("should handle cache set errors gracefully", async () => {
      mockCacheManager._mockGet.mockResolvedValueOnce({ hit: false, latencyMs: 5 });
      mockCacheManager._mockSet.mockRejectedValueOnce(new Error("Cache write failed"));

      // Should still return the result
      const result = await fetcher.fetch("https://example.com/page");

      expect(result.success).toBe(true);
    });
  });
});
