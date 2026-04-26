# Keyword Intelligence System: Gaps & Contradictions

> **Analysis Date:** 2026-04-26  
> **Source Documents:** `docs/infra-research/cpu-only-rag-graph.md`, `docs/infra-research/crawling-10-5000-tasks-day.md`  
> **Status:** Issues identified, requires resolution before implementation

## Critical Issues (Must Fix)

### 1. Content Hash Includes Price — Breaks Delta Detection
**Location:** `CRAWL-TO-GRAPH-PIPELINE.md` line ~180

The crawling doc explicitly warns:
> "Trafilatura and readability-lxml are not safe for e-commerce delta detection — they extract the price block as part of 'main content' and your SHA256 changes constantly"

But the pipeline hashes price into content:
```python
content = f"{name}|{price}|{sku}|{brand_canonical}|{description}"
content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
```

**Impact:** Every price change triggers false "modified" — defeats 65-80% cache savings.

**Fix:** Create two hashes:
- `seo_content_hash` — name, description, categories (SEO-relevant, stable)
- `inventory_hash` — price, stock, sku (volatile, separate tracking)

---

### 2. Embedding Dimension Mismatch
Multiple docs specify different dimensions:

| Document | Dimension | Model |
|----------|-----------|-------|
| CRAWL-TO-GRAPH schema | 384 | unspecified |
| HIERARCHICAL-EMBEDDING | 768 (truncated to 384) | multilingual-e5-base |
| LIGHTRAG-INTEGRATION | 1536 | OpenAI text-embedding-3-small |
| RAG infra doc | 768 or 1024 | e5-base or jina-v3 |

**Impact:** Schema incompatibility, wasted storage, index rebuild needed.

**Fix:** Single source of truth:
- **Production:** `multilingual-e5-base` → 768-dim → PCA to 384 for storage
- **LightRAG:** Must use same model, not OpenAI API

---

### 3. Lithuanian Morphology — Wrong Library
**Claims:** Stanza for Lithuanian
**Code uses:** spaCy `lt_core_news_sm`

**Reality check:** spaCy's Lithuanian model is community-contributed and limited. The infra doc recommends:
> "Lithuanian's seven-case morphology amplifies lexical noise"

**Fix:** Use Stanza with `stanza.download('lt')` — it has better lemmatization for Baltic languages. Fallback to rule-based `LEMMA_MAP` only when Stanza unavailable.

---

### 4. Missing Cookie Consent / Bot Challenge Detection
**Warning from crawling doc:**
> "GDPR cookie-consent walls and Cloudflare bot-challenge pages return HTTP 200 with structured-looking HTML, but the body is a consent shell"

**Current code:** No validation. Would extract "Cookie Policy" as product name.

**Fix:** Add pre-extraction validation:
```python
CONSENT_SIGNATURES = ['cookiebot', 'onetrust', 'iubenda', 'cf-challenge', 'cf-turnstile']
def is_consent_shell(html: str) -> bool:
    return any(sig in html.lower() for sig in CONSENT_SIGNATURES)
```

---

## Architectural Contradictions

### 5. FalkorDB vs Apache AGE — No Decision
- `cpu-only-rag-graph.md` recommends FalkorDB (Redis module) as primary
- `LIGHTRAG-INTEGRATION.md` uses PGGraphStorage (PostgreSQL + AGE)
- `CRAWL-TO-GRAPH-PIPELINE.md` shows FalkorDB Cypher schema

**Impact:** Can't implement both. Need to pick one.

**Recommendation:** 
- **FalkorDB** for the product/category knowledge graph (per-tenant, real-time)
- **PostgreSQL + AGE** for LightRAG's entity graph (shared, analytical)

This is actually fine — two graphs serving different purposes.

---

### 6. Task Decomposition Not Reflected
Key insight from crawling doc:
> "60–70% of workload should never touch your crawler at all"

The keyword intelligence system assumes we crawl everything. Missing:
- DataForSEO integration for competitor keywords (Type C tasks)
- API-first workflow for keyword gap analysis
- Crawl only for client site audits (Type A, 5-10% of volume)

**Fix:** Add `KeywordSourceRouter` that directs:
- Client site keywords → Crawl + extract
- Competitor keywords → DataForSEO Labs API
- SERP data → DataForSEO SERP API (cached 24-72h)

---

### 7. Singleflight Pattern — Implementation Missing
The crawling doc provides working Redis singleflight code, but the keyword intelligence system only mentions it conceptually.

**Required:** Actual implementation in `MULTI-TENANT-COST-OPTIMIZATION.md` showing:
- How keyword classification requests dedupe
- Cache key structure for cross-tenant sharing
- Pub/sub completion notification

---

## Cost Calculation Gaps

### 8. Cold Start Cost Unknown
- **MULTI-TENANT claims:** $0.0008/classification at 1000 clients (cache flywheel)
- **Missing:** What's the cost for client #1 with empty cache?

**Estimate needed:**
- First client, 500 keywords, no cache: ~$0.50-$1.00 (all LLM calls)
- Client #100, 70% cache hit: ~$0.15-$0.30
- Client #1000, 95% cache hit: ~$0.04

---

### 9. LightRAG Indexing vs Classification Confusion
- **LightRAG indexing:** $9.20 for 10k pages (one-time per site)
- **Keyword classification:** $0.00008 per keyword (cached)

These are different operations but docs sometimes conflate them. Clarify in README.

---

## Missing Operational Concerns

### 10. No Graceful Degradation
What happens when:
- FalkorDB OOMs (8-15GB for 1000 tenants is tight)
- Redis singleflight leader crashes mid-crawl
- LLM API rate limits during entity extraction
- Embedding service unavailable

**Required:**
- Circuit breakers with fallback modes
- Retry strategies with exponential backoff
- Queue-based degradation (slow down, don't fail)

---

### 11. LightRAG Context Limit Trap
RAG doc warns:
> "LightRAG silently fails when the LLM context is below 32k"

**Fix:** Explicitly document:
- Claude Sonnet 4.6: 200k context ✓
- GPT-4o-mini: 128k context ✓
- Local models (Ollama): Must set `num_ctx: 32768` in Modelfile

---

## Resolution Priority

| Issue | Severity | Effort | Order |
|-------|----------|--------|-------|
| 1. Content hash includes price | Critical | Low | 1st |
| 4. Cookie consent detection | Critical | Low | 2nd |
| 2. Embedding dimension mismatch | High | Medium | 3rd |
| 3. Lithuanian morphology library | High | Medium | 4th |
| 5. FalkorDB vs AGE decision | Medium | Low | 5th |
| 6. Task decomposition routing | High | High | 6th |
| 10. Graceful degradation | Medium | High | 7th |

---

## Next Steps

1. **Create `DECISIONS.md`** — Document architectural choices (FalkorDB for KG, AGE for LightRAG)
2. **Fix content hash** — Split into seo_hash and inventory_hash
3. **Add consent detection** — Pre-extraction validation
4. **Unify embedding model** — Single dimension across all docs
5. **Add operational runbook** — Circuit breakers, fallbacks, monitoring
