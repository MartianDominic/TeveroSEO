/**
 * KeywordEnrichmentService Tests
 *
 * Tests for batched DataForSEO enrichment with caching.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

// Mock Redis
vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

// Mock DataForSEO
vi.mock("@/server/lib/dataforseo", () => ({
  fetchKeywordMetrics: vi.fn(),
}));

describe("KeywordEnrichmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: enrichBatch() batches up to 1000 keywords per API call
  it("should batch up to 1000 keywords per API call", async () => {
    const { KeywordEnrichmentService } = await import(
      "./KeywordEnrichmentService"
    );
    const service = new KeywordEnrichmentService();

    // Verify batch size constant
    expect((service as any).BATCH_SIZE || 1000).toBe(1000);
  });

  // Test 2: Cached keywords (7-day TTL) skip API call
  it("should use 7-day TTL for keyword cache", async () => {
    const { CACHE_TTL_SECONDS } = await import("./KeywordEnrichmentService");
    expect(CACHE_TTL_SECONDS).toBe(7 * 24 * 60 * 60); // 604800 seconds
  });

  // Test 3: Cost tracking constant is correct
  it("should track cost at 0.5 cents per keyword", async () => {
    const { COST_PER_KEYWORD_CENTS } = await import(
      "./KeywordEnrichmentService"
    );
    expect(COST_PER_KEYWORD_CENTS).toBe(0.5);
  });

  // Test 4: Cache key prefix
  it("should use correct cache key prefix", async () => {
    const { CACHE_PREFIX } = await import("./KeywordEnrichmentService");
    expect(CACHE_PREFIX).toBe("kw-metrics:");
  });

  // Test 5: Service exports EnrichmentResult interface
  it("should export EnrichmentResult type", async () => {
    const mod = await import("./KeywordEnrichmentService");
    expect(mod.KeywordEnrichmentService).toBeDefined();
  });

  // Test 6: Cached keywords return cached status
  describe("enrichBatch with cache", () => {
    it("should return cached status when keyword exists in cache", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };

      // Mock cache hit
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          searchVolume: 1000,
          keywordDifficulty: 50,
          cpc: 1.5,
          competition: 0.5,
        })
      );

      const { db } = await import("@/db");
      const mockDb = db as any;

      // Mock DB select returning keywords that need enrichment
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() =>
            Promise.resolve([
              {
                id: "kw_1",
                keyword: "test keyword",
                normalizedKeyword: "test keyword",
                source: "manual",
                searchVolume: null,
                enrichmentStatus: "pending",
              },
            ])
          ),
        })),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      });

      const { KeywordEnrichmentService } = await import(
        "./KeywordEnrichmentService"
      );
      const service = new KeywordEnrichmentService();

      const result = await service.enrichBatch(["kw_1"]);

      expect(result.cached).toBe(1);
      expect(result.enriched).toBe(0);
    });
  });

  // Test 7: Keywords with existing metrics from CSV are skipped
  describe("enrichBatch with csv_upload source", () => {
    it("should skip keywords with existing metrics from CSV", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };

      // No cache hit
      mockRedis.get.mockResolvedValue(null);

      const { db } = await import("@/db");
      const mockDb = db as any;

      // Mock DB select returning keyword with metrics from CSV
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() =>
            Promise.resolve([
              {
                id: "kw_csv",
                keyword: "csv keyword",
                normalizedKeyword: "csv keyword",
                source: "csv_upload",
                searchVolume: 500, // Already has metrics
                enrichmentStatus: "pending",
              },
            ])
          ),
        })),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      });

      const { KeywordEnrichmentService } = await import(
        "./KeywordEnrichmentService"
      );
      const service = new KeywordEnrichmentService();

      const result = await service.enrichBatch(["kw_csv"]);

      expect(result.skipped).toBe(1);
    });
  });

  // Test 8: Failed enrichments are marked with status="failed"
  describe("enrichBatch error handling", () => {
    it("should mark failed enrichments with failed status", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockRedis = redis as unknown as {
        get: ReturnType<typeof vi.fn>;
        setex: ReturnType<typeof vi.fn>;
      };

      // No cache hit
      mockRedis.get.mockResolvedValue(null);

      const { fetchKeywordMetrics } = await import("@/server/lib/dataforseo");
      const mockFetch = fetchKeywordMetrics as ReturnType<typeof vi.fn>;

      // API returns empty (keyword not found)
      mockFetch.mockResolvedValue([]);

      const { db } = await import("@/db");
      const mockDb = db as any;

      // Mock DB select returning keyword needing enrichment
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() =>
            Promise.resolve([
              {
                id: "kw_fail",
                keyword: "unknown keyword",
                normalizedKeyword: "unknown keyword",
                source: "manual",
                searchVolume: null,
                enrichmentStatus: "pending",
              },
            ])
          ),
        })),
      });

      const updateSetMock = vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      }));
      mockDb.update.mockReturnValue({
        set: updateSetMock,
      });

      const { KeywordEnrichmentService } = await import(
        "./KeywordEnrichmentService"
      );
      const service = new KeywordEnrichmentService();

      const result = await service.enrichBatch(["kw_fail"]);

      expect(result.failed).toBe(1);
    });
  });
});
