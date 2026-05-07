# Plan 95-01: TieredFetcher + Domain Learning System

**Status:** Planning  
**Effort:** 1.5 weeks  
**Priority:** P0 (Foundation for all other plans)

---

## Goal

Implement the cost-optimized tiered fetcher that automatically discovers and remembers the cheapest working tier for each domain.

---

## Current State

```typescript
// DEFINED in types.ts but NOT IMPLEMENTED:
export const FETCH_TIERS = {
  DIRECT: 0,        // ✗ Basic fetch exists, no retry logic
  WEBSHARE_DC: 1,   // ✗ Not implemented
  GEONODE_RESIDENTIAL: 2,  // ✗ Not implemented
  DATAFORSEO: 3,    // ✓ Implemented but used for ALL fetches
} as const;
```

**Current flow:**
1. Try direct fetch
2. If fails → DataForSEO at $0.02/page
3. No learning, no caching, no escalation

---

## Target State

```
For each URL:
├── Check cache (L1 → L2 → L3)
│   └── HIT: Return cached HTML
│
├── MISS: Check domain_scrape_configs
│   ├── Known domain: Use optimal_tier directly
│   └── Unknown domain: Discovery process
│
├── DISCOVERY (new domains):
│   ├── T0: Direct fetch ($0)
│   │   └── Success (200, content OK)? → Save tier, done
│   ├── T1: Webshare DC proxy ($0)
│   │   └── Success? → Save tier, done
│   ├── T2: Geonode Residential fetch ($0.77/GB)
│   │   └── Success? → Save tier, done
│   ├── T2.5: Camoufox + Geonode ($0.77/GB) ← NEW
│   │   └── Stealth browser bypasses fingerprinting? → Save tier, done
│   ├── T3: DataForSEO Basic ($0.000125/pg)
│   │   └── Content quality OK? → Save tier, done
│   ├── T4: DataForSEO JS ($0.00125/pg)
│   │   └── Content quality OK? → Save tier, done
│   └── T5: DataForSEO Browser ($0.00425/pg)
│       └── Always works → Save tier, done
│
└── Return HTML + metadata
```

### Tier Decision Matrix

| Failure Type | From Tier | Skip To |
|--------------|-----------|---------|
| IP rate limit (429) | T0 | T1 |
| DC/ASN blocked (403 Cloudflare) | T1 | T2 |
| Fingerprint detection | T2 | T2.5 (Camoufox) |
| JS challenge / CAPTCHA | T2.5 | T3 |
| Empty SPA shell | T3 | T4 |
| Heavy anti-bot | T4 | T5 |

---

## Database Schema

```typescript
// src/db/domain-scrape-schema.ts
import { pgTable, text, integer, real, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const domainScrapeConfigs = pgTable('domain_scrape_configs', {
  // Primary key
  domain: text('domain').primaryKey(), // Normalized: "example.com"
  
  // Optimal tier (learned)
  optimalTier: text('optimal_tier').notNull()
    .$type<'direct' | 'webshare' | 'geonode' | 'dfs_basic' | 'dfs_js' | 'dfs_browser'>(),
  
  // Success tracking
  successCount: integer('success_count').default(0).notNull(),
  failureCount: integer('failure_count').default(0).notNull(),
  consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
  successRate: real('success_rate').default(100).notNull(),
  
  // Performance metrics
  avgResponseTimeMs: integer('avg_response_time_ms'),
  avgPageSizeBytes: integer('avg_page_size_bytes'),
  p95ResponseTimeMs: integer('p95_response_time_ms'),
  
  // Technology detection
  primaryTechnology: text('primary_technology'), // 'wordpress', 'shopify', 'react', etc.
  hasAntiBot: boolean('has_anti_bot').default(false),
  requiresJs: boolean('requires_js').default(false),
  
  // Geo requirements (some sites block non-US IPs)
  geoRequirement: text('geo_requirement'), // 'US', 'UK', null
  
  // Timestamps
  discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
  lastTestedAt: timestamp('last_tested_at').defaultNow().notNull(),
  lastSuccessAt: timestamp('last_success_at'),
  lastFailureAt: timestamp('last_failure_at'),
  nextRevalidationAt: timestamp('next_revalidation_at'),
}, (table) => ({
  tierIdx: index('idx_domain_tier').on(table.optimalTier),
  revalidationIdx: index('idx_revalidation').on(table.nextRevalidationAt),
}));

// History for debugging (optional, auto-pruned after 30 days)
export const domainScrapeHistory = pgTable('domain_scrape_history', {
  id: serial('id').primaryKey(),
  domain: text('domain').notNull(),
  tier: text('tier').notNull(),
  success: boolean('success').notNull(),
  statusCode: integer('status_code'),
  responseTimeMs: integer('response_time_ms'),
  pageSizeBytes: integer('page_size_bytes'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  domainIdx: index('idx_history_domain').on(table.domain),
  createdIdx: index('idx_history_created').on(table.createdAt),
}));
```

