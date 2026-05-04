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
 * - Safe parameterized vector queries (M-65-01 fix)
 *
 * @see .planning/phases/65-graphrag-foundation/65-RESEARCH.md (Pattern 3)
 */

import { getTenantGraphManager } from "./tenant-graph-manager";
import { embedQuery } from "@/server/lib/embeddings";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { fusionRRF } from "@/lib/rrf";
import { getCategoryRouter, rerankCandidates } from "@/server/lib/retrieval";

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

// H-65-01 fix: RRF function moved to shared utility @/lib/rrf.ts
// Re-export for backwards compatibility
export { fusionRRF as reciprocalRankFusion } from "@/lib/rrf";

/**
 * Validate that a vector contains only valid numeric values.
 * Prevents SQL injection via malformed vector data (M-65-01 mitigation).
 *
 * @param embedding - Vector to validate
 * @throws Error if vector contains invalid values
 */
function validateEmbeddingVector(embedding: number[]): void {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array");
  }
  for (let i = 0; i < embedding.length; i++) {
    const val = embedding[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(`Invalid embedding value at index ${i}: ${val}`);
    }
  }
}

/**
 * Vector search using pgvector DiskANN index.
 *
 * Searches the graphrag_chunks table for semantically similar documents.
 * Uses halfvec(768) with cosine distance for efficient search.
 *
 * M-65-01 fix: Uses validated vector string instead of sql.raw() with
 * unvalidated user input. The vector values are validated to be finite
 * numbers before being used in the query.
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
  // M-65-01 fix: Validate vector values to prevent injection
  validateEmbeddingVector(queryEmbedding);

  // Safe to use after validation - all values are confirmed finite numbers
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  try {
    // Note: We use sql.raw() here but only after validating that the vector
    // contains only finite numbers. This is safe because:
    // 1. queryEmbedding comes from our embedding service (trusted source)
    // 2. We validate all values are finite numbers (no strings/injection)
    // 3. pgvector requires the ::halfvec cast which can't be parameterized
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

  // Step 3: RRF fusion (using shared utility - H-65-01 fix)
  const fusedResults = fusionRRF(
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

/**
 * Options for hierarchical search.
 */
export interface HierarchicalSearchOptions {
  /** Number of top categories to route to (default: 3) */
  topCategories?: number;
  /** Number of candidates to retrieve per category (default: 20) */
  candidatesPerCategory?: number;
  /** Final number of results to return (default: 10) */
  finalTopK?: number;
  /** Whether to use reranker for final scoring (default: true) */
  useReranker?: boolean;
  /** Text key in results for reranking (default: "content") */
  rerankerTextKey?: string;
}

/**
 * Hierarchical search combining category routing + in-category search + reranking.
 *
 * Phase 73-03: Retrieval Quality Enhancement
 *
 * Implements two-stage retrieval pattern from Best Buy, JD.com UniERF,
 * Taobao ULIM, eBay CoT-BFS, and CHARM paper (arXiv 2501.18707):
 *
 * 1. Route query to top-k most relevant categories using centroid similarity
 * 2. Search within selected categories for candidates
 * 3. Rerank all candidates using cross-encoder for final ordering
 *
 * Benefits:
 * - Better relevance by focusing on relevant categories first
 * - +3-8 recall@10 improvement from cross-encoder reranking
 * - Scales better than searching all categories
 *
 * @param tenantId - Tenant identifier for multi-tenant isolation
 * @param query - Natural language query string
 * @param options - Search options
 * @returns Array of search results sorted by relevance
 *
 * @example
 * ```typescript
 * const results = await hierarchicalSearch("tenant-123", "laptop computer", {
 *   topCategories: 3,
 *   candidatesPerCategory: 20,
 *   finalTopK: 10,
 *   useReranker: true,
 * });
 * ```
 */
