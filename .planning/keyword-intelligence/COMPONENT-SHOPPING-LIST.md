# Keyword Intelligence: Component Shopping List

> **Version:** 1.0  
> **Created:** 2026-05-05  
> **Purpose:** Precise spec of what we need, why, and alternatives to research
> **Hardware Target:** 8 vCPU AMD EPYC, 24GB RAM, 100 prospects/hour

---

## Table of Contents

1. [Decisions Already Made](#1-decisions-already-made)
2. [V1 Scope: Ship vs Skip](#2-v1-scope-ship-vs-skip)
3. [Component Shopping List](#3-component-shopping-list)
4. [Research Questions](#4-research-questions)

---

## 1. Decisions Already Made

### Cold Start Analysis Conclusions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| **No success rate claims** | Need n=385 for 95% CI, we have n=0 | Remove "73% success rate" displays |
| **No cross-client benchmarks** | Need n=50/industry, we have n=0 | Show industry research instead |
| **No outcome predictions** | Need n=500 for ML, 6-month lag | Skip entirely for v1 |
| **No pattern mining** | Multiple testing risk at low n | Manual observation only |
| **Industry presets = research-cited** | Can't claim "learned from data" | Label as "Industry Standard" |
| **Data collection scaffolding** | Enable future learning | Ship tracking tables now |

### Cost Optimization Conclusions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| **Pattern-first classification** | 80% of keywords classifiable without LLM | 72x cost reduction |
| **External LLM (Groq) required** | Local LLM too slow (15 tok/s = 11 hours for 100 prospects) | Accept $0.008/100 prospects |
| **Local embeddings preferred** | Avoid API rate limits, save $2/100 prospects | Need to pick embedding model |
| **Groq over Grok** | 6000 RPM vs 60 RPM rate limits | Use Groq for all LLM tasks |
| **HDBSCAN on CPU** | Fast enough (2s/prospect), no GPU needed | Ship as-is |
| **Deterministic cluster splitting** | Rules > LLM for intent conflicts | Zero cost for splitting step |

### Architecture Conclusions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| **4 clustering workers** | Optimal for 24GB RAM | Parallel prospect processing |
| **2 embedding workers** | Balance speed vs memory | ~500s for 100 prospects |
| **BullMQ for queue** | Already in stack | No new dependency |
| **Redis for cache** | Already in stack | Singleflight deduplication |
| **Python embedding server** | sentence-transformers is fastest | Small Python dependency |

---

## 2. V1 Scope: Ship vs Skip

### Features to SHIP (Day 1 Ready)

| Feature | Phase | Why It Works | Dependency |
|---------|-------|--------------|------------|
| Funnel classification (BOFU/MOFU/TOFU) | 76 | 95+ Lithuanian patterns exist | None |
| Geographic filtering | 77 | 50+ city morphological variants | None |
| Relevance scoring | 78 | Real-time embedding similarity | Embedding model |
| Constraint filtering | 79 | Business rules, no learning | None |
| Cascade selection | 80 | Configurable algorithm | None |
| Conversation extraction | 75 | Claude LLM real-time | LLM API |
| DataForSEO metrics | 84 | External API | DataForSEO key |
| CSV/Sheets import | 84 | User upload | None |
| HDBSCAN clustering | 86 | Mathematical, no training | Embedding model |
| Semantic deduplication | 86 | Similarity threshold | Embedding model |
| Score breakdowns | 87 | Deterministic calculation | None |
| Exclusion reasons | 87 | Real-time generation | None |

### Features to SKIP (Need Historical Data)

| Feature | Phase | Minimum n | Time to Threshold | Workaround |
|---------|-------|-----------|-------------------|------------|
| Success rate display | 88/90 | n=100 | 12 months | Show "Early Data" badge |
| Cross-client benchmarks | 88/90 | n=50/industry | 18 months | Use industry research |
| Outcome predictions | 90 | n=500 | 24 months | Skip entirely |
| Pattern mining | 88 | n=200 | 18 months | Manual observation |
| Time-to-rank estimates | 92 | n=300 | 18 months | Show range, not point |
| ROI projections (actual) | 92 | n=100 | 12 months | Show projection only |

### Features to MODIFY (External Data Instead)

| Feature | Original | V1 Modification | Data Source |
|---------|----------|-----------------|-------------|
| Industry presets | "Learned from data" | "Industry research" | Backlinko, HubSpot, BrightLocal |
| Smart defaults | "Our recommendation" | "Suggested starting point" | SEO studies |
| Benchmarks | "Based on 500 analyses" | "Industry standard" | External reports |
| Effort estimates | "Based on our data" | "Industry average" | Content marketing benchmarks |

---

## 3. Component Shopping List

### COMPONENT 1: Embedding Model (LOCAL)

**Purpose:** Convert keywords to 768-dim vectors for clustering

**Requirements:**
- Speed: ≥100 keywords/sec on 8 vCPU
- Memory: ≤2GB per instance (need 2 instances)
- Quality: Good Lithuanian support
- Format: ONNX preferred for CPU optimization

**Current Best Candidates:**

| Model | Dims | Size | Speed (est) | Lithuanian | Notes |
|-------|------|------|-------------|------------|-------|
| **Jina v3** | 1024 | 1.5GB | 50 kw/s | Good | Current production |
| **Jina v5 nano** | 512 | 300MB | 200 kw/s | ? | User suggested - RESEARCH |
| **Jina v5 small** | 768 | 600MB | 100 kw/s | ? | User suggested - RESEARCH |
| MiniLM-L12 multilingual | 384 | 500MB | 150 kw/s | OK | Lower quality |
| BGE-small-en | 384 | 130MB | 300 kw/s | No | English only |
| E5-base-multilingual | 768 | 400MB | 80 kw/s | Good | Alternative |
| Multilingual-E5-small | 384 | 120MB | 200 kw/s | Good | Alternative |

**Research Questions:**
1. Does Jina v5 nano/small exist and what are actual specs?
2. Lithuanian performance comparison: Jina v3 vs v5 vs E5?
3. ONNX availability for each model?
4. Can we run 2 instances in 4GB total?

**Decision Criteria:**
- Primary: Speed (need 100+ kw/s)
- Secondary: Quality on Lithuanian (test with 100 sample keywords)
- Tertiary: Memory footprint (need 2 instances in 4GB)

---

### COMPONENT 2: LLM for Classification (EXTERNAL API)

**Purpose:** Classify 20% ambiguous keywords (400 per prospect) for intent/funnel

**Requirements:**
- Speed: <3 seconds for 200 keywords
- Cost: <$0.01 per 100 prospects
- Rate limit: >500 RPM (handle 100 prospects without throttling)
- Quality: Reasonable Lithuanian understanding

**Current Best Candidates:**

| Provider | Model | Cost/1M | RPM | Latency | Lithuanian | Notes |
|----------|-------|---------|-----|---------|------------|-------|
| **Groq** | Llama 3.1 8B | $0.05 in / $0.08 out | 6000 | 200ms | Good | **RECOMMENDED** |
| Groq | Llama 3.3 70B | $0.59 / $0.79 | 1000 | 500ms | Better | 10x more expensive |
| Together | Llama 3.1 8B | $0.18 / $0.18 | 1000 | 300ms | Good | Fallback |
| DeepSeek | V2 Chat | $0.14 / $0.28 | 1000 | 500ms | Weak | Chinese-focused |
| Cerebras | Llama 3.1 8B | $0.10 / $0.10 | 900 | 150ms | Good | Fast alternative |
| Fireworks | Llama 3.1 8B | $0.20 / $0.20 | 600 | 200ms | Good | Alternative |

**Research Questions:**
1. Cerebras vs Groq: actual latency comparison?
2. Any newer models with better Lithuanian? (Mistral v3? Qwen 2.5?)
3. Groq batch API - does it exist for even cheaper?
4. Can we use OpenRouter for automatic fallback?

**Decision Criteria:**
- Primary: Rate limit (must handle 100 prospects without throttle)
- Secondary: Latency (<500ms)
- Tertiary: Lithuanian quality (test with 50 ambiguous keywords)

---

### COMPONENT 3: LLM for Labeling (EXTERNAL API)

**Purpose:** Generate human-readable cluster names (25 per prospect)

**Requirements:**
- Quality: Must produce good Lithuanian labels
- Speed: <5 seconds for 25 clusters
- Cost: <$0.005 per 100 prospects

**Current Best Candidates:**

Same as Component 2, but quality matters more:

| Provider | Model | Why for Labeling |
|----------|-------|------------------|
| **Groq Llama 3.1 8B** | Best rate limit | May need better quality |
| Groq Llama 3.3 70B | Better quality | 10x more expensive but still cheap |
| Grok 2 Mini | Good quality | 60 RPM limit is problem |
| GPT-4o-mini | Best Lithuanian | $0.15/$0.60 - still cheap enough? |

**Research Questions:**
1. Quality comparison: Groq 8B vs 70B vs GPT-4o-mini for Lithuanian labels?
2. Can we batch 100 clusters per request? (reduce API calls)
3. Grok 2 Mini rate limit - is it 60 RPM or higher with paid plan?

**Decision Criteria:**
- Primary: Label quality (test with 25 sample clusters)
- Secondary: Rate limit (need 100 requests in <2 minutes)
- Tertiary: Cost (should be <$0.01/100 prospects)

---

### COMPONENT 4: Clustering Algorithm

**Purpose:** Group similar keywords into 15-30 clusters

**Requirements:**
- No predefined cluster count (HDBSCAN)
- Fast: <3 seconds for 2000 keywords
- Handles varying density

**Current Best Candidates:**

| Library | Language | Speed | Quality | Notes |
|---------|----------|-------|---------|-------|
| **hdbscan** (Python) | Python | 2-3s | Best | Current plan |
| hdbscan-js | Node.js | 4-5s | Good | No Python needed |
| OPTICS | Python/JS | 3-4s | Good | Alternative |
| DBSCAN | Python/JS | 1-2s | OK | Requires eps tuning |

**Research Questions:**
1. Is there a pure JS HDBSCAN that's production-ready?
2. Performance difference: Python subprocess vs JS native?
3. Any faster alternatives that don't need cluster count?

**Decision Criteria:**
- Primary: No cluster count required (rules out K-means)
- Secondary: Speed (<3s for 2000 keywords)
- Tertiary: Language (prefer JS if quality equal)

---

### COMPONENT 5: Pattern Library (Lithuanian)

**Purpose:** Classify 80% of keywords without LLM

**Requirements:**
- 100+ intent patterns (what/how/why → informational, buy/price → transactional)
- 100+ funnel patterns (existing in FunnelClassifier.ts)
- Lithuanian morphological variants

**Current State:**

```typescript
// Already have in FunnelClassifier.ts:
BOFU_PATTERNS: 30+ patterns
MOFU_PATTERNS: 25+ patterns  
TOFU_PATTERNS: 20+ patterns

// Need to add in IntentPatternMatcher.ts:
INFORMATIONAL_PATTERNS: ~50 (kas yra, kaip, kodėl, ką reiškia...)
TRANSACTIONAL_PATTERNS: ~30 (pirkti, kaina, užsakyti, nuolaida...)
COMMERCIAL_PATTERNS: ~30 (geriausi, palyginti, vs, atsiliepimai...)
NAVIGATIONAL_PATTERNS: ~20 (brand + product combinations)
```

**Research Questions:**
1. What Lithuanian SEO studies exist for intent classification?
2. Can we mine DataForSEO's intent field for pattern discovery?
3. Are there open-source Lithuanian NLP pattern libraries?

**Decision Criteria:**
- Primary: Coverage (need 80%+ keywords classifiable)
- Secondary: Accuracy (validate against LLM ground truth)
- Tertiary: Maintainability (simple regex vs complex grammar)

---

### COMPONENT 6: Heuristic Signals

**Purpose:** Classify another 10-15% without LLM using metadata

**Requirements:**
- CPC inference (high CPC → likely commercial/transactional)
- DataForSEO intent field (when available)
- Modifier detection

**Available Signals:**

| Signal | Source | Coverage | Reliability |
|--------|--------|----------|-------------|
| DataForSEO intent | API | ~70% | High |
| CPC value | API | 100% | Medium |
| Search volume | API | 100% | Low |
| SERP features | API | ~50% | Medium |
| Word count | Computed | 100% | Low |

**Research Questions:**
1. What % of DataForSEO results include intent field?
2. What CPC thresholds correlate with intent? ($0.50? $2.00?)
3. Can SERP features predict intent? (featured snippet → informational?)

**Decision Criteria:**
- Primary: Coverage (how many more keywords can we classify?)
- Secondary: Accuracy (validate against LLM)
- Tertiary: API cost (already fetching this data?)

---

## 4. Research Questions Summary

### For User to Research

| # | Component | Question | How to Find Answer |
|---|-----------|----------|-------------------|
| 1 | Embedding | Does Jina v5 nano/small exist? Specs? | Check Jina AI website, HuggingFace |
| 2 | Embedding | Any faster multilingual models? | Search HuggingFace MTEB leaderboard |
| 3 | Embedding | ONNX availability? | Check model repos for .onnx files |
| 4 | LLM | Cerebras vs Groq latency? | Run benchmark with 100 keywords |
| 5 | LLM | OpenRouter for fallback? | Check OpenRouter docs |
| 6 | LLM | Any models with better Lithuanian? | Test Qwen 2.5, Mistral v3 |
| 7 | Labeling | Quality: Groq 8B vs 70B vs GPT-4o-mini? | Test with 25 clusters |
| 8 | Clustering | Production-ready JS HDBSCAN? | Search npm for hdbscan |
| 9 | Patterns | Lithuanian SEO intent studies? | Search academic + SEO blogs |
| 10 | Heuristics | DataForSEO intent field coverage? | Check API response samples |

### Quick Tests to Run

```bash
# Test 1: Jina v5 existence
curl https://huggingface.co/api/models?search=jina-embeddings-v5

# Test 2: Check MTEB multilingual leaderboard
# https://huggingface.co/spaces/mteb/leaderboard

# Test 3: Groq latency test
time curl -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Classify intent: šampūnas ploniems plaukams"}]}'

# Test 4: Check npm for HDBSCAN
npm search hdbscan
```

---

## 5. Component Stack Summary

### Recommended Stack (Current Best Guess)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KEYWORD INTELLIGENCE STACK                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER              COMPONENT               STATUS           RESEARCH       │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Embedding          Jina v3 (baseline)      ✓ Working        Look for v5    │
│                     Jina v5 nano/small      ? Unknown        PRIORITY 1     │
│                     E5-multilingual         ✓ Fallback       Test quality   │
│                                                                              │
│  Classification     Pattern library         ✓ 80% coverage   Expand LT      │
│  (80% free)         Heuristic signals       ✓ +10% coverage  Validate       │
│                                                                              │
│  Classification     Groq Llama 3.1 8B       ✓ Working        Test 70B       │
│  (20% LLM)          Cerebras (fallback)     ? Unknown        Test latency   │
│                                                                              │
│  Clustering         Python HDBSCAN          ✓ Working        Check JS       │
│                     hdbscan-js              ? Unknown        Test quality   │
│                                                                              │
│  Labeling           Groq Llama 3.1 8B       ✓ Working        Test quality   │
│                     GPT-4o-mini             ✓ Fallback       Compare LT     │
│                                                                              │
│  Queue              BullMQ                  ✓ In stack       None           │
│  Cache              Redis                   ✓ In stack       None           │
│  Workers            Node.js × 4             ✓ Planned        None           │
│  Embed Server       Python FastAPI × 2      ✓ Planned        JS alternative?│
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  TOTAL COST: $0.008 per 100 prospects ($0.00008 per prospect)               │
│  TOTAL TIME: ~9-17 minutes for 100 prospects                                │
│  TOTAL RAM:  17GB of 24GB used                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Priority Research Order

1. **Jina v5 nano/small** - Could be 2-4x faster than v3
2. **Groq 70B quality** - Small cost increase for better Lithuanian
3. **JS HDBSCAN** - Eliminate Python dependency if quality matches
4. **Cerebras** - Potentially faster than Groq
5. **Lithuanian patterns** - More patterns = less LLM cost

---

## 6. Files Created/Updated This Session

| File | Purpose | Status |
|------|---------|--------|
| `.planning/research/COLD-START-ANALYSIS.md` | What to skip in v1 | ✓ Complete |
| `.planning/research/CONSOLIDATED-PHASE-ROADMAP.md` | 7 phases, 29 waves | ✓ Complete |
| `.planning/keyword-intelligence/COST-OPTIMIZED-CLUSTERING.md` | 72x cost reduction | ✓ Complete |
| `.planning/keyword-intelligence/100-PROSPECTS-ARCHITECTURE.md` | Worker architecture | ✓ Complete |
| `.planning/keyword-intelligence/COMPONENT-SHOPPING-LIST.md` | This file | ✓ Complete |

---

## 7. Next Steps

### For You (Research)

1. Check if Jina v5 exists (HuggingFace, Jina AI website)
2. Find any faster multilingual embedding models
3. Test Groq 8B vs 70B on Lithuanian cluster labels
4. Search for production-ready JS HDBSCAN

### For Implementation (After Research)

1. Create embedding server (`services/embedding/server.py`)
2. Create clustering worker (`workers/clustering/worker.ts`)
3. Extend pattern library (`IntentPatternMatcher.ts`)
4. Implement BullMQ queue for batch processing
5. Wire up Redis caching with singleflight

### For Verification

1. Benchmark: 100 keywords through full pipeline
2. Quality check: LLM vs pattern classification accuracy
3. Load test: 100 prospects, measure actual time
4. Memory profiling: confirm 17GB fits

---

*Document created: 2026-05-05*
*Purpose: Provide precise research targets before implementation*
