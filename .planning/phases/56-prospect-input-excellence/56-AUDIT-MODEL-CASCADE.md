# Model Cascade and LLM Classification Systems Audit

**Date:** 2026-04-30  
**Auditor:** Claude Opus 4.5  
**Scope:** open-seo-main + AI-Writer LLM orchestration patterns

---

## Executive Summary

The TeveroSEO platform has **production-grade LLM orchestration** in the open-seo-main subsystem with a well-designed multi-model cascade (Claude -> GPT-4o-mini -> Rules). The AI-Writer subsystem has a different approach with environment-driven provider selection and simple single-fallback patterns. Neither system implements task-complexity-based model selection.

**Production Readiness Rating: 7/10**

---

## LLM Usage Inventory

### open-seo-main (TypeScript/TanStack Start)

| Task | Model Used | File:Line | Fallback Chain | Circuit Breaker |
|------|------------|-----------|----------------|-----------------|
| Keyword Classification | claude-sonnet-4-20250514 | `ResilientClassifier.ts:231` | Claude -> GPT-4o-mini -> Rule-based | Yes (per-backend) |
| Business Priority Parsing | claude-sonnet-4-20250514 | `BusinessPriorityParser.ts:53` | None | No |
| Conversation Extraction | claude-sonnet-4-20250514 | `ConversationExtractor.ts:19` | None (throws error) | No |
| Voice Preview Generation | claude-sonnet-4-20250514 | `voice.ts:429` | Fallback samples | No |
| Voice Analysis | claude-3-5-sonnet-20241022 | `VoiceAnalyzer.ts:16` | None | No |
| Business Extraction (scraper) | claude-3-5-sonnet-20241022 | `businessExtractor.ts:18` | None | No |
| Keyword Generation | claude-3-5-sonnet-20241022 | `keywordGenerator.ts:170` | None | No |
| Selector Discovery | claude-sonnet-4-20250514 | `SelectorDiscoveryService.ts:55` | None | No |
| Translation | gemini-1.5-pro | `TranslationService.ts:32` | Retry with shorter prompt | No |

### AI-Writer (Python/FastAPI)

| Task | Model Used | File:Line | Fallback Chain | Circuit Breaker |
|------|------------|-----------|----------------|-----------------|
| Text Generation | gemini-2.0-flash-001 (primary) | `main_text_generation.py:76` | Google -> HuggingFace | Soft (1 fallback) |
| Text Generation | openai/gpt-oss-120b:cerebras | `main_text_generation.py:104` | HuggingFace fallback | Soft |
| SIF Agents | txtai embeddings | `agents.py` | None (local service) | No |

---

## Cascade Logic

### ResilientClassifier (Production-Grade)

```
                    +------------------+
                    |  classify()      |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    | Claude Available?|
                    | Circuit Closed?  |
                    +--------+---------+
                             |
              Yes            |            No
         +-------------------+-------------------+
         |                                       |
         v                                       v
+------------------+                   +------------------+
| Claude Sonnet 4  |                   | OpenAI Available?|
| (Primary LLM)    |                   | Circuit Closed?  |
+--------+---------+                   +--------+---------+
         |                                       |
   Success|Failure                    Yes        |         No
         |                             |         |          |
         +--------+                    v         +----------+
                  |           +------------------+          |
                  |           | GPT-4o-mini      |          |
                  |           | (Fallback LLM)   |          |
                  |           +--------+---------+          |
                  |                    |                    |
                  |              Success|Failure            |
                  |                    |                    |
                  +--------------------+--------------------+
                                       |
                                       v
                              +------------------+
                              | Rule-Based       |
                              | (Always Works)   |
                              +------------------+
```

**Actual fallback code (ResilientClassifier.ts:475-553):**

```typescript
// Try Claude first (if configured and circuit closed)
if (this.claude && this.claudeCircuit.allowsRequest) {
  try {
    const result = await this.claude.classify(keyword, categories);
    this.claudeCircuit.recordSuccess();
    return { ...result, source: "claude", isFallback: false };
  } catch (error) {
    this.claudeCircuit.recordFailure();
    log.warn("Claude classification failed, trying fallback", { ... });
  }
}

// Try OpenAI fallback (if configured and circuit closed)
if (this.openai && this.openaiCircuit.allowsRequest) {
  try {
    const result = await this.openai.classify(keyword, categories);
    this.openaiCircuit.recordSuccess();
    return { ...result, source: "openai", isFallback: true };
  } catch (error) {
    this.openaiCircuit.recordFailure();
    log.warn("OpenAI classification failed, using rules", { ... });
  }
}

// Last resort: rule-based classification
const result = this.rules.classify(keyword, categories);
return { ...result, isFallback: this.claude !== null || this.openai !== null };
```

### AI-Writer Text Generation Fallback