---

## Service Interface

```typescript
// src/server/features/scraping/types.ts

export type FetchTier = 'direct' | 'webshare' | 'geonode' | 'camoufox' | 'dfs_basic' | 'dfs_js' | 'dfs_browser';

export const TIER_ORDER: FetchTier[] = ['direct', 'webshare', 'geonode', 'camoufox', 'dfs_basic', 'dfs_js', 'dfs_browser'];

export const TIER_COSTS: Record<FetchTier, { perRequest: number; perGB: number }> = {
  direct: { perRequest: 0, perGB: 0 },
  webshare: { perRequest: 0, perGB: 0 },
  geonode: { perRequest: 0, perGB: 0.77 },
  camoufox: { perRequest: 0, perGB: 0.77 },  // Same bandwidth cost, browser overhead
  dfs_basic: { perRequest: 0.000125, perGB: 0 },
  dfs_js: { perRequest: 0.00125, perGB: 0 },
  dfs_browser: { perRequest: 0.00425, perGB: 0 },
};

export const TIER_TIMEOUTS: Record<FetchTier, number> = {
  direct: 5000,      // 5s - fast path
  webshare: 8000,    // 8s - DC proxy overhead
  geonode: 12000,    // 12s - residential routing
  camoufox: 20000,   // 20s - full browser render
  dfs_basic: 30000,  // 30s - API queue
  dfs_js: 30000,
  dfs_browser: 30000,
};

export interface FetchOptions {
  /** Skip tier learning, use this tier */
  forceTier?: FetchTier;
  
  /** Skip cache lookup */
  skipCache?: boolean;
  
  /** Timeout override (ms) */
  timeoutMs?: number;
  
  /** Include raw HTML in response */
  includeHtml?: boolean;
  
  /** Include DFS pre-parsed data if available */
  includeParsedData?: boolean;
  
  /** Custom headers */
  headers?: Record<string, string>;
  
  /** Tracking: client ID for cost attribution */
  clientId?: string;
  
  /** Tracking: job ID for correlation */
  jobId?: string;
}

export interface FetchResult {
  url: string;
  success: boolean;
  
  // Content
  html?: string;
  parsedData?: DataForSEOPageData;
  
  // Metadata
  statusCode: number;
  tierUsed: FetchTier;
  fromCache: boolean;
  cacheLevel?: 'L1' | 'L2' | 'L3' | 'L4';
  
  // Performance
  responseTimeMs: number;
  pageSizeBytes: number;
  
  // Cost
  estimatedCost: number;
  
  // Error info
  error?: string;
  blocked?: boolean;
  requiresJs?: boolean;
}

export interface DataForSEOPageData {
  title: string;
  metaDescription: string;
  canonical: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  internalLinks: { url: string; anchor: string }[];
  externalLinks: { url: string; anchor: string }[];
  images: { src: string; alt: string }[];
  structuredData: object[];
  loadTimeMs: number;
}
```

---

## TieredFetcher Implementation

