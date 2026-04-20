---
phase: 22-goal-based-metrics
plan: 01
subsystem: database
tags: [drizzle, postgres, goals, metrics, schema]

# Dependency graph
requires:
  - phase: 21-agency-command-center
    provides: client_dashboard_metrics table, BullMQ worker infrastructure
provides:
  - goal_templates table with 9 default templates
  - client_goals table with computed state columns
  - goal_snapshots table for historical tracking
  - goal columns on client_dashboard_metrics
affects: [22-02, 22-03, 22-04] # Goal computation worker, goal config UI, dashboard integration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Goal template pattern: system templates + client configuration"
    - "Computed state columns: worker updates currentValue, attainmentPct, trend"
    - "Snapshot tracking: daily snapshots for trend analysis"

key-files:
  created:
    - open-seo-main/src/db/goals-schema.ts
    - open-seo-main/src/db/seeds/goal-templates.ts
    - open-seo-main/drizzle/0010_goals_schema.sql
    - open-seo-main/drizzle/0011_dashboard_goals_columns.sql
  modified:
    - open-seo-main/src/db/schema.ts
    - open-seo-main/src/db/dashboard-schema.ts
    - open-seo-main/src/migrate-entry.ts
    - open-seo-main/drizzle/meta/_journal.json

key-decisions:
  - "9 default goal templates covering keywords, clicks, CTR, growth, and custom"
  - "hasDenominator flag enables 'X out of Y' goals like 7/10 keywords in Top 10"
  - "Seed script integrated into migrate-entry.ts for automatic seeding on deploy"
  - "Goal columns on dashboard_metrics enable sorting by priority score"

patterns-established:
  - "Goal computation method names: count_keywords_in_range, sum_clicks_period, avg_ctr_period, mom_growth_pct, manual"
  - "Trend direction values: up, down, flat"
  - "Seed upsert pattern: onConflictDoUpdate for idempotent seeding"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-04-20
---

# Phase 22 Plan 01: Schema & Templates Summary

**Goal-based metrics schema with 3 tables (templates, client_goals, snapshots) and 9 seeded goal templates for keyword ranking, traffic, CTR, and growth tracking**

## Performance

- **Duration:** 4m 45s
- **Started:** 2026-04-20T11:43:22Z
- **Completed:** 2026-04-20T11:48:07Z
- **Tasks:** 8
- **Files modified:** 8

## Accomplishments

- Created goal_templates table with 9 pre-defined goal types (keywords top 10/3/1, weekly/monthly clicks, CTR, MoM growth, impressions, custom)
- Created client_goals table with computed state columns (currentValue, attainmentPct, trendDirection) for worker updates
- Created goal_snapshots table for daily historical tracking enabling trend analysis
- Added goal attainment columns to client_dashboard_metrics for dashboard display
- Integrated seed script into migration entry point for automatic template seeding

## Task Commits

Each task was committed atomically:

1. **Tasks 1-5: Create schema and migrations** - `48ab2ae` (feat)
   - goal_templates, client_goals, goal_snapshots tables
   - Schema export, migration SQL, journal update
2. **Tasks 6-7: Create seed script** - `726c4d3` (feat)
   - 9 goal templates with upsert pattern
   - Integration into migrate-entry.ts
3. **Task 8: Dashboard schema updates** - `fb6c766` (feat)
   - Goal columns on client_dashboard_metrics
   - Updated test file

## Files Created/Modified

**Created:**
- `open-seo-main/src/db/goals-schema.ts` - Goal templates, client goals, snapshots tables with type exports
- `open-seo-main/src/db/seeds/goal-templates.ts` - Seed script with 9 default templates
- `open-seo-main/drizzle/0010_goals_schema.sql` - Migration for goal tables
- `open-seo-main/drizzle/0011_dashboard_goals_columns.sql` - Migration for dashboard goal columns

**Modified:**
- `open-seo-main/src/db/schema.ts` - Added goals-schema export
- `open-seo-main/src/db/dashboard-schema.ts` - Added 7 goal-related columns
- `open-seo-main/src/db/dashboard-schema.test.ts` - Updated tests for new columns
- `open-seo-main/src/migrate-entry.ts` - Added seedGoalTemplates call
- `open-seo-main/drizzle/meta/_journal.json` - Added migration entries

## Decisions Made

- **9 default templates:** Cover all common agency goal types (keyword rankings, clicks, CTR, growth, impressions) plus custom
- **hasDenominator flag:** Enables "X out of Y" display for keyword goals (e.g., 7/10 keywords in Top 10)
- **computationMethod field:** Defines how worker calculates each goal type (count_keywords_in_range, sum_clicks_period, etc.)
- **Seed in migrate-entry:** Templates seeded automatically on deploy, idempotent with upsert pattern
- **priorityScore column:** Enables sorting clients by goal urgency in dashboard

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **drizzle-kit TTY requirement:** drizzle-kit generate requires interactive TTY, so migration SQL was created manually following established patterns
- **Pre-existing test failures:** Some ranking queue/processor tests timeout - out of scope for this plan

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema ready for Plan 22-02 (Goal Computation Worker)
- Templates will be seeded on next migration run
- Dashboard metrics table ready to receive goal data from worker

## Self-Check: PASSED

All files verified:
- goals-schema.ts: FOUND
- goal-templates.ts: FOUND
- 0010_goals_schema.sql: FOUND
- 0011_dashboard_goals_columns.sql: FOUND
- Commit 48ab2ae: FOUND
- Commit 726c4d3: FOUND
- Commit fb6c766: FOUND

---
*Phase: 22-goal-based-metrics*
*Plan: 01*
*Completed: 2026-04-20*
