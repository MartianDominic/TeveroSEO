# Keyword Intelligence System - Deep Audit

**Date:** 2026-04-30
**Auditor:** Claude Opus 4.5
**Scope:** Complete audit of existing keyword expansion, model cascading, and prospect-to-keyword flow

---

## 1. DataForSEO Integration Status

### Implemented Endpoints

| Endpoint | Implemented | Wired to UI | Location |
|----------|-------------|-------------|----------|
| `/v3/keywords_data/google_ads/search_volume/live` | Yes | Yes | `dataforseo.ts:77-134` |
| `/v3/dataforseo_labs/google/related_keywords/live` | Yes | Partial | `dataforseo.ts:143-162` |
| `/v3/dataforseo_labs/google/keyword_suggestions/live` | Yes | Partial | `dataforseo.ts:167-185` |
| `/v3/dataforseo_labs/google/keyword_ideas/live` | Yes | Partial | `dataforseo.ts:190-208` |
| `/v3/dataforseo_labs/google/domain_rank_overview/live` | Yes | Yes | `dataforseo.ts:213-230` |
| `/v3/dataforseo_labs/google/ranked_keywords/live` | Yes | Yes | `dataforseo.ts:235-254` |
| `/v3/serp/google/organic/live/regular` | Yes | Yes | `dataforseo.ts:263-280` |
| `/v3/on_page/instant_pages` | Yes | Yes | `dataforseo.ts:296-322` |
| `/v3/dataforseo_labs/google/domain_intersection/live` | Yes | Yes | `dataforseoKeywordGap.ts:142-218` |
| `/v3/dataforseo_labs/google/competitors_domain` | Yes | Yes | `dataforseoClient.ts` |
| `/v3/keywords_data/google_ads/keywords_for_site/live` | No | No | - |
| `/v3/serp/google/autocomplete/live` | **No** | No | - |
| `/v3/dataforseo_labs/google/people_also_ask/live` | **No** | No | - |
| `/v3/serp/google/related_searches/live` | **No** | No | - |

### Key Finding: Missing Expansion Sources

The system lacks three critical keyword expansion endpoints:
1. **Autocomplete** - Real-time Google suggestions
2. **People Also Ask (PAA)** - Question-based keyword mining
3. **Related Searches** - Bottom-of-SERP expansions

PAA extraction exists only within SERP analysis (`SerpAnalyzer.ts`) for content briefs, not as a dedicated keyword expansion source.

### Code Snippets

**Related Keywords (implemented)**:
```typescript
// dataforseo.ts:143-162
export async function fetchRelatedKeywordsRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  depth?: number
): Promise<DataforseoApiResponse<LabsKeywordDataItem[]>>
```

---

## 2. Model Cascade Architecture

### Current Cascade Flow

```
                    classify(keyword, categories)
                              |
                              v
               +--------------+---------------+
               |    Claude Circuit Open?       |
               +--------------+---------------+
                      |               |
                     No              Yes
                      |               |
                      v               v
              +-------+-------+      Skip to OpenAI
              | Try Claude    |
              | (Sonnet 4)    |
              +-------+-------+
                      |
               Success? ----No---> Record failure
                      |                  |
                     Yes                 v
                      |          +-------+-------+
                      v          | OpenAI Circuit|
               Return result     | Open?        |
                                 +-------+-------+
                                        |
                               No       |      Yes
                                |       |       |
                                v       |       v
                        +-------+       |    Skip to Rules
                        | Try GPT      |
                        | 4o-mini      |
                        +-------+       |
                                |       |
                         Success?  ----No---> Record failure
                                |                  |
                               Yes                 v
                                |          +-------+-------+
                                v          | Rule-Based    |
                         Return result     | Classifier    |
                                           +-------+-------+
                                                   |
                                                   v
                                            Return result
```

### Models Used

| Layer | Model | Purpose | Timeout | Retries |
|-------|-------|---------|---------|---------|
| Primary | `claude-sonnet-4-20250514` | Lithuanian keyword classification | 120s | 1 |
| Fallback | `gpt-4o-mini` | Cost-effective fallback | 120s | 1 |
| Last Resort | Rule-based (regex) | Always available | N/A | N/A |

### Circuit Breaker Configuration

```typescript
// ResilientClassifier.ts:430-440
this.claudeCircuit = new CircuitBreaker({
  name: "claude-classifier",
  failureThreshold: 3,    // Open after 3 failures
  resetTimeout: 60000,    // Try again after 60s
});

this.openaiCircuit = new CircuitBreaker({
  name: "openai-classifier",
  failureThreshold: 5,    // More lenient
  resetTimeout: 120000,   // Try again after 120s
});
```

