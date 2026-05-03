# Agent 2: Database Schema Consistency Review

**Generated:** 2026-05-03
**Scope:** Schema alignment between alwrity (AI-Writer) and open_seo (open-seo-main) databases
**Focus:** client_id as shared entity, foreign key integrity, migration consistency

---

## Executive Summary

Both databases implement a `clients` table as the core entity, with `client_id` serving as the cross-database identifier. Analysis reveals **1 CRITICAL**, **4 HIGH**, **4 MEDIUM**, and **2 LOW** severity issues affecting schema consistency and data integrity.

The most significant issue is the existence of duplicate `clients` table definitions with incompatible UUID implementations, which will cause silent failures in cross-service client synchronization.

---

## Database Overview

| Database | App | ORM | Tables with client_id | Primary Key Type |
|----------|-----|-----|----------------------|------------------|
| alwrity | AI-Writer | SQLAlchemy | 12 tables | UUID (GUID class) |
| open_seo | open-seo-main | Drizzle ORM | 25+ tables | UUID (native PostgreSQL) |

---

## CRITICAL Findings

### CRITICAL-01: Duplicate clients Tables with Incompatible Schemas

**Location:**
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client.py:66-108`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/client-schema.ts:44-112`

**Issue:** Both applications define their own `clients` table with different column sets:

| Column | AI-Writer (alwrity) | open-seo-main (open_seo) |
|--------|---------------------|-------------------------|
| id | GUID (UUID) | uuid (native PostgreSQL) |
| name | String(255), NOT NULL | text, NOT NULL |
| domain | - | text, NOT NULL |
| website_url | String(500), nullable | - |
| workspace_id | String(255), nullable | text, NOT NULL, FK to organization |
| contact_email | - | text, nullable |
| contact_name | - | text, nullable |
| industry | - | text, nullable |
| status | - | text, NOT NULL, default "onboarding" |
| is_archived | Boolean, default False | - |
| is_deleted | - | Boolean, default False |
| gsc_refresh_token | - | text, nullable |
| baseline_metrics | - | jsonb |
| converted_from_prospect_id | - | text, FK to prospects |

**Impact:**
- Cross-service client lookups fail due to column mismatches
- AI-Writer clients cannot be linked to open-seo prospects/conversions
- Workspace isolation differs (AI-Writer nullable, open-seo required)
- No single source of truth for client data

**Recommended Fix:**
1. Designate open_seo.clients as the source of truth (has richer schema)
2. AI-Writer should query open_seo.clients via API, not maintain separate table
3. If separate tables are required, implement bidirectional sync with conflict resolution

---

## HIGH Findings

### HIGH-01: UUID Type Implementation Mismatch

**Location:**
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client.py:29-58` (GUID class)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/client-schema.ts:47` (native uuid)

**Issue:** AI-Writer uses a custom `GUID` TypeDecorator that falls back to `CHAR(36)` on SQLite:

```python
def load_dialect_impl(self, dialect):
    if dialect.name == "postgresql":
        return dialect.type_descriptor(PG_UUID())
    return dialect.type_descriptor(CHAR(36))  # SQLite fallback
```

While PostgreSQL will use native UUID, any SQLite testing or local development will store UUIDs as CHAR(36), causing:
- Type comparison failures in cross-database queries
- Potential index inefficiency on text-based UUID storage
- UUID validation bypassed in SQLite mode

**Impact:** Medium-high risk during development/testing, low risk in production.

**Recommended Fix:**
- Remove SQLite fallback or explicitly test PostgreSQL-only
- Add runtime assertion: `assert dialect.name == "postgresql"` in production

---

### HIGH-02: Missing FK Constraint on AI-Writer client_settings

**Location:**
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client.py:111-151`
- Migration: `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/alembic/versions/0001_create_clients_and_client_settings_tables.py`

**Issue:** While SQLAlchemy model defines `ForeignKey("clients.id", ondelete="CASCADE")`, the Alembic migration may create the column without FK constraint at database level.

**Impact:** Orphaned settings rows after client deletion, potential data inconsistency.

**Recommended Fix:** Verify migration and add explicit FK constraint if missing:
```sql
ALTER TABLE client_settings 
ADD CONSTRAINT fk_client_settings_client 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
```

---

### HIGH-03: Conflicting ON DELETE Behavior for voice_profiles

**Location:**
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/voice-schema.ts:143-144` (SET NULL)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/drizzle/0034_client_id_to_uuid.sql:86` (CASCADE)

**Issue:** Schema definition expects SET NULL on client deletion:
```typescript
clientId: uuid("client_id")
  .references(() => clients.id, { onDelete: "set null" }),
```

But migration 0034 recreates FK with CASCADE:
```sql
ALTER TABLE voice_profiles ADD CONSTRAINT voice_profiles_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
```

**Impact:** 
- Client deletion will cascade-delete voice profiles instead of preserving them
- Voice profile learning data (expensive to regenerate) permanently lost on client removal
- Application code expecting SET NULL behavior will fail silently

**Recommended Fix:** Run corrective migration:
```sql
ALTER TABLE voice_profiles DROP CONSTRAINT voice_profiles_client_id_clients_id_fk;
ALTER TABLE voice_profiles ADD CONSTRAINT voice_profiles_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
```

---

### HIGH-04: No FK Constraints on content_planning Tables (AI-Writer)

**Location:**
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/content_planning.py:18-244`

