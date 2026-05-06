---
phase: 93-keyword-coverage
plan: 06
subsystem: keywords
tags: [ui, coverage, research, dashboard, v6-design-system]
dependency_graph:
  requires: [93-05]
  provides: [coverage-ui, research-mode-ui]
  affects: []
tech_stack:
  added: []
  patterns: [tanstack-start-route, react-hooks, design-system-v6]
key_files:
  created:
    - src/client/features/keywords/components/CoverageDashboard.tsx
    - src/client/features/keywords/components/ResearchModeSelector.tsx
    - src/routes/clients/[id]/keywords/coverage.tsx
  modified: []
decisions:
  - CoverageDashboard fetches from GET /api/keywords/coverage on mount
  - ResearchModeSelector submits to POST /api/keywords/research and displays deduplication results inline
  - Three research modes: EXPAND (new seeds), DEEP_DIVE (cluster expansion), COMPETITOR (gap analysis)
  - Coverage levels shown with semantic colors and icons (comprehensive ✅, moderate ⚠️, minimal 📊, missing ❌)
  - Tier labels map internal tier names to user-friendly labels (must_do → "Must Do (High Priority)")
  - Design system v6 tokens used throughout (surface-2, text-3, accent-soft, success/warning/error)
  - Research button hidden until user clicks "Research New Keywords"
  - Refresh coverage dashboard after research submission via key prop change
metrics:
  duration: 193s
  completed_date: 2026-05-06T20:19:57Z
  tasks_completed: 3
  tasks_total: 3
---

# Phase 93 Plan 06: Coverage Dashboard UI Summary

**One-liner:** Coverage dashboard and research mode selector UI with design system v6 compliance, showing tier breakdown and deduplication results before API calls

## What Was Built

### Task 1: CoverageDashboard Component (COMPLETE)

**Files Created:**
- `src/client/features/keywords/components/CoverageDashboard.tsx` (183 lines)

**Component Features:**
- **Coverage Metrics Display:**
  - Total keywords count
  - Active keywords count
  - Last researched date with `formatDistanceToNow` from date-fns
  
- **Tier Breakdown:**
  - Visual grid showing each priority tier (must_do, should_do, nice_to_have, unclassified)
  - Coverage level badges (comprehensive, moderate, minimal, missing) with semantic colors
  - Emoji icons for quick visual scanning (✅ ⚠️ 📊 ❌)
  - Keyword count per tier

- **Suggested Action:**
  - Accent-soft banner with CoverageCalculator's suggested next action
  - Only shown when there's a recommendation

- **States:**
  - Loading state with Skeleton components
  - Error state with error message in red-bordered card
  - Empty state prompting user to start with EXPAND research

- **Interaction:**
  - "Research New Keywords" button triggers parent callback to show ResearchModeSelector

**Design System v6 Compliance:**
- `bg-surface-2` for stat boxes and tier rows
- `text-text-3` for labels and meta text
- `bg-accent-soft border border-accent text-accent-ink` for suggested action
- `shadow-card` via Card component
- All text meets 12px WCAG floor (14px body, 12px labels)

**Commit:** `5027cc1`

---

### Task 2: ResearchModeSelector Component (COMPLETE)

**Files Created:**
- `src/client/features/keywords/components/ResearchModeSelector.tsx` (174 lines)

**Component Features:**
- **Mode Selection (RadioGroup):**
  - EXPAND: "Fetch new keywords for NEW seed terms. Deduplicates against existing corpus."
  - DEEP_DIVE: "Explore long-tail variants of a specific topic. Best for expanding weak areas."
  - COMPETITOR: "Research competitor ranking keywords. Find opportunities they rank for that you do not."
  - Each mode card shows label + description
  - Clickable cards with hover state (`hover:bg-surface-3`)
  
- **Keyword Input:**
  - Textarea with mode-specific placeholder text
  - Font-mono styling for input visibility
  - Real-time item count display (`X items entered`)
  - Label changes based on mode (Competitor Domains vs Seed Keywords)

- **Research Submission:**
  - POST to `/api/keywords/research` with prospectId, mode, keywords array
  - Calls parent `onSubmit` callback after API response
  - Clears textarea on success (if newCount > 0)

- **Result Display:**
  - Badge showing new keyword count or "No New Keywords"
  - Duplicate count badge if any found
  - Cost saved display: `$X.XX (duplicates not sent to API)`
  - Conditional background color (success green for new keywords, warning yellow for all duplicates)
  - Message field for API feedback

- **Button State:**
  - Disabled when submitting or textarea empty
  - Label changes: "Researching..." during submission

