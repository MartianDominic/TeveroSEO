# Tevero Design System — v6 (Locomotive SOTD register, accessibility-first)

> **Goal:** Stripe + Linear + Superhuman + Locomotive — calm at rest, tactile on interaction, $100M-software polish, replicable across every page. **WCAG-compliant 12px floor on every visible text.**

> **Reference prototype:** `.planning/design/prototypes/client-hub-v6.html`

> **Changelog from v5:** Type ramp re-floored at 12px. Body bumped 13→14px (industry standard). All eyebrows/labels/tags bumped to 12px (was 10–11px, sub-WCAG). Letter-spacing and line-height systems formalized. Size→role mapping table added.

---

## 0. Version history (v3 → v6)

This system was iterated through four named prototype generations. Each version solved a specific class of failure. Reading this history is the fastest way to understand *why* the rules exist.

### v3 — "AI-y density"
**Tried:** Three-column shell with persistent right rail; tinted cream goal hero; dot grain background; sparklines visible at rest on KPIs; full-width keyword table; Apr 14/22 annotations on trajectory chart.
**Failed because:**
- Tinted goal hero read as a "feature box" — looked templated
- Dot grain background tried hard to feel "designed," ended up feeling AI-generated
- Hard 1px borders on cards = flat, no dimension
- Density without white space — sparklines crammed into KPIs at rest, sub-goals always visible, trajectory annotations cluttered
- Numbers undersized relative to surrounding space
- Too many small competing visual elements (eyebrows, dots, separators, pulsing live badges)
- Hatched fills used everywhere (signature → noise)

### v4 — "Calm but squished"
**Fixed:** Killed dot grain. Goal hero became white. Layered ghost-edge shadows replaced borders. Hover-to-reveal sparklines/menus. Bigger numerals (KPI 48px, mega 84px). Stripe-register white space. Smooth `cubic-bezier(0.16, 1, 0.3, 1)` transitions. Container queries on cards.
**Failed because:**
- Goal hero progress numerals (`12 / 20` / `60%`) were unbalanced — `12` did all the work, `/ 20` orphaned, `60%` floated disconnected
- Falling-row arrow indicators (`12 ↓`) read frail next to large numerals
- Pipeline cells were boxy with no relative scale
- Trajectory chart legend cramped at top-right
- Envelope `TARGET` label collided with `p50`
- Sub-goals tight vertical rhythm

### v5 — "Composition fixed, fluid system locked"
**Fixed:**
- Progress block restructured: `12 / 20` paired tight on left, status pill + ETA stacked on right of same row, bar below, detail row at bottom (§7.1)
- Falling rows: dropped standalone `↓` arrow, added `from-to` chip pattern (`13 from 9`)
- Pipeline strip got 3px relative-volume bars under each count
- Audit findings got severity dots (`●●●` for tier 1, etc.)
- Trajectory legend moved below chart with quiet `85% conf.` italic
- Envelope vis: triangle pointer above bar for `TARGET` (no collision with `p50`)
- Sub-goals row padding bumped to 12px
- All spacing tokens fluid via `clamp()`
- Sidebar/rail widths fluid: `clamp(232px, 16vw, 272px)` and `clamp(320px, 22vw, 380px)`
- Container queries on `.goal-hero` and `.kpi`
- Compact-height mode `@media (max-height: 780px)` for 13" laptops
**Failed because:** Type sizes were sub-WCAG (10–11px tags, 13px body, eyebrows at 10.5px). User couldn't read screenshots on a 13" MacBook Air.

### v6 — "Accessibility-first type ramp" (current)
**Fixed:**
- 12px floor on every visible text (was 10–11px)
- Body bumped 13→14px (Stripe / Linear / Vercel / GitHub / Figma standard)
- Eyebrows: 10.5px → 12px
- Tags / day dividers: 10px → 12px
- Captions / meta: 11px → 12.5–13px
- Deltas / KPI sub: 11.5px → 13px
- Card titles: 14px → 15px
- Section titles: 16–17px → 17–18.5px
- Letter-spacing system formalized (§2.4.2)
- Line-height system formalized (§2.4.1, all body ≥ 1.5x WCAG)
- Size→role mapping table (§2.3) so every element has a single source of truth

**Net result:** v6 keeps every v5 composition fix (the progress block redesign, falling-row pattern, pipeline bars, severity dots, hover-to-reveal, ghost-edge shadows, fluid system, container queries, smooth motion) AND lifts every text element above the WCAG-AAA legibility floor.

---

## 1. Philosophy

The system is built on five non-negotiable principles. If a design decision violates one of these, it's wrong:

1. **One editorial moment per page.** Every page has exactly one big-serif numeral that reads as the answer. Everything else is supporting cast. (Goal hero numeral on overview; biggest KPI on stats page; primary metric on detail page.)
2. **Cards are glass, not paper.** Layered ghost-edge shadows replace solid borders. On hover, cards lift 1px and shadow expands. Never a `border: 1px solid` on a card.
3. **Calm at rest, hover-to-reveal.** Sparklines, secondary actions, kbd hints, menus (`⋯`) — all hidden until hover. Resting state shows the answer; interaction reveals depth.
4. **Numbers want air.** Big serif numerals (Newsreader) need 2× their visual weight in surrounding white space. Cramming kills them.
5. **Everything fluid, nothing static.** Spacing/type/sizing scale with viewport via `clamp()`. Container queries on cards so internal grids respond to *card* width, not *viewport* width.

---

## 2. Foundation tokens

### 2.1 Color

