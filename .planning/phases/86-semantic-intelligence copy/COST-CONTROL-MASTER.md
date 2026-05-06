# Cost Control Master Document

> **Purpose**: Comprehensive inventory of ALL paid API calls, model usage, and optimization opportunities.  
> **Status**: Pre-launch development costs only (not customer revenue)  
> **Generated**: 2026-05-05  

---

## Table of Contents

1. [Model Usage Inventory](#1-model-usage-inventory)
2. [DataForSEO → GSC Replacement](#2-dataforseo--gsc-replacement)
3. [External Paid API Inventory](#3-external-paid-api-inventory)
4. [Redundancy & Loop Issues](#4-redundancy--loop-issues)
5. [Local Embedding Server Migration](#5-local-embedding-server-migration)
6. [Priority Action Matrix](#6-priority-action-matrix)

---

## 1. Model Usage Inventory

### 1.1 LLM Models - TARGET Architecture (May 2026)

> **See MODEL-REFERENCE.md for full migration checklist.**

| Model | Provider | Purpose | Why This Model | Cost |
|-------|----------|---------|----------------|------|
| **grok-4.1-fast** | xAI | Bulk classification, structured extraction, CopilotKit | **Cheapest high-quality structured output** | $0.20/1M |
| **grok-4.1** | xAI | Funnel classification, moderate reasoning | Good balance cost/quality | $0.40/1M |
| **grok-4.1-thinking** | xAI | Proposal narratives, complex analysis, strategic reasoning | Deep reasoning when needed | $2.00/1M |
| **gemini-3.1-pro** | Google | Article generation, voice analysis, translations, quality content | **Best content quality**, excellent Lithuanian | $1.25/1M |
| **gemini-3.1-flash** | Google | Fast tasks, audio transcription, cheap generation | Fast and cheap | $0.075/1M |
| **gemini-3.1-flash-lite** | Google | Ultra-cheap fallback | Cheapest reliable option | $0.02/1M |
| **gemini-3.1-flash-image-preview** | Google | All image generation | Replaces Imagen 4.x | ~$0.02/img |
| **claude-sonnet-4-6** | Anthropic | Voice extraction only (if Gemini 3.1 Pro insufficient) | Best nuanced tone analysis | $3.00/1M |
| **kimi-2.6** | Moonshot | Backup/alternative for complex reasoning | Comparable to Claude Opus | Competitive |

**NOT USED (Deprecated):**
- ~~gpt-4o-mini~~ → use grok-4.1-fast
- ~~claude-3-5-sonnet~~ → use claude-sonnet-4-6 or gemini-3.1-pro
- ~~gemini-1.5/2.x~~ → use gemini-3.1-pro/flash
- ~~imagen-4.x~~ → use gemini-3.1-flash-image-preview
- ~~llama-3.x~~ → use grok-4.1-fast (same cost, better quality)

### 1.2 Model Selection Strategy (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│              TWO-MODEL ARCHITECTURE (May 2026)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ANALYSIS LAYER → Grok 4.1                                      │
│  ├─ grok-4.1-fast: Bulk classification, extraction, chat       │
│  ├─ grok-4.1: Funnel logic, moderate reasoning                 │
│  └─ grok-4.1-thinking: Proposals, strategy, complex analysis   │
│                                                                 │
│  CONTENT LAYER → Gemini 3.1 Pro                                 │
│  ├─ Articles, blog posts, quality content                      │
│  ├─ Voice analysis (12 dimensions)                             │
│  ├─ Translations (excellent Lithuanian)                        │
│  └─ Voice compliance scoring                                   │
│                                                                 │
│  IMAGE LAYER → gemini-3.1-flash-image-preview                  │
│  └─ All image generation (replaces Imagen 4.x)                 │
│                                                                 │
│  FALLBACK (if Gemini voice quality insufficient)               │
│  └─ claude-sonnet-4-6: Voice extraction only                   │
│                                                                 │
│  BACKUP PROVIDER (redundancy)                                   │
│  └─ kimi-2.6: Alternative for complex reasoning                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Optimal Batch Sizes

| Task | Model | Batch Size | Input Tokens | Cost/Batch |
|------|-------|------------|--------------|------------|
| Keyword classification | grok-4.1-fast | **200 keywords** | ~3.2K | $0.006 |
| Funnel classification | grok-4.1 | **250 keywords** | ~4K | $0.007 |
| Translation | gemini-3.1-pro | **50 strings** | ~1.5K | $0.024 |
| Quality analysis | gemini-3.1-pro | **1 call (consolidated)** | ~4K | $0.044 |
| Pass 2 refinement | grok-4.1-thinking | **20 keywords** | ~2.2K | $0.018 |

---

## 2. DataForSEO → GSC Replacement

### 2.1 DataForSEO Endpoint Inventory

| Endpoint | File | Cost/Call | Usage | GSC Replaceable? |
|----------|------|-----------|-------|------------------|
| `/v3/keywords_data/google_ads/search_volume/live` | `dataforseo.ts:91` | $0.005/kw | Volume, CPC, competition | ❌ NO - GSC has no volume data |
| `/v3/dataforseo_labs/google/related_keywords/live` | `dataforseo.ts:151` | $0.02-0.05 | Keyword suggestions | ❌ NO - GSC only shows YOUR queries |
| `/v3/dataforseo_labs/google/keyword_suggestions/live` | `dataforseo.ts:174` | $0.02-0.05 | Keyword ideas | ❌ NO |
| `/v3/dataforseo_labs/google/keyword_ideas/live` | `dataforseo.ts:197` | $0.02-0.05 | Keyword discovery | ❌ NO |
| `/v3/dataforseo_labs/google/domain_rank_overview/live` | `dataforseo.ts:219` | $0.05 | Domain metrics | ❌ NO - GSC has no domain authority |
| `/v3/dataforseo_labs/google/ranked_keywords/live` | `dataforseo.ts:243` | $0.05-0.10 | Keywords domain ranks for | ⚠️ PARTIAL - GSC has YOUR rankings |
| `/v3/serp/google/organic/live/regular` | `dataforseo.ts:269` | $0.01-0.02 | Live SERP, PAA | ❌ NO - GSC has no SERP features |
| `/v3/on_page/instant_pages` | `dataforseo.ts:301` | $0.02/page | HTML content | ❌ NO |
| `/v3/on_page/lighthouse/live/json` | `dataforseoLighthouse.ts:11` | $0.004 | Lighthouse scores | ✅ YES - Use PageSpeed Insights API (FREE) |
| `/v3/on_page/content_parsing/live` | `dataforseoScraper.ts:269` | $0.02 | JS-rendered HTML | ❌ NO |
| `/v3/backlinks/summary/live` | `dataforseoBacklinks.ts:202` | $0.01 | Backlink summary | ❌ NO - GSC has no backlink data |
| `/v3/backlinks/backlinks/live` | `dataforseoBacklinks.ts:221` | $0.02-0.05 | Individual backlinks | ❌ NO |
| `/v3/backlinks/referring_domains/live` | `dataforseoBacklinks.ts:245` | $0.02-0.05 | Referring domains | ❌ NO |
| `/v3/backlinks/history/live` | `dataforseoBacklinks.ts:286` | $0.02-0.05 | Backlink trends | ❌ NO |
| `/v3/dataforseo_labs/google/keywords_for_site/live` | `dataforseoProspect.ts:143` | $0.05-0.10 | All keywords site ranks for | ⚠️ PARTIAL |
| `/v3/dataforseo_labs/google/competitors_domain/live` | `dataforseoProspect.ts:208` | $0.05-0.10 | Competing domains | ❌ NO |
| `/v3/dataforseo_labs/google/domain_intersection/live` | `dataforseoKeywordGap.ts:145` | $0.02-0.05 | Keyword gaps | ❌ NO |

### 2.2 GSC Replacement Strategy

**CAN REPLACE (FREE alternatives):**

| Current | File | Replace With | Implementation |
|---------|------|--------------|----------------|
| **Lighthouse via DataForSEO** | `dataforseoLighthouse.ts` | PageSpeed Insights API | FREE - 25k queries/day |
| **Daily ranking checks (OWN site)** | `ranking-processor.ts:261` | GSC API `getSearchQueries()` | FREE - already implemented |
| **Performance monitoring** | Various | GSC API | FREE - clicks, impressions, CTR |

**CANNOT REPLACE (must keep DataForSEO):**

| Usage | Why DataForSEO Required |
|-------|------------------------|
| Competitor keyword analysis | GSC only shows YOUR data |
| Keyword discovery/suggestions | GSC doesn't provide keyword research |
| Search volume estimates | GSC doesn't provide volume |
| CPC data | GSC doesn't provide cost data |
| Backlink analysis | GSC has no backlink data |
| SERP feature extraction (PAA) | GSC doesn't capture SERP features |
| Domain authority/metrics | GSC doesn't provide domain-level metrics |

### 2.3 Implementation: Replace Lighthouse

```typescript
// File: open-seo-main/src/server/lib/pagespeed-insights.ts

const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export async function getLighthouseScores(url: string) {
  // FREE - no API key required for low volume
  // With API key: 25,000 queries/day
  const response = await fetch(
    `${PAGESPEED_API}?url=${encodeURIComponent(url)}&category=performance&category=accessibility&category=best-practices&category=seo`
  );
  const data = await response.json();
  
  return {
    performance: data.lighthouseResult.categories.performance.score * 100,
    accessibility: data.lighthouseResult.categories.accessibility.score * 100,
    bestPractices: data.lighthouseResult.categories['best-practices'].score * 100,
    seo: data.lighthouseResult.categories.seo.score * 100,
  };
}
```

**Estimated Savings**: $30-50/month (Lighthouse calls → FREE)

### 2.4 DataForSEO Caching Improvements

| Endpoint | Current Cache | Recommended | Savings |
|----------|---------------|-------------|---------|
| Keyword metrics | 7-day Redis | ✅ GOOD | - |
| SERP analysis | 24h Redis | ✅ GOOD | - |
| Backlinks | ❌ None | 24h cache | 60-80% |
| Domain overview | ❌ None | 24h cache | 50% |
| Lighthouse | ❌ None | 7-day cache | 90% |

### 2.5 GSC-First Daily Ranking Tracking (NEW)

**Current Problem**: Daily ranking checks use DataForSEO for ALL keywords, even ones the domain IS ranking for. GSC provides this data FREE and more accurately (Google's own data).

**Architecture**:
```
┌─────────────────────────────────────────────────────────────────┐
│                 GSC-FIRST RANKING FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  02:00 UTC: GSC Sync (analytics-processor.ts)                   │
│  └─> Fetches last 3 days of GSC data                           │
│  └─> Stores in seo_gsc_query_snapshots table                   │
│                                                                 │
│  03:00 UTC: Ranking Check (ranking-processor.ts)                │
│  ├─> 1. Match tracked keywords against GSC snapshot data       │
│  │   └─ Keywords FOUND in GSC: Use GSC position (FREE)         │
│  │   └─ Keywords NOT in GSC: Mark for DataForSEO check         │
│  │                                                              │
│  ├─> 2. DataForSEO ONLY for NOT-IN-GSC keywords                │
│  │   └─ First check: Call DataForSEO                           │
│  │   └─ Not ranking 4+ weeks: Skip DataForSEO, mark "0"        │
│  │                                                              │
│  └─> 3. Store with source tracking                              │
│      └─ source='gsc' | 'dataforseo' | 'not_ranking'            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Files to Modify**:
| File | Change |
|------|--------|
| `ranking-schema.ts` | Add `source` enum column |
| `ranking-processor.ts` | GSC-first logic before DataForSEO |
| `GscRankingMatcher.ts` (NEW) | Match keywords against GSC snapshots |

**Cost Impact**:
| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| DataForSEO calls/day | 1000 | ~200-300 | **70-80%** |
| Ranking data accuracy | Good | Better (Google's own data) | - |
| Monthly cost | ~$150 | ~$30-45 | **$105-120/mo** |

**Not-Ranking Keywords Strategy**:
- If keyword not in GSC and not in top 100 SERP: mark as `not_ranking`
- After 4 consecutive `not_ranking` checks: stop calling DataForSEO
- Re-check weekly instead of daily to save costs
- Reset streak if keyword starts ranking
| Keyword ideas | ❌ None | 1h cache (volatile) | 30% |

---

## 3. External Paid API Inventory

### 3.1 Complete Service List

| # | Service | Category | Monthly Est. | Files | Free Alternative |
|---|---------|----------|--------------|-------|------------------|
| 1 | **DataForSEO** | SEO Data | $200-800 | `dataforseo*.ts` | GSC (partial), PageSpeed (partial) |
| 2 | **Anthropic Claude** | LLM | $50-150 | Voice, Proposals, Classification | OpenRouter routing |
| 3 | **Google Gemini** | LLM | $30-100 | Text gen, Translation, Articles | Groq FREE tier |
| 4 | **xAI Grok** | LLM | $20-80 | Keyword classification | Groq FREE tier |
| 5 | **Jina AI** | Embeddings | $5-30 | `ResilientEmbedding.ts` | **LOCAL SERVER** |
| 6 | **Resend** | Email | $5-20 | `EmailService.ts` | - |
| 7 | **Loops** | Marketing Email | $5-15 | `loops.ts` | Consolidate with Resend |
| 8 | **Exa.ai** | Search | $10-30 | `hallucination_detector.py` | Serper (cheaper) |
| 9 | **Serper** | Search | $5-20 | `pricing_service.py` | - |
| 10 | **Tavily** | AI Search | $5-20 | `user_api_key_context.py` | Serper |
| 11 | **Stability AI** | Images | $10-50 | `stability_service.py` | WaveSpeed |
| 12 | **WaveSpeed** | Images | $5-20 | `studio_manager.py` | - |
| 13 | **CopilotKit** | AI Chat | $10-50 | `provider.tsx` | Custom implementation |
| 14 | **Clerk** | Auth | $0-100 | `auth.ts`, `clerk-jwt.ts` | better-auth (self-hosted) |
| 15 | **Dokobit** | Signing | €10-50 | `dokobit.ts` | Manual PDF signing |
| 16 | **Stripe** | Payments | 2.9%+$0.30 | `payment.ts` | Revolut (1%+€0.20 in EU) |
| 17 | **Revolut** | Payments | 1%+€0.20 | `revolut.ts` | - |
| 18 | **PostHog** | Analytics | $0 (free tier) | `posthog.ts` | - |

### 3.2 Monthly Cost Summary

| Category | Low | Medium | High |
|----------|-----|--------|------|
| DataForSEO | $100 | $400 | $800 |
| LLM APIs | $100 | $280 | $430 |
| Email | $10 | $25 | $35 |
| Search APIs | $20 | $50 | $70 |
| Images | $15 | $45 | $70 |
| Auth (Clerk) | $0 | $50 | $100 |
| Embeddings (Jina) | $5 | $15 | $30 |
| CopilotKit | $10 | $30 | $50 |
| Dokobit | €10 | €30 | €50 |
| **TOTAL** | **$270-310** | **$925-1,025** | **$1,635-1,785** |

---

## 4. Redundancy & Loop Issues

### 4.1 CRITICAL - Loop Issues (Fix Immediately)

#### Issue 1: Sequential LLM Calls in AI Analytics
```
File: AI-Writer/backend/services/ai_analytics_service.py:96-97
Problem: for metric in metrics: await self._analyze_metric_trend(...)
Impact: 4 metrics = 4 serial LLM calls instead of 1 batch
Fix: Batch all metrics into single prompt with structured output
Savings: 50-75% cost reduction
```

#### Issue 2: Fake Batch Translation
```
File: open-seo-main/.../TranslationService.ts:194-199
Problem: translateBatch() uses Promise.all(batch.map(req => this.translate(req)))
         Each translate() makes separate Gemini API call
Impact: 10 translations = 10 API calls
Fix: True batching - send all texts in single prompt
Savings: 80-90% cost reduction
```

#### Issue 3: ResilientClassifier No Real Batching
```
File: open-seo-main/.../ResilientClassifier.ts:560-568
Problem: classifyBatch() → Promise.all(batch.map(kw => this.classify(kw, categories)))
Impact: 100 keywords = 100 LLM calls at $0.003-0.01 each = $0.30-$1.00
Fix: Single prompt with all keywords, request JSON array response
Savings: 90%+ cost reduction ($0.03-0.10 for same 100 keywords)
```

### 4.2 HIGH - Serial AI Calls

#### Issue 4: Deep Competitor Analysis
```
File: AI-Writer/backend/services/seo/deep_competitor_analysis_service.py:43-56
Problem: Loop calls _analyze_competitor_with_ai() sequentially per competitor
Impact: 25 competitors = 25 serial AI calls + aggregation = 26 total
Fix: Batch competitor data, analyze in chunks of 5 with single prompts
Savings: 60-80% cost reduction
```

#### Issue 5: Quality Analysis Service
```
File: AI-Writer/backend/services/ai_quality_analysis_service.py:243-564
Problem: 5+ separate Gemini calls per content piece (lines 243, 300, 359, 415, 471, 564)
Impact: Single quality analysis = 5-6 LLM calls
Fix: Consolidate into single structured prompt
Savings: 70-80% cost reduction per analysis
```

### 4.3 MEDIUM - Cache Improvements

#### Issue 6: Individual Redis Gets in Loop
```
File: open-seo-main/.../KeywordEnrichmentService.ts:83-98
Problem: for (const kw of keywords) { await this.getCached(kw.normalizedKeyword) }
Impact: 1000 keywords = 1000 Redis GET operations
Fix: Use Redis MGET for batch cache lookups
Savings: 10-100x faster cache checks
```

### 4.4 GOOD Patterns (No Changes Needed)

| Pattern | Location | Status |
|---------|----------|--------|
| Singleflight | `singleflight.ts`, `job-deduplication.ts` | ✅ Prevents duplicate API calls |
| Circuit Breaker | `ResilientClassifier.ts`, `retry_utils.py` | ✅ Prevents retry storms |
| Exponential Backoff | `retry.ts`, `retry_utils.py` | ✅ Proper jitter implemented |
| Rate Limiting | `redis-rate-limiter.ts` | ✅ 5 req/sec for DataForSEO |

---

## 5. Local Embedding Server Migration

### 5.1 Current State

**Existing Local Server**: `open-seo-main/src/server/services/embedding-server/server.py`
- Model: `jinaai/jina-embeddings-v5-text-nano`
- Endpoint: `POST /embed`
- Output: 768-dim normalized embeddings
- Port: 8001

**Current Cascade (ResilientEmbedding.ts)**:
```
1. Redis Cache (80%+ hit rate) ✅
2. Local embedding server (v5-nano) ✅
3. Jina API fallback (v5-nano) ← REMOVE THIS
4. THROW (job goes to DLQ)
```

### 5.2 Files to Modify

| Priority | File | Changes |
|----------|------|---------|
| P1 | `ResilientEmbedding.ts:141-214` | Remove Jina API fallback, local-only |
| P1 | `embedding-service.ts:176-235` | Remove `callJinaApi()` method |
| P1 | `embedding-config.ts:117-151` | Remove `jinaApiUrl`, `getApiPayload()` |
| P1 | `AI-Writer/.../embedding_service.py:97-113` | Replace Jina HTTP calls with local server |
| P2 | `types/embeddings.ts:25-34` | Update `EmbeddingModel` enum |
| P2 | `.env.example` | Remove `JINA_API_KEY` |

### 5.3 Local Server Specification

```yaml
# docker-compose.dev.yml addition
embedding-server:
  build: open-seo-main/src/server/services/embedding-server
  environment:
    - EMBEDDING_MODEL=jinaai/jina-embeddings-v5-text-nano
    - PORT=8001
  ports:
    - "8001:8001"
  deploy:
    resources:
      limits:
        memory: 2G  # Model ~300MB + inference overhead
```

### 5.4 Cost Elimination

| Scale | Current Jina Cost | Post-Migration | Savings |
|-------|-------------------|----------------|---------|
| Dev (1K kw/day) | $5-10/mo | $0 | $5-10/mo |
| Small (10K kw/day) | $20-50/mo | $0 | $20-50/mo |
| Medium (100K kw/day) | $200-500/mo | $0 | $200-500/mo |
| Large (1M kw/day) | $2,000+/mo | +$20/mo VPS | $1,980/mo |

---

## 6. Priority Action Matrix

### 6.1 P0 - Immediate (This Week)

| Action | Effort | Savings | Implementation |
|--------|--------|---------|----------------|
| **Deploy local embedding server** | 2h | $5-500/mo | Remove Jina API fallback |
| **Replace DataForSEO Lighthouse** | 1h | $30-50/mo | Use PageSpeed Insights API (FREE) |
| **Fix ResilientClassifier batching** | 2h | 90% classification cost | Single prompt for batch |

### 6.2 P1 - High Priority (This Month)

| Action | Effort | Savings | Implementation |
|--------|--------|---------|----------------|
| **Fix TranslationService batching** | 3h | 80-90% translation cost | True batch prompt |
| **Fix AI Quality Analysis** | 2h | 70-80% per analysis | Consolidate 5 calls → 1 |
| **Add DataForSEO caching** (backlinks, domain) | 2h | 50-60% on those endpoints | 24h Redis TTL |
| **Use GSC for own-site rankings** | 3h | $50-100/mo | Check GSC first, DataForSEO fallback |

### 6.3 P2 - Medium Priority (Next Month)

| Action | Effort | Savings | Implementation |
|--------|--------|---------|----------------|
| **Consolidate search APIs** | 2h | $10-30/mo | Pick one: Serper (cheapest) |
| **Use Redis MGET** | 1h | 10-100x faster | Batch cache lookups |
| **Fix competitor analysis batching** | 3h | 60-80% | Chunk competitors |

### 6.4 P3 - Low Priority (When Convenient)

| Action | Effort | Savings | Implementation |
|--------|--------|---------|----------------|
| Use Groq FREE tier for simple extraction | 1h | $10-20/mo | llama-3.1-8b for light tasks |
| Consolidate Resend + Loops | 2h | $5-10/mo | Single email provider |
| Voice analysis → Grok | 2h | $15-30/mo | Quality risk - test first |

---

## 7. Estimated Total Savings

| Category | Current Est. | After Optimization | Monthly Savings |
|----------|--------------|-------------------|-----------------|
| Embeddings | $5-500 | $0 | **$5-500** |
| DataForSEO | $200-800 | $100-400 | **$100-400** |
| LLM (batching fixes) | $100-280 | $30-100 | **$70-180** |
| Lighthouse | $30-50 | $0 | **$30-50** |
| Search APIs | $20-70 | $10-30 | **$10-40** |
| **TOTAL** | **$355-1,700** | **$140-530** | **$215-1,170** |

**Conservative estimate**: 40-60% reduction in external API costs
**Aggressive estimate**: 60-70% reduction with all optimizations

---

## Appendix A: Environment Variables Reference

```bash
# LLM Providers
OPENAI_API_KEY=           # Optional - fallback only
ANTHROPIC_API_KEY=        # Required - Claude for quality tasks
GOOGLE_AI_API_KEY=        # Required - Gemini for content
XAI_API_KEY=              # Required - Grok for classification
OPENROUTER_API_KEY=       # Optional - multi-model routing

# Embeddings (REMOVE after local server)
JINA_API_KEY=             # REMOVE - use local server
EMBEDDING_SERVER_URL=http://localhost:8001  # Local server

# SEO Data
DATAFORSEO_LOGIN=         # Required
DATAFORSEO_PASSWORD=      # Required

# Email
RESEND_API_KEY=           # Required
LOOPS_API_KEY=            # Optional - consolidate with Resend

# Search
SERPER_API_KEY=           # Pick one
EXA_API_KEY=              # Optional
TAVILY_API_KEY=           # Optional

# Auth
CLERK_SECRET_KEY=         # Required (or use better-auth)

# Signing (Lithuania)
DOKOBIT_API_KEY=          # Required for e-signatures

# Analytics (FREE)
POSTHOG_API_KEY=          # Optional
```

---

## Appendix B: Model Quick Reference

**When to use each model:**

| Model | Best For | Avoid For |
|-------|----------|-----------|
| grok-4.1-fast | Bulk classification, structured extraction | Long-form content |
| grok-4.1 | Funnel logic, moderate reasoning | Content generation |
| claude-sonnet-4 | Accuracy-critical tasks, proposals | Bulk operations |
| claude-3.5-sonnet | Voice/tone analysis | Simple extraction |
| gemini-2.5-pro | Article generation, quality content | Bulk tasks |
| gemini-1.5-pro | Lithuanian, translations | English content |
| gemini-1.5-flash | Audio transcription, cheap tasks | Quality content |
| llama-3.1-8b (Groq) | Simple extraction (FREE) | Anything complex |
