# Plan 95-07: Core Web Vitals Integration

**Phase:** 95 - Scraping Infrastructure Optimization  
**Priority:** P0 (Blocking - Required for On-Page SEO Mastery)  
**Estimated Effort:** 3-4 days  
**Dependencies:** 95-05 (ScrapingService facade)

---

## Problem Statement

The on-page SEO analysis system requires Core Web Vitals (CWV) data to provide complete page performance assessments. Currently:

1. **No CWV integration exists** in the scraping infrastructure
2. **On-Page Mastery** (Phase 92) expects CWV metrics but has no data source
3. **Site Audits** need performance scoring without relying on expensive browser rendering
4. **Cost efficiency** demands a tiered approach: free CrUX API first, paid fallbacks only when necessary

The Chrome UX Report (CrUX) API provides free, real-user CWV data for ~10M origins. For pages not in CrUX, we need PageSpeed Insights (PSI) as a fallback.

---

## Success Criteria

- [ ] CrUX API client fetching real-user CWV data for qualifying origins
- [ ] PageSpeed Insights fallback for pages without CrUX data
- [ ] Unified CwvService exposing consistent metrics regardless of source
- [ ] Integration with ScrapingService.scrape() response enrichment
- [ ] Caching layer preventing redundant API calls (24h TTL for CrUX, 1h for PSI)
- [ ] Cost tracking for PSI calls (quota-limited, not per-call billing)
- [ ] On-Page SEO consumers receiving CWV data transparently

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CwvService                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ getCwvData()│→ │ CruxClient  │→ │ CwvCache    │                 │
│  └─────────────┘  └──────┬──────┘  │ (L2 Redis)  │                 │
│                          │         └─────────────┘                 │
│                   ┌──────▼──────┐                                   │
│                   │ Miss? Try   │                                   │
│                   │ PSI Fallback│                                   │
│                   └──────┬──────┘                                   │
│                          │                                          │
│                   ┌──────▼──────┐                                   │
│                   │ PsiClient   │ ← Rate limited (400 req/100s)    │
│                   └─────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **ScrapingService.scrape()** calls CwvService.getCwvData(url) after HTML fetch
2. **CwvService** checks L2 cache (Redis) for origin-level CWV data
3. **Cache miss** → Query CrUX API for origin (free, real-user data)
4. **CrUX miss** → Query PageSpeed Insights for URL-level lab data
5. **Response** merged into ScrapeResult with `cwv` field

### CWV Metrics Structure

```typescript
interface CwvMetrics {
  source: 'crux' | 'psi' | 'unavailable';
  fetchedAt: Date;
  
  // Core Web Vitals (P75 values)
  lcp?: number;  // Largest Contentful Paint (ms)
  fid?: number;  // First Input Delay (ms) - CrUX only
  inp?: number;  // Interaction to Next Paint (ms)
  cls?: number;  // Cumulative Layout Shift (score)
  
  // Additional metrics from PSI
  fcp?: number;  // First Contentful Paint (ms)
  ttfb?: number; // Time to First Byte (ms)
  si?: number;   // Speed Index (ms)
  tbt?: number;  // Total Blocking Time (ms)
  
  // Scoring
  performanceScore?: number; // 0-100 (PSI only)
  lcpRating: 'good' | 'needs-improvement' | 'poor';
  inpRating: 'good' | 'needs-improvement' | 'poor';
  clsRating: 'good' | 'needs-improvement' | 'poor';
}
```

---

## Task Breakdown

### Task 95-07-01: CrUX API Client

**File:** `open-seo-main/src/server/features/scraping/cwv/CruxClient.ts`

```typescript
interface CruxClientConfig {
  apiKey: string;
  timeout: number;
  retries: number;
}

interface CruxResponse {
  record: {
    key: { origin: string };
    metrics: {
      largest_contentful_paint: MetricData;
      interaction_to_next_paint: MetricData;
      cumulative_layout_shift: MetricData;
      first_input_delay?: MetricData;
      first_contentful_paint?: MetricData;
      experimental_time_to_first_byte?: MetricData;
    };
  };
}

class CruxClient {
  constructor(config: CruxClientConfig);
  
  // Query by origin (domain-level, higher hit rate)
  async queryOrigin(origin: string): Promise<CruxResponse | null>;
  
  // Query by URL (page-level, lower hit rate)
  async queryUrl(url: string): Promise<CruxResponse | null>;
  
  // Extract P75 values from response
  extractMetrics(response: CruxResponse): Partial<CwvMetrics>;
}
```

