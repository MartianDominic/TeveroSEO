# World-Class AI Architecture for TeveroSEO

> **Generated:** 2026-04-26
> **Purpose:** Design optimal multi-pass AI system for keyword analysis, proposals, and automation

---

## Executive Summary

**Don't pick one model. Use the right model for each job.**

| Task | Best Model | Why | Cost/1M tokens |
|------|------------|-----|----------------|
| **Fast pre-filter** | Gemini 2.5 Flash-Lite | Cheapest, fast enough | $0.10 in / $0.40 out |
| **Classification** | GPT-4o-mini | Best price/quality ratio | $0.15 in / $0.60 out |
| **Lithuanian content** | GPT-4o | Best Baltic language support | $2.50 in / $10.00 out |
| **Complex reasoning** | Claude Sonnet 4.6 | Best reasoning + 90% cache | $3.00 in / $15.00 out |
| **Entity extraction** | Claude Sonnet 4.6 | Superior structured output | $3.00 in / $15.00 out |
| **Embeddings** | Local (txtai) | Free, fast | $0.00 |

**Cost projection:** $2-7/month for 100K keywords (with optimization)

---

## The Multi-Pass Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEYWORD ANALYSIS PIPELINE                          │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  3000 Keywords  │
                              │  from DataForSEO│
                              └────────┬────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASS 0: EMBEDDING PRE-FILTER (Local txtai)                     COST: $0    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Compare keyword embedding to business context embedding                   │
│  • Filter out similarity < 0.35                                             │
│  • Speed: ~5000 keywords/second                                             │
│  • Output: 3000 → 800 candidates (70% filtered)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASS 1: FAST CLASSIFICATION (Gemini 2.5 Flash-Lite)         COST: ~$0.50   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Binary classification: LIKELY_RELEVANT | NEEDS_REVIEW                    │
│  • Batch API (50% off) + implicit caching (75% off) = 87.5% savings         │
│  • Context: Business name + top 5 product categories (cached)               │
│  • Output: 800 → 200 LIKELY_RELEVANT + 150 NEEDS_REVIEW (55% filtered)      │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          │                         │
                          ▼                         ▼
              ┌───────────────────┐     ┌───────────────────┐
              │  200 LIKELY       │     │  150 NEEDS        │
              │  (High confidence)│     │  REVIEW           │
              └─────────┬─────────┘     └─────────┬─────────┘
                        │                         │
                        │                         ▼
                        │         ┌───────────────────────────────────────────┐
                        │         │  PASS 2: DETAILED CLASSIFICATION          │
                        │         │  (GPT-4o-mini)                COST: ~$0.20│
                        │         │  ─────────────────────────────────────────│
                        │         │  • 4-way: RELEVANT | TANGENT | IRRELEVANT │
                        │         │           | COMPETITOR                     │
                        │         │  • Includes confidence score 0.0-1.0      │
                        │         │  • Matches to specific category           │
                        │         │  • Output: 150 → 80 RELEVANT + 30 TANGENT │
                        │         └───────────────────────────────────────────┘
                        │                         │
                        ▼                         ▼
              ┌───────────────────────────────────────────────┐
              │            280 RELEVANT KEYWORDS              │
              │         (200 high-conf + 80 verified)         │
              └───────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASS 3: PAGE MAPPING (Claude Haiku)                         COST: ~$0.15   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Classify page types: category | product | blog | landing                 │
│  • 1:1 keyword-to-page assignment (Kyle Roof rule)                          │
│  • Detect conflicts: "3 keywords want this page"                            │
│  • Uses 90% prompt caching (business context cached)                        │
│  • Output: 280 keywords mapped to ~200 unique pages                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASS 4: USER REFINEMENT (Claude Sonnet)              COST: ~$0.05/message  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Natural language: "focus on categories, need 200 keywords"               │
│  • Translates to filters: intent=commercial, limit=200                      │
│  • Iterative refinement: "exclude competitor brands"                        │
│  • Final approval before export                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Final Output:  │
                              │  200 Keywords   │
                              │  1:1 Mapped     │
                              │  AI-Verified    │
                              └─────────────────┘

