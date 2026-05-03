/**
 * Reciprocal Rank Fusion (RRF) Utility
 * Phase 65: GraphRAG Foundation
 *
 * Shared utility for combining rankings from multiple sources.
 * Implements the RRF algorithm per Cormack et al. SIGIR 2009.
 *
 * RRF Formula: score(d) = sum(1 / (k + rank(d))) for each ranking
 *
 * Benefits:
 * - No score normalization needed
 * - Handles different score scales across sources
 * - Boosts documents appearing in multiple sources
 */

/**
 * Base interface for items that can be ranked.
 */
export interface RankedItem {
  /** Unique identifier for the item */
  id: string;
  /** Original score from source (optional, not used in RRF calculation) */
  score?: number;
}

/**
 * Extended interface for items with metadata (e.g., from graph search).
 */
export interface RankedItemWithMetadata extends RankedItem {
  /** Entity name */
  name?: string;
  /** Entity type */
  type?: string;
  /** Related entity names */
  related?: string[];
}

/**
 * Result from RRF fusion with source attribution.
 */
export interface FusedResult {
  /** Item ID */
  id: string;
  /** RRF-computed fused score */
  score: number;
  /** Source attribution: which rankings contained this item */
  source: "vector" | "graph" | "both";
  /** Optional name from graph search */
  name?: string;
  /** Optional type from graph search */
  type?: string;
  /** Optional related entities from graph search */
  related?: string[];
}

/**
 * Reciprocal Rank Fusion algorithm.
 *
 * Combines rankings from vector and graph sources into a single fused ranking.
 * Items appearing in both sources receive boosted scores.
 *
 * @param vectorResults - Results from vector similarity search (ranked by relevance)
 * @param graphResults - Results from graph traversal (ranked by relevance)
 * @param k - RRF constant (default: 60, per Cormack et al. SIGIR 2009)
 * @returns Fused results sorted by RRF score descending
 *
 * @example
 * ```typescript
 * const fused = fusionRRF(
 *   [{ id: "a", score: 0.9 }, { id: "b", score: 0.8 }],
 *   [{ id: "b", score: 0.95, name: "Entity B" }, { id: "c", score: 0.7 }],
 *   60
 * );
 * // Result: [{ id: "b", score: 0.033, source: "both", name: "Entity B" }, ...]
 * ```
 */
export function fusionRRF(
  vectorResults: RankedItem[],
  graphResults: RankedItemWithMetadata[],
  k: number = 60
): FusedResult[] {
  // Handle empty inputs
  if (vectorResults.length === 0 && graphResults.length === 0) {
    return [];
  }

  // Map to track scores, sources, and metadata for each item
  const scores = new Map<
    string,
    {
      score: number;
      sources: Set<"vector" | "graph">;
      name?: string;
      type?: string;
      related?: string[];
    }
  >();

  // Process vector results - rank is 0-indexed
  vectorResults.forEach((result, rank) => {
    const rrfScore = 1 / (k + rank + 1);
    const existing = scores.get(result.id) || {
      score: 0,
      sources: new Set<"vector" | "graph">(),
    };
    existing.score += rrfScore;
    existing.sources.add("vector");
    scores.set(result.id, existing);
  });

  // Process graph results - rank is 0-indexed
  graphResults.forEach((result, rank) => {
    const rrfScore = 1 / (k + rank + 1);
    const existing = scores.get(result.id) || {
      score: 0,
      sources: new Set<"vector" | "graph">(),
    };
    existing.score += rrfScore;
    existing.sources.add("graph");
    // Preserve metadata from graph results
    if (result.name !== undefined) existing.name = result.name;
    if (result.type !== undefined) existing.type = result.type;
    if (result.related !== undefined) existing.related = result.related;
    scores.set(result.id, existing);
  });

  // Convert to array with source attribution
  const results: FusedResult[] = Array.from(scores.entries()).map(
    ([id, data]) => ({
      id,
      score: data.score,
      source:
        data.sources.size === 2
          ? ("both" as const)
          : data.sources.has("vector")
            ? ("vector" as const)
            : ("graph" as const),
      name: data.name,
      type: data.type,
      related: data.related,
    })
  );

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Generic RRF fusion for multiple rankings.
 *
 * Useful when you have more than two ranking sources.
 *
 * @param rankings - Array of ranked result lists
 * @param k - RRF constant (default: 60)
 * @returns Fused results sorted by RRF score descending
 */
export function fusionRRFMultiple<T extends RankedItem>(
  rankings: T[][],
  k: number = 60
): Array<{ item: T; score: number }> {
  if (rankings.length === 0 || rankings.every((r) => r.length === 0)) {
    return [];
  }

  const scoreMap = new Map<string, { item: T; score: number }>();

  for (const ranking of rankings) {
    ranking.forEach((item, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const existing = scoreMap.get(item.id);

      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(item.id, { item, score: rrfScore });
      }
    });
  }

  return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
}
