# Phase 13: Analytics Data Layer - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 8 (new/modified files)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `AI-Writer/backend/alembic/versions/0013_create_gsc_ga4_snapshots.py` | migration | schema | `0012_create_client_oauth_tables.py` | exact |
| `AI-Writer/backend/models/analytics_snapshots.py` | model | ORM | `models/client_oauth.py` | exact |
| `AI-Writer/backend/api/internal.py` | controller | request-response | `api/client_oauth.py` | role-match |
| `open-seo-main/src/server/queues/analyticsQueue.ts` | queue | job-scheduling | `queues/auditQueue.ts` | exact |
| `open-seo-main/src/server/workers/analytics-worker.ts` | worker | job-processing | `workers/audit-worker.ts` | exact |
| `open-seo-main/src/server/workers/analytics-processor.ts` | processor | job-processing | `workers/audit-processor.ts` | exact |
| `open-seo-main/src/server/services/analytics/gsc-client.ts` | service | API-client | `services/gsc_service.py` (Python) | pattern-match |
| `open-seo-main/src/server/services/analytics/ga4-client.ts` | service | API-client | `services/gsc_service.py` (Python) | pattern-match |

## Pattern Assignments

### `AI-Writer/backend/alembic/versions/0013_create_gsc_ga4_snapshots.py` (migration, schema)

**Analog:** `AI-Writer/backend/alembic/versions/0012_create_client_oauth_tables.py`

**Migration header pattern** (lines 1-22):
```python
"""create_gsc_ga4_snapshots

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-XX

Creates three tables for analytics data storage:
  - gsc_snapshots: Daily GSC aggregate metrics per client
  - gsc_query_snapshots: Top queries per day per client
  - ga4_snapshots: Daily GA4 metrics per client
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
```

**Table creation pattern** (lines 24-56):
```python
def upgrade() -> None:
    op.create_table(
        "gsc_snapshots",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column(
            "client_id",
            sa.CHAR(36),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("site_url", sa.Text(), nullable=False),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ctr", sa.Float(), nullable=False, server_default="0"),
        sa.Column("position", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "client_id", "date", name="uq_gsc_snapshots_client_date"
        ),
    )
```

**Index creation pattern** (lines 90-92 from analog):
```python
    op.create_index(
        "ix_gsc_snapshots_client_date", "gsc_snapshots", ["client_id", "date"]
    )
```

**Downgrade pattern** (lines 95-103 from analog):
```python
def downgrade() -> None:
    # Drop index first
    op.drop_index("ix_gsc_snapshots_client_date", table_name="gsc_snapshots")
    # Drop tables in reverse order (respecting FK dependencies)
    op.drop_table("ga4_snapshots")
    op.drop_table("gsc_query_snapshots")
    op.drop_table("gsc_snapshots")
```

---

### `AI-Writer/backend/models/analytics_snapshots.py` (model, ORM)

**Analog:** `AI-Writer/backend/models/client_oauth.py`

**Imports pattern** (lines 1-16):
```python
"""
ORM models for analytics snapshot tables.

Tables:
  - GSCSnapshot: Daily GSC aggregate metrics per client
  - GSCQuerySnapshot: Top queries per day per client  
  - GA4Snapshot: Daily GA4 metrics per client

All models live on SharedBase (shared PostgreSQL).
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from models.client import GUID, _utcnow
from services.shared_db import SharedBase
```

**Model class pattern** (lines 64-106 from analog):
```python
class GSCSnapshot(SharedBase):
    """
    Daily GSC aggregate metrics per client.
    
    UNIQUE(client_id, date) ensures one row per day per client.
    """

    __tablename__ = "gsc_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "client_id", "date", name="uq_gsc_snapshots_client_date"
        ),
    )

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        GUID(),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    date = Column(Date, nullable=False)
    site_url = Column(Text, nullable=False)
    clicks = Column(Integer, nullable=False, default=0)
    impressions = Column(Integer, nullable=False, default=0)
    ctr = Column(Float, nullable=False, default=0)
    position = Column(Float, nullable=False, default=0)
    synced_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    # Relationships
    client = relationship("Client", backref="gsc_snapshots")

    def __repr__(self):
        return f"<GSCSnapshot id={self.id} client_id={self.client_id} date={self.date}>"
```

---

### `AI-Writer/backend/api/internal.py` (controller, request-response)

**Analog:** `AI-Writer/backend/api/client_oauth.py`

**Imports pattern** (lines 17-32):
```python
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.client_oauth import ClientOAuthToken
from services.encryption import decrypt_value
from services.shared_db import get_shared_db
```

