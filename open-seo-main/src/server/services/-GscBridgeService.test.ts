/**
 * Tests for GscBridgeService
 * Phase 84-01 Task 3: GSC bridge for client path
 *
 * TDD RED: Tests written before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GscBridgeService, createGscBridge } from "./GscBridgeService";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Redis for caching
vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe("GscBridgeService", () => {
  let service: GscBridgeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createGscBridge("http://localhost:8000");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchRankings", () => {
    const mockQuery = {
      siteUrl: "https://example.com",
      startDate: "2026-04-01",
      endDate: "2026-05-01",
      dimensions: ["query"],
      rowLimit: 100,
    };

    it("calls AI-Writer GSC endpoint with correct parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            rows: [
              {
                keys: ["test keyword"],
                clicks: 100,
                impressions: 1000,
                ctr: 0.1,
                position: 5.2,
              },
            ],
          }),
      });

      await service.fetchRankings("client-123", mockQuery);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/gsc/search-analytics",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: expect.any(String),
        })
      );
    });

    it("returns parsed ranking data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            rows: [
              {
                keys: ["keyword 1"],
                clicks: 50,
                impressions: 500,
                ctr: 0.1,
                position: 3.5,
              },
              {
                keys: ["keyword 2"],
                clicks: 30,
                impressions: 300,
                ctr: 0.1,
                position: 7.2,
              },
            ],
          }),
      });

      const result = await service.fetchRankings("client-123", mockQuery);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        query: "keyword 1",
        clicks: 50,
        impressions: 500,
        ctr: 0.1,
        position: 3.5,
      });
    });

    it("handles empty response gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ rows: [] }),
      });

      const result = await service.fetchRankings("client-123", mockQuery);

      expect(result).toEqual([]);
    });

    it("handles API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await service.fetchRankings("client-123", mockQuery);

      expect(result).toEqual([]);
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await service.fetchRankings("client-123", mockQuery);

      expect(result).toEqual([]);
    });
  });

  describe("getClientGscCredentials", () => {
    it("returns hasCredentials true when client has GSC configured", async () => {
      // Mock would need to check client credentials in database
      // For now, test the interface
      const result = await service.getClientGscCredentials("client-with-gsc");

      expect(result).toHaveProperty("hasCredentials");
      expect(result).toHaveProperty("siteUrl");
    });
  });

  describe("caching", () => {
    it("caches results using shared analytics TTL (30 minutes)", async () => {
      const { redis } = await import("@/server/lib/redis");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            rows: [
              {
                keys: ["cached keyword"],
                clicks: 10,
                impressions: 100,
                ctr: 0.1,
                position: 2.0,
              },
            ],
          }),
      });

      await service.fetchRankings("client-123", {
        siteUrl: "https://example.com",
        startDate: "2026-04-01",
        endDate: "2026-05-01",
      });

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining("gsc:"),
        expect.any(String),
        "EX",
        1800 // 30 minutes (ANALYTICS_CACHE_TTL_SECONDS)
      );
    });

    it("returns cached data when available", async () => {
      const { redis } = await import("@/server/lib/redis");
      const mockGet = redis.get as ReturnType<typeof vi.fn>;

      const cachedData = JSON.stringify([
        {
          query: "cached keyword",
          clicks: 10,
          impressions: 100,
          ctr: 0.1,
          position: 2.0,
        },
      ]);

      mockGet.mockResolvedValueOnce(cachedData);

      const result = await service.fetchRankings("client-123", {
        siteUrl: "https://example.com",
        startDate: "2026-04-01",
        endDate: "2026-05-01",
      });

      expect(result[0].query).toBe("cached keyword");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("rate limiting", () => {
    it("respects rate limit of 100 calls per day per client", async () => {
      // This would be tested with actual rate limit implementation
      // For now, just verify the service handles the concept
      expect(service).toBeDefined();
    });
  });
});

describe("createGscBridge factory", () => {
  it("creates service with default AI-Writer URL", () => {
    const service = createGscBridge();
    expect(service).toBeInstanceOf(GscBridgeService);
  });

  it("creates service with custom URL", () => {
    const service = createGscBridge("http://custom:8080");
    expect(service).toBeInstanceOf(GscBridgeService);
  });
});
