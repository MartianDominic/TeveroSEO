/**
 * Hybrid Retrieval Pipeline Tests
 * Phase 65: GraphRAG Foundation
 *
 * Tests for RRF fusion algorithm and hybrid search orchestration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create hoisted mocks that can be referenced in vi.mock factories
const { mockEmbedQuery, mockHybridVectorGraphSearch, mockDbExecute } = vi.hoisted(() => ({
  mockEmbedQuery: vi.fn(),
  mockHybridVectorGraphSearch: vi.fn(),
  mockDbExecute: vi.fn(),
}));

vi.mock("./tenant-graph-manager", () => ({
  getTenantGraphManager: vi.fn(async () => ({
    hybridVectorGraphSearch: mockHybridVectorGraphSearch,
  })),
}));

vi.mock("@/server/lib/embeddings", () => ({
  embedQuery: mockEmbedQuery,
}));

vi.mock("@/db", () => ({
  db: {
    execute: mockDbExecute,
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import after mocks are set up
import {
  reciprocalRankFusion,
  hybridSearch,
  type SearchResult,
  type HybridSearchResult,
} from "./hybrid-retrieval";

describe("reciprocalRankFusion", () => {
  describe("basic fusion with default k=60", () => {
    it("should return empty array for empty inputs", () => {
      const result = reciprocalRankFusion([], []);
      expect(result).toEqual([]);
    });

    it("should handle vector-only results", () => {
      const vectorResults = [
        { id: "doc1", score: 0.9 },
        { id: "doc2", score: 0.8 },
        { id: "doc3", score: 0.7 },
      ];

      const result = reciprocalRankFusion(vectorResults, []);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("doc1");
      expect(result[0].source).toBe("vector");
      // RRF score for rank 1: 1/(60+1) = 0.01639...
      expect(result[0].score).toBeCloseTo(1 / 61, 5);
    });

    it("should handle graph-only results", () => {
      const graphResults = [
        { id: "entity1", score: 0.95 },
        { id: "entity2", score: 0.85 },
      ];

      const result = reciprocalRankFusion([], graphResults);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("entity1");
      expect(result[0].source).toBe("graph");
    });

    it("should correctly fuse overlapping results", () => {
      const vectorResults = [
        { id: "doc1", score: 0.9 },
        { id: "doc2", score: 0.8 },
        { id: "doc3", score: 0.7 },
      ];
      const graphResults = [
        { id: "doc2", score: 0.95 }, // Appears in both lists
        { id: "doc4", score: 0.85 },
        { id: "doc1", score: 0.75 }, // Appears in both lists
      ];

      const result = reciprocalRankFusion(vectorResults, graphResults);

      // doc1 and doc2 should appear once with "both" source
      const doc1 = result.find((r) => r.id === "doc1");
      const doc2 = result.find((r) => r.id === "doc2");

      expect(doc1?.source).toBe("both");
      expect(doc2?.source).toBe("both");

      // doc2 should have highest score (rank 2 in vector + rank 1 in graph)
      // Vector rank 2: 1/(60+2) = 1/62
      // Graph rank 1: 1/(60+1) = 1/61
      // Total: 1/62 + 1/61 = 0.0325...
      expect(doc2?.score).toBeGreaterThan(doc1?.score || 0);
    });

    it("should sort results by RRF score descending", () => {
      const vectorResults = [
        { id: "doc1", score: 0.9 },
        { id: "doc2", score: 0.8 },
      ];
      const graphResults = [
        { id: "doc3", score: 0.95 },
        { id: "doc2", score: 0.85 }, // Overlaps with vector
      ];

      const result = reciprocalRankFusion(vectorResults, graphResults);

      // Should be sorted by score descending
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
      }

      // doc2 should be first since it appears in both lists
      expect(result[0].id).toBe("doc2");
    });
  });

  describe("RRF with custom k parameter", () => {
    it("should use custom k value in score calculation", () => {
      const vectorResults = [{ id: "doc1", score: 0.9 }];

      const resultK60 = reciprocalRankFusion(vectorResults, [], 60);
      const resultK10 = reciprocalRankFusion(vectorResults, [], 10);

      // With k=60: score = 1/(60+1) = 0.01639
      // With k=10: score = 1/(10+1) = 0.09090
      expect(resultK10[0].score).toBeGreaterThan(resultK60[0].score);
      expect(resultK60[0].score).toBeCloseTo(1 / 61, 5);
      expect(resultK10[0].score).toBeCloseTo(1 / 11, 5);
    });
  });

  describe("documents appearing in both lists get higher score", () => {
    it("should rank overlapping documents higher than single-source", () => {
      const vectorResults = [
        { id: "single-vector", score: 0.99 }, // High score but single source
        { id: "overlap", score: 0.5 },        // Lower score but in both
      ];
      const graphResults = [
        { id: "single-graph", score: 0.99 },  // High score but single source
        { id: "overlap", score: 0.5 },        // Lower score but in both
      ];

      const result = reciprocalRankFusion(vectorResults, graphResults);

      // "overlap" should be highest because it appears in both lists
      // Vector rank 2: 1/(60+2) = 1/62
      // Graph rank 2: 1/(60+2) = 1/62
      // Total: 2/62 = 0.0323...
      // vs single source rank 1: 1/61 = 0.0164...
      const overlapResult = result.find((r) => r.id === "overlap");
      const singleVectorResult = result.find((r) => r.id === "single-vector");

      expect(overlapResult?.score).toBeGreaterThan(singleVectorResult?.score || 0);
      expect(overlapResult?.source).toBe("both");
    });
  });

  describe("edge cases", () => {
    it("should handle single item in each list", () => {
      const result = reciprocalRankFusion(
        [{ id: "v1", score: 0.9 }],
        [{ id: "g1", score: 0.8 }]
      );

      expect(result).toHaveLength(2);
      // Both have same RRF score (1/61) since they're both rank 1
      expect(result[0].score).toBeCloseTo(result[1].score, 5);
    });

    it("should handle large result sets", () => {
      const vectorResults = Array.from({ length: 100 }, (_, i) => ({
        id: `v${i}`,
        score: 1 - i * 0.01,
      }));
      const graphResults = Array.from({ length: 100 }, (_, i) => ({
        id: `g${i}`,
        score: 1 - i * 0.01,
      }));

      const result = reciprocalRankFusion(vectorResults, graphResults);

      expect(result).toHaveLength(200);
      // First item should have score 1/(60+1) since it's rank 1 in its source
      expect(result[0].score).toBeCloseTo(1 / 61, 5);
    });

    it("should handle duplicate IDs in same source gracefully", () => {
      // This shouldn't happen in practice, but let's ensure it doesn't crash
      const vectorResults = [
        { id: "doc1", score: 0.9 },
        { id: "doc1", score: 0.8 }, // Duplicate
      ];

      const result = reciprocalRankFusion(vectorResults, []);

      // Should combine scores for same ID
      const doc1 = result.find((r) => r.id === "doc1");
      // Score should be sum of both ranks: 1/61 + 1/62
      expect(doc1?.score).toBeCloseTo(1 / 61 + 1 / 62, 5);
    });
  });
});

describe("hybridSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set default implementations for hoisted mocks
    mockEmbedQuery.mockResolvedValue({
      embedding: new Array(768).fill(0.1),
      model: "jina-embeddings-v3",
      truncated: false,
      tokensUsed: 10,
    });

    mockHybridVectorGraphSearch.mockResolvedValue([
      { id: "entity1", name: "Product A", type: "product", score: 0.9, related: ["Category 1"] },
      { id: "entity2", name: "Keyword B", type: "keyword", score: 0.8, related: [] },
    ]);

    mockDbExecute.mockResolvedValue({
      rows: [
        { id: "chunk1", content: "Some content 1", score: 0.85 },
        { id: "chunk2", content: "Some content 2", score: 0.75 },
      ],
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return combined results from vector and graph search", async () => {
    const results = await hybridSearch("tenant-123", "test query");

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it("should generate embedding for query", async () => {
    await hybridSearch("tenant-123", "test query");

    expect(mockEmbedQuery).toHaveBeenCalledWith("test query");
  });

  it("should call graph manager with correct parameters", async () => {
    await hybridSearch("tenant-123", "test query", { k: 10 });

    expect(mockHybridVectorGraphSearch).toHaveBeenCalledWith(
      "tenant-123",
      expect.any(Array), // 768-dim embedding
      { k: 20 } // kExpand = k * 2
    );
  });

  it("should respect k parameter for result limit", async () => {
    const results = await hybridSearch("tenant-123", "test query", { k: 5 });

    // Results should be limited to k
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("should include content when includeContent is true (default)", async () => {
    mockDbExecute.mockResolvedValueOnce({
      rows: [{ id: "chunk1", content: "Test content", score: 0.9 }],
    });

    const results = await hybridSearch("tenant-123", "test query", {
      includeContent: true,
    });

    // Results from vector search should have content
    const vectorResult = results.find((r) => r.source === "vector" || r.source === "both");
    if (vectorResult) {
      expect(vectorResult.content).toBeDefined();
    }
  });

  it("should use custom RRF k parameter", async () => {
    // This is more of a configuration test - ensure the parameter is passed
    await hybridSearch("tenant-123", "test query", { rrfK: 30 });

    // The function should complete without error with custom rrfK
    expect(mockHybridVectorGraphSearch).toHaveBeenCalled();
  });

  it("should handle empty results from both sources", async () => {
    mockHybridVectorGraphSearch.mockResolvedValueOnce([]);
    mockDbExecute.mockResolvedValueOnce({ rows: [] });

    const results = await hybridSearch("tenant-123", "test query");

    expect(results).toEqual([]);
  });

  it("should mark results with correct source attribution", async () => {
    // Set up overlapping results
    mockDbExecute.mockResolvedValueOnce({
      rows: [
        { id: "shared-id", content: "Vector content", score: 0.9 },
        { id: "vector-only", content: "Vector only content", score: 0.8 },
      ],
    });
    mockHybridVectorGraphSearch.mockResolvedValueOnce([
      { id: "shared-id", name: "Shared", type: "product", score: 0.85, related: [] },
      { id: "graph-only", name: "Graph Only", type: "keyword", score: 0.75, related: [] },
    ]);

    const results = await hybridSearch("tenant-123", "test query");

    const sharedResult = results.find((r) => r.id === "shared-id");
    const vectorOnlyResult = results.find((r) => r.id === "vector-only");
    const graphOnlyResult = results.find((r) => r.id === "graph-only");

    expect(sharedResult?.source).toBe("both");
    expect(vectorOnlyResult?.source).toBe("vector");
    expect(graphOnlyResult?.source).toBe("graph");
  });
});

describe("HybridSearchResult interface", () => {
  it("should have all required fields", () => {
    const result: HybridSearchResult = {
      id: "test-id",
      score: 0.9,
      source: "both",
      content: "Optional content",
      name: "Optional name",
      type: "product",
      related: ["related1", "related2"],
    };

    expect(result.id).toBe("test-id");
    expect(result.score).toBe(0.9);
    expect(result.source).toBe("both");
  });

  it("should allow optional fields to be undefined", () => {
    const minimalResult: HybridSearchResult = {
      id: "test-id",
      score: 0.5,
      source: "vector",
    };

    expect(minimalResult.content).toBeUndefined();
    expect(minimalResult.name).toBeUndefined();
    expect(minimalResult.type).toBeUndefined();
    expect(minimalResult.related).toBeUndefined();
  });
});

describe("SearchResult interface", () => {
  it("should support all source types", () => {
    const vectorResult: SearchResult = { id: "1", score: 0.9, source: "vector" };
    const graphResult: SearchResult = { id: "2", score: 0.8, source: "graph" };
    const bothResult: SearchResult = { id: "3", score: 0.95, source: "both" };

    expect(vectorResult.source).toBe("vector");
    expect(graphResult.source).toBe("graph");
    expect(bothResult.source).toBe("both");
  });
});
