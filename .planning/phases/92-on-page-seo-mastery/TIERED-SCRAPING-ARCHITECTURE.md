# Tiered Scraping Architecture

**Date:** 2026-05-07  
**Purpose:** Define the complete scraping strategy for prospect discovery and client audits with cost-optimized proxy escalation.

---

## Executive Summary

Two distinct workflows require different scraping strategies:

| Workflow | Volume | Requests/Site | Proxy Needed? | Cost |
|----------|--------|---------------|---------------|------|
| Prospect Discovery | 100 sites/hr | 3-10 | **No** | FREE |
| Client Full Audit | 1 site, 5k pages | 100-5,000 | **Maybe** | $0-$100 |

---

## 1. Proxy Tier Architecture

### 1.1 Three-Tier Escalation Chain

```
T0: Direct Fetch        → FREE      → 60-70% success rate
    │
    ├── Fails: 429, 403, timeout
    ▼
T1: Webshare Free DC    → FREE      → Defeats: IP rate limits, basic blocks
    │                     (10 IPs, 1GB/mo)
    ├── Fails: DC/ASN detection (Cloudflare)
    ▼
T2: Geonode Residential → $1/GB     → Defeats: DC detection, geo-blocks
    │
    ├── Fails: JS rendering required
    ▼
T3: DataForSEO OnPage   → $0.02/pg  → Defeats: Everything (browser rendering)
```

### 1.2 What Each Tier Defeats

| Blocking Type | T0 Direct | T1 Webshare | T2 Geonode | T3 DataForSEO |
|---------------|-----------|-------------|------------|---------------|
| Rate Limiting (429) | ❌ | ✅ | ✅ | ✅ |
| IP Blocklist | ❌ | ✅ | ✅ | ✅ |
| DC/ASN Detection | ❌ | ❌ | ✅ | ✅ |
| Geo-Restrictions | ❌ | ❌ | ✅ | ✅ |
| JS Rendering | ❌ | ❌ | ❌ | ✅ |
| CAPTCHA | ❌ | ❌ | ❌ | ✅ |

### 1.3 Cost Comparison

| Scenario | All DataForSEO | Tiered Approach | Savings |
|----------|----------------|-----------------|---------|
| 5,000 pages | $100.00 | $2.00 | **98%** |
| 50,000 pages | $1,000.00 | $20.00 | **98%** |
| Monthly (150k) | $3,000.00 | $60.00 | **98%** |

---

## 2. IP Blacklisting Risk Analysis

### 2.1 When Direct Fetch Is Safe

| Scenario | Risk Level | Explanation |
|----------|------------|-------------|
| Client's own site (with permission) | **ZERO** | You're authorized |
| Any site @ 1-2 req/s | **LOW** | Looks like normal browsing |
| 100 different domains/hr | **ZERO** | 0.14 req/s average |
| Same domain @ 10+ req/s | **HIGH** | Triggers anti-bot |

### 2.2 What Actually Blacklists Your Server IP

```
Action                              → Consequence
────────────────────────────────────────────────────────────────
>10 req/s to same domain            → CDN rate limit (429)
Ignoring robots.txt Crawl-Delay     → Domain-level block
Triggering Cloudflare 5x in a row   → IP flagged in CF database
Hitting honeypot URLs               → Added to Spamhaus
Hosting provider TOS violation      → Account warning
```

### 2.3 Safe Crawl Configuration

```typescript
const SAFE_CRAWL_CONFIG = {
  rateLimit: 1.5,              // req/second per domain
  userAgent: 'TeveroSEO/1.0 (+https://tevero.io/bot; contact@tevero.io)',
  respectRobotsTxt: true,
  honorCrawlDelay: true,
  maxConcurrentDomains: 10,
  retryOn429: true,
  maxRetries: 2,
};
```

**With these settings, direct fetch will never get blacklisted.**

---

## 3. Two-Phase Workflow Architecture

### 3.1 Phase 1: Prospect Discovery (100 sites/hr)

**Always direct fetch — no proxies needed.**

