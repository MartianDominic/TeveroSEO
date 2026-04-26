# Phase 43: GSD Plan Revision — Agency Power User Flows

> **Status:** Deep Analysis  
> **Generated:** 2026-04-26  
> **Analysis Method:** Ultrathink on existing code + agency workflows

---

## Executive Summary

After analyzing the codebase, I identified **critical gaps** between the current implementation and world-class agency workflows. The existing system has solid foundations but lacks the **progressive disclosure** and **power user controls** that agencies need.

### Current State

| Component | Status | Quality |
|-----------|--------|---------|
| Prospect schema | EXISTS | Good - has pipeline stages |
| DataForSEO integration | EXISTS | Good - all endpoints wired |
| Proposal schema | EXISTS | Good - has Dokobit/Stripe |
| Prospect analysis | EXISTS | Basic - single flow only |
| Keyword source tracking | MISSING | — |
| Multi-entry-point UI | MISSING | — |
| Power user controls | MISSING | — |
| Scraping customization | MISSING | — |
| Proposal generation AI | MISSING | — |

### The Fundamental Problem

**Current flow**: Prospect → One-size-fits-all analysis → Generic proposal

**Agency reality**: Wildly different scenarios require different depths:

| Scenario | Current Support | What Agencies Need |
|----------|-----------------|-------------------|
| "Check these 3 keywords" | ❌ No | Quick check, no workspace |
| "I have an Ahrefs CSV" | ❌ No | Import with metric detection |
| "Full research this prospect" | ✅ Partial | Full discovery with AI |
| "What am I missing vs X?" | ❌ No | Gap-focused analysis |
| "What does competitor rank for?" | ❌ No | Spy mode, no prospect needed |

---

## GSD Plan Structure Revision

### OLD Structure (from 43-CONTEXT.md)

```
43-01: Multi-source keyword input + schema (6h)
43-02: CSV Export + Basic Prioritization (5h)
43-03: Prioritization UI (8h)
43-04: Page Mapping (12h)
43-05: Proposal Scenarios + Generation (9h)
```

### NEW Structure (Agency Power User Focused)

```
43-01: Entry Point Architecture + Keyword Schema (8h)
       - 5 entry points with progressive disclosure
       - ProspectKeyword schema with source tracking
       - Smart enrichment router
       
43-02: Quick Check + Competitor Spy Modes (6h)
       - No-workspace quick flows
       - Minimal UI, maximum speed
       
43-03: CSV Import + Metric Detection (5h)
       - Smart column mapping
       - Skip enrichment if metrics present
       - Merge with existing keywords
       
43-04: Prioritization Engine + UI (10h)
       - Multi-factor scoring algorithm
       - Quick win detection
       - Tier badges and filtering
       - Power user score weight customization
       
43-05: Scraping Customization + AI Extraction (8h)
       - Custom CSS selectors per client
       - AI-assisted selector discovery
       - Category/product extraction rules
       
43-06: Proposal Generation + Copywriting AI (10h)
       - Awareness classification
       - Pre-sale hook generation
       - Full proposal with XML prompts
       - Agreement generation
```

**Total: 47h** (was 40h — added power user features)

---

## User Journey Deep Dive

### Journey 1: Quick Check (No Workspace)