```
/* Canvas / surface ladder */
--canvas:          #FAFAF7   /* page background, slight warm cream */
--canvas-dim:      #F5F4EE   /* subtle inset surfaces */
--surface:         #FFFFFF   /* cards (default) */
--surface-2:       #F8F8F3   /* hover state, tinted insets */
--surface-3:       #F2F1EB   /* deeper inset (progress bar track) */

/* Hairlines — transparent so they sit on any surface */
--hairline:        rgba(20, 20, 26, 0.06)   /* card edges */
--hairline-2:      rgba(20, 20, 26, 0.04)   /* internal column dividers */
--hairline-3:      rgba(20, 20, 26, 0.025)  /* row separators */

/* Text ramp — warmth-shifted (not gray) */
--text-1:          #14141A   /* headings, hero numerals */
--text-2:          #54545A   /* body */
--text-3:          #93939A   /* labels, eyebrows */
--text-4:          #C4C3BB   /* dividers, sep dots */

/* Accent (forest green — only colored chrome on the page) */
--accent:          #0F4F3D
--accent-2:        #1A6E55
--accent-soft:     #EAF1ED
--accent-ink:      #093528   /* text on accent-soft bg */
--accent-line:     #C8DDD4
--accent-tint:     #5F9181   /* desaturated, used for current-period dist bars */

/* Semantic states */
--success: #1B6E45  --success-soft: #EAF2EE
--error:   #9B2C2C  --error-soft:   #F4E6E6
--warning: #A87F1A  --warning-soft: #F4EDDA
--info:    #2D5A87  --info-soft:    #EFF4F9
```

**Color rules:**
- ✅ Use one accent only (emerald). Tint with `--accent-soft` for filled surfaces, ink with `--accent-ink` for text on those surfaces.
- ✅ Hairlines are always transparent rgba so they sit naturally on any surface.
- ❌ Never use multiple chromatic accents on a page. The accent is reserved for the goal/contract.
- ❌ Never use `#000000` or `#FFFFFF` for text. Use the ramp.
- ❌ Never use Tailwind's `slate` ladder — too cool, too generic. Our text ramp is warmth-shifted toward warm gray (#54545A vs slate-600 #475569).

### 2.2 Typography

**The locked free triad:**

```
--font-sans:    'Geist', ui-sans-serif, system-ui, sans-serif
--font-mono:    'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace
--font-display: 'Newsreader', Georgia, 'Times New Roman', serif
```

Single Google Fonts link in `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,400..600&display=swap" rel="stylesheet" />
```

**Why Newsreader:**
- Variable optical sizing (opsz 6–72) — the same font carries display headlines AND body italics.
- True italic glyphs (not slanted regular).
- True OpenType small caps via `font-variant-caps: all-small-caps`.
- OpenType figure features: `tabular-nums lining-nums` (data) and `oldstyle-nums proportional-nums` (prose).
- Journalistic / Stripe register without paid licensing.

**Why Geist + Geist Mono:**
- Vercel's optimized UI sans — clean tabular numerals, sharp at small sizes.
- Pairs with mono variant for terminal/data rows (URLs, timestamps, keywords).

### 2.3 Type scale (v6 — accessibility-first, 12px floor)

**The #1 rule: no visible text below 12px, ever.** WCAG practical floor + premium-SaaS readability ramp.

```css
--type-tiny:   12px                            /* WCAG floor — eyebrows, micro labels, tags */
--type-small:  clamp(13px, 0.92vw, 13.5px)     /* meta, captions, deltas, sub-text */
--type-body:   clamp(14px, 1vw, 14.5px)        /* body, table cells, default — industry standard */
--type-h3:     clamp(15px, 1.1vw, 16px)        /* card titles, button labels */
--type-h2:     clamp(17px, 1.3vw, 18.5px)      /* section titles */
--type-h1:     clamp(30px, 2.4vw, 40px)        /* page title (Newsreader serif) */
```

**Why these specific values:**
- `12px` is the WCAG-AAA practical floor. Below this, even with 1.5x line-height, body text fails legibility audits.
- `14px` body matches Stripe / Linear / Vercel / GitHub / Figma — the premium SaaS standard. Below 14px, dashboards feel "designer mocked" not "shipped."
- `clamp()` gives ~0.5–1px breathing on 4K monitors without making text balloon.
- Page title `clamp(30px, 2.4vw, 40px)` scales with the editorial-moment role — needs presence on big screens.

**Display numerals (Newsreader, italic-aware optical sizing):**

```css
--num-mega:    clamp(58px, 4.8vw, 80px)   /* goal hero numeral — the page's answer */
--num-hero:    clamp(38px, 3.2vw, 46px)   /* hero KPI numeral */
--num-card:    clamp(36px, 3vw, 44px)     /* KPI card numeral */
--num-row:     clamp(20px, 1.7vw, 26px)   /* table row, distribution bucket */
--num-tiny:    clamp(15px, 1.2vw, 18px)   /* inline serif within prose */
```

**The size→role mapping (memorize this — every element should slot here):**

| Token | Size | Where it goes |
|---|---|---|
| `--type-tiny` | 12px | Eyebrows, group labels, today-feed tags, day dividers, kbd chips, sub-goal tags, severity meta, ETA "lead" prefix, brand-tag, `.t-eyebrow` class |
| `--type-small` | 13–13.5px | Card-head meta, KPI head names, KPI deltas, table head row, intent badges, KD pills, sparkline endpoint labels, today-event timestamps, rail-section meta, breadcrumb separators, ops-strip items |
| `--type-body` | 14–14.5px | Card titles, sidebar nav items, period selector buttons, table cells, today-event body, up-next titles, button labels, search-trigger, ETA block, qw-summary, confidence-line, velocity values, subgoal text, kw-tab labels |
| `--type-h3` | 15–16px | Section card titles (`Forecast & diagnostics`, `Organic ranking distribution`), distribution chart title |
| `--type-h2` | 17–18.5px | Major section headlines if needed |
| `--type-h1` | 30–40px | Page title only (one per page, Newsreader serif) |
| `--num-row` | 20–26px | Distribution bucket numbers above bars, table position numerals, diag-row position |
| `--num-card` | 36–44px | KPI card primary numeral |
| `--num-hero` | 38–46px | (currently unused — reserved for KPI hero variants) |
| `--num-mega` | 58–80px | Goal hero `12 / 20` (the editorial moment) |

