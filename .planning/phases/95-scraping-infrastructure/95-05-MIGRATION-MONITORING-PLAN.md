# Plan 95-05: Migration & Monitoring

**Status:** Planning  
**Effort:** 1 week  
**Priority:** P0 (Final integration step)  
**Depends On:** 95-01, 95-02, 95-03, 95-04

---

## 1. Overview

This plan covers the gradual migration of all 6 existing scraping consumers to the unified ScrapingService, plus the monitoring dashboard for cost tracking and operational visibility.

### Core Principles

1. **Feature flags per consumer** - Enable/disable new scraping per feature
2. **Shadow mode** - Run both old and new, compare results before switching
3. **Gradual rollout** - Start with lowest-volume features, end with Site Audits
4. **Zero downtime** - No service interruption during migration
5. **Instant rollback** - One config change to revert any feature

### Migration Order (by risk/volume)

| Order | Feature | Volume | Risk | Migration Week |
|-------|---------|--------|------|----------------|
| 1 | Prospect Analysis | 4 pages/op | Low | Day 1-2 |
| 2 | Content Briefs | 5 pages/op | Low | Day 2-3 |
| 3 | SERP Content | 5 pages/op | Low | Day 3 |
| 4 | Competitor Spy | Variable | Medium | Day 3-4 |
| 5 | Hybrid Crawler | 10K pages | High | Day 4-5 |
| 6 | Site Audits | 10K pages | Highest | Day 5-7 |

---

## 2. Feature Flag System

### Configuration Schema

```typescript
// src/server/features/scraping/config/feature-flags.ts

export interface ScrapingMigrationFlags {
  /** Enable unified scraping for prospect analysis */
  prospectAnalysis: MigrationState;
  
  /** Enable unified scraping for content briefs (SerpAnalyzer) */
  contentBriefs: MigrationState;
  
  /** Enable unified scraping for SERP content analysis */
  serpContent: MigrationState;
  
  /** Enable unified scraping for competitor spy */
  competitorSpy: MigrationState;
  
  /** Enable unified scraping for hybrid crawler */
  hybridCrawler: MigrationState;
  
  /** Enable unified scraping for site audits */
  siteAudits: MigrationState;
}

export type MigrationState = 
  | 'legacy'      // Use old implementation only
  | 'shadow'      // Run both, log differences, return legacy result
  | 'canary'      // 10% new, 90% legacy
  | 'rollout'     // 100% new, legacy as fallback on error
  | 'migrated';   // New only, legacy code removed

export const DEFAULT_FLAGS: ScrapingMigrationFlags = {
  prospectAnalysis: 'legacy',
  contentBriefs: 'legacy',
  serpContent: 'legacy',
  competitorSpy: 'legacy',
  hybridCrawler: 'legacy',
  siteAudits: 'legacy',
};
```

### Environment-Based Override

```typescript
// src/server/features/scraping/config/flags-loader.ts

export function loadMigrationFlags(): ScrapingMigrationFlags {
  return {
    prospectAnalysis: getEnvFlag('SCRAPING_PROSPECT_ANALYSIS', 'legacy'),
    contentBriefs: getEnvFlag('SCRAPING_CONTENT_BRIEFS', 'legacy'),
    serpContent: getEnvFlag('SCRAPING_SERP_CONTENT', 'legacy'),
    competitorSpy: getEnvFlag('SCRAPING_COMPETITOR_SPY', 'legacy'),
    hybridCrawler: getEnvFlag('SCRAPING_HYBRID_CRAWLER', 'legacy'),
    siteAudits: getEnvFlag('SCRAPING_SITE_AUDITS', 'legacy'),
  };
}

function getEnvFlag(key: string, defaultValue: MigrationState): MigrationState {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  const valid: MigrationState[] = ['legacy', 'shadow', 'canary', 'rollout', 'migrated'];
  return valid.includes(value as MigrationState) 
    ? (value as MigrationState) 
    : defaultValue;
}
```

---

## 3. Shadow Mode Implementation

Shadow mode runs both implementations in parallel, compares results, and logs any differences for analysis before full cutover.

### Shadow Runner

