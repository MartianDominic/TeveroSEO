# World-Class Agency Dashboard Blueprint

**Status:** Design Specification  
**Created:** 2026-04-20  
**Context:** Complete redesign for managing 500 SEO clients with all available data sources

---

## Executive Summary

This document specifies a world-class agency dashboard that replaces arbitrary health scores with goal-based tracking, leverages all available data sources (GSC, GA4, keyword rankings, audits, alerts), and provides the UI/UX patterns needed to efficiently manage 500 clients.

**Core Philosophy:** Don't tell me "health is 72" — tell me "you're at 70% of your keyword goal, trending up, with 2 alerts to address."

---

## Part 1: Data Sources Inventory

### What We Have

| Source | Table | Data Available | Update Frequency |
|--------|-------|----------------|------------------|
| **GSC** | `gsc_snapshots` | Daily clicks, impressions, CTR, avg position | Daily (3-day delay) |
| **GSC** | `gsc_query_snapshots` | Top 50 queries/day with metrics | Daily |
| **GA4** | `ga4_snapshots` | Sessions, users, bounce rate, conversions, revenue | Daily |
| **Rankings** | `keyword_rankings` | Position per keyword per day, SERP features | Daily |
| **Keywords** | `saved_keywords` | Target keywords with tracking enabled | User-managed |
| **Keywords** | `keyword_metrics` | Search volume, CPC, difficulty, intent | On-demand |
| **Audits** | `audits` | Audit status, progress, config | Per-run |
| **Audits** | `audit_pages` | Page metadata, headings, links, images | Per-run |
| **Audits** | `audit_lighthouse_results` | CWV scores, performance | Per-run |
| **Alerts** | `alerts` | Triggered events with severity | Real-time |
| **Alerts** | `alert_rules` | Thresholds per client | User-managed |
| **Dashboard** | `client_dashboard_metrics` | Pre-computed summaries | Every 5 min |
| **Dashboard** | `portfolio_activity` | Real-time feed | Real-time |

### What We Can Derive

From existing data, we can compute:

| Derived Metric | Source | Calculation |
|----------------|--------|-------------|
| Keywords in Top 10 | `keyword_rankings` | COUNT WHERE position <= 10 |
| Keywords in Top 3 | `keyword_rankings` | COUNT WHERE position <= 3 |
| #1 Rankings | `keyword_rankings` | COUNT WHERE position = 1 |
| Position Distribution | `keyword_rankings` | GROUP BY position bands |
| Ranking Velocity | `keyword_rankings` | SUM(previous_position - position) |
| Traffic Trend (WoW) | `gsc_snapshots` | (this_week - last_week) / last_week |
| Traffic Trend (MoM) | `gsc_snapshots` | (this_month - last_month) / last_month |
| CTR vs Expected | `gsc_snapshots` | CTR - expected_ctr_for_position |
| Query Opportunities | `gsc_query_snapshots` | High impressions + low CTR |
| Audit Health | `audit_lighthouse_results` | Avg CWV scores |
| Technical Issues | `audit_pages` | Pages with issues |
| Alert Severity | `alerts` | MAX(severity) WHERE status = 'pending' |

### What's Missing (Need to Add)

| New Table | Purpose | Priority |
|-----------|---------|----------|
| `client_goals` | Track explicit goals per client | **Critical** |
| `goal_snapshots` | Historical goal progress | High |
| `client_touches` | Track last work/interaction | High |
| `client_contracts` | MRR, renewal dates | Medium |
| `client_assignments` | Team member ownership | Medium |
| `portfolio_aggregates` | Pre-computed portfolio stats | Medium |

---

## Part 2: The Metrics Framework

### Layer 1: Goals (Replace Health Score)

**New `client_goals` table:**

