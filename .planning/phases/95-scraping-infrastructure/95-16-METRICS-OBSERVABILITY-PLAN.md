# Plan 95-16: Metrics & Observability Completion

**Phase:** 95 - Scraping Infrastructure  
**Plan:** 16 - Metrics & Observability Completion  
**Status:** Ready  
**Priority:** P0 (Critical - Production Blocker)  
**Estimated Effort:** 10 hours  
**Dependencies:** None

---

## Objective

Complete the metrics and observability implementation to enable proper monitoring dashboards. Currently, cost metrics are not exported to Prometheus, several metrics return stub values, and there's no request duration histogram or structured logging.

---

## Current State Analysis

### Metrics Gaps Identified

**1. Cost Metrics Not in Prometheus**
```typescript
// Current getPrometheusMetrics() exports:
// - scraping_component_health
// - scraping_component_latency_ms
// - scraping_circuit_state
// - scraping_queue_jobs
// - scraping_cache_hit_rate

// MISSING:
// - scraping_cost_usd_total (by tier, client)
// - scraping_dfs_budget_used_percent
// - scraping_dfs_savings_usd
```

**2. Stub Metric Values**
```typescript
// getMetrics() returns hardcoded values:
latencyP50: 0,        // Should be calculated
latencyP95: 0,        // Should be calculated
latencyP99: 0,        // Should be calculated
totalDomains: 0,      // Should query domain_scrape_configs
uniqueUrls24h: 0,     // Should query scrape history
```

**3. Missing Request Duration Histogram**
- Cannot analyze latency percentiles in Grafana
- No SLO tracking capability

**4. No Structured Logging**
- Uses console.log/warn/error directly
- No correlation IDs
- Hard to aggregate in production

---

## Task Breakdown

### Task 1: Add Cost Metrics to Prometheus Export

**File:** `open-seo-main/src/server/features/scraping/ScrapingService.ts` (modify)

```typescript
async getPrometheusMetrics(): Promise<string> {
  const lines: string[] = [];
  const metrics = await this.getMetrics();
  const costReport = await this.getCostReport('day');
  
  // ... existing metrics ...

  // Cost metrics (NEW)
  lines.push('# HELP scraping_cost_usd_total Total cost in USD');
  lines.push('# TYPE scraping_cost_usd_total counter');
  
  // By tier
  for (const [tier, cost] of Object.entries(costReport.byTier)) {
    lines.push(`scraping_cost_usd_total{tier="${tier}"} ${cost.toFixed(6)}`);
  }
  
  // Total
  lines.push(`scraping_cost_usd_total{tier="all"} ${costReport.total.toFixed(6)}`);
  
  // Budget metrics
  lines.push('# HELP scraping_dfs_budget_used_percent DFS budget utilization');
  lines.push('# TYPE scraping_dfs_budget_used_percent gauge');
  const budgetUsed = (costReport.total / (this.config.dfsDailyBudget || 10)) * 100;
  lines.push(`scraping_dfs_budget_used_percent ${budgetUsed.toFixed(2)}`);
  
  // Savings metrics
  lines.push('# HELP scraping_dfs_savings_usd Savings from Standard Queue');
  lines.push('# TYPE scraping_dfs_savings_usd counter');
  lines.push(`scraping_dfs_savings_usd ${costReport.savings?.fromStandardQueue?.toFixed(6) || 0}`);
  
  // Request counts by tier
  lines.push('# HELP scraping_requests_total Total requests by tier and status');
  lines.push('# TYPE scraping_requests_total counter');
  for (const [tier, data] of Object.entries(metrics.tierStats || {})) {
    lines.push(`scraping_requests_total{tier="${tier}",status="success"} ${data.success || 0}`);
    lines.push(`scraping_requests_total{tier="${tier}",status="error"} ${data.error || 0}`);
  }

  return lines.join('\n');
}
```

**Acceptance Criteria:**
- [ ] Cost exported by tier
- [ ] Budget utilization percentage exported
- [ ] Savings from Standard Queue exported
- [ ] Request counts by tier and status

---

### Task 2: Implement Request Duration Histogram

**File:** `open-seo-main/src/server/features/scraping/monitoring/MetricsCollector.ts` (new)

