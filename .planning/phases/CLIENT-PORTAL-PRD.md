# Client Portal PRD: World-Class Implementation

**Version:** 1.0  
**Date:** 2026-05-05  
**Status:** Ready for Implementation

---

## Executive Summary

Build a world-class client portal that demonstrates SEO value through verified data, proactive communication, and trust-first design. Inspired by Linear, Stripe, Superhuman, and Locomotive — fast, beautiful, honest.

**Core Principle:** Never show a number you can't defend in a client meeting.

---

## Design Philosophy

### Trust Hierarchy

```
┌────────────────────────────────────────────────────────────────────┐
│                         TRUST HIERARCHY                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   VERIFIED (GSC)          ←── Always show, source of truth        │
│        ↓                                                           │
│   CALCULATED (our math)   ←── Show growth %, changes               │
│        ↓                                                           │
│   DEFENSIBLE (CPC data)   ←── Optional, clearly labeled            │
│        ↓                                                           │
│   CLIENT-OWNED (inputs)   ←── Their numbers, their responsibility  │
│        ↓                                                           │
│   INTEGRATED (GA4)        ←── Real revenue if connected            │
│                                                                    │
│   ✗ NEVER: Industry average revenue estimates                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Proactive > Reactive** — Portal comes to the client, not the other way
2. **Relative over Absolute** — "Up 340%" beats "Worth €12k"
3. **Show the Work** — Transparency justifies retainer
4. **Signal over Noise** — Fewer notifications, higher quality
5. **Speed is Trust** — Sub-second loads, instant interactions

### V6 Design System

**Typography:**
- Display: Newsreader (serif) — page titles, large numbers
- Body: Geist (sans) — everything else
- Mono: Geist Mono — code, timestamps, domains

**Colors:**
```css
--canvas:        #FAFAF7;      /* Background */
--surface:       #FFFFFF;      /* Cards */
--text-1:        #14141A;      /* Primary text */
--text-2:        #54545A;      /* Secondary text */
--text-3:        #93939A;      /* Tertiary/labels */
--accent:        #0F4F3D;      /* Primary green */
--success:       #1B6E45;      /* Positive */
--error:         #9B2C2C;      /* Negative */
--warning:       #A87F1A;      /* Caution */
```

**Shadows (Ghost-Edge):**
```css
--shadow-card:
  0 0 0 1px rgba(20, 20, 26, 0.045),
  0 1px 2px rgba(20, 20, 26, 0.03),
  inset 0 1px 0 rgba(255, 255, 255, 0.5);

--shadow-lift:  /* Hover state */
  0 0 0 1px rgba(20, 20, 26, 0.06),
  0 6px 16px -4px rgba(20, 20, 26, 0.06),
  0 16px 40px -16px rgba(20, 20, 26, 0.10),
  inset 0 1px 0 rgba(255, 255, 255, 0.55);
