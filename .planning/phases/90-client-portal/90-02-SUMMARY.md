---
phase: 90-client-portal
plan: 02
subsystem: api
tags: [tanstack-start, portal-api, token-validation, gsc, notifications]

# Dependency graph
requires:
  - phase: 90-01
    provides: DashboardService, ActivityService, NotificationService
provides:
  - GET /api/portal/dashboard/:clientId with GSC metrics and deltas
  - GET /api/portal/keywords/:clientId with pagination and filtering
  - GET /api/portal/activity/:clientId with category filtering
  - GET /api/portal/notifications/:clientId for in-app notifications
  - GET/PUT /api/portal/notifications/settings/:clientId for settings
affects: [90-03, portal-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [tanstack-start-api-routes, token-extraction-pattern, zod-request-validation]

key-files:
  created:
    - open-seo-main/src/routes/api/portal/dashboard.$clientId.ts
    - open-seo-main/src/routes/api/portal/keywords.$clientId.ts
    - open-seo-main/src/routes/api/portal/activity.$clientId.ts
    - open-seo-main/src/routes/api/portal/notifications.$clientId.ts
    - open-seo-main/src/routes/api/portal/notifications.settings.$clientId.ts
  modified: []

key-decisions:
  - "Token extraction from Authorization header or query param for flexibility"
  - "ClientId verification against token to prevent cross-client access (T-90-08)"
  - "Zod strict mode for settings validation to reject unknown fields (T-90-07)"
  - "Activity grouping by date for frontend rendering convenience"

patterns-established:
  - "Portal API route pattern: extractToken() helper, validateToken(), clientId verification"
  - "Response format: { success: boolean, data: T, error?: string }"
  - "Error codes: 401 (auth), 403 (forbidden), 400 (validation), 500 (server)"

requirements-completed: [PORTAL-API-DASHBOARD, PORTAL-API-KEYWORDS, PORTAL-API-ACTIVITY, PORTAL-API-NOTIFICATIONS]

# Metrics
duration: 5min
completed: 2026-05-05
---

# Phase 90 Plan 02: API Routes Summary

**Five API routes for Client Portal: Dashboard (GSC metrics), Keywords (paginated rankings), Activity (work feed), Notifications (in-app list), Notification Settings (GET/PUT preferences)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-05T19:10:34Z
- **Completed:** 2026-05-05T19:15:52Z
- **Tasks:** 4
- **Files created:** 5

## Accomplishments

- Dashboard API returns GSC metrics with deltas, recent wins, and keywords needing attention
- Keywords API provides paginated keyword rankings with filtering (all/top10/improving/declining) and sorting (position/clicks/change)
- Activity API returns work entries with category filtering and date grouping
- Notifications API returns in-app notifications with unread count
- Notification Settings API supports GET and PUT with Zod validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard API route** - `bbb4771` (feat)
2. **Task 2: Keywords API route** - `7864cf8` (feat)
3. **Task 3: Activity API route** - `b5295c7` (feat)
4. **Task 4: Notification API routes** - `7c34069` (feat)

## Files Created

| File | Purpose |
|------|---------|
| `src/routes/api/portal/dashboard.$clientId.ts` | Dashboard metrics, wins, alerts |
| `src/routes/api/portal/keywords.$clientId.ts` | Keyword rankings with pagination |
| `src/routes/api/portal/activity.$clientId.ts` | Activity feed with categories |
| `src/routes/api/portal/notifications.$clientId.ts` | In-app notification list |
| `src/routes/api/portal/notifications.settings.$clientId.ts` | Notification preferences |

## Decisions Made

1. **Token extraction flexibility:** Support both `Authorization: Bearer xxx` header and `?token=xxx` query param to accommodate different frontend integration approaches.

2. **ClientId verification:** Every route validates that the token's clientId matches the URL param clientId, preventing cross-client data access (T-90-08 mitigation).

3. **Zod strict validation:** Settings update uses `z.object().strict()` to reject unknown fields, preventing payload tampering (T-90-07 mitigation).

4. **Date grouping for activities:** API returns activity IDs grouped by date (today/yesterday/thisWeek/older) as a convenience for frontend rendering.

5. **Volume isEstimated flag:** Keywords API includes `isEstimated: boolean` field for volume data per D-02 constraint. Currently always `false` as DataForSEO integration is not yet implemented.

## Threat Mitigations Applied

| Threat ID | Component | Mitigation Applied |
|-----------|-----------|-------------------|
| T-90-06 | All routes | Token validation via portalTokenService before data access |
| T-90-07 | notifications.settings | Zod strict schema validation, only known fields accepted |
| T-90-08 | All routes | ClientId from validated token compared to URL param, 403 on mismatch |

## Deviations from Plan

None - plan executed exactly as written.

## Setup Prerequisites

Wave 1 services must be available:
- DashboardService at `server/features/portal/services/DashboardService.ts`
- ActivityService at `server/features/portal/services/ActivityService.ts`
- NotificationService at `server/features/portal/services/NotificationService.ts`

These were copied from main repo into the worktree during execution since this worktree was based on an earlier commit.

## Next Phase Readiness

- API routes complete, ready for 90-03 (Frontend Components)
- All routes follow consistent patterns for frontend integration
- Response formats documented in route comments

---
*Phase: 90-client-portal*
*Completed: 2026-05-05*

## Self-Check: PASSED

All 5 route files verified present. All 4 task commits verified in git history.