```sql
CREATE TABLE client_goals (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  
  -- Goal definition
  goal_type TEXT NOT NULL CHECK (goal_type IN (
    'keywords_top_10',      -- X keywords in positions 1-10
    'keywords_top_3',       -- X keywords in positions 1-3  
    'keywords_position_1',  -- X keywords at #1
    'weekly_clicks',        -- X clicks per week
    'monthly_clicks',       -- X clicks per month
    'ctr_target',           -- CTR above X%
    'traffic_growth',       -- X% growth MoM
    'custom'                -- Custom goal
  )),
  goal_name TEXT NOT NULL,
  
  -- Target (what we're aiming for)
  target_value NUMERIC NOT NULL,
  target_denominator INTEGER,     -- For "X out of Y" goals
  
  -- Current status (updated by worker)
  current_value NUMERIC,
  attainment_pct NUMERIC,         -- 0-100+
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'flat')),
  trend_magnitude NUMERIC,
  projected_hit_date DATE,        -- When we expect to hit goal
  
  -- Flags
  is_primary BOOLEAN DEFAULT false,
  is_client_visible BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Goal Types Explained:**

| Goal Type | Example | How Computed |
|-----------|---------|--------------|
| `keywords_top_10` | "10 keywords in top 10" | COUNT FROM keyword_rankings WHERE position <= 10 |
| `keywords_top_3` | "5 keywords in top 3" | COUNT FROM keyword_rankings WHERE position <= 3 |
| `keywords_position_1` | "2 keywords at #1" | COUNT FROM keyword_rankings WHERE position = 1 |
| `weekly_clicks` | "500 clicks/week" | SUM(clicks) FROM gsc_snapshots last 7 days |
| `monthly_clicks` | "2000 clicks/month" | SUM(clicks) FROM gsc_snapshots last 30 days |
| `ctr_target` | "CTR above 3%" | AVG(ctr) FROM gsc_snapshots last 30 days |
| `traffic_growth` | "10% MoM growth" | (this_month - last_month) / last_month |
| `custom` | "Launch 5 blog posts" | Manual tracking |

### Layer 2: Trends (Momentum Indicators)

Trends show direction without arbitrary weighting:

| Trend | Computation | Display |
|-------|-------------|---------|
| Traffic (30d) | Sparkline of daily clicks | `▁▂▃▄▅▆▇█` +15% |
| Impressions (30d) | Sparkline of daily impressions | `▃▄▄▅▅▆▆▇` +22% |
| CTR (30d) | Sparkline of daily CTR | `██▇▇▆▆▅▅` -0.3% |
| Rankings (30d) | Sparkline of keywords in top 10 | `▃▄▅▅▆▇▇█` +5 |
| Position (30d) | Sparkline of avg position | `▆▅▄▃▃▂▂▁` (lower=better) |

**Sparkline Data Points:** 30 points (one per day), stored in `client_dashboard_metrics.sparkline_data` as JSONB.

### Layer 3: Alerts (Actionable Issues)

Existing `alerts` table is good. Enhance dashboard to show:

| Alert Category | Trigger Condition | Severity |
|----------------|-------------------|----------|
| Traffic Drop | clicks WoW < -20% | Critical |
| Ranking Loss | position change > +10 | Warning |
| Goal Regression | attainment_pct dropped > 10% | Warning |
| Sync Failure | GSC/GA4 sync failed | Critical |
| Connection Expiry | OAuth token expires < 7 days | Warning |
| Audit Issues | Critical CWV failures | Warning |
| Neglect | days_since_touch > 14 | Info |

### Layer 4: Priority Score (For Sorting)

Not displayed — used only for attention queue ordering:

```typescript
function computePriorityScore(client: ClientMetrics): number {
  let priority = 0;
  
  // Tier 1: Active critical problems (1000+ range)
  priority += client.alertsCritical * 1000;
  
  // Tier 2: Active warnings (100+ range)  
  priority += client.alertsWarning * 100;
  
  // Tier 3: Goal gaps (10-99 range)
  const goalGap = Math.max(0, 100 - (client.goalAttainmentPct ?? 100));
  priority += goalGap * 0.5;
  
  // Tier 4: Negative momentum (adds to existing)
  if (client.trafficTrendPct < -20) priority += 200;
  else if (client.trafficTrendPct < -10) priority += 50;
  
  // Tier 5: Neglect (1-14 range)
  priority += Math.min(14, client.daysSinceTouch ?? 0);
  
  // Tier 6: Revenue at risk
  if (client.daysUntilRenewal < 30 && client.goalAttainmentPct < 80) {
    priority += 500;
  }
  
  return Math.round(priority);
}
```

---

## Part 3: Dashboard Layout

### Global Elements

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏢 Agency Command Center                    [Cmd+K] [🔔 12] [Sarah K. ▾]    │
├─────────────────────────────────────────────────────────────────────────────┤
│ View: [All Clients ▾]  [🔍 Search...]  [+ Add View]  [⚙️]                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Global Features:**
- **Cmd+K Command Palette** — Quick navigation, bulk actions
- **Notification Bell** — Alert count with dropdown
- **View Selector** — Saved views (filters + columns + sort)
- **Global Search** — Search across all clients, keywords, alerts

### Section 1: Portfolio Pulse

**Purpose:** Answer "Is my agency succeeding overall?"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PORTFOLIO PULSE                                              Apr 20, 2026   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   500 CLIENTS       │  │   GOAL ATTAINMENT   │  │   TREND THIS MONTH  │  │
│  │                     │  │                     │  │                     │  │
│  │  🟢 412 on track    │  │      78%            │  │   ↑ +6%             │  │
│  │  🟠 76 watching     │  │  avg across all     │  │   portfolio health  │  │
│  │  🔴 12 critical     │  │                     │  │   improving         │  │
│  │                     │  │  [▁▂▃▄▅▆▇█] ↑       │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                             │
│  DISTRIBUTION SHIFT (30 days)                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 100%+ ████████████████████████████████████████ 180 (+12)  ↑ clients   │  │
│  │ 80-99 ████████████████████████████ 142 (+8)               exceeding   │  │
│  │ 60-79 ████████████████ 90 (-15)                           goals       │  │
│  │ 40-59 ████████ 52 (-3)                                                │  │
│  │ <40%  ████████████████████████ 36 (-2)                                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  AGGREGATE METRICS                                                          │
│  ├─ Total Clicks (30d):      2.1M  (+180K / +9%)                           │
│  ├─ Total Keywords Top 10:   4,230  (+340 / +9%)                            │
│  ├─ Avg CTR:                 4.2%  (→ stable)                               │
│  └─ Active Alerts:           52  (12 critical, 40 warning)                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Data Sources:**
- Aggregate from `client_dashboard_metrics`
- Distribution computed from `client_goals.attainment_pct`
- Store aggregates in `portfolio_aggregates` table (refresh every 5 min)

### Section 2: Attention Queue

**Purpose:** Answer "Which clients need me TODAY?"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ATTENTION QUEUE (12)                        [View All] [Bulk: ▾]            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ☐ │ ⚡ │ Client       │ Issue                 │ Goal  │ Owner  │ Days     │
│  ──┼────┼──────────────┼───────────────────────┼───────┼────────┼──────    │
│  ☐ │ 🔴 │ Acme Corp    │ Traffic -45% WoW      │ 70%   │ Sarah  │ 14 ⚠️    │
│  ☐ │ 🔴 │ Beta Inc     │ GSC sync failed       │ 85%   │ Mike   │ 7        │
│  ☐ │ 🔴 │ Gamma Ltd    │ 2 critical CWV fails  │ 92%   │ Lisa   │ 3        │
│  ☐ │ 🟠 │ Delta Co     │ CTR below 3% target   │ 78%   │ Sarah  │ 5        │
│  ☐ │ 🟠 │ Epsilon Inc  │ Contract renews 15d   │ 65%   │ Mike   │ 21 ⚠️    │
│  ☐ │ 🟠 │ Zeta Corp    │ 3 KWs dropped out T10 │ 88%   │ Lisa   │ 2        │
│  ...                                                                        │
│                                                                             │
│  Selected (0)  [Run Audit] [Generate Report] [Snooze 7d] [Reassign ▾]       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Sorted by priority score (not displayed)
- Multi-select with bulk actions
- Issue column shows primary alert or gap
- Days column shows neglect with warning if > 7 days
- Expandable row shows full alert list + goals

**Bulk Actions:**
- Run Audit — Queue audit for all selected
- Generate Report — Queue report generation
- Snooze — Snooze alerts for 7/14/30 days
- Reassign — Change owner
- Mark Acknowledged — Acknowledge all alerts

### Section 3: Client Portfolio Table

**Purpose:** Browse, filter, sort, act on all clients

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLIENT PORTFOLIO                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filter: [Status ▾] [Owner ▾] [Goal % ▾] [Alerts ▾] [Tags ▾]  [Clear All]  │
│  Sort: [Priority ▾]  Show: [50 ▾]  Columns: [⚙️]                            │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ☐ │ Client        │ Goal Progress      │ Traffic   │ KWs T10 │ Alerts │  │
│  ├───┼───────────────┼────────────────────┼───────────┼─────────┼────────┤  │
│  │ ☐ │ Acme Corp     │ ████████░░ 70%  ↓  │ 12.4K ↓   │ 47 ↓    │ 2 🔴   │  │
│  │   │               │ 7/10 KWs top 10    │ -45% WoW  │ -3      │        │  │
│  ├───┼───────────────┼────────────────────┼───────────┼─────────┼────────┤  │
│  │ ☐ │ Beta Inc      │ ████████████░ 85%↑ │ 8.2K →    │ 32 ↑    │ 1 🔴   │  │
│  │   │               │ 425/500 clicks     │ +2% WoW   │ +2      │        │  │
│  ├───┼───────────────┼────────────────────┼───────────┼─────────┼────────┤  │
│  │ ☐ │ Gamma Ltd     │ ████████████████107%│ 15.1K ↑  │ 58 →    │ 2 🟠   │  │
│  │   │               │ 3.2% CTR (>3%)     │ +12% WoW  │ +0      │        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ◀ 1 2 3 ... 10 ▶   Showing 1-50 of 500                                    │
│                                                                             │
│  [☐ Select All] [Run Audit] [Generate Report] [Export CSV ▾]               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Table Features:**

| Feature | Implementation |
|---------|----------------|
| **Virtualization** | TanStack Virtual — only render visible rows |
| **Multi-select** | Checkbox column with shift-click range select |
| **Bulk actions** | Context menu + action bar |
| **Hover popovers** | Show sparklines, goal details, alert list |
| **Inline editing** | Double-click to edit owner, tags |
| **Keyboard nav** | j/k rows, Enter drill-down, / search |
| **Column resize** | Drag column borders |
| **Column reorder** | Drag column headers |
| **Column toggle** | Settings popover |
| **Sort** | Click header, shift-click multi-sort |
| **Filter** | Header dropdowns + global filter bar |
| **Pagination** | 50/100/200 per page + cursor nav |
| **Export** | CSV with column selection |

**Columns Available:**

| Column | Source | Default |
|--------|--------|---------|
| Client Name | clients table | ✓ |
| Goal Progress | client_goals + computation | ✓ |
| Primary Goal | client_goals.is_primary | ✓ |
| Traffic (30d) | gsc_snapshots aggregate | ✓ |
| Traffic Trend | computation | ✓ |
| Keywords Top 10 | keyword_rankings | ✓ |
| Keywords Top 3 | keyword_rankings | |
| #1 Rankings | keyword_rankings | |
| CTR | gsc_snapshots | |
| Alerts | alerts aggregate | ✓ |
| Owner | client_assignments | ✓ |
| Last Touch | client_touches | |
| Contract Renewal | client_contracts | |
| MRR | client_contracts | |
| Tags | client_tags | |
| Status | clients.status | |

### Section 4: Quick Stats Cards (Draggable)

**Purpose:** Personalized KPI highlights

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ TOTAL CLICKS     │  │ KEYWORDS TOP 10  │  │ GOALS MET        │
│                  │  │                  │  │                  │
│ 2.1M             │  │ 4,230            │  │ 312/500          │
│ ▁▂▃▄▅▆▇█ +9%     │  │ ▃▄▅▆▇▇██ +340    │  │ ████████░░ 62%   │
│                  │  │                  │  │                  │
│ vs 1.9M last mo  │  │ vs 3,890 last mo │  │ vs 280 last mo   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Available Cards:**
- Total Clicks (30d)
- Total Impressions (30d)
- Portfolio CTR
- Keywords Top 10
- Keywords Top 3
- #1 Rankings
- Goals Met
- Goal Attainment Avg
- Active Alerts
- Clients On Track
- Clients At Risk
- Team Capacity

**Features:**
- Drag-and-drop reorder
- Add/remove cards
- Layout persists per user

### Section 5: Team Dashboard

**Purpose:** Answer "Is my team balanced and performing?"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TEAM PERFORMANCE                                            [Manage Team]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┬─────────┬─────────────┬──────────┬────────┬────────────┐  │
│  │ Team Member  │ Clients │ Avg Goal %  │ Critical │ Avg    │ Capacity   │  │
│  │              │         │             │          │ Touch  │            │  │
│  ├──────────────┼─────────┼─────────────┼──────────┼────────┼────────────┤  │
│  │ Sarah K.     │ 45      │ 82%         │ 1        │ 4.2d   │ ████████░░ │  │
│  │ Mike T.      │ 52      │ 79%         │ 2        │ 3.8d   │ █████████░ │  │
│  │ Lisa M.      │ 48      │ 75%         │ 3        │ 5.1d   │ █████████░ │  │
│  │ John D.      │ 55      │ 81%         │ 0        │ 2.9d   │ ██████████ │  │
│  │ Amy W.       │ 42      │ 77%         │ 2        │ 6.2d   │ ███████░░░ │  │
│  │ Unassigned   │ 258     │ 76%         │ 4        │ 8.1d   │ —          │  │
│  └──────────────┴─────────┴─────────────┴──────────┴────────┴────────────┘  │
│                                                                             │
│  [Balance Workload]  [Reassign Critical]  [View Unassigned]                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Click row to see team member's clients
- Capacity bar shows relative workload
- "Balance Workload" suggests reassignments
- "Reassign Critical" bulk-moves critical clients to available team members
- Drag client rows to reassign

### Section 6: Wins & Milestones

**Purpose:** Celebrate successes, build morale, client reports

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WINS THIS WEEK                                              [View All]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⭐ Acme Inc hit 100% of keyword goal (10/10 in top 10)                     │
│  ⭐ Beta Ltd traffic doubled MoM (+105%)                                    │
│  ⭐ Gamma Co captured 3 new #1 rankings                                     │
│  ⭐ Delta Inc CTR improved to 5.2% (was 3.1%)                               │
│  ⭐ 12 clients moved from "at risk" to "on track"                           │
│                                                                             │
│  MILESTONES                                                                 │
│  🎯 Epsilon Corp: 1 year anniversary (started Apr 2025)                     │
│  🎯 Zeta Inc: 100th keyword tracked                                         │
│  🎯 Portfolio: 4,000+ keywords in top 10 (new record)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Win Detection Rules:**
- Goal attainment reached 100%+ (was below)
- Traffic doubled MoM
- New #1 ranking captured
- CTR improved > 1%
- Status changed to "on track"

### Section 7: Activity Feed (Real-time)

**Purpose:** See what's happening across portfolio

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ACTIVITY                    [All ▾] [Alerts ▾] [Reports ▾] [Audits ▾]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ● 2 min ago   🔴 Alert: Acme Corp traffic dropped 45%                     │
│  ● 5 min ago   📊 Report generated for Beta Inc (Mar 2026)                 │
│  ● 12 min ago  🔍 Audit completed for Gamma Ltd (score: 87)                │
│  ● 18 min ago  🟢 Goal met: Delta Co reached 500 clicks/week               │
│  ● 25 min ago  ⚠️ Alert: Epsilon Inc CTR below target                      │
│  ● 1 hour ago  👤 Sarah K. reassigned 3 clients to Mike T.                 │
│  ● 2 hours ago 📈 GSC sync completed for 487 clients                       │
│  ...                                                                        │
│                                                                             │
│  [Load More]                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- WebSocket real-time updates
- Filter by event type
- Click to navigate to source
- Infinite scroll

---

## Part 4: Client Detail View

When you click a client, show comprehensive detail:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Portfolio        ACME CORP                    [Edit] [Actions ▾] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OVERVIEW                                          ACCOUNT                  │
│  ┌──────────────────────────────────────────┐     ┌────────────────────┐   │
│  │ Status: 🟠 At Risk                        │     │ Owner: Sarah K.    │   │
│  │ Goal Attainment: 70%                      │     │ Since: Jan 2025    │   │
│  │ Priority: High (needs attention)          │     │ MRR: $2,500        │   │
│  └──────────────────────────────────────────┘     │ Renews: Jun 15     │   │
│                                                    └────────────────────┘   │
│                                                                             │
│  GOALS                                                      [+ Add Goal]    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  ★ 10 keywords in top 10                                   7/10      │  │
│  │    [████████████████████████████░░░░░░░░░░░░]               70%      │  │
│  │    Trend: ↑ +2 this month • Projected to hit: May 15                 │  │
│  │                                                                       │  │
│  │  ○ 500 organic clicks per week                            423/500    │  │
│  │    [████████████████████████████████████░░░░░]              85%      │  │
│  │    Trend: → flat • Needs CTR improvement to hit target               │  │
│  │                                                                       │  │
│  │  ✓ CTR above 3%                                             3.2%     │  │
│  │    [████████████████████████████████████████████]           107%     │  │
│  │    Trend: ↑ +0.2% • Exceeding target                                 │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  TRAFFIC                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  Clicks (30 days)                              This Month: 12,450    │  │
│  │                                                                       │  │
│  │  2K ┤                                              ▄█▄               │  │
│  │     ┤                           ▄▆▄▆▄          ▄█▀   ▀▄              │  │
│  │  1K ┤      ▄▆▄▆▄▆▄▆▄▆▄▆▄▆▄▆▄▆▀                                      │  │
│  │     ┤                                                                │  │
│  │  0  ┼──────────────────────────────────────────────────────          │  │
│  │     Mar 20            Apr 5                  Apr 20                  │  │
│  │                                                                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │  │
│  │  │ Clicks       │  │ Impressions  │  │ CTR          │                │  │
│  │  │ 12,450       │  │ 389,000      │  │ 3.2%         │                │  │
│  │  │ +15% MoM     │  │ +22% MoM     │  │ -0.2% MoM    │                │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  KEYWORDS                                                   [Manage KWs]    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  Position Distribution (100 tracked keywords)                        │  │
│  │                                                                       │  │
│  │  #1      ███ 3                                                       │  │
│  │  #2-3    █████████ 9                                                 │  │
│  │  #4-10   ███████████████████████████████████ 35                      │  │
│  │  #11-20  ████████████████████████████ 28                             │  │
│  │  #21-50  ███████████████ 15                                          │  │
│  │  51+     ██████████ 10                                               │  │
│  │                                                                       │  │
│  │  In Top 10: 47/100 (47%)    Velocity: +18 positions this month       │  │
│  │                                                                       │  │
│  │  TOP MOVERS                                                          │  │
│  │  ├─ ⬆️ "best widgets" #15 → #3 (+12)                                 │  │
│  │  ├─ ⬆️ "widget reviews" #45 → #8 (+37) — entered top 10!            │  │
│  │  ├─ ⬇️ "cheap widgets" #7 → #14 (-7)                                 │  │
│  │  └─ ⬆️ "buy widgets online" #3 → #1 (+2) — captured #1!             │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ALERTS (2)                                                 [Manage Alerts] │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  🔴 CRITICAL — Traffic dropped 45% WoW                               │  │
│  │     Detected: Apr 19, 2026 at 3:42 PM                                │  │
│  │     Likely cause: Unknown — investigate GSC data                     │  │
│  │     [Acknowledge] [Snooze 7d] [Investigate]                          │  │
│  │                                                                       │  │
│  │  🟠 WARNING — CTR below 3% target for 2 weeks                        │  │
│  │     Detected: Apr 12, 2026 at 10:15 AM                               │  │
│  │     Suggestion: Review title tags and meta descriptions              │  │
│  │     [Acknowledge] [Snooze 7d] [Create Task]                          │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  RECENT ACTIVITY                                                            │
│  ├─ Apr 18: Optimized 5 product page title tags                            │
│  ├─ Apr 15: Fixed 3 mobile usability issues from GSC                       │
│  ├─ Apr 10: Published 2 new blog posts                                     │
│  └─ Apr 5: Completed technical audit (score: 87)                           │
│                                                                             │
│  [View Full History] [Add Note] [Generate Report]                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: UI/UX Patterns for 500 Clients

### Performance Requirements

| Metric | Target | Implementation |
|--------|--------|----------------|
| Initial Load | < 1.5s | Pre-computed metrics, SSR |
| Table Render | < 100ms | TanStack Virtual |
| Search | < 50ms | Server-side with index |
| Filter | < 100ms | Server-side |
| Sort | < 100ms | Pre-indexed columns |
| Hover Popover | < 50ms | Lazy load on hover |
| Sparklines | < 20ms each | Canvas rendering |

### Virtualization Strategy

```typescript
// TanStack Virtual for table rows
const virtualizer = useVirtualizer({
  count: clients.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72, // Row height
  overscan: 5, // Render 5 extra rows for smooth scroll
});