```

**Motion:**
```css
--ease-smooth:    cubic-bezier(0.16, 1, 0.3, 1);
--motion-fast:    160ms;
--motion-hover:   280ms;
```

**Spacing (Fluid):**
- 12px minimum for WCAG compliance
- Clamp-based scaling for responsive design
- Generous whitespace — let content breathe

---

## Information Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT PORTAL                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  Dashboard  │  │  Keywords   │  │  Progress   │  │  Activity │  │
│  │  (home)     │  │  (tracking) │  │  (goals)    │  │  (work)   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  Requests   │  │  Documents  │  │  Team       │  │  Settings │  │
│  │  (actions)  │  │  (files)    │  │  (users)    │  │  (config) │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature Specifications

### 1. Dashboard — "Is my SEO working?" in 5 seconds

```
┌─────────────────────────────────────────────────────────────────────┐
│  Good morning, Vilnius Coffee Co.                                   │
│                                                                     │
│  ╔═══════════════════════════════════════════════════════════════╗ │
│  ║  ORGANIC TRAFFIC THIS MONTH                                   ║ │
│  ║                                                               ║ │
│  ║      8,420 clicks         ↑ 34% vs last month                ║ │
│  ║      ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░      ║ │
│  ║                                                               ║ │
│  ║  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          ║ │
│  ║  │ Top 10       │ │ Avg Position │ │ Impressions  │          ║ │
│  ║  │    23        │ │    14.2      │ │   124,000    │          ║ │
│  ║  │   +5 ↑       │ │   -7.9 ↑     │ │   +28% ↑     │          ║ │
│  ║  └──────────────┘ └──────────────┘ └──────────────┘          ║ │
│  ╚═══════════════════════════════════════════════════════════════╝ │
│                                                                     │
│  ┌─────────────────────────────────┐ ┌────────────────────────────┐│
│  │ 🎉 RECENT WINS                  │ │ ⚠️ NEEDS ATTENTION         ││
│  ├─────────────────────────────────┤ ├────────────────────────────┤│
│  │ "best coffee vilnius" → #3     │ │ "coffee beans online"      ││
│  │ "organic coffee beans" → #7    │ │ dropped #8 → #15           ││
│  │ 3 new keywords in top 20       │ │ [View Details]             ││
│  │ [See all wins]                 │ │                            ││
│  └─────────────────────────────────┘ └────────────────────────────┘│
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 📋 RECENT ACTIVITY                                           │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ Today     Published: "Best Coffee Beans 2026 Guide"          │  │
│  │ Today     Optimized meta descriptions for 12 product pages   │  │
│  │ Yesterday Acquired backlink from foodblog.lt (DA 45)         │  │
│  │ [View all activity →]                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Data source: Google Search Console · Last updated: 2 hours ago    │
└─────────────────────────────────────────────────────────────────────┘
```

**Design Rules:**
- Hero metric is CLICKS (verified), not revenue
- All numbers show change direction (↑↓)
- "Needs Attention" builds trust — we're not hiding problems
- Data source clearly labeled at bottom
- No fake numbers anywhere

**Component Breakdown:**
| Component | Data Source | Trust Level |
|-----------|-------------|-------------|
| Organic Clicks | GSC | ✓ Verified |
| Top 10 Count | Calculated | ✓ Verified |
| Avg Position | GSC | ✓ Verified |
| Impressions | GSC | ✓ Verified |
| Recent Wins | Calculated from GSC | ✓ Verified |
| Needs Attention | Calculated from GSC | ✓ Verified |
| Activity Feed | Our database | ✓ Verified |

---

### 2. Keywords View — Full tracking with trust indicators

```
┌─────────────────────────────────────────────────────────────────────┐
│  KEYWORDS                                               [+ Request] │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Filter: [All ▼] [Position ▼] [Change ▼] [Search...]        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐
│  │ Keyword              │ Pos │ Change │ Clicks │ Impr  │ Vol*    │
│  ├──────────────────────┼─────┼────────┼────────┼───────┼─────────┤
│  │ best coffee vilnius  │  3  │ ↑ +4   │  892   │ 4.2k  │ ~2.4k   │
│  │ organic coffee beans │  7  │ ↑ +12  │  445   │ 2.1k  │ ~1.8k   │
│  │ coffee shop near me  │  11 │ ↓ -2   │  234   │ 8.9k  │ ~6.5k   │
│  │ espresso machine     │  34 │ ↑ +8   │   12   │  890  │ ~3.2k   │
│  │ ...                  │     │        │        │       │         │
│  └──────────────────────┴─────┴────────┴────────┴───────┴─────────┘
│                                                                     │
│  * Volume is estimated from third-party data (DataForSEO)          │
│    Pos/Clicks/Impressions are verified from Google Search Console  │
│                                                                     │
│  [Export CSV]  [Export PDF]                    Showing 50 of 127   │
└─────────────────────────────────────────────────────────────────────┘
```

**Column Trust Indicators:**
| Column | Source | Trust Level | UI Indicator |
|--------|--------|-------------|--------------|
| Position | GSC | ✓ Verified | None needed |
| Change | Calculated | ✓ Verified | None needed |
| Clicks | GSC | ✓ Verified | None needed |
| Impressions | GSC | ✓ Verified | None needed |
| Volume | DataForSEO | * Estimated | Asterisk + footnote |
| CPC | DataForSEO | * Estimated | Asterisk + footnote |
| Difficulty | DataForSEO | * Estimated | Asterisk + footnote |

**Keyword Detail View (click to expand):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  "best coffee vilnius"                                    [Close]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  POSITION HISTORY (GSC)                                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │     ╭─╮                                                    │    │
│  │  10 │ ╰───╮        ╭─────────────────────────────────╮    │    │
│  │     │     ╰────────╯                                 │ #3 │    │
│  │   1 │                                                     │    │
│  │     └──────────────────────────────────────────────────────    │
│  │      Jan     Feb     Mar     Apr     May                       │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  VERIFIED METRICS (GSC, last 30 days)                              │
│  ├─ Position: #3 (was #7 last month)                               │
│  ├─ Clicks: 892                                                    │
│  ├─ Impressions: 4,200                                             │
│  └─ CTR: 21.2%                                                     │
│                                                                     │
│  ESTIMATED METRICS (DataForSEO)*                                   │
│  ├─ Monthly search volume: ~2,400                                  │
│  ├─ CPC: €0.85                                                     │
│  └─ Keyword difficulty: 34/100                                     │
│                                                                     │
│  RANKING PAGE                                                       │
│  └─ /blog/best-coffee-vilnius-guide                                │
│                                                                     │
│  [Request Optimization]  [View Page]  [View in GSC]                │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3. Progress & Goals — Value story without fake numbers

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROGRESS                                                           │
│                                                                     │
│  ╔═══════════════════════════════════════════════════════════════╗ │
│  ║  CONTRACT GOAL                                                ║ │
│  ║  20 keywords in top 10 by July 31, 2026                      ║ │
│  ║                                                               ║ │
│  ║  ████████████████████████████░░░░░░░░░░░  23/20 (115%)       ║ │
│  ║                                                               ║ │
│  ║  ✓ Goal achieved on May 3, 2026 (89 days early)              ║ │
│  ╚═══════════════════════════════════════════════════════════════╝ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  BEFORE / AFTER                                              │   │
│  │                                                              │   │
│  │              Contract Start        Now           Change      │   │
│  │              (Jan 15, 2026)    (May 5, 2026)                │   │
│  │  ──────────────────────────────────────────────────────────  │   │
│  │  Organic Clicks    1,200          8,420         +602% ↑     │   │
│  │  Top 10 Keywords      4             23          +475% ↑     │   │
│  │  Avg Position        22.1          14.2          -7.9 ↑     │   │
│  │  Impressions       18,000        124,000        +589% ↑     │   │
│  │                                                              │   │
│  │  Source: Google Search Console (verified)                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  MILESTONES                                                  │   │
│  │                                                              │   │
│  │  ●────●────●────●────●────○────○                            │   │
│  │  │    │    │    │    │    │    │                            │   │
│  │  Jan  Feb  Mar  Apr  May  Jun  Jul                          │   │
│  │                                                              │   │
│  │  ✓ Jan 15 - Campaign started                                │   │
│  │  ✓ Feb 8  - First keyword in top 10                         │   │
│  │  ✓ Mar 12 - 10 keywords in top 10 (50% of goal)            │   │
│  │  ✓ Apr 20 - 5,000 monthly clicks milestone                  │   │
│  │  ✓ May 3  - Goal achieved (20 keywords in top 10)          │   │
│  │  ○ Jun    - Next goal checkpoint                            │   │
│  │  ○ Jul 31 - Contract renewal                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Download Progress Report]  [Share with Team]                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4. Value Context — The honest approach to revenue

```
┌─────────────────────────────────────────────────────────────────────┐
│  VALUE CONTEXT                                           [Settings] │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📊 GROWTH STORY (verified)                                  │   │
│  │                                                              │   │
│  │  Your organic traffic has grown 602% since we started.      │   │
│  │  You now receive 8,420 clicks/month from Google Search.     │   │
│  │                                                              │   │
│  │  This is verified data from Google Search Console.          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  💰 AD SPEND EQUIVALENT (optional)                [Hide ▼]  │   │
│  │                                                              │   │
│  │  If you bought these 8,420 clicks via Google Ads:           │   │
│  │  Approximately €6,200/month                                  │   │
│  │                                                              │   │
│  │  How we calculated this:                                     │   │
│  │  Sum of (keyword monthly clicks × keyword CPC)               │   │
│  │  Using market CPC data from DataForSEO                       │   │
│  │                                                              │   │
│  │  ⚠️ This is what the traffic would COST, not what it's     │   │
│  │  WORTH to your business. Actual value depends on your       │   │
│  │  conversion rates.                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🧮 YOUR VALUE CALCULATOR                        [Edit ▼]   │   │
│  │                                                              │   │
│  │  Your inputs:                                                │   │
│  │  ├─ Conversion rate: 2.3%  [Edit]                           │   │
│  │  └─ Average order value: €85  [Edit]                        │   │
│  │                                                              │   │
│  │  Calculation:                                                │   │
│  │  8,420 clicks × 2.3% = 194 conversions                      │   │
│  │  194 conversions × €85 = €16,490/month                      │   │
│  │                                                              │   │
│  │  ℹ️ This uses YOUR numbers. We can't verify conversion     │   │
│  │  rates or order values — only you know your business.       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✓ VERIFIED REVENUE (GA4 Connected)                         │   │
│  │                                                              │   │
│  │  From your Google Analytics ecommerce tracking:              │   │
│  │                                                              │   │
│  │  Organic Channel Revenue:     €9,847  (this month)          │   │
│  │  Organic Transactions:        127                            │   │
│  │  Organic Conversion Rate:     1.51%                          │   │
│  │  Avg Order Value:             €77.54                         │   │
│  │                                                              │   │
│  │  This is real data from YOUR analytics.                      │   │
│  │  Last synced: 2 hours ago  [Sync Now]  [View in GA4]        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Value Display Hierarchy:**
1. **Growth Story** — Always visible, always true (GSC)
2. **Ad Spend Equivalent** — Optional, clearly labeled as estimate
3. **Your Value Calculator** — Their inputs, their responsibility
4. **Verified Revenue** — Only if GA4 connected, real data

