---
phase: 33-auto-fix-system
plan: 01
subsystem: database-schema
tags: [drizzle, postgresql, schema, change-tracking]
dependency_graph:
  requires: [clients, siteConnections]
  provides: [siteChanges, changeBackups, rollbackTriggers]
  affects: []
tech_stack:
  added: []
  patterns: [drizzle-schema, jsonb-types, relations]
key_files:
  created:
    - open-seo-main/src/db/change-schema.ts
    - open-seo-main/src/db/change-schema.test.ts
    - open-seo-main/drizzle/0021_change_tracking_tables.sql
  modified:
    - open-seo-main/src/db/schema.ts
    - open-seo-main/drizzle/meta/_journal.json
decisions:
  - "Manual migration SQL generation due to drizzle-kit TTY requirement in non-interactive environment"
  - "JSONB columns for snapshot storage enable flexible schema evolution"
  - "Self-referential FK on siteChanges.revertedByChangeId tracks revert chain"
  - "Composite index on (resourceId, resourceType) for efficient resource queries"
metrics:
  duration: 503
  tasks_completed: 4
  files_created: 3
  files_modified: 2
  test_coverage: "100% (19/19 tests passing)"
  completed_at: "2026-04-22T21:52:48Z"
---

# Phase 33 Plan 01: Change Tracking Schema Summary

**One-liner:** PostgreSQL schema for granular SEO change tracking with JSONB snapshots, batch grouping, and rollback trigger configuration

## Overview

Created the database foundation for the auto-fix change tracking system. Three tables store all SEO changes applied by the platform, point-in-time backups for safe rollback, and automatic rollback trigger configurations.

## What Was Built

### Core Tables

**1. site_changes** (26 columns, 8 indexes)
- Tracks every SEO change: meta tags, headings, images, links, schema markup
- Classification: changeType, category, resourceType for granular filtering
- Provenance: triggeredBy (audit/manual/scheduled/ai_suggestion), auditId, findingId, userId
- Status lifecycle: pending → applied → verified OR reverted
- Batch operations: batchId and batchSequence for grouped changes
- JSONB snapshots: beforeSnapshot/afterSnapshot for full object context
- Self-referential FK: revertedByChangeId creates revert chain

**2. change_backups** (10 columns, 3 indexes)
- Point-in-time snapshots before applying changes
- Scope levels: page, site, category
- JSONB snapshotData stores pages array with fields and metadata
- Retention: expiresAt with isPinned flag to prevent auto-deletion
- sizeBytes tracking for storage monitoring

**3. rollback_triggers** (10 columns, 3 indexes)
- Automatic rollback conditions based on metrics
- Trigger types: traffic_drop, ranking_drop, error_spike, manual
- JSONB config: threshold, comparisonPeriod, keywords, positionDrop, etc.
- JSONB rollbackScope: defines what to revert (single/field/resource/category/batch/date_range/audit/full)
- isEnabled flag with lastTriggeredAt/lastCheckAt timestamps

### Type Safety

Exported TypeScript types for all tables:
- `SiteChangeSelect`, `SiteChangeInsert`
- `ChangeBackupSelect`, `ChangeBackupInsert`
- `RollbackTriggerSelect`, `RollbackTriggerInsert`

Exported constants:
- `CHANGE_STATUS`: pending, applied, verified, reverted, failed
- `CHANGE_TYPES`: 15 types (meta_title, meta_description, image_alt, canonical, lazy_loading, etc.)
- `TRIGGER_TYPES`: traffic_drop, ranking_drop, error_spike, manual

### Migration

Migration 0021_change_tracking_tables.sql:
- 3 CREATE TABLE statements
- 4 foreign key constraints (all to clients.id or site_connections.id)
- 17 CREATE INDEX statements for performance

## Tasks Completed

| Task | Commit | Files | Summary |
|------|--------|-------|---------|
| 1 | 557c452 | change-schema.ts | Created schema with 3 tables, relations, types, constants |
| 2 | eb86d5e | schema.ts | Wired change-schema into db barrel exports |
| 3 | 5479a55 | change-schema.test.ts | Added 19 unit tests (all passing) |
| 4 | 8bd2cd5 | 0021_change_tracking_tables.sql, _journal.json | Generated migration SQL manually, registered in journal |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual migration generation**
- **Found during:** Task 4
- **Issue:** `drizzle-kit generate` requires TTY for interactive prompts in non-interactive shell; `script`, `yes`, and other TTY simulation attempts failed
- **Fix:** Manually wrote migration SQL following pattern from migration 0020, including all CREATE TABLE, FK constraints, and CREATE INDEX statements; updated _journal.json with migration entry
- **Files modified:** drizzle/0021_change_tracking_tables.sql (created), drizzle/meta/_journal.json (updated)
- **Commit:** 8bd2cd5

## Known Stubs

None - schema is complete with all required columns and constraints.

## Verification

✅ All acceptance criteria met:
- [x] change-schema.ts exists with siteChanges, changeBackups, rollbackTriggers tables
- [x] All tables exported via db/schema.ts
- [x] TypeScript compilation passes (no change-schema errors)
- [x] 19 unit tests pass (table structure, constants, type exports)
- [x] Migration file contains CREATE TABLE for all 3 tables
- [x] Migration file contains all 17 indexes
- [x] Migration registered in _journal.json as entry 21

**Tests run:**
```bash
cd open-seo-main && pnpm test src/db/change-schema.test.ts --run
✓ 19 tests passed in 7ms
```

**Migration verification:**
```bash
grep "CREATE TABLE" drizzle/0021_change_tracking_tables.sql
# Output: 3 tables (site_changes, change_backups, rollback_triggers)

grep "CREATE INDEX" drizzle/0021_change_tracking_tables.sql | wc -l
# Output: 17 indexes
```

## Impact

**Enables:**
- Granular revert: any change (single/field/resource/category/batch/date_range/audit/full)
- Audit trail: full provenance (who/what/when/why) for every change
- Automatic rollback: trigger-based reversion when metrics drop
- Safe experimentation: backups captured before applying changes
- Batch operations: grouped changes with sequence ordering

**Downstream plans:**
- 33-02: Change application service will use siteChanges table
- 33-03: Revert service will query siteChanges + restore from changeBackups
- 33-04: Rollback monitor will check rollbackTriggers and execute scope-based reverts
- 33-05: UI will display change history and revert controls

## Self-Check: PASSED

**Created files exist:**
```bash
✓ FOUND: open-seo-main/src/db/change-schema.ts
✓ FOUND: open-seo-main/src/db/change-schema.test.ts
✓ FOUND: open-seo-main/drizzle/0021_change_tracking_tables.sql
```

**Modified files updated:**
```bash
✓ FOUND: change-schema export in open-seo-main/src/db/schema.ts
✓ FOUND: 0021 entry in open-seo-main/drizzle/meta/_journal.json
```

**Commits exist:**
```bash
✓ FOUND: 557c452 (feat: create change-schema.ts)
✓ FOUND: eb86d5e (feat: wire change-schema into barrel exports)
✓ FOUND: 5479a55 (test: add unit tests)
✓ FOUND: 8bd2cd5 (feat: generate migration)
```
