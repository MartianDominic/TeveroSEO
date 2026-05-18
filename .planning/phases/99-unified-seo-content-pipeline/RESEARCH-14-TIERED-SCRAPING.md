# Research 14: Tiered Scraping Pipeline

**Date:** 2026-05-11  
**Phase:** 99 - Unified SEO Content Pipeline  
**Sources:** COST-OPTIMIZATION-MASTERPLAN.md, TIERED-SCRAPING-ARCHITECTURE.md, WORLD-CLASS-SCRAPING-ARCHITECTURE.md

---

## Executive Summary

The tiered scraping pipeline achieves **97% cost savings** by intelligently routing requests through six escalation tiers (T0-T5) based on per-domain learning. Instead of using expensive browser rendering for all pages ($0.00425/page), the system learns which domains need which tier and remembers that classification for 30 days.

**Key Metrics:**
| Metric | Naive Approach | Optimized | Savings |
|--------|----------------|-----------|---------|
| Cost per 1M pages | $4,250 (DFS Browser) | $118 | **97%** |
| Monthly @ 5M pages | $21,250 | $590 | **97%** |

---

## 1. T0-T5 Escalation Tiers

### Tier Definitions

```
T0: Direct Fetch        -> FREE           -> 60-70% success
    |
    +-- Fails: 429, 403, timeout
    v
T1: Webshare Free DC    -> FREE (1GB/mo)  -> Defeats: IP rate limits
    |
    +-- Fails: DC/ASN detection (Cloudflare)
    v
T2: Geonode Residential -> $0.77/GB       -> Defeats: DC detection, geo-blocks
    |
    +-- Fails: Static content insufficient
    v
T3: DataForSEO Basic    -> $0.000125/pg   -> 60+ on-page params, HTML
    |
    +-- Fails: SPA indicators detected
    v
T4: DataForSEO JS       -> $0.00125/pg    -> Full JS execution
    |
    +-- Fails: CAPTCHA, heavy anti-bot
    v
T5: DataForSEO Browser  -> $0.00425/pg    -> Full browser, anti-bot bypass
```

### What Each Tier Defeats

| Blocking Type | T0 | T1 | T2 | T3 | T4 | T5 |
|---------------|----|----|----|----|----|----|
| Rate Limiting (429) | - | Y | Y | Y | Y | Y |
| IP Blocklist | - | Y | Y | Y | Y | Y |
| DC/ASN Detection | - | - | Y | Y | Y | Y |
| Geo-Restrictions | - | - | Y | Y | Y | Y |
| JS Rendering | - | - | - | - | Y | Y |
| CAPTCHA | - | - | - | - | - | Y |
| Heavy Anti-Bot | - | - | - | - | - | Y |

### Cost Per Tier

| Tier | Method | Cost/Page | Cost/GB |
|------|--------|-----------|---------|
| T0 | Direct fetch | $0 | $0 |
| T1 | Webshare Free DC | $0 | FREE (1GB/mo) |
| T2 | Geonode Residential | $0.0000154 | $0.77 |
| T3 | DataForSEO Basic | $0.000125 | N/A |
| T4 | DataForSEO JS | $0.00125 | N/A |
| T5 | DataForSEO Browser | $0.00425 | N/A |

---

## 2. Per-Domain Learning System

### Database Schema

```sql
CREATE TABLE domain_scrape_config (
  domain TEXT PRIMARY KEY,
  optimal_tier TEXT NOT NULL,        -- 'direct', 'proxy', 'dfs_basic', 'dfs_js', 'dfs_browser'
  proxy_works BOOLEAN DEFAULT TRUE,
  dfs_mode TEXT,                     -- 'basic', 'resources', 'js', 'browser'
  last_tested TIMESTAMPTZ DEFAULT NOW(),
  success_rate DECIMAL(5,2) DEFAULT 100,
  avg_response_time_ms INTEGER,
  avg_page_size_kb INTEGER,
  requires_geo TEXT,                 -- 'US', 'UK', etc. if geo-specific blocking
  escalation_history JSONB,          -- Array of {tier, success, timestamp, error}
  notes TEXT
);

CREATE INDEX idx_domain_tier ON domain_scrape_config(optimal_tier);
CREATE INDEX idx_domain_last_tested ON domain_scrape_config(last_tested);
```

