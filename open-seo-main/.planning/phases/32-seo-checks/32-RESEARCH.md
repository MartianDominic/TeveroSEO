# Phase 32: 107 SEO Checks Implementation - Research

**Researched:** 2026-04-22
**Domain:** SEO audit checks, HTML parsing, scoring systems
**Confidence:** HIGH

## Summary

Phase 32 implements all 107 SEO checks from `docs/MICRO-OPTIMIZATIONS-80-PERCENT.md`. The existing codebase has solid foundation infrastructure: Cheerio-based HTML parsing in `page-analyzer.ts`, a health score system in `health-score.ts`, and PostgreSQL with Drizzle ORM for persistence.

The 107 checks are organized into 4 tiers: Tier 1 (66 DOM/regex - instant), Tier 2 (21 calculation - light compute), Tier 3 (13 API-based - external calls), Tier 4 (7 crawl-based - site-wide analysis). The scoring system uses a base of 60 points plus weighted tier contributions to reach 100.

**Primary recommendation:** Extend existing `page-analyzer.ts` with check runner architecture. Create `audit_findings` table for granular results. Implement checks by tier, starting with Tier 1 for immediate value.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DOM/Regex Checks (Tier 1) | Backend Worker | -- | Cheerio parsing server-side only |
| Calculation Checks (Tier 2) | Backend Worker | -- | Compute-bound, no external deps |
| API Checks (Tier 3) | Backend Worker | -- | CrUX/NLP/GSC APIs server-only |
| Crawl Checks (Tier 4) | Backend Worker | -- | Site-wide graph analysis |
| Findings Storage | Database | -- | PostgreSQL persistence |
| Score Display | Frontend | API | UI consumes computed scores |

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `cheerio` | ^1.0.0 | HTML DOM parsing | [VERIFIED: already in use] |
| `drizzle-orm` | ^0.44.4 | Database ORM | [VERIFIED: pg-core in use] |
| `zod` | ^3.x | Schema validation | [VERIFIED: already in use] |
| `bullmq` | 5.74.1 | Job queue for async checks | [VERIFIED: per CLAUDE.md] |

### Supporting (May Need)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `readability-scores` | ^1.x | Flesch-Kincaid calculation | Tier 2 check #67 |
| `natural` | ^6.x | NLP/entity extraction | If not using external API |

**No new dependencies required for Tier 1 checks** - all 66 can be implemented with existing Cheerio.

## Architecture Patterns

### System Architecture Diagram

```
[HTML Input] --> [Check Runner]
                     |
          +--------------------+
          |                    |
     [Tier 1-2]           [Tier 3-4]
     Sync Checks          Async Checks
          |                    |
          v                    v
    [PageAnalysis]       [BullMQ Queue]
          |                    |
          +--------------------+
                     |
                     v
            [CheckResult[]]
                     |
                     v
         [audit_findings table]
                     |
                     v
          [Score Calculation]
                     |
                     v
     [on_page_score in audit_pages]
```

### Recommended Project Structure

```
src/server/lib/audit/
├── checks/
│   ├── index.ts           # Check registry
│   ├── types.ts           # CheckResult, CheckDefinition
│   ├── runner.ts          # runChecks(html, config)
│   ├── scoring.ts         # calculateOnPageScore()
│   ├── tier1/
│   │   ├── html-signals.ts      # Checks 1-5
│   │   ├── heading-structure.ts  # Checks 6-13
│   │   ├── title-meta.ts         # Checks 14-20
│   │   ├── url-structure.ts      # Checks 21-25
│   │   ├── content-structure.ts  # Checks 26-32
│   │   ├── image-basics.ts       # Checks 33-38
│   │   ├── internal-links.ts     # Checks 39-43
│   │   ├── external-links.ts     # Checks 44-47
│   │   ├── schema-basics.ts      # Checks 48-54
│   │   ├── technical-basics.ts   # Checks 55-59
│   │   └── eeat-signals.ts       # Checks 60-66
│   ├── tier2/
│   │   ├── content-quality.ts    # Checks 67-71
│   │   ├── anchor-analysis.ts    # Checks 72-74
│   │   ├── schema-completeness.ts # Checks 75-80
│   │   ├── freshness.ts          # Checks 81-83
│   │   └── mobile.ts             # Checks 84-87
│   ├── tier3/
│   │   ├── cwv.ts                # Checks 88-90
│   │   ├── entity-nlp.ts         # Checks 91-94
│   │   ├── backlinks.ts          # Checks 95-97
│   │   └── engagement.ts         # Checks 98-100
│   └── tier4/
│       ├── architecture.ts       # Checks 101-105
│       └── differentiation.ts    # Checks 106-107
```