export async function hierarchicalSearch(
  tenantId: string,
  query: string,
  options: HierarchicalSearchOptions = {}
): Promise<HybridSearchResult[]> {
  const startTime = Date.now();

  const {
    topCategories = 3,
    candidatesPerCategory = 20,
    finalTopK = 10,
    useReranker = true,
    rerankerTextKey = "content",
  } = options;

  // Step 1: Route query to top categories
  const router = getCategoryRouter(tenantId);

  // Check if centroids are loaded
  if (!router.hasCentroids(tenantId)) {
    log.warn("No category centroids loaded, falling back to hybrid search", { tenantId });
    return hybridSearch(tenantId, query, { k: finalTopK });
  }

  const routingResults = await router.route(tenantId, query, { topK: topCategories });

  if (routingResults.length === 0) {
    log.warn("No categories matched, falling back to hybrid search", { tenantId });
    return hybridSearch(tenantId, query, { k: finalTopK });
  }

  const categoryIds = routingResults.map((r) => r.categoryId);

  log.debug("Routed query to categories", {
    tenantId,
    query: query.slice(0, 50),
    categories: categoryIds,
    similarities: routingResults.map((r) => r.similarity.toFixed(3)),
  });

  // Step 2: Search within each category
  const candidates: HybridSearchResult[] = [];

  // Generate query embedding once for all category searches
  const embeddingResult = await embedQuery(query);
  const queryEmbedding = embeddingResult.embedding;

  // Search each category in parallel
  const categorySearchPromises = categoryIds.map((categoryId) =>
    vectorSearchInCategory(tenantId, queryEmbedding, categoryId, candidatesPerCategory)
  );

  const categoryResults = await Promise.all(categorySearchPromises);

  for (const results of categoryResults) {
    candidates.push(...results);
  }

  log.debug("Collected candidates from categories", {
    tenantId,
    totalCandidates: candidates.length,
    categoryBreakdown: categoryResults.map((r) => r.length),
  });

  // Step 3: Rerank all candidates (if enabled and we have more than finalTopK)
  if (useReranker && candidates.length > finalTopK) {
    try {
      const reranked = await rerankCandidates(
        query,
        candidates.map((c) => ({
          ...c,
          [rerankerTextKey]: c.content || c.name || "",
        })),
        finalTopK,
        rerankerTextKey
      );

      const results: HybridSearchResult[] = reranked.map((r) => ({
        id: r.id as string,
        content: r.content as string | undefined,
        name: r.name as string | undefined,
        type: r.type as string | undefined,
        score: r.rerank_score,
        source: r.source as "vector" | "graph" | "both",
        related: r.related as string[] | undefined,
      }));

      const latencyMs = Date.now() - startTime;
      log.info("Hierarchical search completed with reranking", {
        tenantId,
        categories: categoryIds.length,
        totalCandidates: candidates.length,
        finalResults: results.length,
        latencyMs,
      });

      return results;
    } catch (error) {
      log.warn("Reranking failed, falling back to score-based ordering", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fall through to score-based sorting
    }
  }

  // Fallback: sort by original vector score and take top-k
  candidates.sort((a, b) => b.score - a.score);
  const results = candidates.slice(0, finalTopK);

  const latencyMs = Date.now() - startTime;
  log.info("Hierarchical search completed", {
    tenantId,
    categories: categoryIds.length,
    totalCandidates: candidates.length,
    finalResults: results.length,
    latencyMs,
    rerankerUsed: false,
  });

  return results;
}

/**
 * Vector search within a specific category.
 *
 * @param tenantId - Tenant identifier
 * @param queryEmbedding - Pre-computed query embedding
 * @param categoryId - Category to search within
 * @param limit - Maximum results to return
 * @returns Search results from the category
 */
async function vectorSearchInCategory(
  tenantId: string,
  queryEmbedding: number[],
  categoryId: string,
  limit: number
): Promise<HybridSearchResult[]> {
  // Validate embedding to prevent injection
  validateEmbeddingVector(queryEmbedding);

  const vectorStr = `[${queryEmbedding.join(",")}]`;

  try {
    const results = await db.execute(sql`
      SELECT
        id::text,
        content,
        category_id,
        1 - (embedding <=> ${sql.raw(`'${vectorStr}'::halfvec`)}) AS score
      FROM graphrag_chunks
      WHERE tenant_id = ${tenantId}
        AND category_id = ${categoryId}
      ORDER BY embedding <=> ${sql.raw(`'${vectorStr}'::halfvec`)}
      LIMIT ${limit}
    `);

    return (results.rows as Array<{
      id: string;
      content: string;
      category_id: string;
      score: number;
    }>).map((row) => ({
      id: String(row.id),
      content: String(row.content),
      score: Number(row.score),
      source: "vector" as const,
    }));
  } catch (error) {
    log.warn("Category vector search failed", {
      tenantId,
      categoryId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
