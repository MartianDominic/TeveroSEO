# Schema Consistency Review - TeveroSEO
**Status**: COMPLETE
**Reviewed**: 2026-05-03
**Files Analyzed**: 45+ schema files across both ORMs

## Summary

The TeveroSEO platform uses two distinct databases with different ORMs:
- **open_seo** (Drizzle ORM): 50+ tables for SEO audit, prospects, clients, analytics
- **alwrity** (SQLAlchemy): 40+ tables for content generation, personas, subscriptions

The `clients` table exists in both databases with the same shared `client_id` concept, but with significant schema differences that must be understood.

---

## CRITICAL Issues (3)

### CRIT-SCHEMA-01: Table Name Collision Risk - gsc_snapshots / ga4_snapshots
**Severity**: CRITICAL
**Location**: 
- `AI-Writer/backend/models/analytics_snapshots.py` - `gsc_snapshots`, `ga4_snapshots`
- `open-seo-main/src/db/analytics-schema.ts` - `seo_gsc_snapshots`, `seo_ga4_snapshots`

**Description**: Both services originally had `gsc_snapshots` and `ga4_snapshots` tables. The open-seo-main side was renamed to `seo_gsc_snapshots` and `seo_ga4_snapshots` (with deprecation aliases), but AI-Writer still uses the original names. If both services ever share a single database (e.g., during migration or consolidation), this will cause table conflicts.

**Evidence**:
```python
# AI-Writer/backend/models/analytics_snapshots.py
__tablename__ = "gsc_snapshots"  # Line 37
__tablename__ = "ga4_snapshots"  # Line 117
```

```typescript
// open-seo-main/src/db/analytics-schema.ts (comment on line 27)
// Note: Renamed from gsc_snapshots to seo_gsc_snapshots to avoid conflict
// with AI-Writer's gsc_snapshots table (CRITICAL-DB-002).
```

**Impact**: Database migration failures, data corruption if tables are confused, cross-service query failures.

**Recommendation**: 
1. Ensure databases remain physically separate (already the case with `open_seo` and `alwrity`)
2. Document the naming convention explicitly in both projects
3. Add automated tests that verify table names don't collide

---

### CRIT-SCHEMA-02: Clients Table Schema Mismatch Between ORMs
**Severity**: CRITICAL
**Location**:
- `open-seo-main/src/db/client-schema.ts` (Drizzle)
- `AI-Writer/backend/models/client.py` (SQLAlchemy)

**Description**: The `clients` table has different schemas in each ORM, with different column types, constraints, and semantics for the same logical entity.

| Column | Drizzle (open_seo) | SQLAlchemy (alwrity) | Issue |
|--------|-------------------|---------------------|-------|
| `id` | `uuid` (auto-random) | `GUID` (uuid.uuid4) | Compatible |
| `workspace_id` | `text NOT NULL` | `String(255) nullable=True` | **Nullable mismatch** |
| `domain` | `text NOT NULL` | `website_url` `String(500) nullable=True` | **Name and nullable mismatch** |
| `status` | `text DEFAULT 'onboarding'` | N/A (`is_archived` instead) | **Missing column** |
| `is_deleted` | `boolean DEFAULT false` | N/A | **Missing soft delete** |
| `is_archived` | N/A | `boolean DEFAULT false` | **Different naming** |
| `gsc_*` columns | Present (3 columns) | N/A (separate OAuth table) | Different structure |
| `baseline_metrics` | `jsonb` | N/A | Missing in AI-Writer |
| `target_keywords` | `jsonb` | N/A | Missing in AI-Writer |

**Impact**: Cross-database JOINs (even via application code) will fail or return incorrect results. Data integrity cannot be enforced across services.

**Recommendation**:
1. Document that these are logically the same entity but with service-specific extensions
2. Define a "shared core" schema that both must implement
3. Use `client_id` as the linking field and ensure UUID types are compatible (they are)
4. Consider creating a schema compatibility test that validates both sides

---

### CRIT-SCHEMA-03: workspace_id Nullable Inconsistency
**Severity**: CRITICAL
**Location**:
- `open-seo-main/src/db/client-schema.ts:48-50`: `workspace_id: text NOT NULL`
- `AI-Writer/backend/models/client.py:73-74`: `workspace_id = Column(String(255), nullable=True)`

**Description**: In open-seo-main, `workspace_id` is required for multi-tenant isolation. In AI-Writer, it's nullable "for backwards compatibility". This means:
1. AI-Writer clients without `workspace_id` cannot be cross-referenced with open-seo-main
2. New clients created in open-seo-main will always have `workspace_id`, but AI-Writer may create orphaned clients
3. The comment says "nullable for backwards compatibility" - this should be migrated

**Impact**: Multi-tenant isolation breaks, orphaned data, cross-service queries fail silently.

**Recommendation**:
1. Migrate AI-Writer to require `workspace_id` (add NOT NULL constraint after backfilling)
2. Create a data migration to assign workspace_id to existing AI-Writer clients
3. Add validation at API layer to reject clients without workspace_id

