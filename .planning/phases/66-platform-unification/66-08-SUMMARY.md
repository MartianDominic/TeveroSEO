---
phase: 66-platform-unification
plan: 08
subsystem: pixel-analytics
tags:
  - analytics
  - dashboard
  - cwv
  - recharts
  - tanstack-query
dependency_graph:
  requires:
    - 66-01 (pixelAnalyticsDaily schema)
    - 66-02 (PixelCollectorService)
  provides:
    - pixel-analytics-service
    - analytics-api-endpoints
    - analytics-dashboard-components
  affects:
    - pixel-dashboard-page
tech_stack:
  added: []
  patterns:
    - TDD with RED-GREEN
    - TanStack Query for data fetching
    - Recharts area chart
    - Google CWV thresholds
key_files:
  created:
    - open-seo-main/src/server/features/pixel/pixel-analytics.service.ts
    - open-seo-main/src/server/features/pixel/pixel-analytics.service.test.ts
    - open-seo-main/src/routes/api/pixel/[siteId]/analytics.ts
    - open-seo-main/src/routes/api/pixel/[siteId]/analytics.cwv.ts
    - open-seo-main/src/routes/api/pixel/[siteId]/analytics.pages.ts
    - apps/web/src/components/pixel/analytics-dashboard.tsx
    - apps/web/src/components/pixel/cwv-card.tsx
    - apps/web/src/components/pixel/traffic-chart.tsx
    - apps/web/src/components/pixel/top-pages.tsx
  modified:
    - open-seo-main/src/server/features/pixel/index.ts
    - apps/web/src/components/pixel/index.ts
decisions:
  - Google CWV thresholds (LCP<2.5s good, CLS<0.1 good, INP<200ms good)
  - 5-minute cache headers on analytics endpoints (T-66-24)
  - Max 1 year date range to prevent DoS (T-66-24)
  - TanStack Query with 5-min staleTime and refetchOnWindowFocus
  - Series toggle for traffic chart (can hide/show pageviews/sessions/visitors)
metrics:
  duration_seconds: 665
  completed_at: "2026-05-03T11:37:14Z"
  tasks: 3
  tests: 16
  files_created: 9
  files_modified: 2
---

# Phase 66 Plan 08: Pixel Analytics Dashboard Summary

Built pixel analytics dashboard showing traffic metrics and Core Web Vitals from TeveroPixel data.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 287a2a80c | feat | Implement PixelAnalyticsService with TDD (16 tests) |
| 76d94e9e1 | feat | Add analytics API endpoints with date validation |
| 055a3b5c4 | feat | Add dashboard components with Recharts |

## Deliverables

### PixelAnalyticsService

Aggregates daily analytics data for dashboard display:

- **getAnalytics(query)**: Returns full analytics response with summary, CWV, timeseries, topPages
- **getTopPages(siteId, startDate, endDate, limit)**: Returns paginated top pages
- **getCwvTrend(siteId, startDate, endDate)**: Returns CWV values over time for charting
- **getCwvRating(metric, value)**: Calculates rating based on Google thresholds

**CWV Thresholds (Google standards):**
| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | < 2.5s | 2.5s - 4.0s | >= 4.0s |
| CLS | < 0.1 | 0.1 - 0.25 | >= 0.25 |
| INP | < 200ms | 200ms - 500ms | >= 500ms |

**Granularity Support:**
- Daily: Each day as separate data point
- Weekly: 7-day aggregation (ISO week start)
- Monthly: Calendar month aggregation

### API Endpoints

| Endpoint | Method | Purpose | Cache |
|----------|--------|---------|-------|
| /api/pixel/:siteId/analytics | GET | Full analytics response | 5 min |
| /api/pixel/:siteId/analytics/cwv | GET | CWV trend for charts | 5 min |
| /api/pixel/:siteId/analytics/pages | GET | Paginated top pages | 5 min |

**Query Parameters:**
- `startDate`: YYYY-MM-DD (default: 30 days ago)
- `endDate`: YYYY-MM-DD (default: today)
- `granularity`: daily | weekly | monthly (default: daily)
- `limit`: number (default: 10, max: 100) - for /pages endpoint

### Dashboard Components

**AnalyticsDashboard (apps/web)**
- Date range picker with presets (7d, 30d, 90d)
- Summary cards row (pageviews, sessions, visitors, bounce rate)
- CWV section with three metric cards
- Traffic chart (area with series toggle)
- Top pages table with pagination

**CwvCard**
- Metric name with info tooltip
- p75 value with units (s/ms/unitless)
- Rating badge (green/yellow/red)
- Threshold info in tooltip
- Trend indicator (up/down from previous period)

**TrafficChart**
- Area chart using Recharts
- Multiple series (pageviews, sessions, visitors)
- Series toggle buttons in header
- Custom tooltip with all metrics
- Gradient fill with responsive sizing

**TopPages**
- Table with rank, URL, views, avg time
- Background bar for visual comparison
- Truncated URLs with full URL tooltip
- External link icon on hover
- "Show more" pagination support

## Threat Model Mitigations

| Threat ID | Category | Mitigation Applied |
|-----------|----------|-------------------|
| T-66-23 | Information Disclosure | Validate siteId exists before returning data |
| T-66-24 | Denial of Service | Max 1 year date range, 5-minute cache headers |

## Test Coverage

| File | Tests | Description |
|------|-------|-------------|
| pixel-analytics.service.test.ts | 16 | Full service coverage |

**Tests include:**
- Summary aggregation from daily data
- CWV rating calculations (good/needs-improvement/poor)
- Timeseries with daily/weekly/monthly granularity
- Top pages merging across days
- Empty date range handling
- Edge cases for each CWV metric

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] Summary shows correct totals for date range
- [x] CWV ratings match Google thresholds
- [x] Traffic chart renders with timeseries data
- [x] Top pages shows most viewed pages
- [x] Date range picker works with presets
- [x] Data refreshes without page reload (TanStack Query)
- [x] Tests achieve 80%+ coverage (16 tests)

## Self-Check: PASSED

- [x] open-seo-main/src/server/features/pixel/pixel-analytics.service.ts exists
- [x] open-seo-main/src/server/features/pixel/pixel-analytics.service.test.ts exists
- [x] open-seo-main/src/routes/api/pixel/[siteId]/analytics.ts exists
- [x] apps/web/src/components/pixel/analytics-dashboard.tsx exists (180 lines)
- [x] Commit 287a2a80c verified in git log
- [x] Commit 76d94e9e1 verified in git log
- [x] Commit 055a3b5c4 verified in git log
