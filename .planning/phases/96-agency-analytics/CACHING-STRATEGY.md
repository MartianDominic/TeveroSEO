# Phase 96 Caching Strategy

> This document explains the intentional TTL differences between analytics cache and SERP cache,
> and documents the cache warming strategy implemented for GSC sync completion.

## Overview

Phase 96 uses two distinct caching strategies optimized for different data characteristics:

| Cache Type | TTL | Location | Purpose |
|------------|-----|----------|---------|
| **Analytics Cache** | 30 minutes | `src/server/cache/analytics-cache.ts` | Dashboard metrics, trends, striking distance |
| **SERP Cache** | 12-24 hours | `src/server/lib/cache/serp-cache.ts` | SERP analysis results for content briefs |

**These TTL differences are intentional. Do not "fix" them to match.**

---

## Analytics Cache (30 Minutes)

### File Location
- `open-seo-main/src/server/cache/analytics-cache.ts`

### TTL Rationale

```
ANALYTICS_CACHE_TTL_SECONDS = 30 * 60  // 30 minutes
```

**Why 30 minutes?**

1. **Data freshness expectations**: Users expect dashboard data to reflect recent GSC syncs. GSC syncs run nightly (3:00 AM UTC), so data changes once daily.

2. **Balance between freshness and performance**: 
   - Too short (5 min): Excessive database queries during peak hours
   - Too long (6 hours): Users see stale data after manual refresh requests
   - 30 minutes: Optimal balance for typical usage patterns

3. **Proactive invalidation**: Cache is invalidated via pub/sub when GSC sync completes, so TTL is primarily a safety net for edge cases.

4. **GSC processing latency**: GSC data has 2-3 day inherent latency. Caching for 30 minutes doesn't meaningfully reduce data freshness.

### Cache Types

| Type | Description | Typical Query |
|------|-------------|---------------|
| `dashboard` | Aggregated metrics across sites | MasterDashboardService.getAggregatedMetrics |
| `trends` | Growing/decaying page detection | TrendDetectionService.analyzePageTrends |
| `striking` | Pages in striking distance (pos 11-20) | StrikingDistanceService.getStrikingDistancePages |
| `cannibalization` | Keyword cannibalization issues | CannibalizationService.detect |
| `clusters` | Topic cluster metrics | TopicClusterService |
| `groups` | Content group aggregates | ContentGroupService |
| `portfolio` | Portfolio-level metrics | PortfolioMetricsService |
| `ctr-benchmark` | CTR benchmark data | CtrBenchmarkService |
| `index-coverage` | Index coverage status | IndexCoverageService |

### Invalidation Strategy

1. **Pub/Sub invalidation**: When GSC sync completes, `invalidateAfterGscSync()` publishes to Redis channel
2. **All subscribed instances** receive the message and clear relevant cache keys
3. **TTL backup**: If pub/sub fails, TTL ensures eventual cache refresh

---

## SERP Cache (12-24 Hours)

### File Location
- `open-seo-main/src/server/lib/cache/serp-cache.ts`

### TTL Rationale

```typescript
SERP_CACHE_TTL = 24 * 60 * 60  // 24 hours (Redis L2)
MEMORY_CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour (in-memory L1)
```

**Why 12-24 hours?**

1. **SERP results change slowly**: Google updates rankings gradually. Position changes typically occur over days/weeks, not hours.

2. **API cost optimization**: DataForSEO SERP API calls are expensive. Caching for 24 hours dramatically reduces API costs.

3. **Rate limit protection**: Aggressive caching prevents hitting API rate limits during content brief generation spikes.

4. **Use case alignment**: SERP data is used for content briefs and competitive analysis. Weekly comparison is more meaningful than hourly tracking.

### Two-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Application                       │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  L1: In-Memory BoundedCache (1 hour TTL, 500 max)   │
│  - Fast lookups (sub-ms)                            │
│  - Bounded to prevent memory leaks                  │
│  - Cross-instance invalidation via pub/sub          │
└─────────────────────┬───────────────────────────────┘
                      │ miss
                      ▼
