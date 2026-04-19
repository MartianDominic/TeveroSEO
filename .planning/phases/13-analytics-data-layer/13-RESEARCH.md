# Phase 13: Analytics Data Layer - Research

**Researched:** 2026-04-19
**Domain:** Background job scheduling, Google APIs (GSC + GA4), token management
**Confidence:** HIGH

## Summary

Phase 13 builds the nightly analytics sync system: BullMQ workers iterate all clients with active Google OAuth tokens, fetch GSC (Search Analytics) and GA4 (Google Analytics 4) data, and persist snapshots to PostgreSQL tables. A 90-day historical backfill runs on first token connection; incremental 3-day syncs run nightly thereafter. Token refresh is proactive (before expiry), with failures flagged per-client for UI surfacing.

The architecture decision is settled: **Option A** from CONTEXT.md. The open-seo worker fetches decrypted tokens via an internal AI-Writer API endpoint, then makes Google API calls directly and writes to the shared PostgreSQL. This keeps analytics sync logic in one codebase (open-seo-main) while leveraging AI-Writer's existing Fernet encryption infrastructure.

**Primary recommendation:** Add a BullMQ queue `analytics-sync` with per-client job scheduling. Expose a `/internal/tokens/{client_id}/{provider}` endpoint on AI-Writer backend that returns decrypted credentials (internal network only). Use `google-auth-library` + `googleapis` in Node.js for GSC/GA4 API calls. Tables created via Alembic migration in AI-Writer backend (same shared DB).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tables created via Alembic migration on AI-Writer backend, shared PostgreSQL DB
- Schema: `gsc_snapshots`, `gsc_query_snapshots`, `ga4_snapshots` with specified columns
- BullMQ job: `sync-client-analytics` in open-seo-main worker
- Scheduled: nightly at 02:00 UTC via BullMQ `repeat: { cron: '0 2 * * *' }`
- Per-client jobs (one job per client with active Google token)
- Job payload: `{ clientId, provider: 'google', mode: 'incremental' | 'backfill' }`
- Backfill mode: 90 days on first token connection
- Incremental mode: 3 days overlap for late-arriving data
- Token refresh: check expiry before sync, refresh if within 1 hour
- Refresh failure: set `is_active = false`, log error, skip sync
- Worker location: **Option A** -- open-seo worker gets tokens via internal API, makes Google API calls, writes to PostgreSQL
- Top 50 queries per day stored in `gsc_query_snapshots`

### Claude's Discretion
- Whether to add a FastAPI endpoint for token decryption or pass encrypted token to worker and decrypt there
- Exact retry strategy for failed Google API calls (exponential backoff, max 3 retries)
- Whether to store raw API responses in addition to aggregated snapshots

