/**
 * Hybrid Retrieval Pipeline
 * Phase 65: GraphRAG Foundation
 *
 * Combines vector similarity + graph traversal using RRF fusion.
 * Per RESEARCH.md Pattern 3, hybrid retrieval outperforms vector-only by 20%+.
 *
 * Key features:
 * - RRF fusion with configurable k parameter (default: 60)
 * - Parallel vector + graph search for low latency
 * - <500ms p95 latency target for 20 results
 * - Source attribution (vector, graph, or both)
 *
 * @see .planning/phases/65-graphrag-foundation/65-RESEARCH.md (Pattern 3)
 */

import { getTenantGraphManager } from "./tenant-graph-manager";
import { embedQuery } from "@/server/lib/embeddings";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "hybrid-retrieval" });

/**
 * Base search result with RRF score and source attribution.
 */
export interface SearchResult {
  /** Document or entity ID */
  id: string;
  /** RRF-computed score */
  score: number;
  /** Source of result: vector search, graph traversal, or both */
  source: "vector" | "graph" | "both";
}

/**
 * Extended result with optional content and graph metadata.
 */
export interface HybridSearchResult {
  /** Document or entity ID */
  id: string;
  /** Document content (from vector search) */
  content?: string;
  /** Entity name (from graph) */
  name?: string;
  /** Entity type (from graph) */
  type?: string;
  /** RRF-computed score */
  score: number;
  /** Source of result: vector search, graph traversal, or both */
  source: "vector" | "graph" | "both";
  /** Related entity names (from graph traversal) */
  related?: string[];
}

/**
 * Options for hybrid search.
 */
export interface HybridSearchOptions {
  /** Number of final results to return (default: 20, max: 100) */
  k?: number;
  /** Number of candidates from each source (default: k * 2) */
  kExpand?: number;
  /** RRF k parameter - higher values reduce impact of rank differences (default: 60) */
  rrfK?: number;
  /** Whether to include document content in results (default: true) */
  includeContent?: boolean;
}

/** Maximum allowed k parameter to prevent DoS (T-65-08 mitigation) */
const MAX_K = 100;

/**
 * Reciprocal Rank Fusion (RRF) algorithm.
 *
 * Combines rankings from multiple sources using the formula:
 * score(d) = sum(1 / (k + rank(d)))
 *
 * This is a robust fusion method that:
 * - Doesn't require score normalization
 * - Handles different score scales across sources
 * - Boosts documents appearing in multiple sources
 *
 * @param vectorResults - Results from vector search, sorted by relevance
 * @param graphResults - Results from graph traversal, sorted by relevance
 * @param k - RRF constant (default 60, per Cormack et al. SIGIR 2009)
 * @returns Fused results sorted by RRF score descending
 */
