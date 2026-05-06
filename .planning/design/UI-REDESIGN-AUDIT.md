# TeveroSEO UI/UX Redesign Audit

> **Date:** 2026-05-06
> **Audited by:** 5 Opus subagents
> **Reference:** design-system-v6.md, client-hub-v6.html prototype
> **Goal:** Transform agency UI from "functional SaaS" to "$100M-software polish"

---

## Executive Summary

The current agency UI has significant design-system-v6 violations. This document captures the comprehensive audit findings and provides actionable redesign specifications for:

1. Article Generation Pipeline (SEO Automation)
2. Quality Score Card (SEO Content Writer)
3. Keyword Research Table
4. Content Calendar (new)
5. System-wide token/primitive updates

**Estimated migration effort:** 20-25 hours

---

## 1. Article Generation Pipeline ("Under the Hood" View)

### Current State Analysis

The current implementation shows a simple checklist:
```
◯ Generating article
✓ Searching Google          G  24 sources
✓ Scraping content              18 pages
✓ Writing content           3,247 words
● Generating images             4 of 6
○ Adding links                 20 links
○ Publishing article        W  9:00 AM
```

### Anti-Patterns Identified

| Issue | Violation | Fix |
|-------|-----------|-----|
| Hard 1px border on card | Cards should use ghost-edge shadows | `--shadow-card` |
| Generic green checkmarks | Should use semantic-tinted icon containers | success-soft bg |
| No editorial moment | Step count or word count should be hero | Progress block pattern |
| Plain text metrics | Numbers should use serif display font | Newsreader `tabular-nums` |
| All info visible at rest | Secondary details (duration) should reveal on hover | `opacity: 0` → hover |
| No depth hierarchy | Active step should have visual prominence | accent-soft bg, ring |
| Generic badge | "Generating article" should use status-pill pattern | small-caps, semantic color |

### v6 Redesign Specification

#### A. Card Container
```css
.pipeline-card {
  background: var(--surface);
  border-radius: var(--radius-card);  /* 12px */
  box-shadow: var(--shadow-card);     /* ghost-edge, no border */
  overflow: hidden;
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}
.pipeline-card:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-1px);
}
```

#### B. Editorial Moment (Progress Block)
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  4 / 6        steps              3,247  words      │
│  ▲           ▲                    ▲                │
│  mega        unit                 secondary hero   │
│  (36-44px)   (14px)               (22-26px)        │
│                                                     │
│  ████████████████████░░░░░░░░░░  ← progress bar    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Typography:
- `4`: `--num-card` (36-44px), Newsreader 400, `--text-1`
- `/`: `--num-card * 0.65`, Newsreader 300, `--text-4` (whisper)
- `6`: `--num-card * 0.65`, Newsreader 400, `--text-3` (muted)
- `steps`: 14px Geist, `--text-3`
- `3,247`: 22-26px Newsreader, `--text-1`
- `words`: 12px small-caps, `--text-3`

#### C. Pipeline Steps (Subgoal Pattern)

Each step has three states:

**Complete:**
```css
.step.complete .icon-wrap {
  width: 26px; height: 26px;
  background: var(--success-soft);  /* #EAF2EE */
  color: var(--success);            /* #1B6E45 */
  border-radius: 6px;
}
```

**Active (In Progress):**
```css
.step.active .icon-wrap {
  background: var(--accent-soft);   /* #EAF1ED */
  color: var(--accent);             /* #0F4F3D */
  box-shadow: 0 0 0 3px rgba(15, 79, 61, 0.12);
}
```

**Pending:**
```css
.step.pending .icon-wrap {
  background: var(--surface-3);     /* #F2F1EB */
  color: var(--text-4);             /* #C4C3BB */
}
.step.pending .text {
  color: var(--text-3);
}
```

