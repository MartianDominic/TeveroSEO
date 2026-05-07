---
phase: 95
plan: "05"
subsystem: scraping
tags:
  - migration
  - monitoring
  - feature-flags
  - shadow-mode
  - dashboard
dependency-graph:
  requires:
    - 95-01 (TieredFetcher)
    - 95-02 (Caching)
    - 95-03 (Queue/Rate Limiting)
    - 95-04 (DataForSEO Optimization)
  provides:
    - ScrapingService unified facade
    - Feature flag system for gradual rollout
    - Shadow mode for safe comparison testing
    - Migration routing infrastructure
    - 50+ dashboard type definitions
  affects:
    - All 6 scraping consumers (prospect, briefs, serp, competitor, crawler, audits)
tech-stack:
  added:
    - vi.hoisted() for test mocking patterns
  patterns:
    - Feature flag state machine (legacy -> shadow -> canary -> rollout -> migrated)
    - Shadow mode runner for parallel execution comparison
    - Migration router for request routing based on flags
key-files:
  created:
    - src/server/features/scraping/ScrapingService.ts
    - src/server/features/scraping/ScrapingService.test.ts
    - src/server/features/scraping/config/feature-flags.ts
    - src/server/features/scraping/config/flags-loader.ts
    - src/server/features/scraping/migration/shadow-runner.ts
    - src/server/features/scraping/migration/comparators.ts
    - src/server/features/scraping/migration/MigrationRouter.ts
    - src/server/features/scraping/monitoring/dashboard-types.ts
  modified:
    - src/server/features/scraping/config/index.ts
    - src/server/features/scraping/migration/index.ts
    - src/server/features/scraping/monitoring/index.ts
    - src/server/features/scraping/index.ts
decisions:
  - Feature flags per consumer for fine-grained rollout control
  - Shadow mode always returns legacy result for safety
  - 10% tolerance for HTML length differences in comparators
  - Cached flag loading with override support for testing
metrics:
  duration: ~45min
  completed: 2026-05-07
---

# Phase 95 Plan 05: Migration & Monitoring Summary

ScrapingService unified facade with 5-state feature flags, shadow mode comparison, and 50+ dashboard types for cost tracking

## Task Completion

| Task | Description | Status | Commit |
|------|-------------|--------|--------|
| 1 | Feature Flag System | Done | fe4e670 |
| 2 | ScrapingService Facade | Done | fe4e670 |
| 3 | Migration Wrappers | Done | fe4e670 |
| 4 | Monitoring Types | Done | fe4e670 |
| 5 | Integration Tests | Done | fe4e670 |

## Implementation Details

### Task 1: Feature Flag System

Created a 5-state migration flag system for gradual rollout:

**States:**
- `legacy` - Use old implementation only
- `shadow` - Run both, compare results, return legacy
- `canary` - 10% new, 90% legacy
- `rollout` - 100% new with legacy fallback on error
- `migrated` - New only, legacy code removed

**Files:**
- `config/feature-flags.ts` - MigrationState type, ScrapingMigrationFlags interface, utility functions
- `config/flags-loader.ts` - Environment-based loading with caching and runtime override support

**Environment Variables:**
```bash
SCRAPING_PROSPECT_ANALYSIS=legacy|shadow|canary|rollout|migrated
SCRAPING_CONTENT_BRIEFS=...
SCRAPING_SERP_CONTENT=...
SCRAPING_COMPETITOR_SPY=...
SCRAPING_HYBRID_CRAWLER=...
SCRAPING_SITE_AUDITS=...
```

### Task 2: ScrapingService Facade

Unified entry point combining TieredFetcher, CacheManager, DomainLearningService, and QueueManager:

**Public API:**
```typescript
class ScrapingService {
  // Core operations
  scrape(url, options?): Promise<ScrapeResult>
  scrapeBatch(urls, options?): Promise<BatchScrapeResult>
  
  // Cache operations
  warmCache(urls): Promise<CacheWarmResult>
  invalidateCache(url): Promise<void>
  invalidateDomain(domain): Promise<void>
  
  // Queue operations
  enqueue(url, options?): Promise<EnqueueResult | null>
  enqueueBatch(urls, options?): Promise<EnqueueResult[]>
  
  // Domain learning
  discoverDomain(domain): Promise<DiscoveryResult>
  getDomainStats(domain): Promise<DomainStats | null>
  estimateCost(url): Promise<CostEstimate>
  
  // Metrics
  getMetrics(): Promise<ScrapingMetrics>
  getCostReport(period): Promise<CostReport>
}
```

**Features:**
- HTML parsing with cheerio for title extraction
- Feature tracking per request
- Shadow mismatch and fallback counting
- Cost breakdown by tier, feature, and client

### Task 3: Migration Wrappers

**Shadow Runner (`shadow-runner.ts`):**
```typescript
runShadow<T>(
  featureName: string,
  legacyFn: () => Promise<T>,
  newFn: () => Promise<T>,
  compareFn: (legacy: T, newRes: T) => ComparisonResult
): Promise<T>
```
- Always returns legacy result for safety
- Logs mismatches with timing data
- Provides statistics via `getShadowStats()`