### Rule-Based Fallback

Lithuanian e-commerce patterns for hair care domain:
```typescript
// ResilientClassifier.ts:69-111
private static readonly PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  category: string;
  confidence: number;
}> = [
  { pattern: /šampūn/i, category: "Šampūnai", confidence: 0.9 },
  { pattern: /kondicion/i, category: "Kondicionieriai", confidence: 0.9 },
  // ... 30+ patterns for Lithuanian hair care
];
```

---

## 3. Adaptiveness Assessment

### Is the System Adaptive/Intelligent?

**Rating: 3/10 - Fixed Pipeline**

The current system is a **fixed pipeline**, not an adaptive/intelligent system:

| Aspect | Adaptive? | Details |
|--------|-----------|---------|
| API Source Selection | **No** | All endpoints called in fixed order |
| Depth of Expansion | **No** | Fixed limits (e.g., limit: 100) |
| Context-Aware Routing | **No** | No analysis of prospect needs |
| Dynamic Model Selection | **No** | Always tries Claude first |
| Budget-Aware | **No** | No cost optimization logic |

### What Decisions Are Made Dynamically

1. **Circuit breaker fallback** - If Claude fails 3x, skip to OpenAI
2. **Cache hits** - Skip API calls for cached metrics (7-day TTL)
3. **CSV import skip** - Don't enrich if CSV already has metrics

### What's Hardcoded

1. **Expansion sources** - Always calls the same endpoints
2. **Limits** - Fixed at 100, 1000, etc.
3. **Location/Language** - Defaults to Lithuania (2440) unless overridden
4. **Competitor count** - Fixed at 3 competitors for gap analysis
5. **Confidence thresholds** - 0.5 for gap detection
6. **Batch sizes** - 1000 for enrichment, 5 for classification

### Missing Adaptive Capabilities

The system cannot:
- Detect "this is a local business" and prioritize local keywords
- Recognize "high-intent commercial" and dive deeper into product keywords
- Identify "content-heavy site" and expand question-based keywords
- Adapt expansion depth based on keyword opportunity scores
- Choose cheaper APIs when volume is low

---

## 4. Prospect to Keyword Flow

### Complete Flow Trace

```
STEP 1: Prospect Creation
├── File: ProspectService.ts
├── Input: domain, workspaceId, optional company info
└── Output: Prospect record with normalized domain

STEP 2: Conversation Extraction (Optional)
├── File: ConversationExtractor.ts
├── Input: Sales call transcript / email / notes
├── Process: Claude extracts business info
└── Output: businessName, industry, services, targetAudience, keywords, confidence

STEP 3: Prospect Analysis
├── File: ProspectAnalysisService.ts
├── Sub-steps:
│   ├── 3a. Competitor Discovery
│   │   ├── API: competitors_domain endpoint
│   │   ├── Filter: MIN_INTERSECTIONS = 10
│   │   └── Output: Top 3 competitors
│   │
│   ├── 3b. Keyword Gap Analysis
│   │   ├── API: domain_intersection (per competitor)
│   │   ├── Mode: missing_keywords_in_domain_2
│   │   └── Output: Deduplicated keyword gaps
│   │
│   └── 3c. Gap Scoring
│       ├── trafficPotential = searchVolume * cpc * (100 - difficulty) / 100
│       ├── achievability = 100 - max(0, difficulty - DA)
│       └── classification: quick_win | strategic | long_tail | standard

STEP 4: Keyword Enrichment
├── File: KeywordEnrichmentService.ts
├── Cache: 7-day Redis cache (CACHE_NS.KEYWORD)
├── API: search_volume/live (batches of 1000)
├── Skip: CSV imports with existing metrics
└── Output: searchVolume, keywordDifficulty, cpc, competition

STEP 5: Keyword Classification (Optional)
├── File: KeywordIntelligenceService.ts
├── Uses: ResilientClassifier (Claude -> GPT -> Rules)
├── Process: Map keywords to product categories
└── Output: category, confidence, isGap, suggestedCategory

STEP 6: Business Priority Parsing (Optional)
├── File: BusinessPriorityParser.ts
├── Input: Natural language business priorities
├── Model: Claude Sonnet with XML prompt template
└── Output: FocusDirective with scoring weights
```

### Key Files by Function

