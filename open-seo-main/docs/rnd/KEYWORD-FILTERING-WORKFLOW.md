# Keyword Filtering Workflow

> Phase 1 outputs 100-1000 keywords. This document defines how we filter to the best 50-200 actionable keywords per client.

## The Problem

Discovery dumps raw keywords from GSC + site scrape. Not all are worth pursuing:
- Some are too competitive for the client
- Some don't match what we agreed to optimize
- Some have no business value
- Some cannibalize each other

## The Solution: 4-Stage Filtering Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     KEYWORD FILTERING PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STAGE 1: CLIENT CONSTRAINTS                                            │
│  ────────────────────────                                               │
│  Apply hard rules from client agreement                                 │
│  • "Only category pages" → exclude product/blog keywords                │
│  • "Transactional only" → exclude informational queries                 │
│  • "Min 100 searches" → volume floor                                    │
│  • "Exclude competitor names" → brand filter                            │
│  Result: 1000 → 400 keywords                                            │
│                                                                         │
│  STAGE 2: FEASIBILITY SCORING                                           │
│  ───────────────────────────                                            │
│  Score each keyword for THIS client's ability to rank                   │
│  • Authority gap (client DA vs competitor average)                      │
│  • Content coverage (does client have topical authority?)               │
│  • SERP feature impact (AI overview stealing clicks?)                   │
│  • Historical velocity (how fast has client ranked before?)             │
│  Result: 400 → 200 scored keywords                                      │
│                                                                         │
│  STAGE 3: CATEGORY MAPPING                                              │
│  ────────────────────────                                               │
│  Map keywords to client's site taxonomy                                 │
│  • Embed keywords + categories, match by similarity                     │
│  • Assign content type (category page, blog, landing page)              │
│  • Detect cannibalization (multiple pages targeting same keyword)       │
│  • Consolidate (keywords that should target same page)                  │
│  Result: 200 keywords mapped to ~80 target pages                        │
│                                                                         │
│  STAGE 4: PRIORITY RANKING                                              │
│  ────────────────────────                                               │
│  Rank by combined opportunity score                                     │
│  • Quick wins first (position 5-20, low authority gap)                  │
│  • High value next (volume × CPC × feasibility)                         │
│  • Category ROI (aggregate value per category)                          │
│  Result: Final prioritized list for client approval                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Client Constraint Engine

### Constraint Types

| Type | Examples | Stored As |
|------|----------|-----------|
| **Page Type** | Only category pages, exclude blog | `page_type IN ('category')` |
| **Intent** | Transactional only, no informational | `intent = 'transactional'` |
| **Volume** | Min 100, max 10000 | `volume BETWEEN 100 AND 10000` |
| **Difficulty** | KD < 50 | `difficulty < 50` |
| **Location** | Only "New York" keywords | `keyword ILIKE '%new york%'` |
| **Exclusion** | No competitor names | `keyword NOT ILIKE '%competitor%'` |
| **Inclusion** | Must contain "software" | `keyword ILIKE '%software%'` |

### How Client Agreement Maps to Constraints

```typescript
// Client says: "We want to rank for our product categories, 
// transactional keywords only, minimum 200 monthly searches"

const constraints = [
  { type: 'page_type', operator: 'in', value: ['category'] },
  { type: 'intent', operator: 'equals', value: 'transactional' },
  { type: 'volume', operator: 'gte', value: 200 },
];
```

### Preset Templates by Business Type

| Business Type | Default Constraints |
|---------------|---------------------|
| **E-commerce** | Page type: category/product, intent: transactional/commercial, min volume: 100 |
| **Local Service** | Location: service area cities, intent: transactional, include: "near me" variants |
| **SaaS** | Intent: commercial/transactional, exclude: competitor brands, min volume: 50 |
| **Content Publisher** | Intent: informational, min volume: 500, difficulty: < 40 |

### SQL Execution

```sql
-- Apply all constraints in single query
SELECT * FROM discovered_keywords k
WHERE k.project_id = $1
  -- Page type constraint
  AND k.recommended_page_type IN ('category')
  -- Intent constraint  
  AND k.intent = 'transactional'
  -- Volume constraint
  AND k.search_volume >= 200
  -- Exclusion list
  AND k.keyword NOT ILIKE ANY(ARRAY['%competitor1%', '%competitor2%'])
ORDER BY k.search_volume DESC;
```

---

## Stage 2: Feasibility Scoring

### The Problem with Generic KD

Generic "keyword difficulty" is useless:
- A DA 80 site can rank for KD 70 keywords easily
- A DA 20 site struggles with KD 30 keywords
- Same keyword, completely different feasibility

