/**
 * PostgreSQL schema for GraphRAG chunk storage.
 *
 * Phase 65: GraphRAG Foundation
 *
 * Uses halfvec(768) with DiskANN indexes per RESEARCH.md Pattern 4.
 * Separate from product/keyword embeddings (embedding-schema.ts) to allow
 * independent scaling and different index configurations.
 *
 * Reference:
 * - .planning/phases/65-graphrag-foundation/65-RESEARCH.md
 * - docs/infra-research/cpu-only-rag-graph.md
 */

import {
  pgTable,
  text,
  bigint,
  timestamp,
  index,
  uniqueIndex,
  customType,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Custom Drizzle type for PostgreSQL halfvec(768).
 *
 * halfvec uses 16-bit floats (half precision) for 50% storage reduction
 * with near-zero recall loss on normalized embeddings.
 *
 * Storage: 768 dims * 2 bytes = 1536 bytes per vector
 * (vs 3072 bytes for float32 vector(768))
 *
 * Phase 65: Upgraded from halfvec(384) for better Lithuanian quality.
 */
export const halfvec768 = customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return "halfvec(768)";
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
 * GraphRAG chunks table.
 *
 * Stores document chunks with embeddings for GraphRAG retrieval.
 * Per-tenant isolation via tenantId and workspaceId columns.
 *
 * Chunks are deduplicated by (tenantId, docId, chunkIndex) to support
 * incremental document updates without re-embedding unchanged chunks.
 */
export const graphragChunks = pgTable(
  "graphrag_chunks",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),

    /** Tenant ID for data isolation */
    tenantId: text("tenant_id").notNull(),

    /** Workspace ID within tenant (maps to LightRAG workspace) */
    workspaceId: text("workspace_id").notNull(),

    /** Source document ID (URL, file path, or external reference) */
    docId: text("doc_id").notNull(),

    /** Chunk index within document (0-based) */
    chunkIndex: bigint("chunk_index", { mode: "number" }).notNull(),

    /** Chunk text content */
    content: text("content").notNull(),

    /** Embedding vector - halfvec(768) for storage efficiency */
    embedding: halfvec768("embedding").notNull(),

    /** Additional metadata (source type, timestamps, entity types, etc.) */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    /** Creation timestamp */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Tenant isolation - ALWAYS filter by tenant_id first
    index("idx_graphrag_chunks_tenant").on(table.tenantId),

    // Workspace filtering within tenant
    index("idx_graphrag_chunks_workspace").on(table.workspaceId),

    // Document lookup for incremental updates
    index("idx_graphrag_chunks_doc").on(table.docId),

    // Unique constraint for upsert by document chunk
    uniqueIndex("idx_graphrag_chunks_unique").on(
      table.tenantId,
      table.docId,
      table.chunkIndex
    ),
  ]
);

/**
 * DiskANN index creation SQL.
 *
 * Run this SQL after migrations to create vector indexes.
 * DiskANN (via pgvectorscale) provides:
 * - Disk-resident index for 100M+ vectors on 32GB RAM
 * - Sub-50ms p99 latency with memory_optimized layout
 * - StreamingDiskANN with Statistical Binary Quantization (SBQ)
 *
 * The tenant_id label enables filtered vector search with iterative scan.
 *
 * Note: Index creation is expensive - schedule during low-traffic periods.
 */
export const GRAPHRAG_DISKANN_INDEX_SQL = `
-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;

-- DiskANN index for GraphRAG chunks (per-tenant filtered search)
-- memory_optimized layout keeps quantized vectors in RAM
-- num_neighbors=50 for better recall on multi-hop graph queries
CREATE INDEX IF NOT EXISTS idx_graphrag_chunks_diskann
  ON graphrag_chunks
  USING diskann (embedding halfvec_cosine_ops, tenant_id)
  WITH (storage_layout = 'memory_optimized', num_neighbors = 50);
`;

/**
 * PostgreSQL configuration hints for GraphRAG workloads.
 *
 * Apply these settings during index builds or filtered queries.
 * Not applied automatically - use as reference for DB tuning.
 */
export const GRAPHRAG_PG_HINTS = {
  /** Set during DiskANN index builds to prevent OOM */
  indexBuild: `SET maintenance_work_mem = '6GB';`,

  /** Enable iterative scan for filtered vector queries */
  filteredSearch: `
    SET hnsw.iterative_scan = relaxed_order;
    SET hnsw.max_scan_tuples = 20000;
  `,

  /** Rescore setting for better recall on filtered queries */
  rescore: `SET diskann.query_rescore = 50;`,
};

/**
 * Inferred types for database operations.
 */
export type GraphRAGChunkSelect = typeof graphragChunks.$inferSelect;
export type GraphRAGChunkInsert = typeof graphragChunks.$inferInsert;
