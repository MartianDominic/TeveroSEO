# Phase 96: Agency Analytics Platform

> **Mission**: Build the analytics dashboard that makes TeveroSEO the only tool agencies need — eliminating GSC account switching, surfacing actionable insights, and proving ROI to clients.

**Estimated Duration**: 56-74 dev days (Tiers 1-3)  
**Infrastructure Cost**: $0 incremental (Contabo VPS already provisioned)  
**Storage Cost**: ~$0.25/site/month for 5-year retention  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Gap Analysis: GSC v0 Full Usage](#gap-analysis-gsc-v0-full-usage)
4. [SEOGets Feature Analysis](#seogets-feature-analysis)
5. [Prioritization Matrix](#prioritization-matrix)
6. [Implementation Phases](#implementation-phases)
7. [Schema Designs](#schema-designs)
8. [API & Rate Limit Strategy](#api--rate-limit-strategy)
9. [UI/UX Specifications](#uiux-specifications)
10. [Cost Analysis](#cost-analysis)
11. [Risk Mitigation](#risk-mitigation)

---

## Executive Summary

### The $100M Agency Problem

Agencies managing 50-500 client sites currently:
- Switch between GSC accounts 100+ times/day
- Export CSV files manually for reporting
- Miss ranking opportunities buried in data
- Cannot prove content ROI with attribution
- Lose historical data after 16 months

### Our Solution

A unified analytics layer that:
1. **Aggregates** all client GSC data in one master dashboard
2. **Extends** data retention from 16 months → 5 years
3. **Surfaces** actionable insights (growing/decaying, striking distance, cannibalization)
4. **Automates** reporting with white-label client portals
5. **Proves ROI** with content attribution tracking

### Why This Matters

| Competitor | Price | Sites | Our Advantage |
|------------|-------|-------|---------------|
| SEOGets | $49-299/mo | 100-500 | Full SEO platform, not just analytics |
| Agency Analytics | $149+/mo | Unlimited | Integrated audits + content generation |
| Search Console | Free | 1 per view | Multi-site aggregation + extended history |

**Value Prop**: Agencies pay $199-499/mo for analytics alone. We include it as part of a complete platform.

---

## Current State Analysis

### What Already Exists

#### Database Schemas (open-seo-main)

```
analytics-schema.ts
├── seo_gsc_snapshots      — Daily site-level metrics (clicks, impressions, position)
├── gsc_query_snapshots    — Query-level data (LIMITED: only stores top queries)
└── seo_ga4_snapshots      — GA4 integration (sessions, conversions)

platform-connection-schema.ts
├── platform_connections   — OAuth tokens for 15+ platforms including GSC
└── Supports multi-site with workspace_id
```

#### Services

| Service | Location | Status |
|---------|----------|--------|
| GscBridgeService | `/open-seo-main/src/server/services/` | HTTP bridge to AI-Writer, 6h cache, 100 calls/day limit |
| gsc_service.py | `/AI-Writer/backend/services/` | Full GSC implementation (OAuth, search analytics, indexing API) |
| CannibalizationService | `/open-seo-main/src/server/services/` | **EXISTS** — detects keyword overlap, needs UI exposure |
| KeywordDeduplicator | `/open-seo-main/src/server/features/keywords/` | Clusters similar queries |

#### Dashboard Components

```
/open-seo-main/src/lib/dashboard/
├── health-score.ts        — Composite score (traffic 30%, rankings 25%, tech 20%, backlinks 15%, content 10%)
└── Existing widgets for traffic trends, top queries
```

### Critical Gaps

| Gap | Current | Required | Impact |
|-----|---------|----------|--------|
| **Query storage** | ~1,000-5,000 rows | 25,000 per request | Missing long-tail opportunities |
| **Multi-site view** | Site-by-site | Aggregated master dashboard | Agency workflow broken |
| **Data retention** | 16 months (GSC limit) | 5 years | No YoY comparison possible |
| **Growing/Decaying** | Not implemented | Algorithm + UI tabs | #1 requested feature |
| **Striking Distance** | Not implemented | Positions 11-20 filter | Quick wins invisible |
| **Annotations** | Not implemented | Core updates + custom | Context missing for drops |

---

## Gap Analysis: GSC v0 Full Usage

### GSC API Capabilities vs Our Usage

| API Feature | GSC Limit | Our Current Usage | v0 Target |
|-------------|-----------|-------------------|-----------|
| Rows per request | 25,000 | ~1,000 | **25,000** |
| Requests per minute | 200 | ~10 | 50-100 |
| URL Inspection/day | 2,000 | 0 | 500-1,000 |
| Dimensions | 6 (query, page, country, device, date, searchAppearance) | 3 | **All 6** |
| Sitemaps API | Unlimited | Not used | Full integration |
| Index Coverage API | Unlimited | Not used | Daily sync |

### v0 Full Usage Roadmap

#### Phase A: Maximize Query Capture (Week 1-2)
```python
# Current: Single request, ~1000 rows
response = service.search_analytics(site_url, start_date, end_date, dimensions=['query'])

# v0: Paginated extraction, 25K per request, dimension combinations
for dimension_combo in [['query'], ['query', 'page'], ['query', 'country'], ['page']]:
    row_offset = 0
    while True:
        response = service.search_analytics(
            site_url, start_date, end_date,
            dimensions=dimension_combo,
            row_limit=25000,
            start_row=row_offset
        )
        if len(response.rows) < 25000:
            break
        row_offset += 25000
```

#### Phase B: URL Inspection Integration (Week 3-4)
```python
# Prioritize inspection for:
# 1. New content (published < 7 days)
# 2. Updated content (modified in last 7 days)
# 3. Decaying pages (traffic down >20% MoM)
# 4. High-value pages not in index

inspection_priority_queue = [
    *new_content_urls[:500],      # 500/day for new content
    *decaying_urls[:300],          # 300/day for decay investigation
    *high_value_not_indexed[:200]  # 200/day for indexing push
]
```

#### Phase C: Index Coverage Sync (Week 5-6)
```sql
-- New table: page_index_status
CREATE TABLE page_index_status (
    id UUID PRIMARY KEY,
    site_id UUID REFERENCES sites(id),
    url TEXT NOT NULL,
    coverage_state TEXT, -- 'Submitted and indexed', 'Crawled - currently not indexed', etc.
    last_crawl_time TIMESTAMPTZ,
    indexing_state TEXT, -- 'Indexed', 'Not indexed'
    referring_urls TEXT[],
    crawled_as TEXT, -- 'Desktop', 'Mobile'
    robot_txt_state TEXT,
    inspection_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, url)
);

CREATE INDEX idx_page_index_status_state ON page_index_status(site_id, coverage_state);
CREATE INDEX idx_page_index_status_crawl ON page_index_status(site_id, last_crawl_time);
```

---

## SEOGets Feature Analysis

### Feature-by-Feature Assessment

| SEOGets Feature | Build Priority | Effort | Agency Value | Notes |
|-----------------|----------------|--------|--------------|-------|
| **Master Dashboard** | MUST HAVE | 5d | Critical | Multi-site aggregation, the killer feature |
| **Growing Pages Tab** | MUST HAVE | 3d | Critical | Algorithm: 3-week trend, >10% growth |
| **Decaying Pages Tab** | MUST HAVE | 3d | Critical | Algorithm: 3-week trend, >10% decline |
| **Striking Distance** | MUST HAVE | 2d | High | Positions 11-20, quick win opportunities |
| **Multi-Query Filter** | MUST HAVE | 2d | High | Boolean AND/OR/NOT query filtering |
| **Annotations** | MUST HAVE | 2d | High | Core updates auto-imported + custom |
| **Cannibalization** | MUST HAVE | 1d | High | **Already built**, just needs UI |
| **Content Groups** | SHOULD HAVE | 4d | High | Folder-based + custom grouping |
| **Topic Clusters** | SHOULD HAVE | 5d | High | Hub + spoke visualization |
| **Branded vs Non-Branded** | SHOULD HAVE | 2d | Medium | Brand term detection + split metrics |
| **CTR Benchmark** | SHOULD HAVE | 3d | Medium | Position-based CTR curves |
| **Index Reporting** | SHOULD HAVE | 4d | Medium | Coverage states, indexing requests |
| **Portfolio Metrics** | SHOULD HAVE | 3d | Medium | Cross-client totals, avg position |
| **Content Decay Heatmap** | NICE TO HAVE | 3d | Medium | Calendar visualization |
| **PAA Filtering** | NICE TO HAVE | 2d | Low | "People Also Ask" appearance filter |
| **Query Counting 50K** | NICE TO HAVE | 5d | Medium | Full dimension export |
| **Magic Links** | NICE TO HAVE | 4d | Low | Internal linking suggestions |
| **Privacy Blur** | NICE TO HAVE | 2d | Low | Client presentation mode |
| **Mobile PWA** | SKIP | 8d | Low | Browser works fine |
| **5-Year Extended** | SKIP | 10d | Low | 2 years sufficient for most agencies |
| **Real-time Sync** | SKIP | 15d | Low | Daily batch is fine |

### What Makes SEOGets Successful

1. **Zero-friction onboarding**: OAuth connect → instant dashboard
2. **Growing/Decaying as primary view**: Not buried in reports
3. **Annotations with core updates**: Context for every drop
4. **Multi-site aggregation**: The "agency mode" toggle
5. **Export everything**: CSV, Google Sheets, API

### What We Can Do Better

1. **Integrated audits**: SEOGets shows data, we show data + actionable fixes
2. **Content generation**: Decaying page → regenerate with AI
3. **Internal linking**: Magic links that actually get implemented
4. **Client portals**: White-label with brand voice
5. **Voice compliance**: Generated content matches brand

---

## Prioritization Matrix

### Tier 1: MUST HAVE (17-23 days)

| Feature | Days | Dependencies | Acceptance Criteria |
|---------|------|--------------|---------------------|
| Master Dashboard | 5d | site_tags schema | View all sites, filter by tag, aggregate metrics |
| Growing Pages Tab | 3d | query storage upgrade | 3-week trend detection, >10% threshold, sortable |
| Decaying Pages Tab | 3d | query storage upgrade | Same algorithm, decline direction |
| Striking Distance | 2d | None | Positions 11-20 filter, click potential estimate |
| Multi-Query Filter | 2d | None | AND/OR/NOT, regex support, saved filters |
| Annotations | 2d | annotations schema | Core updates auto-imported, custom notes, timeline |
| Cannibalization UI | 1d | Existing service | Expose existing CannibalizationService in dashboard |

**Milestone**: Agency-ready analytics MVP

### Tier 2: SHOULD HAVE (23-30 days)

| Feature | Days | Dependencies | Acceptance Criteria |
|---------|------|--------------|---------------------|
| Topic Clusters | 5d | content_groups schema | Hub detection, spoke mapping, coverage gaps |
| Content Groups | 4d | content_groups schema | Folder + custom rules, group-level metrics |
| Branded vs Non-Branded | 2d | brand terms config | Auto-detect + manual brand terms, split view |
| CTR Benchmark | 3d | Industry data seed | Position-CTR curves, above/below benchmark |
| Index Reporting | 4d | page_index_status schema | Coverage states, batch indexing requests |
| Portfolio Metrics | 3d | site_tags schema | Cross-client totals, trends, avg metrics |
| Client Visibility | 2d | client_visibility schema | Per-metric visibility toggles for client portal |

**Milestone**: Full-featured analytics platform

### Tier 3: NICE TO HAVE (16-21 days)

| Feature | Days | Dependencies | Acceptance Criteria |
|---------|------|--------------|---------------------|
| Content Decay Heatmap | 3d | Growing/Decaying | Calendar view, severity colors, drill-down |
| PAA Filtering | 2d | searchAppearance dimension | Filter queries appearing in PAA |
| Query Counting 50K | 5d | Extended pagination | Full export with all dimensions |
| Magic Links | 4d | Topic Clusters | Internal linking suggestions with anchor text |
| Privacy Blur | 2d | None | Numbers-only mode for client presentations |

**Milestone**: Competitive parity with SEOGets

### Tier 4: SKIP (for now)

| Feature | Reason |
|---------|--------|
| Mobile PWA | Browser responsive is sufficient |
| 5-Year Extended | 2 years covers most agency needs |
| Real-time Sync | Daily batch meets requirements |
| Custom Dashboards | Premature—learn from usage first |

---

## Implementation Phases

### Phase 96-01: GSC Data Foundation (Days 1-10)

**Goal**: Maximize GSC data capture and storage

```
Tasks:
├── Upgrade query storage to 25K rows per sync
├── Add dimension combinations (query+page, query+country)
├── Implement paginated extraction with rate limiting
├── Create seo_gsc_query_analytics table (full storage)
├── Build daily sync job with BullMQ
├── Add data retention manager (5-year partitioning)
└── Create GSC sync health dashboard
```

**Schema**:
```sql
CREATE TABLE seo_gsc_query_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    query_date DATE NOT NULL,
    query TEXT NOT NULL,
    page_url TEXT,
    country TEXT,
    device TEXT,
    search_appearance TEXT,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr DECIMAL(5,4),
    position DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, query_date, query, page_url, country, device)
) PARTITION BY RANGE (query_date);

-- Monthly partitions for efficient queries
CREATE TABLE seo_gsc_query_analytics_2026_01 PARTITION OF seo_gsc_query_analytics
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... repeat for each month
```

**Deliverables**:
- Full 25K query capture per sync
- 5-year data retention with monthly partitions
- Sync health monitoring

### Phase 96-02: Master Dashboard (Days 11-20)

**Goal**: Multi-site aggregation with filtering

```
Tasks:
├── Create site_tags and client_tags schemas
├── Build master dashboard route (/dashboard/analytics)
├── Implement site aggregation queries
├── Add tag-based filtering (client, project, region)
├── Create sparkline components for trends
├── Build KPI cards (total clicks, impressions, avg position)
└── Add date range picker with comparison mode
```

**UI Components** (design-system-v6 compliant):
```tsx
// Master Dashboard Layout
<DashboardShell>
  <DashboardHeader>
    <DateRangePicker comparison={true} />
    <TagFilter tags={clientTags} />
    <SitePicker multi={true} />
  </DashboardHeader>
  
  <KPIGrid>
    <KPICard metric="clicks" comparison={previousPeriod} />
    <KPICard metric="impressions" comparison={previousPeriod} />
    <KPICard metric="avgPosition" comparison={previousPeriod} />
    <KPICard metric="ctr" comparison={previousPeriod} />
  </KPIGrid>
  
  <SiteTable>
    {sites.map(site => (
      <SiteRow 
        key={site.id}
        sparkline={site.clicksTrend}
        metrics={site.metrics}
        tags={site.tags}
      />
    ))}
  </SiteTable>
</DashboardShell>
```

**Deliverables**:
- Multi-site master dashboard
- Tag-based filtering
- Comparison mode (WoW, MoM, YoY)

### Phase 96-03: Actionable Insights (Days 21-35)

**Goal**: Growing, Decaying, Striking Distance, Cannibalization

```
Tasks:
├── Implement growing/decaying algorithm
│   ├── 3-week rolling comparison
│   ├── >10% threshold (configurable)
│   └── Minimum traffic filter (>100 impressions)
├── Build Growing Pages tab with sorting
├── Build Decaying Pages tab with action buttons
├── Create Striking Distance report (positions 11-20)
├── Expose CannibalizationService in UI
├── Add query filtering (AND/OR/NOT, regex)
└── Build annotations timeline
```

**Growing/Decaying Algorithm**:
```typescript
interface TrendAnalysis {
  pageUrl: string;
  currentClicks: number;
  previousClicks: number;
  changePercent: number;
  trend: 'growing' | 'decaying' | 'stable';
  confidence: 'high' | 'medium' | 'low';
}

function analyzePageTrends(
  siteId: string,
  options: { 
    periodDays: number; // default 21 (3 weeks)
    threshold: number;  // default 0.10 (10%)
    minImpressions: number; // default 100
  }
): TrendAnalysis[] {
  // Compare current 3-week period vs previous 3-week period
  const currentPeriod = getMetrics(siteId, -21, 0);
  const previousPeriod = getMetrics(siteId, -42, -21);
  
  return pages.map(page => {
    const change = (current - previous) / previous;
    return {
      pageUrl: page.url,
      currentClicks: current,
      previousClicks: previous,
      changePercent: change,
      trend: change > threshold ? 'growing' : change < -threshold ? 'decaying' : 'stable',
      confidence: impressions > 500 ? 'high' : impressions > 100 ? 'medium' : 'low'
    };
  });
}
```

**Deliverables**:
- Growing/Decaying tabs with algorithm
- Striking Distance report
- Cannibalization UI
- Annotations timeline

### Phase 96-04: Content Intelligence (Days 36-50)

**Goal**: Topic Clusters, Content Groups, Index Reporting

```
Tasks:
├── Create content_groups schema
├── Build content group manager UI
├── Implement folder-based auto-grouping
├── Add custom grouping rules
├── Create topic cluster detection algorithm
├── Build cluster visualization (hub + spokes)
├── Integrate URL Inspection API
├── Build index coverage dashboard
└── Add batch indexing request feature
```

**Topic Cluster Detection**:
```typescript
interface TopicCluster {
  hubPage: string;
  hubTopic: string;
  spokePages: Array<{
    url: string;
    topic: string;
    internalLinks: number;
    linkToHub: boolean;
  }>;
  coverage: number; // 0-100% of subtopics covered
  gaps: string[]; // Missing subtopics
}

function detectTopicClusters(siteId: string): TopicCluster[] {
  // 1. Identify hub pages (high internal link count, broad topic)
  // 2. Find spoke pages (link to hub, related keywords)
  // 3. Calculate coverage vs keyword research
  // 4. Identify gaps (subtopics without content)
}
```

**Deliverables**:
- Content Groups with metrics
- Topic Cluster visualization
- Index Coverage dashboard
- Batch indexing requests

### Phase 96-05: Client Portal & Polish (Days 51-65)

**Goal**: White-label client views, exports, final polish

```
Tasks:
├── Create client_visibility schema
├── Build client portal route (/clients/:id/analytics)
├── Implement per-metric visibility toggles
├── Add branded/non-branded split
├── Build CTR benchmark visualization
├── Create portfolio metrics dashboard
├── Add CSV/Sheets export for all reports
├── Implement privacy blur mode
└── Build email report scheduler
```

**Client Visibility Schema**:
```sql
CREATE TABLE client_visibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    
    -- Per-metric visibility
    show_clicks BOOLEAN DEFAULT true,
    show_impressions BOOLEAN DEFAULT true,
    show_position BOOLEAN DEFAULT true,
    show_ctr BOOLEAN DEFAULT true,
    show_queries BOOLEAN DEFAULT false,  -- Hide actual queries by default
    show_pages BOOLEAN DEFAULT true,
    show_competitors BOOLEAN DEFAULT false,
    
    -- Report access
    can_view_growing BOOLEAN DEFAULT true,
    can_view_decaying BOOLEAN DEFAULT true,
    can_view_cannibalization BOOLEAN DEFAULT false,
    can_export BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, workspace_id)
);
```

**Deliverables**:
- White-label client portal
- Visibility controls
- Export functionality
- Privacy blur mode

---

## Schema Designs

### Core Analytics Tables

```sql
-- Site tagging for multi-site dashboards
CREATE TABLE site_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    tag_color TEXT, -- Hex color for UI
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, tag_name)
);

CREATE INDEX idx_site_tags_name ON site_tags(tag_name);

-- Client-level tagging
CREATE TABLE client_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    tag_color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, tag_name)
);

-- Content grouping
CREATE TABLE content_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    match_type TEXT NOT NULL, -- 'folder', 'regex', 'manual'
    match_pattern TEXT, -- e.g., '/blog/' or '^/products/.*'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, name)
);

CREATE TABLE content_group_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES content_groups(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    manually_added BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, page_url)
);

-- Annotations timeline
CREATE TABLE annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE, -- NULL for global
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    annotation_date DATE NOT NULL,
    annotation_type TEXT NOT NULL, -- 'core_update', 'site_change', 'custom'
    title TEXT NOT NULL,
    description TEXT,
    impact TEXT, -- 'positive', 'negative', 'neutral', 'unknown'
    auto_generated BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_annotations_date ON annotations(site_id, annotation_date);

-- Google algorithm updates (auto-populated)
CREATE TABLE google_algorithm_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    update_date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    update_type TEXT, -- 'core', 'spam', 'helpful_content', 'product_reviews', 'link_spam'
    confirmed BOOLEAN DEFAULT true,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page index status (URL Inspection API)
CREATE TABLE page_index_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    coverage_state TEXT, -- 'Submitted and indexed', 'Crawled - currently not indexed', etc.
    indexing_state TEXT, -- 'Indexed', 'Not indexed'
    last_crawl_time TIMESTAMPTZ,
    crawled_as TEXT, -- 'Googlebot Desktop', 'Googlebot Smartphone'
    robots_txt_state TEXT, -- 'ALLOWED', 'DISALLOWED'
    canonical_url TEXT,
    is_canonical BOOLEAN,
    mobile_usability TEXT, -- 'MOBILE_FRIENDLY', 'NOT_MOBILE_FRIENDLY'
    rich_results JSONB, -- Array of detected rich results
    inspection_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, page_url)
);

CREATE INDEX idx_page_index_coverage ON page_index_status(site_id, coverage_state);
CREATE INDEX idx_page_index_crawl ON page_index_status(site_id, last_crawl_time);

-- Indexing request tracking
CREATE TABLE indexing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    request_type TEXT NOT NULL, -- 'URL_UPDATED', 'URL_DELETED'
    status TEXT DEFAULT 'pending', -- 'pending', 'submitted', 'success', 'failed'
    submitted_at TIMESTAMPTZ,
    response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_indexing_requests_status ON indexing_requests(site_id, status);
```

### Data Storage: TimescaleDB Hypertables

**Why TimescaleDB:** At $100M agency scale (5,000 sites × 25K rows/day = 125M rows/day), native PostgreSQL partitioning degrades. TimescaleDB provides:
- **Automatic chunking** — No manual partition management
- **90-95% compression** — Critical for 5-year retention (228B rows → ~15B compressed)
- **Continuous aggregates** — Incremental refresh (seconds) vs full re-scan (30-60 min)
- **Transparent queries** — Same SQL syntax, hypertable handles chunk routing

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Full query analytics as hypertable (7-day chunks)
CREATE TABLE seo_gsc_query_analytics (
    id UUID DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    query_time TIMESTAMPTZ NOT NULL,  -- TIMESTAMPTZ required for hypertables
    query TEXT NOT NULL,
    page_url TEXT,
    country CHAR(2),
    device TEXT,
    search_appearance TEXT,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr DECIMAL(5,4),
    position DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, query_time)  -- Must include time column
);

-- Convert to hypertable with 7-day chunks
SELECT create_hypertable('seo_gsc_query_analytics', 'query_time', chunk_time_interval => INTERVAL '7 days');

-- Compression policy: chunks older than 30 days (90-95% storage reduction)
ALTER TABLE seo_gsc_query_analytics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'site_id',
    timescaledb.compress_orderby = 'query_time DESC'
);
SELECT add_compression_policy('seo_gsc_query_analytics', compress_after => INTERVAL '30 days');

-- Retention policy: drop chunks older than 5 years
SELECT add_retention_policy('seo_gsc_query_analytics', drop_after => INTERVAL '5 years');

-- Continuous aggregate for growing/decaying (incremental refresh)
CREATE MATERIALIZED VIEW growing_pages_cagg
WITH (timescaledb.continuous) AS
SELECT
    site_id,
    page_url,
    time_bucket('1 day', query_time) AS bucket,
    SUM(clicks) AS daily_clicks,
    SUM(impressions) AS daily_impressions,
    AVG(position) AS avg_position
FROM seo_gsc_query_analytics
GROUP BY site_id, page_url, time_bucket('1 day', query_time)
WITH NO DATA;

-- Auto-refresh every hour (only processes new data)
SELECT add_continuous_aggregate_policy('growing_pages_cagg',
    start_offset => INTERVAL '42 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);
```

---

## API & Rate Limit Strategy

### GSC API Budget Allocation

| Operation | Daily Budget | Burst Limit | Notes |
|-----------|--------------|-------------|-------|
| Search Analytics | 150 requests/site | 50/minute | Full 25K extraction |
| URL Inspection | 1,000/workspace | 100/minute | Prioritized by decay |
| Sitemaps | 50/site | 10/minute | Weekly refresh |
| Index Coverage | 10/site | 5/minute | Daily summary |

### Rate Limiting Implementation

```typescript
// BullMQ rate limiter configuration
const gscSyncQueue = new Queue('gsc-sync', {
  limiter: {
    max: 50,        // 50 requests
    duration: 60000 // per minute
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Priority-based job scheduling
interface GscSyncJob {
  siteId: string;
  syncType: 'full' | 'incremental' | 'inspection';
  priority: 1 | 2 | 3; // 1 = highest
}

// Full sync: priority 2, runs daily at 3 AM
// Incremental: priority 1, runs hourly for active sites
// Inspection: priority 3, runs after decay detection
```

### Caching Strategy

| Data Type | Cache TTL | Storage |
|-----------|-----------|---------|
| Query aggregates | 6 hours | Redis |
| Page metrics | 1 hour | Redis |
| Growing/Decaying | 6 hours | Redis + Postgres |
| Index status | 24 hours | Postgres |
| Annotations | Indefinite | Postgres |

---

## UI/UX Specifications

### Design System Compliance (v6)

```
Typography:
├── Headers: Newsreader (serif)
├── Body: Geist (sans)
└── Mono: JetBrains Mono (code/numbers)

Colors:
├── Primary: HSL(222, 47%, 11%) — ink-900
├── Success: HSL(142, 76%, 36%) — green-600
├── Danger: HSL(0, 84%, 60%) — red-500
├── Warning: HSL(38, 92%, 50%) — amber-500
└── Backgrounds: ghost-edge shadows (0 0 0 1px ink-100/5)

Spacing:
├── Minimum tap target: 44px
├── Card padding: 16px-24px
├── Grid gap: 16px
└── Type floor: 12px
```

### Key Views

#### 1. Master Dashboard (`/dashboard/analytics`)
```
┌─────────────────────────────────────────────────────────────────┐
│  [📅 Date Range ▾]  [🏷️ Tags ▾]  [🌐 Sites ▾]  [⚡ Compare ▾]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ 1.2M    │  │ 45.2M   │  │ 12.3    │  │ 2.7%    │           │
│  │ Clicks  │  │ Impr    │  │ Avg Pos │  │ CTR     │           │
│  │ +15.2%  │  │ +8.7%   │  │ -0.8    │  │ +0.3%   │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Site                │ Clicks   │ Trend    │ Tags         │ │
│  ├─────────────────────┼──────────┼──────────┼──────────────┤ │
│  │ client-a.com        │ 45.2K    │ ▁▂▃▅▆▇█  │ [E-comm]     │ │
│  │ client-b.io         │ 32.1K    │ ▇▆▅▄▃▂▁  │ [SaaS]       │ │
│  │ client-c.co         │ 28.9K    │ ▃▃▄▄▅▅▆  │ [Agency]     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Growing/Decaying View (`/dashboard/analytics/trends`)
```
┌─────────────────────────────────────────────────────────────────┐
│  [🌱 Growing]  [📉 Decaying]  [⚡ Striking]  [🔀 Cannibal]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filter: [All Queries ▾]  Threshold: [10% ▾]  Min Impr: [100]  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Page                          │ Change  │ Clicks │ Action │ │
│  ├───────────────────────────────┼─────────┼────────┼────────┤ │
│  │ /blog/seo-guide-2026          │ +127%   │ 2.3K   │ [View] │ │
│  │ /products/analytics-tool      │ +89%    │ 1.8K   │ [View] │ │
│  │ /resources/keyword-research   │ +67%    │ 1.2K   │ [View] │ │
│  │ /case-studies/agency-growth   │ +52%    │ 890    │ [View] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Annotations: ─●─────●───────●─────────●────────────────────── │
│               Jan    Feb      Mar       Apr                     │
│               Core   Site     HCU      Spam                     │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Topic Clusters (`/dashboard/analytics/clusters`)
```
┌─────────────────────────────────────────────────────────────────┐
│  Topic Clusters — client-a.com                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│         ┌─────────────┐                                         │
│    ┌────│  SEO Guide  │────┐                                    │
│    │    │    (Hub)    │    │                                    │
│    │    └─────────────┘    │                                    │
│    │          │            │                                    │
│    ▼          ▼            ▼                                    │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                           │
│ │On-Pg │ │Tech  │ │Links │ │Local │  Coverage: 78%             │
│ │ SEO  │ │ SEO  │ │Build │ │ SEO  │  Missing: Voice Search,    │
│ └──────┘ └──────┘ └──────┘ └──────┘          AI SEO            │
│                                                                 │
│  [+ Create Cluster]  [Generate Missing Content]                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cost Analysis

### Storage Costs (PostgreSQL)

| Data Type | Per Site/Month | 100 Sites | 500 Sites |
|-----------|----------------|-----------|-----------|
| Query Analytics (25K/day) | ~50MB | 5GB | 25GB |
| Page Metrics | ~5MB | 500MB | 2.5GB |
| Index Status | ~2MB | 200MB | 1GB |
| Annotations | ~1MB | 100MB | 500MB |
| **Total** | ~58MB | **5.8GB** | **29GB** |

At Contabo rates ($6.99/mo for 400GB NVMe):
- **100 sites**: $0.10/mo storage
- **500 sites**: $0.50/mo storage

### API Costs

| Service | Free Tier | Our Usage | Monthly Cost |
|---------|-----------|-----------|--------------|
| GSC API | Unlimited | Unlimited | **$0** |
| Redis (Upstash) | 10K/day | Included in VPS | **$0** |
| PostgreSQL | N/A | Contabo VPS | **$0** |

### Total Infrastructure Cost

**$0 incremental** — all services run on existing Contabo VPS ($50/mo already provisioned)

### Development Cost (at $150/hour agency rate)

| Phase | Days | Hours | Cost |
|-------|------|-------|------|
| 96-01: GSC Foundation | 10 | 80 | $12,000 |
| 96-02: Master Dashboard | 10 | 80 | $12,000 |
| 96-03: Actionable Insights | 15 | 120 | $18,000 |
| 96-04: Content Intelligence | 15 | 120 | $18,000 |
| 96-05: Client Portal | 15 | 120 | $18,000 |
| **Total** | **65** | **520** | **$78,000** |

### ROI Projection

| Metric | Value |
|--------|-------|
| Target price point | $199-499/mo (included in platform) |
| SEOGets equivalent | $49-299/mo (standalone) |
| Break-even clients | 156-392 (at dev cost) |
| 12-month target | 500 agency clients |
| Annual revenue contribution | $1.2M-3M |

---

## Risk Mitigation

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GSC API rate limits | Medium | High | Aggressive caching, priority queues, graceful degradation |
| Data volume growth | High | Medium | Partitioning strategy, retention policies, archival |
| Query complexity | Medium | Medium | Materialized views, pre-aggregation, read replicas |
| OAuth token expiry | Low | High | Token refresh job, user notification, re-auth flow |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Feature parity race | High | Medium | Focus on integrated value (audit + content + analytics) |
| GSC API deprecation | Low | Critical | Abstract data layer, support alternative sources |
| Agency churn | Medium | High | Lock-in via historical data, client portals |

### Contingency Plans

1. **GSC API fails**: Fall back to cached data, show staleness indicator
2. **Storage exceeds budget**: Implement tiered retention (30 days hot, 1 year warm, 5 years cold)
3. **Performance degrades**: Add read replica, implement query caching, pre-compute dashboards

---

## Success Metrics

### Phase 96 KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Query capture rate | 95%+ of available | Compared to GSC UI |
| Dashboard load time | <2s | p95 latency |
| Growing/Decaying accuracy | >90% | Manual validation sample |
| Agency adoption | 50% of agencies use daily | Analytics on analytics |
| Client portal logins | 2x/week per client | Usage tracking |

### Launch Criteria

- [ ] Master dashboard loads in <2s for 100+ sites
- [ ] Growing/Decaying algorithm validated against 10 agency datasets
- [ ] Annotations auto-import Google core updates
- [ ] Cannibalization UI exposes existing service
- [ ] Client portal with visibility controls working
- [ ] Export to CSV/Sheets functional for all reports
- [ ] 5-year data retention verified with sample data

---

## Appendix: Detailed Schemas

### A. Complete Type Definitions

```typescript
// types/analytics.ts

export interface SiteMetrics {
  siteId: string;
  siteName: string;
  siteUrl: string;
  tags: string[];
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  comparison: {
    clicksChange: number;
    impressionsChange: number;
    ctrChange: number;
    positionChange: number;
  };
  trend: number[]; // 7-day sparkline data
}

export interface PageTrend {
  pageUrl: string;
  pageTitle: string;
  currentPeriod: {
    clicks: number;
    impressions: number;
    position: number;
  };
  previousPeriod: {
    clicks: number;
    impressions: number;
    position: number;
  };
  changePercent: number;
  trend: 'growing' | 'decaying' | 'stable';
  confidence: 'high' | 'medium' | 'low';
  topQueries: string[];
}

export interface StrikingDistancePage {
  pageUrl: string;
  query: string;
  position: number;
  impressions: number;
  clicks: number;
  potentialClicks: number; // Estimated if moved to position 1-3
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface CannibalizationIssue {
  query: string;
  pages: Array<{
    url: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface TopicCluster {
  id: string;
  name: string;
  hubPage: {
    url: string;
    title: string;
    clicks: number;
  };
  spokePages: Array<{
    url: string;
    title: string;
    linksToHub: boolean;
    clicks: number;
  }>;
  coverage: number;
  gaps: string[];
  totalClicks: number;
  avgPosition: number;
}

export interface Annotation {
  id: string;
  date: Date;
  type: 'core_update' | 'site_change' | 'custom';
  title: string;
  description?: string;
  impact: 'positive' | 'negative' | 'neutral' | 'unknown';
  autoGenerated: boolean;
}

export interface ClientVisibility {
  clientId: string;
  workspaceId: string;
  showClicks: boolean;
  showImpressions: boolean;
  showPosition: boolean;
  showCtr: boolean;
  showQueries: boolean;
  showPages: boolean;
  showCompetitors: boolean;
  canViewGrowing: boolean;
  canViewDecaying: boolean;
  canViewCannibalization: boolean;
  canExport: boolean;
}
```

### B. BullMQ Job Definitions

```typescript
// jobs/gsc-sync.ts

export const gscSyncJobs = {
  // Daily full sync - runs at 3 AM for all sites
  'gsc:full-sync': {
    pattern: '0 3 * * *',
    handler: async (job: Job<{ siteId: string }>) => {
      const { siteId } = job.data;
      await syncFullQueryData(siteId);
      await syncPageMetrics(siteId);
      await detectTrends(siteId);
    }
  },
  
  // Hourly incremental - active sites only
  'gsc:incremental-sync': {
    pattern: '0 * * * *',
    handler: async (job: Job<{ siteId: string }>) => {
      const { siteId } = job.data;
      await syncIncrementalData(siteId);
    }
  },
  
  // URL inspection - priority queue
  'gsc:url-inspection': {
    handler: async (job: Job<{ siteId: string; urls: string[] }>) => {
      const { siteId, urls } = job.data;
      for (const url of urls) {
        await inspectUrl(siteId, url);
        await job.updateProgress(urls.indexOf(url) / urls.length);
      }
    }
  },
  
  // Partition maintenance - runs monthly
  'gsc:partition-maintenance': {
    pattern: '0 0 1 * *',
    handler: async () => {
      await createFuturePartitions(3); // 3 months ahead
      await dropOldPartitions(60);     // 5 years retention
    }
  }
};
```

---

## Next Steps

1. **Immediate**: Create sub-phase plans (96-01 through 96-05)
2. **Week 1**: Begin 96-01 GSC Data Foundation
3. **Checkpoint**: After 96-02, validate master dashboard with 3 agency beta testers
4. **Launch**: After 96-05, soft launch to existing agency customers

**Document Version**: 1.0  
**Created**: 2026-05-07  
**Author**: Claude Opus 4.5 (10-agent synthesis)
