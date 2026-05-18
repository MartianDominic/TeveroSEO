# Research 05: World-Class Content Calendar Architecture

> **Phase:** 99 — Unified SEO Content Pipeline  
> **Research Area:** Content Calendar (Agents 5-8)  
> **Status:** Complete  
> **Date:** 2026-05-11

---

## Executive Summary

This document defines the world-class content calendar architecture for TeveroSEO, rivaling Notion/Monday/Asana but purpose-built for SEO workflows. The calendar integrates keyword targeting, topic clusters, and the complete editorial pipeline while adhering strictly to design-system-v6.md principles.

**Key Innovation:** Unlike generic calendars, our SEO-specific calendar treats keywords as first-class citizens — every content item maps to a target keyword, cluster position, and internal link plan.

---

## 1. The Editorial Moment

> **v6 Principle:** "One editorial moment per page — the big serif numeral that reads as the answer."

### Content Calendar Editorial Moment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   12 / 20                                    ● ON TRACK                    │
│   ─────────                                    ETA May 31                   │
│   articles this month                          3 days ahead                 │
│                                                                             │
│   [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░]                 │
│                                        ▲ TARGET                             │
│                                                                             │
│   60% complete · 8 pending · +4 this week · 2 in review                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Typography (from design-system-v6.md Section 2.3):**
- `12` (current): `--num-mega` clamp(58px, 4.8vw, 80px) Newsreader 400, letter-spacing -0.034em
- `/ 20` (target): `--num-hero` clamp(38px, 3.2vw, 52px) Newsreader 300, color `--text-3`
- "articles this month": `--type-body` 14px Geist, color `--text-2`
- Detail row: `--type-small` 13px, color `--text-3`

**Why This Works:**
- User lands on calendar and immediately knows: "12 articles done, 8 to go, I'm on track"
- Matches goal-hero pattern from client dashboard for consistency
- Progress bar with target marker shows velocity at a glance

---

## 2. View Architecture: Calendar vs Kanban vs Timeline

### 2.1 Three Primary Views

The calendar supports three synchronized views — all tied to the same underlying data (following Notion's pattern).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONTENT CALENDAR                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  [Calendar]  [Kanban]  [Timeline]           May 2026  [<] [>]  [+]   │  │
│  │      ●         ○          ○                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tab Implementation (from design-system-v6.md Section 8.5):**
```css
.view-tab.active::after {
  content: "";
  position: absolute;
  left: 16px; right: 16px; bottom: -1px;
  height: 2px;
  background: var(--accent);
  border-radius: 1px 1px 0 0;
}
```

---

### 2.2 Calendar View (Month/Week/Day)

**Best For:** Visual scheduling, deadline awareness, publication cadence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAY 2026                                       │
├─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────────────┤
│   SUN   │   MON   │   TUE   │   WED   │   THU   │   FRI   │   SAT           │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────────────┤
│         │         │         │         │    1    │    2    │    3            │
│         │         │         │         │         │ ┌─────┐ │                 │
│         │         │         │         │         │ │ ▓▓▓ │ │                 │
│         │         │         │         │         │ │Draft│ │                 │
│         │         │         │         │         │ └─────┘ │                 │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────────────┤
│    4    │    5    │    6    │    7    │    8    │    9    │   10            │
│ ┌─────┐ │ ┌─────┐ │         │ ┌─────┐ │ ┌─────┐ │         │                 │
│ │ ███ │ │ │ ▒▒▒ │ │         │ │ ░░░ │ │ │ ███ │ │         │                 │
│ │Pub'd│ │ │Revw │ │         │ │Idea │ │ │Pub'd│ │         │                 │
│ └─────┘ │ └─────┘ │         │ └─────┘ │ └─────┘ │         │                 │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────────────┤
│   11    │   12    │   13    │   14    │   15    │   16    │   17            │
│ ┌─────┐ │ ┌─────┐ │ ┌─────┐ │         │ ┌─────┐ │ ┌─────┐ │                 │
│ │TODAY│ │ │ ▓▓▓ │ │ │ ▓▓▓ │ │         │ │ ▒▒▒ │ │ │ ░░░ │ │                 │
│ │2 due│ │ │Draft│ │ │Draft│ │         │ │Revw │ │ │Idea │ │                 │
│ └─────┘ │ └─────┘ │ └─────┘ │         │ └─────┘ │ └─────┘ │                 │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────────────┘
```

**Cell Card Design (v6 Compliant):**
```css
.calendar-item {
  background: var(--surface);
  border-radius: var(--radius-card);     /* 12px */
  box-shadow: var(--shadow-card);
  padding: 6px 8px;
  font-size: var(--type-tiny);           /* 12px WCAG floor */
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}
.calendar-item:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-1px);
}
```

**Status Color Coding (left border, 2px accent bar pattern):**
```css
.calendar-item.idea      { border-left: 2px solid var(--text-4); }
.calendar-item.outline   { border-left: 2px solid var(--info); }
.calendar-item.draft     { border-left: 2px solid var(--warning); }
.calendar-item.review    { border-left: 2px solid var(--accent-2); }
.calendar-item.published { border-left: 2px solid var(--success); }
```

---

### 2.3 Kanban View (Status Pipeline)

**Best For:** Workflow management, bottleneck identification, drag-and-drop progression

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KANBAN PIPELINE                                   │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│     IDEA     │   OUTLINE    │    DRAFT     │    REVIEW    │   PUBLISHED    │
│      (8)     │     (3)      │     (5)      │     (2)      │      (12)      │
├──────────────┼──────────────┼──────────────┼──────────────┼─────────────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌────────────┐ │
│ │          │ │ │          │ │ │          │ │ │          │ │ │            │ │
│ │ Best     │ │ │ Running  │ │ │ Marathon │ │ │ Trail    │ │ │ Hiking     │ │
│ │ Running  │ │ │ Shoes    │ │ │ Training │ │ │ Running  │ │ │ Boots      │ │
│ │ Gear     │ │ │ 2026     │ │ │ Guide    │ │ │ Tips     │ │ │ Guide      │ │
│ │          │ │ │          │ │ │          │ │ │          │ │ │            │ │
│ │ ──────── │ │ │ ──────── │ │ │ ──────── │ │ │ ──────── │ │ │ ────────── │ │
│ │ KW: 2.4K │ │ │ KW: 8.1K │ │ │ KW: 1.2K │ │ │ KW: 900  │ │ │ KW: 3.2K   │ │
│ │ KD: 32   │ │ │ KD: 67   │ │ │ KD: 28   │ │ │ KD: 19   │ │ │ Pos: #4    │ │
│ │ Due: — │  │ │ Due: May 15│ │ Due: May 12│ │ May 14   │ │ │ May 8      │ │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │ └────────────┘ │
│              │              │              │              │                │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌────────────┐ │
│ │          │ │ │          │ │ │          │ │ │          │ │ │            │ │
│ │ Protein  │ │ │ Recovery │ │ │ Nutrition│ │ │ Sleep    │ │ │ Pre-Run    │ │
│ │ for      │ │ │ Techniques│ │ for       │ │ │ for      │ │ │ Meals      │ │
│ │ Runners  │ │ │          │ │ │ Athletes │ │ │ Athletes │ │ │            │ │
│ │          │ │ │          │ │ │          │ │ │          │ │ │            │ │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │ └────────────┘ │
│              │              │              │              │                │
│ [+ Add Idea] │              │              │              │                │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘
```

