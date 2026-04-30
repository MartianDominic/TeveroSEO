---
phase: 46-47-proposal-system
plan: 02
subsystem: proposals
tags: [public-access, view-tracking, client-actions]
dependency_graph:
  requires: [46-01]
  provides: [public-proposal-page, accept-reject-api, view-tracking]
  affects: [pipeline-activities, proposal-state-machine]
tech_stack:
  added: []
  patterns: [server-actions, beacon-tracking, fire-and-forget]
key_files:
  created:
    - apps/web/src/app/proposals/[token]/page.tsx
    - apps/web/src/app/proposals/[token]/layout.tsx
    - apps/web/src/app/proposals/[token]/actions.ts
    - apps/web/src/app/proposals/[token]/components/ProposalView.tsx
    - apps/web/src/app/proposals/[token]/components/AcceptRejectButtons.tsx
    - apps/web/src/app/api/proposals/beacon/route.ts
    - open-seo-main/src/routes/api/proposals/public/$token.ts
    - open-seo-main/src/routes/api/proposals/[id]/accept.ts
    - open-seo-main/src/routes/api/proposals/[id]/reject.ts
    - open-seo-main/src/routes/api/proposals/track.ts
  modified:
    - open-seo-main/src/db/activity-schema.ts
decisions:
  - "Add 'proposal' to ENTITY_TYPES in activity-schema.ts for activity logging"
  - "Use fire-and-forget pattern for beacon tracking to not block image response"
  - "ProposalStatus type imported from proposal-schema.ts for canTransition validation"
metrics:
  duration_seconds: 472
  completed_date: "2026-04-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 10
  files_modified: 1
---

# Phase 46-47 Plan 02: Public Proposal Page Summary

Public client-facing proposal page with view tracking via beacon and accept/reject functionality with activity logging.

## One-liner

Public /proposals/[token] route with beacon view tracking, accept/reject endpoints logging to pipeline_activities with actorType='client'.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Public proposal fetch and accept/reject API | 81c4981b1 | public/$token.ts, [id]/accept.ts, [id]/reject.ts |
| 2 | Beacon endpoint for view tracking | de999b976 | beacon/route.ts, track.ts |
| 3 | Public proposal view page | 0023da578 | [token]/page.tsx, ProposalView.tsx, AcceptRejectButtons.tsx |

## Key Deliverables

### API Endpoints (open-seo-main)

1. **GET /api/proposals/public/:token** - Fetch proposal by public token
   - No auth required, token provides access
   - Tracks view via ViewTrackingService
   - Returns 410 for expired proposals

2. **POST /api/proposals/:id/accept** - Accept proposal
   - Transitions from viewed to accepted
   - Logs to pipeline_activities with actorType='client'

3. **POST /api/proposals/:id/reject** - Reject proposal
   - Optional reason and notes
   - Logs to pipeline_activities with actorType='client'

4. **POST /api/proposals/track** - Track view from beacon
   - Called by beacon endpoint
   - ViewTrackingService handles 5-minute deduplication

### Beacon Tracking (apps/web)

- **GET /api/proposals/beacon?t=token** - Returns 1x1 transparent GIF
- Fire-and-forget tracking call to open-seo-main
- No-cache headers ensure tracking fires each time

### Public Page (apps/web)

- **/proposals/[token]** - Public proposal viewing
- No auth wrapper (outside shell)
- ProposalView: hero, current state, opportunities, investment, ROI, next steps
- AcceptRejectButtons: accept/reject with loading states, error handling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added 'proposal' to ENTITY_TYPES**
- **Found during:** Task 1
- **Issue:** activity-schema.ts ENTITY_TYPES did not include 'proposal'
- **Fix:** Added 'proposal' to the ENTITY_TYPES array
- **Files modified:** open-seo-main/src/db/activity-schema.ts
- **Commit:** 81c4981b1

**2. [Rule 1 - Bug] Fixed ProposalStatus type import**
- **Found during:** Task 1
- **Issue:** ProposalService doesn't re-export ProposalStatus type
- **Fix:** Import ProposalStatus from proposal-schema.ts instead
- **Files modified:** open-seo-main/src/routes/api/proposals/[id]/reject.ts
- **Commit:** 81c4981b1

**3. [Rule 1 - Bug] Fixed AppError statusCode property**
- **Found during:** Task 1
- **Issue:** AppError class doesn't have statusCode property
- **Fix:** Use error code mapping instead of statusCode property
- **Files modified:** open-seo-main/src/routes/api/proposals/[id]/reject.ts
- **Commit:** 81c4981b1

## Requirements Traced

- [x] PROP-03: Public route at /proposals/[token] - no auth required
- [x] PROP-04: View tracking via 1x1 beacon image with IP hashing
- [x] PROP-05: Accept/reject with activity logging (actorType='client')

## Verification Results

- [x] TypeScript compilation passes (open-seo-main)
- [x] Next.js build succeeds (apps/web)
- [x] All acceptance criteria verified via grep checks

## Self-Check: PASSED

All created files exist and all commits verified in git log.
