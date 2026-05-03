# Phase 67: Database Consolidation

**Milestone:** v8.0 SaaS Hardening
**Duration:** 3 weeks
**Priority:** CRITICAL - Foundation for all other v8.0 phases

## Overview

Consolidate `open_seo` and `alwrity` databases into unified `tevero` database. Resolves 7+ CRITICAL/HIGH issues including table name collisions and schema mismatches.

## Sub-Plans

| Plan | Name | Wave | Depends On |
|------|------|------|------------|
| 67-01 | Schema Design | 1 | None |
| 67-02 | Migration Scripts | 1 | 67-01 |
| 67-03 | Cutover | 2 | 67-02 |

## Issues Resolved

- CRITICAL-DB-002: Table collision `gsc_snapshots`
- CRITICAL-DB-005: Table collision `ga4_snapshots`
- HIGH-DB-001: `clients.workspace_id` nullable in alwrity
- HIGH-DB-003: Cross-DB sync lacks rollback
- HIGH-DB-004: Voice profiles linked differently
- MED-DB-006: DateTime timezone inconsistency
- MED-DB-007: No cross-database JOINs possible

---

## Plan 67-01: Schema Design

```yaml
---
phase: 67-database-consolidation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - open-seo-main/src/db/schema/shared-clients.ts
  - open-seo-main/src/db/schema/shared-voice-profiles.ts
  - open-seo-main/src/db/schema/seo-gsc-snapshots.ts
  - open-seo-main/src/db/schema/seo-ga4-snapshots.ts
  - open-seo-main/drizzle.config.ts
  - AI-Writer/backend/models/shared_models.py
  - AI-Writer/backend/alembic/env.py
autonomous: true
requirements:
  - CRITICAL-DB-002
  - CRITICAL-DB-005
  - HIGH-DB-001
  - HIGH-DB-004
  - MED-DB-006
must_haves:
  truths:
    - Unified schema DDL exists for shared_clients, shared_voice_profiles
    - Namespace prefixes applied (shared_, seo_, content_, biz_, analytics_)
    - workspace_id NOT NULL constraint on shared_clients
    - TIMESTAMPTZ used consistently for all timestamp columns
  artifacts:
    - open-seo-main/src/db/schema/shared-clients.ts (export sharedClients)
    - open-seo-main/src/db/schema/shared-voice-profiles.ts (export sharedVoiceProfiles)
    - open-seo-main/src/db/schema/seo-gsc-snapshots.ts (export seoGscDailySnapshots)
    - AI-Writer/backend/models/shared_models.py (SharedClient, SharedVoiceProfile)
  key_links:
    - Drizzle owns shared_*, seo_*, biz_*, analytics_* tables
    - SQLAlchemy owns content_* tables
    - Both ORMs connect to single tevero database
---
```

<objective>
Design unified tevero database schema with namespace prefixes, merging clients and voice_profiles tables, and resolving timezone inconsistencies.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Create Unified Clients Schema (Drizzle)

- Create `open-seo-main/src/db/schema/shared-clients.ts`
- Merge columns from both `open_seo.clients` and `alwrity.clients`
- Make `workspace_id` NOT NULL
- Use `timestamptz` for all timestamp columns
- Add unique constraint on (workspace_id, domain)

Files: `open-seo-main/src/db/schema/shared-clients.ts`

Acceptance:
- [ ] Schema compiles without errors
- [ ] workspace_id has NOT NULL constraint
- [ ] All timestamps use TIMESTAMPTZ

### Task 2: Create Unified Voice Profiles Schema

- Create `open-seo-main/src/db/schema/shared-voice-profiles.ts`
- Merge `voice_profiles` (clientId FK) and `writing_personas` (userId FK)
- Add CHECK constraint for ownership (client_id OR user_id must be set)

Files: `open-seo-main/src/db/schema/shared-voice-profiles.ts`

Acceptance:
- [ ] Schema supports both client-level and user-level profiles
- [ ] Ownership CHECK constraint defined

### Task 3: Create Namespaced Analytics Schemas

- Rename `gsc_snapshots` to `seo_gsc_daily_snapshots`
- Rename `ga4_snapshots` to `seo_ga4_daily_snapshots`
- Add CASCADE on client_id FK

Files: `open-seo-main/src/db/schema/seo-gsc-snapshots.ts`, `open-seo-main/src/db/schema/seo-ga4-snapshots.ts`

Acceptance:
- [ ] No table name collisions
- [ ] CASCADE delete on client_id FK

### Task 4: Configure ORM Boundaries

- Update `drizzle.config.ts` with tablesFilter for owned prefixes
- Update `alembic/env.py` to only manage content_* tables
- Create `_migration_ownership` tracking table

Files: `open-seo-main/drizzle.config.ts`, `AI-Writer/backend/alembic/env.py`

Acceptance:
- [ ] Drizzle ignores content_* tables
- [ ] Alembic ignores shared_*, seo_*, biz_* tables

### Task 5: Create SQLAlchemy Reflection Models

- Create `AI-Writer/backend/models/shared_models.py`
- Use `Table(..., autoload_with=engine)` for Drizzle-owned tables
- Map relationships correctly

Files: `AI-Writer/backend/models/shared_models.py`

Acceptance:
- [ ] SQLAlchemy can read shared_clients
- [ ] SQLAlchemy can read shared_voice_profiles

---

## Plan 67-02: Migration Scripts

