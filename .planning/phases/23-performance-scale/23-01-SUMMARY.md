---
phase: 23
plan: 01
subsystem: dashboard
tags: [performance, virtualization, lazy-loading, sparklines]
dependency_graph:
  requires: [22-05]
  provides: [virtualized-table, lazy-sparklines, scroll-persistence]
  affects: [ClientPortfolioTable, dashboard-performance]
tech_stack:
  added: ["@tanstack/react-virtual"]
  patterns: [intersection-observer, row-virtualization, lazy-loading]
key_files:
  created:
    - apps/web/src/components/dashboard/VirtualizedTable.tsx
    - apps/web/src/components/dashboard/LazySparkline.tsx
    - apps/web/src/app/api/sparkline/[clientId]/[metric]/route.ts
    - apps/web/src/hooks/useScrollPosition.ts
  modified:
    - apps/web/src/components/dashboard/ClientPortfolioTable.tsx
    - apps/web/package.json
decisions:
  - VirtualizedTable uses generic column definitions (not TanStack Table) for simpler integration
  - LazySparkline wraps existing SparklineChart with IntersectionObserver lazy loading
  - Sparkline API proxies to analytics backend, extracts time-series from existing endpoint
  - Virtualization and sparklines are opt-in via props to preserve backward compatibility
metrics:
  duration_seconds: 410
  completed_at: "2026-04-20T12:15:28Z"
  tasks_completed: 6
  tasks_total: 6
  files_changed: 7
  lines_added: 1052
  lines_removed: 119
---

# Phase 23 Plan 01: TanStack Virtual + Lazy Sparklines Summary

Row virtualization and lazy-loaded sparklines for 500+ client scalability using @tanstack/react-virtual and IntersectionObserver.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Install @tanstack/react-virtual | 56b28607 |
| 2 | Create VirtualizedTable component | 90b37fa7 |
| 3 | Create LazySparkline component | 62233e26 |
| 4 | Create sparkline API endpoint | 21705790 |
| 5 | Update ClientPortfolioTable with virtualization | 7a8461ce |
| 6 | Create useScrollPosition hook | 29dc635f |

## Key Implementation Details

### VirtualizedTable Component

Generic virtualized table component at `apps/web/src/components/dashboard/VirtualizedTable.tsx`:
- Uses `@tanstack/react-virtual` for row virtualization
- Accepts generic column definitions with render functions
- Configurable row height (default 64px), overscan (default 10), max height
- Row click handler and selection state support
- Empty state handling

### LazySparkline Component

Lazy-loading sparkline wrapper at `apps/web/src/components/dashboard/LazySparkline.tsx`:
- Uses IntersectionObserver with 100px root margin for preloading
- Fetches data from `/api/sparkline/[clientId]/[metric]` when visible
- AbortController for request cancellation on unmount
- Integrates with existing SparklineChart component
- Skeleton loading state during fetch

### Sparkline API Endpoint

BFF endpoint at `apps/web/src/app/api/sparkline/[clientId]/[metric]/route.ts`:
- Supports metrics: `traffic` (clicks), `keywords` (impressions), `ctr`
- Proxies to existing analytics backend, extracts 30-day time series
- Auth inherited from server-fetch middleware
- Returns empty array on 404 for graceful degradation

### ClientPortfolioTable Enhancement

Updated `apps/web/src/components/dashboard/ClientPortfolioTable.tsx`:
- `useVirtualization` prop enables VirtualizedTable (default false)
- `showSparklines` prop adds lazy-loaded sparklines to trend column (default false)
- Both features are opt-in for backward compatibility
- Column definitions reuse existing cell renderers

### Scroll Position Hook

New hook at `apps/web/src/hooks/useScrollPosition.ts`:
- `useScrollPosition(key)` - persists scroll position in sessionStorage
- `useScrollPositionWithDirection(key)` - adds scroll direction tracking
- `clearScrollPosition(key)` - utility to reset saved position

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Adapted VirtualizedTable for codebase architecture**
- **Found during:** Task 2
- **Issue:** Plan's VirtualizedTable used TanStack Table types, but codebase doesn't use TanStack Table
- **Fix:** Created generic VirtualizedTable with custom column definitions that work with raw data arrays
- **Files modified:** VirtualizedTable.tsx

**2. [Rule 2 - Missing Functionality] Adapted sparkline API for BFF architecture**
- **Found during:** Task 4
- **Issue:** Plan assumed direct database access, but Next.js app uses BFF pattern proxying to backend
- **Fix:** Created API route that proxies to existing analytics endpoint and extracts sparkline data
- **Files modified:** route.ts

## Verification Checklist

- [x] @tanstack/react-virtual installed
- [x] VirtualizedTable component created with proper typing
- [x] LazySparkline component with IntersectionObserver
- [x] Sparkline API endpoint with auth
- [x] ClientPortfolioTable enhanced (not replaced)
- [x] Scroll position hook created
- [x] All tasks committed individually
- [x] `pnpm tsc --noEmit` passes

## Self-Check: PASSED

All created files verified to exist:
- FOUND: apps/web/src/components/dashboard/VirtualizedTable.tsx
- FOUND: apps/web/src/components/dashboard/LazySparkline.tsx
- FOUND: apps/web/src/app/api/sparkline/[clientId]/[metric]/route.ts
- FOUND: apps/web/src/hooks/useScrollPosition.ts

All commits verified in git log:
- FOUND: 56b28607
- FOUND: 90b37fa7
- FOUND: 62233e26
- FOUND: 21705790
- FOUND: 7a8461ce
- FOUND: 29dc635f
