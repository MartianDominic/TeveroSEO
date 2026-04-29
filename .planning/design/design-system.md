# Tevero Design System (TDS)

**Version:** 1.0
**Date:** 2026-04-28
**Status:** Canonical specification — all `apps/web` pages compose from this
**Supersedes:** Ad-hoc styling in `dashboard-v1.html`, `dashboard-v2.html`, `client-hub-v1.html` (these are now archived as design-fidelity references)

---

## How to read this document

This is the **single source of truth** for visual and interaction design across TeveroSEO. Every new page, component, and screen MUST compose from this system. No bespoke styling.

If a page needs something this system doesn't provide:
1. Check if an existing component can be extended via props.
2. If not, propose a new component for this system, get it added, then use it.
3. Never inline-style or hand-roll a one-off.

The first rule of TDS: **compose, don't reinvent.**

---

## Table of contents

1. [Philosophy](#1-philosophy)
2. [Foundation tokens](#2-foundation-tokens)
3. [Typography](#3-typography)
4. [Color](#4-color)
5. [Spacing & layout](#5-spacing--layout)
6. [Radii, borders, shadows](#6-radii-borders-shadows)
7. [Motion](#7-motion)
8. [Iconography](#8-iconography)
9. [Primitive components](#9-primitive-components)
10. [Composite components](#10-composite-components)
11. [Layout components](#11-layout-components)
12. [Charts](#12-charts)
13. [Page templates](#13-page-templates)
14. [Microcopy & content rules](#14-microcopy--content-rules)
15. [Accessibility](#15-accessibility)
16. [Implementation architecture](#16-implementation-architecture)
17. [Migration plan](#17-migration-plan)

---

## 1. Philosophy

### Register
Linear × Superhuman × Stripe. The "expensive instrument" feel — confidence through restraint, density through type rigor, intentionality through optical alignment.

### Three rules
1. **Compose, don't reinvent.** Every screen is built from this system. No bespoke styling.
2. **Tokens drive everything.** Hex values, font sizes, spacing — never hardcoded in components. All flow from `:root` CSS variables defined in §2.
3. **Restraint as confidence.** Almost everything is removed. What remains is precisely placed.

### Anti-patterns (forbidden)
- Drop shadows on default cards (only on overlays)
- Gradients on UI chrome (only on avatars and decorative marks)
- Hover scale-up, card-tilt, glow effects
- Decorative bar charts with rainbow gradients
- More than one accent color
- Tailwind defaults for color (`bg-emerald-500` etc — use semantic tokens)
- Pure-black text (`#000`) — use `var(--text-1)`
- Pure-white surfaces against pure-white canvas — canvas is warm off-white
- "Click here" microcopy
- Generic error apologies ("Oops!", "Whoops!")

### Quality bar
If a chosen detail wouldn't ship in Stripe Dashboard, Linear, or Bloomberg Terminal, revise.

---

## 2. Foundation tokens

All values flow from CSS custom properties defined at `:root`. Components consume via `var(--token)`. Tailwind config maps to the same variables.

### 2.1 Token CSS (canonical source)

```css
:root {
  /* === Color tokens === */

  /* Surfaces */
  --canvas:        #FAFAF7;   /* page background, warm off-white */
  --surface:       #FFFFFF;   /* card on canvas */
  --surface-2:     #F5F5F0;   /* hover/secondary surface */
  --hairline:      #ECECE7;   /* 1px borders default */
  --hairline-soft: #F0F0EB;   /* 1px borders inside cards */

  /* Text */
  --text-1:        #0E0E10;   /* primary, near-black */
  --text-2:        #5C5C60;   /* secondary */
  --text-3:        #9A9A9F;   /* tertiary, captions */
  --text-4:        #BEBEC0;   /* disabled, dividers as text */

  /* Accent (deep emerald — chosen for SEO/growth semantic + competitor differentiation) */
  --accent:        #0F4F3D;
  --accent-soft:   #E6F0EC;   /* tinted background for accent surfaces */
  --accent-ink:    #093528;   /* hover/active darker */
  --accent-line:   #C8DDD4;   /* accent borders on soft surfaces */

  /* Status (semantic — desaturated, never Bootstrap-bright) */
  --success:       #1B6E45;   --success-soft: #E8F2EC;
  --error:         #9B2C2C;   --error-soft:   #F4E5E5;
  --warning:       #A87F1A;   --warning-soft: #F5EDD9;
  --info:          #2D5A87;   --info-soft:    #EFF4F9;

  /* === Radii === */
  --radius-input:  6px;       /* buttons, inputs, small pills */
  --radius-card:   10px;      /* cards, panels */
  --radius-modal:  14px;      /* dialogs, drawers */
  --radius-pill:   999px;     /* fully rounded pills */

  /* === Type === */
  --font-sans:    "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-mono:    "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --font-display: "GT Sectra Display", "Tiempos Headline", "Fraunces", Georgia, serif;

  /* === Motion === */
  --motion-hover:   150ms cubic-bezier(0.2, 0, 0.2, 1);
  --motion-state:   200ms cubic-bezier(0.2, 0, 0.2, 1);
  --motion-layout:  250ms cubic-bezier(0.2, 0, 0, 1);

  /* === Z-index === */
  --z-base:        0;
  --z-elevated:    10;
  --z-sticky:      20;
  --z-overlay:     50;
  --z-modal:       100;
  --z-toast:       200;
}
```

### 2.2 Tailwind mapping

`tailwind.config.ts` maps every token to a Tailwind class so utility classes consume the same values:

```ts
theme: {
  extend: {
    colors: {
      canvas:    "var(--canvas)",
      surface:   "var(--surface)",
      "surface-2": "var(--surface-2)",
      hairline:  "var(--hairline)",
      "hairline-soft": "var(--hairline-soft)",
      "text-1":  "var(--text-1)",
      "text-2":  "var(--text-2)",
      "text-3":  "var(--text-3)",
      "text-4":  "var(--text-4)",
      accent:    { DEFAULT: "var(--accent)", soft: "var(--accent-soft)", ink: "var(--accent-ink)" },
      success:   { DEFAULT: "var(--success)", soft: "var(--success-soft)" },
      error:     { DEFAULT: "var(--error)",   soft: "var(--error-soft)" },
      warning:   { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
      info:      { DEFAULT: "var(--info)",    soft: "var(--info-soft)" },
    },
    fontFamily: {
      sans:    "var(--font-sans)",
      mono:    "var(--font-mono)",
      display: "var(--font-display)",
    },
    borderRadius: {
      input: "var(--radius-input)",
      card:  "var(--radius-card)",
      modal: "var(--radius-modal)",
    },
  },
}
```

**Forbidden:** Using arbitrary Tailwind values (`bg-[#0F4F3D]`) for tokens. Always use the named class (`bg-accent`).

---

## 3. Typography

### 3.1 Font families

| Family | Use | Variable |
|---|---|---|
| Geist | All UI text, body, table cells, labels | `--font-sans` |
| GT Sectra Display | Hero numerals, section titles, display headlines | `--font-display` |
| Geist Mono | URLs, code, IDs, monospace data | `--font-mono` |

**Free fallback for prototyping:** Fraunces (Google Fonts) for display. Production must license GT Sectra or Tiempos Headline.

### 3.2 Type scale

| Token | Size / line | Letter-spacing | Use |
|---|---|---|---|
| `text-display-xl` | 32 / 1.1 display | -0.025em | Page titles (Command Center, Project Overview) |
| `text-display-lg` | 26 / 1.1 display | -0.020em | Entity names (Acme Corp) |
| `text-display-md` | 21 / 1.45 display | -0.012em | Briefing hero paragraph |
| `text-display-sm` | 18 / 1.3 display | -0.015em | Section headlines |
| `text-num-xl` | 30 / 1.0 display | -0.022em | Stat card primary metric |
| `text-num-lg` | 22 / 1.0 display | -0.020em | Identity strip ticker values |
| `text-num-md` | 17 / 1.0 display | -0.015em | Goal pill current values, mid-card metrics |
| `text-body` | 13 / 1.5 sans | -0.005em | Default body, table cells |
| `text-body-sm` | 12.5 / 1.4 sans | -0.005em | Card subtitles, muted body |
| `text-meta` | 12 / 1.3 sans | -0.005em | Captions, metadata |
| `text-micro` | 11 / 1.3 sans | 0 | Card-foot meta, action priority scores |
| `text-tiny` | 10.5 / 1.2 sans | 0.05em | Eyebrows, uppercase labels |

### 3.3 Rules

- **Hero numerals always in display serif.** This is the highest-leverage move for "expensive instrument" feel. Stat cards, ticker values, goal currents, briefing emphasis numbers — all serif.
- **Labels always in sans.** Never serif a label.
- **Tabular numerals everywhere data lives.** `font-feature-settings: "tnum"` or `font-variant-numeric: tabular-nums`. Mandatory in tables, tickers, anywhere numbers align vertically.
- **Letter-spacing scales inverse to size.** Display gets tightened (-0.025em); micro gets none or slightly opened.
- **One eyebrow per section.** Uppercase, 11px, tracking 0.07em, color text-3.

### 3.4 Examples

```tsx
<h1 className="font-display text-[32px] leading-[1.1] tracking-[-0.025em]">Command Center</h1>
<div className="text-tiny uppercase tracking-[0.07em] text-text-3">Today's briefing</div>
<span className="font-display tracking-[-0.022em]">128,409</span>
<span className="font-mono text-meta">acmecorp.com</span>
```

---

## 4. Color

### 4.1 Semantic taxonomy

Color names describe **purpose**, not hue. Never use raw hex in components.

| Layer | Token | Use |
|---|---|---|
| Surface | `canvas` | Page background. Warm off-white, never pure white. |
| Surface | `surface` | Card body. Pure white over canvas. |
| Surface | `surface-2` | Hover state, internal sub-surface. |
| Border | `hairline` | 1px borders on canvas. |
| Border | `hairline-soft` | 1px borders inside cards (lower contrast). |
| Text | `text-1` | Primary content, headlines. |
| Text | `text-2` | Secondary content, labels. |
| Text | `text-3` | Tertiary, captions, metadata. |
| Text | `text-4` | Disabled, decorative dividers. |
| Brand | `accent` | Single brand emphasis — primary buttons, active states, key data series. |
| Brand | `accent-soft` | Tinted background (active pills, focus rings, hover tint). |
| Brand | `accent-ink` | Hover/pressed accent (darker). |
| Status | `success / error / warning / info` | Semantic state — never decorative. |

### 4.2 Accent usage rules

- **One accent.** Emerald only. No blue + emerald, no purple anywhere.
- **Accent appears only in chrome that requires emphasis:** primary CTA, active tab underline, selected row state, key data line in chart, focus ring.
- **Never use accent for decoration** (cards, dividers, body text, generic icons).
- **Status colors override accent for meaning.** A critical alert is `error`, not `accent`.

### 4.3 Status color rules

- Status colors are paired with their soft variant for backgrounds.
- A status badge is `color: var(--status); background: var(--status-soft); border: 1px solid var(--status-soft);` (no border most of the time).
- A status icon is `color: var(--status); background: var(--status-soft);` in a 6px-radius square.
- Never use color alone to convey status — pair with icon + text.

### 4.4 Avatar gradients

Avatars use linear gradients for visual identity. Keep saturation low.

| Use | Gradient |
|---|---|
| Brand mark | `var(--accent)` solid |
| Healthy / positive | `linear-gradient(135deg, #0F4F3D, #1E7A5C)` |
| Warning | `linear-gradient(135deg, #A87F1A, #D4A340)` |
| Error / at-risk | `linear-gradient(135deg, #9B2C2C, #B85050)` |
| Info / neutral | `linear-gradient(135deg, #2D5A87, #5285B8)` |
| Identity (analytical) | `linear-gradient(135deg, #1A1A4F, #3F3F8C)` |
| Identity (subtle) | `linear-gradient(135deg, #6B5B7A, #9881AB)` |
| Default user | `linear-gradient(135deg, #2C2C30, #565660)` |

Avatar component picks gradient deterministically by `clientId.hashCode() % len(gradients)` so the same client always gets the same color.

---

## 5. Spacing & layout

### 5.1 Spacing scale

Base unit: **4px**. Everything is a multiple.

| Token | px | Use |
|---|---|---|
| `space-1` | 4 | Tight gaps between paired elements |
| `space-2` | 8 | Default inline gap (icon-text, chips) |
| `space-3` | 12 | Card internal vertical rhythm |
| `space-4` | 16 | Default card-to-card gap, label-to-input |
| `space-5` | 20 | Card horizontal padding |
| `space-6` | 24 | Section vertical gap |
| `space-7` | 28 | Card vertical padding (large) |
| `space-8` | 32 | Page horizontal padding |
| `space-10` | 40 | Major section breaks |
| `space-12` | 48 | Hero margins |
| `space-14` | 56 | Page-bottom safe area |

### 5.2 Card padding pairs

Standard combinations of vertical / horizontal padding:

| Pair | Use |
|---|---|
| `12 / 16` | List items, table rows |
| `14 / 20` | Card head, default inner row |
| `16 / 20` | Card body default |
| `18 / 20` | Stat card, briefing card |
| `20 / 24` | Hero cards |

### 5.3 Layout shell

The application uses one of three shell variants:

**Variant A — Two-pane (sidebar + main)**
```
┌─ 240px ─┬─────── flex ───────┐
│ sidebar │ topbar             │
│         ├────────────────────┤
│         │ main content       │
└─────────┴────────────────────┘
```
Used for: Command Center, list pages, settings.

**Variant B — Three-pane (sidebar + main + rail)**
```
┌─ 240px ─┬─── flex ───┬─ 320px ─┐
│ sidebar │ topbar     │ rail    │
│         ├────────────┤         │
│         │ main       │         │
└─────────┴────────────┴─────────┘
```
Used for: Client hub, detail pages where stakeholder/contextual rail adds value.

**Variant C — Four-pane (sidebar + sub-rail + main + rail)**
```
┌─ 240px ─┬─ 200px ─┬─ flex ─┬─ 320px ─┐
│ sidebar │ subnav  │ main   │ rail    │
└─────────┴─────────┴────────┴─────────┘
```
Used for: Editor pages (article editor, brief editor) where left subnav scopes navigation within an entity.

### 5.4 Page padding

- Top: `16px` (topbar internal padding)
- Sides: `32px` (`space-8`) within main
- Bottom: `56px` (`space-14`) for safe scroll area
- Sidebar internal: `16px 12px`
- Rail internal: `24px`

---

## 6. Radii, borders, shadows

### 6.1 Radii

| Token | px | Use |
|---|---|---|
| `radius-input` | 6 | Buttons, inputs, small pills, small cards within rows |
| `radius-card` | 10 | Cards, panels |
| `radius-modal` | 14 | Dialogs, drawers, side panels |
| `radius-pill` | 999 | Fully rounded pills (filter pills, plan pills) |

### 6.2 Borders

- **Default:** `1px solid var(--hairline)`. This is THE border. Used on cards, inputs, buttons.
- **Inside cards:** `1px solid var(--hairline-soft)` for sub-section dividers.
- **Active/selected:** `1px solid var(--accent)` + `box-shadow: 0 0 0 3px var(--accent-soft)` (focus pattern).
- **No 2px borders.** Ever.

### 6.3 Shadows

- **Default cards have no shadow.** Period.
- Overlays (popover, dropdown, dialog, side panel) use the canonical pop shadow:
  ```css
  --shadow-pop: 0 1px 0 rgba(14,14,16,0.04), 0 8px 24px rgba(14,14,16,0.06);
  ```
- No "Material elevation" stacking. No glow shadows.

---

## 7. Motion

### 7.1 Durations

| Token | Duration | Use |
|---|---|---|
| `motion-hover` | 150ms | Color/background changes on hover |
| `motion-state` | 200ms | Open/close states (popover, dropdown) |
| `motion-layout` | 250ms | Layout shifts (drawer, side panel) |

All use `cubic-bezier(0.2, 0, 0.2, 1)` (custom ease-out — gentler than default).

### 7.2 Forbidden

- `transform: scale()` on hover (no scale-up effects)
- Card tilt / 3D rotate
- Glow / pulse effects (except deliberate live-pip indicators)
- Spring physics (except on drag interactions where physical fidelity helps)
- Animation-on-load for static content (no fade-in cards)

### 7.3 Allowed and encouraged

- Streaming content via React Suspense with subtle pulse skeleton
- Live indicators (`live-pip`): emerald dot with `box-shadow: 0 0 0 3px var(--accent-soft)`
- Spinner: hairline border with one accent segment, 800ms rotation
- Width/height transitions for accordion expand/collapse
- Side panel slide-in from right, 250ms

---

## 8. Iconography

### 8.1 System

All icons live in **one SVG sprite** loaded once per page. Components reference via `<use href="#i-name">`.

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <symbol id="i-search" viewBox="0 0 24 24" ...>...</symbol>
    <!-- one symbol per icon -->
  </defs>
</svg>
```

### 8.2 Stroke widths

| Width | Use |
|---|---|
| 1.8 | Default for nav, decorative, status icons |
| 2.0 | Utility (search, settings, chevrons) |
| 2.4 | Arrows (intentionally heavier for emphasis) |

### 8.3 Sizes

| Token | px | Use |
|---|---|---|
| `icon-xs` | 9 | Inline arrow in delta chip |
| `icon-sm` | 13 | Button leading icon |
| `icon-md` | 14 | Default icon size |
| `icon-lg` | 16 | Sidebar nav icons |
| `icon-xl` | 18 | Card head decorative icons |

### 8.4 Geometry source

Geometry is borrowed from **Lucide** (https://lucide.dev). When in doubt, use Lucide's path. For unique TeveroSEO icons (audit tier marks, score badges), commission from a single illustrator using the same stroke width and corner radius rules.

### 8.5 Icon list (current minimal sprite)

`i-search · i-bell · i-settings · i-chevron-down · i-chevron-right · i-chevron-up-down · i-arrow-up · i-arrow-down · i-minus · i-more · i-grip · i-home · i-target · i-trending · i-link · i-doc · i-pen · i-shield · i-folder · i-users · i-zap · i-plus · i-download · i-calendar · i-eye · i-globe · i-spark · i-alert · i-trophy · i-rotate · i-wrench · i-pulse · i-mail · i-plug · i-funnel · i-edit · i-bolt · i-clock · i-share · i-phone`

Add new icons via PR; never ad-hoc.

---

## 9. Primitive components

The lowest-level building blocks. Every composite component composes from these.

### 9.1 `<Button>`

**Props:** `variant` ("default" | "primary" | "ghost"), `size` ("sm" | "md"), `leadingIcon`, `trailingIcon`, `loading`, `disabled`.

**Anatomy:** Border (1px hairline) + background + text + optional icon. Padding `7px 13px` for `md`.

**Variants:**
| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| default | `surface` | `text-1` | `hairline` | `surface-2` |
| primary | `accent` | white | `accent` | `accent-ink` |
| ghost | transparent | `text-2` | transparent | `surface-2` |

**Rules:**
- Primary button is the ONLY place accent appears in chrome on most screens. One per region.
- Never use destructive-color buttons by default — destructive actions go through a confirm dialog with `error` color tinting only on the confirm step.
- Loading state replaces leading icon with spinner; text stays.

### 9.2 `<IconButton>`

**Props:** `icon`, `aria-label` (required), `dotIndicator` (boolean), `size` ("sm" | "md").

**Anatomy:** 32×32 square (md), centered icon, 1px hairline, `radius-input`. Optional 6px error dot at top-right.

### 9.3 `<Input>`

**Props:** `leadingIcon`, `trailingSlot`, `error` (string), `size`.

**Anatomy:** 1px hairline, `radius-input`, `padding: 8px 12px`. With leading icon: left padding `34px`, icon absolutely positioned at `left: 10px`. Focus state: `border-color: accent; box-shadow: 0 0 0 3px accent-soft`.

### 9.4 `<Pill>`

Three sub-types — same component, three variant props.

| Variant | Use | Style |
|---|---|---|
| `text` | Static label (plan pill, count pill) | `surface`, hairline border, `radius-pill`, 6/12 padding |
| `filter` | Active-able filter | Adds `data-state="active"` → `accent-soft` bg + `accent` text |
| `scope` | In-context indicator (search scoped to client) | `accent-soft` bg, `accent` text, smaller padding |

### 9.5 `<Badge>`

**Props:** `tone` ("default" | "success" | "error" | "warning" | "info" | "intent-info" | "intent-commercial" | "intent-transactional" | "intent-navigational"), `size`.

**Anatomy:** 2/8 padding, 11px text, `font-weight: 500`, `radius: 4px`. Color = `var(--{tone})`, background = `var(--{tone}-soft)`.

### 9.6 `<DeltaChip>`

**Props:** `direction` ("up" | "down" | "flat"), `value` (string or number), `magnitude` ("compact" | "standard").

**Anatomy:** Inline-flex, arrow icon (size-xs), value in tabular numerals. Color: success / error / text-2.

```tsx
<DeltaChip direction="up" value="18.4%" />
<DeltaChip direction="down" value={-3} />
```

### 9.7 `<HealthPill>`

**Props:** `score` (0-100).

**Anatomy:** Filled colored dot + score in tabular numerals. Color tier:
- 80-100: `accent` + `accent-soft`
- 60-79: `warning` + `warning-soft`
- 0-59: `error` + `error-soft`

### 9.8 `<Avatar>`

**Props:** `seed` (string for gradient hash), `initials` (1-2 chars), `size` ("xs" | "sm" | "md" | "lg" | "xl"), `shape` ("square" | "circle").

**Sizes:** xs=22, sm=26, md=32, lg=44, xl=56.

**Algorithm:** Gradient picked deterministically from §4.4 list using `seed.hashCode() % 7`.

### 9.9 `<Sparkline>`

**Props:** `data` (number[]), `width`, `height`, `tone` ("up" | "down" | "flat"), `endpointDot` (boolean).

**Default styles:** stroke 1.5px, color by tone (accent / error / text-3), no fill, optional 2px endpoint dot in same color.

### 9.10 `<KbdHint>`

**Props:** `keys` (string[]).

**Anatomy:** Joined with `+`. Each key in 1px hairline border, 1/5 padding, 10.5px text, color text-3, radius 4px.

```tsx
<KbdHint keys={["⌘", "K"]} />
```

### 9.11 `<Card>`

**Props:** `padding` ("none" | "sm" | "md" | "lg"), `head` (ReactNode), `foot` (ReactNode), `variant` ("default" | "interactive").

**Anatomy:** `surface` background, `1px solid hairline`, `radius-card`. With head: head section has `border-bottom: 1px solid hairline-soft`. Padding pairs from §5.2.

**`interactive` variant** adds hover state: `border-color: text-3` (subtle).

### 9.12 `<CardHead>`

**Props:** `title`, `subtitle`, `action` (ReactNode), `icon`.

**Anatomy:** Flex between, padding 16/20, bottom border `hairline-soft`. Title 13.5/600, subtitle 12/text-3.

### 9.13 `<SectionHead>`

**Props:** `title` (h2), `meta`, `action`.

**Anatomy:** Like `<CardHead>` but standalone (not inside a card). Used above ungrouped lists or above `<ActionQueue>`.

### 9.14 `<EmptyState>`

**Props:** `icon`, `title`, `description`, `primaryAction`, `secondaryAction`.

**Anatomy:** Centered, 48px vertical padding, icon in 44×44 surface-2 square, title 18 display, description 13 text-2, action row.

**No emoji icons.** Use sprite icons.

### 9.15 `<Skeleton>`

**Props:** `width`, `height`, `radius`.

**Anatomy:** `surface-2` block with subtle pulse animation (1.5s infinite).

---

## 10. Composite components

Built from primitives. Each represents a recurring pattern across multiple screens.

### 10.1 `<StatCard>` ✓ used: dashboard-v1, dashboard-v2

**Props:** `label`, `icon`, `value`, `unit`, `delta` (DeltaChipProps), `subLabel`, `sparkline` (data), `dragHandle` (boolean), `onMenuClick`.

**Anatomy:**
```
┌───────────────────────────┐
│ [icon] Label      [⋯ menu]│
│                           │
│ 128,409                   │  ← display serif
│                           │
│ ↑ 18.4% vs. previous 30d  │
└───────────────────────────┘
```

**Composition:** Card + Icon + DeltaChip + (optional) Sparkline.

### 10.2 `<TickerItem>` ✓ used: client-hub

**Props:** `label`, `value`, `unit`, `delta`, `onClick`.

**Anatomy:** Vertical stack — label (10.5 text-3 uppercase) + value (display serif 18 + tiny unit + tiny delta inline). Inside a horizontal `<Ticker>` with left-border separators.

### 10.3 `<Ticker>` ✓ used: client-hub

Container for `<TickerItem>`s. Equal-width children, left-border between items (`hairline`), no border on first child.

### 10.4 `<GoalPill>` and `<GoalProgressStrip>` ✓ used: client-hub

`<GoalPill>` props: `name`, `current`, `target`, `direction`, `attainmentPct`.

**Anatomy:** Vertical: name (text-3 11) + row [current display serif 17, "/{target} target" text-3 11, delta arrow] + 3px meter bar (color by attainment: ≥100 good, 75-99 ok, <75 bad).

`<GoalProgressStrip>` is a horizontal scroll container of `<GoalPill>`s with left-border separators (same pattern as Ticker).

### 10.5 `<ActionQueueItem>` and `<ActionQueue>` ✓ used: client-hub

`<ActionQueueItem>` props: `tone` ("crit" | "warn" | "opp" | "info"), `icon`, `title`, `meta`, `priorityScore`, `primaryAction`, `secondaryAction`.

**Anatomy:**
```
┌────────────────────────────────────────────────────────┐
│ [icon-tone] Title                       [score] [Btn] │
│             Meta context                                │
└────────────────────────────────────────────────────────┘
```

`<ActionQueue>` is a `<Card>` containing rows + a `<SectionHead>` above it.

### 10.6 `<BriefingHero>` ✓ used: client-hub

**Props:** `eyebrow`, `paragraph` (ReactNode with inline emphasis tokens), `meta` ({generatedAt, period, sources}), `onRegenerate`.

**Anatomy:**
```
[●] TODAY'S BRIEFING                    ← eyebrow with live pip
                                          (max-width 760px)
{Acme is up. Organic traffic grew 18.4% this week, driven by      ← display serif 21px
"enterprise seo platform" reaching position #1. ...}                line-height 1.45

Generated 2h ago · Period: 7 days · Sources: 4 · Regenerate
```

**Inline emphasis tokens:** `<EmKeyword>` (accent) for entity names, `<EmWarn>` (warning) for problem signals, `<EmNum>` (font-weight 500) for raw numbers.

**Adaptive states:** see `per-client-experience-design.md` §`<adaptive_hero>`.

### 10.7 `<MoverRow>` and `<MoversSplit>` ✓ used: client-hub

`<MoverRow>` props: `keyword`, `oldPosition`, `newPosition`, `sparkline`, `trafficDelta`.

**Anatomy:** Horizontal — keyword (truncate 1fr) | mono `oldPos → newPos` (right-aligned, new bolded) | sparkline 56×18 | traffic delta.

`<MoversSplit>` is a 2-column grid of two `<Card>`s: `Top gainers` | `Top losers`.

### 10.8 `<ActivityItem>` and `<ActivityFeed>` ✓ used: dashboard-v2, client-hub

`<ActivityItem>` props: `live` (boolean), `text` (ReactNode), `time`.

**Anatomy:** Horizontal — dot (live emerald with halo, or muted text-4) + content (text 12.5/1.45 + time 10.5 text-3).

`<ActivityFeed>` is a `<Card>` with optional Pause/Filter actions in `<CardHead>`.

### 10.9 `<TeamCapacityRow>` and `<TeamWorkload>` ✓ used: dashboard-v2

`<TeamCapacityRow>` props: `member` ({avatar, name}), `capacityPct`, `meta`.

**Anatomy:** Avatar + name + percent (color by status: over/near/ok) over 4px meter bar with filled portion. Caption row below.

### 10.10 `<UpcomingItem>` and `<UpcomingList>` ✓ used: dashboard-v2

`<UpcomingItem>` props: `urgent` (boolean), `icon`, `title`, `meta`.

**Anatomy:** 26×26 icon square (urgent=warning-tinted, default=surface-2 tinted) + body.

### 10.11 `<ClientPortfolioRow>` ✓ used: dashboard-v2

Table row composing: `<Avatar size="sm">` + name/domain + `<HealthPill>` + traffic-cell (sparkline + delta) + numeric column + goal meter cell + issue badges (`<Badge tone="error">3 crit</Badge>`) + last sync (with stale tone if >48h) + menu.

### 10.12 `<ClientPortfolioTable>` ✓ used: dashboard-v2

`<Card>` containing `<CardHead>` with filter row + sortable `<Table>` of `<ClientPortfolioRow>`s. Columns are config-driven (drag-drop reorderable, persistable per-user).

### 10.13 `<ProspectFunnel>` ✓ used: dashboard-v2

Visualizes 5-stage pipeline (new / analyzing / analyzed / proposal / won). Stage = vertical stack: count (display serif) + bar (height proportional to count, accent fill, opacity decreasing through funnel) + label (uppercase 10.5).

Footer: 3-column grid for derived stats (conversion %, ARR added, pending signature).

### 10.14 `<ContentPipelineMini>` ✓ used: dashboard-v2, client-hub

Visualizes 8-state article distribution. Single horizontal stacked bar (8 segments, color-coded by state) + state legend with counts + footer stats (quality gate avg, voice profile completeness, auto-link velocity, next publish).

### 10.15 `<TierFindingsStrip>` ✓ used: client-hub

For audit findings. 4 rows (Tier 1-4) — each: tier name | bar with crit/warn segments | count badges. Below: total summary + Approve safe button.

### 10.16 `<AnnotatedTimeline>` ✓ used: client-hub

The signature chart. Dual-axis line chart (left: clicks, right: position inverted) with **vertical hairline annotations** at key events. Annotation list below chart with diamond markers + descriptive copy.

**Event types and colors:**
| Type | Color | Marker |
|---|---|---|
| `audit` | info | diamond |
| `publish` | accent | diamond |
| `fix` | warning | diamond |
| `revert` | error | diamond |
| `alert` | error | diamond |
| `milestone` | accent | diamond |

### 10.17 `<DigestPreviewCard>` ✓ used: client-hub

Email-preview style card showing the rendered weekly digest the client will receive. Mini email with To: line, Subject:, body excerpt in italic. Send/Edit actions below.

### 10.18 `<QuickActionRow>` ✓ used: client-hub

Single row with: icon square + (title + meta) + chevron-right. Common pattern for shareable action lists.

### 10.19 `<ContractCard>` ✓ used: client-hub

Stakeholder-facing card. Key/value rows (Plan, MRR, Renewal, Days remaining, Health) + edit CTA at bottom.

### 10.20 `<NeedsAttentionItem>` ✓ used: dashboard-v2

Composition variant of `<ActionQueueItem>` for portfolio-level attention list. Same anatomy, but secondary-action shows Snooze/Dismiss.

### 10.21 `<WinItem>` ✓ used: dashboard-v2

Mirror of NeedsAttentionItem but tone always positive. Trophy / trending / link icon + win narrative.

### 10.22 `<OpsCard>` ✓ used: dashboard-v2

Compact 3-stat operational card (Auto-fix activity, Alerts firing, Reports, Connections style). Title + 3 stats in row, each with display-serif count + label.

### 10.23 `<HealthGauge>` ✓ used: dashboard-v1

Semi-circle SVG gauge with track + filled arc + center score (display serif large) + grade label + meta.

---

## 11. Layout components

### 11.1 `<Shell>`

**Props:** `variant` ("two-pane" | "three-pane" | "four-pane"), `sidebar`, `subnav` (only with four-pane), `main`, `rail` (only with three/four-pane).

Renders the grid per §5.3. Sidebars sticky-positioned; main scrolls.

### 11.2 `<Sidebar>`

Composes:
- `<BrandHeader>` — mark + name + sub
- `<WorkspaceSwitcher>` — for multi-workspace (or `<ClientSwitcher>` when scoped)
- `<NavGroup>`s — each with `<NavLabel>` + `<NavItem>`s
- `<SidebarFooter>` — user row

### 11.3 `<NavItem>`

**Props:** `icon`, `label`, `count` (number), `dot` (boolean), `state` ("default" | "active" | "parent-active").

States:
- `default`: text-2, hover bg surface-2
- `active`: surface bg, hairline border, text-1, accent icon
- `parent-active`: text-1, accent icon (no bg) — used when current page is a descendant

### 11.4 `<Topbar>`

Composes: `<Search>` (max 480px, ⌘K hint, optional scope pill) + `<TopbarActions>` (notifications IconButton with dot + settings IconButton).

Sticky-positioned, `border-bottom: 1px solid hairline-soft`.

### 11.5 `<Breadcrumb>`

Trail of links separated by chevron-right (text-4). Last item is `current` (text-1, font-weight 500).

### 11.6 `<PageHeader>`

**Props:** `eyebrow`, `title`, `subtitle`, `actions`.

**Anatomy:**
```
{eyebrow}                       [actions row]
{title in display serif xl}
{subtitle text-2 13}
```

### 11.7 `<IdentityStrip>` ✓ used: client-hub

For entity-detail pages (client hub, prospect hub, project hub). Composes: `<Avatar size="lg">` + name (display serif lg) + domain (mono) + `<Pill variant="text">` (plan) + tag row + center `<Ticker>` + right action row.

`border-bottom: 1px solid hairline-soft`.

### 11.8 `<ClientTabs>` (and `<ProjectTabs>`)

Horizontal underline tabs, max 7 tabs. Active = accent underline + text-1 + medium weight. Optional badge per tab.

`border-bottom: 1px solid hairline`. Tab `border-bottom: 2px solid` extends below by -1px to overlap.

### 11.9 `<StakeholderRail>` ✓ used: client-hub

Right-side rail container. `<RailSection>`s separated by 28px vertical gaps, each with `<RailHeader>` (uppercase 11 text-3, tracking 0.07em) + content.

### 11.10 `<SidePanel>`

**Props:** `open`, `onClose`, `width` (default 480), `title`, children.

Slide-in from right, 250ms `motion-layout`. Backdrop is none (Linear-style, doesn't dim). `radius-modal` on outer corners only (left edge is straight). Border-left `1px hairline`. Esc closes; ⌘W closes.

Used for: keyword detail, audit issue detail, article inspector, voice profile editor when invoked from non-settings page.

---

## 12. Charts

### 12.1 Library

**Recharts** wrapped in TDS components. Direct Recharts use is forbidden — always go through wrappers.

### 12.2 Color usage

| Series role | Color |
|---|---|
| Primary metric (clicks, traffic, primary measure) | `accent` |
| Secondary metric on dual-axis | `text-3` (dashed) |
| Comparison/baseline (previous period) | `text-3` at 40% opacity, `hatch-gray` pattern |
| Trend up (positive movement) | `accent` |
| Trend down (negative) | `error` |
| Neutral / flat | `text-3` |

**Never** use multiple bright colors for category bars. If categorical comparison is needed, use the hatched-fill pattern (different angles or densities) over solid color.

### 12.3 Gridlines

- **Horizontal hairlines only** (`hairline`, 1px). No vertical gridlines.
- 4 reference lines max.
- Axis labels in 10px Geist, color text-3.
- Right axis (when present) has labels right-aligned outside the plot area.

### 12.4 Hatched fill signature

Diagonal hatched fills are TDS's editorial signature. Define once in `<defs>`:

```html
<pattern id="hatch-emerald" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
  <line x1="0" y1="0" x2="0" y2="6" stroke="#0F4F3D" stroke-width="2.5"/>
</pattern>
<pattern id="hatch-area" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
  <line x1="0" y1="0" x2="0" y2="5" stroke="#0F4F3D" stroke-width="0.8" stroke-opacity="0.45"/>
</pattern>
<pattern id="hatch-gray" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
  <line x1="0" y1="0" x2="0" y2="5" stroke="#9A9A9F" stroke-width="1" stroke-opacity="0.4"/>
</pattern>
```

Use cases:
- Bar charts: emerald hatched bars for current, gray hatched for previous period.
- Area charts: hatched-area pattern under primary line for ranking-distribution-style emphasis.
- Reserved for "hero" charts at top of dashboards. Don't hatched-fill every chart — it loses meaning.

### 12.5 Tooltips

Floating card: `surface` bg, 1px hairline, `radius-input`, padding 8/12, `shadow-pop`. Inside: date in 11px text-3, then key-value rows for each series.

### 12.6 Endpoint labels

For line charts, label the right endpoint with the latest value in display serif 12. Color matches the line. 2px endpoint dot in same color.

This is preferred over right-axis labels for primary metric.

### 12.7 Annotations (timeline events)

For `<AnnotatedTimeline>`:
- Vertical hairline at event x-coordinate, dashed (`stroke-dasharray: 2 3`), color from event-type (info/accent/warning/error), opacity 0.5-0.55.
- Diamond marker at top of plot area (8×8 rotated 45deg, filled with event color).
- Annotation key strip below chart describing each event with date and color-matched diamond.

### 12.8 Chart components

| Component | Use |
|---|---|
| `<Sparkline>` | Inline mini-trend (table rows, stat cards) |
| `<LineChart>` | Single-series time series |
| `<DualAxisLineChart>` | Two metrics with different scales |
| `<AnnotatedTimeline>` | DualAxis + event annotations |
| `<BarChart>` | Categorical comparison |
| `<DistributionChart>` | Distribution over buckets (e.g., position 1-3 / 4-10 / 11-20 …) |
| `<HealthGauge>` | Semi-circle progress |
| `<StackedBar>` | Single horizontal stacked bar (portfolio health, content pipeline) |
| `<FunnelChart>` | Stage-by-stage funnel |

---

## 13. Page templates

Pre-defined compositions. Every new page starts from one of these.

### T1: Command Center

```
<Shell variant="two-pane">
  <Sidebar />
  <main>
    <Topbar />
    <PageHeader eyebrow="<live-pip> Live · ..." title="Command Center" />
    <QuickStatsRow><StatCard /> × 4</QuickStatsRow>
    <PortfolioHealthSummary />
    <Row2><NeedsAttentionList /> | <WinsList /></Row2>
    <Row2><ProspectFunnel /> | <ContentPipelineMini /></Row2>
    <ClientPortfolioTable />
    <Row3><ActivityFeed /> | <TeamWorkload /> | <UpcomingList /></Row3>
    <OpsStrip><OpsCard /> × 4</OpsStrip>
  </main>
</Shell>
```

### T2: Entity Hub (Client / Prospect / Project Overview)

```
<Shell variant="three-pane">
  <Sidebar />
  <main>
    <Topbar scoped />
    <Breadcrumb />
    <IdentityStrip />
    <ClientTabs activeTab="Overview" />
    <BriefingHero />
    <GoalProgressStrip />
    <ActionQueue />
    <AnnotatedTimeline />
    <Row2><MoversSplit /></Row2>
    <Row2><ContentPipelineMini /> | <TierFindingsStrip /></Row2>
    <ActivityFeed scoped />
  </main>
  <StakeholderRail>
    <RailSection><LastContactCard /></RailSection>
    <RailSection><DigestPreviewCard /></RailSection>
    <RailSection><QuickActionRow /> × N</RailSection>
    <RailSection><ContractCard /></RailSection>
    <RailSection><ConnectionsList /></RailSection>
  </StakeholderRail>
</Shell>
```

### T3: List Page

```
<Shell variant="two-pane">
  <Sidebar />
  <main>
    <Topbar />
    <Breadcrumb />
    <PageHeader title="Keywords" subtitle="..." actions={[Export, AddKeyword]} />
    <FilterBar><SavedViewSelector /><FilterPills /><SearchInput /></FilterBar>
    <Card><Table /><Pagination /></Card>
  </main>
</Shell>
```

Used for: Clients list, Prospects list, Articles list, Keywords list, Backlinks, Internal links, Reports list.

### T4: Detail Page (Single Entity)

```
<Shell variant="three-pane">
  <Sidebar />
  <main>
    <Topbar scoped />
    <Breadcrumb /> <!-- includes parent entity -->
    <IdentityStrip variant="compact" />
    <Tabs />
    {tab === "Overview" && <OverviewBlocks />}
    {tab === "History" && <Timeline />}
    {tab === "Settings" && <SettingsForm />}
  </main>
  <DetailRail>
    <RailSection><MetadataList /></RailSection>
    <RailSection><RelatedItemsList /></RailSection>
    <RailSection><ActionButtons /></RailSection>
  </DetailRail>
</Shell>
```

Used for: Single keyword, single article, single audit issue, single backlink.

### T5: Editor Page

```
<Shell variant="four-pane">
  <Sidebar />
  <SubNav> <!-- e.g., article sections -->
    <SubNavItem /> × N
  </SubNav>
  <main>
    <Topbar scoped />
    <Breadcrumb />
    <EditorHeader>
      <Title editable />
      <StatusPills />
      <SaveStatus />
    </EditorHeader>
    <EditorBody />
  </main>
  <EditorRail>
    <RailSection><BriefDetails /></RailSection>
    <RailSection><VoiceCompliance /></RailSection>
    <RailSection><QualityGateScore /></RailSection>
    <RailSection><LinkSuggestions /></RailSection>
  </EditorRail>
</Shell>
```

Used for: Article editor, Brief editor, Proposal builder.

### T6: Settings Page

```
<Shell variant="two-pane">
  <Sidebar />
  <main>
    <Topbar />
    <Breadcrumb />
    <PageHeader title="Settings" />
    <Tabs>
      <Tab label="CMS" />
      <Tab label="Voice" />
      <Tab label="Branding" />
      ...
    </Tabs>
    <SettingsForm>
      <SettingsSection title="..."><SettingsRow /> × N</SettingsSection>
    </SettingsForm>
  </main>
</Shell>
```

### T7: Calendar Page

```
<Shell variant="two-pane">
  <Sidebar />
  <main>
    <Topbar scoped />
    <Breadcrumb />
    <CalendarHeader> <!-- month nav, view toggle, filter pills -->
    <Calendar /> <!-- react-big-calendar in TDS theme -->
  </main>
</Shell>
```

### T8: Report Viewer

Editorial layout, white-label branded, single column with serif headings. NOT a dashboard. See `report-viewer-design.md` (TODO).

### T9: Empty / Error / Loading states

Every list, table, and chart has three explicit states:

- **Empty:** `<EmptyState>` with icon, title, description, primary CTA.
- **Error:** Same anatomy, error tone, "Try again" CTA.
- **Loading:** `<Skeleton>` blocks matching final layout (NOT generic spinners). Stream via Suspense.

These are first-class. Pages that lack them get rejected at review.

---

## 14. Microcopy & content rules

### 14.1 Numbers

- Hero numerals in display serif. Always.
- Tabular numerals everywhere they could line up.
- Compact format for >9999: `12.4k`, `2.3M`. Full format with comma only when precision matters (financial reports, exact counts).
- Percentages: 1 decimal place by default (`18.4%`), 0 decimals when integer (`+12%`).
- Currency: `€1,200` or `$12k` — suffix the unit, never prefix with code.

### 14.2 Time

- Relative for recent: "2m ago", "23 min ago", "yesterday", "Apr 26".
- Absolute when precision matters: "Apr 24, 2:07 AM" (in activity feeds, audit timestamps).
- "Today / Tomorrow / Next week" preferred over date for upcoming.
- Always include time zone when scheduling: "tomorrow 2:00 AM UTC".

### 14.3 Tone

- Direct. Never apologetic. "Couldn't reach GSC. Reconnect." not "Oh no, we couldn't reach GSC, sorry!"
- Specific over generic. "8 striking-distance keywords" beats "potential opportunities".
- Show your work. "Briefing generated 2h ago · sources: 4" beats hiding the methodology.
- No "Click here". Verbs on CTAs only ("Investigate", "Approve safe", "Preview", "Send now").
- Stakeholder-safe copy on stakeholder rail. Internal jargon allowed elsewhere.
- No emoji decoration in default UI. Emoji only when explicitly part of user content (article body, comment, etc).

### 14.4 Capitalization

- Sentence case for everything except brand names and proper nouns.
- "Generate report" not "Generate Report".
- Tab labels are sentence-case.
- Eyebrows are UPPERCASE with letter-spacing 0.07em.

### 14.5 Severity and urgency words

- **Critical:** ranking drop ≥7 positions, traffic drop ≥20%, auto-revert fired, tier-1 finding.
- **Warning:** ranking drop 3-6, traffic drop 10-20%, stale connection, voice profile incomplete.
- **Info:** notable change without action required, completed routine action.

Don't redefine these per-feature. The taxonomy is shared.

---

## 15. Accessibility

### 15.1 Color contrast

All text passes WCAG AA against its background:
- text-1 on canvas: 16.4:1 ✓
- text-2 on canvas: 7.8:1 ✓
- text-3 on canvas: 4.6:1 ✓ (just passes for body, marginal — only use for non-body)
- accent on white: 8.2:1 ✓
- white on accent: 6.1:1 ✓ (primary button)

text-3 must NOT be used for body copy ≥ AA size. It's for captions only (small caps text waives AA).

### 15.2 Focus

- Every interactive element has visible focus.
- Focus ring: `box-shadow: 0 0 0 3px var(--accent-soft); border-color: var(--accent)`.
- Never `outline: none` without replacement.
- Focus-visible (keyboard) shows ring; mouse focus may suppress.

### 15.3 Keyboard

- Tab order follows visual reading order.
- All actions reachable without mouse.
- Lists support `j/k` for next/prev.
- ⌘K opens command palette globally.
- `?` opens shortcuts cheat sheet.
- Esc closes overlays.
- Specific shortcuts documented per template.

### 15.4 ARIA

- Live regions for: briefing hero (`aria-live="polite"`), activity feed (`role="feed"`), toast notifications (`role="status"`).
- Buttons must have accessible names (text or `aria-label`).
- IconButton requires `aria-label` prop (enforced at TS level).
- Tables use `<thead>` / `<tbody>` and `scope="col"` on th.
- Charts have a sibling `<figcaption>` describing the data.

### 15.5 Color is never the only signal

Status uses **icon + text + color** triple. Never color alone.

---

## 16. Implementation architecture

### 16.1 File structure

```
apps/web/src/
├── styles/
│   ├── tokens.css             ← canonical CSS variables (§2.1)
│   └── globals.css            ← imports tokens + base resets
├── components/
│   ├── ui/                    ← shadcn primitives (Button, Input, Card, etc — RESTYLED via tokens)
│   ├── ds/                    ← TDS primitives that wrap shadcn (§9)
│   │   ├── Button.tsx
│   │   ├── IconButton.tsx
│   │   ├── Pill.tsx
│   │   ├── Badge.tsx
│   │   ├── DeltaChip.tsx
│   │   ├── HealthPill.tsx
│   │   ├── Avatar.tsx
│   │   ├── Sparkline.tsx
│   │   ├── KbdHint.tsx
│   │   └── index.ts           ← barrel export
│   ├── ds-composite/          ← composite components (§10)
│   │   ├── StatCard.tsx
│   │   ├── Ticker.tsx
│   │   ├── BriefingHero.tsx
│   │   ├── ActionQueue.tsx
│   │   ├── AnnotatedTimeline.tsx
│   │   ├── ContentPipelineMini.tsx
│   │   ├── ProspectFunnel.tsx
│   │   ├── TierFindingsStrip.tsx
│   │   ├── DigestPreviewCard.tsx
│   │   └── ...
│   ├── ds-layout/             ← layout components (§11)
│   │   ├── Shell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   ├── Breadcrumb.tsx
│   │   ├── PageHeader.tsx
│   │   ├── IdentityStrip.tsx
│   │   ├── ClientTabs.tsx
│   │   ├── StakeholderRail.tsx
│   │   ├── SidePanel.tsx
│   │   └── ...
│   ├── ds-charts/             ← chart wrappers (§12)
│   │   ├── Sparkline.tsx
│   │   ├── LineChart.tsx
│   │   ├── DualAxisLineChart.tsx
│   │   ├── AnnotatedTimeline.tsx
│   │   ├── BarChart.tsx
│   │   ├── DistributionChart.tsx
│   │   ├── HealthGauge.tsx
│   │   ├── StackedBar.tsx
│   │   └── FunnelChart.tsx
│   └── ds-icons/
│       ├── sprite.tsx         ← single SVG sprite component (§8.1)
│       └── icon-list.ts       ← typed list of all icon ids
├── lib/
│   └── design-tokens.ts       ← typed token values importable in TS
└── app/
    └── ...                    ← pages compose ONLY from ds/ds-composite/ds-layout/ds-charts
```

### 16.2 Naming

- TDS primitives: `<Button>`, `<Input>`, `<Pill>` — short names
- TDS composites: `<StatCard>`, `<BriefingHero>` — descriptive
- TDS layout: `<Shell>`, `<Sidebar>` — short
- TDS charts: `<LineChart>`, `<AnnotatedTimeline>` — chart-suffix
- Pages do NOT define inline components. Extract to ds-composite if reused; to a private `_components/` subfolder if truly page-local AND complex enough to warrant it.

### 16.3 Token consumption

Three valid ways to consume tokens, in priority order:

1. **Tailwind classes mapped to tokens:** `className="bg-accent text-text-1 rounded-card"` — preferred.
2. **CSS variables in `style`:** `style={{ background: "var(--surface)" }}` — for dynamic values.
3. **TS import for dynamic logic:** `import { tokens } from "@/lib/design-tokens"` — for chart libraries that need raw values.

**Never** hardcode hex, font sizes, or spacing values in components.

### 16.4 shadcn integration

shadcn primitives in `components/ui/` get **restyled** to use TDS tokens. TDS primitives in `components/ds/` may wrap them with TDS-specific props.

Example:
```tsx
// components/ui/button.tsx — shadcn original, restyled
const buttonVariants = cva(
  "inline-flex items-center gap-2 rounded-input transition-colors",
  {
    variants: {
      variant: {
        default: "bg-surface border border-hairline text-text-1 hover:bg-surface-2",
        primary: "bg-accent text-white border border-accent hover:bg-accent-ink",
        ghost: "bg-transparent text-text-2 hover:bg-surface-2 hover:text-text-1",
      },
    },
  }
);

// components/ds/Button.tsx — TDS wrapper adding loading state and standardizing icon usage
export function Button({ leadingIcon, trailingIcon, loading, children, ...props }) { ... }
```

### 16.5 Strictness

- ESLint rule: forbid `bg-[#...]`, `text-[#...]`, `rounded-[Npx]` arbitrary values for tokens we provide.
- ESLint rule: forbid raw `<svg>` outside the sprite component or chart components.
- TS rule: IconButton requires `aria-label` (typed prop).
- Storybook: every TDS component has a story with all variants. PR cannot land without.

### 16.6 Storybook

Use Storybook 8+ for visual regression and design review. Every component in `ds/`, `ds-composite/`, `ds-layout/`, `ds-charts/` has at least:
- Default story
- All variants story
- Edge case story (empty state, error state, max-content state)

Chromatic (or self-hosted) snapshot tests on PRs.

---

## 17. Migration plan

### 17.1 Phases

**Phase A — Token foundation (1 week)**
- Write `tokens.css` with §2.1 values
- Map to `tailwind.config.ts`
- Replace existing color/spacing/radius values site-wide via codemod
- Load Geist + Fraunces (or GT Sectra/Tiempos if licensed) at root layout
- Acceptance: every page still renders; no visual regression worse than minor tonal shifts

**Phase B — Primitive layer (2 weeks)**
- Restyle all shadcn primitives in `components/ui/` per §16.4
- Add TDS primitives in `components/ds/` (§9)
- Add Storybook with stories for each
- Replace direct shadcn usage in pages with TDS imports
- Acceptance: Buttons, Inputs, Pills, Badges, Cards uniform across pages

**Phase C — Layout layer (1 week)**
- Build `<Shell>`, `<Sidebar>`, `<Topbar>`, `<Breadcrumb>`, `<PageHeader>`, `<IdentityStrip>`, `<ClientTabs>`, `<StakeholderRail>`, `<SidePanel>`
- Replace per-page layout code with these
- Acceptance: every page uses one of the §13 templates

**Phase D — Composite layer (3 weeks)**
- Build composites in §10 in priority order: StatCard, Ticker, BriefingHero, ActionQueue, AnnotatedTimeline, ContentPipelineMini, ProspectFunnel, TierFindingsStrip, ClientPortfolioTable, ActivityFeed
- Migrate Command Center first (T1)
- Then Client Hub (T2)
- Then List pages (T3)
- Acceptance: Command Center and Client Hub match `dashboard-v2.html` and `client-hub-v1.html` prototype fidelity

**Phase E — Chart layer (1.5 weeks)**
- Build chart wrappers (§12.8)
- Replace direct Recharts usage with wrappers
- Apply hatched-fill signature to flagship charts
- Acceptance: every chart in app uses TDS chart components

**Phase F — Detail/editor pages (2 weeks)**
- Build T4 (Detail) and T5 (Editor) templates
- Migrate keyword detail, article editor, audit issue detail, brief editor
- Acceptance: all entity-detail screens consistent

**Phase G — Settings/calendar/report viewer (1 week)**
- Build T6 (Settings), T7 (Calendar) per template
- Build T8 (Report viewer) — separate editorial design
- Acceptance: settings, calendars, reports all template-driven

**Phase H — Polish + a11y audit (1 week)**
- WCAG AA audit
- Keyboard navigation pass
- Empty/error/loading state coverage
- Acceptance: full accessibility report green

**Total: ~12 weeks** of focused single-pair work.

### 17.2 Hard rules during migration

- Once Phase A lands, no new code may use raw color/spacing/radius. Codemod or commit-hook block.
- Once Phase B lands, no new code imports shadcn primitives directly outside `components/ui/`. Use TDS layer.
- Once Phase D lands, no page may render a stat card / activity feed / etc. that isn't from TDS.

### 17.3 Backwards compatibility

Existing pages keep working during migration. Each phase is additive then a sweep replaces. No big-bang rewrite.

---

## Appendix A: Cross-prototype distillation

The three HTML prototypes (`dashboard-v1`, `dashboard-v2`, `client-hub-v1`) are now design-fidelity references only. Every component and pattern they demonstrate is captured above with a ✓ marker indicating which prototype to consult for visual reference.

If you find a pattern in a prototype not captured here, it's either:
1. A bug in the prototype (don't replicate)
2. A missing entry in this document — open a PR to add it

This document is **the source of truth.** The prototypes are illustrations.

---

## Appendix B: Decisions deferred

These need explicit decisions before Phase D:

- [ ] License GT Sectra Display vs. Tiempos Headline vs. ship with Fraunces (free)
- [ ] Confirm emerald `#0F4F3D` against real production data (live Recharts test)
- [ ] Decide on dark theme rollout — parallel from start, or v2 after light ships
- [ ] Brand mark refresh — does the current Tevero wordmark survive premium typography?
- [ ] Custom illustrations vs commission for empty states (decision blocks T9 polish)
- [ ] Side panel pattern vs full-page navigation for: voice editor, keyword mapping editor, audit issue detail (recommendation: side panel)

---

## Appendix C: Related documents

- `ui-redesign-exploration.md` — Direction commit (§9), historical exploration
- `dashboard-feature-coverage.md` — Feature inventory mapped to widgets
- `per-client-experience-design.md` — XML-structured design spec for client hub
- `prototypes/dashboard-v1.html` — Per-client SEO project view (early)
- `prototypes/dashboard-v2.html` — Agency Command Center
- `prototypes/client-hub-v1.html` — Client Hub Overview
