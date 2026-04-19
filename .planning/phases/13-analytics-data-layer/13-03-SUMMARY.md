---
phase: 13-analytics-data-layer
plan: 03
subsystem: open-seo-main, AI-Writer backend
tags: [google-api, gsc, ga4, oauth, token-refresh, bullmq-processor]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [gsc-client, ga4-client, google-auth, analytics-processor, internal-token-crud]
  affects: [analytics-worker, dashboard-queries]
tech_stack:
  added: []
  patterns: [googleapis-oauth2, proactive-token-refresh, bullmq-sandboxed-processor, drizzle-upsert]
key_files:
  created:
    - open-seo-main/src/server/services/analytics/gsc-client.ts
    - open-seo-main/src/server/services/analytics/ga4-client.ts
    - open-seo-main/src/server/services/analytics/google-auth.ts
    - open-seo-main/src/server/workers/analytics-processor.ts
  modified:
    - AI-Writer/backend/api/internal.py
decisions:
  - Token refresh triggered when expiry within 1 hour (proactive, not reactive)
  - GSC/GA4 date range accounts for 3-day data delay
  - Per-client job fan-out via ALWRITY_DATABASE_URL direct query
  - Drizzle upsert with onConflictDoUpdate for idempotent snapshot writes
metrics:
  duration: 6m
  completed: 2026-04-19T10:35:10Z
---

# Phase 13 Plan 03: GSC/GA4 Sync Processor Summary

GSC and GA4 API clients with token refresh logic and BullMQ processor for snapshot persistence.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create services/analytics directory and gsc-client.ts | 3409139 (open-seo) | src/server/services/analytics/gsc-client.ts |
| 2 | Create ga4-client.ts | bfe5b76 (open-seo) | src/server/services/analytics/ga4-client.ts |
| 3 | Create google-auth.ts for token refresh | 73bfa64 (open-seo) | src/server/services/analytics/google-auth.ts |
| 4 | Add token update and deactivate endpoints to internal API | 6debcf61 (AI-Writer) | backend/api/internal.py |
| 5 | Create analytics-processor.ts | 4684c5b (open-seo) | src/server/workers/analytics-processor.ts |

## Implementation Details

### GSC Client (gsc-client.ts)

Google Search Console API wrapper with typed interfaces:

**Exports:**
- `fetchGSCDateMetrics(accessToken, siteUrl, startDate, endDate)` - Daily aggregate metrics
- `fetchGSCTopQueries(accessToken, siteUrl, startDate, endDate, topN=50)` - Top queries per day
- `getGSCDateRange(mode)` - Date range helper accounting for 3-day data delay

**Key behaviors:**
- Uses googleapis searchconsole v1 API
- Dimensions: `['date']` for aggregate, `['date', 'query']` for top queries
- Groups queries by date and sorts by clicks descending to get top N per day
- Row limit: 1000 for daily, 5000 for queries (90 days x 50 queries)

### GA4 Client (ga4-client.ts)

Google Analytics 4 API wrapper with typed interfaces:

**Exports:**
- `fetchGA4Metrics(accessToken, propertyId, startDate, endDate)` - Daily 7-metric data
- `getGA4DateRange(mode)` - Date range helper matching GSC timing

**Metrics fetched:**
1. sessions
2. totalUsers
3. newUsers
4. bounceRate
5. averageSessionDuration
6. conversions
7. totalRevenue

**Key behaviors:**
- Uses googleapis analyticsdata v1beta API
- Property ID prefixed with `properties/` at call time
- Same 3-day delay as GSC for consistency

### Google Auth (google-auth.ts)

Token management with proactive refresh:

**Exports:**
- `getValidCredentials(clientId)` - Returns valid access token, refreshing if needed

**Key behaviors:**
- Checks token_expiry before sync
- Refreshes if expiry within 1 hour (not 5 minutes - proactive)
- Uses google-auth-library OAuth2Client for refresh
- Updates token in AI-Writer DB via internal API
- Marks token inactive on refresh failure (is_active=false)

### Internal API Extensions (internal.py)

Two new endpoints for token lifecycle management:

**PUT /internal/tokens/{client_id}/{provider}:**
- Updates access_token, refresh_token, token_expiry after refresh
- Encrypts values before storage
- Called by open-seo worker on successful refresh

**POST /internal/tokens/{client_id}/{provider}/deactivate:**
- Sets is_active=false on token
- Called by open-seo worker when refresh fails
- UI surfaces this as "Reconnect needed" badge

### Analytics Processor (analytics-processor.ts)

Sandboxed BullMQ processor handling two job types:

**sync-all-clients:**
- Queries ALWRITY_DATABASE_URL for active Google tokens
- Enqueues one sync-client-analytics job per client
- Uses job deduplication to prevent race conditions

**sync-client-analytics:**
- Fetches credentials via getValidCredentials (with auto-refresh)
- Syncs GSC data if gsc_site_url configured
- Syncs GA4 data if ga4_property_id configured
- Upserts snapshots to PostgreSQL via Drizzle ORM

**Upsert pattern:**
- `onConflictDoUpdate` on UNIQUE constraints
- Updates existing rows, inserts new ones
- Sets syncedAt=NOW() on updates

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

```
$ cd open-seo-main && pnpm exec tsc --noEmit
(no errors)
```

```
$ cd AI-Writer/backend && python3 -c "from api.internal import router; print([r.path for r in router.routes])"
['/internal/tokens/{client_id}/{provider}', '/internal/tokens/{client_id}/{provider}', '/internal/tokens/{client_id}/{provider}/deactivate', '/internal/backfill']
```

All files compile, all endpoints registered.

## Self-Check: PASSED

- [x] open-seo-main/src/server/services/analytics/gsc-client.ts exists
- [x] open-seo-main/src/server/services/analytics/ga4-client.ts exists
- [x] open-seo-main/src/server/services/analytics/google-auth.ts exists
- [x] open-seo-main/src/server/workers/analytics-processor.ts exists
- [x] AI-Writer/backend/api/internal.py has PUT and POST /deactivate endpoints
- [x] Commit 3409139 exists (Task 1)
- [x] Commit bfe5b76 exists (Task 2)
- [x] Commit 73bfa64 exists (Task 3)
- [x] Commit 6debcf61 exists (Task 4)
- [x] Commit 4684c5b exists (Task 5)