**Issue:** Content planning tables use `user_id = Column(Integer, nullable=False)` without any FK reference:
- `content_strategies.user_id` (line 24)
- `content_gap_analyses.user_id` (line 132)
- `content_recommendations.user_id` (line 167)
- `ai_analysis_results.user_id` (line 211)

These are orphan-prone columns with no referential integrity.

**Impact:**
- Orphaned records when users are deleted
- No cascading cleanup
- Integer user_id incompatible with Clerk's string user IDs

**Recommended Fix:**
1. Add FK to a users table or remove user_id in favor of workspace_id
2. Change type from Integer to String/Text to match Clerk user IDs

---

## MEDIUM Findings

### MEDIUM-01: Timestamp Mechanism Differences

**Location:**
- AI-Writer: Uses `onupdate=_utcnow` (SQLAlchemy app-level)
- open-seo-main: Uses `$onUpdate(() => new Date())` (Drizzle ORM-level)

**Issue:** Both ORMs handle timestamp updates at application level, not database level:
- SQLAlchemy `onupdate` triggers on UPDATE via ORM
- Drizzle `$onUpdate` triggers at ORM level

If either app performs raw SQL updates, timestamps won't update.

**Impact:** Audit trail inconsistencies, stale `updated_at` values.

**Recommended Fix:** Add database-level triggers for `updated_at`:
```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_timestamp();
```

---

### MEDIUM-02: Soft Delete Pattern Mismatch

**Location:**
- AI-Writer: `is_archived: Boolean` (`/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client.py:75`)
- open-seo-main: `isDeleted: Boolean, deletedAt: Timestamp` (`/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/client-schema.ts:99-100`)
- Some open-seo tables: `isArchived: Boolean, archivedAt: Timestamp`

**Issue:** Inconsistent soft delete column naming:
- `is_archived` vs `isDeleted` vs `isArchived`
- Some have timestamp (`deletedAt`), some don't

**Impact:**
- Confusing query patterns across codebases
- Cross-service soft delete status hard to align
- Potential for querying deleted records if filter missed

**Recommended Fix:** Standardize on one pattern across both databases:
```sql
-- Recommended pattern
is_deleted: boolean NOT NULL DEFAULT false
deleted_at: timestamp with time zone
```

---

### MEDIUM-03: Missing Indexes on FK Columns

**Tables potentially missing FK indexes:**
- `gsc_query_snapshots.client_id` (composite index exists but no standalone)
- `ai_analysis_results.strategy_id` (FK without index)
- `content_recommendations.strategy_id` (FK without index)

**Impact:** Slow CASCADE deletes, poor JOIN performance on large datasets.

**Recommended Fix:** Add indexes:
```sql
-- AI-Writer
CREATE INDEX IF NOT EXISTS ix_ai_analysis_results_strategy ON ai_analysis_results(strategy_id);
CREATE INDEX IF NOT EXISTS ix_content_recommendations_strategy ON content_recommendations(strategy_id);
```

---

### MEDIUM-04: Analytics Table Naming Collision (Resolved but Deprecated Aliases Remain)

**Location:**
- AI-Writer: `gsc_snapshots`, `ga4_snapshots` tablenames
- open-seo-main: Renamed to `seo_gsc_snapshots`, `seo_ga4_snapshots`

**Status:** RESOLVED via migration 0032, but deprecated aliases remain in code:
```typescript
// /home/dominic/Documents/TeveroSEO/open-seo-main/src/db/analytics-schema.ts:56-57
/** @deprecated Use seoGscSnapshots instead. Alias kept for migration compatibility. */
export const gscSnapshots = seoGscSnapshots;
```

**Impact:** Code referencing old names may work but creates confusion.

**Recommended Fix:** Remove deprecated aliases after confirming no usage, add deprecation notices to imports.

---

## LOW Findings

### LOW-01: Nullable workspace_id in AI-Writer clients

