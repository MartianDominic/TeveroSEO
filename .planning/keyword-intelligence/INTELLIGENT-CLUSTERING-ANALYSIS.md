# Intelligent Keyword Clustering: Beyond Pure HDBSCAN

> **Version:** 1.0  
> **Created:** 2026-05-05  
> **Status:** Analysis Complete, Ready for Implementation  
> **Author:** Technical Architecture Analysis

---

## Table of Contents

1. [What's Wrong with Pure HDBSCAN](#1-whats-wrong-with-pure-hdbscan)
2. [What Would Intelligent Classification Look Like](#2-what-would-intelligent-classification-look-like)
3. [Concrete Architecture Proposal](#3-concrete-architecture-proposal)
4. [Agency-Specific Requirements](#4-agency-specific-requirements)
5. [Implementation Recommendation](#5-implementation-recommendation)

---

## 1. What's Wrong with Pure HDBSCAN

### The Fundamental Problem

HDBSCAN operates on a single principle: **density-based clustering in embedding space**. Keywords that are close in embedding space get grouped together. This is mathematically elegant but semantically naive for SEO.

### Failure Mode Analysis

#### Failure Mode 1: Semantically Similar, SEO-Incompatible

**Example: Intent Mismatch**

```
Keywords (all cluster together due to embedding similarity):
- "what is keyword clustering" (informational)
- "keyword clustering tool free" (transactional)
- "best keyword clustering software 2024" (commercial investigation)
- "how to cluster keywords manually" (informational/DIY)

HDBSCAN result: Single cluster "Keyword Clustering"
SEO reality: These need 3 different pages:
  1. Blog post answering "what is"
  2. Tool landing page for "tool free"
  3. Comparison page for "best...software"
```

**Why this hurts agencies:** The deliverable shows one content silo with 4 keywords. Client creates one page, ranks for none because Google serves different intent per query.

#### Failure Mode 2: Semantically Different, Should Be Clustered

**Example: Synonym Blindness**

```
Keywords that HDBSCAN separates:
Cluster A: "SEO audit checklist", "website SEO analysis"
Cluster B: "technical SEO review", "site health check"
Cluster C: "SEO site inspection", "website optimization audit"

SEO reality: All these are the SAME landing page opportunity.
User searching any of these wants: a comprehensive SEO audit service.
```

**Why embeddings fail:** Multilingual models weight lexical overlap heavily. "audit" and "review" have different vectors despite identical search intent.

#### Failure Mode 3: Funnel Stage Blindness

**Example: BOFU/TOFU Collision**

```
HDBSCAN clusters by topic "Car Insurance":
- "what is car insurance" (TOFU - awareness)
- "car insurance quotes" (BOFU - decision)
- "best car insurance companies" (MOFU - consideration)
- "car insurance near me" (BOFU - decision)

All clustered together because "car insurance" dominates the embedding.
```

**Agency impact:** Client targets "car insurance" cluster with one pillar page. Ranks for none because:
- TOFU queries need educational content
- BOFU queries need quote calculators
- MOFU queries need comparison tables

#### Failure Mode 4: Geographic Pollution

**Example: Location Mixing**

```
HDBSCAN cluster "Plumber Services":
- "plumber vilnius" (target city)
- "plumber kaunas" (competitor city)
- "plumber services" (generic)
- "emergency plumber siauliai" (wrong city)

All semantically similar, all clustered together.
```

**Agency impact:** Local SEO strategy ruined. Client in Vilnius gets keyword list that includes competitor cities.

#### Failure Mode 5: Commercial Value Blindness

**Example: Revenue Mismatch**

```
HDBSCAN cluster "Laptop Reviews":
- "laptop reviews" (CPC: $0.50, low intent)
- "buy gaming laptop" (CPC: $12.00, high intent)
- "best laptop deals" (CPC: $8.00, high intent)
- "laptop comparison chart" (CPC: $0.30, low intent)

All clustered together. No signal about which keywords drive revenue.
```

**Agency impact:** Content strategy doesn't prioritize high-value keywords. Client publishes "laptop comparison chart" article, misses "buy gaming laptop" opportunity.

### Summary: Why Pure HDBSCAN Fails for SEO

| Limitation | Impact on Agency Deliverables |
|------------|-------------------------------|
| No intent awareness | Wrong content type recommendations |
| No funnel understanding | TOFU/MOFU/BOFU pages conflated |
| No geographic filtering | Local SEO strategies polluted |
| No business value signal | Low-ROI keywords prioritized |
| No hierarchy awareness | Flat clusters instead of topic trees |
| No seasonal detection | Static recommendations for dynamic queries |
| No brand/generic split | Brand terms mixed with generic opportunities |

---

## 2. What Would Intelligent Classification Look Like

### Multi-Signal Classification Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    INTELLIGENT KEYWORD CLASSIFICATION SYSTEM                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  INPUT: 1000 keywords + DataForSEO metrics                                      │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: SIGNAL EXTRACTION (Parallel, Deterministic)                   │   │
│  │  ───────────────────────────────────────────────────────────────────── │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│  │  │ Embedding    │ │ Intent       │ │ Funnel       │ │ Geographic   │   │   │
│  │  │ Generator    │ │ Classifier   │ │ Classifier   │ │ Extractor    │   │   │
│  │  │ (Jina v5)    │ │ (Pattern+LLM)│ │ (Rules+LLM)  │ │ (City DB)    │   │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│  │  │ Query Type   │ │ Modifier     │ │ Value        │ │ Seasonality  │   │   │
│  │  │ Detector     │ │ Extractor    │ │ Scorer       │ │ Detector     │   │   │
│  │  │ (Question?)  │ │ (best, free) │ │ (Vol*CPC)    │ │ (Trend API)  │   │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                           │                                                      │
│                           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: PRIMARY CLUSTERING (HDBSCAN on Embeddings)                    │   │
│  │  ───────────────────────────────────────────────────────────────────── │   │
│  │  Raw clusters based on semantic similarity                               │   │
│  │  Output: ~30-50 raw clusters from 1000 keywords                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                           │                                                      │
│                           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: CLUSTER REFINEMENT (LLM-Powered)                              │   │
│  │  ───────────────────────────────────────────────────────────────────── │   │
│  │  1. SPLIT clusters with mixed intents (info + transactional)            │   │
│  │  2. MERGE clusters that represent same landing page opportunity         │   │
│  │  3. FILTER clusters by geographic constraints                           │   │
│  │  4. LABEL clusters with SEO-appropriate names                           │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                           │                                                      │
│                           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 4: HIERARCHY CONSTRUCTION                                         │   │
│  │  ───────────────────────────────────────────────────────────────────── │   │
│  │  1. Identify parent clusters (pillar pages)                              │   │
│  │  2. Link child clusters (supporting content)                             │   │
│  │  3. Detect pSEO patterns (city variants, product variants)              │   │
│  │  4. Build internal linking graph                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                           │                                                      │
│                           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 5: ENRICHMENT & PRIORITIZATION                                    │   │
│  │  ───────────────────────────────────────────────────────────────────── │   │
│  │  1. Assign target keyword per cluster (highest volume, achievable)      │   │
│  │  2. Calculate cluster priority score                                     │   │
│  │  3. Generate content type recommendation                                 │   │
│  │  4. Identify quick wins vs. long-term plays                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  OUTPUT: Hierarchical clusters with labels, intent, funnel, target KW          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Signal Definitions

#### Intent Signals

| Intent Type | Pattern Indicators | DataForSEO Signal | Content Type |
|-------------|-------------------|-------------------|--------------|
| Informational | "what is", "how to", "why", "guide" | intent=0 | Blog post, guide |
| Navigational | Brand names, "login", "official" | intent=1 | Landing page |
| Commercial | "best", "vs", "review", "compare" | intent=2 | Comparison, review |
| Transactional | "buy", "price", "near me", "shop" | intent=3 | Product/service page |

#### Funnel Signals

| Stage | Indicators | SEO Strategy |
|-------|-----------|--------------|
| TOFU (Awareness) | Question queries, "what is", educational | Blog content, attract links |
| MOFU (Consideration) | "best", "vs", comparison queries | Comparison pages, capture emails |
| BOFU (Decision) | "buy", "price", location queries | Landing pages, conversion focus |

#### Value Signals

```python
# Business value score formula
value_score = (
    log10(search_volume + 1) *           # Volume weight (log scale)
    cpc *                                 # Commercial intent signal
    (1 - keyword_difficulty / 100) *      # Achievability
    intent_multiplier[intent]             # Intent weights: transactional > commercial > info
)

# Intent multipliers
intent_multiplier = {
    "transactional": 2.0,
    "commercial": 1.5,
    "navigational": 0.5,
    "informational": 1.0
}
```

### Handling Multi-Cluster Keywords

Some keywords legitimately belong to multiple clusters:

```
"best organic shampoo for dandruff"
├── Topic Cluster: Shampoo Products
├── Problem Cluster: Dandruff Solutions
└── Attribute Cluster: Organic Hair Care
```

**Solution: Primary + Secondary Assignment**

```python
@dataclass
class KeywordAssignment:
    keyword: str
    primary_cluster: str           # Main content home
    secondary_clusters: list[str]  # Internal linking targets
    overlap_score: float           # How strongly it belongs to multiple
    linking_recommendation: str    # "Link from X to Y"
```

### LLM's Role in Cluster Refinement

LLM reasoning is most valuable for:

1. **Cluster Merging Decisions**: "Should 'SEO audit' and 'website health check' clusters merge?"
2. **Intent Disambiguation**: "Is 'keyword clustering' informational or transactional in this context?"
3. **Cluster Naming**: Generate client-presentable labels, not "cluster_7"
4. **Content Type Recommendation**: "This cluster needs a comparison page, not a blog post"
5. **Hierarchy Construction**: "This cluster is a subset of that pillar topic"

**Where LLM should NOT be used:**
- Initial clustering (too expensive at 1000 keywords)
- Pattern matching (deterministic rules are faster)
- Geographic extraction (database lookup is cheaper)
- Volume/CPC scoring (pure arithmetic)

---

## 3. Concrete Architecture Proposal

### Input Schema

```typescript
interface KeywordInput {
  keyword: string;
  search_volume: number;
  keyword_difficulty: number;
  cpc: number;
  intent: "informational" | "navigational" | "commercial" | "transactional";
  serp_features: string[];  // "featured_snippet", "local_pack", etc.
  trend_data?: number[];    // Monthly search volumes for seasonality
}

interface AnalysisConstraints {
  target_cities?: string[];      // For local SEO filtering
  exclude_cities?: string[];
  business_type: string;         // "hair salon", "e-commerce", etc.
  focus_categories?: string[];   // Optional category focus
  min_volume?: number;           // Filter threshold
  max_clusters?: number;         // Target cluster count
}
```

### Output Schema

```typescript
interface IntelligentCluster {
  id: string;
  label: string;                      // "Organic Hair Care Products"
  slug: string;                       // "organic-hair-care"
  
  // Keywords
  target_keyword: string;             // Highest value, achievable
  keywords: KeywordWithMetrics[];
  keyword_count: number;
  
  // Classification
  primary_intent: Intent;
  funnel_stage: "TOFU" | "MOFU" | "BOFU";
  content_type: ContentType;
  
  // Hierarchy
  parent_cluster_id?: string;
  child_cluster_ids: string[];
  hierarchy_level: 1 | 2 | 3;         // 1=pillar, 2=subtopic, 3=long-tail
  
  // Metrics
  total_volume: number;
  avg_difficulty: number;
  estimated_value: number;            // Composite score
  priority: "HIGH" | "MEDIUM" | "LOW";
  
  // Agency deliverables
  recommended_url: string;            // "/services/organic-hair-care"
  internal_links: InternalLink[];     // Links to/from other clusters
  content_brief_outline: string[];    // Key sections to cover
  
  // Explanation
  why_grouped: string;                // "These keywords share commercial intent for organic products"
  why_separated?: string;             // If split from another cluster
}

interface ContentType {
  type: "pillar_page" | "blog_post" | "comparison" | "product_page" | "landing_page" | "pseo_template";
  template_suggestion?: string;       // For pSEO
}

interface InternalLink {
  target_cluster_id: string;
  relationship: "parent" | "child" | "sibling" | "related";
  anchor_text_suggestion: string;
}
```

### Algorithm Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        INTELLIGENT CLUSTERING PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  STAGE 1: SIGNAL EXTRACTION (Parallel Processing)                ~5 seconds     │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  1a. EMBEDDING GENERATION                                                │  │
│  │      Model: Jina v5-small (1024-dim) or v5-nano (256-dim)               │  │
│  │      Input: 1000 keywords                                                │  │
│  │      Output: 1000 x 1024 matrix                                          │  │
│  │      Cost: ~$0.002 (Jina API) or $0 (self-hosted)                        │  │
│  │      Latency: ~2s for 1000 keywords                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  1b. INTENT + FUNNEL CLASSIFICATION (Pattern-First)                      │  │
│  │      ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │      │  Pattern Matching (800/1000 keywords classified, ~200ms)        │ │  │
│  │      │  - "how to" → informational + TOFU                              │ │  │
│  │      │  - "best X" → commercial + MOFU                                 │ │  │
│  │      │  - "X price" → transactional + BOFU                             │ │  │
│  │      │  - "X near me" → transactional + BOFU                           │ │  │
│  │      └─────────────────────────────────────────────────────────────────┘ │  │
│  │      ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │      │  LLM Batch Classification (200 ambiguous keywords)              │ │  │
│  │      │  Cost: ~$0.01 (Claude Haiku batch)                              │ │  │
│  │      │  Latency: ~2s                                                   │ │  │
│  │      └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  1c. GEOGRAPHIC EXTRACTION                                               │  │
│  │      Database lookup: Lithuanian city variants                           │  │
│  │      Filter: Remove wrong-city keywords based on constraints             │  │
│  │      Cost: $0 (local DB)                                                 │  │
│  │      Latency: ~50ms                                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  1d. VALUE SCORING                                                       │  │
│  │      Formula: log(volume) * CPC * (1 - difficulty/100) * intent_mult     │  │
│  │      Cost: $0 (pure computation)                                         │  │
│  │      Latency: ~10ms                                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  1e. QUERY TYPE DETECTION                                                │  │
│  │      Categories: question, comparison, brand, generic, long-tail, local  │  │
│  │      Method: Pattern matching + n-gram analysis                          │  │
│  │      Cost: $0                                                            │  │
│  │      Latency: ~20ms                                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
│                                                                                  │
│  STAGE 2: PRIMARY CLUSTERING (HDBSCAN)                           ~3 seconds     │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  Parameters:                                                                    │
│  - min_cluster_size: 3 (minimum keywords per cluster)                          │
│  - min_samples: 2                                                               │
│  - metric: cosine                                                               │
│  - cluster_selection_method: leaf (finer clusters)                             │
│                                                                                  │
│  Output: 30-50 raw clusters + noise points                                      │
│  Cost: $0 (CPU computation)                                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
│                                                                                  │
│  STAGE 3: INTENT-BASED CLUSTER SPLITTING                         ~2 seconds     │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  For each cluster with mixed intents:                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  IF cluster has >30% info AND >30% transactional keywords:               │  │
│  │      SPLIT into two clusters by intent                                   │  │
│  │  IF cluster has >40% BOFU AND >40% TOFU keywords:                        │  │
│  │      SPLIT by funnel stage                                               │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Method: Deterministic rules, no LLM needed                                     │
│  Cost: $0                                                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
│                                                                                  │
│  STAGE 4: CLUSTER MERGING (LLM-Assisted)                         ~5 seconds     │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  Find cluster pairs with:                                                       │
│  - High embedding similarity (cosine > 0.85)                                    │
│  - Same intent                                                                  │
│  - Same funnel stage                                                            │
│                                                                                  │
│  LLM Decision Prompt:                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Given these two keyword groups:                                         │  │
│  │  Group A: ["SEO audit", "website SEO analysis", "site SEO check"]        │  │
│  │  Group B: ["technical SEO review", "site health audit"]                  │  │
│  │                                                                           │  │
│  │  Would a single landing page serve both groups well?                     │  │
│  │  Consider: same search intent, same content type, same user need         │  │
│  │                                                                           │  │
│  │  Answer: MERGE or KEEP_SEPARATE with brief reason                        │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Batch: ~5-10 merge decisions per analysis                                      │
│  Cost: ~$0.005 (Claude Haiku)                                                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
│                                                                                  │
│  STAGE 5: HIERARCHY CONSTRUCTION                                 ~3 seconds     │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  Algorithm:                                                                     │
│  1. Sort clusters by total volume (largest = potential pillars)                │
│  2. For each cluster, find parent candidates:                                   │
│     - Embedding similarity > 0.7                                                │
│     - Parent volume > 2x child volume                                           │
│     - Parent is broader in topic scope                                          │
│  3. Build tree structure (max 3 levels)                                         │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Level 1 (Pillars):     "Hair Care" (5000 vol)                           │  │
│  │       │                                                                   │  │
│  │       ├── Level 2:      "Shampoo" (2000 vol)                             │  │
│  │       │       │                                                           │  │
│  │       │       ├── Level 3: "Anti-Dandruff Shampoo" (500 vol)             │  │
│  │       │       └── Level 3: "Organic Shampoo" (400 vol)                   │  │
│  │       │                                                                   │  │
│  │       └── Level 2:      "Hair Dye" (1500 vol)                            │  │
│  │               │                                                           │  │
│  │               └── Level 3: "Professional Hair Color" (300 vol)           │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Cost: $0 (deterministic algorithm)                                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
│                                                                                  │
│  STAGE 6: pSEO PATTERN DETECTION                                 ~1 second      │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  Detect template opportunities:                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Pattern: "[service] [city]"                                             │  │
│  │  Examples: "plumber vilnius", "plumber kaunas", "plumber siauliai"       │  │
│  │  Template: /services/plumber-{city}                                      │  │
│  │  Recommendation: Create pSEO template with 50 city variants              │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Pattern: "[product] for [use-case]"                                     │  │
│  │  Examples: "shampoo for oily hair", "shampoo for dry hair"               │  │
│  │  Template: /products/shampoo-for-{hair-type}                             │  │
│  │  Recommendation: Create pSEO template with 8 hair type variants          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Method: Regex patterns + LCS (longest common substring)                        │
│  Cost: $0                                                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
│                                                                                  │
│  STAGE 7: LABELING + ENRICHMENT (LLM)                            ~5 seconds     │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  For each final cluster (~15-25 clusters):                                      │
│                                                                                  │
│  LLM Prompt (batched):                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  For each keyword cluster, provide:                                      │  │
│  │  1. Client-presentable label (2-4 words)                                 │  │
│  │  2. URL slug suggestion                                                  │  │
│  │  3. Content type recommendation (pillar/blog/comparison/landing)         │  │
│  │  4. Why these keywords are grouped together (1 sentence)                 │  │
│  │  5. Content brief outline (3-5 bullet points)                            │  │
│  │                                                                           │  │
│  │  Cluster 1: ["organic shampoo", "natural hair wash", "eco shampoo"]      │  │
│  │  Target keyword: "organic shampoo" (1200 vol, 45 KD)                     │  │
│  │  Intent: commercial, Funnel: MOFU                                        │  │
│  │                                                                           │  │
│  │  Cluster 2: ["how to wash hair naturally", "natural hair care tips"]     │  │
│  │  Target keyword: "natural hair care tips" (800 vol, 30 KD)               │  │
│  │  Intent: informational, Funnel: TOFU                                     │  │
│  │  ...                                                                     │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  Cost: ~$0.02 (Claude Sonnet for quality, 15-25 clusters)                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
│                                                                                  │
│  STAGE 8: INTERNAL LINKING GRAPH                                 ~1 second      │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  Build linking recommendations:                                                 │
│  - Parent → Child (pillar links to subtopics)                                   │
│  - Sibling ↔ Sibling (related topics cross-link)                                │
│  - TOFU → BOFU (educational content links to conversion pages)                  │
│                                                                                  │
│  Output: Directed graph with anchor text suggestions                            │
│  Cost: $0                                                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
│                                                                                  │
│  TOTAL PIPELINE COST: ~$0.035 per 1000 keywords                                 │
│  TOTAL PIPELINE TIME: ~25 seconds                                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Pseudocode Implementation

```python
# intelligent_clusterer.py

from dataclasses import dataclass
from enum import Enum
import numpy as np
from hdbscan import HDBSCAN

class Intent(Enum):
    INFORMATIONAL = "informational"
    NAVIGATIONAL = "navigational"
    COMMERCIAL = "commercial"
    TRANSACTIONAL = "transactional"

class FunnelStage(Enum):
    TOFU = "tofu"
    MOFU = "mofu"
    BOFU = "bofu"

@dataclass
class EnrichedKeyword:
    keyword: str
    embedding: np.ndarray
    intent: Intent
    funnel_stage: FunnelStage
    query_type: str  # "question", "comparison", "brand", "generic", "local"
    city: str | None
    value_score: float
    volume: int
    difficulty: int
    cpc: float

@dataclass
class IntelligentCluster:
    id: str
    keywords: list[EnrichedKeyword]
    label: str
    slug: str
    target_keyword: EnrichedKeyword
    primary_intent: Intent
    funnel_stage: FunnelStage
    content_type: str
    parent_id: str | None
    child_ids: list[str]
    total_volume: int
    priority: str
    why_grouped: str

class IntelligentClusterer:
    """
    Multi-signal keyword clustering for agency SEO.
    
    Pipeline:
    1. Extract signals (embeddings, intent, funnel, geo, value)
    2. Primary HDBSCAN clustering on embeddings
    3. Split clusters by intent/funnel conflicts
    4. Merge semantically related clusters (LLM-assisted)
    5. Build hierarchy (pillar → subtopic → long-tail)
    6. Detect pSEO patterns
    7. Label and enrich clusters (LLM)
    8. Generate internal linking graph
    """
    
    def __init__(
        self,
        embedding_model,  # Jina v5 or similar
        llm_client,       # Claude API client
        city_database,    # Lithuanian cities with variants
        intent_patterns,  # Regex patterns for intent
        funnel_patterns   # Regex patterns for funnel
    ):
        self.embedding_model = embedding_model
        self.llm = llm_client
        self.cities = city_database
        self.intent_patterns = intent_patterns
        self.funnel_patterns = funnel_patterns
        
        # HDBSCAN configuration
        self.clusterer = HDBSCAN(
            min_cluster_size=3,
            min_samples=2,
            metric="cosine",
            cluster_selection_method="leaf"
        )
    
    async def cluster(
        self,
        keywords: list[dict],
        constraints: dict
    ) -> list[IntelligentCluster]:
        """Main clustering pipeline."""
        
        # Stage 1: Signal extraction (parallel)
        enriched = await self._extract_signals(keywords, constraints)
        
        # Stage 2: Primary HDBSCAN clustering
        raw_clusters = self._primary_clustering(enriched)
        
        # Stage 3: Split by intent/funnel conflicts
        split_clusters = self._split_by_conflicts(raw_clusters)
        
        # Stage 4: Merge related clusters (LLM-assisted)
        merged_clusters = await self._merge_related(split_clusters)
        
        # Stage 5: Build hierarchy
        hierarchical = self._build_hierarchy(merged_clusters)
        
        # Stage 6: Detect pSEO patterns
        with_pseo = self._detect_pseo_patterns(hierarchical)
        
        # Stage 7: Label and enrich (LLM)
        enriched_clusters = await self._label_clusters(with_pseo)
        
        # Stage 8: Generate linking graph
        final = self._generate_links(enriched_clusters)
        
        return final
    
    async def _extract_signals(
        self,
        keywords: list[dict],
        constraints: dict
    ) -> list[EnrichedKeyword]:
        """Extract all signals in parallel."""
        
        # 1a. Generate embeddings (batch)
        texts = [kw["keyword"] for kw in keywords]
        embeddings = self.embedding_model.encode(texts)
        
        # 1b. Intent + funnel classification
        intents, funnels = self._classify_intent_funnel(keywords)
        
        # 1c. Geographic extraction
        cities = self._extract_cities(keywords, constraints)
        
        # 1d. Value scoring
        values = self._compute_values(keywords)
        
        # 1e. Query type detection
        query_types = self._detect_query_types(keywords)
        
        # Combine into enriched keywords
        enriched = []
        for i, kw in enumerate(keywords):
            enriched.append(EnrichedKeyword(
                keyword=kw["keyword"],
                embedding=embeddings[i],
                intent=intents[i],
                funnel_stage=funnels[i],
                query_type=query_types[i],
                city=cities[i],
                value_score=values[i],
                volume=kw["search_volume"],
                difficulty=kw["keyword_difficulty"],
                cpc=kw.get("cpc", 0)
            ))
        
        return enriched
    
    def _primary_clustering(
        self,
        keywords: list[EnrichedKeyword]
    ) -> list[list[EnrichedKeyword]]:
        """HDBSCAN clustering on embeddings."""
        
        embeddings = np.array([kw.embedding for kw in keywords])
        labels = self.clusterer.fit_predict(embeddings)
        
        # Group by cluster
        clusters = {}
        for kw, label in zip(keywords, labels):
            if label == -1:
                continue  # Skip noise
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(kw)
        
        return list(clusters.values())
    
    def _split_by_conflicts(
        self,
        clusters: list[list[EnrichedKeyword]]
    ) -> list[list[EnrichedKeyword]]:
        """Split clusters with intent/funnel conflicts."""
        
        result = []
        
        for cluster in clusters:
            # Check intent distribution
            intent_counts = {}
            for kw in cluster:
                intent_counts[kw.intent] = intent_counts.get(kw.intent, 0) + 1
            
            # If >30% info AND >30% transactional, split
            total = len(cluster)
            info_pct = intent_counts.get(Intent.INFORMATIONAL, 0) / total
            trans_pct = intent_counts.get(Intent.TRANSACTIONAL, 0) / total
            
            if info_pct > 0.3 and trans_pct > 0.3:
                # Split by intent
                info_cluster = [kw for kw in cluster if kw.intent == Intent.INFORMATIONAL]
                trans_cluster = [kw for kw in cluster if kw.intent == Intent.TRANSACTIONAL]
                other = [kw for kw in cluster if kw.intent not in [Intent.INFORMATIONAL, Intent.TRANSACTIONAL]]
                
                if info_cluster:
                    result.append(info_cluster)
                if trans_cluster:
                    result.append(trans_cluster)
                if other:
                    result.append(other)
            else:
                result.append(cluster)
        
        return result
    
    async def _merge_related(
        self,
        clusters: list[list[EnrichedKeyword]]
    ) -> list[list[EnrichedKeyword]]:
        """Merge clusters that represent same landing page opportunity."""
        
        # Compute cluster centroids
        centroids = []
        for cluster in clusters:
            centroid = np.mean([kw.embedding for kw in cluster], axis=0)
            centroids.append(centroid)
        
        # Find merge candidates (high similarity, same intent)
        merge_candidates = []
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                # Compute cosine similarity
                sim = np.dot(centroids[i], centroids[j]) / (
                    np.linalg.norm(centroids[i]) * np.linalg.norm(centroids[j])
                )
                
                if sim > 0.85:
                    # Check intent match
                    intent_i = self._dominant_intent(clusters[i])
                    intent_j = self._dominant_intent(clusters[j])
                    
                    if intent_i == intent_j:
                        merge_candidates.append((i, j, sim))
        
        # LLM decision for each candidate
        merge_decisions = {}
        for i, j, sim in merge_candidates:
            # Get sample keywords for LLM
            sample_i = [kw.keyword for kw in clusters[i][:5]]
            sample_j = [kw.keyword for kw in clusters[j][:5]]
            
            decision = await self._llm_merge_decision(sample_i, sample_j)
            if decision == "MERGE":
                merge_decisions[(i, j)] = True
        
        # Execute merges
        merged = set()
        result = []
        
        for i, cluster in enumerate(clusters):
            if i in merged:
                continue
            
            # Check if this cluster should merge with another
            for (a, b), should_merge in merge_decisions.items():
                if should_merge and a == i:
                    cluster = cluster + clusters[b]
                    merged.add(b)
            
            result.append(cluster)
        
        return result
    
    def _build_hierarchy(
        self,
        clusters: list[list[EnrichedKeyword]]
    ) -> list[dict]:
        """Build parent-child hierarchy based on volume and semantic containment."""
        
        # Sort by total volume (largest first = potential pillars)
        clusters_with_volume = [
            (cluster, sum(kw.volume for kw in cluster))
            for cluster in clusters
        ]
        clusters_with_volume.sort(key=lambda x: -x[1])
        
        # Build hierarchy
        hierarchy = []
        for i, (cluster, volume) in enumerate(clusters_with_volume):
            centroid = np.mean([kw.embedding for kw in cluster], axis=0)
            
            node = {
                "id": f"cluster_{i}",
                "keywords": cluster,
                "volume": volume,
                "centroid": centroid,
                "parent_id": None,
                "child_ids": [],
                "level": 1
            }
            
            # Find potential parent (larger cluster with high similarity)
            for parent in hierarchy:
                if parent["volume"] > volume * 2:  # Parent must be 2x larger
                    sim = np.dot(centroid, parent["centroid"]) / (
                        np.linalg.norm(centroid) * np.linalg.norm(parent["centroid"])
                    )
                    
                    if sim > 0.7:  # Semantic containment threshold
                        node["parent_id"] = parent["id"]
                        node["level"] = parent["level"] + 1
                        parent["child_ids"].append(node["id"])
                        break
            
            hierarchy.append(node)
        
        return hierarchy
```

### Component File Structure

```
open-seo-main/src/server/features/keywords/
├── clustering/
│   ├── index.ts                     # Public API
│   ├── IntelligentClusterer.ts      # Main orchestrator
│   ├── signals/
│   │   ├── EmbeddingGenerator.ts    # Jina v5 integration
│   │   ├── IntentClassifier.ts      # Pattern + LLM fallback
│   │   ├── FunnelClassifier.ts      # BOFU/MOFU/TOFU
│   │   ├── GeoExtractor.ts          # City detection
│   │   ├── ValueScorer.ts           # Volume * CPC formula
│   │   └── QueryTypeDetector.ts     # Question, comparison, etc.
│   ├── algorithms/
│   │   ├── HDBSCANClustering.ts     # Primary clustering
│   │   ├── IntentSplitter.ts        # Split by intent conflicts
│   │   ├── ClusterMerger.ts         # LLM-assisted merging
│   │   ├── HierarchyBuilder.ts      # Pillar → subtopic tree
│   │   └── pSEODetector.ts          # Template patterns
│   ├── enrichment/
│   │   ├── ClusterLabeler.ts        # LLM naming
│   │   ├── ContentTypeRecommender.ts
│   │   └── LinkingGraphBuilder.ts   # Internal link suggestions
│   └── types.ts                     # Shared interfaces
```

### Cost Analysis

| Stage | Model/Method | Cost per 1000 Keywords |
|-------|--------------|------------------------|
| Embedding generation | Jina v5-small API | $0.002 |
| Intent classification (200 ambiguous) | Claude Haiku | $0.010 |
| Merge decisions (~10 pairs) | Claude Haiku | $0.005 |
| Cluster labeling (20 clusters) | Claude Sonnet | $0.020 |
| **Total LLM cost** | | **$0.037** |
| Embedding (self-hosted Jina) | Local GPU | $0.000 |
| **Total with self-hosted embeddings** | | **$0.035** |

**At scale:**
- 100 analyses/month: $3.50
- 1000 analyses/month: $35.00

---

## 4. Agency-Specific Requirements

### Requirement 1: Clusters Map to Content Silos

Each cluster must represent a single page opportunity:

```typescript
interface ContentSilo {
  pillarPage: {
    cluster: IntelligentCluster;
    recommendedUrl: string;        // "/services/hair-care"
    contentType: "pillar";
    targetKeyword: string;
    supportingKeywords: string[];
  };
  
  supportingPages: {
    cluster: IntelligentCluster;
    recommendedUrl: string;        // "/services/hair-care/shampoo"
    contentType: "subtopic" | "blog" | "comparison";
    linkToParent: boolean;
  }[];
}
```

### Requirement 2: Clear Target Keyword Selection

Each cluster needs a primary target keyword:

```python
def select_target_keyword(cluster: list[EnrichedKeyword]) -> EnrichedKeyword:
    """
    Select the best target keyword for a cluster.
    
    Criteria (weighted):
    1. Achievable difficulty (<60 for most clients)
    2. Decent volume (higher is better)
    3. Matches cluster intent
    4. Not too long-tail (2-4 words ideal)
    """
    
    candidates = [
        kw for kw in cluster
        if kw.difficulty < 60  # Achievability filter
        and len(kw.keyword.split()) <= 4  # Not too long-tail
    ]
    
    if not candidates:
        candidates = cluster  # Fallback to all
    
    # Score each candidate
    def score(kw: EnrichedKeyword) -> float:
        return (
            np.log10(kw.volume + 1) *           # Volume (log scale)
            (1 - kw.difficulty / 100) *          # Achievability
            (1 if kw.intent in [Intent.COMMERCIAL, Intent.TRANSACTIONAL] else 0.8)  # Intent bonus
        )
    
    return max(candidates, key=score)
```

### Requirement 3: Internal Linking Opportunities

```typescript
interface InternalLinkingPlan {
  fromCluster: string;        // "organic-shampoo"
  toCluster: string;          // "hair-care" (pillar)
  relationship: "child_to_parent" | "sibling" | "tofu_to_bofu";
  
  anchorTextSuggestions: string[];  // ["hair care products", "our hair care range"]
  
  // Where in the content to add the link
  contextSuggestion: string;  // "In the intro paragraph, when discussing..."
}
```

### Requirement 4: Client-Presentable Labels

Labels must be:
1. **Concise**: 2-4 words
2. **Professional**: No technical jargon
3. **Action-oriented**: Suggest the content topic
4. **Consistent**: Match client's brand voice

```python
LABELING_PROMPT = """
You are naming content topics for an SEO agency's client deliverable.

For each keyword cluster, provide a label that:
1. Is 2-4 words
2. Clearly indicates the topic
3. Would make sense in a content calendar
4. Matches the style of these existing categories: {existing_labels}

Cluster keywords: {keywords}
Dominant intent: {intent}
Funnel stage: {funnel}

Provide:
- label: The main label
- slug: URL-friendly version
- why: One sentence explaining the grouping (for client)
"""
```

### Requirement 5: Grouping Explanations

Every cluster must have a `why_grouped` explanation:

```json
{
  "cluster_id": "organic-hair-care",
  "label": "Organic Hair Care Products",
  "why_grouped": "These keywords share commercial intent for natural and organic hair products, targeting customers who prioritize eco-friendly and chemical-free options.",
  "why_not_merged": "Separated from 'General Hair Care' because organic-focused customers have distinct needs and expect dedicated product pages."
}
```

---

## 5. Implementation Recommendation

### Changes to Phase 86 (Semantic Intelligence)

**Current Phase 86 scope (assumed):**
- HDBSCAN clustering on Jina embeddings
- Basic cluster output

**Recommended additions:**

| Addition | Effort | Priority |
|----------|--------|----------|
| Intent/Funnel signal extraction | 4 hours | HIGH |
| Intent-based cluster splitting | 2 hours | HIGH |
| LLM-assisted cluster merging | 4 hours | MEDIUM |
| Hierarchy construction | 3 hours | HIGH |
| pSEO pattern detection | 2 hours | MEDIUM |
| LLM cluster labeling | 3 hours | HIGH |
| Internal linking graph | 2 hours | MEDIUM |
| Agency-ready output format | 2 hours | HIGH |

**Total additional effort:** ~22 hours

### New Components Required

| Component | File | Purpose |
|-----------|------|---------|
| IntentClassifier | `IntentClassifier.ts` | Pattern + LLM intent detection |
| FunnelClassifier | `FunnelClassifier.ts` | BOFU/MOFU/TOFU classification |
| ValueScorer | `ValueScorer.ts` | Volume * CPC * achievability |
| IntentSplitter | `IntentSplitter.ts` | Split mixed-intent clusters |
| ClusterMerger | `ClusterMerger.ts` | LLM-assisted merge decisions |
| HierarchyBuilder | `HierarchyBuilder.ts` | Build pillar → subtopic tree |
| pSEODetector | `pSEODetector.ts` | Detect template patterns |
| ClusterLabeler | `ClusterLabeler.ts` | LLM naming + explanations |
| LinkingGraphBuilder | `LinkingGraphBuilder.ts` | Internal link suggestions |

### Integration with Existing Jina Embeddings

The existing Jina embedding service in Phase 78 (Relevance Scoring) should be extended:

```typescript
// Extend existing EmbeddingService
interface EmbeddingService {
  // Existing
  embedKeywords(keywords: string[]): Promise<number[][]>;
  computeSimilarity(a: number[], b: number[]): number;
  
  // New for clustering
  batchEmbedWithCache(keywords: string[], clientId: string): Promise<Map<string, number[]>>;
  computeClusterCentroid(embeddings: number[][]): number[];
}
```

### Cost/Latency Tradeoffs

| Configuration | Quality | Cost/1000 KW | Latency |
|---------------|---------|--------------|---------|
| Full pipeline (recommended) | Excellent | $0.035 | ~25s |
| Skip merge decisions | Good | $0.030 | ~20s |
| Skip LLM labeling (use heuristics) | Acceptable | $0.015 | ~15s |
| Pure HDBSCAN (current) | Poor | $0.002 | ~8s |

**Recommendation:** Use full pipeline for client deliverables, skip merge for internal analysis.

### Rollout Plan

**Phase 86-A (Foundation):** 2 days
- Intent/Funnel classifiers
- Value scoring
- Integration with existing HDBSCAN

**Phase 86-B (Intelligence):** 3 days
- Intent-based splitting
- LLM-assisted merging
- Hierarchy construction

**Phase 86-C (Agency Polish):** 2 days
- LLM cluster labeling
- pSEO detection
- Internal linking graph
- Agency-ready export format

---

## Appendix: Intent Pattern Library

```typescript
const INTENT_PATTERNS = {
  informational: [
    /^what (is|are|was|were)/i,
    /^how (to|do|does|can|should)/i,
    /^why (do|does|is|are)/i,
    /^when (to|should|do|does)/i,
    /^where (to|can|do|does)/i,
    /guide$/i,
    /tutorial$/i,
    /^learn/i,
    /explained$/i,
    /definition$/i,
    /meaning$/i,
    /examples?$/i,
  ],
  
  transactional: [
    /^buy/i,
    /^order/i,
    /^purchase/i,
    /\bprice\b/i,
    /\bpricing\b/i,
    /\bcost\b/i,
    /\bcheap\b/i,
    /\bdiscount\b/i,
    /\bdeal\b/i,
    /\bnear me\b/i,
    /\bin \w+$/i,  // "plumber in vilnius"
    /\bfor sale\b/i,
    /\bshop\b/i,
    /\bstore\b/i,
  ],
  
  commercial: [
    /^best/i,
    /^top \d+/i,
    /\bvs\b/i,
    /\bversus\b/i,
    /\bcompare\b/i,
    /\bcomparison\b/i,
    /\breview\b/i,
    /\breviews\b/i,
    /\balternative\b/i,
    /\balternatives\b/i,
    /\brating\b/i,
    /\brated\b/i,
  ],
  
  navigational: [
    /\blogin\b/i,
    /\bsign in\b/i,
    /\bdownload\b/i,
    /\bofficial\b/i,
    /\bwebsite\b/i,
    // Brand names detected separately via NER
  ],
};

const FUNNEL_PATTERNS = {
  bofu: [
    /^buy/i,
    /\bprice\b/i,
    /\bnear me\b/i,
    /\bquote\b/i,
    /\bhire\b/i,
    /\bbook\b/i,
    /\bschedule\b/i,
    /\bcontact\b/i,
    /\bget\b.*\bquote\b/i,
    /\bfree (trial|demo)\b/i,
  ],
  
  mofu: [
    /^best/i,
    /\bvs\b/i,
    /\bcompare\b/i,
    /\breview\b/i,
    /\balternative\b/i,
    /\bpros (and|&) cons\b/i,
    /\bfeatures\b/i,
    /\bbenefits\b/i,
  ],
  
  tofu: [
    /^what (is|are)/i,
    /^how (to|do)/i,
    /^why/i,
    /\bguide\b/i,
    /\btutorial\b/i,
    /\btips\b/i,
    /\bexamples?\b/i,
    /\bbasics?\b/i,
    /\bintroduction\b/i,
    /\bbeginners?\b/i,
  ],
};
```

---

## Summary

Pure HDBSCAN clustering fails for agency SEO because it only considers embedding similarity, ignoring:
- Search intent (informational vs. transactional)
- Funnel stage (awareness vs. decision)
- Business value (volume * CPC * achievability)
- Geographic constraints
- Content type requirements
- Hierarchy needs (pillar → subtopic)

The proposed intelligent clustering system adds:
1. **Multi-signal extraction** (intent, funnel, geo, value)
2. **Intent-based splitting** (separate info from transactional)
3. **LLM-assisted merging** (combine synonym clusters)
4. **Hierarchy construction** (pillar → subtopic tree)
5. **pSEO detection** (template opportunities)
6. **Agency-ready output** (labels, explanations, linking)

**Cost:** ~$0.035 per 1000 keywords (acceptable for agency pricing)
**Latency:** ~25 seconds (acceptable for async processing)
**Quality:** Clusters map 1:1 to content silos with clear target keywords

Implement as Phase 86-A/B/C extension over ~7 days.