```typescript
// src/server/features/scraping/migration/shadow-runner.ts

export interface ShadowResult<T> {
  legacyResult: T;
  newResult: T;
  comparison: {
    match: boolean;
    differences: string[];
    legacyTimeMs: number;
    newTimeMs: number;
    legacyCost: number;
    newCost: number;
  };
}

export async function runShadow<T>(
  featureName: string,
  legacyFn: () => Promise<T>,
  newFn: () => Promise<T>,
  compareFn: (legacy: T, newResult: T) => { match: boolean; differences: string[] }
): Promise<T> {
  const legacyStart = Date.now();
  const [legacyResult, legacyError] = await safeExecute(legacyFn);
  const legacyTimeMs = Date.now() - legacyStart;

  const newStart = Date.now();
  const [newResult, newError] = await safeExecute(newFn);
  const newTimeMs = Date.now() - newStart;

  // Log comparison for analysis
  if (legacyResult && newResult) {
    const comparison = compareFn(legacyResult, newResult);
    
    await logShadowComparison({
      feature: featureName,
      timestamp: new Date(),
      legacyTimeMs,
      newTimeMs,
      match: comparison.match,
      differences: comparison.differences,
      legacySuccess: !legacyError,
      newSuccess: !newError,
    });

    if (!comparison.match) {
      log.warn(`Shadow mismatch for ${featureName}`, {
        differences: comparison.differences.slice(0, 5),
      });
    }
  }

  // Always return legacy result in shadow mode
  if (legacyError) throw legacyError;
  return legacyResult!;
}

async function safeExecute<T>(fn: () => Promise<T>): Promise<[T | null, Error | null]> {
  try {
    return [await fn(), null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}
```

### Comparison Functions

```typescript
// src/server/features/scraping/migration/comparators.ts

/** Compare prospect page scrape results */
export function compareProspectScrape(
  legacy: MultiPageScrapeResult,
  newResult: MultiPageScrapeResult
): { match: boolean; differences: string[] } {
  const differences: string[] = [];

  // Compare homepage
  if (legacy.homepage.title !== newResult.homepage.title) {
    differences.push(`Title mismatch: "${legacy.homepage.title}" vs "${newResult.homepage.title}"`);
  }
  if (Math.abs(legacy.homepage.wordCount - newResult.homepage.wordCount) > 50) {
    differences.push(`Word count diff: ${legacy.homepage.wordCount} vs ${newResult.homepage.wordCount}`);
  }

  // Compare link counts
  const legacyLinks = legacy.homepage.internalLinks.length;
  const newLinks = newResult.homepage.internalLinks.length;
  if (Math.abs(legacyLinks - newLinks) > 5) {
    differences.push(`Internal link count diff: ${legacyLinks} vs ${newLinks}`);
  }

  // Compare cost
  const costDiff = legacy.totalCostCents - newResult.totalCostCents;
  if (costDiff !== 0) {
    differences.push(`Cost diff: $${(legacy.totalCostCents / 100).toFixed(4)} vs $${(newResult.totalCostCents / 100).toFixed(4)}`);
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

/** Compare SERP content analysis results */
export function compareSerpContent(
  legacy: SerpContentAnalysis,
  newResult: SerpContentAnalysis
): { match: boolean; differences: string[] } {
  const differences: string[] = [];

  // Compare H2 counts
  if (Math.abs(legacy.commonH2s.length - newResult.commonH2s.length) > 2) {
    differences.push(`H2 count diff: ${legacy.commonH2s.length} vs ${newResult.commonH2s.length}`);
  }

  // Compare word count stats
  const avgDiff = Math.abs(legacy.wordCountStats.avg - newResult.wordCountStats.avg);
  if (avgDiff > 200) {
    differences.push(`Avg word count diff: ${legacy.wordCountStats.avg} vs ${newResult.wordCountStats.avg}`);
  }

  return {
    match: differences.length === 0,
    differences,
  };
}
```

---

## 4. Per-Feature Migration Steps

### 4.1 Prospect Analysis (Day 1-2)

**Current implementation:** `multiPageScraper.ts`  
**Current method:** DataForSEO for all 4 pages  
**Volume:** ~4 pages per operation  
**Risk:** Low - isolated feature, small volume

#### Before (Legacy)

```typescript
// src/server/lib/scraper/multiPageScraper.ts
import { scrapeProspectPage } from "./dataforseoScraper";

export async function scrapeProspectSite(domain: string): Promise<MultiPageScrapeResult> {
  const homepageUrl = normalizeDomain(domain);
  const homepageResult = await scrapeProspectPage(homepageUrl); // Always DataForSEO
  // ...scrape additional pages with DataForSEO
}
```

#### After (Migrated)