**Location:**
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client.py:74`

**Issue:** `workspace_id = Column(String(255), nullable=True, index=True)` allows clients without workspace isolation.

Comment says "Nullable for backwards compatibility with existing clients" but this breaks multi-tenancy.

**Impact:** Legacy clients may leak across workspaces if not carefully filtered in queries.

**Recommended Fix:** Backfill workspace_id for all existing clients, then make NOT NULL:
```sql
-- 1. Backfill
UPDATE clients SET workspace_id = 'org_default' WHERE workspace_id IS NULL;
-- 2. Alter
ALTER TABLE clients ALTER COLUMN workspace_id SET NOT NULL;
```

---

### LOW-02: Column Naming Convention Differences

**Pattern:**
- AI-Writer: snake_case in both Python and DB (`client_id`, `created_at`, `website_url`)
- open-seo-main: camelCase in TypeScript, snake_case in DB (`clientId` -> `client_id`)

**Impact:** Minor cognitive load when switching between codebases, but consistent at DB level.

**No action required** - both use snake_case at database level.

---

## Migration Audit

### Destructive Operations Found

| Migration | Operation | Risk Level | Mitigation |
|-----------|-----------|------------|------------|
| 0034_client_id_to_uuid.sql | ALTER COLUMN TYPE uuid | HIGH | Will fail on invalid UUID strings |
| 0036_add_missing_fk_constraints.sql | DELETE orphaned records | MEDIUM | Backups created first |
| 0038_soft_delete_clients.sql | ADD COLUMN is_deleted | LOW | Non-destructive |

**Verdict:** Migration 0036 properly creates backup tables (`_backup_*`) before deleting orphans. Migration 0034 relies on `::uuid` cast which will fail on invalid data - validate data before running.

### Missing Migrations

1. No migration for voice_profiles FK behavior correction (HIGH-03)
2. No migration for AI-Writer `content_planning` FK additions (HIGH-04)
3. No migration for workspace_id NOT NULL enforcement (LOW-01)

---

## Cross-Reference Integrity Map

### Tables Referencing clients.id (open_seo database)

| Table | Column | FK Constraint | ON DELETE | Index |
|-------|--------|---------------|-----------|-------|
| client_dashboard_metrics | client_id | Yes | CASCADE | Unique |
| portfolio_activity | client_id | Yes | CASCADE | Yes |
| seo_gsc_snapshots | client_id | Yes | CASCADE | Composite |
| gsc_query_snapshots | client_id | Yes | CASCADE | Composite |
| seo_ga4_snapshots | client_id | Yes | CASCADE | Composite |
| site_changes | client_id | Yes | SET NULL | Yes |
| voice_profiles | client_id | Yes | SET NULL* | Yes |
| reports | client_id | Yes | CASCADE | Yes |
| api_keys | client_id | Yes | SET NULL | Yes |
| alert_rules | client_id | Yes | CASCADE | Yes |
| audits | client_id | Yes | SET NULL | Yes |
| link_graph | client_id | Yes | CASCADE | Composite |
| contracts | client_id | Yes | SET NULL | Yes |
| invoices | client_id | Yes | CASCADE | Yes |
| onboarding_checklists | client_id | Yes | CASCADE | Yes |
| client_branding | client_id | Yes | CASCADE | Unique |

*Note: voice_profiles migration conflict - actual behavior is CASCADE (see HIGH-03)

### Tables Referencing clients.id (alwrity database)

| Table | Column | FK Constraint | ON DELETE | Index |
|-------|--------|---------------|-----------|-------|
| client_settings | client_id | ORM-level* | CASCADE | Unique |
| client_publishing_settings | client_id | Yes | CASCADE | Unique |
| scheduled_articles | client_id | Yes | CASCADE | - |
| csv_import_batches | client_id | Yes | CASCADE | - |
| publishing_logs | client_id | Yes | CASCADE | - |
| client_analytics_snapshots | client_id | Yes | CASCADE | Unique |
| article_rank_snapshots | client_id | Yes | CASCADE | - |
| client_oauth_tokens | client_id | Yes | CASCADE | Unique |
| client_connect_invites | client_id | Yes | CASCADE | - |
| client_website_intelligence | client_id | Yes | CASCADE | Unique |
| gsc_snapshots | client_id | Yes | CASCADE | Unique |
| ga4_snapshots | client_id | Yes | CASCADE | Unique |

*Verify DB-level constraint exists (see HIGH-02)

---

## Priority Actions

### Immediate (Before Next Deploy)

1. **CRITICAL-01**: Decide single clients table source of truth
2. **HIGH-03**: Fix voice_profiles CASCADE -> SET NULL mismatch

### Short-term (Next Sprint)

3. **HIGH-02**: Verify AI-Writer client_settings FK constraint exists at DB level
4. **HIGH-04**: Add FK constraints to content_planning tables (or refactor user_id)
5. **MEDIUM-03**: Add missing FK indexes

### Long-term (Technical Debt)

6. **MEDIUM-01**: Standardize timestamp trigger mechanism
7. **MEDIUM-02**: Unify soft delete patterns
8. **LOW-01**: Backfill workspace_id and make NOT NULL

---

## Summary Statistics

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | Open |
| HIGH | 4 | Open |
| MEDIUM | 4 | Open |
| LOW | 2 | Open |
| RESOLVED | 1 | Closed (gsc_snapshots naming) |

---

## Appendix: Schema File References

### AI-Writer (alwrity database)
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/publishing.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/analytics_snapshots.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client_oauth.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/intelligence.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/content_planning.py`

### open-seo-main (open_seo database)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/client-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/voice-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/analytics-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/dashboard-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/link-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/change-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/contract-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/invoice-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/prospect-schema.ts`

### Migrations
- `/home/dominic/Documents/TeveroSEO/open-seo-main/drizzle/0034_client_id_to_uuid.sql`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/drizzle/0036_add_missing_fk_constraints.sql`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/alembic/versions/` (18 migrations)
