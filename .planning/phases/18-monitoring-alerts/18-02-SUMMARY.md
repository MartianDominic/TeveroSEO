---
phase: 18-monitoring-alerts
plan: 02
subsystem: alert-processor
tags: [bullmq, alerts, worker, queue]
dependency_graph:
  requires: [alert_rules from 18-01, alerts from 18-01, rank_drop_events from 17-04]
  provides: [alertQueue, alert-processor worker, scheduled processing]
  affects: [18-03 notifications, 18-04 UI]
tech_stack:
  added: []
  patterns: [sandboxed processor, repeatable jobs, event-driven alerting]
key_files:
  created:
    - open-seo-main/src/server/queues/alertQueue.ts
    - open-seo-main/src/server/workers/alert-processor.ts
    - open-seo-main/src/server/workers/alert-worker.ts
  modified: []
decisions:
  - "5-minute repeatable job for processing"
  - "Sandboxed processor pattern matching ranking-worker"
  - "Events below threshold marked processed but skipped"
  - "Rule-disabled clients marked processed but skipped"
metrics:
  duration_minutes: 18
  completed_at: "2026-04-19T19:50:00Z"
---

# Phase 18 Plan 02: Alert Processing Worker Summary

BullMQ queue and worker for converting drop events to alerts

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1-4 | Full implementation | (bundled) | 3 files |

## Implementation Details

### alertQueue.ts

- BullMQ queue with shared connection
- `AlertJobData` type: process_drop_events, check_sync_failures, check_connection_expiry
- `enqueueAlertJob()` - Add job to queue
- `scheduleAlertProcessing()` - 5-minute repeatable job
- `cancelAlertProcessing()` - Remove repeatable job

### alert-processor.ts (Sandboxed)

- `processDropEvents()`:
  - Query unprocessed drop events
  - Group by client for batch processing
  - Check alert rule for client/type
  - Skip if rule disabled or below threshold
  - Create alert via service
  - Mark events as processed
  - Return created alerts for logging

- Job type routing:
  - `process_drop_events`: Implemented
  - `check_sync_failures`: TODO placeholder
  - `check_connection_expiry`: TODO placeholder

### alert-worker.ts

- Standard worker lifecycle
- Sandboxed processor path
- Graceful shutdown handling
- Returns alertsCreated count

## Self-Check: PASSED

- [x] Queue with proper connection
- [x] Sandboxed processor pattern
- [x] Drop events to alerts conversion
- [x] Threshold checking against rules
- [x] Events marked processed
- [x] TypeScript compiles clean
