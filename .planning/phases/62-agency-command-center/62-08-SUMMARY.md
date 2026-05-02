---
phase: 62-agency-command-center
plan: 08
subsystem: command-center
tags: [analytics, i18n, e2e, win-loss, dashboard]
dependency_graph:
  requires:
    - 62-07-SUMMARY.md (Smart alerts, Activity feed)
    - 62-05-SUMMARY.md (Dashboard Core UI)
    - 62-01-SUMMARY.md (deal_outcomes schema)
  provides:
    - AnalyticsService with win/loss metrics
    - DealOutcomeRepository with aggregations
    - WinLossAnalytics + LossReasonChart components
    - EN/LT translations for Command Center
    - E2E test suite
  affects:
    - /command-center dashboard page
tech_stack:
  added:
    - recharts PieChart for loss reason visualization
  patterns:
    - Repository pattern for deal outcome aggregations
    - TanStack Query for analytics data fetching
    - next-intl for i18n translations
key_files:
  created:
    - open-seo-main/src/server/features/command-center/services/AnalyticsService.ts
    - open-seo-main/src/server/features/command-center/services/AnalyticsService.test.ts
    - open-seo-main/src/server/features/command-center/repositories/DealOutcomeRepository.ts
    - apps/web/src/app/(dashboard)/command-center/_components/WinLossAnalytics.tsx
    - apps/web/src/app/(dashboard)/command-center/_components/LossReasonChart.tsx
    - apps/web/src/i18n/locales/en/command-center.json
    - apps/web/src/i18n/locales/lt/command-center.json
    - e2e/command-center.spec.ts
  modified:
    - apps/web/messages/en.json
    - apps/web/messages/lt.json
decisions:
  - Recharts PieLabelRenderProps for TypeScript-safe custom labels
  - Parallel repository queries in getWinLossAnalytics for performance
  - next-intl useTranslations with commandCenter namespace
  - E2E tests use conditional skips for empty data states
metrics:
  duration: 8m 26s
  completed_date: 2026-05-02T18:58:08Z
  tasks_completed: 3
  tests_added: 14 (unit) + 24 (e2e)
  files_created: 8
  files_modified: 2
---

# Phase 62 Plan 08: Win/Loss Analytics, i18n, and E2E Tests Summary

Win/Loss analytics service with loss reason distribution, top competitors tracking, and full EN/LT translations with comprehensive E2E test coverage.

## Completed Tasks

### Task 1: AnalyticsService and Win/Loss Components

Created backend analytics service and frontend visualization:

**DealOutcomeRepository** (`open-seo-main/src/server/features/command-center/repositories/DealOutcomeRepository.ts`):
- `findByWorkspace()` - Fetch outcomes with optional date range
- `countByOutcome()` - Aggregate win/loss counts with FILTER clause
- `groupByLossReason()` - Group losses by reason with COUNT
- `getTopCompetitors()` - Competitor frequency sorted DESC
- `getAvgCycleDays()` - Mean cycle duration for won deals

**AnalyticsService** (`open-seo-main/src/server/features/command-center/services/AnalyticsService.ts`):
- `getDealOutcomes()` - Returns won, lost, total counts
- `getLossReasonDistribution()` - Reasons with percentages
- `getTopCompetitors()` - Top N competitors by frequency
- `getAvgCycleTime()` - Average days to close won deals
- `getWinLossAnalytics()` - Combined payload with parallel queries

**Frontend Components**:
- `WinLossAnalytics.tsx` - Summary stats (win rate, avg cycle, won/lost counts)
- `LossReasonChart.tsx` - Recharts donut pie chart with custom labels

**Tests**: 14 unit tests covering all service methods and edge cases.

### Task 2: i18n Locale Files (EN/LT)

Created comprehensive translations for Command Center:

**English** (`apps/web/src/i18n/locales/en/command-center.json`):
- Dashboard sections (today, pipeline, needsAttention, revenue, funnel, alerts, activity)
- Actions (sendReminder, markLost, snooze, addNote, followUpOn)
- Workflow statuses (active, paused, snoozed, completed, won, lost)
- Analytics labels (winLoss, lossReasons, competitors)
- All 17 loss reasons translated
- Common strings (days, cancel, save, send)