```typescript
// src/server/features/scraping/TieredFetcher.ts

export class TieredFetcher {
  constructor(
    private domainLearning: DomainLearningService,
    private cache: CacheManager,
    private rateLimiter: RateLimiter,
    private providers: {
      direct: DirectFetcher;
      webshare: WebshareFetcher;
      geonode: GeonodeFetcher;
      dataForSeo: DataForSEOFetcher;
    }
  ) {}

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const domain = extractDomain(url);
    const startTime = Date.now();
    
    // 1. Check cache first (unless skipCache)
    if (!options.skipCache) {
      const cached = await this.cache.get(url);
      if (cached) {
        return {
          url,
          success: true,
          html: options.includeHtml ? cached.html : undefined,
          parsedData: options.includeParsedData ? cached.parsedData : undefined,
          statusCode: 200,
          tierUsed: 'direct',
          fromCache: true,
          cacheLevel: cached.level,
          responseTimeMs: Date.now() - startTime,
          pageSizeBytes: cached.html?.length || 0,
          estimatedCost: 0,
        };
      }
    }
    
    // 2. Rate limit check
    await this.rateLimiter.acquire(domain);
    
    // 3. Get optimal tier for domain
    const tier = options.forceTier || await this.domainLearning.getOptimalTier(domain);
    
    // 4. Fetch with tier (or discover if unknown)
    let result: FetchResult;
    if (tier) {
      result = await this.fetchWithTier(url, tier, options);
    } else {
      result = await this.discoverAndFetch(url, domain, options);
    }
    
    // 5. Cache successful results
    if (result.success && result.html) {
      await this.cache.set(url, {
        html: result.html,
        parsedData: result.parsedData,
        fetchedAt: new Date(),
        tierUsed: result.tierUsed,
      });
    }
    
    // 6. Update domain learning
    await this.domainLearning.recordAttempt(domain, {
      tier: result.tierUsed,
      success: result.success,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      pageSizeBytes: result.pageSizeBytes,
      error: result.error,
    });
    
    return result;
  }

  private async discoverAndFetch(
    url: string, 
    domain: string, 
    options: FetchOptions
  ): Promise<FetchResult> {
    // Try tiers in order of cost
    const tiers: FetchTier[] = ['direct', 'webshare', 'geonode', 'dfs_basic', 'dfs_js', 'dfs_browser'];
    
    for (const tier of tiers) {
      const result = await this.fetchWithTier(url, tier, options);
      
      if (this.isSuccessful(result)) {
        // Save learned tier
        await this.domainLearning.setOptimalTier(domain, tier);
        return result;
      }
      
      // Check if we should continue or skip to DFS
      if (result.blocked && tier === 'geonode') {
        // Skip to DFS tiers
        continue;
      }
      
      if (result.requiresJs && tier === 'dfs_basic') {
        // Skip to JS rendering
        continue;
      }
    }
    
    // Should never reach here (dfs_browser always works)
    throw new Error(`Failed to fetch ${url} with all tiers`);
  }

  private isSuccessful(result: FetchResult): boolean {
    if (!result.success) return false;
    if (!result.html || result.html.length < 1000) return false;
    
    // Check for SPA shell (empty body)
    if (result.html.includes('<div id="root"></div>') && result.html.length < 5000) {
      return false;
    }
    
    // Check for Cloudflare challenge
    if (result.html.includes('cf-browser-verification')) {
      return false;
    }
    
    return true;
  }
}
```

---

## Proxy Provider Implementations

### Geonode Integration