TOTAL COST PER PROSPECT: ~$0.90 (with all optimizations)
```

---

## Model Selection Matrix

### By Task Type

| Task | Primary | Fallback | Why Primary Wins |
|------|---------|----------|------------------|
| **Embedding similarity** | txtai (local) | OpenAI ada-002 | Free, fast, good enough |
| **Binary classification** | Gemini Flash-Lite | GPT-4o-mini | 87.5% savings with batch+cache |
| **Multi-class classification** | GPT-4o-mini | Claude Haiku | Best structured output |
| **Entity extraction** | Claude Sonnet | GPT-4o | Superior tool use |
| **Lithuanian text** | GPT-4o | Gemini Pro | Best Baltic benchmarks |
| **Proposal generation** | Gemini Pro (LT) | Claude Sonnet | Already integrated for LT |
| **Complex reasoning** | Claude Sonnet | GPT-4o | Best reasoning chains |
| **User chat** | Claude Sonnet | GPT-4o | Best conversation quality |

### By Cost Tier

| Tier | Models | Use For | Cost Range |
|------|--------|---------|------------|
| **Free** | txtai, local Llama | Embeddings, pre-filter | $0 |
| **Cheap** | Gemini Flash-Lite, Ministral 8B | High-volume classification | $0.10-0.50/M |
| **Balanced** | GPT-4o-mini, Gemini Flash | Quality classification | $0.15-0.60/M |
| **Premium** | Claude Sonnet, GPT-4o | Complex reasoning | $3-10/M |
| **Expert** | Claude Opus, GPT-5 | Critical decisions | $5-25/M |

---

## Cost Optimization Strategies

### Strategy 1: Batch Processing

```python
# Instead of real-time calls...
for keyword in keywords:
    result = classify(keyword)  # $0.003 each = $9 for 3000

# Use batch API (50% off)
batch_results = classify_batch(keywords)  # $4.50 for 3000
```

**Providers with batch:**
- Anthropic: 50% off, 24h SLA
- OpenAI: 50% off (Batch) or 50% off with faster SLA (Flex)
- Google: 50% off, implicit caching stacks

### Strategy 2: Prompt Caching

```python
# Anthropic prompt caching (90% savings on cached portion)
system_prompt = {
    "type": "text",
    "text": f"""You classify keywords for {business_name}.
    
    Products: {products}  # ~2000 tokens
    Categories: {categories}
    
    Classification rules: ...""",
    "cache_control": {"type": "ephemeral"}  # Cache this part
}

# Per keyword: only ~50 tokens uncached
user_message = f"Classify: {keyword}"

# Cost breakdown for 3000 keywords:
# - Cache write (once): 2000 tokens × $3.75/M = $0.0075
# - Cache reads (2999×): 2000 × 2999 × $0.30/M = $1.80
# - Uncached (3000×): 50 × 3000 × $3.00/M = $0.45
# - Output: 30 × 3000 × $15.00/M = $1.35
# TOTAL: $3.60 vs $18+ without caching (80% savings)
```

### Strategy 3: Cascade Architecture

```
Pass 1 (90% of traffic): Cheap model → Done
Pass 2 (9% of traffic): Medium model → Done  
Pass 3 (1% of traffic): Premium model → Done

Cost = 0.9 × $0.001 + 0.09 × $0.01 + 0.01 × $0.10
     = $0.0009 + $0.0009 + $0.001
     = $0.0028 per keyword (vs $0.01 flat)

70% cost reduction with same quality.
```

### Strategy 4: Smart Batching Windows

```python
# Queue keywords throughout the day
keyword_queue.add(keyword, priority="normal")