```typescript
// src/server/lib/scraper/multiPageScraper.ts
import { scrapeProspectPage as legacyScrape } from "./dataforseoScraper";
import { scrapingService } from "@/server/features/scraping";
import { loadMigrationFlags } from "@/server/features/scraping/config/flags-loader";
import { runShadow, compareProspectScrape } from "@/server/features/scraping/migration";

export async function scrapeProspectSite(domain: string): Promise<MultiPageScrapeResult> {
  const flags = loadMigrationFlags();
  const homepageUrl = normalizeDomain(domain);

  switch (flags.prospectAnalysis) {
    case 'legacy':
      return scrapeWithLegacy(homepageUrl);

    case 'shadow':
      return runShadow(
        'prospectAnalysis',
        () => scrapeWithLegacy(homepageUrl),
        () => scrapeWithUnified(homepageUrl),
        compareProspectScrape
      );

    case 'canary':
      return Math.random() < 0.1
        ? scrapeWithUnified(homepageUrl)
        : scrapeWithLegacy(homepageUrl);

    case 'rollout':
    case 'migrated':
      try {
        return await scrapeWithUnified(homepageUrl);
      } catch (error) {
        if (flags.prospectAnalysis === 'rollout') {
          log.warn('Unified scraping failed, falling back to legacy', { error });
          return scrapeWithLegacy(homepageUrl);
        }
        throw error;
      }
  }
}

async function scrapeWithUnified(homepageUrl: string): Promise<MultiPageScrapeResult> {
  const homepageResult = await scrapingService.fetchPage(homepageUrl, {
    includeHtml: true,
    includeParsedData: true,
  });

  // Extract business links from parsed data or HTML
  const businessLinks = detectBusinessLinks(
    homepageResult.parsedData?.internalLinks || [],
    homepageUrl
  );

  // Batch fetch additional pages
  const urlsToScrape = [
    businessLinks.products,
    businessLinks.about,
    businessLinks.services,
  ].filter(Boolean).slice(0, 3);

  const additionalResults = await scrapingService.batchFetch(urlsToScrape, {
    includeHtml: true,
    includeParsedData: true,
  });

  return {
    homepage: transformToProspectPage(homepageResult),
    businessLinks,
    additionalPages: additionalResults.filter(r => r.success).map(transformToProspectPage),
    totalCostCents: Math.round(
      (homepageResult.estimatedCost + additionalResults.reduce((sum, r) => sum + r.estimatedCost, 0)) * 100
    ),
    errors: additionalResults.filter(r => !r.success).map(r => ({ url: r.url, error: r.error! })),
  };
}
```

### 4.2 Content Briefs / SERP Content (Day 2-3)

**Current implementation:** `SerpAnalyzer.ts`, `SerpContentAnalyzer.ts`  
**Current method:** DataForSEO OnPage Instant Pages  
**Volume:** ~5 pages per keyword  
**Risk:** Low

#### Before (Legacy)

```typescript
// src/server/features/briefs/services/SerpContentAnalyzer.ts
import { fetchOnPageInstantPages } from "@/server/lib/dataforseo";

export async function analyzeSerpContent(urls: string[]): Promise<SerpContentAnalysis> {
  const results = await fetchOnPageInstantPages(urls.slice(0, 5));
  // ...analyze HTML with cheerio
}
```

#### After (Migrated)

```typescript
// src/server/features/briefs/services/SerpContentAnalyzer.ts
import { fetchOnPageInstantPages } from "@/server/lib/dataforseo";
import { scrapingService } from "@/server/features/scraping";
import { loadMigrationFlags } from "@/server/features/scraping/config/flags-loader";

export async function analyzeSerpContent(urls: string[]): Promise<SerpContentAnalysis> {
  const flags = loadMigrationFlags();
  const targetUrls = urls.slice(0, 5);

  if (flags.serpContent === 'legacy') {
    return analyzeWithLegacy(targetUrls);
  }

  if (flags.serpContent === 'shadow') {
    return runShadow(
      'serpContent',
      () => analyzeWithLegacy(targetUrls),
      () => analyzeWithUnified(targetUrls),
      compareSerpContent
    );
  }

  // canary, rollout, migrated
  try {
    return await analyzeWithUnified(targetUrls);
  } catch (error) {
    if (flags.serpContent !== 'migrated') {
      log.warn('Unified SERP analysis failed, falling back', { error });
      return analyzeWithLegacy(targetUrls);
    }
    throw error;
  }
}

async function analyzeWithUnified(urls: string[]): Promise<SerpContentAnalysis> {
  const results = await scrapingService.batchFetch(urls, {
    includeHtml: true,
    includeParsedData: true,
  });

  const h2Counts = new Map<string, number>();
  const wordCounts: number[] = [];
  let analyzedUrls = 0;

  for (const result of results) {
    if (!result.success || !result.html) continue;
    analyzedUrls++;

    // Use pre-parsed data if available (from DFS tiers)
    if (result.parsedData) {
      for (const h2 of result.parsedData.h2) {
        const normalized = h2.toLowerCase();
        h2Counts.set(normalized, (h2Counts.get(normalized) || 0) + 1);
      }
      if (result.parsedData.wordCount > 100) {
        wordCounts.push(result.parsedData.wordCount);
      }
    } else {
      // Fall back to cheerio parsing for non-DFS results
      const $ = cheerio.load(result.html);
      // ...same cheerio logic as before
    }
  }

  return buildAnalysisResult(h2Counts, wordCounts, analyzedUrls);
}
```

