---
phase: 66-platform-unification
plan: 01
subsystem: pixel
tags:
  - database
  - drizzle
  - api
  - pixel
  - analytics
dependency_graph:
  requires: []
  provides:
    - pixel-schema
    - pixel-script-service
    - pixel-api-endpoints
  affects:
    - 66-02 (collector uses schema)
    - 66-03 (platform detection)
tech_stack:
  added:
    - pixel_installations table
    - pixel_dom_changes table
    - pixel_analytics_daily table
    - developer_handoffs table
  patterns:
    - TDD with RED-GREEN
    - Drizzle ORM schema
    - TanStack Start API routes
    - IIFE pattern for loader
key_files:
  created:
    - open-seo-main/src/db/pixel-schema.ts
    - open-seo-main/src/db/pixel-schema.test.ts
    - open-seo-main/drizzle/0066_pixel_tables.sql
    - open-seo-main/src/server/features/pixel/pixel-script.service.ts
    - open-seo-main/src/server/features/pixel/pixel-script.service.test.ts
    - open-seo-main/src/server/features/pixel/index.ts
    - open-seo-main/src/routes/api/pixel/[siteId]/script.ts
    - open-seo-main/src/routes/api/pixel/t.js.ts
    - open-seo-main/src/routes/api/pixel/config/[siteId].ts
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - nanoid for siteId (short, URL-safe)
  - IIFE pattern for loader to avoid globals
  - mode: "date" for analytics date column (native Date object)
  - installationId FK in developerHandoffs (not siteId)
  - 1hr cache for t.js, 1min cache for config
metrics:
  duration_seconds: 447
  completed_at: "2026-05-03T11:06:49Z"
  tasks: 3
  tests: 66
  files_created: 9
  files_modified: 1
---

# Phase 66 Plan 01: TeveroPixel Database Schema + Script Generation Service Summary

Implemented complete data layer and script generation for the TeveroPixel system enabling any website to connect via a single script tag.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 5d687c1d6 | feat | Add pixel database schemas and migration |
| ff4f61c51 | feat | Implement PixelScriptService with <5KB loader |
| 355449222 | feat | Add pixel script API endpoints |

## Deliverables

### Database Schema (4 tables)

1. **pixel_installations** - Workspace/site scoped pixel deployments
   - siteId: unique per-workspace, used in data-site attribute
   - features: JSONB with analytics, cwv, metaInjection, etc.
   - detection tracking: firstPingAt, lastPingAt, pingCount
   - allowedOrigins: text array for CORS whitelist

2. **pixel_dom_changes** - Approved SEO modifications
   - changeType: meta_title, meta_description, canonical, schema, internal_link, content
   - approval workflow: status, approvedBy, approvedAt, deployedAt
   - targetSelector and targetUrl for page-specific changes

3. **pixel_analytics_daily** - Aggregated daily metrics
   - Traffic: pageviews, sessions, uniqueVisitors
   - Engagement: avgTimeOnPage, bounceRate
   - CWV: lcpP75, clsP75, inpP75 (p75 aggregates)
   - topPages JSONB for breakdown
   - Unique constraint on (installationId, date)

4. **developer_handoffs** - Developer email flow tracking
   - magicLinkToken with unique constraint
   - Reminder tracking: reminderCount, lastReminderAt

### PixelScriptService

- `generatePixelScript(siteId)`: Returns embeddable script tag (~100 bytes)
- `generatePixelLoader()`: Returns minified loader (<4KB)
- `getOrCreateInstallation(workspaceId, domain)`: Idempotent installation
- `getInstallationBySiteId(siteId)`: Lookup by data-site value
- `getInstallationConfig(siteId)`: Runtime config for loader

### Pixel Loader Features

- Async, non-blocking loading
- Session tracking via sessionStorage
- Analytics: pageview, scroll depth (25/50/75/100), click tracking
- Core Web Vitals: LCP, CLS, INP via PerformanceObserver
- DOM mutations: title, meta description, canonical, schema injection
- SPA support: history.pushState and popstate listeners
- Beacon API for reliable data collection (XMLHttpRequest fallback)

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/pixel/:siteId/script | GET | Returns snippet + features |
| /api/pixel/t.js | GET | Serves loader (1hr cache) |
| /api/pixel/config/:siteId | GET | Runtime config (1min cache) |

## Test Coverage

- **pixel-schema.test.ts**: 48 tests (constants, columns, types)
- **pixel-script.service.test.ts**: 18 tests (generation, service methods)
- **Total**: 66 tests for this plan

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] All 4 pixel tables exist with correct columns and relations
- [x] Migration file created (0066_pixel_tables.sql)
- [x] PixelScriptService generates valid JavaScript
- [x] Script size under 5KB uncompressed (~3.9KB)
- [x] API endpoints return correct responses
- [x] Tests achieve 80%+ coverage (66 tests passing)

## Self-Check: PASSED

- [x] open-seo-main/src/db/pixel-schema.ts exists
- [x] open-seo-main/drizzle/0066_pixel_tables.sql exists
- [x] open-seo-main/src/server/features/pixel/pixel-script.service.ts exists
- [x] open-seo-main/src/routes/api/pixel/t.js.ts exists
- [x] Commit 5d687c1d6 exists
- [x] Commit ff4f61c51 exists
- [x] Commit 355449222 exists