#### D. Step Row Layout
```
┌──────────────────────────────────────────────────────────────┐
│  [icon]   Step description with **metric**      duration     │
│   26px    flex: 1                               hover-reveal │
│           "Searched Google for **24** sources"  "12s"        │
└──────────────────────────────────────────────────────────────┘
```

- Icon: 26×26px, 6px radius, semantic background
- Description: 14px Geist, `--text-2`
- Metrics: Newsreader serif, `--text-1`, `tabular-nums`
- Duration: 13px Geist, `--text-3`, **hidden until row hover**

#### E. Hover-to-Reveal Pattern
```css
.step .duration {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity var(--motion-reveal), transform var(--motion-reveal);
}
.step:hover .duration {
  opacity: 1;
  transform: translateX(0);
}
```

#### F. Status Pill Pattern
```css
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px 5px 9px;
  background: var(--accent-soft);
  border-radius: var(--radius-pill);
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
  font-variant-caps: all-small-caps;
  color: var(--accent);
  box-shadow: 0 0 0 1px rgba(15, 79, 61, 0.12);
}
.status-pill .dot {
  width: 6px; height: 6px;
  background: var(--accent);
  border-radius: 50%;
  /* NO animation - static is premium */
}
```

#### G. Enhanced "Under the Hood" Details

For each step, hovering or expanding reveals deeper info:

**Research Step (Searching Google):**
```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Searched Google for 24 sources                   12s   │
│      ├─ competitor-a.com/blog/...                          │
│      ├─ healthline.com/dental/...                          │
│      ├─ webmd.com/oral-health/...                          │
│      └─ +21 more sources                                   │
└─────────────────────────────────────────────────────────────┘
```

**Scraping Step:**
```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Scraped content from 18 pages                    34s   │
│      ├─ 42,318 words extracted                             │
│      ├─ 12 images found                                    │
│      └─ 3 pages blocked (robots.txt)                       │
└─────────────────────────────────────────────────────────────┘
```

**Writing Step:**
```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Wrote 3,247 words of content                   2m 18s  │
│      ├─ 8 H2 headings                                      │
│      ├─ 14 paragraphs                                      │
│      ├─ 2 tables                                           │
│      └─ Brand voice: 94% match                             │
└─────────────────────────────────────────────────────────────┘
```

**Image Generation Step:**
```
┌─────────────────────────────────────────────────────────────┐
│  ●  Generating images 4 of 6                    ~2m remain  │
│      ├─ ✓ hero-image.webp (1200×630)                       │
│      ├─ ✓ infographic-1.webp                               │
│      ├─ ✓ comparison-chart.webp                            │
│      ├─ ✓ process-diagram.webp                             │
│      ├─ ● generating product-shot.webp...                  │
│      └─ ○ social-preview.webp                              │
└─────────────────────────────────────────────────────────────┘
```

**Links Step:**
```
┌─────────────────────────────────────────────────────────────┐
│  ○  Add 20 internal links                          pending  │
│      ├─ 12 contextual links (auto-matched)                 │
│      ├─ 5 related articles                                 │
│      └─ 3 CTA links                                        │
└─────────────────────────────────────────────────────────────┘
```

**Publishing Step:**
```
┌─────────────────────────────────────────────────────────────┐
│  ○  Publish article                              W 9:00 AM  │
│      ├─ WordPress draft created                            │
│      ├─ SEO meta configured                                │
│      ├─ Schema markup ready                                │
│      └─ Social cards generated                             │
└─────────────────────────────────────────────────────────────┘
```

#### H. Expandable Detail Pattern

Steps can expand/collapse to show details:

```css
.step-details {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 300ms var(--ease-smooth), opacity 200ms;
}
.step.expanded .step-details {
  max-height: 200px;
  opacity: 1;
}

.step-detail-row {
  padding: 6px 0 6px 40px;  /* align with step text */
  font-size: 13px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-detail-row::before {
  content: "├─";
  font-family: var(--font-mono);
  color: var(--text-4);
}
.step-detail-row:last-child::before {
  content: "└─";
}
.step-detail-row .value {
  color: var(--text-2);
  font-variant-numeric: tabular-nums lining-nums;
}
```

