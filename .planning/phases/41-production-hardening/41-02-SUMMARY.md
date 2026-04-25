---
phase: 41
plan: "02"
subsystem: analytics
tags: [gsc, patterns, api, real-data]
dependency_graph:
  requires: [41-01]
  provides: [workspace-traffic-api, workspace-ranking-api, pattern-api]
  affects: [detect-patterns, patterns-schema]
tech_stack:
  added: []
  patterns: [api-routes, zod-validation, drizzle-queries]
key_files:
  created:
    - open-seo-main/src/routes/api/workspaces/$workspaceId/traffic-data.ts
    - open-seo-main/src/routes/api/workspaces/$workspaceId/ranking-data.ts
    - open-seo-main/src/routes/api/patterns/$patternId.ts
  modified:
    - open-seo-main/src/db/patterns-schema.ts
    - apps/web/src/actions/analytics/detect-patterns.ts
decisions:
  - Traffic status thresholds: dropped <= -20%, growing >= 10%, stable in between
  - Week aggregation: 4 weeks with index 3 = current, 0 = oldest
  - Ranking change: positive = improvement (lower position is better in search)
metrics:
  duration: 5m 24s
  completed: 2026-04-25T21:01:00Z
  tasks: 5/5
  files_changed: 5
---

# Phase 41 Plan 02: Pattern Detection with Real GSC Data Summary

Real GSC aggregate queries replace mock traffic/ranking data generators, making cross-client analytics dashboard meaningful.

## One-Liner

Wired pattern detection to real GSC snapshots and keyword rankings via new workspace API endpoints.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | GSC traffic data endpoint | 31c794e (open-seo) | traffic-data.ts |
| 2 | Ranking data endpoint | 1c6fad7 (open-seo) | ranking-data.ts |
| 3 | Wire detect-patterns to real endpoints | 26d22ea0d | detect-patterns.ts |
| 4 | Implement dismissPattern/resolvePattern | 994d002 (open-seo), 909a9667a | patterns-schema.ts, detect-patterns.ts |
| 5 | Pattern API endpoint | d519cfe (open-seo) | $patternId.ts |

## Implementation Details

### Workspace Traffic Data Endpoint
- `/api/workspaces/{id}/traffic-data` - GET
- Fetches GSC snapshots for last 28 days per client
- Aggregates clicks by week (4 weeks total)
- Calculates week-over-week trend percentage
- Returns traffic status: `dropped` / `growing` / `stable`

### Workspace Ranking Data Endpoint
- `/api/workspaces/{id}/ranking-data` - GET
- Fetches tracked keywords per client project
- Compares current vs 7-day-ago positions
- Returns improved/dropped counts and top keyword details

### Pattern Detection Updates
- Removed mock generators: `generateMockTrafficData`, `generateMockRankingData`
- Added transform functions for API response formats
- `detectPatterns()` now fetches real data via `getOpenSeo()`
- `dismissPattern()` and `resolvePattern()` persist to DB via PATCH

### Pattern API Endpoint
- `PATCH /api/patterns/{id}` - Update status (dismiss/resolve)
- `GET /api/patterns/{id}` - Fetch pattern details
- Zod validation for request body
- Returns updated pattern state

## Verification Checklist

- [x] `/api/workspaces/{id}/traffic-data` returns real GSC aggregates
- [x] `/api/workspaces/{id}/ranking-data` returns real keyword positions
- [x] `detect-patterns.ts` no longer contains mock generators (grep returns 0)
- [x] Pattern detection wired to real endpoints
- [x] `dismissPattern` and `resolvePattern` persist to database

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] traffic-data.ts exists at expected path
- [x] ranking-data.ts exists at expected path
- [x] $patternId.ts exists at expected path
- [x] patterns-schema.ts has dismissedAt field
- [x] detect-patterns.ts has no mock generators
