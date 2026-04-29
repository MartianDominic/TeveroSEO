---
phase: 44
plan: 04
subsystem: ui-components
tags: [entity-card, step-wizard, progress-bar, metric-card, typography, numerals, timestamp]
dependency_graph:
  requires: [44-01, 44-02]
  provides: [entity-display, wizard-flow, progress-visualization, kpi-display, typography-primitives, numeral-primitives]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [compound-components, v6-tokens, hover-reveal, newsreader-numerals]
key_files:
  created:
    - packages/ui/src/components/entity-card.tsx
    - packages/ui/src/components/step-wizard.tsx
    - packages/ui/src/components/segmented-progress-bar.tsx
    - packages/ui/src/components/metric-card.tsx
    - packages/ui/src/components/typography.tsx
    - packages/ui/src/components/numerals.tsx
    - packages/ui/src/components/relative-timestamp.tsx
  modified:
    - packages/ui/src/index.ts
decisions:
  - Use React.ElementType for polymorphic typography components (avoids JSX namespace issues)
  - Rename CardTitle to TypographyCardTitle to avoid conflict with card.tsx CardTitle
  - Sparkline uses inline SVG polyline for simplicity (no external chart library)
  - NumDelta infers direction from numeric value sign when not explicitly provided
metrics:
  duration: 7m
  completed: 2026-04-30
  tasks: 3
  files: 8
---

# Phase 44 Plan 04: New Primitives Part 2 Summary

Seven component patterns for entity display, wizards, and typography with full v6 design token integration and Newsreader numeral support.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | EntityCard and StepWizard | fcbca7b97 | entity-card.tsx, step-wizard.tsx |
| 2 | SegmentedProgressBar and MetricCard | 58e1a61b9 | segmented-progress-bar.tsx, metric-card.tsx |
| 3 | Typography, Numerals, RelativeTimestamp | e834723fa | typography.tsx, numerals.tsx, relative-timestamp.tsx |

## What Was Built

### 1. EntityCard (entity-card.tsx)

Generic entity display card with:
- Avatar section (initials, image, or icon)
- Title and subtitle with v6 typography
- Status pill with StatusConfig integration
- CardActionMenu (hover reveal pattern)
- Selection ring (ring-2 ring-accent)
- Hover lift animation (shadow-lift, translateY(-1px))

### 2. StepWizard (step-wizard.tsx)

Multi-step wizard using compound component pattern:
- StepWizard.Header: Progress dots with completed/current/pending states
- StepWizard.Content: Content container with min-height
- StepWizard.Footer: Back/Next/Complete navigation buttons
- Context provider for step state management
- Optional step support with Skip button

### 3. SegmentedProgressBar (segmented-progress-bar.tsx)

Multi-segment progress visualization:
- Auto-calculates percentages from values
- Size variants: sm (h-1), md (h-2), lg (h-3)
- Optional labels and values display
- Uses Newsreader numerals for values
- Default color rotation for segments

### 4. MetricCard (metric-card.tsx)

KPI display card with:
- Label in small-caps (text-type-tiny)
- Value in NumCard size (Newsreader, tabular-nums)
- Optional unit suffix
- Delta indicator with direction icons and colors
- Sparkline (SVG polyline) revealed on hover
- Loading skeleton state
- CardActionMenu (hover reveal)

### 5. Typography Primitives (typography.tsx)

Eight typography components:
- PageTitle: Newsreader, --type-h1, -0.024em tracking
- SectionTitle: Geist, --type-h2, font-medium
- TypographyCardTitle: Geist, --type-h3, font-medium
- Eyebrow: uppercase, 0.1em tracking
- SmallCaps: font-variant-caps: all-small-caps
- Mono: Geist Mono, tabular-nums
- Body: --type-body
- Caption: --type-small

All support polymorphic `as` prop for semantic HTML.

### 6. Numeral Primitives (numerals.tsx)

Six numeral components with Newsreader + tabular-nums:
- NumMega: --num-mega (58-80px)
- NumHero: --num-hero (38-46px)
- NumCard: --num-card (36-44px)
- NumRow: --num-row (20-26px)
- NumTiny: --num-tiny (15-18px)
- NumDelta: with direction color (success/error/text-3)

### 7. RelativeTimestamp (relative-timestamp.tsx)

Timestamp display with:
- formatRelativeTime for human-readable strings
- Full date-time tooltip on hover
- Optional prefix
- Optional mono styling for tabular alignment

## Deviations from Plan

None - plan executed exactly as written.

## Dependencies Note

This plan depends on 44-02 outputs (CardActionMenu, StatusConfig, format-time utilities) which were already committed in previous execution.

## Verification Results

- TypeScript compilation: PASSED
- Task 1 verification: PASSED (EntityCard, StepWizard, shadow-lift)
- Task 2 verification: PASSED (SegmentedProgressBar, MetricCard, delta)
- Task 3 verification: PASSED (PageTitle, NumCard, RelativeTimestamp, font-display)

## Self-Check: PASSED

All files verified to exist:
- entity-card.tsx: FOUND
- step-wizard.tsx: FOUND
- segmented-progress-bar.tsx: FOUND
- metric-card.tsx: FOUND
- typography.tsx: FOUND
- numerals.tsx: FOUND
- relative-timestamp.tsx: FOUND
- index.ts (exports): FOUND

All commits verified:
- fcbca7b97: FOUND
- 58e1a61b9: FOUND
- e834723fa: FOUND
