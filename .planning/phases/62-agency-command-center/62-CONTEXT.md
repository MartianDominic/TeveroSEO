# Phase 62: Agency Command Center — Context

**Gathered:** 2026-05-02
**Status:** Ready for planning
**Mode:** Auto-generated from DESIGN.md

<domain>
## Phase Boundary

Build the unified operations hub for SEO agencies, consolidating prospects, proposals, agreements, payments, and engagement workflows into a single actionable dashboard.

**Core Capabilities:**
- Pipeline Intelligence — Real-time visibility into all prospect/client stages
- Engagement Workflow Engine — Automated follow-ups with anti-annoyance safeguards
- Smart Alerts — AI-detected anomalies and at-risk deals
- Quick Actions — One-click operations from anywhere in the dashboard
- Win/Loss Analytics — Data-driven insights on pipeline health

**Key Constraint:** Anti-annoyance safeguards limit automated touches to max 3 per week per entity with configurable cooldown.

</domain>

<decisions>
## Implementation Decisions

### Database Schema
- **D-01:** `follow_ups` table with polymorphic entity reference (prospect, proposal, contract, invoice, client)
- **D-02:** `follow_up_rules` table for configurable automation rules with trigger conditions (JSONB)
- **D-03:** `workflow_templates` table with steps array (JSONB), anti-annoyance config
- **D-04:** `workflow_instances` table tracking active engagements with state machine
- **D-05:** `workflow_events` table for execution audit log
- **D-06:** `deal_outcomes` table with loss_reason enum for win/loss analytics
- **D-07:** `pipeline_metrics` table (refreshed every 5 minutes) with pre-computed counts
- **D-08:** `smart_alerts` table with severity, entity reference, suggested actions
- **D-09:** `dashboard_views` table for saved filter/layout preferences
- **D-10:** `notification_preferences` table per user per workspace

### Engagement Workflow Engine
- **D-11:** WorkflowStep types: wait, email, task, condition, webhook, alert
- **D-12:** Default templates: Proposal Follow-up, Contract Signature Reminder, Invoice Collection
- **D-13:** Anti-annoyance checks: maxTouchesPerWeek, cooldownHours, skipOnResponse
- **D-14:** Snooze support for "follow up on May 27th" functionality
- **D-15:** Response detection pauses workflow when skipOnResponse enabled

### Smart Alerts
- **D-16:** Alert rules: high_value_stuck, win_rate_declining, unassigned_prospects, collection_velocity_drop, contract_expiring_soon
- **D-17:** Alert worker runs every 5 minutes per workspace
- **D-18:** Auto-resolve alerts when condition no longer applies

### Dashboard Components
- **D-19:** Server Component base with client hydration for interactive parts
- **D-20:** TodayActionBar shows overdue, due today, awaiting, new counts
- **D-21:** PipelineHealthCardsGrid with drag-and-drop (dnd-kit)
- **D-22:** NeedsAttentionList with priority sorting
- **D-23:** PipelineFunnel visualization (Recharts)
- **D-24:** ActivityFeed with real-time updates (Socket.IO)

### Real-time Updates
- **D-25:** Socket.IO server for activity feed WebSocket
- **D-26:** Events emitted on entity changes via webhooks/triggers

### i18n
- **D-27:** All strings in command-center.json (EN + LT)

### Claude's Discretion
- Loading states for dashboard cards
- Error boundaries per widget
- Optimistic UI updates for quick actions
- Keyboard shortcuts for power users

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Design
- `.planning/phases/62-agency-command-center/DESIGN.md` — Full specification with schemas, workflow engine

### Prior Art
- `open-seo-main/src/db/` — Drizzle schema patterns
- `open-seo-main/src/server/workers/` — BullMQ worker patterns
- `apps/web/src/components/dashboard/` — Dashboard component patterns
- `packages/i18n/src/locales/` — i18n file structure

### Dependencies
- Phase 56: i18n foundation
- Phase 57: Proposal Editor (proposals table)
- Phase 59: Agreement Excellence (contracts table)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- BullMQ worker patterns from existing workers
- Drizzle pgTable + relations pattern
- v6 design system tokens
- TanStack Query patterns from existing dashboards

### Established Patterns
- Server Components with client hydration
- Server Actions for mutations
- Repository pattern for data access
- Socket.IO for real-time (if exists)

### Integration Points
- Prospects, Proposals, Contracts, Invoices tables (existing)
- Email service for workflow emails
- Notification service for alerts

</code_context>

<specifics>
## Specific Ideas

- **Single pane of glass**: All pipeline stages visible without navigation
- **Proactive intelligence**: Alert before deals go stale, not after
- **Snooze-friendly**: Support "follow up next Thursday" natural language
- **Mobile-ready**: Dashboard works on tablet for on-the-go agencies

</specifics>

<deferred>
## Deferred Ideas

- AI-generated follow-up email content
- Predictive deal scoring
- Multi-workspace aggregation
- Custom workflow step types
- Slack/Teams bot integration
- Voice assistant integration

</deferred>

---

*Phase: 62-agency-command-center*
*Context gathered: 2026-05-02*
