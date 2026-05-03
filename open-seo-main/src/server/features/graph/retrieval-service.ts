/**
 * RetrievalService - Hybrid Retrieval for GraphRAG
 * Phase 65: GraphRAG Foundation (65-04)
 *
 * Provides hybrid retrieval combining vector similarity with graph traversal.
 * Uses Reciprocal Rank Fusion (RRF) to merge results from both sources.
 */

import type { LightRAGService } from "@/server/lib/lightrag";
import { getLightRAGService } from "@/server/lib/lightrag";
import { getTenantGraphManager, type HybridSearchResult as GraphSearchResult } from "@/server/lib/graph";
import { getEmbeddingService } from "@/server/lib/embeddings";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "retrieval-service" });

/**
 * Options for retrieval operations.
 */
export interface RetrievalOptions {
  /** Number of results to return (default: 20) */
  k?: number;
  /** Expanded k for graph traversal before filtering (default: k*4) */
  kExpand?: number;
  /** RRF fusion parameter (default: 60) */
  rrfK?: number;
  /** Include full content in results (default: true) */
  includeContent?: boolean;
  /** Retrieval mode */
  mode?: "hybrid" | "vector" | "graph" | "lightrag";
}

/**
 * Individual search result with source tracking.
 */
export interface HybridSearchResult {
  /** Result ID */
  id: string;
  /** Fused score */
  score: number;
  /** Source of the result */
  source: "vector" | "graph" | "both";
  /** Entity name (from graph) */
  name?: string;
  /** Entity type (from graph) */
  type?: string;
  /** Content (if includeContent is true) */
  content?: string;
  /** Related entities from graph traversal */
  related?: string[];
}

/**
 * Result from retrieval operations.
 */
export interface RetrievalResult {
  /** Search results */
  results: HybridSearchResult[];
  /** Retrieval mode used */
  mode: string;
  /** Latency in milliseconds */
  latencyMs: number;
}

/**
 * Reciprocal Rank Fusion to combine rankings from multiple sources.
 * RRF(d) = sum(1 / (k + rank_i(d))) for each ranking i
 */
function reciprocalRankFusion(
  vectorResults: Array<{ id: string; score: number }>,
  graphResults: Array<{ id: string; score: number; name?: string; type?: string; related?: string[] }>,
  k: number = 60
): HybridSearchResult[] {
  const scores = new Map<string, { score: number; source: "vector" | "graph" | "both"; name?: string; type?: string; related?: string[] }>();

  // Process vector results
  vectorResults.forEach((result, rank) => {
    const rrfScore = 1 / (k + rank + 1);
    scores.set(result.id, {
      score: rrfScore,
      source: "vector",
    });
  });

  // Process graph results
  graphResults.forEach((result, rank) => {
    const rrfScore = 1 / (k + rank + 1);
    const existing = scores.get(result.id);

    if (existing) {
      // Found in both - boost score and mark as "both"
      scores.set(result.id, {
        score: existing.score + rrfScore,
        source: "both",
        name: result.name,
        type: result.type,
        related: result.related,
      });
    } else {
      scores.set(result.id, {
        score: rrfScore,
        source: "graph",
        name: result.name,
        type: result.type,
        related: result.related,
      });
    }
  });

  // Sort by fused score and return
  return Array.from(scores.entries())
    .map(([id, data]) => ({
      id,
      score: data.score,
      source: data.source,
      name: data.name,
      type: data.type,
      related: data.related,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * RetrievalService provides hybrid retrieval for GraphRAG.
 *
 * Combines:
 * - Vector similarity search (via embeddings + LightRAG)
 * - Graph traversal (via FalkorDB TenantGraphManager)
 * - RRF fusion for optimal ranking
 */
export class RetrievalService {
  private lightrag: LightRAGService;

  constructor(lightrag: LightRAGService) {
    this.lightrag = lightrag;
  }

  /**
   * Retrieve results using hybrid search.
   */
  async retrieve(
    tenantId: string,
    query: string,
    options?: RetrievalOptions
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const mode = options?.mode ?? "hybrid";
    const k = options?.k ?? 20;
    const rrfK = options?.rrfK ?? 60;

    log.debug("Starting retrieval", { tenantId, query: query.slice(0, 50), mode, k });

    let results: HybridSearchResult[] = [];

    if (mode === "lightrag") {
      // Pure LightRAG mode
      const ragResult = await this.lightrag.queryRAG(tenantId, query, "hybrid");
      results = ragResult.entities.map((e, i) => ({
        id: e.normalizedName, // Use normalized name as ID (ExtractedEntity doesn't have id)
        score: 1 - i * 0.05, // Approximate score based on position
        source: "both" as const,
        name: e.name,
        type: e.type,
      }));
    } else {
      // Hybrid/vector/graph modes
      const embeddingService = getEmbeddingService();
      const graphManager = await getTenantGraphManager();

      // Generate query embedding
      const embeddingOutput = await embeddingService.embedQuery(query);
      const queryEmbedding = embeddingOutput.embedding;

      if (mode === "hybrid" || mode === "vector") {
        // Vector search via graph manager (uses FalkorDB vector index)
        const vectorResults = await graphManager.hybridVectorGraphSearch(
          tenantId,
          queryEmbedding,
          { k: k * 2 }
        );

        if (mode === "vector") {
          results = vectorResults.map((r) => ({
            id: r.id,
            score: r.score,
            source: "vector" as const,
            name: r.name,
            type: r.type,
            related: r.related,
          }));
        } else {
          // For hybrid, we get both and fuse
          const graphResults = await graphManager.hybridVectorGraphSearch(
            tenantId,
            queryEmbedding,
            { k: k * 2 }
          );

          results = reciprocalRankFusion(
            vectorResults.map((r) => ({ id: r.id, score: r.score })),
            graphResults.map((r) => ({
              id: r.id,
              score: r.score,
              name: r.name,
              type: r.type,
              related: r.related,
            })),
            rrfK
          );
        }
      } else if (mode === "graph") {
        // Graph-only mode
        const graphResults = await graphManager.hybridVectorGraphSearch(
          tenantId,
          queryEmbedding,
          { k: k * 2 }
        );

        results = graphResults
          .filter((r) => r.related && r.related.length > 0)
          .map((r) => ({
            id: r.id,
            score: r.score,
            source: "graph" as const,
            name: r.name,
            type: r.type,
            related: r.related,
          }));
      }
    }

    // Apply k limit
    results = results.slice(0, k);

    const latencyMs = Date.now() - startTime;
    log.info("Retrieval complete", {
      tenantId,
      mode,
      resultCount: results.length,
      latencyMs,
    });

    return {
      results,
      mode,
      latencyMs,
    };
  }

  /**
   * Check if tenant has indexed data.
   */
  async hasTenantData(tenantId: string): Promise<boolean> {
    try {
      const health = await this.lightrag.healthCheck(tenantId);
      return health.tenantInitialized ?? false;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let _service: RetrievalService | null = null;

/**
 * Get the singleton RetrievalService instance.
 */
export function getRetrievalService(): RetrievalService {
  if (!_service) {
    _service = new RetrievalService(getLightRAGService());
  }
  return _service;
}
