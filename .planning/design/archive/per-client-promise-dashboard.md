# Per-Client Promise Dashboard

> The page that proves we deliver. Reframes the per-client view around **goal attainment** (the actual product promise) instead of generic SEO metrics. Combines image-13 visual confidence (sidebar shell, big numerals, dominant chart anchor) with v3's typographic system, plus a goal-tracking centerpiece and forecast/diagnostics module that no competitor has.

---

## 1. The promise — what we actually sell

A TeveroSEO contract is one sentence. Some examples of what an agency commits to:

- "Get **20 of your 200 tracked keywords on page 1** by **July 31**."
- "Get **5 keywords to position #1** by **end of Q2**."
- "Improve **average position** from **18.7 → 8.0** by **end of year**."
- "Grow **organic traffic +60%** by **end of year**."
- "Acquire **25 referring domains** of DR ≥ 50 by **end of Q3**."

Everything else in the platform — audits, content production, link building, auto-fixes, voice management — is *in service of* this single contractual deliverable.

The per-client dashboard exists to answer one question, in five seconds:

> **Are we delivering on the promise — and if not, what's the gap and how do we close it?**

If the page can't answer that, it doesn't matter how pretty the cards are.

---

## 2. The 5-second test

What every viewer (agency owner, account manager, client) must learn within five seconds of opening the page:

1. **What's the goal?** ("20 of 200 keywords on page 1 by July 31")
2. **Where are we right now?** ("12 of 20 — 60%")
3. **Are we on track?** ("Yes, ETA July 18 — 13 days early" OR "No, ETA Aug 14 — 14 days late")
4. **What's the velocity?** ("+3 last 7 days, +12 last 30")
5. **What should change?** ("3 quick wins in the 11-15 bucket would land us at 15/20 in 14 days")

Section 5 is the differentiator. Other tools show *what is*. We show *what to do next*.

---

## 3. Goal-aware architecture

The dashboard adapts to the configured goal type. Same skeleton, different anchor metric. This is the design insight competitors miss.

| Goal type | Hero numeral | Distribution highlight | Velocity unit | Forecast metric |
|---|---|---|---|---|
| **N keywords on page 1** | `12 / 20` | bucket 1-10 | keywords/week into top 10 | ETA to N in top 10 |
| **N keywords in top 3** | `4 / 5` | bucket 1-3 | keywords/week into top 3 | ETA to N in top 3 |
| **N keywords at #1** | `2 / 5` | bucket 1 only | keywords/week to #1 | ETA to N at #1 |
| **Avg position to X** | `9.4 → 8.0` | weighted distribution | avg-pos delta/week | ETA to target avg pos |
| **+N% organic traffic** | `+18.4% → +60%` | traffic source mix | weekly traffic delta | ETA to traffic target |
| **+N referring domains** | `2,316 → 2,400` | DR distribution | RDs/week added | ETA to RD target |

Same dashboard, different anchor. The user picks a goal in client setup; the page reorients around it.

For the prototype: **"20 of 200 keywords on page 1 by July 31"** (the most common SEO contract).

---

## 4. Section architecture (top to bottom)

The page is opinionated about order. Each section answers a question the previous section provoked.

### A. Identity strip (sticky)
- Client name (display serif, big), domain (mono), country, owner avatar group
- Health pill, goal mini-pill, last sync timestamp
- Period selector right-aligned: 7D / 30D / 90D / 1Y / Custom (affects every chart on the page)
- Quick actions: Run audit · New article · Schedule report

### B. Page title + briefing
- "Project overview" (sans, large)
- One-sentence subtitle: "Snapshot of organic performance, content health, and active opportunities."

### C. **Goal hero — the moneyshot** ← THE NEW CENTERPIECE
The single most important section on the page. Detailed in §5.

### D. KPI strip (4 supporting cards)
Smaller, in service of the goal — not pretending to be the whole story.
- Organic traffic (clicks · 30d · sparkline · delta)
- Avg position (number · delta · period)
- Indexed pages
- Referring domains (delta · top new link last week)

Numerals in serif, tabular lining figures. Card padding generous (no 6-card cram).

### E. **Keyword distribution chart — the visual anchor**
Big bar chart, like image 13. Buckets: 1, 2-3, 4-10, 11-20, 21-50, 51-100, 100+.
- **Goal bucket highlighted** with deep accent + hatched fill. If goal is "top 10," buckets 1, 2-3, and 4-10 all render in accent. If goal is "top 3," only 1 and 2-3 do.
- Previous period overlaid (lighter, hatched differently)
- Hover reveals: count, % change, drill-down link
- Period selector tabs: 7D / 30D / 90D / 1Y (top-right of chart, like image 13)

### F. Two-column: keywords table + right rail
**Left (2/3):** Top keywords table with 4 tabbed views:
- **All** — top by traffic delta
- **Movers** — biggest position gainers + losers
- **Opportunities** ← *the tab the agency owner clicks every morning* — keywords in 11-15, est. effort + impact, "push to top 10" CTA
- **At risk** — keywords lost top 10 in last 14d

