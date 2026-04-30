---
phase: 52-v6-ui-compliance
plan: 03
subsystem: ui
tags: [tailwind, design-system, v6, wcag, accessibility, semantic-colors, shadow-card, shadow-lift]

# Dependency graph
requires:
  - phase: 52-01
    provides: v6 patterns for keyword pipeline components
  - phase: 52-02
    provides: v6 patterns for scrape-config components
provides:
  - v6 compliant QuickCheck and Competitor Spy pages
  - v6 compliant EntrySelector with shadow-lift hover effect
  - v6 compliant CSV Import pages and ColumnMapper
  - v6 compliant Client keyword pages (4 files)
  - 12px WCAG text floor across all updated files
  - shadow-card pattern on all Cards and data containers
affects: [reports, keyword-ui, phase-52-complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - shadow-card for Card components and table containers
    - shadow-lift hover:shadow-lift hover:-translate-y-px for interactive cards
    - v6 semantic tokens (success-soft, error-soft, warning-soft, info-soft)
    - text-[12px] for WCAG 12px floor compliance
    - var(--radius-card), var(--radius-input) for consistent border radii
    - bg-surface-2 for muted backgrounds and inset areas
    - text-text-3 for muted text instead of text-muted-foreground

key-files:
  created: []
  modified:
    - apps/web/src/app/(shell)/prospects/keywords/quick-check/page.tsx
    - apps/web/src/app/(shell)/prospects/keywords/quick-check/error.tsx
    - apps/web/src/app/(shell)/prospects/keywords/competitor-spy/page.tsx
    - apps/web/src/app/(shell)/prospects/keywords/competitor-spy/error.tsx
    - apps/web/src/app/(shell)/prospects/keywords/components/EntrySelector.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/page.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/error.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/components/ColumnMapper.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/error.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/[keywordId]/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/[keywordId]/error.tsx

key-decisions:
  - "Use shadow-card on all Card components for v6 glass-edge appearance"
  - "Use shadow-lift with hover:-translate-y-px for interactive card hover states"
  - "Replace all bg-muted with bg-surface-2 for v6 surface ladder"
  - "Replace all text-muted-foreground with text-text-3 for v6 text ramp"
  - "Replace all text-destructive with text-error for v6 semantic colors"
  - "Use var(--radius-card) for table containers and var(--radius-input) for nested panels"
  - "Remove all dark mode variants (dark:bg-*, dark:text-*) as v6 handles theming via CSS variables"
  - "Use bg-accent-soft for selected states instead of bg-primary/10"
  - "Use border-hairline-2 instead of border-b for subtle dividers"

patterns-established:
  - "Competition badges: bg-success-soft text-success (low), bg-warning-soft text-warning (medium), bg-error-soft text-error (high)"
  - "Position badges: bg-success-soft text-success (top 3), bg-info-soft text-info (4-10)"
  - "Confidence badges: bg-success-soft text-success (Auto), bg-info-soft text-info (Likely)"
  - "Format badges: bg-warning-soft (Ahrefs, keywords_only), bg-info-soft (SEMrush), bg-accent-soft (Moz), bg-surface-2 (generic)"
  - "Interactive card hover: shadow-card hover:shadow-lift hover:-translate-y-px transition-all duration-[280ms]"
  - "Table containers: rounded-[var(--radius-card)] shadow-card bg-surface overflow-hidden"
  - "Dropzone: border-2 border-dashed border-hairline-2 bg-surface-2 hover:bg-surface-3"
  - "Error alerts: bg-error-soft text-error rounded-[var(--radius-input)]"

requirements-completed:
  - All UI consistent before reports

# Metrics
duration: 7min
completed: 2026-04-30
---

# Phase 52 Plan 03: Import/Export & Client Keywords v6 UI Compliance Summary

**QuickCheck, Competitor Spy, CSV Import, EntrySelector, ColumnMapper, and Client keyword pages updated to v6 design system with shadow-card containers, semantic colors, shadow-lift hover effects, and WCAG 12px text floor**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-30T15:47:19Z
- **Completed:** 2026-04-30T15:54:09Z
- **Tasks:** 6
- **Files modified:** 12

## Accomplishments

- QuickCheck page now uses shadow-card Cards with v6 competition badges (success-soft, warning-soft, error-soft)
- Competitor Spy page uses shadow-card with v6 position badges (success-soft, info-soft)
- EntrySelector cards have shadow-lift hover effect with -translate-y-px lift and v6 motion timing
- CSV Import page uses v6 dropzone styling with surface-2/surface-3 and v6 format badges
- ColumnMapper Table wrapped in shadow-card container with v6 confidence badges
- All 4 Client keyword pages updated to match prospect keyword v6 patterns
- All error pages updated to use text-error and bg-surface-2
- All text now meets WCAG 12px floor requirement

## Task Commits

Each task was committed atomically:

1. **Task 1: Update QuickCheck page to v6** - `945803ae4` (feat)
2. **Task 2: Update Competitor Spy pages to v6** - `0132e4f3b` (feat)
3. **Task 3: Update EntrySelector cards to v6** - `e87e7be31` (feat)
4. **Task 4: Update Keywords import pages to v6** - `3c7b59a8d` (feat)
5. **Task 5: Update ColumnMapper to v6** - `3decb3fef` (feat)
6. **Task 6: Update Client Keyword pages to v6** - `192415193` (feat)

## Files Modified

### Prospect Keywords (9 files)
- `apps/web/src/app/(shell)/prospects/keywords/quick-check/page.tsx` - shadow-card Cards, v6 competition badges, v6 difficulty colors, bg-surface-2 share link box
- `apps/web/src/app/(shell)/prospects/keywords/quick-check/error.tsx` - text-error icon, text-text-3 for muted text
- `apps/web/src/app/(shell)/prospects/keywords/competitor-spy/page.tsx` - shadow-card Cards, v6 position badges, text-accent links
- `apps/web/src/app/(shell)/prospects/keywords/competitor-spy/error.tsx` - text-error icon, text-text-3 for muted text
- `apps/web/src/app/(shell)/prospects/keywords/components/EntrySelector.tsx` - shadow-lift hover effect, bg-surface-2 icons, v6 motion timing
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/page.tsx` - shadow-card Cards, v6 dropzone, v6 format badges, v6 status badges
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/error.tsx` - text-error icon, text-text-3, bg-surface-2 pre
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/components/ColumnMapper.tsx` - shadow-card Table wrapper, v6 confidence badges

### Client Keywords (4 files)
- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/page.tsx` - shadow-card Cards, bg-surface-2 hover, bg-accent-soft selected, border-hairline-2 dividers
- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/error.tsx` - text-error icon, text-text-3, bg-surface-2 pre
- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/[keywordId]/page.tsx` - shadow-card Cards, text-text-3 links, bg-surface-2 SERP badges
- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/[keywordId]/error.tsx` - text-error icon, text-text-3, bg-surface-2 pre

## Verification Results

- No legacy border patterns (rounded-md border): PASS
- No legacy Tailwind colors: PASS
- No dark mode variants: PASS
- No animate-pulse: PASS
- shadow-card occurrences: 19
- v6 semantic color occurrences: 43
- Client keyword files exist: PASS

## Decisions Made

- Used shadow-lift hover pattern with `-translate-y-px` for EntrySelector interactive cards to match v6 design system section 4.1 card hover specification
- Replaced all `variant="secondary"` badges with explicit v6 color classes (bg-surface-2 text-text-2) for SERP feature badges
- Used bg-accent-soft instead of bg-primary/10 for selected keyword rows to maintain v6 accent consistency
- Applied border-hairline-2 for table header dividers instead of generic border-b
- Used text-accent for links instead of text-blue-600 to maintain single chromatic accent rule

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Phase 52 Completion Status

All 3 plans in Phase 52 are now complete:

| Plan | Focus | Status |
|------|-------|--------|
| 52-01 | Keyword Pipeline Components | Complete |
| 52-02 | Scrape Configuration Components | Complete |
| 52-03 | Import/Export & Client Keywords | Complete |

**Phase 52 v6 UI Compliance: COMPLETE**

---
*Phase: 52-v6-ui-compliance*
*Completed: 2026-04-30*

## Self-Check: PASSED
