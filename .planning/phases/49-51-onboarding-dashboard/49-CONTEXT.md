# Phase 49-51: Onboarding & Agency Dashboard - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated client onboarding system with tier-based checklists + agency command center dashboard with pipeline kanban, Today's tasks feed, and MRR/revenue metrics. Complete prospect-to-client conversion flow.

</domain>

<decisions>
## Implementation Decisions

### Checklist Completion UX
- **D-01:** Dual mode for credential items: "Send to client" (magic link flow) + "Connect myself" (direct OAuth). Most credentials are client-owned, so magic link is primary.
- **D-02:** Magic link page uses full white-label branding (workspace logo, colors, agency name). Client sees "[Agency Name] Onboarding" with no TeveroSEO branding.
- **D-03:** Non-credential items use hybrid approach: manual checkbox for all items + smart action buttons where applicable (Calendly for scheduling, file picker for uploads).
- **D-04:** Progress visualization: overall progress bar + percentage at top, items grouped by category with per-category counts (Credentials 2/4, Kickoff 1/2, etc.).

### Pipeline Kanban
- **D-05:** Full prospect-to-client pipeline stages: New → Analyzing → Qualified → Proposal Sent → Negotiating → Won → Onboarding → Active Client.
- **D-06:** Configurable stages with full flexibility: agencies can add, remove, reorder stages. Default stages provided as starting point.
- **D-07:** Kanban card displays: company name + domain, deal value (if proposal exists), days in stage, next action indicator, deal owner, days since first contact.
- **D-08:** Quick actions on cards: move to stage (dropdown), view details (modal), log activity (quick note), archive/mark lost.

### Today's Tasks System
- **D-09:** Task sources: overdue checklist items, stale pipeline cards (X+ days in stage), scheduled follow-ups, expiring proposals/contracts, SEO tasks stuck on human action, manually added tasks per client.
- **D-10:** Full task system with assignees, priority (high/medium/low), category, due date, and reminders. Not just notes with due dates.
- **D-11:** 5-layer priority system:
  - Layer 1: Smart urgency score algorithm (overdue × 20 + due_today × 50 + deal_value/1000 + days_stale × 3 + manual_priority × 25)
  - Layer 2: User overrides via pin (always top), snooze (hide until date), priority setting
  - Layer 3: Sort mode toggle (Smart Priority, Due Date, Deal Value, Client Name)
  - Layer 4: Visual urgency indicators always visible regardless of sort (red=overdue, yellow=due today, warning=stale)
  - Layer 5: "My Focus" section - drag up to 5 tasks into pinned daily focus area

### Revenue & Metrics Dashboard
- **D-12:** Full revenue dashboard: 4 metric cards (MRR, One-Time, Collected This Month, Outstanding) + MRR movement breakdown (new/expansion/churn) + churn risk alerts + trend chart (toggle 3/6/12 months).
- **D-13:** Multi-currency support: store amounts in original currency, user picks display currency for dashboard totals.
- **D-14:** Contract types supported: recurring (MRR), prepaid term (e.g., €2,500 for 6 months), project (one-time), hybrid (setup + recurring).
- **D-15:** Payment schedules: templates (Upfront, 50/50 split, 3 equal payments, On delivery) + custom schedule option with user-defined amounts/dates.
- **D-16:** Outstanding payments: dedicated dashboard section showing overdue (red), due this week (yellow), upcoming (gray) with actions (Send Reminder, Log Call, Send Invoice).
- **D-17:** Prepaid revenue display: toggle between "Recognized Revenue" view (€2,500/6mo = €417/mo spread) and "Cash Received" view (€2,500 when paid).

### Churn Risk Signals (Agency-Observable)
- **D-18:** Service period ending: 30/60/90 day warnings for contracts/prepaid terms approaching end.
- **D-19:** No contact logged: configurable threshold (e.g., 14 days) since last call/email/meeting logged.
- **D-20:** Deliverables overdue: internal tasks/milestones past due date.
- **D-21:** SEO metrics declining: rankings or traffic dropping vs. previous period (from GSC data we have access to).

### Client Communication
- **D-22:** Defer auto-progress emails to Phase 53 (Report Cards). Client communication via scheduled PDF reports. No client portal in this phase.

### Claude's Discretion
- Urgency score algorithm weights fine-tuning
- Specific thresholds for "stale" pipeline cards (days in stage)
- UI component implementation details
- Database schema for tasks table
- Caching strategy for dashboard metrics

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Code (Phase 48)
- `open-seo-main/src/server/features/onboarding/services/OnboardingService.ts` — Checklist creation after payment (already built)
- `open-seo-main/src/db/onboarding-schema.ts` — onboarding_checklists table with JSONB items, service tiers
- `open-seo-main/src/db/activity-schema.ts` — pipeline_activities logging pattern

### Dashboard Patterns
- `apps/web/src/app/(shell)/dashboard/page.tsx` — Existing dashboard structure with QuickStatsCards, NeedsAttentionSection, ActivityFeed
- `apps/web/src/components/dashboard/` — Existing dashboard components to extend

### Design System
- `.planning/design/design-system-v6.md` — v6 design tokens for all new components

### Phase 12 Reference
- Per-client credentials system with magic link pattern (`/connect/[token]` route)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OnboardingService.createFromContract()` — Already creates tier-based checklist after payment
- `CHECKLIST_TEMPLATES` — Starter (5 items), Growth (8 items), Enterprise (12 items) with autoCompleteEvent fields
- `ChecklistRepository`, `ActivityRepository` — Data access patterns
- Dashboard components: QuickStatsCards, NeedsAttentionSection, ActivityFeed, ClientPortfolioTable

### Established Patterns
- State machine transitions with activity logging (from ProposalService/ContractService)
- Server actions for dashboard data fetching
- ErrorBoundary wrapping for graceful degradation
- Parallel data fetching with individual fallbacks

### Integration Points
- Phase 48 payment webhook → triggers OnboardingService.createFromContract()
- OAuth callbacks for credential items → mark checklist item complete
- Prospects table → Pipeline kanban cards
- Contracts/Invoices tables → Revenue metrics

</code_context>

<specifics>
## Specific Ideas

- Magic link pages should feel like the agency's own onboarding portal
- Pipeline kanban should allow jumping multiple stages via dropdown (not just drag)
- "My Focus" section clears daily but user can manually clear
- Outstanding payments section is a collections workflow tool, not just a metric
- Prepaid term deals are common (€2,500 for 6 months) - revenue dashboard must handle these well

</specifics>

<deferred>
## Deferred Ideas

- **Client portal** — Clients logging in to see their own dashboard (separate phase, big scope)
- **Auto-progress emails** — Automated weekly/monthly digests to clients (defer to Phase 53 Report Cards)
- **Client engagement tracking** — Would require client portal to track logins/activity
- **Email open tracking** — Track if clients read communications

</deferred>

---

*Phase: 49-51-onboarding-dashboard*
*Context gathered: 2026-04-30*
