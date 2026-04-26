# Phase 43: Prospect Keyword Pipeline

> **Status:** Planning  
> **Estimated Hours:** 47 (expanded for power user features)  
> **Dependencies:** Phase 42 (42-01, 42-02, 42-03)  
> **Milestone:** v5.2

## Goal

Complete the prospect → komercinis → sutartele flow with **flexible keyword input modes**:
1. Accept keywords from multiple sources (manual, CSV, DataForSEO, competitor gap)
2. Smart enrichment (skip if data present, batch API calls, 7-day cache)
3. Prioritize and classify keywords (tiers, quick wins)
4. Map keywords to prospect's existing pages
5. Generate scenario-appropriate proposals (focused/full/competitor-only)
6. Export to CSV with Lithuanian headers

## Key Insight: Five Entry Points, Not One

Agencies have wildly different prospect scenarios:

| Entry Point | Use Case | Workspace? | Cost |
|-------------|----------|------------|------|
| **Quick Check** | "Check these 3 keywords" | No | ~$0.005 |
| **CSV Import** | "I have an Ahrefs export" | Yes | $0 if metrics present |
| **Full Discovery** | "Research this prospect" | Yes | ~$0.04 |
| **Gap Analysis** | "What am I missing?" | Yes | ~$0.04 |
| **Competitor Spy** | "What does X rank for?" | No | ~$0.02 |

**Progressive disclosure**: Quick actions stay quick. Complex workflows available but not forced.

## Business Context

This pipeline enables:
1. **Sales acceleration** — Generate commercial proposals in minutes, not hours
2. **Data-driven prioritization** — Multi-factor scoring identifies quick wins
3. **Page-level action items** — Clear mapping of keywords to existing/needed pages
4. **Professional deliverables** — CSV exports and proposal PDFs for client meetings

## User Flow Architecture

### Entry Point Selection UI

```
┌────────────────────────────────────────────────────────────────┐
│  + NEW KEYWORD RESEARCH                                        │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  🔍 Discover │  │  📄 Import   │  │  ⚡ Quick    │         │
│  │  Full keyword│  │  Upload CSV  │  │  Check 1-20  │         │
│  │  research    │  │  from tools  │  │  keywords    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │  📊 Gap      │  │  👁 Competitor│                          │
│  │  Analysis    │  │  Spy         │                           │
│  └──────────────┘  └──────────────┘                           │
└────────────────────────────────────────────────────────────────┘
```

### Keyword Source Tracking

```typescript
interface ProspectKeyword {
  keyword: string;
  normalizedKeyword: string;
  source: 'dataforseo' | 'manual' | 'csv_upload' | 'competitor_gap';
  sourceMetadata: SourceMetadata;
  
  // Nullable until enriched
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  
  enrichmentStatus: 'pending' | 'enriched' | 'cached' | 'failed' | 'skipped';
  enrichmentCostCents: number;
}
```

### Smart Enrichment Rules

| Source | Volume | Difficulty | CPC | Needs API? |
|--------|--------|------------|-----|------------|
| DataForSEO fetch | ✓ | ✓ | ✓ | No |
| Competitor gap | ✓ | ✓ | ✓ | No |
| CSV (with metrics) | ✓ | ✓ | ✓ | No |
| CSV (keywords only) | ✗ | ✗ | ✗ | Yes |
| Manual entry | ✗ | ✗ | ✗ | Yes |

**Cost optimization:**
- Batch up to 1000 keywords per API call
- 7-day Redis cache (cross-tenant)
- Skip enrichment if metrics present

## Sub-Plans (Revised for Agency Power Users)

| Plan | Focus | Hours | Dependencies |
|------|-------|-------|--------------|
| 43-01 | Entry Point Architecture + Keyword Schema | 8h | None |
| 43-02 | Quick Check + Competitor Spy Modes | 6h | 43-01 |
| 43-03 | CSV Import + Metric Detection | 5h | 43-01 |
| 43-04 | Prioritization Engine + UI | 10h | 43-01, 43-02, 43-03 |
| 43-05 | Scraping Customization + AI Extraction | 8h | 42-01 |
| 43-06 | Proposal Generation + Copywriting AI | 10h | 43-04, 42-02 |

**Total: 47h** (expanded from 40h for power user features)

See: [GSD-PLAN-REVISION.md](GSD-PLAN-REVISION.md) for detailed UX wireframes and user journey designs.

## Proposal Scenarios

| Scenario | Keywords | Page Mapping | Base Price | Use Case |
|----------|----------|--------------|------------|----------|
| **Focused** | 3-10 | Yes (all) | €150 + €25/kw | "I want these 3 keywords" |
| **Full Audit** | 100+ | Yes (top 20) | €800 flat | Comprehensive SEO strategy |
| **Competitor Only** | Gap list | No | €250 + €75/comp | "What am I missing?" |

### Sections by Scenario