**Router setup pattern** (lines 34):
```python
router = APIRouter(prefix="/internal", tags=["Internal"])

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")
```

**Pydantic response schema pattern** (lines 40-54 from analog):
```python
class TokenResponse(BaseModel):
    """Decrypted token response for internal service use."""
    access_token: str
    refresh_token: Optional[str]
    token_expiry: Optional[str]
    scopes: List[str]
```

**Internal API key auth pattern** (new, based on standard pattern):
```python
def verify_internal_api_key(x_internal_api_key: str = Header(...)) -> None:
    """Verify internal API key header for service-to-service auth."""
    if not INTERNAL_API_KEY:
        logger.error("INTERNAL_API_KEY not configured")
        raise HTTPException(status_code=500, detail="Internal auth not configured")
    if x_internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")
```

**Endpoint pattern** (lines 122-154 from analog):
```python
@router.get("/tokens/{client_id}/{provider}", response_model=TokenResponse)
def get_decrypted_token(
    client_id: str,
    provider: str,
    db: Session = Depends(get_shared_db),
    _: None = Depends(verify_internal_api_key),
):
    """
    Return decrypted OAuth tokens for internal service use.
    
    SECURITY: This endpoint is protected by X-Internal-Api-Key header.
    Only internal services (open-seo-worker) should call this.
    """
    token = (
        db.query(ClientOAuthToken)
        .filter(
            ClientOAuthToken.client_id == client_id,
            ClientOAuthToken.provider == provider,
            ClientOAuthToken.is_active.is_(True),
        )
        .first()
    )
    
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    return TokenResponse(
        access_token=decrypt_value(token.access_token),
        refresh_token=decrypt_value(token.refresh_token) if token.refresh_token else None,
        token_expiry=token.token_expiry.isoformat() if token.token_expiry else None,
        scopes=token.scopes or [],
    )
```

---

### `open-seo-main/src/server/queues/analyticsQueue.ts` (queue, job-scheduling)

**Analog:** `open-seo-main/src/server/queues/auditQueue.ts`

**Imports pattern** (lines 1-14):
```typescript
/**
 * BullMQ Queue definitions for the analytics sync system.
 *
 * - `analyticsQueue` - primary queue for analytics sync jobs
 * - `initAnalyticsScheduler` - sets up nightly cron via upsertJobScheduler
 */

import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@/server/lib/redis";
```

**Queue name constants pattern** (lines 16-17):
```typescript
export const ANALYTICS_QUEUE_NAME = "analytics-sync" as const;
```

**Job data interface pattern** (lines 34-45):
```typescript
export interface AnalyticsSyncJobData {
  clientId: string;
  provider: "google";
  mode: "incremental" | "backfill";
}

export interface SyncAllClientsJobData {
  mode: "incremental" | "backfill";
}
```

**Default job options pattern** (lines 56-64):
```typescript
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};
```

**Queue instance pattern** (lines 66-69):
```typescript
export const analyticsQueue = new Queue<AnalyticsSyncJobData | SyncAllClientsJobData>(
  ANALYTICS_QUEUE_NAME,
  {
    connection: createRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);
```

**Scheduler initialization pattern** (new, based on BullMQ docs):
```typescript
/**
 * Initialize the nightly analytics sync scheduler.
 * Uses upsertJobScheduler for idempotent cron setup.
 * Call once on worker startup.
 */
export async function initAnalyticsScheduler(): Promise<void> {
  await analyticsQueue.upsertJobScheduler(
    "nightly-analytics-sync",
    { pattern: "0 2 * * *" }, // 02:00 UTC daily
    {
      name: "sync-all-clients",
      data: { mode: "incremental" },
      opts: {
        attempts: 1, // Master job spawns per-client jobs
        removeOnComplete: { count: 30 },
      },
    },
  );
}
```

---

### `open-seo-main/src/server/workers/analytics-worker.ts` (worker, job-processing)

**Analog:** `open-seo-main/src/server/workers/audit-worker.ts`

**Imports pattern** (lines 1-22):
```typescript
/**
 * BullMQ Worker for analytics sync jobs.
 *
 * Wires:
 *   - Dedicated Redis connection (BQ-03) via createRedisConnection()
 *   - lockDuration: 120_000 (BQ-05)
 *   - maxStalledCount: 2 (BQ-06)
 *   - Sandboxed processor via file path (BQ-04)
 *   - on("failed") handler for logging
 *   - Graceful shutdown via stopAnalyticsWorker()
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { createRedisConnection } from "@/server/lib/redis";
import {
  ANALYTICS_QUEUE_NAME,
  type AnalyticsSyncJobData,
  type SyncAllClientsJobData,
} from "@/server/queues/analyticsQueue";
```