```typescript
// src/server/features/scraping/providers/GeonodeFetcher.ts

export class GeonodeFetcher {
  // Current endpoint (2026) - use proxy.geonode.io
  private readonly hostname: string;
  private readonly port: number;
  
  constructor(private config: {
    hostname: string;  // proxy.geonode.io
    port: number;      // 9000 (rotating) or 10000 (sticky)
    username: string;  // geonode_XXXXX-type-residential (includes proxy type)
    password: string;  // UUID format API key
  }) {
    this.hostname = config.hostname;
    this.port = config.port;
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const startTime = Date.now();
    const proxyAuth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    
    try {
      const response = await fetch(url, {
        headers: {
          'Proxy-Authorization': `Basic ${proxyAuth}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'br, gzip, deflate',
          ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(options.timeoutMs || 30000),
        // @ts-expect-error - proxy support via undici
        dispatcher: new ProxyAgent(this.baseUrl),
      });
      
      const html = await response.text();
      
      return {
        url,
        success: response.ok,
        html,
        statusCode: response.status,
        tierUsed: 'geonode',
        fromCache: false,
        responseTimeMs: Date.now() - startTime,
        pageSizeBytes: html.length,
        estimatedCost: this.estimateCost(html.length),
        blocked: response.status === 403 || response.status === 429,
      };
    } catch (error) {
      return {
        url,
        success: false,
        statusCode: 0,
        tierUsed: 'geonode',
        fromCache: false,
        responseTimeMs: Date.now() - startTime,
        pageSizeBytes: 0,
        estimatedCost: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private estimateCost(bytes: number): number {
    // Geonode: $0.77/GB (50GB plan)
    return (bytes / 1_000_000_000) * 0.77;
  }
}
```

### Webshare Free DC

```typescript
// src/server/features/scraping/providers/WebshareFetcher.ts

export class WebshareFetcher {
  constructor(private config: {
    apiKey: string;
  }) {}

  async getProxyList(): Promise<string[]> {
    // Webshare provides 10 free DC proxies per month
    const response = await fetch('https://proxy.webshare.io/api/v2/proxy/list/', {
      headers: { 'Authorization': `Token ${this.config.apiKey}` },
    });
    const data = await response.json();
    return data.results.map((p: any) => `${p.proxy_address}:${p.port}`);
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const proxies = await this.getProxyList();
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    
    // Similar implementation to GeonodeFetcher
    // Cost: $0 (free tier, 1GB/month)
  }
}
```

### Camoufox Stealth Browser (T2.5)

```typescript
// src/server/features/scraping/providers/CamoufoxFetcher.ts

import { Camoufox } from 'camoufox-js';
import type { Browser, Page } from 'playwright-core';

interface CamoufoxPoolConfig {
  maxInstances: number;           // 15-20 for 24GB RAM
  maxRequestsPerInstance: number; // 100
  maxAgeMs: number;               // 30 * 60 * 1000 (30 min)
}

interface PooledBrowser {
  browser: Browser;
  requestCount: number;
  createdAt: number;
  lastUsed: number;
}

export class CamoufoxFetcher {
  private pool: PooledBrowser[] = [];
  private readonly config: CamoufoxPoolConfig = {
    maxInstances: parseInt(process.env.CAMOUFOX_MAX_INSTANCES || '15'),
    maxRequestsPerInstance: parseInt(process.env.CAMOUFOX_MAX_REQUESTS || '100'),
    maxAgeMs: parseInt(process.env.CAMOUFOX_MAX_AGE_MINUTES || '30') * 60 * 1000,
  };
  
  constructor(private geonodeConfig: {
    hostname: string;   // proxy.geonode.io
    port: number;       // 9000 rotating, 10000 sticky
    username: string;   // geonode_XXXXX-type-residential (includes proxy type)
    password: string;   // UUID format API key
  }) {}

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const startTime = Date.now();
    const browser = await this.acquireBrowser(options);
    
    try {
      const context = await browser.browser.newContext();
      const page = await context.newPage();
      
      // Human-like behavior before navigation
      await this.simulateHumanBehavior(page);
      
      // Navigate with networkidle wait
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: options.timeoutMs || 20000,
      });
      
      // Scroll to trigger lazy loading
      await this.scrollPage(page);
      
      // Extract content
      const html = await page.content();
      
      await context.close();
      this.releaseBrowser(browser);
      
      return {
        url,
        success: response?.ok() ?? false,
        html,
        statusCode: response?.status() ?? 0,
        tierUsed: 'camoufox',
        fromCache: false,
        responseTimeMs: Date.now() - startTime,
        pageSizeBytes: Buffer.byteLength(html, 'utf8'),
        estimatedCost: this.estimateCost(Buffer.byteLength(html, 'utf8')),
      };
    } catch (error) {
      this.releaseBrowser(browser);
      return {
        url,
        success: false,
        statusCode: 0,
        tierUsed: 'camoufox',
        fromCache: false,
        responseTimeMs: Date.now() - startTime,
        pageSizeBytes: 0,
        estimatedCost: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async acquireBrowser(options: FetchOptions): Promise<PooledBrowser> {
    // Find reusable browser
    const now = Date.now();
    const available = this.pool.find(b => 
      b.requestCount < this.config.maxRequestsPerInstance &&
      now - b.createdAt < this.config.maxAgeMs
    );
    
    if (available) {
      available.requestCount++;
      available.lastUsed = now;
      return available;
    }
    
    // Create new browser with world-class config
    // Note: Username already includes -type-residential, session params appended after
    const browser = await Camoufox({
      headless: true,
      os: ['windows', 'macos'],      // Rotate fingerprints
      geoip: true,                    // CRITICAL: Match fingerprint to proxy IP
      humanize: 2.5,                  // Mouse movement variance
      block_images: true,             // Faster loading
      block_webrtc: true,             // Prevent IP leaks
      allow_webgl: false,             // Reduce fingerprint surface
      proxy: {
        server: `http://${this.geonodeConfig.hostname}:${this.geonodeConfig.port}`,
        username: this.buildGeonodeUsername(options),
        password: this.geonodeConfig.password,
      },
    });
    
    const pooled: PooledBrowser = {
      browser,
      requestCount: 1,
      createdAt: now,
      lastUsed: now,
    };
    
    this.pool.push(pooled);
    return pooled;
  }

  private buildGeonodeUsername(options: FetchOptions): string {
    // Base username already includes -type-residential
    // e.g., geonode_y9ZVNlVjdE-type-residential
    let username = this.geonodeConfig.username;
    
    // Sticky session for multi-page crawls (append after -type-residential)
    if (options.jobId) {
      username += `-session-${options.jobId}-lifetime-30`;
    }
    // Result: geonode_y9ZVNlVjdE-type-residential-session-job123-lifetime-30
    return username;
  }

  private releaseBrowser(browser: PooledBrowser): void {
    // Check if browser should be recycled
    const now = Date.now();
    if (
      browser.requestCount >= this.config.maxRequestsPerInstance ||
      now - browser.createdAt >= this.config.maxAgeMs
    ) {
      // Remove from pool and close
      this.pool = this.pool.filter(b => b !== browser);
      browser.browser.close().catch(() => {});
    }
  }

  private async simulateHumanBehavior(page: Page): Promise<void> {
    // Random mouse movement before navigation
    const viewport = page.viewportSize();
    if (viewport) {
      await page.mouse.move(
        Math.random() * viewport.width * 0.5 + 100,
        Math.random() * viewport.height * 0.3 + 100,
        { steps: 10 }
      );
    }
    // Random delay (log-normal distribution, median 1.5s)
    const delay = Math.exp(Math.log(1500) + 0.4 * this.gaussianRandom());
    await page.waitForTimeout(Math.min(delay, 3000));
  }

  private async scrollPage(page: Page): Promise<void> {
    // Scroll to trigger lazy loading, human-like increments
    const scrolls = 2 + Math.floor(Math.random() * 3); // 2-4 scrolls
    for (let i = 0; i < scrolls; i++) {
      const scrollAmount = 100 + Math.random() * 200; // 100-300px
      await page.mouse.wheel(0, scrollAmount);
      await page.waitForTimeout(300 + Math.random() * 500); // 300-800ms
    }
  }

  private gaussianRandom(): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private estimateCost(bytes: number): number {
    // Same as Geonode: $0.77/GB
    return (bytes / 1_000_000_000) * 0.77;
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.pool.map(b => b.browser.close().catch(() => {})));
    this.pool = [];
  }
}
```

**Key Camoufox Configuration (see detailed docs):**
- `CAMOUFOX-FINGERPRINT-CONFIG.md` - BrowserForge integration, OS distribution, WebGL/Canvas
- `CAMOUFOX-BEHAVIORAL-PATTERNS.md` - Mouse movement, scrolling, timing patterns
- `CAMOUFOX-GEONODE-INTEGRATION.md` - Proxy auth, geo-targeting, sticky sessions
- `CAMOUFOX-POOL-MANAGEMENT.md` - Memory limits, instance lifecycle, health checks
- `CAMOUFOX-DETECTION-TESTING.md` - Verification against anti-bot vendors

---

## Content Quality Assessment

```typescript
// src/server/features/scraping/ContentQualityAssessor.ts

