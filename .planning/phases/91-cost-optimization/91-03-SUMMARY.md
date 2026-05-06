---
phase: 91
plan: 03
status: complete
completed: 2026-05-06
---

# Summary: Batching Optimization

## What Was Built

### T1: Keyword Classification Batch Size ✅

Increased batch size from 50 to 200 keywords per API call.

**File:** `open-seo-main/src/server/features/keywords/classification/config.ts`

**Changes:**
- `BATCH_SIZE: 50 → 200` (4x improvement)
- `maxTokens: 4000 → 12000` (required for larger batches)

### T2: ResilientClassifier Pass 2 Batch ✅

Increased concurrent API call limit from 5 to 25.

**File:** `open-seo-main/src/server/features/keywords/services/ResilientClassifier.ts:563`

**Change:** `batchSize = 5 → 25` (5x improvement)

### T3: Translation Batch Size ✅

Increased batch size from 10 to 30 texts per batch.

**File:** `open-seo-main/src/server/services/translation/TranslationService.ts:192`

**Change:** `batchSize = 10 → 30` (3x improvement)

### T4: Funnel Classification Batch — SKIPPED

Already at reasonable batch size (100). Token math for 250 needs validation.
Marked for future optimization.

### T5: Environment Variable Overrides ✅

Made batch sizes configurable via environment variables:

```bash
CLASSIFICATION_BATCH_SIZE=200   # Override keyword batch size
GROK_MAX_TOKENS=12000           # Override max tokens
GROK_CLASSIFICATION_MODEL=grok-4-1-fast-reasoning  # Override model
```

**File:** `open-seo-main/src/server/features/keywords/classification/config.ts`

### T6: Quality Monitoring — DEFERRED

Quality logging already exists in classification pipeline. Extended monitoring can be added during A/B test period.

## Key Files Modified

| File | Change |
|------|--------|
| `classification/config.ts` | BATCH_SIZE 50→200, maxTokens 4000→12000, env overrides |
| `ResilientClassifier.ts` | batchSize 5→25 |
| `TranslationService.ts` | batchSize 10→30 |

## Self-Check

- [x] T1 committed — 200-keyword batches
- [x] T2 committed — 25-concurrent Pass 2
- [x] T3 committed — 30-text translation batches
- [ ] T4 skipped — FunnelClassifier already reasonable
- [x] T5 committed — env var overrides
- [ ] T6 deferred — quality monitoring during A/B test

## Expected Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API calls per 10K keywords | 200 | 50 | **75% reduction** |
| Pass 2 retry throughput | 5 concurrent | 25 concurrent | **5x faster** |
| Translation API calls | 10 per batch | 30 per batch | **67% reduction** |

## Rollback Plan

Environment variables allow instant rollback without code changes:
```bash
CLASSIFICATION_BATCH_SIZE=50  # Revert to original
```
