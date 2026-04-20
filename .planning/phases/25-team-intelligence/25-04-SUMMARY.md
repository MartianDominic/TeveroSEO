---
phase: "25"
plan: "04"
subsystem: analytics
tags: [opportunities, intelligence, detection, ctr, ranking]
dependency_graph:
  requires: [dashboard-metrics, gsc-data, keyword-rankings]
  provides: [opportunity-detection, opportunity-panel, opportunity-api]
  affects: [client-dashboard, analytics-views]
tech_stack:
  added: []
  patterns: [bff-pattern, priority-matrix, impact-effort-scoring]
key_files:
  created:
    - apps/web/src/types/opportunities.ts
    - apps/web/src/lib/analytics/opportunities.ts
    - apps/web/src/actions/analytics/get-opportunities.ts
    - apps/web/src/components/dashboard/OpportunitiesPanel.tsx
    - apps/web/src/components/dashboard/OpportunityCard.tsx
  modified: []
decisions:
  - "Priority matrix uses 9-point scale (high/low = 9, low/high = 1)"
  - "Expected CTR lookup table based on industry averages by position"
  - "CTR gap threshold of 2% to avoid noise from minor variations"
  - "Ranking gap detection targets positions 11-20 (almost page 1)"
  - "Quick wins focus on recent drops from top 10 positions"
metrics:
  duration_seconds: 296
  completed_at: "2026-04-20T12:52:50Z"
---

# Phase 25 Plan 04: Opportunity Identification Summary

Opportunity detection system that surfaces actionable insights from client analytics data.

## Completed Tasks

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create opportunity types | de01a21b | src/types/opportunities.ts |
| 2 | Create opportunity detection algorithms | e31682ed | src/lib/analytics/opportunities.ts |
| 3 | Create server action for opportunities | cb37a28c | src/actions/analytics/get-opportunities.ts |
| 4 | Create OpportunitiesPanel component | 3041eb8d | src/components/dashboard/OpportunitiesPanel.tsx |
| 5 | Create OpportunityCard component | 8f83d22d | src/components/dashboard/OpportunityCard.tsx |

## Implementation Details

### Opportunity Types

Four opportunity types defined:
- **CTR Improvement**: High impressions with below-expected CTR
- **Ranking Gap**: Keywords at positions 11-20 (almost page 1)
- **Quick Win**: Recently dropped rankings that can be recovered
- **Content Opportunity**: Placeholder for future content gap detection

### Detection Algorithms

1. **CTR Detection**: Compares actual CTR against expected CTR by position (industry averages). Flags queries with 2%+ gap and 100+ impressions.

2. **Ranking Gaps**: Finds keywords at positions 11-20 that need small improvements to reach page 1.

3. **Quick Wins**: Identifies keywords that recently dropped from good positions (top 10) and could be recovered.

### Priority Scoring

Uses impact/effort matrix for prioritization:
- High impact + Low effort = Priority 9 (best)
- Low impact + High effort = Priority 1 (lowest)

### UI Components

- **OpportunitiesPanel**: Compact list view with badges showing impact/effort
- **OpportunityCard**: Detailed view with metrics visualization, keywords, pages, and action buttons

## Deviations from Plan

### [Rule 1 - Bug] TypeScript route typing fix

- **Found during:** Task 4 verification
- **Issue:** Next.js strict route typing rejected dynamic route string
- **Fix:** Used `Parameters<typeof Link>[0]["href"]` type cast pattern
- **Files modified:** OpportunitiesPanel.tsx

## Verification

- [x] CTR improvement opportunities detected (algorithm implemented)
- [x] Ranking gap opportunities detected (positions 11-20 filtered)
- [x] Quick win opportunities detected (recent drops tracked)
- [x] Priority sorting works correctly (impact/effort matrix)
- [x] Opportunities panel displays properly (with skeleton loading)
- [x] Filter by type works (OpportunityFilter interface)
- [x] `pnpm tsc --noEmit` passes

## Self-Check: PASSED

- [x] src/types/opportunities.ts exists
- [x] src/lib/analytics/opportunities.ts exists
- [x] src/actions/analytics/get-opportunities.ts exists
- [x] src/components/dashboard/OpportunitiesPanel.tsx exists
- [x] src/components/dashboard/OpportunityCard.tsx exists
- [x] Commit de01a21b exists
- [x] Commit e31682ed exists
- [x] Commit cb37a28c exists
- [x] Commit 3041eb8d exists
- [x] Commit 8f83d22d exists