### 2.4 Type roles (use the class, never raw `font-size`)

```css
.t-page-title    /* Newsreader, --type-h1 fluid, letter-spacing -0.024em */
.t-eyebrow       /* 12px, 0.1em tracking, uppercase, --text-3 */
.t-smallcaps     /* 12px, 0.04em tracking, font-variant-caps: all-small-caps */
.t-mono          /* Geist Mono, tabular-nums lining-nums */
.t-tnum          /* applies tabular-nums lining-nums only */
.num-mega/.num-hero/.num-card/.num-row  /* display serif numeral roles */
.kbd             /* 12px Geist Mono with hairline shadow */
```

### 2.4.1 Line-height system (WCAG-compliant)

```
12px tiny:    1.3   →  15.6px line  (UI labels — single-line)
13px small:   1.45  →  18.9px line  (captions, meta — short paragraphs)
14px body:    1.55  →  21.7px line  (body — meets WCAG 1.5x)
15px h3:      1.4   →  21px         (titles — slightly tighter than body)
17px h2:      1.3   →  22.1px       (titles — tight)
30px+ h1:     1.05  →  31.5px+      (display — very tight)
60px+ mega:   0.95  →  57px+        (numerals — optical compression)
```

WCAG 1.4.12 requires body line-height ≥ 1.5 of font size. We exceed (1.55 on body). Tight headings are exempt per WCAG.

### 2.4.2 Letter-spacing system

```
Display serif numerals:  -0.024em to -0.034em  (optical compression — Newsreader needs slight tightening at large sizes)
H1 page title:           -0.024em
H3 card titles:          -0.005em to -0.012em  (very subtle)
Body 14px:               -0.005em
Tiny eyebrows:           +0.1em                (uppercase needs tracking)
Small caps:              +0.04em to +0.06em    (small caps benefit from breathing)
```

**Rule:** Larger text = tighter tracking. Smaller text = looser tracking. Uppercase always +0.06em or more.

### 2.5 Numerals — the dual-figure system

This is the typographic signature. **Never** mix the two figure styles in the same context:

| Figure style | Where it goes | Why |
|---|---|---|
| `tabular-nums lining-nums` | Tables, charts, KPI numerals, timestamps, percentages, deltas | Aligned columns, all-caps height, scans as data |
| `oldstyle-nums proportional-nums` | Body prose ("Apr 1 by Marcus L.", "set 14 minutes ago") | Sits with lowercase letters, reads as text |

**Set on `body`:** `font-variant-numeric: oldstyle-nums proportional-nums`
**Override on data:** `font-variant-numeric: tabular-nums lining-nums`

### 2.6 Italic emphasis (semantic)

Italic is **never decoration**. Use it only for:
- Proper nouns inside data context: `set Apr 1 by *Marcus L.*`
- Dates inline with prose: `*July 18, 2026*`
- URL paths called out: `*/blog/best-running-shoes*`
- Goal sentence anchors: `Land *20 of 200* keywords on *page 1* by *July 31, 2026*`
- Confidence ranges: `between *July 6* and *August 14*`

Body text uses Geist regular. Italic is an editorial highlight.

### 2.7 Spacing scale (fluid)

```css
--space-1: 4px              /* fixed atoms */
--space-2: 8px              /* fixed atoms */
--space-3: clamp(10px, 0.85vw, 13px)
--space-4: clamp(12px, 1.05vw, 16px)
--space-5: clamp(16px, 1.4vw, 22px)
--space-6: clamp(20px, 1.8vw, 28px)
--space-7: clamp(28px, 2.4vw, 38px)
--space-8: clamp(36px, 3.4vw, 52px)
--space-9: clamp(48px, 4.8vw, 72px)
```

**Spacing rules of thumb:**
- Card interior: `--space-7` (28–38px) on big cards, `--space-6` (20–28px) on KPI cards
- Section gap (between major sections in main column): `--space-8` (36–52px)
- Grid/element gap: `--space-4` to `--space-5` (12–22px)
- Page horizontal padding: `--space-7` (28–38px)

