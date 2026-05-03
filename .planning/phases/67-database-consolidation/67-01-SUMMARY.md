---
phase: 67-database-consolidation
plan: 01
subsystem: database
tags: [schema, drizzle, sqlalchemy, consolidation]
dependency_graph:
  requires: []
  provides: [shared_clients, shared_voice_profiles, seo_analytics_schemas, orm_boundaries]
  affects: [AI-Writer, open-seo-main]
tech_stack:
  added: []
  patterns: [table_reflection, orm_boundary_separation, namespace_prefixes]
key_files:
  created:
    - open-seo-main/src/db/schema/shared-clients.ts
    - open-seo-main/src/db/schema/shared-voice-profiles.ts
    - open-seo-main/src/db/schema/seo-gsc-snapshots.ts
    - open-seo-main/src/db/schema/seo-ga4-snapshots.ts
    - AI-Writer/backend/models/shared_models.py
  modified:
    - open-seo-main/drizzle.config.ts
    - AI-Writer/backend/alembic/env.py
    - open-seo-main/src/db/schema/index.ts
decisions:
  - Namespace prefixes: shared_*, seo_*, biz_*, analytics_* for Drizzle; content_* for SQLAlchemy
  - Table reflection pattern for SQLAlchemy to read Drizzle-owned tables
  - workspace_id NOT NULL constraint on shared_clients (HIGH-DB-001)
  - TIMESTAMPTZ for all timestamp columns (MED-DB-006)
metrics:
  duration: 5m 48s
  completed: 2026-05-03T21:36:27Z
  tasks_completed: 5
  files_created: 5
  files_modified: 3
---

# Phase 67 Plan 01: Schema Design Summary

Unified Drizzle schemas with namespace prefixes, ORM boundary configuration, and SQLAlchemy reflection models for database consolidation.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 93556dd90 | feat(67-01): create unified shared_clients schema |
| 2 | 8a85b603b | feat(67-01): create unified shared_voice_profiles schema |
| 3 | 70f22d952 | feat(67-01): create namespaced SEO analytics schemas |
| 4 | 9c3cb0b95 | chore(67-01): configure ORM boundaries for database consolidation |
| 5 | 3986ffbd2 | feat(67-01): create SQLAlchemy reflection models for Drizzle tables |
| - | 2458fd4df | chore(67-01): export unified schemas from schema/index.ts |

## Task Completion

### Task 1: Unified Clients Schema (shared-clients.ts)

Created `open-seo-main/src/db/schema/shared-clients.ts` merging columns from:
- open-seo-main clients (domain, contact info, GSC credentials, baseline metrics)
- AI-Writer clients (CMS settings, brand voice, model overrides)

Key features:
- `workspace_id` NOT NULL constraint (HIGH-DB-001)
- TIMESTAMPTZ for all timestamps (MED-DB-006)
- Unique constraint on (workspace_id, domain)
- Check constraints for status and cms_type enums

### Task 2: Unified Voice Profiles Schema (shared-voice-profiles.ts)

Created `open-seo-main/src/db/schema/shared-voice-profiles.ts` merging:
- open-seo-main voice_profiles (40+ voice dimensions, SEO integration)
- AI-Writer writing_personas (linguistic fingerprint, platform adaptations)

Key features:
- `client_id` FK to sharedClients (nullable) for client-level profiles
- `user_id` FK to organization (nullable) for user-level profiles
- CHECK constraint: `client_id IS NOT NULL OR user_id IS NOT NULL`
- All voice dimensions preserved (tone, formality, vocabulary, SEO priority)

### Task 3: Namespaced Analytics Schemas

Created two new schema files with `seo_` namespace prefix:

1. `seo-gsc-snapshots.ts`:
   - `seo_gsc_daily_snapshots` - daily GSC aggregates
   - `seo_gsc_query_snapshots` - top queries per day
   - CASCADE delete on client_id FK

2. `seo-ga4-snapshots.ts`:
   - `seo_ga4_daily_snapshots` - daily GA4 aggregates
   - `seo_ga4_page_snapshots` - top pages per day
   - CASCADE delete on client_id FK

### Task 4: ORM Boundaries Configuration

Updated both ORMs to respect namespace boundaries:

1. `drizzle.config.ts`:
   - Added `tablesFilter` array with owned namespaces
   - Includes: shared_*, seo_*, biz_*, analytics_*
   - Legacy tables included for backwards compatibility

2. `alembic/env.py`:
   - Added `include_object` function for table filtering
   - Skips Drizzle-owned prefixes: shared_*, seo_*, biz_*, analytics_*
   - Explicitly includes content_* tables

### Task 5: SQLAlchemy Reflection Models

Created `AI-Writer/backend/models/shared_models.py`:
- `SharedClient` - accessor for shared_clients table
- `SharedVoiceProfile` - accessor for shared_voice_profiles table
- `SeoGscDailySnapshot` - accessor for seo_gsc_daily_snapshots
- `SeoGa4DailySnapshot` - accessor for seo_ga4_daily_snapshots

Features:
- Table reflection with `autoload_with=engine`
- Caching to avoid repeated reflection calls
- `clear_reflection_cache()` for post-migration refresh
- Graceful handling when tables don't exist yet

## Deviations from Plan

None - plan executed exactly as written.

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| shared-clients.ts exists | PASS |
| workspace_id NOT NULL | PASS |
| TIMESTAMPTZ used | PASS |
| sharedClients exported | PASS |
| shared-voice-profiles.ts exists | PASS |
| client_id and user_id columns | PASS |
| sharedVoiceProfiles exported | PASS |
| seo-gsc-snapshots.ts exists | PASS |
| seo-ga4-snapshots.ts exists | PASS |
| seo_gsc_daily_snapshots table name | PASS |
| CASCADE delete on FK | PASS |
| drizzle.config.ts tablesFilter | PASS |
| alembic/env.py include_object | PASS |
| shared_models.py exists | PASS |
| autoload_with usage | PASS |
| shared_clients reflection | PASS |
| shared_voice_profiles reflection | PASS |

## Requirements Addressed

| Requirement | Description | Status |
|-------------|-------------|--------|
| CRITICAL-DB-002 | Single source of truth for client data | DONE |
| CRITICAL-DB-005 | Namespaced analytics tables | DONE |
| HIGH-DB-001 | workspace_id NOT NULL constraint | DONE |
| HIGH-DB-004 | ORM boundary separation | DONE |
| MED-DB-006 | TIMESTAMPTZ for all timestamps | DONE |

## Next Steps

Plan 67-02 (Migration Scripts) will:
1. Create Drizzle migration for new tables
2. Create data migration scripts to copy existing data
3. Add foreign key references between systems

## Self-Check: PASSED

All created files exist and commits verified.