---

## HIGH Issues (4)

### HIGH-SCHEMA-01: DateTime Timezone Handling Inconsistency
**Severity**: HIGH
**Location**: Multiple files in both projects

**Description**: Drizzle schemas consistently use `timestamp with timezone`:
```typescript
// open-seo-main/src/db/client-schema.ts
createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
```

SQLAlchemy models are inconsistent - some use `DateTime(timezone=True)`, others use plain `DateTime`:
```python
# AI-Writer/backend/models/onboarding.py
started_at = Column(DateTime, default=func.now())  # NO timezone
updated_at = Column(DateTime, default=func.now())  # NO timezone

# AI-Writer/backend/models/persona_models.py (lines 105-106)
created_at = Column(DateTime(timezone=True), default=_utcnow)  # WITH timezone
```

**Impact**: Timezone-naive timestamps cause issues when comparing dates across services or when users are in different timezones.

**Affected Files**:
- `AI-Writer/backend/models/onboarding.py` - 12 columns without timezone
- `AI-Writer/backend/models/subscription_models.py` - Uses `datetime.utcnow` (deprecated)
- `AI-Writer/backend/models/seo_analysis.py` - Mixed usage

**Recommendation**: Standardize on `DateTime(timezone=True)` with `_utcnow()` helper in all SQLAlchemy models.

---

### HIGH-SCHEMA-02: Missing Foreign Key from prospectAnalyses to prospects in AI-Writer
**Severity**: HIGH
**Location**: 
- `open-seo-main/src/db/prospect-schema.ts`: Has proper `prospectAnalyses` with FK
- AI-Writer has no equivalent prospect analysis tracking

**Description**: open-seo-main tracks prospects with full analysis history:
```typescript
export const prospectAnalyses = pgTable("prospect_analyses", {
  prospectId: text("prospect_id").notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  // ... 15+ columns
});
```

AI-Writer has no equivalent, meaning prospect analysis data from open-seo cannot be linked to AI-Writer content generation.

**Impact**: Content briefs generated in AI-Writer cannot reference prospect analysis data from open-seo-main without a separate integration.

**Recommendation**: Either:
1. Add a `prospect_id` reference column to AI-Writer's `scheduled_articles` table
2. Or create a bridge service that syncs analysis summaries to AI-Writer

---

### HIGH-SCHEMA-03: Missing Soft Delete on AI-Writer Tables
**Severity**: HIGH
**Location**: `AI-Writer/backend/models/*.py` (most tables)

**Description**: open-seo-main has comprehensive soft delete (`is_deleted`, `deleted_at`) on critical tables:
```typescript
// open-seo-main/src/db/client-schema.ts
isDeleted: boolean("is_deleted").default(false).notNull(),
deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
```

AI-Writer uses `is_archived` on the `Client` model but most other tables lack soft delete entirely:
- `ScheduledArticle` has soft delete (good)
- `OnboardingSession` - NO soft delete
- `WritingPersona` - has `is_active` but no `deleted_at`
- `ContentStrategy` - NO soft delete
- `SEOAnalysis` - NO soft delete

**Impact**: Accidental cascading deletes can destroy irreplaceable data (onboarding sessions, personas, content strategies).

**Recommendation**: Add `is_deleted`/`deleted_at` columns to high-value tables in AI-Writer.

---

### HIGH-SCHEMA-04: Voice Profile Linked to Client Differently
**Severity**: HIGH
**Location**:
- `open-seo-main/src/db/voice-schema.ts`: `clientId` references `clients.id`
- `AI-Writer/backend/models/persona_models.py`: `user_id` references Clerk user ID

**Description**: Voice/persona profiles are linked differently:
```typescript
// open-seo-main/src/db/voice-schema.ts
clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
```

```python
# AI-Writer/backend/models/persona_models.py
user_id = Column(String(255), nullable=False)  # Clerk user ID
```

This means:
- open-seo-main voice profiles are per-client (brand voice)
- AI-Writer personas are per-user (individual writer)

**Impact**: Cannot sync brand voice from open-seo-main to AI-Writer without mapping user -> client -> voice.

**Recommendation**: AI-Writer should add optional `client_id` to `WritingPersona` for agency workflows where personas are per-client, not per-user.

---

## MEDIUM Issues (5)

### MED-SCHEMA-01: Enum Value Inconsistencies
**Severity**: MEDIUM
**Location**: Multiple schema files

**Description**: Status enums differ between services:

| Entity | open-seo-main | AI-Writer |
|--------|--------------|-----------|
| Client | `onboarding, active, paused, churned` | `is_archived` boolean |
| Article | N/A | `draft, generating, generated, pending_review, approved, publishing, published, failed` |
| Audit | `pending, running, completed, failed, cancelled` | N/A |

No shared enum vocabulary for cross-service status queries.

