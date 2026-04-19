---
phase: 17-rank-tracking-history
plan: 03
subsystem: ui
tags: [recharts, sparkline, keywords, charts]
dependency_graph:
  requires: [keywordRankings table from 17-01, ranking-worker from 17-02]
  provides: [RankSparkline, RankHistoryChart, PositionBadge, keyword detail page]
  affects: [keywords page UI, user ranking visualization]
tech_stack:
  added: []
  patterns: [Recharts LineChart, inverted Y-axis for positions, ResponsiveContainer]
key_files:
  created:
    - apps/web/src/components/keywords/RankSparkline.tsx
    - apps/web/src/components/keywords/RankHistoryChart.tsx
    - apps/web/src/components/keywords/PositionBadge.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/[keywordId]/page.tsx
  modified:
    - apps/web/src/actions/seo/keywords.ts
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/page.tsx
decisions:
  - "Inverted Y-axis on charts (position 1 at top)"
  - "Green stroke for improvement, red for decline in sparklines"
  - "Reference lines at top 3 (green) and top 10 (muted) positions"
  - "Router push type cast pattern for dynamic routes"
metrics:
  duration_minutes: 8
  completed_at: "2026-04-19T17:21:00Z"
---

# Phase 17 Plan 03: Rankings History UI Summary

Recharts-based ranking visualization with sparklines in keyword list and full position charts in detail view

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create API endpoint for keyword ranking history | 317720f2 | keywords.ts (actions) |
| 2 | Create sparkline and position badge components | b3c66e2a | RankSparkline.tsx, PositionBadge.tsx |
| 3 | Create rank history chart component | 0a3089ea | RankHistoryChart.tsx |
| 4 | Extend keywords page with sparkline column | bc69cc04 | keywords/page.tsx |
| 5 | Create keyword detail page with history chart | b2332145 | keywords/[keywordId]/page.tsx |

## Implementation Details

### RankSparkline.tsx

- Compact 30-day position sparkline (96px x 32px)
- Inverts position values (100 - position) so lower positions appear higher
- Green stroke for improvement (latest < first)
- Red stroke for decline (latest > first)
- Gray stroke for stable
- Click handler for navigation

### PositionBadge.tsx

- Displays current position with change indicator
- Green with up arrow for positive change (improved)
- Red with down arrow for negative change (declined)
- Gray dash for no change
- "Not ranking" badge for null/0 position

### RankHistoryChart.tsx

- Full 30/90-day position chart with toggle buttons
- Inverted Y-axis (reversed: position 1 at top)
- Reference lines at position 3 (green) and 10 (muted)
- Custom tooltip showing position, URL, and SERP features
- Responsive container with 280px height

### Keywords Page Updates

- Replaced getSavedKeywords with getSavedKeywordsWithRankings
- Added header row with Trend/Position columns
- Added RankSparkline for each keyword
- Added PositionBadge showing current position
- Made rows clickable to navigate to detail page

### Keyword Detail Page

- Back button to keywords list
- Current Position card with PositionBadge
- Ranking URL with external link icon
- SERP Features badges
- Position History chart with 30/90-day toggle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Router type casting**
- **Found during:** Task 4
- **Issue:** Next.js typed routes required cast for dynamic segments
- **Fix:** Applied `as Parameters<typeof router.push>[0]` pattern
- **Files modified:** keywords/page.tsx, keywords/[keywordId]/page.tsx

**2. [Rule 2 - Missing] open-seo-main routes not committed**
- **Found during:** Task 1
- **Issue:** open-seo-main directory in .gitignore (separate repo)
- **Fix:** Created ranking-history.ts service and keyword-rankings.ts route in open-seo-main, committed only apps/web server actions
- **Note:** Backend changes exist locally but require separate commit to open-seo-main repo

## Verification

- TypeScript compilation: PASSED (apps/web)
- Components created: RankSparkline, RankHistoryChart, PositionBadge
- Keywords page: Sparkline and position columns added
- Detail page: Chart with 30/90 toggle functional

## Self-Check: PASSED

- [x] RankSparkline.tsx exists with green/red/gray stroke logic
- [x] RankHistoryChart.tsx exists with 30/90 toggle and inverted Y-axis
- [x] PositionBadge.tsx exists with up/down/stable indicators
- [x] keywords/page.tsx imports and renders sparkline/badge
- [x] keywords/[keywordId]/page.tsx exists with chart and position card
- [x] All commits verified: 317720f2, b3c66e2a, 0a3089ea, bc69cc04, b2332145