// Only render visible rows
{virtualizer.getVirtualItems().map((virtualRow) => (
  <ClientRow key={virtualRow.key} client={clients[virtualRow.index]} />
))}
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `Enter` | Open client detail |
| `Space` | Toggle select |
| `Shift+Click` | Range select |
| `/` | Focus search |
| `Escape` | Clear selection / close modal |
| `Cmd+K` | Open command palette |
| `Cmd+A` | Select all (in table) |
| `g h` | Go home (dashboard) |
| `g c` | Go clients (portfolio) |
| `g t` | Go team |
| `g a` | Go alerts |

### Command Palette (Cmd+K)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Type a command or search...                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  RECENT                                                         │
│  ├─ 📊 Acme Corp                                               │
│  ├─ 📊 Beta Inc                                                │
│  └─ 📈 View Portfolio                                          │
│                                                                 │
│  ACTIONS                                                        │
│  ├─ 🔍 Run Audit...                                            │
│  ├─ 📝 Generate Report...                                      │
│  ├─ 👤 Reassign Client...                                      │
│  └─ 📤 Export Portfolio...                                     │
│                                                                 │
│  NAVIGATION                                                     │
│  ├─ 🏠 Dashboard                               ⌘ Shift D        │
│  ├─ 📋 Client Portfolio                        ⌘ Shift C        │
│  ├─ 👥 Team                                    ⌘ Shift T        │
│  └─ 🔔 Alerts                                  ⌘ Shift A        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Loading States

