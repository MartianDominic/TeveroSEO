# Dashboard Feature Coverage Map

**Date:** 2026-04-28
**Source:** 4 parallel sonnet 4.6 subagent reports surveying 43 phases + all `apps/web` routes + planning docs
**Purpose:** Map every TeveroSEO capability to its representation on the agency command center dashboard, so the design preview reflects reality

---

## 1. Top-level entities the platform tracks

| Entity | Scope | Notes |
|---|---|---|
| Workspace | top | Multi-tenant container, Clerk org |
| Team Member | workspace | Capacity-tracked, role-assigned |
| Client | workspace | Core unit; everything else scopes here |
| Prospect | workspace | Pre-sales lead, distinct from Client |
| SEO Project | client | 1 client → many SEO projects |
| Audit Run | project | Snapshot of 107-check scan |
| Finding | audit | Tier 1-4, severity, autoEditable flag |
| Keyword | project | Daily rank-tracked |
| Keyword-Page Mapping | project | Optimize-vs-create action |
| Backlink | client | DataForSEO-sourced |
| Link Graph Entry / Opportunity | client | Internal linking |
| Auto-Fix Change | page | Reversible, dependency-aware |
| Article | client | 8-state lifecycle |
| Brand Voice Profile | client | 40+ fields, 3 modes |
| Content Brief | article | SERP-informed, PAA-extracted |
| Report | client | PDF, white-label, scheduled |
| Alert | client | Threshold-triggered |
| Webhook | client | 25 Tier-1 events [planned] |
| Connection | client+provider | Google (GSC/GA4/GBP), Bing, WP, Shopify, Wix, Squarespace, Webflow |
| GSC/GA4 Snapshot | client | Daily, 90-day backfill |
| Goal | client | 9 templates, attainment computed every 5min |
| Pipeline Job | autonomous | BullMQ flow, parent/child tree |
| Proposal | prospect | "Komercinis" — token-link, status-tracked |

---

## 2. Major feature surfaces (clusters)

### SEO Project Operations
- 107 checks across 4 tiers (Tier 1: 66 DOM/regex, Tier 2: 21 calculated, Tier 3: 13 API, Tier 4: 7 site-wide)
- Daily rank tracking with 365-day history per saved keyword
- Backlink tracking (DataForSEO)
- Keyword-to-page mapping with relevance scoring
- Internal link graph: extraction, orphan detection, cannibalization detection, opportunity scoring
- Auto-fix system: 17 edit recipes (7 safe-auto), single/page/category/batch/date-range revert
- Auto-revert triggers on traffic drop >20% or rank drop >5 positions
- Platform detection (Wix/Squarespace/Webflow) — failed detection blocks auto-fix

### Content Production
- Brief generation: SERP analysis, competitor H2 extraction, PAA, target word count
- AI article generation with brand voice + ICP psychology + SERP-informed H2s + PAA
- 8-state article lifecycle: draft → generating → generated → pending_review → approved → publishing → published / failed
- Quality gate: 107-check score ≥80 required for auto-publish (fail-closed pattern)
- Brand voice: 40+ fields, 3 modes (preservation/application/best_practices), 8 industry templates
- Voice compliance scoring; voice preview via Claude
- CMS publish: WordPress, Shopify, Wix adapters
- Internal link auto-insertion (3-7 links/article, ≥85% confidence, velocity capped 50/site/day)
- GSC indexing submission post-publish (200/day quota)
- Content calendar (react-big-calendar, color-coded by status)

### Prospect Pipeline
- 5 statuses: new → analyzing → analyzed → converted → archived
- Priority score formula: DA×0.20 + traffic×0.15 + opps×0.25 + avgScore×0.25 + recency×0.15
- Quick-win detection: striking distance (11-30), low-hanging-fruit (4-10), fresh opportunity
- Tier system: Must-Do / Should-Do / Nice-to-Have / Ignore
- Daily quota: 10 soft / 20 hard analyses per workspace
- Re-analysis cooldown 24h
- Page mapping via three-layer match (rules → embeddings → LLM)
- Cannibalization + gap identification
- Proposal "Komercinis": 3 scenarios (Focused €150+25/kw, Full Audit €800, Competitor €250+75/comp)
- Token-based public proposal links, status: draft → sent → viewed → accepted → signed → paid
- Lithuanian sutartis (contract) generation