export class ContentQualityAssessor {
  /**
   * Returns 0-1 quality score.
   * Used to decide if we need to escalate to JS rendering.
   */
  assess(html: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 1.0;
    
    const $ = cheerio.load(html);
    
    // 1. Check body text length
    const bodyText = $('body').text().trim();
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    if (wordCount < 100) {
      score -= 0.3;
      issues.push(`Low word count: ${wordCount}`);
    }
    
    // 2. Check for H1
    if ($('h1').length === 0) {
      score -= 0.2;
      issues.push('No H1 found');
    }
    
    // 3. Check text-to-HTML ratio
    const textRatio = bodyText.length / html.length;
    if (textRatio < 0.05) {
      score -= 0.3;
      issues.push(`Low text ratio: ${(textRatio * 100).toFixed(1)}%`);
    }
    
    // 4. Check for SPA indicators
    const spaIndicators = [
      html.includes('<div id="root"></div>'),
      html.includes('<div id="app"></div>'),
      html.includes('<div id="__next"></div>') && wordCount < 200,
      html.includes('ng-app'),
    ];
    if (spaIndicators.some(Boolean) && wordCount < 200) {
      score -= 0.4;
      issues.push('SPA shell detected');
    }
    
    // 5. Check for blocking indicators
    if (html.includes('cf-browser-verification')) {
      score = 0;
      issues.push('Cloudflare challenge');
    }
    if (html.includes('Access Denied') || html.includes('403 Forbidden')) {
      score = 0;
      issues.push('Access denied');
    }
    
    return { score: Math.max(0, score), issues };
  }
}
```

---

## Tasks

### Task 1: Database Schema (0.5 day)
- [ ] Create `src/db/domain-scrape-schema.ts`
- [ ] Add migration for `domain_scrape_configs` table
- [ ] Add migration for `domain_scrape_history` table
- [ ] Add indexes

### Task 2: Types & Interfaces (0.5 day)
- [ ] Create `src/server/features/scraping/types.ts`
- [ ] Define FetchOptions, FetchResult, DataForSEOPageData
- [ ] Define tier cost constants (TIER_ORDER, TIER_COSTS, TIER_TIMEOUTS)
- [ ] Add `camoufox` to FetchTier union

### Task 3: Proxy Providers (1.5 days)
- [ ] Implement `DirectFetcher.ts`
- [ ] Implement `WebshareFetcher.ts` (free tier)
- [ ] Implement `GeonodeFetcher.ts` (user's config)
- [ ] Implement `DataForSEOFetcher.ts` (existing, refactor)

### Task 4: Camoufox Stealth Browser (1.5 days) ← NEW
- [ ] Install `camoufox-js` and `playwright-core`
- [ ] Run `npx camoufox-js fetch` to download browser binary
- [ ] Implement `CamoufoxFetcher.ts` with pool management
- [ ] Implement browser acquisition/release lifecycle
- [ ] Implement human-like scrolling and timing
- [ ] Configure Geonode proxy integration with sticky sessions
- [ ] Set up instance recycling (100 requests OR 30 minutes)
- [ ] Add health monitoring for pool

### Task 5: Domain Learning Service (1 day)
- [ ] Implement `DomainLearningService.ts`
- [ ] Optimal tier lookup with Redis cache
- [ ] Discovery algorithm (now includes T2.5 camoufox)
- [ ] Revalidation logic

### Task 6: Content Quality Assessor (0.5 day)
- [ ] Implement `ContentQualityAssessor.ts`
- [ ] SPA detection
- [ ] Blocking detection (Cloudflare, Akamai, DataDome, PerimeterX)
- [ ] Fingerprint detection signals

### Task 7: TieredFetcher (1 day)
- [ ] Implement `TieredFetcher.ts`
- [ ] Tier escalation logic with decision matrix
- [ ] Integration with cache and learning
- [ ] Smart skip logic (fingerprint detection → skip to camoufox)

### Task 8: Tests (1.5 days)
- [ ] Unit tests for each provider (including CamoufoxFetcher)
- [ ] Unit tests for ContentQualityAssessor
- [ ] Integration tests for TieredFetcher
- [ ] Mock external services
- [ ] Detection verification tests (sannysoft, pixelscan patterns)

### Task 9: Migration Script (0.5 day)
- [ ] Migrate existing `UniversalCrawler` usages
- [ ] Migrate `HybridCrawler` usages
- [ ] Backward compatibility

**Revised Effort:** 2 weeks (was 1.5 weeks, added Camoufox tasks)

---

## Environment Variables Required

```env
# Webshare (free tier)
WEBSHARE_API_KEY=xxx

