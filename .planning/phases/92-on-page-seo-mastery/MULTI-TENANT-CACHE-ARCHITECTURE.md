# Multi-Tenant Cache Architecture: Avoiding Redundant Fetches

**Date:** 2026-05-07  
**Purpose:** Comprehensive caching strategy to minimize redundant web fetches across the entire TeveroSEO platform through aggressive caching, deduplication, and shared data strategies.

---

## Executive Summary

### The Problem
For 100 clients, each auditing 10 competitors with 5,000 pages each:
- **Without dedup:** 100 × 10 × 5,000 = **5M fetches**
- **With optimization:** ~350K fetches (**93% reduction**)

### Key Insight
Public HTML is not tenant-specific. If Client A audits `competitor.com`, Client B requesting the same URL can use the cached version. No privacy concerns exist for public web content.

---

## 1. Multi-Tenant Shared Cache Architecture

### 1.1 Cache Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                    TeveroSEO Cache Layers                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  L1: Request Dedup (in-flight)                                  │
│  ├── Singleflight pattern                                       │
│  └── Prevents concurrent fetches of same URL                    │
│                                                                 │
│  L2: Hot Cache (Redis)                                          │
│  ├── Key: url_hash (SHA256[:16])                                │
│  ├── Value: { html, headers, fetchedAt, contentHash }           │
│  ├── TTL: 24h for audits, 7d for competitor research            │
│  └── Shared across ALL tenants (no tenant prefix)               │
│                                                                 │
│  L3: Warm Cache (PostgreSQL + S3)                               │
│  ├── crawl_html_cache table for small content                   │
│  ├── S3 for large HTML (>100KB)                                 │
│  └── TTL: 30d for historical comparison                         │
│                                                                 │
│  L4: External Sources (FREE)                                    │
│  ├── Common Crawl (1-2 month lag, 50B+ pages)                   │
│  ├── Wayback Machine (historical, rate-limited)                 │
│  └── HTTP 304 (conditional GET)                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Cache Key Strategy

**Universal cache key (no tenant isolation for public HTML):**

```typescript
interface CacheKey {
  urlHash: string;      // SHA256(normalizeUrl(url))[:16]
  contentType: 'html' | 'sitemap' | 'robots';
}

function generateCacheKey(url: string): string {
  const normalized = normalizeUrl(url);
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `html:${hash}`;
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  // Remove tracking params
  const STRIP_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'ref'];
  STRIP_PARAMS.forEach(p => parsed.searchParams.delete(p));
  // Lowercase host, remove trailing slash, sort params
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  parsed.searchParams.sort();
  return parsed.toString();
}
```

### 1.3 TTL Strategy by Use Case

| Use Case | TTL | Rationale |
|----------|-----|-----------|
| Site audit (own site) | 24h | Owner knows when content changes |
| Competitor audit | 7d | Competitors don't change daily |
| Keyword research SERP | 24h | Rankings fluctuate |
| Backlink source pages | 30d | Link pages rarely change |
| Historical comparison | 90d | Archive for trend analysis |

### 1.4 Redis Schema

```typescript
// Redis key patterns (NO tenant prefix for shared HTML)
const CACHE_PATTERNS = {
  html: 'html:{urlHash}',           // Shared HTML cache
  headers: 'hdrs:{urlHash}',        // ETag/Last-Modified for conditional GET
  sitemap: 'smap:{domainHash}',     // Sitemap data (shared)
  robots: 'rbts:{domainHash}',      // robots.txt (shared)
  domainTier: 'tier:{domain}',      // Per-domain fetch tier (T0-T3)
  rateLimit: 'rl:{domain}',         // Per-domain rate limit tokens
};

// Only tenant-specific for analysis results, NOT raw HTML
const TENANT_PATTERNS = {
  analysisResult: 't:{tenantId}:analysis:{urlHash}',
  crawlJob: 't:{tenantId}:job:{jobId}',
};
```

---

## 2. Delta Crawling Optimization

