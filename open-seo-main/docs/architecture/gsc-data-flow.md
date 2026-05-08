# GSC Data Flow Architecture

> **Purpose**: Document the 3-location storage pattern for GSC analytics data and when to query each source.

## Architecture Overview

GSC data flows through a multi-tier storage architecture designed for both high-volume ingestion (125M rows/day) and sub-second query performance.

```
                                GSC DATA FLOW ARCHITECTURE
                                ==========================

   +-----------------+
   |   GSC API       |  Source: Google Search Console
   |   (25K/request) |  Latency: 2-3 days
   +-----------------+
            |
            v
   +-----------------+
   | GscBridgeService|  Auth + API wrapper
   +-----------------+
            |
            v
   +---------------------+
   | GscPaginationService|  AsyncGenerator pagination (up to 50K/day/site)
   +---------------------+
            |
            v
   +-------------------------+
   | QueryAnalyticsRepository|  Batch upsert with ON CONFLICT
   +-------------------------+
            |
            v
   +=========================================================+
   |                                                         |
   |  TIMESCALEDB HYPERTABLE                                 |
   |  =====================                                  |
   |  Table: seo_gsc_query_analytics                         |
   |  - 7-day chunks                                         |
   |  - Compression after 30 days (90-95% reduction)         |
   |  - 5-year retention policy                              |
   |                                                         |
   +=========================================================+
            |                                   |
            | (hourly refresh)                  | (read)
            v                                   v
   +----------------------+          +-------------------+
   | CONTINUOUS AGGREGATES|          |   REDIS CACHE     |
   | ====================|           | ================= |
   | - growing_pages_cagg |          | Pattern:          |
   | - master_dashboard_  |          |   analytics:{type}|
   |     cagg             |          |   :{workspace}    |
   | Refresh: 1 hour      |          |   :{site}:{suffix}|
   +----------------------+          | TTL: 30 minutes   |
            |                        +-------------------+
            |                                   |
            +----------------+------------------+
                             |
                             v
                    +------------------+
                    |   API Response   |
                    |   (with cache    |
                    |    metadata)     |
                    +------------------+
```

## Storage Locations

### 1. TimescaleDB Hypertable (Primary Storage)

**Table**: `seo_gsc_query_analytics`

**Schema**:
```sql
CREATE TABLE seo_gsc_query_analytics (
  id UUID DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL,
  query_time TIMESTAMPTZ NOT NULL,
  query TEXT NOT NULL,
  page_url TEXT,
  country TEXT,
  device TEXT,
  search_appearance TEXT,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr REAL,
  position REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, query_time)
);
```

**Configuration**:
| Setting | Value | Purpose |
|---------|-------|---------|
| Chunk interval | 7 days | Optimal for 125M rows/day workload |
| Compression | After 30 days | 90-95% storage reduction |
| Retention | 5 years | Historical data lifecycle |
| Segment by | `site_id` | Compression optimization |
| Order by | `query_time DESC` | Range query optimization |

**Indexes**:
- `idx_gsc_query_site_time` - (site_id, query_time DESC)
- `idx_gsc_query_query` - (query)
- `idx_gsc_query_page` - (page_url)

**Use When**:
- Historical analysis spanning weeks/months/years
- Raw data access for custom aggregations
- Complex queries with WHERE clauses on multiple dimensions
- Data export and compliance requirements

**Performance**: <100ms for day-range queries with site_id filter

**Code Reference**:
```typescript
// src/server/features/analytics/repositories/QueryAnalyticsRepository.ts
const result = await db
  .select()
  .from(seoGscQueryAnalytics)
  .where(
    and(
      eq(seoGscQueryAnalytics.siteId, siteId),
      gte(seoGscQueryAnalytics.queryTime, startDate),
      lte(seoGscQueryAnalytics.queryTime, endDate)
    )
  );
```

---

### 2. Redis Cache (Hot Data Layer)

**Pattern**: `analytics:{type}:{workspaceId}:{siteId}:{suffix}`

**Cache Types**:
| Type | Description |
|------|-------------|
| `dashboard` | Master dashboard aggregates |
| `trends` | Trend detection results |
| `striking` | Striking distance keywords |
| `cannibalization` | Keyword cannibalization data |
| `clusters` | Topic cluster analysis |
| `groups` | Content group metrics |
| `portfolio` | Portfolio-level metrics |
| `ctr-benchmark` | CTR benchmark data |
| `index-coverage` | Index coverage status |

**Configuration**:
| Setting | Value | Purpose |
|---------|-------|---------|
| TTL | 30 minutes | Balance freshness vs API load |
| Stale handling | Return with `refreshAvailable: true` | Serve stale while refreshing |

**Cached Data Structure**:
```typescript
interface CachedData<T> {
  data: T;
  metadata: {
    cachedAt: string;       // ISO timestamp when cached
    dataAsOf: string;       // ISO timestamp of source data
    staleAfter: string;     // ISO timestamp when cache expires
    refreshAvailable: boolean; // True if data is stale
  };
}
```