```
// Skeleton for table row
<div className="flex items-center h-18 px-4 gap-4">
  <Skeleton className="h-4 w-4" />           {/* Checkbox */}
  <Skeleton className="h-10 w-32" />         {/* Client name */}
  <Skeleton className="h-4 w-24" />          {/* Goal progress */}
  <Skeleton className="h-4 w-20" />          {/* Traffic */}
  <Skeleton className="h-4 w-16" />          {/* Keywords */}
  <Skeleton className="h-4 w-12" />          {/* Alerts */}
</div>
```

### Error States

- **Data fetch error:** Show error banner with retry button
- **Partial failure:** Show available data with warning badge
- **Stale data:** Show last updated timestamp with refresh option

---

## Part 6: Implementation Roadmap

### Phase 22: Goals & Metrics Foundation

| Plan | Focus | Deliverables |
|------|-------|--------------|
| 22-01 | Schema | `client_goals`, `goal_snapshots`, `client_touches`, `client_assignments` |
| 22-02 | Worker | Goal computation in BullMQ job, priority score |
| 22-03 | API | Goals CRUD, goal templates, auto-suggest from history |
| 22-04 | UI | Goal setup wizard, goal progress components |

### Phase 23: Performance & Scale

| Plan | Focus | Deliverables |
|------|-------|--------------|
| 23-01 | Virtualization | TanStack Virtual for table, lazy sparklines |
| 23-02 | Pagination | Cursor-based pagination, server-side sort/filter |
| 23-03 | Caching | Redis caching layer, optimistic updates |
| 23-04 | Aggregates | `portfolio_aggregates` table, batch computation |

