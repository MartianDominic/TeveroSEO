# Semantic Intelligence Master Document

> **Single source of truth** for LLM architecture, cost optimization, and semantic understanding.  
> **Created:** 2026-05-06  
> **Supersedes:** LLM-ARCHITECTURE.md, MODEL-REFERENCE.md, COST-CONTROL-MASTER.md, COST-OPTIMIZATION-DEEP-DIVE.md

---

## Executive Summary

TeveroSEO's semantic intelligence layer transforms raw keyword data into client-specific growth strategies using **dynamic semantic understanding** — not hardcoded mappings.

**Core Principle:**
```
WRONG:  "šampūnas" → category: "Hair Care"  (hardcoded dictionary)
RIGHT:  embed("šampūnas") ≈ embed(business_context) → classification (semantic similarity)
```

This works for:
- Hair salon in Vilnius
- Industrial machinery in Germany  
- SaaS startup in San Francisco
- Restaurant chain in Tokyo

**No language dictionaries. No industry templates. Pure semantic understanding.**

---

## Table of Contents

1. [Semantic Understanding Architecture](#1-semantic-understanding-architecture)
2. [LLM Model Strategy](#2-llm-model-strategy)
3. [Cost Optimization Hierarchy](#3-cost-optimization-hierarchy)
4. [Multi-Tenant Economics](#4-multi-tenant-economics)
5. [Implementation Reference](#5-implementation-reference)
6. [Migration Checklist](#6-migration-checklist)

---

## 1. Semantic Understanding Architecture

### Why NOT Hardcoded Mappings

| Approach | Example | Problem |
|----------|---------|---------|
| **Dictionary lookup** | `"šampūnas" → "shampoo"` | Only works for Lithuanian hair care |
| **Category templates** | `hair_care_keywords.json` | Only works for hair care industry |
| **Keyword-to-page mapping** | `"šampūnai" → /products/shampoos` | Only works for this specific site |

**All of these fail** when you onboard:
- A B2B software company
- A restaurant chain
- An industrial supplier
- A professional services firm

### The Semantic Approach

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC UNDERSTANDING PIPELINE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INPUT: Raw keyword + Business context                                   │
│  ──────────────────────────────────────────────────────────────────────  │
│  keyword: "plaukų priežiūra" (hair care)                                │
│  context: {                                                              │
│    business: "Plaukų Pasaka - premium hair salon",                      │
│    services: ["haircuts", "coloring", "treatments"],                    │
│    positioning: "luxury",                                                │
│    target_audience: "women 25-45 Vilnius"                               │
│  }                                                                       │
│                                                                          │
│  STEP 1: EMBEDDING (Language-Agnostic)                                   │
│  ──────────────────────────────────────────────────────────────────────  │
│  • jina-v5-text-nano: 768-dim multilingual embeddings                   │
│  • Same model embeds Lithuanian, English, German, Japanese              │
│  • "plaukų priežiūra" and "hair care" have cosine ~0.85                 │
│  • No language-specific dictionaries needed                              │
│                                                                          │
│  keyword_emb = embed("plaukų priežiūra")     # [0.12, -0.34, ...]      │
│  context_emb = embed(business_description)   # [0.15, -0.31, ...]      │
│  similarity = cosine(keyword_emb, context_emb)  # 0.78 → RELEVANT      │
│                                                                          │
│  STEP 2: BUSINESS CONTEXT CLASSIFICATION (LLM)                           │
│  ──────────────────────────────────────────────────────────────────────  │
│  • Grok 4.1 understands business context, not keyword dictionaries      │
│  • Prompt includes: business description, services, positioning          │
│  • Model REASONS about fit: "This keyword matches their luxury           │
│    positioning because it targets high-value hair care services"        │
│                                                                          │
│  classify(keyword, business_context) → {                                │
│    classification: "RELEVANT",                                          │
│    confidence: 0.94,                                                    │
│    intent: "commercial",                                                │
│    reasoning: "Matches core service offering"                           │
│  }                                                                       │
│                                                                          │
│  STEP 3: CLUSTERING (Unsupervised Discovery)                             │
│  ──────────────────────────────────────────────────────────────────────  │
│  • HDBSCAN auto-discovers clusters from embedding space                 │
│  • No predefined "hair care", "electronics" categories                  │
│  • Clusters emerge from the DATA, not from templates                    │
│  • Works for any industry without configuration                          │
│                                                                          │
│  HDBSCAN(embeddings) → [                                                │
│    { cluster: 1, keywords: ["šampūnai", "plaukų priežiūra", ...] },    │
│    { cluster: 2, keywords: ["plaukų dažymas", "spalva", ...] },        │
│    { cluster: 3, keywords: ["plaukų kirpimas", "stilius", ...] },      │
│  ]                                                                       │
│                                                                          │
│  STEP 4: LABELING (LLM-Generated, Not Template)                          │
│  ──────────────────────────────────────────────────────────────────────  │
│  • Grok generates labels BY LOOKING AT cluster contents                 │
│  • Labels are business-friendly, not SEO jargon                         │
│  • Works in client's language automatically                              │
│                                                                          │
│  label_cluster(cluster_keywords, business_context) → {                  │
│    label_lt: "Plaukų priežiūros produktai",                            │
│    label_en: "Hair Care Products",                                      │
│    business_label: "Product Growth Area"                                │
│  }                                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Properties

| Property | How It's Achieved |
|----------|-------------------|
| **Language-agnostic** | Multilingual embeddings (jina-v5-text-nano) |
| **Industry-agnostic** | No templates — clusters emerge from data |
| **Business-specific** | LLM classification uses business context |
| **Scalable** | Same pipeline for 1 or 10,000 clients |

---

## 2. LLM Model Strategy

### Two-Model Architecture (May 2026)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ANALYSIS + WRITING SEPARATION                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────┐                              │
│  │  ANALYSIS LAYER: Grok 4.1 (xAI)       │                              │
│  │  ─────────────────────────────────────│                              │
│  │  • Keyword classification             │  $0.20/1M input              │
│  │  • Funnel stage detection             │  $0.50/1M output             │
│  │  • Cluster labeling                   │                              │
│  │  • Strategic reasoning                │  WHY: Cheapest high-quality  │
│  │  • Proposal narratives                │  structured output           │
│  │  • CopilotKit chat                    │                              │
│  └───────────────────────────────────────┘                              │
│                                                                          │
│  ┌───────────────────────────────────────┐                              │
│  │  WRITING LAYER: Gemini 3.1 Pro        │                              │
│  │  ─────────────────────────────────────│                              │
│  │  • Article generation                 │  $1.25/1M input              │
│  │  • Voice analysis (12 dimensions)     │  $5.00/1M output             │
│  │  • Brand voice application            │                              │
│  │  • Lithuanian translations            │  WHY: Best prose quality,    │
│  │  • Quality content                    │  excellent Lithuanian        │
│  └───────────────────────────────────────┘                              │
│                                                                          │
│  ┌───────────────────────────────────────┐                              │
│  │  IMAGE LAYER: Gemini 3.1 Flash Image  │                              │
│  │  ─────────────────────────────────────│                              │
│  │  • All image generation               │  ~$0.02/image                │
│  │  • Replaces Imagen 4.x                │                              │
│  └───────────────────────────────────────┘                              │
│                                                                          │
│  FALLBACK (rare):                                                        │
│  • claude-sonnet-4-6: If Gemini voice quality insufficient ($3/1M)      │
│  • kimi-2.6: Alternative provider for redundancy                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Model Selection Matrix

| Task | Model | Variant | Cost | Batch Size |
|------|-------|---------|------|------------|
| Keyword classification (bulk) | Grok 4.1 | Fast | $0.20/1M | 200 |
| Funnel classification | Grok 4.1 | Standard | $0.40/1M | 250 |
| Quality refinement | Grok 4.1 | Thinking | $2.00/1M | 20 |
| Cluster labeling | Grok 4.1 | Fast | $0.20/1M | All clusters |
| Strategic ranking | Grok 4.1 | Thinking | $2.00/1M | Per cluster |
| Proposal narrative | Grok 4.1 | Thinking | $2.00/1M | 1 |
| CopilotKit chat | Grok 4.1 | Fast | $0.20/1M | 1 |
| Article generation | Gemini 3.1 | Pro | $1.25/1M | 1 |
| Voice extraction | Gemini 3.1 | Pro | $1.25/1M | 1 |
| Translation | Gemini 3.1 | Pro | $1.25/1M | 50 |
| Image generation | Gemini 3.1 | Flash Image | ~$0.02/img | 1 |

### Deprecated Models (DO NOT USE)

| Deprecated | Replace With | Reason |
|------------|--------------|--------|
| `gpt-4o-mini` | `grok-4.1-fast` | 10x cheaper, same quality |
| `gpt-4o` | `grok-4.1` | 5x cheaper |
| `claude-3-5-sonnet-*` | `claude-sonnet-4-6` | Old version |
| `claude-3-haiku` | `grok-4.1-fast` | Cheaper + better |
| `gemini-1.5-*` | `gemini-3.1-*` | Old version |
| `gemini-2.x-*` | `gemini-3.1-*` | Old version |
| `imagen-*` | `gemini-3.1-flash-image` | Deprecated |

---

## 3. Cost Optimization Hierarchy

### The Cascade: Free → Cheap → Quality

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       COST OPTIMIZATION CASCADE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TIER 0: FREE — Local Processing                                         │
│  ════════════════════════════════════════════════════════════════════   │
│  • Local embeddings (jina-v5-text-nano on CPU)      $0.00               │
│  • Redis cache (90%+ hit rate target)              $0.00               │
│  • Semantic deduplication (cosine > 0.92)          $0.00               │
│  • HDBSCAN clustering (no LLM needed)              $0.00               │
│  Filter: 70% of keywords never touch paid APIs                          │
│                                                                          │
│  TIER 1: CHEAP — Bulk Classification                                     │
│  ════════════════════════════════════════════════════════════════════   │
│  • Grok 4.1 Fast ($0.20/1M)                                             │
│  • Single API call for 200 keywords                                     │
│  • Binary output: LIKELY_RELEVANT | NEEDS_REVIEW                        │
│  • Cache identical prompts (75% cache hit)                              │
│  Cost: ~$0.006 per 200 keywords                                         │
│                                                                          │
│  TIER 2: DETAILED — Uncertain Cases Only                                 │
│  ════════════════════════════════════════════════════════════════════   │
│  • Only NEEDS_REVIEW keywords (15-20% of total)                         │
│  • Grok 4.1 Standard or Thinking                                        │
│  • Full classification with reasoning                                    │
│  Cost: ~$0.004 per batch (Batch API 50% discount)                       │
│                                                                          │
│  TIER 3: QUALITY — Content Generation Only                               │
│  ════════════════════════════════════════════════════════════════════   │
│  • Gemini 3.1 Pro for articles                                          │
│  • Context caching (90% discount on repeated voice context)             │
│  • Only triggered when user generates content                           │
│  Cost: ~$0.20-0.50 per article                                          │
│                                                                          │
│  RESULT: $0.04 per prospect analysis (vs $18 naive approach)            │
│         99.8% cost reduction                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cost Per Operation

| Operation | Before Optimization | After Optimization | Savings |
|-----------|--------------------|--------------------|---------|
| Keyword classification (100 kw) | $1.00 | $0.006 | 99% |
| Prospect analysis (3000 kw) | $18.00 | $0.044 | 99.8% |
| Article generation | $0.50 | $0.20 | 60% |
| Voice analysis (10 pages) | $1.00 | $0.02 | 98% |
| Embedding (1000 keywords) | $0.20 | $0.00 | 100% |

### Monthly Cost at Scale

| Clients | Before | After | Savings |
|---------|--------|-------|---------|
| 100 | $2,800 | $400 | $2,400 |
| 500 | $14,000 | $1,200 | $12,800 |
| 1000 | $28,000 | $2,000 | $26,000 |

---

## 4. Multi-Tenant Economics

### The Flywheel: More Clients = Lower Costs

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT COST FLYWHEEL                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INSIGHT: 50 Lithuanian e-commerce clients share classification for     │
│           "varle.lt kaina" — first client pays, rest get it FREE.       │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  L1: EMBEDDING CACHE (Global, Never Expires)                      │  │
│  │  ─────────────────────────────────────────────────────────────────│  │
│  │  Key: embed:{hash(keyword)}                                       │  │
│  │  Sharing: 100% cross-client (same keyword = same embedding)       │  │
│  │  Hit rate: 85%+ (finite keyword universe per language)            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  L2: CLASSIFICATION CACHE (Per Vertical, 30 Days)                 │  │
│  │  ─────────────────────────────────────────────────────────────────│  │
│  │  Key: classify:{hash(keyword)}:{vertical}                         │  │
│  │  Sharing: Cross-client within same vertical (ecom, SaaS, local)   │  │
│  │  Hit rate: 70%+ (common keywords in same vertical)                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  L3: LLM RESPONSE CACHE (Global, 7 Days)                          │  │
│  │  ─────────────────────────────────────────────────────────────────│  │
│  │  Key: llm:{model}:{hash(prompt)}                                  │  │
│  │  Sharing: Cross-client for identical prompts                      │  │
│  │  Hit rate: 60%+ (similar business contexts)                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ECONOMICS:                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Clients │ Cost/Classification │ Effective Cost │ Savings       │    │
│  │  ────────┼────────────────────┼────────────────┼───────────────│    │
│  │  1       │ $0.010              │ $0.010          │ 0%            │    │
│  │  10      │ $0.010              │ $0.003          │ 70%           │    │
│  │  100     │ $0.010              │ $0.001          │ 90%           │    │
│  │  1000    │ $0.010              │ $0.0003         │ 97%           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  The first client pays full price. The 1000th client pays 3% of that.   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why This Works

| Reason | Explanation |
|--------|-------------|
| **Finite keyword universe** | Lithuanian has ~500K common search terms |
| **Vertical clustering** | E-commerce clients share 70%+ keywords |
| **Embedding permanence** | "šampūnas" embedding never changes |
| **Classification stability** | "šampūnas" stays hair care category |

---

## 5. Implementation Reference

### Environment Variables

```bash
# PRIMARY MODELS (REQUIRED)
XAI_API_KEY=               # Grok 4.1 access
GOOGLE_AI_API_KEY=         # Gemini 3.1 access

# FALLBACK (OPTIONAL)
ANTHROPIC_API_KEY=         # Claude Sonnet 4.6 (voice backup)
MOONSHOT_API_KEY=          # Kimi 2.6 (reasoning backup)

# LOCAL SERVICES (REQUIRED)
EMBEDDING_SERVER_URL=http://localhost:8001  # Local jina-v5-text-nano

# MODEL OVERRIDES (OPTIONAL)
CLASSIFICATION_MODEL=grok-4.1-fast
CONTENT_MODEL=gemini-3.1-pro
VOICE_MODEL=gemini-3.1-pro  # or claude-sonnet-4-6
IMAGE_MODEL=gemini-3.1-flash-image-preview
```

### API Integration Patterns

```typescript
// Analysis: Grok 4.1 via OpenAI-compatible API
import OpenAI from "openai";

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

async function classifyKeywords(keywords: string[], businessContext: BusinessContext) {
  // DYNAMIC: Uses business context, not keyword dictionaries
  const response = await grok.chat.completions.create({
    model: "grok-4.1-fast",
    messages: [{
      role: "user",
      content: `Classify keywords for this business:
      
Business: ${businessContext.name}
Industry: ${businessContext.industry}
Services: ${businessContext.services.join(", ")}
Target audience: ${businessContext.targetAudience}

Keywords to classify:
${keywords.map((kw, i) => `${i+1}. ${kw}`).join("\n")}

For EACH keyword, determine:
- include: true if relevant to this specific business
- confidence: 0.0-1.0
- intent: informational | commercial | transactional | navigational
- reasoning: why it fits (or doesn't) this business

Return JSON array.`
    }],
    response_format: { type: "json_object" },
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

```python
# Content: Gemini 3.1 Pro
import google.generativeai as genai

genai.configure(api_key=os.environ["GOOGLE_AI_API_KEY"])
model = genai.GenerativeModel("gemini-3.1-pro")

async def generate_article(topic: str, voice_profile: dict) -> str:
    # DYNAMIC: Uses extracted voice profile, not templates
    response = await model.generate_content_async(
        f"""Write an article about: {topic}
        
Brand voice guidelines:
{json.dumps(voice_profile, indent=2)}

Write in the exact tone, style, and vocabulary of this brand.
Include the terminology they use. Match their formality level.
This should sound like THEM, not like generic content."""
    )
    return response.text
```

### Files to Update

| Priority | File | Current | Change To |
|----------|------|---------|-----------|
| P1 | `model-router.ts:57` | `grok-2-mini` | `grok-4.1-fast` |
| P1 | `provider-config.ts:49` | `grok-2-mini` | `grok-4.1-fast` |
| P1 | `ResilientClassifier.ts:334` | `gpt-4o-mini` | `grok-4.1-fast` |
| P1 | `VoiceAnalyzer.ts:16` | `claude-3-5-sonnet-*` | `gemini-3.1-pro` |
| P1 | `TranslationService.ts:35` | `gemini-1.5-pro` | `gemini-3.1-pro` |
| P2 | `gemini.ts:529` | `gemini-1.5-pro` | `gemini-3.1-pro` |
| P2 | `main_text_generation.py:76` | `gemini-2.0-flash-001` | `gemini-3.1-flash` |
| P2 | `client_context.py:21` | `gemini-2.5-pro` | `gemini-3.1-pro` |

---

## 6. Migration Checklist

### Phase 1: Infrastructure (Week 1)

- [ ] Deploy local embedding server (jina-v5-text-nano)
- [ ] Configure Redis multi-tier caching
- [ ] Set up model routing with fallbacks
- [ ] Add cost tracking per operation

### Phase 2: Model Migration (Week 2)

- [ ] Update classification to Grok 4.1 Fast
- [ ] Update funnel detection to Grok 4.1
- [ ] Update voice analysis to Gemini 3.1 Pro
- [ ] Update content generation to Gemini 3.1 Pro
- [ ] Update image generation to Gemini 3.1 Flash Image

### Phase 3: Cost Optimization (Week 3)

- [ ] Implement prompt caching (75% discount)
- [ ] Increase batch sizes (200 keywords/call)
- [ ] Add singleflight for deduplication
- [ ] Extend cache TTLs (7 → 30 days for classifications)

### Phase 4: Multi-Tenant (Week 4)

- [ ] Enable cross-client embedding cache
- [ ] Enable vertical-based classification cache
- [ ] Implement cache pre-warming per vertical
- [ ] Add cost attribution per client

---

## Appendix: Why This Scales

### The "Shampoo Problem" Solved

**Old approach (broken):**
```json
{
  "šampūnas": "shampoo",
  "kondicionierius": "conditioner",
  "plaukų kaukė": "hair mask"
}
```

This fails immediately when you onboard:
- A car parts retailer (no hair care keywords)
- A German client (different language)
- A B2B SaaS company (completely different domain)

**New approach (works for everyone):**
```typescript
// 1. Embed the business
const businessEmb = embed("AutoDalys - automotive parts retailer for Lithuanian market");

// 2. Embed each keyword
const keywordEmb = embed("stabdžių kaladėlės");  // brake pads

// 3. Semantic similarity (language-agnostic)
const similarity = cosine(businessEmb, keywordEmb);  // 0.72 → RELEVANT

// 4. LLM confirms with business reasoning
const classification = await grok.classify(keyword, businessContext);
// → { include: true, reasoning: "Core product category for auto parts retailer" }
```

**This works because:**
1. Embeddings are multilingual — no dictionaries needed
2. Business context is dynamic — passed at runtime, not hardcoded
3. LLM reasons about fit — understands business model, not just keyword text
4. Clustering discovers topics — HDBSCAN finds what's there, no templates

---

*Document created: 2026-05-06*  
*This supersedes all previous cost and LLM architecture documents.*
