---
phase: 67
plan: 03
subsystem: database
tags: [database, migration, cutover, dual-write, feature-flags]
dependency_graph:
  requires: [67-02]
  provides: [dual-write, read-router, cutover-runbook]
  affects: [open-seo-main, AI-Writer, docker-compose]
tech_stack:
  added: [asyncpg]
  patterns: [dual-write, fire-and-forget, feature-flags, percentage-based-routing]
key_files:
  created:
    - open-seo-main/src/db/dual-write.ts
    - open-seo-main/src/db/read-router.ts
    - AI-Writer/backend/services/dual_write.py
    - docs/runbooks/database-cutover.md
  modified:
    - open-seo-main/src/db/index.ts
    - AI-Writer/backend/services/shared_db.py
    - docker-compose.vps.yml
    - .env.vps.example
decisions:
  - Fire-and-forget pattern for shadow writes (non-blocking)
  - SHADOW_WRITE_ENABLED defaults to false (opt-in)
  - DB_READ_PERCENTAGE_TEVERO uses Math.random for distribution
  - Tevero connection pool size 5 (smaller than primary)
  - 3-week phased cutover timeline in runbook
metrics:
  duration_seconds: 299
  completed_at: "2026-05-03T21:50:41Z"
  tasks_completed: 5
  tasks_total: 5
  files_created: 4
  files_modified: 4
---

# Phase 67 Plan 03: Cutover Summary

Zero-downtime database cutover with dual-write pattern, gradual read migration, and comprehensive runbook.

## One-liner

Dual-write pattern with SHADOW_WRITE_ENABLED flag and DB_READ_PERCENTAGE_TEVERO for gradual read migration, enabling instant rollback during 3-week cutover.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Implement Dual-Write (TypeScript) | 680e7aa71 | dual-write.ts, index.ts |
| 2 | Implement Dual-Write (Python) | 2006f13ad | dual_write.py, shared_db.py |
| 3 | Implement Read Migration Feature Flags | 95e7bbbd1 | read-router.ts |
| 4 | Update Docker Compose | 5672384fe | docker-compose.vps.yml, .env.vps.example |
| 5 | Create Cutover Runbook | c3b432cd0 | database-cutover.md |

## Implementation Details

### Task 1: TypeScript Dual-Write

Created `open-seo-main/src/db/dual-write.ts`:
- `dualWriteClient()` for insert/update operations
- `dualWriteClientInsert()` and `dualWriteClientUpdate()` type-safe variants
- `createTeveroDb()` with lazy connection pooling
- Fire-and-forget shadow writes using `.catch()` pattern
- `SHADOW_WRITE_ENABLED` env var control

Exported from `index.ts` for easy consumption.

### Task 2: Python Dual-Write

Created `AI-Writer/backend/services/dual_write.py`:
- `shadow_write_client()` async function with `create_async_engine`
- `shadow_update_client()` for update operations
- `fire_and_forget_shadow_write()` sync wrapper for async shadow writes
- `SHADOW_WRITE_ENABLED` env var control
- Error logging without blocking primary operations

Updated `shared_db.py`:
- Added `get_tevero_db()` dependency for tevero sessions
- Lazy engine initialization for tevero
- `close_tevero_engine()` for graceful shutdown

### Task 3: Read Migration Feature Flags

Created `open-seo-main/src/db/read-router.ts`:
- `DB_READ_PERCENTAGE_TEVERO` (0-100) controls read distribution
- `shouldReadFromTevero()` uses `Math.random()` for percentage-based routing
- `getReadDb()` returns appropriate database connection
- Fallback to primary if tevero connection fails
- `ROUTABLE_TABLES` whitelist for migrated tables only

### Task 4: Docker Compose Updates

Updated `docker-compose.vps.yml`:
- Added `TEVERO_DATABASE_URL` to open-seo, open-seo-worker, ai-writer-backend
- Added `SHADOW_WRITE_ENABLED=false` (default off)
- Added `DB_READ_PERCENTAGE_TEVERO=0` (default off)

Updated `.env.vps.example`:
- Documented all new environment variables
- Explained 3-phase migration process
- Documented instant rollback procedure

### Task 5: Cutover Runbook

Created `docs/runbooks/database-cutover.md`:
- Pre-Cutover Checklist (database, infrastructure, monitoring, communication)
- Phase 1: Enable Shadow Write (Week 1)
- Phase 2: Gradual Read Migration (Week 2) - 10% -> 50% -> 90% -> 100%
- Phase 3: Full Cutover (Week 3)
- Rollback Procedure with <1 minute recovery time
- Emergency contacts and verification queries

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **Fire-and-forget pattern**: Shadow writes do not block primary operations. Errors are logged but not propagated.

2. **Default off**: Both SHADOW_WRITE_ENABLED and DB_READ_PERCENTAGE_TEVERO default to off, requiring explicit opt-in.

3. **Smaller tevero pool**: Tevero connection pool (5 connections) is smaller than primary (20) since it handles shadow/migration traffic only.

4. **Math.random for distribution**: Simple random selection for read routing. No sticky sessions or consistent hashing needed for this migration pattern.

5. **3-week timeline**: Conservative timeline allows for proper monitoring and rollback at each phase.

## Environment Variables Added

| Variable | Default | Description |
|----------|---------|-------------|
| `TEVERO_DATABASE_URL` | (empty) | Connection string for consolidated database |
| `SHADOW_WRITE_ENABLED` | `false` | Enable dual-write to tevero |
| `DB_READ_PERCENTAGE_TEVERO` | `0` | Percentage of reads to route to tevero (0-100) |

## Verification Commands

```bash
# Check shadow write status
grep "dual-write" /var/log/syslog | tail -20

# Verify read percentage
curl -s http://localhost:3001/api/health | jq '.readRouter'

# Test tevero connectivity
psql $TEVERO_DATABASE_URL -c "SELECT 1"
```

## Self-Check: PASSED

- [x] File exists: open-seo-main/src/db/dual-write.ts
- [x] File exists: open-seo-main/src/db/read-router.ts
- [x] File exists: AI-Writer/backend/services/dual_write.py
- [x] File exists: docs/runbooks/database-cutover.md
- [x] Commit 680e7aa71 exists
- [x] Commit 2006f13ad exists
- [x] Commit 95e7bbbd1 exists
- [x] Commit 5672384fe exists
- [x] Commit c3b432cd0 exists