**Column Header Design:**
```css
.kanban-column-header {
  font-size: var(--type-tiny);           /* 12px */
  font-variant-caps: all-small-caps;
  letter-spacing: 0.1em;
  color: var(--text-3);
}
.kanban-column-header .count {
  font-variant-numeric: tabular-nums lining-nums;
  background: var(--surface-2);
  padding: 1px 7px;
  border-radius: var(--radius-pill);
}
```

**Kanban Card Design:**
```css
.kanban-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--space-4);               /* 12-16px fluid */
  cursor: grab;
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}
.kanban-card:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-2px);
}
.kanban-card.dragging {
  box-shadow: var(--shadow-pop);
  transform: rotate(2deg) scale(1.02);
  cursor: grabbing;
}
```

---

### 2.4 Timeline View (Gantt-Style)

**Best For:** Multi-week planning, cluster sequencing, dependency visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TIMELINE VIEW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ARTICLE             │  May 5   │  May 12  │  May 19  │  May 26  │  Jun 2   │
│ ────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────│
│                     │          │          │          │          │          │
│ [P] Running Gear    │ ████████████████████████████████████████████████████ │
│     Guide (Pillar)  │ ░░░░░░░░░░░░░░░░░░░░│██████████│▓▓▓▓▓▓▓▓▓▓│          │
│                     │ Outline  │ Draft    │ Review   │ Publish  │          │
│                     │          │          │          │          │          │
│ [C] Best Running    │          │ ████████████████████████████████│          │
│     Shoes 2026      │          │ ░░░░░░░░░│██████████│▓▓▓▓▓▓▓▓▓▓│          │
│                     │          │          │          │          │          │
│ [C] Marathon        │                     │ █████████████████████████████  │
│     Training        │                     │ ░░░░░░░░░│██████████│▓▓▓▓▓▓▓▓  │
│                     │          │          │          │          │          │
│ [C] Trail Running   │                               │ ████████████████████ │
│     Tips            │                               │ ░░░░░░░░░│██████████ │
│                     │          │          │          │          │          │
└─────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

