---
phase: 66-platform-unification
plan: 07
subsystem: pixel
tags:
  - dom-injection
  - approval-workflow
  - api
  - ui
dependency_graph:
  requires:
    - 66-01 (pixelDomChanges schema)
  provides:
    - dom-change-service
    - change-approval-api
    - change-approval-ui
  affects:
    - 66-08 (pixel config includes approved changes)
tech_stack:
  added:
    - DomChangeService
    - TanStack Start API routes
    - React approval UI components
  patterns:
    - Approval workflow (pending -> live -> rolled_back)
    - Before/after diff preview
    - Content sanitization (T-66-19)
    - Audit trail (T-66-22)
key_files:
  created:
    - open-seo-main/src/server/features/pixel/dom-change.service.ts
    - open-seo-main/src/server/features/pixel/dom-change.service.test.ts
    - open-seo-main/src/routes/api/pixel/[siteId]/changes.ts
    - open-seo-main/src/routes/api/pixel/[siteId]/changes.pending.ts
    - open-seo-main/src/routes/api/pixel/[siteId]/changes.history.ts
    - open-seo-main/src/routes/api/pixel/changes/[changeId].ts
    - apps/web/src/components/pixel/pending-changes.tsx
    - apps/web/src/components/pixel/change-approval.tsx
    - apps/web/src/components/pixel/change-history.tsx
    - apps/web/src/components/pixel/index.ts
  modified:
    - open-seo-main/src/server/features/pixel/index.ts
decisions:
  - Title attribute for tooltips (Tooltip component not in @tevero/ui)
  - Native HTML title for truncated values and relative timestamps
  - Change approval moves directly to live status (no separate approved state delay)
  - Rollback creates new live change with old value (audit trail preserved)
metrics:
  duration_seconds: 546
  completed_at: "2026-05-03T11:35:00Z"
  tasks: 3
  tests: 32
  files_created: 10
  files_modified: 1
---

# Phase 66 Plan 07: DOM Change Approval System Summary

Implemented complete DOM change approval system for pixel-injected SEO modifications with full lifecycle management, API endpoints, and approval UI.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 474055380 | feat | Implement DomChangeService with full lifecycle management |
| b9b564444 | feat | Add DOM change API endpoints |
| 7aa7e55f7 | feat | Add DOM change approval UI components |

## Deliverables

### DomChangeService (528 lines)

Service class managing the full change lifecycle:

- **queueChange(request)**: Creates pending change, captures oldValue from current live state
- **approveChange(changeId, userId)**: Transitions pending to live, sets audit fields
- **rejectChange(changeId, userId, reason?)**: Marks as rejected with optional reason
- **rollbackChange(changeId, userId)**: Creates reverse change, marks original as rolled_back
- **getApprovedChanges(siteId, pageUrl?)**: Returns live changes for pixel injection
- **getPendingChanges(siteId)**: Returns changes awaiting approval
- **getChangeHistory(siteId, options?)**: Returns all changes with pagination

Security mitigations implemented:
- T-66-19: HTML sanitization (script tags, event handlers), JSON schema validation
- T-66-21: siteId validation against pixel installation
- T-66-22: Full audit trail with userId, approvedAt, deployedAt

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/pixel/:siteId/changes | GET | Get approved changes for pixel |
| /api/pixel/:siteId/changes | POST | Queue new change |
| /api/pixel/:siteId/changes/pending | GET | Get pending changes for UI |
| /api/pixel/:siteId/changes/history | GET | Get full history with pagination |
| /api/pixel/changes/:changeId | GET | Get single change details |
| /api/pixel/changes/:changeId | PATCH | Approve or reject |
| /api/pixel/changes/:changeId | DELETE | Rollback live change |

### UI Components

1. **PendingChanges** (300 lines)
   - Card list of pending changes with type badges
   - Quick approve/reject icon buttons
   - Timestamp and target URL display
   - Empty state and loading skeletons

2. **ChangeApproval** (475 lines)
   - Full review view with change details
   - Side-by-side and unified diff views
   - JSON syntax highlighting for schema changes
   - Search result preview for meta title/description
   - Rejection dialog with reason input

3. **ChangeHistory** (366 lines)
   - Table with all change types and statuses
   - Status badges: pending (yellow), live (green), rejected (red), rolled_back (gray)
   - Rollback button for live changes
   - Pagination controls

## Test Coverage

- **dom-change.service.test.ts**: 32 tests covering all service methods
- Tests for queueChange, approveChange, rejectChange, rollbackChange
- Tests for getPendingChanges, getApprovedChanges, getChangeHistory
- Content sanitization and schema validation tests
- Total pixel tests: 346 passing

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] Changes can be queued with all supported types
- [x] Approval workflow transitions status correctly
- [x] Only approved changes are served to pixel
- [x] Rollback creates reverse change
- [x] History shows complete audit trail
- [x] Tests achieve 80%+ coverage (32 tests)

## Self-Check: PASSED

- [x] open-seo-main/src/server/features/pixel/dom-change.service.ts exists (528 lines)
- [x] open-seo-main/src/server/features/pixel/dom-change.service.test.ts exists (649 lines)
- [x] All 4 API endpoint files exist
- [x] All 3 UI component files exist (pending-changes, change-approval, change-history)
- [x] apps/web/src/components/pixel/change-approval.tsx has 475 lines (>100 min)
- [x] Commit 474055380 exists
- [x] Commit b9b564444 exists
- [x] Commit 7aa7e55f7 exists
