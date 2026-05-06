---
phase: 94-design-system-v6
plan: 04
subsystem: ui
tags: [design-system, v6, keyword-table, calendar, content-calendar]

requires:
  - phase: 94-02
    provides: Card, Badge, ProgressBlock primitives with v6 styling
provides:
  - KeywordTable with v6 sliding tabs, serif volume, semantic difficulty
  - ContentCalendar with three view modes (month, week, list)
  - CalendarViews with status dot system
affects: [portal, content-pipeline, article-scheduling]

tech-stack:
  added: [date-fns]
  patterns: [sliding-underline-tabs, hover-reveal-buttons, status-dot-system, tree-connectors]

key-files:
  created:
    - apps/web/src/components/calendar/CalendarViews.tsx
    - apps/web/src/components/calendar/ContentCalendar.tsx
  modified:
    - apps/web/src/components/portal/KeywordTable.tsx
    - apps/web/src/lib/portal/types.ts

key-decisions:
  - "Volume column uses Newsreader serif (font-display) at 18px with relative 3px bar"
  - "Difficulty badge uses semantic colors based on KD value ranges (Easy <= 30, Medium <= 50, Hard <= 70, Very Hard > 70)"
  - "Queue button uses hover-reveal pattern with slide-in animation"
  - "Status dots use distinct patterns: solid (published), hollow (scheduled), gradient half (draft), halo (in_progress), solid red (overdue)"
  - "Calendar views modeled after Notion (month), Linear (week), Superhuman (list)"

patterns-established:
  - "Sliding underline tabs: 2px accent bar under active tab with transition"
  - "Hover-reveal button: opacity-0 -translate-x-1 to opacity-100 translate-x-0"
  - "Priority indicator: 2px accent left border via before pseudo-element"
  - "Tree connectors in list views using font-mono"

requirements-completed: [DS6-KEYWORDS, DS6-CALENDAR]

duration: 5min
completed: 2026-05-06
---

# Phase 94 Plan 04: Data Views Summary

**KeywordTable with v6 sliding tabs and serif volume numerals; ContentCalendar with Notion/Linear/Superhuman-style views**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-06T20:15:17Z
- **Completed:** 2026-05-06T20:20:53Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- KeywordTable updated with sliding underline tab navigation
- Volume column now uses Newsreader serif at 18px with relative bar visualization
- Difficulty badge uses semantic colors (success/warning/error-soft)
- Queue button implements hover-reveal pattern with slide-in animation
- Priority rows have 2px accent left border indicator
- CalendarViews created with MonthView (Notion), WeekView (Linear), ListView (Superhuman)
- ContentCalendar wrapper with view switching, navigation, and status legend
- Status dot system: solid, hollow, half-filled, halo patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Update KeywordTable with v6 styling** - `584674c00` (feat)
2. **Task 2: Create CalendarViews with three view modes** - `0be2e3b11` (feat)
3. **Task 3: Create ContentCalendar wrapper** - `1d8ab7c9c` (feat)

**Additional fix:** `5cafd6660` (fix: add missing KeywordData fields)

## Files Created/Modified

- `apps/web/src/components/portal/KeywordTable.tsx` - Updated with v6 sliding tabs, serif volume, semantic difficulty, hover-reveal queue
- `apps/web/src/components/calendar/CalendarViews.tsx` - MonthView, WeekView, ListView with status dots
- `apps/web/src/components/calendar/ContentCalendar.tsx` - Wrapper with view switching and navigation
- `apps/web/src/lib/portal/types.ts` - Added difficulty, isPriority, isQueued fields to KeywordData

## Decisions Made

- **Volume display:** Newsreader serif at 18px with 3px relative bar below for visual comparison
- **Difficulty thresholds:** Easy (0-30), Medium (31-50), Hard (51-70), Very Hard (71-100)
- **Calendar inspiration:** Month from Notion, Week from Linear, List from Superhuman
- **Status dot patterns:** Distinct visual patterns for each status to avoid color-only differentiation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing KeywordData type fields**
- **Found during:** Task 1 verification
- **Issue:** KeywordTable referenced difficulty, isPriority, isQueued fields not in KeywordData type
- **Fix:** Added optional difficulty, isPriority, isQueued fields to KeywordData interface
- **Files modified:** apps/web/src/lib/portal/types.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 5cafd6660

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type extension required to support new v6 features. No scope creep.

## Issues Encountered

- Pre-existing type error in ConnectionCard.tsx (Badge variant "zinc" not valid) - logged to deferred-items.md, out of scope

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- KeywordTable and ContentCalendar ready for portal integration
- Plan 94-05 (Portal Polish: GoalProgressCard, ClusterCard, StatCard) ready to proceed

---
*Phase: 94-design-system-v6*
*Completed: 2026-05-06*