**Use When**:
- Repeated reads of same data within 30 minutes
- Dashboard rendering (first load and subsequent)
- API responses where millisecond latency matters

**Performance**: <5ms

**Code Reference**:
```typescript
// src/server/cache/analytics-cache.ts
import { getAnalyticsCache } from '@/server/cache/analytics-cache';

const cache = getAnalyticsCache();

// Get with metadata
const result = await cache.get<DashboardData>(
  'dashboard',
  workspaceId,
  siteId,
  cacheKey
);

if (result && !result.metadata.refreshAvailable) {
  return result; // Serve from cache
}

// Set after computing fresh data
await cache.set('dashboard', workspaceId, siteId, data, dataAsOf, cacheKey);
```

---

### 3. Continuous Aggregates (Pre-computed Metrics)

**Views**:

#### `growing_pages_cagg` (Page-level daily metrics)
```sql
CREATE MATERIALIZED VIEW growing_pages_cagg
WITH (timescaledb.continuous) AS
SELECT
  site_id,
  page_url,
  time_bucket('1 day', query_time) AS day,
  SUM(clicks) AS total_clicks,
  SUM(impressions) AS total_impressions,
  AVG(ctr) AS avg_ctr,
  AVG(position) AS avg_position,
  COUNT(DISTINCT query) AS unique_queries
FROM seo_gsc_query_analytics
WHERE page_url IS NOT NULL
GROUP BY site_id, page_url, day;
```

#### `master_dashboard_cagg` (Site-level daily totals)
```sql
CREATE MATERIALIZED VIEW master_dashboard_cagg
WITH (timescaledb.continuous) AS
SELECT
  site_id,
  time_bucket('1 day', query_time) AS day,
  SUM(clicks) AS total_clicks,
  SUM(impressions) AS total_impressions,
  AVG(ctr) AS avg_ctr,
  AVG(position) AS avg_position,
  COUNT(DISTINCT query) AS unique_queries,
  COUNT(DISTINCT page_url) AS unique_pages,
  COUNT(DISTINCT country) AS unique_countries
FROM seo_gsc_query_analytics
GROUP BY site_id, day;
```

**Refresh Policy**:
| Setting | Value |
|---------|-------|
| Schedule | Every 1 hour |
| Start offset | 3 days back |
| End offset | 1 hour back |

**Use When**:
- Dashboard total clicks/impressions for a site
- Site-level KPIs (pre-aggregated)
- Multi-site portfolio views
- Sparkline data for recent trends

**Performance**: <10ms (pre-computed)

**Code Reference**:
```typescript
// src/server/features/analytics/services/MasterDashboardService.ts
const currentMetricsQuery = sql`
  SELECT
    site_id,
    SUM(daily_clicks) as total_clicks,
    SUM(daily_impressions) as total_impressions,
    AVG(avg_position) as avg_position,
    AVG(avg_ctr) as avg_ctr
  FROM master_dashboard_cagg
  WHERE bucket >= ${startDate}::date
    AND bucket <= ${endDate}::date
    AND site_id = ANY(${siteIds})
  GROUP BY site_id
`;
```

---

## Decision Table: Which Source to Query

| Use Case | Primary Source | Fallback | Why |
|----------|----------------|----------|-----|
| Dashboard total clicks today | `master_dashboard_cagg` | Hypertable | Pre-aggregated, <10ms |
| List top 10 queries | Redis cache | Hypertable | Cache hit <5ms, accuracy on miss |
| 30-day trend chart | Hypertable | - | Need daily granularity for charting |
| Compare month-over-month | `master_dashboard_cagg` | Hypertable | Site-level MoM already aggregated |
| Real-time accuracy check | Hypertable | - | Source of truth for audits |
| Export all data | Hypertable | - | Only complete data source |
| Page-level performance | `growing_pages_cagg` | Hypertable | Page metrics pre-aggregated |
| Keyword cannibalization | Redis cache | Computed from hypertable | Complex computation, cache result |
| Striking distance keywords | Redis cache | Computed from hypertable | Filtered subset, cache result |

---

## Data Freshness Guarantees

| Source | Freshness | Update Trigger |
|--------|-----------|----------------|
| Hypertable | Daily sync at 3 AM | `GscFullSyncService.fullSyncSite()` |
| Redis cache | 30 min TTL | On-demand + post-sync invalidation |
| Continuous aggregates | Hourly refresh | TimescaleDB policy (automatic) |

**Note**: GSC API has 2-3 day data latency. "Yesterday's data" is typically the freshest available.

---

## Cache Invalidation Flow

