# Phase 56: Complete Infrastructure Audit Synthesis

**Date:** 2026-05-01  
**Auditor:** Claude Opus 4.5  
**Scope:** Full audit of keyword intelligence + crawling infrastructure vs both infra research docs  
**Decision:** Option A — Full Infrastructure Alignment

---

## Audit Documents Created

| Document | Focus | Key Finding |
|----------|-------|-------------|
| `56-AUDIT-DATAFORSEO.md` | DataForSEO endpoints | 17 implemented, missing autocomplete/PAA/related |
| `56-AUDIT-MODEL-CASCADE.md` | LLM orchestration | 7/10, good circuit breakers, no adaptive selection |
| `56-AUDIT-PROSPECT-FLOW.md` | End-to-end flow | 5/10, fixed pipeline not intelligent agent |
| `56-AUDIT-EXISTING-SYSTEM.md` | Deep system review | 5/10 overall, 3/10 adaptiveness |
| `56-INFRA-GAPS.md` | vs cpu-only-rag-graph.md | +39h delta for RAG/embeddings |
| `56-AUDIT-ARQ-SINGLEFLIGHT.md` | Task queue + dedup | BullMQ exists, no crawl singleflight |
| `56-AUDIT-DELTA-CRAWLING.md` | 4-layer delta cascade | Schema exists, 0% implemented |
| `56-AUDIT-TASK-DECOMPOSITION.md` | 6 task shapes + lanes | 50% implemented, no lane separation |
| `56-AUDIT-PROXY-ANTIBOT.md` | Proxy + anti-bot | Managed service, missing consent detection |
| `56-AUDIT-SHARED-CACHE.md` | Cache flywheel | 60% implemented, missing crawl dedup |

---

## Executive Summary

The existing TeveroSEO keyword intelligence system is a **production-grade fixed pipeline** rated **5/10** overall. It has solid foundations (model cascade, circuit breakers, billing integration) but lacks the **adaptive intelligence** needed to match the "Claude Code pattern" of seeing user intent and selecting appropriate tools dynamically.

### Key Metrics

| Dimension | Score | Assessment |
|-----------|-------|------------|
| DataForSEO Coverage | 6/10 | 17 endpoints, missing autocomplete/PAA/related |
| Model Cascade | 8/10 | Claude → GPT-4o-mini → Rules with circuit breakers |
| Adaptiveness | **3/10** | Fixed pipeline, no context-aware routing |
| Infrastructure vs cpu-only-rag-graph.md | **2/10** | No LightRAG, FalkorDB, embeddings, pgvector |
| Code Quality | 7-8/10 | TypeScript, Zod validation, billing integration |
| **Overall** | **5/10** | Fixed pipeline, not intelligent agent |

### Decision

**Option A: Full Infrastructure Alignment** selected.

- Add LightRAG + FalkorDB + jina-embeddings-v3 + pgvector
- Update 56-05/56-06 with Grok 4.1 (xAI) instead of GPT-4.1-nano
- Add autocomplete/PAA/related searches endpoints
- Build adaptive intent classification layer
- Implement confirm/autonomous toggle
- **Effort delta: +39 hours (+150%)**

---

## Part 1: DataForSEO Integration Audit

**Source:** `56-AUDIT-DATAFORSEO.md`

### Implemented Endpoints (17 total)

| Endpoint | API Path | Status | Location |
|----------|----------|--------|----------|
| Search Volume | `/v3/keywords_data/google_ads/search_volume/live` | ✅ Wired | `dataforseo.ts:77-134` |
| Related Keywords | `/v3/dataforseo_labs/google/related_keywords/live` | ✅ Wired | `dataforseo.ts:143-162` |
| Keyword Suggestions | `/v3/dataforseo_labs/google/keyword_suggestions/live` | ✅ Wired | `dataforseo.ts:167-185` |
| Keyword Ideas | `/v3/dataforseo_labs/google/keyword_ideas/live` | ✅ Wired | `dataforseo.ts:190-208` |
| Domain Rank Overview | `/v3/dataforseo_labs/google/domain_rank_overview/live` | ✅ Wired | `dataforseo.ts:213-230` |
| Ranked Keywords | `/v3/dataforseo_labs/google/ranked_keywords/live` | ✅ Wired | `dataforseo.ts:235-254` |
| Live SERP | `/v3/serp/google/organic/live/regular` | ✅ Wired | `dataforseo.ts:263-280` |
| On-Page Instant Pages | `/v3/on_page/instant_pages` | ✅ Wired | `dataforseo.ts:296-322` |
| Keywords For Site | `/v3/dataforseo_labs/google/keywords_for_site/live` | ✅ Wired | `dataforseoProspect.ts:140-181` |
| Competitors Domain | `/v3/dataforseo_labs/google/competitors_domain/live` | ✅ Wired | `dataforseoProspect.ts:205-245` |
| Domain Intersection | `/v3/dataforseo_labs/google/domain_intersection/live` | ✅ Wired | `dataforseoKeywordGap.ts:142-218` |
| Backlinks Summary | `/v3/backlinks/summary/live` | ✅ Wired | `dataforseoBacklinks.ts` |
| Backlinks Rows | `/v3/backlinks/backlinks/live` | ✅ Wired | `dataforseoBacklinks.ts` |
| Referring Domains | `/v3/backlinks/referring_domains/live` | ✅ Wired | `dataforseoBacklinks.ts` |
| Domain Pages | `/v3/backlinks/domain_pages_summary/live` | ✅ Wired | `dataforseoBacklinks.ts` |
| Backlinks History | `/v3/backlinks/history/live` | ✅ Wired | `dataforseoBacklinks.ts` |
| Lighthouse | `/v3/on_page/lighthouse/live` | ✅ Wired | `dataforseoLighthouse.ts` |

