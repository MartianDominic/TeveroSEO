# Phase 95: Unified Scraping Infrastructure

**Status:** Planning  
**Depends On:** None (infrastructure layer)  
**Enables:** All features that fetch external HTML  
**Estimated Effort:** 5-6 weeks  
**Cost Impact:** 96-98% reduction in scraping costs

---

## Why a Separate Phase?

Phase 92 (On-Page SEO Mastery) is **complete** and focused on **HTML analysis**:
- 41-point SEO-AGI scorecard
- Quality gates, vertical classification
- Semantic chunking for LLM retrieval
- 241 tests passing

The scraping infrastructure was **researched** in Phase 92 docs but **never implemented**:
- `FETCH_TIERS` types exist, but no `TieredFetcher` class
- No Webshare/Geonode proxy integration
- No per-domain learning system
- No HTML caching
- All features use DataForSEO at $0.02/page when $0.00022/page is achievable

---

## Scope

### In Scope
1. **Unified ScrapingService** — Single entry point for all HTML fetching
2. **Tiered Fetcher** — Cost-optimized escalation (Direct → Webshare → Geonode → DFS)
3. **Per-Domain Learning** — Remember what tier works for each domain
4. **Multi-Level Caching** — L1 (memory) → L2 (Redis) → L3 (PostgreSQL) → L4 (R2)
5. **Queue Integration** — BullMQ with per-domain rate limiting
6. **DataForSEO Optimization** — Standard Queue, pre-parsed data, batch requests

### Out of Scope
- SEO analysis logic (Phase 92)
- Keyword clustering (Phase 86)
- Content generation (AI-Writer)

---

## Features That Will Consume This Tier

| Feature | Current Method | Pages/Op | Integration Point |
|---------|---------------|----------|-------------------|
| Site Audits | Direct fetch | 10-10,000 | `siteAuditWorkflowCrawl.ts` |
| Hybrid Crawler | Direct + Playwright | 10,000 | `hybrid-crawler.ts` |
| Prospect Analysis | DataForSEO | 4 | `multiPageScraper.ts` |
| SERP Content | DataForSEO | 5 | `SerpContentAnalyzer.ts` |
| Competitor Spy | DataForSEO | Variable | `CompetitorSpyService.ts` |
| Content Briefs | DataForSEO | 5 | `SerpAnalyzer.ts` |

**All 6 features will be migrated to use the unified ScrapingService.**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          UNIFIED SCRAPING SERVICE                                │
│                                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐             │
│  │  Site Audits    │    │ Prospect Scrape │    │  SERP Content   │             │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘             │
│           │                      │                      │                       │
│           └──────────────────────┼──────────────────────┘                       │
│                                  ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                         ScrapingService                                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │ │
│  │  │ fetchPage() │  │ crawlSite() │  │ batchFetch()│  │ warmCache() │      │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                  │                                              │
│                                  ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                         CacheManager (L1-L4)                               │ │
│  │  L1: Memory LRU │ L2: Redis │ L3: PostgreSQL │ L4: Cloudflare R2          │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                  │ MISS                                         │
│                                  ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                         DomainLearningService                              │ │
│  │  domain_scrape_config table │ Optimal tier lookup │ Revalidation           │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                  │                                              │
│                                  ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                         TieredFetcher                                      │ │
│  │                                                                           │ │
│  │   T0: Direct    T1: Webshare   T2: Geonode   T3: DFS    T4: DFS   T5: DFS │ │
│  │   (FREE)        DC (FREE)      ($0.77/GB)    Basic      JS       Browser  │ │
│  │                                              $0.000125  $0.00125 $0.00425  │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                  │                                              │
│                                  ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                         RateLimiter                                        │ │
│  │  Per-domain: 2 req/sec │ Global: 200 concurrent │ Adaptive backoff        │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Scraping → Keyword Pipeline