### Learning Algorithm

```typescript
async function learnDomainConfig(domain: string): Promise<DomainConfig> {
  // 1. Check cache (30-day TTL)
  const existing = await db.query.domainScrapeConfig.findFirst({
    where: eq(domainScrapeConfig.domain, domain)
  });
  
  if (existing && existing.lastTested > dayjs().subtract(30, 'days').toDate()) {
    return existing;
  }
  
  // 2. Discovery process - escalate until success
  const testUrl = `https://${domain}/`;
  
  // T0: Direct fetch
  const directResult = await tryDirectFetch(testUrl);
  if (directResult.success && assessContentQuality(directResult.html) > 0.8) {
    return saveConfig(domain, { optimalTier: 'direct' });
  }
  
  // T1: Webshare DC proxy (skip if DC detection likely)
  if (!directResult.dcDetected) {
    const webshareResult = await tryProxyFetch(testUrl, 'webshare');
    if (webshareResult.success && assessContentQuality(webshareResult.html) > 0.8) {
      return saveConfig(domain, { optimalTier: 'webshare' });
    }
  }
  
  // T2: Geonode residential proxy
  const geonodeResult = await tryProxyFetch(testUrl, 'geonode');
  if (geonodeResult.success && assessContentQuality(geonodeResult.html) > 0.8) {
    return saveConfig(domain, { optimalTier: 'geonode' });
  }
  
  // T3: DataForSEO Basic
  const dfsBasicResult = await tryDataForSeo(testUrl, 'basic');
  if (dfsBasicResult.success && assessContentQuality(dfsBasicResult.html) > 0.8) {
    return saveConfig(domain, { optimalTier: 'dfs_basic', dfsMode: 'basic' });
  }
  
  // T4: DataForSEO JS
  const dfsJsResult = await tryDataForSeo(testUrl, 'js');
  if (dfsJsResult.success && assessContentQuality(dfsJsResult.html) > 0.8) {
    return saveConfig(domain, { optimalTier: 'dfs_js', dfsMode: 'js' });
  }
  
  // T5: DataForSEO Browser (nuclear option)
  return saveConfig(domain, { optimalTier: 'dfs_browser', dfsMode: 'browser' });
}
```

### Content Quality Assessment

```typescript
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
  
  return score; // 0.0 - 1.0
}
```

### Cache TTL Strategy

| Domain Attribute | TTL | Rationale |
|------------------|-----|-----------|
| Tier classification | 30 days | Sites rarely change protection |
| Success rate | Rolling 7 days | Detect degradation quickly |
| Escalation history | 90 days | Audit trail |

---

## 3. Technology Classification

### SPA Detection Signals

```typescript
const SPA_INDICATORS = [
  'id="__next"',           // Next.js
  'id="__nuxt"',           // Nuxt
  'id="app"',              // Vue
  'id="root"',             // React
  'ng-app',                // Angular
  'data-reactroot',        // React
  'window.__NUXT__',       // Nuxt hydration
  'window.__NEXT_DATA__',  // Next.js hydration
];

