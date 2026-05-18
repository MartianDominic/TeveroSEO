# Research 13: 109 SEO Checks System

**Phase:** 99 - Unified SEO Content Pipeline  
**Created:** 2026-05-11  
**Status:** Complete  
**Source Files:** `.planning/phases/92-on-page-seo-mastery/`, `open-seo-main/src/server/lib/audit/checks/`

---

## Executive Summary

TeveroSEO implements a comprehensive 109-check SEO audit system organized into a 5-tier architecture. The system scores pages on a 0-100 scale using weighted tier contributions with hard gates for critical failures. Phase 92 extended the original 4-tier system (109 checks) with Tier 5 Content Quality Intelligence (13 additional checks).

**Key Metrics:**
- **Total Checks:** 122 (109 base + 13 Tier 5 quality)
- **Tiers:** 5 (DOM/regex, calculation, API-based, crawl-based, content quality)
- **Severity Levels:** 5 (critical, high, medium, low, info)
- **Score Range:** 0-100 with quality gate threshold at 80

---

## 1. Four-Tier Architecture (Original 109 Checks)

### Tier Distribution

| Tier | Name | Check Count | Weight | Max Points | Execution |
|------|------|-------------|--------|------------|-----------|
| **Tier 1** | DOM/Regex | 68 | 0.3 pts/pass | 20 | Instant (<100ms) |
| **Tier 2** | Calculation | 21 | 0.5 pts/pass | 10 | Light compute (<500ms) |
| **Tier 3** | API-Based | 13 | 0.8 pts/pass | 6 | Variable (external APIs) |
| **Tier 4** | Crawl-Based | 7 | 0.4 pts/pass | 4 | Requires site context |
| **Total** | | **109** | | **40 variable** | |

### Scoring Formula

```
Final Score = Base (60) + Tier1 + Tier2 + Tier3 + Tier4
            = 60 + min(20, T1_passed * 0.3)
                 + min(10, T2_passed * 0.5)
                 + min(6, T3_passed * 0.8)
                 + min(4, T4_passed * 0.4)
Max = 100
```

---

## 2. Tier 5: Content Quality Intelligence (Phase 92)

Phase 92 added a new opt-in Tier 5 for advanced content quality checks. Unlike Tiers 1-4, Tier 5 checks can be **blocking** (prevent auto-publish regardless of score).

### Tier 5 Checks (13 Total)

| ID | Name | Cost | Method | Blocking |
|----|------|------|--------|----------|
| T5-01 | Reddit Test | $0.002 | LLM (Grok 4.1 Fast) | Yes (<50) |
| T5-02 | Information Gain vs SERP | $0.005 | SERP + LLM | Yes (<40) |
| T5-03 | Prove-It Details | $0.003 | LLM | Yes (<30) |
| T5-04 | Not For You Block | $0 | Regex pattern | No |
| T5-05 | QDD Vulnerability | $0.002 | SERP analysis | No |
| T5-06 | Thin Content Detection | $0 | Word count | Yes (<20) |
| T5-07 | Fluff Detection | $0.001 | Embeddings | No |
| T5-08 | AI Slop Detection | $0.002 | LLM | Yes (<40) |
| T5-09 | Voice Consistency | $0.001 | Embeddings | No |
| T5-10 | Tone Appropriateness | $0.001 | Embeddings | No |
| T5-11 | Audience Alignment | $0.001 | Embeddings | No |
| T5-12 | Sentence Length Distribution | $0 | Calculation | No |
| T5-13 | Paragraph Length Optimization | $0 | Calculation | No |

**Full Suite Cost:** ~$0.018/page (optimized with caching: ~$0.005/page)

### Tier 5 Execution Tiers

