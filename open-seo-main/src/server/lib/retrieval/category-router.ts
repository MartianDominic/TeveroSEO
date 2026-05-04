/**
 * Category Centroid Router for hierarchical retrieval.
 *
 * Phase 73-03: Retrieval Quality Enhancement
 *
 * Implements two-stage retrieval pattern from Best Buy, JD.com UniERF,
 * Taobao ULIM, eBay CoT-BFS, and CHARM paper (arXiv 2501.18707):
 * 1. Route query to top-k most relevant categories using centroid similarity
 * 2. Search within selected categories for final results
 *
 * Reference:
 * - .planning/phases/73-infrastructure-optimization/73-03-PLAN.md
 * - docs/infra-research/cpu-only-rag-graph.md
 */

import { embedQuery } from "@/server/lib/embeddings/embedding-service";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "category-router" });

/**
 * Represents a category centroid for routing.
 */
export interface CategoryCentroid {
  /** Unique category identifier */
  categoryId: string;
  /** Human-readable category name */
  categoryName: string;
  /** Mean embedding vector of all items in category (normalized) */
  centroid: Float32Array;
  /** Number of items in this category */
  itemCount: number;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Result of routing a query to categories.
 */
export interface RoutingResult {
  /** Category ID */
  categoryId: string;
  /** Category name */
  categoryName: string;
  /** Similarity score to query (0-1) */
  similarity: number;
  /** Number of items in category */
  itemCount: number;
}

/**
 * Options for building centroids.
 */
export interface BuildCentroidsOptions {
  /** Minimum items required to create a category centroid */
  minItemsPerCategory?: number;
  /** Table name containing embeddings (default: graphrag_chunks) */
  embeddingTable?: string;
  /** Column name for category ID */
  categoryColumn?: string;
  /** Column name for embedding vector */
  embeddingColumn?: string;
}

/**
 * Options for routing queries.
 */
export interface RouteOptions {
  /** Number of top categories to return (default: 3) */
  topK?: number;
  /** Minimum similarity threshold (default: 0.0) */
  minSimilarity?: number;
}

/**
 * Category Router using centroid-based similarity for hierarchical retrieval.
 *
 * The router maintains precomputed category centroids (mean embeddings)
 * and uses cosine similarity to route queries to relevant categories.
 *
 * Usage:
 * 1. Build centroids periodically (e.g., daily via scheduled job)
 * 2. Route incoming queries to top-k categories
 * 3. Search within those categories for final results
 *
 * Performance:
 * - Centroid computation: O(n) where n = total items
 * - Query routing: O(c) where c = number of categories
 * - Memory: ~3KB per category (768-dim * 4 bytes)
 */
export class CategoryRouter {
  /** In-memory cache of category centroids per tenant */
  private centroids: Map<string, Map<string, CategoryCentroid>> = new Map();

  /** Default embedding dimension */
  private readonly embeddingDim = 768;

