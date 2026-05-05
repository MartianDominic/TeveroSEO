---
phase: 90-client-portal
plan: 01
subsystem: api
tags: [drizzle, bullmq, resend, vitest, portal, gsc, notifications]

# Dependency graph
requires:
  - phase: 90-client-portal-schema
    provides: Portal schema tables (portalActivities, portalNotifications, portalNotificationSettings)
provides:
  - DashboardService with GSC data aggregation (clicks, impressions, position, wins, alerts)
  - ActivityService for work tracking CRUD operations
  - NotificationService for async notification queueing via BullMQ
  - notification-worker for email delivery via Resend
affects: [90-02, 90-03, portal-api-routes]

# Tech tracking
tech-stack:
  added: []
  patterns: [sequential-mock-pattern-vitest, bullmq-queue-singleton, service-static-methods]

key-files:
  created:
    - open-seo-main/src/server/features/portal/services/DashboardService.ts
    - open-seo-main/src/server/features/portal/services/ActivityService.ts
    - open-seo-main/src/server/features/portal/services/NotificationService.ts
    - open-seo-main/src/server/queues/notificationQueue.ts
    - open-seo-main/src/server/workers/notification-worker.ts
  modified: []

key-decisions:
  - "Used sequential mock response pattern for Drizzle chain testing"
  - "Notification worker uses 60s lock duration and concurrency of 5"
  - "Dashboard handles 3-day GSC data delay via date offset"

patterns-established:
  - "Portal service pattern: static methods, Drizzle queries, createLogger"
  - "BullMQ notification queue following alertQueue.ts pattern"
  - "vi.hoisted() for mock functions referenced in vi.mock factories"

requirements-completed: [PORTAL-DASHBOARD, PORTAL-ACTIVITY, PORTAL-NOTIFICATIONS]

# Metrics
duration: 45min
completed: 2026-05-05
---

# Phase 90 Plan 01: Trust Foundation Summary

**Three backend services for Client Portal: DashboardService (GSC aggregation), ActivityService (work tracking), NotificationService (async BullMQ notifications with Resend email delivery)**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-05T18:22:00Z (approximate)
- **Completed:** 2026-05-05T19:07:29Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- DashboardService aggregates GSC data with 30-day metrics, delta calculations, wins (top 10), and attention alerts (>5 position drops)
- ActivityService provides full CRUD for portal activities with category filtering, pagination, and stats aggregation
- NotificationService queues async notifications via BullMQ, checks settings before queuing, and tracks delivery status
- notification-worker processes jobs via email (Resend), Slack (webhook), and push (placeholder)

## Task Commits

Each task was committed atomically:

1. **Task 1: DashboardService with GSC aggregation** - `da504f4f9` (feat)
2. **Task 2: ActivityService for work tracking** - `04afce927` (feat)
3. **Task 3: NotificationService + BullMQ queue + worker** - `c7db95191` (feat)

## Files Created/Modified

- `open-seo-main/src/server/features/portal/services/DashboardService.ts` - GSC data aggregation (getDashboardMetrics, getRecentWins, getNeedsAttention)
- `open-seo-main/src/server/features/portal/services/DashboardService.test.ts` - 5 tests for dashboard service
- `open-seo-main/src/server/features/portal/services/ActivityService.ts` - Activity CRUD (getClientActivities, createActivity, getActivityStats)
- `open-seo-main/src/server/features/portal/services/ActivityService.test.ts` - 5 tests for activity service
- `open-seo-main/src/server/features/portal/services/NotificationService.ts` - Notification queueing and settings management
- `open-seo-main/src/server/features/portal/services/NotificationService.test.ts` - 6 tests for notification service
- `open-seo-main/src/server/queues/notificationQueue.ts` - BullMQ queue "portal-notifications" with standard job options
- `open-seo-main/src/server/workers/notification-worker.ts` - Worker processing email/Slack/push channels

## Decisions Made

1. **Sequential mock pattern for Drizzle:** Used `setMockResponses()` helper with index tracking to handle chained Drizzle queries that make multiple DB calls in sequence.

2. **vi.hoisted() for mock references:** Used `vi.hoisted()` to define `mockQueueAdd` before the `vi.mock()` factory, resolving the hoisting order issue in Vitest.

3. **3-day GSC delay handling:** Dashboard queries offset dates by 3 days to account for Google Search Console data delay.

4. **Worker configuration:** 60s lock duration, concurrency 5, following established BullMQ patterns from alertQueue.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added groupBy to mock chain**
- **Found during:** Task 2 (ActivityService.getActivityStats)
- **Issue:** Mock chain missing `groupBy()` method required by Drizzle query
- **Fix:** Added `groupBy: vi.fn().mockImplementation(...)` to chainMock
- **Files modified:** ActivityService.test.ts
- **Verification:** Test passes with stats aggregation
- **Committed in:** 04afce927

**2. [Rule 3 - Blocking] Fixed vi.mock hoisting issue**
- **Found during:** Task 3 (NotificationService tests)
- **Issue:** `mockQueueAdd` referenced in vi.mock factory before initialization
- **Fix:** Used `vi.hoisted()` to define mock function before factory
- **Files modified:** NotificationService.test.ts
- **Verification:** All 6 tests pass
- **Committed in:** c7db95191

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both auto-fixes were test infrastructure issues, not implementation changes. No scope creep.

## Issues Encountered

- Worktree branch was based on wrong commit - fixed with `git reset --hard d48aae54e` before starting
- pnpm install required in worktree - resolved by running `pnpm install`

## User Setup Required

None - no external service configuration required. Services use existing Resend and Redis configuration.

## Next Phase Readiness

- Backend services layer complete, ready for 90-02 (tRPC API routes)
- DashboardService, ActivityService, NotificationService all exported and tested
- Notification queue ready for worker deployment

---
*Phase: 90-client-portal*
*Completed: 2026-05-05*

## Self-Check: PASSED

All 8 files verified present. All 3 task commits verified in git history.