### 4.3 Competitor Spy (Day 3-4)

**Current implementation:** `CompetitorSpyService.ts`  
**Current method:** DataForSEO Organic Keywords API  
**Volume:** Variable (100 keywords per domain)  
**Risk:** Medium - uses different DFS endpoint

**Note:** CompetitorSpyService uses DataForSEO's Organic Keywords API, not scraping. The migration here is about:
1. Using the unified cost tracking
2. Benefiting from the cache layer
3. Consistent error handling

#### Migration Pattern

```typescript
// src/server/features/keywords/services/CompetitorSpyService.ts

export class CompetitorSpyService {
  async spyOnCompetitor(domain: string, limit: number = 100): Promise<CompetitorSpyResult> {
    const flags = loadMigrationFlags();
    
    // CompetitorSpy primarily uses keyword API, but may need domain HTML
    // for supplementary analysis (e.g., vertical detection)
    
    if (flags.competitorSpy !== 'legacy') {
      // Use unified service for any HTML fetching
      const domainMetadata = await scrapingService.fetchPage(`https://${domain}`, {
        includeHtml: false,
        includeParsedData: true, // Get structure without full HTML
      });
      
      // Use parsed data for vertical classification
      if (domainMetadata.parsedData) {
        // Enhance keyword results with domain context
      }
    }
    
    // Core keyword fetching remains via DFS Organic API
    const organicKeywords = await fetchOrganicKeywords(domain, limit);
    // ...rest of implementation
  }
}
```

### 4.4 Hybrid Crawler (Day 4-5)

**Current implementation:** `hybrid-crawler.ts`  
**Current method:** Direct HTTP fetch + Playwright fallback  
**Volume:** Up to 10,000 pages  
**Risk:** High - core crawling infrastructure

#### Before (Legacy)

```typescript
// src/server/lib/crawler/hybrid-crawler.ts

export class HybridCrawler {
  async fetchPage(url: string): Promise<CrawlResult> {
    // Manual HTTP fetch with manual redirect handling
    const response = await fetch(url, {
      headers: { 'User-Agent': this.options.userAgent },
      redirect: 'manual',
    });
    
    // Manual Playwright fallback logic
    if (needsPlaywright) {
      return this.fetchWithPlaywright(url, fetchStart);
    }
  }
}
```

#### After (Migrated)

```typescript
// src/server/lib/crawler/hybrid-crawler.ts
import { scrapingService } from "@/server/features/scraping";
import { loadMigrationFlags } from "@/server/features/scraping/config/flags-loader";

export class HybridCrawler {
  async fetchPage(url: string): Promise<CrawlResult> {
    const flags = loadMigrationFlags();

    if (flags.hybridCrawler === 'legacy') {
      return this.legacyFetchPage(url);
    }

    // Use unified ScrapingService
    const result = await scrapingService.fetchPage(url, {
      includeHtml: true,
      timeoutMs: this.options.timeoutMs,
      // Let ScrapingService handle tier escalation (including Playwright equivalent via DFS Browser)
    });

    return {
      url: result.url,
      html: result.html || '',
      statusCode: result.statusCode,
      fetchMethod: result.tierUsed.startsWith('dfs_') ? 'playwright' : 'http',
      changeType: ChangeType.ADD, // Delta sync handled by ScrapingService cache
      fetchTimeMs: result.responseTimeMs,
    };
  }