---

## 2. Quality Score Card (SEO Content Writer)

### Current State
```
Article Score    100 / 100
█████████████████████████
✓ Word count         3,247 / 3,000
✓ Keyword density    0.8% optimal
✓ Headings           8 added
✓ Internal links     13 added
✓ Images             6 added
```

### v6 Redesign: Three Variants

#### Option A: Health Gauge (Compact/Rail)
Best for: Right rail, dashboard summary
```
┌───────────────────────────────────┐
│  Article Quality        ● Perfect │
│                                   │
│   ╭───╮                          │
│   │A+ │   100 / 100              │
│   ╰───╯   All checks passed      │
│    72px                          │
└───────────────────────────────────┘
```

#### Option B: Progress Block (Full)
Best for: Main content area, article editor
```
┌───────────────────────────────────────────────────────────┐
│  Article Quality                              ● Perfect   │
│                                                           │
│  100 / 100                                               │
│   ▲      ▲                                               │
│  mega   muted                                            │
│                                                           │
│  ████████████████████████████████████████████  ← bar     │
│                                                           │
│  ┌─────────┬─────────┬─────────┐                         │
│  │  3,247  │   0.8%  │    8    │  ← metrics strip       │
│  │  Words  │ Density │Headings │                         │
│  └─────────┴─────────┴─────────┘                         │
│                                                           │
│  ▼ 5 of 5 checks passed                    (expandable)  │
└───────────────────────────────────────────────────────────┘
```

#### Option C: Subgoal Pattern
Best for: Detailed quality breakdown
```
┌───────────────────────────────────────────────────────────┐
│  100 / 100                              ╭───╮            │
│                                         │A+ │            │
│                                         ╰───╯            │
│                                                           │
│  ✓ Word count      3,247 / 3,000   ✓ Headings    8      │
│  ✓ Density         0.8%   optimal  ✓ Links      13      │
│  ✓ Images          6 added                               │
└───────────────────────────────────────────────────────────┘
```

### Typography Specifications

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Score (100) | Newsreader | `--num-mega` (58-80px) | 400 | `--text-1` |
| Divider (/) | Newsreader | 38-52px | 300 | `--text-4` |
| Target (100) | Newsreader | 38-52px | 400 | `--text-3` |
| Metric values | Newsreader | 20-26px | 400 | `--text-1` |
| Metric labels | Geist | 12px | 500 | `--text-3` small-caps |
| Check items | Geist | 14px | 400 | `--text-2` |

### "Under the Hood" Quality Check Details

Each quality check row can expand to reveal what's behind the score. This builds trust by showing exactly how the AI evaluated each dimension.

#### Word Count Check
```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Word count                   3,247 / 3,000             │
│      ├─ Body text: 2,891 words                             │
│      ├─ Headings: 156 words (8 H2s, 12 H3s)                │
│      ├─ Lists: 200 words (3 bullet lists)                  │
│      ├─ Tables: 0 words                                    │
│      └─ Competitor avg: 2,847 words (you're +14%)          │
└─────────────────────────────────────────────────────────────┘
```

#### Keyword Density Check
```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Keyword density              0.8%   optimal            │
│      ├─ Primary: "teeth whitening" × 26 (0.8%)             │
│      ├─ Secondary: "whitening treatment" × 8 (0.25%)       │
│      ├─ LSI: "dental bleaching" × 4 (0.12%)                │
│      ├─ Distribution: ███░░░░██░░░██░██ (even spread)      │
│      └─ Target range: 0.5%–1.2% ✓                          │
└─────────────────────────────────────────────────────────────┘
```