**Lithuanian** (`apps/web/src/i18n/locales/lt/command-center.json`):
- Full Lithuanian translations for all strings
- Proper Lithuanian grammar for loss reasons

**Main Messages Updated**:
- `apps/web/messages/en.json` - Added commandCenter namespace
- `apps/web/messages/lt.json` - Added commandCenter namespace with LT translations

### Task 3: E2E Tests for Command Center

Created comprehensive Playwright test suite (`e2e/command-center.spec.ts`):

**Test Categories**:
1. **Dashboard Display** (5 tests)
   - Page title and header
   - Today Action Bar counts
   - Pipeline Health Cards
   - Revenue Pipeline section
   - Conversion Funnel

2. **Performance** (1 test)
   - Dashboard loads within 1.5 seconds

3. **Needs Attention List** (2 tests)
   - Section display
   - Items or empty state

4. **Quick Actions** (3 tests)
   - Send Reminder dialog
   - Mark as Lost with reason dropdown
   - Snooze with date picker

5. **Activity Feed** (2 tests)
   - Section display
   - Connection status indicator

6. **Smart Alerts** (2 tests)
   - Section display when alerts exist
   - Alert dismissal

7. **Win/Loss Analytics** (4 tests)
   - Win rate metric
   - Average cycle time
   - Loss reason chart
   - Top competitors

8. **Language Toggle** (1 test)
   - Switch to Lithuanian

9. **Responsive Layout** (2 tests)
   - Mobile viewport (375x667)
   - Tablet viewport (768x1024)

10. **Error Handling** (2 tests)
    - API error graceful handling
    - Loading state display

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | f5a9f9308 | feat(62-08): add Win/Loss Analytics service and components |
| 2 | ca6233118 | feat(62-08): add i18n locale files for Command Center (EN/LT) |
| 3 | b782ef9fb | test(62-08): add E2E tests for Command Center dashboard |

## Deviations from Plan

None - plan executed exactly as written.

## Phase 62 Completion Status

With 62-08 complete, Phase 62 (Agency Command Center) delivers:

1. **10 Database Tables**: follow_ups, follow_up_rules, workflow_templates, workflow_instances, workflow_events, deal_outcomes, pipeline_metrics, smart_alerts, dashboard_views, notification_preferences

2. **Follow-up System**: Rules engine with configurable triggers, automated follow-up creation

3. **Engagement Workflow Engine**: Template-based sequences with anti-annoyance safeguards (max touches/week, cooldown periods, skip on response)

4. **Pipeline Metrics Worker**: 5-minute BullMQ refresh, pre-computed aggregations, stale-while-revalidate

5. **Command Center Dashboard**:
   - Today Action Bar (overdue, due, awaiting, new counts)
   - Pipeline Health Cards (prospects, proposals, agreements, payments)
   - Revenue Pipeline (this month, last month, outstanding, overdue)
   - Conversion Funnel with Recharts
   - Needs Attention list with Quick Actions
   - Smart Alert detection (5 rules)
   - Real-time Activity Feed (Socket.IO)
   - Win/Loss Analytics with loss reason chart

6. **Full i18n**: English and Lithuanian translations

7. **E2E Test Suite**: 24 Playwright tests covering critical flows

## Self-Check: PASSED

All files verified to exist:
- [x] open-seo-main/src/server/features/command-center/services/AnalyticsService.ts
- [x] open-seo-main/src/server/features/command-center/services/AnalyticsService.test.ts
- [x] open-seo-main/src/server/features/command-center/repositories/DealOutcomeRepository.ts
- [x] apps/web/src/app/(dashboard)/command-center/_components/WinLossAnalytics.tsx
- [x] apps/web/src/app/(dashboard)/command-center/_components/LossReasonChart.tsx
- [x] apps/web/src/i18n/locales/en/command-center.json
- [x] apps/web/src/i18n/locales/lt/command-center.json
- [x] e2e/command-center.spec.ts

All commits verified:
- [x] f5a9f9308 - Task 1
- [x] ca6233118 - Task 2
- [x] b782ef9fb - Task 3
