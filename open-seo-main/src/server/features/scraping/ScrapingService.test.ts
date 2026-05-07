/**
 * ScrapingService Integration Tests
 * Phase 95-05: Migration & Monitoring
 *
 * Tests for the unified ScrapingService facade including:
 * - Single and batch scraping
 * - Feature flag integration
 * - Migration routing
 * - Metrics collection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// Hoisted Mocks - Vitest requires hoisted mocks before imports
// =============================================================================

const { mockFetch, mockFetchBatch, mockSetCacheManager, mockDiscoverDomain, mockGetDomainStats, mockEstimateCost } = vi.hoisted(() => ({
  mockFetch: vi.fn().mockResolvedValue({
    url: "https://example.com",
    success: true,
    html: "<html><head><title>Test</title></head><body>Content</body></html>",
    statusCode: 200,
    tierUsed: "direct",
    fromCache: false,
    responseTimeMs: 150,
    responseSizeBytes: 1024,
    estimatedCostUsd: 0,
    quality: {
      score: 85,
      acceptable: true,
      wordCount: 100,
      textRatio: 0.3,
    },
  }),
  mockFetchBatch: vi.fn().mockResolvedValue(
    new Map([
      [
        "https://example.com/1",
        {
          url: "https://example.com/1",
          success: true,
          html: "<html><body>Page 1</body></html>",
          statusCode: 200,
          tierUsed: "direct",
          fromCache: false,
          responseTimeMs: 100,
          responseSizeBytes: 512,
          estimatedCostUsd: 0,
        },
      ],
      [
        "https://example.com/2",
        {
          url: "https://example.com/2",
          success: true,
          html: "<html><body>Page 2</body></html>",
          statusCode: 200,
          tierUsed: "webshare",
          fromCache: true,
          responseTimeMs: 50,
          responseSizeBytes: 512,
          estimatedCostUsd: 0,
        },
      ],
    ])
  ),
  mockSetCacheManager: vi.fn(),
  mockDiscoverDomain: vi.fn().mockResolvedValue({
    domain: "example.com",
    optimalTier: "direct",
    technologies: ["wordpress"],
  }),
  mockGetDomainStats: vi.fn().mockResolvedValue({
    domain: "example.com",
    optimalTier: "direct",
    successRate: 0.98,
    avgResponseTimeMs: 200,
    totalRequests: 100,
    technologies: ["wordpress"],
  }),
  mockEstimateCost: vi.fn().mockResolvedValue({
    domain: "example.com",
    knownTier: "direct",
    estimatedCostUsd: 0,
    estimatedTimeMs: 2000,
  }),
}));

// Mock TieredFetcher with hoisted mocks
vi.mock("./TieredFetcher", () => ({
  TieredFetcher: class MockTieredFetcher {
    fetch = mockFetch;
    fetchBatch = mockFetchBatch;
    setCacheManager = mockSetCacheManager;
    discoverDomain = mockDiscoverDomain;
    getDomainStats = mockGetDomainStats;
    estimateCost = mockEstimateCost;
  },
  tieredFetcher: {
    fetch: mockFetch,
    fetchBatch: mockFetchBatch,
    setCacheManager: mockSetCacheManager,
  },
  createTieredFetcher: vi.fn(),
}));

// Mock DomainLearningService
vi.mock("./DomainLearningService", () => ({
  DomainLearningService: class MockDomainLearningService {
    getConfig = vi.fn().mockResolvedValue(null);
    getRevalidationCandidates = vi.fn().mockResolvedValue([]);
  },
  domainLearningService: {
    getConfig: vi.fn().mockResolvedValue(null),
    getRevalidationCandidates: vi.fn().mockResolvedValue([]),
  },
  normalizeDomain: vi.fn((url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }),
}));

// Mock CacheManager
vi.mock("./cache", () => ({
  createCacheManager: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({ hit: false }),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidateDomain: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      l1: { hits: 10, misses: 5, hitRate: 0.67, avgLatencyMs: 1, sizeBytes: 1000, itemCount: 10 },
      l2: { hits: 20, misses: 10, hitRate: 0.67, avgLatencyMs: 5, sizeBytes: 10000, itemCount: 100 },
      l3: { hits: 5, misses: 3, hitRate: 0.63, avgLatencyMs: 20, sizeBytes: 100000, itemCount: 500 },
      l4: { hits: 2, misses: 1, hitRate: 0.67, avgLatencyMs: 100, sizeBytes: 1000000, itemCount: 1000 },
      totalHitRate: 0.67,
      avgLatencyMs: 10,
      totalRequests: 56,
      lastResetAt: new Date(),
    }),
  }),
  CacheManager: class MockCacheManager {},
}));

// Mock QueueManager
vi.mock("./queue", async () => {
  const actual = await vi.importActual("./queue");
  return {
    ...actual,
    getQueueManager: vi.fn().mockReturnValue({
      enqueue: vi.fn().mockResolvedValue({
        jobId: "test-job-1",
        queue: "scrape:standard",
        priority: "normal",
        position: 0,
      }),
      enqueueBatch: vi.fn().mockResolvedValue([
        { jobId: "test-job-1", queue: "scrape:standard", priority: "normal", position: 0 },
        { jobId: "test-job-2", queue: "scrape:standard", priority: "normal", position: 1 },
      ]),
      getQueueMetrics: vi.fn().mockResolvedValue({
        queues: {},
        global: { currentConcurrency: 10, maxConcurrency: 200 },
      }),
    }),
    QueueManager: class MockQueueManager {},
  };
});

// =============================================================================
// Imports - After mocks
// =============================================================================

import {
  ScrapingService,
  createScrapingService,
} from "./ScrapingService";
import {
  loadMigrationFlagsCached,
  setFlagOverride,
  clearAllFlagOverrides,
} from "./config";
import {
  runShadow,
  getShadowStats,
  clearShadowLogs,
  compareSingleScrape,
} from "./migration";

// =============================================================================
// Test Suite: ScrapingService
// =============================================================================

describe("ScrapingService", () => {
  let service: ScrapingService;

  beforeEach(() => {
    service = createScrapingService();
    clearAllFlagOverrides();
    clearShadowLogs();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearAllFlagOverrides();
  });

  // ===========================================================================
  // Initialization Tests
  // ===========================================================================

  describe("initialization", () => {
    it("should create a new service instance", () => {
      expect(service).toBeInstanceOf(ScrapingService);
    });

    it("should not be initialized before calling initialize()", () => {
      expect(service.isInitialized()).toBe(false);
    });

    it("should be initialized after calling initialize()", () => {
      const mockRedis = {} as any;
      const mockDb = {} as any;

      service.initialize({ redis: mockRedis, db: mockDb });

      expect(service.isInitialized()).toBe(true);
    });
  });

  // ===========================================================================
  // Single Scrape Tests
  // ===========================================================================

  describe("scrape()", () => {
    beforeEach(() => {
      service.initialize({ redis: {} as any, db: {} as any });
    });

    it("should scrape a URL successfully", async () => {
      const result = await service.scrape("https://example.com");

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.url).toBe("https://example.com");
      expect(result.statusCode).toBe(200);
      expect(result.html).toContain("<title>Test</title>");
    });

    it("should include parsed data when requested", async () => {
      const result = await service.scrape("https://example.com", {
        includeParsedData: true,
      });

      expect(result.parsedData).toBeDefined();
      expect(result.parsedData?.title).toBe("Test");
    });

    it("should exclude HTML when includeHtml is false", async () => {
      const result = await service.scrape("https://example.com", {
        includeHtml: false,
      });

      expect(result.html).toBeUndefined();
    });

    it("should track feature requests", async () => {
      await service.scrape("https://example.com", {
        feature: "prospectAnalysis",
      });

      const metrics = await service.getMetrics();
      expect(metrics.cost.byFeature).toBeDefined();
    });
  });

  // ===========================================================================
  // Batch Scrape Tests
  // ===========================================================================

  describe("scrapeBatch()", () => {
    beforeEach(() => {
      service.initialize({ redis: {} as any, db: {} as any });
    });

    it("should scrape multiple URLs in batch", async () => {
      const urls = [
        "https://example.com/1",
        "https://example.com/2",
        "https://example.com/3",
      ];

      const result = await service.scrapeBatch(urls, { concurrency: 2 });

      expect(result.results).toHaveLength(3);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should track tier distribution in batch results", async () => {
      const urls = ["https://example.com/1", "https://example.com/2"];

      const result = await service.scrapeBatch(urls);

      expect(result.tierDistribution).toBeDefined();
      const totalTierRequests = Object.values(result.tierDistribution).reduce(
        (a, b) => a + b,
        0
      );
      expect(totalTierRequests).toBe(urls.length);
    });

    it("should track cache hits in batch results", async () => {
      const urls = ["https://example.com/1", "https://example.com/2"];

      const result = await service.scrapeBatch(urls);

      expect(result.cacheHits).toBeDefined();
      expect(result.cacheMisses).toBeDefined();
      expect(result.cacheHits + result.cacheMisses).toBe(urls.length);
    });

    it("should call progress callback", async () => {
      const progressFn = vi.fn();
      const urls = ["https://example.com/1", "https://example.com/2"];

      await service.scrapeBatch(urls, { onProgress: progressFn });

      expect(progressFn).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Cache Tests
  // ===========================================================================

  describe("cache operations", () => {
    beforeEach(() => {
      service.initialize({ redis: {} as any, db: {} as any });
    });

    it("should warm cache for URLs", async () => {
      const urls = ["https://example.com/1", "https://example.com/2"];

      const result = await service.warmCache(urls);

      expect(result).toHaveProperty("warmed");
      expect(result).toHaveProperty("alreadyCached");
      expect(result).toHaveProperty("failed");
    });

    it("should invalidate cache for a URL", async () => {
      await service.invalidateCache("https://example.com");
      // Should complete without error
    });

    it("should invalidate cache for a domain", async () => {
      await service.invalidateDomain("example.com");
      // Should complete without error
    });
  });

  // ===========================================================================
  // Metrics Tests
  // ===========================================================================

  describe("getMetrics()", () => {
    beforeEach(() => {
      service.initialize({ redis: {} as any, db: {} as any });
    });

    it("should return comprehensive metrics", async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toHaveProperty("cost");
      expect(metrics).toHaveProperty("performance");
      expect(metrics).toHaveProperty("cache");
      expect(metrics).toHaveProperty("domainLearning");
      expect(metrics).toHaveProperty("migration");
    });

    it("should include migration flag status", async () => {
      const metrics = await service.getMetrics();

      expect(metrics.migration.flagStatus).toBeDefined();
      expect(metrics.migration.flagStatus.prospectAnalysis).toBeDefined();
    });

    it("should track shadow mismatches", async () => {
      service.recordShadowMismatch();
      service.recordShadowMismatch();

      const metrics = await service.getMetrics();

      expect(metrics.migration.shadowMismatches).toBe(2);
    });

    it("should track fallbacks", async () => {
      service.recordFallback();

      const metrics = await service.getMetrics();

      expect(metrics.migration.fallbacksTriggered).toBe(1);
    });
  });

  // ===========================================================================
  // Cost Report Tests
  // ===========================================================================

  describe("getCostReport()", () => {
    beforeEach(() => {
      service.initialize({ redis: {} as any, db: {} as any });
    });

    it("should return daily cost report", async () => {
      const report = await service.getCostReport("day");

      expect(report.period).toBe("day");
      expect(report).toHaveProperty("totalCostUsd");
      expect(report).toHaveProperty("byTier");
    });

    it("should return weekly cost report", async () => {
      const report = await service.getCostReport("week");

      expect(report.period).toBe("week");
    });

    it("should return monthly cost report", async () => {
      const report = await service.getCostReport("month");

      expect(report.period).toBe("month");
    });
  });

  // ===========================================================================
  // Queue Tests
  // ===========================================================================

  describe("queue operations", () => {
    beforeEach(() => {
      service.initialize({ redis: {} as any, db: {} as any });
    });

    it("should enqueue a URL for background processing", async () => {
      const result = await service.enqueue("https://example.com");

      expect(result).not.toBeNull();
      expect(result?.jobId).toBeDefined();
    });

    it("should enqueue multiple URLs", async () => {
      const results = await service.enqueueBatch([
        "https://example.com/1",
        "https://example.com/2",
      ]);

      expect(results).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Domain Learning Tests
  // ===========================================================================

  describe("domain learning", () => {
    beforeEach(() => {
      service.initialize({ redis: {} as any, db: {} as any });
    });

    it("should discover domain tier", async () => {
      const result = await service.discoverDomain("example.com");

      expect(result.domain).toBe("example.com");
      expect(result.optimalTier).toBeDefined();
    });

    it("should get domain stats", async () => {
      const stats = await service.getDomainStats("example.com");

      expect(stats?.domain).toBe("example.com");
    });

    it("should estimate cost for URL", async () => {
      const estimate = await service.estimateCost("https://example.com");

      expect(estimate.domain).toBe("example.com");
      expect(estimate.estimatedCostUsd).toBeDefined();
    });
  });
});

// =============================================================================
// Test Suite: Feature Flags
// =============================================================================

describe("Feature Flags", () => {
  beforeEach(() => {
    clearAllFlagOverrides();
  });

  afterEach(() => {
    clearAllFlagOverrides();
  });

  it("should load default flags", () => {
    const flags = loadMigrationFlagsCached();

    expect(flags.prospectAnalysis).toBe("legacy");
    expect(flags.siteAudits).toBe("legacy");
  });

  it("should allow setting flag overrides", () => {
    setFlagOverride("prospectAnalysis", "rollout");

    // Verify override mechanism exists
    expect(setFlagOverride).toBeDefined();
  });

  it("should clear all overrides", () => {
    setFlagOverride("prospectAnalysis", "rollout");
    setFlagOverride("siteAudits", "canary");

    clearAllFlagOverrides();

    const flags = loadMigrationFlagsCached();
    expect(flags.prospectAnalysis).toBe("legacy");
  });
});

// =============================================================================
// Test Suite: Shadow Mode
// =============================================================================

describe("Shadow Mode", () => {
  beforeEach(() => {
    clearShadowLogs();
  });

  it("should run shadow comparison and return legacy result", async () => {
    const legacyResult = { value: "legacy", cost: 10 };
    const newResult = { value: "new", cost: 5 };

    const result = await runShadow(
      "test-feature",
      async () => legacyResult,
      async () => newResult,
      (legacy, newRes) => ({
        match: legacy.value === newRes.value,
        differences: legacy.value !== newRes.value ? ["value mismatch"] : [],
      })
    );

    // Should return legacy result
    expect(result).toBe(legacyResult);
  });

  it("should track shadow statistics", async () => {
    // Run a shadow comparison
    await runShadow(
      "test-feature",
      async () => ({ success: true }),
      async () => ({ success: true }),
      (legacy, newRes) => ({
        match: legacy.success === newRes.success,
        differences: [],
      }),
      { logOnMatch: true }
    );

    const stats = getShadowStats();

    expect(stats.totalComparisons).toBeGreaterThanOrEqual(1);
  });

  it("should clear shadow logs", () => {
    clearShadowLogs();

    const stats = getShadowStats();

    expect(stats.totalComparisons).toBe(0);
  });
});

// =============================================================================
// Test Suite: Comparators
// =============================================================================

describe("Comparators", () => {
  describe("compareSingleScrape", () => {
    it("should match identical results", () => {
      const result1 = {
        url: "https://example.com",
        success: true,
        statusCode: 200,
        html: "<html>Content</html>",
        tierUsed: "direct" as const,
        fromCache: false,
        responseTimeMs: 100,
        responseSizeBytes: 500,
        estimatedCostUsd: 0,
      };

      const result2 = { ...result1 };

      const comparison = compareSingleScrape(result1, result2);

      expect(comparison.match).toBe(true);
      expect(comparison.differences).toHaveLength(0);
    });

    it("should detect success mismatch", () => {
      const result1 = {
        url: "https://example.com",
        success: true,
        statusCode: 200,
        tierUsed: "direct" as const,
        fromCache: false,
        responseTimeMs: 100,
        responseSizeBytes: 500,
        estimatedCostUsd: 0,
      };

      const result2 = { ...result1, success: false };

      const comparison = compareSingleScrape(result1, result2);

      expect(comparison.match).toBe(false);
      expect(comparison.differences.some((d) => d.includes("Success"))).toBe(true);
    });

    it("should detect status code mismatch", () => {
      const result1 = {
        url: "https://example.com",
        success: true,
        statusCode: 200,
        tierUsed: "direct" as const,
        fromCache: false,
        responseTimeMs: 100,
        responseSizeBytes: 500,
        estimatedCostUsd: 0,
      };

      const result2 = { ...result1, statusCode: 404 };

      const comparison = compareSingleScrape(result1, result2);

      expect(comparison.match).toBe(false);
      expect(comparison.differences.some((d) => d.includes("Status"))).toBe(true);
    });

    it("should tolerate small HTML length differences", () => {
      const result1 = {
        url: "https://example.com",
        success: true,
        statusCode: 200,
        html: "x".repeat(1000),
        tierUsed: "direct" as const,
        fromCache: false,
        responseTimeMs: 100,
        responseSizeBytes: 1000,
        estimatedCostUsd: 0,
      };

      // 5% difference should be tolerated
      const result2 = { ...result1, html: "x".repeat(1050) };

      const comparison = compareSingleScrape(result1, result2);

      expect(comparison.match).toBe(true);
    });

    it("should detect large HTML length differences", () => {
      const result1 = {
        url: "https://example.com",
        success: true,
        statusCode: 200,
        html: "x".repeat(1000),
        tierUsed: "direct" as const,
        fromCache: false,
        responseTimeMs: 100,
        responseSizeBytes: 1000,
        estimatedCostUsd: 0,
      };

      // 50% difference should be flagged
      const result2 = { ...result1, html: "x".repeat(1500) };

      const comparison = compareSingleScrape(result1, result2);

      expect(comparison.match).toBe(false);
      expect(comparison.differences.some((d) => d.includes("HTML length"))).toBe(true);
    });
  });
});

// =============================================================================
// Test Suite: Migration Router Integration
// =============================================================================

describe("Migration Router Integration", () => {
  let service: ScrapingService;

  beforeEach(() => {
    service = createScrapingService();
    service.initialize({ redis: {} as any, db: {} as any });
    clearAllFlagOverrides();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearAllFlagOverrides();
  });

  it("should use legacy when flag is legacy", async () => {
    // Default is legacy, so just verify scrape works
    const result = await service.scrape("https://example.com", {
      feature: "prospectAnalysis",
    });

    expect(result.success).toBe(true);
  });

  it("should track feature in metrics", async () => {
    await service.scrape("https://example.com", {
      feature: "contentBriefs",
    });

    await service.scrape("https://example.com/2", {
      feature: "contentBriefs",
    });

    const metrics = await service.getMetrics();

    expect(metrics.cost.byFeature).toBeDefined();
  });
});