Legend: [P] Pillar  [C] Cluster  ░ Outline  █ Draft  ▓ Review  ● Published
```

**Timeline Bar Design:**
```css
.timeline-bar {
  height: 24px;
  border-radius: 4px;
  position: relative;
}
.timeline-bar .phase-outline   { background: var(--surface-3); }
.timeline-bar .phase-draft     { background: var(--warning-soft); }
.timeline-bar .phase-review    { background: var(--accent-soft); }
.timeline-bar .phase-published { background: var(--success); }
```

**Cluster Dependency Lines:**
```css
.dependency-line {
  stroke: var(--accent-line);
  stroke-width: 1.5px;
  stroke-dasharray: 4 2;
  fill: none;
}
```

---

## 3. Status Pipeline: The 6-Stage Workflow

### 3.1 Status Definitions

| Status | Definition | Entry Trigger | Exit Trigger |
|--------|------------|---------------|--------------|
| **IDEA** | Topic identified, keyword assigned, not started | Keyword selected from intelligence | Outline approved |
| **OUTLINE** | Structure defined, sections planned | User starts outlining | Outline marked complete |
| **DRAFT** | Content being written (AI or human) | Generation started | Draft submitted |
| **REVIEW** | Quality gate check, human review | Draft submitted | Approved or rejected |
| **SCHEDULED** | Approved, awaiting publish date | Review approved | Publish date reached |
| **PUBLISHED** | Live on CMS, GSC submitted | Auto-publish or manual | — |

### 3.2 Pipeline Stage Component

Following v6 Section 14.5 (Pipeline stages with relative-volume bars):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE STAGES                                   │
├────────────┬────────────┬────────────┬────────────┬────────────┬────────────┤
│    IDEA    │  OUTLINE   │   DRAFT    │   REVIEW   │ SCHEDULED  │ PUBLISHED  │
│     8      │     3      │     5      │     2      │     1      │    12      │
│   ████     │    ██      │   ███      │    █       │    █       │  ██████    │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

**Volume Bar CSS:**
```css
.pipeline-stage {
  text-align: center;
  padding: var(--space-4);
}
.pipeline-stage .label {
  font-size: var(--type-tiny);
  font-variant-caps: all-small-caps;
  letter-spacing: 0.1em;
  color: var(--text-3);
}
.pipeline-stage .count {
  font-family: var(--font-display);
  font-size: var(--num-row);             /* clamp(20px, 1.7vw, 26px) */
  font-variant-numeric: tabular-nums lining-nums;
  color: var(--text-1);
}
.pipeline-stage .volume-bar {
  height: 3px;
  background: var(--accent-tint);
  border-radius: 1.5px;
  margin-top: 8px;
}
.pipeline-stage.active .volume-bar {
  background: var(--accent);
}
```

### 3.3 Status Transition Rules

```typescript
interface StatusTransition {
  from: ContentStatus;
  to: ContentStatus;
  trigger: 'manual' | 'auto' | 'scheduled';
  conditions?: {
    qualityScore?: number;      // Min score for auto-publish
    reviewRequired?: boolean;   // Must have human review
    linksPrepared?: boolean;    // Internal links mapped
  };
  actions?: {
    notifySlack?: boolean;
    submitGSC?: boolean;
    insertLinks?: boolean;
  };
}

const TRANSITIONS: StatusTransition[] = [
  { from: 'idea', to: 'outline', trigger: 'manual' },
  { from: 'outline', to: 'draft', trigger: 'auto', actions: { notifySlack: true } },
  { from: 'draft', to: 'review', trigger: 'manual' },
  { 
    from: 'review', 
    to: 'scheduled', 
    trigger: 'auto',
    conditions: { qualityScore: 80, linksPrepared: true }
  },
  { 
    from: 'scheduled', 
    to: 'published', 
    trigger: 'scheduled',
    actions: { submitGSC: true, insertLinks: true }
  },
];
```

---

## 4. Keyword Integration with Content Items

### 4.1 The SEO-First Content Card

Unlike generic calendars, every content item displays keyword intelligence:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Best Running Shoes for Marathon Training 2026                        │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ TARGET KEYWORD                                                    │ │ │
│  │  │                                                                   │ │ │
│  │  │ "best running shoes marathon"                                     │ │ │
│  │  │                                                                   │ │ │
│  │  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────────────────┐ │ │ │
│  │  │ │ 8,100   │ │ KD: 67  │ │ BOFU    │ │ ★ Running Gear [Cluster] │ │ │ │
│  │  │ │ vol/mo  │ │ medium  │ │ intent  │ │   links to pillar        │ │ │ │
│  │  │ └─────────┘ └─────────┘ └─────────┘ └──────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ STATUS           │ SCHEDULED      │ AUTHOR         │ QUALITY     │ │ │
│  │  │ ● Draft          │ May 15, 2026   │ Sarah M.       │ — pending   │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ INTERNAL LINKS (planned)                                         │ │ │
│  │  │                                                                   │ │ │
│  │  │ ← Links FROM:  Running Gear Guide (pillar)                       │ │ │
│  │  │ → Links TO:    Marathon Training Guide, Trail Running Tips       │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  [Edit] [Generate] [View History]                              → 　   │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Content Item Data Model

```typescript
interface ContentCalendarItem {
  id: string;
  title: string;
  slug?: string;
  
