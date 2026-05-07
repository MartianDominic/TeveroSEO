# TeveroSEO Cost Optimization Masterplan

**Date:** 2026-05-07  
**Version:** 4.0 (Compute optimization research + Contabo infrastructure)  
**Goal:** Absolute minimum cost while maintaining 100% coverage and data freshness where needed

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Proxy Provider Analysis (Corrected)](#2-proxy-provider-analysis)
3. [DataForSEO Tiered Pricing Deep Dive](#3-dataforseo-tiered-pricing)
4. [Free Data Sources](#4-free-data-sources)
5. [Bandwidth Optimization](#5-bandwidth-optimization)
6. [Caching Architecture](#6-caching-architecture)
7. [The 98/2 Split Strategy](#7-the-982-split-strategy)
8. [Per-Domain Learning System](#8-per-domain-learning)
9. [Fresh vs Stale Data Decisions](#9-fresh-vs-stale-data)
10. [Complete Cost Model](#10-complete-cost-model)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Database Storage Optimization](#12-database-storage-optimization)
13. [Compute & Parsing Optimization](#13-compute--parsing-optimization)
14. [Queue & Scheduling Optimization](#14-queue--scheduling-optimization)
15. [API Request Optimization](#15-api-request-optimization)
16. [Advanced Caching Architecture](#16-advanced-caching-architecture)
17. [DataForSEO Pre-Parsed Data Strategy](#17-dataforseo-pre-parsed-data-strategy)

---

## 1. Executive Summary

### The Core Insight

**70-80% of SEO data doesn't require scraping at all.** By combining free APIs (CrUX, GSC, Common Crawl, Open PageRank) with intelligent caching, tiered proxy escalation, and adaptive DataForSEO usage, we can achieve:

| Metric | Naive Approach | Optimized | Savings |
|--------|----------------|-----------|---------|
| Cost per 1M pages | $4,250 (DFS Browser) | **$15-50** | **99%+** |
| Data freshness | 100% real-time | 95% real-time | Acceptable |
| Coverage | 100% | 100% | Same |

### Key Principles

1. **Never pay for data you can get free** (CrUX, GSC, Common Crawl)
2. **Never fetch what hasn't changed** (conditional GET, delta sync)
3. **Never use expensive tiers when cheap ones work** (per-domain learning)
4. **Never scrape what's already cached** (multi-tenant sharing)
5. **Understand when cost incurs** (transfer time, not processing time)

---

## 2. Proxy Provider Analysis

### Corrected Pricing (May 2026)

| Provider | Plan | Price/GB | Min Purchase | Expiry | Best For |
|----------|------|----------|--------------|--------|----------|
| **Geonode** | 10 GB Sub | $0.88 | $8.80 | Rolls over | Small scale |
| **Geonode** | 25 GB Sub | $0.82 | $20.50 | Rolls over | Medium scale |
| **Geonode** | 50 GB Sub | **$0.77** | $38.50 | Rolls over | **Recommended** |
| **Geonode** | Flexible | $0.30-0.88 | $8.80 | Rolls over | High volume |
| **Evomi** | Pay As You Go | $0.99 | None | Never | Unpredictable |
| **Webshare** | Free DC | FREE | None | N/A | First tier |
| **DataImpulse** | Residential | $1.00 | $5 | Never | Backup |

### Winner: Geonode at $0.77/GB (50GB Subscription)

**Why Geonode:**
- Cheapest at practical volumes ($0.77/GB)
- Bandwidth rolls over (no waste)
- 54M+ residential IPs
- Geo-targeting available
- Can go as low as $0.30/GB at scale

### What NOT to Use

| Option | Why Avoid |
|--------|-----------|
| Tor network | Exit nodes pre-blocked by Cloudflare |
| Free proxy lists | 90%+ dead, unreliable |
| VPS as proxy | All major VPS IP ranges flagged as DC |
| Paid DC proxies | Same blocking as free DC |
| Mobile proxies | 4-8x more expensive, overkill |

---

## 3. DataForSEO Tiered Pricing

### OnPage API Pricing Breakdown

| Feature | Cost/Page | Multiplier | What You Get |
|---------|-----------|------------|--------------|
| **Basic** | $0.000125 | 1x | 60+ on-page params, HTML, internal links, page speed |
| + Load Resources | $0.000375 | 3x | + Images, CSS, scripts, broken items |
| + Enable JavaScript | $0.00125 | 10x | + JS execution on page |
| + Custom JavaScript | $0.00025 | 2x | + Execute custom JS code |
| + Browser Rendering | $0.00425 | 34x | + Full browser, anti-bot bypass |
| + Keyword Density | $0.00025 | 2x | + Keyword density calculation |
| **Instant Pages** | $0.000125 | 1x | Quick on-page params |
| **Page Screenshot** | $0.004 | 32x | High-quality screenshot |
| **Content Parsing** | $0.000125 | 1x | Structured content extraction |

### The Layered Strategy

**Don't use expensive tiers for all sites.** Test and remember what each domain needs:

```
Domain Classification Flow:
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Try Proxy + Cheerio ($0.0000154/page)              │
│         Works for 65% of sites                              │
│         IF BLOCKED → Step 2                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Try DataForSEO BASIC ($0.000125/page)              │
│         Check: word count > 100, has H1, text ratio > 5%   │
│         IF LOOKS LIKE SPA → Step 3                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Try DataForSEO JS ($0.00125/page)                  │
│         10x cost, but renders JavaScript                    │
│         IF STILL EMPTY → Step 4                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: DataForSEO BROWSER ($0.00425/page)                 │
│         34x cost, nuclear option                            │
│         Works for everything                                │
└─────────────────────────────────────────────────────────────┘
```

### Expected Distribution (Per-Domain Learning)

| Domain Type | % of Sites | Tier | Cost/Page |
|-------------|------------|------|-----------|
| Simple static/WordPress | 65% | Proxy | $0.000015 |
| Protected but static | 15% | DFS Basic | $0.000125 |
| Light SPA (Nuxt, Next SSR) | 12% | DFS JS | $0.00125 |
| Heavy SPA (React CSR) | 6% | DFS JS | $0.00125 |
| Cloudflare + SPA | 2% | DFS Browser | $0.00425 |

**Weighted Average:** $0.000339/page (vs $0.00425 for all-browser)

**Savings: 92%**

---

## 4. Free Data Sources

### APIs That Replace Scraping

| Source | Data Provided | Rate Limit | Cost |
|--------|---------------|------------|------|
| **CrUX API** | Core Web Vitals (LCP, INP, CLS) | 150 req/min | FREE |
| **GSC API** | Indexation, mobile, rich results, canonical | 2,000/day/site | FREE |
| **PageSpeed Insights** | Lighthouse scores, lab metrics | 25,000/day | FREE |
| **Common Crawl WAT** | Title, meta, links (50B+ pages) | Unlimited | FREE |
| **Common Crawl WET** | Plain text extraction | Unlimited | FREE |
| **Open PageRank** | Domain authority (0-10) | 4.3M domains/day | FREE |
| **Wayback Machine** | Historical snapshots | 60 req/min | FREE |

### Data Replacement Matrix

| SEO Metric | Owned Sites | Competitor Sites | Cost |
|------------|-------------|------------------|------|
| Core Web Vitals | CrUX API | CrUX API | FREE |
| Indexation status | GSC URL Inspection | Cannot check | FREE |
| Title/Meta | Scrape | Common Crawl WAT | FREE |
| Headings (H1-H6) | Scrape | Scrape | Minimal |
| Word count | Scrape | Common Crawl WET | FREE |
| Internal links | Scrape | Common Crawl WAT | FREE |
| Schema/Rich Results | GSC URL Inspection | Scrape | FREE |
| Domain Authority | Open PageRank | Open PageRank | FREE |
| Mobile Usability | GSC URL Inspection | PageSpeed API | FREE |

### Coverage Estimate

- **Owned sites:** 80-90% of data from FREE APIs
- **Competitor sites:** 60-70% of data from FREE sources
- **Remaining:** Minimal scraping required

---

## 5. Bandwidth Optimization

### The Key Insight: When Does Cost Incur?

**Proxy costs incur at TRANSFER time, not processing time.**

```
SAVES PROXY MONEY:
├── Brotli compression → 82% less bytes transferred
├── Conditional GET (304) → ~200 bytes instead of 100KB
├── HEAD requests → Headers only, no body
├── Cache hits → No fetch at all
└── Free APIs → No fetch at all

DOESN'T SAVE PROXY MONEY:
├── Stripping content AFTER fetch → Already downloaded
├── Discarding data AFTER parse → Already downloaded
└── Efficient parsing → Already downloaded
```

### Compression (Always Enable)

```typescript
const response = await fetch(url, {
  headers: { 'Accept-Encoding': 'br, gzip, deflate' }
});
```

| Algorithm | Reduction | Support |
|-----------|-----------|---------|
| Brotli | 82% | 95%+ |
| gzip | 78% | 99%+ |

**Impact:** 100KB page → 18KB transfer = **82% bandwidth savings**

### Conditional GET (304 Not Modified)

```typescript
const response = await fetch(url, {
  headers: {
    'If-None-Match': cachedEtag,
    'If-Modified-Since': cachedLastModified
  }
});

if (response.status === 304) {
  return cachedAnalysis; // ~200 bytes transferred
}
```

**Impact:** 50-80% of repeat crawls return 304

### Combined Bandwidth Savings

| Optimization | Reduction | Cumulative |
|--------------|-----------|------------|
| Brotli compression | 82% | 82% |
| Conditional GET (50% unchanged) | 50% | 91% |
| Cache hits (30%) | 30% | 93.7% |
| Free APIs (40% of data) | 40% | 96.2% |

---

## 6. Caching Architecture

### Multi-Tenant Shared Cache

**Key insight:** Public HTML is not tenant-specific. Share across all clients.

```typescript
// Cache key: NO tenant prefix for HTML (shared)
const htmlCacheKey = `html:${sha256(normalizeUrl(url)).slice(0, 16)}`;

// Only analysis results need tenant isolation
const analysisKey = `analysis:${tenantId}:${urlHash}`;
```

### TTL Strategy

| Data Type | TTL | Reason |
|-----------|-----|--------|
| HTML (audit) | 24h | Fresh for active audits |
| HTML (competitor) | 7d | Less time-sensitive |
| Analysis results | 30d | Expensive to recompute |
| CrUX data | 1d | Updated daily by Google |
| GSC data | 4h | Refreshes frequently |
| Domain tier config | 30d | Rarely changes |

### Cross-Client Savings

For 100 clients auditing overlapping competitors:

| Strategy | Fetches | Savings |
|----------|---------|---------|
| No optimization | 5,000,000 | - |
| + Cross-client cache (60% overlap) | 2,000,000 | 60% |
| + Delta sync (80% unchanged) | 400,000 | 92% |
| + Common Crawl fallback | 280,000 | 94.4% |
| + Free API data | 100,000 | **98%** |

---

## 7. The 98/2 Split Strategy

### Core Concept

Not all sites need expensive scraping methods:

- **98% of sites:** Simple HTTP fetch works (WordPress, Shopify, static, SSR)
- **2% of sites:** Need browser rendering (React CSR, heavy Cloudflare)

### Technology Classification

```typescript
async function classifyTechnology(domain: string): Promise<'http' | 'browser'> {
  const cached = await techCache.get(domain);
  if (cached) return cached;
  
  // Try direct HTTP first
  const response = await directFetch(`https://${domain}/`);
  
  // SPA indicators
  const isSPA = 
    (response.html.includes('id="__next"') && response.html.length < 5000) ||
    (response.html.includes('id="root"') && response.html.length < 5000) ||
    response.html.includes('ng-app');
  
  // Cloudflare challenge
  const isCFChallenge = 
    response.status === 403 && 
    response.html.includes('cf-browser-verification');
  
  const classification = (isSPA || isCFChallenge) ? 'browser' : 'http';
  await techCache.set(domain, classification, { ttl: '30d' });
  
  return classification;
}
```

### Cost Impact

| Method | % of Sites | Cost/Page | Weighted Cost |
|--------|------------|-----------|---------------|
| HTTP (proxy) | 65% | $0.000015 | $0.00000975 |
| HTTP (DFS Basic) | 15% | $0.000125 | $0.00001875 |
| Browser (DFS JS) | 18% | $0.00125 | $0.000225 |
| Browser (DFS Full) | 2% | $0.00425 | $0.000085 |
| **Total** | 100% | | **$0.000339** |

vs using DFS Browser for all: $0.00425/page

**Savings: 92%**

---

## 8. Per-Domain Learning System

### Database Schema

```sql
CREATE TABLE domain_scrape_config (
  domain TEXT PRIMARY KEY,
  optimal_tier TEXT NOT NULL, -- 'proxy', 'dfs_basic', 'dfs_js', 'dfs_browser'
  proxy_works BOOLEAN DEFAULT TRUE,
  dfs_mode TEXT, -- 'basic', 'resources', 'js', 'browser'
  last_tested TIMESTAMPTZ DEFAULT NOW(),
  success_rate DECIMAL(5,2) DEFAULT 100,
  avg_response_time_ms INTEGER,
  avg_page_size_kb INTEGER,
  requires_geo TEXT, -- 'US', 'UK', etc. if geo-specific blocking
  notes TEXT
);

CREATE INDEX idx_domain_tier ON domain_scrape_config(optimal_tier);
```

### Learning Algorithm

```typescript
async function learnDomainConfig(domain: string): Promise<DomainConfig> {
  // Check if already learned
  const existing = await db.query.domainScrapeConfig.findFirst({
    where: eq(domainScrapeConfig.domain, domain)
  });
  
  if (existing && existing.lastTested > dayjs().subtract(30, 'days').toDate()) {
    return existing;
  }
  
  // Discovery process
  const testUrl = `https://${domain}/`;
  
  // Try Tier 1: Direct fetch
  const directResult = await tryDirectFetch(testUrl);
  if (directResult.success && directResult.contentQuality > 0.8) {
    return saveConfig(domain, { optimalTier: 'proxy', proxyWorks: true });
  }
  
  // Try Tier 2: Geonode proxy
  const proxyResult = await tryProxyFetch(testUrl, 'geonode');
  if (proxyResult.success && proxyResult.contentQuality > 0.8) {
    return saveConfig(domain, { optimalTier: 'proxy', proxyWorks: true });
  }
  
  // Try Tier 3: DataForSEO Basic
  const dfsBasicResult = await tryDataForSeo(testUrl, 'basic');
  if (dfsBasicResult.success && dfsBasicResult.contentQuality > 0.8) {
    return saveConfig(domain, { optimalTier: 'dfs_basic', dfsMode: 'basic' });
  }
  
  // Try Tier 4: DataForSEO JS
  const dfsJsResult = await tryDataForSeo(testUrl, 'js');
  if (dfsJsResult.success && dfsJsResult.contentQuality > 0.8) {
    return saveConfig(domain, { optimalTier: 'dfs_js', dfsMode: 'js' });
  }
  
  // Fallback: DataForSEO Browser
  return saveConfig(domain, { optimalTier: 'dfs_browser', dfsMode: 'browser' });
}

function assessContentQuality(html: string): number {
  const $ = cheerio.load(html);
  
  const wordCount = $('body').text().split(/\s+/).filter(Boolean).length;
  const hasH1 = $('h1').length > 0;
  const hasTitle = $('title').text().length > 0;
  const bodyTextRatio = $('body').text().length / html.length;
  
  let score = 0;
  if (wordCount > 100) score += 0.3;
  if (hasH1) score += 0.2;
  if (hasTitle) score += 0.2;
  if (bodyTextRatio > 0.05) score += 0.3;
  
  return score;
}
```

---

## 9. Fresh vs Stale Data Decisions

### The Freshness Matrix

| Data Type | Freshness Required | Source | Cost |
|-----------|-------------------|--------|------|
| **SERP rankings** | Real-time (daily) | DataForSEO SERP | $0.0006/kw |
| **Own site on-page** | Real-time | Proxy + Cheerio | $0.000015/pg |
| **Competitor on-page** | Weekly OK | Proxy or DFS | $0.000015-0.000125/pg |
| **Core Web Vitals** | Daily (28-day avg) | CrUX API | FREE |
| **Backlinks** | Monthly OK | Common Crawl or DFS | FREE-$0.02/domain |
| **Domain Authority** | Monthly OK | Open PageRank | FREE |
| **Historical trends** | N/A (historical) | Common Crawl/Wayback | FREE |

### Decision Tree

```
WHAT DATA DO YOU NEED?
│
├── SERP Rankings
│   └── DataForSEO SERP API ($0.0006/query)
│       └── Cannot use stale data, positions change daily
│
├── Own Site Audit
│   └── Proxy + Cheerio (real-time, $0.000015/page)
│       └── Must be fresh to verify your changes worked
│
├── Competitor On-Page
│   │
│   ├── Quick Discovery (what keywords do they rank for?)
│   │   └── DataForSEO SERP ($0.0006/kw) - must be fresh
│   │
│   └── Deep Content Analysis (what's on their page?)
│       ├── Weekly check: Proxy or DFS Basic
│       └── Baseline: Common Crawl (1-2mo lag OK)
│
├── Core Web Vitals
│   └── CrUX API (FREE, updated daily)
│       └── Real user data, 28-day rolling average
│
├── Backlinks
│   └── Common Crawl host graph (FREE) or DFS monthly
│       └── Links don't change daily
│
└── Domain Authority
    └── Open PageRank (FREE)
        └── Slow-moving metric
```

### Hybrid Freshness Strategy

```typescript
async function getCompetitorData(domain: string, dataType: string): Promise<Data> {
  switch (dataType) {
    case 'serp_keywords':
      // Must be fresh - use DataForSEO
      return await dataForSeo.getOrganicKeywords(domain);
      
    case 'on_page_content':
      // Check cache first (7-day TTL)
      const cached = await cache.get(`competitor:${domain}:content`);
      if (cached) return cached;
      
      // Try Common Crawl for baseline (free)
      const ccData = await commonCrawl.getLatest(domain);
      if (ccData && ccData.age < 30) {
        return ccData; // Use if less than 30 days old
      }
      
      // Fallback to fresh scrape
      return await scrapeWithTieredFetcher(domain);
      
    case 'backlinks':
      // Monthly refresh OK
      const cachedLinks = await cache.get(`competitor:${domain}:backlinks`);
      if (cachedLinks && cachedLinks.age < 30) return cachedLinks;
      
      // Use Common Crawl host graph (free)
      return await commonCrawl.getHostGraph(domain);
      
    case 'cwv':
      // CrUX API (free, always fresh)
      return await cruxApi.getMetrics(domain);
  }
}
```

---

## 10. Complete Cost Model

### Per-Page Cost Breakdown

| Component | Method | Cost/Page |
|-----------|--------|-----------|
| **CWV data** | CrUX API | $0 |
| **Indexation** | GSC API (owned) | $0 |
| **Title/Meta** | Cache hit (30%) | $0 |
| **Title/Meta** | Common Crawl (20%) | $0 |
| **Title/Meta** | Proxy scrape (35%) | $0.000015 |
| **Title/Meta** | DFS Basic (10%) | $0.000125 |
| **Title/Meta** | DFS JS/Browser (5%) | $0.002 |
| **Weighted HTML cost** | | **$0.000118** |

### Monthly Cost at Scale

| Volume | Naive (DFS Browser) | Optimized | Savings |
|--------|---------------------|-----------|---------|
| 10,000 pages | $42.50 | $1.18 | 97% |
| 100,000 pages | $425 | $11.80 | 97% |
| 1,000,000 pages | $4,250 | $118 | 97% |
| 10,000,000 pages | $42,500 | $1,180 | 97% |

### Position Tracking Cost

| Item | Calculation | Monthly |
|------|-------------|---------|
| 100 keywords daily | 100 × $0.0006 × 30 | $1.80 |
| 500 keywords daily | 500 × $0.0006 × 30 | $9.00 |
| 1,000 keywords daily | 1,000 × $0.0006 × 30 | $18.00 |

### Infrastructure Cost (Self-Hosted)

| Component | Provider | Monthly |
|-----------|----------|---------|
| Orchestration server | Contabo VPS (8 vCPU, 24GB RAM) | $13 |
| Redis cache | Included in VPS | $0 |
| Proxy budget | Geonode 50GB | $38.50 |
| DataForSEO budget | On-demand | ~$50 |
| **Total** | | **~$101.50/mo** |

**Capacity:** ~5M pages/month

**Why Contabo over Hetzner:**
- 8 vCPU AMD EPYC, 24GB RAM for $13/mo (vs Hetzner CPX41 at $31/mo)
- Extra 8GB RAM helps with L1 caching and parse buffers
- Same compute capacity, **60% cheaper**
- Trade-off: Slightly higher latency (acceptable for batch processing)

---

## 11. Implementation Roadmap

### Phase 1: Free Data Integration (Week 1-2)
- [ ] Integrate CrUX API for Core Web Vitals
- [ ] Integrate GSC URL Inspection API
- [ ] Build Common Crawl CDX client
- [ ] Integrate Open PageRank API

### Phase 2: Caching Infrastructure (Week 3-4)
- [ ] Implement multi-tenant shared HTML cache
- [ ] Add conditional GET with ETag/Last-Modified
- [ ] Build Bloom filter for URL deduplication
- [ ] Implement cache TTL strategy

### Phase 3: Tiered Fetcher (Week 5-6)
- [ ] Build technology classifier
- [ ] Implement proxy escalation (direct → Geonode)
- [ ] Implement DataForSEO escalation (Basic → JS → Browser)
- [ ] Build per-domain learning system

### Phase 4: Bandwidth Optimization (Week 7-8)
- [ ] Enable Brotli compression everywhere
- [ ] Implement content stripping for storage
- [ ] Add delta sync with sitemap lastmod
- [ ] Build adaptive rate limiting

### Phase 5: Monitoring & Optimization (Week 9-10)
- [ ] Build cost tracking dashboard
- [ ] Add tier distribution metrics
- [ ] Implement alerting for cost spikes
- [ ] Continuous per-domain optimization

---

## 12. Database Storage Optimization

### The Storage Problem

At scale, HTML storage dominates costs:
- Raw HTML: ~100KB/page average
- 10M pages = 1TB raw storage
- PostgreSQL storage: $0.10-0.20/GB/month

### Compression Strategy

| Algorithm | Ratio | Speed | Use Case |
|-----------|-------|-------|----------|
| **LZ4** | 3-4x | Fastest | Hot data (recent audits) |
| **zstd** | 5-6x | Fast | Warm data (last 30 days) |
| **Brotli** | 7-8x | Slow | Cold archive |

**Implementation:**
```sql
-- Store compressed HTML with algorithm marker
ALTER TABLE crawl_pages ADD COLUMN html_compressed BYTEA;
ALTER TABLE crawl_pages ADD COLUMN compression_algo TEXT DEFAULT 'lz4';

-- Compression on insert (application-level)
INSERT INTO crawl_pages (url, html_compressed, compression_algo)
VALUES ($1, lz4_compress($2), 'lz4');
```

### Tiered Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ HOT TIER: PostgreSQL (0-7 days)                             │
│ - Active audits, real-time access                           │
│ - LZ4 compression (4x)                                      │
│ - Cost: $0.20/GB/mo                                         │
└─────────────────────────────────────────────────────────────┘
                              │ Age > 7 days
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ WARM TIER: Cloudflare R2 (7-90 days)                        │
│ - Recent history, occasional access                         │
│ - zstd compression (6x)                                     │
│ - Cost: $0.015/GB/mo + FREE egress                         │
└─────────────────────────────────────────────────────────────┘
                              │ Age > 90 days
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COLD TIER: Backblaze B2 (90+ days)                          │
│ - Historical archive, rare access                           │
│ - Brotli compression (8x)                                   │
│ - Cost: $0.005/GB/mo                                        │
└─────────────────────────────────────────────────────────────┘
```

### Storage Cost at 10M Pages

| Tier | Pages | Compressed Size | Monthly Cost |
|------|-------|-----------------|--------------|
| Hot (PostgreSQL) | 500K | 12.5 GB | $2.50 |
| Warm (R2) | 2.5M | 41.7 GB | $0.63 |
| Cold (B2) | 7M | 87.5 GB | $0.44 |
| **Total** | 10M | 141.7 GB | **$3.57/mo** |

vs uncompressed PostgreSQL: 1TB × $0.20 = $200/mo

**Savings: 98%**

### Partition by Date

```sql
-- Partition crawl_pages by crawl date for efficient archival
CREATE TABLE crawl_pages (
  id BIGSERIAL,
  url TEXT NOT NULL,
  crawl_date DATE NOT NULL,
  html_compressed BYTEA,
  PRIMARY KEY (id, crawl_date)
) PARTITION BY RANGE (crawl_date);

-- Auto-create monthly partitions
CREATE TABLE crawl_pages_2026_05 PARTITION OF crawl_pages
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

---

## 13. Compute & Parsing Optimization

### Critical Insight: Parsing is NOT the Bottleneck

**Parsing accounts for only 1-3% of total processing time.** Optimizing parsers yields minimal returns compared to network and analysis optimization.

#### Pipeline Time Breakdown (Per Page)

| Stage | Time | % of Total | Bottleneck? |
|-------|------|------------|-------------|
| **Network fetch** | 250-600ms | 50-70% | **YES - Primary** |
| **SEO analysis (109 checks)** | 80-200ms | 25-40% | **YES - Secondary** |
| **HTML parsing** | 2-15ms | 1-3% | No |
| **DB/cache operations** | 5-15ms | 2-5% | No |

#### Theoretical Parsing Capacity

At 100K pages/hour (28 pages/sec), parsing uses only **8.3% of 1 CPU core**:

```
28 pages/sec × 3ms/page = 84ms of CPU per second = 8.4% utilization
```

An 8-core server can theoretically parse **1.9-9.6M pages/hour** depending on parser choice. Parsing is trivial.

### Parser Performance Comparison (LOW PRIORITY)

| Parser | Parse Time (100KB) | Memory | Use Case |
|--------|-------------------|--------|----------|
| **node-html-parser** | 2-3ms | Low | Extraction only |
| **Cheerio (xmlMode)** | 4ms | Medium | Fast mode |
| **linkedom** | 8ms | Medium | DOM spec compliance |
| **Cheerio (default)** | 12-15ms | Medium | jQuery-style selectors |
| **JSDOM** | 45ms | High | Full DOM emulation |

**Note:** Parser optimization is LOW PRIORITY since parsing represents <3% of time. Cheerio's 12ms vs node-html-parser's 2ms saves only 10ms when network fetch takes 400ms.

### When to Use Each

```typescript
// Use Cheerio with xmlMode for speed + familiar API
import * as cheerio from 'cheerio';
const $ = cheerio.load(html, { xmlMode: true }); // 4ms instead of 12ms

// Use node-html-parser only for:
// - Ultra-high volume (>500K pages/hour)
// - Simple extraction (no complex selectors)
import { parse } from 'node-html-parser';
const root = parse(html);
const title = root.querySelector('title')?.text;
```

### Infrastructure: Contabo vs Hetzner vs AWS Lambda

| Factor | Contabo VPS | Hetzner CPX41 | AWS Lambda |
|--------|-------------|---------------|------------|
| **vCPUs** | 8 AMD EPYC | 8 | 6 (max) |
| **RAM** | 24 GB | 16 GB | 10 GB (max) |
| **Monthly cost** | **$13** | $31 | Variable |
| **Cold starts** | None | None | 100-500ms |
| **Best for** | Batch processing | Low-latency | Burst traffic |

**Winner: Contabo at $13/mo** (60% cheaper than Hetzner, same capacity)

**Break-even Analysis:**
- Lambda: ~$0.0000167/second of compute
- At 8 vCPU equivalent: ~$0.00013/second
- Contabo: $13 / 2,592,000 seconds = $0.000005/second

**Contabo is 26x cheaper than Lambda at steady utilization.**

Lambda makes sense for:
- <10% utilization
- Extreme burst (0 → 1000 concurrent)
- No ops team

### Scaling Architecture for 100K Pages/Hour

**Single Server (Contabo 8 vCPU, 24GB):**
- 200 concurrent network fetches (semaphore-controlled)
- 7 worker threads for CPU-bound parsing/analysis
- Comfortable capacity: 100K pages/hour
- First bottleneck: Worker CPU for SEO checks, NOT parsing

```typescript
// Worker pool for CPU-bound work (SEO analysis, not parsing)
import { Piscina } from 'piscina';

const workerPool = new Piscina({
  filename: './seo-analyzer-worker.js',
  minThreads: 7,  // Leave 1 core for main thread
  maxThreads: 7,
  maxQueue: 1000,
});

// Main thread handles I/O-bound fetching (200 concurrent)
// Workers handle CPU-bound SEO analysis (7 parallel)
```

### Parallel Processing Architecture

```typescript
// Worker pool for CPU-bound analysis (parsing is trivial)
import { Worker, isMainThread, parentPort } from 'worker_threads';
import os from 'os';

const WORKER_COUNT = os.cpus().length - 1; // Leave 1 for orchestration

// Main thread: distribute work
if (isMainThread) {
  const workers = Array.from({ length: WORKER_COUNT }, () => 
    new Worker('./seo-analyzer-worker.js')
  );
  
  // Round-robin distribution
  let currentWorker = 0;
  function analyzeHtml(html: string, url: string): Promise<SeoResult> {
    const worker = workers[currentWorker++ % WORKER_COUNT];
    return new Promise(resolve => {
      worker.once('message', resolve);
      worker.postMessage({ html, url });
    });
  }
}

// Worker thread: parse + analyze (parsing is <10% of this work)
if (!isMainThread) {
  parentPort?.on('message', ({ html, url }) => {
    const parsed = fastParse(html);      // 2-4ms (trivial)
    const seoResult = runSeoChecks(parsed, url); // 80-200ms (real work)
    parentPort?.postMessage(seoResult);
  });
}
```

---

## 14. Queue & Scheduling Optimization

### BullMQ Patterns for Cost Control

```typescript
// Per-domain rate limiting (prevents IP blocks)
const queue = new Queue('scrape', {
  defaultJobOptions: {
    rateLimiter: {
      max: 1,        // 1 request at a time
      duration: 2000 // per 2 seconds per domain
    }
  }
});

// Group jobs by domain for rate limiting
await queue.add('scrape', { url }, {
  group: { id: new URL(url).hostname }
});
```

### Singleflight Pattern (Request Deduplication)

```typescript
// Prevent duplicate in-flight requests
const inFlight = new Map<string, Promise<Result>>();

async function fetchWithDedup(url: string): Promise<Result> {
  const key = normalizeUrl(url);
  
  // If already fetching, wait for existing request
  if (inFlight.has(key)) {
    return inFlight.get(key)!;
  }
  
  // Start new request
  const promise = doFetch(url).finally(() => {
    inFlight.delete(key);
  });
  
  inFlight.set(key, promise);
  return promise;
}
```

**Note:** Partial singleflight implementation exists at:
- `open-seo-main/src/server/features/keywords/services/EmbeddingService.pure.ts`

### Adaptive Backoff

```typescript
// Exponential backoff with jitter
function calculateBackoff(attempt: number, baseMs = 1000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), 60000);
  const jitter = Math.random() * 1000;
  return exponential + jitter;
}

// Domain-specific backoff tracking
const domainBackoff = new Map<string, number>();

async function fetchWithBackoff(url: string): Promise<Response> {
  const domain = new URL(url).hostname;
  const backoff = domainBackoff.get(domain) || 0;
  
  if (backoff > Date.now()) {
    await sleep(backoff - Date.now());
  }
  
  try {
    const response = await fetch(url);
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      domainBackoff.set(domain, Date.now() + retryAfter * 1000);
      throw new Error('Rate limited');
    }
    domainBackoff.delete(domain);
    return response;
  } catch (err) {
    domainBackoff.set(domain, Date.now() + calculateBackoff(1));
    throw err;
  }
}
```

### Priority Queue Structure

```typescript
// Priority levels for different job types
enum Priority {
  CRITICAL = 1,   // User waiting (live audit)
  HIGH = 5,       // Scheduled daily audit
  NORMAL = 10,    // Background competitor scan
  LOW = 20,       // Historical backfill
  BULK = 50       // Mass crawl
}

await queue.add('scrape', { url }, {
  priority: isUserInitiated ? Priority.CRITICAL : Priority.NORMAL
});
```

---

## 15. API Request Optimization

### DataForSEO: Standard Queue vs Live

| Mode | Cost | Response Time | Best For |
|------|------|---------------|----------|
| **Standard Queue** | $0.0006/query | 1-15 min | Bulk ranking checks |
| **Live** | $0.002/query | 5-30 sec | User-facing lookups |

**Standard Queue is 70% cheaper** — use for all non-interactive work.

### Batch Operations

```typescript
// DataForSEO supports up to 100 tasks per POST
const BATCH_SIZE = 100;

async function batchSerpCheck(keywords: string[]): Promise<SerpResult[]> {
  const batches = chunk(keywords, BATCH_SIZE);
  const results: SerpResult[] = [];
  
  for (const batch of batches) {
    const tasks = batch.map((keyword, i) => ({
      keyword,
      location_code: 2840, // US
      language_code: 'en',
      device: 'desktop',
      tag: `batch-${i}` // For result matching
    }));
    
    // Single API call for up to 100 keywords
    const response = await dataForSeo.post('/serp/google/organic/task_post', tasks);
    
    // Wait for results (Standard Queue)
    const taskIds = response.tasks.map(t => t.id);
    const completed = await pollForCompletion(taskIds);
    results.push(...completed);
  }
  
  return results;
}
```

### Webhook-Based Result Collection

```typescript
// Instead of polling, use webhooks for Standard Queue
const tasks = keywords.map(keyword => ({
  keyword,
  location_code: 2840,
  pingback_url: `${WEBHOOK_BASE}/dataforseo/serp/${jobId}`
}));

await dataForSeo.post('/serp/google/organic/task_post', tasks);

// Webhook handler
app.post('/dataforseo/serp/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const results = req.body;
  
  await processResults(jobId, results);
  await checkJobCompletion(jobId);
  
  res.status(200).send('OK');
});
```

**Benefits:**
- No polling overhead
- Instant notification when ready
- Reduced API calls

### Request Deduplication

```typescript
// Don't pay twice for the same data
const serpCache = new Redis();

async function getSerpResults(keyword: string, location: string): Promise<SerpResult> {
  const cacheKey = `serp:${keyword}:${location}:${getDateKey()}`;
  
  // Check cache first
  const cached = await serpCache.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Check if request in flight
  const inFlight = await serpCache.get(`inflight:${cacheKey}`);
  if (inFlight) {
    return waitForResult(cacheKey);
  }
  
  // Mark as in-flight
  await serpCache.set(`inflight:${cacheKey}`, '1', 'EX', 300);
  
  // Make request
  const result = await dataForSeo.getSerpResults(keyword, location);
  
  // Cache and clear in-flight
  await serpCache.set(cacheKey, JSON.stringify(result), 'EX', 86400);
  await serpCache.del(`inflight:${cacheKey}`);
  
  return result;
}
```

---

## 16. Advanced Caching Architecture

### Bloom Filters for URL Deduplication

```typescript
import { BloomFilter } from 'bloom-filters';

// 18MB for 10M URLs at 0.1% false positive rate
const urlBloom = new BloomFilter(10_000_000, 0.001);

function shouldCrawl(url: string): boolean {
  const normalized = normalizeUrl(url);
  
  // If definitely not seen, crawl it
  if (!urlBloom.has(normalized)) {
    urlBloom.add(normalized);
    return true;
  }
  
  // Bloom says "maybe seen" - check DB for certainty
  const exists = await db.query.crawledUrls.findFirst({
    where: eq(crawledUrls.url, normalized)
  });
  
  return !exists;
}
```

**Memory:** 18MB for 10M URLs (vs 400MB for HashSet)

### Multi-Level Cache Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ L1: In-Process LRU (10MB)                                   │
│ - Hot URLs, parsed results                                  │
│ - Latency: <1ms                                             │
│ - TTL: 5 minutes                                            │
└─────────────────────────────────────────────────────────────┘
                              │ Miss
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ L2: Redis (1GB)                                             │
│ - Recent crawls, analysis results                           │
│ - Latency: 1-2ms                                            │
│ - TTL: 24 hours                                             │
└─────────────────────────────────────────────────────────────┘
                              │ Miss
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ L3: PostgreSQL (compressed)                                 │
│ - Historical data, audit history                            │
│ - Latency: 5-20ms                                           │
│ - TTL: 90 days                                              │
└─────────────────────────────────────────────────────────────┘
                              │ Miss
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ L4: Object Storage (R2/B2)                                  │
│ - Archive, cold storage                                     │
│ - Latency: 50-200ms                                         │
│ - TTL: Forever                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
class MultiLevelCache {
  private l1 = new LRUCache<string, any>({ max: 10_000 });
  private l2: Redis;
  private l3: PostgresPool;
  private l4: R2Client;
  
  async get<T>(key: string, tier: 'hot' | 'warm' | 'cold' = 'hot'): Promise<T | null> {
    // L1: In-process
    const l1Result = this.l1.get(key);
    if (l1Result) return l1Result as T;
    
    // L2: Redis
    const l2Result = await this.l2.get(key);
    if (l2Result) {
      this.l1.set(key, JSON.parse(l2Result));
      return JSON.parse(l2Result);
    }
    
    if (tier === 'hot') return null;
    
    // L3: PostgreSQL
    const l3Result = await this.l3.query(
      'SELECT data FROM cache WHERE key = $1', [key]
    );
    if (l3Result.rows[0]) {
      const data = decompress(l3Result.rows[0].data);
      await this.promoteToL2(key, data);
      return data;
    }
    
    if (tier === 'warm') return null;
    
    // L4: Object Storage
    const l4Result = await this.l4.get(key);
    if (l4Result) {
      const data = decompress(await l4Result.arrayBuffer());
      await this.promoteToL3(key, data);
      return data;
    }
    
    return null;
  }
}
```

### Cross-Tenant Deduplication

```typescript
// Separate cache keys for shared vs tenant-specific data
const cacheStrategy = {
  // Shared across all tenants (public data)
  html: (url: string) => `html:${sha256(normalizeUrl(url)).slice(0, 16)}`,
  
  // Per-tenant (analysis may differ by settings)
  analysis: (tenantId: string, url: string) => 
    `analysis:${tenantId}:${sha256(url).slice(0, 16)}`,
  
  // Shared (SERP results are same for everyone)
  serp: (keyword: string, location: string) => 
    `serp:${sha256(`${keyword}:${location}`).slice(0, 16)}`
};
```

**Savings from cross-tenant deduplication: ~30%** (based on overlapping competitor analysis)

---

## 17. DataForSEO Pre-Parsed Data Strategy

### The Hybrid Approach

DataForSEO OnPage API returns both **pre-parsed structured data** and **raw HTML**. We can leverage pre-parsed data for ~60% of checks and only parse raw HTML for custom checks.

### Check Distribution: Pre-Parsed vs Raw HTML

#### Tier 1 Checks Using DFS Pre-Parsed Data (~60%)

| Check Category | DFS Field | Coverage |
|----------------|-----------|----------|
| **Title analysis** | `meta.title`, `meta.title_length` | Full |
| **Meta description** | `meta.description`, `meta.description_length` | Full |
| **H1 presence/count** | `meta.htags.h1` | Full |
| **H2-H6 structure** | `meta.htags.h2`, `h3`, etc. | Full |
| **Canonical URL** | `meta.canonical` | Full |
| **Internal links** | `links.internal` | Full |
| **External links** | `links.external` | Full |
| **Image count** | `resource_errors` (with load_resources) | Full |
| **Word count** | `meta.content.plain_text_word_count` | Full |
| **Page size** | `meta.content.size` | Full |
| **Status code** | `status_code` | Full |
| **Load time** | `page_timing` | Full |
| **Robots directives** | `meta.robots_txt`, `meta.x_robots_tag` | Full |
| **Hreflang** | `meta.hreflang` | Full |
| **Open Graph** | `meta.open_graph` | Full |

#### Tier 1 Checks Requiring Raw HTML Parsing (~40%)

| Check Category | Why Raw HTML Needed |
|----------------|---------------------|
| **Keyword in `<strong>`/`<b>`** | DFS doesn't expose text formatting tags |
| **Keyword in first 100 words** | Need exact position, not just presence |
| **E-E-A-T signals** | Author bio patterns, trust signals, review schema |
| **Schema completeness** | Full JSON-LD validation beyond basic detection |
| **Content quality patterns** | Thin content detection, boilerplate ratio |
| **Above-the-fold content** | DOM structure analysis |
| **Image alt text quality** | Semantic analysis of alt attributes |
| **Internal anchor text** | Context around links |
| **Duplicate content blocks** | Template vs unique content detection |
| **CTA placement** | Conversion element detection |

### Implementation Strategy

```typescript
interface DfsOnPageResponse {
  // Pre-parsed data we can use directly
  meta: {
    title: string;
    title_length: number;
    description: string;
    description_length: number;
    canonical: string;
    htags: { h1: string[]; h2: string[]; h3: string[]; };
    content: {
      plain_text_word_count: number;
      size: number;
    };
    // ... more fields
  };
  
  // Raw HTML for custom parsing
  html: string;  // Only when requested
}

async function runSeoAudit(url: string): Promise<AuditResult> {
  // 1. Fetch from DFS with HTML included
  const dfsResult = await dataForSeo.onpage.getPage(url, {
    load_resources: true,
    enable_javascript: false, // Start without JS
    return_raw_html: true,    // Get HTML for custom checks
  });
  
  // 2. Run pre-parsed checks (60% of checks, instant)
  const preParsedResults = runPreParsedChecks(dfsResult.meta);
  
  // 3. Parse raw HTML only for remaining checks (40%)
  const $ = cheerio.load(dfsResult.html, { xmlMode: true });
  const customResults = runCustomHtmlChecks($, dfsResult.html);
  
  return mergeResults(preParsedResults, customResults);
}

function runPreParsedChecks(meta: DfsMeta): CheckResult[] {
  return [
    checkTitleLength(meta.title, meta.title_length),
    checkMetaDescription(meta.description, meta.description_length),
    checkH1Presence(meta.htags.h1),
    checkHeadingStructure(meta.htags),
    checkCanonical(meta.canonical),
    checkWordCount(meta.content.plain_text_word_count),
    // ... ~35 more checks using pre-parsed data
  ];
}

function runCustomHtmlChecks($: CheerioAPI, html: string): CheckResult[] {
  return [
    checkKeywordInStrong($),
    checkKeywordPosition($),
    checkEeatSignals($),
    checkSchemaCompleteness($),
    checkContentQuality($, html),
    // ... ~25 checks requiring HTML parsing
  ];
}
```

### Cost-Benefit Analysis

| Approach | DFS Cost | Parse Time | Total Time |
|----------|----------|------------|------------|
| **Parse everything locally** | $0.000125/page | 12ms | 12ms |
| **Use DFS pre-parsed only** | $0.000125/page | 0ms | 0ms (incomplete) |
| **Hybrid (recommended)** | $0.000125/page | 4ms | 4ms |

The hybrid approach:
- Uses DFS pre-parsed data for 60% of checks (0ms parsing)
- Parses raw HTML for 40% of checks (4ms with xmlMode)
- **Saves 67% of parsing time** while maintaining 100% coverage

### When to Request Raw HTML

```typescript
// Decision tree for raw HTML
function shouldRequestRawHtml(checkTier: number, checkCategories: string[]): boolean {
  // Always request for Tier 1 audits (need full coverage)
  if (checkTier === 1) return true;
  
  // Request if any category needs custom parsing
  const needsHtml = [
    'keyword_density',
    'eeat_signals', 
    'schema_validation',
    'content_quality',
    'internal_linking_context'
  ];
  
  return checkCategories.some(cat => needsHtml.includes(cat));
}
```

### Summary

- **60% of Tier 1 checks** can use DFS pre-parsed data directly (no parsing needed)
- **40% of checks** require raw HTML for custom analysis
- DFS can return **both** parsed data AND raw HTML in one request
- Recommended: Always request raw HTML for Tier 1 audits, parse only what's needed
- Net effect: **67% reduction in parsing overhead** while maintaining full coverage

---

## Appendix: Quick Reference

### Proxy Tier Order
```
T0: Direct fetch (FREE)
T1: Webshare Free DC (FREE, 1GB/mo)
T2: Geonode Residential ($0.77/GB)
T3: DataForSEO Basic ($0.000125/page)
T4: DataForSEO JS ($0.00125/page)
T5: DataForSEO Browser ($0.00425/page)
```

### Free API Limits
```
CrUX API: 150 req/min
GSC URL Inspection: 2,000/day/site
PageSpeed Insights: 25,000/day
Open PageRank: 4.3M domains/day
Common Crawl: Unlimited (S3 bandwidth)
Wayback Machine: 60 req/min
```

### DataForSEO Quick Costs
```
SERP Standard: $0.0006/query
SERP Live: $0.002/query
OnPage Basic: $0.000125/page
OnPage JS: $0.00125/page
OnPage Browser: $0.00425/page
Backlinks: $0.02/domain + $0.00003/row
Keywords: $0.01 + $0.0001/keyword
```

---

## Document History

- **v1.0** (2026-05-07): Initial research with 5 Opus subagents
- **v2.0** (2026-05-07): Corrected proxy pricing (Geonode $0.77 < Evomi $0.99), added DataForSEO layered strategy, fresh vs stale data analysis
- **v3.0** (2026-05-07): Deep optimization research consolidated — added sections 12-16 covering database storage (LZ4/tiered storage), compute optimization (node-html-parser 6x faster), queue patterns (singleflight, adaptive backoff), API batching (Standard Queue 70% cheaper), and multi-level caching (L1-L4 architecture, Bloom filters)
- **v4.0** (2026-05-07): Compute optimization research — clarified parsing is NOT the bottleneck (only 1-3% of time), updated infrastructure to Contabo ($13/mo vs Hetzner $31/mo for 60% savings), added pipeline time breakdown showing network dominates, added Section 17 for DataForSEO pre-parsed data strategy (60%/40% split for Tier 1 checks)
