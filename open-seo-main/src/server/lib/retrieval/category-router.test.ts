/**
 * Tests for Category Router and Hierarchical Search.
 *
 * Phase 73-03: Retrieval Quality Enhancement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CategoryRouter, getCategoryRouter, getSharedCategoryRouter } from "./category-router";

// Mock database and embedding service
vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock("@/server/lib/embeddings/embedding-service", () => ({
  embedQuery: vi.fn(),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("CategoryRouter", () => {
  let router: CategoryRouter;

  beforeEach(() => {
    router = new CategoryRouter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    router.clearCentroids();
  });

  describe("buildCentroids", () => {
    it("should build centroids from database embeddings", async () => {
      const { db } = await import("@/db");

      // Mock database results with embeddings
      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [
          { category_id: "cat1", embedding: [0.5, 0.5, 0.5] },
          { category_id: "cat1", embedding: [0.6, 0.4, 0.5] },
          { category_id: "cat2", embedding: [0.1, 0.9, 0.1] },
        ],
      } as never);

      // Mock category name lookup
      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [{ name: "Category 1" }],
      } as never);
      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [{ name: "Category 2" }],
      } as never);

      const count = await router.buildCentroids("tenant-123");

      expect(count).toBe(2);
      expect(router.hasCentroids("tenant-123")).toBe(true);
      expect(router.getCategoryCount("tenant-123")).toBe(2);
    });

    it("should skip categories with fewer items than minimum", async () => {
      const { db } = await import("@/db");

      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [
          { category_id: "cat1", embedding: [0.5, 0.5, 0.5] },
          { category_id: "cat1", embedding: [0.6, 0.4, 0.5] },
          { category_id: "cat2", embedding: [0.1, 0.9, 0.1] }, // Only 1 item
        ],
      } as never);

      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [{ name: "Category 1" }],
      } as never);

      const count = await router.buildCentroids("tenant-123", { minItemsPerCategory: 2 });

      expect(count).toBe(1); // Only cat1 should be included
    });

    it("should handle empty results gracefully", async () => {
      const { db } = await import("@/db");

      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [],
      } as never);

      const count = await router.buildCentroids("tenant-123");

      expect(count).toBe(0);
      expect(router.hasCentroids("tenant-123")).toBe(false);
    });
  });

  describe("route", () => {
    it("should return empty results when no centroids loaded", async () => {
      const results = await router.route("tenant-123", "test query");

      expect(results).toEqual([]);
    });

    it("should route query to most similar categories", async () => {
      const { db } = await import("@/db");
      const { embedQuery } = await import("@/server/lib/embeddings/embedding-service");

      // Build some centroids first
      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [
          { category_id: "electronics", embedding: [0.9, 0.1, 0.0] },
          { category_id: "clothing", embedding: [0.1, 0.9, 0.0] },
          { category_id: "home", embedding: [0.0, 0.1, 0.9] },
        ],
      } as never);

      vi.mocked(db.execute).mockResolvedValueOnce({ rows: [{ name: "Electronics" }] } as never);
      vi.mocked(db.execute).mockResolvedValueOnce({ rows: [{ name: "Clothing" }] } as never);
      vi.mocked(db.execute).mockResolvedValueOnce({ rows: [{ name: "Home" }] } as never);

      await router.buildCentroids("tenant-123");

      // Mock query embedding similar to electronics
      vi.mocked(embedQuery).mockResolvedValueOnce({
        embedding: [0.85, 0.15, 0.0],
        model: "jina-embeddings-v3",
        truncated: false,
        tokensUsed: 10,
      });

      const results = await router.route("tenant-123", "laptop computer", { topK: 2 });

      expect(results).toHaveLength(2);
      expect(results[0].categoryId).toBe("electronics");
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });

    it("should respect topK parameter", async () => {
      const { db } = await import("@/db");
      const { embedQuery } = await import("@/server/lib/embeddings/embedding-service");

      // Build centroids
      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [
          { category_id: "cat1", embedding: [1, 0, 0] },
          { category_id: "cat2", embedding: [0, 1, 0] },
          { category_id: "cat3", embedding: [0, 0, 1] },
        ],
      } as never);

      vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);

      await router.buildCentroids("tenant-123");

      vi.mocked(embedQuery).mockResolvedValueOnce({
        embedding: [0.5, 0.5, 0.0],
        model: "jina-embeddings-v3",
        truncated: false,
        tokensUsed: 10,
      });

      const results = await router.route("tenant-123", "query", { topK: 1 });

      expect(results).toHaveLength(1);
    });

    it("should filter results below minimum similarity", async () => {
      const { db } = await import("@/db");
      const { embedQuery } = await import("@/server/lib/embeddings/embedding-service");

      // Build centroids
      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [
          { category_id: "cat1", embedding: [1, 0, 0] },
          { category_id: "cat2", embedding: [0, 1, 0] },
        ],
      } as never);

      vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);

      await router.buildCentroids("tenant-123");

      // Query very different from both categories
      vi.mocked(embedQuery).mockResolvedValueOnce({
        embedding: [0, 0, 1], // Orthogonal to both
        model: "jina-embeddings-v3",
        truncated: false,
        tokensUsed: 10,
      });

      const results = await router.route("tenant-123", "query", { minSimilarity: 0.5 });

      expect(results).toHaveLength(0);
    });
  });

  describe("routeToIds", () => {
    it("should return only category IDs", async () => {
      const { db } = await import("@/db");
      const { embedQuery } = await import("@/server/lib/embeddings/embedding-service");

      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [
          { category_id: "cat1", embedding: [1, 0, 0] },
          { category_id: "cat2", embedding: [0, 1, 0] },
        ],
      } as never);

      vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);

      await router.buildCentroids("tenant-123");

      vi.mocked(embedQuery).mockResolvedValueOnce({
        embedding: [0.9, 0.1, 0],
        model: "jina-embeddings-v3",
        truncated: false,
        tokensUsed: 10,
      });

      const ids = await router.routeToIds("tenant-123", "query", 2);

      expect(ids).toEqual(["cat1", "cat2"]);
    });
  });

  describe("clearCentroids", () => {
    it("should clear centroids for specific tenant", async () => {
      const { db } = await import("@/db");

      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [{ category_id: "cat1", embedding: [1, 0, 0] }],
      } as never);
      vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);

      await router.buildCentroids("tenant-1");

      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [{ category_id: "cat2", embedding: [0, 1, 0] }],
      } as never);

      await router.buildCentroids("tenant-2");

      expect(router.hasCentroids("tenant-1")).toBe(true);
      expect(router.hasCentroids("tenant-2")).toBe(true);

      router.clearCentroids("tenant-1");

      expect(router.hasCentroids("tenant-1")).toBe(false);
      expect(router.hasCentroids("tenant-2")).toBe(true);
    });

    it("should clear all centroids when no tenant specified", async () => {
      const { db } = await import("@/db");

      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [{ category_id: "cat1", embedding: [1, 0, 0] }],
      } as never);
      vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);

      await router.buildCentroids("tenant-1");

      vi.mocked(db.execute).mockResolvedValueOnce({
        rows: [{ category_id: "cat2", embedding: [0, 1, 0] }],
      } as never);

      await router.buildCentroids("tenant-2");

      router.clearCentroids();

      expect(router.hasCentroids("tenant-1")).toBe(false);
      expect(router.hasCentroids("tenant-2")).toBe(false);
    });
  });
});

describe("Singleton functions", () => {
  it("getCategoryRouter should return same instance for same tenant", () => {
    const router1 = getCategoryRouter("tenant-a");
    const router2 = getCategoryRouter("tenant-a");

    expect(router1).toBe(router2);
  });

  it("getCategoryRouter should return different instances for different tenants", () => {
    const router1 = getCategoryRouter("tenant-a");
    const router2 = getCategoryRouter("tenant-b");

    expect(router1).not.toBe(router2);
  });

  it("getSharedCategoryRouter should return singleton", () => {
    const router1 = getSharedCategoryRouter();
    const router2 = getSharedCategoryRouter();

    expect(router1).toBe(router2);
  });
});