export function reciprocalRankFusion(
  vectorResults: Array<{ id: string; score: number }>,
  graphResults: Array<{ id: string; score: number }>,
  k: number = 60
): SearchResult[] {
  // Handle empty inputs
  if (vectorResults.length === 0 && graphResults.length === 0) {
    return [];
  }

  // Map to track scores and sources for each document
  const scores = new Map<string, { score: number; sources: Set<"vector" | "graph"> }>();

  // Process vector results - rank is 0-indexed
  vectorResults.forEach((result, rank) => {
    const existing = scores.get(result.id) || {
      score: 0,
      sources: new Set<"vector" | "graph">(),
    };
    // RRF formula: 1 / (k + rank + 1), where rank is 0-indexed
    existing.score += 1 / (k + rank + 1);
    existing.sources.add("vector");
    scores.set(result.id, existing);
  });

  // Process graph results - rank is 0-indexed
  graphResults.forEach((result, rank) => {
    const existing = scores.get(result.id) || {
      score: 0,
      sources: new Set<"vector" | "graph">(),
    };
    // RRF formula: 1 / (k + rank + 1), where rank is 0-indexed
    existing.score += 1 / (k + rank + 1);
    existing.sources.add("graph");
    scores.set(result.id, existing);
  });

  // Convert to array and determine source attribution
  const results: SearchResult[] = Array.from(scores.entries()).map(([id, data]) => ({
    id,
    score: data.score,
    source:
      data.sources.size === 2
        ? ("both" as const)
        : data.sources.has("vector")
          ? ("vector" as const)
          : ("graph" as const),
  }));

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Vector search using pgvector DiskANN index.
 *
 * Searches the graphrag_chunks table for semantically similar documents.
 * Uses halfvec(768) with cosine distance for efficient search.
 *
 * @param tenantId - Tenant identifier
 * @param queryEmbedding - 768-dim query embedding vector
 * @param limit - Maximum results to return
 * @returns Vector search results with content
 */
async function vectorSearch(
  tenantId: string,
  queryEmbedding: number[],
  limit: number
): Promise<Array<{ id: string; score: number; content: string }>> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  try {
    const results = await db.execute(sql`
      SELECT
        id::text,
        content,
        1 - (embedding <=> ${sql.raw(`'${vectorStr}'::halfvec`)}) AS score
      FROM graphrag_chunks
      WHERE tenant_id = ${tenantId}
      ORDER BY embedding <=> ${sql.raw(`'${vectorStr}'::halfvec`)}
      LIMIT ${limit}
    `);

    return (results.rows as Array<{ id: string; content: string; score: number }>).map(
      (row) => ({
        id: String(row.id),
        score: Number(row.score),
        content: String(row.content),
      })
    );
  } catch (error) {
    log.warn("Vector search failed, returning empty results", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Hybrid search combining vector similarity and graph traversal.
 *
 * Workflow:
 * 1. Generate query embedding (768-dim)
 * 2. Parallel search: vector search + graph traversal
 * 3. RRF fusion to combine results
 * 4. Assemble final results with content and metadata
 *
 * @param tenantId - Tenant identifier
 * @param query - Natural language query string
 * @param options - Search options (k, kExpand, rrfK, includeContent)
 * @returns Fused search results with source attribution
 */
export async function hybridSearch(
  tenantId: string,
  query: string,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResult[]> {
  const startTime = Date.now();

  // Apply defaults and cap k to prevent DoS (T-65-08)
  const k = Math.min(options.k ?? 20, MAX_K);
  const kExpand = options.kExpand ?? k * 2;
  const rrfK = options.rrfK ?? 60;
  const includeContent = options.includeContent ?? true;

  // Step 1: Generate query embedding (768-dim)
  const embeddingResult = await embedQuery(query);
  const queryEmbedding = embeddingResult.embedding;

  // Step 2: Parallel search - vector + graph
  const graphManager = await getTenantGraphManager();

  const [vectorResults, graphResults] = await Promise.all([
    vectorSearch(tenantId, queryEmbedding, kExpand),
    graphManager.hybridVectorGraphSearch(tenantId, queryEmbedding, { k: kExpand }),
  ]);

  // Step 3: RRF fusion
  const fusedResults = reciprocalRankFusion(
    vectorResults.map((r) => ({ id: r.id, score: r.score })),
    graphResults.map((r) => ({ id: r.id, score: r.score })),
    rrfK
  );

  // Step 4: Build result lookup maps for enrichment
  const vectorContentMap = new Map(vectorResults.map((r) => [r.id, r.content]));
  const graphDataMap = new Map(
    graphResults.map((r) => [r.id, { name: r.name, type: r.type, related: r.related }])
  );

  // Assemble final results (limited to k)
  const results: HybridSearchResult[] = fusedResults.slice(0, k).map((fused) => {
    const graphData = graphDataMap.get(fused.id);
    return {
      id: fused.id,
      content: includeContent ? vectorContentMap.get(fused.id) : undefined,
      name: graphData?.name,
      type: graphData?.type,
      score: fused.score,
      source: fused.source,
      related: graphData?.related,
    };
  });

  // Log performance metrics
  const latencyMs = Date.now() - startTime;
  log.info("Hybrid search completed", {
    tenantId,
    k,
    latencyMs,
    vectorCount: vectorResults.length,
    graphCount: graphResults.length,
    fusedCount: results.length,
  });

  // Warn if latency exceeds target (T-65-08 monitoring)
  if (latencyMs > 500) {
    log.warn("Hybrid search exceeded 500ms target", { tenantId, latencyMs });
  }

  return results;
}
