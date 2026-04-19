---
phase: 16-report-scheduling-white-label
plan: 01
subsystem: report-scheduling
tags: [bullmq, drizzle, scheduler, cron, api]
dependency_graph:
  requires: [Phase 15 reportQueue, reports schema]
  provides: [scheduleQueue, schedule-worker, reportSchedules table, schedule CRUD API]
  affects: [worker-entry.ts, server-fetch.ts]
tech_stack:
  added: [cron-parser]
  patterns: [BullMQ repeatable jobs, sandboxed processor, timezone-aware scheduling]
key_files:
  created:
    - open-seo-main/src/db/schedule-schema.ts
    - open-seo-main/src/db/schedule-schema.test.ts
    - open-seo-main/src/server/queues/scheduleQueue.ts
    - open-seo-main/src/server/workers/schedule-worker.ts
    - open-seo-main/src/server/workers/schedule-processor.ts
    - open-seo-main/src/server/workers/schedule-processor.test.ts
    - open-seo-main/src/routes/api/schedules/index.ts
    - open-seo-main/src/routes/api/schedules/$id.ts
    - apps/web/src/app/api/clients/[clientId]/schedules/route.ts
    - apps/web/src/app/api/clients/[clientId]/schedules/[scheduleId]/route.ts
  modified:
    - open-seo-main/src/db/schema.ts
    - open-seo-main/src/worker-entry.ts
    - apps/web/src/lib/server-fetch.ts
decisions:
  - 5-minute repeatable job interval for schedule checking
  - Minimum schedule frequency: daily (T-16-05 DoS mitigation)
  - Max 100 schedules processed per check run
key_links_verified:
  - schedule-processor.ts -> enqueueReportGeneration (reportQueue.ts)
  - schedule-processor.ts -> db.query.reportSchedules (schedule-schema.ts)
metrics:
  duration_minutes: 10
  completed: 2026-04-19T16:28:37Z
  tasks_completed: 3
  tasks_total: 3
  files_created: 10
  files_modified: 3
  tests_added: 18
---

# Phase 16 Plan 01: Report Scheduler Infrastructure Summary

BullMQ scheduler queue with cron-parser timezone support for automated report generation.

## One-Liner

BullMQ scheduler with 5-minute repeatable job using cron-parser for timezone-aware schedule processing.

## What Was Built

### 1. Drizzle Schema (`schedule-schema.ts`)
- `report_schedules` table with all required columns per CONTEXT.md
- UUID primary key, clientId, cronExpression, timezone, reportType, locale
- JSONB recipients array for email addresses
- Enabled boolean with default true
- lastRun (nullable) and nextRun timestamps
- Indexes: `ix_schedules_client_id`, `ix_schedules_next_run_enabled`
- Unique constraint: `uq_schedules_client_type` (one schedule per type per client)
- Type exports: `ReportScheduleSelect`, `ReportScheduleInsert`

### 2. BullMQ Schedule Queue (`scheduleQueue.ts`)
- Queue name: `report-scheduler`
- 5-minute repeatable job pattern (`*/5 * * * *`)
- Job data: `{ triggeredAt: string }`
- `initScheduleQueue()` sets up the repeatable job
- `triggerScheduleCheck()` for manual triggering

### 3. Schedule Worker (`schedule-worker.ts`)
- Sandboxed processor via file path
- lockDuration: 60_000 (enough for DB queries)
- concurrency: 1 (single scheduler - no parallel checks)
- Graceful shutdown with 25s timeout
- DLQ handling for failed jobs

### 4. Schedule Processor (`schedule-processor.ts`)
- Queries due schedules: `nextRun <= now AND enabled = true`
- For each due schedule:
  1. Creates report record in pending status
  2. Calls `enqueueReportGeneration()` from Phase 15
  3. Calculates new nextRun using cron-parser with timezone
  4. Updates lastRun and nextRun
- Max 100 schedules per run (batching)

### 5. Schedule CRUD API (open-seo-main)
- `GET /api/schedules?client_id={id}` - List schedules
- `POST /api/schedules` - Create with validation
- `GET /api/schedules/:id` - Get by ID
- `PUT /api/schedules/:id` - Update with validation
- `DELETE /api/schedules/:id` - Delete

### 6. Schedule API Proxy (apps/web)
- `GET/POST /api/clients/:clientId/schedules`
- `GET/PUT/DELETE /api/clients/:clientId/schedules/:scheduleId`
- Added `putOpenSeo` and `deleteOpenSeo` to server-fetch.ts

## Validation Implemented

1. **Cron expression** - Validated with cron-parser
2. **Timezone** - Validated with `Intl.DateTimeFormat`
3. **Recipients** - Validated as email format
4. **Minimum interval** - Cannot schedule more frequently than daily (T-16-05)

## Threat Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-16-02 | Cron expression validated with cron-parser |
| T-16-05 | Minimum 24-hour interval between runs enforced |

## Commits

| Repo | Hash | Message |
|------|------|---------|
| open-seo-main | 8dc8b8d | feat(16-01): add report_schedules Drizzle schema |
| open-seo-main | fd98332 | feat(16-01): add BullMQ schedule queue and worker |
| open-seo-main | 9717475 | feat(16-01): add schedule CRUD API endpoints |
| TeveroSEO | 0a1b065b | feat(16-01): add schedule API proxy routes in apps/web |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] All 18 tests pass (14 schema + 4 processor)
- [x] Type check passes for open-seo-main
- [x] Type check passes for apps/web
- [x] Schedule schema exports correct types
- [x] Worker integrates with worker-entry.ts
- [x] API validation rejects invalid cron expressions
- [x] API validation rejects invalid timezones

## Known Stubs

None - all functionality is fully implemented.

## Self-Check: PASSED

All created files exist and all commits verified:
- open-seo-main: 8dc8b8d, fd98332, 9717475
- TeveroSEO: 0a1b065b