### Reports
- Ad-hoc generation (button) [implemented]
- Scheduled (weekly Mon 6am, monthly 1st 6am) [planned, Phase 16]
- White-label: logo + primary/secondary colors + footer HTML per client
- Delivery: PDF email attachment <10MB OR shareable download link OR HTML preview
- 6 sections: header, summary stats, GSC chart, GA4 chart, top queries table, footer

### Alerts + Webhooks
- Alert types: ranking_drop, sync_failure, connection_expiry (severity info/warning/critical)
- Lifecycle: pending → acknowledged → resolved/dismissed
- Channels: in-app drawer + email; Slack/webhook deferred
- 25 Tier-1 webhook events [planned]: ranking.*, backlink.*, traffic.*, audit.*, report.*, connection.*, alert.*, sync.*
- HMAC-SHA256, idempotency keys, multi-tenant scoped
- BullMQ delivery with 3 retries, DLQ on exhaustion

### Analytics
- Sources: GSC (clicks/imp/CTR/position + top 50 queries), GA4 (sessions/users/conversions), DataForSEO SERP
- Nightly sync 02:00 UTC, 90-day backfill on first connect
- Anomaly detection: >20% WoW drop = "Drop" badge, >48h no sync = "Stale"
- Token auto-refresh, failure flagged
- Time-series: gsc_snapshots (daily), gsc_query_snapshots (top 50/day), ga4_snapshots, keyword_rankings (365d), goal_snapshots

### Goal-Based Metrics (Phase 22)
- 9 seeded templates: Keywords in Top 10, Top 3, #1 Rankings, Weekly/Monthly Clicks, CTR Target, MoM Growth, Monthly Impressions, Custom
- Attainment recomputed every 5min by BullMQ worker
- "Needs Attention" priority formula: alerts×1000 + goal_gaps×50 + traffic_drops×200

### Connections / CMS
- Google one-OAuth flow (GSC + GA4 + GBP)
- Self-service `/connect/[token]` magic-link onboarding
- Per-client status dashboard with reconnect CTAs
- 8 providers total (Google, Bing, WP, Shopify, Wix, Squarespace, Webflow, [Webhook])

### Autonomous Orchestration
- BullMQ Flow Producer: parent/child phase/plan job trees
- Real-time pipeline dashboard via Socket.IO (port 3002), velocity-based ETA
- Checkpoint persistence + crash resume
- Start/pause/resume controls

### Team Intelligence (Phase 25)
- TeamMember capacity: client count vs. max
- TeamDashboard cards: green/yellow/red bars, Available/NearCap/Overloaded
- WorkloadBalancer: drag-drop reassignment, suggestion algorithm moves newest from overloaded → available

---

## 3. Current `/dashboard/page.tsx` widgets (already implemented)

From `apps/web/src/app/(shell)/dashboard/page.tsx`:

| Widget | Phase | Implemented? | Data source |
|---|---|---|---|
| `PowerUserFeatures` (Cmd+K, ?) | 24 | ✅ | client-side |
| `PageHeader` + `ExportButton` | 21-05 | ✅ | — |
| `DashboardViewProvider` (saved views) | 21-05 | ✅ | dashboard_views |
| `QuickStatsCards` (drag-drop, 4) | 21-04 | ✅ | /api/dashboard/layout |
| `PortfolioHealthSummary` | 21-02 | ✅ | getPortfolioSummary |
| `NeedsAttentionSection` (snooze/dismiss) | 21-02 | ✅ | getAttentionItems |
| `WinsMilestonesSection` | 21-02 | ✅ | getWins |
| `ClientPortfolioTable` (8 cols, sparklines) | 21-03 | ✅ | getDashboardMetrics |
| `ActivityFeed` (Socket.IO live) | 21-04 | ✅ | port 3002 WS |
| `TeamWorkloadSection` | 21-05, 25 | ✅ (conditional) | getTeamWorkload |
| `UpcomingScheduledSection` | 21-05 | ✅ | getUpcomingScheduled |