```typescript
/**
 * Prometheus-compatible metrics collector with histogram support
 */

interface HistogramBucket {
  le: number; // Less than or equal
  count: number;
}

interface Histogram {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

class MetricsCollector {
  private histograms: Map<string, Histogram> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  
  // Standard latency buckets (in seconds)
  private static LATENCY_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

  constructor() {
    // Initialize request duration histogram
    this.initHistogram('scraping_request_duration_seconds', MetricsCollector.LATENCY_BUCKETS);
  }

  private initHistogram(name: string, buckets: number[]): void {
    this.histograms.set(name, {
      buckets: buckets.map(le => ({ le, count: 0 })),
      sum: 0,
      count: 0,
    });
  }

  recordDuration(name: string, durationSeconds: number, labels: Record<string, string> = {}): void {
    const key = this.makeKey(name, labels);
    let histogram = this.histograms.get(key);
    
    if (!histogram) {
      this.initHistogram(key, MetricsCollector.LATENCY_BUCKETS);
      histogram = this.histograms.get(key)!;
    }

    histogram.sum += durationSeconds;
    histogram.count++;
    
    for (const bucket of histogram.buckets) {
      if (durationSeconds <= bucket.le) {
        bucket.count++;
      }
    }
  }

  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.makeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.makeKey(name, labels);
    this.gauges.set(key, value);
  }

  private makeKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  toPrometheusFormat(): string {
    const lines: string[] = [];

    // Export histograms
    for (const [key, histogram] of this.histograms) {
      const baseName = key.split('{')[0];
      const labels = key.includes('{') ? key.slice(key.indexOf('{') + 1, -1) : '';
      
      lines.push(`# HELP ${baseName} Request duration in seconds`);
      lines.push(`# TYPE ${baseName} histogram`);
      
      for (const bucket of histogram.buckets) {
        const bucketLabels = labels 
          ? `${labels},le="${bucket.le}"` 
          : `le="${bucket.le}"`;
        lines.push(`${baseName}_bucket{${bucketLabels}} ${bucket.count}`);
      }
      
      const infLabels = labels ? `${labels},le="+Inf"` : `le="+Inf"`;
      lines.push(`${baseName}_bucket{${infLabels}} ${histogram.count}`);
      lines.push(`${baseName}_sum${labels ? `{${labels}}` : ''} ${histogram.sum}`);
      lines.push(`${baseName}_count${labels ? `{${labels}}` : ''} ${histogram.count}`);
    }

    // Export counters
    for (const [key, value] of this.counters) {
      lines.push(`${key} ${value}`);
    }

    // Export gauges
    for (const [key, value] of this.gauges) {
      lines.push(`${key} ${value}`);
    }

    return lines.join('\n');
  }

  // Calculate percentiles from histogram
  getPercentile(name: string, percentile: number): number {
    const histogram = this.histograms.get(name);
    if (!histogram || histogram.count === 0) return 0;

    const targetCount = histogram.count * (percentile / 100);
    let prevBucket = { le: 0, count: 0 };
    
    for (const bucket of histogram.buckets) {
      if (bucket.count >= targetCount) {
        // Linear interpolation within bucket
        const fraction = (targetCount - prevBucket.count) / (bucket.count - prevBucket.count);
        return prevBucket.le + fraction * (bucket.le - prevBucket.le);
      }
      prevBucket = bucket;
    }
    
    return histogram.buckets[histogram.buckets.length - 1].le;
  }

  reset(): void {
    this.histograms.clear();
    this.counters.clear();
    this.gauges.clear();
  }
}

// Singleton
let metricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

// Convenience wrapper for timing operations
export async function withTiming<T>(
  operation: () => Promise<T>,
  metricName: string,
  labels: Record<string, string> = {}
): Promise<T> {
  const startTime = performance.now();
  try {
    return await operation();
  } finally {
    const durationSeconds = (performance.now() - startTime) / 1000;
    getMetricsCollector().recordDuration(metricName, durationSeconds, labels);
  }
}
```

**Acceptance Criteria:**
- [ ] Histogram implementation with standard buckets
- [ ] Percentile calculation from histogram
- [ ] Prometheus format export
- [ ] Timing wrapper utility

---

### Task 3: Integrate Histogram into Scrape Flow

**File:** `open-seo-main/src/server/features/scraping/TieredFetcher.ts` (modify)

```typescript
import { getMetricsCollector, withTiming } from './monitoring/MetricsCollector';