### Deferred Ideas (OUT OF SCOPE)
- Bing analytics sync -- post v2.0
- Real-time sync on demand ("Sync now" button) -- Phase 14 stretch
- Raw API response storage for debugging -- post v2.0
- Cross-client aggregate analytics -- post v2.0
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANALYTICS-01 | gsc_snapshots table created and populated | Alembic migration 0013, GSC searchanalytics.query API |
| ANALYTICS-02 | ga4_snapshots table created and populated | Alembic migration 0013, GA4 Data API runReport |
| ANALYTICS-03 | gsc_query_snapshots table created and populated | Alembic migration 0013, GSC query dimension |
| ANALYTICS-04 | BullMQ job sync-client-analytics runs nightly 02:00 UTC | BullMQ upsertJobScheduler with cron pattern |
| ANALYTICS-05 | 90-day backfill on first connect | Job mode:'backfill' triggered by OAuth callback |
| ANALYTICS-06 | Token expiry check before sync | Read token_expiry from client_oauth_tokens |
| ANALYTICS-07 | Automatic token refresh within 1 hour of expiry | google-auth-library refresh flow |
| ANALYTICS-08 | Failed refresh sets is_active=false | Internal API update or direct DB write |
| ANALYTICS-09 | Connection status visible in UI | is_active flag surfaced via existing /connections endpoint |
| ANALYTICS-10 | Data available within 2h of connection | Backfill job triggered immediately, not waiting for nightly cron |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Job scheduling (cron) | BullMQ in open-seo-worker | -- | Existing BullMQ infrastructure, proven pattern |
| Token storage/encryption | AI-Writer FastAPI | -- | Fernet keys, encryption.py already in place |
| Google API calls | open-seo-worker (Node.js) | -- | Single-language analytics logic, no Python async complexity |
| Snapshot persistence | PostgreSQL (shared) | -- | Same DB, different tables alongside existing data |
| Token refresh | open-seo-worker calling Google | AI-Writer for storage update | Worker refreshes via google-auth, updates AI-Writer DB |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | 5.74.1 | Job queue, scheduling | Already installed in open-seo-main [VERIFIED: package.json] |
| ioredis | 5.10.1 | Redis client for BullMQ | Already installed [VERIFIED: package.json] |
| googleapis | 171.4.0 | GSC searchconsole API | Official Google client [VERIFIED: npm registry] |
| google-auth-library | 10.6.2 | OAuth2Client, token refresh | Official auth library [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg | 8.20.0 | PostgreSQL client | Already installed for open-seo DB writes |
| date-fns | 4.x | Date arithmetic for 90-day range | If needed; native Date sufficient for simple cases |

### Python (AI-Writer internal endpoint)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| google-analytics-data | 0.21.0 | GA4 Data API client | Only if making GA4 calls from Python [VERIFIED: pip3 index] |
| cryptography | -- | Fernet decryption | Already installed for encryption.py |

**Note:** Decision is Option A (Node.js makes Google API calls), so google-analytics-data Python package is NOT needed. The open-seo worker uses googleapis (Node.js) for both GSC and GA4.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| googleapis (Node.js) | google-api-python-client | Would require Python subprocess or separate worker service |
| BullMQ job scheduler | node-cron | Loses job persistence, retry, DLQ -- not suitable |
| Per-client jobs | Single monolithic job | Isolates failures, allows parallel execution |

**Installation (open-seo-main):**
```bash
pnpm add googleapis google-auth-library
```

**Version verification:** [VERIFIED: npm registry 2026-04-19]
- googleapis: 171.4.0 (published 2026-04-11)
- google-auth-library: 10.6.2 (published 2026-04-08)

## Architecture Patterns

### System Architecture Diagram

```
                                    +-------------------+
                                    |  Google APIs      |
                                    | (GSC + GA4)       |
                                    +--------^----------+
                                             |
                     (2) API calls           | (3) Data
                         with access_token   |
                                             |
+-------------------+               +--------+-----------+
|  AI-Writer        |   (1) GET    |  open-seo-worker   |
|  FastAPI          | <------------+  (BullMQ Worker)   |
|                   |   /internal/ |                     |
| - encryption.py   |   tokens/    | - analyticsQueue    |
| - client_oauth_   |   {client}/  | - analytics-worker  |
|   tokens table    |   google     | - analytics-proc    |
+-------------------+               +--------------------+
        |                                    |
        |                                    | (4) INSERT/UPSERT
        v                                    v
+--------------------------------------------------------+
|                PostgreSQL (shared)                      |
| +--------------------+  +----------------------------+  |
| | client_oauth_tokens|  | gsc_snapshots              |  |
| | (encrypted tokens) |  | gsc_query_snapshots        |  |
| +--------------------+  | ga4_snapshots              |  |
|                         +----------------------------+  |
+--------------------------------------------------------+
        ^
        |
+-------+-------+
|    Redis      |
| (BullMQ jobs) |
+---------------+
```

**Data flow:**
1. BullMQ triggers `sync-client-analytics` job at 02:00 UTC (or immediately for backfill)
2. Worker calls AI-Writer internal API to get decrypted access/refresh tokens
3. Worker calls GSC/GA4 APIs with tokens, handling pagination
4. Worker upserts snapshot rows into PostgreSQL (conflict on UNIQUE constraints)

### Recommended Project Structure

```
open-seo-main/src/server/
├── queues/
│   ├── auditQueue.ts          # (existing)
│   └── analyticsQueue.ts      # NEW: analytics-sync queue definition
├── workers/
│   ├── audit-worker.ts        # (existing)
│   ├── analytics-worker.ts    # NEW: Worker setup, event handlers
│   └── analytics-processor.ts # NEW: Sandboxed job processor
├── services/
│   └── analytics/
│       ├── google-auth.ts     # OAuth2Client, token refresh
│       ├── gsc-client.ts      # GSC searchanalytics.query wrapper
│       └── ga4-client.ts      # GA4 runReport wrapper
└── lib/
    └── aiwriter-api.ts        # Internal API client for tokens

AI-Writer/backend/
├── api/
│   └── internal.py            # NEW: /internal/tokens/{client_id}/{provider}
├── alembic/versions/
│   └── 0013_create_gsc_ga4_snapshots.py  # NEW migration
└── models/
    └── analytics_snapshots.py # NEW: ORM models
```

### Pattern 1: BullMQ Job Scheduler with Cron

**What:** Use `upsertJobScheduler` for nightly cron scheduling instead of adding repeatable jobs manually.

**When to use:** Any scheduled job that needs to run at fixed intervals or cron patterns.

**Example:**
```typescript
// Source: https://docs.bullmq.io/guide/job-schedulers (verified via Context7)
import { Queue } from 'bullmq';
import { createRedisConnection } from '@/server/lib/redis';

export const ANALYTICS_QUEUE_NAME = 'analytics-sync' as const;

export const analyticsQueue = new Queue(ANALYTICS_QUEUE_NAME, {
  connection: createRedisConnection(),
});

// Upsert the scheduler on worker startup (idempotent)
export async function initAnalyticsScheduler(): Promise<void> {
  await analyticsQueue.upsertJobScheduler(
    'nightly-analytics-sync',
    { pattern: '0 2 * * *' }, // 02:00 UTC daily
    {
      name: 'sync-all-clients',
      data: { mode: 'incremental' },
      opts: {
        attempts: 1, // Master job spawns per-client jobs
        removeOnComplete: { count: 30 },
      },
    },
  );
}
```

### Pattern 2: Per-Client Job Fan-Out

**What:** Master job queries active clients, enqueues one child job per client.

**When to use:** Isolate failures, enable parallel processing, avoid monolithic job timeouts.

**Example:**
```typescript
// analytics-processor.ts (sandboxed)
import { Job } from 'bullmq';
import { analyticsQueue } from '@/server/queues/analyticsQueue';
import { getActiveGoogleClients } from '@/server/services/analytics/client-registry';

export default async function processor(job: Job): Promise<void> {
  if (job.name === 'sync-all-clients') {
    const clients = await getActiveGoogleClients();
    for (const client of clients) {
      await analyticsQueue.add('sync-client-analytics', {
        clientId: client.id,
        provider: 'google',
        mode: job.data.mode,
      }, {
        jobId: `sync-${client.id}-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
      });
    }
    return;
  }

  if (job.name === 'sync-client-analytics') {
    await syncClientAnalytics(job.data);
    return;
  }
}
```

### Pattern 3: Token Refresh Before API Call

**What:** Check token expiry before making Google API calls; refresh proactively if within 1 hour of expiry.

**When to use:** Any OAuth flow where tokens have finite lifetimes.

**Example:**
```typescript
// google-auth.ts
import { OAuth2Client } from 'google-auth-library';

