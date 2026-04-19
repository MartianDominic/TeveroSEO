---
phase: 17-rank-tracking-history
plan: 04
subsystem: ranking-alerts
tags: [alerts, drop-detection, ranking, events]
dependency_graph:
  requires: [keyword_rankings table from 17-01, ranking-worker from 17-02]
  provides: [rank_drop_events table, drop detection in worker, threshold config, drop events API]
  affects: [Phase 18 alert system]
tech_stack:
  added: []
  patterns: [event recording pattern, threshold-based alerting]
key_files:
  created:
    - open-seo-main/src/db/rank-events-schema.ts
    - open-seo-main/src/services/rank-events.ts
    - open-seo-main/src/routes/api/clients/$clientId.drop-events.ts
    - open-seo-main/drizzle/0006_rank_drop_events.sql
  modified:
    - open-seo-main/src/db/app.schema.ts
    - open-seo-main/src/db/schema.ts
    - open-seo-main/src/server/workers/ranking-processor.ts
    - open-seo-main/src/routes/api/seo/keyword-rankings.ts
decisions:
  - "Default drop threshold of 5 positions"
  - "Events stored unprocessed for Phase 18 alert worker to consume"
  - "organizationId used as clientId for drop events"
metrics:
  duration_minutes: 12
  completed_at: "2026-04-19T17:45:00Z"
---

# Phase 17 Plan 04: Rank Drop Alerts Integration Summary

Drop detection in ranking worker with event storage for Phase 18 alert system

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1-4 | Full implementation | 74c06bb | 8 files |

## Implementation Details

### rank-events-schema.ts

- `rank_drop_events` table with:
  - keywordId, projectId, clientId, keyword (denormalized)
  - previousPosition, currentPosition, dropAmount, threshold
  - detectedAt, processedAt, processedBy
- Indexes on (clientId, processedAt), keywordId, detectedAt

### rank-events.ts Service

- `recordDropEvent()` - Insert drop event when threshold exceeded
- `getUnprocessedDropEvents()` - For Phase 18 alert worker
- `markDropEventsProcessed()` - Mark events as handled
- `getRecentDropEvents()` - For UI display

### ranking-processor.ts Updates

- Added drop detection after storing ranking
- Compares current vs previous position
- Records event if drop >= threshold (default 5)
- Logs warnings for drop detections
- Tracks totalDrops in batch processing

### Drop Events API

- `GET /api/clients/:clientId/drop-events`
- Optional `?unprocessed=true` for alert worker
- Returns events with all metadata

### Migration 0006

- Adds `drop_alert_threshold` column to saved_keywords
- Creates `rank_drop_events` table with indexes

## Self-Check: PASSED

- [x] dropAlertThreshold column in saved_keywords schema
- [x] rank_drop_events table with all columns
- [x] ranking-processor detects drops and records events
- [x] Drop events API returns events
- [x] TypeScript compiles clean
- [x] Migration file created