---

## 4. What the v1 preview was MISSING

The v1 preview I built was a per-client SEO project view. The real `/dashboard` is the agency command center. Missing surfaces that should be visible:

1. **Prospect pipeline funnel** (47 new → 12 analyzed → 8 proposal → 3 won this month, $12k ARR added, conversion %)
2. **Content production status** (8-state distribution across all clients, voice profile gaps blocking auto-publish, quality gate avg score)
3. **Auto-fix activity** (applied this week, auto-reverts triggered — this is genuinely critical because reverts mean something went wrong silently)
4. **Alert firing summary** (count + severity breakdown, links to drawer)
5. **Report delivery** (delivered today, pending generation, scheduled)
6. **Team workload** (capacity bars, overload warnings, reassignment suggestions)
7. **Upcoming scheduled** (next 24h reports, audits, SSL expiries)
8. **Cross-client opportunities** (orphan pages total, cannibalization issues, quick wins available)
9. **Connection health** (clients with stale GSC, expired tokens, missing connections)
10. **Goal attainment** (portfolio avg, on-track vs below-target counts)

---

## 5. Non-obvious things that need surfacing

These are things the planning docs explicitly call out but a generic SaaS dashboard would miss:

- **Auto-revert is silent.** The system can roll back fixes automatically when traffic/rankings drop. A non-zero "auto-reverts this week" count means a fix made things worse — must be visible.
- **Quality gate creates a hidden backlog.** Articles scoring <80 land in pending_review forever. This queue grows silently.
- **Voice profile incompleteness blocks auto-publish.** A client missing brand voice can't auto-publish — agency owner needs to know.
- **GSC submission quota.** 200/day cap. Backlogs mean delayed indexing.
- **Cross-tenant cache economics.** Cost per client drops 95% at portfolio scale of 1,000. Worth showing.
- **Liminal proposal state.** Signed-but-not-converted prospects represent near-term revenue.
- **Platform detection failures block auto-fix entirely.** Surface as warning.
- **Link velocity caps.** 50/site/day, 3/page/day — can create pending insertions backlog.

---

## 6. Final widget set for v2 preview

Organized by row, top to bottom:

**Row 1 — Top stat strip (4 cards, drag-drop)**
- Total clients (with health breakdown: 21 / 8 / 5)
- Avg goal attainment (% + trend)
- Keywords in Top 10 (count + Δ this week)
- Wins this week (count, click-through to list)

**Row 2 — Portfolio Health Summary (1 wide card)**
- Horizontal stacked bar: 34 clients = 21 healthy / 8 monitor / 5 at-risk
- Sub-stats: total clicks 30d, total impressions 30d, avg traffic Δ, keywords Top 3, keywords #1
- Goals met / total

**Row 3 — Two columns (60/40)**
- Left: Needs Attention list (5-7 items, severity icons, snooze/dismiss/view)
- Right: Wins & Milestones list (5-7 items, trophy/trending icons)

**Row 4 — Two columns (50/50)**
- Left: Prospect pipeline funnel (5 stages, counts, conversion rate, ARR added, daily quota)
- Right: Content production status (8-state distribution, voice gap warning, quality gate avg, scheduled this week)

**Row 5 — Client Portfolio Table (full width)**
- 8 columns: Client / Health (with sparkline on hover) / Traffic Δ 30d (sparkline) / Keywords Top 10 / Goals (X/Y) / Issues / Last sync / Actions (⋯)
- Filters: search / health bracket / alert state / connection state
- 6-8 visible rows
- Saved views selector + filter row + add-client button

**Row 6 — Three columns (1/1/1)**
- Activity feed (live, 8 events, paused indicator, filter pill)
- Team workload (3-4 members, capacity bars, reassign hint)
- Upcoming scheduled (next 24h: reports, audits, expiries)

**Row 7 — Operational strip (4 small cards)**
- Auto-fix activity (applied / reverted / pending review)
- Alerts firing (count by severity)
- Reports (delivered today / pending / scheduled)
- Connections (healthy / stale / failed)

This puts every major surface from §2 within one scroll of the agency dashboard, with each widget linking to the deeper view.
