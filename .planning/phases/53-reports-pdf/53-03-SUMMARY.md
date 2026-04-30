---
phase: 53-reports-pdf
plan: 03
subsystem: reports
tags: [bullmq, email, resend, pdf, scheduling, react, tanstack-table]

# Dependency graph
requires:
  - phase: 53-02
    provides: Report builder, PDF generation, schedule schema
provides:
  - Schedule processor email delivery after report completion
  - Report history table with filtering and sorting
  - Schedule settings navigation from reports page
affects: [53-04, report-templates, client-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-phase-worker, rate-limited-email, filtered-table]

key-files:
  created:
    - apps/web/src/components/reports/ReportHistoryTable.tsx
  modified:
    - open-seo-main/src/db/report-schema.ts
    - open-seo-main/src/server/workers/schedule-processor.ts
    - apps/web/src/components/reports/ReportList.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/reports/page.tsx
    - apps/web/src/components/reports/index.ts

key-decisions:
  - "Two-phase worker: schedule check then email delivery in same job cycle"
  - "MAX_EMAILS_PER_RUN = 50 per 5-minute cycle for rate limiting (T-53-09)"
  - "scheduleId links reports to schedules for delivery tracking"
  - "emailSentAt null check identifies pending email deliveries"

patterns-established:
  - "Two-phase worker pattern: phase 1 enqueue work, phase 2 process completed work"
  - "Rate-limited batch processing with configurable MAX_* constants"
  - "Filtered table component with search, status filter, and sort controls"

requirements-completed: [RPT-SCHEDULE-01, RPT-EMAIL-01, RPT-HISTORY-01]

# Metrics
duration: 5min
completed: 2026-04-30
---

# Phase 53 Plan 03: Scheduling & Delivery Summary

**Schedule processor with email delivery phase, report history table with filtering, and schedule settings navigation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-30T16:37:56Z
- **Completed:** 2026-04-30T16:42:29Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added scheduleId and emailSentAt columns to report schema for delivery tracking
- Implemented sendCompletedReportEmails function with MAX_EMAILS_PER_RUN=50 rate limit
- Created ReportHistoryTable component with search, status filter, and sorting
- Updated ReportList to use history table and added schedule settings link

## Task Commits

Each task was committed atomically:

1. **Task 1: Add email delivery to schedule processor** - `38dee43b8` (feat)
2. **Task 2: Create ReportHistoryTable component** - `588e782be` (feat)
3. **Task 3: Update reports page with history table** - `859a3dab4` (feat)

**Plan metadata:** Pending (docs: complete plan)

## Files Created/Modified

- `open-seo-main/src/db/report-schema.ts` - Added scheduleId and emailSentAt columns with index
- `open-seo-main/src/server/workers/schedule-processor.ts` - Two-phase worker with email delivery
- `apps/web/src/components/reports/ReportHistoryTable.tsx` - Filterable report history table
- `apps/web/src/components/reports/ReportList.tsx` - Refactored to use history table
- `apps/web/src/app/(shell)/clients/[clientId]/reports/page.tsx` - Updated layout and styling
- `apps/web/src/components/reports/index.ts` - Added ReportHistoryTable export

## Decisions Made

- **Two-phase worker pattern:** Schedule processor runs phase 1 (check due schedules, enqueue generation) then phase 2 (send emails for completed reports) in the same job cycle for efficient polling
- **Rate limiting:** MAX_EMAILS_PER_RUN = 50 per 5-minute cycle prevents email floods (T-53-09 mitigation)
- **Delivery tracking:** scheduleId links reports to their originating schedule; emailSentAt null check identifies pending deliveries
- **Filter UX:** Status filter uses "all" as default rather than showing all status checkboxes

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-53-08 | Recipients validated from schedule.recipients array |
| T-53-09 | MAX_EMAILS_PER_RUN = 50 per cycle |
| T-53-10 | Existing requireClientAccess validates ownership |

## Issues Encountered

- Pre-existing TypeScript errors in other files (contracts validation, onboarding routes) - not related to this plan, documented for future cleanup

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Report scheduling and delivery infrastructure complete
- ReportHistoryTable ready for use in other contexts
- Phase 53-04 (Report Templates & White-Label) can proceed
- Schedule settings page (`/clients/{id}/settings/reports`) needs to be created

## Self-Check: PASSED

- [x] ReportHistoryTable.tsx exists
- [x] Commit 38dee43b8 exists (Task 1)
- [x] Commit 588e782be exists (Task 2)
- [x] Commit 859a3dab4 exists (Task 3)

---
*Phase: 53-reports-pdf*
*Completed: 2026-04-30*
