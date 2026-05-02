# Phase 65: GraphRAG Foundation - Context

**Gathered:** 2026-05-02
**Status:** Ready for execution
**Mode:** Auto-generated from infrastructure research

<domain>
## Phase Boundary

Implement LightRAG + FalkorDB for per-tenant knowledge graphs enabling intelligent retrieval across prospects, keywords, and content. Must work on $50/mo VPS (CPU-only, no GPU).

**Core Capabilities:**
- FalkorDB for per-tenant graph storage with Cypher queries
- LightRAG as lightweight RAG orchestration layer
- jina-embeddings-v3 for Lithuanian-optimized embeddings
- pgvector + pgvectorscale for vector storage with DiskANN indexes
- Hybrid retrieval: vector similarity + graph traversal

**Key Constraint:** Must run on CPU-only VPS, no GPU dependency.

</domain>

<decisions>
## Implementation Decisions

### Graph Database
- FalkorDB (RedisGraph successor) for graph storage
- Per-tenant isolation via workspaceId property on all nodes
- Cypher query language for traversals

### Embeddings
- jina-embeddings-v3 for Lithuanian language support (Cohen's κ 0.62)
- Batch embedding generation with caching
- pgvector for storage, pgvectorscale for DiskANN indexes

### Retrieval Strategy
- **Vector-only:** Pure semantic similarity
- **Graph-only:** Relationship traversal
- **Hybrid:** Vector candidates → graph expansion → reranking (preferred)

### Performance Targets
- Latency: <500ms p95
- Memory: Fits in 4GB RAM
- Concurrent queries: 10+ simultaneous

</decisions>

<references>
## Reference Documents

- `docs/infra-research/cpu-only-rag-graph.md` — Full GraphRAG spec for $50/mo VPS
- `56-AUDIT-SHARED-CACHE.md` — Current caching gaps

</references>

<success_criteria>
## Success Criteria

1. Per-tenant knowledge graphs created on workspace init
2. Embeddings generated via jina-embeddings-v3
3. GraphRAG retrieval returns relevant context
4. Hybrid retrieval outperforms vector-only by 20%+
5. Works on $50/mo VPS (CPU-only, no GPU)
6. Retrieval latency <500ms p95

</success_criteria>
