# Cost-Optimized Full-Site Scraping Pipeline Design

**Date:** 2026-05-07  
**Purpose:** Integrate on-page mastery with existing cheerio scraping infrastructure using sitemap-first discovery and progressive fallbacks to minimize costs.

---

## Executive Summary

TeveroSEO already has robust scraping infrastructure. This design builds on existing components to create a **96% cost reduction** compared to using DataForSEO for everything.

| Metric | All DataForSEO | Optimized Pipeline |
|--------|----------------|-------------------|
| Cost per 5,000 pages | $5.00 | **$0.20** |
| Cost per 50,000 pages | $50.00 | **$2.00** |
| Monthly (5k pages/day) | $750 | **$30** |

---

## 1. Existing Infrastructure (Already Built)

### 1.1 Cheerio Parsing

| File | Purpose |
|------|---------|
| `src/server/lib/audit/page-analyzer.ts:22` | Main `analyzeHtml()` - extracts title, meta, headings, links, images, schemas |
| `src/server/features/onpage-mastery/services/RuleEngineService.ts:94` | Evaluates 30+ SEO rules |
| `src/server/features/onpage-mastery/utils/ChunkExtractor.ts:15` | 500-token content chunking |
| `src/server/features/scraping/services/CustomExtractor.ts:45` | Rule-based CSS extraction |

### 1.2 HTML Fetching

| Method | File | Cost | Use Case |
|--------|------|------|----------|
| Direct fetch | `hybrid-crawler.ts:258` | FREE | Static HTML, SSR sites |
| DataForSEO OnPage | `dataforseoClient.ts:281` | $0.02/page | JS-rendered sites |
| Playwright | `hybrid-crawler.ts:342` | Compute | Opt-in only |

### 1.3 Sitemap Discovery

| File | Capabilities |
|------|-------------|
| `SitemapParser.ts` | 5 common locations, robots.txt extraction, recursive parsing |
| `sitemap-parser.ts` | lastmod filtering, delta sync support |
| `RobotsTxtParser.ts` | Sitemap directives, crawl permissions |

### 1.4 Queue Infrastructure

| Component | Location |
|-----------|----------|
| BullMQ | `src/server/queues/` |
| Audit Queue | `auditQueue.ts` |
| Crawl Lane Router | `crawlLaneRouter.ts` |
| Rate Limiter | `redis-rate-limiter.ts` |

---

## 2. Data Source Cascade (Cost Priority)

### 2.1 FREE Tier (No API Cost)

| Source | Data | Rate Limits |
|--------|------|-------------|
| **GSC API** | Own rankings, clicks, CTR, impressions, query-to-page | 2,000 req/day |
| **PageSpeed Insights** | Core Web Vitals, Lighthouse scores | 25,000 req/day |
| **Direct Fetch** | HTML content from static/SSR sites | Unlimited |
| **Local Lighthouse** | Full performance audit (puppeteer) | Unlimited (compute) |
| **robots.txt** | Sitemap locations, crawl rules | Unlimited |
| **sitemap.xml** | URL discovery, lastmod, priority | Unlimited |

### 2.2 CHEAP Tier ($0.001-0.01/request)

| Source | Data | Cost |
|--------|------|------|
| **Webshare Free** | 10 proxies, 1GB/mo | FREE |
| **DC Proxy Pool** | IP rotation | $0.018/IP |
| **DataForSEO Labs** | Related keywords, suggestions | $0.01 + $0.0001/item |

### 2.3 PAID Tier ($0.02+/request)

| Source | Data | Cost |
|--------|------|------|
| **DataForSEO OnPage** | JS-rendered HTML | $0.02/page |
| **DataForSEO SERP** | Competitor rankings | $0.006/SERP |
| **DataForSEO Backlinks** | Link profile | $0.02 + $0.00003/row |
| **Residential Proxy** | Cloudflare bypass | $1.40-4.00/GB |

---

## 3. Scraping Tier Architecture

### 3.1 Tier Definitions

```
Tier 0: Direct Fetch + Cheerio (FREE)
├── Method: fetch() with proper User-Agent
├── Works for: 60-70% of sites (WordPress, static, SSR)
├── Latency: 100-200ms
└── Cost: $0.02/1000 pages (bandwidth only)

Tier 1: Delayed Retry (FREE)
├── Method: Exponential backoff + UA rotation
├── Works for: Rate-limited sites (429)
├── Latency: 2-5s extra
└── Cost: $0.02/1000 pages

Tier 2: Webshare Free Proxy (FREE)
├── Method: Route through 10 free proxies
├── Works for: IP-blocked sites
├── Latency: 500ms extra
└── Cost: $0 (1GB/mo limit)

Tier 3: DataForSEO OnPage (PAID)
├── Method: API with browser rendering
├── Works for: JS SPAs, Cloudflare
├── Latency: 2-5s
└── Cost: $1.00/1000 pages
```