```
Tier A (FREE - regex/rule-based):
  T5-04, T5-06, T5-12, T5-13

Tier B (CHEAP - $0.0001-0.001, embeddings):
  T5-07, T5-09, T5-10, T5-11

Tier C (EXPENSIVE - $0.002-0.003, LLM):
  T5-01, T5-03, T5-08

Tier D (VERY EXPENSIVE - $0.005+, SERP + LLM):
  T5-02, T5-05
```

---

## 3. Check Categories

### Tier 1 Categories (68 checks)

| Category | Check IDs | Count | Description |
|----------|-----------|-------|-------------|
| `html-signals` | T1-01 to T1-05 | 5 | Meta robots, viewport, lang, doctype |
| `heading-structure` | T1-06 to T1-13 | 8 | H1 count, hierarchy, keyword placement |
| `title-meta` | T1-14 to T1-20 | 7 | Title length, meta description, OG tags |
| `url-structure` | T1-21 to T1-25 | 5 | URL length, keywords, special chars |
| `content-structure` | T1-26 to T1-32 | 7 | Keyword in first 100 words, TOC, word count |
| `image-basics` | T1-33 to T1-38 | 6 | Alt text, dimensions, lazy loading |
| `internal-links` | T1-39 to T1-47 | 9 | Link count, anchor diversity, orphan pages |
| `external-links` | T1-48 to T1-54 | 7 | Outbound links, nofollow, broken links |
| `schema-basics` | T1-55 to T1-61 | 7 | JSON-LD presence, basic types |
| `technical-basics` | T1-62 to T1-69 | 8 | Canonical, robots, X-Robots-Tag |
| **Phase 92 additions** | T1-70 to T1-85 | 16 | Page type detection, vertical-specific |

### Phase 92 Tier 1 Additions (T1-70 to T1-85)

| ID | Name | Page Types | Severity |
|----|------|------------|----------|
| T1-70 | Page type detected | All | medium |
| T1-71 | Value proposition above fold | All | high |
| T1-72 | Primary CTA above fold | service, local | high |
| T1-73 | H2 spacing optimal | article | low |
| T1-74 | Comparison table present | comparison | high |
| T1-75 | Pros/cons section present | comparison | medium |
| T1-76 | Winner declaration present | comparison | medium |
| T1-77 | Listicle items numbered | listicle | medium |
| T1-78 | NAP information present | local | critical |
| T1-79 | Map embed present | local | medium |
| T1-80 | LocalBusiness schema complete | local | high |
| T1-81 | Author byline present | article | high |
| T1-82 | Published date visible | article | medium |
| T1-83 | Service schema present | service | medium |
| T1-84 | ItemList schema present | listicle | medium |
| T1-85 | Social proof section present | service | medium |

### Tier 2 Categories (21 checks)

| Category | Check IDs | Count | Description |
|----------|-----------|-------|-------------|
| `content-quality` | T2-01 to T2-06 | 6 | Readability (Flesch), keyword density |
| `anchor-analysis` | T2-07 to T2-10 | 4 | Anchor text distribution, over-optimization |
| `schema-completeness` | T2-11 to T2-15 | 5 | Schema validation, required properties |
| `freshness` | T2-16 to T2-18 | 3 | dateModified, content staleness |
| `mobile` | T2-19 to T2-21 | 3 | Viewport, tap targets, font sizes |

### Tier 3 Categories (13 checks)

| Category | Check IDs | Count | Description |
|----------|-----------|-------|-------------|
| `cwv` | T3-01 to T3-03 | 3 | LCP, FID/INP, CLS from CrUX API |
| `entity-nlp` | T3-04 to T3-07 | 4 | Entity extraction, topic coverage |
| `backlinks` | T3-08 to T3-10 | 3 | Backlink count, domain authority |
| `engagement` | T3-11 to T3-13 | 3 | Bounce rate, time on page, CTR |

### Tier 4 Categories (7 checks)

| Category | Check IDs | Count | Description |
|----------|-----------|-------|-------------|
| `architecture` | T4-01 to T4-04 | 4 | Click depth, internal PageRank, orphans |
| `differentiation` | T4-05 to T4-07 | 3 | Duplicate content, cannibalization |

