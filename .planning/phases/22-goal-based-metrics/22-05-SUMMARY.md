# Summary 22-05: Dashboard Integration

**Phase:** 22 - Goal-Based Metrics System  
**Status:** Complete  
**Date:** 2026-04-20

---

## Objective

Replace health score displays with goal attainment throughout the dashboard. Update sorting to use priority score. Show goal progress prominently.

---

## Completed Tasks

### Task 1: GoalAttainmentBadge Component
**Status:** Already Complete (from 22-04)

The `GoalAttainmentBadge` component was already implemented with:
- Color-coded badges based on attainment percentage
- Trend indicators (up/down/flat)
- Dark mode support
- "No goals" state handling
- Compact size variant

**File:** `apps/web/src/components/dashboard/GoalAttainmentBadge.tsx`

### Task 2: PortfolioHealthSummary Update
**Status:** Already Complete (from 22-04)

The `PortfolioHealthSummary` component already displays:
- Average goal attainment with trend
- Goals met / total goals
- Client status distribution (on track, watching, critical)
- Integration with `usePortfolioAggregates` hook

**File:** `apps/web/src/components/dashboard/PortfolioHealthSummary.tsx`

### Task 3: ClientPortfolioTable Update
**Status:** Already Complete (from 22-04)

The `ClientPortfolioTable` component already:
- Shows GoalAttainmentBadge when client has goals
- Falls back to HealthScoreBadge when no goals configured
- Displays primary goal name under badge

**Updated:** Fixed TypeScript error in sort function to handle nullable `goalAttainmentPct` and `priorityScore` fields.

**File:** `apps/web/src/components/dashboard/ClientPortfolioTable.tsx`

### Task 4: NeedsAttentionSection Update
**Status:** Complete

Updated to show goal gaps alongside alerts:
- Added `goal_gap` attention item type
- Added Target icon for goal-related items
- Added GoalAttainmentBadge display for items with goal data
- Extended `AttentionItem` interface with goal fields

**File:** `apps/web/src/components/dashboard/NeedsAttentionSection.tsx`

### Task 5: ClientTableHoverPopover Update
**Status:** Complete

Added `GoalsHoverPopover` component for goal preview on hover:
- Shows overall attainment percentage
- Displays goals met / total
- Lists top 3 goals with attainment
- "+N more goals" indicator

**File:** `apps/web/src/components/dashboard/ClientTableHoverPopover.tsx`

### Task 6: Goals Tab in Client Settings
**Status:** Complete

Added Goals tab to client settings page:
- New "Goals" tab in TabsList
- TabsContent with ClientGoalsManager component
- Description text explaining goals purpose

**File:** `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx`

### Task 7: Dashboard Data Fetching
**Status:** Already Complete (from prior phases)

Dashboard actions already include goal-based metrics in PortfolioSummary.

**File:** `apps/web/src/app/(shell)/dashboard/actions.ts`

### Task 8: HealthScoreBadge Deprecation
**Status:** Complete

Added JSDoc deprecation notice to HealthScoreBadge:
- `@deprecated` tag with migration guidance
- Component kept for backwards compatibility

**File:** `apps/web/src/components/dashboard/HealthScoreBadge.tsx`

### Task 9: Dashboard Types Update
**Status:** Complete

Updated types with:
- Extended `AttentionItem` with goal fields and `goal_gap` type
- Added `goalAttainmentPct` and `priorityScore` to `ClientSortKey`
- Added new `PortfolioMetrics` interface for goal tracking

**File:** `apps/web/src/lib/dashboard/types.ts`

---

## Verification

- [x] GoalAttainmentBadge displays correctly
- [x] Portfolio summary shows goal distribution
- [x] Client table shows goal progress column
- [x] Sorting by priority score works
- [x] Needs attention shows goal gaps
- [x] Hover popovers show goals (GoalsHoverPopover added)
- [x] Client detail page has Goals tab (in Settings)
- [x] Health score badge deprecated
- [x] `pnpm tsc --noEmit` passes

---

## Files Changed

| File | Change Type |
|------|-------------|
| `apps/web/src/components/dashboard/GoalAttainmentBadge.tsx` | Previously complete |
| `apps/web/src/components/dashboard/PortfolioHealthSummary.tsx` | Previously complete |
| `apps/web/src/components/dashboard/ClientPortfolioTable.tsx` | Modified (fixed TS error) |
| `apps/web/src/components/dashboard/NeedsAttentionSection.tsx` | Modified |
| `apps/web/src/components/dashboard/ClientTableHoverPopover.tsx` | Modified |
| `apps/web/src/components/dashboard/HealthScoreBadge.tsx` | Modified |
| `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx` | Modified |
| `apps/web/src/lib/dashboard/types.ts` | Modified |

---

## Notes

1. **GoalAttainmentBadge vs HealthScoreBadge**: The table now shows GoalAttainmentBadge when a client has goals configured, and falls back to the deprecated HealthScoreBadge for clients without goals. This ensures backward compatibility.

2. **Goals Tab Location**: Per the existing UI structure, the Goals tab was added to the client Settings page rather than creating a separate route, maintaining consistency with the tabbed settings UI.

3. **TypeScript Fix**: The sort function in ClientPortfolioTable needed explicit null handling for the new nullable sort keys (`goalAttainmentPct`, `priorityScore`).
