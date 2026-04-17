# Phase 13: Analytics Data Layer - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated

<domain>
## Phase Boundary

Build the nightly analytics sync system. BullMQ workers (in open-seo-main or a new worker service) iterate all clients with active Google tokens and sync GSC + GA4 data into PostgreSQL snapshot tables. 90-day historical backfill on first connect. Token refresh automated; failures flagged per client. Data ready for dashboard queries within 2h of connection.

</domain>

<decisions>
## Implementation Decisions

### New Tables (Drizzle migration on open-seo-main OR Alembic on AI-Writer — decision: Alembic on AI-Writer backend, same DB)
```sql
gsc_snapshots
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
  date            DATE NOT NULL
  site_url        TEXT NOT NULL
  clicks          INTEGER NOT NULL DEFAULT 0
  impressions     INTEGER NOT NULL DEFAULT 0
  ctr             REAL NOT NULL DEFAULT 0
  position        REAL NOT NULL DEFAULT 0
  synced_at       TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(client_id, date)

gsc_query_snapshots
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
  date            DATE NOT NULL
  query           TEXT NOT NULL
  clicks          INTEGER DEFAULT 0
  impressions     INTEGER DEFAULT 0
  ctr             REAL DEFAULT 0
  position        REAL DEFAULT 0
  UNIQUE(client_id, date, query)

ga4_snapshots
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
  date                    DATE NOT NULL
  property_id             TEXT NOT NULL
  sessions                INTEGER DEFAULT 0
  users                   INTEGER DEFAULT 0
  new_users               INTEGER DEFAULT 0
  bounce_rate             REAL DEFAULT 0
  avg_session_duration    REAL DEFAULT 0
  conversions             INTEGER DEFAULT 0
  revenue                 REAL DEFAULT 0
  synced_at               TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(client_id, date)
```

### Sync Worker
- BullMQ job: `sync-client-analytics` in open-seo-main worker
- Scheduled: nightly at 02:00 UTC via BullMQ `repeat: { cron: '0 2 * * *' }`
- Per-client job (not one monolithic job): one job per client with active Google token
- Job payload: `{ clientId, provider: 'google', mode: 'incremental' | 'backfill' }`
- Backfill mode: fetch last 90 days; triggered once on first token connection
- Incremental mode: fetch last 3 days (overlap for late data); upsert by UNIQUE constraint

### Token Refresh
- Before each sync job: check `token_expiry` in `client_oauth_tokens`
- If expiry within 1 hour: refresh via Google OAuth refresh token
- If refresh fails: set `is_active = false`, log error, skip sync for this client
- Failure visible in `/clients/[clientId]/connections` as "Reconnect needed" badge

### GSC API Calls
- Use existing `gsc_service.py` pattern from AI-Writer backend
- Endpoint: `searchanalytics.query` with dimensions `['date']` for aggregate, `['date', 'query']` for top queries
- Date range: last 3 days for incremental, last 90 days for backfill
- Top 50 queries per day stored in `gsc_query_snapshots`

### GA4 API Calls
- Google Analytics Data API v1 (not Universal Analytics)
- Metrics: sessions, totalUsers, newUsers, bounceRate, averageSessionDuration, conversions, totalRevenue
- Dimensions: date
- Date range: same as GSC

### Worker Location
- Sync jobs run in `open-seo-main` worker (already has BullMQ infrastructure)
- BUT API calls need decrypted tokens from AI-Writer backend — two options:
  - Option A: open-seo worker calls AI-Writer internal API to get decrypted token → makes GSC/GA4 calls itself
  - Option B: AI-Writer FastAPI exposes a `/internal/sync-analytics` endpoint; open-seo worker triggers it
  - **Decision: Option A** — open-seo worker gets tokens via internal API, makes Google API calls, writes to shared PostgreSQL. Keeps analytics logic in one place.

### Claude's Discretion
- Whether to add a FastAPI endpoint for token decryption or pass encrypted token to worker and decrypt there
- Exact retry strategy for failed Google API calls (exponential backoff, max 3 retries)
- Whether to store raw API responses in addition to aggregated snapshots

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `open-seo-main/src/server/lib/bullmq.ts` (or equivalent) — existing queue/worker setup
- `AI-Writer/backend/services/gsc_service.py` — GSC API call pattern; adapt for sync worker
- `AI-Writer/backend/services/encryption.py` — token decryption; expose via internal API
- Existing `oauth_token_monitoring_service.py` — token refresh logic; extend for per-client

### Established Patterns
- BullMQ jobs with retry: `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }`
- Drizzle upsert: `onConflictDoUpdate` — use for snapshot inserts
- APScheduler in AI-Writer backend for scheduled jobs — BullMQ cron in open-seo worker is preferred

### Integration Points
- `client_oauth_tokens` table in shared PostgreSQL — worker reads tokens
- `gsc_snapshots`, `ga4_snapshots` — worker writes data
- `client_oauth_tokens.is_active` — worker updates on refresh failure

</code_context>

<specifics>
## Specific Ideas

- One BullMQ job per client per sync run — isolates failures
- 90-day backfill fires automatically when token first connected (triggered by Phase 12 OAuth callback)
- Incremental sync runs nightly — overlap of 3 days handles late-arriving data
- Token refresh before sync — proactive, not reactive

</specifics>

<deferred>
## Deferred Ideas

- Bing analytics sync — post v2.0 (GSC + GA4 first)
- Real-time sync on demand ("Sync now" button) — Phase 14 stretch
- Raw API response storage for debugging — post v2.0
- Cross-client aggregate analytics — post v2.0

</deferred>