export async function getValidCredentials(
  accessToken: string,
  refreshToken: string,
  tokenExpiry: Date,
  clientId: string,
): Promise<{ accessToken: string; refreshed: boolean }> {
  const now = new Date();
  const hourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  if (tokenExpiry > hourFromNow) {
    // Token still valid for > 1 hour
    return { accessToken, refreshed: false };
  }

  // Refresh needed
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  
  // Persist new tokens via internal API
  await updateClientToken(clientId, 'google', {
    accessToken: credentials.access_token!,
    refreshToken: credentials.refresh_token || refreshToken,
    tokenExpiry: credentials.expiry_date 
      ? new Date(credentials.expiry_date) 
      : new Date(Date.now() + 3600 * 1000),
  });

  return { accessToken: credentials.access_token!, refreshed: true };
}
```

### Pattern 4: Internal API for Token Access

**What:** AI-Writer exposes a minimal internal endpoint to return decrypted tokens.

**When to use:** Cross-service credential sharing where encryption keys live in one service.

**Example (AI-Writer FastAPI):**
```python
# api/internal.py
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from services.encryption import decrypt_value
from services.shared_db import get_shared_db
from models.client_oauth import ClientOAuthToken
import os

router = APIRouter(prefix="/internal", tags=["Internal"])

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str]
    token_expiry: Optional[str]
    scopes: list[str]