### Missing Endpoints (Critical for Keyword Expansion)

| Endpoint | API Path | Priority | Use Case |
|----------|----------|----------|----------|
| **Autocomplete** | `/v3/keywords_data/google/autocomplete/live` | **HIGH** | Real-time Google suggestions, long-tail gold |
| **People Also Ask** | `/v3/dataforseo_labs/google/bulk_keyword_difficulty/live` | **HIGH** | Question-based keyword mining |
| **Related Searches** | `/v3/serp/google/related_searches/live` | **HIGH** | Bottom-of-SERP expansions |
| Google Trends | `/v3/keywords_data/google_trends/explore/live` | MEDIUM | Seasonality analysis |
| Search Intent | `/v3/dataforseo_labs/google/search_intent/live` | MEDIUM | Reduce LLM classification costs |

### Adaptive Logic Assessment

**Current state:** User manually picks data source via dropdown. No intelligent routing.

```typescript
// research-data.ts:158-181 - STATIC SOURCE SELECTION
if (params.source === "related") {
  return fetchRelatedRows(params, dataforseo);
}
if (params.source === "suggestions") {
  return mapKeywordDataItems(await dataforseo.keywords.suggestions({...}));
}
return mapKeywordDataItems(await dataforseo.keywords.ideas({...}));
```

**Gaps:**
- [ ] No industry-based endpoint selection
- [ ] No result-based adaptive calls (if one source returns few, try another)
- [ ] No parallel querying of multiple sources
- [ ] No budget-aware endpoint selection

### Code Quality: 7/10

**Strengths:**
- Zod schemas for all API responses
- Centralized auth module
- Redis-backed rate limiting (5 req/sec)
- Circuit breaker for cascading failure prevention
- Billing integration via `meterDataforseoCall()`

**Weaknesses:**
- No adaptive selection logic
- No Redis caching for expensive keyword data
- No batch optimization across calls

---

## Part 2: Model Cascade Architecture Audit

**Source:** `56-AUDIT-MODEL-CASCADE.md`

### LLM Inventory

#### open-seo-main (TypeScript)

| Task | Model | File:Line | Fallback | Circuit Breaker |
|------|-------|-----------|----------|-----------------|
| Keyword Classification | claude-sonnet-4-20250514 | `ResilientClassifier.ts:231` | Claude → GPT-4o-mini → Rules | ✅ Per-backend |
| Business Priority Parsing | claude-sonnet-4-20250514 | `BusinessPriorityParser.ts:53` | None | ❌ |
| Conversation Extraction | claude-sonnet-4-20250514 | `ConversationExtractor.ts:19` | None (throws error) | ❌ |
| Voice Preview | claude-sonnet-4-20250514 | `voice.ts:429` | Fallback samples | ❌ |
| Voice Analysis | claude-3-5-sonnet-20241022 | `VoiceAnalyzer.ts:16` | None | ❌ |
| Business Extraction | claude-3-5-sonnet-20241022 | `businessExtractor.ts:18` | None | ❌ |
| Keyword Generation | claude-3-5-sonnet-20241022 | `keywordGenerator.ts:170` | None | ❌ |
| Translation | gemini-1.5-pro | `TranslationService.ts:32` | Retry shorter | ❌ |

#### AI-Writer (Python)

| Task | Model | File:Line | Fallback |
|------|-------|-----------|----------|
| Text Generation | gemini-2.0-flash-001 | `main_text_generation.py:76` | Google → HuggingFace |
| Text Generation | openai/gpt-oss-120b:cerebras | `main_text_generation.py:104` | HuggingFace |

### ResilientClassifier Cascade (Production-Grade)