---

## 4. Severity Classification

### Severity Levels

| Level | Impact | Examples |
|-------|--------|----------|
| **critical** | Blocks indexing or major SEO penalty | noindex, CWV poor, NAP missing (local) |
| **high** | Significant ranking impact | Missing H1, orphan pages, no author on YMYL |
| **medium** | Moderate impact, should fix | Title length, meta description, image alt |
| **low** | Minor optimizations | Year in title, brackets for CTR |
| **info** | Informational, no action required | Check passed or skipped |

### Severity Distribution (Approximate)

| Severity | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|----------|--------|--------|--------|--------|--------|
| critical | 3 | 0 | 3 | 1 | 4 |
| high | 18 | 5 | 4 | 3 | 2 |
| medium | 32 | 12 | 4 | 2 | 5 |
| low | 15 | 4 | 2 | 1 | 2 |

---

## 5. Scoring Algorithm

### Implementation Location

`open-seo-main/src/server/lib/audit/checks/scoring.ts`

### Base Score Calculation

```typescript
const TIER_WEIGHTS = { 1: 0.3, 2: 0.5, 3: 0.8, 4: 0.4 };
const TIER_MAXES = { 1: 20, 2: 10, 3: 6, 4: 4 };
const BASE_SCORE = 60;

function calculateOnPageScore(results: CheckResult[]): ScoreResult {
  // Filter out skipped checks
  const activeResults = results.filter(r => !isSkippedCheck(r));
  
  // Count passed checks by tier
  const tier1Passed = activeResults.filter(r => r.checkId.startsWith("T1-") && r.passed).length;
  const tier2Passed = activeResults.filter(r => r.checkId.startsWith("T2-") && r.passed).length;
  const tier3Passed = activeResults.filter(r => r.checkId.startsWith("T3-") && r.passed).length;
  const tier4Passed = activeResults.filter(r => r.checkId.startsWith("T4-") && r.passed).length;
  
  // Calculate tier contributions (capped)
  const tier1Points = Math.min(TIER_MAXES[1], tier1Passed * TIER_WEIGHTS[1]);
  const tier2Points = Math.min(TIER_MAXES[2], tier2Passed * TIER_WEIGHTS[2]);
  const tier3Points = Math.min(TIER_MAXES[3], tier3Passed * TIER_WEIGHTS[3]);
  const tier4Points = Math.min(TIER_MAXES[4], tier4Passed * TIER_WEIGHTS[4]);
  
  let score = BASE_SCORE + tier1Points + tier2Points + tier3Points + tier4Points;
  score = Math.min(100, score);
  
  // Apply hard gates...
  return { score, gates, breakdown };
}
```

### Hard Gates (Score Caps)

Applied in precedence order (highest priority first):

| Priority | Gate | Trigger | Score Cap |
|----------|------|---------|-----------|
| 1 | noindex | T1-67 fail | 0 |
| 2 | duplicate-content | T4-06 fail with >60% duplicate | 50 |
| 3 | ymyl-no-author | T1-68 fail | 60 |
| 4 | cwv-poor | T3-01/02/03 critical fail | 75 |

### Quality Gate Threshold

```typescript
const QUALITY_GATE_THRESHOLD = 80;

function passesQualityGate(score: number): boolean {
  return score >= QUALITY_GATE_THRESHOLD;
}

// Auto-publish eligibility requires:
// 1. Score >= 80
// 2. No active hard gates
autoPublishEligible = passed && gates.length === 0;
```

---

## 6. Check Context & Execution

### CheckContext Interface