function detectSPA(html: string): boolean {
  const hasIndicator = SPA_INDICATORS.some(i => html.includes(i));
  if (!hasIndicator) return false;
  
  // Check text density - SPA shells have low content
  const textContent = extractTextContent(html);
  const textRatio = textContent.length / html.length;
  
  // SPA if indicators present AND low text content
  return textRatio < 0.05;
}
```

### Escalation Reason Detection

```typescript
function detectEscalationReason(response: Response, html: string): EscalationReason | null {
  // Rate limited
  if (response.status === 429) return 'rate_limited';
  
  // IP blocked / Cloudflare
  if (response.status === 403) {
    if (html.includes('cf-browser-verification') || 
        html.includes('__cf_chl_opt')) {
      return 'dc_detected';
    }
    return 'ip_blocked';
  }
  
  // Bot detection pages
  const botPatterns = [
    'Please verify you are human',
    'Are you a robot',
    'Pardon Our Interruption',
    'detecting automated access',
  ];
  if (botPatterns.some(p => html.includes(p))) return 'bot_detected';
  
  // CAPTCHA
  if (html.includes('g-recaptcha') || html.includes('h-captcha')) {
    return 'captcha';
  }
  
  // SPA detection
  if (detectSPA(html)) return 'js_required';
  
  return null;
}
```

### Expected Distribution

| Domain Type | % of Sites | Optimal Tier | Cost/Page |
|-------------|------------|--------------|-----------|
| Simple static/WordPress | 65% | T0/T2 (Proxy) | $0.000015 |
| Protected but static | 15% | T3 (DFS Basic) | $0.000125 |
| Light SPA (Nuxt, Next SSR) | 12% | T4 (DFS JS) | $0.00125 |
| Heavy SPA (React CSR) | 6% | T4 (DFS JS) | $0.00125 |
| Cloudflare + SPA | 2% | T5 (DFS Browser) | $0.00425 |

**Weighted Average:** $0.000339/page

---

## 4. Cost Optimization Strategies

### 4.1 The 98/2 Split Principle

**Core Insight:** 98% of pages work with simple HTTP fetch + proxy. Only 2% need browser rendering.

| Method | % of Sites | Cost/Page | Weighted Cost |
|--------|------------|-----------|---------------|
| HTTP (T0-T2) | 80% | $0.000015 | $0.000012 |
| DFS Basic (T3) | 10% | $0.000125 | $0.0000125 |
| DFS JS (T4) | 8% | $0.00125 | $0.0001 |
| DFS Browser (T5) | 2% | $0.00425 | $0.000085 |
| **Total** | 100% | | **$0.000210** |

vs all DFS Browser: $0.00425/page = **95% savings**

### 4.2 Bandwidth Optimization

```typescript
// Always request compression
const response = await fetch(url, {
  headers: { 'Accept-Encoding': 'br, gzip, deflate' }
});
```

| Optimization | Bandwidth Reduction |
|--------------|---------------------|
| Brotli compression | 82% |
| Conditional GET (304) | 50% of repeat crawls |
| Cache hits | 30% |
| Free APIs (CrUX, GSC) | 40% of data needs |

**Combined:** 96%+ bandwidth savings

### 4.3 Free API Integration

Replace scraping with free APIs where possible:

| Data Type | Free Source | Rate Limit |
|-----------|-------------|------------|
| Core Web Vitals | CrUX API | 150 req/min |
| Indexation status | GSC URL Inspection | 2,000/day/site |
| Lighthouse scores | PageSpeed Insights | 25,000/day |
| Title/Meta (historical) | Common Crawl WAT | Unlimited |
| Domain Authority | Open PageRank | 4.3M domains/day |

### 4.4 Multi-Tenant Cache Sharing

```typescript
// Shared cache key for public HTML (no tenant prefix)
const htmlCacheKey = `html:${sha256(normalizeUrl(url)).slice(0, 16)}`;

// Tenant-specific analysis results
const analysisKey = `analysis:${tenantId}:${urlHash}`;
```

**Cross-client savings:** ~30% from overlapping competitor analysis

---

## 5. Complete Cost Model

### Per-Page Breakdown

| Component | Method | Cost/Page |
|-----------|--------|-----------|
| CWV data | CrUX API | $0 |
| Indexation | GSC API (owned) | $0 |
| Title/Meta | Cache hit (30%) | $0 |
| Title/Meta | Common Crawl (20%) | $0 |
| Title/Meta | Proxy scrape (35%) | $0.000015 |
| Title/Meta | DFS Basic (10%) | $0.000125 |
| Title/Meta | DFS JS/Browser (5%) | $0.002 |
| **Weighted HTML cost** | | **$0.000118** |

### Monthly Cost at Scale

| Volume | Naive (DFS Browser) | Optimized | Savings |
|--------|---------------------|-----------|---------|
| 10,000 pages | $42.50 | $1.18 | 97% |
| 100,000 pages | $425 | $11.80 | 97% |
| 1,000,000 pages | $4,250 | $118 | 97% |
| 10,000,000 pages | $42,500 | $1,180 | 97% |

### Infrastructure Budget

| Component | Provider | Monthly |
|-----------|----------|---------|
| Orchestration server | Contabo VPS (8 vCPU, 24GB) | $13 |
| Redis cache | Included in VPS | $0 |
| Proxy budget | Geonode 50GB | $38.50 |
| DataForSEO budget | On-demand | ~$50 |
| **Total** | | **~$101.50/mo** |

**Capacity:** ~5M pages/month

---

## 6. Implementation Architecture

### TieredFetcher Class

```typescript
interface FetchResult {
  success: boolean;
  html?: string;
  tier: FetchTier;
  cost: number;
  escalationReason?: EscalationReason;
  responseTime: number;
}

