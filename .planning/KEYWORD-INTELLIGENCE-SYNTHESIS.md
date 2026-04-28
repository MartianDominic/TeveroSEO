# Keyword Intelligence System: World-Class Architecture Synthesis

> **Generated:** 2026-04-26  
> **Sources:** `docs/infra-research/cpu-only-rag-graph.md`, `docs/infra-research/crawling-10-5000-tasks-day.md`, `.planning/keyword-intelligence/` (18 documents)  
> **Analysis Method:** 5 Opus deep-dive agents synthesized into unified architecture

---

## Executive Summary

This document synthesizes the infrastructure research documents with the keyword intelligence planning documents to deliver a **world-class keyword analysis solution for Lithuanian e-commerce businesses**. The architecture is designed for **focused e-commerce** (200-500 products, 15-30 categories) rather than Amazon-scale deployments.

### The Core Insight

**60-70% of keyword research tasks should never touch your crawler.** The infrastructure research explicitly states this, yet the initial planning documents assumed crawling everything. This single architectural decision drives a **10x cost reduction** on the majority of workloads.

### Key Numbers

| Metric | Value |
|--------|-------|
| Infrastructure cost | $49/month (fits $50 budget) |
| Per-client cost at 100 clients | $3.49/month |
| Per-client cost at 1000 clients | $0.85/month |
| Cache hit rate at 1000 clients | 95% |
| Classification cost per keyword (cached) | $0.00008 |
| Delta crawl savings | 65-80% fetches eliminated |
| Implementation time | ~20 hours |

---

## Part 1: Gap Analysis Between Infrastructure & Planning

### Critical Alignment Areas (GOOD)

The infrastructure research and planning documents agree on foundational choices:

| Technology | Infrastructure Doc | Planning Docs | Status |
|------------|-------------------|---------------|--------|
| Crawler | Crawlee 1.6 + aiohttp hybrid (83 pages/sec) | Same | Aligned |
| Graph storage | FalkorDB 4.14 (Redis module) | FalkorDB + NetworkX | Aligned |
| Vector DB | PostgreSQL 17 + pgvector 0.8 + DiskANN | Same | Aligned |
| GraphRAG | LightRAG v1.4.10 (100 tokens/query) | Same | Aligned |
| LLM | GPT-4o-mini for indexing | Claude Sonnet 4.6 for classification | Aligned (different tasks) |

### Critical Gaps Found (10 Issues)

| # | Gap | Severity | Resolution |
|---|-----|----------|------------|
| 1 | Content hash includes price (defeats delta detection) | **Critical** | Split into `seo_content_hash` + `inventory_hash` |
| 2 | Embedding dimension mismatch (384/768/1024/1536) | High | Unified to jina-v3 @ 384-dim via Matryoshka |
| 3 | Wrong Lithuanian morphology library (spaCy vs Stanza) | High | Use Stanza with 100+ domain-specific patterns |
| 4 | Missing cookie consent/bot challenge detection | Critical | Add `PageValidator` with 25+ signatures |
| 5 | FalkorDB vs AGE decision unclear | Medium | FalkorDB for catalog, NetworkX for LightRAG |
| 6 | Task decomposition not reflected (60-70% API-first) | High | Add `TaskRouter` to route to DataForSEO |
| 7 | Singleflight pattern implementation missing | High | Redis SET NX EX + pub/sub with subscribe-before-recheck |
| 8 | Cold start cost unknown | Medium | Documented: $0.50 first client, $0.025 at 1000 |
| 9 | LightRAG vs classification cost confusion | Medium | Clarified: indexing is one-time, classification is per-run |
| 10 | No graceful degradation | Medium | Circuit breakers + cascading fallbacks |

### Gap #1 Detail: Content Hash Breaking Delta Detection

**The Problem:**
The infrastructure doc explicitly warns:
> "Trafilatura and readability-lxml are not safe for e-commerce delta detection — they extract the price block as part of 'main content' and your SHA256 changes constantly"

But the planning code hashes price into content:
```python
content = f"{name}|{price}|{sku}|{brand_canonical}|{description}"
content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
```

**Impact:** Every price change triggers false "modified" — defeats 65-80% cache savings.

