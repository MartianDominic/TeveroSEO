---
phase: 64-crawling-infrastructure
plan: 04
subsystem: crawler
tags: [metrics, cost-savings, monitoring, crawling]
dependency_graph:
  requires: [singleflight, delta-cascade]
  provides: [recordSingleflight, recordDeltaSkip, recordFullProcess, getMetrics, getSingleflightRatio, getDeltaSkipRatio, CrawlMetrics]
  affects: [cost-visualization, operator-monitoring]
tech_stack:
  added: []
  patterns: [in-memory-counters, immutable-snapshot]
key_files:
  created:
    - open-seo-main/src/server/lib/metrics/crawl-metrics.ts
    - open-seo-main/src/server/lib/metrics/crawl-metrics.test.ts
    - open-seo-main/src/server/lib/metrics/index.ts
    - open-seo-main/src/routes/api/metrics/crawl.ts
  modified:
    - open-seo-main/src/server/lib/crawler/singleflight.ts
    - open-seo-main/src/server/lib/crawler/delta-cascade.ts
decisions:
  - "In-memory counters for simplicity (not Redis-backed for this phase)"
  - "Cost calculation uses $0.0001 per crawl estimate"
  - "Metrics wired at all singleflight return points and delta cascade decision points"
metrics:
  duration_minutes: 6
  completed: "2026-05-03T09:57:00Z"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 23
  coverage_delta: "+23 tests"
---

# Phase 64 Plan 04: Crawl Metrics Summary

In-memory metrics collection with API endpoint for cost savings visualization and operator monitoring.

## What Was Built

### Metrics Collection Module (`crawl-metrics.ts`)

Core implementation (176 lines):

1. **CrawlMetrics Interface**: Tracks all crawl-related counters
2. **recordSingleflight(hit)**: Increments hits/misses, adds costSavings on hit
3. **recordDeltaSkip(layer)**: Tracks L0/L1/L2 skips, adds costSavings
4. **recordFullProcess()**: Counts L3 full processing events
5. **recordQueueCompletion(lane)**: Tracks fastApi/heavyCrawl completions
6. **getSingleflightRatio()**: Calculates hits/(hits+misses)
7. **getDeltaSkipRatio()**: Calculates skips/(skips+processed)
8. **getMetrics()**: Returns immutable snapshot
9. **resetMetrics()**: Clears for testing/window resets

Key exports:
- `COST_PER_CRAWL_DOLLAR` = 0.0001
- `CrawlMetrics` interface
- All recording and query functions

### Tests (`crawl-metrics.test.ts`)

23 tests covering:
- Singleflight hit/miss recording
- Delta skip by layer (L0/L1/L2)
- Full process counting
- Queue completion tracking
- Cost savings calculation
- Ratio calculations (edge cases)
- Immutable snapshot verification
- Reset functionality

### API Endpoint (`routes/api/metrics/crawl.ts`)

GET /api/metrics/crawl returns:
```json
{
  "singleflightHits": 0,
  "singleflightMisses": 0,
  "deltaL0Skips": 0,
  "deltaL1Skips": 0,
  "deltaL2Skips": 0,
  "fullProcessed": 0,
  "fastApiCompleted": 0,
  "heavyCrawlCompleted": 0,
  "costSavingsDollars": 0,
  "singleflightRatio": 0,
  "deltaSkipRatio": 0,
  "timestamp": "2026-05-03T09:57:00.000Z"
}
```

### Crawler Integration

**singleflight.ts changes:**
- Import `recordSingleflight` from metrics
- Record hit (true) on: cache hit, follower receives shared result (pub/sub, polling)
- Record miss (false) on: leader acquires lock

**delta-cascade.ts changes:**
- Import `recordDeltaSkip`, `recordFullProcess` from metrics
- Record L0 skip on: sitemap lastmod unchanged
- Record L1 skip on: HTTP 304 response
- Record full process on: L3 fetch/process decisions

## Implementation Details

### Metrics Structure

```typescript
interface CrawlMetrics {
  singleflightHits: number;      // Deduplicated requests
  singleflightMisses: number;    // New unique requests
  deltaL0Skips: number;          // Sitemap lastmod unchanged
  deltaL1Skips: number;          // HTTP 304 unchanged
  deltaL2Skips: number;          // Hash unchanged
  fullProcessed: number;         // L3 full processing
  fastApiCompleted: number;      // Fast queue completions
  heavyCrawlCompleted: number;   // Heavy queue completions
  costSavingsDollars: number;    // Estimated savings
}
```

### Cost Calculation

Per 64-RESEARCH.md, each skip saves an estimated $0.0001 in crawl cost (CPU, memory, bandwidth for self-hosted setup). Cost savings increment on:
- Singleflight cache hits
- All delta skips (L0, L1, L2)

### Success Criteria Verification

| Metric | Target | How Measured |
|--------|--------|--------------|
| Singleflight ratio | 98% | getSingleflightRatio() |
| Delta skip ratio | 80%+ | getDeltaSkipRatio() |
| Cost savings | Visible | costSavingsDollars |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| cc22421b5 | test | Add failing tests for crawl metrics (RED) |
| a4aa6f0b2 | feat | Implement metrics collection module (GREEN) |
| 4ec454853 | feat | Add metrics API and wire to crawlers |

## Self-Check: PASSED

- [x] `open-seo-main/src/server/lib/metrics/crawl-metrics.ts` exists (176 lines)
- [x] `open-seo-main/src/server/lib/metrics/crawl-metrics.test.ts` exists (222 lines)
- [x] `open-seo-main/src/server/lib/metrics/index.ts` exists
- [x] `open-seo-main/src/routes/api/metrics/crawl.ts` exists (56 lines)
- [x] All 3 commits exist in git log
- [x] 23 metrics tests pass
- [x] 40 total tests pass (metrics + singleflight + delta-cascade)
- [x] No TypeScript errors in metrics modules