**Recommendation**: Create shared status vocabulary document in `.planning/schemas/`.

---

### MED-SCHEMA-02: JSONB vs JSON Column Type
**Severity**: MEDIUM
**Location**: All SQLAlchemy models

**Description**: Drizzle uses `jsonb` (PostgreSQL binary JSON with indexing):
```typescript
baselineMetrics: jsonb("baseline_metrics").$type<BaselineMetrics>(),
```

SQLAlchemy uses `JSON` (text-based JSON, less efficient):
```python
content_pillars = Column(JSON, nullable=True)
```

**Impact**: Performance difference on JSON queries, cannot use GIN indexes on SQLAlchemy JSON columns.

**Recommendation**: Use `from sqlalchemy.dialects.postgresql import JSONB` for PostgreSQL-backed tables.

---

### MED-SCHEMA-03: Missing Indexes on AI-Writer Foreign Keys
**Severity**: MEDIUM
**Location**: `AI-Writer/backend/models/content_planning.py`

**Description**: Many FK columns lack indexes:
```python
# content_planning.py
strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=False)
# No index defined!
```

Compare to open-seo-main which consistently indexes FKs:
```typescript
index("ix_clients_converted_prospect").on(table.convertedFromProspectId),
```

**Impact**: Slow queries when joining on these columns.

**Recommendation**: Add `index=True` to all FK columns in SQLAlchemy models.

---

### MED-SCHEMA-04: Check Constraints Only in Drizzle
**Severity**: MEDIUM
**Location**: `open-seo-main/src/db/*.ts`

**Description**: Drizzle schemas have extensive check constraints:
```typescript
check("chk_client_status_valid", sql`status IN ('onboarding', 'active', 'paused', 'churned')`),
check("chk_voice_blend_weight_range", sql`voice_blend_weight >= 0 AND voice_blend_weight <= 1`),
```

SQLAlchemy models have no CHECK constraints - validation is only at application layer.

**Impact**: Invalid data can be inserted directly via SQL or during data migration.

**Recommendation**: Add CHECK constraints to critical SQLAlchemy tables via Alembic migration.

---

### MED-SCHEMA-05: Inconsistent On-Delete Behavior
**Severity**: MEDIUM
**Location**: Multiple models

**Description**: FK on-delete behavior is inconsistent:

| Table | FK | open-seo-main | AI-Writer |
|-------|-----|--------------|-----------|
| client_settings | client_id | CASCADE | CASCADE (good) |
| voice_profiles | client_id | SET NULL | N/A |
| scheduled_articles | client_id | CASCADE | CASCADE (good) |
| gsc_snapshots | client_id | CASCADE (but no FK!) | CASCADE |

The open-seo-main `voice_profiles` uses SET NULL to preserve expensive learned data, while most others use CASCADE.

**Recommendation**: Document on-delete strategy for each entity type.

---

## LOW Issues (3)

### LOW-SCHEMA-01: Column Naming Conventions
**Severity**: LOW
**Description**: 
- Drizzle uses camelCase: `createdAt`, `workspaceId`
- SQLAlchemy uses snake_case: `created_at`, `workspace_id`

This is expected behavior for each ORM but requires mapping in cross-service code.

---

### LOW-SCHEMA-02: UUID Generation Method
**Severity**: LOW
**Description**:
- Drizzle: `uuid().primaryKey().defaultRandom()` (database-side)
- SQLAlchemy: `default=uuid.uuid4` (Python-side)

Both work but UUIDs generated before insert are different from those generated by the database.

---

### LOW-SCHEMA-03: Missing Table Comments
**Severity**: LOW
**Description**: Neither ORM has table/column comments for documentation. PostgreSQL supports `COMMENT ON TABLE/COLUMN` which helps with database introspection.

---

## Cross-Cutting Observations

1. **Two Databases Design is Intentional**: The `open_seo` and `alwrity` databases are separate by design. The `clients` table in `alwrity` is the source of truth for client_id, and open-seo-main references these UUIDs.

2. **SharedBase vs Base**: AI-Writer has two declarative bases:
   - `SharedBase` (in `services/shared_db.py`) for shared PostgreSQL tables
   - `Base` (in `models/base.py`) for user-scoped tables
   
   This is well-architected but requires developer awareness.

3. **Migration Tools**: 
   - open-seo-main uses Drizzle Kit migrations
   - AI-Writer uses Alembic
   
   No cross-database migration coordination exists.

---

## Files Reviewed

**open-seo-main (Drizzle)**:
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/client-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/user-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/app.schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/voice-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/prospect-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/brief-schema.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/analytics-schema.ts`

**AI-Writer (SQLAlchemy)**:
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/base.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client_oauth.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/publishing.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/analytics_snapshots.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/onboarding.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/subscription_models.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/persona_models.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/seo_analysis.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/content_planning.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/shared_db.py`

---

## Issue Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 4 |
| MEDIUM | 5 |
| LOW | 3 |
| **Total** | **15** |