**What We NEVER Show:**
| ❌ Don't | Why |
|----------|-----|
| Revenue from "industry benchmarks" | Every business is different |
| ROI % we calculated | We don't know their actual costs |
| "You made €X from SEO" | We can't prove causation |
| Conversion estimates without their input | Pure fiction |

---

### 5. Activity Feed — Show the work

```
┌─────────────────────────────────────────────────────────────────────┐
│  ACTIVITY                                                           │
│                                                                     │
│  Filter: [All Types ▼]  [All Time ▼]                               │
│                                                                     │
│  TODAY · May 5, 2026                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📝 Content Published                              10:34 AM   │   │
│  │ "Ultimate Guide to Coffee Beans in 2026"                     │   │
│  │ 2,400 words · Targets: best coffee beans, organic coffee    │   │
│  │ [View Article]                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🔧 Technical Optimization                          9:15 AM   │   │
│  │ Updated meta descriptions for 12 product pages               │   │
│  │ Improved click-through messaging for coffee products         │   │
│  │ [View Changes]                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📊 Search Console                                  8:00 AM   │   │
│  │ Submitted 3 new URLs for indexing                            │   │
│  │ /blog/coffee-guide, /products/new-arrivals, /about-us       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  YESTERDAY · May 4, 2026                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🔗 Backlink Acquired                               3:22 PM   │   │
│  │ New link from foodblog.lt (DA 45)                            │   │
│  │ Links to: /blog/best-coffee-vilnius-guide                    │   │
│  │ [View Source]                                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🎯 Keyword Tracking                               11:00 AM   │   │
│  │ Added 5 new keywords from competitor gap analysis            │   │
│  │ espresso machine, coffee grinder, french press, ...          │   │
│  │ [View Keywords]                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Load More]                                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Activity Categories:**
| Icon | Category | Examples |
|------|----------|----------|
| 📝 | Content | Published, updated, optimized |
| 🔧 | Technical | Audits, fixes, speed improvements |
| 🔗 | Links | Backlinks acquired, internal links added |
| 🎯 | Tracking | Keywords added, competitors monitored |
| 📊 | Analytics | GSC submissions, reports generated |
| 💬 | Communication | Meetings, strategy updates |

**Activity Card Structure:**
```typescript
interface ActivityCard {
  icon: ActivityIcon;
  category: 'content' | 'technical' | 'links' | 'tracking' | 'analytics' | 'communication';
  title: string;
  description: string;
  timestamp: Date;
  artifacts?: {
    label: string;
    url: string;
  }[];
}
```

---

### 6. Notification System

**Notification Types & Default Settings:**

| Event | In-App | Email | Slack | Default |
|-------|--------|-------|-------|---------|
| Keyword hits Top 10 | ✓ | ✓ | ✓ | ON |
| Goal achieved | ✓ | ✓ | ✓ | ON |
| Significant drop (>5 pos) | ✓ | ✓ | ✓ | ON |
| Traffic anomaly (>30%) | ✓ | ✓ | - | ON |
| Work completed | ✓ | - | - | ON |
| Report ready | ✓ | ✓ | - | ON |
| Request status change | ✓ | ✓ | - | ON |
| Weekly digest | - | ✓ | - | ON |
| Monthly summary | - | ✓ | - | ON |

**Win Notification Email:**
```
Subject: 🎉 "best coffee vilnius" just hit #3!

