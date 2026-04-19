---
phase: 14-analytics-ux-agency-dashboard
plan: 04
subsystem: analytics-page
tags: [frontend, nextjs, server-actions, analytics, per-client]
dependency_graph:
  requires: [14-02, 14-03]
  provides: [Per-client analytics page, fetchAnalyticsData server action]
  affects: [Client analytics workflow]
tech_stack:
  added: []
  patterns: [Server action data fetching, useTransition for loading states]
key_files:
  created:
    - apps/web/src/app/(shell)/clients/[clientId]/analytics/actions.ts
  modified:
    - apps/web/src/app/(shell)/clients/[clientId]/analytics/page.tsx
decisions:
  - useTransition + overlay spinner for date range changes (non-blocking UX)
  - Empty state prompts user to connect Google account
  - formatNumber helper formats large numbers with k/M suffixes
  - SEO Audit section links to /clients/[id]/seo
metrics:
  duration_seconds: 0
  completed: "2026-04-19T11:24:05Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 1
---

# Phase 14 Plan 04: Per-Client Analytics Page Summary

Per-client analytics page at /clients/[clientId]/analytics with GSC and GA4 data side by side, date range selector, and summary stats.

## One-liner

Server action fetchAnalyticsData calls FastAPI /api/analytics/{client_id}/full; page renders GSC chart, GA4 chart, summary cards, top queries table with 30d/90d toggle and empty state handling.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create server action for analytics data | 8e6f1326 | actions.ts |
| 2 | Rewrite per-client analytics page | 7dda6423 | page.tsx |
| 3 | Human verification checkpoint | n/a | User approved |

## Key Deliverables

### Server Action (apps/web/src/app/(shell)/clients/[clientId]/analytics/actions.ts)

- `fetchAnalyticsData(clientId, days)` calls backend via `getFastApi`
- Returns `AnalyticsData | null` with error handling
- Days parameter accepts 30 or 90

### Analytics Page (apps/web/src/app/(shell)/clients/[clientId]/analytics/page.tsx)

- **Loading state**: Skeleton placeholders for all sections
- **Error state**: Retry button with AlertCircle icon
- **Empty state**: "No analytics data yet" with Connect Google CTA
- **Data state**: Full analytics dashboard with:
  - Search Performance section: GSC summary cards (clicks, impressions, CTR, avg position) + GSCChart + QueriesTable
  - Traffic section: GA4 summary cards (sessions, users, conversions, bounce rate) + GA4Chart
  - SEO Audit link section

### Features

- DateRangeSelector toggles between 30d and 90d views
- useTransition provides loading overlay during date range changes
- formatNumber helper displays large numbers with k/M suffixes
- Conditional rendering shows only sections with data
- 289 lines of code (exceeds 80-line minimum)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

User confirmed via checkpoint:
- Dashboard page loads at /dashboard
- Per-client analytics page loads at /clients/[clientId]/analytics
- Date range selector functions correctly
- Empty state shows when no GSC/GA4 data
- TypeScript build passes without errors

## Threat Surface Scan

No new threat surface introduced beyond plan's threat_model:
- T-14-07 (Information Disclosure): Server action uses Clerk JWT; backend validates client access
- T-14-08 (Denial of Service): useTransition prevents rapid re-fetching during date changes

## Self-Check: PASSED

- [x] apps/web/src/app/(shell)/clients/[clientId]/analytics/actions.ts exists
- [x] apps/web/src/app/(shell)/clients/[clientId]/analytics/page.tsx exists (289 lines)
- [x] Commit 8e6f1326 exists (Task 1)
- [x] Commit 7dda6423 exists (Task 2)
- [x] Human verification approved (Task 3)

## Phase 14 Complete

With this plan complete, Phase 14 (Analytics UX - Agency Dashboard) is finished:
- Plan 01: TypeScript types + FastAPI dashboard endpoint + Dashboard nav item
- Plan 02: Dashboard page with StatusBadge, DashboardTable, needs attention section
- Plan 03: Chart components (GSCChart, GA4Chart, QueriesTable, DateRangeSelector, StatCard)
- Plan 04: Per-client analytics page with server action

All success criteria met:
- /dashboard loads <1s with server-rendered data
- Clients show 30-day GSC metrics
- Traffic drops >20% WoW appear in "Needs attention" section
- Unconnected clients show invite CTA
- /clients/[id]/analytics renders GSC chart + GA4 summary + top queries
- Recharts used for all charts

---
*Phase: 14-analytics-ux-agency-dashboard*
*Completed: 2026-04-19*
