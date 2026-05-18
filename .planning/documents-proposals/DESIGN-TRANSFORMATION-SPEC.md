# TeveroSEO Sales Page: Design Transformation Specification

**Goal:** Transform v3-final.html into a "slippery slope" reading experience inspired by Stripe, Linear, Superhuman, and Locomotive.

**Core Principle:** Every element exists to pull the reader to the next element. No visual walls. No stopping points. The eye glides.

---

## Executive Summary: What's Wrong

| Problem | Impact | Fix |
|---------|--------|-----|
| Pure black sections (#111111) | Visual walls - eye stops, momentum dies | Warm charcoal (#1C1C1A) with gradient transitions |
| Red (#E11D2A) in 47 places | Everything is "important" = nothing is important | Reserve for CTA only. Use green (#2D5A4A) for accents |
| All headlines weight 800 | Hierarchy collapses | Headlines 700, body 400. Clear separation. |
| Hard section cuts | Jarring transitions create "stairs" not "slides" | Gradient spacers between sections |
| Dense content in dark sections | Eye fatigue, reader exhaustion | Reduce content, increase padding, soften contrast |
| 3 dark sections | Pattern exhaustion | ONE dark section (Final CTA only) |

---

## Part 1: New Design System

### Color Palette

```css
:root {
  /* ===== BACKGROUNDS ===== */
  --bg-primary: #FAFAF8;        /* Warm white - feels like morning light */
  --bg-secondary: #F5F4F0;      /* Warm cream - subtle distinction */
  --bg-tertiary: #EEEEE8;       /* Soft stone - elevated surfaces */
  --bg-dark: #1C1C1A;           /* Warm charcoal - NOT pure black */
  --bg-dark-end: #252523;       /* Gradient terminus */
  
  /* ===== ACCENT ===== */
  --accent-primary: #2D5A4A;    /* Deep forest green - authority without aggression */
  --accent-hover: #3D7A64;      /* Lighter on interaction */
  --accent-light: #E8F0EC;      /* Subtle background tint */
  --red-cta: #E11D2A;           /* RESERVED FOR CTA ONLY */
  
  /* ===== TEXT ===== */
  --text-primary: #1A1A18;      /* Headlines - warm near-black */
  --text-body: #3D3D3A;         /* Body - softened for comfort */
  --text-muted: #6B6B66;        /* Secondary info */
  --text-inverse: #FAFAF8;      /* On dark backgrounds */
  --text-inverse-muted: #A8A8A2;
  
  /* ===== BORDERS & SHADOWS ===== */
  --border-light: #E5E5E0;
  --shadow-sm: 0 1px 2px rgba(26, 26, 24, 0.04);
  --shadow-md: 0 4px 12px rgba(26, 26, 24, 0.06);
  --shadow-lg: 0 12px 32px rgba(26, 26, 24, 0.08);
}
```

**Psychology:**
- Warm whites signal reliability (Lithuanian B2B values stability over flash)
- Forest green projects confidence without desperation
- Softened body text reduces reading friction
- Warm charcoal feels like "entering a room" not "hitting a wall"

### Typography System

```css
:root {
  /* ===== FONTS ===== */
  --font-headline: 'Newsreader', Georgia, serif;  /* Editorial authority */
  --font-body: 'Inter', -apple-system, sans-serif;
  
  /* ===== TYPE SCALE ===== */
  --text-6xl: 4rem;      /* 64px - Hero */
  --text-5xl: 3rem;      /* 48px - Section headlines */
  --text-4xl: 2.25rem;   /* 36px - Subsections */
  --text-3xl: 1.875rem;  /* 30px - Cards */
  --text-2xl: 1.5rem;    /* 24px - Large body */
  --text-xl: 1.25rem;    /* 20px - Emphasized */
  --text-lg: 1.125rem;   /* 18px - Body */
  --text-base: 1rem;     /* 16px - Secondary */
  --text-sm: 0.875rem;   /* 14px - Captions */
  --text-xs: 0.75rem;    /* 12px - Labels */
  
  /* ===== LINE HEIGHTS ===== */
  --leading-tight: 1.15;    /* Headlines */
  --leading-snug: 1.3;      /* Subheadlines */
  --leading-normal: 1.6;    /* Body */
  --leading-relaxed: 1.75;  /* Long-form */
  
  /* ===== LETTER SPACING ===== */
  --tracking-tight: -0.02em;   /* Headlines */
  --tracking-normal: 0;         /* Body */
  --tracking-wide: 0.02em;      /* Labels */
  
  /* ===== WEIGHTS ===== */
  --font-regular: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;  /* Headlines - NOT 800 */
}
```

**Key Change:** Headlines use serif (Newsreader) at weight 700. Body uses sans-serif (Inter) at weight 400. This creates clear hierarchy without shouting.

### Spacing Architecture

```css
:root {
  --space-section: 6rem;     /* 96px between sections */
  --space-block: 3rem;       /* 48px between content blocks */
  --space-element: 1.5rem;   /* 24px between elements */
  --space-tight: 0.75rem;    /* 12px tight spacing */
  
  /* Asymmetric spacing creates forward pull */
  --section-padding-top: 6.5rem;    /* More above */
  --section-padding-bottom: 5rem;   /* Less below - pulls forward */
}
```

**Slippery Slope Principle:** More padding above content, less below. The page "leans forward."

---

## Part 2: Section Transitions (The "Dusk/Dawn" System)

The current design has HARD CUTS between sections. This creates "stairs" instead of "slides."

**Solution: Gradient Spacers**

```css
/* Before any dark section */
.transition-dusk {
  height: 80px;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-dark) 100%);
}

/* After any dark section */
.transition-dawn {
  height: 80px;
  background: linear-gradient(180deg, var(--bg-dark) 0%, var(--bg-secondary) 100%);
}

/* Section internal gradients */
.section-light {
  background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}

.section-dark {
  background: linear-gradient(180deg, var(--bg-dark) 0%, var(--bg-dark-end) 100%);
}
```

**Result:** Eye glides between sections instead of hitting walls.

---

## Part 3: Section-by-Section Transformation

### 1. Top Bar + Scarcity

**Current:** Black bar + Red scarcity strip = 2 harsh bands
**New:** Single unified dark bar with subtle gradient. Scarcity becomes inline element.

```css
.topbar {
  background: linear-gradient(180deg, #0D0D0D 0%, #1A1A1A 100%);
  padding: 14px 24px;
}

/* Remove separate scarcity strip - integrate it */
.scarcity-inline {
  font-size: 12px;
  opacity: 0.85;
  margin-left: 20px;
}
```

**Remove:** Pulsing red dot (feels like error indicator)
**Add:** Gradient spacer below transitioning to white hero

---

### 2. Hero

**Current Issues:**
- H1 at weight 800 (too heavy)
- Red in 4 places (tag, underline, span, stat)
- Stats box with hard borders
- Multiple CTAs compete

**Transformation:**

```css
.hero h1 {
  font-family: var(--font-headline);
  font-weight: 700;  /* down from 800 */
  line-height: 1.15;
  letter-spacing: -0.025em;
}

/* Replace red span with subtle highlight */
.hero h1 .highlight {
  background: linear-gradient(180deg, transparent 60%, rgba(45, 90, 74, 0.15) 60%);
}

/* Stats: Remove hard borders */
.hero-stats {
  border-top: 1px solid var(--border-light);
  border-bottom: none;  /* Remove */
}

.stat {
  border-right: none;  /* Remove dividers */
  padding: 24px 40px;  /* Wider - creates separation */
}
```

**Key Changes:**
- Serif headline creates editorial authority
- Single accent color (green highlight)
- Stats box opens at bottom (pulls forward)
- Primary CTA in green, not red

---

### 3. Honesty Hook

**Current:** Hard gray (#F7F7F7) with red H2 accent
**New:** Warm off-white seamless from hero, minimal red

```css
.section-honesty {
  background: var(--bg-secondary);  /* Warm #F5F4F0 */
}

/* Kicker: Muted, not red */
.kicker {
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  text-transform: none;  /* Remove uppercase */
}

/* H2 red text: Subtle opacity */
.section h2 .accent {
  color: var(--accent-primary);  /* Green instead of red */
  opacity: 0.9;
}
```

---

### 4. Pain Agitation

**Current Issues:**
- Big quote with hard red border-left
- Inline red spans break flow

**Transformation:**

```css
/* Quote: Remove aggressive red border */
.big-quote {
  font-size: clamp(22px, 2.5vw, 28px);  /* Smaller */
  font-style: italic;
  font-weight: 500;
  border-left: 1px solid var(--border-light);  /* Subtle */
  padding-left: 28px;
  color: var(--text-primary);
}

/* Emphasis: Weight, not color */
.big-quote .emphasis {
  font-weight: 600;
  font-style: normal;
  color: var(--text-primary);  /* NOT red */
}
```

---

### 5. Agencies Problem

**Current:** Contains `.hl-red` highlight that competes with H2
**New:** Single underline accent

```css
/* "Mes parduodame pozicijas" - elegant underline */
.key-phrase {
  border-bottom: 2px solid var(--accent-primary);
  padding-bottom: 2px;
  font-weight: 600;
}
```

**Add:** Gradient at bottom preparing for dark section transition

---

### 6. Objection Handling (DARK) - MAJOR TRANSFORMATION

**Current:** Hard black wall with cramped cards
**New:** Warm charcoal with flowing Q&A format

**OPTION A: Keep Dark, Transform Treatment**

```css
/* Add dusk transition spacer BEFORE */
<div class="transition-dusk"></div>

.section-objections {
  background: var(--bg-dark);
  padding: 120px 0;  /* Extra breathing room */
}

/* Remove objection cards entirely */
/* New: Flowing Q&A format */
.objection-item {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 32px;
  margin-bottom: 48px;
}

.objection-num {
  font-size: 64px;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.1);  /* Watermark */
}

.objection-question {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-inverse);
  margin-bottom: 16px;
}

.objection-answer {
  font-size: 17px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.75);
}

/* Add dawn transition spacer AFTER */
<div class="transition-dawn"></div>
```

**OPTION B: Eliminate Dark Section Entirely**

Replace with warm stone background (#EEEEE8) and floating dark cards:

```css
.section-objections {
  background: var(--bg-tertiary);
}

.objection-card {
  background: var(--bg-dark);
  border-radius: 12px;
  padding: 36px;
  color: var(--text-inverse);
}
```

**Recommendation:** Option A with transitions. The dark creates gravitas for the objection-handling moment.

---

### 7. Educational Magic

**Current:** Dense paragraphs, big quote with red border
**New:** Generous storytelling flow

```css
.section-story p {
  line-height: 1.8;  /* Maximum readability */
  margin-bottom: 26px;
}

/* Dialogue examples: Italic */
.section-story .example {
  font-style: italic;
  color: var(--text-muted);
}

/* Subheadings: More breathing room */
.section-story h3 {
  margin-top: 64px;
  margin-bottom: 20px;
}
```

---

### 8. Time + Pre-Guarantee

**Current:** `.hl-red` highlight competes with guarantee message
**New:** Single emphasis through horizontal rules

```css
.guarantee-block {
  padding: 28px 0;
  border-top: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
  margin: 36px 0;
}

/* Remove colored highlights */
.highlight-text {
  font-weight: 600;
  color: var(--text-primary);
}
```

---

### 9. 6 Etapai - MAJOR TRANSFORMATION

**Current:** Dense 2x3 grid with red top borders, cramped cards
**New:** Clean cards with watermark numbers, breathing room

```css
.etapai {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;  /* Up from 18px */
}

.etapas {
  background: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 32px;
  position: relative;
  /* Remove red top border */
}

/* Watermark number */
.etapas::before {
  content: attr(data-stage);
  position: absolute;
  right: 20px;
  top: 10px;
  font-size: 80px;
  font-weight: 300;
  color: rgba(0, 0, 0, 0.03);
}

.etapas h4 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}

.etapas p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-body);
}

/* Result: Subtle background instead of bordered box */
.etapas-result {
  background: var(--bg-secondary);
  margin: 16px -32px -32px;
  padding: 16px 32px;
  border-radius: 0 0 8px 8px;
}

.etapas-result strong {
  color: var(--text-muted);  /* Not red */
  font-size: 10px;
  letter-spacing: 0.08em;
}
```

---

### 10. Keyword Selection

**Current:** Criteria cards with red left border, heavy numbers
**New:** Clean numbered list, no boxes

```css
.criteria-item {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 20px;
  padding: 20px 0;
  border-bottom: 1px solid var(--border-light);
}

.criteria-num {
  font-size: 32px;
  font-weight: 300;
  color: #CCCCCC;  /* Light gray, elegant */
}

.criteria-item p {
  font-size: 17px;
  font-weight: 500;
  color: var(--text-primary);
}
```

---

### 11. Pricing Intro

Short bridge section - keep minimal. Add gradient spacer below preparing for dark.

---

### 12. Payment Options (DARK) - MAJOR TRANSFORMATION

**Current:** Hard black with 10+ paragraphs, multiple big quotes
**New:** Warm charcoal, reduced content, glass cards

```css
/* Dusk transition before */
<div class="transition-dusk"></div>

.section-payments {
  background: linear-gradient(180deg, #1A1A1A 0%, #222222 100%);
  padding: 100px 0;
}

/* Payment cards: Glass effect */
.pay-card {
  background: rgba(255, 255, 255, 0.04);
  border: none;
  border-radius: 12px;
  padding: 32px;
  /* Remove red top border */
}

/* Watermark numbers */
.pay-card::before {
  content: attr(data-num);
  font-size: 60px;
  color: rgba(255, 255, 255, 0.03);
}

/* ROI cards: Same treatment */
.roi-card {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 28px;
}

/* Big quotes: Glow instead of border */
.big-quote-dark {
  background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
  padding: 40px;
  border-radius: 12px;
  border-left: none;
}

/* Dawn transition after */
<div class="transition-dawn"></div>
```

**Key:** Reduce content. 10+ paragraphs of white-on-black causes fatigue. Keep it punchy.

---

### 13. Pricing Tiers - MAJOR TRANSFORMATION

**Current:** Featured tier has red border, all cards overwhelmed with content
**New:** Equal-weight cards, comparison simplified

```css
.pricing {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.tier {
  background: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 40px 32px;
  /* All cards same border - no "featured" red */
}

/* Featured: Subtle differentiation */
.tier-featured {
  border-color: #CCCCCC;
  box-shadow: var(--shadow-md);
}

/* Remove featured tag/banner - too aggressive */

/* Price: Inline format */
.tier-price {
  font-size: 38px;  /* Down from 48px */
  font-weight: 700;
}

/* Feature checkmarks: Muted */
.tier ul li::before {
  color: var(--text-muted);  /* Not red */
}

/* Guarantee box: Subtle */
.tier-guarantee {
  background: var(--bg-secondary);
  padding: 16px;
  border-radius: 8px;
  border: none;
}

/* Leasing: No red */
.tier-leasing {
  background: var(--bg-tertiary);
  border-left: none;
}

/* CTAs: All ghost style */
.tier .btn {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-primary);
}

.tier .btn:hover {
  background: var(--text-primary);
  color: #FFFFFF;
}
```

**Goal:** Reduce decision paralysis. Equal visual weight lets user scan and compare.

---

### 14-15. After 6 Months + Not For Everyone

Short sections - keep minimal. Remove red X icons from "Not For Everyone" - creates negative association.

```css
/* Not-for items: Simple list format */
.notfor-item {
  display: block;
  padding: 24px 0;
  border-bottom: 1px solid var(--border-light);
}

.notfor-item h4 {
  font-weight: 600;
  margin-bottom: 8px;
}

/* No red X badge */
```

---

### 16. How To Start

```css
/* Watermark numbers */
.step-num {
  font-size: 48px;
  font-weight: 300;
  color: rgba(0, 0, 0, 0.08);
}

/* Remove border-bottom separators */
.step {
  border-bottom: none;
  padding: 32px 0;
}
```

**Add:** Long gradient dusk transition (100px) building to final CTA.

---

### 17. Final CTA

**Current:** Hard black, same treatment as other dark sections
**New:** Deep charcoal with radial spotlight, single dramatic moment

```css
.section-final {
  background: radial-gradient(ellipse at center, #1F1F1F 0%, #0F0F0F 100%);
  padding: 100px 0;
}

/* Remove kicker - unnecessary */

/* H2: Underline accent instead of red color */
.section-final h2 .accent {
  border-bottom: 3px solid var(--red-cta);
  padding-bottom: 2px;
  color: var(--text-inverse);
}

/* Primary CTA: Full red - ONLY place red is aggressive */
.section-final .btn-primary {
  background: var(--red-cta);
  border: none;
  box-shadow: 0 0 30px rgba(225, 29, 42, 0.4);
}
```

---

## Part 4: What to Remove Entirely

| Element | Why Remove |
|---------|------------|
| Red kickers on every section | Creates visual static |
| Red left borders on cards | Too many "important" signals |
| Red checkmarks in pricing | Competes with CTA |
| Featured tier red border | Creates sales pressure |
| Scarcity red strip | Integrate into top bar |
| Multiple big-quotes | Quote fatigue - keep 2-3 max |
| Heavy stat box borders | Opens at bottom to pull forward |
| Pulsing red dot | Feels like error indicator |
| Weight 800 on everything | Reserve for hero only |

---

## Part 5: Implementation Priority

### Phase 1: Structural (Highest Impact)
1. Add gradient transition spacers between light/dark sections
2. Change dark backgrounds from #111111 to #1C1C1A
3. Soften text color in dark sections to rgba(255,255,255,0.85)
4. Remove one of the two dark sections (recommend keeping only Final CTA dark, or keeping Objections dark and making Payments light)

### Phase 2: Color System
1. Replace red accent with green (#2D5A4A) everywhere except Final CTA
2. Change body text from #2A2A2A to #3D3D3A
3. Warm up backgrounds from #F7F7F7 to #F5F4F0
4. Remove red borders/checkmarks from cards

### Phase 3: Typography
1. Add Newsreader font for headlines
2. Reduce headline weight from 800 to 700
3. Increase body line-height from 1.65 to 1.75
4. Standardize letter-spacing (pick ONE value for labels)

### Phase 4: Cards & Elements
1. Transform objection cards to flowing Q&A
2. Transform 6 Etapai cards (watermark numbers, no red borders)
3. Equalize pricing card treatments
4. Transform criteria list (elegant numbers, no boxes)

### Phase 5: Polish
1. Add subtle hover animations to cards
2. Refine button gradients
3. Add section internal gradients
4. Final spacing refinements

---

## Measurement Criteria

Success looks like:

| Metric | Current (Estimated) | Target |
|--------|---------------------|--------|
| Scroll depth | 60% drop at dark sections | 85%+ to Final CTA |
| Time on page | 2-3 min | 4-5 min |
| CTA click rate | Split across 6+ CTAs | 70%+ on Final CTA |
| Heatmap | Clusters at pricing | Even distribution |

---

## Summary

The transformation follows one principle: **remove visual friction**.

- **Warm colors** feel welcoming
- **Gradient transitions** prevent momentum death
- **Single accent** creates clear hierarchy
- **Serif headlines** establish authority
- **Reduced density** improves comprehension
- **Reserved red** makes the CTA irresistible

The reader should feel they are sliding down a slope, not climbing stairs. Every element hands off to the next. When they reach the Final CTA, taking action feels like the obvious next step - not a decision.

---

*Document prepared by VP Design analysis team, 2026-05-16*
