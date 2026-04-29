# v7 Architecture Addendum: Phase 43 Journeys

> **Purpose**: Document new user journeys created by Phase 43 (Prospect Keyword Pipeline) that must be integrated into v7-master-design-architecture.md
> **Date**: 2026-04-30
> **Status**: MUST BE MERGED before Phase 44+ execution

---

## Executive Summary

Phase 43 creates a **Prospect Intelligence Pipeline** — a new domain of 15 journeys not covered in the original v6-comprehensive-journeys.md. These represent a fundamental expansion of the prospect experience from basic CRUD to a full keyword intelligence workflow.

### Journey Count Impact

| Document | Before | After Phase 43 |
|----------|--------|----------------|
| Domain 3: Prospects | 18 journeys | 33 journeys (+15) |
| Total Platform | 200 journeys | 215 journeys |

---

## New Cross-Domain Pattern: Pattern F

Add to v7-master-design-architecture.md after Pattern E:

### Pattern F: Keyword Intelligence Pipeline

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  KEYWORD        │ ──────► │  PRIORITIZATION │ ──────► │  PROPOSAL       │
│  ENTRY          │ analyze │  ENGINE         │ generate│  BUILDER        │
│                 │         │                 │         │                 │
│  • Quick Check  │         │  • 5-factor     │         │  • Awareness    │
│  • Competitor   │         │  • Quick wins   │         │  • AI sections  │
│  • CSV Import   │         │  • Tier filter  │         │  • Agreement    │
│  • AI Discover  │         │  • Score editor │         │  • Preview      │
└─────────────────┘         └─────────────────┘         └─────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  SCRAPE         │         │  OPPORTUNITY    │         │  CLIENT         │
│  CONFIG         │         │  DASHBOARD      │         │  CONVERSION     │
│                 │         │                 │         │                 │
│  • AI selectors │         │  • Quick wins   │         │  • Keywords     │
│  • Custom rules │         │  • Stuck        │         │    imported     │
│  • Rule editor  │         │  • Long-term    │         │  • Auto audit   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

**Autonomy Points:**
- AI auto-detects CSV column mappings
- System auto-discovers CSS selectors for e-commerce sites
- Auto-prioritization scores all keywords on import
- Quick win detection runs automatically
- Awareness classification drives proposal content

**Control Points:**
- User confirms column mappings before import
- User edits/approves AI-discovered selectors
- Power users customize score weights per factor
- User chooses which quick wins to include in proposal
- User edits AI-generated proposal sections

---

## New Journeys: Domain 3 Additions (3.19 - 3.33)

### Keyword Entry Journeys

| # | Journey | Entry Point | Exit Point | Components Needed |
|---|---------|-------------|------------|-------------------|
| 3.19 | Quick keyword check | /prospects/keywords/quick-check | Validation result | QuickCheckPanel |
| 3.20 | Competitor keyword spy | /prospects/keywords/competitor-spy | Keywords discovered | CompetitorSpyResults |
| 3.21 | Smart CSV import | /prospects/[id]/keywords/import | Keywords imported | CSVImportWizard, ColumnMapper |
| 3.22 | Choose entry method | /prospects/keywords | Entry point page | EntrySelector |

### Prioritization Journeys

| # | Journey | Entry Point | Exit Point | Components Needed |
|---|---------|-------------|------------|-------------------|
| 3.23 | View prioritized keywords | /prospects/[id]/keywords | - | KeywordTable, TierFilter |
| 3.24 | Filter by tier | /prospects/[id]/keywords | Filtered view | TierFilterStrip |
| 3.25 | Find quick wins | /prospects/[id]/keywords | Quick wins highlighted | QuickWinBadge |
| 3.26 | Customize score weights | /prospects/[id]/keywords | Weights saved | ScoreWeightEditor |
| 3.27 | Bulk update keywords | /prospects/[id]/keywords | Updated | BulkActionBar |

### Scrape Configuration Journeys

| # | Journey | Entry Point | Exit Point | Components Needed |
|---|---------|-------------|------------|-------------------|
| 3.28 | Configure scrape rules | /prospects/[id]/scrape-config | Rules saved | ScrapeRuleBuilder |
| 3.29 | AI discover selectors | /prospects/[id]/scrape-config | Selectors proposed | SelectorDiscoveryPanel |
| 3.30 | Test extraction rule | /prospects/[id]/scrape-config | Test results | RuleTestPreview |

### Proposal Generation Journeys (Enhanced)

| # | Journey | Entry Point | Exit Point | Components Needed |
|---|---------|-------------|------------|-------------------|
| 3.31 | AI-generate proposal | /prospects/[id]/proposal/builder | Sections generated | ProposalSectionCard |
| 3.32 | Classify awareness level | /prospects/[id]/proposal/builder | Level determined | AwarenessLevelIndicator |
| 3.33 | Generate agreement (sutartis) | /prospects/[id]/proposal/builder | Agreement ready | AgreementPreview |

---

## Autonomy/Control Matrix Updates

Add to the Autonomy/Control Matrix in v7:

```
                    HIGH AUTONOMY
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    │  CSV COLUMN        │   PRIORITIZATION   │
    │  DETECTION         │   (auto-score)     │
    │                    │                    │
    │  SELECTOR          │   QUICK WIN        │
    │  DISCOVERY         │   DETECTION        │
    │                    │                    │
LOW │  AWARENESS         │   COMPETITOR       │ HIGH
VISI│  CLASSIFICATION    │   SPY              │ VISIBILITY
BILI│                    │                    │
TY  │  AGREEMENT         │   PROPOSAL         │
    │  GENERATION        │   SECTIONS         │
    │                    │                    │
    └────────────────────┼────────────────────┘
                         │
                    LOW AUTONOMY
```