```typescript
interface CheckContext {
  $: CheerioAPI;           // Shared Cheerio instance (parsed once)
  html: string;            // Raw HTML
  url: string;             // Page URL
  keyword?: string;        // Target keyword for keyword checks
  pageAnalysis?: PageAnalysis;  // Pre-computed analysis
  siteContext?: SiteContext;    // For Tier 4 checks
  responseHeaders?: Record<string, string>;  // For X-Robots-Tag
  
  // Tier 5 extensions (Phase 92)
  vertical?: Vertical;     // Page vertical classification
  serpContent?: string[];  // SERP competitor content
  clientId?: string;       // For voice consistency
}
```

### Check Definition Interface

```typescript
interface CheckDefinition {
  id: string;              // "T1-01", "T5-01"
  name: string;            // Human-readable name
  tier: CheckTier;         // 1, 2, 3, 4, or 5
  category: CheckCategory; // Grouping category
  severity: CheckSeverity; // critical, high, medium, low, info
  autoEditable: boolean;   // Can be auto-fixed
  editRecipe?: string;     // Fix instructions
  blocking?: boolean;      // Tier 5: blocks publication
  run: (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
}
```

### Execution Flow

```
HTML Input
    |
    v
validateUrl() --- Invalid --> Error
    |
    v
Size check (<5MB) --- Exceeds --> Error
    |
    v
cheerio.load(html) --- Parse ONCE
    |
    v
Build CheckContext (shared $ instance)
    |
    v
For each tier (1-4 default, 5 opt-in):
    |
    +---> getChecksByTier(tier)
    |         |
    |         v
    |     For each check:
    |         |
    |         +---> runCheckWithTimeout(30s)
    |         |         |
    |         |         v
    |         |     CheckResult
    |         |
    |         v
    |     Aggregate results
    |
    v
deduplicateResults()
    |
    v
calculateOnPageScore()
    |
    v
ScoreResult { score, gates, breakdown }
```

---

## 7. Existing Implementation Map

### File Locations

```
open-seo-main/src/server/lib/audit/checks/
├── types.ts              # Type definitions
├── registry.ts           # Check registration
├── runner.ts             # Check execution
├── scoring.ts            # Score calculation
├── index.ts              # Exports
│
├── tier1/                # 68 DOM/regex checks
│   ├── html-signals.ts
│   ├── heading-structure.ts
│   ├── title-meta.ts
│   ├── url-structure.ts
│   ├── content-structure.ts
│   ├── image-basics.ts
│   ├── internal-links.ts
│   ├── external-links.ts
│   ├── schema-basics.ts
│   ├── technical-basics.ts
│   ├── eeat-signals.ts
│   └── T1-70 to T1-85 (Phase 92)
│
├── tier2/                # 21 calculation checks
│   ├── content-quality.ts
│   ├── anchor-analysis.ts
│   ├── schema-completeness.ts
│   ├── freshness.ts
│   └── mobile.ts
│
├── tier3/                # 13 API-based checks
│   ├── cwv.ts
│   ├── CwvCheckAdapter.ts
│   ├── entity-nlp.ts
│   ├── backlinks.ts
│   └── engagement.ts
│
└── tier4/                # 7 crawl-based checks
    ├── architecture.ts
    ├── differentiation.ts
    └── analytics.ts
```

### Phase 92 Services

```
open-seo-main/src/server/features/onpage-mastery/
├── services/
│   ├── VerticalClassifier.ts    # Page vertical classification
│   ├── RuleEngineService.ts     # 41-point scorecard
│   ├── QualityGateService.ts    # Tier 5 quality gates
│   └── PageStructureAnalyzer.ts # Heading/content analysis
│
├── utils/
│   ├── ChunkExtractor.ts        # 500-token chunks
│   ├── EntityExtractor.ts       # Entity extraction
│   ├── ReadabilityScorer.ts     # Flesch scores
│   └── SchemaGenerator.ts       # JSON-LD generation
│
├── rules/
│   ├── universal.ts             # 30 universal rules
│   ├── healthcare.ts            # YMYL vertical
│   ├── legal.ts                 # YMYL vertical
│   ├── financial.ts             # YMYL vertical
│   ├── ecommerce.ts
│   └── saas.ts
│
└── checks/
    ├── tier1/T1-70 to T1-85     # Phase 92 Tier 1 additions
    └── tier5/T5-01 to T5-13     # Content quality intelligence
```