async fetch(url: string, options: FetchOptions = {}): Promise<ScrapeResult> {
  const metrics = getMetricsCollector();
  const startTime = performance.now();
  
  try {
    const result = await this.fetchWithEscalation(url, options);
    
    // Record duration with tier label
    const durationSeconds = (performance.now() - startTime) / 1000;
    metrics.recordDuration('scraping_request_duration_seconds', durationSeconds, {
      tier: result.tier,
      status: 'success',
    });
    
    return result;
  } catch (error) {
    const durationSeconds = (performance.now() - startTime) / 1000;
    metrics.recordDuration('scraping_request_duration_seconds', durationSeconds, {
      tier: options.startTier || 'direct',
      status: 'error',
    });
    throw error;
  }
}
```

**Also integrate into:**
- `ScrapingService.scrape()`
- `ScrapeWorker.processJob()`
- `CacheManager.get()` / `CacheManager.set()`

**Acceptance Criteria:**
- [ ] All scrape requests record duration
- [ ] Duration labeled by tier and status
- [ ] Cache operations record duration

---

### Task 4: Fix Stub Metric Values

**File:** `open-seo-main/src/server/features/scraping/ScrapingService.ts` (modify)

```typescript
async getMetrics(): Promise<ScrapingMetrics> {
  const metrics = getMetricsCollector();
  
  // Calculate real latency percentiles from histogram
  const latencyP50 = metrics.getPercentile('scraping_request_duration_seconds', 50) * 1000;
  const latencyP95 = metrics.getPercentile('scraping_request_duration_seconds', 95) * 1000;
  const latencyP99 = metrics.getPercentile('scraping_request_duration_seconds', 99) * 1000;
  
  // Query real domain count
  const domainCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(domainScrapeConfigs);
  const totalDomains = domainCountResult[0]?.count || 0;
  
  // Query unique URLs in last 24h
  const uniqueUrlsResult = await db
    .select({ count: sql<number>`count(distinct url)` })
    .from(domainScrapeHistory)
    .where(gte(domainScrapeHistory.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  const uniqueUrls24h = uniqueUrlsResult[0]?.count || 0;
  
  // Get tier distribution from history
  const tierDistribution = await db
    .select({
      tier: domainScrapeHistory.tier,
      count: sql<number>`count(*)`,
    })
    .from(domainScrapeHistory)
    .where(gte(domainScrapeHistory.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
    .groupBy(domainScrapeHistory.tier);

  return {
    // Real values now
    latencyP50,
    latencyP95,
    latencyP99,
    totalDomains,
    uniqueUrls24h,
    tierDistribution: Object.fromEntries(
      tierDistribution.map(t => [t.tier, t.count])
    ),
    // ... rest of metrics
  };
}
```

**Acceptance Criteria:**
- [ ] latencyP50/P95/P99 calculated from histogram
- [ ] totalDomains from database
- [ ] uniqueUrls24h from database
- [ ] tierDistribution from database

---

### Task 5: Implement Structured Logging

**File:** `open-seo-main/src/server/features/scraping/logging/Logger.ts` (new)

```typescript
import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// Correlation ID storage
const correlationStorage = new AsyncLocalStorage<string>();

// Create logger with structured output
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'scraping',
    version: process.env.npm_package_version,
  },
  mixin: () => {
    const correlationId = correlationStorage.getStore();
    return correlationId ? { correlationId } : {};
  },
});

// Child loggers for subsystems
export const fetcherLogger = logger.child({ component: 'fetcher' });
export const cacheLogger = logger.child({ component: 'cache' });
export const queueLogger = logger.child({ component: 'queue' });
export const costLogger = logger.child({ component: 'cost' });
export const domainLogger = logger.child({ component: 'domain-learning' });

// Correlation ID utilities
export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationStorage.run(correlationId, fn);
}

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}