Hi Tomas,

Great news for Vilnius Coffee Co.!

Your keyword "best coffee vilnius" just climbed to position #3 
on Google — up from #7 last month.

WHAT THIS MEANS
├─ ~2,400 people search this monthly in Lithuania
├─ Position #3 typically gets ~10% of clicks
├─ Estimated new monthly clicks: ~240

This is one of 23 keywords now in your top 10, compared to 
just 4 when we started in January.

[View in Portal]  [See All Keywords]

──────────────────────────────────────
Sent by TeveroSEO · Manage notifications
```

**Weekly Digest Email:**
```
Subject: Your SEO Week: May 1-7 · 3 wins, 1 item needs attention

Hi Tomas,

Here's your weekly SEO summary for Vilnius Coffee Co.

THIS WEEK'S NUMBERS (from Google Search Console)
├─ Clicks: 2,105 (↑ 12% vs last week)
├─ Impressions: 31,200 (↑ 8%)
├─ Avg Position: 14.2 (unchanged)

🎉 WINS
├─ "best coffee vilnius" → #3 (was #7)
├─ "organic coffee beans" → #7 (was #19)
├─ New article published: "Coffee Beans Guide 2026"

⚠️ NEEDS ATTENTION
└─ "coffee beans online" dropped from #8 to #15
   We're investigating and will update you.