```
┌─────────────────────────────────────────────────────────────┐
│                    classify(keyword, categories)            │
│                              │                              │
│                              ▼                              │
│               ┌──────────────────────────┐                  │
│               │   Claude Circuit Closed?  │                  │
│               └──────────────────────────┘                  │
│                      │               │                      │
│                     Yes              No                     │
│                      │               │                      │
│                      ▼               ▼                      │
│              ┌───────────────┐     Skip to OpenAI          │
│              │ Claude Sonnet │                              │
│              │ (Primary LLM) │                              │
│              └───────────────┘                              │
│                      │                                      │
│               Success│Failure                               │
│                      │    │                                 │
│                      │    ▼                                 │
│                      │  Record failure → Try OpenAI        │
│                      │                        │             │
│                      ▼                        ▼             │
│               Return result          ┌───────────────┐      │
│                                      │ GPT-4o-mini   │      │
│                                      │ (Fallback)    │      │
│                                      └───────────────┘      │
│                                             │               │
│                                      Success│Failure        │
│                                             │    │          │
│                                             │    ▼          │
│                                             │  Rule-Based   │
│                                             │  (Always OK)  │
│                                             ▼               │
│                                      Return result          │
└─────────────────────────────────────────────────────────────┘
```

### Circuit Breaker Configuration

```typescript
// ResilientClassifier.ts
this.claudeCircuit = new CircuitBreaker({
  name: "claude-classifier",
  failureThreshold: 3,     // Open after 3 failures
  resetTimeout: 60000,     // Try again after 60s
});

this.openaiCircuit = new CircuitBreaker({
  name: "openai-classifier",
  failureThreshold: 5,     // More lenient
  resetTimeout: 120000,    // Try again after 120s
});
```

**Also has Redis-backed distributed circuit breakers** with in-memory fallback when Redis unavailable.

### Adaptiveness Assessment

| Criterion | open-seo-main | AI-Writer |
|-----------|---------------|-----------|
| Task complexity routing? | ❌ No | ❌ No |
| Cost constraints? | ❌ No | ⚠️ Partial (subscription limits) |
| Previous failures? | ✅ Yes (circuit breaker) | ✅ Yes (single fallback) |
| User preferences? | ❌ No | ⚠️ Partial (tenant config) |
| Token budget? | ❌ No | ✅ Yes (max_tokens param) |
| Response quality? | ❌ No | ❌ No |

### Model Version Inconsistency (Risk)

| Service | Model Version |
|---------|---------------|
| ResilientClassifier | claude-sonnet-4-20250514 ✅ Latest |
| ConversationExtractor | claude-sonnet-4-20250514 ✅ Latest |
| VoiceAnalyzer | claude-3-5-sonnet-20241022 ⚠️ Older |
| BusinessExtractor | claude-3-5-sonnet-20241022 ⚠️ Older |
| KeywordGenerator | claude-3-5-sonnet-20241022 ⚠️ Older |

### Production Readiness: 7/10

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Fallback/Cascade | 8/10 | 25% | 2.0 |
| Circuit Breaker | 9/10 | 20% | 1.8 |
| Error Handling | 6/10 | 15% | 0.9 |
| Model Version Mgmt | 4/10 | 10% | 0.4 |
| Cost Optimization | 5/10 | 10% | 0.5 |
| Observability | 7/10 | 10% | 0.7 |
| Adaptive Selection | 3/10 | 10% | 0.3 |
| **Total** | | | **6.6/10** |

---

## Part 3: Prospect-to-Keyword Flow Audit

**Source:** `56-AUDIT-PROSPECT-FLOW.md`

### End-to-End Flow

```
[User Input]                    [Step 1: UI Modal]                [Step 2: Server Action]
     │                               │                                  │
     ▼                               ▼                                  ▼
AddProspectModal.tsx:72-139    extractFromConversation         postOpenSeo("/api/prospects/extract")
  - 3 input modes:               Action.ts:483-518                     │
    website, website_with_context, conversation                        ▼
  - Validates domain/content     [Step 3: Backend Extraction]
  - Triggers handleAnalyze()     ConversationExtractor.ts:79-186
                                   - Claude API call (claude-sonnet-4)
                                   - Fixed prompt EXTRACTION_PROMPT:47-74
                                   - Returns: businessName, industry, services,
                                     targetAudience, keywords, location, confidence
                                        │
                                        ▼
                              [Step 4: Platform Detection]
                              ConversationExtractor.ts:162-175
                                   - detectPlatform() for website modes
                                   - Non-blocking, optional enrichment
                                        │
                                        ▼
                              [Step 5: User Confirmation]
                              ExtractionConfirmation component
                                   - User reviews/edits extracted data
                                   - Can trigger re-analysis with corrections
                                        │
                                        ▼
                              [Step 6: Prospect Creation]
                              confirmAndCreateProspectAction:545-575
                              postOpenSeo("/api/prospects/confirm")
                                        │
                                        ▼
                              [Step 7: Analysis Trigger]
                              triggerAnalysisAction:318-363
                                   - analysisType: quick_scan | deep_dive | opportunity_discovery
                                   - targetRegion, targetLanguage
                                        │
                                        ▼
                              [Step 8: DataForSEO Analysis]
                              ProspectAnalysisService.ts
                                   - discoverCompetitors()
                                   - analyzeKeywordGaps()
                                        │
                                        ▼
                              [Step 9: Keyword Storage]
                              KeywordInputService.ts:76-128
                                   - 6 entry points mapped to sources
                                   - Normalize, deduplicate, optionally enrich
```