```
                    +------------------+
                    | llm_text_gen()   |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    | Resolve Provider |
                    | (env/tenant/arg) |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    | Primary Provider |
                    | (Google/HF/etc)  |
                    +--------+---------+
                             |
                   Success   |   Failure
                      +------+------+
                      |             |
                      v             v
               +----------+  +------------------+
               | Return   |  | ONE Fallback Try |
               +----------+  | (circuit breaker)|
                             +--------+---------+
                                      |
                            Success   |   Failure
                               +------+------+
                               |             |
                               v             v
                        +----------+  +----------+
                        | Return   |  | HTTPException|
                        +----------+  | 429 Error   |
                                      +----------+
```

**Actual fallback code (main_text_generation.py:420-541):**

```python
except Exception as provider_error:
    logger.error(f"[llm_text_gen] Provider {gpt_provider} failed: {str(provider_error)}")
    
    # CIRCUIT BREAKER: Only try ONE fallback to prevent expensive API calls
    fallback_providers = ["google", "huggingface"]
    fallback_providers = [p for p in fallback_providers if p in available_providers and p != gpt_provider]
    
    if fallback_providers:
        fallback_provider = fallback_providers[0]  # Only try the first available
        try:
            # ... attempt fallback
        except Exception as fallback_error:
            logger.error(f"[llm_text_gen] Fallback provider {fallback_provider} also failed")
    
    # CIRCUIT BREAKER: Stop immediately to prevent expensive API calls
    logger.error("[llm_text_gen] CIRCUIT BREAKER: All providers failed.")
    raise HTTPException(status_code=429, detail={...})
```

---

## Circuit Breaker Architecture

### open-seo-main: Dual-Layer Circuit Breakers

**1. In-Memory Circuit Breaker (per-service instance):**
```typescript
// CircuitBreaker.ts
export class CircuitBreaker {
  private failures = 0;
  private state: CircuitState = CircuitState.CLOSED;
  private lastFailureTime = 0;
  
  // Default: 3 failures -> OPEN, 60s recovery
  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }
}
```

**2. Redis-Backed Circuit Breaker (distributed):**
```typescript
// redis-circuit-breaker.ts
export const anthropicCircuitBreaker = new RedisCircuitBreaker(
  "anthropic",
  3,      // 3 failures to open
  60000,  // 60s recovery
);

export const openaiCircuitBreaker = new RedisCircuitBreaker(
  "openai",
  3,      // 3 failures to open
  60000,  // 60s recovery
);
```

The Redis circuit breaker includes **in-memory fallback** when Redis is unavailable:

```typescript
async isOpen(): Promise<boolean> {
  try {
    const state = await redis.hgetall(this.key);
    // ... Redis logic
  } catch (error) {
    // Fall back to in-memory state
    return this.isOpenInMemory();
  }
}
```

### AI-Writer: Soft Circuit Breaker (Code-Level)

No formal circuit breaker class. Instead, uses a "try-once-fallback" pattern:

```python
# Only try ONE fallback to prevent expensive API calls
fallback_providers = [p for p in fallback_providers if p != gpt_provider]
if fallback_providers:
    fallback_provider = fallback_providers[0]  # Single attempt
```

---

## Adaptiveness Assessment

### Does the model selection adapt based on:

| Criterion | open-seo-main | AI-Writer |
|-----------|---------------|-----------|
| Task complexity? | No | No |
| Cost constraints? | No | Partial (subscription limits) |
| Previous failures? | Yes (circuit breaker) | Yes (single fallback) |
| User preferences? | No | Yes (tenant config) |
| Token budget? | No | Yes (max_tokens param) |
| Response quality? | No | No |
| Latency requirements? | No | No |

### Detailed Analysis

**Task Complexity Adaptation: NOT IMPLEMENTED**

All tasks use hardcoded models regardless of complexity:
- Simple keyword classification: Claude Sonnet 4 (expensive)
- Complex voice analysis: Claude 3.5 Sonnet (older model)
- Translation: Gemini 1.5 Pro (consistent)

**Cost Constraints: PARTIAL**

AI-Writer implements subscription-based limits:
```python
can_proceed, message, usage_info = pricing_service.check_usage_limits(
    user_id=user_id,
    provider=provider_enum,
    tokens_requested=estimated_total_tokens,
)
if not can_proceed:
    raise HTTPException(status_code=429, detail=error_detail)
```

**Previous Failures: YES**

Both systems track failures and circuit-break:
- open-seo-main: 3 failures -> 60s cooldown
- AI-Writer: 1 failure -> try fallback -> give up

**User Preferences: PARTIAL (AI-Writer only)**

```python
# Tenant provider config resolver
provider_cfg = tenant_provider_config_resolver.resolve(
    modality="text",
    user_id=user_id,
)
```

---

## HTTP Client Configuration

**LLM API Timeouts (http-client.ts):**

```typescript
// Anthropic Claude API client
export const anthropicClient = new HttpClient({
  baseUrl: "https://api.anthropic.com",
  timeout: 120000,          // 2 minute timeout
  retries: 2,               // 2 retry attempts
  retryDelay: 2000,         // 2s base delay
  circuitBreakerThreshold: 3,
  circuitBreakerRecoveryTime: 60000,
});

// OpenAI API client
export const openaiClient = new HttpClient({
  baseUrl: "https://api.openai.com",
  timeout: 120000,          // 2 minute timeout
  retries: 2,
  retryDelay: 2000,
  circuitBreakerThreshold: 3,
  circuitBreakerRecoveryTime: 60000,
});
```

