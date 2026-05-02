---
phase: 64-crawling-infrastructure
plan: 01
subsystem: crawler
tags: [redis, singleflight, deduplication, crawling]
dependency_graph:
  requires: [redis]
  provides: [Singleflight, createCrawlSingleflight, SingleflightResult]
  affects: [crawl-deduplication, cost-reduction]
tech_stack:
  added: []
  patterns: [SET-NX-EX, pub-sub-polling-hybrid]
key_files:
  created:
    - open-seo-main/src/server/lib/crawler/singleflight.ts
    - open-seo-main/src/server/lib/crawler/singleflight.test.ts
  modified:
    - open-seo-main/src/server/lib/crawler/index.ts
decisions:
  - "Use SET NX EX for atomic lock (not separate SETNX + EXPIRE per anti-pattern)"
  - "Subscribe before check pattern to prevent lost wakeups (Pitfall 4)"
  - "Tenant-prefixed keys for isolation (T-64-01 mitigation)"
  - "Type cast for ioredis 5.x SET compatibility"
metrics:
  duration_minutes: 7
  completed: "2026-05-02T21:32:00Z"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 7
  coverage_delta: "+7 tests"
---

# Phase 64 Plan 01: Crawl Singleflight Summary

Redis-based singleflight using SET NX EX for atomic lock acquisition with pub/sub + polling hybrid notification.

## What Was Built

### Singleflight Class (`singleflight.ts`)

Core implementation (~220 lines):

1. **Cache Check**: Returns immediately if result cached (1-hour TTL)
2. **Leader Election**: Atomic `SET key NX EX 300` acquires 5-minute lock
3. **Leader Execution**: Executes function, caches result, notifies via pub/sub
4. **Follower Waiting**: Subscribe before check pattern with 100ms polling fallback
5. **Error Handling**: Leader failure cleans lock and publishes "fail" notification

Key exports:
- `Singleflight<T>`: Generic class for any cacheable operation
- `SingleflightResult<T>`: Result with `shared` flag and `waitTimeMs`
- `createCrawlSingleflight<T>(tenantId)`: Factory with tenant-prefixed keys

### Tests (`singleflight.test.ts`)

7 tests covering:
- Leader executes and caches result
- Cached result returns immediately
- Leader failure cleans up lock
- Follower waits via subscribe + polling
- Atomic SET NX EX pattern used
- Correct key prefixes (lock, result, done channel)
- Tenant-prefixed key isolation

## Implementation Details

### Redis Key Structure

```
{prefix}:lock:{key}   - Lock with 5-min TTL
{prefix}:result:{key} - Cached result with 1-hour TTL
{prefix}:done:{key}   - Pub/sub channel for notifications
```

### Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| T-64-01 Tampering | Tenant-prefixed keys: `crawl:{tenantId}:lock:{url}` |
| T-64-02 DoS | 5-minute lock TTL prevents permanent lock |
| T-64-03 Info Disclosure | 1-hour cache TTL limits exposure |

### TypeScript Compatibility

Used type cast for ioredis 5.x SET NX EX positional args:
```typescript
const acquired = await (this.redis as unknown as {
  set(key: string, value: string, nx: "NX", ex: "EX", ttl: number): Promise<string | null>;
}).set(lockKey, workerId, "NX", "EX", LOCK_TTL_SECONDS);
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ioredis 5.x TypeScript compatibility**
- **Found during:** Task 3
- **Issue:** ioredis 5.x changed SET overloads, positional args no longer typed
- **Fix:** Type cast for SET NX EX signature
- **Files modified:** singleflight.ts
- **Commit:** b5f590110

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 75983e424 | test | Add failing tests for singleflight (RED) |
| c33867325 | feat | Implement Redis singleflight (GREEN) |
| b5f590110 | chore | Export from crawler index + TS fix |

## Self-Check: PASSED

- [x] `open-seo-main/src/server/lib/crawler/singleflight.ts` exists (224 lines)
- [x] `open-seo-main/src/server/lib/crawler/singleflight.test.ts` exists (176 lines)
- [x] All 3 commits exist in git log
- [x] 7 tests pass
- [x] No TypeScript errors in singleflight module