### Client-Specific Feasibility Formula

```
Feasibility = (Authority × 0.35) + (Content × 0.30) + (Velocity × 0.35) × SERP Modifier
```

### Component Scores

**Authority Feasibility (0-100)**
```typescript
const daGap = avgCompetitorDA - clientDA;
const authorityFeasibility = Math.max(0, 50 - daGap);
// Client DA 40, Competitor avg DA 35 → 50 - (-5) = 55 (advantage)
// Client DA 25, Competitor avg DA 50 → 50 - 25 = 25 (tough)
```

**Content Feasibility (0-100)**
```typescript
const coverageRatio = clientSubtopicsCovered / totalSubtopics;
const contentFeasibility = coverageRatio * 100;
// Client covers 8/10 subtopics → 80 (strong topical authority)
// Client covers 2/10 subtopics → 20 (needs content investment)
```

**Velocity Score (0-100)**
Based on client's historical ranking speed:
- How fast do their new pages get indexed?
- What % of similar-difficulty keywords reached top 10?
- Recent momentum (improving or declining?)

**SERP Modifier (0.5 - 1.5)**
```typescript
let modifier = 1.0;
if (hasAIOverview) modifier -= 0.3;
if (hasLocalPack && !clientIsLocal) modifier -= 0.25;
if (hasFeaturedSnippet && clientCanWin) modifier += 0.3;
```

### Feasibility Verdict

| Score | Verdict | Action |
|-------|---------|--------|
| 70-100 | Quick Win | Prioritize immediately |
| 55-69 | Achievable | Include in 90-day plan |
| 40-54 | Stretch | Plan with resources |
| 25-39 | Long Term | Strategic investment |
| 0-24 | Not Feasible | Skip or revisit later |

---

## Stage 3: Category Mapping

### Why Map Keywords to Categories?

Client says "rank for categories" — we need to:
1. Identify which keywords belong to which category
2. Determine if keyword should go to category page, product page, or blog
3. Find cannibalization (multiple pages competing)
4. Find consolidation opportunities (similar keywords → same page)

### Mapping Algorithm

```typescript
// 1. Embed all keywords and category names
const keywordEmbeddings = await embedBatch(keywords);
const categoryEmbeddings = await embedBatch(categories.map(c => c.name + ' ' + c.seedKeywords.join(' ')));

// 2. Match each keyword to best category by cosine similarity
for (const kw of keywords) {
  const similarities = categoryEmbeddings.map(cat => 
    cosineSimilarity(kw.embedding, cat.embedding)
  );
  const bestMatch = argmax(similarities);
  
  mappings.push({
    keyword: kw.text,
    category: categories[bestMatch].name,
    confidence: similarities[bestMatch],
  });
}
```

### Content Type Assignment Rules

```
IF keyword matches category name closely AND intent is commercial/transactional
  → CATEGORY PAGE

IF keyword is "how to" / "guide" / "what is"
  → BLOG POST

IF keyword is "best X" / "X vs Y" / "X review"
  → COMPARISON BLOG POST

IF keyword is specific product + transactional modifier
  → PRODUCT PAGE

IF keyword has high volume but doesn't fit existing pages
  → NEW LANDING PAGE
```

### Cannibalization Detection

```sql
-- Find keywords where multiple client URLs rank
SELECT 
  query,
  COUNT(DISTINCT page) as competing_pages,
  array_agg(page) as pages,
  array_agg(position) as positions
FROM gsc_data
WHERE project_id = $1
GROUP BY query
HAVING COUNT(DISTINCT page) > 1
ORDER BY SUM(impressions) DESC;
```

**Resolution Actions:**
- Add internal link from weaker page to stronger page
- Differentiate content (one informational, one transactional)
- 301 redirect if content overlaps significantly
- Consolidate into single authoritative page

---

## Stage 4: Priority Ranking

### Quick Wins Formula

Quick wins = keywords where we're close + effort is low:

```typescript
const quickWinScore = (
  (20 - currentPosition) / 15 * 40 +  // Position proximity (max 40)
  Math.max(0, 30 - authorityGap) +     // Authority gap (max 30)
  Math.min(30, log10(impressions) * 10) // Volume (max 30)
);
```

### Opportunity Score Formula

For non-quick-wins, rank by expected value:

```typescript
const opportunityScore = (
  trafficValue * 0.30 +      // Volume × CPC (normalized)
  feasibility * 0.35 +       // Can we rank?
  businessFit * 0.25 +       // Does it match client goals?
  momentum * 0.10            // Is client trending up for this topic?
);
```

### Category-Level Prioritization

