---
phase: 23
plan: 03
subsystem: dashboard
tags: [performance, caching, redis, optimistic-updates]
dependency_graph:
  requires: [23-02]
  provides: [redis-cache, optimistic-updates, cache-invalidation]
  affects: [dashboard-performance, goal-mutations]
tech_stack:
  added: [ioredis]
  patterns: [cache-aside, tag-invalidation, optimistic-ui]
key_files:
  created:
    - apps/web/src/lib/cache/redis-cache.ts
    - apps/web/src/lib/cache/with-cache.ts
    - apps/web/src/lib/cache/index.ts
    - apps/web/src/lib/optimistic/index.ts
    - apps/web/src/hooks/useGoalMutations.ts
  modified:
    - apps/web/src/actions/dashboard/get-clients-paginated.ts
    - apps/web/package.json
decisions:
  - Redis lazyConnect enabled for serverless-friendly initialization
  - Tag-based invalidation allows clearing related caches together
  - Cache TTL 60s for paginated data (short for data freshness)
  - Optimistic updates use QueryClient pattern (not global singleton)
metrics:
  duration_seconds: 149
  completed_at: "2026-04-20T12:24:28Z"
  tasks_completed: 5
  tasks_total: 5
  files_changed: 7
  lines_added: 456
  lines_removed: 1
---

# Phase 23 Plan 03: Redis Caching + Optimistic Updates Summary

Redis cache-aside pattern for dashboard data with tag-based invalidation and React Query optimistic updates for instant UI feedback on mutations.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1-2 | Create Redis cache utilities with tag-based invalidation | 9dcd84cd |
| 3 | Add Redis caching to paginated clients action | 37c89417 |
| 4 | Create optimistic update utilities | 15ec29c3 |
| 5 | Create goal mutation hooks with optimistic updates | 779c44bc |

## Key Implementation Details

### Redis Cache Utilities

New cache layer at `apps/web/src/lib/cache/`:
- `cacheGet<T>(key)` - Typed cache retrieval with JSON parsing
- `cacheSet(key, value, options)` - Set with TTL and tag tracking
- `cacheInvalidate(key)` - Single key deletion
- `cacheInvalidateByTag(tag)` - Batch invalidation of related keys
- `cacheKeys` - Generators for consistent key naming
- `cacheTags` - Generators for workspace/client tags

### Cache Wrapper

Higher-order function at `apps/web/src/lib/cache/with-cache.ts`:
- `withCache(fn, getOptions)` - Wrap any async function with caching
- `hashParams(params)` - MD5 hash for query param cache keys

### Paginated Clients Caching

Enhanced `apps/web/src/actions/dashboard/get-clients-paginated.ts`:
- Cache key generated from hashed query params
- 60-second TTL for paginated data freshness
- Workspace tag enables batch invalidation on data changes

### Optimistic Update Utilities

New utilities at `apps/web/src/lib/optimistic/index.ts`:
- `createOptimisticUpdate<TData, TVariables>` - Generic HOF for mutations
- `createGoalUpdateOptimistic` - Goal update optimistic handler
- `createGoalDeleteOptimistic` - Goal delete optimistic handler
- Handles snapshot, optimistic update, rollback on error, refetch on settle

### Goal Mutation Hooks

New hooks at `apps/web/src/hooks/useGoalMutations.ts`:
- `useUpdateGoal(clientId)` - Update goal with instant UI feedback
- `useDeleteGoal(clientId)` - Delete goal with optimistic removal
- `useGoalMutations(clientId)` - Combined hook for all operations
- Integrates Redis cache invalidation on mutation success

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added barrel export for cache utilities**
- **Found during:** Task 1
- **Issue:** Plan lacked index.ts for clean imports
- **Fix:** Created apps/web/src/lib/cache/index.ts
- **Files modified:** apps/web/src/lib/cache/index.ts
- **Commit:** 9dcd84cd

## Verification Checklist

- [x] Redis cache utilities with get/set/invalidate functions
- [x] Cache wrapper for server actions
- [x] Paginated clients action uses caching
- [x] Optimistic update utilities created
- [x] Goal mutation hooks with optimistic updates
- [x] All tasks committed individually
- [x] `pnpm tsc --noEmit` passes

## Self-Check: PASSED

All created files verified to exist:
- FOUND: apps/web/src/lib/cache/redis-cache.ts
- FOUND: apps/web/src/lib/cache/with-cache.ts
- FOUND: apps/web/src/lib/cache/index.ts
- FOUND: apps/web/src/lib/optimistic/index.ts
- FOUND: apps/web/src/hooks/useGoalMutations.ts

All commits verified in git log:
- FOUND: 9dcd84cd
- FOUND: 37c89417
- FOUND: 15ec29c3
- FOUND: 779c44bc
