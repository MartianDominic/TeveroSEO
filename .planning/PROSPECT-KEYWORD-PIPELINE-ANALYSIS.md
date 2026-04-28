# Prospect Keyword Pipeline: What Exists vs What's Needed

> **Generated:** 2026-04-26  
> **Analysis Method:** 5 Opus deep-dive agents  
> **Purpose:** Determine implementation path for prospect → komercinis → sutartele flow

---

## Executive Summary

**The good news:** 60-70% of the prospect keyword pipeline already exists in the codebase.

**The work needed:** ~35-45 hours to complete the full flow from keyword research to commercial proposal with page mapping.

| Component | Status | Effort |
|-----------|--------|--------|
| DataForSEO integration | **EXISTS** | 0h |
| Prospect keyword analysis | **EXISTS** | 0h |
| Proposal system (komercinis) | **EXISTS** | 0h |
| CSV export | **MISSING** | 2-3h |
| Prospect keyword-to-page mapping | **MISSING** | 12-16h |
| Keyword prioritization UI | **MISSING** | 8-10h |
| Recommendation generation | **MISSING** | 6-8h |
| Full keyword intelligence infra | **RESEARCH DONE** | 20h (separate phase) |

---

## 1. Already Built (Production-Ready)

### DataForSEO Integration
```
open-seo-main/src/server/lib/dataforseoClient.ts
open-seo-main/src/server/lib/dataforseoProspect.ts
open-seo-main/src/server/lib/dataforseoKeywordGap.ts
```
- `keywordsForSite()` - Get organic keywords for domain
- `competitorsDomain()` - Discover competitors
- `domainIntersection()` - Keyword gap analysis
- Automatic billing/metering via Autumn

### Prospect Data Model
```
open-seo-main/src/db/prospect-schema.ts
```
- `KeywordGap`, `OpportunityKeyword`, `ScrapedContent` types
- Full analysis workflow with deduplication
- `organicKeywords` field for storing DataForSEO results

### Proposal System ("Komercinis")
```
open-seo-main/src/db/proposal-schema.ts
```
- `ProposalContent` JSONB with opportunities array
- Draft/sent/viewed/accepted/signed/paid workflow
- ROI calculator data
- Token-based public viewing

### Frontend for Prospects
```
apps/web/src/app/(shell)/prospects/page.tsx
apps/web/src/app/(shell)/prospects/actions.ts
```
- Create/update/delete prospects
- Trigger analysis (quick_scan, deep_dive, opportunity_discovery)
- Bulk analyze with quota management

---

## 2. Missing Components (Build Order)

### Phase A: CSV Export (2-3 hours)
**Effort:** Low | **Dependency:** None

What's needed:
- `GET /api/prospects/:id/keywords/export?format=csv`
- Export `opportunityKeywords` + `keywordGaps` from analysis
- Columns: keyword, volume, difficulty, position, opportunity_score, classification
- Lithuanian headers option

Files to create:
```
open-seo-main/src/server/features/prospects/routes/export.ts
```

### Phase B: Keyword Prioritization UI (8-10 hours)
**Effort:** Medium | **Dependency:** Phase A

What's needed:
- `/prospects/[id]/keywords` page
- Display keywords with sorting/filtering by tier
- Quick win badges (striking-distance, low-hanging-fruit)
- Checkbox selection for proposal inclusion
- Tier summary (must-do, should-do, nice-to-have, ignore)

Files to create:
```
apps/web/src/app/(shell)/prospects/[id]/keywords/page.tsx
apps/web/src/app/(shell)/prospects/[id]/keywords/components/KeywordTable.tsx
apps/web/src/app/(shell)/prospects/[id]/keywords/components/TierBadge.tsx
apps/web/src/app/(shell)/prospects/[id]/keywords/components/QuickWinIndicator.tsx
```

### Phase C: Prospect Page Mapping (12-16 hours)
**Effort:** High | **Dependency:** None (can run parallel with B)

What's needed:
- Lightweight crawler for prospect sites (categories + products only)
- Three-layer matching: rules → embeddings → LLM fallback
- Cannibalization detection
- Gap detection (keywords needing new pages)
- UI: mapping view showing keyword → page matches

Key insight from Agent 4:
> "The crawler must be lightweight (no full-site crawl), fast (under 2 minutes for 500-2000 pages), and focused (only categories + products, skip non-SEO pages)."

Files to create:
```
open-seo-main/src/server/features/mapping/services/ProspectCrawler.ts
open-seo-main/src/server/features/mapping/services/MatchOrchestrator.ts
open-seo-main/src/server/features/mapping/services/CannibalizationDetector.ts
open-seo-main/src/server/features/mapping/prompts/keyword-page-matcher.xml
apps/web/src/app/(shell)/prospects/[id]/mapping/page.tsx
```

### Phase D: Recommendation Generation (6-8 hours)
**Effort:** Medium | **Dependency:** Phase B

What's needed:
- LLM-powered recommendation generator
- Cluster related keywords into actionable recommendations
- Generate executive summary
- Estimated traffic impact calculations

