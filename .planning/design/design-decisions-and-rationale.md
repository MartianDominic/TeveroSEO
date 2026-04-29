# Tevero Design Decisions & Rationale

> **Purpose:** This is the narrative companion to `design-system-v6.md`. The system doc says *what* the rules are. This doc says *what we tried, what failed, why it failed, and what we changed.* Read this before making design decisions in the future so we don't repeat the same mistakes.
>
> **Scope:** The full evolution from initial dashboard prototype through v6 (the production-ready design system).
>
> **Audience:** Future Tevero designers, engineers, and AI sessions building UI within this system. If you're about to make a design decision, find the closest prior decision in this doc first.

---

## Table of contents

0. [How to use this document](#0-how-to-use-this-document)
1. [The original problem](#1-the-original-problem)
2. [Iteration timeline (v1 → v6)](#2-iteration-timeline-v1--v6)
3. [Decision log — every major call we made](#3-decision-log--every-major-call-we-made)
4. [The mistakes catalog](#4-the-mistakes-catalog)
5. [The "AI look" diagnostic](#5-the-ai-look-diagnostic)
6. [Meta-principles that emerged](#6-meta-principles-that-emerged)
7. [Anti-patterns — never do these](#7-anti-patterns--never-do-these)
8. [Pre-flight checklist (BEFORE you start designing)](#8-pre-flight-checklist-before-you-start-designing)
9. [Lessons for future AI sessions](#9-lessons-for-future-ai-sessions)
10. [What's still unsolved / open questions](#10-whats-still-unsolved--open-questions)

---

## 0. How to use this document

Three reading modes:

**Mode 1 — Before you build a new page.** Read §1 (the problem), §6 (meta-principles), §7 (anti-patterns), §8 (pre-flight checklist). Skip the iteration timeline. ~10 minutes.

**Mode 2 — When something feels "off" but you can't articulate why.** Read §5 (AI look diagnostic) and §4 (mistakes catalog). Find the symptom; the doc names the disease. ~5 minutes.

**Mode 3 — Deep onboarding (new contributor / new AI session).** Read top to bottom. ~45 minutes. You'll come out understanding not just the rules but the *taste* behind them.

---

## 1. The original problem

### 1.1 What the user asked for

The user wanted to redesign the TeveroSEO platform UI to feel "world-class / SOTD" — Linear × Superhuman × Stripe register, "iterated for 20 years, millions spent on it," "polished by in-house designers," "$100M software." Specifically not:

- Generic SaaS / Tailwind defaults
- The "AI look" (a cluster of visual tells, see §5)
- Stock dashboard patterns

The specific business context:
- B2B platform for SEO agencies managing clients
- Per-client view needs to communicate goal attainment (the contractual deliverable)
- Multi-tenant; agency operators see many clients per day
- Information density matters — operators stay in the app for hours
- Audience: technical, taste-driven SEO professionals (not consumers)

### 1.2 The product north star

The contract Tevero sells is roughly:
> "Land N of M tracked keywords on page 1 by date D"

Every page in the per-client view must answer the user's most-frequent question:
> "Are we delivering on this?"

This north star drove a key architectural decision (see §3.2): *one editorial moment per page* — a single big-serif numeral that *is* the answer. Everything else is supporting evidence.

### 1.3 The aesthetic targets (named references)

The user named four references:

| Reference | What we took from it |
|---|---|
| **Stripe** | Generous white space, white cards on warm canvas, hairline borders that almost vanish, bold serif numerals, single chromatic accent |
| **Linear** | Tight type rhythm, mono labels, density only where data is, hover-to-reveal interactions, kbd shortcut hints inline, calm at rest |
| **Superhuman** | Single-purpose pages, each section = one job, no competing CTAs, speed-via-layout |
| **Locomotive (SOTD)** | One moment of editorial drama, fluid scaling, smooth premium transitions, hidden depth (hover to reveal), magazine-rhythm white space |

If a design decision can't be defended in terms of one of these references, it's almost certainly wrong.

---

## 2. Iteration timeline (v1 → v6)

We went through six named iterations. Each version solved a specific class of failure exposed by the previous. The user's reactions are quoted verbatim where available.

### 2.1 v1 — `dashboard-v1.html`

**Built:** Initial three-column shell (sidebar 240 / main / rail 340) for an agency-level dashboard. Used Fraunces serif for page title and stat numerals. KPI strip with 4 cards. Big distribution chart card with hatched bars and big floating numbers. Right rail with health gauge, top opportunities, recent activity.

**What worked:**
- Three-column shell felt "premium dashboard"
- Big serif numerals on KPIs
- Big chart with floating serif numbers above bars
- Generous white space
- Right rail content (health + opportunities + activity)

**What didn't:**
- Generic SEO metrics, not per-client goal-attainment
- No "editorial moment" — every element competed equally for attention
- Fraunces was "too overused" / "too luxury fashion" (per user pushback)

**Decision:** Keep the shell. Replace the content layer with per-client / goal-attainment focus.

---

### 2.2 v2 — `client-hub-v1.html`, `client-hub-v2.html`

**Built:** Per-client dashboard with the centerpiece goal hero. Editorial sentence ("Land 20 of 200 tracked keywords on page 1 by July 31, 2026"). Mega numeral 56px (12 / 20). Hatched progress bar. Trajectory chart with required-pace dashed line + p10/p50/p90 confidence band + NOW marker + target marker. Velocity rows. Sub-goals strip. KPI quartet. Distribution chart. Keyword table with movers/opportunities/at-risk tabs. Forecast & diagnostics 3-col card-on-card (envelope + stuck/falling + quick wins). Pipeline strip. Ops strip.

**What worked:**
- The goal hero composition: editorial sentence anchor + mega numeral + chart
- The forecast/diagnostics three-column block with stuck/falling/quick-wins
- The "Quick wins" call-out box at the end ("If 3 of these land, ETA pulls forward")
- The intent badges, KD pills, sparklines

**User reaction:** "much closer" (referencing image 13, the per-client v1).

**What didn't:**
- Cap at 1320px max-width — content floated marooned on wide monitors
- Single-column main flow without breathing
- Cards used hard 1px borders — flat, no dimension
- Tinted goal hero card felt "feature box" — templated

**Decision:** Lift the cap. Add full-bleed shell. Keep tinted goal hero (we'd kill it in v4).

---

### 2.3 v3 — `client-hub-v3.html` ("AI-y density")

**Built:** Full-bleed shell `260px sidebar | minmax(0,1fr) main | 360px rail` with no max-width cap. Persistent global right rail with "Today" event feed (timestamp + body + semantic-colored tag). Subtle dot grain background (`radial-gradient` at 18px pitch, 1.8% opacity). Frosted-glass sticky utility bar. Container queries on cards. KPI cards with sparklines visible at rest. Hatched-fill progress bar. Trajectory chart with Apr 14/22 callout annotations.

**Built rationale at the time:**
- Dot grain = "Locomotive SOTD micro-tell that's invisible until you remove it"
- Persistent rail = "Linear/Superhuman live-awareness pattern"
- Sparklines visible = "data density, premium dashboard signal"
- Annotations on chart = "editorial commentary"

**User reaction:** "*it looks Ai-y, I need that incredible smoothness but popping*" / "*proper white space, properly sized elements, hover to reveal more*" / "*everything grouped beautifully together, there must be dimension to the site, all the borders must look oh wow*" / "*dashboard v1 was the closest so far*."

**The diagnosis (this is the key learning):**

Every decision we'd made *individually* could be justified, but the *aggregate* read as "AI-generated:"

| Decision | Why it failed |
|---|---|
| Tinted cream goal hero | Reads as "feature box" — looks like a designer mocked up a special panel |
| Dot grain background | Tries hard to feel "designed," ends up looking like a default Tailwind plugin |
| Hard 1px borders on every card | Flat, no dimension — every card has the same edge weight |
| Sparklines visible at rest on KPIs | Density without purpose; eye doesn't know what to focus on |
| Sub-goals always visible in hero | Forces the eye to compete with the mega numeral |
| Trajectory chart annotations | Cluttered an editorial moment with secondary info |
| Hatched fills everywhere (bars + progress + ...) | Signature became noise |
| Pulsing live indicator dots | Animation gimmick, screamed "designer wanted to feel alive" |
| Multiple visual elements (eyebrows, dots, separators, badges) competing | Each individually justifiable, together cacophonous |

**The systemic insight:** *Density and detail aren't the problem. Density without composition is the problem.* v3 had the right vocabulary but the wrong syntax.

---

### 2.4 v4 — `client-hub-v4.html` ("Calm but squished")

**Built:** Killed the dot grain. Goal hero became white (not tinted). Replaced solid borders with **layered ghost-edge shadows** (the breakthrough decision — see §3.5). KPI sparklines hidden at rest, fade in on hover with `translateX(4px)` reveal. KPI menu (`⋯`) hidden at rest. Bigger numerals: KPI 48px, mega 84px. Section gap bumped from 24px to `clamp(36px, 3.6vw, 52px)`. Content padding `clamp(28px, 3.2vw, 56px)`. Cards lift `translateY(-1px)` on hover with shadow expansion via `cubic-bezier(0.16, 1, 0.3, 1)` 280ms. Container queries baked in. Subtle radial atmospheric gradient on goal hero (replacing the solid tint).

**What worked:**
- Ghost-edge shadows immediately gave cards "dimension" — they read as glass panels, not paper
- Hover lift + shadow expansion = the "ethereal" quality the user wanted
- Hover-to-reveal made the resting state calm
- White goal hero replaced the templated feel
- Bigger numerals had visual presence
- The atmospheric radial gradient (2.5% accent at top-right + 1.5% warning at bottom-left) gave depth without tinting

**User reaction:** "*YES, this is much much closer, just some fonts and numbers are weird squished*"

**What didn't:**
- Goal hero progress numerals (`12 / 20` / `60%`) were unbalanced — `12` carried 100% visual weight, `/ 20` orphaned at 50px, `60%` floated disconnected far right
- Falling-row arrow indicators (`12 ↓`) — the standalone Unicode arrow at 14px next to a 22px serif numeral read frail
- Pipeline cells were boxy — big serif numbers floating with small label above and tiny meta below, no relative scale
- Trajectory chart legend cramped at top-right of chart area
- Envelope visualization `TARGET` label could collide with `p50` label at certain widths
- Sub-goals had 4px vertical padding — too tight

**Decision:** Fix each squished spot surgically. Don't rebuild from scratch.

---

### 2.5 v5 — `client-hub-v5.html` ("Composition fixed, fluid system locked")

**Built (the precision pass):**

**Progress block redesign** — see §3.10 for the full reasoning:
- `12 / 20` paired tight on left (mega 80px / divider 50px text-4 / target 50px text-3)
- Status pill + ETA + "13 days ahead" stacked on right of same row
- Bar below
- Detail row at bottom: `60% to goal · 8 to land · +3 last 7d · +12 last 30d`

**Falling rows** — dropped standalone `↓` arrow:
- Position number stays
- `from-to` chip pattern: `13 from 9` instead of `13 ↓`
- Section header "FALLING (LOST TOP 10, < 14d)" carries direction
- Optional `.pos.falling` red color tint

**Pipeline strip** — added relative-volume bars:
- Each stage: label + count (Newsreader serif) + 3px volume bar showing relative %
- "Published" stage (47% of total) gets subtle accent gradient + accent fill bar
- Visual at-a-glance scale without being a chart

**Audit findings** — added severity dots:
- `Tier 1: ●●●` (3 critical), `Tier 2: ●●●●●` (5 warning), etc.
- Color matches tier semantic
- 5 dots max per cell — beyond that, switch to numeric

**Trajectory legend** moved below chart (was top-right cramped). Quiet `85% conf.` italic next to band swatch.

**Envelope vis** — triangle pointer above bar for `TARGET` (no collision with `p50`).

**Sub-goals** — bumped row padding to 12px vertical.

**Fully fluid system** — every spacing token now `clamp()`. Sidebar `clamp(232px, 16vw, 272px)`, rail `clamp(320px, 22vw, 380px)`.

**Container queries** on `.goal-hero` and `.kpi`.

**Compact-height mode** `@media (max-height: 780px)` — shorter utility bar (44px), tighter section gaps, slightly smaller hero numeral. Targets 13" laptops with browser chrome.

**User reaction:** "*the texts are too small - can you increase them to be accessible properly minimum 12px but ideally more*"

**What didn't:**
- The system favored editorial density (10–11px small caps tags, 13px body, 10.5px eyebrows) — defensible aesthetically, but sub-WCAG.
- Tags at 10px (`RANKING · GAIN`) failed accessibility
- Body at 13px below industry-standard 14–15px
- User reported difficulty reading on a 13" MacBook Air

**Decision:** Reset the type scale to 12px floor + 14px body without losing the editorial register.

---

### 2.6 v6 — `client-hub-v6.html` ("Accessibility-first type ramp") — current

**Built (the accessibility pass):** Every visible text bumped to ≥12px. Body bumped 13→14px. Captions/meta 11→13px. Eyebrows 10.5→12px. Tags 10→12px. Plus formalized line-height system (1.55 body / 1.4 h3 / 1.3 h2 / 1.05 h1 / 0.95 mega) and letter-spacing system (negative -0.024 to -0.034 on display numerals; positive +0.04 to +0.1 on uppercase/small-caps).

**Why this didn't break the editorial register:** Small caps glyphs at 12px optically read smaller than regular 12px due to lower x-height. So a 12px small-caps tag still feels like a "tiny capsule chip" while being readable. The look-and-feel stayed; only the legibility floor moved.

**Critical sed-pass details for reproducibility:**

```bash
# Run in reverse-size order to avoid chains
sed -i 's/font-size: 13\.5px/font-size: 14.5px/g' file
sed -i 's/font-size: 13px/font-size: 14px/g' file
sed -i 's/font-size: 12\.5px/font-size: 13.5px/g' file
sed -i 's/font-size: 12px/font-size: 13px/g' file
sed -i 's/font-size: 11\.5px/font-size: 13px/g' file
sed -i 's/font-size: 11px/font-size: 12.5px/g' file
sed -i 's/font-size: 10\.5px/font-size: 12px/g' file
sed -i 's/font-size: 10px/font-size: 12px/g' file
sed -i 's/font-size: 9px/font-size: 12px/g' file
```

**User reaction:** Implicit acceptance — they then asked for the consolidated documentation (this doc and the system doc).

---

## 3. Decision log — every major call we made

For each decision: **what** was decided, **why**, **alternatives considered**, **when to reconsider**.

### 3.1 The locked free-only typographic triad

**Decision:** `Newsreader` (display serif) + `Geist` (UI sans) + `Geist Mono` (data mono). All free, all on Google Fonts.

**Why Newsreader specifically:**
- Variable optical sizing (opsz 6–72) — same font carries display headlines AND body italics
- True italic glyphs (not slanted regular)
- True OpenType small caps via `font-variant-caps: all-small-caps`
- OpenType figure features (lining-tabular AND old-style-proportional)
- Journalistic register (Bloomberg / Economist / FT) without paid licensing

**Alternatives we considered and rejected:**

| Font | Why rejected |
|---|---|
| Tiempos Headline | Paid (~$$). User constraint: free only. |
| Fraunces | Overused in 2024-25 design Twitter. User pushed back: "Fraunces felt too luxury fashion." |
| GT Sectra Display | Wrong register (luxury fashion, not editorial) |
| Crimson Pro | Too book-like, lacks editorial sharpness |
| Cormorant / Playfair | Wrong vibe (wedding invites, not finance journalism) |
| Source Serif | Adobe-default feel |
| Lora | Generic Google-fonts look |
| Inter | The #1 "AI look" tell — see §5 |
| SF Pro / system stack | Default everywhere, no register |

**When to reconsider:** Only if a free serif emerges with better OpenType figure support AND truly journalistic editorial weight. Don't switch to Tiempos unless the user explicitly approves paid licensing.

### 3.2 The single-editorial-moment principle

**Decision:** Each page has exactly *one* big-serif numeral that is "the answer." Everything else is supporting cast.

**Why:**
- Cognitive: the user came for an answer. Give it visual weight commensurate with importance.
- Compositional: hero numerals only work if surrounded by 2× their visual weight in white space. Two heroes = neither is heroic.
- Editorial: magazine pages have one feature per spread. SOTD sites have one moment of drama per scroll.

**On the per-client overview:** the `12 / 20` mega numeral is the editorial moment.
**On a stats page:** the biggest KPI numeral.
**On a detail page:** the primary metric for that detail.

**Alternatives considered:**
- Multiple equal-weight numerals (rejected — v1 felt "agency dashboard generic")
- All-numerals-the-same-size with hierarchy via labels (rejected — fails fast-scan)

**When to reconsider:** Only on dashboards where there's literally no primary metric (very rare; usually means the dashboard is wrong, not the rule).

### 3.3 The three-column shell with full-bleed main

**Decision:** `grid-template-columns: clamp(232px, 16vw, 272px) minmax(0, 1fr) clamp(320px, 22vw, 380px)`. Sidebar and rail sticky-100vh. No max-width on main column.

**Why:**
- Sidebar (260px): nav + client switcher + user, fits 8–10 nav items comfortably
- Main (1fr): content. No max-width because Stripe-style: full edge-to-edge with generous padding handles legibility, and on 27" monitors capping at 1320px floats the content marooned in the middle.
- Rail (360px): persistent live awareness — Today feed, health, up next, activity. Linear/Superhuman tell.

**Alternatives considered:**
- Two-column shell (sidebar + main only) — rejected. Loses the live-awareness moment that makes the platform feel alive.
- Max-width 1320px on main — rejected (v2). On wide monitors, content marooned.
- Fixed-pixel sidebar/rail — rejected. Doesn't feel premium on 4K monitors.

**When to reconsider:** If we ship a mobile / iPad version, the rail might collapse to a drawer. Already handled at `< 1180px` breakpoint.

### 3.4 The warm canvas + white cards palette

**Decision:** Canvas `#FAFAF7` (slight warm cream). Cards `#FFFFFF` (pure white). No tinted cards as primary content. One accent (emerald `#0F4F3D`).

**Why warm cream canvas:**
- Pure `#FFFFFF` body looks clinical / generic SaaS
- Slight warm cream gives the page a "paper" quality
- White cards float visually against the warm canvas — the contrast itself creates dimension
- Stripe uses this exact palette family for the same reason

**Why no tinted cards:**
- v3 had a cream goal hero — read as "feature box" / templated
- Tinted backgrounds for content panels = AI-look (see §5)
- Cream is a canvas color, not a content color

**Why one accent:**
- Two accents = tension without resolution
- The accent (emerald) is reserved for the contract / goal / primary CTA
- Semantic states (success/error/warning/info) use their own palettes but only at 12% / 18% opacity tints (the `*-soft` colors)

**Alternatives considered:**
- Pure white canvas — rejected, too clinical
- Multiple chromatic accents (e.g., teal + orange) — rejected, multiple themes
- Dark mode by default — deferred to a future iteration

**When to reconsider:** Dark theme rollout (post-Phase 44). Will use a different canvas/surface ladder.

### 3.5 Ghost-edge shadows replace solid borders (the v4 breakthrough)

**Decision:** Cards use layered box-shadow instead of `border: 1px solid`. The composition:

```
At rest:
  0 0 0 1px rgba(20, 20, 26, 0.045)         ← outer ghost stroke (replaces border)
  0 1px 2px rgba(20, 20, 26, 0.03)           ← depth shadow (subtle drop)
  inset 0 1px 0 rgba(255, 255, 255, 0.5)     ← inner top highlight (the magic)
```

**Why this matters (the "oh wow" borders the user demanded):**
- Solid borders are flat. No light interaction. Card and canvas read as the same plane.
- The outer 0.045-alpha stroke is *almost* invisible — gives the edge weight without screaming "border."
- The 1px drop shadow at 0.03 alpha adds barely-perceptible elevation — card sits 1mm above canvas.
- The **inner top highlight** at 50% white is the breakthrough: it simulates light from above hitting the top edge of the card. Glass-like. This is what makes cards feel "tactile."

**On hover:**
```
0 0 0 1px rgba(20, 20, 26, 0.06)            ← edge sharpens slightly
0 6px 16px -4px rgba(20, 20, 26, 0.06)      ← lifted ground shadow
0 16px 40px -16px rgba(20, 20, 26, 0.10)    ← atmospheric drop (long, soft)
inset 0 1px 0 rgba(255, 255, 255, 0.55)     ← top highlight slightly brighter
```

Plus `transform: translateY(-1px)`. The card physically rises 1px while the shadow grows. This is the "ethereal" interaction the user described.

**Alternatives considered:**
- Solid 1px border on cards — rejected (v3 used this; flat).
- Heavy drop shadows like Material Design — rejected (looks dated, Android).
- `filter: drop-shadow` — rejected (poor performance, no inset highlight possible).
- Glow halos on hover — rejected (cheap; Bootstrap admin theme energy).

**When to reconsider:** Only if browser support for layered box-shadows changes (it won't — this is universal CSS).

### 3.6 Hover-to-reveal as the core interaction grammar

**Decision:** Anything secondary — sparklines on KPIs, action menus (`⋯`), `→` arrows on table rows, kbd hints in nav — is hidden at rest and fades in on hover.

**Why:**
- Calm at rest = the page-load impression is "sparse and confident"
- Reveal-on-hover = depth that the user discovers (Linear/Superhuman tell)
- Cognitive: resting page focuses the eye on the hero numeral; hover provides instrumentation
- Performance: less DOM-painted = faster perceived load

**Implementation pattern:**

```css
.kpi .spark-wrap {
  opacity: 0;
  transform: translateX(4px);
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
              transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.kpi:hover .spark-wrap {
  opacity: 1;
  transform: translateX(0);
}
```

Always pair opacity with a tiny translation (4–6px). Pure opacity fade-in feels "spec'd by accountant." The tiny slide is what makes it feel "designed."

**Alternatives considered:**
- Always-visible everything — rejected (v3 cluttered, AI-y)
- Click-to-toggle — rejected (extra interaction step, breaks scanning)
- Right-click for menu — rejected (hidden affordance, user can't discover)

**When to reconsider:** If accessibility audit requires `prefers-reduced-motion` users to see all data without hover. Already partially handled — `prefers-reduced-motion: reduce` short-circuits the transitions, but elements still appear only on hover. We may need a "show all secondary" preference.

### 3.7 The dual-figure typographic system (the typographic signature)

**Decision:** Two figure styles, never mixed in the same context:

| Style | Where | Why |
|---|---|---|
| `tabular-nums lining-nums` | Tables, charts, KPI numerals, timestamps, percentages, deltas | Aligned columns, all-caps height, scans as data |
| `oldstyle-nums proportional-nums` | Body prose ("Apr 1 by Marcus L.", "set 14 minutes ago") | Sits with lowercase letters, reads as text |

`body { font-variant-numeric: oldstyle-nums proportional-nums; }` — default for prose.
Override on data: `font-variant-numeric: tabular-nums lining-nums;`.

**Why:**
- This is the typographic signature that distinguishes us from generic SaaS
- 99% of dashboards use only lining figures everywhere — even in prose. Numbers stand out as "data dropped into the sentence." Reading "set Apr 1" feels like a system message.
- Old-style figures in prose let numbers blend with lowercase letters. Reading "set Apr 1 by Marcus" feels like a sentence written by a human.
- Tabular numerals in data give Bloomberg-grade column alignment.

**Alternatives considered:**
- Only lining figures everywhere — rejected (the AI-look default).
- Custom font-feature-settings only — rejected (less semantic, harder to audit).

**When to reconsider:** Never. This is a signature decision.

### 3.8 Italic emphasis is semantic, not decorative

**Decision:** Italic is reserved for specific roles, never for visual variety:

- Proper nouns inside data context: `set Apr 1 by *Marcus L.*`
- Dates inline with prose: `*July 18, 2026*`
- URL paths: `*/blog/best-running-shoes*`
- Goal sentence anchors: `Land *20 of 200* keywords on *page 1*`
- Confidence ranges: `between *July 6* and *August 14*`

**Why:**
- Italic is a typographic spotlight. Used everywhere = means nothing.
- Used for specific semantic roles = the eye learns to recognize the role.
- Newsreader's true italic glyphs are gorgeous — wasted if used for decoration.

**The cognitive payoff:** When the user sees an italic word in our system, they instantly know it's a specific entity (a person, a date, a path). It becomes a hyperlink-like affordance without underlines.

### 3.9 Small caps via `font-variant-caps`, never `text-transform: uppercase`

**Decision:** All "tiny uppercase labels" in the system use `font-variant-caps: all-small-caps`. Never `text-transform: uppercase` for small text.

**Why:**
- Small caps are real OpenType glyphs, designed at the right x-height
- `text-transform: uppercase` just scales lowercase letters → kerning is unbalanced, tracking wrong
- The difference is invisible at first glance and obvious after looking at both for 5 seconds

**Where:**
- `.t-smallcaps` class
- Status pills ("ON TRACK")
- Effort/impact pills ("LOW EFFORT", "HIGH IMPACT")
- Today-feed tags ("RANKING · GAIN")
- Section eyebrows on diagnostic columns
- Sub-goal tags ("ON PACE", "AT RISK")

**Where uppercase is OK:** Page-level eyebrows above the main title (rare, large enough that text-transform doesn't matter). Even there we use `font-variant-caps` if Newsreader is the family.

### 3.10 The progress block redesign (the v5 composition fix)

**Decision:** The goal hero progress block has a specific composition with three rows:

```
┌─ Row 1: Numbers + status ──────────────────────────┐
│  12 / 20                          ● ON TRACK       │
│  mega smaller smaller             ETA Jul 18       │
│                                   13 days ahead    │
├─────────────────────────────────────────────────────┤
│  ████████████████████████████░░░░░░░░░░░  ▼target  │  ← Row 2: Bar
├─────────────────────────────────────────────────────┤
│  60% to goal · 8 to land · +3 last 7d · +12 last 30d  ← Row 3: Detail
└─────────────────────────────────────────────────────┘
```

**Critical proportions (every pixel justifiable):**
- `12` (now): `clamp(58px, 4.8vw, 80px)` Newsreader 400, letter-spacing -0.034em, color text-1
- `/` (divider): `clamp(38px, 3.2vw, 52px)` Newsreader 300, letter-spacing -0.024em, color **text-4** (whisper)
- `20` (target): `clamp(38px, 3.2vw, 52px)` Newsreader 400, color **text-3** (muted)
- Gap between numbers: 8px — tight, reads as `12/20` unit
- Status block right-aligned, padding-top 4px to align baselines

**Why this works:**
- The `12` carries 100% visual weight as the answer
- `/ 20` is supportive, smaller, muted — reads as "out of"
- Status pill + ETA on the right balances composition without competing
- Progress bar lives below as the visual proof
- Detail row at bottom with `60% to goal` first reads left-to-right as story

**v4 mistake we fixed:** The 60% pct floated awkwardly to the right at 22px italic Newsreader. Disconnected from anything. Removed; merged into detail row.

**Alternatives considered:**
- All numbers same size — rejected, no hierarchy
- 60% as the mega numeral instead of 12 — rejected, "60%" isn't the answer; "12 of 20" is
- Vertical layout (numbers above, status below, bar below) — rejected, wastes horizontal space, breaks asymmetric rhythm with the chart

### 3.11 Falling rows: drop standalone arrow indicators

**Decision:** Falling-keyword rows show position number only (with optional red color tint). No standalone `↓` arrow next to the numeral.

**Why:**
- Standalone Unicode arrow (`12 ↓`) at 14px next to a 22px serif numeral reads frail and orphaned.
- The arrow tries to convey direction but adds visual noise.
- The section header ("FALLING — LOST TOP 10, < 14d") already conveys direction.
- The `was 8 · now 12` meta line conveys direction.
- Color (red) conveys direction.
- Three signals of direction = arrow is redundant.

**Replacement pattern for "where it came from":**
```html
<div class="pos falling">12<span class="from-to">from 8</span></div>
```
Small "from 8" chip in mono next to the position. Quieter than an arrow, more informative.

**Lesson:** When you find yourself adding a standalone Unicode arrow as a "small indicator," pause. The arrow probably reads weak. Find a way to say it with type, color, or context instead.

### 3.12 Pipeline strip: relative-volume bars under counts

**Decision:** Pipeline stages each show: small-caps label + Newsreader serif count + 3px relative-volume bar.

**Why:**
- Big serif numbers in boxy cells with just labels above and tiny meta below feel disconnected (v4 mistake).
- The 3px bar shows what % of total this stage represents.
- "Published" cell (47% of total) gets accent gradient + accent fill bar — highlights the success state.
- Visual at-a-glance scale, not just data.

**Alternatives considered:**
- Funnel arrows between cells (`Idea → Outline → Draft → Review → Published`) — rejected, looks like Salesforce
- Sparklines under each cell — rejected, too detailed for a status strip
- Pure data table — rejected, boring

### 3.13 Audit findings: severity dots

**Decision:** Tier cells show a count of severity dots (`●●●` for tier 1 critical = 3 critical issues).

**Why:**
- "Tier 1: 3 critical" as just text feels like a label
- Three colored dots feels like a signal
- Glanceable: more dots = more severe = more attention
- Capped at 5 dots — beyond that, switch to numeric

**Compositional advantage:** Now each tier has three visual signals: label (small caps) + count (serif numeral) + dots (visual scale) + meta (text). Multiple registers in one small cell, each reinforcing the data.

### 3.14 Container queries (the responsive breakthrough)

**Decision:** Card-internal grids use container queries. Viewport media queries are reserved for app-shell breakpoints only.

**Why:**
- v3 had a 2-col grid inside the goal hero that stacked at viewport `< 1100px`. But when the rail is hidden (viewport `< 1180px`), the goal hero itself is wider, so the grid SHOULDN'T stack yet.
- Viewport-based responsiveness fails when the same component appears in different layouts (full-width card vs half-width card in a strip).
- Container queries solve this: the card responds to its *own* width.

**Pattern:**
```css
.goal-hero {
  container-type: inline-size;
  container-name: hero;
}
@container hero (max-width: 880px) {
  .gh-grid { grid-template-columns: 1fr; }
}
```

**When to use viewport media queries:** Only for the app shell itself (sidebar/rail show/hide breakpoints).

**When to use container queries:** Card internals, KPI grid layout, distribution chart bar widths, forecast 3-col grid.

### 3.15 Compact-height mode for 13" laptops

**Decision:** `@media (max-height: 780px)` overrides spacing tokens to be tighter, utility bar shorter (44px), hero numeral slightly smaller.

**Why:**
- 13" MacBook Air with browser chrome (tabs + bookmarks bar + URL bar) leaves ~700–780px effective viewport height.
- Default sticky bar height (56px) + page padding (52px top + 72px bottom) eats too much vertical real estate.
- Without this override, the goal hero pushes the KPI strip below the fold on 13" screens.

**The triggers and overrides:**
```css
@media (max-height: 780px) {
  --space-7: clamp(20px, 2vw, 30px);
  --space-8: clamp(24px, 2.4vw, 36px);
  --space-9: clamp(32px, 3vw, 48px);
  --shell-utility-h: 44px;
  --num-mega: clamp(52px, 4.2vw, 68px);
}
```

**Lesson:** Always test at `max-height: 720–800px` in addition to width breakpoints. Browser chrome eats height, not width.

### 3.16 The 12px floor (v6 accessibility-first ramp)

**Decision:** No visible text below 12px, ever. Body 14px. Captions 13px. Eyebrows/tags 12px (with small caps for the editorial register).

**Why:**
- WCAG 2.1 doesn't specify a hard pixel minimum but accessibility audits flag below-12px text as failing legibility for many users
- Industry benchmarks: Stripe / Linear / Vercel / GitHub / Figma all use 14px body
- 13px body (v5) felt slightly cramped, especially on Retina displays where the OS may downscale
- 10–11px tags (v5) were unreadable on 13" MacBook Airs at default scaling
- A premium product UI is calibrated to be legible without zoom

**Why we don't go higher (e.g., 16px body):**
- Tevero is a data-dense agency tool; operators stay in it for hours
- 16px body would push the dashboard toward "consumer SaaS" register
- 14px body is the sweet spot: legible without zoom, dense enough for instrument-panel feel

**The size→role mapping is the source of truth.** See `design-system-v6.md` §2.3 table.

**Letter-spacing rule:** Larger text = tighter tracking. Smaller text = looser tracking. Uppercase always +0.06em or more.

**Line-height rule:** Body ≥ 1.5x (WCAG). Headings 1.05–1.4 (tighter as size grows). Display numerals 0.95–1.0 (optical compression).

### 3.17 Motion: two easing curves, three durations

**Decision:**
- `--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1)` for shadows, transforms (premium ease-out)
- `--ease-quick: cubic-bezier(0.4, 0, 0.2, 1)` for color/background shifts (Material curve)
- `--motion-fast: 160ms` (color/bg)
- `--motion-hover: 280ms` (cards lifting, shadow expansion)
- `--motion-reveal: 240ms` (fades-in)

**Why these specific values:**
- `cubic-bezier(0.16, 1, 0.3, 1)` is the Locomotive / SOTD signature ease — it starts fast and lands gently, feels "premium"
- 280ms is long enough to feel intentional, short enough to feel responsive
- Anything < 160ms feels twitchy
- Anything > 320ms feels sluggish

**Hard rules:**
- Never `linear` easing
- Never `transition: all`
- Never animate `width` or `height` of cards (only `transform` and `box-shadow`)
- Never use `transform: scale()` on hover (cheap-feeling). Use `translateY(-1px)`.
- Never animate longer than 320ms.

### 3.18 The "Today" rail feed (Linear/Superhuman tell)

**Decision:** Persistent right rail with a Today feed of timestamped events. Each event: mono timestamp (12px) + body text (13.5px) + semantic-colored tag in small caps.

**Why:**
- This is the live-awareness moment that makes the platform feel like a real product
- Mono timestamps = data-feeling, glanceable
- Semantic-colored tags (Ranking · gain, Audit · attention) = at-a-glance categorization
- Day dividers ("Yesterday") with hairline trail = chronological grouping

**Limit:** 4–6 events shown, then "All" link. Beyond that, becomes a wall of text.

**Lesson:** The rail is the only place we celebrate "what's happening." The main column is for "what is." Don't put live updates in the main flow.

---

## 4. The mistakes catalog

Every mistake we made, what was wrong, what we changed. Use this as a checklist when reviewing future designs.

| # | Mistake | Why it was wrong | What we changed |
|---|---|---|---|
| 1 | Cap main column at `max-width: 1320px` | On 4K monitors, content floats marooned in middle of viewport with vast empty margins | Removed cap. Use `minmax(0, 1fr)` and let `clamp()`-based padding handle legibility |
| 2 | Tinted cream goal hero card | Reads as "feature box" / templated panel | White card on canvas + subtle radial atmospheric gradient (2.5% accent at top-right) for warmth without tint |
| 3 | Dot grain background | Tries hard to feel "designed," ends up looking like default Tailwind plugin | Plain canvas. The system isn't trying to feel designed; it IS designed. |
| 4 | Hard `border: 1px solid` on cards | Flat, no dimension. Every card has same edge weight. | Layered ghost-edge box-shadow + inner top highlight + hover lift + shadow expansion |
| 5 | Sparklines visible at rest on KPIs | Density without composition; eye doesn't know what to focus on | Hidden at rest, fade in on hover with `translateX(4px)` slide |
| 6 | Sub-goals always visible in goal hero | Forces eye to compete with mega numeral | Quieter bottom strip with hairline divider above, smaller text, semantic icons |
| 7 | Trajectory chart annotations (Apr 14 audit, Apr 22 pillar) | Cluttered the editorial moment | Removed. Kept only NOW marker + endpoints + target. |
| 8 | Hatched fills everywhere | Signature became noise | Reserved hatching for distribution bars (signature placement) and progress fill. Removed from elsewhere. |
| 9 | Pulsing live indicator dot | Animation gimmick, feels designer-want | Static colored dot with soft halo (success-soft 3px shadow) |
| 10 | Standalone Unicode arrows (`12 ↓`) | Reads frail next to large numerals | Use color, section context, or `from-to` chip pattern (`12 from 8`) |
| 11 | Goal hero progress block: `60%` floating right | Disconnected from numbers, orphaned | Integrated into the detail row: `60% to goal · 8 to land · +3 last 7d · +12 last 30d` |
| 12 | Pipeline cells: just label + serif number + tiny meta | Boxy, no relative scale | Added 3px volume bar showing relative %. "Published" stage gets accent gradient + accent fill. |
| 13 | Audit findings: just numeric counts | Lacks at-a-glance scale | Added severity dots (`●●●` for tier 1 = 3 critical). 5 dots max, then numeric. |
| 14 | Trajectory legend at top-right of chart | Cramped, competes with title | Moved below chart. Smaller. Quiet `85% conf.` italic next to band swatch. |
| 15 | Envelope vis: `TARGET` vertical line + label above | Could collide with `p50` label at certain widths | Triangle pointer above bar + label below |
| 16 | 10–11px small caps tags | Failed accessibility (sub-WCAG) | All tags ≥ 12px small caps. Optically still feel "tiny capsule chips" due to small caps lower x-height. |
| 17 | 13px body text | Below industry standard (Stripe/Linear/Vercel use 14–15px) | Body 14px (`clamp(14px, 1vw, 14.5px)`) |
| 18 | 10.5px eyebrows | Sub-WCAG, hard to read on 13" laptops | All eyebrows 12px |
| 19 | Inter / system stack font | Generic, the AI-look tell | Geist + Newsreader + Geist Mono triad |
| 20 | Tailwind slate text ramp | Too cool, generic | Warmth-shifted ramp (#54545A vs slate-600) |
| 21 | Universal `line-height: 1.5` | Body leading on numerals = looks loose | 0.95 on numerals, 1.05 on h1, 1.4 on h3, 1.55 on body |
| 22 | `text-transform: uppercase` on small text | Kerning unbalanced | `font-variant-caps: all-small-caps` (real OpenType glyphs) |
| 23 | Multiple chromatic accents | Theme-confused | One accent (emerald). Semantic states use *-soft tints only. |
| 24 | KPI menu (`⋯`) visible at rest | Visual noise | Hidden at rest, fades in on KPI hover |
| 25 | Active tab as `border-bottom` swap | Jumpy on click | Sliding underline via `::after` over parent's bottom hairline |
| 26 | Heavy zebra-striped table rows | Distracting at rest | Subtle `surface-2` background only on hover |
| 27 | Generic priority highlight (full-row tinted bg) | Reads as "selected," not "priority" | 2px accent left bar + slight bg shift |
| 28 | Animation > 320ms | Feels sluggish | All transitions 160–280ms |
| 29 | `transform: scale()` on card hover | Cheap-feeling | `translateY(-1px)` + shadow expansion |
| 30 | Linear easing on transitions | Mechanical, robot | Always cubic-bezier (smooth or quick) |
| 31 | `transition: all` | Performance footgun, unspecified intent | Always specify properties |
| 32 | Glow halos on hover (colored shadow ring) | Bootstrap admin theme energy | Shadow expansion only — no color shift |
| 33 | Viewport media queries on card-internal grids | Fails when card appears in different layouts | Container queries on cards |
| 34 | No compact-height mode | 13" MacBook Air with browser chrome pushes content below fold | `@media (max-height: 780px)` shrinks utility bar + section gaps + hero numeral |
| 35 | Page title in Geist sans | Generic | Page title in Newsreader serif (the editorial moment) |
| 36 | Mixed figure styles in same context (lining numbers in body prose) | Numbers look "dropped in" rather than written | Old-style figures in prose, tabular figures in data |
| 37 | All buttons same height as inputs (40px) | Buttons feel chunky | Buttons 34px, inputs 32px in shell — distinguishable, balanced |
| 38 | Goal hero `max-width: 88%` with margin auto | Felt floating | Goal hero is full-width within content padding; the editorial sentence has `max-width: 92%` to wrap before reaching edge |

---

## 5. The "AI look" diagnostic

The user's primary critique on v3 was "it looks AI-y." This is the diagnostic for that critique — every specific tell, why it reads AI, and what it costs.

### 5.1 The cluster of tells

These rarely appear individually. Together they form the "AI look":

| Tell | What it is | Why it reads AI |
|---|---|---|
| Inter or SF Pro font everywhere | Most common system font default | Default = "designer didn't choose"; AI generators default to it |
| Lining figures everywhere (no oldstyle) | All numbers are tabular caps-height | Default font-feature; AI doesn't know about figure styles |
| Tailwind `slate` text ramp | `slate-50` through `slate-950` | Default Tailwind palette; cool/blue undertone is the giveaway |
| `line-height: 1.5` on every text role | Universal body-text leading | One value applied to everything = lazy |
| No italic anywhere | All-regular weights | Italic requires intent; default is regular |
| No small caps anywhere | `text-transform: uppercase` for tiny labels | Real small caps require font expertise |
| Solid 1px borders on cards | Flat panels | Bootstrap default |
| Drop shadows that look like Material | Heavy ground shadow only | "Card" component default |
| Multiple chromatic accents | Teal + orange, blue + pink, etc. | "Modern colorful dashboard" template |
| Gradient mesh / abstract backgrounds | Stock blob gradients | Figma community default |
| Glassmorphism on cards | Backdrop-blur + transparent fill | 2021-2022 trend, AI knows it well |
| Neumorphism | Soft inset + outer shadow | 2020 trend, AI knows it well |
| Heavy use of emoji in UI | 🚀 in buttons, 📊 in titles | Marketing-page energy on a dashboard |
| Decorative italic for emphasis | Italicizing just to differentiate | Italic without meaning |
| All sections look equally important | Same card weight, same numerals | "Filled out the dashboard layout grid" |
| Big icons next to small numbers | Iconified everything | Awwwards 2018 |
| Pulsing live dots | Animated indicator | "Showing it's alive" gimmick |

### 5.2 The meta-pattern

The AI look is **defaults applied uniformly without intent.** Each individual choice could be defended. Together they shout "templated."

The fix is **intent at every layer:**
- Color: warmth-shifted, one accent, *-soft for semantics
- Type: triad with specific roles, dual figure styles, semantic italic, true small caps
- Surface: white cards on warm canvas, ghost-edge shadow, hover lift
- Motion: smooth cubic-bezier, shadow expansion only, no scale tricks
- Composition: one editorial moment, hover-to-reveal, calm at rest

When in doubt, ask: "If I removed this element, would the page be worse?" If the answer is no, it's AI-look noise.

### 5.3 The "designer mocked" smell

A specific subset of AI-look tells that make a UI feel "designer mocked, not shipped":

- Tinted feature boxes (cream/colored panels for primary content)
- Decorative hatched patterns on every fill
- Stock dashboard layouts (4 KPI cards + 1 big chart + 1 table)
- Showing every available data dimension at once
- Title attributes with icon + text + chevron + count + status all in one row
- Multiple active highlight states ("hover," "active," "focused" — all visible simultaneously)

The fix: **subtraction.** Strip until it hurts, then add back only what earns its pixels.

---

## 6. Meta-principles that emerged

Five principles distilled from all the iterations. These are the rules that survived contact with reality.

### 6.1 Composition before density

Density is fine. Density without composition is the AI look. Every element on the page must be part of a hierarchy:
- Hero (the answer)
- Supporting (the evidence)
- Contextual (the metadata)
- Hidden until needed (the secondary actions)

Before adding anything, ask: "Which tier does this belong to?" If you can't say, don't add it.

### 6.2 Calm at rest, depth on demand

The page-load impression should be sparse and confident. Hover, click, and focus reveal complexity progressively. This is the Linear/Superhuman tell. It also has a cognitive payoff: users feel in control because the UI doesn't fire-hose them.

Every interaction should reveal something — even if it's just a subtle shadow lift. Static UIs feel dead.

### 6.3 Borders as light, not lines

The breakthrough of v4: cards aren't bounded by lines, they're modeled by light. Layered shadows + inner highlights = depth. On hover, the light shifts (shadow expands, edge sharpens slightly) — that's the "ethereal" quality.

If you find yourself reaching for `border: 1px solid` on a content surface, pause. The right answer is almost always a layered shadow.

### 6.4 Type as instrument

Newsreader + Geist + Geist Mono is an instrument with three voices:
- **Newsreader** sings (display, headlines, numerals — the editorial moment)
- **Geist** speaks (body, UI labels, tabs — the working layer)
- **Geist Mono** records (timestamps, URLs, identifiers — the data layer)

Every text element should pick the right voice. Mixing them randomly = AI look. Picking with intent = signature.

The dual-figure system (lining for data, oldstyle for prose) is the typographic signature. The italic-for-semantics rule is the second signature. The small caps via OpenType is the third. These three together are uncopyable without effort.

### 6.5 Fluid by default, fixed when justified

`clamp()` everything: spacing, type, sidebar/rail widths, chart heights. Container queries on card internals. Compact-height mode for laptops. The system should feel "just right" on a 13" MacBook AND a 27" Studio Display without manual sizing.

Fixed pixel values are reserved for: grid gaps below 8px, hairline thicknesses (1–2px), avatar/icon dimensions, kbd chip padding. Anything that's structurally tied to typography or layout = fluid.

---

## 7. Anti-patterns — never do these

If you see one of these in a future design, push back. They are tested-and-rejected.

### 7.1 Visual / aesthetic anti-patterns

- ❌ Tinted card backgrounds for primary content (cream is canvas-only)
- ❌ Dot grain / noise textures on canvas
- ❌ `border: 1px solid` on cards
- ❌ `filter: drop-shadow` (use `box-shadow`)
- ❌ Gradient mesh backgrounds
- ❌ Glassmorphism on cards (only on sticky bars, with subtle blur)
- ❌ Neumorphism (soft inset + outer shadow)
- ❌ Multiple chromatic accents on one page
- ❌ Pulsing animations on live indicators
- ❌ Glow halos on hover (use shadow expansion)
- ❌ `transform: scale()` on hover (cheap-feeling — use `translateY`)
- ❌ Hatched fills outside of distribution bars and progress fill
- ❌ Heavy zebra-striping on tables

### 7.2 Typography anti-patterns

- ❌ Inter / SF Pro / Helvetica system stack
- ❌ Tailwind slate text ramp
- ❌ `text-transform: uppercase` on text below 14px (use `font-variant-caps: all-small-caps`)
- ❌ Universal `line-height: 1.5` on everything
- ❌ Lining figures in body prose (use oldstyle)
- ❌ Italic for visual decoration (italic is semantic only)
- ❌ Display serif for body / UI labels (Newsreader is for headlines + numerals only)
- ❌ Font sizes below 12px on visible text
- ❌ Body font size below 14px

### 7.3 Layout anti-patterns

- ❌ `max-width` on the main content column
- ❌ Fixed-pixel sidebar/rail widths (use `clamp()`)
- ❌ Viewport media queries for card-internal responsiveness (use container queries)
- ❌ All sections same visual weight (one editorial moment per page)
- ❌ Multiple primary CTAs ("Run audit" AND "Generate report" AND "Export" all primary)
- ❌ Centered single-column layouts on wide viewports (use the rail)

### 7.4 Interaction anti-patterns

- ❌ All secondary actions visible at rest (sparklines, menus, → arrows)
- ❌ Hover states that change colors but don't lift
- ❌ Click-to-toggle for things that should be hover-reveal
- ❌ Linear easing on transitions
- ❌ `transition: all`
- ❌ Animations longer than 320ms
- ❌ Animating `width` or `height` of cards
- ❌ No `prefers-reduced-motion` handling

### 7.5 Information-architecture anti-patterns

- ❌ Showing every data dimension at once (use tabs / hover-reveal)
- ❌ Standalone Unicode arrows next to numerals (`12 ↓` reads weak)
- ❌ Decorative icons on every label (icons must earn their pixels)
- ❌ Empty states that are just text ("No data" — design empty states with intent)
- ❌ Loading states with spinners (use skeleton screens or progressive reveal)

---

## 8. Pre-flight checklist (BEFORE you start designing)

Before you build a new page in this system, walk through this checklist. Most of the v1–v5 mistakes would have been caught here.

### 8.1 Strategic questions

1. ☐ What is the **one editorial moment** for this page? (One numeral that is "the answer.")
2. ☐ What is the user's primary job-to-be-done? (One sentence.)
3. ☐ What's the contractual deliverable being communicated? (For Tevero: usually goal attainment.)
4. ☐ What can be moved to the rail (live awareness) vs. main flow (the answer + evidence)?
5. ☐ What can be hidden until hover/click? (Sparklines, menus, secondary actions.)

### 8.2 Composition questions

6. ☐ Does the page have a clear hierarchy: hero → supporting → contextual → hidden?
7. ☐ Are there any sections of equal visual weight? (Should not be.)
8. ☐ Is there exactly one primary CTA? (Should be.)
9. ☐ Does each card earn its pixels, or could it be merged / removed?
10. ☐ Is the canvas color cream (`--canvas`) and are cards white (`--surface`)?
11. ☐ Does the goal hero / page hero have at most one tinted region? (Subtle radial gradient, not solid tint.)

### 8.3 Type questions

12. ☐ Are all visible text sizes ≥ 12px?
13. ☐ Is body text 14px (`--type-body`)?
14. ☐ Are eyebrows / labels using `font-variant-caps: all-small-caps`, not `text-transform: uppercase`?
15. ☐ Are display numerals using Newsreader with `font-variant-numeric: tabular-nums lining-nums`?
16. ☐ Is body prose using `oldstyle-nums proportional-nums` (set on `body`)?
17. ☐ Are timestamps / URLs / identifiers in Geist Mono?
18. ☐ Are italic emphases semantic (proper nouns, dates, paths) — not decorative?
19. ☐ Are line-heights from §2.4.1 (0.95 mega / 1.05 h1 / 1.4 h3 / 1.55 body)?

### 8.4 Surface questions

20. ☐ Are cards using `var(--shadow-card)` (layered ghost-edge), not `border: 1px solid`?
21. ☐ Do cards lift on hover via `translateY(-1px)` + `var(--shadow-lift)`?
22. ☐ Is the primary CTA using the gradient + `var(--shadow-cta)` system?
23. ☐ Are hairlines using transparent rgba (so they sit on any surface)?

### 8.5 Motion questions

24. ☐ All transitions use `var(--ease-smooth)` or `var(--ease-quick)`, never `linear`?
25. ☐ All transitions specify properties, never `all`?
26. ☐ All transitions ≤ 320ms?
27. ☐ Hover states animate `transform: translateY(-1px)` + `box-shadow`, never `scale()`?
28. ☐ `prefers-reduced-motion: reduce` short-circuits transitions?

### 8.6 Responsive questions

29. ☐ Is the main column `minmax(0, 1fr)` with no `max-width`?
30. ☐ Sidebar/rail widths are `clamp()`-based?
31. ☐ Card-internal grids use `@container` queries, not viewport `@media`?
32. ☐ Compact-height mode (`@media (max-height: 780px)`) tested?
33. ☐ Tested at 1280 / 1440 / 1920 / 2560 viewports?

### 8.7 Color questions

34. ☐ One chromatic accent (emerald) on the page?
35. ☐ Semantic states use only `*-soft` tints?
36. ☐ Text uses the ramp (`text-1` through `text-4`), never `#000` or `#FFF`?

### 8.8 The vibe check

37. ☐ Does the page-load impression feel **calm**? (If "busy," cut elements.)
38. ☐ Does hovering feel **alive**? (If nothing changes, add lift/reveal.)
39. ☐ Does the page have one moment of **drama**? (The editorial numeral.)
40. ☐ Could a Stripe / Linear / Superhuman designer ship this without wincing?

---

## 9. Lessons for future AI sessions

The user kicked off this session with "ultrathink." Here's what *I* learned in the process — for the next session.

### 9.1 The user's taste vocabulary

The user uses specific words that map to specific design moves. Translation table:

| User word | Design move |
|---|---|
| "AI-y" | One or more anti-patterns from §7. Diagnose with §5. |
| "squished" | Type or padding too tight. Bump with `clamp()`. |
| "world class" | Apply Stripe/Linear/Superhuman/Locomotive references. |
| "umph" | One editorial moment + bigger numerals + dimension via shadow. |
| "ethereal" | Layered shadows + smooth ease-out + hover-to-reveal. |
| "popping" | Better contrast (numeral vs label), tighter composition. |
| "clean" | Subtract elements. Calm at rest. |
| "sexy" | The composition feels intentional, not templated. Often = subtract more. |
| "$100M software" | Polish: hover lifts, smooth easing, fluid scaling, zero accidental visual artifacts. |
| "polished by in-house designers" | Custom register (Newsreader instead of Inter), semantic italic, dual figure styles. |
| "iterated for 20 years" | Every pixel justifiable. No template defaults. |

### 9.2 What the user values (high → low)

1. **Aesthetic intent** (no defaults)
2. **Calm at rest**
3. **Smooth interactions**
4. **One clear answer per page**
5. **Density when earned**
6. **Accessibility / readability** (called out in v6)

### 9.3 What the user explicitly rejected

- Tiempos Headline (paid)
- Fraunces (overused)
- Inter (AI-look default)
- GT Sectra Display (luxury fashion register)
- Tinted feature boxes
- Dot grain backgrounds
- Decorative italic
- Pulsing live dots
- Multiple chromatic accents

### 9.4 The iteration cadence that worked

The user prefers:
1. **Ultrathink first** (write the diagnostic before the code)
2. **Build the prototype** (HTML so they can open in browser)
3. **React with screenshots** (not detailed text feedback)
4. **Iterate surgically** (don't rebuild from scratch — fix specific spots)

When given a screenshot, the move is: identify the specific failure modes by name, propose specific fixes (with line-level CSS deltas), then build the next iteration. Avoid asking "what do you want me to change?" — diagnose first.

### 9.5 The mistakes I made as the AI

1. **Iterated too aggressively in v3.** Should have shipped v2 + minimal additions, not a full redesign. Lesson: the user's feedback was directional ("more umph"), not "rebuild from scratch."
2. **Defended individual decisions instead of seeing the aggregate.** Each v3 element was justifiable; together they were AI-y. Lesson: composition matters more than individual choices.
3. **Optimized for editorial density at the cost of accessibility.** v5 had 10–11px tags because it felt "Bloomberg-grade." But on a 13" MacBook Air, it failed. Lesson: accessibility floor is non-negotiable; the editorial register can survive at 12px+ via small caps and proper letter-spacing.
4. **Spent too much time on the goal hero composition.** It went through 4 redesigns (v2 / v3 / v4 / v5 progress block). Should have nailed the proportions in v3 with a 30-minute pencil sketch instead of building the prototype each time.
5. **Didn't formalize the type system early.** The size→role mapping table that's now in §2.3 of the system doc should have been the FIRST artifact, not the LAST. Without it, every component used raw `font-size` values that didn't ladder.

### 9.6 What I'd do differently next time

1. **Before any prototype, write a 1-page composition spec.** Hero element, supporting elements, hidden elements. Get user buy-in on hierarchy, then build.
2. **Build the type ramp on day 1.** Lock min/max for every role. Use tokens, never raw values.
3. **Test at 1280 + 1920 + max-height: 720px AT EVERY ITERATION.** Don't wait for the user to flag "doesn't scale."
4. **Quote the user's rejection words as design constraints.** When they say "no AI look," lock the anti-patterns from §7 into the spec.
5. **Ship the dec-rationale doc alongside the system doc.** Both. Always.

---

## 10. What's still unsolved / open questions

Some decisions I parked but didn't resolve. Tagged for future work.

### 10.1 Dark theme

We never built a dark variant. Considerations:
- Canvas: not pure black (`#0A0A0F` is the right warmth-shifted base)
- Surfaces: `#14141A` (cards lift via slightly lighter `#1A1A20`)
- Hairlines: `rgba(255, 255, 255, 0.08)` family
- Accent: emerald may need to brighten to `#1FB37C` for dark mode contrast
- Text ramp: invert (text-1 → near-white, text-4 → mid-gray)
- Shadows: `box-shadow` becomes less effective in dark; replace inner highlight with very subtle outer glow

**Action:** Build dark theme as a Phase 45 (after the system ships to apps/web in Phase 44).

### 10.2 Brand mark redesign

Current brand mark is a placeholder geometric green square with a triangle. Should be:
- Custom-drawn
- Works at 16px through 64px
- Has a "T" reading without being a literal letter
- Stripe-clean, not Awwwards-busy

**Action:** Brief a designer or generate via Midjourney/Figma after Phase 44 ships.

### 10.3 Empty states

We've done zero work on empty states. ("No keywords yet," "No clients yet," "No data this period," etc.) These need:
- Editorial sentence in Newsreader
- Subtle illustration (not stock — custom hatched-pattern art that matches the system)
- One primary CTA
- One secondary "learn more" link

**Action:** Design 6–8 canonical empty states for: no clients, no keywords, no goal set, no audit run, no content, no rankings, no backlinks, no data this period.

### 10.4 Loading states

Skeleton screens vs spinner — we've done neither. The right answer is skeleton screens that match the actual layout (KPI card with grayed numeral, table rows with grayed text). Animate via subtle `background-position` shift on a linear-gradient, not pulsing opacity.

**Action:** Build skeleton primitives matching every card type.

### 10.5 Error states

Not designed. Need:
- Inline error within a card (tier 1 audit fail, GSC sync error)
- Page-level error (full-card error replacing chart when data fetch fails)
- Toast notifications (top-right slide-in, semantic-colored)

**Action:** Phase 46.

### 10.6 Mobile / iPad

Single-column collapse below 880px exists but is untested. Tablet (768–1180px) collapses to 2-col but the rail content becomes a drawer. None of this is designed thoughtfully — just defaults from media queries.

**Action:** A separate iteration on mobile is needed. Probably v7.

### 10.7 Animation choreography

Page-load: should sections fade in cascaded (hero first, then KPIs, then chart, then table)? Or all at once? Currently all at once. Choreographed cascade can feel premium *or* sluggish depending on timing.

**Action:** Test choreographed page-load on real devices. Decision deferred to actual implementation.

### 10.8 Print / export styles

Reports exported to PDF need a separate print stylesheet. Hero numerals scale differently. Right rail is dropped. Backgrounds switch to white.

**Action:** Phase 47 when reports ship.

### 10.9 Accessibility audit

We've enforced WCAG 12px floor and 1.5x line-height. We have NOT audited:
- Color contrast at every text/background pair (need to check `text-3` on `surface-2`, etc.)
- Keyboard navigation flow
- Screen-reader landmarks (`<aside>`, `<main>`, `<nav>` are correctly set, but ARIA labels need review)
- Focus rings (default browser rings — need custom focus-visible style matching the accent)

**Action:** Run aXe / WAVE on the v6 prototype. Fix any flagged contrast pairs.

---

*End of design decisions & rationale doc. Last updated 2026-04-29.*

*Companion: `design-system-v6.md` (the spec). Reference prototype: `prototypes/client-hub-v6.html`. Historical: `prototypes/client-hub-v[1-5].html` for each iteration.*