```
Prospect Domain
    │
    ▼ [ScrapingService.fetchPage()]
Raw HTML + Metadata
    │
    ├─────────────────────────────────────────────┐
    │                                             │
    ▼                                             ▼
[PageAnalyzer]                            [ChunkExtractor]
SEO metadata                              500-token chunks
    │                                             │
    ▼                                             ▼
[SEO Checks T1-T4]                        [EmbeddingService]
109 checks                                jina-v3 384-dim
    │                                             │
    ▼                                             ▼
Audit Results                             [HDBSCANClusterer]
    │                                             │
    ▼                                             ▼
Dashboard                                 Keyword Clusters
                                                  │
                                                  ▼
                                          Topical Authority
```

---

## Cost Model

### Current State (All DataForSEO)

| Volume | Cost | Per Page |
|--------|------|----------|
| 10K pages/mo | $200 | $0.02 |
| 100K pages/mo | $2,000 | $0.02 |
| 1M pages/mo | $20,000 | $0.02 |

### Optimized State (Tiered)

| Tier | % of Pages | Cost/Page | Weighted |
|------|------------|-----------|----------|
| T0: Direct | 45% | $0.00 | $0.00 |
| T1: Webshare | 20% | $0.00 | $0.00 |
| T2: Geonode | 15% | $0.000015 | $0.0000023 |
| T3: DFS Basic | 10% | $0.000125 | $0.0000125 |
| T4: DFS JS | 8% | $0.00125 | $0.0001 |
| T5: DFS Browser | 2% | $0.00425 | $0.000085 |
| **Total** | 100% | | **$0.0002** |

### Monthly Savings

| Volume | Current | Optimized | Savings |
|--------|---------|-----------|---------|
| 10K pages | $200 | $2 + $51 infra | **75%** |
| 100K pages | $2,000 | $20 + $51 infra | **96%** |
| 1M pages | $20,000 | $200 + $51 infra | **99%** |

**Infrastructure:** Contabo VPS $13 + Geonode 50GB $38.50 = $51.50/mo

---

## Sub-Plans

| Plan | Focus | Effort |
|------|-------|--------|
| **95-01** | TieredFetcher + Domain Learning | 1.5 weeks |
| **95-02** | Multi-Level Caching (L1-L4) | 1 week |
| **95-03** | Queue & Rate Limiting | 1 week |
| **95-04** | DataForSEO Optimization | 0.5 week |
| **95-05** | Migration & Monitoring | 1 week |

---

## Success Criteria

1. **Cost:** Average cost/page drops from $0.02 to <$0.001
2. **Coverage:** 100% of pages fetchable (no change)
3. **Speed:** p95 fetch time <2s for cached, <5s for uncached
4. **Learning:** 95%+ domain tier accuracy after first discovery
5. **Integration:** All 6 features migrated to ScrapingService

---

## Dependencies

**Requires:**
- Geonode API credentials (user to provide)
- Webshare API credentials (free tier)
- DataForSEO API key (existing)

**Enables:**
- High-volume prospect discovery (100+ sites/hr)
- Cost-effective competitor analysis
- Re-audit without re-fetch (cached HTML)

---

## Files to Create

```
open-seo-main/src/server/features/scraping/
├── ScrapingService.ts          # Unified entry point
├── TieredFetcher.ts            # T0-T5 escalation
├── DomainLearningService.ts    # Per-domain config
├── CacheManager.ts             # L1-L4 caching
├── RateLimiter.ts              # Per-domain throttling
├── ProxyProviders/
│   ├── DirectFetcher.ts        # T0
│   ├── WebshareFetcher.ts      # T1
│   ├── GeonodeFetcher.ts       # T2
│   └── DataForSEOFetcher.ts    # T3-T5
├── types.ts
├── index.ts
└── __tests__/
    ├── ScrapingService.test.ts
    ├── TieredFetcher.test.ts
    └── DomainLearning.test.ts

open-seo-main/src/db/
└── domain-scrape-schema.ts     # domain_scrape_configs table
```

---

## Document History

- **v1.0** (2026-05-07): Initial context from 5 Opus subagent analysis