┌─────────────────────────────────────────────────────┐
│  L2: Redis Cache (24 hour TTL)                      │
│  - Persistent across restarts                       │
│  - Shared across instances                          │
└─────────────────────┬───────────────────────────────┘
                      │ miss
                      ▼
┌─────────────────────────────────────────────────────┐
│  DataForSEO API (origin)                            │
│  - $0.01+ per request                               │
│  - Rate limited                                     │
└─────────────────────────────────────────────────────┘
```

---

## Cache Warming (CACHE-02 Fix)

### Problem

After overnight GSC sync completes:
1. Old cache is invalidated
2. No new cache is populated
3. First user to load dashboard hits cold cache
4. Dashboard loads slowly while data is fetched and cached

### Solution

Cache warming job is triggered by `analytics:sync-completed` event.

### File Location
- `open-seo-main/src/server/cache/cache-warming.ts`

### Implementation

```typescript
// Triggered in analytics-event-consumer.ts
eventBus.on('analytics:sync-completed', async (payload) => {
  // Non-blocking: uses setImmediate
  warmAnalyticsCacheForSite(payload.siteId);
});
```

### Warming Targets

| Target | Priority | Typical Duration |
|--------|----------|------------------|
| Dashboard metrics | High | 200-500ms |
| Trend detection | High | 300-800ms |
| Striking distance | Medium | 200-400ms |
| Cannibalization | Medium | 400-1000ms |

### Characteristics

- **Non-blocking**: Uses `setImmediate` to not delay sync completion notification
- **Fault-tolerant**: Uses `Promise.allSettled` so partial failures don't affect other queries
- **Observable**: Logs warming duration for performance monitoring
- **Idempotent**: Safe to call multiple times (overwrites existing cache)

---

## Key Design Decisions

### 1. Why different TTLs?

| Factor | Analytics (30min) | SERP (24hr) |
|--------|-------------------|-------------|
| Data change frequency | Daily (GSC sync) | Weekly (ranking changes) |
| Query cost | Low (PostgreSQL) | High (DataForSEO API) |
| User expectation | "Current" data | "Recent" analysis |
| Invalidation trigger | GSC sync event | Manual/TTL only |

### 2. Why proactive invalidation for analytics but not SERP?

- **Analytics**: Data source (GSC) is under our control. We know exactly when data changes.
- **SERP**: Data source (Google SERPs) is external. We can't know when rankings change.

### 3. Why cache warming only for analytics?

- **Analytics**: Predictable sync schedule (3:00 AM). We know when to warm.
- **SERP**: Unpredictable access patterns. Warming would require speculative API calls.

---

## Monitoring

### Metrics to Track

1. **Cache hit rate**: Should be >80% during business hours
2. **Warming duration**: Should be <2s for full warming cycle
3. **Warming failures**: Should be rare (<1% of sync events)

### Log Patterns

```
# Successful warming
INFO cache-warming: Cache warming completed successfully {warmedCount: 4, durationMs: 1234}

# Partial failure
WARN cache-warming: Cache warming completed with failures {warmedCount: 3, failedCount: 1}

# Cache hit
DEBUG analytics-cache: Cache hit {key: "analytics:dashboard:..."}

# Cache invalidation
INFO cache-invalidation: Cache invalidation published {reason: "gsc_sync_complete"}
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/server/cache/analytics-cache.ts` | Unified analytics cache service |
| `src/server/cache/cache-invalidation.ts` | Redis pub/sub invalidation |
| `src/server/cache/cache-warming.ts` | Cache warming after sync |
| `src/server/cache/index.ts` | Barrel exports |
| `src/server/lib/cache/serp-cache.ts` | SERP cache with L1/L2 |
| `src/server/features/analytics/events/analytics-event-consumer.ts` | Event handler for sync completion |
