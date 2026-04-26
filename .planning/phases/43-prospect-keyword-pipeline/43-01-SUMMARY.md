---
phase: 43-prospect-keyword-pipeline
plan: 01
subsystem: keywords
tags: [schema, services, ui, tdd]
dependency_graph:
  requires: []
  provides:
    - ProspectKeyword schema with source tracking
    - KeywordEnrichmentService with batching and caching
    - KeywordDeduplicator with Lithuanian normalization
    - KeywordInputService for 5 entry points
    - Entry point selector UI
  affects:
    - apps/web/src/app/(shell)/prospects/keywords/
    - open-seo-main/src/server/features/keywords/
tech_stack:
  added:
    - drizzle-orm (PostgreSQL schema)
    - ioredis (Redis caching)
    - vitest (testing)
  patterns:
    - TDD (Red-Green-Refactor)
    - Service layer with singleton exports
    - Batch processing with cost tracking
key_files:
  created:
    - open-seo-main/src/db/prospect-keyword-schema.ts
    - open-seo-main/src/db/migrations/0031_prospect_keyword_source.ts
    - open-seo-main/src/server/features/keywords/services/KeywordEnrichmentService.ts
    - open-seo-main/src/server/features/keywords/services/KeywordDeduplicator.ts
    - open-seo-main/src/server/features/keywords/services/KeywordInputService.ts
    - open-seo-main/src/server/features/keywords/services/index.ts
    - open-seo-main/src/server/lib/redis.ts
    - open-seo-main/src/server/lib/dataforseo.ts
    - open-seo-main/src/db/index.ts
    - open-seo-main/vitest.config.ts
    - apps/web/src/app/(shell)/prospects/keywords/page.tsx
    - apps/web/src/app/(shell)/prospects/keywords/components/EntrySelector.tsx
  modified:
    - open-seo-main/src/db/schema.ts
    - .gitignore
    - pnpm-workspace.yaml
decisions:
  - "Remove open-seo-main from .gitignore to track keyword service files (Rule 3 deviation)"
  - "7-day cache TTL (604800s) for keyword metrics to balance freshness vs cost"
  - "0.5 cents per keyword cost tracking for DataForSEO API"
  - "Lithuanian diacritics removed via NFD normalization for deduplication"
  - "5 entry points map to 4 source types (competitor_spy and gap_analysis both use competitor_gap)"
metrics:
  duration: 11m 22s
  completed: 2026-04-26T21:50:50Z
  tasks: 4/4
  tests: 32 passing
  files_created: 14
  files_modified: 3
---

# Phase 43 Plan 01: Entry Point Architecture + Keyword Schema Summary

ProspectKeyword schema with 5-source tracking, batched enrichment with 7-day Redis cache, Lithuanian-aware deduplication, and entry point selector UI.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ProspectKeyword schema with source tracking | 1c3d162e9 | prospect-keyword-schema.ts, migration |
| 2 | KeywordEnrichmentService with batching and caching | ac1a179eb | KeywordEnrichmentService.ts, redis.ts, dataforseo.ts |
| 3 | KeywordDeduplicator and KeywordInputService | eef4ff456 | KeywordDeduplicator.ts, KeywordInputService.ts, index.ts |
| 4 | Entry point selector UI | 10fdd5010 | EntrySelector.tsx, page.tsx |

## Implementation Details

### ProspectKeyword Schema

```typescript
// Source tracking for all 5 entry points
KEYWORD_SOURCES = ["dataforseo", "manual", "csv_upload", "competitor_gap", "quick_check"]

// Enrichment status workflow
ENRICHMENT_STATUS = ["pending", "enriched", "cached", "failed", "skipped"]

// Prioritization tiers
KEYWORD_TIERS = ["must_do", "should_do", "nice_to_have", "ignore"]
```

Key fields:
- `normalizedKeyword`: Lowercase, diacritics removed for deduplication
- `source` + `sourceMetadata`: Track keyword origin for cost attribution
- `enrichmentStatus` + `enrichmentCostCents`: Track API usage and costs
- Unique index on `(prospectId, normalizedKeyword)` prevents duplicates

### KeywordEnrichmentService

- **Batch size**: 1000 keywords per DataForSEO API call
- **Cache TTL**: 7 days (604800 seconds)
- **Cost tracking**: 0.5 cents per keyword
- **Skip logic**: CSV imports with existing metrics skip enrichment
- **Cache key format**: `kw-metrics:{normalizedKeyword}`

### KeywordDeduplicator

Lithuanian diacritic normalization:
```typescript
normalizeKeyword("Plaukų Dažai") // => "plauku dazai"
// ą→a, č→c, ę→e, ė→e, į→i, š→s, ų→u, ū→u, ž→z
```

Merge strategy: Keep keyword with higher search volume when duplicates found.

### Entry Point Selector UI

| Entry Point | Source Type | Workspace Required | Cost |
|-------------|-------------|-------------------|------|
| Quick Check | quick_check | No | ~$0.005/kw |
| Import CSV | csv_upload | Yes | $0 if metrics present |
| Full Discovery | dataforseo | Yes | ~$0.04 |
| Gap Analysis | competitor_gap | Yes | ~$0.04 |
| Competitor Spy | competitor_gap | No | ~$0.02 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed open-seo-main from .gitignore**
- **Found during:** Task 1
- **Issue:** open-seo-main was in .gitignore, preventing keyword service files from being tracked
- **Fix:** Removed open-seo-main/ from .gitignore, added node_modules/ instead
- **Files modified:** .gitignore
- **Commit:** 1c3d162e9

**2. [Rule 3 - Blocking] Added missing infrastructure files**
- **Found during:** Task 2
- **Issue:** Missing redis.ts, dataforseo.ts, db/index.ts, vitest.config.ts
- **Fix:** Created all required infrastructure files for the service layer
- **Files created:** redis.ts, dataforseo.ts, db/index.ts, vitest.config.ts
- **Commit:** ac1a179eb

**3. [Rule 3 - Blocking] Added pnpm-workspace.yaml entry**
- **Found during:** Task 1
- **Issue:** open-seo-main not in pnpm workspace, dependencies not installing
- **Fix:** Added "open-seo-main" to pnpm-workspace.yaml packages array
- **Files modified:** pnpm-workspace.yaml
- **Commit:** 1c3d162e9

## Test Coverage

All 32 tests passing:
- `prospect-keyword-schema.test.ts`: 6 tests (schema validation)
- `KeywordEnrichmentService.test.ts`: 8 tests (batching, caching, cost tracking)
- `KeywordDeduplicator.test.ts`: 8 tests (normalization, merge logic)
- `KeywordInputService.test.ts`: 10 tests (entry point mapping, orchestration)

## Known Stubs

None - all services are fully implemented with real logic.

## Self-Check: PASSED

All created files verified to exist:
- [x] open-seo-main/src/db/prospect-keyword-schema.ts
- [x] open-seo-main/src/server/features/keywords/services/KeywordEnrichmentService.ts
- [x] open-seo-main/src/server/features/keywords/services/KeywordDeduplicator.ts
- [x] open-seo-main/src/server/features/keywords/services/KeywordInputService.ts
- [x] apps/web/src/app/(shell)/prospects/keywords/page.tsx
- [x] apps/web/src/app/(shell)/prospects/keywords/components/EntrySelector.tsx

All commits verified in git log:
- [x] 1c3d162e9 - Task 1
- [x] ac1a179eb - Task 2
- [x] eef4ff456 - Task 3
- [x] 10fdd5010 - Task 4
