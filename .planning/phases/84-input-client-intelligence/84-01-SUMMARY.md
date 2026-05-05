---
phase: 84-input-client-intelligence
plan: 01
subsystem: api, ui
tags: [keyword-generator, clarifying-questions, gsc-bridge, csv-import, react, tanstack-start]

# Dependency graph
requires:
  - phase: 75-01
    provides: ConstraintExtractor with clarificationNeeded[]
  - phase: 82-02
    provides: CopilotKit chat integration
provides:
  - KeywordGenerator wired into chat flow
  - Clarifying question conversational loop (max 3 rounds)
  - GSC bridge service with 1-hour cache
  - CSV import dialog with format detection
affects: [85-analysis-experience, 86-semantic-intelligence, 87-agency-business]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Business description detection via keyword heuristics
    - Multi-round clarification with confidence tracking
    - HTTP bridge pattern for cross-service communication
    - 3-step wizard pattern for file import

key-files:
  created:
    - apps/web/src/components/keyword-analysis/ClarifyingQuestionLoop.tsx
    - apps/web/src/components/keyword-analysis/useClarifyingQuestions.ts
    - apps/web/src/components/keyword-analysis/CsvImportDialog.tsx
    - open-seo-main/src/routes/api/keywords/generate.ts
    - open-seo-main/src/server/services/GscBridgeService.ts
    - open-seo-main/src/routes/api/clients/$clientId/gsc.ts
  modified:
    - apps/web/src/components/keyword-analysis/KeywordAnalysisChat.tsx

key-decisions:
  - "Business description detection uses keyword density + average length heuristics"
  - "Clarifying questions use QUESTION_MAP for human-readable question mapping"
  - "GSC bridge caches for 1 hour to avoid quota issues"
  - "Rate limit 100 GSC calls/day/client"
  - "CSV import uses 3-step wizard pattern (upload, preview, results)"

patterns-established:
  - "HTTP bridge pattern: GscBridgeService calls AI-Writer with client credentials"
  - "useClarifyingQuestions hook manages multi-round state"
  - "Business description detection: isBusinessDescription() utility function"

requirements-completed: [INPUT-01, INPUT-02, INPUT-03, INPUT-04]

# Metrics
duration: 45min
completed: 2026-05-05
---

# Phase 84 Plan 01: Input & Client Intelligence Summary

**Wired KeywordGenerator, clarifying question loop, GSC bridge, and CSV import dialog into keyword analysis pipeline**

## Performance

- **Duration:** 45 min
- **Started:** 2026-05-05T16:00:00Z
- **Completed:** 2026-05-05T16:45:00Z
- **Tasks:** 4
- **Files modified:** 12

## Accomplishments

- Business description in chat triggers KeywordGenerator with grouped keyword results
- Clarifying questions appear when extraction confidence < 0.5, max 3 rounds
- GSC bridge service fetches ranking data via AI-Writer with 1-hour cache
- CSV import dialog with format detection (Ahrefs/SEMrush/Moz/generic)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire KeywordGenerator into chat flow** - `b1fd651a5` (feat)
2. **Task 2: Build clarifying question conversational loop** - `172482b5e` (feat)
3. **Task 3: Create GSC bridge for client path** - `b2da2dd29` (feat)
4. **Task 4: Build CsvImportDialog.tsx frontend** - `434344c0a` (feat)

## Files Created/Modified

### Created
- `open-seo-main/src/routes/api/keywords/generate.ts` - API endpoint for keyword generation from business description
- `open-seo-main/src/routes/api/keywords/generate.test.ts` - 10 tests for generation endpoint
- `apps/web/src/components/keyword-analysis/ClarifyingQuestionLoop.tsx` - Question rendering with options/text input
- `apps/web/src/components/keyword-analysis/ClarifyingQuestionLoop.test.tsx` - Component tests
- `apps/web/src/components/keyword-analysis/useClarifyingQuestions.ts` - Hook for question state management
- `open-seo-main/src/server/services/GscBridgeService.ts` - HTTP bridge to AI-Writer GSC endpoint
- `open-seo-main/src/server/services/GscBridgeService.test.ts` - Service tests with mock fetch
- `open-seo-main/src/routes/api/clients/$clientId/gsc.ts` - GSC API routes (GET status, POST rankings)
- `apps/web/src/components/keyword-analysis/CsvImportDialog.tsx` - 3-step import wizard
- `apps/web/src/components/keyword-analysis/CsvImportDialog.test.tsx` - 11 dialog tests

### Modified
- `apps/web/src/components/keyword-analysis/KeywordAnalysisChat.tsx` - Added business description detection, keyword generation UI, clarification integration

## Decisions Made

1. **Business description detection** - Uses `isBusinessDescription()` utility checking for business keywords and average word length > 30 characters
2. **QUESTION_MAP** - Maps field names to human-readable questions (e.g., "geo.scope" -> "What geographic area do you serve?")
3. **GSC cache TTL** - 1 hour (3600 seconds) to avoid GSC API quota issues
4. **Rate limiting** - 100 GSC calls per day per client using Redis counter with 24h expiry
5. **CSV dialog pattern** - 3-step wizard using @tevero/ui Dialog and Table components

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Zod validation error access pattern**
- **Found during:** Task 1 (API endpoint)
- **Issue:** Plan used `.errors[0]` but Zod uses `.issues[0]`
- **Fix:** Changed to correct Zod API
- **Files modified:** open-seo-main/src/routes/api/keywords/generate.ts
- **Committed in:** b1fd651a5

**2. [Rule 3 - Blocking] user-event not installed**
- **Found during:** Task 2 (Tests)
- **Issue:** @testing-library/user-event not in dependencies
- **Fix:** Used fireEvent from @testing-library/react instead
- **Files modified:** ClarifyingQuestionLoop.test.tsx
- **Committed in:** 172482b5e

**3. [Rule 1 - Bug] Type assertions for fetch responses**
- **Found during:** Tasks 1, 3 (API handlers)
- **Issue:** `response.json()` returns `unknown` type
- **Fix:** Added explicit type assertions for API response shapes
- **Files modified:** GscBridgeService.ts, gsc.ts routes
- **Committed in:** b2da2dd29

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for type safety and test execution. No scope creep.

## Issues Encountered

- Test assertion for "5 skipped" needed adjustment - the count and "skipped" label are in separate elements, updated test to check both independently

## User Setup Required

None - no external service configuration required. GSC credentials are fetched from AI-Writer which already handles OAuth.

## Next Phase Readiness

- Keyword generation pipeline fully wired, ready for Phase 85 analysis enhancements
- GSC bridge available for client path ranking overlays
- CSV import frontend complete, backend CsvImportService integration ready
- All TypeScript files compile without errors

---
*Phase: 84-input-client-intelligence*
*Completed: 2026-05-05*