**Comparators (`comparators.ts`):**
- `compareSingleScrape()` - Compare FetchResult objects
- `compareParsedData()` - Compare ParsedPageData objects
- `compareProspectScrape()` - Compare multi-page prospect results
- `compareSerpContent()` - Compare SERP analysis results
- `compareBatchResults()` - Compare batch scrape results

**Tolerances:**
- 10% HTML length difference allowed
- 5% text ratio difference allowed
- Title/status/success must match exactly

**Migration Router (`MigrationRouter.ts`):**
```typescript
routeRequest<L, N>(
  feature: ScrapingFeature,
  legacyFn: () => Promise<L>,
  newFn: () => Promise<N>,
  compareFn: CompareFunction<L, N>,
  transform?: ResultTransformer<N, L>
): Promise<L>
```
- Routes based on feature flag state
- Handles canary percentage (10%)
- Provides fallback on error for rollout mode

### Task 4: Monitoring Types

Created 50+ TypeScript interfaces in `monitoring/dashboard-types.ts`:

**Cost Metrics:**
- TierCostBreakdown
- FeatureCostBreakdown
- ClientCostBreakdown
- DailyCostSummary
- CostTrendPoint
- CostProjection

**Performance Metrics:**
- LatencyPercentiles (p50, p75, p90, p95, p99, max)
- TierPerformanceMetrics
- PerformanceSummary

**Cache Metrics:**
- CacheLevelStats (L1-L4)
- CacheEfficiencyMetrics
- CacheHealth

**Domain Learning Metrics:**
- DomainLearningStats
- DomainLearningHealth
- TopDomainsReport

**Migration Metrics:**
- FeatureMigrationStatus
- MigrationProgress
- ShadowModeStats

**Dashboard Aggregates:**
- ScrapingDashboardData (complete dashboard structure)
- DashboardSummaryCard
- QueueStatus/QueueMetrics
- ScrapingAlert/AlertConfig

**API Response Types:**
- DashboardResponse
- CostBreakdownResponse
- DomainLearningResponse
- MigrationStatusResponse

### Task 5: Integration Tests

39 passing tests covering:

**ScrapingService Tests:**
- Initialization lifecycle
- Single scrape operations
- Batch scrape with tier distribution
- Cache warming and invalidation
- Metrics collection and reporting
- Cost reports (day/week/month)
- Queue operations
- Domain learning integration

**Feature Flag Tests:**
- Default flag loading
- Override mechanism
- Clear all overrides

**Shadow Mode Tests:**
- Shadow comparison execution
- Statistics tracking
- Log clearing

**Comparator Tests:**
- Identical result matching
- Success/status mismatch detection
- HTML length tolerance (5%)
- Large difference detection (50%)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest mock hoisting error**
- **Found during:** Task 5
- **Issue:** `vi.mock` is hoisted but mock variables were defined after imports, causing "Cannot access before initialization" error
- **Fix:** Used `vi.hoisted()` to define mock functions before they're referenced in `vi.mock` calls
- **Files modified:** ScrapingService.test.ts
- **Commit:** fe4e670

**2. [Rule 1 - Bug] Batch duration assertion**
- **Found during:** Task 5
- **Issue:** Test expected `durationMs > 0` but mocked implementation completes instantly
- **Fix:** Changed assertion to `durationMs >= 0` since mocked operations have no actual duration
- **Files modified:** ScrapingService.test.ts
- **Commit:** fe4e670

## Self-Check: PASSED

**Files verified:**
- FOUND: src/server/features/scraping/ScrapingService.ts
- FOUND: src/server/features/scraping/ScrapingService.test.ts
- FOUND: src/server/features/scraping/config/feature-flags.ts
- FOUND: src/server/features/scraping/config/flags-loader.ts
- FOUND: src/server/features/scraping/migration/shadow-runner.ts
- FOUND: src/server/features/scraping/migration/comparators.ts
- FOUND: src/server/features/scraping/migration/MigrationRouter.ts
- FOUND: src/server/features/scraping/monitoring/dashboard-types.ts

**Commits verified:**
- FOUND: fe4e670

## Phase 95 Completion Status

| Plan | Name | Status |
|------|------|--------|
| 95-01 | TieredFetcher | Complete |
| 95-02 | Caching | Complete |
| 95-03 | Queue & Rate Limiting | Complete |
| 95-04 | DataForSEO Optimization | Complete |
| 95-05 | Migration & Monitoring | Complete |

**Phase 95 is now complete.** All unified scraping infrastructure is in place:
- Tiered fetching (T0-T5)
- 4-level caching (L1-L4)
- BullMQ queue with rate limiting
- DataForSEO optimization
- Migration infrastructure with feature flags
- Monitoring types for dashboard

## Next Steps

1. **Implement dashboard UI** - Use dashboard types to build monitoring interface
2. **Begin consumer migration** - Start with low-volume features (Prospect Analysis)
3. **Shadow mode testing** - Run parallel comparison before full cutover
4. **Cost tracking** - Implement API endpoints for cost breakdown queries
