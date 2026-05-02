---
phase: "62"
plan: "02"
subsystem: command-center
tags: [follow-up, rules-engine, automation, bullmq]

dependency_graph:
  requires: [62-01]
  provides: [follow-up-service, rules-engine, follow-up-worker]
  affects: [command-center-dashboard, entity-workflows]

tech_stack:
  added: [bullmq-follow-up-queue]
  patterns: [polymorphic-entity-reference, trigger-condition-evaluation, tdd]

key_files:
  created:
    - open-seo-main/src/server/features/command-center/repositories/FollowUpRepository.ts
    - open-seo-main/src/server/features/command-center/repositories/FollowUpRulesRepository.ts
    - open-seo-main/src/server/features/command-center/services/FollowUpService.ts
    - open-seo-main/src/server/features/command-center/services/FollowUpService.test.ts
    - open-seo-main/src/server/features/command-center/services/RulesEngine.ts
    - open-seo-main/src/server/features/command-center/services/RulesEngine.test.ts
    - open-seo-main/src/server/queues/followUpQueue.ts
    - open-seo-main/src/server/workers/follow-up-processor.ts
    - open-seo-main/src/server/workers/follow-up-worker.ts
  modified:
    - open-seo-main/src/db/follow-up-schema.ts
    - open-seo-main/src/server/workers/index.ts

decisions:
  - Polymorphic entity reference pattern for follow-ups across 5 entity types
  - AND logic for trigger conditions (all conditions must match)
  - vi.hoisted() pattern for Vitest mock function declarations
  - 5-minute repeatable job for processing due follow-ups
  - Dead-letter queue pattern for failed jobs after max retries

metrics:
  duration_minutes: 18
  completed: 2026-05-02T18:25:18Z
  tasks_completed: 3
  tests_added: 25
  files_created: 9
  files_modified: 2
---

# Phase 62 Plan 02: Follow-up System with Rules Engine Summary

Follow-up service with polymorphic entity references and configurable rules engine for automated reminders.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | FollowUp Repository & Service (TDD) | 851330e34 | FollowUpRepository.ts, FollowUpRulesRepository.ts, FollowUpService.ts |
| 2 | Rules Engine (TDD) | 586d6d0b9 | RulesEngine.ts, RulesEngine.test.ts |
| 3 | BullMQ Worker | d8c1410a5 | followUpQueue.ts, follow-up-processor.ts, follow-up-worker.ts |

## Implementation Details

### Task 1: FollowUp Repository & Service

Created repository pattern for follow-ups and rules with workspace scoping:

**FollowUpRepository** operations:
- `findById`, `findByWorkspace`, `findByEntity` - Query operations with filters
- `findUpcoming`, `findOverdue`, `findDueToday` - Time-based queries
- `findDueForUnsnooze` - For processing snoozed follow-ups
- `create`, `update`, `delete` - CRUD operations

**FollowUpRulesRepository** operations:
- `findByWorkspace`, `findByEntityType` - Query rules
- `create`, `update`, `toggleActive` - Rule management

**FollowUpService** methods:
- `create` - Create manual follow-up with workspace and user context
- `createAutomated` - Create follow-up from rule execution
- `snooze` - Defer follow-up with snoozed_until timestamp
- `complete`, `cancel` - Status transitions
- `reschedule` - Update scheduled date
- `getForDashboard` - Aggregate overdue, dueToday, upcoming
- `autoResolveForEntity` - Bulk resolution when entity status changes
- `processUnsnooze` - Move snoozed items back to pending

### Task 2: Rules Engine

Implemented trigger condition evaluation with AND logic:

**Trigger conditions supported:**
- `status_changed_to` - Fires when entity transitions to specific status
- `status_equals` - Fires when entity has specific status
- `days_since` - Fires when entity age exceeds threshold
- `days_overdue_gte` - Fires when overdue days exceed threshold
- `value_gte_cents` - Fires when entity value exceeds threshold

**RulesEngine class:**
- `processEntityEvent` - Find matching rules and create/schedule follow-ups
- `scheduleDelayedFollowUp` - Queue delayed follow-up creation via BullMQ

### Task 3: BullMQ Worker

**followUpQueue** job types:
- `create_scheduled` - Create follow-up after delay_hours elapsed
- `process_due` - Recurring job every 5 minutes for due follow-ups
- `evaluate_rules` - Re-evaluate rules when entity status changes

**follow-up-worker** features:
- 60s lock duration for DB operations
- Concurrency of 2 parallel jobs
- 25s graceful shutdown timeout
- Dead-letter queue for failed jobs after 3 retries

## Test Coverage

25 tests total (all passing):

**FollowUpService.test.ts** (13 tests):
- Create follow-up with required fields
- Create with default priority
- Create automated follow-up
- Snooze operations (success, already completed, not found)
- Complete operations (success, idempotent)
- Cancel operation
- Get for dashboard aggregation
- Reschedule operations (normal, clear snooze)
- Get by entity

**RulesEngine.test.ts** (12 tests):
- status_changed_to match/no match
- status_equals match
- days_since threshold met/not met
- days_overdue_gte threshold
- value_gte_cents threshold
- Conditions not met
- AND logic requirement
- Process entity event (immediate, respects active flag, delayed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed user reference in schema**
- **Found during:** Task 3
- **Issue:** `follow-up-schema.ts` referenced `users.id` but export is `user.id`
- **Fix:** Updated import and all references to use `user` instead of `users`
- **Files modified:** `open-seo-main/src/db/follow-up-schema.ts`
- **Commit:** d8c1410a5

**2. [Rule 1 - Bug] Fixed Drizzle dynamic query pattern**
- **Found during:** Task 3
- **Issue:** Conditional `.limit()` and `.offset()` calls failed TypeScript
- **Fix:** Used `.$dynamic()` with default pagination values
- **Files modified:** `FollowUpRepository.ts`
- **Commit:** d8c1410a5

## Self-Check: PASSED

Files verified:
- FOUND: open-seo-main/src/server/features/command-center/repositories/FollowUpRepository.ts
- FOUND: open-seo-main/src/server/features/command-center/repositories/FollowUpRulesRepository.ts
- FOUND: open-seo-main/src/server/features/command-center/services/FollowUpService.ts
- FOUND: open-seo-main/src/server/features/command-center/services/RulesEngine.ts
- FOUND: open-seo-main/src/server/queues/followUpQueue.ts
- FOUND: open-seo-main/src/server/workers/follow-up-processor.ts
- FOUND: open-seo-main/src/server/workers/follow-up-worker.ts

Commits verified:
- FOUND: 851330e (Task 1)
- FOUND: 586d6d0 (Task 2)
- FOUND: d8c1410 (Task 3)
