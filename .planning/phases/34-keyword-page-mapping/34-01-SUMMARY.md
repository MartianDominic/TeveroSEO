---
phase: 34-keyword-page-mapping
plan: 01
subsystem: data-model
tags: [database, schema, algorithm, relevance]
dependency_graph:
  requires: []
  provides: [keyword_page_mapping_table, calculateRelevance_function]
  affects: [mapping-service, keyword-management]
tech_stack:
  added: []
  patterns: [drizzle-schema, tdd, weighted-scoring]
key_files:
  created:
    - open-seo-main/src/db/mapping-schema.ts
    - open-seo-main/src/db/mapping-schema.test.ts
    - open-seo-main/src/server/features/mapping/services/relevance.ts
    - open-seo-main/src/server/features/mapping/services/relevance.test.ts
    - open-seo-main/drizzle/0022_keyword_page_mapping.sql
  modified:
    - open-seo-main/src/db/schema.ts
    - open-seo-main/drizzle/meta/_journal.json
decisions:
  - "TDD approach for schema and relevance algorithm"
  - "Relevance scoring weights based on Kyle Roof research (title=35, h1=25, first100=15, url=15, frequency=10)"
  - "Manual migration creation due to drizzle-kit TTY requirement"
metrics:
  duration: 6m17s
  completed: 2026-04-23T11:05:00Z
  tasks: 3
  files: 7
---

# Phase 34 Plan 01: Keyword Page Mapping Schema + Relevance Algorithm Summary

Drizzle schema for keyword_page_mapping table and calculateRelevance() algorithm with TDD-validated weighted scoring for title/H1/URL/content matching.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create keyword_page_mapping Drizzle schema | 448721c | mapping-schema.ts, mapping-schema.test.ts, schema.ts |
| 2 | Generate and apply migration | ddbc552 | 0022_keyword_page_mapping.sql, _journal.json |
| 3 | Implement calculateRelevance algorithm | 1e74021 | relevance.ts, relevance.test.ts |

## Implementation Details

### keyword_page_mapping Table

Created `mapping-schema.ts` with the following columns:
- `id` (text, PK)
- `projectId` (text, FK to projects with cascade delete)
- `keyword` (text, not null)
- `targetUrl` (text, nullable for 'create' actions)
- `action` (text: 'optimize' | 'create')
- `relevanceScore` (real, 0-100)
- `reason` (text)
- `searchVolume`, `difficulty` (integer)
- `currentPosition`, `currentUrl` (for GSC/ranking data)
- `isManualOverride` (boolean, default false)
- `createdAt`, `updatedAt` (timestamp with timezone)

Indexes:
- Unique index on (projectId, keyword)
- Index on projectId
- Index on targetUrl
- Index on action

### calculateRelevance Algorithm

Weighted scoring based on Kyle Roof's Factor Group A research:

| Factor | Points | Condition |
|--------|--------|-----------|
| Title | 35 | Keyword in first 30 chars |
| Title | 25 | Keyword after 30 chars |
| H1 | 25 | Keyword present |
| First 100 words | 15 | Keyword present |
| URL slug | 15 | Keyword in path (- and _ normalized) |
| Body frequency | 0-10 | Based on density (capped at 3%) |

Maximum score: 100 points
Good match threshold: 60+

## Test Coverage

- **Schema tests**: 7 tests (table structure, columns, types, exports)
- **Relevance tests**: 19 tests (all scoring scenarios, edge cases, null handling)
- **Total**: 26 tests passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual migration creation**
- **Found during:** Task 2
- **Issue:** drizzle-kit generate requires TTY for interactive prompts
- **Fix:** Created migration SQL manually matching schema definition
- **Files modified:** drizzle/0022_keyword_page_mapping.sql, drizzle/meta/_journal.json
- **Commit:** ddbc552

**2. [Rule 1 - Bug] Test assertion fix**
- **Found during:** Task 3
- **Issue:** `toContain(expect.stringMatching(...))` doesn't work with arrays
- **Fix:** Changed to `toEqual(expect.arrayContaining([expect.stringMatching(...)]))` 
- **Files modified:** relevance.test.ts
- **Commit:** 1e74021

## Verification Results

- [x] `pnpm vitest run` - All 26 tests pass
- [x] Migration file generated with keyword_page_mapping table
- [x] Relevance tests all pass
- [x] Schema exported from barrel export

## Self-Check: PASSED

All created files exist:
- FOUND: open-seo-main/src/db/mapping-schema.ts
- FOUND: open-seo-main/src/db/mapping-schema.test.ts
- FOUND: open-seo-main/src/server/features/mapping/services/relevance.ts
- FOUND: open-seo-main/src/server/features/mapping/services/relevance.test.ts
- FOUND: open-seo-main/drizzle/0022_keyword_page_mapping.sql

All commits exist:
- FOUND: 448721c (schema)
- FOUND: ddbc552 (migration)
- FOUND: 1e74021 (relevance)
