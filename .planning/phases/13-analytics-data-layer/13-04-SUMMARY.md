---
phase: 13-analytics-data-layer
plan: 04
subsystem: open-seo-main, AI-Writer backend
tags: [drizzle, schema, migration, oauth, backfill, analytics]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [drizzle-analytics-schema, backfill-trigger, internal-backfill-api]
  affects: [analytics-worker, oauth-callback]
tech_stack:
  added: []
  patterns: [drizzle-pg-schema, tanstack-api-route, internal-api-pattern]
key_files:
  created:
    - open-seo-main/src/db/analytics-schema.ts
    - open-seo-main/drizzle/0003_analytics_snapshots.sql
    - open-seo-main/src/routes/api/internal/analytics/backfill.ts
  modified:
    - open-seo-main/src/db/schema.ts
    - open-seo-main/drizzle/meta/_journal.json
    - AI-Writer/backend/api/internal.py
    - AI-Writer/backend/services/client_oauth_service.py
decisions:
  - Manual migration file created (drizzle-kit requires TTY for interactive prompts)
  - Type assertion used for TanStack route path (route tree regeneration requires dev server)
  - Backfill trigger calls localhost AI-Writer internal API which forwards to open-seo-worker
metrics:
  duration: 7m
  completed: 2026-04-19T10:36:30Z
---

# Phase 13 Plan 04: Drizzle Schema + Backfill Trigger Summary

Drizzle ORM schema for analytics tables in open-seo-main with OAuth callback triggering backfill on new Google connections.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Drizzle schema for analytics tables | 4c5bd6e | src/db/analytics-schema.ts |
| 2 | Update schema index to export analytics tables | 4b85266 | src/db/schema.ts |
| 3 | Generate Drizzle migration for analytics tables | 0049341 | drizzle/0003_analytics_snapshots.sql, drizzle/meta/_journal.json |
| 4 | Add backfill trigger endpoint to AI-Writer | 6debcf61 | backend/api/internal.py (already committed in 13-03) |
| 5 | Add backfill endpoint to open-seo-worker | 14c6bf8 | src/routes/api/internal/analytics/backfill.ts |
| 6 | Wire backfill trigger into OAuth callback | f275f99e | backend/services/client_oauth_service.py, backend/api/client_oauth.py |

## Implementation Details

### Drizzle Schema (analytics-schema.ts)

Three tables created for analytics data storage:

**gscSnapshots:**
- Daily GSC aggregate metrics per client
- Columns: id, clientId, date, siteUrl, clicks, impressions, ctr, position, syncedAt
- UNIQUE(client_id, date), Index on (client_id, date)

**gscQuerySnapshots:**
- Top queries per day per client (up to 50)
- Columns: id, clientId, date, query, clicks, impressions, ctr, position
- UNIQUE(client_id, date, query), Index on (client_id, date)

**ga4Snapshots:**
- Daily GA4 metrics per client (7 metrics)
- Columns: id, clientId, date, propertyId, sessions, users, newUsers, bounceRate, avgSessionDuration, conversions, revenue, syncedAt
- UNIQUE(client_id, date), Index on (client_id, date)

No FK to clients table since that lives in AI-Writer's PostgreSQL. client_id validated at application layer.

### Migration (0003_analytics_snapshots.sql)

SQL migration with:
- CREATE TABLE IF NOT EXISTS for all three tables
- Primary keys with gen_random_uuid() default
- UNIQUE constraints for upsert support
- btree indexes for efficient querying

### Backfill Trigger Flow

1. OAuth callback completes successfully
2. `_trigger_backfill(client_id)` called in ClientOAuthService
3. Calls AI-Writer `/internal/analytics/backfill/{client_id}`
4. AI-Writer forwards to open-seo-worker `/api/internal/analytics/backfill`
5. Worker queues backfill job via `queueBackfillJob(clientId)`
6. 90-day backfill starts immediately (ANALYTICS-10: data within 2h)

### Internal API Endpoints

**AI-Writer `/internal/analytics/backfill/{client_id}`:**
- Protected by X-Internal-Api-Key header
- Forwards request to open-seo-worker
- Returns "triggered" or "deferred" status

**open-seo-worker `/api/internal/analytics/backfill`:**
- Protected by X-Internal-Api-Key header
- Validates clientId UUID format
- Queues backfill job via analyticsQueue
- Returns 202 Accepted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Drizzle-kit requires TTY for interactive prompts**
- **Found during:** Task 3
- **Issue:** `drizzle-kit generate` fails in non-TTY environment
- **Fix:** Created migration file manually with correct SQL
- **Files modified:** drizzle/0003_analytics_snapshots.sql, drizzle/meta/_journal.json
- **Commit:** 0049341

**2. [Rule 3 - Blocking] TanStack route tree not regenerated**
- **Found during:** Task 5
- **Issue:** Route path not in FileRoutesByPath type
- **Fix:** Used type assertion `as any` for route path
- **Files modified:** src/routes/api/internal/analytics/backfill.ts
- **Commit:** 14c6bf8

**3. [Rule 2 - Missing] OAuth service files not tracked in AI-Writer**
- **Found during:** Task 6
- **Issue:** client_oauth_service.py and client_oauth.py were untracked
- **Fix:** Added and committed both files with backfill trigger
- **Files modified:** backend/services/client_oauth_service.py, backend/api/client_oauth.py
- **Commit:** f275f99e

## Verification Results

```
$ cd open-seo-main && pnpm exec tsc --noEmit 2>&1 | grep -E "error TS" | wc -l
0

$ grep "analytics-schema" src/db/schema.ts
export * from "./analytics-schema";

$ ls drizzle/0003*.sql
drizzle/0003_analytics_snapshots.sql

$ grep backfill AI-Writer/backend/api/internal.py | head -1
@router.post("/analytics/backfill/{client_id}", response_model=BackfillResponse)

$ grep _trigger_backfill AI-Writer/backend/services/client_oauth_service.py | head -1
        self._trigger_backfill(client_id)
```

## Self-Check: PASSED

- [x] open-seo-main/src/db/analytics-schema.ts exists
- [x] open-seo-main/src/db/schema.ts exports analytics-schema
- [x] open-seo-main/drizzle/0003_analytics_snapshots.sql exists
- [x] open-seo-main/src/routes/api/internal/analytics/backfill.ts exists
- [x] AI-Writer/backend/api/internal.py has backfill endpoint
- [x] AI-Writer/backend/services/client_oauth_service.py triggers backfill
- [x] Commit 4c5bd6e exists (Task 1)
- [x] Commit 4b85266 exists (Task 2)
- [x] Commit 0049341 exists (Task 3)
- [x] Commit 6debcf61 exists (Task 4 - pre-existing)
- [x] Commit 14c6bf8 exists (Task 5)
- [x] Commit f275f99e exists (Task 6)
