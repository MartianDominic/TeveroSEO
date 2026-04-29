# Rethinking Client Health Metrics

**Status:** Design Discussion  
**Created:** 2026-04-19  
**Context:** Phase 21 implemented an arbitrary health score. This document explores better approaches.

---

## The Problem

The current health score is arbitrary:

```typescript
// Current implementation (health-score.ts)
traffic: 30%, rankings: 25%, technical: 20%, backlinks: 15%, content: 10%
```

**Why this is problematic:**

1. **Doesn't map to business outcomes** - A score of 72 means nothing if it doesn't correlate with client goals
2. **Opaque** - "Why is my client at 68?" leads to distrust
3. **One-size-fits-all** - Different clients have different definitions of "healthy"
4. **Gameable** - Optimizing for the score rather than outcomes (Goodhart's Law)
5. **Arbitrary weights** - Why is traffic 30% and backlinks 15%? No data supports this

---

## What Does "Health" Actually Mean?

### Option A: Health = Goal Attainment

Instead of arbitrary scores, track progress toward defined goals:

```
ACME CORP - Goal Progress
─────────────────────────────────────────
Goal                           Progress
├─ 10 keywords in top 10      7/10 (70%) ↑
├─ 500 organic clicks/week    423/500 (85%) →
└─ CTR > 3%                   2.8% ⚠️
```

**Pros:**
- Directly tied to what client is paying for
- Transparent - everyone knows the target
- Client-specific - each client has their own goals
- Measurable success - "We hit 8/10 keyword goals"

**Cons:**
- Requires goal-setting per client (onboarding friction)
- Goals need periodic review
- Comparing clients is harder (no single number)

---

### Option B: Health = Trend Direction

Instead of a score, show trend indicators:

```
ACME CORP - 30-Day Trends
─────────────────────────────────────────
Metric          Trend    Change
├─ Traffic      ↑        +12% WoW
├─ Impressions  →        +0.5% (flat)
├─ Avg Position ↑        4.2 → 3.8
├─ CTR          ↓        3.2% → 2.8%
└─ Top 10 KWs   ↑        42 → 47
```

**Pros:**
- No arbitrary weighting
- Shows momentum, not static state
- Easy to scan visually
- Highlights what's improving/declining

**Cons:**
- No single "sort by health" option
- Harder to prioritize attention across 500 clients
- Trends can be noisy (one bad week looks alarming)

---

### Option C: Health = Alert-Based

Don't compute a score - surface actual problems:

```
ACME CORP - Status: 2 Issues
─────────────────────────────────────────
🔴 CRITICAL
   └─ Traffic dropped 35% WoW (investigate)

🟠 WARNING  
   └─ CTR below 3% target for 2 weeks

✅ ON TRACK
   ├─ 47 keywords in top 10 (target: 40)
   ├─ GSC connected, syncing daily
   └─ No technical errors detected
```

**Pros:**
- Actionable - tells you what to do
- No arbitrary math
- Prioritizes by severity
- Self-documenting

**Cons:**
- Alert fatigue if thresholds are wrong
- Still need to define what triggers alerts
- Harder to show "overall portfolio health"

---

### Option D: Configurable Composite (Current + Flexibility)

Keep a composite score but make it configurable:

```
Workspace Settings → Health Score Weights
─────────────────────────────────────────
Component           Weight    Your Focus
├─ Traffic trend    [====    ] 40%   Lead gen
├─ Ranking progress [===     ] 30%   Visibility
├─ Technical health [=       ] 10%   Baseline
├─ Backlink growth  [=       ] 10%   Authority
└─ Content fresh    [=       ] 10%   Engagement
                    ──────────
                    Total: 100%

Presets: [Lead Gen] [Brand Awareness] [Technical] [Custom]
```

**Per-client override:**
```
Client: Acme Corp → Override workspace defaults
├─ Use workspace defaults: [ ]
└─ Custom weights: Traffic 50%, Rankings 50%, others 0%
```

**Pros:**
- Still get a single sortable number
- Agency controls what "health" means
- Per-client customization for key accounts
- Presets reduce friction

**Cons:**
- Still somewhat arbitrary (user chooses arbitrary weights)
- More settings to manage
- Weights don't automatically adapt to goals

---

## Specific Metrics to Consider

### Keyword Ranking Metrics

| Metric | Description | Example |
|--------|-------------|---------|
| **Goal attainment** | Keywords hitting target vs goal | 7/10 in top 10 = 70% |
| **Top 10 count** | Total keywords in top 10 | 47 keywords |
| **Top 3 count** | Total keywords in top 3 | 12 keywords |
| **#1 positions** | Keywords ranked #1 | 3 keywords |
| **Ranking velocity** | Positions gained/lost this period | +18 positions |
| **Ranking distribution** | Spread across positions | 3 in #1, 9 in #2-3, 35 in #4-10 |

### Traffic Metrics

| Metric | Description | Example |
|--------|-------------|---------|
| **Clicks (30d)** | Total organic clicks | 12,450 |
| **Click trend** | WoW or MoM change | +12% WoW |
| **Impressions** | Total impressions | 245,000 |
| **CTR** | Clicks / Impressions | 5.1% |
| **CTR trend** | Is CTR improving? | -0.3% WoW |
| **Click share** | Clicks vs total available (est.) | ~8% of category |

### Technical/Connection Metrics

| Metric | Description | Example |
|--------|-------------|---------|
| **GSC connected** | Is data flowing? | Yes, last sync 2h ago |
| **Data freshness** | How old is latest data? | 2 hours |
| **Coverage issues** | GSC coverage report problems | 3 pages with errors |
| **Core Web Vitals** | CWV status | 2 URLs need improvement |

---

## Questions to Resolve

### 1. What is the primary use case for "health"?

- **Triage**: "Which 20 clients need attention today?" → Alerts work best
- **Reporting**: "Show the client their progress" → Goal attainment works best  
- **Portfolio view**: "Is my agency doing well overall?" → Trends work best
- **Sorting**: "Rank clients by who needs help" → Composite score needed

### 2. Do different client tiers need different approaches?

- **Enterprise clients**: Custom goals, detailed tracking
- **SMB clients**: Simpler metrics, preset goals
- **Self-serve**: Automated alerts only

### 3. Should health be comparable across clients?

If yes → Need a normalized score (some composite)
If no → Can use goal attainment (each client has own targets)

### 4. What's the cost of getting it wrong?

- **False positive** (healthy client flagged as sick): Wastes time investigating
- **False negative** (sick client looks healthy): Client churns, revenue lost

---

## Recommended Approach

### Hybrid: Goals + Trends + Alerts

Don't pick one - layer them:

```
┌─────────────────────────────────────────────────────────────┐
│ ACME CORP                                      [View Goals] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GOALS (2 of 3 on track)                                    │
│  ├─ ✅ 10 keywords in top 10: 12/10 (120%)                  │
│  ├─ ⚠️  500 clicks/week: 423/500 (85%)                      │
│  └─ ✅ CTR > 3%: 3.2%                                       │
│                                                             │
│  TRENDS (30d)                ┌──────────────────────────┐   │
│  Traffic   ████████░░ +15%   │ ▁▂▃▄▅▆▇█▇▆ clicks 30d   │   │
│  Rankings  ██████████ +12    │                          │   │
│  CTR       ███████░░░ -0.2%  └──────────────────────────┘   │
│                                                             │
│  ALERTS (1)                                                 │
│  └─ 🟡 2 keywords dropped out of top 10 yesterday           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Quick Actions: [Run Audit] [Generate Report] [View Details]│
└─────────────────────────────────────────────────────────────┘
```

### For Portfolio Sorting

When sorting 500 clients, use a **priority score** based on:

```typescript
priority = (
  hasActiveAlerts ? 1000 : 0 +          // Alerts bubble up
  goalsBehindSchedule * 100 +           // Goal gaps matter
  Math.abs(trafficDropPct) * 10 +       // Big drops = attention
  daysSinceLastTouch * 1                // Neglected clients
)
```

This isn't "health" - it's "attention priority". Higher = needs you sooner.

### For Client Reporting

Show goal attainment, not arbitrary scores:

```
Monthly Report: ACME CORP
─────────────────────────────
Goal                    Status
├─ 10 KWs in top 10    ✅ 12 (exceeded)
├─ 500 clicks/week     ⚠️  423 (85%)
└─ CTR > 3%            ✅ 3.2%

Overall: 2 of 3 goals met (67%)
```

---

## Implementation Path

### Phase 1: Add Goal Tracking (New)
- Create `client_goals` table
- Goal types: keyword_ranking, traffic_target, ctr_target, custom
- Track current vs target
- Show goal progress on dashboard

### Phase 2: Refactor Health Score
- Rename "health score" → "attention priority"
- Make it sort-only (not displayed prominently)
- Based on alerts + goal gaps + trends

### Phase 3: Configurable Weights (Optional)
- If agencies want to customize priority weighting
- Presets for common agency types
- Per-client overrides

---

## Open Questions

1. **Should goals be set per client or per client tier?**
   - Per client = more accurate, more work
   - Per tier = less accurate, scalable

2. **What's the default for clients without goals?**
   - Use trend-based alerts only?
   - Auto-generate goals from historical data?

3. **How do we handle clients with no data yet?**
   - New connection, no history
   - Show "Not enough data" vs guess?

4. **Should the dashboard show a single "portfolio score"?**
   - Executives might want "portfolio health: 78%"
   - But this compounds all the problems of individual scores

---

## Next Steps

- [ ] Discuss with user which approach resonates
- [ ] Decide on Phase 1 scope (goals? alerts? both?)
- [ ] Design `client_goals` schema if pursuing goal tracking
- [ ] Update Phase 21 health score to be transparent about limitations