#### Headings Check
```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Headings                     8 added                   │
│      ├─ H1: "Teeth Whitening: Complete Guide 2026" ✓       │
│      ├─ H2 × 8:                                            │
│      │   ├─ What Is Professional Teeth Whitening?          │
│      │   ├─ At-Home vs In-Office Options                   │
│      │   ├─ How Much Does Whitening Cost?                  │
│      │   ├─ Side Effects and Safety                        │
│      │   ├─ Best Products for Sensitive Teeth              │
│      │   ├─ How Long Do Results Last?                      │
│      │   ├─ Before and After: What to Expect               │
│      │   └─ FAQ: Your Questions Answered                   │
│      ├─ H3 × 12 (nested under H2s) ✓                       │
│      └─ Hierarchy: H1 → H2 → H3 (no skips) ✓               │
└─────────────────────────────────────────────────────────────┘
```

#### Links Check
```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Internal & external links    13 added                  │
│      ├─ Internal links: 9                                  │
│      │   ├─ /blog/dental-veneers-guide (contextual)        │
│      │   ├─ /blog/sensitive-teeth-causes (contextual)      │
│      │   ├─ /services/cosmetic-dentistry (CTA)             │
│      │   ├─ /about/our-dentists (authority)                │
│      │   └─ +5 more internal links                         │
│      ├─ External links: 4                                  │
│      │   ├─ ada.org/whitening-safety (authority)           │
│      │   ├─ ncbi.nlm.nih.gov/pmc/... (research)            │
│      │   ├─ webmd.com/oral-health/... (reference)          │
│      │   └─ fda.gov/cosmetics/... (regulatory)             │
│      ├─ All links: rel="noopener" applied ✓                │
│      └─ Anchor text diversity: 92% unique ✓                │
└─────────────────────────────────────────────────────────────┘
```

#### Images Check
```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Images                       6 added                   │
│      ├─ hero-whitening.webp (1200×630)                     │
│      │   └─ alt: "Before and after teeth whitening..."     │
│      ├─ whitening-comparison-chart.webp                    │
│      │   └─ alt: "Comparison of at-home vs pro..." ✓       │
│      ├─ sensitive-teeth-tips.webp                          │
│      │   └─ alt: "Tips for whitening sensitive..." ✓       │
│      ├─ product-strips.webp                                │
│      │   └─ alt: "Best whitening strips 2026" ✓            │
│      ├─ dentist-procedure.webp                             │
│      │   └─ alt: "Professional whitening at..." ✓          │
│      ├─ social-preview.webp (1200×630)                     │
│      │   └─ OG image for social sharing ✓                  │
│      ├─ All images: WebP format, <100KB ✓                  │
│      └─ All images: descriptive alt text ✓                 │
└─────────────────────────────────────────────────────────────┘
```

### Expandable Check Row CSS

```css
.quality-check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background var(--motion-hover);
}
.quality-check-row:hover {
  background: var(--surface-2);
}
.quality-check-row .icon-wrap {
  width: 24px; height: 24px;
  background: var(--success-soft);
  color: var(--success);
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.quality-check-row .label {
  flex: 1;
  margin-left: 12px;
  font: 400 14px/1.4 var(--font-sans);
  color: var(--text-2);
}
.quality-check-row .value {
  font: 400 16px/1 var(--font-display);
  font-variant-numeric: tabular-nums lining-nums;
  color: var(--text-1);
}
.quality-check-row .value .target {
  color: var(--text-3);
  font-size: 14px;
}
.quality-check-row .badge {
  font: 500 11px/1 var(--font-sans);
  font-variant-caps: all-small-caps;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--success-soft);
  color: var(--success);
}

/* Expandable details */
.quality-check-details {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  background: var(--surface-2);
  border-radius: 0 0 8px 8px;
  transition: max-height 300ms var(--ease-smooth), opacity 200ms;
}
.quality-check-row.expanded + .quality-check-details {
  max-height: 400px;
  opacity: 1;
  padding: 8px 16px 16px 52px;  /* align with label text */
}

.detail-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  font: 400 13px/1.5 var(--font-sans);
  color: var(--text-3);
}
.detail-line::before {
  content: "├─";
  font-family: var(--font-mono);
  color: var(--text-4);
  flex-shrink: 0;
}
.detail-line:last-child::before {
  content: "└─";
}
.detail-line .highlight {
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.detail-line .mono {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-2);
}
```

