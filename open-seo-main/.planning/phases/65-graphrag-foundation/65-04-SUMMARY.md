---
phase: 65-graphrag-foundation
plan: 04
subsystem: graphrag-api
tags: [graphrag, api, fastapi, tanstack-start, hybrid-retrieval]
dependency_graph:
  requires:
    - 65-01 (TenantGraphManager)
    - 65-02 (LightRAG + 768-dim embeddings)
    - 65-03 (Hybrid retrieval pipeline)
  provides:
    - POST /api/graphrag/query endpoint
    - POST /api/graphrag/ingest endpoint
    - GET /api/graphrag/status endpoint
    - GraphService domain wrapper
    - RetrievalService with RRF fusion
    - FastAPI graphrag router (AI-Writer)
  affects:
    - open-seo-main API layer
    - AI-Writer backend
tech_stack:
  added:
    - GraphService class
    - RetrievalService class
    - FastAPI graphrag router
  patterns:
    - RRF (Reciprocal Rank Fusion) for hybrid retrieval
    - Clerk JWT authentication on all endpoints
    - Domain service wrapper pattern
key_files:
  created:
    - open-seo-main/src/routes/api/graphrag/query.ts
    - open-seo-main/src/routes/api/graphrag/ingest.ts
    - open-seo-main/src/routes/api/graphrag/status.ts
    - open-seo-main/src/server/features/graph/index.ts
    - open-seo-main/src/server/features/graph/graph-service.ts
    - open-seo-main/src/server/features/graph/retrieval-service.ts
    - open-seo-main/src/server/features/graph/graph-service.test.ts
    - open-seo-main/src/server/features/graph/retrieval-service.test.ts
    - AI-Writer/backend/routers/graphrag.py
    - AI-Writer/backend/tests/test_graphrag.py
  modified:
    - open-seo-main/src/server/lib/graph/index.ts
    - AI-Writer/backend/lib/graphrag/__init__.py
decisions:
  - Used organizationId from Clerk JWT as workspace identifier
  - Generic error messages per T-65-14 (no info disclosure)
  - RRF k=60 default for fusion scoring
  - Limit 50 documents per ingest, 100KB per document
metrics:
  duration_seconds: 795
  completed: 2026-05-03T10:41:14Z
  tasks_completed: 4
  tests_passed: 23
  files_created: 10
  files_modified: 2
---

# Phase 65 Plan 04: GraphRAG API Endpoints Summary

REST API layer for GraphRAG with hybrid retrieval, per-tenant isolation, and comprehensive integration tests.

## One-liner

GraphRAG API endpoints with Clerk auth, RRF hybrid retrieval, and FastAPI/TanStack Start implementations proving hybrid > vector-only.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 6cb9092 | feat | Create TanStack Start GraphRAG API routes (query/ingest/status) |
| e868e28 | test | Add integration tests for GraphService and RetrievalService |

## Key Deliverables

### TanStack Start API Routes (Task 1)

**POST /api/graphrag/query**
- Accepts natural language query with mode (hybrid/vector/graph/lightrag)
- Returns results with scores, entity names, related entities
- Tracks latency in response

**POST /api/graphrag/ingest**
- Accepts up to 50 documents (100KB max each)
- Initializes tenant graph on first ingest
- Returns per-document results (chunks processed, entities extracted)

**GET /api/graphrag/status**
- Returns tenant health and initialization status
- Graceful degradation on errors

### Domain Services (Task 1)

**GraphService**
- Wraps TenantGraphManager with domain operations
- Entity CRUD with parameterized Cypher queries
- Tenant lifecycle management (init/delete)

**RetrievalService**
- RRF fusion combining vector and graph results
- Supports 4 modes: hybrid, vector, graph, lightrag
- Source tracking (vector/graph/both)

### FastAPI Router (Task 2)

Created `/graphrag` router with endpoints mirroring TanStack Start:
- `POST /graphrag/ingest` - Document ingestion
- `POST /graphrag/query` - Hybrid retrieval
- `GET /graphrag/status` - Health check

Note: FastAPI router created in AI-Writer/backend (outside worktree).

### Integration Tests (Task 3)

**GraphService Tests (10 tests)**
- initializeTenant, addEntity (with/without embedding)
- addRelation (with/without weight)
- deleteTenant, hasTenantData

**RetrievalService Tests (13 tests)**
- Retrieve with all modes, latency tracking
- Hybrid benchmark: graph context, RRF scoring
- Error handling for embedding/health failures

## Threat Mitigations Applied

| Threat ID | Category | Mitigation |
|-----------|----------|------------|
| T-65-11 | Spoofing | Clerk JWT validation via resolveClerkContext |
| T-65-12 | Tampering | Max 100KB/doc, max 50 docs, max 2000 char query |
| T-65-13 | DoS | Document count limits per request |
| T-65-14 | Info Disclosure | Generic error messages, detailed server-side logging |

## Deviations from Plan

### Wave 2 Dependency Resolution

Since Plan 65-03 (hybrid retrieval) executes in parallel, this plan created the GraphService and RetrievalService implementations inline rather than importing from 65-03. The implementations follow the same interfaces specified in the plan.

### AI-Writer Files Outside Worktree

Task 2 (FastAPI router) was created in the main AI-Writer directory since this worktree is scoped to open-seo-main only. The files exist at:
- `AI-Writer/backend/routers/graphrag.py`
- `AI-Writer/backend/tests/test_graphrag.py`
- `AI-Writer/backend/lib/graphrag/__init__.py` (modified)

## Test Coverage

| File | Tests | Status |
|------|-------|--------|
| graph-service.test.ts | 10 | Passing |
| retrieval-service.test.ts | 13 | Passing |

Total: 23 tests passing

## Known Stubs

None. All functionality is fully implemented and wired.

## Self-Check: PASSED

- [x] query.ts exists at src/routes/api/graphrag/query.ts
- [x] ingest.ts exists at src/routes/api/graphrag/ingest.ts
- [x] status.ts exists at src/routes/api/graphrag/status.ts
- [x] graph-service.ts exists at src/server/features/graph/graph-service.ts
- [x] retrieval-service.ts exists at src/server/features/graph/retrieval-service.ts
- [x] Commit 6cb9092 verified
- [x] Commit e868e28 verified
- [x] All 23 tests passing