# Geonode (residential proxies)
# Username format: {user_id}-type-{proxy_type}
# Example: geonode_y9ZVNlVjdE-type-residential
# When adding geo-targeting/sessions, append AFTER -type-residential:
# geonode_y9ZVNlVjdE-type-residential-country-us-session-abc123-lifetime-30
GEONODE_HOST=proxy.geonode.io
GEONODE_PORT=9000                # 9000-9010 rotating, 10000-10900 sticky
GEONODE_USERNAME=geonode_XXXXX-type-residential
GEONODE_PASSWORD=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# DataForSEO (existing)
DATAFORSEO_API_KEY=xxx

# Camoufox (optional overrides)
CAMOUFOX_MAX_INSTANCES=15        # Default: 15 for 24GB RAM
CAMOUFOX_MAX_REQUESTS=100        # Recycle after N requests
CAMOUFOX_MAX_AGE_MINUTES=30      # Recycle after N minutes
```

### Geonode Username Construction

The base username already includes `-type-residential`. Additional parameters are appended:

```typescript
// Base username from env (already has -type-residential)
const baseUsername = process.env.GEONODE_USERNAME; 
// Example: "geonode_y9ZVNlVjdE-type-residential"

// Add targeting/session parameters
function buildGeonodeUsername(options: {
  country?: string;
  city?: string;
  sessionId?: string;
  lifetimeMinutes?: number;
}): string {
  let username = baseUsername;
  
  if (options.country) username += `-country-${options.country}`;
  if (options.city) username += `-city-${options.city}`;
  if (options.sessionId) username += `-session-${options.sessionId}`;
  if (options.lifetimeMinutes) username += `-lifetime-${options.lifetimeMinutes}`;
  
  return username;
}

