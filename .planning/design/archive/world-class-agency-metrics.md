# World-Class Agency Dashboard Metrics

**Status:** Design Analysis  
**Created:** 2026-04-19  
**Context:** What does an agency managing 500 SEO clients actually need to see?

---

## The Core Question

"Health Score" is the wrong abstraction. The real question is:

**What decisions does an agency need to make, and what data enables those decisions?**

---

## Agency Operations: The Five Core Functions

At 500-client scale, an agency does five things daily:

| Function | Question Being Answered | Data Needed |
|----------|------------------------|-------------|
| **Triage** | "Which 10 clients need attention TODAY?" | Priority signals, alerts, risk indicators |
| **Monitor** | "Is my portfolio generally improving?" | Aggregate trends, distribution shifts |
| **Report** | "How do I prove value to this client?" | Goal progress, wins, work delivered |
| **Plan** | "What work should we do next for this client?" | Opportunities, gaps, competitive position |
| **Delegate** | "Who handles what, and are they overwhelmed?" | Assignments, workload, capacity |

A "health score" attempts to answer all five with one number. That's why it fails.

---

## The Problem with Composite Scores

```typescript
// Current implementation
health = traffic * 0.30 + rankings * 0.25 + technical * 0.20 + backlinks * 0.15 + content * 0.10
```

**Why this fails at scale:**

