# Database Migration Safety Audit - Round 2

**Date:** 2026-04-28  
**Scope:** open-seo-main/drizzle/*.sql, AI-Writer/backend/alembic/versions/*.py, AI-Writer/backend/database/migrations/*.sql  
**Auditor:** Claude Code

---

## Executive Summary

This audit examines 50+ database migration files across two subsystems:
- **open-seo-main**: 34 Drizzle SQL migrations (0000-0033)
- **AI-Writer**: 15 Alembic Python migrations (0001-0015) + 7 standalone SQL migrations

**Overall Risk Level:** MEDIUM-HIGH

### Key Findings Summary

| Severity | Count | Category |
|----------|-------|----------|
| CRITICAL | 3 | Data loss potential, missing rollback |
| HIGH | 7 | Long-running ops, deployment issues |
| MEDIUM | 9 | Missing down migrations, type mismatches |
| LOW | 5 | Missing indexes, documentation gaps |

---

## CRITICAL Findings

### CRIT-01: Destructive DROP TABLE Operations Without Data Preservation

**File:** `open-seo-main/drizzle/0002_clerk_auth_migration.sql`

```sql
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
```

**Issue:** These DROP statements permanently delete authentication tables. The comment states "no production data to preserve" but this assumption may be incorrect during deployment.

**Risk:**
- Complete loss of user sessions on migration
- No rollback capability for session data
- CASCADE can delete dependent data unexpectedly

**Remediation:**
1. Add explicit data backup step before DROP
2. Create down migration to recreate tables (structure only)
3. Add pre-migration check: `SELECT COUNT(*) FROM session WHERE ...`

---

### CRIT-02: Mass DELETE Operations Before FK Constraints

**File:** `open-seo-main/drizzle/0031_add_missing_fk_constraints.sql`

```sql
DELETE FROM client_goals WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM alert_rules WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM alerts WHERE client_id NOT IN (SELECT id FROM clients);
-- ... 10 more DELETE statements
```

**Issue:** Mass deletions of orphaned records are IRREVERSIBLE. If the subquery is incorrect or there's a race condition, legitimate data could be deleted.

**Risk:**
- Permanent data loss if clients table is incomplete
- No transaction isolation specified
- No backup before deletion

**Remediation:**
1. Add explicit backup step: `CREATE TABLE _backup_client_goals AS SELECT * FROM client_goals WHERE client_id NOT IN (...)`
2. Wrap in explicit transaction with ROLLBACK on error
3. Add row count verification: `IF (SELECT COUNT(*) FROM ...) > threshold THEN RAISE EXCEPTION`

---

### CRIT-03: Drizzle Migrations Have No Down Migration Capability

**Files:** All 34 files in `open-seo-main/drizzle/*.sql`

**Issue:** Drizzle SQL migrations are UP-only. There is no standardized way to roll back schema changes.

**Risk:**
- Failed deployments cannot be reverted at database level
- Schema/code version mismatch during rollback
- Manual intervention required for every rollback scenario

**Remediation:**
1. Create corresponding `*.down.sql` files for each migration
2. Document rollback procedures in migration comments
3. Consider switching to a migration tool with native down support (e.g., Prisma, TypeORM)

---

## HIGH Severity Findings

### HIGH-01: Long-Running CONCURRENT Index Creation

**File:** `open-seo-main/drizzle/0032_database_schema_improvements.sql`

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_graph_client_id" ON "link_graph" ("client_id");
-- ... 30+ more CONCURRENTLY indexes
```

**Issue:** While CONCURRENTLY prevents table locks, creating 30+ indexes in one migration will:
- Take significant time on large tables
- Consume substantial I/O
- May timeout during deployment

**Risk:**
- Migration timeout causing partial state
- Production performance degradation during execution
- CONCURRENTLY requires auto-commit (no transaction)

**Remediation:**
1. Split into multiple smaller migrations (5-10 indexes each)
2. Add estimated row counts in comments
3. Run during maintenance window only
4. Add `-- drizzle-kit:disable-transaction` explicitly (already present but verify execution)

---

### HIGH-02: Type Conversion May Cause Data Loss

**File:** `open-seo-main/drizzle/0029_fix_client_id_types_and_fks.sql`

```sql
ALTER TABLE reports ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;
ALTER TABLE gsc_snapshots ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;
-- ... 4 more tables
```

**Issue:** Converting UUID to TEXT is generally safe, but:
- No validation that all UUIDs are valid before conversion
- No verification after conversion
- BREAKING CHANGE warning in comments but no pre-flight check

**Risk:**
- Malformed UUIDs could cause conversion errors
- Silent truncation if TEXT length differs from UUID representation
- Foreign key references may break during migration window

**Remediation:**
1. Add pre-migration validation: `SELECT id FROM reports WHERE client_id !~ '^[0-9a-f-]+$'`
2. Add post-migration verification
3. Wrap in transaction with explicit ROLLBACK on any row failing conversion

---

### HIGH-03: Table Rename Without Application Coordination

**File:** `open-seo-main/drizzle/0032_rename_gsc_snapshots.sql`

```sql
ALTER TABLE "gsc_snapshots" RENAME TO "seo_gsc_snapshots";
```

**Issue:** Table rename requires coordinated application deployment. If app code references old table name during migration:
- Queries will fail with "table does not exist"
- No backward compatibility period

**Risk:**
- Downtime during deployment
- Rolling deployments will have failures
- Monitoring/alerting may reference old name

**Remediation:**
1. Create view with old name: `CREATE VIEW gsc_snapshots AS SELECT * FROM seo_gsc_snapshots`
2. Update application code first, then remove view
3. Add deprecation warning to view

---

### HIGH-04: RLS Policies Could Lock Out Applications

**File:** `open-seo-main/src/db/migrations/0033_add_rls_policies.sql`

```sql
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_org_isolation ON clients FOR SELECT USING (
  workspace_id = current_app_org_id() OR is_app_admin()
);
```

**Issue:** Once RLS is enabled, ALL queries MUST set user context via `set_user_context()`. If application code doesn't call this function:
- All queries return empty results
- Application appears broken with no error messages

**Risk:**
- Complete application failure if context not set
- Difficult to debug (no explicit error)
- Background jobs may lack context

**Remediation:**
1. Add BYPASSRLS to application role as safety net
2. Test with application before enabling in production
3. Add explicit warning in migration: `RAISE NOTICE 'RLS enabled - ensure set_user_context() is called'`
4. Create monitoring for empty query results

---

### HIGH-05: AI-Writer Seed Data in Migration

**File:** `AI-Writer/backend/alembic/versions/0008_create_intelligence_and_voice_templates.py`

```python
op.execute(sa.text(
    "INSERT INTO voice_templates "
    "(id, name, slug, description, style_instructions, is_system, ...) VALUES ..."
))
```

**Issue:** UUIDs are generated at migration time using `str(_uuid.uuid4())`. If migration runs multiple times in different environments:
- Different UUIDs per environment
- Foreign key references in code may break
- Data comparison between environments fails

**Risk:**
- Environment inconsistency
- Code referencing specific UUIDs will fail
- Testing data differs from production

**Remediation:**
1. Use deterministic UUIDs (UUID5 with namespace)
2. Or use slug-based lookups instead of ID references
3. Add idempotency check: `INSERT ... ON CONFLICT (slug) DO NOTHING`

---

### HIGH-06: Missing Transaction Boundaries in Multi-Statement Migrations

**File:** `open-seo-main/drizzle/0021_change_tracking_tables.sql`

Multiple `CREATE TABLE`, `ALTER TABLE`, and `CREATE INDEX` statements separated by `--> statement-breakpoint`.

**Issue:** Drizzle's statement breakpoints may execute without transaction wrapping, causing partial migrations if any statement fails.

**Risk:**
- Partial schema state on failure
- Manual cleanup required
- No atomic rollback

**Remediation:**
1. Verify Drizzle transaction behavior with breakpoints
2. Add explicit `BEGIN`/`COMMIT` where atomicity is required
3. Create idempotent checks for each statement

---

### HIGH-07: Orphaned Record Deletion Without Notification

**File:** `open-seo-main/drizzle/0029_fix_client_id_types_and_fks.sql`

```sql
DELETE FROM prospect_keywords WHERE prospect_id NOT IN (SELECT id FROM prospects);
```

**Issue:** Silently deletes orphaned records without logging what was deleted.

**Risk:**
- No audit trail of deleted data
- Cannot recover if deletion was incorrect
- No notification to administrators

**Remediation:**
1. Log deleted records: `INSERT INTO migration_audit_log SELECT * FROM prospect_keywords WHERE ...`
2. Add row count output: `RAISE NOTICE 'Deleted % orphaned prospect_keywords', (SELECT COUNT(*)...)`
3. Consider soft-delete instead

---

## MEDIUM Severity Findings

### MED-01: AI-Writer Alembic Migrations Have Incomplete Down Migrations

**Files:** Several AI-Writer migrations

While most have `downgrade()` functions, some are incomplete:
- `0002_add_global_settings_table.py` - drops table but doesn't preserve seed data
- `0008_create_intelligence_and_voice_templates.py` - doesn't restore seed data on downgrade

**Remediation:** Add data preservation in downgrade functions where seed data exists.

---

### MED-02: Inconsistent client_id Types Across Databases

**Issue:** 
- AI-Writer uses `CHAR(36)` for client_id (fixed-length UUID)
- open-seo-main uses `TEXT` for client_id

**Risk:**
- Join operations between databases may have performance issues
- Type coercion errors possible

**Remediation:** Standardize on TEXT across both databases.

---

### MED-03: Missing NOT NULL Constraints on Critical Fields

**File:** `open-seo-main/drizzle/0007_alerts.sql`

```sql
"client_id" text NOT NULL  -- Good
"threshold" integer        -- No NOT NULL, no DEFAULT
```

**Risk:** Nullable threshold allows invalid alert rules.

**Remediation:** Add `NOT NULL` or sensible `DEFAULT` values.

---

### MED-04: JSON Columns Without Validation

**File:** `open-seo-main/drizzle/0032_database_schema_improvements.sql`

Only adds COMMENTS documenting JSON schema, not actual constraints:
```sql
COMMENT ON COLUMN voice_profiles.secondary_tones IS 'JSON array of strings...';
```

**Risk:**
- Invalid JSON can be inserted
- Application must validate all JSON inputs
- No database-level schema enforcement

**Remediation:** Add CHECK constraints using `jsonb_typeof()` or consider using PostgreSQL JSON Schema validation.

---

### MED-05: Check Constraints Added Without Existing Data Validation

**File:** `open-seo-main/drizzle/0032_database_schema_improvements.sql`

```sql
ALTER TABLE audit_lighthouse_results
  ADD CONSTRAINT chk_performance_score_range
  CHECK (performance_score IS NULL OR (performance_score >= 0 AND performance_score <= 100));
```

**Issue:** If existing data violates constraints, migration will fail.

**Remediation:** Add data cleanup before constraint: `UPDATE ... SET performance_score = 100 WHERE performance_score > 100`

---

### MED-06: Enum Type Creation Without Migration Strategy

**File:** `open-seo-main/drizzle/0032_database_schema_improvements.sql`

```sql
CREATE TYPE audit_status AS ENUM ('running', 'completed', 'failed', 'cancelled', 'pending');
```

**Issue:** Enums are created but not applied to columns. Adding new enum values later requires:
```sql
ALTER TYPE audit_status ADD VALUE 'new_status';
```
This cannot be done in a transaction.

**Remediation:** Document enum evolution strategy and create separate migration for column type changes.

---

### MED-07: Standalone SQL Migrations Outside Migration System

**Files:** `AI-Writer/backend/database/migrations/*.sql` (7 files)

These migrations exist outside the Alembic system:
- `add_user_id_to_task_execution_logs.sql`
- `update_onboarding_user_id_to_string.sql`
- etc.

**Risk:**
- Not tracked in migration history
- May be applied out of order
- No dependency management

**Remediation:** Migrate these to Alembic or create explicit application order documentation.

---

### MED-08: Column Type Change Without Data Migration

**File:** `AI-Writer/backend/database/migrations/update_onboarding_user_id_to_string.sql`

```sql
ALTER TABLE onboarding_sessions ALTER COLUMN user_id TYPE VARCHAR(255);
```

**Issue:** Comment states "assumes no existing data needs to be preserved" but this may not be true.

**Remediation:** Add explicit data handling: backup, convert, verify.

---

### MED-09: Missing Indexes on Foreign Keys

**File:** `open-seo-main/drizzle/0007_alerts.sql`

```sql
"rule_id" text  -- FK to alert_rules, no index
```

**Risk:** JOIN operations will be slow without index on FK column.

**Note:** This is partially addressed in 0032 migration but should be verified.

---

## LOW Severity Findings

### LOW-01: Inconsistent Index Naming Conventions

- Some indexes: `ix_table_column`
- Others: `idx_table_column`
- Others: `table_column_idx`

**Remediation:** Standardize naming convention.

---

### LOW-02: Missing Migration Timestamps in Drizzle Files

Drizzle migrations use numeric prefixes (0001, 0002) but no execution timestamps are recorded in migration files.

**Remediation:** Add header comment with creation date.

---

### LOW-03: Duplicate Unique Constraints

Some migrations create both UNIQUE INDEX and UNIQUE CONSTRAINT on same columns:
```sql
UNIQUE ("client_id", "provider")  -- Constraint
CREATE UNIQUE INDEX ... ("client_id", "provider")  -- Also creates index
```

**Impact:** Minor storage overhead, no functional issue.

---

### LOW-04: Missing Comments on Complex Columns

Several JSONB columns lack documentation about expected structure.

---

### LOW-05: apps/web Has No Database Migrations

The `apps/web` directory has no database layer - it relies on open-seo-main and AI-Writer backends.

**Status:** This is by design (apps/web is a frontend-only Next.js app).

---

## Recommendations Summary

### Immediate Actions (Before Next Deployment)

1. **Create backup procedure for CRIT-01 and CRIT-02 migrations**
2. **Add transaction boundaries to multi-statement migrations**
3. **Test RLS policies in staging before production enable**

### Short-Term (Next Sprint)

1. **Create down migration templates for all Drizzle migrations**
2. **Consolidate standalone SQL migrations into Alembic**
3. **Add pre-migration data validation checks**

### Long-Term (Next Quarter)

1. **Evaluate migration tooling** - consider tools with native rollback support
2. **Implement migration testing pipeline** - run migrations against production clone
3. **Add database schema versioning table** - track applied migrations with timestamps

---

## Migration Execution Checklist

For every migration deployment:

- [ ] Backup target tables before destructive operations
- [ ] Verify row counts before and after
- [ ] Test in staging with production-like data
- [ ] Prepare rollback script (even if manual)
- [ ] Schedule during low-traffic window for long-running migrations
- [ ] Monitor application errors during and after migration
- [ ] Verify foreign key integrity post-migration

---

## Appendix: Files Reviewed

### open-seo-main/drizzle/
- 0000_init.sql through 0032_rename_gsc_snapshots.sql (34 files)

### open-seo-main/src/db/migrations/
- 0033_add_rls_policies.sql
- add_idempotency_keys.sql

### AI-Writer/backend/alembic/versions/
- 0001 through 0015 (15 files)

### AI-Writer/backend/database/migrations/
- add_user_id_to_task_execution_logs.sql
- create_blog_writer_tasks.sql
- 006_add_exa_provider.sql
- add_persona_data_table.sql
- add_business_info_table.sql
- update_onboarding_user_id_to_string.sql

---

*Report generated by Claude Code migration safety audit*