### Interaction Pattern

1. **At rest:** Show check icon, label, value, and badge (e.g., "optimal")
2. **On hover:** Subtle background shift, chevron appears indicating expandability
3. **On click:** Row expands to reveal tree structure with detailed breakdown
4. **Expanded state:** Chevron rotates 90°, details fade in with 300ms ease

### Trust-Building Details

| Check | What to show "under the hood" |
|-------|------------------------------|
| Word count | Body/heading/list breakdown, competitor comparison |
| Keyword density | Primary/secondary/LSI counts, distribution visualization |
| Headings | Full heading hierarchy, H1→H2→H3 validation |
| Links | Internal/external breakdown, anchor text diversity |
| Images | Each image with alt text, format/size validation |

This transforms a simple checklist into an **audit trail** that proves the AI did its job correctly. Premium agencies can show this to clients as evidence of thorough content optimization.

---

## 3. Keyword Research Table

### Current State
```
Keyword Research
460 keywords found

dentist near me       18,100 | Difficulty: 24  [Queue]
teeth whitening cost   9,900 | Difficulty: 19  [Queue]
invisalign vs braces   6,600 | Difficulty: 31  [Queue]
```

### v6 Redesign

#### Tab Navigation
```
┌───────────────────────────────────────────────────────────────────┐
│  All [460]    High Volume [124]    Quick Wins [37]    Priority [8]│
│  ═══════                                                          │
│                          ↑ sliding underline on active            │
└───────────────────────────────────────────────────────────────────┘
```

#### Table Layout (CSS Grid)
```css
.kw-table-head, .kw-row {
  display: grid;
  grid-template-columns: minmax(260px, 2.4fr) 0.9fr 0.8fr 0.6fr 1fr 0.5fr;
  gap: 14px;
}
```

#### Row Components

**Keyword Cell:**
```
┌──────────────────────────────────────┐
│  📍 dentist near me                  │  ← mono font, pin icon for priority
│     /blog/dentist-guide              │  ← page path, text-3
└──────────────────────────────────────┘
```

**Volume Cell:**
```
┌────────────┐
│    18,100  │  ← Newsreader serif, 18px
│  ████████  │  ← 3px relative volume bar
└────────────┘
```

**Difficulty Cell:**
```
Easy (0-30):      ┌──────┐ success-soft bg, success text
                  │  24  │
                  └──────┘

Medium (31-50):   ┌──────┐ surface-2 bg, text-2
                  │  42  │
                  └──────┘

Hard (51-70):     ┌──────┐ warning-soft bg, warning text
                  │  58  │
                  └──────┘

Very Hard (71+):  ┌──────┐ error-soft bg, error text
                  │  72  │
                  └──────┘
```

**Intent Badge:**
```
Commercial:    accent-soft + accent     "COMMERCIAL"
Informational: info-soft + info         "INFORMATIONAL"
Transactional: warning-soft + warning   "TRANSACTIONAL"
Navigational:  surface-2 + text-2       "NAVIGATIONAL"
```

**Queue Button (Hover-Reveal):**
```css
.queue-btn {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity var(--motion-reveal), transform var(--motion-reveal);
}
.kw-row:hover .queue-btn {
  opacity: 1;
  transform: translateX(0);
}
.queue-btn.queued {
  opacity: 1;
  background: var(--accent);
  color: #fff;
}
```

**Priority Indicator:**
```css
.kw-row.priority::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  background: var(--accent);
}
```

---

## 4. Content Calendar

### Three View Modes