### 2.1 Four-Layer Skip Cascade

TeveroSEO already implements a sophisticated delta cascade (see `delta-cascade.ts`):

| Layer | Method | Cost | Skip Rate | Cumulative |
|-------|--------|------|-----------|------------|
| L0 | Sitemap lastmod | FREE | 20-30% | 25% |
| L1 | HTTP 304 (If-Modified-Since/ETag) | HEAD request | 30-40% | 55% |
| L2 | Template-aware hash | In-memory | 20-30% | 75% |
| L3 | Full reprocess | Full fetch | - | - |

### 2.2 Sitemap lastmod Trust Analysis

**Based on industry research:**
- 58% of sitemaps have outdated/missing lastmod (HTTP Archive 2024)
- Google treats lastmod as a "hint, not a command"
- Shopify-like platforms update lastmod on ANY change (unreliable positive signal)

**Our approach: Negative-only signal**
```typescript
// Trust lastmod ONLY to skip (negative signal)
// Never trust lastmod to force recrawl (positive signal)
if (sitemapLastmod && sitemapLastmod < lastCrawledAt) {
  return 'skip'; // Safe to skip - sitemap says unchanged
}
// If lastmod > lastCrawledAt, verify with L1/L2 before processing
```

### 2.3 HTTP 304 Implementation

```typescript
// Already exists: conditional-get.ts
async function conditionalGet(
  url: string, 
  cachedHeaders: { etag?: string; lastModified?: string }
): Promise<ConditionalResult> {
  const headers: Record<string, string> = {};
  
  if (cachedHeaders.etag) {
    headers['If-None-Match'] = cachedHeaders.etag;
  }
  if (cachedHeaders.lastModified) {
    headers['If-Modified-Since'] = cachedHeaders.lastModified;
  }
  
  const response = await fetch(url, { 
    method: 'GET',  // Some servers don't support conditional HEAD
    headers 
  });
  
  if (response.status === 304) {
    return { status: 'unchanged' };
  }
  
  return {
    status: 'changed',
    response,
    headers: {
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    }
  };
}
```

### 2.4 Template-Aware Hashing

**Already implemented:** `template-hash.ts`

Key features:
- Strips 30+ dynamic selectors (price, stock, widgets, consent)
- Extracts 16 SEO-relevant selectors (title, meta, h1-h3, main, article)
- SHA256 hash for collision resistance
- Target: 65-80% L2 skip rate on stable sites

---

## 3. Public Dataset Exploitation

### 3.1 Common Crawl Integration

**What it offers:**
- 50+ billion pages indexed
- Monthly crawl updates
- Free CDX API (no key required)
- WARC/WET/WAT formats

**Coverage analysis:**
- Strong: Major .com, .org, news sites, large e-commerce
- Weak: Small business sites, new domains, geo-specific TLDs
- Lag: 1-2 months behind current web

**API Integration:**