  async crawlSite(
    tenantId: string,
    sitemapUrl: string,
    onProgress?: (progress: CrawlProgress) => void
  ): Promise<{ results: CrawlResult[]; summary: CrawlSummary }> {
    const flags = loadMigrationFlags();

    if (flags.hybridCrawler === 'legacy') {
      return this.legacyCrawlSite(tenantId, sitemapUrl, onProgress);
    }

    // Use unified bulk crawl
    const allUrls = await fetchAllSitemapUrls(sitemapUrl);
    const results = await scrapingService.crawlSite(
      allUrls.map(u => u.loc),
      {
        concurrency: this.options.concurrency,
        onProgress: (crawled, total, url) => {
          onProgress?.({ crawled, total, currentUrl: url });
        },
      }
    );

    return {
      results: results.map(r => ({
        url: r.url,
        html: r.html || '',
        statusCode: r.statusCode,
        fetchMethod: r.tierUsed.startsWith('dfs_') ? 'playwright' : 'http',
        changeType: ChangeType.ADD,
        fetchTimeMs: r.responseTimeMs,
      })),
      summary: this.buildSummary(results, Date.now() - startTime),
    };
  }
}
```

### 4.5 Site Audits (Day 5-7)

**Current implementation:** `siteAuditWorkflowCrawl.ts`  
**Current method:** Direct fetch via `crawlPage()` helper  
**Volume:** Up to 10,000 pages per audit  
**Risk:** Highest - critical revenue feature

#### Before (Legacy)

```typescript
// src/server/workflows/siteAuditWorkflowCrawl.ts
import { crawlPage } from "@/server/workflows/site-audit-workflow-helpers";

async function runCrawlBatch(step, crawlBatchIndex, urlsToCrawl, origin): Promise<CrawlBatchResult> {
  return step.do(`crawl-batch-${crawlBatchIndex}`, async () => {
    const settled = await Promise.allSettled(
      urlsToCrawl.map((url) => crawlPage(url, origin)),
    );
    // ...process results
  });
}
```

#### After (Migrated)

```typescript
// src/server/workflows/siteAuditWorkflowCrawl.ts
import { crawlPage as legacyCrawlPage } from "@/server/workflows/site-audit-workflow-helpers";
import { scrapingService } from "@/server/features/scraping";
import { loadMigrationFlags } from "@/server/features/scraping/config/flags-loader";

async function runCrawlBatch(
  step: WorkflowStep,
  crawlBatchIndex: number,
  urlsToCrawl: string[],
  origin: string
): Promise<CrawlBatchResult> {
  const flags = loadMigrationFlags();

  return step.do(`crawl-batch-${crawlBatchIndex}`, async () => {
    if (flags.siteAudits === 'legacy') {
      return legacyRunCrawlBatch(urlsToCrawl, origin);
    }

    // Use unified batch fetch for massive parallelism
    const results = await scrapingService.batchFetch(urlsToCrawl, {
      includeHtml: true,
      includeParsedData: true, // Get pre-parsed data for Tier 1 checks
      clientId: origin, // For cost attribution
    });

    const pages: StepPageResult[] = [];
    const htmlByPageId = new Map<string, string>();

    for (const result of results) {
      if (result.success) {
        const pageId = generatePageId(result.url);
        const page = transformToStepPageResult(result, origin);
        pages.push(page);
        if (result.html) {
          htmlByPageId.set(pageId, result.html);
        }
      }
    }

    return { pages, htmlByPageId };
  });
}

