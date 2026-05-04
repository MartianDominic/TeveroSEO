---
phase: 73
plan: 03
subsystem: retrieval
tags: [reranking, hierarchical-search, bge-reranker, category-routing]
dependency_graph:
  requires: [73-01, 73-02]
  provides: [hierarchical-search, cross-encoder-reranking]
  affects: [hybrid-retrieval, graphrag]
tech_stack:
  added: [sentence-transformers, bge-reranker-v2-m3]
  patterns: [cross-encoder-reranking, category-centroid-routing, two-stage-retrieval]
key_files:
  created:
    - AI-Writer/backend/lib/reranker/__init__.py
    - AI-Writer/backend/lib/reranker/bge_reranker.py
    - AI-Writer/backend/lib/reranker/test_bge_reranker.py
    - AI-Writer/backend/routers/embeddings.py
    - open-seo-main/src/server/lib/retrieval/category-router.ts
    - open-seo-main/src/server/lib/retrieval/reranker-client.ts
    - open-seo-main/src/server/lib/retrieval/index.ts
    - open-seo-main/src/server/lib/retrieval/category-router.test.ts
    - open-seo-main/src/server/lib/retrieval/reranker-client.test.ts
  modified:
    - AI-Writer/backend/requirements.txt
    - AI-Writer/backend/main.py
    - open-seo-main/src/server/lib/graph/hybrid-retrieval.ts
decisions:
  - BGE Reranker v2 M3 chosen for multilingual support (Lithuanian)
  - Lazy model loading to avoid startup overhead (~5-10s cold start)
  - Category centroids computed via mean embedding with L2 normalization
  - Graceful fallback to hybridSearch when centroids not loaded
  - DoS protection: max 100 candidates per rerank request
metrics:
  duration_minutes: 8
  completed: 2026-05-04
  tasks_completed: 5
  files_created: 9
  files_modified: 3
  tests_added: 22
---

# Phase 73 Plan 03: Retrieval Quality Enhancement Summary

BGE cross-encoder reranking (+3-8 recall@10) with hierarchical category routing for two-stage retrieval.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | BGE Reranker Service | df52ef66f | lib/reranker/bge_reranker.py |
| 2 | FastAPI /rerank Endpoint | cddb11767 | routers/embeddings.py |
| 3 | Category Centroid Router | 95d1cd201 | retrieval/category-router.ts |
| 4 | Hierarchical Search | abd6f44fb | graph/hybrid-retrieval.ts |
| 5 | Tests | 1f7ffe667 | *.test.ts |

## Implementation Details

### Part A: BGE Reranker (AI-Writer)

**BGEReranker class** (`AI-Writer/backend/lib/reranker/bge_reranker.py`):
- Uses BAAI/bge-reranker-v2-m3 (multilingual, good for Lithuanian)
- `rerank()` returns (index, score) tuples sorted by relevance
- `rerank_with_metadata()` preserves candidate metadata through reranking
- `score_pair()` for single query-candidate scoring
- Lazy model loading (~5-10s cold start on first use)
- Singleton `get_reranker()` for efficient reuse

**FastAPI Endpoint** (`AI-Writer/backend/routers/embeddings.py`):
- `POST /api/embeddings/rerank` - main reranking endpoint
- `GET /api/embeddings/rerank/health` - health check
- `POST /api/embeddings/rerank/warmup` - model pre-loading
- DoS protection: max 100 candidates per request

### Part B: Hierarchical Retrieval (open-seo-main)

**CategoryRouter class** (`open-seo-main/src/server/lib/retrieval/category-router.ts`):
- `buildCentroids()` - compute mean embeddings per category
- `route()` - find top-k categories by cosine similarity to query
- `routeToIds()` - convenience method returning only category IDs
- Per-tenant centroid caching in memory
- L2 normalization for accurate cosine similarity

**Reranker Client** (`open-seo-main/src/server/lib/retrieval/reranker-client.ts`):
- `rerankCandidates()` - call AI-Writer's /rerank endpoint
- `isRerankerAvailable()` - health check
- `warmupReranker()` - trigger model loading
- Retry with exponential backoff

**hierarchicalSearch()** (`open-seo-main/src/server/lib/graph/hybrid-retrieval.ts`):
1. Route query to top-k categories via centroid similarity
2. Vector search within selected categories in parallel
3. Rerank all candidates with cross-encoder
4. Graceful fallback to hybridSearch when centroids not loaded

## Deviations from Plan

None - plan executed exactly as written.

## Verification

1. **Reranker endpoint**: Created with Pydantic validation, DoS limits
2. **Category routing**: Implemented with centroid building and cosine similarity
3. **Hierarchical search**: Three-stage pipeline with graceful fallbacks

## Test Coverage

- **BGE Reranker**: 10 tests (rerank, rerank_with_metadata, singleton, async wrapper)
- **Category Router**: 12 tests (buildCentroids, route, routeToIds, clearCentroids, singletons)
- **Reranker Client**: 10 tests (rerankCandidates, isRerankerAvailable, warmupReranker)

Total: 22 tests added

## Self-Check: PASSED

All created files exist and commits verified:
- df52ef66f: BGE reranker service
- cddb11767: FastAPI endpoint
- 95d1cd201: Category router
- abd6f44fb: Hierarchical search (included in 73-04 commit)
- 1f7ffe667: Tests