**User**: "Client just asked if they can rank for 'plaukų dažai'"

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚡ QUICK KEYWORD CHECK                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Enter up to 20 keywords (one per line):                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ plaukų dažai                                                 │  │
│  │ profesionalūs plaukų dažai                                   │  │
│  │ loreal plaukų dažai                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────┐  ┌────────────────────────────────────────┐   │
│  │ Target Region   │  │ 🇱🇹 Lithuania                    ▼    │   │
│  └─────────────────┘  └────────────────────────────────────────┘   │
│                                                                     │
│  [ Check Keywords ] ~$0.005                                         │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  RESULTS                                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Keyword              │ Volume │ KD  │ CPC   │ Competition   │  │
│  ├──────────────────────┼────────┼─────┼───────┼───────────────┤  │
│  │ plaukų dažai         │ 2,400  │ 34  │ €0.45 │ 🟡 Medium     │  │
│  │ profesionalūs plau...│ 390    │ 28  │ €0.52 │ 🟢 Low        │  │
│  │ loreal plaukų dažai  │ 1,200  │ 42  │ €0.38 │ 🟡 Medium     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Combined: 3,990/mo search volume                                   │
│                                                                     │
│  [ Export CSV ] [ Create Prospect from This ] [ Share Link ]        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Power User Controls**:
- Toggle "Include related keywords" (adds DataForSEO suggestions)
- Toggle "Include competitor check" (shows who ranks)
- Region/language selector with memory

**Technical Flow**:
```
User → keywords[] → DataForSEO batch enrich → Results
                    (no DB write until "Create Prospect")
```

---

### Journey 2: CSV Import with Smart Detection

**User**: "Client sent their Ahrefs export with 500 keywords"

```
┌─────────────────────────────────────────────────────────────────────┐
│  📄 IMPORT KEYWORDS                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🗂 Drop CSV here or click to upload                          │  │
│  │                                                               │  │
│  │   Supports: Ahrefs, SEMrush, Moz, Generic CSV                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  📊 DETECTED FORMAT: Ahrefs Keyword Export                          │
│                                                                     │
│  Column Mapping (auto-detected, editable):                         │
│  ┌────────────────────┬──────────────────────┬─────────────────┐   │
│  │ Your Column        │ Maps To              │ Sample          │   │
│  ├────────────────────┼──────────────────────┼─────────────────┤   │
│  │ Keyword            │ keyword ✓            │ plaukų dažai    │   │
│  │ Volume             │ search_volume ✓      │ 2,400           │   │
│  │ KD                 │ keyword_difficulty ✓ │ 34              │   │
│  │ CPC                │ cpc ✓                │ 0.45            │   │
│  │ Position           │ current_position ✓   │ 15              │   │
│  │ Traffic            │ (ignore) ▼           │ 234             │   │
│  └────────────────────┴──────────────────────┴─────────────────┘   │
│                                                                     │
│  ✅ Metrics detected — NO API enrichment needed (saves ~$0.50)      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🔧 POWER USER OPTIONS                                ▼      │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ☐ Force re-enrich (overwrite CSV metrics with fresh data)  │   │
│  │ ☑ Merge with existing keywords (dedupe by normalized form) │   │
│  │ ☐ Import as "competitor gap" source                        │   │
│  │ ☑ Auto-classify intent (product/info/brand)                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [ Cancel ] [ Import 500 Keywords ] Cost: $0.00 (cached)            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Smart Detection Logic**:
```typescript
interface CsvColumnDetection {
  detectedFormat: 'ahrefs' | 'semrush' | 'moz' | 'generic' | 'keywords_only';
  hasMetrics: {
    volume: boolean;
    difficulty: boolean;
    cpc: boolean;
    position: boolean;
  };
  mappings: Map<string, ColumnMapping>;
  enrichmentNeeded: boolean;
  estimatedCost: number;
}

