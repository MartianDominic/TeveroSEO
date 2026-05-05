# Phase 83: Foundation & Reliability — REVISED

> **Status:** In Progress (Wave 1 Complete)
> **Revision:** Consolidated after architecture review
> **Duration:** 1.5 weeks (reduced from 2 weeks)

---

## Key Changes from Original Plan

### Removed (Already Exists)

| Original Task | Status | Location |
|--------------|--------|----------|
| 83-03 Task 1: LRU Cache | **EXISTS** | `InMemoryEmbeddingCache` in ResilientEmbedding.ts:563 |
| 83-04 Task 1: Cost Tracker | **EXISTS** | `CostTracker.ts` + `api-costs-schema.ts` |
| 83-04 Task 5: Cost Schema | **EXISTS** | `apiCosts` table in `api-costs-schema.ts` |
| 83-04 Task 2: Circuit Breaker | **EXISTS** | `CircuitBreaker.ts` already complete |
| 83-03 Task 6: SWR HTTP | **EXISTS** | HTTP headers in pixel routes |

### Critical Fix Required

**Remove broken fallbacks from ResilientEmbedding.ts:**
- ❌ `LocalONNXEmbedding` (hash-based stub) — produces semantically meaningless vectors
- ❌ Zero vector fallback — breaks clustering entirely

**New architecture: Fail-fast, not fail-silently**

---

## Revised Wave Structure

### Wave 1: Embedding Infrastructure ✅ COMPLETE

All 8 tasks done. Need one fix:

**Fix 1.1: Remove Broken Fallbacks (1 hour)**

Remove from `ResilientEmbedding.ts`:
- `LocalONNXEmbedding` class (lines 160-230)
- Zero vector fallback (lines 514-528)
- Change to: Retry → Jina API fallback → Throw `EmbeddingUnavailableError`

```typescript
// NEW: Fail-fast cascade
private async generateEmbeddings(texts: string[]): Promise<number[][]> {
  // 1. Try local server with retry (3 attempts, exponential backoff)
  const localResult = await this.tryLocalServer(texts);
  if (localResult) return localResult;
  
  // 2. Try Jina API with retry (same model: v5-nano)
  const jinaResult = await this.tryJinaApi(texts);
  if (jinaResult) return jinaResult;
  
  // 3. FAIL - do not degrade quality
  throw new EmbeddingUnavailableError(
    "All embedding backends unavailable. Job will retry later."
  );
}
```

---

### Wave 2: Error Handling & Recovery (83-02) — KEEP AS-IS

All tasks are genuinely new:
- SSE auto-reconnect with exponential backoff
- IndexedDB checkpoint system
- Resume from checkpoint UI
- Graceful degradation for optional stages
- Error message templates
- Database offline queue
- Rate limit backoff + batch splitting

**No changes needed.**

---

### Wave 3: Performance & Caching — REVISED

**Keep (genuinely new):**
- Task 2: Constraint caching (conversation hash → skip LLM)
- Task 3: Parallel pipeline execution (formal dependency graph)
- Task 4: Worker thread pool for CPU tasks (HDBSCAN, scoring, pattern match)
- Task 5: Memory pressure monitoring (v8 heap stats)
- Task 7: Progressive result streaming (SSE partial results)
- Task 8: Client-side RAF buffering

**Modify (extend existing):**
- Task 1: 3-Tier Cache → **Extend existing `InMemoryEmbeddingCache` with Redis L2**
- Task 6: SWR → **Add programmatic SWR for data (not just HTTP headers)**

**New estimate:** 2 days (down from 3)

---

### Wave 4: Cost Controls — REVISED

**Remove (already exists):**
- ❌ Task 1: CostTracker service → `CostTracker.ts` exists
- ❌ Task 5: Cost database schema → `apiCosts` table exists

**Keep (genuinely new):**
- Task 2: Model router (choose cheapest capable model)
- Task 3: UsageDashboard React component
- Task 4: Per-analysis cost breakdown in UI

**New estimate:** 1 day (down from 2)

---

## Revised Architecture: Embedding Fail-Fast

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EMBEDDING STRATEGY: FAIL-FAST                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 1: REDIS CACHE (30-day TTL)                                     │ │
│  │  Key: emb:v5:{sha256(normalized_text)}                                 │ │
│  │  Expected hit rate: 80%+ after warmup                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                           │                                                  │
│                     Cache MISS                                               │
│                           ▼                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 2: LOCAL SERVER (v5-nano via Python FastAPI)                    │ │
│  │  - 3 retries with 1s, 2s, 4s backoff                                   │ │
│  │  - Circuit: 5 failures in 30s → open 60s                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                           │                                                  │
│                    LOCAL FAILED                                              │
│                           ▼                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 3: JINA API (v5-nano model - SAME MODEL for consistency)        │ │
│  │  - 3 retries with exponential backoff                                   │ │
│  │  - Cost: ~$2 per 200k keywords                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                           │                                                  │
│                     ALL FAILED                                               │
│                           ▼                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  THROW EmbeddingUnavailableError                                       │ │
│  │  Job moves to DLQ, user sees "service unavailable, retrying"           │ │
│  │  NEVER degrade to hash vectors or zero vectors                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  REMOVED (were breaking clustering silently):                               │
│  ❌ LocalONNXEmbedding (hash-based stub)                                    │
│  ❌ Zero vector fallback                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 83-01.1: Fix Broken Fallbacks (1 hour) — NEW

**File:** `open-seo-main/src/server/features/keywords/services/ResilientEmbedding.ts`

1. Remove `LocalONNXEmbedding` class entirely
2. Remove zero vector fallback
3. Add `EmbeddingUnavailableError` class
4. Update `generateEmbeddings()` to throw on all failures
5. Ensure Jina API uses same model (v5-nano) for consistency
6. Update circuit breaker config (5 failures, sliding window)

### Phase 83-02: Error Handling (unchanged) — 3 days

### Phase 83-03: Performance (revised) — 2 days

Focus only on genuinely new work:
- Constraint caching
- Parallel pipeline
- Worker threads
- Memory monitoring
- Progressive streaming
- Extend cache with Redis L2 (not replace)

### Phase 83-04: Cost Controls (revised) — 1 day

Focus only on genuinely new work:
- Model router
- UsageDashboard component
- Per-analysis cost display

---

## Execution Order

```
83-01.1: Fix fallbacks (1 hour) ← NEXT
83-02: Error handling (3 days)
83-03: Performance (2 days)
83-04: Cost controls (1 day)
─────────────────────────────
Total: ~1.5 weeks
```

---

## Metrics to Add

```typescript
// Add to embedding service for monitoring
const EMBEDDING_METRICS = {
  cache_hits: Counter,           // Target: 80%+
  local_server_success: Counter, // Primary path
  jina_api_fallback: Counter,    // Should be rare
  total_failures: Counter,       // Should be ~0
  latency_ms: Histogram,         // Target: <100ms p95
};
```

---

*Revised: 2026-05-05*
*Based on: Architecture review by Opus subagents*
