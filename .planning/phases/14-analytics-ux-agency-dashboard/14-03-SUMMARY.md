---
phase: 14-analytics-ux-agency-dashboard
plan: 03
subsystem: analytics-components
tags: [frontend, charts, recharts, api]
dependency_graph:
  requires: [14-01]
  provides: [GSCChart, GA4Chart, QueriesTable, DateRangeSelector, StatCard, /api/analytics/{client_id}/full]
  affects: [apps/web per-client analytics page]
tech_stack:
  added: []
  patterns: [Recharts dual-axis LineChart, theme-aware tooltip styling]
key_files:
  created:
    - apps/web/src/components/analytics/StatCard.tsx
    - apps/web/src/components/analytics/GSCChart.tsx
    - apps/web/src/components/analytics/GA4Chart.tsx
    - apps/web/src/components/analytics/DateRangeSelector.tsx
    - apps/web/src/components/analytics/QueriesTable.tsx
  modified:
    - AI-Writer/backend/routers/seo_analytics.py
decisions:
  - formatDate uses unknown type for Recharts labelFormatter compatibility
  - PositionDelta helper component handles TrendingUp/TrendingDown icons
  - Empty state handled in QueriesTable with centered message
metrics:
  duration_seconds: 253
  completed: "2026-04-19T11:19:57Z"
  tasks_completed: 4
  tasks_total: 4
  files_created: 5
  files_modified: 1
---

# Phase 14 Plan 03: Analytics Chart Components + Per-Client API Summary

Recharts chart components for GSC/GA4 visualization plus FastAPI per-client analytics endpoint.

## One-liner

GSCChart (dual-axis clicks/impressions), GA4Chart (sessions), QueriesTable (top 10 with WoW delta), DateRangeSelector (30d/90d), StatCard components plus GET /api/analytics/{client_id}/full endpoint.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add per-client analytics endpoint to FastAPI | ecd2f206 (AI-Writer) | seo_analytics.py |
| 2 | Create StatCard component | 421010be | StatCard.tsx |
| 3 | Create GSCChart component | f8119a2d | GSCChart.tsx |
| 4 | Create GA4Chart, DateRangeSelector, QueriesTable | 2b584b09 | GA4Chart.tsx, DateRangeSelector.tsx, QueriesTable.tsx |

## Key Deliverables

### FastAPI Per-Client Endpoint (AI-Writer/backend/routers/seo_analytics.py)

- `GET /api/analytics/{client_id}/full` returns `AnalyticsData`
- `days` query param (7-90, default 30) controls date range
- GSC daily data from gsc_snapshots with clicks, impressions, ctr, position
- GA4 daily data from ga4_snapshots with sessions, users, bounce_rate
- Top 10 queries from gsc_query_snapshots with WoW position delta
- Summary aggregates for both GSC and GA4

### Chart Components (apps/web/src/components/analytics/)

- **GSCChart**: Dual-axis LineChart with clicks (left Y-axis) and impressions (right Y-axis)
- **GA4Chart**: Single-axis LineChart for sessions over time
- **QueriesTable**: Table with query, clicks, impressions, CTR, position, WoW change indicators
- **DateRangeSelector**: Select dropdown for 30d/90d toggle
- **StatCard**: Reusable card with label, value, optional subtitle and trend indicator

### Component Features

- All charts use ResponsiveContainer with 280px height
- Theme-aware tooltip styling using CSS variables
- Date formatting for x-axis labels (e.g., "Apr 15")
- Number formatting with k suffix for thousands
- PositionDelta helper shows TrendingUp (green) for improved, TrendingDown (red) for worsened
- Empty state in QueriesTable when no data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts labelFormatter type signature**
- **Found during:** Verification (type check)
- **Issue:** formatDate function with `string` param incompatible with Recharts Tooltip labelFormatter which expects `ReactNode` (can be undefined)
- **Fix:** Changed param type to `unknown` with null check
- **Files modified:** GSCChart.tsx, GA4Chart.tsx
- **Commit:** 553dcb8e

## Verification Results

- TypeScript compiles without errors (`pnpm --filter @tevero/web exec tsc --noEmit`)
- API routes verified: `/api/analytics/dashboard`, `/api/analytics/{client_id}/full`
- All 5 component files created in `apps/web/src/components/analytics/`

## Threat Surface Scan

No new threat surface introduced beyond plan's threat_model:
- T-14-05 (Tampering): client_id validated as UUID by FastAPI
- T-14-06 (Information Disclosure): days param constrained to 7-90 via Query validator

## Self-Check: PASSED

- [x] apps/web/src/components/analytics/StatCard.tsx exists
- [x] apps/web/src/components/analytics/GSCChart.tsx exists
- [x] apps/web/src/components/analytics/GA4Chart.tsx exists
- [x] apps/web/src/components/analytics/DateRangeSelector.tsx exists
- [x] apps/web/src/components/analytics/QueriesTable.tsx exists
- [x] AI-Writer/backend/routers/seo_analytics.py updated with per-client endpoint
- [x] Commit 421010be exists (Task 2)
- [x] Commit f8119a2d exists (Task 3)
- [x] Commit 2b584b09 exists (Task 4)
- [x] Commit ecd2f206 exists in AI-Writer (Task 1)
- [x] Commit 553dcb8e exists (type fix)