### Intelligence Assessment: What's Dynamic vs Hardcoded

**Dynamic Decisions:**
1. Input mode selection (user-driven)
2. Confidence scoring (Claude assigns 0-100)
3. Platform detection (conditional on website modes)
4. Auto-qualification (score >= 70 → qualified)
5. Keyword enrichment (optional flag)

**Hardcoded/Fixed:**

| Fixed Behavior | Location | Assessment |
|----------------|----------|------------|
| Extraction prompt | `ConversationExtractor.ts:47-74` | **LIMITING** - Same for all industries |
| Claude model | `ConversationExtractor.ts:19` | APPROPRIATE |
| Keyword count | "5-10 keywords" in prompt | **LIMITING** - Should adapt |
| Analysis types | 3 fixed types only | **LIMITING** - No adaptive depth |
| Stage transitions | `PipelineService.ts:22-30` | APPROPRIATE |

### Claude Code Pattern Comparison

| Characteristic | Claude Code | This System | Score |
|----------------|-------------|-------------|-------|
| Sees user intent | ✅ Understands goal | ⚠️ 3 input modes, no adaptive interpretation | 5/10 |
| Selects appropriate tools | ✅ Dynamic tool calling | ❌ Fixed pipeline regardless of input | 2/10 |
| Adapts depth based on need | ✅ Simple→simple, complex→deep | ⚠️ 3 analysis types, user must choose | 3/10 |

**Key Gap:** The extraction prompt is identical regardless of:
- Industry (plumber vs SaaS vs ecommerce)
- Input richness (500 chars vs 10,000 chars of context)
- User's stated goals (lead gen vs competitive analysis vs content gap)

### Human-in-the-Loop Points

**Where user CAN intervene:**
- Input mode selection
- Review extraction (edit fields)
- Re-analyze with corrections
- Analysis type selection
- Region/language override

**Where user SHOULD be able to but CANNOT:**
1. Keyword priority input ("focus on commercial keywords")
2. Competitor hints (suggest known competitors)
3. Industry selection (override AI guess)
4. Depth control pre-extraction ("complex business, go deeper")
5. Goal specification (lead gen vs content planning vs competitive intel)

### Prospect Flow Rating: 5/10

**What's Good:**
- Clean 3-mode input (website/context/conversation)
- Human review step before committing
- Re-analyze with corrections capability
- Platform detection enrichment
- Confidence scoring from AI

**What's Missing for 10/10:**
1. Intent classification layer before extraction
2. Industry-adaptive prompt templates
3. Iterative extraction (multi-turn dialog)
4. Priority weighting UI
5. Competitor seeding
6. Cross-prospect learning
7. Goal-driven pipeline selection

---

## Part 4: Infrastructure Gaps vs cpu-only-rag-graph.md

**Source:** `56-INFRA-GAPS.md`

### Critical Gaps

#### Gap 1: No GraphRAG Integration

**Infra doc specifies:**
```
Pipeline: crawl with Crawlee → clean with trafilatura → ingest into LightRAG 
with entity types [product, category, brand, attribute, material, 
occasion, audience] → query in hybrid mode → feed retrieved context 
into classification prompt
```

**Current plans have:**
- Direct LLM classification without context retrieval
- No LightRAG integration
- No entity type taxonomy
- No hybrid retrieval

**Impact:** Classification relies purely on business context from conversation extraction, missing the rich semantic graph.

#### Gap 2: No Per-Tenant Graph Storage

**Infra doc specifies:**
```
FalkorDB 4.14 for the per-tenant knowledge graph
- Graph-per-tenant via Redis keyspace
- 6-15 MB per 10k-node tenant
- Hybrid graph + vector queries in single Cypher call
```

**Current plans have:**
- No FalkorDB integration
- No per-tenant graph isolation
- No graph storage for keyword relationships

#### Gap 3: Missing Lithuanian-Optimized Embeddings

**Infra doc specifies:**
```
jina-embeddings-v3 best for Lithuanian (Cohen's kappa 0.62, AUC-ROC 0.887)
- 572M params, 1024-dim Matryoshka, 8K context
- ~10-20 docs/sec INT8 on CPU
- Slice to [:384] for storage efficiency
```