**Compact-height override** (for 13" laptops / browser chrome):
```css
@media (max-height: 780px) {
  --space-7: clamp(20px, 2vw, 30px);
  --space-8: clamp(24px, 2.4vw, 36px);
  --space-9: clamp(32px, 3vw, 48px);
  --shell-utility-h: 44px;     /* shorter sticky bars */
  --num-mega: clamp(52px, 4.2vw, 68px);  /* slightly smaller hero */
}
```

### 2.8 Radii

```css
--radius-input:  6px       /* inputs, kbd chips */
--radius-button: 8px       /* buttons, search trigger, period selector */
--radius-card:   12px      /* all cards */
--radius-modal:  14px      /* dialogs */
--radius-pill:   999px     /* pills, badges */
```

### 2.9 Shadow system — the "oh wow" borders

Cards use **layered ghost-edge shadows** instead of `border: 1px solid`. This creates the glass-edge feel:

```css
/* At rest */
--shadow-card:
  0 0 0 1px rgba(20, 20, 26, 0.045),     /* outer ghost stroke */
  0 1px 2px rgba(20, 20, 26, 0.03),       /* depth shadow */
  inset 0 1px 0 rgba(255, 255, 255, 0.5); /* inner top highlight */

/* On hover */
--shadow-lift:
  0 0 0 1px rgba(20, 20, 26, 0.06),       /* edge sharpens */
  0 6px 16px -4px rgba(20, 20, 26, 0.06), /* lifted ground shadow */
  0 16px 40px -16px rgba(20, 20, 26, 0.10), /* atmospheric drop */
  inset 0 1px 0 rgba(255, 255, 255, 0.55);

/* Pop (used on small interactive elements like icon-btn, search-trigger) */
--shadow-pop:
  0 0 0 1px rgba(20, 20, 26, 0.05),
  0 2px 4px rgba(20, 20, 26, 0.04),
  0 12px 28px -8px rgba(20, 20, 26, 0.08);

/* Primary CTA — accent gradient with inset highlight */
--shadow-cta:
  inset 0 0 0 1px rgba(15, 79, 61, 0.6),
  inset 0 1px 0 rgba(255, 255, 255, 0.18),
  0 1px 2px rgba(15, 79, 61, 0.18),
  0 4px 12px -2px rgba(15, 79, 61, 0.20);

--shadow-cta-hover:
  inset 0 0 0 1px rgba(15, 79, 61, 0.8),
  inset 0 1px 0 rgba(255, 255, 255, 0.18),
  0 2px 6px rgba(15, 79, 61, 0.25),
  0 8px 18px -4px rgba(15, 79, 61, 0.28);
```

**Shadow rules:**
- ✅ Always pair an outer stroke with an inner top highlight. The inset rgba(255,255,255,0.5) creates the glass-light feel.
- ✅ On hover: shadow expands, doesn't change color.
- ❌ Never use `border: 1px solid` on a card. (Hairlines internal to cards are fine — `border-bottom: 1px solid var(--hairline-2)` between header/body.)
- ❌ Never use a glow that isn't a shadow expansion. No fake colored halos.
- ❌ Never use `filter: drop-shadow`. Always `box-shadow`.

### 2.10 Motion

Two easing curves only:

```css
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1)  /* premium ease-out — for shadow, transform */
--ease-quick:  cubic-bezier(0.4, 0, 0.2, 1)   /* material — for color, background */

--motion-fast:    160ms var(--ease-quick)   /* color/bg shifts: row hover */
--motion-hover:   280ms var(--ease-smooth)  /* card lifts, shadow expansion */
--motion-reveal:  240ms var(--ease-smooth)  /* fade-ins: sparklines, → arrows */
```

**Motion rules:**
- ✅ Card hover always uses `--motion-hover` (280ms smooth) for transform AND shadow.
- ✅ Reveal-on-hover (sparklines, action arrows) uses `--motion-reveal` (240ms smooth).
- ✅ Color/background changes use `--motion-fast` (160ms quick).
- ❌ Never use linear easing.
- ❌ Never animate longer than 320ms — feels sluggish.
- ❌ Never animate `width` or `height` of a card on hover — only transform and box-shadow.

---

## 3. Layout shell

### 3.1 Three-column app shell

```css
:root {
  --shell-sidebar:  clamp(232px, 16vw, 272px);
  --shell-rail:     clamp(320px, 22vw, 380px);
  --shell-utility-h: 56px;
}

.app {
  display: grid;
  grid-template-columns: var(--shell-sidebar) minmax(0, 1fr) var(--shell-rail);
  min-height: 100vh;
}

@media (max-width: 1180px) {
  .app { grid-template-columns: var(--shell-sidebar) minmax(0, 1fr); }
  .rail { display: none; }
}
@media (max-width: 880px) {
  .app { grid-template-columns: 1fr; }
  .sidebar { display: none; }
}
```

**Shell rules:**
- ✅ Sidebar and rail are sticky, full viewport height, internal scroll.
- ✅ Main column is `minmax(0, 1fr)` — never set a max-width. Stripe-style: full edge-to-edge with generous padding.
- ✅ Sidebar/rail widths fluid via clamp — comfortable on 1280, premium on 2560.
- ❌ Never set a max-width on the main content column. Padding handles legibility.

### 3.2 Sticky utility bar

- Height: `var(--shell-utility-h)` (56px default, 44px in compact mode)
- Background: `rgba(250, 250, 247, 0.78)` with `backdrop-filter: saturate(140%) blur(10px)` — frosted-glass scroll feel
- Sticky `top: 0; z-index: 30`, hairline-2 bottom border
- Contains: search trigger (cmd+K), divider, breadcrumb, grow, icon buttons (notifications/help)

### 3.3 Content padding rhythm

```css
.content {
  padding: var(--space-7) var(--space-7) var(--space-9);
  display: flex; flex-direction: column;
  gap: var(--space-8);
}
```

- Top/horizontal: `--space-7` (28–38px fluid)
- Bottom: `--space-9` (48–72px fluid) — generous tail
- Section gap: `--space-8` (36–52px) — magazine breathing

---

## 4. Card primitive

### 4.1 Base card

```css
.card {
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}
.card:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-1px);
}
.card.no-hover:hover { transform: none; box-shadow: var(--shadow-card); }
```

**Card variants:**
- `.card` — default white, lifts on hover
- `.card.no-hover` — non-interactive (pure container)
- `.goal-hero` — special hero card with subtle radial atmospheric gradient
- `.kpi` — KPI card with container-query enabled

### 4.2 Card head

```css
.card-head {
  padding: 18px 28px 16px;
  display: flex; align-items: center; gap: 12px;
  border-bottom: 1px solid var(--hairline-2);
}
.card-head .ic     /* 16px icon, text-3 */
.card-head .title  /* 15px Geist (--type-h3), font-weight: 500, text-1 */
.card-head .meta   /* 13px text-3 (--type-small), separated by · with text-4 */
.card-head .grow   /* flex: 1 spacer */
.card-head .action /* anchor with hover lift, → arrow translates 2px right on hover */
```

### 4.3 Card foot

```css
.card-foot {
  background: var(--surface-2);
  border-top: 1px solid var(--hairline-2);
  padding: 11px 28px;
  font-size: 13px;          /* --type-small */
  color: var(--text-3);
}
```

---

## 5. Button system

### 5.1 Default button

```css
.btn {
  height: 34px;
  padding: 0 14px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border: none;
  border-radius: var(--radius-button);
  font-size: 14px; font-weight: 500;          /* --type-body */
  letter-spacing: -0.005em;
  display: inline-flex; align-items: center; gap: 8px;
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}
.btn:hover { box-shadow: var(--shadow-pop); transform: translateY(-1px); }
```

### 5.2 Primary button — gradient + glow

```css
.btn-primary {
  background: linear-gradient(180deg, #1A6E55 0%, #0F4F3D 100%);
  color: #fff;
  box-shadow: var(--shadow-cta);
}
.btn-primary:hover {
  box-shadow: var(--shadow-cta-hover);
  transform: translateY(-1px);
}
```

Inset `rgba(255, 255, 255, 0.18)` highlight at top of gradient = glass-button feel.

### 5.3 Ghost button (used in goal hero eyebrow)

```css
.ghost-btn {
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--text-2);
}
.ghost-btn:hover {
  background: var(--surface-2);
  border-color: var(--text-4);
  color: var(--text-1);
}
```

### 5.4 Icon button

```css
.icon-btn {
  width: 32px; height: 32px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-button);
}
.icon-btn:hover {
  box-shadow: var(--shadow-pop);
  color: var(--text-1);
  transform: translateY(-1px);
}
```

### 5.5 Inline kbd chip

```css
.kbd {
  font-family: var(--font-mono);
  font-size: 12px;          /* --type-tiny — WCAG floor */
  background: var(--surface-2);
  box-shadow: 0 0 0 1px var(--hairline);
  border-radius: 4px;
  padding: 1px 5px;
}
```

Pair with action labels: `Run audit <kbd>⌘R</kbd>`, `Export <kbd>E</kbd>`. Inside primary buttons use rgba-white kbd: `background: rgba(255,255,255,0.14)`.

---

## 6. Pills, chips, badges

### 6.1 Status pill

```css
.status-pill {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 5px 11px 5px 9px;
  background: var(--success-soft);   /* or warning-soft, error-soft */
  color: var(--success);             /* matches bg semantic */
  border-radius: var(--radius-pill);
  font-size: 12px; font-weight: 500;          /* --type-tiny */
  letter-spacing: 0.06em;
  font-variant-caps: all-small-caps;
  box-shadow: 0 0 0 1px rgba(27,110,69,0.12);
}
```

Reads as "ON TRACK" via small caps. Always paired with an SVG check/warning icon.

### 6.2 Effort/impact pills (in diagnostics)

Tiny capsule chips, semantic-colored:

```css
.effort-impact .pill {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--surface-2);
  font-size: 12px;          /* --type-tiny */
  letter-spacing: 0.06em;
  font-variant-caps: all-small-caps;
}
.effort-impact .pill.low-e   { background: var(--success-soft); color: var(--success); }
.effort-impact .pill.med-e   { background: var(--warning-soft); color: var(--warning); }
.effort-impact .pill.hi-e    { background: var(--error-soft);   color: var(--error); }
.effort-impact .pill.high-i  { background: var(--accent-soft);  color: var(--accent); }
```

### 6.3 Intent badges (in keyword table)

Pill-shaped, semantic background+color:

```
.intent-comm  — Commercial    (accent-soft / accent)
.intent-info  — Informational (info-soft / info)
.intent-trans — Transactional (warning-soft / warning)
.intent-nav   — Navigational  (surface-2 / text-2)
```

### 6.4 Counts in tabs

```css
.kw-tab .count {
  font-size: 12px;          /* --type-tiny */
  background: var(--surface-2);
  color: var(--text-3);
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  font-variant-numeric: tabular-nums lining-nums;
}
.kw-tab.active .count { background: var(--accent-soft); color: var(--accent); }
```

---

## 7. Hero numerals — the editorial moment

### 7.1 Goal hero progress block (the v5 redesign)

**The composition:**

```
[──── progress numbers ────]    [──── status / ETA ────]
  12   /   20                     ● on track
  mega smaller smaller             ETA Jul 18
                                   13 days ahead

[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]  ← bar with target marker

60% to goal · 8 to land · +3 last 7d · +12 last 30d  ← detail row
```

**Critical proportions:**
- `12` (now): `clamp(58px, 4.8vw, 80px)` Newsreader 400, letter-spacing -0.034em, color text-1
- `/` (divider): `clamp(38px, 3.2vw, 52px)` Newsreader 300, letter-spacing -0.024em, color **text-4** (whisper)
- `20` (target): `clamp(38px, 3.2vw, 52px)` Newsreader 400, letter-spacing -0.024em, color **text-3** (muted)
- Gap between: 8px — tight, reads as `12/20` unit
- Status block right-aligned, padding-top 4px to align baselines

**Why this works:**
- The `12` carries 100% visual weight as the answer
- `/ 20` is supportive, smaller, muted — reads as "out of"
- Status pill + ETA on the right balances composition without competing
- Progress bar lives below as the visual proof
- Detail row at bottom with `60% to goal` first, then metrics — reads left-to-right as story

### 7.2 KPI numeral

```css
.kpi .v {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: var(--num-card);   /* clamp(36px, 3vw, 44px) */
  letter-spacing: -0.026em;
  font-variant-numeric: tabular-nums lining-nums;
  font-optical-sizing: auto;
  margin-bottom: 14px;
  display: flex; align-items: baseline; gap: 6px;
}
.kpi .v .unit {
  font-size: 18px;
  color: var(--text-3);
  font-family: var(--font-sans);  /* unit reverts to sans */
  font-weight: 400;
}
```

### 7.3 Editorial sentence (goal-line)

```css
.t-goal-line {
  font-family: var(--font-display);
  font-size: clamp(24px, 1.95vw, 30px);
  line-height: 1.25;
  letter-spacing: -0.018em;
  color: var(--text-1);
  font-optical-sizing: auto;
}
.t-goal-line em { font-style: italic; color: var(--text-1); }
```

Use only for the page-defining sentence (goal contract, tagline, headline answer). Max one per page.

---

## 8. Tables

### 8.1 Layout

CSS Grid, never `<table>`-style flex. Use `display: grid` + `grid-template-columns` with `minmax()`.

```css
.kw-table-head, .kw-row {
  display: grid;
  grid-template-columns: minmax(260px, 2.4fr) 0.7fr 1fr 0.6fr 0.9fr minmax(140px, 1.3fr) 0.5fr;
  gap: 14px;
  padding: 16px 28px;
}
```

### 8.2 Row hover

```css
.kw-row {
  border-top: 1px solid var(--hairline-2);
  transition: background var(--motion-fast);
  cursor: pointer;
}
.kw-row:hover { background: var(--surface-2); }
```

Subtle shift, no heavy zebra. The hover is a feedback signal, not a permanent state.

### 8.3 Priority indicator

```css
.kw-row.priority::before {
  content: ""; position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px; background: var(--accent);
}
```

2px accent left bar = priority/pinned. Never use highlight backgrounds for priority — they read as zebra.

### 8.4 Hover-reveal `→` arrow

```css
.kw-cell-go {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity var(--motion-reveal), color var(--motion-reveal), transform var(--motion-reveal);
}
.kw-row:hover .kw-cell-go {
  opacity: 1;
  color: var(--accent);
  transform: translateX(0);
}
```

The Linear/Superhuman tell: row reveals navigate-to-detail affordance only on hover.

### 8.5 Tabs (sliding underline)

```css
.kw-tab.active::after {
  content: "";
  position: absolute;
  left: 16px; right: 16px; bottom: -1px;
  height: 2px;
  background: var(--accent);
  border-radius: 1px 1px 0 0;
}
```

Sits over the parent's bottom hairline. Smoother than `border-bottom` swap.

---

## 9. Charts

### 9.1 SVG conventions

- Use `<svg viewBox="..." preserveAspectRatio="none">` for charts that should stretch fluidly to container width.
- For pixel-precise charts (small ones), use `preserveAspectRatio="xMidYMid meet"` (default).
- All chart text uses `font-family="Geist"` or `font-family="Newsreader"` inline (referenced from CSS variables won't work in SVG attribute strings — use direct names).
- Always add `font-variant-numeric="tabular-nums lining-nums"` to numeric labels.

### 9.2 Distribution bars (signature pattern)

The "Stripe register" hatched bars:

```css
.dist-bar.curr.goal {
  background-color: var(--accent);
  background-image: repeating-linear-gradient(45deg,
    transparent 0, transparent 4px,
    rgba(255, 255, 255, 0.16) 4px, rgba(255, 255, 255, 0.16) 5px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
}
```

**Hatch pattern rules:**
- 45° angle
- 4px transparent / 1px white-overlay (about 16% opacity on dark fills, 22% on tint fills)
- Always include `inset 0 1px 0 rgba(255,255,255,0.X)` for top edge highlight
- Goal-zone buckets get `--accent` fill; non-goal current period gets `--accent-tint`; previous period gets `--surface-2` with darker hatch

### 9.3 Trajectory chart legend

Move legend to bottom-right of chart card, not top. Smaller. Three swatches with semantic dashes:
- Solid 2px line — Actual
- 1px dashed top border — Required pace
- 8px filled semi-transparent — Forecast band

### 9.4 Numerals above bars

```css
.dist-bar .v {
  position: absolute;
  top: -32px;
  font-family: var(--font-display);
  font-size: clamp(20px, 2vw, 26px);
  letter-spacing: -0.022em;
  font-variant-numeric: tabular-nums lining-nums;
  font-optical-sizing: auto;
}
```

Numerals float above bars by 32px. Generous headroom on the bars container (`padding: 32px 0 16px`).

---

## 10. Right rail patterns

### 10.1 Rail shell

- Background: `var(--canvas)` (matches sidebar — frames main content)
- Sticky utility bar matches main bar height
- Sections separated by `1px solid var(--hairline-2)`, padded `22px 22px 20px`

### 10.2 Today event feed (Linear/Superhuman tell)

```
[14:23] [3 keywords moved into top 10]
        Ranking · gain (semantic colored tag)

[11:08] [running shoes review hit position 4]
        Top 10 · new
```

- Two-column: timestamp (44px, mono) + body
- Tag at bottom: `font-variant-caps: all-small-caps`, semantic dot+color
- Day dividers (`Yesterday`) with hairline trail

### 10.3 Health gauge

96×96 SVG arc with stroke-dasharray. Number centered, italic grade beside.

```html
<svg viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="38" fill="none" stroke="#F2F1EB" stroke-width="7"/>
  <circle cx="48" cy="48" r="38" fill="none" stroke="#0F4F3D" stroke-width="7" stroke-linecap="round" stroke-dasharray="196 239" pathLength="239"/>
</svg>
```

`pathLength="239"` lets you set the dasharray as `score * 239 / 100`. Cleaner than computing circumference.

### 10.4 Up next rows

Action queue. 3 rows max. Each row: 26×26 icon (semantic-tinted) + title + meta with effort/impact pills.

Hover: `transform: translateX(2px)` and title color → accent.

---

## 11. Hover-to-reveal patterns

The Linear/Superhuman discipline:

| Element | Resting | On hover |
|---|---|---|
| KPI sparkline | `opacity: 0` | Fades in with 4px x-translate |
| KPI menu (`⋯`) | `opacity: 0` | Fades in |
| Keyword row `→` arrow | `opacity: 0`, `translateX(-4px)` | Fades in to `opacity: 1`, `translateX(0)`, color → accent |
| Nav kbd hint (`G O`) | `opacity: 0` | Fades in |
| Card-head action `→` | Static at 0 | `transform: translateX(2px)` |
| Card | At rest shadow | Lifts by 1px, shadow-lift |
| Up next row | At rest | `transform: translateX(2px)` |

**Reveal rule:** Anything secondary (sparkline, menu, navigate-to arrow) is hidden at rest. The page is calm. Hover is your moment of detail.

---

## 12. Container queries (the dynamic-sizing key)

Cards that have internal grids should use **container queries**, not viewport media queries. This is what makes the layout adapt correctly when:
- Rail is open vs hidden (main column changes width)
- Sidebar is wide vs compact
- Card is half-width inside a 2-col strip

```css
.goal-hero {
  container-type: inline-size;
  container-name: hero;
}
@container hero (max-width: 880px) {
  .gh-grid { grid-template-columns: 1fr; }   /* stack progress + chart */
}
@container hero (max-width: 720px) {
  .velocity-strip, .subgoals { grid-template-columns: 1fr; }
}
```

Same pattern applies to `.kpi`, `.dist-wrap`. **Use container queries for card-internal responsiveness; use media queries only for the app shell breakpoints.**

---

## 13. Responsive breakpoints

### 13.1 App shell breakpoints

```
≥ 1180px   3-column shell (sidebar + main + rail)
880–1179   2-column shell (sidebar + main, rail hidden)
< 880px    Single column (mobile, no sidebar — would need hamburger)
```

### 13.2 Compact-height mode (laptop browsers)

```css
@media (max-height: 780px) {
  /* shorter sticky bar, tighter section gap, smaller hero numeral */
}
```

Targets 13" MacBook Air with bookmarks bar (effective height ~700–780px).

### 13.3 Reduced motion

Always honor `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 14. Specific patterns

### 14.1 Crumb strip (page-level)

```html
<div class="crumb-strip">
  <span class="name">Acme Corp</span>
  <span class="sep">·</span>
  <span class="mono">acmecorp.com</span>
  <span class="sep">·</span>
  <span>United States</span>
  <span class="sep">·</span>
  <span class="sync"><span class="dot"></span>Last sync <span class="mono">2h ago</span></span>
</div>
```

- Identity in plain text (text-1 for name, text-3 for the rest)
- Domain in mono
- Separators in text-4 (whisper)
- Live-state indicator: tiny dot with success-soft halo

### 14.2 Period selector

3px-padded pill containing 4 buttons (7D/30D/90D/1Y). Active button gets `--accent-soft` background + `--accent-ink` text. Other buttons hover to `--surface-2`.

### 14.3 Velocity strip (in goal hero)

Two-cell grid with 2px accent left bar (first cell) and text-4 left bar (second cell). Each cell: tiny uppercase label + value with inline `.num` (tabular) and `em` italic anchors.

### 14.4 Sub-goals strip

Hairline-separated bottom strip in goal hero. Each subgoal: 24×24 semantic-tinted icon + text + small-caps tag. Vertical hairline divider between cells.

### 14.5 Pipeline stages (with relative-volume bars)

Each stage shows: label (small-caps), count (Newsreader serif), 3px volume bar showing relative %. Active stage ("Published") has subtle linear-gradient tint + accent fill on its bar.

### 14.6 Severity dots (audit findings)

Each tier cell shows count of severity dots (matching the tier color). Visual at-a-glance scale without bars.

```html
<div class="severity-dots">
  <span class="dot on"></span>
  <span class="dot on"></span>
  <span class="dot on"></span>
</div>
```

5 dots max per cell — beyond that, switch to numeric.

---

## 15. Do's & Don'ts

### Do's ✅

- ✅ One editorial moment per page (one big serif numeral that answers).
- ✅ Cards float on canvas via shadow, never `border: 1px solid`.
- ✅ Lift cards 1px on hover with shadow expansion.
- ✅ Hide secondary actions (sparklines, menus) until hover.
- ✅ Use Newsreader for headlines and numerals; Geist for UI; Geist Mono for data.
- ✅ Apply `tabular-nums lining-nums` to all data; `oldstyle-nums` to prose.
- ✅ Use italic only semantically (proper nouns, dates, paths, anchors).
- ✅ Use `font-variant-caps: all-small-caps` for titles, never `text-transform: uppercase` (kerning).
- ✅ Use container queries for card internals; media queries for shell.
- ✅ Use `clamp()` for every spacing and type token.
- ✅ Honor `prefers-reduced-motion`.
- ✅ Keep one chromatic accent (emerald). Tints via `*-soft`.
- ✅ Test at 1280, 1440, 1920, 2560 viewports.
- ✅ Test at `max-height: 720px` (small laptops).

### Don'ts ❌

- ❌ No dot-grain or noise textures on canvas.
- ❌ No tinted card backgrounds for primary content (cream is for canvas only).
- ❌ No max-width constraints on the main content column.
- ❌ No solid `border: 1px solid` on cards. Use the shadow system.
- ❌ No `text-transform: uppercase` on small text (use small-caps).
- ❌ No `font-family: Inter` — too generic, the AI-look tell.
- ❌ No `slate` ladder from Tailwind defaults — too cool.
- ❌ No competing chromatic accents. One green, period.
- ❌ No fake glow halos. Shadow expansion only.
- ❌ No `linear` easing. Always cubic-bezier.
- ❌ No `transition: all`. Specify properties.
- ❌ No animation longer than 320ms.
- ❌ No `transform: scale()` on hover (cheap-feeling). Use `translateY`.
- ❌ No `display: table`. Use grid.
- ❌ No zebra-striped table rows. Use hover background only.
- ❌ No standalone Unicode arrows next to large numerals (`12 ↓` reads weak). Use color, section context, or paired `from-to` chips.
- ❌ No `pulse` animations on live indicators (gimmicky). Static colored dot is enough.
- ❌ No "AI look" tells: gradient mesh backgrounds, neumorphism, glassmorphism on cards (only on sticky bars), neon accents, generic stock dashboards.

---

## 16. The "AI look" anti-patterns

These are the specific tells that make a dashboard feel AI-generated. Avoid all of them:

| Tell | Why it fails | Fix |
|---|---|---|
| Inter / SF / Helvetica system stack | Default everywhere, no register | Use Geist + Newsreader |
| Size-only hierarchy (12/14/16/20/32) | No type contrast | Mix sans for UI, serif for hero, mono for data |
| `font-feature-settings: "ss01"` only | Single-style figures | Apply both lining-tabular AND old-style-proportional contextually |
| Tailwind slate text ramp | Too cool, default | Warmth-shifted ramp (#54545A vs slate-600) |
| Universal `line-height: 1.5` | Body-text leading on headings | 0.95 on numerals, 1.05 on h1, 1.45–1.55 on body |
| No italic anywhere | Pure regular weights only | Use italic semantically (proper nouns, dates, anchors) |
| No small-caps anywhere | All caps via `text-transform` (poor kerning) | Use `font-variant-caps: all-small-caps` for OpenType glyphs |
| Hatched pattern overuse | Signature → noise | Reserve hatching for distribution bars + progress fill, nowhere else |
| Dot-grain background | "Designed" texture | Plain canvas. The system isn't trying to feel designed; it IS designed. |
| Rainbow palette | Multiple chromatic accents | One accent only. Semantics use *-soft tints. |
| Tinted feature boxes | Cream/colored cards as content panels | White cards on canvas. Tinted is for canvas only. |
| Glow halos on hover | Fake light | Shadow expansion only |
| Pulsing live dots | Animation gimmick | Static dot with soft halo |
| Standalone arrow indicators next to numerals | `12 ↓` reads orphaned | Use color (text-error), `from-to` text, or rely on section context |
| `text-transform: uppercase` for titles | Tracking unbalanced | `font-variant-caps: all-small-caps` (real OpenType glyphs) |

---

## 17. Implementation checklist (per page)

When building a new page in the system:

1. ☐ Use the 3-col shell as base (sidebar + main + rail)
2. ☐ Sticky utility bar at top with frosted-glass background
3. ☐ Crumb strip → page header with serif title → period chips + actions
4. ☐ Identify the **one editorial moment** for this page (the answer the user came for) — give it the serif mega numeral treatment
5. ☐ KPI strip below: 4 cards in `auto-fit minmax(232px, 1fr)` grid
6. ☐ Visual anchor (chart): full-width white card, dominant
7. ☐ Data table or list: full-width card with tabs/filters
8. ☐ Diagnostic / forecast section: 3-col internal grid with hairline dividers
9. ☐ Pipeline / status strips at bottom
10. ☐ Ops strip (system status) at very bottom
11. ☐ Right rail: Today feed + health + up next + activity
12. ☐ Apply `--motion-hover` lift to all cards
13. ☐ Hide all secondary actions (sparklines, menus, → arrows) until hover
14. ☐ Test at 1280 / 1440 / 1920 / 2560 widths
15. ☐ Test at `max-height: 760px` (compact mode)
16. ☐ Verify all numerals use `tabular-nums lining-nums`
17. ☐ Verify body prose uses `oldstyle-nums proportional-nums`
18. ☐ Verify italic is used only for semantic emphasis
19. ☐ Verify only one chromatic accent on page
20. ☐ Honor `prefers-reduced-motion`

---

## 18. Component map (file references)

Reference implementations in the v6 prototype:

| Component | File | Locator |
|---|---|---|
| App shell | `client-hub-v6.html` | `.app` grid |
| Sidebar | `client-hub-v6.html` | `<aside class="sidebar">` |
| Sticky utility | `client-hub-v6.html` | `<div class="utility">` |
| Page header | `client-hub-v6.html` | `<div class="page-head">` |
| Goal hero | `client-hub-v6.html` | `<section class="goal-hero">` |
| Progress block | `client-hub-v6.html` | `<div class="progress-block">` |
| Trajectory chart | `client-hub-v6.html` | `<div class="trajectory">` |
| Velocity strip | `client-hub-v6.html` | `<div class="velocity-strip">` |
| Sub-goals | `client-hub-v6.html` | `<div class="subgoals">` |
| KPI grid | `client-hub-v6.html` | `<section class="kpi-grid">` |
| Distribution chart | `client-hub-v6.html` | `<section class="dist-wrap">` |
| Keywords table | `client-hub-v6.html` | `<section class="card kw-card">` |
| Forecast & diag | `client-hub-v6.html` | `<section class="card forecast-card">` |
| Pipeline stages | `client-hub-v6.html` | `<div class="pipeline-stages">` |
| Audit tiers | `client-hub-v6.html` | `<div class="audit-tiers">` |
| Right rail | `client-hub-v6.html` | `<aside class="rail">` |
| Today feed | `client-hub-v6.html` | `<section class="rail-section">` (first) |
| Health gauge | `client-hub-v6.html` | `<div class="rail-health">` |
| Up next | `client-hub-v6.html` | `<div class="up-next-row">` |

---

## 19. Migration plan to production (apps/web)

### Phase 44 (recommended): Design System Foundation

1. **Tokens layer** — Add `apps/web/src/lib/design/tokens.css` with all CSS variables from §2.
2. **Tailwind config** — Map tokens to Tailwind theme so `bg-surface`, `text-text-1`, `shadow-card` etc. work natively.
3. **Font loading** — Add Newsreader + Geist + Geist Mono to `apps/web/src/app/layout.tsx` via Next.js `next/font/google`.
4. **Shell components** — Build `<AppShell>`, `<Sidebar>`, `<Rail>`, `<UtilityBar>` as React components with the exact CSS from §3.
5. **Card primitives** — `<Card>`, `<CardHead>`, `<CardFoot>` as composable primitives.
6. **Type primitives** — `<PageTitle>`, `<NumMega>`, `<NumHero>`, etc. matching §7.
7. **Chart components** — `<DistributionChart>`, `<TrajectoryChart>`, `<HealthGauge>` as React Server Components with SVG output.

### Phase 45: Per-page migration

Migrate one page at a time, starting with `dashboard/page.tsx` → goal-hero variant per client.

---

*End of design system v6 — accessibility-first.*