### Pattern 1: Check Definition Interface

```typescript
// Source: Design doc scoring system
interface CheckDefinition {
  id: string;                    // e.g., "T1-01" for Tier 1, Check 1
  name: string;                  // Human-readable name
  tier: 1 | 2 | 3 | 4;
  category: string;              // e.g., "html-signals", "heading-structure"
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoEditable: boolean;         // Can be fixed automatically
  editRecipe?: string;           // Instructions for auto-fix
  run: (ctx: CheckContext) => CheckResult;
}

interface CheckContext {
  $: cheerio.CheerioAPI;         // Parsed DOM
  html: string;                  // Raw HTML
  url: string;                   // Page URL
  keyword?: string;              // Target keyword (if provided)
  pageAnalysis: PageAnalysis;    // Existing analysis data
  siteContext?: SiteContext;     // For Tier 4 site-wide checks
}

interface CheckResult {
  checkId: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;               // Human-readable explanation
  details?: Record<string, unknown>;
  autoEditable: boolean;
  editRecipe?: string;
}
```

### Pattern 2: Check Runner

```typescript
// Source: Design doc tier structure
export async function runTier1Checks(
  html: string,
  url: string,
  keyword?: string
): Promise<CheckResult[]> {
  const $ = cheerio.load(html);
  const results: CheckResult[] = [];
  
  for (const check of tier1Checks) {
    const result = check.run({ $, html, url, keyword });
    results.push(result);
  }
  
  return results;
}
```

### Anti-Patterns to Avoid

- **Monolithic check file:** Don't put all 107 checks in one file - organize by tier and category
- **Re-parsing HTML:** Don't call `cheerio.load()` for each check - pass shared `$` instance
- **Blocking Tier 3/4:** Don't run API/crawl checks synchronously - use BullMQ queue

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flesch-Kincaid | Custom algorithm | `readability-scores` | Edge cases in syllable counting |
| JSON-LD parsing | Regex extraction | `cheerio` + `JSON.parse` | Nested script handling |
| URL normalization | String manipulation | Existing `url-utils.ts` | Already battle-tested in codebase |

## Common Pitfalls

### Pitfall 1: Keyword Detection False Positives
**What goes wrong:** Regex matches keyword in unrelated contexts (URLs, class names)
**Why it happens:** Simple `includes()` or basic regex without word boundaries
**How to avoid:** Use word boundary regex: `/\b${keyword}\b/i`
**Warning signs:** High pass rates on pages that shouldn't pass

### Pitfall 2: Missing Optional Elements
**What goes wrong:** Check throws when element doesn't exist
**Why it happens:** Not handling `null`/`undefined` from Cheerio selectors
**How to avoid:** Always use optional chaining and null checks
**Warning signs:** Audit failures on pages with minimal HTML

### Pitfall 3: Score Capping Logic
**What goes wrong:** Hard gates (CWV Poor = max 75) not applied correctly
**Why it happens:** Gates checked after score calculation instead of during
**How to avoid:** Apply gates first, then calculate remaining points
**Warning signs:** Scores >75 on pages with Poor CWV

## Schema Design

### `audit_findings` Table

```typescript
// Source: Design doc requirements
export const auditFindings = pgTable(
  "audit_findings",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id").notNull().references(() => siteAudits.id),
    pageId: text("page_id").notNull().references(() => auditPages.id),
    checkId: text("check_id").notNull(),          // e.g., "T1-01"
    tier: integer("tier").notNull(),              // 1-4
    category: text("category").notNull(),
    passed: boolean("passed").notNull(),
    severity: text("severity").notNull(),         // critical/high/medium/low
    message: text("message").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    autoEditable: boolean("auto_editable").notNull().default(false),
    editRecipe: text("edit_recipe"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ix_findings_audit").on(table.auditId),
    index("ix_findings_page").on(table.pageId),
    index("ix_findings_check").on(table.checkId),
    index("ix_findings_severity").on(table.severity, table.passed),
  ]
);
```

