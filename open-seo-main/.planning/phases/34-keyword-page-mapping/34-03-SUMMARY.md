---
phase: "34"
plan: "03"
subsystem: keyword-mapping
tags: [keyword, aggregation, service, gsc, rankings]
dependency_graph:
  requires: [analytics-schema, ranking-schema, prospect-schema, client-schema]
  provides: [KeywordAggregationService, AggregatedKeyword type, multi-source keyword pool]
  affects: [keyword-page-mapping, content-optimization]
tech_stack:
  added: []
  patterns: [service-class, case-insensitive-dedup, source-attribution]
key_files:
  created:
    - src/server/services/keyword-aggregation/KeywordAggregationService.ts
    - src/server/services/keyword-aggregation/KeywordAggregationService.test.ts
    - src/server/services/keyword-aggregation/index.ts
  modified: []
decisions:
  - Case-insensitive deduplication using lowercase+trim normalization
  - Source priority order: ranking > saved > prospect > GSC for metrics
  - Track all sources per keyword for transparency
  - Sort by search volume descending for relevance
metrics:
  duration_seconds: 234
  completed: "2026-04-23T11:13:00Z"
  tasks_completed: 7
  files_created: 3
  tests_added: 20
---

# Phase 34 Plan 03: Keyword Aggregation Service Summary

**One-liner:** Multi-source keyword aggregator merging GSC queries, saved keywords, rankings, and prospect analysis into unified pool with case-insensitive deduplication and source attribution.

## What Was Built

### KeywordAggregationService

A service that collects keywords from four distinct sources and merges them into a unified, deduplicated list for keyword-page mapping:

1. **GSC Query Snapshots** - Fetches keywords from `gsc_query_snapshots` with:
   - 30-day lookback window (configurable)
   - Minimum 10 impressions threshold (configurable)
   - Aggregated metrics: avg position, total impressions, total clicks

2. **Saved Keywords** - Joins `saved_keywords` with `keyword_metrics` for:
   - Search volume, CPC, difficulty
   - Tracking status

3. **Keyword Rankings** - Gets latest position from `keyword_rankings`:
   - Most recent position per keyword
   - Ranking URL

4. **Prospect Analysis** - If client converted from prospect, includes:
   - Gap keywords (competitor keywords we don't rank for)
   - Opportunity keywords (AI-generated)
   - Achievability scores

### Type System

```typescript
type KeywordSource = "gsc" | "saved" | "ranking" | "prospect_gap" | "prospect_opportunity";

interface AggregatedKeyword {
  keyword: string;           // Normalized (lowercase, trimmed)
  originalKeyword: string;   // Preserves original case
  sources: KeywordSource[];  // Multi-source attribution
  currentPosition: number | null;
  currentUrl: string | null;
  searchVolume: number | null;
  cpc: number | null;
  difficulty: number | null;
  gscAvgPosition: number | null;
  gscImpressions: number | null;
  gscClicks: number | null;
  achievability: number | null;
  isTracked: boolean;
}
```

### Deduplication Strategy

- **Normalization:** `keyword.toLowerCase().trim()`
- **Merge Priority:**
  - Current position: ranking data (authoritative)
  - Metrics (volume, CPC, difficulty): saved > prospect
  - GSC data: always preserved in dedicated fields
  - Achievability: prospect analysis only
- **Multi-source tracking:** Keywords appearing in multiple sources preserve all source tags

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| e17c29a | feat | Implement KeywordAggregationService with all aggregation methods |
| 80b364c | test | Add unit tests for KeywordAggregationService |

## Test Coverage

20 unit tests covering:
- Type structure validation
- Case normalization and deduplication
- Source merging from all 4 sources
- Metric priority handling
- Sorting by search volume
- Edge cases (special chars, long keywords, zero metrics)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/server/services/keyword-aggregation/KeywordAggregationService.ts` exists
- [x] `src/server/services/keyword-aggregation/KeywordAggregationService.test.ts` exists
- [x] `src/server/services/keyword-aggregation/index.ts` exists
- [x] Commit e17c29a verified
- [x] Commit 80b364c verified
- [x] All 20 tests passing
