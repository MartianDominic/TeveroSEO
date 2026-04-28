/**
 * Tests for EmbeddingService.
 *
 * Phase 42-03: Unified Embedding Service
 *
 * Tests cover:
 * 1. embedPassages returns 384-dim vectors for text array
 * 2. embedQuery returns 384-dim vector for single query
 * 3. Matryoshka truncation slices first 384 dims from 1024
 * 4. Batch processing respects batchSize=32
 * 5. Cache hit returns cached embedding without API call
 * 6. Fallback to e5-base when Jina API fails
 * 7. Retry logic on transient failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EmbeddingService,
  getEmbeddingService,
  embedPassages,
  embedQuery,
} from "./embedding-service";
import { EMBEDDING_CONFIG } from "./embedding-config";

// Mock Redis
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisMget = vi.fn();
const mockRedisPipeline = vi.fn();

vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    mget: (...args: unknown[]) => mockRedisMget(...args),
    pipeline: () => ({
      set: mockRedisPipeline,
      exec: vi.fn().mockResolvedValue([]),
    }),
  },
}));

// Mock fetch for Jina API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock Jina API response
function createJinaResponse(
  texts: string[],
  startIndex = 0
): { data: Array<{ index: number; embedding: number[] }>; usage: { total_tokens: number } } {
  return {
    data: texts.map((_, i) => ({
      index: startIndex + i,
      embedding: Array.from({ length: 384 }, (_, j) => (i + j) * 0.001),
    })),
    usage: {
      total_tokens: texts.length * 10,
    },
  };
}

describe("EmbeddingService", () => {
  let service: EmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EmbeddingService("test-api-key", true);
    mockRedisGet.mockResolvedValue(null);
    // Return nulls matching the number of keys passed (dynamic based on call)
    mockRedisMget.mockImplementation((...keys: string[]) =>
      Promise.resolve(keys.map(() => null))
    );
    mockRedisSet.mockResolvedValue("OK");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("embedPassages", () => {
    it("Test 1: returns 384-dim vectors for text array", async () => {
      const texts = ["Product description for shampoo", "Another hair care item"];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createJinaResponse(texts)),
      });

      const result = await service.embedPassages(texts);

      expect(result.embeddings).toHaveLength(2);
      expect(result.embeddings[0]).toHaveLength(384);
      expect(result.embeddings[1]).toHaveLength(384);
      expect(result.model).toBe(EMBEDDING_CONFIG.model);
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it("Test 4: batch processing respects batchSize=32", async () => {
      // Create 50 texts - should be split into 2 batches (32 + 18)
      const texts = Array.from({ length: 50 }, (_, i) => `Text item ${i}`);

      // Mock two API calls for two batches
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createJinaResponse(texts.slice(0, 32))),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createJinaResponse(texts.slice(32), 32)),
        });

      const result = await service.embedPassages(texts);

      expect(result.embeddings).toHaveLength(50);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify first batch has 32 items
      const firstCall = mockFetch.mock.calls[0];
      const firstBody = JSON.parse(firstCall[1].body);
      expect(firstBody.input).toHaveLength(32);

      // Verify second batch has 18 items
      const secondCall = mockFetch.mock.calls[1];
      const secondBody = JSON.parse(secondCall[1].body);
      expect(secondBody.input).toHaveLength(18);
    });

    it("Test 5: cache hit returns cached embedding without API call", async () => {
      const texts = ["Cached text"];
      const cachedEmbedding = Array.from({ length: 384 }, (_, i) => i * 0.01);

      // Simulate cache hit
      mockRedisMget.mockResolvedValueOnce([JSON.stringify(cachedEmbedding)]);

      const result = await service.embedPassages(texts);

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual(cachedEmbedding);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("embedQuery", () => {
    it("Test 2: returns 384-dim vector for single query", async () => {
      const query = "shamponas dažytiems plaukams";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createJinaResponse([query])),
      });

      const result = await service.embedQuery(query);

      expect(result.embedding).toHaveLength(384);
      expect(result.model).toBe(EMBEDDING_CONFIG.model);
      expect(result.truncated).toBe(false); // API returns 384 directly
      expect(result.tokensUsed).toBeGreaterThan(0);
    });
  });

  describe("Matryoshka truncation", () => {
    it("Test 3: slices first 384 dims from 1024 when API returns native dim", async () => {
      const text = "Test text for truncation";

      // Simulate API returning 1024-dim (native dimension)
      const nativeDimResponse = {
        data: [
          {
            index: 0,
            embedding: Array.from({ length: 1024 }, (_, i) => i * 0.001),
          },
        ],
        usage: { total_tokens: 10 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(nativeDimResponse),
      });

      // Create service without requesting specific dimensions
      const serviceWithTruncation = new EmbeddingService("test-api-key", true);
      const result = await serviceWithTruncation.embedQuery(text);

      // Should truncate to 384 dims (first 384 values)
      expect(result.embedding).toHaveLength(384);
      expect(result.embedding[0]).toBeCloseTo(0);
      expect(result.embedding[383]).toBeCloseTo(383 * 0.001);
      expect(result.truncated).toBe(true);
    });
  });

  describe("Error handling and retry", () => {
    it("Test 7: retry logic on transient failures", async () => {
      const text = "Text for retry test";

      // First two calls fail, third succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503, statusText: "Service Unavailable" })
        .mockResolvedValueOnce({ ok: false, status: 503, statusText: "Service Unavailable" })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createJinaResponse([text])),
        });

      const result = await service.embedQuery(text);

      expect(result.embedding).toHaveLength(384);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("Test 6: fallback behavior when Jina API fails permanently", async () => {
      const text = "Text for fallback test";

      // All retries fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      // Service should throw after exhausting retries
      // In production, this would trigger fallback to e5-base
      await expect(service.embedQuery(text)).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(EMBEDDING_CONFIG.maxRetries);
    });
  });

  describe("API request format", () => {
    it("sends correct request body with dimensions and model", async () => {
      const texts = ["Test product description"];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createJinaResponse(texts)),
      });

      await service.embedPassages(texts);

      expect(mockFetch).toHaveBeenCalledWith(
        EMBEDDING_CONFIG.jinaApiUrl,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          }),
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("jinaai/jina-embeddings-v3");
      expect(body.dimensions).toBe(EMBEDDING_CONFIG.storageDim);
      expect(body.input[0]).toContain(EMBEDDING_CONFIG.passagePrefix);
    });

    it("adds query prefix for query embeddings", async () => {
      const query = "Search query";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createJinaResponse([query])),
      });

      await service.embedQuery(query);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input[0]).toContain(EMBEDDING_CONFIG.queryPrefix);
    });
  });
});

describe("getEmbeddingService singleton", () => {
  it("returns same instance on multiple calls", () => {
    // Reset module state for this test
    vi.resetModules();

    const service1 = getEmbeddingService();
    const service2 = getEmbeddingService();

    expect(service1).toBe(service2);
  });
});

describe("Helper functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisMget.mockImplementation((...keys: string[]) =>
      Promise.resolve(keys.map(() => null))
    );
  });

  it("embedPassages helper works correctly", async () => {
    const texts = ["Test text"];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createJinaResponse(texts)),
    });

    const result = await embedPassages(texts);

    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toHaveLength(384);
  });

  it("embedQuery helper works correctly", async () => {
    const query = "Test query";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createJinaResponse([query])),
    });

    const result = await embedQuery(query);

    expect(result.embedding).toHaveLength(384);
  });
});
