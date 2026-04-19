---
phase: 13-analytics-data-layer
plan: 02
subsystem: open-seo-main
tags: [bullmq, queue, worker, api-client, analytics]
dependency_graph:
  requires: [13-01]
  provides: [analytics-queue, analytics-worker, aiwriter-api-client]
  affects: [analytics-processor]
tech_stack:
  added: [googleapis@171.4.0, google-auth-library@10.6.2]
  patterns: [bullmq-queue, bullmq-worker, upsertJobScheduler, internal-api-client]
key_files:
  created:
    - open-seo-main/src/server/queues/analyticsQueue.ts
    - open-seo-main/src/server/workers/analytics-worker.ts
    - open-seo-main/src/server/lib/aiwriter-api.ts
  modified:
    - open-seo-main/package.json
decisions:
  - concurrency:5 for analytics worker (lower than audit worker to respect Google API rate limits)
  - nightly scheduler at 02:00 UTC via upsertJobScheduler (idempotent cron setup)
  - sandboxed processor pattern (analytics-processor.js path resolution via fileURLToPath)
metrics:
  duration: 4m
  completed: 2026-04-19T10:27:13Z
---

# Phase 13 Plan 02: BullMQ Worker Setup Summary

BullMQ queue and worker infrastructure for analytics sync system with AI-Writer internal API client.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install googleapis and google-auth-library | 87e74cb | package.json |
| 2 | Create AI-Writer internal API client | 1e40008 | src/server/lib/aiwriter-api.ts |
| 3 | Create analytics queue definition | 7269df2 | src/server/queues/analyticsQueue.ts |
| 4 | Create analytics worker | 16f330a | src/server/workers/analytics-worker.ts |

## Implementation Details

### Dependencies Installed

- `googleapis@171.4.0` - Official Google API client for GSC/GA4 API calls
- `google-auth-library@10.6.2` - OAuth2Client for token refresh

### AI-Writer Internal API Client (aiwriter-api.ts)

Typed client for fetching decrypted OAuth tokens from AI-Writer backend:

**Functions:**
- `getClientToken(clientId, provider)` - Fetch decrypted access/refresh tokens
- `updateClientToken(clientId, provider, update)` - Update tokens after refresh
- `markTokenInactive(clientId, provider)` - Deactivate tokens on refresh failure

**Security:**
- X-Internal-Api-Key header required (from INTERNAL_API_KEY env var)
- AIWRITER_INTERNAL_URL defaults to http://localhost:8000

### Analytics Queue (analyticsQueue.ts)

BullMQ queue definition following auditQueue.ts pattern:

**Exports:**
- `ANALYTICS_QUEUE_NAME = "analytics-sync"`
- `analyticsQueue` - Queue instance
- `initAnalyticsScheduler()` - Sets up nightly cron at 02:00 UTC
- `queueBackfillJob(clientId)` - Queue 90-day backfill for new connections

**Job Types:**
- `sync-all-clients` - Master job that fans out to per-client jobs
- `sync-client-analytics` - Per-client sync (GSC + GA4)

**Default Job Options:**
- `attempts: 3`
- `backoff: { type: "exponential", delay: 10_000 }`
- `removeOnComplete: { count: 100 }`
- `removeOnFail: { count: 500 }`

### Analytics Worker (analytics-worker.ts)

BullMQ worker following audit-worker.ts pattern:

**Exports:**
- `startAnalyticsWorker()` - Initialize scheduler and start worker
- `stopAnalyticsWorker()` - Graceful shutdown with 25s timeout

**Configuration:**
- `lockDuration: 120_000` (BQ-05 pattern)
- `maxStalledCount: 2` (BQ-06 pattern)
- `concurrency: 5` (lower than audit to respect Google API rate limits)
- Sandboxed processor via file path (analytics-processor.js)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

```
$ cd open-seo-main && pnpm exec tsc --noEmit
(no errors)
```

```
$ grep -E "googleapis|google-auth-library" package.json
    "google-auth-library": "^10.6.2",
    "googleapis": "^171.4.0",
```

All exports verified:
- analyticsQueue.ts: ANALYTICS_QUEUE_NAME, analyticsQueue, initAnalyticsScheduler, queueBackfillJob
- analytics-worker.ts: startAnalyticsWorker, stopAnalyticsWorker
- aiwriter-api.ts: getClientToken, updateClientToken, markTokenInactive

## Self-Check: PASSED

- [x] open-seo-main/src/server/queues/analyticsQueue.ts exists
- [x] open-seo-main/src/server/workers/analytics-worker.ts exists
- [x] open-seo-main/src/server/lib/aiwriter-api.ts exists
- [x] open-seo-main/package.json contains googleapis and google-auth-library
- [x] Commit 87e74cb exists (Task 1)
- [x] Commit 1e40008 exists (Task 2)
- [x] Commit 7269df2 exists (Task 3)
- [x] Commit 16f330a exists (Task 4)
