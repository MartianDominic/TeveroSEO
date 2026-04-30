---
phase: 52-v6-ui-compliance
plan: 02
subsystem: ui
tags: [tailwind, design-system, v6, wcag, accessibility, semantic-colors, scrape-config]

# Dependency graph
requires:
  - phase: 52-01
    provides: v6 patterns established for keyword pipeline components
provides:
  - v6 compliant RuleEditor component with shadow-card and surface-2 panels
  - v6 compliant scrape-config page with consistent styling
  - 12px WCAG text floor across all scrape-config components
affects: [52-03, reports, scrape-config-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - shadow-card for Card components instead of default shadcn border
    - bg-surface-2 for nested panels instead of bg-muted/30
    - text-text-3 for muted/label text instead of text-muted-foreground
    - text-[12px] for WCAG 12px floor compliance
    - text-error for destructive actions instead of text-destructive
    - bg-accent-soft text-accent-ink for primary badges

key-files:
  created: []
  modified:
    - apps/web/src/app/(shell)/prospects/[prospectId]/scrape-config/components/RuleEditor.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/scrape-config/page.tsx

key-decisions:
  - "Use cn() utility from @tevero/ui for conditional className merging with shadow-card"
  - "Replace text-destructive with text-error for v6 semantic color consistency"
  - "Use bg-accent-soft text-accent-ink for Primary badge instead of variant=secondary"
  - "Use var(--radius-card) and var(--radius-input) for v6 border radius consistency"

patterns-established:
  - "Nested panel pattern: bg-surface-2 with rounded-[var(--radius-input)] for form sections"
  - "Card components: shadow-card class on all Card wrappers"
  - "Label styling: text-[12px] text-text-3 for all form labels"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-04-30
---

# Phase 52 Plan 02: Scrape Configuration v6 UI Compliance Summary

**Scrape configuration components updated to v6 design system with shadow-card containers, surface-2 panels, and WCAG 12px text floor**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-30T15:40:14Z
- **Completed:** 2026-04-30T15:45:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- RuleEditor now uses shadow-card on Card wrapper with cn() utility for conditional styling
- FieldEditor nested panels use bg-surface-2 with var(--radius-input) border radius
- All Label elements use text-[12px] text-text-3 for v6 muted label styling
- Destructive buttons updated to use text-error instead of text-destructive
- Primary Badge uses bg-accent-soft text-accent-ink for v6 accent styling
- Scrape-config page Cards all have shadow-card class
- All text-muted-foreground replaced with text-text-3
- All text-xs replaced with text-[12px] for WCAG compliance

## Task Commits

Each task was committed atomically:

1. **Task 1: Update RuleEditor to v6** - `aa40fb503` (feat)
2. **Task 2: Update scrape-config page to v6** - `088902742` (feat)

## Files Created/Modified
- `apps/web/src/app/(shell)/prospects/[prospectId]/scrape-config/components/RuleEditor.tsx` - shadow-card, bg-surface-2 panels, text-text-3 labels, text-error buttons, accent badges
- `apps/web/src/app/(shell)/prospects/[prospectId]/scrape-config/page.tsx` - shadow-card on all Cards, text-text-3 muted text, text-[12px] floor, bg-surface-2 panels

## Decisions Made
- Used `cn()` utility from @tevero/ui to merge "shadow-card" with conditional opacity-60 on disabled rules
- Replaced `text-destructive` with `text-error` throughout for v6 semantic color consistency
- Used `bg-accent-soft text-accent-ink` for Primary badge to match v6 accent styling (instead of variant="secondary")
- Applied `var(--radius-input)` (6px) for nested panel borders and `var(--radius-card)` (12px) for discovery result container

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Pre-existing build error:** apps/web build fails due to unescaped entity in TodaysFeed.tsx (line 149). This is unrelated to scrape-config changes and out of scope for this plan. TypeScript compilation confirms no errors in modified files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Scrape-config components now v6 compliant
- Ready for 52-03 (Final verification and remaining UI components)
- All text now meets WCAG 12px floor requirement
- Consistent use of v6 semantic colors and shadow system

---
*Phase: 52-v6-ui-compliance*
*Completed: 2026-04-30*

## Self-Check: PASSED