**Current plans have:**
- No embedding model specified
- No vector storage for keyword embeddings
- Type categorization is purely rule-based + LLM

#### Gap 4: No Hierarchical Retrieval

**Infra doc specifies:**
```
Two-stage retrieval - category routing first, in-category dense search second
- CategoryRouter with centroid prototypes
- Per-category FAISS HNSW shards
- PCA-truncated 384-dim vectors
```

**Current plans have:**
- Flat keyword list processing
- No category routing
- No vector-based semantic grouping

#### Gap 5: Vector Storage Not Specified

**Infra doc specifies:**
```
Postgres 17 + pgvector 0.8 + pgvectorscale 0.6
- halfvec(768) storage
- DiskANN with SBQ for 100M vectors
- Multi-tenant via tenant_id filter
```

**Current plans have:**
- No vector storage DDL
- No pgvector integration
- No multi-tenant vector isolation

#### Gap 6: Missing Reranker

**Infra doc specifies:**
```
bge-reranker-v2-m3 on top-50 candidates
- +3-8 points recall@10
- ~80ms per (query, candidate) pair on AVX2 CPU
```

### Required Classification Pipeline (from infra doc)

```
Keywords
  → Embed (jina-v3)
  → Category Route (centroid)
  → GraphRAG Retrieve (LightRAG hybrid mode)
  → Pass 1 (Grok 4.1) with graph context
  → Rerank (bge-reranker-v2-m3)
  → uncertain → Pass 2 (Claude Sonnet) with full context
  → Human Review
```

### Effort Delta

| Category | Hours |
|----------|-------|
| Current plans (56-05 + 56-06) | 26h |
| Infrastructure gaps | 39h |
| **Grand Total** | **65h** |

**Delta: +39 hours (+150%)**

---

## Part 5: Model Selection Update

### Original Plan: GPT-4.1-nano (OpenAI)

**Rejected per user feedback.**

### Updated Plan: Grok 4.1 (xAI)

| Attribute | Value |
|-----------|-------|
| Provider | xAI |
| Model | grok-4.1 |
| Input Cost | $0.20/1M tokens |
| Output Cost | $0.50/1M tokens |
| Base URL | `https://api.x.ai/v1` |
| SDK Compatibility | OpenAI SDK compatible |
| Context Window | 131,072 tokens |
| Structured Output | `strict: true` mode for JSON schema |

**Integration code:**

```typescript
import OpenAI from "openai";

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

const response = await xai.chat.completions.create({
  model: "grok-4.1",
  messages: [...],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "keyword_classification",
      strict: true,
      schema: classificationSchema,
    },
  },
});
```

---

## Part 6: Files to Create/Modify

### New Files Required

```
open-seo-main/src/server/features/keywords/services/graph/
├── LightRAGClient.ts           # LightRAG wrapper
├── EntityTypeConfig.ts         # [product, category, brand, attribute, material, occasion, audience]
├── GraphIngestor.ts            # Ingest business context into graph
├── HybridRetriever.ts          # Hybrid mode retrieval
└── index.ts

open-seo-main/src/server/lib/falkordb/
├── client.ts                   # FalkorDB async client
├── tenant-graph.ts             # Graph-per-tenant setup
├── keyword-graph.ts            # Keyword relationship graph
└── index.ts

open-seo-main/src/server/features/keywords/services/embeddings/
├── EmbeddingClient.ts          # jina-embeddings-v3 wrapper
├── CategoryRouter.ts           # Centroid-based routing
├── HierarchicalRetriever.ts    # Two-stage retrieval
└── index.ts

open-seo-main/src/server/features/keywords/services/classification/
├── types.ts                    # Zod schemas
├── model-config.ts             # Model costs (UPDATED for Grok 4.1)
├── ModelSelector.ts            # Health tracking + fallback
├── ErrorHandler.ts             # Recovery logic
├── Pass1Classifier.ts          # Grok 4.1 (NOT GPT-4.1-nano)
├── Pass2Classifier.ts          # Claude Sonnet
├── ClassificationCascade.ts    # Main orchestrator
├── Reranker.ts                 # bge-reranker-v2-m3
├── HumanReviewQueue.ts         # Optional review queue
├── prompts/
│   ├── pass1-prompt.xml
│   └── pass2-prompt.xml
└── index.ts

open-seo-main/drizzle/migrations/
└── XXXX_add_keyword_vectors.sql

open-seo-main/src/db/keyword-vectors-schema.ts
```

### Files to Modify

