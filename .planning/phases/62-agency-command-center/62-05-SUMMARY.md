---
phase: 62-agency-command-center
plan: 05
subsystem: frontend/dashboard
tags: [command-center, dashboard, recharts, dnd-kit, tanstack-query]
completed_at: "2026-05-02T18:38:05Z"
duration_seconds: 307

dependency_graph:
  requires:
    - 62-04 (MetricsService, PipelineMetricsRepository, API endpoint)
  provides:
    - Command Center dashboard page
    - Dashboard metrics hook
    - Pipeline visualization components
  affects:
    - apps/web routing (new /command-center route)

tech_stack:
  added:
    - Recharts FunnelChart for pipeline funnel
    - dnd-kit sortable for draggable cards
  patterns:
    - Server Components with initial data fetch
    - TanStack Query for client-side refresh
    - Suspense boundaries for progressive loading

key_files:
  created:
    - apps/web/src/app/(dashboard)/command-center/page.tsx
    - apps/web/src/app/(dashboard)/command-center/layout.tsx
    - apps/web/src/app/(dashboard)/command-center/_components/TodayActionBar.tsx
    - apps/web/src/app/(dashboard)/command-center/_components/PipelineHealthCards.tsx
    - apps/web/src/app/(dashboard)/command-center/_components/RevenuePipeline.tsx
    - apps/web/src/app/(dashboard)/command-center/_components/PipelineFunnel.tsx
    - apps/web/src/app/(dashboard)/command-center/_components/DashboardSkeleton.tsx
    - apps/web/src/components/command-center/DraggableCard.tsx
    - apps/web/src/components/command-center/TrendIndicator.tsx
    - apps/web/src/hooks/command-center/useDashboardMetrics.ts
    - apps/web/src/server/features/command-center/api/metrics.ts
    - apps/web/src/app/api/command-center/metrics/route.ts
    - apps/web/src/types/dashboard-metrics.ts
  modified: []

decisions:
  - "Server Components fetch initial metrics for fast first paint"
  - "TanStack Query with 5-minute refetch interval matches backend computation cycle"
  - "4-minute stale time prevents unnecessary refetches"
  - "Suspense boundaries allow progressive loading of widgets"
  - "DraggableCard uses dnd-kit but requires DndContext parent for actual drag"
  - "TrendIndicator supports positiveIsGood flag for metrics where lower is better"

metrics:
  tasks_completed: 3
  files_created: 13
  lines_added: 1036
---

# Phase 62 Plan 05: Command Center Dashboard Core Summary

Command Center dashboard with Server Components, TanStack Query refresh, and Recharts funnel visualization.

## One-liner

Dashboard page with Today Bar, Pipeline Health Cards (4 entity types), Revenue Pipeline, and Recharts conversion funnel with 5-minute auto-refresh.

## What Was Built

### Task 1: Dashboard Page Structure and Data Hook

- **page.tsx**: Server Component with Clerk auth, initial metrics fetch, Suspense boundaries
- **layout.tsx**: Metadata (title/description) wrapper
- **useDashboardMetrics.ts**: TanStack Query hook with 5-minute refetch, 4-minute stale time
- **metrics.ts (server)**: Server-side API calling open-seo backend with error handling
- **route.ts (api)**: Next.js API route for client-side fetching with workspace validation
- **dashboard-metrics.ts**: TypeScript interfaces for all metric types

### Task 2: TodayActionBar and PipelineHealthCards

- **TodayActionBar**: Shows overdue/due today/awaiting you/new counts with Badge variants
- **PipelineHealthCards**: 4 cards (Prospects/Proposals/Agreements/Payments) with stage breakdowns
- **DraggableCard**: dnd-kit wrapper for future card reordering
- **TrendIndicator**: Up/down/stable arrows with percentage change calculation

### Task 3: RevenuePipeline and PipelineFunnel

- **RevenuePipeline**: This month, last month, outstanding, overdue amounts with TrendIndicator
- **PipelineFunnel**: Recharts FunnelChart showing conversion stages (New -> Qualified -> Sent -> Signed -> Paid)
- **DashboardSkeleton**: Loading skeletons matching widget dimensions

## Architecture

```
CommandCenterPage (Server Component)
  |-- auth() -> workspaceId
  |-- getDashboardMetrics() -> initial data
  |
  +-- Suspense
        |-- TodayActionBar (Client)
        |     +-- useDashboardMetrics (5-min refresh)
        |
        |-- PipelineHealthCards (Client)
        |     +-- DraggableCard x4
        |     +-- useDashboardMetrics
        |
        |-- RevenuePipeline (Server-rendered)
        |
        +-- PipelineFunnel (Client)
              +-- Recharts FunnelChart
              +-- useDashboardMetrics
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 22555d0ca | feat | Command Center dashboard core with pipeline widgets |

## Deviations from Plan

None - plan executed exactly as written.

## Known Dependencies

- **62-04**: MetricsService and /api/command-center/metrics endpoint must exist for data to load
- Without 62-04, dashboard shows loading states / pending: true response

## Self-Check: PASSED

```
FOUND: apps/web/src/app/(dashboard)/command-center/page.tsx
FOUND: apps/web/src/app/(dashboard)/command-center/layout.tsx
FOUND: apps/web/src/app/(dashboard)/command-center/_components/TodayActionBar.tsx
FOUND: apps/web/src/app/(dashboard)/command-center/_components/PipelineHealthCards.tsx
FOUND: apps/web/src/app/(dashboard)/command-center/_components/RevenuePipeline.tsx
FOUND: apps/web/src/app/(dashboard)/command-center/_components/PipelineFunnel.tsx
FOUND: apps/web/src/app/(dashboard)/command-center/_components/DashboardSkeleton.tsx
FOUND: apps/web/src/components/command-center/DraggableCard.tsx
FOUND: apps/web/src/components/command-center/TrendIndicator.tsx
FOUND: apps/web/src/hooks/command-center/useDashboardMetrics.ts
FOUND: apps/web/src/server/features/command-center/api/metrics.ts
FOUND: apps/web/src/app/api/command-center/metrics/route.ts
FOUND: apps/web/src/types/dashboard-metrics.ts
FOUND: 22555d0ca (commit)
```