# Run batch at optimal times
@scheduler.cron("0 */4 * * *")  # Every 4 hours
async def process_keyword_batch():
    pending = await keyword_queue.get_pending(limit=1000)
    
    if len(pending) < 100:
        return  # Wait for more to maximize batch efficiency
    
    # Use batch API for 50% savings
    results = await gemini.batch_classify(pending)
    await store_results(results)
```

---

## Implementation: Keyword Classification Service

### File Structure

```
open-seo-main/src/server/features/keyword-intelligence/
├── services/
│   ├── KeywordIntelligenceOrchestrator.ts  # Main orchestrator
│   ├── EmbeddingPreFilter.ts               # Pass 0: txtai
│   ├── FastClassifier.ts                   # Pass 1: Gemini Flash-Lite
│   ├── DetailedClassifier.ts               # Pass 2: GPT-4o-mini
│   ├── PageMapper.ts                       # Pass 3: Claude Haiku
│   └── UserGuidanceChat.ts                 # Pass 4: Claude Sonnet
├── models/
│   ├── BusinessContext.ts
│   ├── ClassifiedKeyword.ts
│   └── KeywordPageMapping.ts
├── prompts/
│   ├── fast-classify.txt
│   ├── detailed-classify.txt
│   └── page-mapping.txt
└── index.ts
```

### Core Orchestrator

```typescript
// KeywordIntelligenceOrchestrator.ts

import { TxtaiService } from '@/ai-writer/services/txtai_service';
import { GeminiClient } from '@/lib/gemini';
import { OpenAIClient } from '@/lib/openai';
import { AnthropicClient } from '@/lib/anthropic';

interface ClassificationPipeline {
  pass0_embedding: TxtaiService;      // Local embeddings (FREE)
  pass1_fast: GeminiClient;            // Gemini Flash-Lite ($0.10/$0.40)
  pass2_detailed: OpenAIClient;        // GPT-4o-mini ($0.15/$0.60)
  pass3_mapping: AnthropicClient;      // Claude Haiku ($1.00/$5.00)
  pass4_chat: AnthropicClient;         // Claude Sonnet ($3.00/$15.00)
}

export class KeywordIntelligenceOrchestrator {
  private pipeline: ClassificationPipeline;
  
  async analyzeKeywords(
    keywords: DataForSEOKeyword[],
    businessContext: BusinessContext,
    userGuidance?: string
  ): Promise<ClassifiedKeywordSet> {
    
    // PASS 0: Embedding pre-filter (FREE, ~5000/sec)
    const embeddings = await this.pipeline.pass0_embedding.batchEmbed(
      keywords.map(k => k.keyword)
    );
    const businessEmbedding = await this.getOrCreateBusinessEmbedding(businessContext);
    
    const pass0Results = keywords.filter((kw, i) => {
      const similarity = cosineSimilarity(embeddings[i], businessEmbedding);
      return similarity >= 0.35;
    });
    
    console.log(`Pass 0: ${keywords.length} → ${pass0Results.length} (${Math.round(pass0Results.length/keywords.length*100)}%)`);
    
    // PASS 1: Fast classification (Gemini Flash-Lite, batch)
    const pass1Results = await this.pipeline.pass1_fast.batchClassify({
      keywords: pass0Results,
      context: this.buildFastContext(businessContext),
      schema: FAST_CLASSIFICATION_SCHEMA,  // LIKELY_RELEVANT | NEEDS_REVIEW
      batchOptions: { maxConcurrent: 100, cachePrefix: businessContext.id }
    });
    
    const likelyRelevant = pass1Results.filter(r => r.classification === 'LIKELY_RELEVANT');
    const needsReview = pass1Results.filter(r => r.classification === 'NEEDS_REVIEW');
    
    console.log(`Pass 1: ${pass0Results.length} → ${likelyRelevant.length} likely + ${needsReview.length} review`);
    
    // PASS 2: Detailed classification for uncertain (GPT-4o-mini)
    const pass2Results = await this.pipeline.pass2_detailed.batchClassify({
      keywords: needsReview,
      context: this.buildDetailedContext(businessContext),
      schema: DETAILED_CLASSIFICATION_SCHEMA,  // 4-way classification
      batchOptions: { useBatchAPI: true }  // 50% off
    });
    
    const allRelevant = [
      ...likelyRelevant,
      ...pass2Results.filter(r => r.classification === 'RELEVANT')
    ];
    
    console.log(`Pass 2: Combined ${allRelevant.length} relevant keywords`);
    
    // PASS 3: Page mapping (Claude Haiku with caching)
    const sitePages = await this.getSitePages(businessContext.clientId);
    const mappings = await this.pipeline.pass3_mapping.mapKeywordsToPages({
      keywords: allRelevant,
      pages: sitePages,
      rules: KYLE_ROOF_MAPPING_RULES,
      cacheControl: { type: 'ephemeral', prefix: businessContext.id }  // 90% savings
    });
    
    // PASS 4: User refinement if guidance provided
    if (userGuidance) {
      const filters = await this.pipeline.pass4_chat.parseGuidance(userGuidance);
      return this.applyFilters(mappings, filters);
    }
    
    return mappings;
  }
}
```

### Prompt Templates

```typescript
// prompts/fast-classify.txt (Pass 1 - Gemini Flash-Lite)
// Optimized for speed and cost - minimal context