#### Month View (Notion-style)
```
┌─────────────────────────────────────────────────────────────────┐
│  ◀ May 2026 ▶                          Month | Week | List     │
├────────┬────────┬────────┬────────┬────────┬────────┬────────┤
│  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │  Sun   │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│        │        │        │   1    │   2    │   3    │   4    │
│        │        │        │  ●●    │  ●     │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│   5    │   6    │   7    │   8    │   9    │  10    │  11    │
│  ●●●   │  ●     │  ⚠     │  ●●    │  ●     │        │        │
│        │        │ no     │        │        │        │        │
│        │        │content │        │        │        │        │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┘

Legend:
● Published (green)
● Scheduled (blue, hollow)
● Draft (yellow, half-filled)
⚠ Content gap (warning)
```

#### Week View (Linear Roadmap-style)
```
┌───────────────────────────────────────────────────────────────────┐
│  Mon 5        Tue 6        Wed 7        Thu 8        Fri 9       │
├─────────────┬─────────────┬─────────────┬─────────────┬──────────┤
│             │             │             │             │          │
│ 9:00 ───────┼─────────────┼─────────────┼─────────────┼──────────│
│ ┌─────────┐ │             │             │ ┌─────────┐ │          │
│ │Best     │ │             │             │ │Teeth    │ │          │
│ │Running  │ │             │             │ │Whiten...│ │          │
│ │Shoes... │ │             │             │ │         │ │          │
│ │ ● 9 AM  │ │             │             │ │ ◐ Draft │ │          │
│ └─────────┘ │             │             │ └─────────┘ │          │
│             │             │             │             │          │
│ 10:00 ──────┼─────────────┼─────────────┼─────────────┼──────────│
│             │ ┌─────────┐ │             │             │          │
│             │ │SEO Guide│ │             │             │          │
│             │ │for 2026 │ │             │             │          │
│             │ │ ✓ Pub'd │ │             │             │          │
│             │ └─────────┘ │             │             │          │
└─────────────┴─────────────┴─────────────┴─────────────┴──────────┘
```

#### List View (Superhuman-style)
```
┌───────────────────────────────────────────────────────────────────┐
│  OVERDUE                                                          │
│  ├─ ● Dental Implants Guide          3 days overdue              │
│  └─ ● Best Dentist in Chicago        1 day overdue               │
│                                                                   │
│  TODAY · Monday, May 5                                            │
│  ├─ ◐ Best Running Shoes 2026        Draft · publishes in 4h 23m │
│  └─ ○ Teeth Whitening Complete Guide Scheduled · 2:00 PM         │
│                                                                   │
│  TOMORROW · Tuesday, May 6                                        │
│  └─ ○ SEO Guide for Beginners        Scheduled · 9:00 AM         │
│                                                                   │
│  THIS WEEK                                                        │
│  ├─ ◐ Running Shoe Reviews           Draft                       │
│  └─ ◐ Marathon Training Guide        Draft                       │
└───────────────────────────────────────────────────────────────────┘
```

### Article Status Visual System

| Status | Dot Style | Color | Use Case |
|--------|-----------|-------|----------|
| Published | Solid ● | `--success` #1B6E45 | Live content |
| Scheduled | Hollow ○ | `--info` #2D5A87 | Pending publish |
| Draft | Half ◐ | `--warning` #A87F1A | Work in progress |
| In Progress | Solid + halo | `--accent` #0F4F3D | Currently writing |
| Overdue | Solid ● + left bar | `--error` #9B2C2C | Missed deadline |

### Pipeline Progress Inline
```
Research ━━ Write ━━ Images ━━ Links ━━ Review ━━ Publish
   ✓         ✓        ●        ○         ○         ○
   ███████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

---

## 5. System-wide Migration Checklist

### Priority 0: Tokens Layer (2-3 hours)

**File:** `packages/ui/src/lib/tokens.css`

Add missing:
```css
/* Shadow with inset highlight (currently missing) */
--shadow-card:
  0 0 0 1px rgba(20, 20, 26, 0.045),
  0 1px 2px rgba(20, 20, 26, 0.03),
  inset 0 1px 0 rgba(255, 255, 255, 0.5);  /* ← ADD THIS */

