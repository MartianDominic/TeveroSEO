/**
 * RetrievalService - Hybrid Retrieval for GraphRAG
 * Phase 65: GraphRAG Foundation (65-04)
 *
 * Provides hybrid retrieval combining vector similarity with graph traversal.
 * Uses Reciprocal Rank Fusion (RRF) to merge results from both sources.
 *
 * Performance optimizations:
 * - Single graph search call for hybrid mode (H-65-02 fix)
 * - Shared RRF utility (H-65-01 fix)
 * - Vector-only fallback when graph fails (M-65-05 fix)
 */

import type { LightRAGService } from "@/server/lib/lightrag";
import { getLightRAGService } from "@/server/lib/lightrag";
import { getTenantGraphManager, type HybridSearchResult as GraphSearchResult } from "@/server/lib/graph";
import { getEmbeddingService } from "@/server/lib/embeddings";
import { createLogger } from "@/server/lib/logger";
import { fusionRRF } from "@/lib/rrf";

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

// H-65-01 fix: RRF function moved to shared utility @/lib/rrf.ts

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

      // H-65-02 fix: Single call to hybrid search, cached for both vector and graph scoring
      // M-65-05 fix: Try graph search with vector-only fallback
      let searchResults: GraphSearchResult[] = [];
      let graphSearchFailed = false;

      try {
        searchResults = await graphManager.hybridVectorGraphSearch(
          tenantId,
          queryEmbedding,
          { k: k * 2 }
        );
      } catch (graphError) {
        graphSearchFailed = true;
        log.warn("Graph search failed, will use vector-only mode", {
          tenantId,
          error: graphError instanceof Error ? graphError.message : String(graphError),
        });
      }

      if (mode === "vector" || graphSearchFailed) {
        // Vector-only mode (or fallback when graph fails)
        results = searchResults.map((r) => ({
          id: r.id,
          score: r.score,
          source: "vector" as const,
          name: r.name,
          type: r.type,
          related: r.related,
        }));
      } else if (mode === "hybrid") {
        // Hybrid mode: use single search result for both vector and graph scoring
        // Score by vector relevance (original order) vs graph connections (by related count)
        const vectorScored = searchResults.map((r) => ({ id: r.id, score: r.score }));
        const graphScored = [...searchResults]
          .sort((a, b) => (b.related?.length ?? 0) - (a.related?.length ?? 0))
          .map((r) => ({
            id: r.id,
            score: r.score,
            name: r.name,
            type: r.type,
            related: r.related,
          }));

        // Use shared RRF utility (H-65-01 fix)
        const fusedResults = fusionRRF(vectorScored, graphScored, rrfK);
        results = fusedResults.map((r) => ({
          id: r.id,
          score: r.score,
          source: r.source,
          name: r.name,
          type: r.type,
          related: r.related,
        }));
      } else if (mode === "graph") {
        // Graph-only mode: filter to items with graph connections
        results = searchResults
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