WORK COMPLETED
├─ 1 article published
├─ 12 pages optimized
├─ 1 backlink acquired
├─ 3 URLs submitted to Google

[View Full Dashboard]

──────────────────────────────────────
Next digest: May 14 · Manage notifications
```

---

### 7. Self-Service Requests

```
┌─────────────────────────────────────────────────────────────────────┐
│  REQUESTS                                                           │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ + Track      │ │ + Content    │ │ + Optimize   │ │ + Schedule │ │
│  │   Keyword    │ │   Brief      │ │   Page       │ │   Call     │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                     │
│  YOUR REQUESTS                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ● In Progress                                                │   │
│  │                                                              │   │
│  │ ┌────────────────────────────────────────────────────────┐  │   │
│  │ │ Track Keyword: "espresso machine reviews"              │  │   │
│  │ │ Submitted: May 3 · Status: In Progress                 │  │   │
│  │ │                                                        │  │   │
│  │ │ Agency note: "Added to tracking. Currently at #34,    │  │   │
│  │ │ will monitor for movement over next 2 weeks."         │  │   │
│  │ └────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ✓ Completed                                                  │   │
│  │                                                              │   │
│  │ ┌────────────────────────────────────────────────────────┐  │   │
│  │ │ Content Brief: "Coffee grinder buying guide"           │  │   │
│  │ │ Submitted: Apr 28 · Completed: May 2                   │  │   │
│  │ │ [View Brief] [Download PDF]                            │  │   │
│  │ └────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Request Flow:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  Submitted  │────▶│ Under Review│────▶│ In Progress │────▶│ Complete │
└─────────────┘     └─────────────┘     └─────────────┘     └──────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Out of Scope│────▶ Change Order Flow
                    └─────────────┘