| Function | Primary File | Supporting Files |
|----------|--------------|------------------|
| Prospect CRUD | `ProspectService.ts` | `prospect-schema.ts` |
| NLP Extraction | `ConversationExtractor.ts` | - |
| Competitor Discovery | `ProspectAnalysisService.ts` | `dataforseoClient.ts` |
| Gap Analysis | `ProspectAnalysisService.ts` | `dataforseoKeywordGap.ts` |
| Metric Enrichment | `KeywordEnrichmentService.ts` | `dataforseo.ts` |
| Classification | `ResilientClassifier.ts` | `CircuitBreaker.ts` |
| Orchestration | `KeywordIntelligenceService.ts` | All above |
| Priority Parsing | `BusinessPriorityParser.ts` | `focus-directive.ts` |

### What's Automated vs Manual

| Step | Automated | Manual Trigger |
|------|-----------|----------------|
| Domain normalization | Yes | - |
| Conversation extraction | No | User pastes text |
| Competitor discovery | Yes (on analysis) | User triggers analysis |
| Gap analysis | Yes (on analysis) | User triggers analysis |
| Metric enrichment | Yes (batch) | Triggered by import/analysis |
| Classification | Yes (in pipeline) | - |
| Priority parsing | No | User provides priorities |

---

## 5. World-Class Assessment

### Overall Rating: 5/10

### Scoring Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| DataForSEO Coverage | 6/10 | Core endpoints present, missing autocomplete/PAA/related |
| Model Cascade | 8/10 | Well-designed fallback with circuit breakers |
| Adaptiveness | 3/10 | Fixed pipeline, no context-aware routing |
| Prospect Flow | 6/10 | Complete but manual, no auto-expansion triggers |
| Gap Detection | 7/10 | Good scoring, achievability, classification |
| Caching | 7/10 | 7-day Redis cache, cost tracking |
| Resilience | 8/10 | Circuit breakers, retries, fallbacks |
| Code Quality | 8/10 | TypeScript, Zod validation, good separation |

### What's Missing to Be World-Class

1. **Autocomplete Endpoint** - Missing real-time Google suggestions
2. **PAA Keyword Mining** - Only used for briefs, not expansion
3. **Related Searches** - Not implemented at all
4. **Adaptive Expansion** - System doesn't analyze prospect context to decide what APIs to call
5. **Deep Dive Capability** - Can't "go deeper" on high-opportunity keyword clusters
6. **Intent Classification** - No informational/navigational/transactional classification
7. **Cost Optimization** - No cheaper-first API strategy
8. **Real-Time Triggers** - No auto-expansion on keyword approval
9. **Competitor Monitoring** - One-time analysis, no ongoing tracking
10. **Semantic Clustering** - Basic prefix clustering, not embedding-based

### Specific Gaps by Category

**Keyword Expansion:**
- No autocomplete mining
- No PAA question extraction for keyword generation
- No related searches integration
- Fixed expansion limits regardless of opportunity

**Intelligence:**
- No prospect-type detection (local, e-commerce, B2B, etc.)
- No budget-aware API selection
- No opportunity-based depth adjustment
- No user behavior learning

**Flow Automation:**
- Manual triggers for most expansion
- No webhook-triggered enrichment
- No scheduled re-analysis
- No automatic competitor monitoring

### Priority Gaps to Address

1. **HIGH:** Add autocomplete/PAA/related searches endpoints
2. **HIGH:** Build adaptive router that analyzes prospect context
3. **MEDIUM:** Implement intent classification for keywords
4. **MEDIUM:** Add deep-dive capability for high-value clusters
5. **LOW:** Cost optimization / cheaper-first strategy
6. **LOW:** Real-time expansion triggers

---

## Appendix: File Locations

```
open-seo-main/src/server/lib/
├── dataforseo.ts                    # Core DataForSEO client
├── dataforseoKeywordGap.ts          # Gap analysis + scoring
├── dataforseoClient.ts              # SDK wrapper
├── dataforseoSchemas.ts             # Zod schemas
├── dataforseo-auth.ts               # Authentication

open-seo-main/src/server/features/keywords/
├── services/
│   ├── BusinessPriorityParser.ts    # NLP priority extraction
│   ├── ResilientClassifier.ts       # Model cascade
│   ├── KeywordEnrichmentService.ts  # Metric enrichment
│   ├── KeywordIntelligenceService.ts # Main orchestrator
│   ├── EmbeddingService.ts          # Semantic embeddings
│   └── LithuanianNormalizer.ts      # Morphology handling

open-seo-main/src/server/features/prospects/
├── services/
│   ├── ProspectService.ts           # CRUD operations
│   ├── ProspectAnalysisService.ts   # Gap analysis
│   ├── ConversationExtractor.ts     # NLP extraction
│   └── PipelineService.ts           # Status management
```