```
Input: prospect_domain.com
                │
                ▼
┌─────────────────────────────────────┐
│  1. Fetch /robots.txt               │  ← 1 request
│     └── Extract Sitemap: directives │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  2. Try sitemap locations           │  ← 1-5 requests
│     ├── /sitemap.xml                │
│     ├── /sitemap_index.xml          │
│     ├── /sitemap-index.xml          │
│     └── /sitemaps/sitemap.xml       │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  3. Parse sitemap (if found)        │  ← 0-5 requests
│     └── Handle sitemap index        │
└─────────────────────────────────────┘
                │
                ▼
Output: ProspectDiscovery {
  domain: "example.com",
  sitemapFound: true,
  urlCount: 2340,
  lastModified: "2026-05-05",
  siteHealth: "healthy"
}

Total: 3-10 requests per prospect
Rate: 500-1000 requests/hr across 100 domains
Risk: ZERO (0.14 req/s average)
```

### 3.2 Phase 2: Client Full Audit

**Tiered escalation with per-domain memory.**

```
Input: client_domain.com (5,000 pages to audit)
                │
                ▼
┌─────────────────────────────────────┐
│  Check Domain Tier Cache            │
│  └── "client_domain.com" → T0       │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  Fetch with current tier            │
│                                     │
│  T0: Direct fetch                   │
│      ├── Success → Store, continue  │
│      └── Fail → Detect reason       │
│                                     │
│  Escalation triggers:               │
│  ├── 429 → Try T1 (Webshare)        │
│  ├── 403 → Try T1 (Webshare)        │
│  ├── DC detected → Skip to T2       │
│  └── JS needed → Skip to T3         │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  Update Domain Tier Cache           │
│  └── Remember minimum working tier  │
└─────────────────────────────────────┘
```

---

## 4. No Sitemap Fallback: Link Discovery Crawl

When a site has no sitemap, we must discover URLs by crawling.

### 4.1 Link Discovery Strategy

```
1. Start with homepage
   └── GET / → Extract all internal links

2. BFS crawl with depth limit
   ├── Depth 1: Homepage links (~50 URLs)
   ├── Depth 2: Second-level pages (~500 URLs)
   ├── Depth 3: Third-level pages (~2000 URLs)
   └── Depth 4+: Diminishing returns

3. URL deduplication
   ├── Normalize URLs (trailing slash, query params)
   ├── Skip pagination (/page/2, ?p=3)
   ├── Skip filters (/products?color=red)
   └── Skip anchors (#section)

4. Pattern-based discovery
   ├── Common paths: /blog/, /products/, /services/
   └── Directory enumeration (careful, can trigger blocks)
```

### 4.2 Link Discovery Implementation

```typescript
interface LinkDiscoveryConfig {
  maxDepth: number;           // Default: 3
  maxPages: number;           // Default: 1000
  includePatterns: RegExp[];  // [/\/blog\//, /\/products\//]
  excludePatterns: RegExp[];  // [/\/tag\//, /\/page\/\d+/]
  respectRobots: boolean;     // Default: true
  rateLimit: number;          // Default: 2 req/s
}

interface DiscoveredUrl {
  url: string;
  depth: number;
  foundOn: string;            // Parent URL
  linkText: string;
  isNavigation: boolean;      // Found in nav/header/footer
}

async function discoverLinks(
  startUrl: string,
  config: LinkDiscoveryConfig
): Promise<DiscoveredUrl[]> {
  const queue: DiscoveredUrl[] = [{ url: startUrl, depth: 0, ... }];
  const visited = new Set<string>();
  const discovered: DiscoveredUrl[] = [];

  while (queue.length > 0 && discovered.length < config.maxPages) {
    const current = queue.shift()!;
    
    if (visited.has(current.url)) continue;
    if (current.depth > config.maxDepth) continue;
    
    visited.add(current.url);
    
    // Fetch with tiered escalation
    const result = await tieredFetch(current.url);
    if (!result.success) continue;
    
    // Extract links with cheerio
    const $ = cheerio.load(result.html);
    const links = extractInternalLinks($, current.url);
    
    // Filter and queue
    for (const link of links) {
      if (shouldInclude(link, config)) {
        queue.push({
          url: link.href,
          depth: current.depth + 1,
          foundOn: current.url,
          linkText: link.text,
          isNavigation: link.inNav,
        });
      }
    }
    
    discovered.push(current);
    await rateLimiter.wait();
  }

  return discovered;
}
```

