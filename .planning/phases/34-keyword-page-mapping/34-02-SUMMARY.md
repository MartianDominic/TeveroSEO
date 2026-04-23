---
phase: 34-keyword-page-mapping
plan: 02
subsystem: mapping-service
tags: [service, repository, decision-logic, tdd]
dependency_graph:
  requires: [keyword_page_mapping_table, calculateRelevance_function]
  provides: [MappingService, MappingRepository, mapKeywordToPage]
  affects: [keyword-management, content-strategy]
tech_stack:
  added: []
  patterns: [repository-pattern, lazy-loading, tdd]
key_files:
  created:
    - open-seo-main/src/server/features/mapping/repositories/MappingRepository.ts
    - open-seo-main/src/server/features/mapping/services/MappingService.ts
    - open-seo-main/src/server/features/mapping/services/MappingService.test.ts
  modified: []
decisions:
  - "Lazy-load repository to enable pure function testing without DB connection"
  - "Decision tree: position <= 20 -> optimize, relevance >= 60 -> optimize, else create"
  - "TDD approach for MappingService decision logic"
metrics:
  duration: 4m4s
  completed: 2026-04-23T11:13:00Z
  tasks: 2
  files: 3
---

# Phase 34 Plan 02: mapKeywordToPage() Decision Logic Summary

MappingService with decision logic for keyword-to-page mapping: optimize existing pages (ranking or high relevance) or flag for new content creation, with MappingRepository for persistence.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create MappingRepository for database operations | ad9d678 | MappingRepository.ts |
| 2 | Create MappingService with mapKeywordToPage decision logic (TDD) | 9b867c3, eece586 | MappingService.ts, MappingService.test.ts |

## Implementation Details

### MappingRepository

Full CRUD operations for keyword_page_mapping table:
- `upsertMapping` / `bulkUpsertMappings` - Insert or update on conflict
- `getMappingsByProject` - List all mappings with optional action filter
- `getMappingByKeyword` - Single mapping lookup
- `getMappingsByTargetUrl` - Find keywords mapped to a page
- `updateMappingTarget` - Manual override support
- `deleteMapping` / `deleteAllMappings` - Cleanup operations
- `countMappingsByAction` - Statistics (optimize/create counts)

### MappingService Decision Logic

The `mapKeywordToPage()` function implements a three-step decision tree:

1. **Already ranking (position <= 20)?**
   - Action: `optimize`
   - Target: current ranking URL
   - Reason: "Already position {N}"

2. **Best match with >= 60% relevance?**
   - Action: `optimize`
   - Target: highest scoring page URL
   - Reason: "Best match ({score}% relevant)"

3. **No good match?**
   - Action: `create`
   - Target: null
   - Reason: "No existing page matches (best: {score}%)"

### Batch Operations

- `mapKeywordsToPages()` - Maps multiple keywords in batch
- `saveMappings()` - Persists mapping results to database
- `getMappings()` - Retrieves mappings with optional action filter
- `overrideMapping()` - Manual reassignment with isManualOverride flag
- `getMappingStats()` - Returns optimize/create/total counts

## Test Coverage

9 tests covering all decision scenarios:
- Returns optimize with current URL when already ranking
- Returns optimize with best match when not ranking but good match exists
- Returns create when no good match exists
- Returns create when no pages in inventory
- Selects highest relevance page when multiple match
- Ignores ranking position > 20
- Enforces 60% relevance threshold
- Maps multiple keywords in batch
- Handles empty keywords array

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Database import triggers connection in tests**
- **Found during:** Task 2 (TDD RED phase)
- **Issue:** Importing MappingService triggered MappingRepository import, which triggered db/index.ts, requiring DATABASE_URL
- **Fix:** Used dynamic import with lazy-loading pattern for repository in database functions
- **Files modified:** MappingService.ts
- **Commit:** eece586

## Verification Results

- [x] MappingRepository compiles and exports all methods
- [x] MappingService tests all pass (9/9)
- [x] mapKeywordToPage returns correct action for each scenario
- [x] 60% threshold enforced for "optimize" action

## Self-Check: PASSED

All created files exist:
- FOUND: open-seo-main/src/server/features/mapping/repositories/MappingRepository.ts
- FOUND: open-seo-main/src/server/features/mapping/services/MappingService.ts
- FOUND: open-seo-main/src/server/features/mapping/services/MappingService.test.ts

All commits exist:
- FOUND: ad9d678 (MappingRepository)
- FOUND: 9b867c3 (TDD RED - failing tests)
- FOUND: eece586 (TDD GREEN - implementation)

## TDD Gate Compliance

- RED gate: 9b867c3 (`test(34-02): add failing tests for MappingService decision logic`)
- GREEN gate: eece586 (`feat(34-02): implement MappingService with mapKeywordToPage decision logic`)
- REFACTOR gate: Not needed - code was clean after GREEN
