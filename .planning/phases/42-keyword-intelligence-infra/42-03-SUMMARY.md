---
phase: 42-keyword-intelligence-infra
plan: 03
subsystem: embeddings
tags: [jina-v3, pgvector, diskann, matryoshka, redis-cache]
dependency_graph:
  requires: [42-01]
  provides: [embedding-service, pgvector-schema, diskann-index]
  affects: [42-04, keyword-matching, product-search]
tech_stack:
  added: [jina-embeddings-v3, pgvector, pgvectorscale, halfvec]
  patterns: [matryoshka-truncation, redis-cache, retry-backoff, singleton]
key_files:
  created:
    - open-seo-main/src/server/lib/embeddings/embedding-config.ts
    - open-seo-main/src/server/lib/embeddings/embedding-service.ts
    - open-seo-main/src/server/lib/embeddings/embedding-service.test.ts
    - open-seo-main/src/server/lib/embeddings/index.ts
    - open-seo-main/src/db/embedding-schema.ts
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - "jina-embeddings-v3 as primary model (best Lithuanian quality per ADR-002)"
  - "Matryoshka truncation 1024->384 dims for storage efficiency"
  - "halfvec(384) type for 50% storage reduction"
  - "DiskANN with memory_optimized layout for 100M+ scale"
  - "30-day cache TTL for embedding reuse"
  - "query_rescore=50 for better recall on filtered queries"
metrics:
  duration: "9 minutes"
  completed: "2026-04-26"
  tasks_completed: 3
  tests_added: 12
  files_created: 5
  files_modified: 1
---

# Phase 42 Plan 03: Unified Embedding Service Summary

Unified embedding service using jina-embeddings-v3 with Matryoshka truncation to 384-dim, PostgreSQL schema with pgvector + DiskANN, and Redis caching.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 40b7bc5 | feat | Add embedding configuration with jina-v3 @ 384-dim |
| 30a5dd7 | test | Add failing tests for embedding service (TDD RED) |
| acbe69c | feat | Implement embedding service with Jina API integration (TDD GREEN) |
| 0554054 | feat | Add PostgreSQL schema with pgvector + DiskANN |

## Tasks Completed

### Task 1: Embedding Configuration
- Created `EMBEDDING_CONFIG` with jina-embeddings-v3 as primary model
- Defined Matryoshka truncation settings (1024 native -> 384 storage)
- Added query/passage prefixes per e5/jina model requirements
- Configured cache settings (30-day TTL, Redis key prefix)
- Defined TypeScript types: `EmbeddingModel`, `EmbeddingInput`, `EmbeddingOutput`

### Task 2: Embedding Service with Jina API (TDD)
- **RED**: 12 failing tests covering all behaviors
- **GREEN**: Implementation passing all tests
- `EmbeddingService` class with Jina API integration
- `embedPassages()` for batch embedding with passage prefix
- `embedQuery()` for single query embedding
- Matryoshka truncation from 1024 to 384 dimensions
- Redis caching with 30-day TTL
- Batch processing (32 texts per API call)
- Retry logic with exponential backoff (3 retries)
- Singleton pattern via `getEmbeddingService()`

### Task 3: PostgreSQL Schema with pgvector + DiskANN
- Custom `halfvec384` Drizzle type for 16-bit float vectors
- `productEmbeddings` table with tenant isolation
- `keywordEmbeddings` table for semantic keyword matching
- `DISKANN_INDEX_SQL` for 100M+ vector scale
- `vectorQueries` helpers with `query_rescore=50`
- `memory_optimized` storage layout for quantized vectors in RAM

## Key Implementation Details

### Embedding Configuration
```typescript
export const EMBEDDING_CONFIG = {
  model: "jina-embeddings-v3" as const,
  modelFallback: "multilingual-e5-base" as const,
  nativeDim: 1024,
  storageDim: 384,
  queryPrefix: "query: ",
  passagePrefix: "passage: ",
  batchSize: 32,
  maxRetries: 3,
  cacheTtlSeconds: 30 * 24 * 60 * 60, // 30 days
}
```

### PostgreSQL Schema
```typescript
// Custom halfvec(384) type for storage efficiency
export const halfvec384 = customType<{
  data: number[];
  driverData: string;
}>({ dataType: () => "halfvec(384)", ... });

// Product embeddings with tenant isolation
export const productEmbeddings = pgTable("product_embeddings", {
  tenantId: text("tenant_id").notNull(),
  embedding: halfvec384("embedding").notNull(),
  ...
});
```

### DiskANN Index
```sql
CREATE INDEX ix_product_emb_diskann
  ON product_embeddings
  USING diskann (embedding halfvec_cosine_ops)
  WITH (storage_layout = 'memory_optimized');
```

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED gate: 30a5dd7 (test commit)
- GREEN gate: acbe69c (feat commit)
- REFACTOR gate: N/A (no refactoring needed)

## Success Criteria Verification

- [x] Embedding configuration with jina-v3 @ 384-dim
- [x] Embedding service with Jina API integration
- [x] Matryoshka truncation to 384-dim working
- [x] Redis caching for embeddings (30-day TTL)
- [x] Retry logic with exponential backoff
- [x] PostgreSQL schema with halfvec(384) type
- [x] DiskANN index SQL for 100M+ vector scale
- [x] Vector search query helpers
- [x] All tests passing (12/12)

## Self-Check: PASSED

- [x] embedding-config.ts exists
- [x] embedding-service.ts exists
- [x] embedding-service.test.ts exists
- [x] embedding-schema.ts exists
- [x] All commits verified in git log