---

## 8. Vertical Classification System

### 12 Primary Verticals

| Vertical | YMYL | Threshold | Key Rules |
|----------|------|-----------|-----------|
| healthcare | Yes | 85% | Medical reviewer, .gov/.edu citations |
| legal | Yes | 85% | Bar verification, jurisdiction disclaimers |
| financial | Yes | 85% | Regulatory disclosures, risk disclaimers |
| ecommerce | No | 70% | Product schema, price freshness |
| saas | No | 70% | Feature tables, security badges |
| real_estate | No | 70% | LocalBusiness schema, property listings |
| home_services | No | 70% | NAP, service areas, licensing |
| hospitality | No | 70% | Booking schema, amenities |
| education | No | 70% | Course schema, credentials |
| professional | No | 70% | Service schema, testimonials |
| manufacturing | No | 70% | Product specs, compliance |
| nonprofit | No | 70% | Charity schema, impact metrics |

### Classification Method

```
1. Schema.org detection (confidence: 0.95)
   └── Parse JSON-LD @type
   
2. URL pattern matching (confidence: 0.90)
   └── /products/, /pricing/, /health/, etc.
   
3. YMYL keyword detection (confidence: 0.70)
   └── Body text analysis
   
4. LLM fallback (Grok 4.1 Fast, ~250 tokens)
   └── Only for uncertain cases
```

---

## 9. Integration Points for Phase 99

### What Phase 99 Inherits

1. **109 Base Checks** - Full Tier 1-4 system ready to use
2. **Scoring Algorithm** - 60 base + 40 variable with hard gates
3. **Quality Gate** - 80 threshold for auto-publish
4. **Check Registry** - Extensible pattern for new checks
5. **Shared Cheerio Context** - Efficient single-parse pattern

### What Phase 99 Should Add

1. **Unified Check Execution** - Run checks during content generation
2. **Real-time Scoring** - Score content as it's written
3. **Tier 5 Integration** - Quality gates for AI-generated content
4. **Voice Compliance** - T5-09 integration with voice profiles
5. **Auto-Fix Loop** - Use editRecipe for automatic corrections

### API Surface for Phase 99

```typescript
// Run all checks
import { runChecks } from "./checks/runner";
const results = await runChecks(html, url, { tiers: [1, 2, 3, 4] });

// Calculate score
import { calculateOnPageScore } from "./checks/scoring";
const { score, gates, breakdown } = calculateOnPageScore(results);

// Check quality gate
import { passesQualityGate } from "./checks/scoring";
const canAutoPublish = passesQualityGate(score) && gates.length === 0;

// Run Tier 5 with context
import { runTier5ChecksWithContext } from "./checks/runner";
const tier5Results = await runTier5ChecksWithContext(html, url, {
  vertical: "healthcare",
  serpContent: [...],
  clientId: "client_123"
});
```

---

## 10. Cost Optimization Summary

### Per-Audit Cost Breakdown

| Component | Without Optimization | With Optimization |
|-----------|---------------------|-------------------|
| Tier 1-4 checks | $0 (local) | $0 (local) |
| Tier 5 quality gates | $0.018 | $0.005 |
| Vertical classification | $0.00005 | $0.000005 (cached) |
| **Total per page** | **$0.018** | **$0.005** |

### Optimization Strategies

1. **Heuristic-first classification** - 90% skip LLM
2. **Content hash caching** - 50% cache hits
3. **Tiered quality gate execution** - Run free checks first
4. **Template-based sampling** - Audit 1 page per template
5. **Delta-based re-auditing** - Skip unchanged pages

---

## Document History

- **v1.0** (2026-05-11): Initial research from Phase 92 documentation and codebase analysis