### Update `audit_pages` Table

Add on-page score column to existing table:

```typescript
// Add to existing audit_pages schema
onPageScore: integer("on_page_score"),  // 0-100
onPageScoreBreakdown: jsonb("on_page_score_breakdown").$type<{
  base: number;        // 60 points
  tier1: number;       // max 20
  tier2: number;       // max 10
  tier3: number;       // max 10
  gates: string[];     // Applied hard gates
}>(),
```

## Scoring System

### Score Calculation [VERIFIED: from design doc]

```typescript
// Source: docs/MICRO-OPTIMIZATIONS-80-PERCENT.md
export function calculateOnPageScore(results: CheckResult[]): ScoreResult {
  // Base score for fundamentals (URL + Title + H1 + Body)
  let score = 60;
  
  // Tier contributions
  const tier1Passed = results.filter(r => r.tier === 1 && r.passed).length;
  const tier2Passed = results.filter(r => r.tier === 2 && r.passed).length;
  const tier3Passed = results.filter(r => r.tier === 3 && r.passed).length;
  
  score += Math.min(20, tier1Passed * 0.3);  // Tier 1: +0.3 each, max 20
  score += Math.min(10, tier2Passed * 0.5);  // Tier 2: +0.5 each, max 10
  score += Math.min(10, tier3Passed * 0.8);  // Tier 3: +0.8 each, max 10
  
  // Hard gates - cap score regardless of other factors
  const gates: string[] = [];
  
  // CWV "Poor" on any metric -> Max 75
  const cwvResults = results.filter(r => ['T3-01', 'T3-02', 'T3-03'].includes(r.checkId));
  if (cwvResults.some(r => !r.passed && r.severity === 'critical')) {
    score = Math.min(75, score);
    gates.push('cwv-poor');
  }
  
  // noindex or robots block -> Max 0
  const indexableCheck = results.find(r => r.checkId === 'T1-55');
  if (indexableCheck && !indexableCheck.passed) {
    score = 0;
    gates.push('noindex');
  }
  
  return { score: Math.round(score), gates };
}
```

### Score Thresholds [VERIFIED: from design doc]

| Score | Rating | Meaning |
|-------|--------|---------|
| 90+ | Excellent | Outranks most competitors |
| 80-89 | Good | Competitive for medium KD |
| 70-79 | Average | Basic optimization only |
| <70 | Poor | Missing fundamentals |

## Check Categories Summary

### Tier 1: DOM/Regex (66 checks, <100ms)

| Category | Count | Checks |
|----------|-------|--------|
| HTML Signals (A) | 5 | Keyword in strong/b, em/i, a[title], noscript, first p |
| Heading Structure (B) | 8 | Single H1, H1 <65 chars, H1=Title match, H3 nesting, etc. |
| Title/Meta (C) | 7 | Title length, keyword position, brackets, year, meta desc |
| URL Structure (D) | 5 | Hyphens, lowercase, slug length, no repetition, depth |
| Content Structure (E) | 7 | Keyword in first 100 words, intro length, paragraph length |
| Image Basics (F) | 6 | Alt text, dimensions, lazy loading, format, filename |
| Internal Links (G) | 5 | Link count, position, duplicates, exact-match anchor |
| External Links (H) | 4 | Outbound count, nofollow, target, noopener |
| Schema Basics (I) | 7 | JSON-LD, author, dates, breadcrumbs, deprecated schemas |
| Technical Basics (J) | 5 | Canonical, HTTPS, mixed content, viewport |
| E-E-A-T Signals (K) | 7 | Author byline, bio, credentials, about/contact pages |

### Tier 2: Light Calculation (21 checks, <500ms)