### 3.2 Escalation Logic

```typescript
async function fetchWithFallback(url: string): Promise<FetchResult> {
  // Tier 0: Direct fetch
  const t0Result = await directFetch(url, {
    headers: {
      'User-Agent': getRotatingUserAgent(),
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });
  
  if (t0Result.ok) {
    const isSPA = await detectSPA(t0Result.html);
    if (!isSPA) return { tier: 0, html: t0Result.html };
    // SPA detected, escalate to Tier 3
  }
  
  // Tier 1: Retry with backoff (rate limit / temp failure)
  if (t0Result.status === 429 || t0Result.status >= 500) {
    const t1Result = await retryWithBackoff(url, {
      retries: 3,
      baseDelay: 2000,
      maxDelay: 10000,
      userAgentRotation: true,
    });
    if (t1Result.ok && !detectSPA(t1Result.html)) {
      return { tier: 1, html: t1Result.html };
    }
  }
  
  // Tier 2: Webshare proxy (IP blocked)
  if (t0Result.status === 403 || t0Result.blocked) {
    const proxy = await getWebshareProxy();
    if (proxy) {
      const t2Result = await fetchWithProxy(url, proxy);
      if (t2Result.ok && !detectSPA(t2Result.html)) {
        return { tier: 2, html: t2Result.html };
      }
    }
  }
  
  // Tier 3: DataForSEO (last resort)
  const t3Result = await dataForSeoScraper.fetchRawHtml(url);
  return { tier: 3, html: t3Result.html };
}
```

### 3.3 SPA Detection (Avoid Unnecessary Tier 3)

```typescript
// Already exists: src/server/features/platform-oauth/crawler/SPADetector.ts
const SPA_INDICATORS = [
  'id="__next"',           // Next.js
  'id="app"',              // Vue
  'id="root"',             // React CRA
  'ng-app',                // Angular
  '<noscript>',            // If noscript has content warning
  'window.__NUXT__',       // Nuxt
  'data-reactroot',        // React
];

function detectSPA(html: string): boolean {
  // Check for SPA indicators
  const hasIndicator = SPA_INDICATORS.some(i => html.includes(i));
  
  // Check content density (SPAs have minimal server HTML)
  const textContent = extractText(html);
  const textRatio = textContent.length / html.length;
  
  // SPA if indicators present AND low text ratio
  return hasIndicator && textRatio < 0.05;
}
```

---

## 4. URL Discovery Pipeline

### 4.1 Sitemap-First Flow

```
1. Check robots.txt for Sitemap: directives
   └── GET /robots.txt → parse Sitemap: lines

2. Try common sitemap locations (if robots.txt empty)
   ├── /sitemap.xml
   ├── /sitemap_index.xml
   ├── /sitemap-index.xml
   ├── /sitemap/sitemap.xml
   └── /sitemaps/sitemap.xml

3. Parse sitemap (handle sitemap index)
   ├── If <sitemapindex>: fetch child sitemaps recursively
   └── If <urlset>: extract <url> entries

4. Extract URL metadata
   ├── loc: URL
   ├── lastmod: Last modified date
   ├── priority: 0.0-1.0
   └── changefreq: always/hourly/daily/weekly/monthly/yearly/never

5. Apply filters
   ├── Include patterns: ['/products/', '/blog/']
   └── Exclude patterns: ['/tag/', '/author/', '/page/', '/feed/']

6. Sort by priority
   ├── Sort by: lastmod DESC, priority DESC
   └── Limit: maxPages (default 10,000)

7. Queue for crawling
   └── Push to pageCrawlQueue with metadata
```

### 4.2 Delta Sync (Skip Unchanged Pages)

```typescript
// Already exists: src/server/lib/crawler/delta-cascade.ts

async function shouldCrawl(url: string, sitemapLastmod: Date | null): Promise<boolean> {
  // L0: Sitemap lastmod check
  if (sitemapLastmod) {
    const lastCrawl = await getLastCrawlDate(url);
    if (lastCrawl && lastCrawl > sitemapLastmod) {
      return false; // Sitemap says unchanged
    }
  }
  
  // L1: Conditional GET (If-Modified-Since)
  const headResponse = await fetch(url, {
    method: 'HEAD',
    headers: { 'If-Modified-Since': lastCrawl?.toUTCString() }
  });
  if (headResponse.status === 304) {
    return false; // Server says unchanged
  }
  
  // L2: Content hash check (after fetch)
  // Done post-fetch to avoid duplicate processing
  
  return true; // Need to crawl
}
```