```yaml
---
phase: 67-database-consolidation
plan: 02
type: execute
wave: 1
depends_on: [67-01]
files_modified:
  - open-seo-main/drizzle/migrations/0001_create_tevero_base.sql
  - scripts/db/migrate_clients.sql
  - scripts/db/migrate_voice_profiles.sql
  - scripts/db/migrate_analytics.sql
  - scripts/db/rollback_clients.sql
  - scripts/db/verify_migration.sql
autonomous: true
requirements:
  - HIGH-DB-003
must_haves:
  truths:
    - All migration scripts wrapped in BEGIN/COMMIT
    - Rollback script exists for each migration
    - Data validation queries verify row counts
    - Orphan handling for NULL workspace_id (prefix with ORPHAN_)
  artifacts:
    - scripts/db/migrate_clients.sql
    - scripts/db/migrate_voice_profiles.sql
    - scripts/db/rollback_clients.sql
    - scripts/db/verify_migration.sql
  key_links:
    - Migrations run in order: base -> clients -> voice -> analytics
    - Rollbacks run in reverse order
---
```

<objective>
Create idempotent migration scripts with transaction wrappers and rollback capability for zero-downtime database consolidation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Create Base Migration

- Create tevero database and extensions
- Create `_migration_log` and `_migration_ownership` tables
- Enable uuid-ossp and pg_trgm extensions

Files: `open-seo-main/drizzle/migrations/0001_create_tevero_base.sql`

Acceptance:
- [ ] Script is idempotent (IF NOT EXISTS)
- [ ] Extensions enabled

### Task 2: Create Clients Migration Script

- Migrate from open_seo.clients (primary source)
- Merge alwrity.clients (non-overlapping records)
- Handle NULL workspace_id with ORPHAN_ prefix
- Log to _migration_log

Files: `scripts/db/migrate_clients.sql`

Acceptance:
- [ ] Transaction wrapped
- [ ] No NULL workspace_id in result
- [ ] Migration logged

### Task 3: Create Voice Profiles Migration Script

- Migrate open_seo.voice_profiles with clientId
- Migrate alwrity.writing_personas with userId (prefix 'wp_')
- Preserve all metadata

Files: `scripts/db/migrate_voice_profiles.sql`

Acceptance:
- [ ] Both sources migrated
- [ ] No duplicate IDs

### Task 4: Create Rollback Scripts

- Create rollback for each migration
- Restore from backup tables
- Log rollback in _migration_log

Files: `scripts/db/rollback_clients.sql`, `scripts/db/rollback_voice_profiles.sql`

Acceptance:
- [ ] Rollbacks are idempotent
- [ ] Backup tables referenced correctly

### Task 5: Create Verification Script

- Compare row counts between source and target
- Check referential integrity
- Verify no NULL workspace_id
- Check for FK violations

Files: `scripts/db/verify_migration.sql`

Acceptance:
- [ ] Returns pass/fail for each check
- [ ] No silent failures

---

## Plan 67-03: Cutover

```yaml
---
phase: 67-database-consolidation
plan: 03
type: execute
wave: 2
depends_on: [67-02]
files_modified:
  - open-seo-main/src/db/index.ts
  - open-seo-main/src/db/dual-write.ts
  - AI-Writer/backend/services/shared_db.py
  - AI-Writer/backend/services/dual_write.py
  - docker-compose.vps.yml
  - .env.vps.example
autonomous: true
requirements:
  - HIGH-DB-003
  - MED-DB-007
must_haves:
  truths:
    - Dual-write enabled during migration window
    - Feature flags control read percentage
    - DATABASE_URL points to tevero after cutover
    - Old databases archived (read-only)
  artifacts:
    - open-seo-main/src/db/dual-write.ts (createClient, updateClient with shadow write)
    - AI-Writer/backend/services/dual_write.py (shadow write functions)
  key_links:
    - SHADOW_WRITE_ENABLED env var
    - DB_READ_PERCENTAGE_TEVERO env var
---
```

<objective>
Execute zero-downtime cutover with dual-write pattern, gradual read migration, and verification gates.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Implement Dual-Write (TypeScript)

- Create `open-seo-main/src/db/dual-write.ts`
- Shadow write to tevero when SHADOW_WRITE_ENABLED=true
- Fire-and-forget with error logging

Files: `open-seo-main/src/db/dual-write.ts`, `open-seo-main/src/db/index.ts`

Acceptance:
- [ ] Shadow writes don't block primary
- [ ] Errors logged but not thrown

### Task 2: Implement Dual-Write (Python)

- Create `AI-Writer/backend/services/dual_write.py`
- Async shadow write with asyncio.create_task
- Connect to tevero database

Files: `AI-Writer/backend/services/dual_write.py`, `AI-Writer/backend/services/shared_db.py`

Acceptance:
- [ ] Python shadow writes work
- [ ] Connection pooling configured

### Task 3: Implement Read Migration Feature Flags

- Add `shouldReadFromTevero(table)` function
- Percentage-based routing per table
- Start at 10% for clients

Files: `open-seo-main/src/db/read-router.ts`

Acceptance:
- [ ] Percentage configurable via env
- [ ] Per-table routing works

### Task 4: Update Docker Compose

- Add DATABASE_URL for tevero
- Keep legacy URLs for verification period
- Add SHADOW_WRITE_ENABLED flag

Files: `docker-compose.vps.yml`, `.env.vps.example`

Acceptance:
- [ ] New env vars documented
- [ ] Backwards compatible

### Task 5: Create Cutover Runbook

- Document pre-cutover checklist
- Execution steps with timing
- Rollback procedure
- Emergency contacts

Files: `docs/runbooks/database-cutover.md`

Acceptance:
- [ ] Step-by-step guide
- [ ] Rollback documented