export function generateCorrelationId(): string {
  return `scrape-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Express middleware to set correlation ID
export function correlationMiddleware(req: any, res: any, next: any) {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  res.setHeader('x-correlation-id', correlationId);
  
  correlationStorage.run(correlationId, () => {
    next();
  });
}

// Usage examples:
// fetcherLogger.info({ url, tier, duration }, 'Fetch completed');
// cacheLogger.warn({ key, level }, 'Cache miss');
// costLogger.info({ tier, cost, clientId }, 'Cost recorded');
```

**Acceptance Criteria:**
- [ ] Structured JSON logging with pino
- [ ] Correlation ID propagation
- [ ] Component-specific child loggers
- [ ] Express middleware for correlation

---

### Task 6: Replace console.log with Structured Logger

**Files to update:**
- `TieredFetcher.ts`
- `CacheManager.ts`
- `QueueManager.ts`
- `DfsCostTracker.ts`
- `DomainLearningService.ts`
- `AlertManager.ts`
- `ScrapeWorker.ts`

**Pattern:**
```typescript
// Before
console.log(`[TieredFetcher] Escalating from ${currentTier} to ${nextTier}`);
console.error('[CacheManager] Redis error:', error);

// After
import { fetcherLogger, cacheLogger } from './logging/Logger';

fetcherLogger.info({ currentTier, nextTier, url }, 'Tier escalation');
cacheLogger.error({ error: error.message, key }, 'Redis operation failed');
```

**Acceptance Criteria:**
- [ ] All console.log replaced with structured logger
- [ ] All console.warn replaced with logger.warn
- [ ] All console.error replaced with logger.error
- [ ] Context included in all log messages

---

### Task 7: Add Correlation ID to Scrape Flow

**File:** `open-seo-main/src/server/features/scraping/ScrapingService.ts` (modify)

```typescript
import { withCorrelationId, generateCorrelationId, logger } from './logging/Logger';

async scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const correlationId = options.correlationId || generateCorrelationId();
  
  return withCorrelationId(correlationId, async () => {
    logger.info({ url, options: { ...options, correlationId } }, 'Scrape started');
    
    try {
      const result = await this.tieredFetcher.fetch(url, options);
      
      logger.info({ 
        url, 
        tier: result.tier, 
        cached: result.cached,
        duration: result.duration,
      }, 'Scrape completed');
      
      return { ...result, correlationId };
    } catch (error) {
      logger.error({ url, error: error.message }, 'Scrape failed');
      throw error;
    }
  });
}
```

**Acceptance Criteria:**
- [ ] Correlation ID generated for each scrape
- [ ] ID propagated through entire flow
- [ ] ID included in response
- [ ] All related logs contain correlation ID

---

## Prometheus Metrics Summary

After implementation, these metrics will be available:

```prometheus
# Request duration histogram
scraping_request_duration_seconds_bucket{tier="direct",status="success",le="0.1"} 1234
scraping_request_duration_seconds_bucket{tier="direct",status="success",le="0.5"} 5678
scraping_request_duration_seconds_sum{tier="direct",status="success"} 12345.67
scraping_request_duration_seconds_count{tier="direct",status="success"} 10000

# Cost metrics
scraping_cost_usd_total{tier="direct"} 0
scraping_cost_usd_total{tier="dfs_basic"} 1.25
scraping_cost_usd_total{tier="dfs_js"} 5.00
scraping_cost_usd_total{tier="dfs_browser"} 2.50
scraping_cost_usd_total{tier="all"} 8.75

# Budget metrics
scraping_dfs_budget_used_percent 87.5
scraping_dfs_savings_usd 15.00

# Request counts
scraping_requests_total{tier="direct",status="success"} 5000
scraping_requests_total{tier="direct",status="error"} 50
scraping_requests_total{tier="dfs_basic",status="success"} 1000
```

---

## Acceptance Criteria

- [ ] Cost metrics exported to Prometheus
- [ ] Request duration histogram implemented
- [ ] All stub values replaced with real data
- [ ] Structured logging with pino
- [ ] Correlation IDs propagated through scrape flow
- [ ] All console.log statements replaced
- [ ] TypeScript compiles without errors
- [ ] Grafana dashboard can query all metrics
