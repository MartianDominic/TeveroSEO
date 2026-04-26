# TeveroSEO AI Keyword Intelligence System

> **Version:** 1.0  
> **Created:** 2026-04-26  
> **Status:** Design Complete, Implementation Pending  
> **Cost Ceiling:** Claude Sonnet 4.6 ($3/$15 per 1M tokens)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [System Architecture](#system-architecture)
4. [Pipeline Deep Dive](#pipeline-deep-dive)
5. [Model Selection Strategy](#model-selection-strategy)
6. [Cost Optimization Techniques](#cost-optimization-techniques)
7. [Scale Economics](#scale-economics)
8. [Self-Hosting Analysis](#self-hosting-analysis)
9. [Implementation Specifications](#implementation-specifications)
10. [Quality Assurance](#quality-assurance)
11. [Operational Considerations](#operational-considerations)
12. [Research Prompt for Model Selection](#research-prompt-for-model-selection)

---

## Executive Summary

### What This System Does

Transforms **3,000 raw keywords** from DataForSEO into **~200 perfectly-mapped, business-relevant keywords** with 1:1 page assignments — automatically, at scale, for pennies per prospect.

### Why It Matters

| Problem | Without This System | With This System |
|---------|---------------------|------------------|
| Keyword relevance | Manual review of 3000 keywords (4+ hours) | AI filters to 200 relevant (seconds) |
| Page mapping | Spreadsheet guesswork | Kyle Roof 1:1 mapping with conflict detection |
| Cost per prospect | $50+ in analyst time | $0.05-0.10 in AI costs |
| Scale potential | 5-10 prospects/day max | 1000+ prospects/day |

### The Core Insight

**Don't use one model. Use the right model for each job.**

```
Pass 0: FREE (local embeddings)     → 70% filtered
Pass 1: $0.002 (ultra-cheap model)  → 55% filtered  
Pass 2: $0.004 (cheap model)        → Detailed classification
Pass 3: $0.008 (cached mid-tier)    → Page mapping
Pass 4: $0.030 (quality model)      → User chat only

Total: $0.044 per prospect vs $18+ single-model approach
Savings: 99.8%
```

---

## Problem Statement

### Current State: DataForSEO Keyword Dump

When we analyze a prospect's domain, DataForSEO returns ~3,000 keywords:

```json
{
  "keywords": [
    {"keyword": "plaukų priežiūra", "volume": 1200, "cpc": 0.45, "competition": 0.3},
    {"keyword": "kaip auginti plaukus", "volume": 890, "cpc": 0.12, "competition": 0.1},
    {"keyword": "competitor brand X", "volume": 500, "cpc": 2.10, "competition": 0.9},
    {"keyword": "plaukų dažymas kaina", "volume": 670, "cpc": 0.78, "competition": 0.5},
    // ... 2996 more keywords
  ]
}
```

**Problems:**
1. **No relevance filtering** — Keywords include competitors, unrelated topics, branded terms
2. **No business context** — System doesn't know what the prospect actually sells
3. **No page mapping** — Which keyword goes to which page?
4. **Manual bottleneck** — Someone must review 3000 keywords by hand

### Target State: Intelligent Keyword Analysis

```json
{
  "analysis_id": "a1b2c3",
  "prospect": "plaukupasaka.lt",
  "input_keywords": 3000,
  "output_keywords": 187,
  "mappings": [
    {
      "keyword": "plaukų priežiūra",
      "classification": "RELEVANT",
      "confidence": 0.94,
      "category": "Hair Care",
      "intent": "commercial",
      "target_page": "/paslaugos/plauku-prieziura",
      "action": "optimize",
      "conflicts": []
    },
    {
      "keyword": "kaip auginti plaukus",
      "classification": "TANGENTIAL",
      "confidence": 0.87,
      "category": "Hair Care",
      "intent": "informational",
      "target_page": null,
      "action": "create_blog",
      "suggested_title": "Kaip Auginti Plaukus: Ekspertų Patarimai"
    }
  ],
  "excluded": [
    {"keyword": "competitor brand X", "reason": "COMPETITOR", "confidence": 0.99}
  ],
  "processing_time_ms": 4200,
  "cost_usd": 0.044
}
```

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        KEYWORD INTELLIGENCE PIPELINE                             │
│                                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  DataForSEO  │───▶│   Pass 0-3   │───▶│   Pass 4     │───▶│   Output     │   │
│  │  3000 kw     │    │   (Batch)    │    │   (Chat)     │    │   Export     │   │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                   │                   │            │
│         ▼                   ▼                   ▼                   ▼            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  Business    │    │  PostgreSQL  │    │  Real-time   │    │  JSON/CSV    │   │
│  │  Context     │    │  + Redis     │    │  WebSocket   │    │  + API       │   │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM COMPONENTS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         ORCHESTRATION LAYER                              │    │
│  │  KeywordIntelligenceOrchestrator                                        │    │
│  │  - Manages pipeline execution                                            │    │
│  │  - Handles retries and fallbacks                                         │    │
│  │  - Aggregates costs and metrics                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│         │              │              │              │              │            │
│         ▼              ▼              ▼              ▼              ▼            │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │
│  │  Pass 0   │  │  Pass 1   │  │  Pass 2   │  │  Pass 3   │  │  Pass 4   │     │
│  │ Embedding │  │   Fast    │  │ Detailed  │  │   Page    │  │   User    │     │
│  │ PreFilter │  │ Classify  │  │ Classify  │  │  Mapper   │  │   Chat    │     │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘     │
│        │              │              │              │              │            │
│        ▼              ▼              ▼              ▼              ▼            │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │
│  │  txtai    │  │ Grok 4.1  │  │ GPT-5.4   │  │  Claude   │  │  Claude   │     │
│  │  (local)  │  │   Fast    │  │   mini    │  │  Haiku    │  │  Sonnet   │     │
│  │   FREE    │  │ $0.20/0.50│  │ $0.75/4.50│  │ $1.00/5.00│  │ $3.00/15  │     │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘     │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              SUPPORT SERVICES                                    │
│                                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Business   │  │   Batch     │  │   Cache     │  │   Cost      │            │
│  │  Context    │  │   Queue     │  │   Manager   │  │   Tracker   │            │
│  │  Service    │  │  (BullMQ)   │  │   (Redis)   │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
                                    KEYWORD INTELLIGENCE DATA FLOW
                                    
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Prospect   │     │  Business   │     │    Site     │     │   Voice     │
│   Domain    │     │   Profile   │     │   Pages     │     │  Profile    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT BUILDER                                  │
│  Combines all inputs into unified BusinessContext object                │
└─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATAFORSEO API                                  │
│  Input: domain                                                          │
│  Output: 3000 keywords with volume, CPC, competition, intent            │
└─────────────────────────────────────────────────────────────────────────┘
       │
       │ 3000 keywords
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PASS 0: EMBEDDING PRE-FILTER                                           │
│  ────────────────────────────────────────────────────────────────────── │
│  Model: txtai (local, sentence-transformers/paraphrase-multilingual)    │
│  Input: 3000 keywords + business context                                │
│  Process:                                                               │
│    1. Embed each keyword: keyword_embeddings[3000][384]                 │
│    2. Embed business context: business_embedding[384]                   │
│    3. Calculate cosine similarity for each keyword                      │
│    4. Filter: similarity >= 0.35                                        │
│  Output: ~800 keywords (70% filtered)                                   │
│  Cost: $0.00                                                            │
│  Latency: ~600ms (5000 keywords/sec)                                    │
└─────────────────────────────────────────────────────────────────────────┘
       │
       │ 800 keywords
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PASS 1: FAST BINARY CLASSIFICATION                                     │
│  ────────────────────────────────────────────────────────────────────── │
│  Model: Grok 4.1 Fast ($0.20/$0.50 per 1M tokens)                       │
│  Context Window: 2M tokens (fits everything in one call)                │
│  Input: 800 keywords + condensed business profile                       │
│  Process:                                                               │
│    1. Single API call with all 800 keywords                             │
│    2. Binary classification: LIKELY_RELEVANT | NEEDS_REVIEW             │
│    3. No explanations, minimal output tokens                            │
│  Output: 200 LIKELY_RELEVANT + 150 NEEDS_REVIEW (55% filtered)          │
│  Token Usage: ~135K input, ~4K output                                   │
│  Cost: ~$0.002                                                          │
│  Latency: ~2s                                                           │
└─────────────────────────────────────────────────────────────────────────┘
       │
       ├──────────────────────────────┐
       │                              │
       ▼                              ▼
┌─────────────┐              ┌─────────────────────────────────────────────┐
│    200      │              │  PASS 2: DETAILED CLASSIFICATION            │
│   LIKELY    │              │  ─────────────────────────────────────────  │
│  RELEVANT   │              │  Model: GPT-5.4-mini ($0.75/$4.50 per 1M)   │
│             │              │  Input: 150 NEEDS_REVIEW keywords           │
│  (skip P2)  │              │  Process:                                   │
│             │              │    1. Batch API for 50% discount            │
└──────┬──────┘              │    2. 4-way classification:                 │
       │                     │       RELEVANT | TANGENTIAL | IRRELEVANT    │
       │                     │       | COMPETITOR                          │
       │                     │    3. Confidence scores 0.0-1.0             │
       │                     │    4. Category matching                     │
       │                     │    5. Brief reasoning                       │
       │                     │  Output: 80 RELEVANT + 30 TANGENTIAL        │
       │                     │  Token Usage: ~28K input, ~12K output       │
       │                     │  Cost: ~$0.004 (with 50% batch discount)    │
       │                     │  Latency: Async (batch API, up to 24h SLA)  │
       │                     └─────────────────────────────────────────────┘
       │                              │
       │                              │ 80 RELEVANT + 30 TANGENTIAL
       │                              │
       ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      MERGE: 280 RELEVANT KEYWORDS                        │
│                      (200 from Pass 1 + 80 from Pass 2)                  │
└─────────────────────────────────────────────────────────────────────────┘
       │
       │ 280 keywords
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PASS 3: KEYWORD-TO-PAGE MAPPING                                        │
│  ────────────────────────────────────────────────────────────────────── │
│  Model: Claude Haiku 4.5 ($1.00/$5.00 per 1M tokens)                    │
│  Optimization: 90% prompt caching on business context                   │
│  Input: 280 keywords + site pages + mapping rules                       │
│  Process:                                                               │
│    1. Load site pages from crawl data                                   │
│    2. Apply Kyle Roof 1:1 mapping rules:                                │
│       - One primary keyword per page                                    │
│       - Category pages → category keywords                              │
│       - Product pages → product keywords                                │
│       - Blog pages → informational keywords                             │
│    3. Detect conflicts (multiple keywords wanting same page)            │
│    4. Suggest new pages for unmapped keywords                           │
│  Output: 280 keyword-page mappings with actions                         │
│  Token Usage: ~40K input (90% cached), ~15K output                      │
│  Cost: ~$0.008 (with 90% cache savings)                                 │
│  Latency: ~3s                                                           │
└─────────────────────────────────────────────────────────────────────────┘
       │
       │ 280 mapped keywords
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PASS 4: USER REFINEMENT (OPTIONAL)                                     │
│  ────────────────────────────────────────────────────────────────────── │
│  Model: Claude Sonnet 4.6 ($3.00/$15.00 per 1M tokens)                  │
│  Input: User natural language + current keyword set                     │
│  Process:                                                               │
│    1. Parse user guidance into structured filters                       │
│       "Focus on categories, need 200 max"                               │
│       → {intent: ["commercial"], limit: 200}                            │
│    2. Apply filters to keyword set                                      │
│    3. Explain what was filtered and why                                 │
│    4. Allow iterative refinement                                        │
│  Output: Filtered keyword set + filter explanation                      │
│  Token Usage: ~5K input, ~1K output per turn                            │
│  Cost: ~$0.030 per conversation (2-3 turns typical)                     │
│  Latency: Real-time streaming                                           │
└─────────────────────────────────────────────────────────────────────────┘
       │
       │ Final keyword set
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           FINAL OUTPUT                                   │
│  ────────────────────────────────────────────────────────────────────── │
│  Format: JSON or CSV export                                             │
│  Contents:                                                              │
│    - keyword: string                                                    │
│    - classification: RELEVANT | TANGENTIAL                              │
│    - confidence: 0.0-1.0                                                │
│    - category: string                                                   │
│    - intent: transactional | commercial | informational | navigational  │
│    - volume: number                                                     │
│    - cpc: number                                                        │
│    - competition: number                                                │
│    - target_page: URL or null                                           │
│    - action: optimize | create_category | create_product | create_blog  │
│    - conflicts: string[] (other keywords targeting same page)           │
│  Typical count: ~200 keywords                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Deep Dive

### Pass 0: Embedding Pre-Filter

**Purpose:** Eliminate obviously irrelevant keywords before any API calls.

**Technical Details:**

```python
# EmbeddingPreFilter.py

from txtai.embeddings import Embeddings
import numpy as np

class EmbeddingPreFilter:
    def __init__(self):
        # Multilingual model for Lithuanian + English
        self.embeddings = Embeddings({
            "path": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            "content": False  # Embeddings only, no content storage
        })
    
    def build_business_context(self, profile: BusinessProfile) -> str:
        """Create searchable text from business profile."""
        return f"""
        {profile.business_name}
        {profile.business_type}
        Products: {', '.join(profile.products)}
        Services: {', '.join(profile.services)}
        Categories: {', '.join(profile.categories)}
        Industry: {profile.industry}
        Target audience: {profile.target_audience}
        """
    
    def filter_keywords(
        self, 
        keywords: list[str], 
        business_context: str,
        threshold: float = 0.35
    ) -> list[tuple[str, float]]:
        """Filter keywords by semantic similarity to business."""
        
        # Batch embed all keywords (very fast)
        keyword_embeddings = self.embeddings.batchtransform(keywords)
        
        # Embed business context
        business_embedding = self.embeddings.transform(business_context)
        
        # Calculate similarities
        results = []
        for keyword, embedding in zip(keywords, keyword_embeddings):
            similarity = self._cosine_similarity(embedding, business_embedding)
            if similarity >= threshold:
                results.append((keyword, similarity))
        
        return sorted(results, key=lambda x: x[1], reverse=True)
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
```

**Why 0.35 Threshold?**

| Threshold | Keywords Kept | False Negatives | False Positives |
|-----------|---------------|-----------------|-----------------|
| 0.25 | 1200 (40%) | Very low | High |
| 0.30 | 1000 (33%) | Low | Medium |
| **0.35** | **800 (27%)** | **Acceptable** | **Low** |
| 0.40 | 600 (20%) | Medium | Very low |
| 0.45 | 400 (13%) | High | Minimal |

0.35 balances aggressive filtering with acceptable false negative rate.

**Performance:**
- Throughput: ~5,000 keywords/second on 16 vCPU
- Memory: ~500MB for model
- Latency: ~600ms for 3,000 keywords

---

### Pass 1: Fast Binary Classification

**Purpose:** Quick triage of remaining keywords into "probably relevant" vs "needs more analysis."

**Model Selection: Grok 4.1 Fast**

| Factor | Grok 4.1 Fast | Alternatives |
|--------|---------------|--------------|
| Price | $0.20/$0.50 | Gemini Flash Lite: $0.25/$1.50 |
| Context | 2M tokens | Most others: 128K-200K |
| Speed | Very fast | Comparable |
| Quality | Good for binary | Sufficient |

The 2M context window is key — we can fit ALL 800 keywords + business context in a single API call.

**Prompt Design:**

```
You classify keywords for {business_name}, a {business_type}.

Top categories: {categories}
Top products: {products}

For each keyword, respond ONLY with:
- R if it relates to this business
- ? if uncertain

Keywords:
1. plaukų priežiūra
2. kaip auginti plaukus
3. competitor brand x
... (800 total)

Respond as: 1R 2R 3? 4R ...
```

**Why This Prompt:**
- Minimal output tokens (1 char per keyword)
- No explanations needed at this stage
- Fits in 2M context easily
- ~4K output tokens for 800 keywords

**Output Processing:**

```python
def parse_fast_classification(response: str, keywords: list[str]) -> dict:
    """Parse compact response into classifications."""
    results = {"LIKELY_RELEVANT": [], "NEEDS_REVIEW": []}
    
    # Response format: "1R 2R 3? 4R 5? ..."
    parts = response.strip().split()
    for part in parts:
        idx = int(part[:-1]) - 1
        classification = part[-1]
        
        if classification == "R":
            results["LIKELY_RELEVANT"].append(keywords[idx])
        else:
            results["NEEDS_REVIEW"].append(keywords[idx])
    
    return results
```

---

### Pass 2: Detailed Multi-Class Classification

**Purpose:** Provide nuanced classification for uncertain keywords with reasoning.

**Model Selection: GPT-5.4-mini**

| Factor | GPT-5.4-mini | Claude Haiku | Gemini Flash |
|--------|--------------|--------------|--------------|
| Price | $0.75/$4.50 | $1.00/$5.00 | $0.50/$2.00 |
| Structured Output | Excellent | Good | Good |
| Batch API | 50% off | 50% off | Implicit cache |
| Quality | High | High | Medium-High |

GPT-5.4-mini wins on structured output reliability and batch pricing.

**Classification Schema:**

```typescript
interface DetailedClassification {
  keyword: string;
  classification: "RELEVANT" | "TANGENTIAL" | "IRRELEVANT" | "COMPETITOR";
  confidence: number;  // 0.0-1.0
  matchedCategory: string | null;
  intent: "transactional" | "commercial" | "informational" | "navigational";
  reason: string;  // Brief explanation
}
```

**Classification Definitions:**

| Class | Definition | Example |
|-------|------------|---------|
| RELEVANT | Directly relates to products/services sold | "plaukų dažai" for hair salon |
| TANGENTIAL | Related topic, good for content marketing | "kaip prižiūrėti plaukus namuose" |
| IRRELEVANT | No meaningful connection to business | "automobilių remontas" |
| COMPETITOR | Mentions competitor brand or product | "wella profesional" for non-Wella salon |

**Batch Processing:**

```python
async def classify_detailed_batch(
    keywords: list[dict],
    business_context: BusinessContext
) -> list[DetailedClassification]:
    """Use OpenAI Batch API for 50% discount."""
    
    # Create batch file
    batch_requests = []
    for i, kw in enumerate(keywords):
        batch_requests.append({
            "custom_id": f"kw-{i}",
            "method": "POST",
            "url": "/v1/chat/completions",
            "body": {
                "model": "gpt-5.4-mini",
                "messages": [
                    {"role": "system", "content": DETAILED_SYSTEM_PROMPT},
                    {"role": "user", "content": format_keyword_request(kw, business_context)}
                ],
                "response_format": {"type": "json_schema", "json_schema": CLASSIFICATION_SCHEMA}
            }
        })
    
    # Submit batch
    batch = await openai.batches.create(
        input_file_id=upload_batch_file(batch_requests),
        endpoint="/v1/chat/completions",
        completion_window="24h"
    )
    
    # Poll for completion (or use webhook)
    while batch.status != "completed":
        await asyncio.sleep(60)
        batch = await openai.batches.retrieve(batch.id)
    
    # Download results
    return parse_batch_results(batch.output_file_id)
```

---

### Pass 3: Keyword-to-Page Mapping

**Purpose:** Assign each keyword to exactly one page following Kyle Roof's SEO methodology.

**Kyle Roof's Rules:**
1. **One primary keyword per page** — Never target the same keyword from multiple pages
2. **Category pages target category keywords** — Broad, high-volume terms
3. **Product pages target specific keywords** — Long-tail, transactional terms
4. **Blog pages target informational keywords** — Questions, how-to terms
5. **Homepage targets brand keywords** — Only if no dedicated landing page

**Model Selection: Claude Haiku 4.5 with Prompt Caching**

| Factor | Why Haiku |
|--------|-----------|
| Structured output | Very reliable JSON |
| Prompt caching | 90% savings on repeated context |
| Reasoning | Good enough for mapping logic |
| Cost | $1.00/$5.00 base, ~$0.10/$0.50 with cache |

**Caching Strategy:**

```python
# The business context is cached (doesn't change between keywords)
CACHED_CONTEXT = """
<system_context cache_control="ephemeral">
You map keywords to website pages following Kyle Roof's SEO rules:

1. One primary keyword per page (CRITICAL)
2. Category pages → category keywords (broad terms)
3. Product pages → product keywords (specific terms)  
4. Blog pages → informational keywords (questions, how-to)
5. Detect conflicts when multiple keywords want same page

Business: {business_name}
Website: {domain}

Site Pages:
{pages_list}
</system_context>
"""

# Only the keywords change per request (not cached)
VARIABLE_REQUEST = """
Map these keywords to pages:
{keywords_list}

Output JSON array with mappings.
"""
```

**Token Economics with Caching:**

| Component | Tokens | Cost per 1M | Actual Cost |
|-----------|--------|-------------|-------------|
| Cached context (90% off) | 35,000 | $0.10 | $0.0035 |
| Variable request | 5,000 | $1.00 | $0.0050 |
| Output | 15,000 | $5.00 | $0.0750 |
| **Total** | | | **$0.0835** |

Without caching: $0.215. **Savings: 61%**

**Conflict Detection:**

```typescript
interface KeywordMapping {
  keyword: string;
  targetUrl: string | null;
  action: "optimize" | "create_category" | "create_product" | "create_blog";
  confidence: number;
  conflicts: ConflictInfo[];
}

interface ConflictInfo {
  competingKeyword: string;
  competingVolume: number;
  resolution: "keep_current" | "swap" | "needs_review";
  reason: string;
}
```

**Example Conflict Resolution:**

```json
{
  "keyword": "plaukų dažai",
  "targetUrl": "/produktai/plauku-dazai",
  "action": "optimize",
  "confidence": 0.92,
  "conflicts": [
    {
      "competingKeyword": "profesionalūs plaukų dažai",
      "competingVolume": 450,
      "resolution": "swap",
      "reason": "Current keyword (volume: 890) has higher volume, should be primary. Move 'profesionalūs plaukų dažai' to /produktai/profesionalus-dazai"
    }
  ]
}
```

---

### Pass 4: User Refinement Chat

**Purpose:** Allow natural language refinement of keyword selection.

**Model Selection: Claude Sonnet 4.6**

| Factor | Why Sonnet |
|--------|------------|
| Conversation quality | Best in class |
| Lithuanian | Good Baltic support |
| Reasoning | Understands nuanced requests |
| Streaming | Real-time response |

**Natural Language → Filter Translation:**

| User Says | Parsed Filter |
|-----------|---------------|
| "Focus on categories" | `{intent: ["commercial", "transactional"]}` |
| "Need about 200 keywords" | `{limit: 200}` |
| "Only high volume" | `{minVolume: 500}` |
| "Remove competitor mentions" | `{excludeCompetitors: true}` |
| "Just hair care products" | `{categories: ["hair care", "hair products"]}` |
| "No informational content" | `{excludeIntent: ["informational"]}` |

**Conversation Flow:**

```
User: "Focus on product categories, need around 150 keywords, 
       skip anything under 200 monthly searches"