| Category | Count | Checks |
|----------|-------|--------|
| Content Quality (L) | 5 | Reading level, keyword density, word count, stats density |
| Anchor Analysis (M) | 3 | Unique anchors, ratio, distribution |
| Schema Completeness (N) | 6 | author.url, sameAs, publisher.logo, citations |
| Freshness (O) | 3 | Date matching, sitemap consistency |
| Mobile (P) | 4 | H1 visibility, interstitials, tap targets, font size |

### Tier 3: API-Required (13 checks, 2-5s)

| Category | Count | Checks |
|----------|-------|--------|
| CWV (Q) | 3 | LCP, INP, CLS via CrUX API |
| Entity/NLP (R) | 4 | Entity coverage, section cohesion, TF-IDF |
| Backlinks (S) | 3 | Velocity, anchor ratio, outbound DR |
| Engagement (T) | 3 | CTR vs position, scroll depth, bounce rate |

### Tier 4: Crawl-Required (7 checks, minutes)

| Category | Count | Checks |
|----------|-------|--------|
| Architecture (U) | 5 | Click depth, orphans, hub-spoke mapping |
| Differentiation (V) | 2 | Unique content, scaled content detection |

## Existing Infrastructure Summary

| Component | Location | What It Does | Reuse Strategy |
|-----------|----------|--------------|----------------|
| `page-analyzer.ts` | `src/server/lib/audit/` | Cheerio HTML parsing | Extend with check runner |
| `PageAnalysis` type | `src/server/lib/audit/types.ts` | Extracted SEO data | Use as check input |
| `health-score.ts` | `src/lib/dashboard/` | Client health scoring | Model for on-page scoring |
| `AuditService` | `src/server/features/audit/` | Audit orchestration | Add findings storage |
| `url-utils.ts` | `src/server/lib/audit/` | URL normalization | Reuse for URL checks |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (assumed from project patterns) |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --run src/server/lib/audit/checks` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| CHK-01 | Tier 1 checks run in <100ms | unit | `npm test -- checks/tier1` |
| CHK-02 | Check results stored in audit_findings | integration | `npm test -- integration/findings` |
| CHK-03 | Score calculation matches spec | unit | `npm test -- checks/scoring` |
| CHK-04 | Hard gates cap scores correctly | unit | `npm test -- checks/scoring` |

### Wave 0 Gaps
- [ ] `src/server/lib/audit/checks/types.ts` - check interfaces
- [ ] `src/server/lib/audit/checks/runner.test.ts` - runner tests
- [ ] `src/server/lib/audit/checks/scoring.test.ts` - score calculation tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes | Existing audit access controls |
| V5 Input Validation | yes | Zod schemas for check config |
| V6 Cryptography | no | -- |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| HTML injection in reports | Tampering | Sanitize check messages before display |
| DoS via large HTML | Denial | Limit HTML size before parsing |

## Open Questions

1. **Keyword Source:**
   - What we know: Checks 1-5, 11-12, 26-27 require target keyword
   - What's unclear: Where does keyword come from per page?
   - Recommendation: Add optional `keyword` column to audit config or derive from title

2. **YMYL Detection:**
   - What we know: Checks 63, 80 have stricter rules for YMYL pages
   - What's unclear: How to detect if page is YMYL?
   - Recommendation: Use category/topic classification or manual flag

3. **Tier 3/4 API Keys:**
   - What we know: CrUX, GSC, GA4 APIs required
   - What's unclear: Are all API keys available in current environment?
   - Recommendation: Check env vars during implementation

## Sources

### Primary (HIGH confidence)
- `docs/MICRO-OPTIMIZATIONS-80-PERCENT.md` - all 107 checks specification
- `src/server/lib/audit/page-analyzer.ts` - existing Cheerio infrastructure
- `src/server/lib/audit/types.ts` - existing type definitions
- `src/lib/dashboard/health-score.ts` - scoring pattern reference

### Secondary (MEDIUM confidence)
- `src/db/dashboard-schema.ts` - PostgreSQL/Drizzle patterns
- `CLAUDE.md` - stack constraints (BullMQ, pg-core)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing infrastructure verified in codebase
- Architecture: HIGH - extends existing patterns
- Check definitions: HIGH - verbatim from design doc
- Scoring: HIGH - explicit formula in design doc

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days - stable specification)