```
open-seo-main/src/server/lib/dataforseo.ts
  → Add autocomplete, PAA, related searches endpoints

open-seo-main/src/server/features/prospects/prompts/conversation-extractor.xml
  → Add negative_associations, business_model extraction

open-seo-main/src/db/prospect-schema.ts
  → Add NegativeAssociationsSchema, BusinessModelSchema

open-seo-main/src/server/lib/redis.ts
  → Add FalkorDB module support

apps/web/src/stores/prospect-wizard-store.ts
  → Add keywordConfirmation: 'always' | 'never' | 'low_confidence'

apps/web/src/components/prospects/ExtractionConfirmation.tsx
  → Show classified keywords with type badges

apps/web/src/hooks/useAnalysisProgress.ts
  → Add discovering_keywords, classifying_keywords stages
```

---

## Part 7: Updated Effort Estimates

### Phase 56 Plans with Full Infrastructure

| Plan | Focus | Original | Delta | New Total |
|------|-------|----------|-------|-----------|
| 56-05 | Business Context + Classification Foundation | 14h | +8h | 22h |
| 56-05a | LightRAG + FalkorDB Infrastructure | NEW | +10h | 10h |
| 56-05b | Embedding + Vector Storage | NEW | +11h | 11h |
| 56-05c | Reranker + Pipeline Integration | NEW | +8h | 8h |
| 56-06 | Keyword Universe Builder + Integration | 12h | +2h | 14h |
| **Total** | | **26h** | **+39h** | **65h** |

### Detailed Breakdown

#### 56-05a: LightRAG + FalkorDB (10h)

| Component | Hours |
|-----------|-------|
| LightRAG Client wrapper | 4h |
| Graph Ingestor (business context) | 3h |
| Hybrid Retriever | 3h |

#### 56-05b: Embedding + Vector Storage (11h)

| Component | Hours |
|-----------|-------|
| FalkorDB Client (Redis module) | 3h |
| Tenant Graph Setup | 2h |
| Keyword Graph Schema | 2h |
| Embedding Client (jina-v3) | 2h |
| Category Router | 2h |

#### 56-05c: Reranker + Pipeline (8h)

| Component | Hours |
|-----------|-------|
| Vector Storage Migration | 2h |
| Keyword Vectors Schema | 1h |
| Reranker Service | 3h |
| Pipeline Modifications | 2h |

---

## Part 8: Entity Type Taxonomy

From infra doc, for GraphRAG retrieval:

| Entity Type | Lithuanian Examples | Classification Use |
|-------------|---------------------|-------------------|
| product | "megztinis", "striukė" | Direct product keywords |
| category | "moteriški drabužiai" | Category-level terms |
| brand | "Zara", "H&M" | Brand mentions |
| attribute | "šiltas", "vandeniui atsparus" | Product attributes |
| material | "vilna", "medvilnė" | Material keywords |
| occasion | "vestuvėms", "darbui" | Use case keywords |
| audience | "vaikams", "moterims" | Target audience |

---

## Part 9: Human-in-the-Loop: Confirm/Autonomous Toggle

**User Request:** Setting near input to confirm or autonomous

### Implementation

**Store:**
```typescript
// apps/web/src/stores/prospect-wizard-store.ts
interface ProspectWizardState {
  keywordConfirmation: 'always' | 'never' | 'low_confidence';
}
```

**Behavior:**
- `always`: Show all keywords for review before proceeding
- `never`: Auto-accept AI classification
- `low_confidence`: Pause if avg confidence < 0.9

**UI Location:** Toggle in AddProspectModal, near input mode selector

---

## Part 10: Summary of Audit Sources

| Audit Document | Focus | Key Finding |
|----------------|-------|-------------|
| `56-AUDIT-DATAFORSEO.md` | DataForSEO endpoints | 17 implemented, missing autocomplete/PAA/related |
| `56-AUDIT-MODEL-CASCADE.md` | LLM orchestration | 7/10, good circuit breakers, no adaptive selection |
| `56-AUDIT-PROSPECT-FLOW.md` | End-to-end flow | 5/10, fixed pipeline not intelligent agent |
| `56-EXISTING-SYSTEM-AUDIT.md` | Deep system review | 5/10 overall, 3/10 adaptiveness |
| `56-INFRA-GAPS.md` | vs cpu-only-rag-graph.md | +39h delta, missing LightRAG/FalkorDB/embeddings |

---

## Appendix A: File Locations Audited

### open-seo-main

```
/src/server/lib/
├── dataforseo.ts                    # Core DataForSEO client
├── dataforseoKeywordGap.ts          # Gap analysis + scoring
├── dataforseoClient.ts              # SDK wrapper
├── dataforseoSchemas.ts             # Zod schemas
├── dataforseo-auth.ts               # Authentication
├── http-client.ts                   # LLM API clients
├── redis-circuit-breaker.ts         # Distributed circuit breakers
├── redis-rate-limiter.ts            # Rate limiting

/src/server/features/keywords/
├── services/
│   ├── BusinessPriorityParser.ts    # NLP priority extraction
│   ├── ResilientClassifier.ts       # Model cascade
│   ├── KeywordEnrichmentService.ts  # Metric enrichment
│   ├── KeywordIntelligenceService.ts # Main orchestrator
│   ├── EmbeddingService.ts          # Semantic embeddings
│   └── LithuanianNormalizer.ts      # Morphology handling

/src/server/features/prospects/
├── services/
│   ├── ProspectService.ts           # CRUD operations
│   ├── ProspectAnalysisService.ts   # Gap analysis
│   ├── ConversationExtractor.ts     # NLP extraction
│   └── PipelineService.ts           # Status management
```

