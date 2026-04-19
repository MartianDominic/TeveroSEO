---
phase: 17-rank-tracking-history
plan: 01
subsystem: database
tags: [drizzle, schema, migrations, rank-tracking]
dependency_graph:
  requires: [saved_keywords table from app.schema.ts]
  provides: [keywordRankings table, tracking_enabled column, KeywordRankingSelect type, KeywordRankingInsert type]
  affects: [Phase 17 plans 02-04 that consume ranking schema]
tech_stack:
  added: []
  patterns: [Drizzle pgTable with FK references, unique index for deduplication]
key_files:
  created:
    - open-seo-main/src/db/ranking-schema.ts
    - open-seo-main/src/db/ranking-schema.test.ts
    - open-seo-main/drizzle/0005_keyword_rankings.sql
  modified:
    - open-seo-main/src/db/app.schema.ts
    - open-seo-main/src/db/schema.ts
    - open-seo-main/drizzle/meta/_journal.json
decisions:
  - "Text ID for keyword_rankings (UUID v7 for time-sortable IDs)"
  - "Nullable tracking_enabled for backward compatibility with existing rows"
  - "Manual migration creation due to drizzle-kit TTY requirement"
metrics:
  duration_minutes: 5
  completed_at: "2026-04-19T17:04:00Z"
---

# Phase 17 Plan 01: Ranking Schema Summary

Drizzle schema for keyword rank tracking with daily position snapshots and FK to saved_keywords

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add tracking_enabled to savedKeywords | 52aaa1e | app.schema.ts |
| 2 | Create keyword_rankings schema | 0a444ca | ranking-schema.ts, ranking-schema.test.ts, schema.ts |
| 3 | Generate migration | 5710667 | 0005_keyword_rankings.sql, _journal.json |

## Implementation Details

### keyword_rankings Table

- `id`: text primary key (UUID v7)
- `keywordId`: FK to saved_keywords with cascade delete
- `position`: integer (1-100, or 0 if not ranking)
- `previousPosition`: nullable integer for change calculation
- `url`: nullable text for ranking URL
- `date`: timestamp for daily snapshot
- `serpFeatures`: jsonb array for SERP feature tracking
- `createdAt`: timestamp with default now()

### Indexes

- `uq_rankings_keyword_date`: Unique index prevents duplicate daily entries
- `ix_rankings_date`: Date range queries
- `ix_rankings_keyword_id`: Keyword lookup queries

### tracking_enabled Column

Added to savedKeywords table with:
- Boolean type with default true
- Nullable for backward compatibility
- Enables per-keyword opt-out from rank tracking

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual migration creation**
- **Found during:** Task 3
- **Issue:** drizzle-kit generate requires TTY for interactive prompts
- **Fix:** Created migration SQL manually following Drizzle patterns
- **Files modified:** drizzle/0005_keyword_rankings.sql, drizzle/meta/_journal.json

## Verification

- TypeScript compilation: PASSED
- Schema tests: 12/12 PASSED
- Migration file: Contains CREATE TABLE keyword_rankings, ALTER TABLE saved_keywords, FK constraint, indexes

## Self-Check: PASSED

- [x] ranking-schema.ts exists with keywordRankings table
- [x] ranking-schema.test.ts exists with 12 passing tests
- [x] 0005_keyword_rankings.sql contains keyword_rankings DDL
- [x] tracking_enabled column in app.schema.ts
- [x] schema.ts exports ranking-schema
- [x] All commits verified: 52aaa1e, 0a444ca, 5710667