| Section | Focused | Full Audit | Competitor |
|---------|---------|------------|------------|
| Executive Summary | ✓ | ✓ | ✓ |
| Current State | Optional | ✓ | Optional |
| Keyword Analysis | ✓ (all) | ✓ (top 20) | ✗ |
| Competitor Comparison | ✓ | ✓ | ✓ (main) |
| Page Mapping | ✓ | ✓ | ✗ |
| ROI Projections | ✓ | ✓ | Optional |
| Investment | ✓ | ✓ | ✓ |
| Appendix | ✗ | ✓ (100 kw) | Optional |

## Prioritization Algorithm

```typescript
compositeScore = (
  volumeScore * 0.15 +      // Search demand
  competitionScore * 0.10 + // Easier = higher
  relevanceScore * 0.25 +   // Product/category match
  focusScore * 0.35 +       // Business priorities (HIGHEST)
  positionScore * 0.15      // Current ranking opportunity
) * quickWinMultiplier
```

### Quick Win Detection

| Type | Criteria | Multiplier |
|------|----------|------------|
| Striking Distance | Position 11-30, volume >= 200, competition <= 0.7 | 1.3x |
| Low Hanging Fruit | Position 4-10, competition <= 0.5, volume >= 100 | 1.2x |
| Fresh Opportunity | Not ranking, relevance >= 0.9, volume >= 500, competition <= 0.4 | 1.15x |

### Tier Thresholds

| Tier | Score Range | Action |
|------|-------------|--------|
| Must-Do | 0.75 - 1.0 | Immediate |
| Should-Do | 0.50 - 0.749 | This Quarter |
| Nice-to-Have | 0.25 - 0.499 | Backlog |
| Ignore | < 0.25 | Skip |

## Success Criteria

### Entry Points & Keywords
- [ ] All 5 keyword input modes functional with source tracking
- [ ] Quick Check works without creating workspace (share link, promote to prospect)
- [ ] Competitor Spy mode extracts competitor rankings without prospect
- [ ] CSV import auto-detects Ahrefs/SEMrush/Moz column formats
- [ ] CSV import skips enrichment when metrics present (cost savings)
- [ ] Enrichment batching reduces API calls by 90%+ vs naive approach

### Prioritization & UI
- [ ] Keywords display with tier badges and source indicators
- [ ] Quick wins highlighted (striking distance, low hanging, fresh opportunity)
- [ ] Power users can customize score weights via UI
- [ ] Bulk tier override and export to CSV functional

### Scraping & AI
- [ ] Custom CSS selectors save per-prospect configuration
- [ ] AI selector discovery works on Shopify/WooCommerce/Magento
- [ ] Extraction rule testing shows sample output before full crawl

### Proposals & Mapping
- [ ] Page mapping shows keyword → URL matches with confidence scores
- [ ] Cannibalization warnings appear when detected
- [ ] Awareness classifier selects appropriate hook strategy
- [ ] Three proposal scenarios generate awareness-appropriate content
- [ ] AI generates sections using XML prompts (Schwartz/Halbert/Kennedy)
- [ ] Agreement generator produces valid Lithuanian sutartis

### Integration
- [ ] Full flow works: entry point → keywords → mapping → komercinis → sutartele
- [ ] Cost per prospect < $0.10 at 95% cache hit rate

## Existing Code to Extend

| Component | Location | Status |
|-----------|----------|--------|
| DataForSEO integration | `open-seo-main/src/server/lib/dataforseo*.ts` | EXISTS |
| Prospect schema | `open-seo-main/src/db/prospect-schema.ts` | EXISTS |
| Proposal system | `open-seo-main/src/db/proposal-schema.ts` | EXISTS |
| Prospect UI | `apps/web/src/app/(shell)/prospects/` | EXISTS |

## New Files to Create

| File | Purpose |
|------|---------|
| `prospect-keyword-schema.ts` | Multi-source keyword storage |
| `KeywordInputService.ts` | Unified input orchestrator |
| `KeywordEnrichmentService.ts` | Batched DataForSEO enrichment |
| `KeywordDeduplicator.ts` | Cross-source deduplication |
| `scenarios.ts` | Proposal scenario configs |
| `pricing.ts` | Pricing calculator |
| `validation.ts` | Completeness validation |

## Source Documents

| Document | Purpose |
|----------|---------|
| `.planning/PROSPECT-KEYWORD-PIPELINE-ANALYSIS.md` | Gap analysis + build order |
| `.planning/keyword-intelligence/XML-PROMPTS.md` | Keyword classification prompts (4 templates) |
| `.planning/keyword-intelligence/PROPOSAL-XML-PROMPTS.md` | Proposal & Agreement prompts (7 templates) |
| `.planning/keyword-intelligence/CATEGORY-MATCHING.md` | Hybrid matching algorithm |
| `.planning/keyword-intelligence/USER-FOCUS.md` | Business priority integration |
| `GSD-PLAN-REVISION.md` | Detailed UX wireframes + user journeys |
