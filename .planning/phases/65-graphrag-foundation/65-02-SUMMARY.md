---
phase: 65-graphrag-foundation
plan: 02
subsystem: graphrag
tags: [embeddings, lightrag, postgresql, vector-search]
dependency_graph:
  requires: []
  provides:
    - GRAPHRAG_EMBEDDING_DIM (768)
    - halfvec768 Drizzle type
    - graphragChunks table schema
    - JinaEmbeddingService Python class
    - LightRAG PostgreSQL configuration
  affects:
    - open-seo-main embedding pipeline
    - AI-Writer GraphRAG integration
tech_stack:
  added:
    - lightrag-hku (LightRAG orchestration)
    - httpx (async HTTP for Jina API)
  patterns:
    - halfvec(768) for storage-efficient embeddings
    - Per-tenant workspace isolation via POSTGRES_WORKSPACE
    - DiskANN indexes with memory_optimized layout
key_files:
  created:
    - open-seo-main/src/db/graphrag-schema.ts
    - AI-Writer/backend/lib/graphrag/__init__.py
    - AI-Writer/backend/lib/graphrag/embedding_service.py
    - AI-Writer/backend/lib/graphrag/lightrag_config.py
    - AI-Writer/backend/lib/__init__.py
  modified:
    - open-seo-main/src/server/lib/embeddings/embedding-config.ts
    - open-seo-main/src/server/lib/embeddings/embedding-service.ts
decisions:
  - Upgraded storageDim from 384 to 768 for better Lithuanian quality
  - Cache key prefix bumped to v2 to invalidate old 384-dim cache
  - LightRAG configured with PostgreSQL storage backends (PGGraphStorage, PGVectorStorage, PGKVStorage)
  - Per-tenant isolation via workspace parameter and POSTGRES_WORKSPACE env var
metrics:
  duration: 245s
  completed: 2026-05-03T10:17:06Z
  tasks_completed: 3
  files_created: 5
  files_modified: 2
---

# Phase 65 Plan 02: LightRAG + 768-dim Embeddings Summary

LightRAG PostgreSQL storage integration with 768-dim Jina embeddings for optimal Lithuanian GraphRAG quality.

## What Was Built

### 1. Embedding Config Upgrade (Task 1)

Upgraded the embedding pipeline from 384-dim to 768-dim:

- `EMBEDDING_CONFIG.storageDim` changed from 384 to 768
- Cache key prefix bumped from `emb:v1:` to `emb:v2:` to invalidate old cache
- Added `GRAPHRAG_EMBEDDING_DIM = 768` export for schema use
- Updated JSDoc references to Phase 65

### 2. GraphRAG PostgreSQL Schema (Task 2)

Created dedicated schema for GraphRAG chunk storage:

- `halfvec768` custom Drizzle type for 768-dim half-precision vectors
- `graphrag_chunks` table with tenant/workspace isolation
- Unique constraint on (tenant_id, doc_id, chunk_index) for incremental updates
- DiskANN index SQL with `memory_optimized` layout and `num_neighbors=50`
- PostgreSQL configuration hints for index builds and filtered queries

### 3. LightRAG Python Configuration (Task 3)

Created Python module for LightRAG integration:

- `JinaEmbeddingService` class with 768-dim embeddings and in-memory caching
- `configure_lightrag_postgres()` for per-tenant PostgreSQL storage setup
- `get_tenant_rag()` for cached LightRAG instance retrieval
- SEO/e-commerce entity types: keyword, page, product, category, brand, attribute, topic
- Module-level convenience functions: `embed_passages()`, `embed_query()`, `query_lightrag()`

## Key Integration Points

| From | To | Via | Pattern |
|------|-----|-----|---------|
| lightrag_config.py | embedding_service.py | embedding_func parameter | `embedding_func=jina_embed_func` |
| graphrag-schema.ts | embedding-schema.ts | extends halfvec pattern | `halfvec768` (768 dims vs 384) |
| LightRAG | PostgreSQL | Environment variables | `POSTGRES_WORKSPACE={tenant_id}` |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 9af07d29d | feat | Upgrade embedding config to 768 dimensions |
| b30fb538e | feat | Create GraphRAG PostgreSQL schema |
| 47d6324ad | feat | Create LightRAG Python configuration |

## Deviations from Plan

None - plan executed exactly as written.

## Dependencies for Runtime

The Python modules require these packages (not installed in this plan):

```bash
pip install lightrag-hku==1.4.15 httpx
```

The PostgreSQL extensions are required:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;
```

## Next Steps

- Plan 65-03: FalkorDB graph client integration
- Plan 65-04: Hybrid retrieval pipeline (vector + graph with RRF fusion)

## Self-Check: PASSED

- [x] open-seo-main/src/db/graphrag-schema.ts exists
- [x] AI-Writer/backend/lib/graphrag/__init__.py exists
- [x] AI-Writer/backend/lib/graphrag/embedding_service.py exists
- [x] AI-Writer/backend/lib/graphrag/lightrag_config.py exists
- [x] Commit 9af07d29d exists
- [x] Commit b30fb538e exists
- [x] Commit 47d6324ad exists