**Solution:** Create two hashes:
```python
# SEO content hash - EXCLUDES price/stock (stable, for delta crawling)
seo_parts = [name, description, '|'.join(categories), brand]
seo_hash = hashlib.sha256('|'.join(seo_parts).encode()).hexdigest()[:16]

# Inventory hash - ONLY price/stock (volatile, for inventory tracking)
inv_parts = [str(price), str(in_stock), sku]
inv_hash = hashlib.sha256('|'.join(inv_parts).encode()).hexdigest()[:16]
```

### Gap #7 Detail: Singleflight Pattern

**The Problem:**
The crawling doc provides working Redis singleflight code, but the keyword intelligence system only mentions it conceptually.

**Critical Implementation Detail (from infra doc):**
```python
# WRONG: SETNX followed by EXPIRE is non-atomic
redis.setnx(key, value)
redis.expire(key, ttl)  # Race condition!

# RIGHT: Single atomic command
redis.set(key, value, nx=True, ex=ttl)  # Or Lua script
```

**Subscribe-Before-Recheck Pattern:**
```python
pubsub = redis.pubsub()
await pubsub.subscribe(chan)              # subscribe BEFORE recheck
cached = await redis.get(rkey)            # recheck AFTER subscribe
if cached:
    return cached
# Now wait for pub/sub notification
```

This prevents lost wakeups when the leader completes between your cache check and subscription.

---

## Part 2: Architecture Decisions (ADR Format)

### ADR-001: Graph Storage Strategy

**Decision:** Use FalkorDB for product catalog graphs, NetworkX for LightRAG entity graphs.

| Component | Technology | Isolation | Use Case |
|-----------|------------|-----------|----------|
| Product Catalog Graph | FalkorDB 4.14 | Graph-per-tenant (`kg:{tenant_id}`) | Keyword classification, 1-3 hop traversals |
| LightRAG Entity Graph | NetworkX + NanoVectorDB | Per-tenant working directory | Entity extraction, GraphRAG queries |
| Vector Storage | PostgreSQL 17 + pgvector 0.8 + DiskANN | Single table with `tenant_id` filter | 100M vectors, multi-tenant search |

**Rationale:**
- FalkorDB: GraphBLAS sparse-matrix execution delivers **sub-10ms traversals** for 10k-node graphs
- NetworkX for LightRAG: Sufficient for <50k entities per tenant, simpler than PostgreSQL + AGE
- **NOT Apache AGE:** 1-3 hop traversals run 20-200ms (3-5x slower than FalkorDB)

**Critical Config:**
```python
# FalkorDB NODE_CREATION_BUFFER must be reduced!
# Default 16,384 reserves matrix slots per graph
# = Multi-GB across 1,000 tenants
NODE_CREATION_BUFFER = 1024  # Down from 16,384
```

### ADR-002: Embedding Model Selection

**Decision:** Use jina-embeddings-v3 with Matryoshka truncation to 384-dim for storage.