When client says "rank for categories," aggregate scores:

```sql
SELECT 
  category_name,
  COUNT(*) as keyword_count,
  SUM(search_volume) as total_volume,
  SUM(search_volume * cpc) as traffic_value,
  AVG(feasibility_score) as avg_feasibility,
  COUNT(CASE WHEN position BETWEEN 5 AND 20 THEN 1 END) as quick_wins
FROM keyword_mappings km
JOIN keywords k ON km.keyword_id = k.id
GROUP BY category_name
ORDER BY 
  quick_wins DESC,           -- Categories with quick wins first
  avg_feasibility DESC,      -- Then by achievability
  traffic_value DESC;        -- Then by value
```

### Final Output: Prioritized Keyword List

```
┌────────────────────────────────────────────────────────────────────────┐
│ RECOMMENDED KEYWORDS FOR CLIENT APPROVAL                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ QUICK WINS (12 keywords)                                               │
│ ─────────────────────────                                              │
│ Keywords at positions 5-20 that need minimal effort to rank top 3     │
│ • "accounting software small business" - Position 8, Volume 2400      │
│ • "cloud accounting solutions" - Position 12, Volume 1800             │
│ ...                                                                   │
│                                                                        │
│ CATEGORY: ACCOUNTING SOFTWARE (28 keywords)                            │
│ ───────────────────────────────────────────                            │
│ Aggregate: 45,000 monthly searches, $12,500 traffic value              │
│ Feasibility: 72% achievable                                            │
│ • "best accounting software" - KD 45, Volume 8100, Feasibility 68     │
│ • "accounting software pricing" - KD 32, Volume 3200, Feasibility 85  │
│ ...                                                                   │
│                                                                        │
│ CATEGORY: INVOICING (15 keywords)                                      │
│ ─────────────────────────────────                                      │
│ Aggregate: 22,000 monthly searches, $8,200 traffic value               │
│ ...                                                                   │
│                                                                        │
│ EXCLUDED (523 keywords)                                                │
│ ───────────────────────                                                │
│ • Filtered by constraints: 312                                         │
│ • Low feasibility (<25): 156                                           │
│ • Cannibalization duplicates: 55                                       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Client Approval Flow

1. **System generates** filtered, prioritized keyword list
2. **Client reviews** in dashboard or exported CSV
3. **Client approves/rejects** individual keywords or entire categories
4. **Approved keywords** become the "working set" for optimization
5. **Status tracking:** `pending` → `approved` → `optimizing` → `ranking`

### Database Schema

```sql
-- Keyword status after filtering
ALTER TABLE saved_keywords ADD COLUMN approval_status text 
  DEFAULT 'pending' 
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'optimizing', 'ranking'));

ALTER TABLE saved_keywords ADD COLUMN approved_at timestamptz;
ALTER TABLE saved_keywords ADD COLUMN approved_by text;
```

---

## Integration with Existing Codebase

| Component | File | Integration Point |
|-----------|------|-------------------|
| Constraint Engine | `src/server/lib/constraints/ConstraintEngine.ts` | New service |
| Feasibility Scoring | `src/server/lib/opportunity/FeasibilityService.ts` | Extends OpportunityDiscoveryService |
| Category Mapping | `src/server/lib/keyword-mapping/CategoryClassifier.ts` | Uses Gemini embeddings |
| Priority Ranking | `src/server/lib/keyword-ranking/PriorityRanker.ts` | New service |
| Quick Win Detection | `src/server/lib/keyword-ranking/QuickWinDetector.ts` | Uses GSC position data |

---

## Related Research Documents

- [KEYWORD-PRIORITIZATION-ALGORITHMS.md](../../.planning/research/KEYWORD-PRIORITIZATION-ALGORITHMS.md) — Detailed scoring formulas
- [KEYWORD-CONSTRAINT-ENGINE.md](../../.planning/research/KEYWORD-CONSTRAINT-ENGINE.md) — Full constraint engine spec
- [POSITION-TRACKING-SYSTEM.md](../../.planning/research/POSITION-TRACKING-SYSTEM.md) — Position tracking for quick wins

---

## Summary

**Input:** 100-1000 raw keywords from discovery

**Stage 1 (Constraints):** Apply client agreement rules → 40% pass

**Stage 2 (Feasibility):** Score for THIS client's ability to rank → Keep achievable ones

**Stage 3 (Category Mapping):** Map to site taxonomy, detect issues → Organized by category

**Stage 4 (Priority):** Rank by opportunity × feasibility → Quick wins first

**Output:** 50-200 actionable keywords grouped by category, ready for client approval