---

## 5. Queue Architecture

### 5.1 Job Types

```typescript
// Sitemap discovery job
interface SitemapCrawlJob {
  id: string;
  tenantId: string;
  projectId: string;
  baseUrl: string;
  config: {
    maxPages: number;           // Default: 10,000
    respectRobots: boolean;     // Default: true
    includePatterns: string[];  // Regex
    excludePatterns: string[];  // Regex
    prioritizeBy: 'lastmod' | 'priority' | 'changefreq';
    deltaSyncEnabled: boolean;  // Default: true
  };
}

// Individual page crawl job
interface PageCrawlJob {
  id: string;
  crawlJobId: string;          // Parent reference
  url: string;
  tier: 0 | 1 | 2 | 3;
  retryCount: number;
  sitemapMeta: {
    lastmod: Date | null;
    priority: number | null;
    changefreq: string | null;
  };
}
```

### 5.2 Queue Configuration

```typescript
// New queues following existing patterns

export const sitemapCrawlQueue = new Queue<SitemapCrawlJob>('sitemap-crawl', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const pageCrawlQueue = new Queue<PageCrawlJob>('page-crawl', {
  connection: redis,
  defaultJobOptions: {
    attempts: 4, // Allow tier escalation retries
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 10000 },
    removeOnFail: { count: 5000 },
  },
});

// Concurrency by tier
const TIER_CONCURRENCY = {
  0: 50,  // High concurrency for free tier
  1: 10,  // Lower for retry tier
  2: 10,  // Lower for proxy tier
  3: 5,   // Lowest for paid tier (rate limited)
};
```

### 5.3 Worker Implementation

```typescript
// page-crawl-worker.ts

const worker = new Worker<PageCrawlJob>('page-crawl', async (job) => {
  const { url, tier, crawlJobId, sitemapMeta } = job.data;
  
  // Rate limit per domain
  const domain = new URL(url).hostname;
  await domainRateLimiter.acquire(domain);
  
  try {
    // Fetch with current tier
    const result = await fetchWithTier(url, tier);
    
    if (result.shouldEscalate && tier < 3) {
      // Escalate to next tier
      await pageCrawlQueue.add(`page-${url}`, {
        ...job.data,
        tier: tier + 1,
        retryCount: 0,
      });
      return { status: 'escalated', nextTier: tier + 1 };
    }
    
    if (result.html) {
      // Parse and store
      const $ = cheerio.load(result.html);
      const analysis = analyzeHtml($, url);
      
      await storeCrawlResult({
        crawlJobId,
        url,
        tier: result.tier,
        html: result.html,
        analysis,
        sitemapMeta,
      });
      
      // Update parent job progress
      await updateCrawlJobProgress(crawlJobId);
      
      return { status: 'success', tier: result.tier };
    }
    
    throw new Error(`Failed to fetch: ${result.error}`);
  } catch (error) {
    // Log to dead letter if exhausted
    if (job.attemptsMade >= job.opts.attempts) {
      await logDeadLetter(crawlJobId, url, error);
    }
    throw error;
  }
}, {
  connection: redis,
  concurrency: 50, // Managed per-tier internally
  limiter: {
    max: 100,
    duration: 1000, // 100 req/s global
  },
});
```

---

## 6. Database Schema