function transformToStepPageResult(result: FetchResult, origin: string): StepPageResult {
  // Use pre-parsed data when available (from DFS tiers)
  const parsed = result.parsedData;
  
  return {
    id: generatePageId(result.url),
    url: result.url,
    statusCode: result.statusCode,
    title: parsed?.title || extractTitleFromHtml(result.html),
    metaDescription: parsed?.metaDescription || extractMetaFromHtml(result.html),
    h1: parsed?.h1?.[0] || extractH1FromHtml(result.html),
    canonical: parsed?.canonical || extractCanonicalFromHtml(result.html),
    internalLinks: parsed?.internalLinks?.map(l => l.url) || extractLinksFromHtml(result.html, origin),
    externalLinks: parsed?.externalLinks?.map(l => l.url) || [],
    contentHash: hashContent(result.html || ''),
    fetchedAt: new Date(),
    tierUsed: result.tierUsed,
    estimatedCost: result.estimatedCost,
  };
}
```

---

## 5. Monitoring Dashboard

### 5.1 Metrics to Track

#### Cost Metrics (Primary)

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `scraping_cost_total` | Cumulative cost in cents | Budget threshold |
| `scraping_cost_per_tier` | Cost breakdown by tier | T5 > 5% of total |
| `scraping_cost_per_feature` | Cost by consumer feature | Unexpected spike |
| `scraping_cost_per_client` | Cost attribution by client | Client budget |

#### Performance Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `scraping_requests_total` | Total requests by tier | - |
| `scraping_latency_p50` | 50th percentile latency | >2s |
| `scraping_latency_p95` | 95th percentile latency | >5s |
| `scraping_latency_p99` | 99th percentile latency | >10s |
| `scraping_success_rate` | Success rate by tier | <95% |

#### Cache Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `cache_hit_rate_l1` | L1 (memory) hit rate | <50% |
| `cache_hit_rate_l2` | L2 (Redis) hit rate | <60% |
| `cache_hit_rate_l3` | L3 (PostgreSQL) hit rate | <70% |
| `cache_hit_rate_total` | Overall cache hit rate | <65% |
| `cache_size_bytes` | Cache storage usage | >80% capacity |

#### Domain Learning Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `domain_learning_accuracy` | Tier prediction accuracy | <90% |
| `domain_discovery_rate` | New domains per hour | - |
| `domain_tier_distribution` | % by optimal tier | T0-T2 < 60% |
| `domain_revalidation_queue` | Pending revalidations | >1000 |

### 5.2 Dashboard Schema

```typescript
// src/server/features/scraping/monitoring/types.ts

export interface ScrapingMetrics {
  // Cost summary
  cost: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    byTier: Record<FetchTier, number>;
    byFeature: Record<string, number>;
    byClient: Record<string, number>;
  };

  // Performance
  performance: {
    requestsTotal: number;
    requestsByTier: Record<FetchTier, number>;
    latencyP50Ms: number;
    latencyP95Ms: number;
    latencyP99Ms: number;
    successRate: number;
    errorsByType: Record<string, number>;
  };

  // Cache efficiency
  cache: {
    hitRateL1: number;
    hitRateL2: number;
    hitRateL3: number;
    hitRateTotal: number;
    sizeBytes: number;
    evictionsToday: number;
  };

  // Domain learning
  domainLearning: {
    totalDomains: number;
    accuracyRate: number;
    tierDistribution: Record<FetchTier, number>;
    discoveriesToday: number;
    revalidationsPending: number;
  };

  // Migration status
  migration: {
    flagStatus: ScrapingMigrationFlags;
    shadowMismatches: number;
    fallbacksTriggered: number;
  };
}
```

### 5.3 Dashboard API Endpoints

```typescript
// src/routes/api/scraping/metrics.ts

import { json } from "@tanstack/start";
import { MetricsService } from "@/server/features/scraping/monitoring/MetricsService";

export const GET = async () => {
  const metrics = await MetricsService.getMetrics();
  return json(metrics);
};

// src/routes/api/scraping/cost-breakdown.ts

export const GET = async ({ request }) => {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'day'; // day, week, month
  const groupBy = url.searchParams.get('groupBy') || 'tier'; // tier, feature, client

  const breakdown = await MetricsService.getCostBreakdown(period, groupBy);
  return json(breakdown);
};

// src/routes/api/scraping/domain-learning.ts

export const GET = async ({ request }) => {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');

  const domains = await MetricsService.getRecentDomainLearning(limit);
  return json(domains);
};
```

### 5.4 Dashboard UI Components

```
/clients/{clientId}/settings/scraping
├── Cost Overview Card
│   ├── Today: $X.XX (X requests)
│   ├── This Week: $X.XX
│   ├── This Month: $X.XX
│   └── vs Target: XX% under/over
├── Tier Distribution Chart (Pie)
│   ├── T0 Direct: XX%
│   ├── T1 Webshare: XX%
│   ├── T2 Geonode: XX%
│   ├── T3 DFS Basic: XX%
│   ├── T4 DFS JS: XX%
│   └── T5 DFS Browser: XX%
├── Cache Hit Rate Gauge
│   ├── L1 Memory: XX%
│   ├── L2 Redis: XX%
│   ├── L3 PostgreSQL: XX%
│   └── Overall: XX%
├── Domain Learning Stats
│   ├── Total Domains Learned: X,XXX
│   ├── Prediction Accuracy: XX%
│   └── Revalidations Pending: XXX
├── Cost by Feature (Bar Chart)
│   ├── Site Audits: $X.XX
│   ├── Prospect Analysis: $X.XX
│   ├── SERP Content: $X.XX
│   └── ...
└── Migration Status
    ├── Prospect Analysis: [migrated]
    ├── Content Briefs: [rollout]
    ├── SERP Content: [canary]
    └── ...
