---
phase: 96-agency-analytics
plan: 04
subsystem: analytics
tags: [content-groups, topic-clusters, index-coverage, url-inspection, gsc-api]
dependency_graph:
  requires:
    - 96-01: GSC Analytics Infrastructure (seoGscQueryAnalytics table)
    - 96-02: Master Dashboard (site metrics aggregation patterns)
    - 96-03: Trends & Annotations (query_time column convention)
  provides:
    - Content Groups with folder/regex/manual pattern matching
    - Topic Clusters with hub+spoke detection and gap analysis
    - Index Coverage with URL Inspection API and quota tracking
    - Batch indexing request management
  affects:
    - open-seo-main analytics feature module
    - GSC integration layer
tech_stack:
  added:
    - URL Inspection API client (GSC API v1)
    - Indexing API client (v3 urlNotifications)
  patterns:
    - Repository pattern for all persistence
    - TDD with mocked repositories
    - SVG-based cluster visualization
key_files:
  created:
    - open-seo-main/src/db/content-intelligence-schema.ts
    - open-seo-main/drizzle/migrations/0005_content_intelligence.sql
    - open-seo-main/src/server/features/analytics/repositories/ContentGroupRepository.ts
    - open-seo-main/src/server/features/analytics/repositories/TopicClusterRepository.ts
    - open-seo-main/src/server/features/analytics/repositories/IndexCoverageRepository.ts
    - open-seo-main/src/server/features/analytics/clients/GscUrlInspectionClient.ts
    - open-seo-main/src/server/features/analytics/services/ContentGroupService.ts
    - open-seo-main/src/server/features/analytics/services/TopicClusterService.ts
    - open-seo-main/src/server/features/analytics/services/IndexCoverageService.ts
    - open-seo-main/src/routes/api/analytics/content-groups.ts
    - open-seo-main/src/routes/api/analytics/topic-clusters.ts
    - open-seo-main/src/routes/api/analytics/index-coverage.ts
    - open-seo-main/src/components/analytics/ContentGroupCard.tsx
    - open-seo-main/src/components/analytics/TopicClusterVisualization.tsx
    - open-seo-main/src/components/analytics/IndexCoverageChart.tsx
  modified:
    - open-seo-main/src/db/schema.ts (added content-intelligence-schema export)
    - open-seo-main/src/server/features/analytics/types.ts (added 100+ lines of types)
decisions:
  - "Used analyticsTopicClusters table prefix to avoid collision with existing topicClusters in onpage-mastery-schema"
  - "FK references use siteConnections.id (text type) not sites table (which doesn't exist in this codebase)"
  - "URL Inspection API wrapped in GscUrlInspectionClient with quota tracking (2000/day inspections, 200/day indexing)"
  - "Cluster coverage calculated as % of spoke pages linking back to hub"
  - "Content groups support three match types: folder, regex, manual"
metrics:
  duration_minutes: 15
  completed_at: "2026-05-08T12:00:00Z"
  tasks_completed: 6
  tasks_total: 6
  files_created: 20
  files_modified: 2
  tests_passing: 23
---

# Phase 96 Plan 04: Content Intelligence Layer Summary

Content groups with folder-based auto-grouping, topic clusters with hub/spoke visualization and gap detection, and index coverage with URL Inspection API integration.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | 03d0ae0 | Schema + types for content_groups, topic_clusters, index_coverage |
| 2 | 3e5bd7f | ContentGroupService with auto-grouping (8 tests) |
| 3 | a2f11da | TopicClusterService with hub/spoke detection (7 tests) |
| 4 | 794d1fe | IndexCoverageService with URL Inspection API (8 tests) |
| 5 | 0f0d387 | API routes for content-groups, topic-clusters, index-coverage |
| 6 | 8f9c1f0 | UI components: ContentGroupCard, TopicClusterVisualization, IndexCoverageChart |

## Key Implementations

### Content Groups
- **Auto-generation**: Detects `/blog/`, `/products/`, `/services/` folder patterns from GSC data
- **Match types**: folder (LIKE), regex (PostgreSQL `~`), manual (explicit page list)
- **Metrics**: Aggregated clicks/impressions/position from seoGscQueryAnalytics
- **Change tracking**: clicksChange, impressionsChange vs previous 28-day period

### Topic Clusters
- **Hub detection**: Pages with high incoming internal links (proxy: high impressions)
- **Spoke identification**: Pages linked to hub with related topics
- **Coverage calculation**: % of spokes with links back to hub
- **Gap analysis**: Missing subtopics stored as JSON array, recommendations generated

### Index Coverage
- **URL Inspection API**: 2000 inspections/day limit, results stored in page_index_status
- **Indexing requests**: URL_UPDATED/URL_DELETED requests with status tracking
- **Quota tracking**: Daily usage counts against limits, auto-reset at midnight
- **Priority scheduling**: New content > decaying pages > high-value > stale inspections

## API Endpoints

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/analytics/content-groups` | GET, POST | List groups, create group, auto-generate |
| `/api/analytics/content-groups/:groupId` | GET, PUT, DELETE | Group detail, update, delete |
| `/api/analytics/topic-clusters` | GET, POST | List clusters, create cluster, detect hubs |
| `/api/analytics/topic-clusters/:clusterId` | GET, POST, DELETE | Detail, spokes, coverage, gaps |
| `/api/analytics/index-coverage` | GET, POST | Stats, quota, inspect, batch-inspect |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed schema FK reference**
- **Found during:** Task 1
- **Issue:** Plan referenced `sites` table which doesn't exist; codebase uses `siteConnections`
- **Fix:** Changed all FK references to `siteConnections.id` (text type, not uuid)
- **Commit:** 03d0ae0

**2. [Rule 1 - Bug] Fixed table name collision**
- **Found during:** Task 1
- **Issue:** `topicClusters` name already exists in onpage-mastery-schema.ts
- **Fix:** Renamed to `analyticsTopicClusters` and `analyticsTopicClusterPages`
- **Commit:** 03d0ae0

**3. [Rule 1 - Bug] Fixed GSC data table reference**
- **Found during:** Task 5
- **Issue:** Code referenced `gscQueryData` which doesn't exist
- **Fix:** Changed to `seoGscQueryAnalytics` with `query_time` column (not `date`)
- **Commit:** 0f0d387

## Test Coverage

| Service | Tests | Status |
|---------|-------|--------|
| ContentGroupService | 8 | PASS |
| TopicClusterService | 7 | PASS |
| IndexCoverageService | 8 | PASS |
| **Total** | **23** | **PASS** |

## Self-Check: PASSED

- [x] All created files exist
- [x] All commits verified in git log
- [x] Tests pass: 23/23
- [x] Types compile without errors (analytics-specific)
