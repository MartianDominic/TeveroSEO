---
phase: 62-agency-command-center
plan: 01
subsystem: database
tags: [schema, drizzle, postgresql, command-center]
dependency_graph:
  requires: []
  provides: [follow_ups, workflow_templates, workflow_instances, deal_outcomes, pipeline_metrics, smart_alerts, cc_dashboard_views, notification_preferences]
  affects: [62-02, 62-03, 62-04, 62-05, 62-06, 62-07, 62-08]
tech_stack:
  added: []
  patterns: [polymorphic-entity-reference, jsonb-config, state-machine, anti-annoyance-safeguards]
key_files:
  created:
    - open-seo-main/src/db/schema/follow-ups.ts
    - open-seo-main/src/db/schema/workflow-templates.ts
    - open-seo-main/src/db/schema/workflow-instances.ts
    - open-seo-main/src/db/schema/deal-outcomes.ts
    - open-seo-main/src/db/schema/pipeline-metrics.ts
    - open-seo-main/src/db/schema/smart-alerts.ts
    - open-seo-main/src/db/schema/dashboard-views.ts
    - open-seo-main/src/db/schema/notification-preferences.ts
    - open-seo-main/drizzle/0062_command_center_schema.sql
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - Renamed dashboard_views to cc_dashboard_views to avoid conflict with Phase 21 table
  - Used CC_ prefix for ENTITY_TYPES export to avoid collision with activity-schema.ts
  - Created manual SQL migration since drizzle-kit requires TTY for interactive prompts
metrics:
  duration_minutes: 10
  completed_at: "2026-05-02T18:23:00Z"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 55
  files_created: 10
  files_modified: 2
---

# Phase 62 Plan 01: Command Center Schema Summary

**One-liner:** 10 Drizzle tables with polymorphic entity tracking, workflow state machines, and anti-annoyance safeguards for Agency Command Center.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Follow-ups and workflow schemas | ccc7f1fb1 | follow-ups.ts, workflow-templates.ts, workflow-instances.ts |
| 2 | Deal outcomes, metrics, alerts, preferences | 01f125dfa | deal-outcomes.ts, pipeline-metrics.ts, smart-alerts.ts, dashboard-views.ts, notification-preferences.ts |
| 3 | Schema index and migration | ddbec6528 | schema.ts, 0062_command_center_schema.sql |

## Schema Summary

### Tables Created (10 total)

| Table | Purpose | Key Features |
|-------|---------|--------------|
| follow_ups | Follow-up tracking | Polymorphic entity_type (5 types), priority levels, snooze support |
| follow_up_rules | Automation rules | JSONB trigger_conditions, 4 action types |
| workflow_templates | Engagement sequences | Anti-annoyance config, JSONB steps, system templates |
| workflow_instances | Active workflows | 8-state machine, snooze until date, weekly touch tracking |
| workflow_events | Workflow audit log | 11 event types, step execution details |
| deal_outcomes | Win/loss tracking | 17 loss reasons, deal value, cycle time |
| pipeline_metrics | Pre-computed metrics | UNIQUE per workspace, 40+ count/financial/rate columns |
| smart_alerts | AI-detected anomalies | Severity levels, metric comparison, dismissal tracking |
| cc_dashboard_views | Saved view configs | JSONB filters/layout, nullable user_id for shared views |
| notification_preferences | User notifications | Per-workspace settings, 7 event toggles, quiet hours |

### Indexes Created

- Workspace + status indexes for all entity-scoped tables
- Entity type + entity_id indexes for polymorphic lookups
- Scheduled_at indexes for follow-up scheduling queries
- Active workflow indexes for BullMQ worker queries
- Loss reason indexes for analytics queries

### CHECK Constraints

- Entity types: prospect, proposal, contract, invoice, client
- Follow-up types: reminder, check_in, escalation, deadline, custom
- Follow-up status: pending, snoozed, completed, cancelled, auto_resolved
- Workflow status: pending, active, paused, snoozed, completed, cancelled, won, lost
- Event types: started, step_executed, step_skipped, paused, resumed, snoozed, unsnoozed, response_detected, completed, cancelled, error
- Alert severity: critical, high, medium, low
- Loss reasons: 17 values covering pricing, timing, fit, competition, process

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Table name conflict with Phase 21**
- **Found during:** Task 3
- **Issue:** dashboard_views table already exists in dashboard-schema.ts from Phase 21
- **Fix:** Renamed to cc_dashboard_views with cc_ prefix throughout
- **Files modified:** dashboard-views.ts, schema.ts, deal-outcomes.test.ts
- **Commit:** ddbec6528

**2. [Rule 3 - Blocking] Export naming conflicts**
- **Found during:** Task 3
- **Issue:** ENTITY_TYPES exported from activity-schema.ts, DashboardViewSelect/Insert from dashboard-schema.ts
- **Fix:** Used explicit re-exports with prefixes (CC_ENTITY_TYPES, CCDashboardViewSelect, etc.)
- **Files modified:** schema.ts
- **Commit:** ddbec6528

**3. [Rule 3 - Blocking] Drizzle-kit requires TTY**
- **Found during:** Task 3
- **Issue:** `pnpm drizzle-kit generate` fails in non-interactive shell
- **Fix:** Created manual SQL migration file with all CREATE TABLE/INDEX statements
- **Files created:** 0062_command_center_schema.sql
- **Commit:** ddbec6528

## Verification

```bash
# All schema files exist
ls open-seo-main/src/db/schema/*.ts | wc -l  # 11 files

# TypeScript compiles
pnpm exec tsc --noEmit  # No errors

# Tests pass
pnpm test src/db/schema/follow-ups.test.ts src/db/schema/deal-outcomes.test.ts
# 55 tests passed

# Migration file ready
cat open-seo-main/drizzle/0062_command_center_schema.sql | head -5
```

## Self-Check: PASSED

- [x] follow-ups.ts exists with followUps, followUpRules tables
- [x] workflow-templates.ts exists with workflowTemplates table
- [x] workflow-instances.ts exists with workflowInstances, workflowEvents tables
- [x] deal-outcomes.ts exists with dealOutcomes table and 17 loss reasons
- [x] pipeline-metrics.ts exists with pipelineMetrics table and UNIQUE constraint
- [x] smart-alerts.ts exists with smartAlerts table and severity CHECK
- [x] dashboard-views.ts exists with ccDashboardViews table
- [x] notification-preferences.ts exists with UNIQUE(user_id, workspace_id)
- [x] 0062_command_center_schema.sql migration created
- [x] schema.ts re-exports all new schemas
- [x] 55 tests pass
- [x] Commits ccc7f1fb1, 01f125dfa, ddbec6528 exist
