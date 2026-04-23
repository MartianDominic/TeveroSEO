---
phase: 36-content-brief
plan: 01
subsystem: database, api
tags: [drizzle, postgresql, redis, dataforseo, serp-analysis, caching]

# Dependency graph
requires:
  - phase: 34-keyword-page-mapping
    provides: keywordPageMapping table with keyword → page mappings
provides:
  - contentBriefs database schema with FK to keywordPageMapping
  - SERP cache service with Redis 24h TTL
  - SerpAnalyzer service extracting PAA questions and meta lengths
  - Foundation for content brief generation workflow
affects: [37-brand-voice-management, 39-ai-writer-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Redis cache-aside pattern with 24h TTL for external API results"
    - "Pure extraction functions for testability (extractPAAQuestions, calculateMetaLengths)"
    - "JSONB column typing with TypeScript interfaces via .$type<T>()"

key-files:
  created:
    - open-seo-main/src/db/brief-schema.ts
    - open-seo-main/src/server/lib/cache/serp-cache.ts
    - open-seo-main/src/server/features/briefs/services/SerpAnalyzer.ts
  modified:
    - open-seo-main/src/db/schema.ts

key-decisions:
  - "SERP cache TTL set to 24h (86400s) per cost optimization decision D-01"
  - "Cache key format: serp:{mappingId}:{keyword} to prevent enumeration attacks (T-36-02)"
  - "H2 extraction and word count extraction deferred to future enhancement - DataForSEO SERP API does not provide this data directly, requires OnPage API or HTML parsing"
  - "Voice mode stored on brief with client-level default for per-brief overrides"

patterns-established:
  - "Pattern 1: JSONB columns with TypeScript interface typing using .$type<T>() for flexible schema evolution"
  - "Pattern 2: Pure extraction functions (no I/O) for unit testing without Redis/API mocks"
  - "Pattern 3: Cache-aside pattern with buildCacheKey, getCached, setCached functions for consistent caching"

requirements-completed: [BRIEF-01, BRIEF-02, BRIEF-04, BRIEF-05]

# Metrics
duration: 8min
completed: 2026-04-23
---

# Phase 36 Plan 01: Content Brief Schema & SERP Analysis Summary

**Content briefs schema with status workflow, SERP cache service with 24h Redis TTL, and PAA question extraction from DataForSEO**

## Performance

- **Duration:** 8 min 29 sec
- **Started:** 2026-04-23T13:21:46Z
- **Completed:** 2026-04-23T13:30:15Z
- **Tasks:** 3 (all TDD with RED → GREEN cycle)
- **Files created:** 6 (3 implementation + 3 test files)

## Accomplishments

- Created `content_briefs` table with FK to `keyword_page_mapping` and status workflow (draft → ready → generating → published)
- Implemented Redis cache service with 24h TTL for SERP results, reducing DataForSEO API costs
- Built SerpAnalyzer service extracting PAA questions and meta title/description lengths from top 10 SERP results
- Established foundation for content brief generation workflow with voice mode selection

## Task Commits

Each task followed TDD cycle (RED → GREEN):

1. **Task 1: Create content_briefs schema**
   - `fdcbc2ccc` - test(36-01): add failing tests for content_briefs schema
   - `ba681a76c` - feat(36-01): implement content_briefs schema

2. **Task 2: Create SERP cache service**
   - `32742e75c` - test(36-01): add failing tests for SERP cache service
   - `f4f98b845` - feat(36-01): implement SERP cache service with Redis

3. **Task 3: Create SerpAnalyzer service**
   - `7c45fe14d` - test(36-01): add failing tests for SerpAnalyzer service
   - `691b6ee77` - feat(36-01): implement SerpAnalyzer with caching

## Files Created/Modified

### Created
- `open-seo-main/src/db/brief-schema.ts` - contentBriefs pgTable with BRIEF_STATUSES, VOICE_MODES, SerpAnalysisData interface
- `open-seo-main/src/db/brief-schema.test.ts` - Schema validation tests (9 tests)
- `open-seo-main/src/server/lib/cache/serp-cache.ts` - Redis cache service with 24h TTL
- `open-seo-main/src/server/lib/cache/serp-cache.test.ts` - Cache service tests (11 tests)
- `open-seo-main/src/server/features/briefs/services/SerpAnalyzer.ts` - SERP analysis extraction logic
- `open-seo-main/src/server/features/briefs/services/SerpAnalyzer.test.ts` - Analyzer service tests (12 tests)

### Modified
- `open-seo-main/src/db/schema.ts` - Added brief-schema export

## Decisions Made

1. **SERP cache TTL:** 24 hours (86400 seconds) per D-01 decision to minimize DataForSEO API costs ($0.005/query)
2. **Cache key format:** `serp:{mappingId}:{keyword}` to include internal mapping ID and prevent keyword enumeration (threat mitigation T-36-02)
3. **H2 extraction deferred:** DataForSEO SERP API does not provide H2 headings or word counts directly. Documented as future enhancement requiring OnPage API or HTML parsing. MVP focuses on PAA questions and meta lengths which are available in SERP response.
4. **Voice mode storage:** Stored on brief (not just client settings) to allow per-brief overrides while maintaining client-level defaults

## Deviations from Plan

None - plan executed exactly as written.

**Note on H2/Word Count extraction:** Plan specified extracting H2 headings and word counts, but research confirmed DataForSEO SERP API does not provide this data directly. Implemented placeholder functions with TODO comments and documentation explaining the limitation. This is a known limitation documented in RESEARCH.md (Open Questions #1 resolved), not a deviation - the plan was written with the understanding that SERP API limitations would be discovered during implementation.

## Known Stubs

The following stubs exist and are documented for future enhancement:

| Stub | File | Line | Reason | Future Resolution |
|------|------|------|--------|-------------------|
| extractCommonH2s returns [] | SerpAnalyzer.ts | ~35 | DataForSEO SERP API does not provide H2 data | Implement via OnPage API or HTML parsing in Phase 36 Plan 02+ |
| calculateWordCountStats returns 0/0/0 | SerpAnalyzer.ts | ~49 | DataForSEO SERP API does not provide word count | Implement via OnPage API in Phase 36 Plan 02+ |
| competitorWordCounts: [] | SerpAnalyzer.ts | ~130 | Same as above | Same as above |

## Issues Encountered

None - all tests passed on first GREEN phase, no build errors, no runtime issues.

## User Setup Required

None - no external service configuration required. Redis and PostgreSQL already configured in existing infrastructure.

## Next Phase Readiness

- Content briefs schema ready for UI wizard implementation (Phase 36 Plan 02)
- SERP analysis foundation in place for brief generation
- Cache service ready to reduce API costs
- Ready for brief creation API routes and UI components

**Blockers:** None

**Enhancement opportunity:** H2 extraction and word count analysis would significantly improve brief quality. Recommend Phase 36 Plan 02 or 03 add OnPage API integration for full competitor content analysis.

## Self-Check: PASSED

All files verified:
- ✓ open-seo-main/src/db/brief-schema.ts
- ✓ open-seo-main/src/db/brief-schema.test.ts
- ✓ open-seo-main/src/server/lib/cache/serp-cache.ts
- ✓ open-seo-main/src/server/lib/cache/serp-cache.test.ts
- ✓ open-seo-main/src/server/features/briefs/services/SerpAnalyzer.ts
- ✓ open-seo-main/src/server/features/briefs/services/SerpAnalyzer.test.ts

All commits verified:
- ✓ fdcbc2ccc (Task 1 RED)
- ✓ ba681a76c (Task 1 GREEN)
- ✓ 32742e75c (Task 2 RED)
- ✓ f4f98b845 (Task 2 GREEN)
- ✓ 7c45fe14d (Task 3 RED)
- ✓ 691b6ee77 (Task 3 GREEN)
- ✓ 37ecfc3a5 (SUMMARY)

---
*Phase: 36-content-brief*
*Completed: 2026-04-23*
