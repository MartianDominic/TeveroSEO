# Phase 22: Goal-Based Metrics System - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Mode:** Auto-generated (detailed plans exist from prior session)

<domain>
## Phase Boundary

Replace arbitrary health scores with goal-based tracking. Agencies select goal templates, configure target values per client, and the system tracks progress automatically. Dashboard displays goal attainment instead of opaque health scores.

</domain>

<decisions>
## Implementation Decisions

### Schema Design
- goal_templates: System-level definitions (9 seeded templates)
- client_goals: Per-client configurations with computed state
- goal_snapshots: Daily historical tracking for trends

### Goal Templates (Seeded)
1. Keywords in Top 10
2. Keywords in Top 3
3. #1 Rankings
4. Weekly Clicks
5. Monthly Clicks
6. CTR Target
7. MoM Traffic Growth
8. Monthly Impressions
9. Custom Goal

### Computation Approach
- BullMQ worker runs every 5 minutes
- Computation methods per template type
- Priority score formula: alerts x 1000 + goal gaps x 50 + traffic drops x 200

### Claude's Discretion
- Implementation details follow existing codebase patterns
- Error handling follows established conventions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `open-seo-main/src/db/schema.ts` — existing Drizzle schema patterns
- `open-seo-main/src/db/dashboard-schema.ts` — client_dashboard_metrics table
- BullMQ infrastructure from analytics/ranking workers

### Established Patterns
- Drizzle ORM with pg-core
- BullMQ workers with 5-minute repeatable jobs
- Server actions pattern from Phase 21

### Integration Points
- Dashboard page reads from client_dashboard_metrics
- Goal configuration UI at /clients/[id]/settings/goals

</code_context>

<specifics>
## Specific Ideas

- Replace health_score display with goal_attainment_pct
- Support "X out of Y" goals (e.g., 7/10 keywords in Top 10)
- Primary goal shown prominently with trend indicator
- Regression warnings when goals drop below threshold

</specifics>

<deferred>
## Deferred Ideas

- AI-based goal recommendations (Phase 25)
- Client-facing goal view
- Goal alerts/notifications beyond regression warning

</deferred>