**Implementation Details:**
- API endpoint: `https://chromeuxreport.googleapis.com/v1/records:queryRecord`
- Free tier: 25,000 queries/day (sufficient for most use cases)
- Query origin first (higher coverage), fall back to URL query
- Parse histogram data to extract P75 values
- Handle 404 (not in dataset) gracefully

**Acceptance Criteria:**
- [ ] Queries CrUX API with proper authentication
- [ ] Extracts P75 values for all available metrics
- [ ] Returns null for origins not in dataset (not an error)
- [ ] Respects rate limits (25k/day)
- [ ] Includes retry logic with exponential backoff

---

### Task 95-07-02: PageSpeed Insights Client

**File:** `open-seo-main/src/server/features/scraping/cwv/PsiClient.ts`

```typescript
interface PsiClientConfig {
  apiKey: string;
  timeout: number;
  strategy: 'mobile' | 'desktop';
  categories: ('performance' | 'accessibility' | 'seo')[];
}

interface PsiResponse {
  lighthouseResult: {
    categories: {
      performance: { score: number };
    };
    audits: {
      'largest-contentful-paint': AuditResult;
      'cumulative-layout-shift': AuditResult;
      'total-blocking-time': AuditResult;
      'first-contentful-paint': AuditResult;
      'speed-index': AuditResult;
      'interactive': AuditResult;
    };
  };
  loadingExperience?: {
    metrics: CruxStyleMetrics; // Field data if available
  };
}

class PsiClient {
  constructor(config: PsiClientConfig);
  
  // Run Lighthouse analysis via PSI API
  async analyze(url: string): Promise<PsiResponse>;
  
  // Extract metrics from response
  extractMetrics(response: PsiResponse): Partial<CwvMetrics>;
  
  // Check if field data is available
  hasFieldData(response: PsiResponse): boolean;
}
```