const FAST_CLASSIFY_PROMPT = `
Business: {{businessName}} ({{businessType}})
Top categories: {{categories}}

For each keyword, respond ONLY with:
- LIKELY_RELEVANT if it relates to these categories
- NEEDS_REVIEW if uncertain

Keywords:
{{#each keywords}}
{{@index}}. {{this}}
{{/each}}

Respond as JSON array: [{"i": 0, "c": "LIKELY_RELEVANT"}, ...]
`;

// prompts/detailed-classify.txt (Pass 2 - GPT-4o-mini)
// More context for nuanced classification

const DETAILED_CLASSIFY_PROMPT = `
You classify keywords for an SEO analysis.

## Business Profile
- Name: {{businessName}}
- Website: {{domain}}
- Type: {{businessType}}
- Products: {{products}}
- Services: {{services}}

## Classification Rules
- RELEVANT: Directly relates to products/services sold
- TANGENTIAL: Related industry topic, good for content
- IRRELEVANT: No meaningful connection
- COMPETITOR: Mentions competitor brand/product

## Output Format
{
  "keyword": "string",
  "classification": "RELEVANT" | "TANGENTIAL" | "IRRELEVANT" | "COMPETITOR",
  "confidence": 0.0-1.0,
  "matchedCategory": "string or null",
  "reason": "brief explanation"
}

Classify these keywords:
{{#each keywords}}
- {{this.keyword}} (volume: {{this.volume}}, intent: {{this.intent}})
{{/each}}
`;

// prompts/page-mapping.txt (Pass 3 - Claude Haiku)
// Page type classification + 1:1 mapping