```

---

## 6. Alerting Rules

### 6.1 Cost Alerts

```typescript
// src/server/features/scraping/monitoring/alerts.ts

export const ALERT_RULES = {
  // Cost spike detection
  costSpike: {
    condition: (current: number, baseline: number) => current > baseline * 2,
    message: 'Scraping cost spiked 2x above baseline',
    severity: 'high',
    cooldownMinutes: 60,
  },

  // Daily budget exceeded
  dailyBudget: {
    condition: (todayCost: number, budget: number) => todayCost > budget,
    message: 'Daily scraping budget exceeded',
    severity: 'critical',
    cooldownMinutes: 0, // Alert every time
  },

  // T5 overuse (should be <2%)
  expensiveTierOveruse: {
    condition: (t5Percent: number) => t5Percent > 5,
    message: `DataForSEO Browser tier at ${t5Percent}% (target <2%)`,
    severity: 'medium',
    cooldownMinutes: 240,
  },

  // Domain learning regression
  learningAccuracyDrop: {
    condition: (accuracy: number) => accuracy < 90,
    message: `Domain learning accuracy dropped to ${accuracy}%`,
    severity: 'medium',
    cooldownMinutes: 120,
  },
};
```

### 6.2 Error Rate Alerts

```typescript
export const ERROR_ALERTS = {
  // High error rate
  errorRateHigh: {
    condition: (errorRate: number) => errorRate > 5,
    message: `Scraping error rate at ${errorRate}% (threshold 5%)`,
    severity: 'high',
    cooldownMinutes: 30,
  },

  // Specific tier failing
  tierFailing: {
    condition: (tier: FetchTier, successRate: number) => successRate < 90,
    message: `Tier ${tier} success rate at ${successRate}%`,
    severity: 'high',
    cooldownMinutes: 30,
  },

  // Cache miss rate high
  cacheMissHigh: {
    condition: (hitRate: number) => hitRate < 50,
    message: `Cache hit rate dropped to ${hitRate}%`,
    severity: 'medium',
    cooldownMinutes: 60,
  },
};
```

### 6.3 Queue Depth Alerts

```typescript
export const QUEUE_ALERTS = {
  // BullMQ queue backing up
  queueBacklog: {
    condition: (depth: number) => depth > 10000,
    message: `Scraping queue depth at ${depth} jobs`,
    severity: 'high',
    cooldownMinutes: 15,
  },

  // Stale jobs
  staleJobs: {
    condition: (staleCount: number) => staleCount > 100,
    message: `${staleCount} stale scraping jobs detected`,
    severity: 'medium',
    cooldownMinutes: 60,
  },

  // Rate limit backpressure
  rateLimitBackpressure: {
    condition: (waitingCount: number) => waitingCount > 500,
    message: `${waitingCount} jobs waiting on rate limits`,
    severity: 'low',
    cooldownMinutes: 120,
  },
};
```

---

## 7. Rollback Procedures

### 7.1 Instant Rollback (< 1 minute)

For any feature experiencing issues:

```bash
# Set feature to legacy mode via environment
export SCRAPING_SITE_AUDITS=legacy
export SCRAPING_HYBRID_CRAWLER=legacy