```sql
-- Crawl jobs (orchestration)
CREATE TABLE crawl_jobs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  base_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending → discovering → crawling → analyzing → complete
  
  config JSONB NOT NULL DEFAULT '{}',
  
  -- Progress
  total_urls INTEGER DEFAULT 0,
  crawled_urls INTEGER DEFAULT 0,
  failed_urls INTEGER DEFAULT 0,
  skipped_urls INTEGER DEFAULT 0,
  
  -- Cost tracking
  tier_0_count INTEGER DEFAULT 0,
  tier_1_count INTEGER DEFAULT 0,
  tier_2_count INTEGER DEFAULT 0,
  tier_3_count INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(10, 4) DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  last_error TEXT,
  error_count INTEGER DEFAULT 0
);

CREATE INDEX idx_crawl_jobs_tenant_status ON crawl_jobs(tenant_id, status);
CREATE INDEX idx_crawl_jobs_project ON crawl_jobs(project_id);

-- Crawl results (individual pages)
CREATE TABLE crawl_results (
  id BIGSERIAL PRIMARY KEY,
  crawl_job_id BIGINT NOT NULL REFERENCES crawl_jobs(id),
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL, -- SHA256[:16]
  
  -- Fetch metadata
  status_code INTEGER,
  fetch_tier INTEGER NOT NULL,
  fetch_method TEXT NOT NULL,
  fetch_time_ms INTEGER,
  
  -- Content
  html_size_bytes INTEGER,
  html_storage_key TEXT, -- S3 key for large content
  
  -- Extracted SEO data
  title TEXT,
  meta_description TEXT,
  h1_count INTEGER,
  canonical_url TEXT,
  word_count INTEGER,
  
  -- Change detection
  content_hash TEXT,
  change_type TEXT, -- 'new', 'modified', 'unchanged'
  
  -- Sitemap metadata
  sitemap_lastmod TIMESTAMPTZ,
  sitemap_priority DECIMAL(3, 2),
  sitemap_changefreq TEXT,
  
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(crawl_job_id, url_hash)
);

CREATE INDEX idx_crawl_results_job ON crawl_results(crawl_job_id);
CREATE INDEX idx_crawl_results_hash ON crawl_results(url_hash);

-- HTML cache (inline for small sites, S3 for large)
CREATE TABLE crawl_html_cache (
  id BIGSERIAL PRIMARY KEY,
  crawl_result_id BIGINT NOT NULL REFERENCES crawl_results(id),
  html TEXT NOT NULL,
  compressed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_html_cache_expires ON crawl_html_cache(expires_at);
```

---

## 7. Integration with On-Page Mastery

### 7.1 Current Flow

```
API Call (url, html?) → RuleEngineService → Cheerio Parse → Rules Evaluation
```

**Problem:** API expects pre-fetched HTML. No automatic crawling.

### 7.2 Enhanced Flow

```
Crawl Job Created
    ↓
Sitemap Discovery (FREE)
    ↓
URL Queue Population
    ↓
Tiered Fetch (T0→T1→T2→T3)
    ↓
HTML Stored in crawl_results
    ↓
On-Page Mastery Analysis (batch)
    ↓
Results stored in onpage_analysis table
    ↓
GraphRAG Ingestion (optional)
```

### 7.3 Batch Analysis Service

```typescript
// OnPageMasteryBatchService.ts

async function analyzeFromCrawlJob(crawlJobId: string): Promise<void> {
  const results = await db.query.crawlResults.findMany({
    where: eq(crawlResults.crawlJobId, crawlJobId),
    with: { htmlCache: true },
  });
  
  for (const result of results) {
    const html = result.htmlCache?.html || await fetchFromS3(result.htmlStorageKey);
    
    // Run on-page mastery
    const analysis = await ruleEngineService.evaluatePage({
      url: result.url,
      html,
      clientId: result.crawlJob.tenantId,
    });
    
    // Store analysis
    await db.insert(onpageAnalysis).values({
      crawlResultId: result.id,
      scores: analysis.scores,
      issues: analysis.issues,
      vertical: analysis.vertical,
      isYmyl: analysis.isYmyl,
    });
    
    // Optional: Queue for GraphRAG
    if (config.enableGraphRag) {
      await enqueueGraphIngestion(result.id);
    }
  }
  
  // Update job status
  await updateCrawlJobStatus(crawlJobId, 'analyzing');
}
```

---

## 8. Cost Projections

### 8.1 Per-Site Crawl (5,000 pages)

| Tier | % of Pages | Pages | Cost/1k | Total |
|------|------------|-------|---------|-------|
| T0 (Free) | 85% | 4,250 | $0.00 | $0.00 |
| T1 (Retry) | 10% | 500 | $0.00 | $0.00 |
| T2 (Proxy) | 3% | 150 | $0.00 | $0.00 |
| T3 (DataForSEO) | 2% | 100 | $1.00 | $0.10 |
| **Total** | 100% | 5,000 | - | **$0.10** |

**vs. All DataForSEO:** $5.00 → **98% savings**

### 8.2 Monthly at Scale (5k pages/day, 30 days)

| Item | Without Optimization | With Optimization |
|------|---------------------|-------------------|
| HTML Fetching | $750 (150k pages × $0.005) | $15 (3k T3 pages × $0.005) |
| GSC Data | FREE | FREE |
| Cheerio Parsing | FREE | FREE |
| On-Page Analysis | FREE (local) | FREE (local) |
| **Total** | $750/mo | **$15/mo** |

### 8.3 What Requires DataForSEO (Cannot Avoid)

