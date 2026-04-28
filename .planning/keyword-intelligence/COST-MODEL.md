# Keyword Intelligence Cost Model

> **Location:** `.planning/keyword-intelligence/COST-MODEL.md`  
> **Created:** 2026-04-26  
> **Status:** Approved  
> **Related:** [IMPLEMENTATION-FIXES.md](IMPLEMENTATION-FIXES.md), [ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md)

This document provides accurate cost breakdowns for the Keyword Intelligence System, addressing the confusion between one-time and ongoing costs identified in [GAPS-AND-CONTRADICTIONS.md](GAPS-AND-CONTRADICTIONS.md) (Issues #8, #9).

---

## Cost Types Overview

| Cost Type | When Incurred | Scales With |
|-----------|---------------|-------------|
| **One-Time (Onboarding)** | Client signup | Number of clients |
| **Ongoing (Per Run)** | Each analysis | Analysis frequency |
| **Infrastructure** | Monthly | Total system capacity |

---

## One-Time Costs (Per Client Onboarding)

These costs are incurred once when a new client is onboarded.

| Operation | Cost | Notes |
|-----------|------|-------|
| Site crawl (500 products) | $0.024 | Crawlee + aiohttp, 500 products typical |
| Site crawl (2000 products) | $0.096 | Larger catalogs scale linearly |
| LightRAG indexing (500 products) | $4.60 | Entity extraction + embeddings |
| LightRAG indexing (2000 products) | $18.40 | Scales with page count |
| Cache warming (first in vertical) | $0.50 | Only if first client in vertical |
| Cache warming (existing vertical) | $0.00 | Shared cache already warm |

### Total Onboarding Cost

| Scenario | Total Cost |
|----------|------------|
| Small client (500 products), existing vertical | ~$5 |
| Small client (500 products), new vertical | ~$5.50 |
| Medium client (2000 products), existing vertical | ~$19 |
| Medium client (2000 products), new vertical | ~$19.50 |

### Cost Breakdown: LightRAG Indexing

LightRAG indexing is **one-time per site** (with incremental updates thereafter):

| Component | Cost Formula | 500 Products |
|-----------|--------------|--------------|
| Entity extraction (GPT-4o-mini) | ~$0.008/page | $4.00 |
| Embedding (jina-v3 API) | $0.02/1M tokens | $0.40 |
| Graph construction | $0 (local) | $0.00 |
| Vector indexing | $0 (local) | $0.00 |
| **Total** | | **$4.40** |

---

## Ongoing Costs (Per Analysis Run)

These costs are incurred each time a keyword analysis runs for a client.

| Operation | Cost | Frequency | Notes |
|-----------|------|-----------|-------|
| Keyword classification (cached, 95% hit) | $0.00008/kw | Per run | After cache maturity |
| Keyword classification (uncached, 0% hit) | $0.001/kw | Per run | First run in vertical |
| 500 keywords analysis (mature cache) | $0.04 | Per run | 95% cache hit assumed |
| 500 keywords analysis (cold start) | $0.50 | Per run | 0% cache hit |
| Delta crawl (20% changed) | $0.005 | Weekly | Uses `seo_content_hash` |
| DataForSEO competitor data | $0.05 | Per run | API, not crawl |
| DataForSEO SERP data | $0.006 | Per run | Per 10 keywords |

### Monthly Cost Per Client (4 Weekly Runs)

| Scenario | Monthly Cost |
|----------|--------------|
| Mature cache (95% hit), 500 keywords | ~$0.40 |
| Growing cache (70% hit), 500 keywords | ~$0.80 |
| Cold start (0% hit), 500 keywords | ~$2.20 |

---

## Cache Flywheel Cost Curve

The classification cache is shared across all tenants. As more clients join, cache hit rates improve dramatically.

| Client # | Cache Hit Rate | Cost per 500 Keywords | Notes |
|----------|----------------|----------------------|-------|
| 1 | 0% | $0.50 | All LLM calls |
| 10 | 30% | $0.35 | Some keyword overlap |
| 50 | 60% | $0.20 | Significant vertical overlap |
| 100 | 70% | $0.15 | Good cache coverage |
| 500 | 90% | $0.05 | Mature cache |
| 1000 | 95% | $0.025 | Cache flywheel fully engaged |

### Cache Key Structure

The cache deduplicates across tenants **only when category sets match**:

```python
# Cache key = keyword + hash of available categories
cache_key = hash(f"{keyword_normalized}:{category_set_hash}")

# Two clients with SAME categories share cache
# Two clients with DIFFERENT categories do NOT share
```

This means:
- Clients in the same vertical (hair care, beauty) share heavily
- Clients in different verticals (hair care vs. electronics) share minimally
- The 95% hit rate assumes 1000 clients in related verticals

---

## Cost Breakdown Clarity

### Commonly Confused Operations

| Operation | What It Does | When It Runs | Cost Basis |
|-----------|--------------|--------------|------------|
| **LightRAG indexing** | Extract entities from pages, build knowledge graph | Onboarding + incremental updates | One-time per site |
| **Keyword classification** | Match keyword to client's categories via LLM | Every analysis run | Per-keyword, cached |
| **Delta crawling** | Check for content changes using `seo_content_hash` | Weekly monitoring | Per-page, mostly skipped |
| **DataForSEO API calls** | Fetch competitor/SERP data | Every analysis run | Per-query |

### LightRAG Indexing vs Keyword Classification

| Aspect | LightRAG Indexing | Keyword Classification |
|--------|-------------------|------------------------|
| **Purpose** | Build entity graph from site content | Match keywords to categories |
| **Frequency** | Once + incremental | Every run |
| **LLM calls** | Entity extraction | Category matching |
| **Cost model** | Per-page (one-time) | Per-keyword (cached) |
| **Cache** | No cross-tenant sharing | Full cross-tenant sharing |

---

## Infrastructure Costs

Fixed monthly infrastructure regardless of client count (up to 1000 clients):

| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| Hetzner CPX32 (crawler) | $14 | 4 vCPU, 8 GB RAM |
| Hetzner CX52 (main) | $35 | 16 vCPU, 32 GB RAM |
| Redis (FalkorDB) | $0 | Included in CX52 |
| PostgreSQL + pgvector | $0 | Included in CX52 |
| **Total infrastructure** | **$49/mo** | |

### Per-Tenant Infrastructure Cost

| Clients | Infrastructure Cost/Client |
|---------|---------------------------|
| 100 | $0.49/mo |
| 500 | $0.098/mo |
| 1000 | $0.049/mo |

---

## Cold Start Cost Mitigation

### Problem
The first client in a vertical pays full classification costs (no cache hits).

### Solutions

1. **Pre-warm cache with common keywords**
   ```python
   COMMON_LITHUANIAN_KEYWORDS = [
       "šampūnas", "kondicionierius", "plaukų kaukė", ...
   ]  # 500+ common terms per vertical
   
   await warm_cache_for_vertical("hair_care", categories)
   # Cost: ~$0.50 per vertical
   ```

2. **Seed from DataForSEO before first client**
   ```python
   top_keywords = await dataforseo.get_top_keywords(
       category="beauty_and_personal_care",
       location="Lithuania",
       limit=1000
   )
   # Cost: $0.11 (API) + $1.00 (classification)
   ```

3. **Tiered pricing model**
   - First client in vertical: $50 setup fee (covers cache seeding)
   - Subsequent clients: No setup fee (benefit from cache)

---

## Total Cost of Ownership (Example)

### Scenario: 100 Clients, Hair Care Vertical

| Cost Category | Monthly | Annual |
|---------------|---------|--------|
| Infrastructure | $49 | $588 |
| LLM (classification, 70% hit) | $80 | $960 |
| DataForSEO API | $200 | $2,400 |
| Delta crawling | $20 | $240 |
| **Total** | **$349** | **$4,188** |
| **Per client** | **$3.49** | **$41.88** |

### Scenario: 1000 Clients, Mixed Verticals

| Cost Category | Monthly | Annual |
|---------------|---------|--------|
| Infrastructure | $49 | $588 |
| LLM (classification, 95% hit) | $250 | $3,000 |
| DataForSEO API | $500 | $6,000 |
| Delta crawling | $50 | $600 |
| **Total** | **$849** | **$10,188** |
| **Per client** | **$0.85** | **$10.19** |

---

## Cost Optimization Levers

| Lever | Impact | Implementation |
|-------|--------|----------------|
| API routing (ADR-003) | -90% on competitor tasks | Route to DataForSEO instead of crawl |
| Cache flywheel | -95% on classification | Singleflight pattern + Redis cache |
| Delta crawling | -65-80% on crawl | `seo_content_hash` excludes price |
| Embedding batching | -50% on embedding costs | Batch 32 texts per call |
| DiskANN quantization | -32x on vector storage | SBQ in pgvectorscale |

---

## References

- [IMPLEMENTATION-FIXES.md](IMPLEMENTATION-FIXES.md) - Fix 8 (Cold Start), Fix 9 (Cost Clarification)
- [ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md) - ADR-003 (Task Routing)
- [cpu-only-rag-graph.md](../../docs/infra-research/cpu-only-rag-graph.md) - Infrastructure benchmarks
- [MULTI-TENANT-COST-OPTIMIZATION.md](MULTI-TENANT-COST-OPTIMIZATION.md) - Cache architecture