**Worker constants pattern** (lines 23-25):
```typescript
const LOCK_DURATION_MS = 120_000; // BQ-05
const MAX_STALLED_COUNT = 2; // BQ-06
const SHUTDOWN_TIMEOUT_MS = 25_000; // BQ-06
```

**Processor path pattern** (lines 28-31):
```typescript
const PROCESSOR_PATH = fileURLToPath(
  new URL("./analytics-processor.js", import.meta.url),
);
```

**Worker singleton pattern** (lines 33-93):
```typescript
let worker: Worker<AnalyticsSyncJobData | SyncAllClientsJobData> | null = null;

export function startAnalyticsWorker(): Worker<AnalyticsSyncJobData | SyncAllClientsJobData> {
  if (worker) return worker;

  worker = new Worker<AnalyticsSyncJobData | SyncAllClientsJobData>(
    ANALYTICS_QUEUE_NAME,
    PROCESSOR_PATH, // Sandboxed processor
    {
      connection: createRedisConnection(),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 5, // Lower than audit to respect Google API rate limits
    },
  );

  worker.on("ready", () => {
    console.log(`[analytics-worker] ready - consuming ${ANALYTICS_QUEUE_NAME}`);
  });

  worker.on("error", (err) => {
    console.error("[analytics-worker] error:", err);
  });

  worker.on(
    "failed",
    async (job: Job<AnalyticsSyncJobData | SyncAllClientsJobData> | undefined, err: Error) => {
      if (!job) {
        console.error("[analytics-worker] failed with no job context:", err);
        return;
      }
      const maxAttempts = job.opts.attempts ?? 1;
      console.error(
        `[analytics-worker] job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}):`,
        err.message,
      );
    },
  );

  worker.on("completed", (job) => {
    console.log(`[analytics-worker] job ${job.id} completed`);
  });

  return worker;
}
```

**Graceful shutdown pattern** (lines 95-110):
```typescript
export async function stopAnalyticsWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    console.error(
      `[analytics-worker] graceful shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms - forcing close`,
    );
    await current.close(true);
  }
}
```

---

### `open-seo-main/src/server/workers/analytics-processor.ts` (processor, job-processing)

**Analog:** `open-seo-main/src/server/workers/audit-processor.ts`

**Imports pattern** (lines 1-17):
```typescript
/**
 * Sandboxed BullMQ processor for analytics sync jobs.
 *
 * Runs in a child process to isolate Google API calls from the main event loop.
 * Handles two job types:
 *   - sync-all-clients: Fan-out to per-client jobs
 *   - sync-client-analytics: Actual GSC/GA4 sync for one client
 */
import type { Job } from "bullmq";
import type {
  AnalyticsSyncJobData,
  SyncAllClientsJobData,
} from "@/server/queues/analyticsQueue";
import { analyticsQueue } from "@/server/queues/analyticsQueue";
```

**Processor export pattern** (lines 59-74 from analog):
```typescript
export default async function processAnalyticsJob(
  job: Job<AnalyticsSyncJobData | SyncAllClientsJobData>,
): Promise<void> {
  if (job.name === "sync-all-clients") {
    // Fan-out: enqueue one job per active client
    const data = job.data as SyncAllClientsJobData;
    await fanOutToClients(data.mode);
    return;
  }

  if (job.name === "sync-client-analytics") {
    // Per-client sync: fetch tokens, call GSC/GA4, write snapshots
    const data = job.data as AnalyticsSyncJobData;
    await syncClientAnalytics(data);
    return;
  }

  console.error(`[analytics-processor] Unknown job name: ${job.name}`);
}
```

---

### `open-seo-main/src/server/services/analytics/gsc-client.ts` (service, API-client)

**Analog:** `AI-Writer/backend/services/gsc_service.py` (Python pattern adapted to TypeScript)

**Imports pattern** (derived from RESEARCH.md):
```typescript
/**
 * Google Search Console API client for analytics sync.
 *
 * Wraps googleapis searchconsole v1 with typed interfaces.
 * Uses OAuth2 access token from internal API.
 */
import { google } from "googleapis";
```

**Interface pattern** (derived from GSC API):
```typescript
export interface GSCDateMetrics {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCQueryMetrics extends GSCDateMetrics {
  query: string;
}
```

**API call pattern** (adapted from gsc_service.py lines 408-486):
```typescript
export async function fetchGSCDateMetrics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GSCDateMetrics[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const searchconsole = google.searchconsole({ version: "v1", auth });

  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["date"],
      rowLimit: 1000,
    },
  });

  return (response.data.rows || []).map((row) => ({
    date: row.keys![0],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}
```