```

**Request Types:**
| Type | Fields | Auto-Actions |
|------|--------|--------------|
| Track Keyword | keyword, reason, priority | Check scope, add to tracking |
| Content Brief | topic, intent, audience, references | Generate brief |
| Optimize Page | URL or keyword, priority | Queue for optimization |
| Schedule Call | topic, preferred times | Calendar integration |
| Report Request | audience, purpose, sections | Generate or queue |

---

### 8. Integrations Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  INTEGRATIONS                                                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✓ Google Search Console                          Connected │   │
│  │    vilnius-coffee.com                                       │   │
│  │    Last sync: 2 hours ago                                   │   │
│  │    Data: Clicks, impressions, positions, queries           │   │
│  │    [Reconnect]  [Disconnect]                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✓ Google Analytics 4                             Connected │   │
│  │    Property: Vilnius Coffee (GA4)                           │   │
│  │    Last sync: 2 hours ago                                   │   │
│  │    Data: Conversions, revenue, user behavior               │   │
│  │                                                              │   │
│  │    🔓 UNLOCKED: Verified revenue data in Value Context     │   │
│  │    [Reconnect]  [Disconnect]                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ○ Slack                                      Not Connected │   │
│  │    Get notifications in your Slack workspace                │   │
│  │    [Connect Slack]                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ○ Calendar                                   Not Connected │   │
│  │    Schedule review calls directly from portal               │   │
│  │    [Connect Google Calendar]  [Connect Outlook]             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Integration Benefits:**
| Integration | Required | Unlocks |
|-------------|----------|---------|
| GSC | Yes | All traffic data, positions, queries |
| GA4 | No | Verified revenue, conversions, real conv rate |
| Slack | No | Push notifications to team channel |
| Calendar | No | One-click meeting scheduling |

---

### 9. Mobile Experience

**Design Requirements:**
- Touch targets: Minimum 44px
- Swipe gestures: Pull to refresh, swipe to dismiss
- Thumb zone: Important actions reachable with one hand
- Offline: Show cached data with "last updated" indicator

**Mobile Dashboard:**
```
┌─────────────────────────┐
│  Vilnius Coffee Co.     │
│                         │
│  ┌───────────────────┐  │
│  │   8,420           │  │
│  │   clicks          │  │
│  │   ↑ 34%           │  │
│  └───────────────────┘  │
│                         │
│  ┌─────┐ ┌─────┐ ┌─────┐│
│  │ 23  │ │14.2 │ │124k ││
│  │Top10│ │ Pos │ │Impr ││
│  │ +5  │ │-7.9 │ │+28% ││
│  └─────┘ └─────┘ └─────┘│
│                         │
│  🎉 Recent Wins      ▼  │
│  ────────────────────── │
│  "best coffee" → #3     │
│  "organic beans" → #7   │
│                         │
│  ⚠️ Needs Attention  ▼  │
│  ────────────────────── │
│  "beans online" ↓ #15   │
│                         │
│  ┌─────────────────────┐│
│  │ 📋 Activity    ▶    ││
│  └─────────────────────┘│
│                         │
│  GSC · 2h ago           │
└─────────────────────────┘
```

**PWA Features:**
- Add to home screen prompt
- App-like experience (no browser chrome)
- Splash screen with branding
- Offline fallback page
- Push notifications

---

## Implementation Phases

### Phase 1: Trust Foundation (3 weeks)

**Scope:** Core dashboard with verified-only data

| Week | Deliverables |
|------|--------------|
| 1 | Dashboard hero (clicks, positions, impressions from GSC) |
| 1 | Keywords table with GSC data |
| 1 | Basic responsive design |
| 2 | Recent wins section |
| 2 | Needs attention section |
| 2 | Keyword detail view with history chart |
| 3 | Activity feed (manual entries) |
| 3 | Basic email notifications (wins) |
| 3 | Mobile optimization pass |

**Schema:**
```sql
CREATE TABLE portal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  contract_id UUID REFERENCES contracts(id),
  category TEXT NOT NULL, -- content, technical, links, tracking, analytics, communication
  title TEXT NOT NULL,
  description TEXT,
  artifacts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE portal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  type TEXT NOT NULL, -- win, alert, update, digest
  channel TEXT NOT NULL, -- in_app, email, slack, push
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE portal_notification_settings (
  client_id UUID PRIMARY KEY REFERENCES clients(id),
  win_email BOOLEAN DEFAULT true,
  win_slack BOOLEAN DEFAULT true,
  alert_email BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'
);
```

---

### Phase 2: Progress & Value (2 weeks)

**Scope:** Tell the value story honestly

| Week | Deliverables |
|------|--------------|
| 4 | Goals tracking against contract |
| 4 | Before/after comparison view |
| 4 | Milestones timeline |
| 5 | Value Context section (all 4 tiers) |
| 5 | Client value calculator (their inputs) |
| 5 | Weekly digest email |

**Schema:**
```sql
CREATE TABLE portal_client_settings (
  client_id UUID PRIMARY KEY REFERENCES clients(id),
  conversion_rate DECIMAL(5,2), -- e.g., 2.30 for 2.3%
  average_order_value DECIMAL(10,2),
  show_ad_equivalent BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  contract_id UUID REFERENCES contracts(id),
  title TEXT NOT NULL,
  description TEXT,
  achieved_at TIMESTAMPTZ,
  target_date DATE,
  milestone_type TEXT, -- goal_progress, first_top10, traffic_milestone, custom
  metadata JSONB DEFAULT '{}'
);
```

---

### Phase 3: Self-Service (2 weeks)

**Scope:** Empower clients, reduce agency load

| Week | Deliverables |
|------|--------------|
| 6 | Request queue system |
| 6 | Keyword tracking requests |
| 6 | Content brief requests |
| 7 | Documents center |
| 7 | Calendar integration (Google/Outlook) |
| 7 | Request status notifications |

**Schema:**
```sql
CREATE TABLE portal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  contract_id UUID REFERENCES contracts(id),
  request_type TEXT NOT NULL, -- track_keyword, content_brief, optimize_page, schedule_call
  status TEXT NOT NULL DEFAULT 'submitted', -- submitted, under_review, in_progress, completed, out_of_scope
  title TEXT NOT NULL,
  details JSONB NOT NULL,
  agency_notes TEXT,
  submitted_by UUID REFERENCES portal_users(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE portal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  document_type TEXT NOT NULL, -- report, brief, contract, invoice, strategy
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id)
);