### Phase 24: Power User Features

| Plan | Focus | Deliverables |
|------|-------|--------------|
| 24-01 | Keyboard | Full keyboard navigation, command palette |
| 24-02 | Bulk Ops | Multi-select, bulk audit/report/reassign |
| 24-03 | Saved Views | View save/load, column customization, sharing |
| 24-04 | Export | CSV/PDF export with column selection |

### Phase 25: Team & Intelligence

| Plan | Focus | Deliverables |
|------|-------|--------------|
| 25-01 | Team | Team dashboard, workload balancing, reassignment |
| 25-02 | Patterns | Cross-client pattern detection ("industry trend") |
| 25-03 | Predictions | Predictive alerts, goal projection |
| 25-04 | Insights | Opportunity identification (high impressions, low CTR) |

---

## Part 7: Success Metrics

### Performance KPIs

| Metric | Target | Current |
|--------|--------|---------|
| Dashboard load time | < 1.5s | TBD |
| Table scroll FPS | 60 FPS | TBD |
| Search latency | < 50ms | TBD |
| Time to first alert action | < 10s | TBD |

### User Experience KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Clients triaged per session | 20+ | Analytics |
| Bulk action usage | 30%+ of actions | Analytics |
| Keyboard nav adoption | 20%+ of power users | Analytics |
| Saved view usage | 50%+ of users | Analytics |

### Business KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Client churn rate | < 5% | After 3 months |
| Goal attainment avg | > 80% | Monthly report |
| Alert response time | < 24h | Alert timestamps |
| Team utilization | 80-90% | Workload metrics |

---

## Summary

**What Changes:**

1. **Health Score → Goal Attainment** — Track explicit goals, not arbitrary weights
2. **Static Metrics → Trends** — Show sparklines and momentum
3. **Hidden Issues → Alerts** — Surface actionable problems
4. **Manual Triage → Priority Queue** — Automatic attention sorting
5. **Single View → Role Views** — Agency owner, account manager, client views

**What's Built:**
- Pre-computed metrics infrastructure ✓
- Real-time WebSocket feed ✓
- Dashboard components ✓
- Alert system ✓

**What's Needed:**
- Goal tracking system
- Virtualized table
- Keyboard navigation
- Command palette
- Team management
- Pattern detection

**The Core Insight:**

A world-class 500-client dashboard doesn't overwhelm with data — it surfaces what matters:
- **Goals** tell you what success looks like
- **Trends** tell you if you're heading there
- **Alerts** tell you what's broken
- **Priority** tells you what to work on first

Everything else is drill-down detail available on demand.