# Restart the service
pm2 restart open-seo-main
```

Or via database flag table:

```sql
-- Instant rollback for site audits
UPDATE scraping_migration_flags 
SET state = 'legacy' 
WHERE feature = 'siteAudits';
```

### 7.2 Partial Rollback (Shadow Mode)

If you need to investigate but not fully rollback:

```bash
# Switch to shadow mode - runs both, returns legacy
export SCRAPING_SITE_AUDITS=shadow
```

### 7.3 Full Rollback Procedure

If unified scraping needs complete removal:

1. **Set all flags to legacy:**
   ```bash
   export SCRAPING_PROSPECT_ANALYSIS=legacy
   export SCRAPING_CONTENT_BRIEFS=legacy
   export SCRAPING_SERP_CONTENT=legacy
   export SCRAPING_COMPETITOR_SPY=legacy
   export SCRAPING_HYBRID_CRAWLER=legacy
   export SCRAPING_SITE_AUDITS=legacy
   ```

2. **Restart services:**
   ```bash
   pm2 restart open-seo-main
   ```

3. **Verify rollback:**
   - Check `/api/scraping/metrics` shows legacy mode
   - Monitor error rates return to baseline
   - Verify cost attribution shows DataForSEO only

4. **Post-mortem:**
   - Analyze shadow mode logs
   - Identify root cause
   - Plan fix before re-migration

---

## 8. Success Criteria

### 8.1 Cost Reduction Target

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Cost per 1K pages | $20.00 | $0.80 | **96% reduction** |
| Monthly cost (100K pages) | $2,000 | $80 | **96% reduction** |
| T0-T2 tier usage | 0% | 65%+ | Achieved |
| Cache hit rate | 0% | 65%+ | Achieved |

### 8.2 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| p50 latency (cached) | <200ms | Dashboard |
| p95 latency (uncached) | <2s | Dashboard |
| p99 latency | <5s | Dashboard |
| Success rate | >99% | Dashboard |
| Zero regressions | 0 test failures | CI |

### 8.3 Migration Completion

| Milestone | Criteria |
|-----------|----------|
| Phase 1 Complete | Prospect + Content Briefs migrated |
| Phase 2 Complete | All low-volume features migrated |
| Phase 3 Complete | Hybrid Crawler migrated |
| Phase 4 Complete | Site Audits migrated |
| Full Migration | All features at `migrated` state |
| Code Cleanup | Legacy code removed |

### 8.4 Domain Learning Quality

| Metric | Target |
|--------|--------|
| Tier prediction accuracy | >95% |
| Discovery rate | <5% of requests |
| Revalidation backlog | <1000 domains |

---

## 9. Implementation Tasks

### Week 1: Migration Infrastructure (Day 1-2)

| Task | Effort | Owner |
|------|--------|-------|
| Create feature flag system | 2h | - |
| Implement shadow runner | 3h | - |
| Build comparison functions | 2h | - |
| Set up metrics collection | 3h | - |
| Create rollback scripts | 1h | - |

### Week 1: Low-Volume Migrations (Day 2-4)

| Task | Effort | Owner |
|------|--------|-------|
| Migrate Prospect Analysis | 4h | - |
| Shadow test Prospect Analysis | 2h | - |
| Migrate Content Briefs | 3h | - |
| Shadow test Content Briefs | 2h | - |
| Migrate SERP Content | 2h | - |
| Migrate Competitor Spy | 3h | - |

### Week 1: High-Volume Migrations (Day 4-7)

| Task | Effort | Owner |
|------|--------|-------|
| Migrate Hybrid Crawler | 6h | - |
| Load test Hybrid Crawler | 4h | - |
| Migrate Site Audits | 8h | - |
| Load test Site Audits | 4h | - |
| Shadow validation period | 8h | - |

### Week 1: Monitoring & Dashboard (Parallel)

| Task | Effort | Owner |
|------|--------|-------|
| Create metrics service | 3h | - |
| Build dashboard API endpoints | 2h | - |
| Create dashboard UI | 4h | - |
| Set up alerting | 2h | - |
| Documentation | 2h | - |

### Total Effort: ~5 days

---

## 10. Environment Variables

```env
# Migration flags (set per environment)
SCRAPING_PROSPECT_ANALYSIS=legacy|shadow|canary|rollout|migrated
SCRAPING_CONTENT_BRIEFS=legacy|shadow|canary|rollout|migrated
SCRAPING_SERP_CONTENT=legacy|shadow|canary|rollout|migrated
SCRAPING_COMPETITOR_SPY=legacy|shadow|canary|rollout|migrated
SCRAPING_HYBRID_CRAWLER=legacy|shadow|canary|rollout|migrated
SCRAPING_SITE_AUDITS=legacy|shadow|canary|rollout|migrated

# Monitoring
SCRAPING_DAILY_BUDGET_CENTS=1000
SCRAPING_ALERT_WEBHOOK_URL=https://hooks.slack.com/...
SCRAPING_METRICS_RETENTION_DAYS=30

# Cost attribution
SCRAPING_COST_TRACKING_ENABLED=true
```

---

## 11. Document History

- **v1.0** (2026-05-07): Initial migration and monitoring plan