**Rate Limiters (redis-rate-limiter.ts):**

```typescript
export const anthropicRateLimiter = new RedisRateLimiter("anthropic", 10, 10);
export const openaiRateLimiter = new RedisRateLimiter("openai", 10, 10);
```

---

## Model Version Inconsistency

The codebase uses multiple Claude model versions:

| Service | Model Version | Notes |
|---------|---------------|-------|
| ResilientClassifier | claude-sonnet-4-20250514 | Latest |
| BusinessPriorityParser | claude-sonnet-4-20250514 | Latest |
| ConversationExtractor | claude-sonnet-4-20250514 | Latest |
| Voice Preview | claude-sonnet-4-20250514 | Latest |
| VoiceAnalyzer | claude-3-5-sonnet-20241022 | Older (env override) |
| BusinessExtractor | claude-3-5-sonnet-20241022 | Older (env override) |
| KeywordGenerator | claude-3-5-sonnet-20241022 | Older (hardcoded) |
| SelectorDiscovery | claude-sonnet-4-20250514 | Latest |

**Risk:** Inconsistent model behavior across features.

---

## Production Readiness Gaps

### Critical Gaps (Must Fix)

1. **No retry with exponential backoff for Anthropic SDK calls**
   - `BusinessPriorityParser` uses `withRetry` but only 3 retries with 1s base delay
   - Other Claude callers have no retry logic

2. **No graceful degradation for extraction services**
   - `ConversationExtractor` throws `AppError` on failure
   - Should return partial results or cached fallback

3. **Model version drift**
   - Different services use different Claude versions
   - No centralized model version management

### High Priority Gaps

4. **No cost tracking per request**
   - AI-Writer tracks usage but open-seo-main does not
   - Cannot optimize model selection by cost

5. **No quality-based fallback**
   - Fallback triggers on error, not low-quality response
   - Should detect and retry on low-confidence results

6. **No request prioritization**
   - All requests treated equally
   - Should deprioritize batch operations during peak

### Medium Priority Gaps

7. **No model warm-up / keep-alive**
   - Cold starts add latency
   - Should maintain connection pools

8. **No A/B testing infrastructure**
   - Cannot compare model performance
   - No gradual rollout capability

---

## Production Readiness Score

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Fallback/Cascade Logic | 8/10 | 25% | 2.0 |
| Circuit Breaker | 9/10 | 20% | 1.8 |
| Error Handling | 6/10 | 15% | 0.9 |
| Model Version Management | 4/10 | 10% | 0.4 |
| Cost Optimization | 5/10 | 10% | 0.5 |
| Observability | 7/10 | 10% | 0.7 |
| Adaptive Selection | 3/10 | 10% | 0.3 |

**Total: 6.6/10 (rounded to 7/10)**

---

## Recommendations

### Immediate (Phase 56)

1. **Standardize model versions** - Create `MODEL_VERSIONS.ts` constant file
2. **Add graceful degradation** to ConversationExtractor
3. **Implement per-request cost tracking** for open-seo-main

### Short-term (Phase 57-58)

4. **Add quality-based retry** - If confidence < 0.7, try next model
5. **Implement request priority queue** - Batch vs interactive
6. **Create unified LLM client** - Single abstraction for all LLM calls

### Long-term (Phase 59+)

7. **Task-complexity-based routing** - Simple tasks use smaller models
8. **A/B testing infrastructure** - Compare model performance
9. **Predictive cost budgeting** - Per-user cost limits with soft warnings

---

## Files Audited

### open-seo-main
- `/src/server/features/keywords/services/ResilientClassifier.ts`
- `/src/server/features/keywords/services/BusinessPriorityParser.ts`
- `/src/server/features/keywords/services/CircuitBreaker.ts`
- `/src/server/features/prospects/services/ConversationExtractor.ts`
- `/src/serverFunctions/voice.ts`
- `/src/server/features/voice/services/VoiceAnalyzer.ts`
- `/src/server/lib/http-client.ts`
- `/src/server/lib/redis-circuit-breaker.ts`
- `/src/server/lib/redis-rate-limiter.ts`
- `/src/server/lib/scraper/businessExtractor.ts`
- `/src/server/lib/opportunity/keywordGenerator.ts`
- `/src/server/features/scraping/services/SelectorDiscoveryService.ts`
- `/src/server/services/translation/TranslationService.ts`

### AI-Writer
- `/backend/services/llm_providers/main_text_generation.py`
- `/backend/services/llm_providers/routing_policy.py`
- `/backend/services/llm_providers/tenant_provider_config.py`
- `/backend/services/intelligence/agents.py`

### apps/web
- `/src/app/(shell)/prospects/actions.ts` (proxy to open-seo-main)