```
GSC Full Sync Completes
         |
         v
QueryAnalyticsRepository.insertBatch()
         |
         v
Redis pub/sub: analytics:invalidate:{workspaceId}:{siteId}
         |
         +---> AnalyticsCache.invalidate(workspaceId, siteId)
         |         |
         |         +---> Delete: analytics:dashboard:{workspace}:{site}:*
         |         +---> Delete: analytics:trends:{workspace}:{site}:*
         |         +---> Delete: analytics:striking:{workspace}:{site}:*
         |         +---> Delete: analytics:cannibalization:{workspace}:{site}:*
         |         +---> (... all cache types)
         |
         +---> Continuous aggregates: auto-refresh (hourly policy)
                   |
                   +---> growing_pages_cagg refreshed
                   +---> master_dashboard_cagg refreshed
```

**Manual Invalidation**:
```typescript
// Force refresh for a site
const cache = getAnalyticsCache();
await cache.invalidate(workspaceId, siteId);

// Force refresh entire workspace
await cache.invalidateAll(workspaceId);
```

---

## Performance Characteristics

| Operation | Source | Expected Latency | Notes |
|-----------|--------|------------------|-------|
| Dashboard load (warm) | Redis | <5ms | Cache hit |
| Dashboard load (cold) | Continuous agg + Redis set | <50ms | Query + cache |
| 7-day sparkline | Continuous agg | <10ms | Pre-aggregated |
| 30-day trend (1 site) | Hypertable | <100ms | Index on site_id, query_time |
| 90-day trend (1 site) | Hypertable | <200ms | Chunks may span compression |
| Export 1M rows | Hypertable | 5-10s | Streaming response recommended |
| Keyword search | Hypertable | <50ms | Index on query |
| Page search | Hypertable | <50ms | Index on page_url |

---

## Related Files

| File | Purpose |
|------|---------|
| `drizzle/migrations/0003_timescaledb_gsc_analytics.sql` | Hypertable, indexes, continuous aggregates |
| `src/db/gsc-analytics-schema.ts` | Drizzle schema definition |
| `src/server/cache/analytics-cache.ts` | Redis cache service |
| `src/server/features/analytics/services/GscPaginationService.ts` | GSC API pagination |
| `src/server/features/analytics/services/GscFullSyncService.ts` | Full sync orchestration |
| `src/server/features/analytics/services/MasterDashboardService.ts` | Dashboard queries |
| `src/server/features/analytics/repositories/QueryAnalyticsRepository.ts` | Hypertable CRUD |

---

## Code Examples

### Reading from Cache with Fallback to Database

```typescript
import { getAnalyticsCache } from '@/server/cache/analytics-cache';
import { sql } from 'drizzle-orm';

async function getDashboardData(workspaceId: string, siteId: string) {
  const cache = getAnalyticsCache();
  
  // 1. Try cache first
  const cached = await cache.get<DashboardData>('dashboard', workspaceId, siteId);
  if (cached && !cached.metadata.refreshAvailable) {
    return cached;
  }
  
  // 2. Query continuous aggregate
  const result = await db.execute(sql`
    SELECT
      SUM(daily_clicks) as total_clicks,
      SUM(daily_impressions) as total_impressions
    FROM master_dashboard_cagg
    WHERE site_id = ${siteId}
      AND bucket >= ${startDate}
      AND bucket <= ${endDate}
  `);
  
  // 3. Cache the result
  const data = transformResult(result);
  await cache.set('dashboard', workspaceId, siteId, data, new Date());
  
  return wrapWithMetadata(data, new Date());
}
```

### Querying Raw Hypertable for Historical Analysis

```typescript
import { db } from '@/db';
import { seoGscQueryAnalytics } from '@/db/gsc-analytics-schema';
import { and, eq, gte, lte, desc } from 'drizzle-orm';

async function getHistoricalTrend(siteId: string, startDate: Date, endDate: Date) {
  // Direct hypertable query for daily granularity
  const rows = await db
    .select({
      date: seoGscQueryAnalytics.queryTime,
      query: seoGscQueryAnalytics.query,
      clicks: seoGscQueryAnalytics.clicks,
      impressions: seoGscQueryAnalytics.impressions,
      position: seoGscQueryAnalytics.position,
    })
    .from(seoGscQueryAnalytics)
    .where(
      and(
        eq(seoGscQueryAnalytics.siteId, siteId),
        gte(seoGscQueryAnalytics.queryTime, startDate),
        lte(seoGscQueryAnalytics.queryTime, endDate)
      )
    )
    .orderBy(desc(seoGscQueryAnalytics.queryTime));
  
  return rows;
}
```

### Cache Invalidation After Sync

```typescript
import { getAnalyticsCache } from '@/server/cache/analytics-cache';

async function onSyncComplete(workspaceId: string, siteId: string) {
  const cache = getAnalyticsCache();
  
  // Invalidate all analytics caches for this site
  const deletedCount = await cache.invalidate(workspaceId, siteId);
  
  console.log(`Invalidated ${deletedCount} cache keys for site ${siteId}`);
  
  // Continuous aggregates will auto-refresh on their hourly schedule
  // No manual action needed
}
```