---

### `open-seo-main/src/server/services/analytics/ga4-client.ts` (service, API-client)

**Analog:** `AI-Writer/backend/services/gsc_service.py` (Python pattern adapted to TypeScript)

**Imports pattern** (derived from RESEARCH.md):
```typescript
/**
 * Google Analytics 4 API client for analytics sync.
 *
 * Wraps googleapis analyticsdata v1beta with typed interfaces.
 * Uses OAuth2 access token from internal API.
 */
import { google } from "googleapis";
```

**Interface pattern** (derived from GA4 API):
```typescript
export interface GA4DateMetrics {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversions: number;
  revenue: number;
}
```

**API call pattern** (from RESEARCH.md):
```typescript
export async function fetchGA4Metrics(
  accessToken: string,
  propertyId: string, // numeric, e.g., "123456789"
  startDate: string,
  endDate: string,
): Promise<GA4DateMetrics[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const response = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "conversions" },
        { name: "totalRevenue" },
      ],
    },
  });

  return (response.data.rows || []).map((row) => ({
    date: row.dimensionValues![0].value!,
    sessions: parseInt(row.metricValues![0].value || "0", 10),
    users: parseInt(row.metricValues![1].value || "0", 10),
    newUsers: parseInt(row.metricValues![2].value || "0", 10),
    bounceRate: parseFloat(row.metricValues![3].value || "0"),
    avgSessionDuration: parseFloat(row.metricValues![4].value || "0"),
    conversions: parseInt(row.metricValues![5].value || "0", 10),
    revenue: parseFloat(row.metricValues![6].value || "0"),
  }));
}
```

---

## Shared Patterns

### Redis Connection
**Source:** `open-seo-main/src/server/lib/redis.ts`
**Apply to:** All queue and worker files
```typescript
import { createRedisConnection } from "@/server/lib/redis";

// For BullMQ Queue/Worker (each needs its own connection)
const connection = createRedisConnection();
```

### Shared Database Session (Python)
**Source:** `AI-Writer/backend/services/shared_db.py`
**Apply to:** All Python API endpoints
```python
from sqlalchemy.orm import Session
from services.shared_db import get_shared_db

@router.get("/...")
def my_endpoint(
    db: Session = Depends(get_shared_db),
):
    ...
```

### Encryption/Decryption
**Source:** `AI-Writer/backend/services/encryption.py`
**Apply to:** Internal token API only
```python
from services.encryption import decrypt_value

# Decrypt stored Fernet-encrypted bytes
plaintext = decrypt_value(token.access_token)
```

### TypeScript Types Package
**Source:** `packages/types/src/oauth.ts`
**Apply to:** Any new analytics types
```typescript
// Add to packages/types/src/analytics.ts
export interface GSCSnapshot {
  id: string;
  clientId: string;
  date: string;
  siteUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  syncedAt: string;
}
```

### ORM Model Conventions
**Source:** `AI-Writer/backend/models/client_oauth.py`
**Apply to:** New analytics ORM models
```python
from models.client import GUID, _utcnow
from services.shared_db import SharedBase

class MyModel(SharedBase):
    __tablename__ = "my_table"
    __table_args__ = (
        UniqueConstraint("col1", "col2", name="uq_my_table_col1_col2"),
    )
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    # ... columns
    
    def __repr__(self):
        return f"<MyModel id={self.id}>"
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `open-seo-main/src/server/lib/aiwriter-api.ts` | client | HTTP | New internal API client pattern; use standard fetch with X-Internal-Api-Key header |

**Recommendation for aiwriter-api.ts:**
```typescript
/**
 * Internal API client for fetching decrypted tokens from AI-Writer backend.
 */
const AIWRITER_INTERNAL_URL = process.env.AIWRITER_INTERNAL_URL || "http://localhost:8000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function getClientToken(
  clientId: string,
  provider: string,
): Promise<TokenResponse> {
  const res = await fetch(
    `${AIWRITER_INTERNAL_URL}/internal/tokens/${clientId}/${provider}`,
    {
      headers: {
        "X-Internal-Api-Key": INTERNAL_API_KEY!,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch token: ${res.status}`);
  }
  return res.json();
}
```

---

## Metadata

**Analog search scope:** 
- `AI-Writer/backend/alembic/versions/`
- `AI-Writer/backend/models/`
- `AI-Writer/backend/api/`
- `AI-Writer/backend/services/`
- `open-seo-main/src/server/queues/`
- `open-seo-main/src/server/workers/`
- `packages/types/src/`

**Files scanned:** 35
**Pattern extraction date:** 2026-04-19