const PAGE_MAPPING_PROMPT = `
{{! This section is cached - 90% savings }}
<system_context cache_control="ephemeral">
You map keywords to website pages following Kyle Roof's SEO rules:
1. One primary keyword per page
2. Category pages target category keywords
3. Product pages target specific product keywords
4. Blog pages target informational keywords
5. Never assign multiple high-volume keywords to same page

Business: {{businessName}}
Site structure:
{{#each sitePages}}
- {{this.url}} (type: {{this.pageType}}, title: {{this.title}})
{{/each}}
</system_context>

{{! This section is NOT cached - variable per request }}
Map these keywords to pages:
{{#each keywords}}
- {{this.keyword}} (volume: {{this.volume}}, classification: {{this.classification}})
{{/each}}

Output as JSON:
[{
  "keyword": "string",
  "targetUrl": "string or null",
  "action": "optimize" | "create",
  "confidence": 0.0-1.0,
  "conflicts": ["other keywords targeting same page"]
}]
`;
```

---

## User Guidance Chat Interface

### Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Keyword Analysis: plaukupasaka.lt                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────┐  ┌──────────────┐ │
│  │ Keywords Table                          │  │ AI Assistant │ │
│  │ ──────────────────────────────────────  │  │              │ │
│  │ [x] plaukų priežiūra       1200  comm   │  │ Found 280    │ │
│  │ [x] plaukų dažai           890   comm   │  │ relevant     │ │
│  │ [x] šampūnas               2100  comm   │  │ keywords for │ │
│  │ [ ] konkurentas X          500   brand  │  │ plaukupasaka │ │
│  │ [x] plaukų kaukė           670   comm   │  │              │ │
│  │                                         │  │ 3 map to     │ │
│  │ Showing 280 of 3000                     │  │ same page.   │ │
│  │                                         │  │              │ │
│  │ [Apply] [Export] [Map to Pages]         │  │ ────────────│ │
│  └─────────────────────────────────────────┘  │              │ │
│                                               │ > Focus on   │ │
│                                               │   categories │ │
│                                               │   200 max    │ │
│                                               │              │ │
│                                               │ ────────────│ │
│                                               │ Filtering to │ │
│                                               │ commercial   │ │
│                                               │ intent...    │ │
│                                               │              │ │
│                                               │ [Send]       │ │
│                                               └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Natural Language → Filters

```typescript
// UserGuidanceChat.ts

const GUIDANCE_PARSER_PROMPT = `
You translate natural language requests into structured keyword filters.

Available filters:
- intent: transactional | commercial | informational | navigational
- classification: RELEVANT | TANGENTIAL
- minVolume: number
- maxVolume: number
- categories: string[] (match to business categories)
- excludeCompetitors: boolean
- limit: number
- sortBy: volume | relevance | difficulty

User request: "{{userMessage}}"

Output JSON:
{
  "filters": { ... },
  "explanation": "brief description of what will be filtered"
}
`;