**Implementation Details:**
- API endpoint: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
- Rate limit: 400 requests per 100 seconds (per project)
- Strategy: mobile (default, aligns with Google's mobile-first indexing)
- Categories: performance only (minimize response size)
- Prefer field data (loadingExperience) over lab data when available

**Acceptance Criteria:**
- [ ] Queries PSI API with configurable strategy
- [ ] Extracts both lab and field metrics
- [ ] Handles rate limiting with 429 response handling
- [ ] Returns performance score alongside raw metrics
- [ ] Timeout configurable (default 30s for slow pages)

---

### Task 95-07-03: CWV Cache Layer

**File:** `open-seo-main/src/server/features/scraping/cwv/CwvCache.ts`

```typescript
interface CwvCacheConfig {
  redis: Redis;
  cruxTtl: number;  // 24 hours (field data changes slowly)
  psiTtl: number;   // 1 hour (lab data, more volatile)
}

class CwvCache {
  constructor(config: CwvCacheConfig);
  
  // Cache key strategies
  private originKey(origin: string): string;  // cwv:origin:{origin}
  private urlKey(url: string): string;        // cwv:url:{urlHash}
  
  // Get cached CWV data
  async get(url: string): Promise<CwvMetrics | null>;
  
  // Store CWV data with source-appropriate TTL
  async set(url: string, metrics: CwvMetrics): Promise<void>;
  
  // Batch get for multiple URLs
  async mget(urls: string[]): Promise<Map<string, CwvMetrics>>;
  
  // Invalidate cache for URL/origin
  async invalidate(url: string): Promise<void>;
}
```

**Cache Strategy:**
- Origin-level CrUX data: 24h TTL (real user data, stable)
- URL-level PSI data: 1h TTL (lab data, can vary)
- Store at origin level when possible (higher reuse)
- URL hash for cache keys (avoid key length issues)

**Acceptance Criteria:**
- [ ] Redis-backed caching with configurable TTLs
- [ ] Origin-level caching for CrUX data
- [ ] URL-level caching for PSI data
- [ ] Batch retrieval for efficiency
- [ ] Proper serialization/deserialization of metrics

---

### Task 95-07-04: Unified CwvService

**File:** `open-seo-main/src/server/features/scraping/cwv/CwvService.ts`

```typescript
interface CwvServiceConfig {
  cruxClient: CruxClient;
  psiClient: PsiClient;
  cache: CwvCache;
  costTracker: DfsCostTracker;
  
  // Feature flags
  enablePsiFallback: boolean;
  psiDailyBudget: number;  // Max PSI calls per day
}

class CwvService {
  constructor(config: CwvServiceConfig);
  
  // Main entry point - tiered lookup
  async getCwvData(url: string): Promise<CwvMetrics>;
  
  // Batch fetch for multiple URLs (optimized)
  async batchGetCwvData(urls: string[]): Promise<Map<string, CwvMetrics>>;
  
  // Force refresh (bypass cache)
  async refreshCwvData(url: string): Promise<CwvMetrics>;
  
  // Get current PSI usage
  getPsiUsageToday(): { used: number; budget: number; remaining: number };
}
```

**Tiered Lookup Flow:**
1. Check cache → return if hit
2. Query CrUX origin → cache + return if hit
3. Query CrUX URL → cache + return if hit
4. Check PSI budget → skip if exhausted
5. Query PSI → cache + return
6. Return `{ source: 'unavailable' }` if all fail

**Acceptance Criteria:**
- [ ] Tiered lookup with cache-first strategy
- [ ] PSI fallback with daily budget enforcement
- [ ] Batch optimization (dedupe origins, parallel queries)
- [ ] Metrics emission for monitoring
- [ ] Graceful degradation when APIs unavailable

---

### Task 95-07-05: ScrapingService Integration

**File:** `open-seo-main/src/server/features/scraping/ScrapingService.ts` (modify)

```typescript
interface ScrapeOptions {
  // ... existing options
  includeCwv?: boolean;  // Default: false (opt-in)
  cwvStrategy?: 'crux-only' | 'full';  // Default: 'full'
}

interface ScrapeResult {
  // ... existing fields
  cwv?: CwvMetrics;
}
```

**Integration Points:**
- Add `cwvService` to ScrapingService constructor
- Enrich response with CWV data when `includeCwv: true`
- Parallel fetch: HTML + CWV in Promise.all()
- Cost tracking: count PSI calls in existing tracker

**Acceptance Criteria:**
- [ ] CWV data included in ScrapeResult when requested
- [ ] Parallel fetching (no added latency for HTML)
- [ ] Opt-in flag to avoid unnecessary API calls
- [ ] CWV failures don't break scraping (graceful degradation)

---

### Task 95-07-06: On-Page SEO Consumer Integration

**File:** `open-seo-main/src/server/features/onpage-mastery/analyzers/PerformanceAnalyzer.ts` (modify)

Update the On-Page SEO performance analyzer to consume CWV data from the unified scraping infrastructure.

```typescript
class PerformanceAnalyzer {
  analyze(content: ParsedContent, cwv: CwvMetrics): PerformanceAnalysis {
    return {
      // CWV-based scoring
      lcpScore: this.scoreLcp(cwv.lcp),
      clsScore: this.scoreCls(cwv.cls),
      inpScore: this.scoreInp(cwv.inp),
      
      // Overall performance grade
      performanceGrade: this.calculateGrade(cwv),
      
      // Recommendations based on poor metrics
      recommendations: this.generateRecommendations(cwv),
      
      // Data source transparency
      dataSource: cwv.source,
      dataFreshness: cwv.fetchedAt,
    };
  }
  
  private scoreLcp(lcp?: number): Score {
    if (!lcp) return { score: null, status: 'unavailable' };
    if (lcp <= 2500) return { score: 100, status: 'good' };
    if (lcp <= 4000) return { score: 50, status: 'needs-improvement' };
    return { score: 0, status: 'poor' };
  }
}
```

**Acceptance Criteria:**
- [ ] PerformanceAnalyzer consumes CwvMetrics
- [ ] Scoring aligned with Google's CWV thresholds
- [ ] Recommendations generated for poor metrics
- [ ] Graceful handling of unavailable data

---

### Task 95-07-07: Unit Tests

**File:** `open-seo-main/src/server/features/scraping/cwv/__tests__/`

Test files:
- `CruxClient.test.ts` - API interaction, response parsing, error handling
- `PsiClient.test.ts` - API interaction, rate limiting, timeout handling
- `CwvCache.test.ts` - Cache operations, TTL behavior, batch operations
- `CwvService.test.ts` - Tiered lookup, budget enforcement, graceful degradation

**Test Coverage Requirements:**
- [ ] CrUX API success path
- [ ] CrUX API 404 (not in dataset)
- [ ] CrUX API error handling
- [ ] PSI API success path
- [ ] PSI rate limiting (429 response)
- [ ] Cache hit/miss scenarios
- [ ] Budget exhaustion handling
- [ ] Batch operation optimization
- [ ] Integration with ScrapingService

---

### Task 95-07-08: Integration Tests

**File:** `open-seo-main/src/server/features/scraping/cwv/__tests__/integration/`

```typescript
describe('CWV Integration', () => {
  it('should fetch CWV data through ScrapingService', async () => {
    const result = await scrapingService.scrape({
      url: 'https://example.com',
      includeCwv: true,
    });
    
    expect(result.cwv).toBeDefined();
    expect(result.cwv.source).toBeOneOf(['crux', 'psi', 'unavailable']);
  });
  
  it('should use cached CWV data on subsequent requests', async () => {
    // First request
    await scrapingService.scrape({ url, includeCwv: true });
    
    // Second request should hit cache
    const metrics = cwvService.getMetrics();
    expect(metrics.cacheHits).toBe(1);
  });
  
  it('should respect PSI daily budget', async () => {
    // Exhaust budget
    for (let i = 0; i < PSI_DAILY_BUDGET; i++) {
      await cwvService.getCwvData(`https://unique-${i}.example.com`);
    }
    
    // Next request should skip PSI
    const result = await cwvService.getCwvData('https://new.example.com');
    expect(result.source).not.toBe('psi');
  });
});
```

---

## Environment Variables

```bash
# CrUX API (required)
CRUX_API_KEY=your-google-api-key