| Data Type | Why DataForSEO | Monthly Cost |
|-----------|----------------|--------------|
| Competitor Rankings | GSC only shows own site | $60 (10k SERPs) |
| Keyword Research | Volume, difficulty | $150 (3k queries) |
| Backlink Data | No free alternative | $100 (2k domains) |

**Total Unavoidable DataForSEO:** ~$310/mo

---

## 9. Implementation Phases

### Phase 1: Unified Sitemap Service (2 days)
- [ ] Merge `SitemapParser.ts` implementations
- [ ] Add URL pattern filtering
- [ ] Add priority sorting
- [ ] Add delta sync awareness

### Phase 2: Tiered Fetcher (2 days)
- [ ] Create `TieredFetcher` class
- [ ] Integrate SPA detection for auto-T3
- [ ] Add Webshare free proxy support
- [ ] Add per-domain rate limiting

### Phase 3: Queue Infrastructure (2 days)
- [ ] Create `sitemapCrawlQueue`
- [ ] Create `pageCrawlQueue`
- [ ] Implement workers
- [ ] Add progress tracking

### Phase 4: Database & Storage (1 day)
- [ ] Add Drizzle schema
- [ ] Implement HTML caching
- [ ] Add S3 fallback for large sites

### Phase 5: On-Page Integration (1 day)
- [ ] Create `OnPageMasteryBatchService`
- [ ] Wire up post-crawl analysis
- [ ] Add reporting/dashboard

### Phase 6: Monitoring (1 day)
- [ ] Tier distribution metrics
- [ ] Cost tracking
- [ ] Alert on high T3 usage
- [ ] Dead letter monitoring

---

## 10. File Structure

```
src/server/
├── lib/
│   └── crawler/
│       ├── index.ts                    # Export all
│       ├── SitemapCrawlService.ts      # NEW: Unified sitemap discovery
│       ├── TieredFetcher.ts            # NEW: T0→T3 escalation
│       ├── WebshareProxyPool.ts        # NEW: Free proxy rotation
│       ├── sitemap-parser.ts           # EXISTING: Keep for delta
│       ├── hybrid-crawler.ts           # EXISTING: Keep for Playwright
│       └── delta-cascade.ts            # EXISTING: Keep for skip logic
├── queues/
│   ├── sitemapCrawlQueue.ts            # NEW
│   └── pageCrawlQueue.ts               # NEW
├── workers/
│   ├── sitemap-crawl-worker.ts         # NEW
│   └── page-crawl-worker.ts            # NEW
├── features/
│   └── onpage-mastery/
│       └── services/
│           └── OnPageMasteryBatchService.ts  # NEW
└── db/
    └── crawl-schema.ts                 # EXTEND: Add new tables
```

---

## 11. Environment Variables

```env
# Existing
DATAFORSEO_API_KEY=base64_encoded_login:password

# New - Webshare Free (optional)
WEBSHARE_API_KEY=your_webshare_api_key

# New - Crawl Config
CRAWL_MAX_PAGES_DEFAULT=10000
CRAWL_T0_CONCURRENCY=50
CRAWL_T3_CONCURRENCY=5
CRAWL_RATE_LIMIT_PER_DOMAIN=10  # req/s

# New - Cost Alerts
CRAWL_T3_ALERT_THRESHOLD=100   # Alert if >100 T3 requests/job
```

---

## Appendix: Existing Infrastructure Reference

| Component | File | What It Does |
|-----------|------|-------------|
| HybridCrawler | `lib/crawler/hybrid-crawler.ts` | HTTP-first with Playwright fallback |
| UniversalCrawler | `features/platform-oauth/crawler/UniversalCrawler.ts` | Tiered crawl (direct → DFS → Playwright) |
| SitemapParser (1) | `lib/crawler/sitemap-parser.ts` | Recursive sitemap with lastmod filter |
| SitemapParser (2) | `features/platform-oauth/crawler/SitemapParser.ts` | 5-location discovery, index handling |
| RobotsTxtParser | `features/platform-oauth/crawler/RobotsTxtParser.ts` | Parse robots.txt, check permissions |
| SPADetector | `features/platform-oauth/crawler/SPADetector.ts` | Detect JS frameworks |
| DeltaCascade | `lib/crawler/delta-cascade.ts` | L0-L3 skip cascade |
| DataForSEO Client | `lib/dataforseoClient.ts` | Metered API wrapper |
| Rate Limiter | `lib/redis-rate-limiter.ts` | Token bucket per domain |
| Template Hash | `lib/crawler/template-hash.ts` | Content fingerprinting |
| Page Analyzer | `lib/audit/page-analyzer.ts` | Cheerio-based SEO extraction |