@router.get("/tokens/{client_id}/{provider}", response_model=TokenResponse)
def get_decrypted_token(
    client_id: str,
    provider: str,
    x_internal_api_key: str = Header(...),
):
    if x_internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")
    
    db = next(get_shared_db())
    token = db.query(ClientOAuthToken).filter(
        ClientOAuthToken.client_id == client_id,
        ClientOAuthToken.provider == provider,
        ClientOAuthToken.is_active == True,
    ).first()
    
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    return TokenResponse(
        access_token=decrypt_value(token.access_token),
        refresh_token=decrypt_value(token.refresh_token) if token.refresh_token else None,
        token_expiry=token.token_expiry.isoformat() if token.token_expiry else None,
        scopes=token.scopes or [],
    )
```

### Anti-Patterns to Avoid

- **Monolithic sync job:** Don't sync all clients in a single job -- timeouts, no isolation
- **Hardcoded credentials:** Always use INTERNAL_API_KEY for internal API auth
- **Synchronous refresh:** Don't block on token refresh for every client sequentially -- use job parallelism
- **Direct DB access across services:** Don't have open-seo write to client_oauth_tokens directly -- use internal API
- **Polling for token validity:** Don't check token on every API call -- check once at job start

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth token refresh | Manual HTTP to token endpoint | google-auth-library OAuth2Client | Handles edge cases, token rotation |
| Job scheduling | node-cron + state management | BullMQ upsertJobScheduler | Persistence, retry, DLQ |
| GSC API calls | Raw fetch to searchanalytics | googleapis searchconsole | Type safety, pagination |
| GA4 API calls | Raw fetch to analyticsdata | googleapis analyticsdata | Type safety, batching |
| Encryption/decryption | Custom AES | cryptography.fernet | Audited implementation |

**Key insight:** Google's official client libraries handle pagination, rate limiting, error categorization, and regional endpoints. Hand-rolling HTTP calls loses all of this and creates maintenance burden.

## Common Pitfalls

### Pitfall 1: GSC Data Delay

**What goes wrong:** Expecting same-day data from GSC; API returns 404 or empty rows.

**Why it happens:** GSC data is delayed 2-3 days. Today's date will have no data.

**How to avoid:** Always query with end_date at least 3 days in the past. For incremental sync, use `end_date = today - 3 days`, `start_date = end_date - 2 days` (3-day window ending 3 days ago).

**Warning signs:** Empty rows array on recent dates; rowCount: 0.

### Pitfall 2: GA4 Property ID Format

**What goes wrong:** Passing property ID as integer or with prefix; API returns "invalid property" error.

**Why it happens:** GA4 expects property ID in format `properties/123456789`, not just `123456789`.

**How to avoid:** Always prefix with `properties/` before API call. Store numeric ID in DB, format at call time.

**Warning signs:** 400 errors mentioning "invalid property identifier".

### Pitfall 3: Token Refresh Race Condition

**What goes wrong:** Multiple parallel jobs refresh the same client's token simultaneously; one overwrites the other's fresh token.

**Why it happens:** Per-client jobs run in parallel; no lock on refresh operation.

**How to avoid:** Use job deduplication (`jobId: sync-${clientId}-...`) so only one job per client runs at a time. Alternatively, use a Redis lock around refresh.

**Warning signs:** Random "invalid_grant" errors after successful syncs; token_expiry jumping backward.

### Pitfall 4: Rate Limiting

**What goes wrong:** Syncing 100+ clients simultaneously hits Google API quota; 429 errors cascade.

**Why it happens:** BullMQ default concurrency processes many jobs at once.

**How to avoid:** Set worker `concurrency: 5` for analytics queue. Use exponential backoff on 429. Consider BullMQ rate limiter: `limiter: { max: 10, duration: 1000 }`.

**Warning signs:** Sudden spike in 429 responses; jobs failing after 3 retries.

### Pitfall 5: Fernet Key Mismatch

**What goes wrong:** Worker decrypts token but gets garbage; Google API rejects malformed token.

**Why it happens:** FERNET_KEY differs between AI-Writer and open-seo-worker environments.

**How to avoid:** Internal API pattern (AI-Writer decrypts, returns plaintext over trusted network) avoids this entirely. Never copy FERNET_KEY to another service.

**Warning signs:** InvalidToken exceptions; decrypted value doesn't look like a JWT.

## Code Examples

### GSC Search Analytics Query

```typescript
// Source: Google Search Console API (verified via Context7)
// gsc-client.ts
import { google } from 'googleapis';

