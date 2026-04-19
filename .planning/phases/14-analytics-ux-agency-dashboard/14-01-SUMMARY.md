---
phase: 14-analytics-ux-agency-dashboard
plan: 01
subsystem: analytics-api
tags: [api, types, navigation]
dependency_graph:
  requires: [gsc_snapshots, ga4_snapshots, client_oauth_tokens]
  provides: [/api/analytics/dashboard, DashboardClient, ClientStatus]
  affects: [apps/web sidebar navigation]
tech_stack:
  added: []
  patterns: [SQL aggregation with FILTER, CTE for complex queries]
key_files:
  created:
    - apps/web/src/lib/analytics/types.ts
    - AI-Writer/backend/routers/seo_analytics.py
  modified:
    - AI-Writer/backend/main.py
    - apps/web/src/components/shell/AppShell.tsx
decisions:
  - DASHBOARD_NAV placed before CLIENT_NAV (agency-level view first)
  - LayoutGrid icon for Dashboard (distinct from per-client LayoutDashboard)
  - Dashboard href uses () => "/dashboard" (not client-scoped)
metrics:
  duration_seconds: 238
  completed: "2026-04-19T14:13:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 14 Plan 01: Dashboard API + Types + Nav Summary

Dashboard analytics API with TypeScript types and sidebar nav integration.

## One-liner

FastAPI /api/analytics/dashboard endpoint with SQL aggregation for 30-day metrics, WoW change, status badges, plus TypeScript types and Dashboard nav item in AppShell.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create TypeScript analytics types | 9b57fe73 | apps/web/src/lib/analytics/types.ts |
| 2 | Create FastAPI dashboard endpoint | 57e29613 (AI-Writer) | routers/seo_analytics.py, main.py |
| 3 | Add Dashboard nav item to AppShell | 2c8e7561 | AppShell.tsx |

## Key Deliverables

### TypeScript Types (apps/web/src/lib/analytics/types.ts)

- `ClientStatus`: "good" | "drop" | "no_gsc" | "stale"
- `DashboardClient`: id, name, clicks_30d, impressions_30d, avg_position, wow_change, status, last_sync
- `GSCDataPoint`, `GA4DataPoint`: chart data structures
- `TopQuery`: query table row with position_delta
- `GSCSummary`, `GA4Summary`, `AnalyticsData`: per-client analytics structures

### FastAPI Endpoint (AI-Writer/backend/routers/seo_analytics.py)

- `GET /api/analytics/dashboard` returns `List[DashboardClient]`
- SQL CTE aggregates gsc_snapshots for 30-day metrics
- WoW change calculated as (clicks_7d - clicks_prev_7d) / clicks_prev_7d
- Status badge logic:
  - `no_gsc`: no active Google token in client_oauth_tokens
  - `stale`: last_sync > 48 hours ago
  - `drop`: WoW change < -20%
  - `good`: everything else
- Results sorted by clicks_30d DESC

### Navigation (apps/web/src/components/shell/AppShell.tsx)

- `LayoutGrid` icon imported from lucide-react
- `DASHBOARD_NAV` constant: global nav item, href="/dashboard"
- Rendered at top of sidebar nav, before "Client" section

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeScript types compile without errors
- FastAPI router imports without errors
- Dashboard nav item exists in AppShell (2 references)

## Threat Surface Scan

No new threat surface introduced beyond what is documented in plan's threat_model:
- T-14-01 (Information Disclosure): Endpoint requires Clerk JWT, data scoped by user's org
- T-14-02 (Spoofing): SQL is read-only aggregation, no user input in query

## Self-Check: PASSED

- [x] apps/web/src/lib/analytics/types.ts exists
- [x] AI-Writer/backend/routers/seo_analytics.py exists
- [x] Commit 9b57fe73 exists (Task 1)
- [x] Commit 57e29613 exists in AI-Writer (Task 2)
- [x] Commit 2c8e7561 exists (Task 3)