CREATE TABLE portal_calendar_tokens (
  client_id UUID PRIMARY KEY REFERENCES clients(id),
  provider TEXT NOT NULL, -- google, outlook
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  calendar_id TEXT
);
```

---

### Phase 4: Intelligence & Integrations (3 weeks)

**Scope:** Defensible value metrics, real revenue

| Week | Deliverables |
|------|--------------|
| 8 | GA4 OAuth integration |
| 8 | Verified revenue display (if connected) |
| 8 | CPC equivalent calculator (optional) |
| 9 | Slack integration |
| 9 | Anomaly detection (traffic ±30%) |
| 9 | Automated insights (basic) |
| 10 | Team management (invite, roles) |
| 10 | Notification preferences UI |
| 10 | Integration health dashboard |

**Schema:**
```sql
CREATE TABLE portal_ga4_tokens (
  client_id UUID PRIMARY KEY REFERENCES clients(id),
  property_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sync_at TIMESTAMPTZ
);

CREATE TABLE portal_ga4_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  date_range TEXT NOT NULL, -- e.g., '30d'
  organic_revenue DECIMAL(12,2),
  organic_transactions INTEGER,
  organic_conversion_rate DECIMAL(5,4),
  avg_order_value DECIMAL(10,2),
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portal_slack_tokens (
  client_id UUID PRIMARY KEY REFERENCES clients(id),
  workspace_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  bot_user_id TEXT
);

CREATE TABLE portal_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer', -- owner, admin, member, viewer
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  invited_by UUID REFERENCES portal_users(id),
  UNIQUE(client_id, email)
);

CREATE TABLE portal_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  anomaly_type TEXT NOT NULL, -- traffic_drop, traffic_spike, ranking_drop
  severity TEXT NOT NULL, -- info, warning, critical
  metric TEXT NOT NULL,
  previous_value DECIMAL(12,2),
  current_value DECIMAL(12,2),
  change_percent DECIMAL(5,2),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  notes TEXT
);
```

---

### Phase 5: Polish & PWA (2 weeks)

**Scope:** Delight and mobile excellence

| Week | Deliverables |
|------|--------------|
| 11 | PWA setup (manifest, service worker) |
| 11 | Push notifications (mobile) |
| 11 | Add-to-homescreen prompt |
| 12 | Performance optimization (<1s load) |
| 12 | White-label theming (colors, logo) |
| 12 | Shareable win graphics |

---

## Technical Architecture

### Frontend Stack
- Next.js 15 App Router
- React Server Components
- TanStack Query for data fetching
- shadcn/ui + Tailwind CSS (v6 tokens)
- Recharts for visualizations
- next-pwa for PWA features

### Backend Stack
- TanStack Start API routes (open-seo-main)
- Existing portal token authentication
- BullMQ for notification jobs
- Resend for transactional emails

### Data Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    GSC      │────▶│   Pipeline  │────▶│   Cache     │
│    API      │     │   (daily)   │     │   (Redis)   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │◀────│   Portal    │◀────│   API       │
│   Browser   │     │   Frontend  │     │   Routes    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Performance Requirements
| Metric | Target |
|--------|--------|
| Dashboard load | <1 second |
| Keyword table (1000 rows) | <2 seconds (virtualized) |
| Time to Interactive | <3 seconds |
| Lighthouse Performance | >90 |
| First Contentful Paint | <1.5 seconds |

---

## Success Metrics

| Category | Metric | Target |
|----------|--------|--------|
| **Engagement** | Weekly active users | >60% of clients |
| **Engagement** | Avg session duration | >2 minutes |
| **Engagement** | Return rate (weekly) | >50% |
| **Trust** | Support tickets about data | -80% |
| **Trust** | "Where did this number come from" questions | Near zero |
| **Trust** | Contract renewal rate | >85% |
| **Efficiency** | Requests via portal (vs email) | >50% |
| **Efficiency** | Time to answer "how's my SEO" | <30 seconds |
| **Adoption** | GA4 integration rate | >60% |
| **Adoption** | Slack integration rate | >30% |

---

## Timeline Summary

```
Week  1-3:  Trust Foundation      ████████░░░░░░░░░░░░░░░░
Week  4-5:  Progress & Value      ░░░░░░░░████░░░░░░░░░░░░
Week  6-7:  Self-Service          ░░░░░░░░░░░░████░░░░░░░░
Week  8-10: Intelligence          ░░░░░░░░░░░░░░░░██████░░
Week 11-12: Polish & PWA          ░░░░░░░░░░░░░░░░░░░░░░██

Total: 12 weeks
```

---

## The Differentiator

Most agency portals show **data** and hope clients figure out the value.

This portal shows **verified growth**, demonstrates value **honestly**, comes to clients **proactively**, and builds trust by **never making up numbers**.

When a client asks "Is my SEO working?", the answer is on screen in 5 seconds — with every number traceable to Google's own data.

---

## Appendix: Component Library

### V6 Token Reference

```css
/* Typography */
--font-display: 'Newsreader';  /* Titles, large numbers */
--font-sans: 'Geist';          /* Body, UI */
--font-mono: 'Geist Mono';     /* Code, timestamps */