interface GSCRow {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function fetchGSCDateMetrics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GSCRow[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['date'],
      rowLimit: 1000,
    },
  });

  return (response.data.rows || []).map(row => ({
    date: row.keys![0],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

export async function fetchGSCTopQueries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit: number = 50,
): Promise<Array<{ date: string; query: string; clicks: number; impressions: number; ctr: number; position: number }>> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['date', 'query'],
      rowLimit: limit * 90, // Up to 50 queries * 90 days
    },
  });

  return (response.data.rows || []).map(row => ({
    date: row.keys![0],
    query: row.keys![1],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}
```

### GA4 Run Report

```typescript
// Source: Google Analytics Data API (verified via Context7)
// ga4-client.ts
import { BetaAnalyticsDataClient } from '@google-analytics/data';

interface GA4Row {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversions: number;
  revenue: number;
}

export async function fetchGA4Metrics(
  accessToken: string,
  propertyId: string, // numeric, e.g., "123456789"
  startDate: string,
  endDate: string,
): Promise<GA4Row[]> {
  // For Node.js googleapis, use google.analyticsdata instead
  const { google } = await import('googleapis');
  
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });

  const response = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
      ],
    },
  });

  return (response.data.rows || []).map(row => ({
    date: row.dimensionValues![0].value!,
    sessions: parseInt(row.metricValues![0].value || '0', 10),
    users: parseInt(row.metricValues![1].value || '0', 10),
    newUsers: parseInt(row.metricValues![2].value || '0', 10),
    bounceRate: parseFloat(row.metricValues![3].value || '0'),
    avgSessionDuration: parseFloat(row.metricValues![4].value || '0'),
    conversions: parseInt(row.metricValues![5].value || '0', 10),
    revenue: parseFloat(row.metricValues![6].value || '0'),
  }));
}
```

### Alembic Migration for Snapshot Tables

```python
# 0013_create_gsc_ga4_snapshots.py
"""Create gsc_snapshots, gsc_query_snapshots, ga4_snapshots tables

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-XX
"""
from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # gsc_snapshots: Daily aggregate GSC metrics per client
    op.create_table(
        'gsc_snapshots',
        sa.Column('id', sa.CHAR(36), primary_key=True),
        sa.Column('client_id', sa.CHAR(36), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('site_url', sa.Text(), nullable=False),
        sa.Column('clicks', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('impressions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ctr', sa.Float(), nullable=False, server_default='0'),
        sa.Column('position', sa.Float(), nullable=False, server_default='0'),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('client_id', 'date', name='uq_gsc_snapshots_client_date'),
    )
    op.create_index('ix_gsc_snapshots_client_date', 'gsc_snapshots', ['client_id', 'date'])

    # gsc_query_snapshots: Top queries per day per client
    op.create_table(
        'gsc_query_snapshots',
        sa.Column('id', sa.CHAR(36), primary_key=True),
        sa.Column('client_id', sa.CHAR(36), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('clicks', sa.Integer(), server_default='0'),
        sa.Column('impressions', sa.Integer(), server_default='0'),
        sa.Column('ctr', sa.Float(), server_default='0'),
        sa.Column('position', sa.Float(), server_default='0'),
        sa.UniqueConstraint('client_id', 'date', 'query', name='uq_gsc_query_snapshots_client_date_query'),
    )
    op.create_index('ix_gsc_query_snapshots_client_date', 'gsc_query_snapshots', ['client_id', 'date'])

    # ga4_snapshots: Daily GA4 metrics per client
    op.create_table(
        'ga4_snapshots',
        sa.Column('id', sa.CHAR(36), primary_key=True),
        sa.Column('client_id', sa.CHAR(36), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('property_id', sa.Text(), nullable=False),
        sa.Column('sessions', sa.Integer(), server_default='0'),
        sa.Column('users', sa.Integer(), server_default='0'),
        sa.Column('new_users', sa.Integer(), server_default='0'),
        sa.Column('bounce_rate', sa.Float(), server_default='0'),
        sa.Column('avg_session_duration', sa.Float(), server_default='0'),
        sa.Column('conversions', sa.Integer(), server_default='0'),
        sa.Column('revenue', sa.Float(), server_default='0'),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('client_id', 'date', name='uq_ga4_snapshots_client_date'),
    )
    op.create_index('ix_ga4_snapshots_client_date', 'ga4_snapshots', ['client_id', 'date'])


def downgrade() -> None:
    op.drop_index('ix_ga4_snapshots_client_date', table_name='ga4_snapshots')
    op.drop_table('ga4_snapshots')
    op.drop_index('ix_gsc_query_snapshots_client_date', table_name='gsc_query_snapshots')
    op.drop_table('gsc_query_snapshots')
    op.drop_index('ix_gsc_snapshots_client_date', table_name='gsc_snapshots')
    op.drop_table('gsc_snapshots')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Universal Analytics API | GA4 Data API | July 2023 | UA deprecated; must use GA4 |
| BullMQ add + repeat option | upsertJobScheduler | BullMQ 5.0 | Cleaner API, idempotent |
| google-auth-library 8.x | google-auth-library 10.x | 2025 | ESM support, improved refresh |

**Deprecated/outdated:**
- Universal Analytics Reporting API: Fully sunset, do not use
- QueueScheduler class in BullMQ: No longer needed in v5.x, workers handle scheduling natively

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | INTERNAL_API_KEY env var pattern is acceptable for internal service auth | Pattern 4 | Would need mTLS or different auth mechanism |
| A2 | BullMQ concurrency: 5 is sufficient to avoid rate limiting | Pitfall 4 | May need lower concurrency or explicit rate limiter |
| A3 | 90-day backfill completes within 10 minutes per client | ANALYTICS-05 | May need pagination or streaming for high-volume sites |

## Open Questions

1. **Property ID storage**
   - What we know: GA4 property ID needed for API calls; format `properties/123456789`
   - What's unclear: Where is property_id stored? CONTEXT.md mentions `client_oauth_properties` table with `ga4_property_id` key -- confirm this is populated during OAuth callback
   - Recommendation: Plan should include task to store property_id in `client_oauth_properties` during OAuth callback (Phase 12 may have already done this)

2. **Multiple GSC sites per client**
   - What we know: One client could have multiple GSC sites verified
   - What's unclear: Should we sync all sites or require selecting a primary site?
   - Recommendation: Store `gsc_site_url` in `client_oauth_properties` during OAuth or first sync; sync only that site

3. **INTERNAL_API_KEY secret management**
   - What we know: Need a shared secret between open-seo-worker and AI-Writer backend
   - What's unclear: Should this be a new env var or reuse existing?
   - Recommendation: Add INTERNAL_API_KEY to docker-compose.vps.yml environment for both services

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| BullMQ | Job scheduling | checkmark | 5.74.1 | -- |
| ioredis | BullMQ connection | checkmark | 5.10.1 | -- |
| PostgreSQL | Snapshot storage | checkmark | 16-alpine | -- |
| Redis | Job queue | checkmark | 7-alpine | -- |
| googleapis npm | GSC/GA4 API | checkmark (to install) | 171.4.0 | -- |
| google-auth-library npm | Token refresh | checkmark (to install) | 10.6.2 | -- |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- googleapis and google-auth-library need `pnpm add` in open-seo-main -- straightforward install

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (open-seo-main) + pytest (AI-Writer) |
| Config file | vitest.config.ts, pytest.ini |
| Quick run command | `pnpm --filter open-seo-main test -- --run` |
| Full suite command | `pnpm --filter open-seo-main test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANALYTICS-01 | gsc_snapshots populated | integration | Alembic + seed data test | N/A Wave 0 |
| ANALYTICS-04 | Job runs at 02:00 UTC | unit | Mock BullMQ scheduler test | N/A Wave 0 |
| ANALYTICS-06 | Token expiry check | unit | `vitest run google-auth.test.ts` | N/A Wave 0 |
| ANALYTICS-07 | Token refresh | unit | Mock OAuth2Client test | N/A Wave 0 |
| ANALYTICS-08 | is_active set false on failure | integration | Mock internal API + DB check | N/A Wave 0 |

### Wave 0 Gaps

- [ ] `tests/server/services/analytics/google-auth.test.ts` -- covers token refresh
- [ ] `tests/server/workers/analytics-processor.test.ts` -- covers job processing
- [ ] Mock factory for BullMQ Job

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Internal API key for service-to-service |
| V3 Session Management | No | No user sessions in workers |
| V4 Access Control | Yes | Only internal network can access /internal/* |
| V5 Input Validation | Yes | Validate clientId, provider before DB/API calls |
| V6 Cryptography | Yes | Fernet encryption (existing), do not expose FERNET_KEY |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token exfiltration via logs | Information Disclosure | Never log access_token, refresh_token |
| Internal API spoofing | Spoofing | X-Internal-Api-Key header, network isolation |
| Rate limit exhaustion | Denial of Service | BullMQ concurrency limit, exponential backoff |
| Stale token replay | Tampering | Proactive refresh, token_expiry validation |

## Sources

### Primary (HIGH confidence)
- BullMQ docs (Context7 /websites/bullmq_io) - job schedulers, repeatable jobs, concurrency
- Google Analytics Data API (Context7 /websites/developers_google_analytics_devguides) - runReport method, dimensions, metrics
- npm registry (verified 2026-04-19) - googleapis 171.4.0, google-auth-library 10.6.2, bullmq 5.74.1

### Secondary (MEDIUM confidence)
- Existing codebase patterns: gsc_service.py, client_oauth_service.py, audit-worker.ts

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against npm registry, existing codebase
- Architecture: HIGH - Option A locked in CONTEXT.md, patterns match existing code
- Pitfalls: HIGH - derived from GSC/GA4 official docs and common error patterns

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days - stable APIs, unlikely to change)
