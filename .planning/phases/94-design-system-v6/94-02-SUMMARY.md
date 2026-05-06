---
phase: 94-design-system-v6
plan: 02
subsystem: ui
tags: [design-system, components, v6, card, button, badge, progress-block]

# Dependency graph
requires:
  - phase: 94-01
    provides: v6 tokens (shadows, typography, spacing)
provides:
  - v6-compliant Card primitive with ghost-edge shadows
  - v6-compliant Button with shadow variants and gradient primary
  - v6-compliant Badge with small-caps and semantic colors
  - ProgressBlock component for editorial numeral pattern
affects: [94-03, 94-04, 94-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ghost-edge shadows replace solid borders
    - hover lift effect (-1px translateY + shadow-lift)
    - font-variant-caps for small-caps (not uppercase)
    - editorial numeral pattern (current / target)

key-files:
  created:
    - packages/ui/src/components/progress-block.tsx
  modified:
    - packages/ui/src/components/card.tsx
    - packages/ui/src/components/button.tsx
    - packages/ui/src/components/badge.tsx
    - packages/ui/src/index.ts
    - packages/ui/src/lib/tokens.css

key-decisions:
  - "Card uses shadow-[var(--shadow-card)] instead of border class"
  - "Primary button uses accent gradient from-[#1A6E55] to-[#0F4F3D]"
  - "Badge uses font-variant-caps: all-small-caps for proper OpenType kerning"
  - "ProgressBlock has three size variants: mega, card, row"

patterns-established:
  - "Ghost-edge shadows: All cards use layered shadows with inset highlights, never border: 1px solid"
  - "Hover lift: Cards and buttons lift -1px on hover with shadow expansion"
  - "Small-caps: Status badges use OpenType small-caps, not text-transform uppercase"
  - "Editorial numerals: Current value is hero-sized, divider and target are muted"

requirements-completed: [DS6-CARD, DS6-BUTTON, DS6-BADGE, DS6-PROGRESS]

# Metrics
duration: 3min
completed: 2026-05-06
---

# Phase 94 Plan 02: Primitives Summary

**Card, Button, Badge rewritten to v6 spec; ProgressBlock created with editorial numeral pattern**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-06T20:02:04Z
- **Completed:** 2026-05-06T20:05:54Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments

- Rewrote Card component with ghost-edge shadows and hover lift effect
- Updated Button with v6 shadow variants and accent gradient primary
- Updated Badge with small-caps typography and semantic color variants
- Created ProgressBlock component for the v6 "editorial moment" pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite card.tsx with v6 ghost-edge shadows** - `e91156bb2` (feat)
2. **Task 2: Update button.tsx with v6 variants** - `e2c56e204` (feat)
3. **Task 3: Update badge.tsx with v6 semantic colors and small-caps** - `a9e03e256` (feat)
4. **Task 4: Create progress-block.tsx component** - `ff88d1de4` (feat)

## Files Created/Modified

- `packages/ui/src/components/card.tsx` - v6 Card with ghost-edge shadows, noHover prop
- `packages/ui/src/components/button.tsx` - v6 Button with shadow variants, gradient primary
- `packages/ui/src/components/badge.tsx` - v6 Badge with small-caps and semantic colors
- `packages/ui/src/components/progress-block.tsx` - NEW: Editorial numeral pattern (12 / 20)
- `packages/ui/src/index.ts` - Added CardProps, ProgressBlock exports
- `packages/ui/src/lib/tokens.css` - Fixed duplicate closing brace

## Decisions Made

1. **Card uses shadow instead of border** - v6 design system mandates ghost-edge shadows for all cards, never border: 1px solid
2. **Primary button uses gradient** - Premium glass-button feel with from-[#1A6E55] to-[#0F4F3D] and shadow-cta
3. **Badge uses OpenType small-caps** - font-variant-caps: all-small-caps provides proper kerning vs text-transform: uppercase
4. **ProgressBlock size variants** - Three sizes (mega, card, row) cover all use cases from goal heroes to table rows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed duplicate closing brace in tokens.css**
- **Found during:** Task 1 (reading tokens.css)
- **Issue:** tokens.css had duplicate closing braces on lines 130-131
- **Fix:** Removed the duplicate brace
- **Files modified:** packages/ui/src/lib/tokens.css
- **Verification:** File now parses correctly
- **Committed in:** e91156bb2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor fix required for CSS validity. No scope creep.

## Issues Encountered

Pre-existing typecheck errors in Storybook files (stories/*.tsx) - out of scope for this plan. The component files themselves compile correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- v6 primitives ready for feature component rewrites
- Ready for 94-03: Pipeline & Quality components
- All card/button/badge consumers can now benefit from v6 styling

---
*Phase: 94-design-system-v6*
*Completed: 2026-05-06*