Columns: Keyword (mono), Position (with arrow + delta), Volume, KD, Intent (badge), Page, 90d sparkline.

**Right (1/3):**
- Site health gauge (0-100, grade A-F, breakdown by category) — like image 13
- Top opportunities (max 4-5, prioritized) — like image 13
- Recent activity (5-7 most recent events) — like image 13

### G. **Forecast & diagnostics — the differentiator** ← NEW
Detailed in §6. This is the section no competitor has.

### H. Content + audit pipeline
Compact strip:
- Content lifecycle (Idea → Outline → Draft → Review → Published, with counts)
- Audit findings (Tier 1/2/3/4 counts, time-to-fix avg)

### I. Ops strip (footer)
- All systems · last GSC sync · last DataForSEO pull · queue depth · build hash

---

## 5. Goal hero — design spec

The single biggest design move on the page. Must be visually arresting, instantly readable, and editorially confident.

### Layout

A wide tinted card (warm `surface-tinted` background) containing two sub-panels and an editorial subtitle.

```
┌─ outer card (warm tinted, 1 hairline-soft border) ───────────────────────┐
│                                                                            │
│  Q2 2026 GOAL · 89 days remaining                            ⚙ Edit goal  │
│                                                                            │
│  20 keywords on page 1 by July 31, 2026                                   │
│  ──────────────────────────────────────                                   │
│  (display serif, 32px, italic emphasis on "page 1" and "July 31")        │
│                                                                            │
│  ┌─ progress (white inner card) ────┐  ┌─ trajectory (white inner) ────┐ │
│  │                                   │  │                                │ │
│  │       12 / 20                     │  │  [line chart 90d]             │ │
│  │     ━━━━━━━━━━━░░░░░░░            │  │   actual ─── solid accent     │ │
│  │     60% to goal                   │  │   required pace ─── dashed    │ │
│  │     ────────────                  │  │   target endpoint ●           │ │
│  │     8 to land                     │  │                                │ │
│  │                                   │  │   annotations:                 │ │
│  │     ✓ ON TRACK                    │  │   • Apr 14 · audit complete   │ │
│  │     ETA Jul 18 — 13d ahead        │  │   • Apr 22 · pillar published │ │
│  │                                   │  │                                │ │
│  └───────────────────────────────────┘  └────────────────────────────────┘ │
│                                                                            │
│  Velocity   ▎ +3 keywords last 7 days · pace +12 / 30d                    │
│  Required   ▎ +0.9 / week to land 8 more by July 31                       │
│                                                                            │
│  Sub-goals                                                                 │
│  ✓ 5 keywords at #1 — currently 2/5 (on pace)                             │
│  ⚠ Avg position top 20 target 8.0 — currently 9.4 (at risk)               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Typographic moves

- **Eyebrow:** "Q2 2026 GOAL · 89 days remaining" — uppercase 11px, tracking 0.08em, color text-3
- **Goal sentence:** display serif, 32px, line-height 1.2, italic on the dynamic anchors ("page 1", "July 31, 2026") to mark them as the contract terms
- **Progress numeral:** display serif, 56px, `tabular-nums lining-nums`. The `12` is text-1; the `/ 20` is text-3.
- **Status pill:** small caps via `font-variant-caps: all-small-caps`, accent green on `accent-soft` background
- **ETA line:** sans 13px, italic on the date, `tabular-nums lining-nums` on the day count
- **Velocity rows:** sans 13px, with a 3px-wide accent left bar (border-left) for visual rhythm, italic on the time period
- **Sub-goals:** sans 13px, status icon + sentence + parenthetical state in text-3

### Colors

- Outer card: `surface-tinted` (#F2EDE0 warm) — editorial moment signal
- Inner cards: `surface` (white) — data clarity
- Progress fill: `accent` (deep emerald) with `repeating-linear-gradient` hatched fill (signature)
- Progress remainder: `accent-soft` (light emerald)
- Required-pace dashed line: `text-3` (gray)
- Annotations: `accent-line` vertical hairlines anchored to chart with small text

### Why this works

1. **Editorial gravitas** — tinted card + serif headline + italic emphasis = "this is the contract" feeling
2. **Instant scan** — `12 / 20` answers progress in 0.3s; status pill answers on-track in 0.5s; ETA answers when in 1s
3. **Trajectory visible** — actual vs required is a one-glance judgment of pace
4. **Diagnostic next-step** — sub-goals expose the granular tensions (e.g., #1 is fine, avg position is at risk)

---

## 6. Forecast & diagnostics — the differentiator

This is the section that makes us world-class. No SEO tool currently does this well — they show you what is, not what to do.

### 6.1 Structure

Three columns inside one card-on-card layout:

**Left column — Forecast envelope**
- Confidence bands chart (p10/p50/p90)
- Numeric statement: "85% confidence we land between July 6 and August 14"
- Risk factors that could shift the forecast:
  - "If Initech-style algo volatility hits, ETA slips ~9 days"
  - "If 3 stuck keywords in 11-15 push to top 10 in next 14d, ETA pulls in ~6 days"

**Middle column — Stuck & falling**
- **Stuck** (in 11-20 for >30 days, candidates to push):
  - "running shoes near me" — pos 16, stuck since Mar 1 (58 days)
  - "best women's running shoes" — pos 18, stuck since Feb 14
  - "wide running shoes" — pos 14, stuck since Mar 12
- **Falling** (lost top 10 in last 14d):
  - "best trail shoes" — was 8 → 12 (Apr 18)
  - "running shoes 2026" — was 9 → 13 (Apr 24)

Each row has effort/impact dots and a one-click action ("Audit page", "Refresh content", "Build links").

**Right column — Quick wins**
- Keywords in positions 11-15 with an estimated path to top 10:
  - "best running shoes" — pos 13 → top 10 · est. 2 weeks · low effort · high impact
  - "running shoes for flat feet" — pos 11 → top 10 · est. 1 week · low effort
  - "carbon plate running shoes" — pos 14 → top 10 · est. 3 weeks · med effort
  - "best marathon running shoes 2026" — pos 12 → top 10 · est. 2 weeks · low effort
  - "trail running shoes review" — pos 15 → top 10 · est. 4 weeks · high effort
- "If 3 of these land, goal hits at 15/20 in ~14 days."

### 6.2 Why this works

- **Forward-looking** — the only forward-looking section on the page. Everything else is "what happened." This is "what's about to happen / what we should do."
- **Probabilistic** — confidence bands, not a single point estimate, signal seriousness (Bloomberg/quant feel).
- **Actionable** — every diagnostic row has a recommended action with effort/impact. The user reads top to bottom and knows exactly what to do this week.
- **Compounds with goal hero** — the goal hero says *where we are*; this section says *what to do to close the gap*. Together they form the management story.

---

## 7. What v3 got wrong and v4 fixes

Pulled forward from the user's "ew" reaction to image 12:

| v3 mistake | v4 fix |
|---|---|
| 6 quickstat cards in a single row → cram | 4 KPI cards max, each with bigger numerals and breathing room |
| Hero numerals at 30px → too modest | Goal hero numeral at 56px, KPI numerals at 36px |
| No visual anchor → page reads as card grid | Distribution chart as dominant centerpiece (image-13 size) |
| Topbar-only chrome → less "product" | Sidebar shell (240px) with proper navigation tree |
| Editorial copy missing → feels generated | Goal hero + briefing copy in serif italic; activity feed has prose |
| All cards same size → no rhythm | Goal hero is full-width tinted; KPIs are equal small; chart is full-width tall; rail-and-table is asymmetric |
| Status density too high → noisy | More whitespace, tighter taxonomy, fewer simultaneous attention items visible |

---

## 8. Compositional rules to keep "world-class" feel

Locked rules that prevent regression to "another SaaS dashboard":

1. **One hero per page.** The goal hero is the only full-width tinted card. Don't duplicate the pattern below — kills the moment.
2. **Numerals scale by importance.** 56px (goal hero progress) → 36px (KPI strip) → 22px (table rows) → 14px (metadata). The eye travels through the hierarchy.
3. **Asymmetric grids.** Avoid 4×4 of equal cards. Use 1 hero + 4 small + 1 wide chart + 2/1 split + 3-col diagnostic. Rhythm is the design.
4. **Breathing room over density.** When in doubt, increase padding. The Bloomberg-of-SEO register comes from confidence, not cram.
5. **Editorial moments need serif.** Goal sentence, briefing prose, hero subtitle — all serif. Everything else sans.
6. **Distribution bucket highlighting is goal-aware.** Don't show buckets neutrally; tint the goal bucket so the eye lands there first.
7. **Forecast is always probabilistic.** A single ETA point estimate reads naive. Confidence bands signal seriousness.
8. **Action queue is at the diagnostic level**, not at the page level. Telling someone "do these three things" is more useful than 8 generic next-actions.

---

## 9. What this prototype demonstrates

The companion `client-hub-v2.html` will demonstrate:

1. ✅ Sidebar shell (image-13 fidelity)
2. ✅ Identity strip with period selector
3. ✅ **Goal hero with progress + trajectory + sub-goals** (new centerpiece)
4. ✅ KPI strip (4 cards, larger numerals than v3)
5. ✅ Distribution chart as dominant anchor (image-13 size, goal-bucket highlighted)
6. ✅ Top keywords table with 4-tab Movers/Opps/Risk pivot
7. ✅ Right rail: Health gauge + Top opportunities + Activity (image-13 fidelity)
8. ✅ **Forecast & diagnostics** with confidence bands, stuck/falling, quick wins (new differentiator)
9. ✅ Newsreader + Geist + Geist Mono (free triad)
10. ✅ All TDS v1.1 typographic moves: italic semantic, small caps taxonomy, OpenType numerals, 4-tier text color

What's deliberately NOT in the prototype (out of scope for one page):
- Backlinks deep dashboard
- Article editor
- Audit deep view
- Multi-period comparison

Those are linked-to from this page but live on dedicated pages.