### AI-Writer

```
/backend/services/llm_providers/
├── main_text_generation.py          # LLM text generation
├── routing_policy.py                # Provider routing
├── tenant_provider_config.py        # Per-tenant config
```

---

## Next Steps

1. **Update 56-05-PLAN.md** — Replace GPT-4.1-nano with Grok 4.1
2. **Create 56-05a-PLAN.md** — LightRAG + FalkorDB infrastructure
3. **Create 56-05b-PLAN.md** — Embedding + Vector storage
4. **Create 56-05c-PLAN.md** — Reranker + Pipeline integration
5. **Update 56-06-PLAN.md** — Add autocomplete/PAA/related endpoints, confirm toggle
6. **Execute in dependency order** — 56-05 → 56-05a → 56-05b → 56-05c → 56-06

---

# Part II: Crawling Infrastructure Audit

**Reference:** `docs/infra-research/crawling-10-5000-tasks-day.md`

---

## Crawling Infra Executive Summary

The crawling infrastructure is **40% implemented**. The platform has solid BullMQ queues and delegates crawling to DataForSEO (appropriate for Phase 0-1), but lacks the cost-optimization patterns needed for Phase 2 scaling (5,000 tasks/day).

### Crawling Infra Metrics

| Dimension | Score | Assessment |
|-----------|-------|------------|
| Task Queue (BullMQ) | 7/10 | Production-grade, no fair queuing |
| Singleflight Dedup | **2/10** | Classification only, not crawls |
| Delta Crawling | **1/10** | Schema exists, 0% implemented |
| Task Decomposition | 5/10 | 6 shapes partially covered |
| Queue Lane Separation | **2/10** | No fast lane for API-only tasks |
| Proxy/Anti-Bot | N/A | Managed service (DataForSEO) |
| Shared Cache Flywheel | 6/10 | Classification singleflight works |
| Consent Wall Detection | **0/10** | CRITICAL GAP for EU markets |

---

## Part 11: ARQ + Redis Singleflight Audit

**Source:** `56-AUDIT-ARQ-SINGLEFLIGHT.md`

### Status: 20% Implemented

| Pattern | Status | Implementation |
|---------|--------|----------------|
| ARQ async task queue | NOT IMPLEMENTED | BullMQ (TS) + APScheduler (Python) |
| Redis singleflight (crawl) | **NOT IMPLEMENTED** | 50 clients = 50 fetches |
| Redis singleflight (classification) | **IMPLEMENTED** | ClassificationSingleflight.ts |
| Pub/sub completion | PARTIAL | Classification only |
| DRR fair queuing | NOT IMPLEMENTED | No client weight fairness |

**Impact:** 50 clients monitoring same retailer trigger 50 independent DataForSEO fetches. **98% potential cost waste.**

---

## Part 12: Delta Crawling Cascade Audit

**Source:** `56-AUDIT-DELTA-CRAWLING.md`

### Status: ~10% Implemented (Schema Only)

| Layer | Expected Savings | Status |
|-------|------------------|--------|
| L0: Sitemap lastmod | 25-55% | NOT IMPLEMENTED |
| L1: Conditional GET (ETag) | 10-20% | NOT IMPLEMENTED (schema exists) |
| L2: Template-aware hash | 10-20% | PARTIAL (incomplete stripping) |
| L3: Full reprocess | 10-25% | CURRENT DEFAULT (100%) |

**Cost Impact:** Without delta crawling, **$390-$480/month wasted** at 1,000 recurring pages/day.

**Critical Finding:** `page-analyzer.ts` strips only basic elements (`script, style, noscript`), missing e-commerce dynamic blocks (`.price`, `.stock`, `.cart`).

---

## Part 13: Task Decomposition Audit

**Source:** `56-AUDIT-TASK-DECOMPOSITION.md`

### Infra Doc Core Insight:

> **60-70% of workload should NEVER touch the crawler.**

### 6 Task Shapes Coverage

| Type | Description | Status |
|------|-------------|--------|
| A | Full site audit | IMPLEMENTED (audit-queue) |
| B | Competitor snapshot | PARTIAL |
| C | Keyword gap | **CORRECT** (pure API) |
| D | Backlink profile | **CORRECT** (pure API) |
| E | Content gap | PARTIAL |
| F | Local SEO | NOT IMPLEMENTED |