class TieredFetcher {
  async fetch(url: string): Promise<FetchResult> {
    const domain = new URL(url).hostname;
    
    // Get learned tier for domain
    const config = await this.getDomainConfig(domain);
    let currentTier = config?.optimalTier ?? FetchTier.DIRECT;
    
    while (currentTier <= FetchTier.DFS_BROWSER) {
      const result = await this.attemptFetch(url, currentTier);
      
      if (result.success && assessContentQuality(result.html!) > 0.8) {
        // Update domain config if we found a better tier
        if (!config || currentTier < config.optimalTier) {
          await this.updateDomainConfig(domain, currentTier);
        }
        return result;
      }
      
      // Escalate
      const nextTier = this.decideNextTier(currentTier, result.escalationReason);
      if (!nextTier) break;
      currentTier = nextTier;
    }
    
    return { success: false, tier: currentTier, cost: 0, responseTime: 0 };
  }
}
```

### Queue Integration (BullMQ)

```typescript
// Per-domain rate limiting
const queue = new Queue('scrape', {
  defaultJobOptions: {
    rateLimiter: {
      max: 1,
      duration: 2000  // 1 req per 2 seconds per domain
    }
  }
});

// Group jobs by domain
await queue.add('scrape', { url }, {
  group: { id: new URL(url).hostname }
});
```

### Singleflight Pattern

```typescript
const inFlight = new Map<string, Promise<FetchResult>>();

async function fetchWithDedup(url: string): Promise<FetchResult> {
  const key = normalizeUrl(url);
  
  if (inFlight.has(key)) {
    return inFlight.get(key)!;
  }
  
  const promise = tieredFetcher.fetch(url).finally(() => {
    inFlight.delete(key);
  });
  
  inFlight.set(key, promise);
  return promise;
}
```

---

## 7. Key Decisions for Phase 99

### Recommended Approach

1. **Start with proxy tiers (T0-T2)** - 80% of pages, near-free
2. **Learn domain requirements** - Build classification database over time
3. **Use DataForSEO pre-parsed data** - 60% of SEO checks don't need HTML parsing
4. **Implement aggressive caching** - Multi-tenant shared cache, 24h TTL
5. **Integrate free APIs first** - CrUX, GSC, PageSpeed before scraping

### Environment Variables

```env
# Proxy providers
WEBSHARE_API_KEY=xxx
GEONODE_USERNAME=xxx
GEONODE_PASSWORD=xxx

# DataForSEO
DATAFORSEO_LOGIN=xxx
DATAFORSEO_PASSWORD=xxx

# Rate limits
CRAWL_RATE_LIMIT_PER_DOMAIN=2
CRAWL_MAX_CONCURRENT_DOMAINS=50

# Cost alerts
CRAWL_COST_ALERT_THRESHOLD=10.00
CRAWL_T5_PERCENT_ALERT=5
```

### Monitoring Metrics

- Tier distribution (% T0, T1, T2, T3, T4, T5)
- Cost per crawl job
- Escalation reason breakdown
- Domain classification cache hit rate
- Alert on T5 usage > 5%

---

## References

- `/home/dominic/Documents/TeveroSEO/.planning/phases/92-on-page-seo-mastery/COST-OPTIMIZATION-MASTERPLAN.md`
- `/home/dominic/Documents/TeveroSEO/.planning/phases/92-on-page-seo-mastery/TIERED-SCRAPING-ARCHITECTURE.md`
- `/home/dominic/Documents/TeveroSEO/.planning/research/WORLD-CLASS-SCRAPING-ARCHITECTURE.md`
