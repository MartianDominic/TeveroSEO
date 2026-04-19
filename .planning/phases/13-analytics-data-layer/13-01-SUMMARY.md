---
phase: 13-analytics-data-layer
plan: 01
subsystem: AI-Writer backend
tags: [database, orm, api, analytics, tdd]
dependency_graph:
  requires: [phase-12-oauth-tokens]
  provides: [gsc_snapshots, gsc_query_snapshots, ga4_snapshots, internal-token-api]
  affects: [open-seo-worker]
tech_stack:
  added: []
  patterns: [alembic-migration, sqlalchemy-orm, fastapi-internal-api]
key_files:
  created:
    - AI-Writer/backend/alembic/versions/0013_create_gsc_ga4_snapshots.py
    - AI-Writer/backend/models/analytics_snapshots.py
    - AI-Writer/backend/api/internal.py
    - AI-Writer/backend/tests/test_analytics_snapshots.py
  modified:
    - AI-Writer/backend/main.py
decisions:
  - passive_deletes=True on snapshot relationships for proper CASCADE behavior
  - SQL DELETE used in cascade test to bypass ORM backref handling in SQLite
  - SQLite foreign_keys pragma enabled in test fixture for CASCADE support
metrics:
  duration: 6m
  completed: 2026-04-19T10:20:40Z
---

# Phase 13 Plan 01: Analytics Database Foundation Summary

Alembic migration 0013 with GSC/GA4 snapshot tables, ORM models, and internal token API for open-seo worker.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create failing tests for analytics snapshot models | fd4c8bf1 | tests/test_analytics_snapshots.py |
| 2 | Create Alembic migration 0013 for snapshot tables | 61e0dcd1 | alembic/versions/0013_create_gsc_ga4_snapshots.py |
| 3 | Create ORM models for analytics snapshots | 7da2bd39 | models/analytics_snapshots.py |
| 4 | Create internal API endpoint for token decryption | 37c7414a | api/internal.py, main.py |
| 5 | Run tests and verify GREEN state | a5c93967 | tests/test_analytics_snapshots.py, models/analytics_snapshots.py |

## Implementation Details

### Database Schema (Migration 0013)

Three tables created for analytics data storage:

**gsc_snapshots:**
- Daily aggregate GSC metrics per client
- Columns: id, client_id, date, site_url, clicks, impressions, ctr, position, synced_at
- UNIQUE(client_id, date), Index on (client_id, date)

**gsc_query_snapshots:**
- Top queries per day per client
- Columns: id, client_id, date, query, clicks, impressions, ctr, position
- UNIQUE(client_id, date, query), Index on (client_id, date)

**ga4_snapshots:**
- Daily GA4 metrics per client (7 metrics)
- Columns: id, client_id, date, property_id, sessions, users, new_users, bounce_rate, avg_session_duration, conversions, revenue, synced_at
- UNIQUE(client_id, date), Index on (client_id, date)

All tables have FK to clients(id) with ON DELETE CASCADE.

### ORM Models

Three SQLAlchemy models inheriting from SharedBase:
- `GSCSnapshot` - daily GSC aggregate metrics
- `GSCQuerySnapshot` - top queries per day
- `GA4Snapshot` - daily GA4 metrics

All relationships use `passive_deletes=True` to allow database-level CASCADE delete.

### Internal API

**Endpoint:** `GET /internal/tokens/{client_id}/{provider}`

**Security:**
- X-Internal-Api-Key header required (from INTERNAL_API_KEY env var)
- Only returns tokens where is_active=True
- Never logs access_token or refresh_token values

**Response schema (TokenResponse):**
- access_token: str
- refresh_token: Optional[str]
- token_expiry: Optional[str] (ISO format)
- scopes: List[str]
- gsc_site_url: Optional[str]
- ga4_property_id: Optional[str]

### Test Coverage

6 tests covering:
1. GSCSnapshot insertion with valid client_id
2. UNIQUE(client_id, date) constraint on GSC snapshots
3. GSCQuerySnapshot insertion with query field
4. UNIQUE(client_id, date, query) constraint on query snapshots
5. GA4Snapshot insertion with all 7 metrics
6. CASCADE delete from client removes all snapshots

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLite CASCADE delete test fix**
- **Found during:** Task 5
- **Issue:** SQLite doesn't enforce FK CASCADE by default, and ORM backrefs interfere with delete
- **Fix:** Added PRAGMA foreign_keys=ON in test fixture, used SQL DELETE instead of ORM delete, added passive_deletes=True to relationships
- **Files modified:** tests/test_analytics_snapshots.py, models/analytics_snapshots.py
- **Commit:** a5c93967

## Verification Results

```
$ cd AI-Writer/backend && python3 -m pytest tests/test_analytics_snapshots.py -v
======================== 6 passed in 1.59s =========================
```

```
$ python3 -c "from models.analytics_snapshots import GSCSnapshot, GSCQuerySnapshot, GA4Snapshot; print('Models imported successfully')"
Models imported successfully
```

```
$ python3 -c "from api.internal import router; print(f'Internal router loaded with prefix={router.prefix}')"
Internal router loaded with prefix=/internal
```

## Self-Check: PASSED

- [x] AI-Writer/backend/alembic/versions/0013_create_gsc_ga4_snapshots.py exists
- [x] AI-Writer/backend/models/analytics_snapshots.py exists
- [x] AI-Writer/backend/api/internal.py exists
- [x] AI-Writer/backend/tests/test_analytics_snapshots.py exists
- [x] Commit fd4c8bf1 exists (Task 1)
- [x] Commit 61e0dcd1 exists (Task 2)
- [x] Commit 7da2bd39 exists (Task 3)
- [x] Commit 37c7414a exists (Task 4)
- [x] Commit a5c93967 exists (Task 5)