# PageSpeed Insights (optional, uses same key)
PSI_API_KEY=your-google-api-key  # Can be same as CRUX_API_KEY

# Configuration
CWV_CRUX_TTL_HOURS=24
CWV_PSI_TTL_HOURS=1
CWV_PSI_DAILY_BUDGET=1000
CWV_PSI_FALLBACK_ENABLED=true
```

---

## Cost Analysis

| API | Daily Limit | Cost | Notes |
|-----|------------|------|-------|
| CrUX | 25,000/day | Free | Real-user data, origin-level |
| PSI | ~345,600/day | Free | 400 req/100s rate limit |

**Projected Usage:**
- CrUX: ~5,000 queries/day (origin deduplication)
- PSI: ~500 queries/day (only for CrUX misses)
- **Total Cost: $0** (within free tier)

---

## Rollout Plan

1. **Phase 1:** Deploy CrUX client with caching (no PSI)
2. **Phase 2:** Add PSI fallback with conservative budget (100/day)
3. **Phase 3:** Increase PSI budget based on miss rate
4. **Phase 4:** Enable by default for on-page audits

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CrUX coverage gaps | PSI fallback with budget |
| API rate limits | Caching + exponential backoff |
| Cost overrun | Daily budget enforcement |
| Data staleness | Configurable TTLs |
| API downtime | Graceful degradation (return unavailable) |

---

## Definition of Done

- [ ] All 8 tasks completed with passing tests
- [ ] CrUX client fetching real-user CWV data
- [ ] PSI fallback working for CrUX misses
- [ ] Caching preventing redundant API calls
- [ ] ScrapingService enriching responses with CWV
- [ ] On-Page SEO consuming CWV transparently
- [ ] Documentation updated
- [ ] Code reviewed and merged