### 4.3 Sitemap vs Link Discovery Comparison

| Aspect | Sitemap Discovery | Link Discovery |
|--------|-------------------|----------------|
| Requests | 3-10 | 100-1000+ |
| Time | 2-5 seconds | 1-10 minutes |
| Coverage | URLs publisher wants indexed | All discoverable URLs |
| Freshness | lastmod available | Unknown |
| Risk | Zero | Low-Moderate |
| Cost | Free | May need proxies |

### 4.4 Hybrid Approach (Recommended)

```
1. Try sitemap first (always)
   ├── Found → Use sitemap URLs
   └── Not found → Fall back to link discovery

2. Supplement sitemap with link discovery
   └── Find orphan pages not in sitemap

3. Compare sitemap vs discovered
   └── Flag discrepancies (sitemap says 5k, found 2k)
```

---

## 5. Proxy Provider Configuration

### 5.1 Webshare Free Tier

```
Plan: Free
IPs: 10 datacenter proxies
Bandwidth: 1GB/month
Locations: US, EU
Auth: Username:Password

Endpoint: proxy.webshare.io:PORT
Rotation: Per-request or sticky

Limits:
- 10 concurrent connections
- 1GB/month (resets monthly)
- DC IPs only (will fail on CF detection)
```

### 5.2 Geonode Residential

```
Plan: Starter ($1/GB minimum)
IPs: 2M+ residential pool
Bandwidth: Pay-as-you-go
Locations: 195 countries
Auth: Username:Password

Endpoint: rotating.geonode.com:PORT
Rotation: Per-request or sticky sessions

Pricing:
- Starter: $1.00/GB
- Growth: $0.80/GB
- Scale: $0.60/GB

Features:
- Residential IPs (defeats DC detection)
- Geo-targeting (country/city)
- Session persistence (optional)
```

### 5.3 DataForSEO OnPage

```
API: https://api.dataforseo.com/v3/on_page/
Auth: Base64(login:password)

Pricing: $0.02 per page

Features:
- Full browser rendering
- JS execution
- CAPTCHA handling
- Guaranteed delivery
- Resale-legal data
```

---

## 6. Domain Tier Memory

### 6.1 Cache Schema

```typescript
interface DomainTierCache {
  domain: string;
  minimumTier: FetchTier;      // Start here next time
  lastUpdated: Date;
  history: {
    tier: FetchTier;
    success: boolean;
    timestamp: Date;
    error?: string;
  }[];
}

// Redis key: domain_tier:{domain}
// TTL: 7 days (sites can change protection)
```

### 6.2 Escalation Logic

```typescript
function getStartingTier(domain: string): FetchTier {
  const cached = await redis.get(`domain_tier:${domain}`);
  
  if (!cached) return FETCH_TIERS.DIRECT; // New domain, start at T0
  
  // If cache is >7 days old, retry from T0
  if (Date.now() - cached.lastUpdated > 7 * 24 * 60 * 60 * 1000) {
    return FETCH_TIERS.DIRECT;
  }
  
  return cached.minimumTier;
}

function decideNextTier(
  currentTier: FetchTier,
  failureReason: EscalationReason
): FetchTier | null {
  switch (failureReason) {
    case 'rate_limited':
    case 'ip_blocked':
      // Try next tier up
      return currentTier < FETCH_TIERS.DATAFORSEO 
        ? currentTier + 1 
        : null;
    
    case 'dc_detected':
      // Skip DC tiers, go straight to residential
      return FETCH_TIERS.GEONODE_RESIDENTIAL;
    
    case 'js_required':
    case 'captcha':
      // Need browser rendering
      return FETCH_TIERS.DATAFORSEO;
    
    case 'bot_detected':
      // Could be anything, try residential first
      return currentTier < FETCH_TIERS.GEONODE_RESIDENTIAL
        ? FETCH_TIERS.GEONODE_RESIDENTIAL
        : FETCH_TIERS.DATAFORSEO;
    
    default:
      return currentTier + 1;
  }
}
```