| Setting | Value | Rationale |
|---------|-------|-----------|
| Model | `jinaai/jina-embeddings-v3` | Best Lithuanian quality (Cohen's κ 0.62, AUC-ROC 0.887 on LtHate benchmark) |
| Native dimension | 1024 | jina-v3 native output |
| Storage dimension | 384 | Matryoshka truncation for storage efficiency |
| Quantization | INT8 ONNX | CPU-optimized inference |

**Why NOT other models:**
- **EmbeddingGemma:** Despite high MMTEB averages, performs poorly on Lithuanian (outperformed by tiny Potion model)
- **OpenAI text-embedding-3:** "Weak" for Lithuanian per infrastructure doc
- **SPLADE v3:** English-centric, poor fit for Baltic languages

**Throughput:** ~15-25 docs/sec INT8 (vs ~80 docs/sec for e5-base) — acceptable tradeoff for quality.

### ADR-003: Task Routing Strategy

**Decision:** Route 60-70% of tasks to DataForSEO APIs. Crawl only client sites.

| Task Type | Data Source | Cost | Volume % |
|-----------|-------------|------|----------|
| Client site audit | Crawl | $0.024/500 products | 5-10% |
| Competitor keywords | DataForSEO Labs API | $0.01-0.05 | 35-45% |
| SERP analysis | DataForSEO SERP API | $0.006 | 15-20% |
| Backlinks | DataForSEO Backlinks API | $0.02-0.05 | 10-15% |
| Cached queries | Redis cache | $0 | 20-30% |

**Cost Impact:**

| Task Type | Before (Crawl) | After (API) | Savings |
|-----------|----------------|-------------|---------|
| Competitor gap | $0.50 | $0.05 | **10x** |
| Keyword research | $0.30 | $0.03 | **10x** |
| SERP analysis | $0.20 | $0.006 | **33x** |
| **Blended 5000 tasks/day** | $1,500/day | $150/day | **10x** |

**Legal Note:** DataForSEO is the **only major SEO API** whose Terms of Service permit resale to agency clients. Ahrefs and Semrush APIs explicitly prohibit this.

---

## Part 3: World-Class Keyword Analysis Pipeline

### The Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KEYWORD INTELLIGENCE PIPELINE                         │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  Client Website │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
          ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
          │ Rule-based (92%)│ │ Crawlee+aiohttp│ │ Cookie/Bot Check│
          │   Extraction    │ │  (83 pg/sec)   │ │   (25+ sigs)    │
          └────────┬────────┘ └───────┬───────┘ └────────┬────────┘
                   │                  │                  │
                   │    ┌─────────────┴──────────────┐   │
                   │    │    seo_content_hash        │   │
                   │    │  (excludes price/stock)    │   │
                   │    └─────────────┬──────────────┘   │
                   │                  │                  │
                   ▼                  ▼                  ▼
          ┌───────────────────────────────────────────────────────┐
          │              FalkorDB Graph (per-tenant)              │
          │         kg:{tenant_id} - Product/Category KG          │
          └───────────────────────────┬───────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│  LightRAG v1.4  │        │ jina-v3 @ 384d  │        │ DiskANN Index   │
│  (NetworkX)     │        │  (Matryoshka)   │        │ (pgvectorscale) │
└────────┬────────┘        └────────┬────────┘        └────────┬────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
          ┌─────────────────┐             ┌─────────────────┐
          │  DataForSEO API │             │  Task Router    │
          │  (60-70% tasks) │             │  (crawl 5-10%)  │
          └────────┬────────┘             └────────┬────────┘
                   │                               │
                   └───────────────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │    HYBRID MATCHING          │
                    │  BM25 (25%) + Embed (35%)   │
                    │  + Rules (15%) + Catalog (20%)│
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Singleflight    │     │   User Focus    │     │  Gap Detection  │
│ Cache (Redis)   │     │  (40% weight)   │     │   (HDBSCAN)     │
│ SET NX EX + pub │     │  FocusDirective │     │  Clustering     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   FINAL SCORED OUTPUT   │
                    │ + Category Recommendations│
                    └─────────────────────────┘
```

### Multi-Pass Classification (5 Passes)

| Pass | Purpose | Cost |
|------|---------|------|
| 1. Embedding Pre-filter | Fast vector similarity to reduce candidate set | $0 (local) |
| 2. Fast Classification | Rule-based + BM25 for obvious matches | $0 (local) |
| 3. Detailed LLM Classification | Claude Sonnet for ambiguous keywords | $0.001/kw |
| 4. Page Mapping | 1:1 keyword-to-URL assignment | $0 (rules) |
| 5. User Refinement | Apply `FocusDirective` weights | $0 (local) |

### Lithuanian Morphology Handling

**The Challenge:** Lithuanian has seven grammatical cases that create exponential keyword variants:
- "plaukams" (dative plural) → "plaukai" (nominative)
- "šampūnai" (nominative plural) → "šampūnas" (nominative singular)
- "priežiūrai" (dative) → "priežiūra" (nominative)

**Solution: Stanza + 100+ Domain Patterns**

```python
class LithuanianNormalizer:
    LEMMA_MAP = {
        # Dative plural -> Nominative (category names)
        "plaukams": "plaukai",
        "dažytiems": "dažytas",
        "riebiems": "riebus",
        "sausiems": "sausas",
        
        # Product types (plural -> singular)
        "šampūnai": "šampūnas",
        "kondicionieriai": "kondicionierius",
        "kaukės": "kaukė",
        "aliejai": "aliejus",
        
        # Actions (genitive/dative -> nominative)
        "priežiūrai": "priežiūra",
        "stiprinimui": "stiprinimas",
        "drėkinimui": "drėkinimas",
        # ... 100+ total patterns
    }
    
    def lemmatize(self, text: str) -> str:
        # 1. Try Stanza (best for Baltic languages)
        if self._stanza_nlp:
            doc = self._stanza_nlp(text.lower())
            return ' '.join(word.lemma for sent in doc.sentences for word in sent.words)
        
        # 2. Rule-based fallback
        words = text.lower().split()
        return ' '.join(self.LEMMA_MAP.get(w, w) for w in words)
```

---

## Part 4: World-Class XML Prompt Design

### Prompt Engineering Principles

| Principle | Implementation |
|-----------|----------------|
| Chain-of-thought reasoning | `<reasoning>` tags with numbered steps |
| Confidence calibration | Anchored scores: 0.95+ exact, 0.70-0.84 ambiguous |
| Quality checks as constraints | Validation rules in prompt |
| Few-shot coverage | 6 examples covering edge cases |
| Placeholder injection | `{{CATEGORIES_PLACEHOLDER}}` for runtime substitution |

### 1. Category Classification Prompt

```xml
<prompt>
  <system-context>
    <role>Expert e-commerce keyword classifier (Lithuanian)</role>
    <domain-knowledge>
      <morphology-rules>
        <rule type="dative-to-nominative">"plaukams" → "plaukai"</rule>
        <rule type="genitive-to-nominative">"priežiūros" → "priežiūra"</rule>
      </morphology-rules>
      <intent-signals>
        <signal pattern="kaina">commercial: price comparison</signal>
        <signal pattern="kaip">informational: how-to</signal>
        <signal pattern="geriausias">commercial: best-of</signal>
      </intent-signals>
    </domain-knowledge>
  </system-context>
  
  <task-definition>
    <classification-rules priority="ordered">
      <rule order="1">Check for exact category name match (after lemmatization)</rule>
      <rule order="2">Check for brand + product type combination</rule>
      <rule order="3">Check for attribute modifiers (color, hair type)</rule>
      <rule order="4">Classify intent (product, informational, navigational)</rule>
      <rule order="5">Assign to closest semantic category or flag as gap</rule>
    </classification-rules>
    <confidence-calibration>
      <score value="0.95-1.0" meaning="Exact match, no ambiguity"/>
      <score value="0.85-0.94" meaning="Strong match with minor inference"/>
      <score value="0.70-0.84" meaning="Good fit with semantic ambiguity"/>
      <score value="below 0.70" meaning="Requires human review"/>
    </confidence-calibration>
  </task-definition>
  
  <categories>{{CATEGORIES_PLACEHOLDER}}</categories>
  
  <few-shot-examples>
    <example id="1" type="exact_match">
      <keyword>plaukų šampūnas</keyword>
      <reasoning>
        1. MORPHOLOGY: "plaukų" (genitive) → "plaukai" (hair)
        2. INTENT: Product search (no informational signals)
        3. MATCH: Direct category "Šampūnai" exists
        4. CONFIDENCE: 0.97 (exact after lemmatization)
      </reasoning>
      <classification>
        <primary_category>cat_shampoos</primary_category>
        <confidence>0.97</confidence>
      </classification>
    </example>
    
    <example id="2" type="morphological_variant">
      <keyword>kaip dažyti plaukus namuose</keyword>
      <reasoning>
        1. MORPHOLOGY: "dažyti plaukus" = to dye hair (infinitive + accusative)
        2. MODIFIER: "namuose" = at home - indicates DIY intent
        3. INTENT: Informational ("kaip" = how)
        4. CATEGORY MATCH: Related to "Plaukų dažai"
        5. CONTENT OPPORTUNITY: Good for blog/tutorial content
      </reasoning>
      <classification>
        <primary_category>cat_hair_dye</primary_category>
        <confidence>0.82</confidence>
        <flags><informational_intent>true</informational_intent></flags>
      </classification>
    </example>
    
    <!-- 4 more examples covering: brand keywords, multi-category, edge cases, no match -->
  </few-shot-examples>
  
  <keywords-batch>{{KEYWORDS_PLACEHOLDER}}</keywords-batch>
  
  <output-schema>
    <format>JSON</format>
    <structure>
      {
        "classifications": [
          {
            "keyword": "string",
            "primary_category": "category_id",
            "secondary_categories": ["category_id"],
            "confidence": 0.0-1.0,
            "reasoning": "string (required if confidence < 0.85)",
            "flags": {"informational_intent": bool, "brand_specific": bool}
          }
        ],
        "unclassified": ["keywords that don't match any category"]
      }
    </structure>
  </output-schema>
  
  <quality-checks>
    <check>Every input keyword must appear in classifications OR unclassified</check>
    <check>Primary category must be a valid category_id from input</check>
    <check>Confidence must be calibrated per the ranges above</check>
    <check>Reasoning required for confidence below 0.85</check>
    <check>Lithuanian morphological variants must be normalized before matching</check>
  </quality-checks>
</prompt>
```

### 2. Product Matching Prompt

```xml
<prompt>
  <system-context>
    <core-principle name="1:1-targeting-rule">
      Each keyword MUST map to exactly ONE canonical URL.
      Never assign the same keyword to multiple products.
    </core-principle>
    <domain-knowledge>
      <brand-aliases>
        <alias canonical="L'Oreal">L'Oréal, Loreal, L'oreal, LOreal</alias>
        <alias canonical="Schwarzkopf">Švarczkopf, Shwarzkopf</alias>
      </brand-aliases>
      <color-code-formats>
        <format>6/0 = 6.0 = 6-0 = 6N (dark blonde neutral)</format>
        <format>Letter codes: N=0 (neutral), A=1 (ash), G=3 (gold)</format>
      </color-code-formats>
    </domain-knowledge>
  </system-context>
  
  <matching-criteria>
    <criterion name="intent-classification" weight="prerequisite">
      <types>
        <type name="PRODUCT_SPECIFIC">Exact product: "loreal majirel 6/0 50ml"</type>
        <type name="PRODUCT_LINE">Product line: "majirel plaukų dažai"</type>
        <type name="BRAND_EXPLORATION">Brand browse: "loreal plaukų dažai"</type>
        <type name="GENERIC">Category: "plaukų dažai"</type>
        <type name="COLOR_SPECIFIC">Color filter: "6/0 plaukų dažai"</type>
      </types>
    </criterion>
    <criterion name="brand-match" weight="high">+40 points</criterion>
    <criterion name="color-code-match" weight="critical">
      <correct>+50 points</correct>
      <mismatch>-100 points (disqualifies)</mismatch>
    </criterion>
    <criterion name="product-line-match" weight="high">+35 points</criterion>
  </matching-criteria>
  
  <output-schema>
    {
      "action": "ASSIGN_TO_PRODUCT | ASSIGN_TO_CATEGORY | ASSIGN_TO_BRAND_COLLECTION | FLAG_AS_GAP",
      "confidence": 0.92,
      "match": {
        "product_id": "prod_123",
        "url": "/produktai/loreal-majirel-6-0-50ml"
      },
      "reasoning": "Exact color code match (6/0) + brand + product line"
    }
  </output-schema>
</prompt>
```

### 3. Business Priority Parser Prompt

```xml
<prompt>
  <system-context>
    <core-principles>
      <principle name="conservative-inference">
        Extract only what is explicitly stated or strongly implied.
        Never invent priorities not mentioned by the user.
      </principle>
      <principle name="temporal-awareness">
        Detect quarterly signals: Q1/Q2/Q3/Q4, seasonal terms.
        Normalize relative dates to absolute (e.g., "next month" → "2026-05").
      </principle>
      <principle name="lithuanian-expansion">
        Auto-generate Lithuanian variants for English terms.
        "professional" → ["profesionalus", "profesionalūs", "saloninis"]
      </principle>
    </core-principles>
  </system-context>
  
  <output-schema>
    {
      "priorities": {
        "categories": [
          {"name": "Hair Coloring", "weight_modifier": 1.5, "scope": "QUARTERLY"}
        ],
        "brands": [
          {"brand": "L'Oreal Professionnel", "action": "PROMOTE", "weight_modifier": 1.8}
        ]
      },
      "suppressions": {
        "brands": [
          {"brand": "Pigu", "action": "EXCLUDE", "reason": "competitor"}
        ],
        "attributes": [
          {"attribute": "home", "attribute_lt": "namams", "suppress_factor": 0.1}
        ]
      },
      "volume_preference": {
        "strategy": "HIGH_VOLUME | LOW_COMPETITION | BALANCED",
        "rationale": "Brand awareness phase"
      },
      "lithuanian_variants": {
        "generated": [
          {"original": "professional", "variants": ["profesionalus", "saloninis"]}
        ]
      },
      "confidence": 0.87
    }
  </output-schema>
</prompt>
```

---

## Part 5: Cache Flywheel Economics

### The Core Insight

The classification cache is **shared across all tenants**. Two clients in the same vertical (hair care) share cache hits for common keywords. This creates a **network effect** where each additional client reduces marginal costs.

### Cache Hit Rate Progression

| Clients | Cache Hit Rate | Cost per 500 Keywords | Cost per Keyword |
|---------|----------------|----------------------|------------------|
| 1 | 0% | $0.50 | $0.001 |
| 10 | 30% | $0.35 | $0.0007 |
| 50 | 60% | $0.20 | $0.0004 |
| 100 | 70% | $0.15 | $0.0003 |
| 500 | 90% | $0.05 | $0.0001 |
| 1000 | 95% | $0.025 | $0.00005 |

### Cache Key Design (Critical)

```python
# Cache key = keyword + hash of available categories
# Two clients with SAME categories CAN share results
# Two clients with DIFFERENT categories CANNOT

def cache_key(keyword: str, categories: list[str]) -> str:
    keyword_normalized = keyword.lower().strip()
    cat_hash = hashlib.sha256(
        '|'.join(sorted(c.lower() for c in categories)).encode()
    ).hexdigest()[:8]
    
    combined = f"{keyword_normalized}:{cat_hash}"
    return hashlib.sha256(combined.encode()).hexdigest()[:16]
```

**Implication:** Clients in the same vertical share heavily; clients in different verticals share minimally.

### Cold Start Mitigation

**Problem:** First client in a vertical pays full classification costs.

**Solutions:**

1. **Pre-warm cache:** Seed with 500+ common keywords per vertical (~$0.50)
2. **Seed from DataForSEO:** Get top keywords before first client (~$1.11)
3. **Tiered pricing:** First client pays $50 setup fee; subsequent clients get free cache

---

## Part 6: Total Cost Model

### One-Time Costs (Per Client Onboarding)

| Operation | Cost | Notes |
|-----------|------|-------|
| Site crawl (500 products) | $0.024 | Crawlee + aiohttp |
| LightRAG indexing (500 products) | $4.60 | Entity extraction + embeddings |
| Cache warming (first in vertical) | $0.50 | Only if first client |
| **Total onboarding** | **~$5.12** | Small client, existing vertical |

### Ongoing Costs (Per Analysis Run)

| Operation | Cost | Notes |
|-----------|------|-------|
| Keyword classification (95% cache hit) | $0.00008/kw | After cache maturity |
| 500 keywords analysis | $0.04 | Weekly |
| Delta crawl (20% changed) | $0.005 | Uses `seo_content_hash` |
| DataForSEO competitor data | $0.05 | API call |
| **Monthly (4 runs)** | **~$0.40** | Per client |

### Infrastructure Costs

| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| Hetzner CPX32 (crawler) | $14 | 4 vCPU, 8 GB RAM |
| Hetzner CX52 (main) | $35 | 16 vCPU, 32 GB RAM |
| Redis (FalkorDB) | $0 | Included in CX52 |
| PostgreSQL + pgvector | $0 | Included in CX52 |
| **Total infrastructure** | **$49/mo** | Fits $50 budget |

### Total Cost of Ownership

| Scenario | Monthly | Per Client |
|----------|---------|------------|
| 100 clients, 70% cache hit | $349 | $3.49 |
| 500 clients, 90% cache hit | $649 | $1.30 |
| 1000 clients, 95% cache hit | $849 | **$0.85** |

---

## Part 7: Implementation Priorities

### 20 Hours of Focused Work

| Order | Fix | Time | Impact |
|-------|-----|------|--------|
| 1 | Split content hash (seo_hash + inventory_hash) | 2h | Unblocks 65-80% delta savings |
| 2 | Cookie consent detection | 1h | Prevents garbage extraction |
| 3 | Unify embedding model (jina-v3 @ 384) | 3h | Single source of truth |
| 4 | Lithuanian morphology (Stanza + 100 patterns) | 1h | Better classification accuracy |
| 5 | Singleflight implementation | 3h | Cross-tenant cost sharing |
| 6 | Task router (60-70% to APIs) | 4h | 10x cost reduction |
| 7 | Graceful degradation | 4h | Production resilience |
| 8 | Documentation updates | 2h | ADRs, cost model, README |
| **Total** | | **20h** | |

### Critical Path

```
┌─────────────────────────────────────────────────────────────────┐
│                     IMPLEMENTATION ORDER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Fix 1 (Content Hash) ──┬──► Fix 5 (Singleflight)               │
│         2h              │           3h                          │
│                         │                                       │
│  Fix 2 (Consent) ───────┴──► Fix 6 (Task Router)                │
│         1h                          4h                          │
│                                                                  │
│  Fix 3 (Embeddings) ──────► Fix 4 (Morphology)                  │
│         3h                         1h                           │
│                                                                  │
│  Fix 7 (Degradation) ─────► Fix 8 (Documentation)               │
│         4h                         2h                           │
│                                                                  │
│  ════════════════════════════════════════════════════════════   │
│  TOTAL: 20 hours                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 8: Quality Gates

### Before Production

- [ ] All 10 gaps from GAPS-AND-CONTRADICTIONS.md resolved
- [ ] Content hash split into `seo_content_hash` + `inventory_hash`
- [ ] Embedding dimension unified to 384 across all components
- [ ] Stanza morphology with 100+ domain patterns
- [ ] Cookie/bot detection with 25+ signatures
- [ ] Singleflight with subscribe-before-recheck pattern
- [ ] Task router directing 60-70% to DataForSEO APIs
- [ ] Circuit breakers on all external services
- [ ] Cache flywheel tested with multi-tenant load

### Monitoring Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Cache hit rate | <70% | <50% |
| Classification latency p99 | >2s | >5s |
| FalkorDB memory per tenant | >20MB | >30MB |
| Delta crawl savings | <50% | <30% |
| Singleflight dedup rate | <30% | <10% |

---

## Conclusion

This synthesis demonstrates that a **world-class keyword intelligence system for Lithuanian e-commerce** is achievable within a **$50/month infrastructure budget**. The key architectural decisions are:

1. **Task decomposition:** 60-70% to APIs, crawl only client sites
2. **Cache flywheel:** Cross-tenant sharing reduces per-keyword costs to $0.00005 at scale
3. **Delta crawling:** Template-aware hashing eliminates 65-80% of recurring fetches
4. **Lithuanian-first NLU:** Stanza + jina-v3 embeddings provide best-in-class Baltic language support
5. **Graph isolation:** FalkorDB per-tenant keyspaces prevent leakage by construction

The 10 gaps identified between infrastructure research and planning documents have been resolved with concrete implementation fixes requiring ~20 hours of focused work.

---

## References

| Document | Location |
|----------|----------|
| CPU-only RAG+Graph infrastructure | `docs/infra-research/cpu-only-rag-graph.md` |
| Crawling infrastructure | `docs/infra-research/crawling-10-5000-tasks-day.md` |
| Architecture decisions | `.planning/keyword-intelligence/ARCHITECTURE-DECISIONS.md` |
| Gap analysis | `.planning/keyword-intelligence/GAPS-AND-CONTRADICTIONS.md` |
| Implementation fixes | `.planning/keyword-intelligence/IMPLEMENTATION-FIXES.md` |
| Cost model | `.planning/keyword-intelligence/COST-MODEL.md` |
| XML prompts | `.planning/keyword-intelligence/XML-PROMPTS.md` |
