/**
 * LightRAG Module
 *
 * Provides GraphRAG-powered entity extraction with per-tenant isolation.
 *
 * Per ADR-001: LightRAG uses NetworkX + NanoVectorDB for entity graphs,
 * with working directory pattern: ./data/lightrag/{tenant_id}
 *
 * Per ADR-002: All embeddings use jina-v3 @ 384-dim for consistency
 * across LightRAG, FalkorDB vector indexes, and pgvector storage.
 */

export * from "./entity-types";
export * from "./lightrag-service";
export * from "./extraction-pipeline";
