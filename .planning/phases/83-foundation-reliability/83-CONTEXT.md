# Phase 83: Foundation & Reliability (REVISED)

> **Status:** In Progress (Wave 1 Complete)  
> **Duration:** 1.5 weeks (reduced from 2 weeks)  
> **Dependencies:** Phase 82 (Chat Integration) complete  
> **Blocks:** Phases 84-89 (all keyword intelligence features)  
> **Revision:** Consolidated after architecture review, removed duplicate work

---

## Goal

Make the keyword analysis system bulletproof before adding features. This phase upgrades embedding infrastructure (v3 → v5-nano), adds resilience, and establishes cost controls.

**Why First:** Users will abandon a flaky tool no matter how feature-rich. The v5-nano upgrade alone provides 12x faster embeddings, enabling 100 prospects/hour throughput.

---

## Critical Architecture Fix

**Removed broken fallbacks from ResilientEmbedding.ts:**
- LocalONNXEmbedding (hash-based stub) — produced semantically meaningless vectors
- Zero vector fallback — caused complete clustering failures

**New architecture: Fail-fast, not fail-silently**

```
Cache Hit → Return
    ↓ miss
Local Server (3 retries, exponential backoff)
    ↓ fail
Jina API (same v5-nano model, 3 retries)
    ↓ fail
Throw EmbeddingUnavailableError → Job moves to DLQ
```

---

## Key Deliverables

| Deliverable | Impact | Metric |
|-------------|--------|--------|
| Jina v5-nano in production | 12x faster embeddings | <3 min for 100 prospects |
| Fail-fast embedding cascade | Consistent quality | No degraded vectors |
| SSE auto-reconnect | Zero dropped analyses | 99%+ recovery rate |
| Checkpoint/resume | Resume after crash | Works after browser refresh |
| 2-tier caching (L1+L2) | 60%+ cache hits | $0.008/100 prospects |
| Cost visibility | Budget transparency | Per-analysis cost display |

---

## Waves (Revised Timeline)

| Wave | Name | Duration | Status | Key Work |
|------|------|----------|--------|----------|
| 1 | Embedding Infrastructure | 3 days | **COMPLETE** | v5-nano upgrade, fail-fast cascade, worker pool |
| 2 | Error Handling & Recovery | 3 days | Ready | SSE reconnect, checkpoints, graceful degradation |
| 3 | Performance & Caching | 2 days | Ready | Extend cache with Redis L2, parallel pipeline, memory monitor |
| 4 | Cost Controls | 1 day | Ready | Model router, UsageDashboard, per-analysis cost |

**Total: ~9 days (down from 14)**

---

## Duplicate Work Removed

| Original Task | Status | Location |
|--------------|--------|----------|
| 83-03 Task 1: LRU Cache | **EXISTS** | `InMemoryEmbeddingCache` in ResilientEmbedding.ts |
| 83-03 Task 6: SWR HTTP | **EXISTS** | HTTP headers in pixel routes |
| 83-04 Task 1: Cost Tracker | **EXISTS** | `CostTracker.ts` + `api-costs-schema.ts` |
| 83-04 Task 5: Cost Schema | **EXISTS** | `apiCosts` table in `api-costs-schema.ts` |
| CircuitBreaker | **EXISTS** | `CircuitBreaker.ts` already complete |

---

## Architecture Context

### Current State (v3)
```
Embedding: Jina v3 API → 458ms/doc, 1.5GB model, 50 kw/sec
Fallback: Hash-based ONNX stub (BROKEN - removed)
Caching: Redis only, no local LRU
Recovery: None - refresh loses all progress
```

### Target State (v5-nano)
```
Embedding: Jina v5-nano → 37ms/doc, 300MB model, 200 kw/sec
Fallback: Fail-fast (no quality degradation)
Caching: 2-tier (L1 memory → L2 Redis → API), 60%+ hit rate
Recovery: IndexedDB checkpoints, SSE auto-reconnect
Cost: $0.008 per 100 prospects
```

---

## Success Criteria

| Metric | Current | Target | Verification |
|--------|---------|--------|--------------|
| Embedding speed | 50 kw/sec | 200 kw/sec | Benchmark 1000 keywords |
| 100 prospects time | ~45 min | <10 min | Load test |
| Cache hit rate | ~20% | >60% | TieredEmbeddingCache.getStats() |
| Error recovery | 0% | 99%+ | Kill browser mid-analysis |
| Memory usage | Unknown | <17GB | memoryMonitor.check() |
| Cost per 100 | ~$0.65 | <$0.01 | Track in dashboard |
| Clustering quality | Degraded | Consistent | No zero/hash vectors |

---

## Files Modified (Wave 1)

```
MODIFIED: open-seo-main/src/server/features/keywords/services/ResilientEmbedding.ts
          - Removed LocalONNXEmbedding class (hash-based stub)
          - Removed zero vector fallback
          - Added EmbeddingUnavailableError for fail-fast
          - Added retry with exponential backoff (3 attempts)
          - Changed backend types: "cache" | "local" | "jina"
```

---

## Related Documents

- `.planning/phases/83-foundation-reliability/83-REVISED-PLAN.md` - Full revised architecture
- `.planning/phases/83-foundation-reliability/83-03-PLAN.md` - Wave 3 (Performance)
- `.planning/phases/83-foundation-reliability/83-04-PLAN.md` - Wave 4 (Cost Controls)
- `.planning/keyword-intelligence/COST-OPTIMIZED-CLUSTERING.md` - 72x cost reduction architecture
- `AI-Writer/benchmark/results/REPORT.md` - v5-nano benchmark results

---

*Phase revised: 2026-05-05*
*Based on: Architecture review by Opus subagents*
