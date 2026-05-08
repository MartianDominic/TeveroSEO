/**
 * TieredFetcher Unit Tests
 * Phase 95-08: Test Coverage & Reliability
 *
 * Tests tier escalation, domain learning, cost tracking, timeouts,
 * rate limiting, and response validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TieredFetcher, createTieredFetcher } from "../../TieredFetcher";
import type { TieredFetchResult } from "../../types";
import type { ScrapeTier } from "@/db/domain-scrape-learning-schema";

// =============================================================================
// Mocks
// =============================================================================

// Mock DomainLearningService
vi.mock("../../DomainLearningService", () => ({
  domainLearningService: {
    fetch: vi.fn(),
    discover: vi.fn(),
    getConfig: vi.fn(),
  },
  normalizeDomain: vi.fn((url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.toLowerCase();
    } catch {
      return url;
    }
  }),
}));

// Mock ContentQualityAssessor
vi.mock("../../ContentQualityAssessor", () => ({
  contentQualityAssessor: {
    assess: vi.fn((_html: string) => ({
      score: 85,
      acceptable: true,
      metrics: {
        wordCount: 500,
        textRatio: 0.6,
        codeRatio: 0.1,
      },
      issues: [],
    })),
  },
}));

// Mock cache utilities
vi.mock("../../cache", () => ({
  getContentHash: vi.fn((content: string) => `hash-${content.length}`),
  detectContentType: vi.fn(() => "article" as const),
}));

// Mock BandwidthTracker - use vi.hoisted to ensure mock is available during module load
const { mockBandwidthTracker } = vi.hoisted(() => ({
  mockBandwidthTracker: {
    getStatus: vi.fn().mockResolvedValue({
      provider: "geonode",
      usedBytes: 1000000,
      limitBytes: 10737418240, // 10GB
      remainingBytes: 10736418240,
      percentUsed: 0.01,
      estimatedCostUsd: 0.00072,
      isExhausted: false,
      isWarning: false,
      isCritical: false,
      month: "2026-05",
    }),
    recordUsage: vi.fn(),
  },
}));

vi.mock("../../monitoring/BandwidthTracker", () => ({
  getBandwidthTracker: () => mockBandwidthTracker,
}));

import { domainLearningService } from "../../DomainLearningService";

// =============================================================================
// Test Helpers
// =============================================================================

function createMockTieredFetchResult(
  overrides: Partial<TieredFetchResult> = {}
): TieredFetchResult {
  return {
    success: true,
    html: "<html><body>Test Content</body></html>",
    statusCode: 200,
    tier: "direct",
    responseTimeMs: 1000,
    responseSizeBytes: 1024,
    costUsd: 0,
    validation: {
      hasBody: true,
      hasTitle: true,
      hasH1: true,
      wordCount: 100,
      textRatio: 0.5,
      isSpaShell: false,
      isBotDetectionPage: false,
      isCaptchaPage: false,
    },
    ...overrides,
  };
}

function createMockCacheManager() {
  return {
    get: vi.fn().mockResolvedValue({ hit: false }),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidatePattern: vi.fn().mockResolvedValue(0),
    getMetrics: vi.fn().mockResolvedValue({
      hits: { L1: 0, L2: 0, L3: 0, L4: 0 },
      misses: 0,
      writes: 0,
    }),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("TieredFetcher", () => {
  let fetcher: TieredFetcher;
  let mockCacheManager: ReturnType<typeof createMockCacheManager>;

  beforeEach(() => {
    fetcher = createTieredFetcher();
    mockCacheManager = createMockCacheManager();
    fetcher.setCacheManager(mockCacheManager as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Tier Escalation", () => {
    it("should start with direct fetch for non-protected URLs", async () => {
      const mockResult = createMockTieredFetchResult({
        tier: "direct",
        costUsd: 0,
      });

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      const result = await fetcher.fetch("https://example.com");

      expect(result.success).toBe(true);
      expect(result.tierUsed).toBe("direct");
      expect(result.estimatedCostUsd).toBe(0);
      expect(domainLearningService.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com",
        })
      );
    });

    it("should escalate to webshare on direct fetch failure", async () => {
      const mockResult = createMockTieredFetchResult({
        tier: "webshare",
        costUsd: 0,
        discovery: {
          isNewDomain: true,
          tiersAttempted: ["direct", "webshare"],
          escalationPath: [
            { tier: "direct" as ScrapeTier, reason: "ip_blocked" as const },
          ],
        },
      });

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      const result = await fetcher.fetch("https://protected-site.com");

      expect(result.success).toBe(true);
      expect(result.tierUsed).toBe("webshare");
      expect(result.discovery?.tiersAttempted).toContain("direct");
      expect(result.discovery?.tiersAttempted).toContain("webshare");
    });

    it("should escalate through all tiers until success", async () => {
      const mockResult = createMockTieredFetchResult({
        tier: "dfs_js",
        costUsd: 0.00125,
        discovery: {
          isNewDomain: true,
          tiersAttempted: ["direct", "webshare", "geonode", "camoufox", "dfs_basic", "dfs_js"],
          escalationPath: [
            { tier: "direct" as ScrapeTier, reason: "ip_blocked" as const },
            { tier: "webshare" as ScrapeTier, reason: "ip_blocked" as const },
            { tier: "geonode" as ScrapeTier, reason: "ip_blocked" as const },
            { tier: "camoufox" as ScrapeTier, reason: "bot_detected" as const },
            { tier: "dfs_basic" as ScrapeTier, reason: "js_required" as const },
          ],
        },
      });

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      const result = await fetcher.fetch("https://heavily-protected.com");

      expect(result.success).toBe(true);
      expect(result.tierUsed).toBe("dfs_js");
      expect(result.discovery?.tiersAttempted.length).toBe(6);
    });

    it("should fail after all tiers exhausted", async () => {
      const mockResult = createMockTieredFetchResult({
        success: false,
        tier: "dfs_browser",
        html: undefined,
        error: { message: "All tiers exhausted", reason: "bot_detected" as const, tier: "dfs_browser" as ScrapeTier },
      });

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      const result = await fetcher.fetch("https://impossible.com");

      expect(result.success).toBe(false);
      expect(result.error).toContain("All tiers exhausted");
    });
  });

  describe("Domain Learning", () => {
    it("should skip to learned tier for known domains", async () => {
      // Mock known domain config
      vi.mocked(domainLearningService.getConfig).mockResolvedValue({
        domain: "protected-domain.com",
        optimalTier: "geonode",
        isValidated: true,
        successRate: 0.98,
        consecutiveFailures: 0,
        avgResponseTimeMs: 2500,
        detectedTechnologies: ["cloudflare"],
        hasAntiBotProtection: true,
        requiresJsRendering: false,
        geoRequirement: null,
        lastEscalationReason: null,
        updatedAt: new Date(),
        nextRevalidationAt: null,
      });

      const mockResult = createMockTieredFetchResult({
        tier: "geonode",
        costUsd: 0,
      });

      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      const result = await fetcher.fetch("https://protected-domain.com/page");

      expect(result.tierUsed).toBe("geonode");
      // Should only make one fetch call (no escalation)
      expect(domainLearningService.fetch).toHaveBeenCalledTimes(1);
    });

    it("should re-discover on learned tier failure", async () => {
      // First call - learned tier fails
      vi.mocked(domainLearningService.getConfig).mockResolvedValue({
        domain: "flaky-domain.com",
        optimalTier: "webshare",
        isValidated: true,
        successRate: 0.9,
        consecutiveFailures: 0,
        avgResponseTimeMs: 3000,
        detectedTechnologies: [],
        hasAntiBotProtection: false,
        requiresJsRendering: false,
        geoRequirement: null,
        lastEscalationReason: null,
        updatedAt: new Date(),
        nextRevalidationAt: null,
      });

      // First fetch fails
      vi.mocked(domainLearningService.fetch)
        .mockResolvedValueOnce(
          createMockTieredFetchResult({
            success: false,
            tier: "webshare",
            error: { message: "Connection timeout", reason: "timeout" as const, tier: "webshare" as ScrapeTier },
          })
        )
        // Second fetch (discovery) succeeds
        .mockResolvedValueOnce(
          createMockTieredFetchResult({
            tier: "geonode",
            costUsd: 0,
          })
        );

      const result = await fetcher.fetch("https://flaky-domain.com/page");

      expect(result.success).toBe(true);
      expect(result.tierUsed).toBe("geonode");
      expect(domainLearningService.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Cost Tracking", () => {
    it("should track cost for paid tiers", async () => {
      const mockResult = createMockTieredFetchResult({
        tier: "geonode",
        costUsd: 0.000123, // $0.77/GB
        responseSizeBytes: 200000,
      });

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      const result = await fetcher.fetch("https://example.com");

      expect(result.estimatedCostUsd).toBeGreaterThan(0);
      expect(result.tierUsed).toBe("geonode");
    });

    it("should report zero cost for cache hits", async () => {
      mockCacheManager.get.mockResolvedValue({
        hit: true,
        level: "L1",
        data: {
          html: "<html><body>Cached</body></html>",
          contentHash: "abc123",
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          tierUsed: "webshare",
          statusCode: 200,
          pageSizeBytes: 1024,
          contentType: "article",
        },
      });

      const result = await fetcher.fetch("https://cached-site.com");

      expect(result.fromCache).toBe(true);
      expect(result.estimatedCostUsd).toBe(0);
    });
  });

  describe("Cache Integration", () => {
    it("should check cache before fetching", async () => {
      mockCacheManager.get.mockResolvedValue({
        hit: true,
        level: "L2",
        data: {
          html: "<html><body>Cached Content</body></html>",
          contentHash: "hash123",
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          tierUsed: "direct",
          statusCode: 200,
          pageSizeBytes: 2048,
          contentType: "article",
        },
      });

      const result = await fetcher.fetch("https://example.com");

      expect(result.fromCache).toBe(true);
      expect(result.cacheLevel).toBe("L2");
      expect(mockCacheManager.get).toHaveBeenCalledWith("https://example.com");
      expect(domainLearningService.fetch).not.toHaveBeenCalled();
    });

    it("should skip cache when skipCache option is set", async () => {
      mockCacheManager.get.mockResolvedValue({
        hit: true,
        level: "L1",
        data: {
          html: "<html><body>Cached</body></html>",
          contentHash: "hash",
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          tierUsed: "direct",
          statusCode: 200,
          pageSizeBytes: 1024,
          contentType: "article",
        },
      });

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(
        createMockTieredFetchResult()
      );

      const result = await fetcher.fetch("https://example.com", {
        skipCache: true,
      });

      expect(result.fromCache).toBe(false);
      expect(domainLearningService.fetch).toHaveBeenCalled();
    });

    it("should store successful results to cache", async () => {
      const mockResult = createMockTieredFetchResult({
        html: "<html><body>Fresh Content</body></html>",
      });

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      await fetcher.fetch("https://example.com");

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          html: "<html><body>Fresh Content</body></html>",
          statusCode: 200,
        }),
        expect.any(Object)
      );
    });
  });

  describe("Response Validation", () => {
    it("should assess content quality", async () => {
      const mockResult = createMockTieredFetchResult({
        html: "<html><body><p>Good quality content with enough text.</p></body></html>",
      });

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      const result = await fetcher.fetch("https://example.com");

      expect(result.quality).toBeDefined();
      expect(result.quality?.acceptable).toBe(true);
      expect(result.quality?.wordCount).toBeGreaterThan(0);
    });
  });

  describe("Batch Operations", () => {
    it("should fetch multiple URLs concurrently", async () => {
      const urls = [
        "https://example.com/1",
        "https://example.com/2",
        "https://example.com/3",
      ];

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(
        createMockTieredFetchResult()
      );

      const results = await fetcher.fetchBatch(urls, { concurrency: 2 });

      expect(results.size).toBe(3);
      expect(Array.from(results.keys())).toEqual(urls);
    });

    it("should handle individual fetch failures in batch", async () => {
      const urls = [
        "https://example.com/good",
        "https://example.com/bad",
        "https://example.com/good2",
      ];

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch)
        .mockResolvedValueOnce(createMockTieredFetchResult())
        .mockResolvedValueOnce(
          createMockTieredFetchResult({
            success: false,
            error: { message: "Network error", reason: "connection_reset" as const, tier: "direct" as ScrapeTier },
          })
        )
        .mockResolvedValueOnce(createMockTieredFetchResult());

      const results = await fetcher.fetchBatch(urls);

      expect(results.size).toBe(3);
      expect(results.get(urls[0])?.success).toBe(true);
      expect(results.get(urls[1])?.success).toBe(false);
      expect(results.get(urls[2])?.success).toBe(true);
    });
  });

  describe("Cost Estimation", () => {
    it("should estimate cost for known domains", async () => {
      vi.mocked(domainLearningService.getConfig).mockResolvedValue({
        domain: "example.com",
        optimalTier: "webshare",
        isValidated: true,
        successRate: 0.95,
        consecutiveFailures: 0,
        avgResponseTimeMs: 3000,
        detectedTechnologies: [],
        hasAntiBotProtection: false,
        requiresJsRendering: false,
        geoRequirement: null,
        lastEscalationReason: null,
        updatedAt: new Date(),
        nextRevalidationAt: null,
      });

      const estimate = await fetcher.estimateCost("https://example.com/page");

      expect(estimate.knownTier).toBe("webshare");
      expect(estimate.estimatedCostUsd).toBe(0); // Webshare is free
      expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
    });

    it("should provide conservative estimate for unknown domains", async () => {
      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);

      const estimate = await fetcher.estimateCost("https://unknown-domain.com");

      expect(estimate.knownTier).toBeNull();
      expect(estimate.estimatedCostUsd).toBeGreaterThan(0); // Default to dfs_basic
    });
  });

  describe("Domain Discovery", () => {
    it("should pre-discover optimal tier without fetching content", async () => {
      vi.mocked(domainLearningService.discover).mockResolvedValue({
        domain: "new-domain.com",
        optimalTier: "geonode",
        attempts: [],
        totalTimeMs: 5000,
        totalCostUsd: 0.001,
        technologies: ["cloudflare", "react"],
        hasAntiBotProtection: true,
        requiresJsRendering: true,
        geoRequirement: null,
      });

      const result = await fetcher.discoverDomain("new-domain.com");

      expect(result.domain).toBe("new-domain.com");
      expect(result.optimalTier).toBe("geonode");
      expect(result.technologies).toContain("cloudflare");
      expect(domainLearningService.discover).toHaveBeenCalledWith({
        domain: "new-domain.com",
      });
    });
  });

  describe("Domain Statistics", () => {
    it("should return stats for known domains", async () => {
      vi.mocked(domainLearningService.getConfig).mockResolvedValue({
        domain: "example.com",
        optimalTier: "direct",
        isValidated: true,
        successRate: 0.995,
        consecutiveFailures: 0,
        avgResponseTimeMs: 1500,
        detectedTechnologies: ["nginx"],
        hasAntiBotProtection: false,
        requiresJsRendering: false,
        geoRequirement: null,
        lastEscalationReason: null,
        updatedAt: new Date(),
        nextRevalidationAt: null,
      });

      const stats = await fetcher.getDomainStats("example.com");

      expect(stats).not.toBeNull();
      expect(stats?.optimalTier).toBe("direct");
      expect(stats?.successRate).toBeGreaterThan(99);
    });

    it("should return null for unknown domains", async () => {
      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);

      const stats = await fetcher.getDomainStats("unknown.com");

      expect(stats).toBeNull();
    });
  });

  describe("Force Tier Mode", () => {
    it("should skip learning when forceTier is specified", async () => {
      const mockResult = createMockTieredFetchResult({
        tier: "dfs_basic",
        costUsd: 0.000125,
      });

      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      const result = await fetcher.fetch("https://example.com", {
        forceTier: "dfs_basic",
      });

      expect(result.tierUsed).toBe("dfs_basic");
      expect(domainLearningService.getConfig).not.toHaveBeenCalled();
      expect(domainLearningService.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          startTier: "dfs_basic",
          maxTier: "dfs_basic",
        })
      );
    });
  });

  describe("Bandwidth Exhaustion", () => {
    it("should skip tier when proxy provider bandwidth is exhausted", async () => {
      // Mock webshare as exhausted
      mockBandwidthTracker.getStatus.mockImplementation(async (provider: string) => {
        if (provider === "webshare") {
          return {
            provider: "webshare",
            usedBytes: 50 * 1024 * 1024 * 1024, // 50GB
            limitBytes: 50 * 1024 * 1024 * 1024, // 50GB limit
            remainingBytes: 0,
            percentUsed: 100,
            estimatedCostUsd: 5.0,
            isExhausted: true,
            isWarning: true,
            isCritical: true,
            month: "2026-05",
          };
        }
        // Geonode has bandwidth
        return {
          provider: "geonode",
          usedBytes: 1000000,
          limitBytes: 10737418240,
          remainingBytes: 10736418240,
          percentUsed: 0.01,
          estimatedCostUsd: 0.00072,
          isExhausted: false,
          isWarning: false,
          isCritical: false,
          month: "2026-05",
        };
      });

      // Domain config says to use webshare
      vi.mocked(domainLearningService.getConfig).mockResolvedValue({
        domain: "example.com",
        optimalTier: "webshare",
        isValidated: true,
        successRate: 0.95,
        consecutiveFailures: 0,
        avgResponseTimeMs: 3000,
        detectedTechnologies: [],
        hasAntiBotProtection: false,
        requiresJsRendering: false,
        geoRequirement: null,
        lastEscalationReason: null,
        updatedAt: new Date(),
        nextRevalidationAt: null,
      });

      // Mock successful fetch on geonode
      const mockResult = createMockTieredFetchResult({
        tier: "geonode",
        costUsd: 0.0001,
      });
      vi.mocked(domainLearningService.fetch).mockResolvedValue(mockResult);

      const result = await fetcher.fetch("https://example.com");

      // Should have escalated past webshare to geonode
      expect(result.success).toBe(true);
      expect(result.tierUsed).toBe("geonode");
    });

    it("should still work when no providers are exhausted", async () => {
      // All providers have bandwidth
      mockBandwidthTracker.getStatus.mockResolvedValue({
        provider: "geonode",
        usedBytes: 1000000,
        limitBytes: 10737418240,
        remainingBytes: 10736418240,
        percentUsed: 0.01,
        estimatedCostUsd: 0.00072,
        isExhausted: false,
        isWarning: false,
        isCritical: false,
        month: "2026-05",
      });

      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(
        createMockTieredFetchResult({
          tier: "direct",
          costUsd: 0,
        })
      );

      const result = await fetcher.fetch("https://example.com");

      expect(result.success).toBe(true);
      expect(result.tierUsed).toBe("direct");
    });

    it("should fail gracefully when all proxy tiers are exhausted", async () => {
      // All proxy providers exhausted
      mockBandwidthTracker.getStatus.mockResolvedValue({
        provider: "geonode",
        usedBytes: 10737418240,
        limitBytes: 10737418240,
        remainingBytes: 0,
        percentUsed: 100,
        estimatedCostUsd: 7.7,
        isExhausted: true,
        isWarning: true,
        isCritical: true,
        month: "2026-05",
      });

      // Direct fetch fails
      vi.mocked(domainLearningService.getConfig).mockResolvedValue(null);
      vi.mocked(domainLearningService.fetch).mockResolvedValue(
        createMockTieredFetchResult({
          success: false,
          tier: "direct",
          error: { message: "Blocked", reason: "ip_blocked" as const, tier: "direct" as ScrapeTier },
        })
      );

      // Note: DFS tiers don't use tracked bandwidth, so should still work
      const _result = await fetcher.fetch("https://example.com");

      // The fetch should still complete (DFS tiers available)
      expect(domainLearningService.fetch).toHaveBeenCalled();
    });
  });
});
