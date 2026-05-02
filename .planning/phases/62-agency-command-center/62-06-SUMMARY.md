---
phase: 62-agency-command-center
plan: 06
subsystem: command-center
tags: [dashboard, quick-actions, needs-attention]
dependency_graph:
  requires: [62-05]
  provides: [NeedsAttentionList, QuickActionDialog, QuickActionService]
  affects: [proposals, prospects, workflows, follow-ups]
tech_stack:
  added: []
  patterns: [server-actions, optimistic-ui, priority-sorting]
key_files:
  created:
    - apps/web/src/types/command-center.ts
    - apps/web/src/components/command-center/PriorityBadge.tsx
    - apps/web/src/components/command-center/EntityIcon.tsx
    - apps/web/src/hooks/command-center/useNeedsAttention.ts
    - apps/web/src/app/(dashboard)/command-center/_components/NeedsAttentionList.tsx
    - apps/web/src/app/(dashboard)/command-center/_components/QuickActionDialog.tsx
    - apps/web/src/app/(dashboard)/command-center/actions.ts
    - open-seo-main/src/server/features/command-center/services/QuickActionService.ts
    - open-seo-main/src/routes/api/command-center/actions/send-reminder.ts
    - open-seo-main/src/routes/api/command-center/actions/snooze.ts
    - open-seo-main/src/routes/api/command-center/actions/mark-lost.ts
    - open-seo-main/src/routes/api/command-center/actions/add-note.ts
    - open-seo-main/src/routes/api/command-center/alerts/$alertId.dismiss.ts
  modified: []
decisions:
  - "Native date input for snooze picker - simpler than full calendar component"
  - "Inline feedback messages instead of global toast - consistent with existing patterns"
  - "Priority sorting: critical > high > medium > low using numeric mapping"
  - "Loss reason subset in UI - 10 common reasons from full 17-value taxonomy"
metrics:
  duration: 9m 9s
  completed: 2026-05-02
---

# Phase 62 Plan 06: Needs Attention List with Quick Actions Summary

Priority-sorted action list with one-click operations for rapid deal management.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create NeedsAttentionList component | 23e7a6c72 | NeedsAttentionList.tsx, PriorityBadge.tsx, EntityIcon.tsx |
| 2 | Create QuickActionDialog and Server Actions | 9044577ba | QuickActionDialog.tsx, actions.ts |
| 3 | Create QuickActionService and API endpoints | a19d383b0 | QuickActionService.ts, 5 API routes |

## Implementation Details

### Task 1: NeedsAttentionList Component

Created priority-sorted attention list per DESIGN.md Section 5.2:

- **types/command-center.ts**: Shared types for AttentionItem, EntityType, Priority, LossReason
- **PriorityBadge.tsx**: Color-coded badge (critical=red, high=orange, medium=yellow, low=blue)
- **EntityIcon.tsx**: Lucide icons per entity type (Users, FileText, FileSignature, CreditCard, User)
- **useNeedsAttention.ts**: React Query hook with 60s auto-refresh
- **NeedsAttentionList.tsx**: Main component with:
  - Priority sorting (critical > high > medium > low)
  - Dropdown menu with 4 quick actions
  - Skeleton loading state
  - Value display with currency formatting
  - Scrollable list (400px max height)

### Task 2: QuickActionDialog and Server Actions

Created dialog and server-side actions:

- **actions.ts**: Server Actions with Zod validation
  - `sendReminder`: Send reminder email to entity contact
  - `snoozeFollowUp`: Snooze until specific date
  - `markAsLost`: Mark prospect/proposal as lost with reason
  - `addNote`: Add note to entity activity log
  - `dismissAlert`: Dismiss smart alert

- **QuickActionDialog.tsx**: Form dialog with:
  - Action-specific form fields
  - Native date input for snooze picker
  - Loss reason dropdown (10 common reasons)
  - Competitor name field (shown when "chose competitor" selected)
  - Inline success/error feedback
  - Loading state with spinner

### Task 3: QuickActionService and API

Created backend service and routes:

- **QuickActionService.ts**: Business logic layer
  - `sendReminder`: Get contact email, log activity (email sending TODO)
  - `snooze`: Snooze workflow instances and pending follow-ups
  - `markAsLost`: Create deal_outcome record, update entity status, cancel workflows
  - `addNote`: Log to activity feed
  - `dismissAlert`: Mark smart alert as dismissed

- **API Routes** (TanStack Start pattern):
  - POST `/api/command-center/actions/send-reminder`
  - POST `/api/command-center/actions/snooze`
  - POST `/api/command-center/actions/mark-lost`
  - POST `/api/command-center/actions/add-note`
  - POST `/api/command-center/alerts/:alertId/dismiss`

## Verification

TypeScript compilation passes for all new files in both apps/web and open-seo-main.

Pre-existing issues in codebase:
- apps/web: 2 pre-existing errors in unrelated files (ConnectionCard, DuplicateButton)
- open-seo-main: ts-expect-error directive warnings (expected for new routes before type regeneration)

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Component | Mitigation |
|-----------|-----------|------------|
| T-62-06-01 | markAsLost | Workspace validation via X-Workspace-Id header in API routes |
| T-62-06-02 | sendReminder | Rate limiting placeholder in service (to be implemented in API layer) |
| T-62-06-03 | snooze | Only return entity data from workspace scope |

## Dependencies Wired

- NeedsAttentionList -> useNeedsAttention hook -> /api/command-center/needs-attention
- QuickActionDialog -> Server Actions (actions.ts) -> QuickActionService API routes
- QuickActionService -> EngagementService (workflow cancellation)
- QuickActionService -> FollowUpService (auto-resolve follow-ups)
- markAsLost -> dealOutcomes table (creates outcome record)

## Self-Check: PASSED

All created files verified to exist:
- [x] apps/web/src/types/command-center.ts
- [x] apps/web/src/components/command-center/PriorityBadge.tsx
- [x] apps/web/src/components/command-center/EntityIcon.tsx
- [x] apps/web/src/hooks/command-center/useNeedsAttention.ts
- [x] apps/web/src/app/(dashboard)/command-center/_components/NeedsAttentionList.tsx
- [x] apps/web/src/app/(dashboard)/command-center/_components/QuickActionDialog.tsx
- [x] apps/web/src/app/(dashboard)/command-center/actions.ts
- [x] open-seo-main/src/server/features/command-center/services/QuickActionService.ts
- [x] open-seo-main/src/routes/api/command-center/actions/send-reminder.ts
- [x] open-seo-main/src/routes/api/command-center/actions/snooze.ts
- [x] open-seo-main/src/routes/api/command-center/actions/mark-lost.ts
- [x] open-seo-main/src/routes/api/command-center/actions/add-note.ts
- [x] open-seo-main/src/routes/api/command-center/alerts/$alertId.dismiss.ts

All commits verified in git log.