/* CTA shadows (missing) */
--shadow-cta: ...
--shadow-cta-hover: ...

/* Type role classes (missing) */
.t-page-title { ... }
.t-eyebrow { ... }
.t-mono { ... }
.t-smallcaps { ... }
.num-mega { ... }
.num-card { ... }
```

### Priority 1: Card Primitive (3-4 hours)

**File:** `packages/ui/src/components/card.tsx`

Before:
```tsx
<div className="rounded-lg border bg-card shadow-sm" />
```

After:
```tsx
<div className={cn(
  "bg-surface rounded-[--radius-card]",
  "shadow-[--shadow-card]",
  "hover:shadow-[--shadow-lift] hover:-translate-y-px",
  "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
)} />
```

### Priority 2: Typography (4-5 hours)

**File:** `apps/web/src/app/layout.tsx`

Add font loading:
```tsx
import { Newsreader, Geist, Geist_Mono } from 'next/font/google'

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
})
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})
```

### Priority 3: KPI Components (2-3 hours)

- Verify NumMega/NumHero/NumCard with fonts
- Create StatusPill component
- Update progress block patterns

### Priority 4: Table/List Patterns (3-4 hours)

- v6-compliant DataTable primitive
- Hover-reveal arrow pattern
- Priority indicator bars

### Priority 5: Interaction Polish (3-4 hours)

- Utility bar with frosted glass
- Hidden-until-hover patterns
- Verify all motion tokens

---

## 6. Files Requiring Updates

### Critical
1. `packages/ui/src/lib/tokens.css` - Missing shadow insets
2. `packages/ui/src/components/card.tsx` - Full v6 rewrite
3. `packages/ui/src/components/button.tsx` - v6 variants
4. `packages/ui/src/components/badge.tsx` - Small-caps + semantics
5. `apps/web/src/components/ui/progress.tsx` - v6 styling

### High Priority
6. `apps/web/src/components/portal/GoalProgressCard.tsx` - Progress block
7. `apps/web/src/components/portal/ClusterCard.tsx` - Tier colors
8. Article generation pipeline component (TBD)

### Medium Priority
9. Error screens - Text ramp tokens
10. Page error boundary - v6 tokens

---

## 7. Design Principles Summary

### Non-Negotiables

1. **One editorial moment per card** - One big serif numeral that answers
2. **Cards are glass, not paper** - Ghost-edge shadows, never `border: 1px solid`
3. **Calm at rest, hover-to-reveal** - Secondary actions hidden until hover
4. **Numbers want air** - Big numerals need 2× visual weight in whitespace
5. **Warm-shifted grays** - #54545A not Tailwind slate-600

### "AI Look" Anti-Patterns to Avoid

| Tell | Fix |
|------|-----|
| Inter/system font | Geist + Newsreader |
| Tailwind slate grays | Warm-shifted text ramp |
| `border: 1px solid` | Ghost-edge shadows |
| All info visible | Hover-to-reveal |
| Generic green checks | Semantic-tinted icons |
| Pulsing dots | Static with soft halo |
| `text-transform: uppercase` | `font-variant-caps: all-small-caps` |

---

## 8. Implementation Notes

### "Under the Hood" Experience

The article generation pipeline should make AI work **visible and trustworthy**:

1. **Show real progress** - Not fake loading bars, actual step completion
2. **Reveal depth on demand** - Expand steps to see what happened
3. **Use tree structure** - `├─` and `└─` for nested details (developer feel)
4. **Show real metrics** - Words extracted, images found, pages blocked
5. **Time transparency** - Duration per step, ETA for completion
6. **Brand voice match %** - Show how well the AI matched voice profile

This builds trust and positions TeveroSEO as a premium AI tool, not a black box.

---

*Document generated by 5 Opus subagent analysis, 2026-05-06*