  /**
   * Build category centroids from item embeddings.
   *
   * This method queries all items with embeddings, groups by category,
   * computes mean embeddings, and normalizes them for cosine similarity.
   *
   * Should be called periodically (e.g., daily) to keep centroids fresh.
   *
   * @param tenantId - Tenant identifier for multi-tenant isolation
   * @param options - Build options
   * @returns Number of categories with computed centroids
   */
  async buildCentroids(
    tenantId: string,
    options: BuildCentroidsOptions = {}
  ): Promise<number> {
    const {
      minItemsPerCategory = 1,
      embeddingTable = "graphrag_chunks",
      categoryColumn = "category_id",
      embeddingColumn = "embedding",
    } = options;

    const startTime = Date.now();

    try {
      // Query all items grouped by category
      // Note: This query assumes embeddings are stored as halfvec
      const results = await db.execute(sql`
        SELECT
          ${sql.raw(categoryColumn)} as category_id,
          ${sql.raw(embeddingColumn)}::float4[] as embedding
        FROM ${sql.raw(embeddingTable)}
        WHERE tenant_id = ${tenantId}
          AND ${sql.raw(categoryColumn)} IS NOT NULL
          AND ${sql.raw(embeddingColumn)} IS NOT NULL
      `);

      // Group embeddings by category
      const grouped = new Map<string, number[][]>();
      for (const row of results.rows as Array<{ category_id: string; embedding: number[] }>) {
        if (!row.category_id || !row.embedding) continue;

        const list = grouped.get(row.category_id) || [];
        list.push(row.embedding);
        grouped.set(row.category_id, list);
      }

      // Compute centroids for each category
      const tenantCentroids = new Map<string, CategoryCentroid>();

      for (const [categoryId, embeddings] of grouped) {
        if (embeddings.length < minItemsPerCategory) {
          continue;
        }

        const centroid = this.computeMeanEmbedding(embeddings);
        const categoryName = await this.getCategoryName(tenantId, categoryId);

        tenantCentroids.set(categoryId, {
          categoryId,
          categoryName,
          centroid,
          itemCount: embeddings.length,
          updatedAt: new Date(),
        });
      }

      // Store in cache
      this.centroids.set(tenantId, tenantCentroids);

      const duration = Date.now() - startTime;
      log.info("Built category centroids", {
        tenantId,
        categoryCount: tenantCentroids.size,
        totalItems: results.rows.length,
        durationMs: duration,
      });

      return tenantCentroids.size;
    } catch (error) {
      log.error("Failed to build category centroids", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Route a query to the top-k most relevant categories.
   *
   * Uses cosine similarity between query embedding and category centroids
   * to find the most relevant categories for the query.
   *
   * @param tenantId - Tenant identifier
   * @param query - Natural language query string
   * @param options - Routing options
   * @returns Array of routing results sorted by similarity descending
   */
  async route(
    tenantId: string,
    query: string,
    options: RouteOptions = {}
  ): Promise<RoutingResult[]> {
    const { topK = 3, minSimilarity = 0.0 } = options;

    const tenantCentroids = this.centroids.get(tenantId);
    if (!tenantCentroids || tenantCentroids.size === 0) {
      log.warn("No centroids found for tenant, returning empty results", { tenantId });
      return [];
    }

    // Generate query embedding
    const queryResult = await embedQuery(query);
    const queryEmbedding = new Float32Array(queryResult.embedding);

    // Normalize query embedding for cosine similarity
    const normalizedQuery = this.normalizeVector(queryEmbedding);

    // Compute similarity to each category centroid
    const scores: RoutingResult[] = [];

    for (const [categoryId, centroid] of tenantCentroids) {
      const similarity = this.cosineSimilarity(normalizedQuery, centroid.centroid);

      if (similarity >= minSimilarity) {
        scores.push({
          categoryId,
          categoryName: centroid.categoryName,
          similarity,
          itemCount: centroid.itemCount,
        });
      }
    }

    // Sort by similarity descending and return top-k
    scores.sort((a, b) => b.similarity - a.similarity);

    return scores.slice(0, topK);
  }

  /**
   * Get category IDs for a query (convenience method).
   *
   * @param tenantId - Tenant identifier
   * @param query - Natural language query string
   * @param topK - Number of categories to return
   * @returns Array of category IDs
   */
  async routeToIds(
    tenantId: string,
    query: string,
    topK: number = 3
  ): Promise<string[]> {
    const results = await this.route(tenantId, query, { topK });
    return results.map((r) => r.categoryId);
  }

  /**
   * Check if centroids are loaded for a tenant.
   *
   * @param tenantId - Tenant identifier
   * @returns True if centroids are available
   */
  hasCentroids(tenantId: string): boolean {
    const tenantCentroids = this.centroids.get(tenantId);
    return tenantCentroids !== undefined && tenantCentroids.size > 0;
  }

  /**
   * Get the number of categories with centroids.
   *
   * @param tenantId - Tenant identifier
   * @returns Number of categories or 0 if not loaded
   */
  getCategoryCount(tenantId: string): number {
    return this.centroids.get(tenantId)?.size ?? 0;
  }

  /**
   * Clear cached centroids for a tenant.
   *
   * @param tenantId - Tenant identifier to clear, or undefined to clear all
   */
  clearCentroids(tenantId?: string): void {
    if (tenantId) {
      this.centroids.delete(tenantId);
    } else {
      this.centroids.clear();
    }
  }

  /**
   * Compute mean embedding from a list of embeddings.
   *
   * @param embeddings - Array of embedding vectors
   * @returns Normalized mean embedding as Float32Array
   */
  private computeMeanEmbedding(embeddings: number[][]): Float32Array {
    if (embeddings.length === 0) {
      return new Float32Array(this.embeddingDim);
    }

    const dim = embeddings[0].length;
    const mean = new Float32Array(dim);

    // Sum all embeddings
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        mean[i] += emb[i];
      }
    }

    // Divide by count to get mean
    for (let i = 0; i < dim; i++) {
      mean[i] /= embeddings.length;
    }

    // Normalize for cosine similarity
    return this.normalizeVector(mean);
  }

  /**
   * Normalize a vector to unit length.
   *
   * @param vec - Input vector
   * @returns Normalized vector (same array if input, or new array)
   */
  private normalizeVector(vec: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      return vec;
    }

    const normalized = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) {
      normalized[i] = vec[i] / norm;
    }

    return normalized;
  }

  /**
   * Compute cosine similarity between two normalized vectors.
   *
   * Since vectors are normalized, cosine similarity = dot product.
   *
   * @param a - First normalized vector
   * @param b - Second normalized vector
   * @returns Similarity score (-1 to 1, typically 0 to 1 for embeddings)
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  /**
   * Get human-readable category name from ID.
   *
   * Override this method to provide custom category name resolution.
   *
   * @param tenantId - Tenant identifier
   * @param categoryId - Category ID
   * @returns Category name (defaults to ID if not found)
   */
  protected async getCategoryName(
    tenantId: string,
    categoryId: string
  ): Promise<string> {
    // Default implementation: try to fetch from categories table
    try {
      const result = await db.execute(sql`
        SELECT name FROM categories
        WHERE id = ${categoryId}
          AND (tenant_id = ${tenantId} OR tenant_id IS NULL)
        LIMIT 1
      `);

      if (result.rows.length > 0 && (result.rows[0] as { name?: string }).name) {
        return (result.rows[0] as { name: string }).name;
      }
    } catch {
      // Table might not exist, fall back to ID
    }

    return categoryId;
  }
}

// Singleton instances per tenant
const routerInstances = new Map<string, CategoryRouter>();

/**
 * Get or create a CategoryRouter instance for a tenant.
 *
 * @param tenantId - Tenant identifier
 * @returns CategoryRouter instance
 */
export function getCategoryRouter(tenantId: string): CategoryRouter {
  let router = routerInstances.get(tenantId);
  if (!router) {
    router = new CategoryRouter();
    routerInstances.set(tenantId, router);
  }
  return router;
}

/**
 * Get the shared CategoryRouter instance.
 *
 * Use this for single-tenant deployments or when tenant isolation
 * is handled at the centroid level.
 *
 * @returns Shared CategoryRouter instance
 */
export function getSharedCategoryRouter(): CategoryRouter {
  return getCategoryRouter("__shared__");
}
