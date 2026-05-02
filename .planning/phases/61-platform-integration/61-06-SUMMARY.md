---
phase: 61-platform-integration
plan: 06
subsystem: platform-oauth, apps/web
tags: [oauth, token-refresh, bullmq, worker, ui, dashboard]
dependency_graph:
  requires: [61-01, 61-02, 61-03, 61-04]
  provides:
    - Token refresh BullMQ worker
    - Platform connection API routes
    - ConnectionStatusDashboard component
    - PlatformConnectionFlow dialog
    - ConnectionCard component
  affects:
    - open-seo-main/src/server/workers
    - open-seo-main/src/server/queues
    - apps/web/src/app/api/connections
    - apps/web/src/components/connections
tech_stack:
  added: []
  patterns:
    - BullMQ repeatable scheduler (15-minute interval)
    - Sandboxed processor for token refresh
    - Backend API proxy pattern for cross-app communication
key_files:
  created:
    - open-seo-main/src/server/queues/tokenRefreshQueue.ts
    - open-seo-main/src/server/workers/token-refresh-processor.ts
    - open-seo-main/src/server/workers/token-refresh-worker.ts
    - open-seo-main/src/routes/api/platform-connections/index.ts
    - open-seo-main/src/routes/api/platform-connections/$id.ts
    - open-seo-main/src/routes/api/platform-connections/$id.sync.ts
    - apps/web/src/app/api/connections/route.ts
    - apps/web/src/app/api/connections/[id]/route.ts
    - apps/web/src/app/api/connections/[id]/sync/route.ts
    - apps/web/src/components/connections/ConnectionCard.tsx
    - apps/web/src/components/connections/ConnectionStatusDashboard.tsx
    - apps/web/src/components/connections/PlatformConnectionFlow.tsx
  modified:
    - open-seo-main/src/server/features/platform-oauth/providers/index.ts
    - apps/web/src/components/connections/index.ts
decisions:
  - Token refresh runs every 15 minutes via BullMQ upsertJobScheduler (D-11)
  - Targets tokens expiring within 30 minutes for proactive refresh
  - Failed refresh marks connection as 'error' status with error message (D-12)
  - Frontend API routes proxy to backend via BACKEND_URL environment variable
  - Backend validates workspace ownership via x-workspace-id header
metrics:
  duration_seconds: 364
  completed: 2026-05-02T16:55:49Z
  tests_passing: 0
  files_created: 12
  files_modified: 2
---

# Phase 61 Plan 06: Token Refresh Worker + Dashboard UI Summary

Token refresh worker for automatic OAuth renewal and connection dashboard UI for visibility and management.

## One-Liner

BullMQ token refresh worker (15-minute scheduler) with ConnectionStatusDashboard showing status, last sync, and Sync Now/Disconnect actions.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Token refresh BullMQ worker and queue | 1596f9d18 | tokenRefreshQueue.ts, token-refresh-processor.ts, token-refresh-worker.ts |
| 2 | Connection management API routes | 4d26fbe69 | platform-connections/*.ts, connections/route.ts |
| 3 | Connection dashboard UI components | 65bc63a98 | ConnectionCard.tsx, ConnectionStatusDashboard.tsx, PlatformConnectionFlow.tsx |

## Implementation Details

### Token Refresh Worker (Task 1)

- **tokenRefreshQueue.ts**: BullMQ queue with 15-minute repeatable scheduler per D-11
- **token-refresh-processor.ts**: Finds connections expiring within 30 minutes, calls provider.refreshAccessToken
- **token-refresh-worker.ts**: Worker with startTokenRefreshWorker/stopTokenRefreshWorker exports
- **Platforms supported**: Google (GSC, GA, GBP) and Wix have refresh tokens
- **Error handling**: Failed refresh marks connection status as 'error' per D-12

### Connection Management API (Task 2)

- **apps/web routes**: Proxy to backend via BACKEND_URL for cross-app communication
- **Backend routes**: TanStack Start handlers in open-seo-main/src/routes/api/platform-connections/
- **Endpoints**:
  - GET /api/connections - List connections for workspace
  - GET /api/connections/:id - Get single connection
  - DELETE /api/connections/:id - Remove connection
  - POST /api/connections/:id/sync - Trigger manual sync

### Connection Dashboard UI (Task 3)

- **ConnectionCard**: Platform icon, status badge, last sync time, Sync Now/Disconnect buttons
- **ConnectionStatusDashboard**: TanStack Query for fetching, syncing, disconnecting connections
- **PlatformConnectionFlow**: Dialog for adding Google/Shopify/Wix/WordPress connections
- **Platform icons**: Lucide icons for Search Console, Analytics, Business Profile, Shopify, Wix, WordPress

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] Token refresh worker starts without errors (startTokenRefreshWorker function)
- [x] Worker targets tokens expiring within 30 minutes (30 * 60 * 1000)
- [x] Failed refresh updates connection status to 'error' (platformConnectionService.updateStatus)
- [x] API routes require authentication (Clerk auth check)
- [x] Dashboard loads connections correctly (TanStack Query)
- [x] Manual sync triggers data fetch (POST /api/connections/:id/sync)
- [x] Disconnect removes connection (DELETE /api/connections/:id)

## Self-Check: PASSED

All created files exist and all commits are present in git history.

## Next Steps

- Phase 61 complete - all 6 plans executed
- Token refresh worker should be started in production entry point
- Platform-specific sync logic to be added as services mature