Files to create:
```
open-seo-main/src/server/features/keywords/services/RecommendationGenerator.ts
open-seo-main/src/server/features/keywords/prompts/recommendation-generator.xml
apps/web/src/app/(shell)/prospects/[id]/recommendations/page.tsx
```

---

## 3. Prioritization Algorithm Summary

From Agent 5's deep analysis, the scoring formula:

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

---

## 4. World-Class XML Prompts Designed

### 4.1 Keyword-Page Matcher Prompt
Purpose: LLM fallback for ambiguous keyword-to-page matching
Key features:
- Lithuanian morphology rules (7 cases)
- Brand alias normalization
- Color code STRICT matching (wrong color = disqualified)
- Cannibalization detection
- Gap identification

### 4.2 Recommendation Generator Prompt
Purpose: Generate prioritized SEO recommendations
Key features:
- Clusters related keywords
- Prioritizes by impact/effort ratio
- Generates executive summary
- Concrete action steps with deadlines

### 4.3 Business Priority Parser Prompt
Purpose: Extract FocusDirective from user input
Key features:
- Category/brand prioritization
- Exclusion handling
- Lithuanian variant generation
- Temporal scope detection

### 4.4 Commercial Proposal Narrative Prompt
Purpose: Generate proposal sections in Lithuanian
Key features:
- Opportunity framing
- Competitor analysis narrative
- ROI projection explanations

---

## 5. The Complete Flow (After Implementation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROSPECT → KOMERCINIS FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

1. CREATE PROSPECT
   └── Input: domain (e.g., "plaukucentras.lt")

2. FETCH KEYWORDS [EXISTS]
   └── DataForSEO Labs API → organicKeywords[]
   └── Cost: ~$0.02 per prospect (100 keywords)

3. SCORE & PRIORITIZE [BUILD: Phase B]
   └── Multi-factor scoring (volume, competition, relevance, focus, position)
   └── Quick win detection
   └── Tier assignment (must-do, should-do, nice-to-have, ignore)

4. MAP TO PAGES [BUILD: Phase C]
   └── Lightweight crawl of prospect site (categories + products)
   └── Three-layer matching (rules → embeddings → LLM)
   └── Output: { keyword, matchedPage, confidence, action }
   └── Detect: cannibalization, gaps

5. GENERATE RECOMMENDATIONS [BUILD: Phase D]
   └── Cluster keywords into actionable recommendations
   └── Generate executive summary
   └── Estimate traffic impact

6. EXPORT CSV [BUILD: Phase A]
   └── Columns: keyword, volume, difficulty, position, tier, matched_page, action
   └── Lithuanian headers

7. CREATE PROPOSAL ("KOMERCINIS") [EXISTS]
   └── Select keywords to include
   └── Auto-generate narrative sections
   └── ROI calculator
   └── Export to PDF (optional)

8. SHARE WITH PROSPECT [EXISTS]
   └── Token-based public link
   └── Track: viewed, accepted, signed
```

---

## 6. Recommended GSD Phase Structure

Given the scope, this should be a **new GSD phase**. Recommended structure:

### Phase 42: Prospect Keyword Pipeline

| Plan | Focus | Hours | Dependencies |
|------|-------|-------|--------------|
| 42-01 | CSV Export + Basic Prioritization | 5h | None |
| 42-02 | Prioritization UI (keyword table, tiers, quick wins) | 8h | 42-01 |
| 42-03 | Prospect Page Mapping (crawler + matcher) | 14h | None |
| 42-04 | Recommendation Generation + Executive Summary | 8h | 42-02 |

**Total:** ~35 hours

### Phase Verification Criteria
- [ ] CSV export works with Lithuanian headers
- [ ] Keywords display with tier badges in UI
- [ ] Quick wins highlighted with visual indicators
- [ ] Page mapping shows keyword → URL matches
- [ ] Cannibalization warnings appear when detected
- [ ] Recommendations generate with action steps
- [ ] Full flow works: prospect → keywords → mapping → komercinis

---

## 7. Cost Model (Per Prospect)

| Operation | Cost | When |
|-----------|------|------|
| DataForSEO keywords (100) | $0.02 | First analysis |
| DataForSEO SERP (5 keywords) | $0.003 | First analysis |
| Prospect site crawl | $0.00 | Self-hosted |
| LLM matching (10% of keywords) | ~$0.02 | Page mapping |
| LLM recommendations | ~$0.03 | Report generation |
| **Total (cache miss)** | **~$0.07** | |
| **Total (cache hit)** | **~$0.01** | |

---

## 8. References

| Document | Purpose |
|----------|---------|
| Agent 1 Output | Gap analysis - what exists vs missing |
| Agent 2 Output | DataForSEO prospect flow design |
| Agent 3 Output | Commercial proposal design |
| Agent 4 Output | Keyword-page mapping design |
| Agent 5 Output | Prioritization algorithm + XML prompts |
| `.planning/keyword-intelligence/` | Full keyword intelligence research (18 docs) |
| `docs/infra-research/` | Infrastructure research (crawler, graph, embeddings) |
