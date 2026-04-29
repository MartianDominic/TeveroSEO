# Typography & Boxes — 20-Year Polish Deep Dive

> Supplement to `design-system.md`. Diagnoses why generic SaaS typography reads "AI-generated," prescribes a typographic system tuned to SEO agencies, and pushes the card primitive further without breaking the premium feel we already have.
>
> Output of this doc: a concrete delta to merge into TDS §3 (Typography) and §6 (Borders/Shadows) plus a `<Card>` v2 spec.

---

## 1. The "AI look" — diagnosed

When a UI screams "vibe-coded by an LLM," it almost always fails on the same six axes. Listing them so we can avoid each one consciously.

| # | Tell | Why it reads as AI | Antidote we'll adopt |
|---|---|---|---|
| 1 | **Inter everywhere** (or default Geist) at 400/500 weights only | Inter is the lowest-common-denominator sans. Every shadcn/Tailwind starter uses it. The brain has been trained on it = boring. | Pair sans with a serif **for hero numerals and editorial moments**. Use weight pairing (Regular body + Medium UI labels + Display Light hero numbers) so weight signals hierarchy. |
| 2 | **Same family, only size signals hierarchy** | Hierarchy through size alone is a 2014 Material Design tic. Looks generated because the LLM picks `text-xl/text-base/text-sm` and stops. | Hierarchy through *family change* (serif/sans/mono), *weight*, *color tier*, *case* (small caps), and *tracking*. Size is the **last** lever, not the first. |
| 3 | **Default tabular figures (or none)** | Generic SaaS leaves `font-feature-settings` at default. Numbers don't align in tables, don't blend in prose, don't feel "instrument-grade." | Mandatory OpenType: `tnum` in tables/tickers/cards, `onum` (old-style) in prose, `lnum` (lining) in display. **Numerals are our signature.** |
| 4 | **Monoculture color: black + 4 grays** | Tailwind's `slate-{500,600,700,900}` ladder used as the entire text palette. Reads as "I asked Claude for some grays." | 4-tier text system with **purpose names** (text-1/2/3/4) — every level has a job, color values are hand-tuned (5C5C60, not slate-600). |
| 5 | **Generic line-height (1.5 universal)** | Tailwind's `leading-relaxed/normal` applied indiscriminately. Hero numbers crammed at 1.5, body cramped at 1.4. | Per-role leading: hero numerals 1.0, display serif body 1.4, UI body 1.55, table rows 1.4, compact rows 1.35. |
| 6 | **No italic, no small caps, no drop caps, no semantic emphasis** | LLMs almost never reach for italic-as-emphasis or small-caps-as-taxonomy. Result: visually flat. | Italic for proper nouns in editorial paragraphs (client names, domains). Small caps for taxonomy labels (TIER 1, ACME CORP in identity strip). |

**The unifying tell:** generic SaaS typography is *mathematical*. Each step doubles or scales by 1.25. Same family, predictable weights, default OpenType. Our system has to feel *hand-tuned* — every size, weight, and feature flag chosen for a specific reason.

### Litmus test
Show a screenshot to a typographer. They should immediately notice:
1. Old-style figures inline with body prose ("47 keywords" — the 4 and 7 sit on different baselines than I/k)
2. Tabular display numerals in stat cards (the "8" and "1" same width, optically aligned)
3. Italic proper nouns in the briefing hero
4. Small caps for entity labels
5. Mono for URLs/keywords

If they say "looks like Stripe / Bloomberg / FT," we passed. If they say "looks like another Linear clone," we failed.

---

## 2. Audience semiotics — what SEO agency users want their tools to feel like

Our buyer is an agency owner or senior consultant who sells $5K–$50K/month retainers. Their professional identity is built on:

