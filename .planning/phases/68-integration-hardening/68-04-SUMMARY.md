---
phase: 68-integration-hardening
plan: 04
subsystem: state
tags: [tanstack-query, react-query, broadcast-channel, zustand, multi-tab, state-management]

# Dependency graph
requires:
  - phase: 68-02
    provides: AbortManager for client context switching, cache invalidation patterns
provides:
  - TanStack Query hooks for client data (useClients, useActiveClient, useSetActiveClient)
  - BroadcastChannel sync for multi-tab state coordination
  - Cross-tab logout propagation
affects: [68-05, 69-01, client-switcher, app-shell]

# Tech tracking
tech-stack:
  added: []  # TanStack Query was already installed
  patterns: [tanstack-query-hooks, broadcast-channel-sync, store-query-hybrid]

key-files:
  created:
    - apps/web/src/hooks/use-clients.ts
    - apps/web/src/lib/state/broadcast-sync.ts
  modified:
    - apps/web/src/stores/clientStore.ts

key-decisions:
  - "5-minute staleTime, 10-minute gcTime for client query cache"
  - "BroadcastChannel for cross-tab sync (not localStorage events)"
  - "Store retains legacy methods for gradual migration"
  - "Use setState directly in broadcast handler to avoid circular broadcasts"

patterns-established:
  - "TanStack Query hooks in @/hooks/ for server state"
  - "broadcastSync.init() on module load for cross-tab messaging"
  - "subscribe() returns unsubscribe function for cleanup"

requirements-completed: [HIGH-STATE-01, HIGH-STATE-02]

# Metrics
duration: 4min
completed: 2026-05-04
---

# Phase 68-04: State Management Migration Summary

**TanStack Query hooks for client data with 5-minute cache, BroadcastChannel for multi-tab sync (client switch, logout)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-03T22:10:17Z
- **Completed:** 2026-05-03T22:14:00Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- useClients() hook with 5-minute staleTime replaces manual fetch in clientStore
- useActiveClient() derives active client from store + query data
- useSetActiveClient() invalidates audits/goals/analytics queries on switch
- BroadcastChannel syncs client changes and logout across browser tabs
- clientStore subscribes to cross-tab messages on module load

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TanStack Query Hooks** - `c2059397b` (feat)
2. **Task 2: Implement BroadcastChannel Sync** - `ecf2b62bd` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `apps/web/src/hooks/use-clients.ts` - TanStack Query hooks for client data (useClients, useActiveClient, useSetActiveClient, useInvalidateClients, useClientById)
- `apps/web/src/lib/state/broadcast-sync.ts` - BroadcastSync class with subscribe/broadcast pattern for cross-tab communication
- `apps/web/src/stores/clientStore.ts` - Added broadcastSync subscription for CLIENT_CHANGED, LOGOUT, CACHE_INVALIDATE messages

## Decisions Made

- **5-minute staleTime:** Matches existing STALE_TIME_MS constant in clientStore for consistency
- **10-minute gcTime:** Reasonable cache lifetime for client list that doesn't change frequently
- **BroadcastChannel over localStorage:** BroadcastChannel is cleaner for message passing (no JSON serialization to localStorage, no storage event parsing)
- **Legacy methods retained:** clientStore.fetchClients() etc. remain for gradual migration - new code should use hooks
- **Direct setState in handler:** Using useClientStore.setState() instead of setActiveClient() in broadcast handler prevents circular message broadcasts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation was straightforward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TanStack Query hooks ready for use in client switcher and other components
- BroadcastChannel sync active on any page that imports clientStore
- Legacy store methods remain for backwards compatibility during migration

## Self-Check: PASSED

- [x] apps/web/src/hooks/use-clients.ts exists
- [x] apps/web/src/lib/state/broadcast-sync.ts exists
- [x] Commit c2059397b exists (Task 1)
- [x] Commit ecf2b62bd exists (Task 2)
- [x] 5-min staleTime configured in useClients
- [x] broadcastClientChange called in useSetActiveClient
- [x] LOGOUT handler in clientStore

---
*Phase: 68-integration-hardening*
*Completed: 2026-05-04*