  // SEO Core (THE DIFFERENTIATOR)
  keyword: {
    primary: string;
    volume: number;
    difficulty: number;
    intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
    position?: number;          // Current ranking if tracked
  };
  cluster?: {
    id: string;
    name: string;
    pillarId: string;
    role: 'pillar' | 'spoke';
  };
  internalLinks: {
    from: string[];             // IDs of pages that should link TO this
    to: string[];               // IDs of pages this should link TO
    confirmed: boolean;         // Links verified/inserted
  };
  
  // Workflow
  status: 'idea' | 'outline' | 'draft' | 'review' | 'scheduled' | 'published';
  assignee?: string;
  scheduledDate?: Date;
  publishedDate?: Date;
  publishedUrl?: string;
  
  // Quality
  qualityScore?: number;        // 0-100, from quality gate
  qualityBreakdown?: {
    readability: number;
    keywordDensity: number;
    eeatSignals: number;
    originality: number;
    voiceMatch: number;
  };
  
  // Metadata
  contentType: 'article' | 'guide' | 'listicle' | 'comparison' | 'how-to';
  wordCountTarget?: number;
  estimatedReadTime?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.3 Keyword-to-Content Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KEYWORD → CONTENT FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ INTELLIGENCE│  select │   CONTENT   │  enrich │   CALENDAR  │           │
│  │   KEYWORDS  │────────▶│   CREATOR   │────────▶│    ITEM     │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│        │                       │                       │                    │
│        ▼                       ▼                       ▼                    │
│   • Quick Wins            • Title gen            • Auto-schedule            │
│   • Opportunity score     • Outline gen          • Link mapping             │
│   • Cluster assignment    • Voice prep           • Assignee pick            │
│   • Competitor gap        • Word count           • Priority calc            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**"Create Article" from Intelligence Page:**
```typescript
async function createContentFromKeyword(keyword: KeywordData): Promise<ContentCalendarItem> {
  // 1. Find or create cluster
  const cluster = await findOrCreateCluster(keyword);
  
  // 2. Generate title suggestions
  const titles = await generateTitles(keyword, cluster);
  
  // 3. Calculate internal link targets
  const linkTargets = await calculateLinkTargets(keyword, cluster);
  
  // 4. Determine optimal schedule slot
  const scheduleSlot = await findOptimalSlot(cluster);
  
  // 5. Create calendar item
  return {
    title: titles[0],
    keyword: {
      primary: keyword.keyword,
      volume: keyword.searchVolume,
      difficulty: keyword.difficulty,
      intent: keyword.intent,
    },
    cluster: {
      id: cluster.id,
      name: cluster.name,
      pillarId: cluster.pillarId,
      role: cluster.pillarId ? 'spoke' : 'pillar',
    },
    internalLinks: {
      from: linkTargets.from,
      to: linkTargets.to,
      confirmed: false,
    },
    status: 'idea',
    scheduledDate: scheduleSlot,
    contentType: inferContentType(keyword),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```

---

## 5. v6-Compliant Card Designs

### 5.1 Content Item Card (Compact — Calendar/Kanban)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ COMPACT CARD (140px x 80px for calendar cells)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │▌Best Running Shoes for Marathon Training                     │          │
│  │                                                              │          │
│  │  8.1K vol · KD 67 · BOFU                           May 15    │          │
│  │                                                          →   │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ▌= 2px status color bar (left edge)                                       │
│  → = hover-reveal navigation arrow                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**CSS (v6 Compliant):**
```css
.content-card-compact {
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 10px 12px 10px 14px;
  position: relative;
  overflow: hidden;
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}

/* Status bar (left edge) */
.content-card-compact::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  background: var(--status-color);
}

/* Title */
.content-card-compact .title {
  font-size: var(--type-tiny);           /* 12px - WCAG floor */
  font-weight: 500;
  color: var(--text-1);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Meta row */
.content-card-compact .meta {
  font-size: var(--type-tiny);
  color: var(--text-3);
  font-variant-numeric: tabular-nums lining-nums;
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Hover arrow (v6 hover-to-reveal) */
.content-card-compact .arrow {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity var(--motion-reveal), transform var(--motion-reveal);
  color: var(--text-3);
}
.content-card-compact:hover .arrow {
  opacity: 1;
  transform: translateX(0);
  color: var(--accent);
}

/* Hover lift */
.content-card-compact:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-1px);
}
```

### 5.2 Content Item Card (Expanded — Detail View)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ EXPANDED CARD (Full detail panel)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │ CARD HEAD                                                        │  │ │
│  │  │                                                                  │  │ │
│  │  │ ⊙ Best Running Shoes for Marathon Training 2026                 │  │ │
│  │  │   Draft · Updated 2h ago                            [⋯]         │  │ │
│  │  │                                                                  │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │  ─────────────────────────────────────────────────────────────────────│ │
│  │                                                                        │ │
│  │  KEYWORD TARGET                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │ "best running shoes marathon"                                    │  │ │
│  │  │                                                                  │  │ │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │  │ │
│  │  │ │ VOLUME   │ │ KD       │ │ INTENT   │ │ POSITION │             │  │ │
│  │  │ │ 8,100    │ │ 67       │ │ BOFU     │ │ —        │             │  │ │
│  │  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘             │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  TOPIC CLUSTER                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │ ★ Running Gear Guide                              [View Cluster] │  │ │
│  │  │   This article is a SPOKE linking to the pillar                  │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  INTERNAL LINKS                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │ ← LINKS FROM (2)                                                 │  │ │
│  │  │   Running Gear Guide (pillar)                                    │  │ │
│  │  │   Best Running Watches 2026                                      │  │ │
│  │  │                                                                  │  │ │
│  │  │ → LINKS TO (3)                                                   │  │ │
│  │  │   Marathon Training Guide                                        │  │ │
│  │  │   Trail Running Tips                                             │  │ │
│  │  │   Running Nutrition Guide                                        │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  QUALITY GATE                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │ Score: — (not yet generated)                                     │  │ │
│  │  │                                                                  │  │ │
│  │  │ [Generate Article]  [Edit Outline]  [Schedule]                   │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  ───────────────────────────────────────────────────────────────────  │ │
│  │  CARD FOOT                                                            │ │
│  │  Created May 3 · Assigned to Sarah M. · Due May 15                    │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Status Pills (v6 Section 6.1)

```css
/* Status pill variants */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px 5px 9px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.06em;
  font-variant-caps: all-small-caps;
}

.status-pill.idea {
  background: var(--surface-2);
  color: var(--text-2);
  box-shadow: 0 0 0 1px var(--hairline);
}

.status-pill.outline {
  background: var(--info-soft);
  color: var(--info);
  box-shadow: 0 0 0 1px rgba(45, 90, 135, 0.12);
}

.status-pill.draft {
  background: var(--warning-soft);
  color: var(--warning);
  box-shadow: 0 0 0 1px rgba(168, 127, 26, 0.12);
}

.status-pill.review {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: 0 0 0 1px rgba(15, 79, 61, 0.12);
}

.status-pill.scheduled {
  background: var(--accent-soft);
  color: var(--accent-ink);
  box-shadow: 0 0 0 1px rgba(15, 79, 61, 0.12);
}

.status-pill.published {
  background: var(--success-soft);
  color: var(--success);
  box-shadow: 0 0 0 1px rgba(27, 110, 69, 0.12);
}
```

### 5.4 Intent Badges (v6 Section 6.3)

```css
.intent-badge {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  font-variant-caps: all-small-caps;
}

.intent-badge.informational {
  background: var(--info-soft);
  color: var(--info);
}

.intent-badge.commercial {
  background: var(--accent-soft);
  color: var(--accent);
}

.intent-badge.transactional {
  background: var(--warning-soft);
  color: var(--warning);
}

.intent-badge.navigational {
  background: var(--surface-2);
  color: var(--text-2);
}
```

---

## 6. Component Specifications

### 6.1 ContentCalendarPage Component Tree

```
ContentCalendarPage
├── PageHeader (v6 utility bar pattern)
│   ├── PageTitle ("Content Calendar")
│   ├── PeriodSelector (7D/30D/90D/1Y)
│   └── ActionButtons ([+ New Article] [Import CSV])
│
├── GoalHeroCard (editorial moment)
│   ├── ProgressNumerals ("12 / 20")
│   ├── StatusPill ("ON TRACK")
│   ├── ProgressBar (with target marker)
│   └── MetricsRow (60% complete · 8 pending · +4 this week)
│
├── ViewTabs
│   ├── CalendarTab (default)
│   ├── KanbanTab
│   └── TimelineTab
│
├── PipelineStages (volume bars)
│   ├── StageColumn (IDEA)
│   ├── StageColumn (OUTLINE)
│   ├── StageColumn (DRAFT)
│   ├── StageColumn (REVIEW)
│   ├── StageColumn (SCHEDULED)
│   └── StageColumn (PUBLISHED)
│
├── [View-Specific Content]
│   ├── CalendarGrid (react-big-calendar or custom)
│   │   ├── MonthView
│   │   ├── WeekView
│   │   └── DayView
│   │
│   ├── KanbanBoard (@dnd-kit/core)
│   │   ├── KanbanColumn (per status)
│   │   └── KanbanCard (draggable)
│   │
│   └── TimelineChart (custom SVG or @nivo/gantt)
│       ├── TimelineRow (per content item)
│       └── DependencyLines (cluster links)
│
├── ContentDetailSheet (right-side panel)
│   ├── SheetHeader
│   ├── KeywordSection
│   ├── ClusterSection
│   ├── InternalLinksSection
│   ├── QualityGateSection
│   └── ActionButtons
│
└── Modals
    ├── CreateContentModal
    ├── ImportCSVModal
    ├── BulkScheduleModal
    └── ClusterPlannerModal
```

### 6.2 State Management (Zustand)

```typescript
interface ContentCalendarState {
  // Data
  items: ContentCalendarItem[];
  clusters: TopicCluster[];
  
  // UI State
  view: 'calendar' | 'kanban' | 'timeline';
  dateRange: { start: Date; end: Date };
  filters: {
    status?: ContentStatus[];
    cluster?: string;
    assignee?: string;
    intent?: string;
  };
  selectedItem: string | null;
  
  // Loading States
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchItems: (clientId: string, dateRange: DateRange) => Promise<void>;
  createItem: (data: CreateContentInput) => Promise<ContentCalendarItem>;
  updateItem: (id: string, data: Partial<ContentCalendarItem>) => Promise<void>;
  moveItem: (id: string, newStatus: ContentStatus) => Promise<void>;
  scheduleItem: (id: string, date: Date) => Promise<void>;
  bulkSchedule: (ids: string[], startDate: Date, cadence: number) => Promise<void>;
  
  // View Actions
  setView: (view: ViewType) => void;
  setDateRange: (range: DateRange) => void;
  setFilters: (filters: Partial<CalendarFilters>) => void;
  selectItem: (id: string | null) => void;
}

export const useContentCalendarStore = create<ContentCalendarState>((set, get) => ({
  items: [],
  clusters: [],
  view: 'calendar',
  dateRange: { 
    start: startOfMonth(new Date()), 
    end: endOfMonth(new Date()) 
  },
  filters: {},
  selectedItem: null,
  loading: false,
  error: null,
  
  // Implementation...
}));
```

### 6.3 API Endpoints

```typescript
// Content Calendar Endpoints
GET    /api/clients/:clientId/calendar/items
       ?start=2026-05-01&end=2026-05-31
       &status=draft,review
       &cluster=running-gear
       
POST   /api/clients/:clientId/calendar/items
       Body: { title, keyword, cluster?, scheduledDate? }

PATCH  /api/clients/:clientId/calendar/items/:id
       Body: { status?, scheduledDate?, assignee? }

POST   /api/clients/:clientId/calendar/items/:id/generate
       Triggers AI content generation

POST   /api/clients/:clientId/calendar/items/:id/schedule
       Body: { date, time? }

POST   /api/clients/:clientId/calendar/bulk-schedule
       Body: { ids: [], startDate, cadence }

// Cluster Endpoints
GET    /api/clients/:clientId/clusters
POST   /api/clients/:clientId/clusters
       Body: { name, pillarKeyword }

GET    /api/clients/:clientId/clusters/:id/items
```

---

## 7. Empty States

### 7.1 No Content Items

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
│                          ┌─────────────────┐                                │
│                          │                 │                                │
│                          │    📅           │                                │
│                          │                 │                                │
│                          └─────────────────┘                                │
│                                                                             │
│                     No content scheduled yet                                │
│                                                                             │
│             Start by creating your first article or importing              │
│                    keywords from your Intelligence page.                    │
│                                                                             │
│               [+ Create Article]    [Import Keywords]                       │
│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**v6 Empty State Pattern:**
- Icon: 48x48, color `--text-4`
- Headline: `--type-h3` (15-16px), font-weight 500, `--text-1`
- Body: `--type-body` (14px), `--text-3`
- CTA: Primary button (first) + Ghost button (second)

### 7.2 No Items in Status Column (Kanban)

```
┌────────────────┐
│     REVIEW     │
│      (0)       │
├────────────────┤
│                │
│   No articles  │
│   in review    │
│                │
│   Drag items   │
│   here when    │
│   ready        │
│                │
└────────────────┘
```

---

## 8. Responsive Behavior

### 8.1 Breakpoints (from v6 Section 13)

| Breakpoint | Layout | View Behavior |
|------------|--------|---------------|
| >= 1180px | 3-column shell | All views available, side-by-side detail panel |
| 880-1179px | 2-column shell (no rail) | All views, overlay detail panel |
| < 880px | 1-column mobile | Calendar defaults to agenda view, Kanban to single-column scroll |

### 8.2 Mobile Calendar Adaptations

```css
@media (max-width: 880px) {
  /* Calendar: agenda view default */
  .calendar-grid { display: none; }
  .calendar-agenda { display: block; }
  
  /* Kanban: horizontal scroll */
  .kanban-board {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .kanban-column {
    min-width: 280px;
    scroll-snap-align: start;
  }
  
  /* Timeline: simplified list */
  .timeline-gantt { display: none; }
  .timeline-list { display: block; }
}
```

### 8.3 Container Queries (v6 Section 12)

```css
.content-calendar-page {
  container-type: inline-size;
  container-name: calendar;
}

@container calendar (max-width: 720px) {
  .pipeline-stages {
    grid-template-columns: repeat(3, 1fr);
  }
  .goal-hero .metrics-row {
    flex-wrap: wrap;
  }
}

@container calendar (max-width: 480px) {
  .pipeline-stages {
    grid-template-columns: repeat(2, 1fr);
  }
  .view-tabs {
    overflow-x: auto;
  }
}
```

---

## 9. Keyboard Navigation & Accessibility

### 9.1 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `G C` | Go to Calendar page |
| `1` | Switch to Calendar view |
| `2` | Switch to Kanban view |
| `3` | Switch to Timeline view |
| `N` | New content item |
| `←` / `→` | Navigate month (calendar) / columns (kanban) |
| `↑` / `↓` | Navigate items |
| `Enter` | Open selected item detail |
| `Escape` | Close detail panel |
| `D` | Set deadline for selected item |
| `S` | Change status (opens dropdown) |

### 9.2 ARIA Labels

```tsx
<div 
  role="grid" 
  aria-label="Content calendar for May 2026"
  aria-rowcount={weeksInMonth}
  aria-colcount={7}
>
  <div role="row" aria-rowindex={1}>
    <div role="columnheader" aria-colindex={1}>Sunday</div>
    {/* ... */}
  </div>
  <div role="row" aria-rowindex={2}>
    <div role="gridcell" aria-colindex={1} tabindex={0}>
      <span aria-label="May 4, 2026: 2 articles scheduled">
        {/* cell content */}
      </span>
    </div>
  </div>
</div>

<div 
  role="region" 
  aria-label="Kanban board"
>
  <div role="list" aria-label="Idea column, 8 items">
    <div role="listitem" draggable="true" aria-grabbed="false">
      {/* card content */}
    </div>
  </div>
</div>
```

---

## 10. Integration Points

### 10.1 Intelligence Page Integration

```typescript
// From /clients/[clientId]/intelligence page
async function createArticleFromQuickWin(keyword: QuickWinKeyword) {
  // Navigate to calendar with pre-filled data
  router.push({
    pathname: `/clients/${clientId}/calendar`,
    query: {
      action: 'create',
      keyword: keyword.keyword,
      volume: keyword.volume,
      difficulty: keyword.difficulty,
      intent: keyword.intent,
      cluster: keyword.suggestedCluster,
    }
  });
}
```

### 10.2 Quality Gate Integration

```typescript
// After article generation completes
async function handleGenerationComplete(itemId: string, result: GenerationResult) {
  const qualityScore = await runQualityGate(result.content);
  
  await updateItem(itemId, {
    qualityScore: qualityScore.total,
    qualityBreakdown: qualityScore.breakdown,
    status: qualityScore.total >= 80 ? 'scheduled' : 'review',
  });
  
  // Show quality gate panel
  setSelectedItem(itemId);
  setShowQualityPanel(true);
}
```

### 10.3 Publishing Integration

```typescript
// Scheduled publish trigger (cron job or BullMQ)
async function processScheduledPublish(item: ContentCalendarItem) {
  // 1. Verify quality gate still passes
  if (item.qualityScore < 80) {
    await updateItem(item.id, { status: 'review' });
    await notifyReviewRequired(item);
    return;
  }
  
  // 2. Insert internal links
  const linkedContent = await insertInternalLinks(
    item.content,
    item.internalLinks.to
  );
  
  // 3. Publish to CMS
  const publishResult = await publishToCMS(item.clientId, {
    title: item.title,
    content: linkedContent,
    slug: item.slug,
  });
  
  // 4. Submit to GSC
  await submitToGSC(item.clientId, publishResult.url);
  
  // 5. Update calendar item
  await updateItem(item.id, {
    status: 'published',
    publishedDate: new Date(),
    publishedUrl: publishResult.url,
    internalLinks: { ...item.internalLinks, confirmed: true },
  });
  
  // 6. Log to Today feed
  await logToActivityFeed(item.clientId, {
    type: 'content_published',
    title: item.title,
    url: publishResult.url,
    linkedPagesCount: item.internalLinks.to.length,
  });
}
```

---

## 11. Autonomy vs Control Matrix

| Feature | Autonomy Mode | Control Point | Override Location |
|---------|---------------|---------------|-------------------|
| **Scheduling** | Auto-suggest optimal dates based on cluster | Drag to any date | Calendar drag-drop |
| **Status Progression** | Auto-advance when conditions met | Manual advance anytime | Status dropdown |
| **Internal Links** | Auto-map based on cluster | Review before confirm | Links section in detail |
| **Publishing** | Auto-publish if score >= threshold | Hold for review | Quality gate panel |
| **Keyword Assignment** | Suggest from Intelligence | Manual keyword entry | Create/Edit modal |
| **Cluster Assignment** | Auto-assign to best-fit cluster | Override cluster | Cluster dropdown |

---

## 12. Performance Considerations

### 12.1 Virtualization

For calendars with 100+ items, use virtualized rendering:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedKanbanColumn({ items }: { items: ContentCalendarItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated card height
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} className="kanban-column-scroll">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <KanbanCard
            key={items[virtualItem.index].id}
            item={items[virtualItem.index]}
            style={{
              position: 'absolute',
              top: virtualItem.start,
              height: virtualItem.size,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

### 12.2 Optimistic Updates

```typescript
// Drag-drop status change with optimistic update
async function handleDragEnd(itemId: string, newStatus: ContentStatus) {
  // Optimistic update
  set((state) => ({
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, status: newStatus } : item
    ),
  }));
  
  try {
    // Server update
    await api.patch(`/calendar/items/${itemId}`, { status: newStatus });
  } catch (error) {
    // Rollback on failure
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, status: originalStatus } : item
      ),
    }));
    toast.error('Failed to update status');
  }
}
```

---

## 13. Migration from Current Implementation

### 13.1 Current State Analysis

The existing `ContentCalendarPage.tsx` (AI-Writer) has:
- react-big-calendar integration (good foundation)
- Basic status pipeline (8 statuses, need to consolidate to 6)
- CSV import capability
- Article detail sheet

**Gaps to Address:**
1. No keyword integration (THE major gap)
2. No cluster/topic management
3. No internal link planning
4. No Kanban view
5. No Timeline view
6. No v6 design system compliance
7. No goal hero/editorial moment

### 13.2 Migration Plan

| Phase | Focus | Components |
|-------|-------|------------|
| **Phase 1** | Design system migration | Apply v6 tokens, card shadows, typography |
| **Phase 2** | Data model extension | Add keyword, cluster, internalLinks fields |
| **Phase 3** | Goal hero component | Build editorial moment header |
| **Phase 4** | View architecture | Add Kanban, Timeline alongside Calendar |
| **Phase 5** | Intelligence integration | Connect keyword → content flow |
| **Phase 6** | Link planning | Build internal link mapping UI |

---

## 14. References

### Design System
- [design-system-v6.md](/home/dominic/Documents/TeveroSEO/.planning/design/design-system-v6.md) — Visual rules
- [v7-master-design-architecture.md](/home/dominic/Documents/TeveroSEO/.planning/design/v7-master-design-architecture.md) — Page anatomy, autonomy/control

### Existing Implementation
- [ContentCalendarPage.tsx](/home/dominic/Documents/TeveroSEO/AI-Writer/frontend/src/pages/ContentCalendarPage.tsx) — Current calendar implementation
- [page-inventory.md](/home/dominic/Documents/TeveroSEO/.planning/design/page-inventory.md) — All pages in the system

### Research Sources
- [Calendar UI Examples: 33 Inspiring Designs](https://www.eleken.co/blog-posts/calendar-ui)
- [The 7 best content calendar software tools 2026 - Airtable](https://www.airtable.com/articles/content-calendar-software)
- [Best content calendar tools for 2026 - Hootsuite](https://blog.hootsuite.com/content-calendar-tools/)
- [CoSchedule Review](https://nathanojaokomo.com/blog/coschedule-review)
- [Editorial Workflow: How to Streamline Content Creation](https://www.cflowapps.com/editorial-workflow/)
- [Content workflow: A resourceful guide for 2026](https://planable.io/blog/content-workflow/)
- [SEO Content Calendar: Planning Content That Ranks](https://www.stackmatix.com/blog/seo-content-calendar)
- [Topic Clusters for SEO - Semrush](https://www.semrush.com/blog/topic-clusters/)
- [Automated SEO Content Calendar: Complete Guide 2026](https://www.trysight.ai/blog/automated-seo-content-calendar)

---

*Document complete. Ready for implementation planning.*