// Examples:
// Rotating US: "geonode_y9ZVNlVjdE-type-residential-country-us"
// Sticky NYC:  "geonode_y9ZVNlVjdE-type-residential-country-us-city-newyork-session-crawl001-lifetime-60"
```

---

## Camoufox Research Documentation

The following detailed research docs were created for world-class Camoufox configuration:

| Document | Size | Focus |
|----------|------|-------|
| `CAMOUFOX-FINGERPRINT-CONFIG.md` | 25KB | BrowserForge, OS distribution, WebGL/Canvas, Navigator props |
| `CAMOUFOX-BEHAVIORAL-PATTERNS.md` | 23KB | Mouse movement, scrolling, timing, navigation patterns |
| `CAMOUFOX-GEONODE-INTEGRATION.md` | 31KB | Auth methods, geo-targeting, sticky sessions, bandwidth |
| `CAMOUFOX-POOL-MANAGEMENT.md` | 55KB | Memory limits, concurrency, lifecycle, health checks |
| `CAMOUFOX-DETECTION-TESTING.md` | 42KB | Test sites, anti-bot vendors, CI verification, monitoring |

**Key configurations from research:**
- **Fingerprints:** Windows 70%, macOS 15%, exclude Linux; Firefox 145-150
- **Behavior:** Log-normal delays (median 3.5s), 80-180px scroll increments, 2.5s humanize
- **Pool:** 15-20 instances for 24GB RAM, recycle at 100 requests or 30 minutes
- **Detection:** Target 95%+ on sannysoft, 90%+ on CreepJS, 0.5+ on incolumitas

---

## Success Criteria

1. **Tier distribution:** 60%+ requests served by T0-T2 (free or cheap)
2. **Learning accuracy:** 95%+ domain tier predictions correct
3. **Cost reduction:** 90%+ reduction vs all-DataForSEO baseline
4. **Test coverage:** 80%+ for new code
5. **Zero regressions:** All existing tests pass