**Design System v6 Compliance:**
- RadioGroup with RadioGroupItem from ui/radio-group
- `bg-surface-2` for mode cards
- `text-text-3` for descriptions
- `text-success` for cost saved message
- Badge variants: `default` and `outline`

**Commit:** `08b8afe`

---

### Task 3: Coverage Page Route (COMPLETE)

**Files Created:**
- `src/routes/clients/[id]/keywords/coverage.tsx` (58 lines)

**Route Features:**
- **TanStack Start Route:**
  - Path: `/clients/$id/keywords/coverage`
  - Extracts prospectId from URL params via `Route.useParams()`
  
- **Layout:**
  - Two-column grid on large screens (`lg:grid-cols-2`)
  - Single column on mobile
  - 6-unit gap between cards

- **State Management:**
  - `showResearch` boolean to toggle ResearchModeSelector visibility
  - `isSubmitting` boolean passed to ResearchModeSelector
  - `refreshKey` integer to force CoverageDashboard re-fetch after research

- **Flow:**
  1. User lands on page → CoverageDashboard fetches coverage
  2. User clicks "Research New Keywords" → `setShowResearch(true)`
  3. ResearchModeSelector appears on right side
  4. User submits research → `handleResearchSubmit` runs
  5. After submission → `refreshKey` increments → CoverageDashboard re-fetches

**Commit:** `9ae65a1`

---

## Deviations from Plan

None. Plan executed exactly as written. All three components created with expected functionality, design system v6 compliance, and integration with Wave 2 API endpoints (93-05).

---

## Integration Points

### Upstream Dependencies (Wave 2)

- **GET /api/keywords/coverage** (93-05):
  - Returns `CoverageSummary` with tier breakdown, last researched date, suggested action
  - Workspace-scoped via prospect.workspaceId check

- **POST /api/keywords/research** (93-05):
  - Accepts `{ prospectId, mode, keywords[] }`
  - Returns `{ newCount, duplicateCount, costUsd, costSavedUsd, message }`
  - Deduplicates before API call to save costs

### Downstream Consumers (Future)

- Navigation links from keyword management pages will point to `/clients/:id/keywords/coverage`
- Coverage metrics can be embedded in client dashboard cards
- Research mode selector pattern can be reused in other prospect workflows

---

## Design System v6 Validation

✅ **Typography:**
- Body text: 14px (design system standard)
- Labels: 12px (WCAG floor)
- Card titles: 15px (`--type-h3`)
- Page title: 2xl Tailwind class (~30px)

✅ **Colors:**
- `bg-surface-2` for neutral backgrounds
- `text-text-3` for labels
- `bg-accent-soft text-accent-ink` for suggested action
- `text-success` / `text-error` for semantic states

✅ **Spacing:**
- `space-y-6` for card content sections
- `gap-4` for stat grid
- `gap-2` / `gap-3` for inline elements

✅ **Components:**
- Card with CardHeader and CardContent
- Badge with semantic variants
- Button with disabled states
- Skeleton for loading states
- RadioGroup with RadioGroupItem

---

## Known Stubs

None. All components are fully functional and ready for human verification.

---

## Threat Flags

None. All data flows through workspace-scoped API routes (T-93-11, T-93-12 mitigations from 93-05).

---

## Self-Check: PASSED

**Created files exist:**
```bash
✓ src/client/features/keywords/components/CoverageDashboard.tsx
✓ src/client/features/keywords/components/ResearchModeSelector.tsx
✓ src/routes/clients/[id]/keywords/coverage.tsx
```

**Commits exist:**
```bash
✓ 5027cc1: feat(93-06): create CoverageDashboard component
✓ 08b8afe: feat(93-06): create ResearchModeSelector component
✓ 9ae65a1: feat(93-06): create coverage page route
```

**Design system compliance:**
- All text >= 12px ✓
- v6 tokens used throughout ✓
- Card primitives from ui package ✓
- Semantic color classes ✓

---

## Next Step: Task 4 Human Verification Checkpoint

Task 4 is `type="checkpoint:human-verify"` — requires human to verify UI before continuing.

**Verification Instructions:**
1. Start dev server: `cd open-seo-main && pnpm dev`
2. Navigate to: `/clients/{prospectId}/keywords/coverage`
3. Verify coverage dashboard displays
4. Click "Research New Keywords"
5. Select mode, enter keywords, submit
6. Verify deduplication results display
7. Confirm cost savings shown when duplicates found

**Expected behavior:** Dashboard shows coverage before research, deduplication prevents redundant API spend, cost savings communicated transparently.