---

## Today Feed Events (New)

Add these event types to the Today Feed pattern:

```
TODAY · {N} events
─────────────────────────────────────────────

14:45 │ 127 keywords imported from CSV
      │ PROSPECTS · IMPORT

13:22 │ Prioritization complete: 8 quick wins found
      │ PROSPECTS · ANALYSIS

12:08 │ Competitor keywords: 45 discovered from rival.com
      │ PROSPECTS · SPY

11:30 │ Quick check: "marathon shoes" — High opportunity
      │ PROSPECTS · VALIDATION

10:15 │ Proposal generated for Acme Corp (3 scenarios)
      │ PROSPECTS · PROPOSAL

09:42 │ AI discovered 6 CSS selectors for ecommerce.com
      │ PROSPECTS · SCRAPE
```

---

## Up Next Recommendations (New)

Add these recommendation types:

```
UP NEXT (system-curated)
─────────────────────────────────────────────

⚡ Prioritize 45 newly imported keywords
   Prospect: Acme Corp · CSV imported 2h ago
   [Run Prioritization]

📊 Send proposal to TechStart
   3 scenarios ready · High awareness
   [Preview] [Send]

🔍 Configure scrape rules for shop.example.com
   E-commerce detected · Product pages found
   [Auto-Discover] [Manual Setup]

🎯 Review 8 quick wins for GlobalCo
   Striking distance: 5 · Low hanging: 3
   [View All] [Add to Proposal]
```

---

## Component Inventory Updates

### New Components Required

| Component | v6 Design Reference | Priority | Journey |
|-----------|---------------------|----------|---------|
| QuickCheckPanel | Cards §4 + KPI §7.2 | P0 | 3.19 |
| CompetitorSpyResults | Tables §8 | P0 | 3.20 |
| CSVImportWizard | Multi-step §16.3 | P0 | 3.21 |
| ColumnMapper | Forms + Tables | P0 | 3.21 |
| EntrySelector | Cards §4 | P1 | 3.22 |
| TierFilterStrip | Buttons §5 | P0 | 3.24 |
| QuickWinBadge | Badge §6 | P0 | 3.25 |
| ScoreWeightEditor | Sliders/Forms | P1 | 3.26 |
| ScrapeRuleBuilder | Forms + Preview | P1 | 3.28 |
| SelectorDiscoveryPanel | Cards + Code | P1 | 3.29 |
| RuleTestPreview | Cards + Results | P2 | 3.30 |
| ProposalSectionCard | Cards §4 + Editable | P0 | 3.31 |
| AwarenessLevelIndicator | Progress/Badge | P1 | 3.32 |
| AgreementPreview | Document viewer | P1 | 3.33 |

### v6 Token Requirements

All new components MUST use:

```css
/* Shadows - ghost-edge for cards */
--shadow-ghost-edge: 0 0 0 1px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.04);
--shadow-hover-lift: 0 4px 12px rgba(0,0,0,0.08);

/* Colors - ONE accent only */
--accent-600: /* brand accent */
--text-primary: /* main text */
--text-muted: /* secondary text */
--surface-card: /* card background */

/* Typography */
--font-display: 'Newsreader', serif;  /* for editorial moments */
--font-body: 'Geist', system-ui;       /* for everything else */

/* Spacing - 12px floor */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;

/* Motion - NO pulse */
--ease-micro: cubic-bezier(0.4, 0, 0.2, 1) 100ms;
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1) 200ms;
```

---

## Integration Points

### Finding → Proposal (Cross-Domain)

When audit findings exist for prospect's domain:

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  PROSPECT       │ ──────► │  AUDIT          │ ──────► │  PROPOSAL       │
│  DOMAIN         │  scan   │  PREVIEW        │ include │  SECTION        │
│                 │         │                 │         │                 │
│  acmecorp.com   │         │  "14 issues"    │ as      │  "Current Site  │
│                 │         │  [View Details] │ evidence│   Analysis"     │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### Quick Win → Proposal Section

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  QUICK WINS     │ ──────► │  SELECT FOR     │ ──────► │  PROPOSAL       │
│  (8 found)      │  pick   │  PROPOSAL       │ generate│  "Opportunities"│
│                 │         │                 │  section│                 │
│  [Striking: 5]  │         │  ☑ marathon...  │         │  • Position #11 │
│  [Low hang: 3]  │         │  ☑ running...   │         │  • Easy win...  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### Conversion → Keyword Import

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  PROSPECT       │ ──────► │  CONVERT        │ ──────► │  CLIENT         │
│  KEYWORDS       │ convert │  MODAL          │ auto    │  INTELLIGENCE   │
│                 │         │                 │ import  │                 │
│  127 keywords   │         │  ☑ Import kws   │         │  127 keywords   │
│  8 quick wins   │         │  ☑ Keep scores  │         │  ready to track │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

---

## Phase Assignment

| Journey | Assigned Phase | Reason |
|---------|----------------|--------|
| 3.19-3.22 | Phase 50 | Keyword entry routes |
| 3.23-3.27 | Phase 50 | Prioritization UI |
| 3.28-3.30 | Phase 51 | Scrape config routes |
| 3.31-3.33 | Phase 46-47 | Proposal flows (with v6) |

---

## Action Items

1. **Merge into v7-master-design-architecture.md**: Add Pattern F
2. **Update v6-comprehensive-journeys.md**: Add journeys 3.19-3.33
3. **Add to Phase 44 component library**: 14 new components
4. **Update Phase 46-47 plans**: Include AI proposal journeys
5. **Add to Phase 50-51**: Keyword and scrape config pages

---

*This addendum becomes authoritative once merged. Phase 43 UI files MUST be updated in Phases 49-51 to match these journey specifications.*