const COLUMN_PATTERNS = {
  keyword: ['keyword', 'keywords', 'search term', 'query', 'raktažodis'],
  volume: ['volume', 'search volume', 'sv', 'searches', 'paieškos'],
  difficulty: ['kd', 'keyword difficulty', 'difficulty', 'seo difficulty'],
  cpc: ['cpc', 'cost per click', 'ppc'],
  position: ['position', 'rank', 'ranking', 'current position', 'pozicija'],
};
```

---

### Journey 3: Full Discovery with AI

**User**: "New prospect plaukucentras.lt — full research"

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔍 FULL KEYWORD DISCOVERY                                          │
│  Prospect: plaukucentras.lt                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DISCOVERY STEPS                                                    │
│                                                                     │
│  ✅ Step 1: Domain Analysis                                         │
│     DA: 32 | Traffic: 4,200/mo | Indexed: 1,240 pages              │
│                                                                     │
│  ✅ Step 2: Existing Rankings (127 keywords)                        │
│     → 23 in striking distance (pos 11-30)                          │
│     → 8 quick wins identified                                       │
│                                                                     │
│  ✅ Step 3: Competitor Discovery                                    │
│     Found: grožiosalonas.lt, hairshop.lt, plaukuparduotuve.lt      │
│                                                                     │
│  ✅ Step 4: Gap Analysis (vs top 3 competitors)                     │
│     → 342 keywords they have, you don't                            │
│     → 156 achievable (based on DA)                                 │
│                                                                     │
│  🔄 Step 5: AI Opportunity Discovery                                │
│     Analyzing business context...                                   │
│     ████████░░░░░░░░░░░░ 40%                                       │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  🔧 CUSTOMIZE DISCOVERY                                      [▼]   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │ Business Focus (AI will prioritize):                        │   │
│  │ ┌─────────────────────────────────────────────────────────┐ │   │
│  │ │ Focus on professional hair products, especially L'Oreal │ │   │
│  │ │ Ignore home-use and budget brands                       │ │   │
│  │ └─────────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  │ Competitor Override:                                        │   │
│  │ [ grožiosalonas.lt ] [ hairshop.lt ] [ + Add ]             │   │
│  │                                                             │   │
│  │ Include:                                                    │   │
│  │ ☑ Product keywords        ☑ Brand keywords                 │   │
│  │ ☑ Commercial intent       ☐ Informational (blog)           │   │
│  │ ☐ Long-tail (vol < 50)    ☑ Seasonal trends                │   │
│  │                                                             │   │
│  │ Volume threshold: [ 50 ▼ ] minimum searches/month          │   │
│  │ Difficulty cap: [ 70 ▼ ] maximum KD to consider            │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Estimated cost: ~$0.04 | Time: ~2 minutes                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Power User AI Input Box**:
This is the key differentiator — natural language business context that the AI uses for:
1. **Keyword relevance scoring** — "Focus on professional" → boost salon-grade products
2. **Category filtering** — "Ignore home-use" → suppress DIY/home keywords
3. **Brand prioritization** — "especially L'Oreal" → L'Oreal keywords get 1.5x weight

```typescript
interface BusinessFocusDirective {
  raw_input: string;
  parsed: {
    categories_to_promote: string[];
    categories_to_suppress: string[];
    brands_to_promote: string[];
    brands_to_suppress: string[];
    intent_focus: ('product' | 'commercial' | 'informational')[];
    volume_min: number;
    difficulty_max: number;
  };
  confidence: number;
}
```

---

### Journey 4: Scraping Customization (Power User)

**Problem**: Default scraping extracts generic content. Agencies need control over what gets extracted.

```
┌─────────────────────────────────────────────────────────────────────┐
│  🕷 SCRAPING CONFIGURATION                                          │
│  Prospect: plaukucentras.lt                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DETECTED SITE TYPE: E-commerce (Shopify)                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🤖 AI SELECTOR DISCOVERY                              [Run] │   │
│  │                                                             │   │
│  │ "Find selectors for product names, prices, categories,     │   │
│  │  and brand names on this site"                              │   │
│  │                                                             │   │
│  │ Results:                                                    │   │
│  │ ✅ Product name: h1.product-title (confidence: 98%)         │   │
│  │ ✅ Price: span.price (confidence: 95%)                      │   │
│  │ ✅ Category: nav.breadcrumb > a (confidence: 92%)           │   │
│  │ ⚠️ Brand: .product-vendor (confidence: 67%)                 │   │
│  │                                                             │   │
│  │ [ Accept All ] [ Edit Selectors ]                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  CUSTOM EXTRACTION RULES                                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Rule 1: Product Pages                                       │   │
│  │ URL Pattern: /products/*                                    │   │
│  │ Extract:                                                    │   │
│  │   • Title:    h1.product-title                              │   │
│  │   • Price:    span.price | .product-price                   │   │
│  │   • Brand:    .product-vendor | meta[property="brand"]      │   │
│  │   • Category: nav.breadcrumb > a:nth-child(2)               │   │
│  │   • SKU:      [data-sku] | .sku-value                       │   │
│  │ [ Test on URL ] [ Delete Rule ]                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Rule 2: Category Pages                                      │   │
│  │ URL Pattern: /collections/*                                 │   │
│  │ Extract:                                                    │   │
│  │   • Category Name: h1                                       │   │
│  │   • Product Count: .collection-count | [data-count]         │   │
│  │   • Subcategories: .collection-nav a                        │   │
│  │ [ Test on URL ] [ Delete Rule ]                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [ + Add Custom Rule ]                                              │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  CRAWL SETTINGS                                                     │
│                                                                     │
│  Max pages: [ 500 ▼ ]    Depth: [ 3 ▼ ]    Rate: [ 2/sec ▼ ]       │
│                                                                     │
│  Include patterns:                                                  │
│  [ /products/* ] [ /collections/* ] [ + Add ]                       │
│                                                                     │
│  Exclude patterns:                                                  │
│  [ /cart ] [ /account/* ] [ /checkout ] [ + Add ]                   │
│                                                                     │
│  [ Save Configuration ] [ Run Test Crawl (10 pages) ]               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**AI Selector Discovery Prompt**:
```xml
<prompt name="selector-discovery">
  <task>
    Analyze the HTML structure of this e-commerce page and identify 
    CSS selectors for extracting:
    1. Product name
    2. Product price (current, not original)
    3. Product category/breadcrumb
    4. Brand name
    5. SKU/product code
  </task>
  
  <html>{{PAGE_HTML}}</html>
  
  <output>
    For each field, provide:
    - Primary selector (most reliable)
    - Fallback selector (alternative)
    - Confidence score (0-100)
    - Sample value extracted
  </output>
</prompt>
```

---

### Journey 5: Proposal Builder with AI Copywriting

**User**: "Generate komercinis for plaukucentras.lt"

```
┌─────────────────────────────────────────────────────────────────────┐
│  📝 PROPOSAL BUILDER                                                │
│  Prospect: plaukucentras.lt                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STEP 1: SCENARIO SELECTION                                         │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ ⚡ FOCUSED      │  │ 📊 FULL AUDIT   │  │ 🔍 COMPETITOR   │     │
│  │                 │  │                 │  │                 │     │
│  │ 3-10 keywords   │  │ 100+ keywords   │  │ Gap analysis    │     │
│  │ All with mapping│  │ Top 20 mapped   │  │ No page mapping │     │
│  │ €150 + €25/kw   │  │ €800 flat       │  │ €250 + €75/comp │     │
│  │                 │  │                 │  │                 │     │
│  │ [Select]        │  │ [Selected ✓]    │  │ [Select]        │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  STEP 2: CONTENT CUSTOMIZATION                                      │
│                                                                     │
│  Prospect Awareness Level: [ Solution-Aware ▼ ]                     │
│  (They know SEO exists, comparing options)                          │
│                                                                     │
│  Tone: [ Professional ▼ ]   Language: [ Lithuanian ▼ ]              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🤖 AI COPY SETTINGS                                         │   │
│  │                                                             │   │
│  │ Company positioning (how to describe us):                   │   │
│  │ ┌─────────────────────────────────────────────────────────┐ │   │
│  │ │ SEO agentūra, specializuojanti e-komercijos              │ │   │
│  │ │ optimizavime. 5+ metų patirtis grožio sektoriuje.        │ │   │
│  │ └─────────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  │ Key differentiators to emphasize:                           │   │
│  │ ☑ Technical SEO expertise                                   │   │
│  │ ☑ Industry-specific experience                              │   │
│  │ ☐ Fastest results                                           │   │
│  │ ☑ Transparent reporting                                     │   │
│  │                                                             │   │
│  │ Social proof to include:                                    │   │
│  │ [ grožiosalonas.lt +120% traffic ] [ + Add Case Study ]     │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  STEP 3: PRICING                                                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Setup fee:    € [ 500    ]                                  │   │
│  │ Monthly fee:  € [ 800    ] × [ 6 ▼ ] months                 │   │
│  │ ─────────────────────────────────────                       │   │
│  │ Total:        € 5,300                                       │   │
│  │                                                             │   │
│  │ ☑ Show ROI comparison (recommended)                         │   │
│  │ ☑ Include payment options (upfront discount)                │   │
│  │ ☑ Add performance guarantee clause                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  STEP 4: SECTIONS                                                   │
│                                                                     │
│  Drag to reorder, toggle to include:                               │
│                                                                     │
│  ☑ ≡ Executive Summary        [AI: Generate] [Edit]                │
│  ☑ ≡ Current State Analysis   [AI: Generate] [Edit]                │
│  ☑ ≡ Keyword Opportunities    [Auto from analysis]                 │
│  ☑ ≡ Competitor Comparison    [AI: Generate] [Edit]                │
│  ☑ ≡ Page Mapping (Top 20)    [Auto from mapping]                  │
│  ☑ ≡ ROI Projections          [Calculator] [Edit]                  │
│  ☑ ≡ Investment & Guarantee   [From pricing above]                 │
│  ☐ ≡ Appendix (Full KW List)  [Toggle on for PDF]                  │
│                                                                     │
│  [ Preview ] [ Generate Draft ] [ Save as Template ]                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**AI Generation Flow**:
```
1. User selects scenario + settings
2. System loads prospect analysis data
3. AI classifies awareness level (if not set)
4. For each section:
   - Load appropriate XML prompt
   - Inject prospect data + settings
   - Generate copy
   - User can edit or regenerate
5. Assemble into proposal document
6. Generate PDF or web link
```

---

## Existing Infrastructure (Key Discovery)

**Critical finding:** The onboarding system already imports keywords during conversion!

```typescript
// onboarding.ts:311-339
async function importKeywordsFromAnalysis(tx, projectId, keywords: OpportunityKeyword[]) {
  // Already copies opportunityKeywords → savedKeywords
}
```

**Existing keyword tables (for clients):**
- `savedKeywords` — Keywords to track (with locationCode, languageCode)
- `keywordMetrics` — Cached metrics (volume, CPC, difficulty, intent)
- `keywordPageMapping` — Keyword → URL mapping with action (optimize/create)

**Current conversion flow:**
```
triggerOnboarding() 
├── createClientFromProposalWithTx() → client record
├── createProjectFromAnalysisWithTx() 
│   └── importKeywordsFromAnalysis() → opportunityKeywords only
└── Updates statuses
```

**What needs extension (not new tables):**

| Gap | Current State | Required Change |
|-----|---------------|-----------------|
| Organic keywords | Not imported | Extend `importKeywordsFromAnalysis()` |
| Keyword gaps | Not imported | Import achievable gaps (score > 70) |
| Metrics | Lost on conversion | Populate `keywordMetrics` during import |
| Page mappings | Not created | Create `keywordPageMapping` rows |
| Source tracking | No tracking | Add `source` column to `savedKeywords` |

## Schema Changes Required

### Extend: savedKeywords Table

Add source tracking to existing table (migration):

```typescript
// Migration: add source tracking to savedKeywords
await db.execute(sql`
  ALTER TABLE saved_keywords 
  ADD COLUMN source text DEFAULT 'manual',
  ADD COLUMN source_metadata jsonb,
  ADD COLUMN tier text,
  ADD COLUMN quick_win_type text,
  ADD COLUMN composite_score real,
  ADD COLUMN imported_from_prospect_id text REFERENCES prospects(id)
`);
```

This allows:
1. Keywords to track their origin (prospect research, CSV import, manual)
2. Tier classification persists from prospect phase
3. Link back to original prospect for auditing

### Extend: keywordPageMapping Table

Add prospect-phase fields:

```typescript
// Migration: add prospect-phase fields
await db.execute(sql`
  ALTER TABLE keyword_page_mapping
  ADD COLUMN mapping_confidence real,
  ADD COLUMN cannibalization_risk boolean DEFAULT false,
  ADD COLUMN imported_from_prospect_id text
`);
```

---

## Keyword Transfer Flows (Prospect → Client)

### Flow 1: Automatic on Conversion (Extended)

```
Prospect signs proposal → triggerOnboarding()
├── Creates client + project
├── importKeywordsFromAnalysis() [EXTENDED]
│   ├── opportunityKeywords → savedKeywords ✅ (existing)
│   ├── organicKeywords → savedKeywords ✅ (NEW)
│   ├── keywordGaps (achievable) → savedKeywords ✅ (NEW)
│   ├── All metrics → keywordMetrics ✅ (NEW)
│   └── Page mappings → keywordPageMapping ✅ (NEW)
└── Keywords ready in client project immediately
```

### Flow 2: CSV Export → Import

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROSPECT KEYWORDS                      CLIENT KEYWORDS             │
│                                                                     │
│  [Export CSV]                           [Import CSV]                │
│       │                                      │                      │
│       ▼                                      ▼                      │
│  keywords_plaukucentras_2026-04-26.csv      │                      │
│  ┌────────────────────────────────────┐     │                      │
│  │ keyword,volume,kd,tier,mapped_url, │     │                      │
│  │ action,confidence,source           │     │                      │
│  │ "plaukų dažai",2400,34,must_do,... │     │                      │
│  └────────────────────────────────────┘     │                      │
│       │                                      │                      │
│       └──────────────────────────────────────┘                      │
│                                                                     │
│  Same CSV format works in BOTH directions:                          │
│  • Export from prospect → Import to client (conversion)             │
│  • Export from client → Share with team                             │
│  • Import from Ahrefs/SEMrush → Either prospect or client           │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Manual Promote (No Full Conversion)

For cases where agency wants to track keywords before contract:

```
Prospect keywords UI → [Promote to Tracking]
├── Creates shadow project (if not exists)
├── Copies selected keywords to savedKeywords
├── Enables rank tracking immediately
└── Prospect status unchanged (still prospect)
```

### CSV Format (Universal)

Works for both prospect export AND client import:

```csv
keyword,search_volume,keyword_difficulty,cpc,current_position,tier,quick_win_type,mapped_url,mapping_action,mapping_confidence,source
"plaukų dažai",2400,34,0.45,15,must_do,striking_distance,/plauku-dazai,optimize,0.92,dataforseo
"profesionalūs plaukų dažai",390,28,0.52,,should_do,,/profesionalus,create,,csv_upload
```

**Lithuanian headers option:**
```csv
raktažodis,paieškos,sunkumas,kaina_už_paspaudimą,pozicija,prioritetas,greitas_laimėjimas,puslapis,veiksmas,tikimybė,šaltinis
```

### New: prospect_scrape_configs Table

```typescript
export const prospectScrapeConfigs = pgTable(
  "prospect_scrape_configs",
  {
    id: text("id").primaryKey(),
    prospectId: text("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    
    // Site detection
    detectedPlatform: text("detected_platform"), // 'shopify' | 'woocommerce' | 'magento' | 'custom'
    detectedSiteType: text("detected_site_type"), // 'ecommerce' | 'service' | 'blog' | 'corporate'
    
    // Extraction rules
    extractionRules: jsonb("extraction_rules").$type<ExtractionRule[]>(),
    
    // Crawl settings
    maxPages: integer("max_pages").default(500),
    maxDepth: integer("max_depth").default(3),
    rateLimit: integer("rate_limit").default(2), // requests per second
    includePatterns: text("include_patterns").array(),
    excludePatterns: text("exclude_patterns").array(),
    
    // AI-discovered selectors
    aiSelectors: jsonb("ai_selectors").$type<AiSelector[]>(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("ix_prospect_scrape_configs_prospect").on(table.prospectId),
  ],
);

interface ExtractionRule {
  name: string;
  urlPattern: string; // glob or regex
  fields: {
    name: string;
    selectors: string[]; // primary + fallbacks
    type: 'text' | 'attribute' | 'html';
    attribute?: string; // for attribute type
  }[];
}

interface AiSelector {
  field: string;
  selector: string;
  fallback: string | null;
  confidence: number;
  sampleValue: string;
  discoveredAt: string;
}
```

---

## API Endpoints Required

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/keywords/quick-check` | No-auth quick keyword check |
| POST | `/api/prospects/:id/keywords/import` | CSV import with detection |
| GET | `/api/prospects/:id/keywords` | List with filtering/sorting |
| PATCH | `/api/prospects/:id/keywords/:kwId` | Update single keyword |
| POST | `/api/prospects/:id/keywords/bulk-update` | Batch tier/mapping updates |
| POST | `/api/prospects/:id/keywords/enrich` | Trigger enrichment batch |
| GET | `/api/prospects/:id/keywords/export` | CSV export |
| GET | `/api/prospects/:id/scrape-config` | Get scrape configuration |
| PUT | `/api/prospects/:id/scrape-config` | Update scrape configuration |
| POST | `/api/prospects/:id/scrape-config/discover` | AI selector discovery |
| POST | `/api/prospects/:id/scrape-config/test` | Test extraction rules |
| POST | `/api/proposals/:id/generate-section` | AI generate single section |
| POST | `/api/proposals/:id/generate-all` | AI generate full proposal |

---

## Revised Sub-Plan Details

### 43-01: Entry Point Architecture + Schema Extensions (8h)

**Files to create/modify:**
```
open-seo-main/src/db/migrations/0XXX_keyword_source_tracking.ts  -- Extend savedKeywords
open-seo-main/src/server/features/keywords/services/KeywordInputService.ts
open-seo-main/src/server/features/keywords/services/KeywordEnrichmentService.ts
open-seo-main/src/server/features/keywords/services/KeywordDeduplicator.ts
open-seo-main/src/server/features/proposals/onboarding/keyword-transfer.ts  -- Extended import
apps/web/src/app/(shell)/prospects/keywords/entry-selector/page.tsx
apps/web/src/app/(shell)/prospects/keywords/quick-check/page.tsx
```

**Tasks:**
1. Migration: Add source tracking columns to `savedKeywords` table
2. Migration: Add mapping confidence to `keywordPageMapping` table
3. Extend `importKeywordsFromAnalysis()` to include:
   - `organicKeywords` (current rankings)
   - `keywordGaps` (achievable ones with score > 70)
   - Metrics transfer to `keywordMetrics` table
4. Build KeywordInputService with 5 entry point handlers
5. Implement deduplication by normalized keyword
6. Build entry point selector UI component
7. Implement quick-check flow (no workspace)

### 43-02: Quick Check + Competitor Spy Modes (6h)

**Files to create:**
```
apps/web/src/app/(shell)/prospects/keywords/competitor-spy/page.tsx
open-seo-main/src/server/features/keywords/services/CompetitorSpyService.ts
open-seo-main/src/routes/api/keywords/quick-check.ts
```

**Tasks:**
1. Build competitor spy UI (enter competitor domain → see their keywords)
2. Implement no-workspace quick check API
3. Add share-link generation for quick results
4. Build "promote to prospect" flow

### 43-03: CSV Import + Metric Detection (5h)

**Files to create:**
```
open-seo-main/src/server/features/keywords/services/CsvImportService.ts
open-seo-main/src/server/features/keywords/services/ColumnDetector.ts
apps/web/src/app/(shell)/prospects/[id]/keywords/import/page.tsx
```

**Tasks:**
1. Build smart column detection (Ahrefs/SEMrush/Moz patterns)
2. Implement metric presence detection → skip enrichment
3. Build column mapping UI with override capability
4. Implement merge/dedupe with existing keywords

### 43-04: Prioritization Engine + UI (10h)

**Files to create:**
```
open-seo-main/src/server/features/keywords/services/PrioritizationService.ts
open-seo-main/src/server/features/keywords/services/QuickWinDetector.ts
apps/web/src/app/(shell)/prospects/[id]/keywords/page.tsx
apps/web/src/app/(shell)/prospects/[id]/keywords/components/KeywordTable.tsx
apps/web/src/app/(shell)/prospects/[id]/keywords/components/TierFilter.tsx
apps/web/src/app/(shell)/prospects/[id]/keywords/components/ScoreWeightEditor.tsx
```

**Tasks:**
1. Implement multi-factor scoring algorithm
2. Build quick win detection (striking distance, low hanging, fresh)
3. Create tier assignment logic with thresholds
4. Build keyword table with sorting/filtering
5. Implement power user score weight customization UI
6. Add bulk tier override capability

### 43-05: Scraping Customization + AI Extraction (8h)

**Files to create:**
```
open-seo-main/src/db/prospect-scrape-config-schema.ts
open-seo-main/src/server/features/scraping/services/SelectorDiscoveryService.ts
open-seo-main/src/server/features/scraping/services/CustomExtractor.ts
open-seo-main/src/server/features/scraping/prompts/selector-discovery.xml
apps/web/src/app/(shell)/prospects/[id]/scrape-config/page.tsx
```

**Tasks:**
1. Create scrape config schema
2. Build AI selector discovery with Claude
3. Implement custom extraction rule engine
4. Build rule testing UI (test on single URL)
5. Create platform detection (Shopify/WooCommerce/etc)

### 43-06: Proposal Generation + Copywriting AI (10h)

**Files to create:**
```
open-seo-main/src/server/features/proposals/services/ProposalGeneratorService.ts
open-seo-main/src/server/features/proposals/services/AwarenessClassifier.ts
open-seo-main/src/server/features/proposals/services/SectionGenerator.ts
open-seo-main/src/server/features/proposals/prompts/ (7 XML files)
apps/web/src/app/(shell)/prospects/[id]/proposal/builder/page.tsx
apps/web/src/app/(shell)/prospects/[id]/proposal/preview/page.tsx
```

**Tasks:**
1. Implement awareness level classification
2. Build section-by-section AI generation
3. Wire XML prompts (awareness, hook, exec summary, investment, etc)
4. Create proposal builder UI with drag-reorder
5. Implement proposal preview with live editing
6. Add "save as template" functionality

---

## Success Criteria (Updated)

- [ ] All 5 keyword input modes functional with source tracking
- [ ] Quick check works without creating workspace
- [ ] CSV import detects Ahrefs/SEMrush/Moz formats automatically
- [ ] Enrichment batching reduces API calls by 90%+ vs naive
- [ ] Keywords display with tier badges and source indicators
- [ ] Quick wins highlighted with visual indicators
- [ ] Power users can customize score weights
- [ ] Custom CSS selectors save per-prospect
- [ ] AI selector discovery works on major e-commerce platforms
- [ ] Proposal builder generates with awareness-appropriate copy
- [ ] Three proposal scenarios generate appropriate content
- [ ] Agreement includes all required Lithuanian legal sections
- [ ] Full flow works: entry point → keywords → mapping → komercinis
- [ ] Cost per prospect < $0.10 at 95% cache hit rate
