/**
 * Tests for RRF (Reciprocal Rank Fusion) Utility
 * Phase 65: GraphRAG Foundation
 */

import { describe, it, expect } from "vitest";
import {
  fusionRRF,
  fusionRRFMultiple,
  type RankedItem,
  type RankedItemWithMetadata,
} from "./rrf";

describe("fusionRRF", () => {
  it("returns empty array for empty inputs", () => {
    const result = fusionRRF([], []);
    expect(result).toEqual([]);
  });

  it("handles vector-only results", () => {
    const vectorResults: RankedItem[] = [
      { id: "a", score: 0.9 },
      { id: "b", score: 0.8 },
    ];

    const result = fusionRRF(vectorResults, []);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("a");
    expect(result[0].source).toBe("vector");
    expect(result[1].id).toBe("b");
    expect(result[1].source).toBe("vector");
  });

  it("handles graph-only results", () => {
    const graphResults: RankedItemWithMetadata[] = [
      { id: "c", score: 0.95, name: "Entity C", type: "keyword" },
      { id: "d", score: 0.7, name: "Entity D", type: "page" },
    ];

    const result = fusionRRF([], graphResults);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c");
    expect(result[0].source).toBe("graph");
    expect(result[0].name).toBe("Entity C");
    expect(result[0].type).toBe("keyword");
    expect(result[1].id).toBe("d");
    expect(result[1].source).toBe("graph");
  });

  it("fuses vector and graph results with overlap", () => {
    const vectorResults: RankedItem[] = [
      { id: "a", score: 0.9 },
      { id: "b", score: 0.8 },
    ];
    const graphResults: RankedItemWithMetadata[] = [
      { id: "b", score: 0.95, name: "Entity B", type: "keyword" },
      { id: "c", score: 0.7, name: "Entity C", type: "page" },
    ];

    const result = fusionRRF(vectorResults, graphResults);

    expect(result).toHaveLength(3);

    // "b" should be boosted (appears in both)
    const itemB = result.find((r) => r.id === "b");
    expect(itemB).toBeDefined();
    expect(itemB!.source).toBe("both");
    expect(itemB!.name).toBe("Entity B");

    // Items from only one source should be marked correctly
    const itemA = result.find((r) => r.id === "a");
    expect(itemA?.source).toBe("vector");

    const itemC = result.find((r) => r.id === "c");
    expect(itemC?.source).toBe("graph");
    expect(itemC?.name).toBe("Entity C");
  });

  it("correctly calculates RRF scores", () => {
    const vectorResults: RankedItem[] = [{ id: "a", score: 0.9 }];
    const graphResults: RankedItemWithMetadata[] = [];
    const k = 60;

    const result = fusionRRF(vectorResults, graphResults, k);

    // RRF score for rank 0 with k=60: 1 / (60 + 0 + 1) = 1/61
    const expectedScore = 1 / (k + 0 + 1);
    expect(result[0].score).toBeCloseTo(expectedScore, 10);
  });

  it("items in both sources have higher scores than single-source items", () => {
    const vectorResults: RankedItem[] = [
      { id: "a", score: 0.9 }, // rank 0 in vector
      { id: "b", score: 0.8 }, // rank 1 in vector
    ];
    const graphResults: RankedItemWithMetadata[] = [
      { id: "b", score: 0.95 }, // rank 0 in graph
      { id: "c", score: 0.7 }, // rank 1 in graph
    ];

    const result = fusionRRF(vectorResults, graphResults);

    // "b" appears in both (rank 1 in vector, rank 0 in graph)
    // "a" appears only in vector (rank 0)
    const itemB = result.find((r) => r.id === "b")!;
    const itemA = result.find((r) => r.id === "a")!;

    // "b" should have higher combined score
    expect(itemB.score).toBeGreaterThan(itemA.score);
  });

  it("respects custom k parameter", () => {
    const vectorResults: RankedItem[] = [{ id: "a", score: 0.9 }];
    const k10 = 10;
    const k60 = 60;

    const result10 = fusionRRF(vectorResults, [], k10);
    const result60 = fusionRRF(vectorResults, [], k60);

    // Lower k means higher scores (1/11 > 1/61)
    expect(result10[0].score).toBeGreaterThan(result60[0].score);
  });

  it("preserves related entities from graph results", () => {
    const graphResults: RankedItemWithMetadata[] = [
      {
        id: "a",
        score: 0.9,
        name: "Entity A",
        type: "keyword",
        related: ["Entity B", "Entity C"],
      },
    ];

    const result = fusionRRF([], graphResults);

    expect(result[0].related).toEqual(["Entity B", "Entity C"]);
  });

  it("returns results sorted by score descending", () => {
    const vectorResults: RankedItem[] = [
      { id: "c", score: 0.5 }, // rank 0
      { id: "b", score: 0.3 }, // rank 1
      { id: "a", score: 0.1 }, // rank 2
    ];

    const result = fusionRRF(vectorResults, []);

    // Results should maintain the ranking order (higher RRF score first)
    expect(result[0].id).toBe("c");
    expect(result[1].id).toBe("b");
    expect(result[2].id).toBe("a");

    // Verify scores are descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});

describe("fusionRRFMultiple", () => {
  it("returns empty array for empty rankings", () => {
    const result = fusionRRFMultiple([]);
    expect(result).toEqual([]);
  });

  it("returns empty array for all-empty rankings", () => {
    const result = fusionRRFMultiple([[], [], []]);
    expect(result).toEqual([]);
  });

  it("fuses multiple rankings correctly", () => {
    const ranking1: RankedItem[] = [
      { id: "a", score: 0.9 },
      { id: "b", score: 0.8 },
    ];
    const ranking2: RankedItem[] = [
      { id: "b", score: 0.95 },
      { id: "c", score: 0.7 },
    ];
    const ranking3: RankedItem[] = [
      { id: "c", score: 0.85 },
      { id: "a", score: 0.6 },
    ];

    const result = fusionRRFMultiple([ranking1, ranking2, ranking3]);

    expect(result).toHaveLength(3);

    // Items appearing in more rankings should have higher scores
    // "a" appears in 2 rankings, "b" appears in 2 rankings, "c" appears in 2 rankings
    // But ranks differ, so scores will differ
    const itemA = result.find((r) => r.item.id === "a")!;
    const itemB = result.find((r) => r.item.id === "b")!;
    const itemC = result.find((r) => r.item.id === "c")!;

    expect(itemA).toBeDefined();
    expect(itemB).toBeDefined();
    expect(itemC).toBeDefined();
  });

  it("returns results sorted by score descending", () => {
    const ranking1: RankedItem[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const ranking2: RankedItem[] = [{ id: "b" }, { id: "a" }, { id: "c" }];

    const result = fusionRRFMultiple([ranking1, ranking2]);

    // Verify scores are descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});
