# Cost Optimization Master

> **Single source of truth** for LLM architecture, cost optimization, and caching strategy.  
> **Created:** 2026-05-06  
> **Supersedes:** MODEL-REFERENCE.md, LLM-ARCHITECTURE.md, COST-CONTROL-MASTER.md, COST-OPTIMIZATION-DEEP-DIVE.md, API-COST-ANALYSIS.md

---

## Executive Summary

TeveroSEO uses a **two-model architecture** optimized for cost efficiency:

| Layer | Model | Provider | Cost | Use Case |
|-------|-------|----------|------|----------|
| **Analysis** | `grok-4.1-fast` | xAI | $0.20/1M input | Classification, clustering, CopilotKit |
| **Content** | `gemini-3.1-pro` | Google | $1.25/1M input | Articles, voice, translations |
| **Image** | `gemini-3.1-flash-image-preview` | Google | ~$0.02/image | All image generation |
| **Voice (fallback)** | `claude-sonnet-4-6` | Anthropic | $3.00/1M input | Voice extraction if Gemini insufficient |

**Monthly savings potential:** $3,100-4,300 (65-75% reduction from naive approach)

**Key optimization:** 200-keyword batching (4x fewer API calls, 75% call reduction)

---

## Table of Contents

1. [Model Inventory](#1-model-inventory)
2. [Provider Routing](#2-provider-routing)
3. [Cost Centers](#3-cost-centers)
4. [SEO-Specific Caching](#4-seo-specific-caching)
5. [Already Implemented](#5-already-implemented)
6. [Implementation Gaps](#6-implementation-gaps)
7. [Migration Checklist](#7-migration-checklist)
8. [Priority Matrix](#8-priority-matrix)
9. [Batching Optimizations](#9-batching-optimizations)
10. [Concurrency & Throughput](#10-concurrency--throughput)
11. [LLM Prompt Optimizations](#11-llm-prompt-optimizations)
12. [Performance Gains Summary](#12-performance-gains-summary)
13. [Implementation Quick Reference](#13-implementation-quick-reference)

---

## 1. Model Inventory

### Core Models (USE THESE)

| Model ID | Provider | Cost (Input/Output) | Use Case | Context |
|----------|----------|---------------------|----------|---------|
| `grok-4.1-fast` | xAI | $0.20/$0.50 per 1M | Bulk classification, structured extraction, CopilotKit | 2M tokens |
| `grok-4.1` | xAI | $0.40/— | Moderate reasoning, funnel classification | 2M tokens |
| `grok-4.1-thinking` | xAI | $2.00/— | Strategic analysis, proposal narratives | 2M tokens |
| `gemini-3.1-pro` | Google | $1.25-2.00/$5.00-12.00 | Article generation, voice analysis, translations | 2M tokens |
| `gemini-3.1-flash` | Google | $0.075/— | Fast tasks, audio transcription | — |
| `gemini-3.1-flash-lite` | Google | $0.02/— | Ultra-cheap fallback | — |
| `gemini-3.1-flash-image-preview` | Google | ~$0.02/image | All image generation | — |
| `claude-sonnet-4-6` | Anthropic | $3.00/$15.00 | Voice extraction (fallback only) | — |

### Deprecated Models (DO NOT USE)

| Outdated Model | Replace With | Reason |
|----------------|--------------|--------|
| `claude-3-5-sonnet-*` | `claude-sonnet-4-6` | Old naming convention |
| `claude-3-sonnet-*` | `claude-sonnet-4-6` | Deprecated |
| `claude-3-haiku-*` | `grok-4.1-fast` | Cost optimization |
| `gemini-1.5-pro` | `gemini-3.1-pro` | Outdated |
| `gemini-2.5-*` | `gemini-3.1-*` | Outdated |
| `gpt-4o-mini` | `grok-4.1-fast` | Cost optimization |
| `gpt-4o` | `grok-4.1` | Cost optimization |
| `grok-2-mini` | `grok-4.1-fast` | Outdated |
| `imagen-*` | `gemini-3.1-flash-image-preview` | Consolidated |

---

## 2. Provider Routing

### Environment Variables

```bash
# PRIMARY (REQUIRED)
XAI_API_KEY=                          # Grok 4.1 access
GOOGLE_AI_API_KEY=                    # Gemini 3.1 access

# FALLBACK (OPTIONAL)
ANTHROPIC_API_KEY=                    # Claude Sonnet 4.6 (voice backup)

# LOCAL SERVICES (REQUIRED)
EMBEDDING_SERVER_URL=http://localhost:8001  # Local jina-v5-text-nano

# MODEL OVERRIDES (OPTIONAL)
CLASSIFICATION_MODEL=grok-4.1-fast
CONTENT_MODEL=gemini-3.1-pro
VOICE_MODEL=gemini-3.1-pro
IMAGE_MODEL=gemini-3.1-flash-image-preview

# PROVIDER BACKENDS (direct | azure | openrouter)
GROK_BACKEND=direct
GEMINI_BACKEND=direct
ANTHROPIC_BACKEND=direct

# OPENROUTER (OPTIONAL)
USE_OPENROUTER=false
OPENROUTER_API_KEY=
```

### Provider Configuration Pattern

```typescript
// Target: /open-seo-main/src/server/lib/llm/config.ts
export const LLM_CONFIG = {
  providers: {
    grok: {
      backend: process.env.GROK_BACKEND || 'direct',
      apiKey: process.env.XAI_API_KEY,
      baseUrl: 'https://api.x.ai/v1',
    },
    gemini: {
      backend: process.env.GEMINI_BACKEND || 'direct',
      apiKey: process.env.GOOGLE_AI_API_KEY,
    },
    anthropic: {
      backend: process.env.ANTHROPIC_BACKEND || 'direct',
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  },
  
  models: {
    classification: process.env.CLASSIFICATION_MODEL || 'grok-4.1-fast',
    content: process.env.CONTENT_MODEL || 'gemini-3.1-pro',
    voice: process.env.VOICE_MODEL || 'gemini-3.1-pro',
    image: process.env.IMAGE_MODEL || 'gemini-3.1-flash-image-preview',
  },
  
  openrouter: {
    enabled: process.env.USE_OPENROUTER === 'true',
    apiKey: process.env.OPENROUTER_API_KEY,
    modelMap: {
      'grok-4.1-fast': 'x-ai/grok-4.1-fast',
      'gemini-3.1-pro': 'google/gemini-3.1-pro',
      'claude-sonnet-4-6': 'anthropic/claude-sonnet-4-6',
    },
  },
};
```

### Backend Options

| Backend | When to Use | Example |
|---------|-------------|---------|
| `direct` | Default, direct API access | `https://api.x.ai/v1` |
| `azure` | Enterprise Azure endpoints | `https://your-resource.openai.azure.com` |
| `openrouter` | Unified billing, fallback routing | `https://openrouter.ai/api/v1` |

---

## 3. Cost Centers

### LLM API Costs

| Operation | Model | Cost | Monthly Est. |
|-----------|-------|------|--------------|
| Keyword classification | grok-4.1-fast | $0.04/prospect | $40-100 |
| Funnel classification | grok-4.1 | $0.08/batch | $20-50 |
| Proposal narratives | grok-4.1-thinking | $0.50/proposal | $50-150 |
| Article generation | gemini-3.1-pro | $0.20-0.50/article | $100-250 |
| Voice analysis | gemini-3.1-pro | $0.10/analysis | $30-80 |
| Translation | gemini-3.1-pro | $0.05/page | $50-100 |
| **Total LLM** | | | **$290-730** |

### DataForSEO Costs

| Endpoint | Cost/Call | Caching Status | Monthly Est. |
|----------|-----------|----------------|--------------|
| Search volume | $0.005/kw | ✅ 7-day Redis | $50-100 |
| Related keywords | $0.02-0.10 | ✅ 24h file | $100-200 |
| Domain overview | $0.05 | ❌ NONE | $100-200 |
| Ranked keywords | $0.05-0.10 | ✅ 12h file | $100-200 |
| SERP organic | $0.01-0.02 | ✅ 24h L1+L2 | $50-100 |
| Lighthouse | $0.004 | ❌ NONE | $20-50 |
| Backlinks | $0.01-0.05 | ❌ NONE | $100-200 |
| Prospect analysis | $0.05-0.10 × 4-5 | ❌ NONE | $400-800 |
| **Total DataForSEO** | | | **$920-1,850** |

### Crawling Costs

| Provider | Cost | When Used |
|----------|------|-----------|
| Direct fetch | ~$0.02/1k pages | Static HTML |
| DataForSEO OnPage | $0.001/page | JS-rendered (default) |
| Playwright | $2-5/1k pages | Explicit opt-in only |

### Embedding Costs

| Provider | Cost | Status |
|----------|------|--------|
| Local server (jina-v5-text-nano) | $0.00 | ✅ Implemented |
| Jina API (fallback) | $0.02/1M tokens | ✅ Fallback only |

---

## 4. SEO-Specific Caching

### Cache TTL Strategy

| Data Type | Volatility | TTL | Rationale |
|-----------|------------|-----|-----------|
| Keyword volumes | Low | 14-30 days | Google Ads updates monthly |
| SERP positions | High | 3-7 days | Week-to-week stable |
| Competitor analysis | Medium | 7 days | Weekly refresh sufficient |
| Backlink data | Low | 7 days | Backlinks change slowly |
| Domain metrics | Low | 7 days | Traffic stable weekly |
| Content quality | Stable | Permanent | Deterministic |
| Translations | Deterministic | Permanent | SHA256 hash key |
| Embeddings | Deterministic | 30 days | Same input = same output |
| Classifications | Semi-stable | 30 days | Re-classify monthly |

### Multi-Tenant Flywheel

Cross-client caching provides compounding benefits:

```
Client A classifies "šampūnas" → Cache stores result
Client B queries "šampūnas" → Cache HIT (no API call)
Client C queries "šampūnas" → Cache HIT (no API call)
...
```

**Impact:** At 95% cache hit rate, cost drops from $3.67 to $0.67 per 10K keywords (82% reduction)

### Cache Key Patterns

```typescript
// Embeddings (global, cross-tenant)
`emb:v3:${sha256(text)}` → 30 days

// Classifications (global, cross-tenant)
`class:v1:${sha256(keyword)}` → 30 days

// Prospect analysis (per-domain)
`prospect:${domain}:analysis` → 7 days

// Backlinks (per-domain)
`backlinks:${domain}:summary` → 7 days

// SERP (per-keyword-location)
`serp:${keyword}:${location}` → 3-7 days
```

---

## 5. Already Implemented

| Component | Location | Status |
|-----------|----------|--------|
| **Revolut payments** | `/open-seo-main/src/server/features/payments/providers/RevolutProvider.ts` | ✅ Production |
| **Stripe payments** | `/open-seo-main/src/server/features/proposals/payment/payment.ts` | ✅ Production |
| **Model router** | `/open-seo-main/src/server/features/keywords/services/model-router.ts` | ✅ Production |
| **Multi-backend config** | `/open-seo-main/src/server/features/keywords/services/provider-config.ts` | ✅ Production |
| **Embedding cascade** | `/open-seo-main/src/server/features/keywords/services/ResilientEmbedding.ts` | ✅ Production |
| **Tiered embedding cache** | `/open-seo-main/src/server/features/keywords/services/TieredEmbeddingCache.ts` | ✅ Production |
| **Universal crawler** | `/open-seo-main/src/server/features/platform-oauth/crawler/UniversalCrawler.ts` | ✅ Production |
| **Translation cache** | Database table `translationCache` | ✅ Production |
| **R2 backlinks cache** | `/open-seo-main/src/server/lib/r2-cache.ts` | ✅ Production |

---

## 6. Implementation Gaps

### Missing Caches (High Priority)

| Gap | Monthly Impact | Implementation |
|-----|----------------|----------------|
| **Prospect analysis cache** | $800-1,500 | Redis, 7-day TTL, key: `prospect:{domain}:analysis` |
| **Domain overview cache** | $200-400 | Redis, 7-day TTL, key: `domain:{domain}:overview` |
| **Lighthouse cache** | $100-200 | Redis, 24h TTL, key: `lighthouse:{url}:report` |

### Model ID Updates Needed

| File | Current | Target |
|------|---------|--------|
| `config.ts:30` | `grok-2-mini` | `grok-4.1-fast` |
| `config.ts:42` | `gemini-2.5-flash-lite` | `gemini-3.1-flash` |
| `model-router.ts:57` | `grok-2-mini` | `grok-4.1-fast` |
| `provider-config.ts:49` | `grok-2-mini` | `grok-4.1-fast` |
| `VoiceAnalyzer.ts:16` | `claude-3-5-sonnet-*` | `gemini-3.1-pro` |
| `TranslationService.ts:35` | `gemini-1.5-pro` | `gemini-3.1-pro` |
| `gemini.ts:529` | `gemini-1.5-pro` | `gemini-3.1-pro` |

---

## 7. Migration Checklist

### Phase 1: Model ID Updates (P0)

- [ ] Update `config.ts` - Grok model ID
- [ ] Update `config.ts` - Gemini model ID
- [ ] Update `model-router.ts` - model array
- [ ] Update `provider-config.ts` - OpenRouter map
- [ ] Test classification pipeline
- [ ] Verify CopilotKit still works

### Phase 2: Voice/Translation (P1)

- [ ] Update `VoiceAnalyzer.ts` - switch to Gemini
- [ ] Update `TranslationService.ts` - Gemini 3.1
- [ ] Update `gemini.ts` - model ID
- [ ] Test voice analysis quality
- [ ] Test translation quality

### Phase 3: Cache Gap Closure (P1)

- [ ] Implement prospect analysis cache
- [ ] Implement domain overview cache
- [ ] Implement Lighthouse cache
- [ ] Monitor cache hit rates

### Phase 4: AI-Writer Updates (P2)

- [ ] Update Python files (6 total)
- [ ] Test content generation
- [ ] Verify image generation

---

## 8. Priority Matrix

### P0 - This Week

| Task | Impact | Effort |
|------|--------|--------|
| Update model IDs in config.ts | Quality risk | 1h |
| Update model IDs in model-router.ts | Quality risk | 1h |
| Test classification pipeline | Validation | 2h |

### P1 - This Month

| Task | Impact | Effort |
|------|--------|--------|
| Implement prospect analysis cache | $800-1,500/mo | 3h |
| Implement domain overview cache | $200-400/mo | 2h |
| Update VoiceAnalyzer to Gemini | $48-98/mo | 2h |
| Update TranslationService | Quality | 1h |

### P2 - Next Month

| Task | Impact | Effort |
|------|--------|--------|
| Implement Lighthouse cache | $100-200/mo | 2h |
| Update AI-Writer Python files | Consistency | 4h |
| Extend classification cache TTL | $30/10K kw | 1h |

---

## Appendix: Cost Comparison

### Before Optimization

| Category | Monthly Cost |
|----------|--------------|
| LLM APIs | $800-1,500 |
| DataForSEO | $1,500-2,500 |
| Embeddings | $100-500 |
| **Total** | **$2,400-4,500** |

### After Optimization

| Category | Monthly Cost | Savings |
|----------|--------------|---------|
| LLM APIs | $290-730 | 64% |
| DataForSEO | $500-900 | 64% |
| Embeddings | $0-50 | 90%+ |
| **Total** | **$790-1,680** | **63-67%** |

**Annual savings: $19,000-34,000**

---

## 9. Batching Optimizations

### Grok 4.1 Actual Limits

| Spec | Value | Notes |
|------|-------|-------|
| **Context window** | 2M tokens | Massive headroom for batching |
| **Max output** | 131K tokens | Far exceeds any batch response |
| **Cost** | $0.20/1M input, $0.50/1M output | Same per-token regardless of batch size |

### Token Math for 200-Keyword Batch

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt | ~350 | Fixed overhead |
| User prompt | ~150 | Fixed overhead |
| 200 keywords × 15 tokens | ~3,000 | Variable input |
| **Total input** | **~3,500** | Well under 2M context |
| JSON output per keyword | ~40 | Structured response |
| 200 keywords × 40 tokens | ~8,000 | Variable output |
| **Required maxTokens** | **12,000** | With headroom |

**Bottleneck insight:** The previous 50-keyword limit was caused by an artificial `maxTokens: 4000` setting, not model constraints. Grok 4.1 can easily handle 200+ keywords per batch.

### Current Batch Sizes

| Operation | Location | Current | Optimal | Impact |
|-----------|----------|---------|---------|--------|
| Keyword classification | `config.ts:BATCH_SIZE` | 50 | **200** | **4x fewer API calls** |
| Funnel classification | `FunnelLLMClassifier.ts` | 100 | 250 | 2.5x fewer calls |
| ResilientClassifier (Pass 2) | `ResilientClassifier.ts:566` | 5 | 25 | 5x fewer calls |
| Translation | `TranslationService.ts:192` | 10 | 30-50 | 3-5x fewer calls |
| Embedding (Jina v5) | `embeddings.ts:68` | 64 | 64 | ✅ Optimal |
| DataForSEO keywords | `KeywordEnrichmentService.ts:25` | 1000 | 1000 | ✅ Optimal |
| SERP enrichment | `SerpEnricher.ts:62` | 100 | 100 | ✅ Optimal |
| Site audit pages | `siteAuditWorkflowPhases.ts` | 50 | 100 | 2x faster |
| Lighthouse URLs | `siteAuditWorkflowPhases.ts:26` | 10 | 20 | 2x faster |
| DB batch insert | `FindingsRepository.ts:11` | 100 | 100 | ✅ Optimal |

### Batching Fixes (High Impact)

```typescript
// Fix 1: Increase keyword classification batch to 200
// File: /open-seo-main/src/server/features/keywords/classification/config.ts
export const CLASSIFICATION_CONFIG = {
  BATCH_SIZE: 200, // was 50 (4x improvement)
  MAX_TOKENS: 12000, // was 4000 (required for 200 keywords)
  // ...
};

// Fix 2: Increase ResilientClassifier batch
// File: /open-seo-main/src/server/features/keywords/services/ResilientClassifier.ts:566
const batchSize = 25; // was 5

// Fix 3: Increase translation batch
// File: /open-seo-main/src/server/services/translation/TranslationService.ts:192
const BATCH_SIZE = 30; // was 10
```

---

## 10. Concurrency & Throughput

### Worker Concurrency (Configurable via ENV)

| Worker | Default | Env Variable | Can Increase? |
|--------|---------|--------------|---------------|
| Audit | 5 | `WORKER_CONCURRENCY_AUDIT` | Yes (to 8) |
| Prospect Analysis | 3 | `WORKER_CONCURRENCY_PROSPECT_ANALYSIS` | Yes (to 5) |
| Voice Analysis | 2 | `WORKER_CONCURRENCY_VOICE_ANALYSIS` | Rate limited |
| Analytics | 3 | `WORKER_CONCURRENCY_ANALYTICS` | Yes (to 5) |
| Report | 3 | `WORKER_CONCURRENCY_REPORT` | Yes (to 5) |
| Webhook | 5 | `WORKER_CONCURRENCY_WEBHOOK` | ✅ Optimal |

### External API Limits

| API | Current Limit | Location | Optimization |
|-----|---------------|----------|--------------|
| DataForSEO | 10 concurrent | `routing.ts:144` | Increase to 15-20 |
| DataForSEO RPS | 20 RPS | `routing.ts:148` | ✅ At API limit |
| Crawl per domain | 2 concurrent | `routing.ts:142` | ✅ Polite default |
| Translation delay | 1000ms | `TranslationService.ts:38` | Reduce to 500ms |

### Parallel Processing Patterns

```typescript
// Pattern 1: Concurrent batches with limit
import pLimit from 'p-limit';
const limit = pLimit(5); // 5 concurrent
const results = await Promise.all(
  batches.map(batch => limit(() => classifier.classify(batch)))
);

// Pattern 2: Redis MGET instead of loop
// Before (slow):
for (const key of keys) {
  results.push(await redis.get(key));
}
// After (fast):
const results = await redis.mget(keys); // 10-100x faster
```

---

## 11. LLM Prompt Optimizations

### Prompt Caching (NOT IMPLEMENTED - HIGH IMPACT)

| Provider | Feature | Discount | Implementation |
|----------|---------|----------|----------------|
| **Grok (xAI)** | Prompt caching | 75% on cached tokens | Add `cache_control` to system prompt |
| **Gemini** | Context caching | 90% on cached input | Use cached context API |
| **Claude** | Prompt caching | 90% read / 25% write | Add `cache_control: ephemeral` |

**Implementation for Grok:**
```typescript
// File: GrokClassifier.ts
const response = await client.chat.completions.create({
  model: 'grok-4.1-fast',
  messages: [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
      // Enable caching
      cache_control: { type: 'ephemeral' }
    },
    { role: 'user', content: userPrompt }
  ]
});
```

### Prompt Token Analysis

| Service | System Prompt | Cacheable | Compression Potential |
|---------|---------------|-----------|----------------------|
| GrokClassifier | ~350 tokens | 100% | LOW |
| FunnelLLMClassifier | ~600 tokens | 100% | LOW |
| ResilientClassifier | ~250 tokens (inline) | 0% | HIGH - use system msg |
| VoiceAnalyzer | ~800 tokens (inline) | 0% | HIGH - use system msg |
| TranslationService | ~600 tokens | 100% | LOW |

### Quick Wins

1. **Move inline prompts to system messages** - Enables caching
2. **Reduce max_tokens** - GrokClassifier uses 4000, needs ~1500
3. **Consolidate quality analysis** - 5 calls → 1 call (70-80% savings)

---

## 12. Performance Gains Summary

### Latency Improvements

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Local embedding server | 458ms | 37ms | **12x faster** |
| Redis MGET batching | N ops | 1 op | **10-100x faster** |
| Stale-while-revalidate | 100% wait | Instant return | **50% perceived** |
| UMAP pre-processing | 768D | 15D | **6-7x faster clustering** |

### Throughput Improvements

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Classification batching | 50/call | 200/call | **4x throughput** |
| Funnel batching | 100/call | 250/call | **2.5x throughput** |
| Pass 2 batching | 5/call | 25/call | **5x throughput** |
| Translation batching | 10/call | 30/call | **3x throughput** |

### API Call Reduction

| Operation | Before | After | Reduction |
|-----------|--------|-------|-----------|
| 10K keyword classification | 200 calls | 50 calls | **75%** |
| Quality analysis per prospect | 5 calls | 1 call | **80%** |
| Translation (100 texts) | 10 calls | 3-4 calls | **65%** |

---

## 13. Implementation Quick Reference

### Config Files to Modify

| File | Changes |
|------|---------|
| `classification/config.ts` | BATCH_SIZE: 50→200, MAX_TOKENS: 4000→12000, model IDs |
| `services/ResilientClassifier.ts:566` | batchSize: 5→25 |
| `translation/TranslationService.ts:192` | BATCH_SIZE: 10→30 |
| `services/model-router.ts` | Update model IDs |
| `services/provider-config.ts` | Update OpenRouter map |
| `config/routing.ts:144` | dataforseo_concurrent: 10→15 |

### Environment Variables to Add

```bash
# Batching overrides
CLASSIFICATION_BATCH_SIZE=200
TRANSLATION_BATCH_SIZE=30

# Grok configuration
GROK_MAX_TOKENS=12000

# Concurrency increases
WORKER_CONCURRENCY_PROSPECT_ANALYSIS=5
WORKER_CONCURRENCY_ANALYTICS=5

# API limits
DATAFORSEO_CONCURRENT=15
```

### Verification Commands

```bash
# Check batch sizes are applied
grep -r "BATCH_SIZE" open-seo-main/src/

# Monitor cache hit rates
redis-cli INFO stats | grep hit

# Check API call counts
grep -r "api_calls" logs/ | wc -l
```
