/**
 * Tests for Reranker Client.
 *
 * Phase 73-03: Retrieval Quality Enhancement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rerankCandidates, isRerankerAvailable, warmupReranker } from "./reranker-client";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("rerankCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset AbortSignal.timeout mock
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => new AbortController().signal);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty array for empty candidates", async () => {
    const results = await rerankCandidates("query", []);

    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should call rerank endpoint and return results", async () => {
    const mockResponse = {
      results: [
        { id: "2", text: "laptop notebook", rerank_score: 0.95 },
        { id: "1", text: "desktop PC", rerank_score: 0.3 },
      ],
      latency_ms: 150,
      model: "BAAI/bge-reranker-v2-m3",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const candidates = [
      { id: "1", text: "desktop PC" },
      { id: "2", text: "laptop notebook" },
    ];

    const results = await rerankCandidates("laptop computer", candidates, 10);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/embeddings/rerank"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "laptop computer",
          candidates,
          text_key: "text",
          top_k: 10,
        }),
      })
    );

    expect(results).toHaveLength(2);
    expect(results[0].rerank_score).toBe(0.95);
    expect(results[0].id).toBe("2");
  });

  it("should preserve original fields in reranked results", async () => {
    const mockResponse = {
      results: [
        {
          id: "1",
          text: "laptop",
          original_score: 0.8,
          metadata: { category: "electronics" },
          rerank_score: 0.95,
        },
      ],
      latency_ms: 100,
      model: "BAAI/bge-reranker-v2-m3",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const candidates = [
      { id: "1", text: "laptop", original_score: 0.8, metadata: { category: "electronics" } },
    ];

    const results = await rerankCandidates("laptop", candidates, 10);

    expect(results[0].id).toBe("1");
    expect(results[0].original_score).toBe(0.8);
    expect(results[0].metadata).toEqual({ category: "electronics" });
    expect(results[0].rerank_score).toBe(0.95);
  });

  it("should use custom text key", async () => {
    const mockResponse = {
      results: [{ id: "1", content: "laptop notebook", rerank_score: 0.9 }],
      latency_ms: 100,
      model: "BAAI/bge-reranker-v2-m3",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const candidates = [{ id: "1", content: "laptop notebook" }];

    await rerankCandidates("laptop", candidates, 10, "content");

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.text_key).toBe("content");
  });

  it("should retry on failure", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ id: "1", text: "doc", rerank_score: 0.5 }],
            latency_ms: 100,
            model: "BAAI/bge-reranker-v2-m3",
          }),
      });

    const results = await rerankCandidates("query", [{ id: "1", text: "doc" }], 10, "text", {
      maxRetries: 2,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
  });

  it("should throw after all retries exhausted", async () => {
    mockFetch.mockRejectedValue(new Error("Persistent error"));

    await expect(
      rerankCandidates("query", [{ id: "1", text: "doc" }], 10, "text", { maxRetries: 1 })
    ).rejects.toThrow("Persistent error");

    expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });

  it("should throw on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal server error"),
    });

    await expect(
      rerankCandidates("query", [{ id: "1", text: "doc" }], 10, "text", { maxRetries: 0 })
    ).rejects.toThrow("Reranker API error: 500");
  });

  it("should use custom base URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [],
          latency_ms: 0,
          model: "BAAI/bge-reranker-v2-m3",
        }),
    });

    await rerankCandidates("query", [{ id: "1", text: "doc" }], 10, "text", {
      baseUrl: "http://custom:9000",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://custom:9000/api/embeddings/rerank",
      expect.any(Object)
    );
  });
});

describe("isRerankerAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => new AbortController().signal);
  });

  it("should return true when service is healthy", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "healthy", model_loaded: true }),
    });

    const available = await isRerankerAvailable();

    expect(available).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/embeddings/rerank/health"),
      expect.any(Object)
    );
  });

  it("should return false when service returns unhealthy status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "error", model_loaded: false }),
    });

    const available = await isRerankerAvailable();

    expect(available).toBe(false);
  });

  it("should return false when service is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const available = await isRerankerAvailable();

    expect(available).toBe(false);
  });

  it("should return false on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const available = await isRerankerAvailable();

    expect(available).toBe(false);
  });
});

describe("warmupReranker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => new AbortController().signal);
  });

  it("should call warmup endpoint and return result", async () => {
    const mockResponse = {
      status: "warmed_up",
      latency_ms: 5000,
      model: "BAAI/bge-reranker-v2-m3",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await warmupReranker();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/embeddings/rerank/warmup"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.status).toBe("warmed_up");
    expect(result.latency_ms).toBe(5000);
  });

  it("should throw on warmup failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    await expect(warmupReranker()).rejects.toThrow("Warmup failed: 503");
  });
});