/* Type Scale */
--type-h1:    clamp(30px, 2.4vw, 40px);  /* Page titles */
--type-h2:    clamp(17px, 1.3vw, 18.5px); /* Section titles */
--type-h3:    clamp(15px, 1.1vw, 16px);   /* Card titles */
--type-body:  clamp(14px, 1vw, 14.5px);   /* Body text */
--type-small: clamp(13px, 0.92vw, 13.5px); /* Meta text */
--type-tiny:  12px;                        /* Labels, eyebrows */

/* Number Display */
--num-mega:   clamp(58px, 4.8vw, 80px);   /* Hero numbers */
--num-hero:   clamp(38px, 3.2vw, 46px);   /* Large stats */
--num-card:   clamp(36px, 3vw, 44px);     /* Card numbers */
--num-row:    clamp(20px, 1.7vw, 26px);   /* Table numbers */

/* Colors */
--canvas:       #FAFAF7;
--surface:      #FFFFFF;
--surface-2:    #F8F8F3;
--surface-3:    #F2F1EB;
--text-1:       #14141A;
--text-2:       #54545A;
--text-3:       #93939A;
--text-4:       #C4C3BB;
--accent:       #0F4F3D;
--accent-soft:  #EAF1ED;
--success:      #1B6E45;
--success-soft: #EAF2EE;
--error:        #9B2C2C;
--error-soft:   #F4E6E6;
--warning:      #A87F1A;
--warning-soft: #F4EDDA;

/* Radii */
--radius-input:  6px;
--radius-button: 8px;
--radius-card:   12px;
--radius-modal:  14px;
--radius-pill:   999px;

/* Motion */
--ease-smooth:   cubic-bezier(0.16, 1, 0.3, 1);
--motion-fast:   160ms;
--motion-hover:  280ms;
--motion-reveal: 240ms;

/* Shadows */
--shadow-card: 
  0 0 0 1px rgba(20, 20, 26, 0.045),
  0 1px 2px rgba(20, 20, 26, 0.03),
  inset 0 1px 0 rgba(255, 255, 255, 0.5);

--shadow-lift:
  0 0 0 1px rgba(20, 20, 26, 0.06),
  0 6px 16px -4px rgba(20, 20, 26, 0.06),
  0 16px 40px -16px rgba(20, 20, 26, 0.10),
  inset 0 1px 0 rgba(255, 255, 255, 0.55);
```

### Component Patterns

**Card with Hover Lift:**
```tsx
<div className="bg-surface rounded-card shadow-card hover:shadow-lift hover:-translate-y-px transition-all">
  {/* content */}
</div>
```

**Stat Card:**
```tsx
<div className="bg-surface rounded-card shadow-card p-6">
  <div className="flex items-center gap-2 mb-4">
    <Icon className="w-4 h-4 text-text-3" />
    <span className="text-small font-medium tracking-wide uppercase text-text-2">
      Label
    </span>
  </div>
  <div className="font-display text-num-card text-text-1 tabular-nums">
    8,420
  </div>
  <div className="flex items-center gap-2 mt-3 text-small text-text-3">
    <span className="delta-up">↑ 34%</span>
    <span>vs last month</span>
  </div>
</div>
```

**Delta Badge:**
```tsx
// Positive
<span className="delta-up px-2 py-0.5 rounded text-small font-medium bg-success-soft text-success">
  ↑ +12
</span>

// Negative
<span className="delta-down px-2 py-0.5 rounded text-small font-medium bg-error-soft text-error">
  ↓ -5
</span>

// Neutral
<span className="delta-flat px-2 py-0.5 rounded text-small font-medium bg-surface-2 text-text-3">
  —
</span>
```

**Activity Card:**
```tsx
<div className="flex gap-3 py-3 border-b border-hairline-2 last:border-0">
  <div className="w-6 h-6 rounded-md bg-accent-soft text-accent flex items-center justify-center">
    <ContentIcon className="w-3.5 h-3.5" />
  </div>
  <div className="flex-1 min-w-0">
    <div className="text-body text-text-1">Published: "Coffee Guide 2026"</div>
    <div className="text-small text-text-3 mt-1">2,400 words · 3 target keywords</div>
  </div>
  <div className="text-small text-text-3 font-mono tabular-nums">10:34</div>
</div>
```

---

*Document generated: 2026-05-05*
*Ready for Phase 1 implementation*