```typescript
interface CommonCrawlResult {
  url: string;
  timestamp: string;      // YYYYMMDDHHMMSS
  digest: string;         // SHA-1 of content
  filename: string;       // WARC file location
  offset: number;
  length: number;
  status: string;         // HTTP status from crawl
}

async function queryCommonCrawl(url: string): Promise<CommonCrawlResult[]> {
  const indexes = await fetch('https://index.commoncrawl.org/collinfo.json').then(r => r.json());
  const latestIndex = indexes[0].cdx_api;  // Most recent crawl
  
  const response = await fetch(
    `${latestIndex}?url=${encodeURIComponent(url)}&output=json&limit=1`
  );
  
  if (!response.ok) return [];
  
  const results = await response.text();
  return results.split('\n').filter(Boolean).map(JSON.parse);
}

async function fetchFromCommonCrawl(result: CommonCrawlResult): Promise<string> {
  // Fetch WARC record using range request
  const warc_url = `https://data.commoncrawl.org/${result.filename}`;
  const response = await fetch(warc_url, {
    headers: {
      Range: `bytes=${result.offset}-${result.offset + result.length - 1}`
    }
  });
  
  const data = await response.arrayBuffer();
  // Decompress and extract HTML from WARC record
  return extractHtmlFromWarc(data);
}
```

**When to use Common Crawl:**
- Competitor research (freshness less critical)
- Historical analysis
- Large-scale discovery
- Budget constraints

**When NOT to use:**
- Client's own site (need current data)
- Audit accuracy requirements
- Real-time monitoring

### 3.2 Wayback Machine Integration

**Rate limits (2026):**
- CDX API: 60 requests/minute
- Violations: 1-hour IP block (doubles each time)
- No API key required

```typescript
async function getLatestSnapshot(url: string): Promise<WaybackSnapshot | null> {
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=1&sort=reverse`;
  
  const response = await fetch(cdxUrl);
  if (!response.ok) return null;
  
  const data = await response.json();
  if (data.length < 2) return null;  // First row is headers
  
  const [, timestamp, , , status, digest, length] = data[1];
  
  return {
    url: `https://web.archive.org/web/${timestamp}id_/${url}`,
    timestamp: parseWaybackTimestamp(timestamp),
    digest,
    originalStatus: status,
  };
}
```

**Use cases:**
- Historical comparison ("how did this page look 6 months ago?")
- Fallback for blocked sites
- Competitor research

### 3.3 Google Cache Alternative

**Status:** Google Cache deprecated February 2024

**Alternatives:**
1. Wayback Machine (recommended)
2. Bing Cache (`cache:url` still works)
3. Archive.today (archive.ph)
4. CachedView.com (aggregator)

---

## 4. Cross-Client Collaborative Caching

### 4.1 The Opportunity

Most SEO agencies audit overlapping competitors:
- Marketing agencies: Competing SaaS companies
- E-commerce: Amazon, competitors in same vertical
- Local SEO: Directory sites (Yelp, Google Business)

**Overlap estimation:**
- 100 clients × 10 competitors each = 1,000 unique domains (theoretical)
- Actual unique: ~300-400 (60-70% overlap on popular sites)

### 4.2 Shared Cache Implementation

```typescript
// Cache lookup order (shared-first for public HTML)
async function getCachedHtml(url: string): Promise<CacheResult | null> {
  const urlHash = generateCacheKey(url);
  
  // 1. Check Redis hot cache (shared across ALL tenants)
  const redisResult = await redis.get(`html:${urlHash}`);
  if (redisResult) {
    const parsed = JSON.parse(redisResult);
    if (Date.now() < parsed.expiresAt) {
      return { source: 'redis', ...parsed };
    }
  }
  
  // 2. Check PostgreSQL warm cache (shared)
  const dbResult = await db.query.crawlHtmlCache.findFirst({
    where: and(
      eq(crawlHtmlCache.urlHash, urlHash),
      gt(crawlHtmlCache.expiresAt, new Date())
    )
  });
  if (dbResult) {
    // Promote to Redis for faster subsequent access
    await redis.setex(`html:${urlHash}`, 3600, JSON.stringify(dbResult));
    return { source: 'postgres', ...dbResult };
  }
  
  // 3. Check Common Crawl (if acceptable freshness)
  const ccResult = await queryCommonCrawl(url);
  if (ccResult.length > 0) {
    const age = Date.now() - parseTimestamp(ccResult[0].timestamp);
    if (age < 30 * 24 * 60 * 60 * 1000) { // < 30 days
      const html = await fetchFromCommonCrawl(ccResult[0]);
      // Cache for future requests
      await cacheHtml(url, html, { source: 'common_crawl' });
      return { source: 'common_crawl', html, age };
    }
  }
  
  return null; // Cache miss - need fresh fetch
}
```

### 4.3 Privacy Considerations

**Why shared cache is safe for public HTML:**
1. All data is publicly accessible (no auth required)
2. No tenant-specific modifications to content
3. Cached data is the same for all observers
4. No PII or client data in raw HTML cache

**What MUST remain tenant-isolated:**
- Analysis results (SEO scores, issues found)
- Crawl job configuration
- Client-specific metadata
- User actions and preferences

### 4.4 Cache Invalidation Strategy

```typescript
// Invalidation triggers
const INVALIDATION_EVENTS = {
  // Manual invalidation (tenant requests fresh data)
  manual: async (tenantId: string, url: string) => {
    const urlHash = generateCacheKey(url);
    await redis.del(`html:${urlHash}`);
    // Don't delete from PostgreSQL (keep for audit trail)
  },
  
  // Time-based expiry (handled by TTL)
  ttlExpiry: 'automatic',
  
  // Content change detected (during conditional GET)
  contentChanged: async (url: string, newHtml: string) => {
    const urlHash = generateCacheKey(url);
    await redis.setex(`html:${urlHash}`, 86400, JSON.stringify({
      html: newHtml,
      fetchedAt: Date.now(),
      contentHash: computeTemplateAwareHash(newHtml).hash,
    }));
  },
};
```

---

## 5. Pre-fetching Strategy

### 5.1 Popular Domain Pre-crawl

For commonly audited domains, pre-fetch on a schedule:

```typescript
const PRE_CRAWL_CONFIG = {
  // Tier 1: Crawl weekly (high overlap across clients)
  tier1: {
    domains: [
      'amazon.com', 'wikipedia.org', 'youtube.com', 'linkedin.com',
      'facebook.com', 'twitter.com', 'instagram.com', 'yelp.com',
      'reddit.com', 'medium.com', 'hubspot.com', 'mailchimp.com',
    ],
    schedule: 'weekly',
    maxPages: 10000,
  },
  
  // Tier 2: Crawl monthly (moderate overlap)
  tier2: {
    domains: [
      // Industry-specific leaders per vertical
      // Populated from client competitor analysis
    ],
    schedule: 'monthly',
    maxPages: 5000,
  },
  
  // Tier 3: On-demand only (client-specific)
  tier3: {
    domains: [],
    schedule: 'on_demand',
    maxPages: 5000,
  },
};
```

### 5.2 Pre-crawl Cost Analysis

| Tier | Domains | Pages/Domain | Total Pages | Monthly Cost |
|------|---------|--------------|-------------|--------------|
| Tier 1 | 12 | 10,000 | 120,000 | ~$12 (98% T0-T2) |
| Tier 2 | 50 | 5,000 | 250,000 | ~$25 |
| **Total** | 62 | - | 370,000 | **$37/mo** |

**ROI:** If this satisfies 30% of client competitor requests, saves $300+/mo in on-demand crawling.

---

## 6. Deduplication Math

### 6.1 Baseline Scenario

**100 clients, 10 competitors each, 5,000 pages/competitor:**

```
Without any optimization:
  100 clients × 10 competitors × 5,000 pages = 5,000,000 fetches/month
  Cost: 5M × $0.001 (bandwidth) = $5,000/mo minimum
        + 2% T3 fallback × $0.02 = $2,000/mo
  Total: ~$7,000/mo