---

## 7. Cost Tracking

### 7.1 Per-Request Cost Calculation

```typescript
function calculateRequestCost(
  tier: FetchTier,
  bytesTransferred: number
): number {
  const config = TIER_CONFIGS[tier];
  
  if (config.costPerRequest > 0) {
    return config.costPerRequest;
  }
  
  if (config.costPerGB > 0) {
    const gb = bytesTransferred / (1024 * 1024 * 1024);
    return gb * config.costPerGB;
  }
  
  return 0; // Free tier
}
```

### 7.2 Crawl Job Cost Summary

```typescript
interface CrawlCostSummary {
  jobId: string;
  domain: string;
  totalPages: number;
  byTier: {
    [tier: number]: {
      pages: number;
      bytes: number;
      cost: number;
    };
  };
  totalCost: number;
  averageCostPerPage: number;
}
```

---

## 8. Error Detection Patterns

### 8.1 Escalation Reason Detection

```typescript
function detectEscalationReason(
  response: Response,
  html: string
): EscalationReason | null {
  // Rate limited
  if (response.status === 429) {
    return 'rate_limited';
  }
  
  // IP blocked
  if (response.status === 403) {
    // Check for specific block pages
    if (html.includes('Access Denied') || 
        html.includes('blocked') ||
        html.includes('banned')) {
      return 'ip_blocked';
    }
    
    // Cloudflare DC detection
    if (html.includes('Attention Required') ||
        html.includes('cf-browser-verification') ||
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
    'We want to make sure it is actually you',
    'detecting automated access',
  ];
  if (botPatterns.some(p => html.includes(p))) {
    return 'bot_detected';
  }
  
  // CAPTCHA
  if (html.includes('g-recaptcha') ||
      html.includes('h-captcha') ||
      html.includes('captcha-container')) {
    return 'captcha';
  }
  
  // SPA detection (needs JS rendering)
  if (detectSPA(html)) {
    return 'js_required';
  }
  
  // Empty response (bot trap or error)
  const textContent = extractTextContent(html);
  if (textContent.length < 100 && !html.includes('<title>')) {
    return 'empty_response';
  }
  
  return null; // No escalation needed
}
```

### 8.2 SPA Detection

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
  
  // Check text density
  const textContent = extractTextContent(html);
  const textRatio = textContent.length / html.length;
  
  // SPA if indicators present AND low text content
  // (Real content is loaded via JS)
  return textRatio < 0.05;
}
```

---

## 9. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `TieredFetcher` class
- [ ] Implement escalation detection
- [ ] Add domain tier cache (Redis)
- [ ] Create cost tracker

### Phase 2: Proxy Integrations
- [ ] Webshare free proxy pool
- [ ] Geonode residential integration
- [ ] DataForSEO fetcher (existing)

### Phase 3: Discovery Services
- [ ] `SitemapDiscoveryService` (direct only)
- [ ] `LinkDiscoveryService` (tiered)
- [ ] Hybrid discovery orchestrator

### Phase 4: Monitoring
- [ ] Tier distribution metrics
- [ ] Cost per crawl job
- [ ] Escalation reason breakdown
- [ ] Alert on high T3 usage

---

## 10. Environment Variables

```env
# Webshare (Free tier)
WEBSHARE_API_KEY=your_api_key

# Geonode Residential
GEONODE_USERNAME=your_username
GEONODE_PASSWORD=your_password

# DataForSEO (existing)
DATAFORSEO_API_KEY=base64_login_password

# Crawl Configuration
CRAWL_RATE_LIMIT_PER_DOMAIN=2
CRAWL_MAX_DEPTH=3
CRAWL_MAX_PAGES=5000
CRAWL_TIMEOUT_MS=15000

# Cost Alerts
CRAWL_COST_ALERT_THRESHOLD=10.00
CRAWL_T3_PERCENT_ALERT=20
```