1. **Mastery of an opaque domain** (Google's algorithm). They want tools that *look* like they understand the domain better than the user does.
2. **Defensible expertise** vs. cheap competitors offering "SEO for $99/mo." They need to walk into pitches with a tool screen that justifies the rate.
3. **Sharing reports with clients** who themselves are CMOs, founders, ops leads. The tool's screenshots end up in slide decks and email attachments.
4. **Reading dense data fast** — keyword tables with 5,000 rows, audit reports with 107 checks, weekly sweeps across 30 client sites.

What this rules **out**:
- ❌ Playful (no Linear "ship it" energy, no Notion friendliness)
- ❌ "Modern minimal" (Webflow / Framer template aesthetic — they've seen 100 of those)
- ❌ Brutalist / experimental (nobody puts brutalist screenshots in a CMO deck)
- ❌ Crypto/AI-startup glow shadows + gradients

What this rules **in**:
- ✅ **Bloomberg Terminal seriousness** — but readable, not 1990s-cramped
- ✅ **The Economist editorial tone** — confident, written, restrained
- ✅ **Stripe payments-grade precision** — every number deliberate, every spacing intentional
- ✅ **FT.com pink-paper warmth** (literally why we chose `#FAFAF7` warm canvas)

The unifying register: **"this tool was built by people who read 10-Ks for fun."**

---

## 3. The 20-year-polished typography system

### 3.1 Family decision — locked

| Role | Family | Why | Cost |
|---|---|---|---|
| **UI sans** | **Geist** (Vercel, OFL) | Cleaner than Inter, has true italic, has tabular variants, free, modern but not trendy. Already adopted in TDS. | Free |
| **Display serif** | **Tiempos Headline** (Klim Type Foundry) | Klim's serifs are the gold standard for editorial digital — used by Medium, Bloomberg Markets, NYT VR. Tiempos has the sharpness of Times but with contemporary terminals. | License (~$200/seat one-time, or $40/mo web license) |
| **Editorial body serif** *(optional, only for long-form briefs/reports)* | **Tiempos Text** (same foundry) | Pairs exactly with Tiempos Headline. Old-style figures by default. | Bundled with Headline license |
| **Mono** | **Geist Mono** | Pairs with Geist. URLs, keywords, kbd hints, code. | Free |
| **Free-tier fallback** *(prototype + bootstrap)* | **Fraunces** (Google Fonts) | Variable serif with optical sizing, old-style + tabular figures, italic. Closest free equivalent to Tiempos. | Free |

**Why not GT Sectra Display** (current placeholder)? Sectra is *more* dramatic — high contrast, dagger terminals, almost Didone-influenced. Beautiful but reads as **fashion editorial / luxury brand**. Our buyers are agency owners, not Vogue readers. Tiempos is more **financial press / serious journalism** — exactly the register we want.

**Why not Söhne** (Klim's premium sans)? It's gorgeous and Stripe-tier, but $$$, and Geist already covers the role at zero cost.

**Action:** Replace `--font-display: "GT Sectra Display"` → `"Tiempos Headline"` in design-system.md §2.1. Production licenses Tiempos; prototypes ship Fraunces.

### 3.2 The hierarchy — by purpose, not by size

The hierarchy uses **five orthogonal axes**. Pick the right combination per role, not just the right size.

| Axis | Values | Signals |
|---|---|---|
| Family | sans / display-serif / mono | sans = chrome, serif = editorial moment, mono = data primitive |
| Weight | Light(300) / Regular(400) / Medium(500) / Semibold(600) | Body is 400. Labels jump to 500. Display numerals can drop to 300 for that "expensive" feel. |
| Color tier | text-1 / text-2 / text-3 / text-4 | text-1 for the one thing per card that matters most |
| Case | sentence / Title Case / SMALL CAPS / UPPERCASE | Small caps for taxonomy. Uppercase only for eyebrows. |
| OpenType figure | tnum / onum / lnum / pnum | tnum in tables, onum in prose, lnum+tnum in display |

### 3.3 Roles — every text style we need

| Role | Family | Size / leading | Weight | Color | Tracking | Case | OpenType | Where it appears |
|---|---|---|---|---|---|---|---|---|
| **Hero metric** (stat card big number) | display-serif | 30 / 1.0 | 400 | text-1 | -0.022em | as-is | `tnum, lnum` | StatCard primary value |
| **Display metric** (identity strip ticker, goal current) | display-serif | 22 / 1.0 | 400 | text-1 | -0.020em | as-is | `tnum, lnum` | Ticker, GoalPill |
| **Editorial display** (page title, entity name) | sans | 28 / 1.1 | 500 | text-1 | -0.022em | Title | — | Page H1 |
| **Briefing paragraph** | display-serif | 21 / 1.45 | 400 | text-1 | -0.012em | sentence | `onum` | BriefingHero body |
| **Briefing emphasis** (proper nouns, deltas) | display-serif | 21 / 1.45 | 400 *italic* | text-1 | -0.012em | sentence | `onum` | within BriefingHero |
| **Section headline** | sans | 17 / 1.3 | 500 | text-1 | -0.012em | Title | — | Card titles, section heads |
| **Section eyebrow** | sans | 11 / 1.2 | 500 | text-3 | 0.07em | UPPERCASE | — | Above section heads |
| **Body** | sans | 13 / 1.55 | 400 | text-2 | -0.005em | sentence | `onum` (in prose) | All UI body text, briefing-adjacent prose |
| **Body strong** | sans | 13 / 1.55 | 500 | text-1 | -0.005em | sentence | `onum` | Inline emphasis in body |
| **Table cell** | sans | 13 / 1.4 | 400 | text-2 | -0.005em | sentence | `tnum` (numeric cells) | Data tables |
| **Table cell numeric** | sans | 13 / 1.4 | 400 | text-1 | -0.005em | as-is | `tnum, lnum` | Numeric columns |
| **Caption / metadata** | sans | 12 / 1.3 | 400 | text-3 | -0.005em | sentence | `onum` | Card foots, timestamps |
| **Micro / priority score** | sans | 11 / 1.3 | 500 | text-3 | 0 | sentence | `tnum` | ActionQueue priority badge |
| **Taxonomy small-caps** | sans | 11 / 1.3 | 500 | text-3 | 0.04em | small caps | — | TIER 1, NEW LEAD, FAILING |
| **Eyebrow uppercase** | sans | 10.5 / 1.2 | 500 | text-3 | 0.08em | UPPERCASE | — | Top-of-card labels |
| **URL / keyword** | mono | 12 / 1.4 | 400 | text-2 | 0 | as-is | — | acmecorp.com, "best running shoes" |
| **Keyboard hint** | mono | 11 / 1 | 500 | text-3 | 0 | UPPERCASE | — | KbdHint |

### 3.4 The "AI look" antidotes — locked rules

These are non-negotiable. Each escapes one of the six tells from §1.

1. **Hero numerals are always serif.** Tier-1 stat values, ticker values, goal currents, big delta in deltas. This is THE single highest-leverage move. Our prototypes already do this for stat cards — extend to ticker and goal currents.
2. **Numbers in body prose use old-style figures.** When a paragraph says "47 keywords moved into top 10 since March 4," the digits sit on different baselines and blend with lowercase. Implemented via `font-variant-numeric: oldstyle-nums proportional-nums` on body class.
3. **Numbers in tables and tickers use tabular lining figures.** Implemented via `font-variant-numeric: tabular-nums lining-nums` on table cell numeric class.
4. **Italic is real semantic emphasis.** In BriefingHero, italicize: client names (*Acme Corp*), domain names (*acmecorp.com*), and "up/down" verbs in deltas. **Never** italicize for visual flavor.
5. **Small caps for taxonomy.** TIER 1 / NEW LEAD / IN REVIEW / DRAFT — these are categorical labels. Render as small caps via `font-variant-caps: small-caps`, never as `text-transform: uppercase`. Actual small caps glyphs (Geist supports them) are shorter than the cap height; uppercase-from-lowercase is the AI giveaway.
6. **Tracking is per-size.** Display sizes get -0.020 to -0.025em. Body gets -0.005em. Eyebrows/labels get +0.04 to +0.08em. **Never leave default tracking** on display sizes.
7. **Color tiers are purposeful, not aesthetic.** text-1 is for "the one thing on the screen that the user is here to read." text-2 is for the explanatory body. text-3 is metadata. text-4 is decorative. If everything on a card is text-2 you've failed.
8. **Mono for URLs and keywords always.** Never set `acmecorp.com` in sans. The reader's eye should know instantly: "that's a string from outside our system."

### 3.5 OpenType feature settings (canonical CSS)

Add to design-system.md §2.1. Sets the OpenType behavior at the right level so we don't have to remember per-component.

```css
/* Default body — old-style proportional figures so numbers blend with lowercase */
body, .ds-body, .ds-prose {
  font-variant-numeric: oldstyle-nums proportional-nums;
  font-feature-settings: "ss01", "cv11"; /* Geist stylistic set 01 = single-storey 'a', cv11 = curly l */
}

/* Display serif numerals — tabular lining (precise alignment, traditional shapes) */
.ds-display, .ds-num-hero, .ds-num-display {
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: "ss01"; /* depends on chosen serif's stylistic set */
}

/* Table numeric cells, ticker values, anywhere data aligns vertically */
.ds-tnum, td.numeric, .ds-ticker-value, .ds-goal-current {
  font-variant-numeric: tabular-nums lining-nums;
}

/* Taxonomy labels — small caps via OpenType, never via text-transform */
.ds-smallcaps {
  font-variant-caps: small-caps;
  letter-spacing: 0.04em;
  text-transform: lowercase; /* let small-caps OpenType handle the visual uppercase */
}

/* Eyebrows — synthetic uppercase is acceptable here because it's branding-as-label */
.ds-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
}
```

### 3.6 Color tier — refined hex (delta from current tokens)

Current tokens (text-2 = #5C5C60, text-3 = #9A9A9F) are slightly cool. For warm canvas, we want text colors with a hint of warm undertone so they don't fight the canvas.

| Token | Current | Proposed | Reason |
|---|---|---|---|
| `--text-1` | #0E0E10 | #14141A | Slightly warmer near-black. Less "phone screen blue-black." |
| `--text-2` | #5C5C60 | #4F4F55 | Pulls out of "Tailwind slate" territory. Reads more confident. |
| `--text-3` | #9A9A9F | #8A8A92 | Marginally darker so metadata isn't ghost-faint on warm canvas. |
| `--text-4` | #BEBEC0 | #C0BFB7 | Slight warm tint matching canvas family. |

These are subtle (sub-10 hex point shifts) but compound across an entire screen.

### 3.7 What the briefing hero looks like with all this applied

Current state in `client-hub-v1.html` is decent but uses Fraunces with default OpenType. Target render:

```html
<p class="ds-display ds-prose font-display text-[21px] leading-[1.45] tracking-[-0.012em] text-text-1">
  <em>Acme Corp</em> is up. Organic traffic on
  <span class="font-mono text-[18px]">acmecorp.com</span>
  grew <em>18.4%</em> over the last 30 days, with
  <span class="ds-tnum">47</span> keywords moving into the top 10 since
  <em>March 4</em>. Two Tier-1 alerts cleared yesterday. The auto-fix on the
  <em>/pricing</em> meta description held — traffic is +12% week-over-week
  with no rank loss.
</p>
```

Visual signals:
- Serif body (Tiempos/Fraunces)
- Italic for client name, domain segment, dates — semantic emphasis
- Mono for the full domain (`acmecorp.com`) — distinct token
- Old-style figures in "47" inline (`onum`)
- Tabular if the number stands alone in a stat strip nearby

This single paragraph carries more "polished for 20 years" signal than any other element on the screen.

---

## 4. Boxes / cards — keeping the premium feel and pushing further

What we already nailed (don't break):

- **Hairline borders, no shadow** at rest — the flat-with-edge aesthetic that reads as Stripe-grade
- **10-12px radii** — soft enough to feel modern, sharp enough to feel serious. Avoid going to 16px+ (consumer territory) or 4px (utilitarian)
- **Pure white surface on warm canvas** — the `#FFFFFF` on `#FAFAF7` relationship is doing real work. Don't tint surfaces.
- **24-32px internal padding** — already comfortable. Don't shrink.

Where we should push:

### 4.1 CardHead — formal envelope pattern

Instead of just placing a title at the top of a card, introduce a formal **CardHead** strip. This is the single biggest "iterated for years" upgrade.

```
┌─────────────────────────────────────────────────────────┐
│ ⌐ KEYWORD MOVERS · LAST 30 DAYS               View all → │  ← CardHead (52px tall)
├─────────────────────────────────────────────────────────┤  ← hairline-soft, 16px inset both sides
│                                                          │
│   [card body content]                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

- Height: 52px
- Padding: 16px horizontal, 14px top, 12px bottom
- Title: small caps via `ds-smallcaps`, font-weight 500, color text-2
- Optional inline metadata (• separators) in text-3
- Optional icon left of title (16px stroke icon, color text-3)
- Optional right action (link/button)
- **Bottom hairline is inset 16px from each edge** (not full bleed) — this is the refined detail. Full-bleed dividers feel utilitarian; inset hairlines feel composed.

This pattern applied consistently across cards is the single move that screams "design system, not vibe code."

### 4.2 Inner dividers — hairline-soft with inset

Within a card body, when separating sub-sections, use:
- 1px solid `var(--hairline-soft)` (lower contrast than card border)
- **16px inset from each edge** of card body
- Vertical padding 16px above and below

Avoid: full-bleed dividers (utilitarian), thicker dividers (heavy-handed), no divider with just spacing (visually mushy).

### 4.3 Footer pattern — quiet metadata strip

Optional 36px footer for cards that surface "this came from somewhere" metadata:
- Background: `surface-2` (slightly tinted)
- Top border: 1px hairline-soft, full bleed
- Padding: 8px 20px
- Content: 11px small caps, text-3, with `•` separators
- Example: `Updated 2h ago · Source: GSC + DataForSEO · 14 keywords`

Not every card needs this. Use only where provenance/timestamp is genuinely informative.

### 4.4 Card variants — composable, not variant-explosion

Three core variants. Resist adding a fourth.

| Variant | Background | Border | Use |
|---|---|---|---|
| `default` | surface (#FFFFFF) | hairline | Standard card, most common |
| `tinted` | accent-soft tinted (`#F2EDE0` warm) | hairline-soft | Editorial moments — BriefingHero only |
| `inset` | surface-2 (#F5F5F0) | none | Sub-card inside a card (e.g., quick stats inside a parent panel) |

State modifiers (apply on top of any variant):
- `hover` → `box-shadow: 0 1px 0 rgba(20,20,26,0.04)` (whisper of depth)
- `selected` → `border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft) inset`
- `loading` → skeleton inside, opacity 0.6
- `disabled` → opacity 0.55, cursor not-allowed

### 4.5 Card-on-card "envelope" pattern for hero panels

For the BriefingHero specifically, allow a tinted outer card containing a default white inner card (the envelope pattern):

```
┌─ outer: tinted warm ──────────────────────────────────┐
│  TODAY'S BRIEFING · 2026-04-28                         │
│                                                         │
│  ┌─ inner: surface white ────────────────────────────┐ │
│  │ Acme Corp is up. Organic traffic on acmecorp.com │ │
│  │ grew 18.4% over the last 30 days...              │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  [auto-generated by haiku · 1h cache · refresh ↻]      │
└────────────────────────────────────────────────────────┘
```

This is restricted to BriefingHero. Don't generalize the pattern (envelope explosions are an AI-look tell of their own — every card wrapped in another card).

### 4.6 What we will NOT do (forbidden)

- ❌ **Gradients on cards** (canvas, surface, headers — anywhere). One exception: avatars use gradients, that's it.
- ❌ **Backdrop blur / glass** effects. Reads as "Apple Vision Pro 2024 hype."
- ❌ **Glow shadows** (any colored shadow). Drop-shadow only ever uses near-black at low opacity.
- ❌ **Card background images** (decorative). The card content is the content.
- ❌ **Hover cards that lift more than 1px**. We're not iOS Settings.
- ❌ **Animated borders** (gradient sweeps, etc.). Crypto / AI-tool tell.

### 4.7 Spacing — micro-adjustments

| Pair | Current | Proposed | Reason |
|---|---|---|---|
| Card-to-card gap (default rail) | 16 | 20 | Slightly more breathing room; current feels marginally tight at 1440px viewport |
| CardHead bottom-divider inset | n/a | 16 | New rule: dividers inset, not full-bleed |
| Card body horizontal padding | 24 | 24 | Keep |
| Card body vertical padding | 24 | 28 | One more notch of headroom; pairs with hero numerals at scale |

---

## 5. Concrete delta to merge into `design-system.md`

### 5.1 Token CSS additions (§2.1)

```css
:root {
  /* === Text color refinements (slightly warmer for warm canvas) === */
  --text-1: #14141A;   /* was #0E0E10 */
  --text-2: #4F4F55;   /* was #5C5C60 */
  --text-3: #8A8A92;   /* was #9A9A9F */
  --text-4: #C0BFB7;   /* was #BEBEC0 */

  /* === Display family — production target === */
  --font-display: "Tiempos Headline", "GT Sectra Display", "Fraunces", Georgia, serif;
  /* (Tiempos is licensed; Fraunces is the free fallback used in prototypes.) */

  /* === Card surface tints (new) === */
  --surface-tinted: #F2EDE0;  /* warm tinted card for editorial moments (BriefingHero outer) */

  /* === Inner divider inset (new) === */
  --inset-divider: 16px;
}
```

### 5.2 Type role classes (§3 addition)

Add to design-system.md §3 as a new subsection §3.5:

```css
/* === OpenType defaults by role === */
.ds-prose, .ds-body {
  font-variant-numeric: oldstyle-nums proportional-nums;
}
.ds-display, .ds-num-hero, .ds-num-display {
  font-variant-numeric: tabular-nums lining-nums;
}
.ds-tnum, td.numeric {
  font-variant-numeric: tabular-nums lining-nums;
}
.ds-smallcaps {
  font-variant-caps: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.04em;
}
.ds-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
}
```

### 5.3 Card primitive update (§9.11 + new CardHead §9.12)

`<Card>` API additions:
- `variant?: "default" | "tinted" | "inset"` (default: `"default"`)
- `as?: "div" | "section" | "article"` (default: `"div"`)

`<CardHead>` API additions:
- `eyebrow?: ReactNode` — optional eyebrow above title (uppercase 11px)
- `title: ReactNode` — small caps via `ds-smallcaps` class
- `meta?: ReactNode` — inline metadata after title, with bullet separator
- `icon?: ReactNode` — 16px leading icon
- `action?: ReactNode` — right-aligned action (link or icon button)
- Renders 52px tall, 16px h-padding, hairline-soft bottom divider **inset 16px each edge**.

### 5.4 New rule in §3.3

> **Display numerals always use Tiempos/Fraunces with `tabular-nums lining-nums`.** Body prose uses Geist with `oldstyle-nums proportional-nums`. This dual-system is the core typographic signature of TDS.

---

## 6. Verification — A/B before locking

Before we merge any of this, do a side-by-side prototype:

1. **Clone `client-hub-v1.html` → `client-hub-v2-typo.html`**
2. Apply §3 type roles, §4 card refinements, §5.1 token deltas
3. Render at 1440×900 and 1920×1080
4. Capture screenshot of both
5. Internal review: does v2 read as "Bloomberg/FT/Stripe register" vs v1's "Linear-clone register"?
6. If yes, merge deltas into `design-system.md` and update v2 prototypes (`dashboard-v2.html`, `client-hub-v1.html` → re-render)

Two specific moments to evaluate side-by-side:
- **The briefing hero paragraph** — most type-density, biggest editorial moment
- **A stat card with hero numeral + label + sparkline + delta chip** — most components-per-square-inch

If either of those reads "AI" in v2, the system isn't there yet.

---

## 7. Decisions still pending (escalate)

Three decisions that need user/owner sign-off before this delta becomes canonical:

1. **License Tiempos Headline?** ~$200 one-time per seat for desktop, ~$40/mo web license for production. Alternative: stay on free Fraunces (slightly less polished but acceptable). Cost decision.
2. **Color tier hex shifts (§5.1)** — sub-10 hex point shifts on text-1 through text-4. Low risk, but should be reviewed in production data context.
3. **CardHead inset divider (§4.1)** — adopting this universally means re-rendering every card across both prototypes. ~2 days of design work to update. Confirm before committing.

If approved, this becomes Phase 44 §A (Tokens) and §B (Primitives) in the migration plan from `design-system.md` §17.