```

### 6.2 With Cross-Client Cache (50% overlap)

```
Unique domains: ~400 (60% overlap on popular sites)
Unique pages: 400 × 5,000 = 2,000,000

With cross-client sharing:
  First request: 2,000,000 fetches
  Subsequent: 3,000,000 cache hits (free)
  
Savings: 60% reduction → 2,000,000 fetches
Cost: ~$2,800/mo
```

### 6.3 With Delta Sync (80% unchanged)

```
Of 2,000,000 unique fetches:
  L0 skip (sitemap lastmod): 25% → 500,000 skipped
  L1 skip (304 response): 35% → 525,000 skipped  
  L2 skip (hash unchanged): 20% → 195,000 skipped
  
Full fetches needed: 780,000 (20% of unique)
Cost: ~$560/mo
```

### 6.4 With Common Crawl Fallback (30% coverage)

```
Of 780,000 needed fetches:
  Common Crawl available: 30% → 234,000 (free)
  Fresh fetch required: 546,000
  
Final fetches: 546,000
Cost: ~$390/mo
```

### 6.5 Summary

| Strategy | Fetches | Monthly Cost | Savings |
|----------|---------|--------------|---------|
| No optimization | 5,000,000 | $7,000 | - |
| + Cross-client cache | 2,000,000 | $2,800 | 60% |
| + Delta sync | 780,000 | $560 | 92% |
| + Common Crawl | 546,000 | $390 | 94.4% |
| + Pre-crawl popular | ~350,000 | $250 | **96.4%** |

---

## 7. Implementation Checklist

### Phase 1: Shared Cache Infrastructure (3 days)
- [ ] Add URL normalization utility
- [ ] Create shared Redis cache layer (no tenant prefix)
- [ ] Implement cache key generation
- [ ] Add TTL configuration by use case

### Phase 2: Delta Cascade Enhancement (2 days)
- [ ] Integrate sitemap lastmod into cascade (already exists)
- [ ] Add HTTP 304 support with header caching (already exists)
- [ ] Wire template-aware hash comparison (already exists)
- [ ] Add cascade metrics/monitoring

### Phase 3: External Source Integration (3 days)
- [ ] Common Crawl CDX API client
- [ ] WARC record extraction
- [ ] Wayback Machine fallback (with rate limiting)
- [ ] Freshness threshold configuration

### Phase 4: Cross-Client Sharing (2 days)
- [ ] Remove tenant prefix from HTML cache keys
- [ ] Add cache hit metrics by source
- [ ] Implement cache promotion (DB → Redis)
- [ ] Add manual invalidation endpoint

### Phase 5: Pre-crawl System (2 days)
- [ ] Popular domain list management
- [ ] Scheduled pre-crawl jobs (cron)
- [ ] Pre-crawl cost tracking
- [ ] ROI reporting dashboard

---

## 8. Database Schema Additions

```sql
-- Shared HTML cache (no tenant isolation)
CREATE TABLE shared_html_cache (
  id BIGSERIAL PRIMARY KEY,
  url_hash TEXT NOT NULL UNIQUE,  -- SHA256[:16] of normalized URL
  url TEXT NOT NULL,
  
  -- Content
  html TEXT,                       -- NULL if stored in S3
  s3_key TEXT,                     -- For large content
  content_hash TEXT NOT NULL,      -- Template-aware SEO hash
  html_size_bytes INTEGER,
  
  -- HTTP caching headers
  etag TEXT,
  last_modified TEXT,
  
  -- Metadata
  source TEXT NOT NULL,            -- 'direct', 'common_crawl', 'wayback', 'pre_crawl'
  fetched_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Stats
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shared_html_cache_hash ON shared_html_cache(url_hash);
CREATE INDEX idx_shared_html_cache_expiry ON shared_html_cache(expires_at);
CREATE INDEX idx_shared_html_cache_source ON shared_html_cache(source);

-- Common Crawl index cache (to avoid repeated API calls)
CREATE TABLE common_crawl_index (
  id BIGSERIAL PRIMARY KEY,
  url_hash TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  
  -- Latest available capture
  cc_timestamp TEXT,               -- YYYYMMDDHHMMSS
  cc_digest TEXT,                  -- SHA-1
  cc_filename TEXT,                -- WARC file
  cc_offset BIGINT,
  cc_length INTEGER,
  
  -- Query metadata
  last_checked_at TIMESTAMPTZ NOT NULL,
  found BOOLEAN NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cc_index_hash ON common_crawl_index(url_hash);
CREATE INDEX idx_cc_index_found ON common_crawl_index(found);
```

---

## 9. Environment Variables

```env
# Cache TTLs (seconds)
CACHE_TTL_AUDIT=86400           # 24 hours
CACHE_TTL_COMPETITOR=604800     # 7 days
CACHE_TTL_BACKLINK=2592000      # 30 days
CACHE_TTL_HISTORICAL=7776000    # 90 days

# Common Crawl
CC_ENABLED=true
CC_MAX_AGE_DAYS=30              # Only use if < 30 days old
CC_RATE_LIMIT=10                # Requests per minute

# Wayback Machine
WAYBACK_ENABLED=true
WAYBACK_RATE_LIMIT=50           # Requests per minute (stay under 60)
WAYBACK_FALLBACK_ONLY=true      # Only use when primary fetch fails

# Pre-crawl
PRECRAWL_ENABLED=true
PRECRAWL_TIER1_SCHEDULE="0 0 * * 0"  # Weekly Sunday midnight
PRECRAWL_TIER2_SCHEDULE="0 0 1 * *"  # Monthly 1st

# Metrics
CACHE_METRICS_ENABLED=true
CACHE_HIT_LOG_SAMPLE_RATE=0.01  # Log 1% of cache hits
```

---

## 10. Monitoring & Metrics

### Key Metrics to Track

```typescript
const CACHE_METRICS = {
  // Hit rates by source
  'cache.hit.redis': Counter,
  'cache.hit.postgres': Counter,
  'cache.hit.common_crawl': Counter,
  'cache.hit.wayback': Counter,
  'cache.miss': Counter,
  
  // Delta cascade effectiveness
  'delta.skip.l0': Counter,      // Sitemap lastmod
  'delta.skip.l1': Counter,      // HTTP 304
  'delta.skip.l2': Counter,      // Content hash
  'delta.fetch.l3': Counter,     // Full fetch required
  
  // Cost tracking
  'fetch.cost.t0': Counter,      // Free direct
  'fetch.cost.t1': Counter,      // Free retry
  'fetch.cost.t2': Counter,      // Free proxy
  'fetch.cost.t3': Counter,      // Paid DataForSEO
  
  // Cross-client sharing
  'cache.cross_client.hit': Counter,
  'cache.cross_client.miss': Counter,
  'cache.shared_domains.count': Gauge,
};
```

### Dashboard Alerts

| Metric | Threshold | Action |
|--------|-----------|--------|
| Cache hit rate | < 60% | Investigate TTL or invalidation issues |
| L3 fetch rate | > 30% | Review delta cascade configuration |
| Common Crawl miss rate | > 80% | Expected for niche sites, acceptable |
| Cross-client sharing | < 40% | May indicate low client overlap (normal) |

---

## Sources

- [Common Crawl Index Server](https://index.commoncrawl.org/)
- [Common Crawl CDXJ Index](https://commoncrawl.org/cdxj-index)
- [CDX Index Client (GitHub)](https://github.com/ikreymer/cdx-index-client)
- [MDN: HTTP 304 Not Modified](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/304)
- [MDN: If-None-Match header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match)
- [Wayback Machine APIs](https://archive.org/help/wayback_api.php)
- [Web Archive in 2026 (Archivarix)](https://archivarix.com/en/blog/webarchive-2026/)
- [Google Cache Removal Alternatives (SEOZoom)](https://www.seozoom.com/google-cache-removal-alternatives/)
- [SimHash: The Ultimate Guide](https://spotintelligence.com/2023/01/02/simhash/)
- [Redis Data Isolation in Multi-Tenant SaaS](https://redis.io/blog/data-isolation-multi-tenant-saas/)
- [Azure Managed Redis Multitenancy](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/service/managed-redis)
- [Redis Tenant Isolation with Key Prefixes](https://oneuptime.com/blog/post/2026-01-25-redis-tenant-isolation-key-prefixes/view)
- [Cloudflare Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [XML Sitemaps in 2026](https://twosquares.co.uk/blog/xml-sitemaps)
- [Distributed Web Crawling (ZenRows)](https://www.zenrows.com/blog/distributed-web-crawling)
- [How to Use Cache in Web Scraping (Scrapfly)](https://scrapfly.io/blog/posts/how-to-use-cache-in-web-scraping)
