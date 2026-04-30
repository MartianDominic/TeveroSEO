---
phase: 52-v6-ui-compliance
plan: 01
subsystem: ui
tags: [tailwind, design-system, v6, wcag, accessibility, semantic-colors]

# Dependency graph
requires:
  - phase: 44-component-library
    provides: v6 design tokens in tokens.css and globals.css
provides:
  - v6 compliant keyword pipeline components (KeywordTable, TierFilter, ScoreWeightEditor)
  - v6 compliant keyword components (PositionBadge, RankHistoryChart, RankSparkline)
  - 12px WCAG text floor across keyword UI
  - shadow-card pattern on data containers
affects: [52-02, 52-03, reports, keyword-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - shadow-card for table/card containers instead of rounded-md border
    - v6 semantic tokens (success, error, warning, info, text-3) for status colors
    - text-[12px] for WCAG 12px floor compliance
    - var(--radius-card), var(--radius-input) for consistent border radii

key-files:
  created: []
  modified:
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/KeywordTable.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/TierFilter.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/ScoreWeightEditor.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/error.tsx
    - apps/web/src/components/keywords/PositionBadge.tsx
    - apps/web/src/components/keywords/RankHistoryChart.tsx
    - apps/web/src/components/keywords/RankSparkline.tsx

key-decisions:
  - "Use text-[12px] instead of text-xs to enforce WCAG 12px floor"
  - "Replace dark mode variants with v6 tokens that handle theming via CSS variables"
  - "Use bg-surface-2 for ignore tier (neutral) instead of info-soft"
  - "Use var(--success/error/text-3) in chart components for CSS variable compatibility"

patterns-established:
  - "v6 semantic colors: error-soft/error for critical, warning-soft/warning for caution, info-soft/info for neutral-positive, surface-2/text-3 for neutral"
  - "shadow-card replaces rounded-md border on all data containers"
  - "12px floor: all visible text uses text-[12px] minimum, never text-xs"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-04-30
---

# Phase 52 Plan 01: Keyword Pipeline v6 UI Compliance Summary

**Keyword pipeline components updated to v6 design system with shadow-card containers, semantic colors, and WCAG 12px text floor**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-30T15:32:43Z
- **Completed:** 2026-04-30T15:37:40Z
- **Tasks:** 5
- **Files modified:** 7

## Accomplishments
- KeywordTable now uses shadow-card bg-surface instead of rounded-md border
- TierFilter badges use v6 semantic-soft backgrounds with consistent 12px text
- ScoreWeightEditor validation feedback uses v6 semantic colors
- PositionBadge improved/declined states use v6 success/error tokens
- Chart components (RankHistoryChart, RankSparkline) use CSS variable tokens for trend colors

## Task Commits

Each task was committed atomically:

1. **Task 1: Update KeywordTable to v6** - `cb0a8b090` (feat)
2. **Task 2: Update TierFilter badges to v6** - `2db25c553` (feat)
3. **Task 3: Update ScoreWeightEditor to v6** - `f53024058` (feat)
4. **Task 4: Update PositionBadge and error.tsx to v6** - `b1c92e7e3` (feat)
5. **Task 5: Update chart components to v6** - `7d6a0881b` (feat)

## Files Created/Modified
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/KeywordTable.tsx` - shadow-card wrapper, v6 quick win and KD colors
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/TierFilter.tsx` - v6 tier badge colors, 12px text floor
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/ScoreWeightEditor.tsx` - shadow-card on Card, v6 validation colors
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/error.tsx` - 12px text floor on error details
- `apps/web/src/components/keywords/PositionBadge.tsx` - v6 success/error colors, 12px delta text
- `apps/web/src/components/keywords/RankHistoryChart.tsx` - v6 reference line colors, 12px legend text
- `apps/web/src/components/keywords/RankSparkline.tsx` - v6 trend colors via CSS variables

## Decisions Made
- Used `text-[12px]` instead of `text-xs` to explicitly enforce WCAG 12px floor (text-xs in Tailwind defaults to 0.75rem which may be less than 12px)
- Removed all dark mode variants (dark:bg-*, dark:text-*) since v6 design system handles theming via CSS custom properties
- Used `bg-surface-2 text-text-3` for "ignore" tier since it's a neutral/inactive state (not semantic)
- Used CSS variables directly in chart stroke colors (var(--success), var(--error), var(--text-3)) for recharts compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Keyword pipeline components now v6 compliant
- Ready for 52-02 (Additional UI components) and 52-03 (Final verification)
- Import page (keywords/import/page.tsx) identified with legacy colors but out of scope for this plan

---
*Phase: 52-v6-ui-compliance*
*Completed: 2026-04-30*

## Self-Check: PASSED
- All 7 modified files verified to exist
- All 5 task commits verified in git log
