---
phase: 62-agency-command-center
plan: 07
subsystem: command-center
tags: [alerts, websocket, activity-feed, bullmq, real-time]
dependency_graph:
  requires: [62-06, 62-04]
  provides: [AlertDetectionService, SmartAlerts, ActivityFeed, activityFeed]
  affects: [command-center-dashboard]
tech_stack:
  added: [socket.io-client]
  patterns: [TDD, repository-pattern, optimistic-updates, real-time-websocket]
key_files:
  created:
    - open-seo-main/src/server/features/command-center/services/AlertDetectionService.ts
    - open-seo-main/src/server/features/command-center/services/AlertDetectionService.test.ts
    - open-seo-main/src/server/features/command-center/repositories/SmartAlertRepository.ts
    - open-seo-main/src/server/queues/alertDetectionQueue.ts
    - open-seo-main/src/server/workers/alert-detection-processor.ts
    - open-seo-main/src/server/workers/alert-detection-worker.ts
    - open-seo-main/src/server/websocket/activityFeed.ts
    - apps/web/src/hooks/command-center/useActivityFeed.ts
    - apps/web/src/hooks/command-center/useSmartAlerts.ts
    - apps/web/src/app/(dashboard)/command-center/_components/SmartAlerts.tsx
    - apps/web/src/app/(dashboard)/command-center/_components/ActivityFeed.tsx
  modified:
    - open-seo-main/src/server/workers/index.ts
decisions:
  - Used TDD approach for AlertDetectionService with vi.hoisted() mocking pattern
  - Calculated proposal value as setupFeeCents + monthlyFeeCents*12 (annual value approximation)
  - Used existing Socket.IO server infrastructure with workspace-scoped rooms
  - Implemented optimistic updates for alert dismiss with rollback on error
metrics:
  duration: ~45min
  completed: 2025-05-02T22:15:00Z
---

# Phase 62 Plan 07: Smart Alert Detection Summary

Smart alert detection with 5 rules and real-time activity feed via Socket.IO for proactive pipeline monitoring.

## One-Liner

5 alert rules (high_value_stuck, win_rate_declining, contract_expiring_soon, unassigned_prospects, collection_velocity_drop) with BullMQ 5-minute scheduling and Socket.IO real-time activity feed.

## What Was Built

### Task 1: AlertDetectionService with TDD (13 tests)

**SmartAlertRepository** (`open-seo-main/src/server/features/command-center/repositories/SmartAlertRepository.ts`):
- `findByWorkspace(workspaceId, activeOnly)` - List alerts with optional filter
- `findActiveByType(workspaceId, alertType)` - Check for existing alert (duplicate prevention)
- `create(data)` - Create new alert
- `dismiss(id, userId)` - User-initiated dismiss
- `resolve(id)` - Auto-resolve when condition clears
- `expireOld()` - Expire alerts past expiresAt

**AlertDetectionService** (`open-seo-main/src/server/features/command-center/services/AlertDetectionService.ts`):
- 5 alert rules per DESIGN.md Section 4.1
- `detectAlerts(workspaceId, metrics)` - Evaluate all rules
- `evaluateRule(rule, metrics, workspace)` - Create/resolve per rule
- Auto-resolve when condition no longer applies
- Duplicate prevention via existing check

**Alert Rules:**
| Rule | Trigger | Severity |
|------|---------|----------|
| high_value_stuck | Proposal > 5000 EUR, no activity 7+ days | high |
| win_rate_declining | Win rate dropped > 5% | medium |
| contract_expiring_soon | Contract expires in 14 days | high |
| unassigned_prospects | 3+ prospects without owner in 2 days | low |
| collection_velocity_drop | Avg collection time +5 days | medium |

### Task 2: Alert Detection Worker and Activity Feed

**alertDetectionQueue.ts** - BullMQ queue with 5-minute schedule:
- `detect_workspace` job type for single workspace
- `detect_all` job type for batch detection
- 2 attempts with 5-second backoff
- Job retention: 50 completed, 100 failed

**alert-detection-processor.ts** - Job processor:
- Fetches workspace metrics from pipelineMetrics table
- Runs AlertDetectionService.detectAlerts()
- Error isolation per workspace in batch mode
- Expires old alerts after batch completion

**alert-detection-worker.ts** - BullMQ worker:
- Concurrency: 1 (avoid rate limits)
- Rate limit: 10 jobs per minute
- DLQ support for failed jobs after all attempts

**activityFeed.ts** - Unified activity event emitter:
- `emitActivity(workspaceId, payload)` - Generic event emission
- `emitProspectActivity()`, `emitProposalActivity()`, etc. - Type-safe helpers
- 30+ activity types (lifecycle, alerts, follow-ups, workflows, payments)

### Task 3: Dashboard Components

**useActivityFeed.ts** - Socket.IO hook:
- Clerk JWT authentication in handshake
- Auto-reconnect with exponential backoff
- Keeps last 50 events in memory
- Connection status tracking (connected, connecting, error)

**useSmartAlerts.ts** - TanStack Query hook:
- 60-second refresh interval
- 30-second stale time
- Optimistic dismiss with rollback on error
- Active alerts filter (not dismissed, not resolved)

**SmartAlerts.tsx** - Alert display component:
- Severity-based color coding (critical/high/medium/low)
- Dismiss button with optimistic update
- Suggested action links
- "All clear" state when no alerts

**ActivityFeed.tsx** - Real-time activity stream:
- Entity-type icons (prospect, proposal, contract, invoice, etc.)
- Activity-type colors (green for positive, red for negative, orange for warnings)
- Connection status indicator (Wifi/WifiOff)
- 300px scrollable area with auto-scroll

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed proposal schema mismatch in high_value_stuck rule**
- **Found during:** Task 2 type check
- **Issue:** Used non-existent `totalValueCents` and `clientName` columns
- **Fix:** Changed to `setupFeeCents + monthlyFeeCents*12` calculation, joined with prospects table for `companyName`
- **Files modified:** AlertDetectionService.ts, AlertDetectionService.test.ts
- **Commit:** d4c097987

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 1c67d2a43 | feat | implement AlertDetectionService with 5 alert rules |
| d4c097987 | fix | use correct proposal schema columns for high_value_stuck rule |
| 501f0b7bf | feat | add alert detection worker and real-time activity feed |
| 77ce123aa | feat | add SmartAlerts and ActivityFeed dashboard components |

## Test Results

```
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  22:01:55
   Duration  241ms
```

## Self-Check: PASSED

- [x] AlertDetectionService.ts exists
- [x] AlertDetectionService.test.ts exists with 13 passing tests
- [x] SmartAlertRepository.ts exists
- [x] alertDetectionQueue.ts exists
- [x] alert-detection-processor.ts exists
- [x] alert-detection-worker.ts exists
- [x] activityFeed.ts exists
- [x] useActivityFeed.ts exists
- [x] useSmartAlerts.ts exists
- [x] SmartAlerts.tsx exists
- [x] ActivityFeed.tsx exists
- [x] All commits verified in git log
