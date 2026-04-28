/**
 * PostgreSQL schema for embedding storage with pgvector and DiskANN.
 *
 * Phase 42-03: Unified Embedding Service
 *
 * This schema provides:
 * - Custom halfvec(384) Drizzle type for storage-efficient vectors
 * - productEmbeddings table for e-commerce product embeddings
 * - keywordEmbeddings table for keyword matching
 * - DiskANN index configuration for 100M+ vector scale
 * - Vector search query helpers with tenant isolation
 *
 * Reference:
 * - .planning/keyword-intelligence/ARCHITECTURE-DECISIONS.md (ADR-002)
 * - docs/infra-research/cpu-only-rag-graph.md (Section 5)
 */

import {
  pgTable,
  text,
  bigint,
  timestamp,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Custom Drizzle type for PostgreSQL halfvec(384).
 *
 * halfvec uses 16-bit floats (half precision) for 50% storage reduction
 * with near-zero recall loss on normalized embeddings.
 *
 * Storage: 384 dims * 2 bytes = 768 bytes per vector
 * (vs 1536 bytes for float32 vector(384))
 */
export const halfvec384 = customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return "halfvec(384)";
  },
  toDriver(value: number[]): string {
    // Convert array to PostgreSQL vector literal: '[0.1,0.2,...]'
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Parse PostgreSQL vector literal back to array
    // Value comes as '[0.1,0.2,...]'
    const inner = value.slice(1, -1);
    if (!inner) return [];
    return inner.split(",").map(Number);
  },
});

/**
 * Product embeddings table.
 *
 * Stores embeddings for e-commerce products with tenant isolation.
 * Uses seoContentHash for deduplication (ignores price/stock changes).
 */
export const productEmbeddings = pgTable(
  "product_embeddings",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    tenantId: text("tenant_id").notNull(),
    productSku: text("product_sku").notNull(),
    productUrl: text("product_url").notNull(),
    /** SEO content hash (excludes price/stock for delta detection) */
    contentHash: text("content_hash").notNull(),
    /** Product name/title for display */
    productName: text("product_name"),
    /** Embedding vector - halfvec(384) for storage efficiency */
    embedding: halfvec384("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Tenant isolation - ALWAYS filter by tenant_id first
    index("ix_product_emb_tenant").on(table.tenantId),
    // Fast lookup by tenant + SKU
    index("ix_product_emb_tenant_sku").on(table.tenantId, table.productSku),
    // Unique constraint for upsert by content hash
    uniqueIndex("ix_product_emb_tenant_hash").on(
      table.tenantId,
      table.contentHash
    ),
  ]
);

/**
 * Keyword embeddings table.
 *
 * Stores embeddings for keywords to enable semantic matching.
 * Keywords are globally unique (not per-tenant) for cross-tenant cache sharing.
 */
export const keywordEmbeddings = pgTable(
  "keyword_embeddings",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** Original keyword text */
    keyword: text("keyword").notNull().unique(),
    /** Normalized keyword (lowercased, diacritics removed) for matching */
    normalizedKeyword: text("normalized_keyword").notNull(),
    /** Embedding vector - halfvec(384) for storage efficiency */
    embedding: halfvec384("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Fast lookup by keyword
    index("ix_keyword_emb_keyword").on(table.keyword),
    // Search by normalized form
    index("ix_keyword_emb_normalized").on(table.normalizedKeyword),
  ]
);

/**
 * DiskANN index creation SQL.
 *
 * DiskANN (via pgvectorscale) provides:
 * - Disk-resident index for 100M+ vectors on 32GB RAM
 * - Sub-50ms p99 latency with memory_optimized layout
 * - StreamingDiskANN with Statistical Binary Quantization (SBQ)
 *
 * Run this SQL after migrations to create vector indexes.
 * Note: Index creation is expensive - schedule during low-traffic periods.
 */
export const DISKANN_INDEX_SQL = `
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;

-- DiskANN index for product embeddings (per-tenant search)
-- memory_optimized layout keeps quantized vectors in RAM
CREATE INDEX IF NOT EXISTS ix_product_emb_diskann
  ON product_embeddings
  USING diskann (embedding halfvec_cosine_ops)
  WITH (storage_layout = 'memory_optimized');

-- DiskANN index for keyword embeddings (global search)
CREATE INDEX IF NOT EXISTS ix_keyword_emb_diskann
  ON keyword_embeddings
  USING diskann (embedding halfvec_cosine_ops)
  WITH (storage_layout = 'memory_optimized');
`;

/**
 * Vector search query helpers.
 *
 * These use diskann.query_rescore = 50 for better recall on filtered queries.
 * The rescore setting re-ranks top 50 candidates using full precision.
 */
export const vectorQueries = {
  /**
   * Find similar products within a tenant.
   *
   * @param tenantId - Tenant ID for isolation
   * @param queryVector - 384-dim query embedding
   * @param limit - Max results to return
   * @returns SQL query for similar products
   */
  findSimilarProducts(
    tenantId: string,
    queryVector: number[],
    limit: number = 10
  ) {
    // Note: Caller must execute this with proper parameterization
    // Using raw SQL for diskann settings
    return sql`
      SET LOCAL diskann.query_rescore = 50;
      SELECT
        id,
        product_sku,
        product_url,
        product_name,
        1 - (embedding <=> ${sql.raw(`'[${queryVector.join(",")}]'::halfvec`)}) AS similarity
      FROM product_embeddings
      WHERE tenant_id = ${tenantId}
      ORDER BY embedding <=> ${sql.raw(`'[${queryVector.join(",")}]'::halfvec`)}
      LIMIT ${limit};
    `;
  },

  /**
   * Find similar keywords globally.
   *
   * @param queryVector - 384-dim query embedding
   * @param limit - Max results to return
   * @returns SQL query for similar keywords
   */
  findSimilarKeywords(queryVector: number[], limit: number = 10) {
    return sql`
      SET LOCAL diskann.query_rescore = 50;
      SELECT
        id,
        keyword,
        normalized_keyword,
        1 - (embedding <=> ${sql.raw(`'[${queryVector.join(",")}]'::halfvec`)}) AS similarity
      FROM keyword_embeddings
      ORDER BY embedding <=> ${sql.raw(`'[${queryVector.join(",")}]'::halfvec`)}
      LIMIT ${limit};
    `;
  },
};

/**
 * Inferred types for database operations.
 */
export type ProductEmbeddingSelect = typeof productEmbeddings.$inferSelect;
export type ProductEmbeddingInsert = typeof productEmbeddings.$inferInsert;
export type KeywordEmbeddingSelect = typeof keywordEmbeddings.$inferSelect;
export type KeywordEmbeddingInsert = typeof keywordEmbeddings.$inferInsert;
