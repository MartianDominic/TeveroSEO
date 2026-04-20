---
phase: 22
plan: 2
subsystem: goal-metrics
tags: [bullmq, worker, computation, dashboard]
dependency_graph:
  requires: [22-01-goals-schema]
  provides: [goal-computation, priority-score, goal-snapshots]
  affects: [dashboard-metrics-processor]
tech_stack:
  added: []
  patterns: [bullmq-worker, computation-methods-registry]
key_files:
  created:
    - open-seo-main/src/server/workers/goal-computations.ts
    - open-seo-main/src/server/workers/goal-processor.ts
    - open-seo-main/src/server/queues/goalQueue.ts
    - open-seo-main/src/server/workers/priority-score.ts
    - open-seo-main/src/server/workers/index.ts
  modified:
    - open-seo-main/src/server/workers/dashboard-metrics-processor.ts
decisions:
  - Computation methods as registry pattern for extensibility
  - Daily snapshots via upsert to prevent duplicates
  - Priority score uses tiered formula (alerts > goals > traffic > neglect)
metrics:
  duration: ~15 minutes
  completed: 2026-04-20
---

# Phase 22 Plan 2: Goal Computation Worker Summary

BullMQ worker that computes goal progress from GSC and keyword ranking data, calculates trends, and updates dashboard metrics.

## One-liner

BullMQ goal processor with computation method registry, daily snapshots, and tiered priority scoring.

## Completed Tasks

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Goal computation methods | 66f7a59 |
| 2-3 | Goal processor worker and queue | d90517b |
| 4 | Priority score computation | 33353fb |
| 5 | Dashboard metrics integration | 823ad63 |
| 6 | Worker exports for startup | 6019ad0 |

## Implementation Details

### Computation Methods (goal-computations.ts)

Registry of computation functions keyed by method name:
- `count_keywords_in_range` - Keywords in top 10/3/1 positions
- `sum_clicks_period` - Weekly or monthly click totals
- `sum_impressions_period` - 30-day impression totals
- `avg_ctr_period` - 30-day average CTR percentage
- `mom_growth_pct` - Month-over-month traffic growth
- `manual` - Passthrough for manual goals

### Goal Processor Worker (goal-processor.ts)

- Fetches goals with templates via inner join
- Executes computation method for each goal
- Calculates attainment percentage (current/target * 100)
- Computes trend direction (up/down/flat) from previous snapshot
- Upserts daily snapshot for historical tracking
- Updates dashboard metrics with goal aggregates

### Goal Queue (goalQueue.ts)

- 5-minute repeatable job for all goals
- `processClientGoals(clientId)` for immediate client processing
- `processGoalImmediate(goalId)` for single goal updates
- Exponential backoff: 5s, 10s, 20s

### Priority Score (priority-score.ts)

Tiered urgency formula:
- Critical alerts: 1000 pts each
- Warning alerts: 100 pts each
- Goal gap: 0.5 pts per percentage point below 100%
- Traffic decline >20%: 200 pts, >10%: 50 pts
- Days since touch: up to 14 pts
- Expiring contract with poor performance: 500 pt bonus

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] `pnpm tsc --noEmit` passes
- [x] Computation methods return correct structure
- [x] Worker registered for startup
- [x] Dashboard integration complete

## Self-Check: PASSED

All files created and commits verified.