### Critical Gap: No Lane Separation

`prospect-analysis-processor.ts` runs ALL operations (API + crawl) sequentially in ONE job. Types C/D should never queue behind crawl operations.

**Needed:**
1. `fast-api` queue (sub-minute SLA) for pure API tasks
2. `heavy-crawl` queue (15-min SLA) for crawl tasks
3. BullMQ Flow to orchestrate decomposed jobs

---

## Part 14: Proxy & Anti-Bot Audit

**Source:** `56-AUDIT-PROXY-ANTIBOT.md`

### Status: Managed Service (DataForSEO handles)

Current architecture delegates all crawling to DataForSEO OnPage API (~$0.02/page). Appropriate for Phase 0-1.

### CRITICAL Gap: Consent Wall Detection

**Infra Doc Warning:**
> GDPR cookie-consent walls return HTTP 200 with structured HTML, but the body is a consent shell — not the page content. Audits silently report "thin content" for pages that are actually rich.

**Current Status:** No Cookiebot/OneTrust/Iubenda detection.

**Impact:** False audit results for EU/Lithuanian prospects.

### Other Gaps

| Gap | Impact |
|-----|--------|
| Per-domain rate limiting | Could hammer single domain |
| HTML size sanity check | Challenge pages not detected |
| Render mode caching | Paying 8x for static sites |

---

## Part 15: Shared Cache Flywheel Audit

**Source:** `56-AUDIT-SHARED-CACHE.md`

### Status: 60% Implemented

| Component | Status |
|-----------|--------|
| ClassificationSingleflight | **IMPLEMENTED** |
| CrawlSingleflight | NOT IMPLEMENTED |
| PostgreSQL schema | EXISTS (unused) |
| Redis write-through | NOT IMPLEMENTED |
| lastmod_sitemap column | MISSING |

**Working Pattern to Copy:** `ClassificationSingleflight.ts` demonstrates the correct atomic SET NX EX + pub/sub pattern. Apply same pattern for crawl deduplication.

---

## Part 16: Combined Effort Estimate

### Keyword Intelligence (cpu-only-rag-graph.md)

| Component | Hours |
|-----------|-------|
| Current 56-05 + 56-06 | 26h |
| LightRAG + FalkorDB | 10h |
| Embeddings + pgvector | 11h |
| Reranker + pipeline | 8h |
| **Subtotal** | **55h** |

### Crawling Infrastructure (crawling-10-5000.md)

| Component | Hours |
|-----------|-------|
| CrawlSingleflight | 8h |
| Delta crawling (L0-L2) | 28h |
| Task decomposition + lanes | 30h |
| Consent wall detection | 4h |
| HTML sanity + per-domain rate | 6h |
| Redis write-through cache | 8h |
| **Subtotal** | **84h** |

### Grand Total

| Category | Hours |
|----------|-------|
| Keyword Intelligence | 55h |
| Crawling Infrastructure | 84h |
| **Total Option A** | **139h** |

---

## Part 17: Priority Matrix

### P0 (Must Have for Phase 56)

| Item | Impact | Effort |
|------|--------|--------|
| Consent wall detection | Accurate EU audits | 4h |
| Grok 4.1 integration | Updated model selection | 4h |
| Autocomplete endpoint | Keyword expansion | 2h |
| Confirm/autonomous toggle | User request | 2h |

### P1 (Should Have)

| Item | Impact | Effort |
|------|--------|--------|
| CrawlSingleflight | 98% crawl dedup | 8h |
| Task decomposition | 60-70% throughput | 30h |
| L2 template-aware hash | 10-20% delta savings | 8h |

### P2 (Phase 57+)

| Item | Impact | Effort |
|------|--------|--------|
| LightRAG + FalkorDB | GraphRAG retrieval | 21h |
| jina-embeddings-v3 | Lithuanian quality | 11h |
| Full delta cascade (L0-L1) | 35-75% savings | 20h |

---

## Part 18: Recommended Phase 56 Scope (Revised)

Given the audit findings, recommend splitting:

### Phase 56: Core Keyword Intelligence (Current Scope)
- Grok 4.1 integration
- Autocomplete/PAA endpoints
- Confirm/autonomous toggle
- Consent wall detection (P0 for accuracy)
- **Effort: ~30h**

### Phase 57: Crawling Infrastructure
- CrawlSingleflight + shared cache
- Task decomposition + dual lanes
- Delta crawling L0-L2
- **Effort: ~66h**

### Phase 58: GraphRAG Infrastructure
- LightRAG + FalkorDB
- jina-embeddings-v3 + pgvector
- Hierarchical retrieval
- **Effort: ~43h**

This phasing delivers immediate value (accurate keyword intelligence) while deferring infrastructure work to dedicated phases.