1. **Masks actionable information** - A score of 68 tells you nothing about what's wrong
2. **Different clients have different goals** - E-commerce cares about traffic; SaaS cares about rankings
3. **Arbitrary weights** - Why 30% traffic? No data supports this
4. **Gameable** - Teams optimize for the score, not outcomes (Goodhart's Law)
5. **False precision** - A client at 72 vs 71 is meaningless variance

**The real problem:** "Health" is a vanity metric. It feels good to track but doesn't drive action.

---

## What World-Class Looks Like

### Layer 1: Goals (What Client Pays For)

Every client engagement has deliverables. Track them explicitly:

```
ACME CORP — Goal Progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Goal                              Status    Progress
──────────────────────────────────────────────────────
├─ 10 keywords in top 10          7/10      70%  ↑
│  [████████████████████░░░░░░░░]
│  
├─ 500 organic clicks/week        423/500   85%  →
│  [██████████████████████████░░░]
│  
└─ CTR above 3%                   3.2%      107% ✓
   [████████████████████████████████████]

Overall: 2 of 3 goals on track (67%)
```

**Why this works:**
- Directly tied to what client is paying for
- Transparent — everyone knows the target
- Client-specific — each client has their own goals
- Measurable success — "We achieved 7 of 10 keyword placements"

### Layer 2: Trends (Momentum Indicators)

Are things getting better or worse? Don't compute — just show:

```
ACME CORP — 30-Day Trends
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Metric           Sparkline        Change     Signal
──────────────────────────────────────────────────────
Traffic (clicks) ▁▂▃▄▅▆▇█▇▆       +15% MoM   ↑ Growing
Impressions      ▃▄▄▅▅▆▆▇▇█       +22% MoM   ↑ Expanding
CTR              ██▇▇▆▆▆▅▅▅       -0.3% MoM  ↓ Watch
Avg Position     ▆▅▅▄▄▃▃▂▂▂       3.8→2.9    ↑ Improving
Top 10 Keywords  ▃▄▄▅▅▆▆▇▇█       42→47      ↑ Gaining
```

**Why this works:**
- No arbitrary weighting
- Shows momentum, not static state
- Visual — scannable in 2 seconds
- Highlights what's improving vs. declining

### Layer 3: Alerts (Action Items)

Don't compute scores — surface actual problems:

```
ACME CORP — Alerts (2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 CRITICAL (1)
   └─ Traffic dropped 35% WoW
      Likely cause: GSC sync failed 3 days ago
      Action: Verify GSC connection, investigate further
      
🟠 WARNING (1)
   └─ CTR below 3% target for 2 consecutive weeks
      Pattern: High impressions + low clicks
      Action: Review title tags and meta descriptions
      
✅ ON TRACK
   ├─ 47 keywords in top 10 (target: 40)
   ├─ GSC connected, syncing daily
   └─ No technical errors detected
```

**Why this works:**
- Actionable — tells you what to do
- No arbitrary math
- Prioritizes by severity
- Self-documenting

### Layer 4: Engagement (Operational Status)

Who owns this client and when were they touched?

```
ACME CORP — Account Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner:          Sarah K.
Last touched:   2 days ago (keyword research)
Next scheduled: Apr 22 (technical audit)
Contract:       Renews Jun 15 (57 days)
MRR:            $2,500/mo
```

---

## The Sorting Problem

At 500 clients, you need to sort. "Show me the worst 20."

But what does "worst" mean?
- Worst goal attainment?
- Biggest traffic drop?
- Most alerts?
- Longest neglected?
- Highest churn risk?

**Solution: Priority Score (not Health Score)**

```typescript
// This isn't "health" — it's "attention priority"
// Higher = needs your attention sooner

priorityScore = (
  // Tier 1: Active problems
  (criticalAlerts > 0 ? 1000 * criticalAlerts : 0) +
  (warningAlerts > 0 ? 100 * warningAlerts : 0) +
  
  // Tier 2: Goal gaps (multiply by gap severity)
  (goalGapPct > 0 ? goalGapPct * 50 : 0) +
  
  // Tier 3: Negative momentum
  (trafficTrend < -0.20 ? Math.abs(trafficTrend) * 200 : 0) +
  
  // Tier 4: Neglect
  daysSinceLastTouch +
  
  // Tier 5: Revenue at risk
  (daysUntilRenewal < 30 && goalAttainmentPct < 0.80 ? 500 : 0)
)
```

**This isn't displayed as "Priority: 1,247"** — it's used to sort the attention queue.

```
ATTENTION QUEUE (sorted by priority)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 #  Client      Issue                 Goal Gap  Neglect
────────────────────────────────────────────────────────
 1  Acme Corp   🔴 Traffic -45%       30%       14 days
 2  Beta Inc    🔴 GSC sync failed    15%       7 days
 3  Gamma Ltd   🟠 Goal regression    20%       21 days
 4  Delta Co    🟠 CTR below target   10%       5 days
 5  Epsilon     🟠 Contract in 15d    25%       2 days
...
```

---

## The Specific Metrics to Track

### Keyword Metrics (User's Primary Goal Area)

| Metric | Description | Example | Why It Matters |
|--------|-------------|---------|----------------|
| **Keywords in Top 10** | Target KWs in positions 1-10 | 7/10 | User's stated goal |
| **Keywords in Top 3** | Target KWs in positions 1-3 | 3/10 | High-value positions |
| **#1 Rankings** | Target KWs at position 1 | 1/10 | Best outcome |
| **Total Target Keywords** | Size of keyword set | 100 | Denominator for ratios |
| **Ranking Velocity** | Net positions gained/lost | +18 this week | Momentum |
| **Position Distribution** | Breakdown by position band | 3/9/35/53 | Shows where effort is needed |

**Position Distribution Visualization:**
```
Position Band     Keywords    Visual
───────────────────────────────────────────────
#1                3           ███
#2-3              9           █████████
#4-10             35          ███████████████████████████████████
#11-20            28          ████████████████████████████
#21-50            15          ███████████████
51+               10          ██████████
───────────────────────────────────────────────
Total tracked:    100
In top 10:        47 (target: 40) ✓
```

### Traffic Metrics (From GSC)

| Metric | Description | Example | Why It Matters |
|--------|-------------|---------|----------------|
| **Clicks (30d)** | Total organic clicks | 12,450 | Primary traffic measure |
| **Clicks (7d)** | Recent clicks | 2,890 | Short-term trend |
| **Click Trend (WoW)** | Week-over-week change | +12% | Momentum |
| **Click Trend (MoM)** | Month-over-month change | +8% | Sustained growth |
| **Impressions (30d)** | Total impressions | 245,000 | Visibility |
| **CTR** | Clicks / Impressions | 5.1% | Title/snippet effectiveness |
| **CTR vs Expected** | CTR vs position-average | +0.8% above avg | Content quality signal |

### Goal Metrics (The New Core)

| Metric | Description | Example |
|--------|-------------|---------|
| **Goal Count** | Total active goals | 3 |
| **Goals Met** | Goals at 100%+ | 2 |
| **Goal Attainment %** | Average progress across goals | 87% |
| **Worst Goal** | Lowest performing goal | CTR at 85% |
| **Goal Trend** | Is attainment improving? | ↑ +5% this month |

### Operational Metrics (Agency Management)

| Metric | Description | Example |
|--------|-------------|---------|
| **Days Since Touch** | Last work on this client | 14 days |
| **Assigned To** | Account owner | Sarah K. |
| **Contract Renewal** | Days until renewal | 57 days |
| **MRR** | Monthly revenue | $2,500 |
| **Active Alerts** | Critical + Warning count | 2 |
| **Alert Severity** | Highest severity | Critical |

---

## Dashboard Views by Role

### 1. Agency Owner View (500-Client Portfolio)

**Primary question:** "Is my agency succeeding overall?"

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Agency Portfolio                                      Apr 19, 2026      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PORTFOLIO PULSE                                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  500 clients    │ 🟢 412 on track │ 🟠 76 watching │ 🔴 12 critical │  │
│  │                 │     (82%)       │     (15%)      │     (2%)      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  AGGREGATE PERFORMANCE (30d)                                            │
│  ├─ Avg Goal Attainment:     78%  (↑ from 72% last month)              │
│  ├─ Total Keywords in Top 10: 4,230  (+340 this month)                  │
│  ├─ Total Client Clicks:      2.1M  (+180K this month)                  │
│  └─ Portfolio Avg CTR:        4.2%  (→ stable)                          │
│                                                                         │
│  DISTRIBUTION SHIFTS                                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Goal Attainment Distribution                                      │  │
│  │                                                                   │  │
│  │ 100%+ ████████████████████████████████████████ 180 clients (+12)  │  │
│  │ 80-99 ████████████████████████████ 142 clients (+8)               │  │
│  │ 60-79 ████████████████ 90 clients (-15)                           │  │
│  │ 40-59 ████████ 52 clients (-3)                                    │  │
│  │ <40%  ████████████████████████ 36 clients (-2)                    │  │
│  │                                                                   │  │
│  │ Trend: Clients moving UP in distribution ↑                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  TEAM PERFORMANCE                                                       │
│  ┌──────────────┬─────────┬─────────────┬──────────┬─────────────────┐  │
│  │ Team Member  │ Clients │ Avg Goal %  │ Critical │ Avg Touch (days)│  │
│  ├──────────────┼─────────┼─────────────┼──────────┼─────────────────┤  │
│  │ Sarah K.     │ 45      │ 82%         │ 1        │ 4.2             │  │
│  │ Mike T.      │ 52      │ 79%         │ 2        │ 3.8             │  │
│  │ Lisa M.      │ 48      │ 75%         │ 3        │ 5.1             │  │
│  │ ...          │         │             │          │                 │  │
│  └──────────────┴─────────┴─────────────┴──────────┴─────────────────┘  │
│                                                                         │
│  ATTENTION QUEUE (12 critical)                          [View All →]    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. Acme Corp    │ Traffic -45%      │ Goal: 70%  │ Sarah │ 14d    │  │
│  │ 2. Beta Inc     │ GSC sync failed   │ Goal: 85%  │ Mike  │ 7d     │  │
│  │ 3. Gamma Ltd    │ 3 KWs dropped     │ Goal: 65%  │ Lisa  │ 21d    │  │
│  │ ...                                                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Account Manager View (My 50 Clients)

**Primary question:** "What do I work on today?"

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Sarah's Portfolio (45 clients)                        Apr 19, 2026      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TODAY'S FOCUS                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 🔴 Acme Corp: Traffic -45%, investigate immediately                │  │
│  │ 🟠 Beta Inc: Contract renews in 15 days, goal only at 70%          │  │
│  │ 🟠 Gamma Ltd: 3 keywords dropped out of top 10 yesterday           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  MY PERFORMANCE                                                         │
│  ├─ Avg Goal Attainment: 82% (agency avg: 78%)                         │
│  ├─ Clients On Track: 38/45 (84%)                                       │
│  ├─ Keywords in Top 10: 890 (+45 this month)                            │
│  └─ Total Client Clicks: 125K (+12% MoM)                                │
│                                                                         │
│  CLIENT TABLE                      [Search] [Filter ▾] [Sort: Priority] │
│  ┌────┬────────────┬──────────────────┬──────────┬────────┬───────────┐ │
│  │ ☐  │ Client     │ Primary Goal     │ Progress │ Trend  │ Last Touch│ │
│  ├────┼────────────┼──────────────────┼──────────┼────────┼───────────┤ │
│  │ ☐  │ Acme Corp  │ 10 KWs top 10    │ 70%      │ ↓ -8%  │ 14 days  │ │
│  │ ☐  │ Beta Inc   │ 500 clicks/week  │ 85%      │ → flat │ 7 days   │ │
│  │ ☐  │ Gamma Ltd  │ CTR > 3%         │ 93%      │ ↑ +5%  │ 2 days   │ │
│  │ ...                                                                │ │
│  └────┴────────────┴──────────────────┴──────────┴────────┴───────────┘ │
│                                                                         │
│  [Bulk Actions: Run Audit (3) | Generate Reports (3) | Reassign (3)]    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. Client-Facing View (What Client Sees)

**Primary question:** "Is my SEO working?"

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Acme Corp — SEO Performance                            Apr 19, 2026     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  YOUR GOALS                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  ✅ 10 keywords in Google top 10                          7/10   │  │
│  │     [████████████████████████████░░░░░░░░░░░░░░]           70%   │  │
│  │     ↑ +2 from last month • On track to hit target by May         │  │
│  │                                                                   │  │
│  │  ⚠️  500 organic clicks per week                         423/500  │  │
│  │     [████████████████████████████████████░░░░░░]           85%   │  │
│  │     → Holding steady • Need CTR improvements to hit target       │  │
│  │                                                                   │  │
│  │  ✅ Click-through rate above 3%                            3.2%   │  │
│  │     [████████████████████████████████████████████]         107%   │  │
│  │     ✓ Exceeding target                                           │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  TRAFFIC TREND (30 days)                                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  Clicks                                                          │  │
│  │  1.5K ┤                                              ▄█▄         │  │
│  │  1.0K ┤                           ▄▆▄▆▄          ▄█▀   ▀▄       │  │
│  │  500  ┤      ▄▆▄▆▄▆▄▆▄▆▄▆▄▆▄▆▄▆▀                              │  │
│  │    0  ┼──────────────────────────────────────────────────────    │  │
│  │       Mar 20            Apr 5                  Apr 19            │  │
│  │                                                                   │  │
│  │  This month: 12,450 clicks (+15% vs last month)                  │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  KEYWORD WINS                                                           │
│  ├─ ⭐ "best widgets" moved to #3 (+12 positions)                      │
│  ├─ ⭐ "widget reviews" entered top 10 at #8 (new!)                    │
│  └─ ⭐ "buy widgets online" reached #1 position                        │
│                                                                         │
│  RECENT WORK                                                            │
│  ├─ Apr 18: Optimized 5 product page title tags                        │
│  ├─ Apr 15: Fixed 3 mobile usability issues from GSC                   │
│  └─ Apr 10: Published 2 new blog posts targeting long-tail keywords    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### New Table: client_goals

```sql
CREATE TABLE client_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Goal definition
  goal_type TEXT NOT NULL CHECK (goal_type IN (
    'keywords_top_10',    -- X keywords in positions 1-10
    'keywords_top_3',     -- X keywords in positions 1-3
    'weekly_clicks',      -- X clicks per week
    'monthly_clicks',     -- X clicks per month
    'ctr_target',         -- CTR above X%
    'position_target',    -- Specific keyword at position X
    'custom'              -- Custom goal with manual tracking
  )),
  goal_name TEXT NOT NULL,          -- Human-readable: "10 keywords in top 10"
  
  -- Target
  target_value NUMERIC NOT NULL,    -- e.g., 10, 500, 3.0
  target_keyword_count INTEGER,     -- For keyword goals: "out of X"
  
  -- Current status (updated by BullMQ job)
  current_value NUMERIC,            -- e.g., 7, 423, 3.2
  attainment_pct NUMERIC,           -- current/target as percentage
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'flat')),
  trend_magnitude NUMERIC,          -- e.g., +2 keywords, -5%
  
  -- Metadata
  is_primary BOOLEAN DEFAULT false, -- Highlight as primary goal
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint: one goal per type per client (unless custom)
  UNIQUE(client_id, goal_type) WHERE goal_type != 'custom'
);

CREATE INDEX idx_client_goals_client ON client_goals(client_id);
CREATE INDEX idx_client_goals_workspace ON client_goals(workspace_id);
```

### Updated: client_dashboard_metrics

```sql
-- Add new columns, deprecate health_score
ALTER TABLE client_dashboard_metrics 
  ADD COLUMN goal_attainment_pct NUMERIC,      -- Average across all goals
  ADD COLUMN goals_met_count INTEGER,          -- X goals at 100%+
  ADD COLUMN goals_total_count INTEGER,        -- Total active goals
  ADD COLUMN priority_score INTEGER,           -- For attention queue sorting
  ADD COLUMN keywords_top_10 INTEGER,          -- Keywords in positions 1-10
  ADD COLUMN keywords_top_3 INTEGER,           -- Keywords in positions 1-3
  ADD COLUMN keywords_position_1 INTEGER,      -- Keywords at #1
  ADD COLUMN total_tracked_keywords INTEGER,   -- Total keywords being tracked
  ADD COLUMN alerts_critical INTEGER DEFAULT 0,
  ADD COLUMN alerts_warning INTEGER DEFAULT 0,
  ADD COLUMN days_since_touch INTEGER,
  ADD COLUMN contract_renewal_date DATE;

-- Deprecate but don't remove yet (for migration)
COMMENT ON COLUMN client_dashboard_metrics.health_score IS 'DEPRECATED: Use goal_attainment_pct instead';
```

---

## Migration Path

### Phase 1: Add Goal Infrastructure
- Create `client_goals` table
- Add goal configuration UI per client
- Update BullMQ job to compute goal attainment
- Add goal progress to dashboard

### Phase 2: Transition Health → Goals
- Add `goal_attainment_pct` to dashboard metrics
- Show both health score and goal attainment during transition
- Update sorting to use priority score
- Train users on new metrics

### Phase 3: Remove Health Score
- Hide health score from UI
- Keep column for historical data
- Full transition to goal-based metrics

---

## Open Questions

1. **Default goals for clients without explicit goals?**
   - Option A: Require goal setup during onboarding
   - Option B: Auto-generate from first 30 days of data
   - Option C: Use workspace-level defaults

2. **Goal templates by industry?**
   - E-commerce: Traffic + conversions weighted
   - B2B SaaS: Rankings + branded terms
   - Local business: Local pack + GMB signals

3. **How often to update goal progress?**
   - Real-time: Every GSC sync
   - Daily: Once per day batch job
   - Weekly: Aligns with GSC data freshness

4. **Client-visible vs. internal goals?**
   - Some goals (like MRR targets) are internal
   - Allow marking goals as "internal only"

---

## Summary

**What We Remove:**
- Arbitrary weighted health score
- Single composite number that masks problems

**What We Add:**
- Explicit, trackable goals per client
- Goal attainment percentage (the new "health")
- Priority score for triage (not displayed, just for sorting)
- Trend indicators for momentum
- Alert system for actionable issues

**The Core Insight:**
A world-class dashboard doesn't say "health is 72."
It says: "You're at 70% of your keyword goal, up from 65% last month, with 2 alerts to address."

Goals are explicit. Progress is measurable. Actions are clear.
