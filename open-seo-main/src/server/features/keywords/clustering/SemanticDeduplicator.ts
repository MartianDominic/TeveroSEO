/**
 * Semantic Deduplicator
 * Phase 86-01: Semantic Intelligence Pipeline
 *
 * Deduplicates keywords using embedding cosine similarity.
 * Near-duplicates above threshold are merged into canonical forms.
 *
 * Algorithm: Union-Find for transitive closure of similarity graph.
 *
 * CRITICAL: Validates embedding dimension (768 for jina-v5-text-nano)
 * per 86-RESEARCH.md Pitfall 1: Embedding Dimension Mismatch
 */

import { cosineSimilarity } from '@/server/features/keywords/services/EmbeddingService';
import type {
  ClusteringInput,
  DeduplicationConfig,
  DeduplicationResult,
  DeduplicationStats,
  MergedKeyword,
} from './types';
import {
  DEFAULT_DEDUP_CONFIG,
  EMBEDDING_DIMENSION,
  validateEmbedding,
} from './types';

/**
 * Union-Find data structure for efficient grouping.
 */
class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  makeSet(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.makeSet(x);
    }

    const p = this.parent.get(x)!;
    if (p !== x) {
      // Path compression
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    // Union by rank
    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(key);
    }

    return groups;
  }
}

/**
 * Semantic deduplicator using embedding similarity.
 */
export class SemanticDeduplicator {
  private config: DeduplicationConfig;

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = { ...DEFAULT_DEDUP_CONFIG, ...config };
  }

  /**
   * Deduplicate keywords by semantic similarity.
   *
   * @throws Error if any embedding has wrong dimension (not 768)
   * @throws Error if any embedding contains NaN/Infinity
   */
  deduplicate(inputs: ClusteringInput[]): DeduplicationResult {
    const startTime = Date.now();

    // Handle empty input
    if (inputs.length === 0) {
      return {
        canonicals: [],
        mergeMap: new Map(),
        merged: [],
        stats: {
          inputCount: 0,
          outputCount: 0,
          mergedCount: 0,
          reductionPercent: 0,
          processingTimeMs: 0,
          skippedInvalidEmbeddings: 0,
        },
      };
    }

    // Validate embeddings and filter out invalid ones
    const validInputs: ClusteringInput[] = [];
    let skippedCount = 0;

    for (const input of inputs) {
      const validation = validateEmbedding(input.embedding, input.keyword);

      if (!validation.valid) {
        // Check if it's a dimension/value error (should throw) or missing (should skip)
        if (!input.embedding) {
          // Missing embedding - skip with warning
          console.warn(`[SemanticDeduplicator] ${validation.error}`);
          skippedCount++;
          continue;
        } else {
          // Invalid dimension or values - throw error (this is a bug)
          throw new Error(validation.error);
        }
      }

      validInputs.push(input);
    }

    // Handle case where all inputs were skipped or only one valid
    if (validInputs.length === 0) {
      return {
        canonicals: [],
        mergeMap: new Map(),
        merged: [],
        stats: {
          inputCount: inputs.length,
          outputCount: 0,
          mergedCount: 0,
          reductionPercent: 100,
          processingTimeMs: Date.now() - startTime,
          skippedInvalidEmbeddings: skippedCount,
        },
      };
    }

    if (validInputs.length === 1) {
      return {
        canonicals: [...validInputs],
        mergeMap: new Map([[validInputs[0].keyword, validInputs[0].keyword]]),
        merged: [],
        stats: {
          inputCount: inputs.length,
          outputCount: 1,
          mergedCount: 0,
          reductionPercent: 0,
          processingTimeMs: Date.now() - startTime,
          skippedInvalidEmbeddings: skippedCount,
        },
      };
    }

    // Build keyword index
    const keywordMap = new Map<string, ClusteringInput>();
    for (const input of validInputs) {
      keywordMap.set(input.keyword, input);
    }

    // Find similar pairs using Union-Find
    const uf = new UnionFind();
    for (const input of validInputs) {
      uf.makeSet(input.keyword);
    }

    // Compare all pairs (O(n^2) - acceptable for <10K keywords)
    const n = validInputs.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const similarity = cosineSimilarity(
          new Float32Array(validInputs[i].embedding),
          new Float32Array(validInputs[j].embedding)
        );

        if (similarity >= this.config.similarityThreshold) {
          uf.union(validInputs[i].keyword, validInputs[j].keyword);
        }
      }
    }

    // Process groups
    const groups = uf.getGroups();
    const canonicals: ClusteringInput[] = [];
    const merged: MergedKeyword[] = [];
    const mergeMap = new Map<string, string>();

    for (const [_root, members] of groups) {
      const groupInputs = members.map(k => keywordMap.get(k)!);

      // Select canonical based on strategy
      const canonical = this.selectCanonical(groupInputs);
      canonicals.push(canonical);

      // Map all members to canonical
      for (const member of members) {
        mergeMap.set(member, canonical.keyword);
      }

      // If group has multiple members, record merge
      if (members.length > 1) {
        merged.push(this.createMergedKeyword(canonical, groupInputs));
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const stats: DeduplicationStats = {
      inputCount: inputs.length,
      outputCount: canonicals.length,
      mergedCount: merged.length,
      reductionPercent: validInputs.length > 0
        ? ((validInputs.length - canonicals.length) / validInputs.length) * 100
        : 0,
      processingTimeMs,
      skippedInvalidEmbeddings: skippedCount,
    };

    return { canonicals, mergeMap, merged, stats };
  }

  /**
   * Select canonical keyword from a group.
   */
  private selectCanonical(group: ClusteringInput[]): ClusteringInput {
    switch (this.config.canonicalStrategy) {
      case 'highest_volume':
        return group.reduce((best, curr) =>
          curr.volume > best.volume ? curr : best
        );

      case 'shortest':
        return group.reduce((best, curr) =>
          curr.keyword.length < best.keyword.length ? curr : best
        );

      case 'first':
        return group[0];

      default:
        return group[0];
    }
  }

  /**
   * Create merged keyword record with combined stats.
   */
  private createMergedKeyword(
    canonical: ClusteringInput,
    group: ClusteringInput[]
  ): MergedKeyword {
    const combinedVolume = group.reduce((sum, k) => sum + k.volume, 0);
    const averageDifficulty = group.reduce((sum, k) => sum + k.difficulty, 0) / group.length;

    return {
      ...canonical,
      mergedFrom: group.map(k => k.keyword),
      combinedVolume,
      averageDifficulty,
      variantCount: group.length,
    };
  }
}

/**
 * Factory function for quick deduplication.
 */
export function deduplicate(
  inputs: ClusteringInput[],
  config?: Partial<DeduplicationConfig>
): DeduplicationResult {
  const dedup = new SemanticDeduplicator(config);
  return dedup.deduplicate(inputs);
}