// Example translations:
// "Focus on categories, need about 200" 
//   → { intent: ["commercial", "transactional"], limit: 200 }
//
// "Only high volume hair care keywords"
//   → { minVolume: 500, categories: ["hair care"] }
//
// "Remove competitor brand mentions"
//   → { excludeCompetitors: true }
```

---

## Cost Projections

### Per Prospect Analysis (3000 keywords)

| Pass | Model | Input Tokens | Output Tokens | Base Cost | With Savings | Final Cost |
|------|-------|--------------|---------------|-----------|--------------|------------|
| 0 | txtai (local) | N/A | N/A | $0.00 | $0.00 | **$0.00** |
| 1 | Gemini Flash-Lite | 120K | 15K | $0.018 | 87.5% off | **$0.002** |
| 2 | GPT-4o-mini | 22K | 6K | $0.007 | 50% batch | **$0.004** |
| 3 | Claude Haiku | 40K | 8K | $0.080 | 90% cache | **$0.008** |
| 4 | Claude Sonnet | 5K | 1K | $0.030 | - | **$0.030** |
| **Total** | | | | $0.135 | | **$0.044** |

### Monthly Volume (100 prospects)

| Scenario | Keywords | Cost/Prospect | Monthly Cost |
|----------|----------|---------------|--------------|
| Low volume | 100 × 3000 | $0.044 | **$4.40** |
| Medium volume | 500 × 3000 | $0.044 | **$22.00** |
| High volume | 2000 × 3000 | $0.044 | **$88.00** |

**Compare to single-model approach:**
- Claude Sonnet for all: $18/prospect × 100 = $1,800/month
- Multi-pass approach: $4.40/month
- **Savings: 99.8%**

---

## Why NOT Just Use One Model?

### Argument: "Just use Claude for everything"

| Approach | Monthly Cost (100 prospects) | Quality | Latency |
|----------|------------------------------|---------|---------|
| Claude Opus for all | $4,500 | Overkill | 2-3s/keyword |
| Claude Sonnet for all | $1,800 | Good but expensive | 1-2s/keyword |
| GPT-4o for all | $1,200 | Good | 1s/keyword |
| **Multi-pass** | **$4.40** | Same quality | 0.2s/keyword avg |

### Argument: "Grok has real-time data"

- Grok's strength is X/Twitter integration and current events
- Keywords don't need real-time data
- Grok's pricing ($3/$15) isn't competitive for classification
- **Verdict:** Not useful for this task

### Argument: "Self-host Llama"

- Break-even at ~2M tokens/day
- 100 prospects × 3000 keywords × 200 tokens = 60M tokens/month = 2M/day
- At this volume, consider Llama 3.3 70B for Pass 1
- But API is simpler to operate below 2M/day

---

## Recommended Model Mix for TeveroSEO

```
┌─────────────────────────────────────────────────────────────────┐
│                    TeveroSEO AI Model Mix                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  KEYWORD INTELLIGENCE                                            │
│  ├─ Pass 0: txtai (local)         ← FREE                        │
│  ├─ Pass 1: Gemini 2.5 Flash-Lite ← $0.10/$0.40 + 87.5% savings │
│  ├─ Pass 2: GPT-4o-mini           ← $0.15/$0.60 + 50% batch     │
│  ├─ Pass 3: Claude Haiku          ← $1.00/$5.00 + 90% cache     │
│  └─ Pass 4: Claude Sonnet         ← $3.00/$15.00 (chat only)    │
│                                                                  │
│  BUSINESS EXTRACTION                                             │
│  └─ Claude Sonnet                 ← Best entity extraction      │
│                                                                  │
│  PROPOSALS (Lithuanian)                                          │
│  └─ Gemini 1.5 Pro               ← Already integrated for LT    │
│                                                                  │
│  QUALITY GATE                                                    │
│  └─ Claude Sonnet                ← Nuanced content judgment     │
│                                                                  │
│  VOICE MATCHING                                                  │
│  └─ Claude Haiku                 ← Cheap + 90% cache            │
│                                                                  │
│  USER CHAT                                                       │
│  └─ Claude Sonnet                ← Best conversation quality    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Week 1: Core Pipeline
1. **Day 1-2:** Set up Gemini Flash-Lite client with batch API
2. **Day 3-4:** Integrate with existing txtai for Pass 0
3. **Day 5:** Wire GPT-4o-mini for Pass 2

### Week 2: Optimization
1. **Day 1-2:** Implement Claude prompt caching for Pass 3
2. **Day 3-4:** Add batch queuing system
3. **Day 5:** Cost monitoring dashboard

### Week 3: User Experience
1. **Day 1-3:** Build chat sidebar component
2. **Day 4-5:** Guidance parser with Claude Sonnet

### Week 4: Integration
1. **Day 1-2:** Connect to existing prospect analysis flow
2. **Day 3-4:** End-to-end testing
3. **Day 5:** Documentation and launch

---

## Summary

| Question | Answer |
|----------|--------|
| **Claude or Gemini?** | Both. Gemini for cheap bulk, Claude for quality reasoning. |
| **What about Grok?** | Skip. Not cost-effective for classification. |
| **Multi-pass worth it?** | Yes. 99.8% cost savings with same quality. |
| **Self-host Llama?** | Only above 2M tokens/day. API is simpler below that. |
| **Which Claude model?** | Haiku for bulk (with cache), Sonnet for reasoning, Opus rarely. |
| **Which Gemini model?** | Flash-Lite for classification, Pro for Lithuanian proposals. |

**The world-class approach: Use the right model for each job, cascade from cheap to expensive, and maximize caching.**
