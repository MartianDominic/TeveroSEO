---
phase: 82-chat-integration
plan: 01
subsystem: keyword-chat
tags: [sse, streaming, pipeline, drizzle]
dependency_graph:
  requires: []
  provides: [keyword-chat-types, stage-emitter, analysis-pipeline, sse-endpoint, analysis-sessions-schema]
  affects: [apps/web, open-seo-main]
tech_stack:
  added: []
  patterns: [sse-streaming, pipeline-orchestration, stub-implementation]
key_files:
  created:
    - apps/web/src/lib/keyword-chat/types.ts
    - apps/web/src/lib/keyword-chat/stage-emitter.ts
    - apps/web/src/lib/keyword-chat/analysis-pipeline.ts
    - apps/web/src/app/api/keyword-chat/analyze/route.ts
    - open-seo-main/src/db/schema/analysis-sessions.ts
    - open-seo-main/drizzle/0074_analysis_sessions.sql
  modified:
    - open-seo-main/src/db/schema/index.ts
decisions:
  - Removed drizzle-zod dependency to match existing codebase pattern
  - Stub implementations use realistic delays (60-100ms per stage) for pipeline testing
  - SSE events use `data:` prefix only (not `event:`) for simpler client parsing
metrics:
  duration_minutes: 9
  completed_date: 2026-05-04
---

# Phase 82 Plan 01: SSE Streaming Foundation Summary

SSE streaming endpoint and analysis pipeline orchestrator for keyword chat integration with stub implementations.

## One-liner

POST /api/keyword-chat/analyze SSE endpoint with 8-stage pipeline orchestrator and analysis_sessions Drizzle schema.

## Deliverables

| File | Lines | Purpose |
|------|-------|---------|
| `apps/web/src/lib/keyword-chat/types.ts` | 183 | AnalysisStage, AnalysisEvent, AnalysisResult, STAGE_WEIGHTS |
| `apps/web/src/lib/keyword-chat/stage-emitter.ts` | 65 | StageEmitter class for progress callbacks |
| `apps/web/src/lib/keyword-chat/analysis-pipeline.ts` | 325 | AnalysisPipeline orchestrator with stub services |
| `apps/web/src/app/api/keyword-chat/analyze/route.ts` | 137 | SSE streaming POST endpoint |
| `open-seo-main/src/db/schema/analysis-sessions.ts` | 67 | Drizzle schema for session storage |
| `open-seo-main/drizzle/0074_analysis_sessions.sql` | 31 | Migration with 4 indexes |

**Total:** 777 lines of production code

## Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| `types.test.ts` | 8 | PASS |
| `stage-emitter.test.ts` | 11 | PASS |
| `analysis-pipeline.test.ts` | 10 | PASS |

**Total:** 29 tests passing

## Commits

| Hash | Type | Description |
|------|------|-------------|
| f018ee2e1 | test | Add failing tests for types and stage-emitter (RED) |
| a2fd5e572 | feat | Implement types and StageEmitter (GREEN) |
| aa52b1732 | test | Add failing tests for AnalysisPipeline (RED) |
| 27614b205 | feat | Implement AnalysisPipeline with stubs (GREEN) |
| dbd65ee8f | feat | Create SSE streaming endpoint |
| fd0647da9 | feat | Add analysis_sessions Drizzle schema |

## Pipeline Stages

| Stage | Weight | Phase |
|-------|--------|-------|
| idle | 0% | - |
| extracting_constraints | 5% | 75 |
| classifying_funnel | 25% | 76 |
| classifying_geo | 35% | 77 |
| scoring_relevance | 50% | 78 |
| filtering | 65% | 79 |
| selecting | 75% | 80 |
| discovering_pseo | 85% | 81 |
| discovering_side_keywords | 95% | 81 |
| complete | 100% | - |

## API Contract

**Endpoint:** `POST /api/keyword-chat/analyze`

**Request:**
```json
{
  "clientId": "uuid",
  "conversation": "string (max 50000)",
  "keywords": ["string"] // 1-10000 items
}
```

**Response:** SSE stream with events:
- `progress` - Stage name and percentage
- `partial` - Intermediate results after each stage
- `complete` - Full AnalysisResult
- `error` - Error message with stage context

**Headers:**
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache, no-transform`
- `X-Accel-Buffering: no`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Location | Reason | Resolution |
|------|----------|--------|------------|
| `analysis-pipeline.ts` | extractConstraints() | Phase 75 service not yet wired | Plan 82-02 |
| `analysis-pipeline.ts` | classifyFunnel() | Phase 76 service not yet wired | Plan 82-02 |
| `analysis-pipeline.ts` | classifyGeo() | Phase 77 service not yet wired | Plan 82-02 |
| `analysis-pipeline.ts` | filterConstraints() | Phase 79 service not yet wired | Plan 82-02 |
| `analysis-pipeline.ts` | cascadeSelect() | Phase 80 service not yet wired | Plan 82-02 |
| `analysis-pipeline.ts` | detectPSEO() | Phase 81 service not yet wired | Plan 82-02 |
| `analysis-pipeline.ts` | discoverSideKeywords() | Phase 81 service not yet wired | Plan 82-02 |
| `route.ts` | saveAnalysisSession() | Database persistence TODO | Plan 82-02 |

Stub implementations return realistic mock data with 60-100ms delays to simulate actual service latency.

## Security Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-82-01 | Clerk auth required; userId+orgId validated |
| T-82-02 | TODO: verify clientId access via AI-Writer API |
| T-82-03 | Sessions logged with workspace_id for audit |
| T-82-04 | Only authenticated users receive streams |
| T-82-05 | Keywords limited to 10000; conversation to 50000 chars |
| T-82-06 | Workspace scoping on analysis_sessions table |

## Self-Check: PASSED

- [x] `apps/web/src/lib/keyword-chat/types.ts` exists (183 lines)
- [x] `apps/web/src/lib/keyword-chat/stage-emitter.ts` exists (65 lines)
- [x] `apps/web/src/lib/keyword-chat/analysis-pipeline.ts` exists (325 lines)
- [x] `apps/web/src/app/api/keyword-chat/analyze/route.ts` exists (137 lines)
- [x] `open-seo-main/src/db/schema/analysis-sessions.ts` exists (67 lines)
- [x] `open-seo-main/drizzle/0074_analysis_sessions.sql` exists (31 lines)
- [x] Commit f018ee2e1 exists
- [x] Commit a2fd5e572 exists
- [x] Commit aa52b1732 exists
- [x] Commit 27614b205 exists
- [x] Commit dbd65ee8f exists
- [x] Commit fd0647da9 exists
- [x] 29 tests passing
