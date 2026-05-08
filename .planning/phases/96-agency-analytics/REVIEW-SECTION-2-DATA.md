# Phase 96: Data Schema & Integrity Review

**Audit Date**: 2026-05-08  
**Auditor**: Senior Data Architect Agent  
**Scope**: Phase 96 database schemas, data models, and storage patterns

---

## 2. Data Schema & Integrity Review

### 2.1 Schema Entity Relationship Map

#### Phase 96 Core Tables

```
organization (user-schema.ts)
    │
    ├── clients (client-schema.ts)
    │       ├── id: UUID PK
    │       ├── workspaceId: TEXT FK → organization.id
    │       ├── isDeleted: BOOLEAN (soft delete)
    │       │
    │       ├─→ client_visibility (analytics-extended-schema.ts)
    │       │       ├── clientId: UUID FK → clients.id ON DELETE CASCADE
    │       │       └── workspaceId: TEXT FK → organization.id ON DELETE CASCADE
    │       │
    │       ├─→ brand_terms (analytics-extended-schema.ts)
    │       │       └── clientId: UUID FK → clients.id ON DELETE CASCADE
    │       │
    │       ├─→ client_tags (analytics-tags-schema.ts)
    │       │       └── clientId: UUID FK (NO CONSTRAINT DEFINED)
    │       │
    │       └─→ seo_gsc_snapshots (analytics-schema.ts)
    │               ├── clientId: UUID FK → clients.id ON DELETE CASCADE
    │               └── isDeleted: BOOLEAN (soft delete)
    │
    └── site_connections (connection-schema.ts)
            ├── id: TEXT PK
            ├── clientId: UUID FK → clients.id ON DELETE CASCADE
            │
            ├─→ seo_gsc_query_analytics (gsc-analytics-schema.ts) [TimescaleDB Hypertable]
            │       └── siteId: TEXT FK → site_connections.id ON DELETE CASCADE
            │
            ├─→ site_tags (analytics-tags-schema.ts)
            │       └── siteId: UUID FK → site_connections.id ON DELETE CASCADE
            │
            ├─→ content_groups (content-intelligence-schema.ts)
            │       └── siteId: TEXT FK → site_connections.id ON DELETE CASCADE
            │
            ├─→ analytics_topic_clusters (content-intelligence-schema.ts)
            │       └── siteId: TEXT FK → site_connections.id ON DELETE CASCADE
            │
            ├─→ page_index_status (content-intelligence-schema.ts)
            │       └── siteId: TEXT FK → site_connections.id ON DELETE CASCADE
            │
            └─→ indexing_requests (content-intelligence-schema.ts)
                    └── siteId: TEXT FK → site_connections.id ON DELETE CASCADE

annotations (analytics-schema.ts)
    ├── workspaceId: UUID (NO FK CONSTRAINT)
    ├── siteId: UUID (NULLABLE, NO FK CONSTRAINT)
    └── createdBy: UUID (NO FK CONSTRAINT)

analytics_report_schedules (analytics-extended-schema.ts)
    ├── workspaceId: TEXT FK → organization.id ON DELETE CASCADE
    └── clientId: UUID FK → clients.id ON DELETE CASCADE (NULLABLE)
```

#### TimescaleDB Continuous Aggregates

```
seo_gsc_query_analytics (Hypertable)
    │
    ├─→ growing_pages_cagg (Continuous Aggregate)
    │       Columns: site_id, page_url, day, total_clicks, total_impressions, avg_ctr, avg_position, unique_queries
    │       Refresh: Hourly (start_offset: 3 days, end_offset: 1 hour)
    │       Indexes: (site_id, day DESC), (page_url)
    │
    └─→ master_dashboard_cagg (Continuous Aggregate)
            Columns: site_id, day, total_clicks, total_impressions, avg_ctr, avg_position, unique_queries, unique_pages, unique_countries
            Refresh: Hourly (start_offset: 3 days, end_offset: 1 hour)
            Indexes: (site_id, day DESC)
```

---

### 2.2 Index Coverage Analysis

#### 2.2.1 Tables with Good Index Coverage

| Table | Query Pattern | Existing Indexes | Status |
|-------|--------------|------------------|--------|
| `seo_gsc_query_analytics` | site_id + time range | `idx_gsc_query_site_time (site_id, query_time DESC)` | GOOD |
| `seo_gsc_query_analytics` | query text lookup | `idx_gsc_query_query (query)` | GOOD |
| `seo_gsc_query_analytics` | page URL lookup | `idx_gsc_query_page (page_url)` | GOOD |
| `seo_gsc_snapshots` | client + date | `ix_seo_gsc_snapshots_client_date (clientId, date)` | GOOD |
| `seo_gsc_snapshots` | soft delete filter | `ix_seo_gsc_snapshots_deleted (isDeleted)` | GOOD |
| `annotations` | workspace + site | `ix_annotations_workspace_site (workspaceId, siteId)` | GOOD |
| `annotations` | date filtering | `ix_annotations_date (annotationDate)` | GOOD |
| `content_groups` | site lookup | `idx_content_groups_site (site_id)` | GOOD |
| `page_index_status` | coverage state | `idx_page_index_coverage_state (site_id, coverage_state)` | GOOD |

#### 2.2.2 Missing Indexes (CRITICAL)

| Table | Query Pattern | Missing Index | Priority |
|-------|--------------|---------------|----------|
| `client_tags` | client_id lookup | `idx_client_tags_client (client_id)` | HIGH |
| `analytics_report_schedules` | Due reports | `idx_report_schedules_active_next_run (isActive, nextRunAt)` | HIGH |
| `indexing_requests` | page URL lookup | `idx_indexing_requests_page_url (page_url)` | MEDIUM |
| `analytics_topic_cluster_pages` | page URL lookup | `idx_topic_cluster_pages_url (page_url)` | MEDIUM |

#### 2.2.3 Index Recommendations for Service Queries

**TrendDetectionService.ts (Lines 61-111)**
```sql
-- Query: growing_pages_cagg + seo_gsc_query_analytics JOIN
-- Current: Uses continuous aggregate indexes
-- Issue: Subquery for top_queries may cause sequential scan

-- RECOMMENDATION: Add covering index for top queries subquery
CREATE INDEX CONCURRENTLY idx_gsc_query_site_time_page_query 
  ON seo_gsc_query_analytics (site_id, query_time, page_url, query);
```

**StrikingDistanceService.ts (Lines 55-121)**
```sql
-- Query: Aggregates by page_url with position filter
-- Current: Uses idx_gsc_query_page but needs position filtering

-- RECOMMENDATION: Partial index for striking distance range
CREATE INDEX CONCURRENTLY idx_gsc_query_striking_distance 
  ON seo_gsc_query_analytics (site_id, page_url, position)
  WHERE position >= 11 AND position <= 20;
```

**MasterDashboardService.ts (Lines 47-91)**
```sql
-- Query: Aggregates from master_dashboard_cagg with workspace filter via JOIN
-- Issue: JOIN to site_connections for workspace_id filtering

-- RECOMMENDATION: Consider denormalizing workspace_id into continuous aggregate
-- Alternative: Add workspace_id to site_tags for faster filtering
```

**PortfolioMetricsService.ts (Lines 89-107, 141-154)**
```sql
-- Query: JOINs gsc_query_analytics with clients via gsc_site_id
-- Issue: clients.gsc_site_id is used but NO INDEX exists

-- RECOMMENDATION: Add index for GSC site ID join
CREATE INDEX CONCURRENTLY idx_clients_gsc_site_id ON clients(gsc_site_url);
```

---

### 2.3 Data Integrity Concerns

#### 2.3.1 Foreign Key Constraint Issues (CRITICAL)

| Issue ID | Table | Column | Problem | Risk Level |
|----------|-------|--------|---------|------------|
| FK-01 | `client_tags` | `client_id` | **NO FK CONSTRAINT** - Schema has `uuid("client_id").notNull()` but no `.references()` | CRITICAL |
| FK-02 | `annotations` | `workspaceId` | **NO FK CONSTRAINT** - Uses `uuid("workspace_id")` without reference to organization | HIGH |
| FK-03 | `annotations` | `siteId` | **NO FK CONSTRAINT** - Nullable site_id without reference to site_connections | HIGH |
| FK-04 | `annotations` | `createdBy` | **NO FK CONSTRAINT** - User reference without constraint | MEDIUM |

**Recommended Fix for FK-01 (client_tags)**:
```typescript
// analytics-tags-schema.ts line 33
clientId: uuid("client_id")
  .notNull()
  .references(() => clients.id, { onDelete: "cascade" }),  // ADD THIS
```

**Recommended Fix for FK-02/03 (annotations)**:
```typescript
// analytics-schema.ts lines 156-165
workspaceId: uuid("workspace_id")
  .notNull()
  .references(() => organization.id, { onDelete: "cascade" }),  // ADD THIS
siteId: uuid("site_id")
  .references(() => siteConnections.id, { onDelete: "cascade" }),  // ADD THIS
```

#### 2.3.2 Data Type Inconsistencies

| Issue ID | Tables | Columns | Problem | Recommendation |
|----------|--------|---------|---------|----------------|
| DT-01 | `site_connections` / `seo_gsc_query_analytics` | `id` / `site_id` | Primary key is TEXT but some FKs expect UUID | Standardize on TEXT for site_connections.id |
| DT-02 | `site_tags` | `siteId` | Schema uses `uuid("site_id")` but site_connections.id is TEXT | Change to `text("site_id")` |
| DT-03 | `annotations` | `workspaceId` | Schema uses `uuid("workspace_id")` but organization.id is TEXT | Change to `text("workspace_id")` |
| DT-04 | Various | `ctr` | Inconsistent: `real` in some tables, `DECIMAL(5,4)` in plan | Standardize on `real` for Drizzle compatibility |

**Type Mismatch Detail (DT-02)**:
```typescript
// analytics-tags-schema.ts line 16 - INCORRECT
siteId: uuid("site_id").notNull().references(() => siteConnections.id, { onDelete: "cascade" }),

// connection-schema.ts line 45 - site_connections.id is TEXT
id: text("id").primaryKey(),

// FIX:
siteId: text("site_id").notNull().references(() => siteConnections.id, { onDelete: "cascade" }),
```

#### 2.3.3 Cascade Delete Behavior

| Parent Table | Child Table | ON DELETE | Risk |
|--------------|-------------|-----------|------|
| `clients` | `seo_gsc_snapshots` | CASCADE | Data loss prevented by soft-delete on parent |
| `clients` | `client_visibility` | CASCADE | Appropriate - config follows client |
| `clients` | `brand_terms` | CASCADE | Appropriate - terms follow client |
| `site_connections` | `seo_gsc_query_analytics` | CASCADE | **RISKY** - Hypertable data loss is catastrophic |
| `site_connections` | `content_groups` | CASCADE | Appropriate |
| `site_connections` | `page_index_status` | CASCADE | **RISKY** - Historical inspection data loss |
| `organization` | `client_visibility` | CASCADE | Appropriate |

**Recommendation**: Add soft-delete to `seo_gsc_query_analytics` or implement archive policy before hard delete of site_connections.

#### 2.3.4 Soft Delete Implementation Gaps

| Table | Has Soft Delete | Should Have | Rationale |
|-------|-----------------|-------------|-----------|
| `seo_gsc_snapshots` | YES (isDeleted, deletedAt) | YES | GSC historical data is irreplaceable |
| `seo_ga4_snapshots` | YES (isDeleted, deletedAt) | YES | GA4 historical data is irreplaceable |
| `seo_gsc_query_analytics` | NO | **YES** | TimescaleDB data cannot be re-fetched after 16 months |
| `annotations` | NO | YES | User-created annotations have agency value |
| `content_groups` | NO | OPTIONAL | Can be recreated |
| `page_index_status` | NO | YES | Historical inspection data has diagnostic value |

---

### 2.4 Performance Recommendations

#### 2.4.1 Query Performance Optimizations

**Issue P-01: N+1 Query Pattern in MasterDashboardService**

Location: `MasterDashboardService.ts` lines 94-110

```typescript
// CURRENT: Two separate queries + in-memory JOIN
const sparklines = await this.getSitesSparklines(...);  // Query 1
const siteTags = await this.siteTagsRepo.findBySiteIds(...);  // Query 2
// Then manual assembly in assembleResponse()

// RECOMMENDATION: Single query with LEFT JOINs
```

**Issue P-02: Full Table Scan in PortfolioMetricsService**

Location: `PortfolioMetricsService.ts` lines 89-107

```typescript
// CURRENT: JOIN on gsc_site_id without index
INNER JOIN clients c ON ga.site_id = c.gsc_site_id

// PROBLEM: clients.gsc_site_url exists but gsc_site_id doesn't
// The service references c.gsc_site_id but schema has gsc_site_url

// FIX: Either add gsc_site_id column or use gsc_site_url consistently
```

**Issue P-03: Missing Pagination in Trend Analysis**

Location: `TrendDetectionService.ts` - No LIMIT clause

```typescript
// CURRENT: Returns all matching pages (could be 10,000+)
// RECOMMENDATION: Add pagination
LIMIT ${limit} OFFSET ${offset}
```

#### 2.4.2 TimescaleDB Optimizations

| Optimization | Current State | Recommendation | Impact |
|--------------|---------------|----------------|--------|
| Chunk Size | 7 days | Appropriate for 125M rows/day | N/A |
| Compression | 30 days | Appropriate (90-95% reduction) | N/A |
| Retention | 5 years | Appropriate per plan | N/A |
| Continuous Aggregate Refresh | 1 hour | Consider 15 min for real-time dashboards | MEDIUM |
| Index on Continuous Aggregates | Present | Add `(site_id, page_url)` compound on growing_pages_cagg | HIGH |

**Missing Continuous Aggregate Index**:
```sql
-- For StrikingDistanceService queries
CREATE INDEX IF NOT EXISTS idx_growing_pages_cagg_site_page_position
  ON growing_pages_cagg (site_id, page_url, avg_position);
```

#### 2.4.3 Partitioning Recommendations

| Table | Current | Recommendation |
|-------|---------|----------------|
| `seo_gsc_query_analytics` | TimescaleDB hypertable (7-day chunks) | CORRECT |
| `annotations` | No partitioning | Consider RANGE by annotationDate for >1M rows |
| `page_index_status` | No partitioning | Consider RANGE by inspection_time for historical queries |

#### 2.4.4 Connection Pool Considerations

The services use singleton patterns with lazy initialization:
```typescript
// Pattern in multiple services
let instance: ServiceClass | null = null;
export async function getService(): Promise<ServiceClass> {
  if (!instance) {
    const { db } = await import("@/db");
    instance = new ServiceClass(db);
  }
  return instance;
}
```

**Risk**: No connection pool size configuration visible. For 125M rows/day workload, ensure:
- Pool size: 20-50 connections
- Statement timeout: 30s for analytics queries
- Idle timeout: 10s

---

### 2.5 Migration Safety Analysis

#### 2.5.1 Phase 96-05 Tables NOT YET MIGRATED

The following tables exist in schema files but have NO migration:

| Table | Schema File | Migration Status |
|-------|-------------|------------------|
| `client_visibility` | analytics-extended-schema.ts | **MISSING** |
| `brand_terms` | analytics-extended-schema.ts | **MISSING** |
| `analytics_report_schedules` | analytics-extended-schema.ts | **MISSING** |

**Migration Required**:
```sql
-- 0006_client_visibility.sql

CREATE TABLE IF NOT EXISTS "client_visibility" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "show_clicks" boolean NOT NULL DEFAULT true,
  "show_impressions" boolean NOT NULL DEFAULT true,
  "show_position" boolean NOT NULL DEFAULT true,
  "show_ctr" boolean NOT NULL DEFAULT true,
  "show_queries" boolean NOT NULL DEFAULT false,
  "show_pages" boolean NOT NULL DEFAULT true,
  "show_competitors" boolean NOT NULL DEFAULT false,
  "can_view_growing" boolean NOT NULL DEFAULT true,
  "can_view_decaying" boolean NOT NULL DEFAULT true,
  "can_view_cannibalization" boolean NOT NULL DEFAULT false,
  "can_export" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "uq_client_visibility_client_workspace" 
  ON "client_visibility" ("client_id", "workspace_id");
CREATE INDEX "ix_client_visibility_client" ON "client_visibility" ("client_id");
CREATE INDEX "ix_client_visibility_workspace" ON "client_visibility" ("workspace_id");
```

#### 2.5.2 Safe Migration Practices

| Migration | Risk | Mitigation |
|-----------|------|------------|
| Add NOT NULL column | HIGH | Add with DEFAULT, then backfill, then drop default |
| Add FK constraint | MEDIUM | Use `NOT VALID` then `VALIDATE CONSTRAINT` separately |
| Add index | LOW | Use `CONCURRENTLY` keyword |
| Drop column | HIGH | Soft-deprecate first, remove in next release |

---

### 2.6 Summary of Critical Issues

| Priority | Issue | Location | Action Required |
|----------|-------|----------|-----------------|
| CRITICAL | Missing FK on client_tags.client_id | analytics-tags-schema.ts:33 | Add FK constraint |
| CRITICAL | Type mismatch: site_tags.siteId is UUID but site_connections.id is TEXT | analytics-tags-schema.ts:16 | Change to TEXT |
| CRITICAL | Type mismatch: annotations.workspaceId is UUID but organization.id is TEXT | analytics-schema.ts:157 | Change to TEXT |
| HIGH | Missing migration for Phase 96-05 tables | drizzle/migrations/ | Create 0006 migration |
| HIGH | Missing FK on annotations.workspaceId | analytics-schema.ts:157 | Add FK constraint |
| HIGH | No soft delete on seo_gsc_query_analytics | gsc-analytics-schema.ts | Add isDeleted column |
| HIGH | PortfolioMetricsService references non-existent gsc_site_id | PortfolioMetricsService.ts:104 | Fix to use gsc_site_url |
| MEDIUM | Missing index on client_tags.client_id | analytics-tags-schema.ts | Add index in migration |
| MEDIUM | Missing composite index for striking distance queries | gsc-analytics-schema.ts | Add partial index |
| LOW | Continuous aggregate refresh interval (1 hour) | 0003_timescaledb_gsc_analytics.sql | Consider 15 min |

---

**Review Complete**  
**Total Issues Identified**: 14  
**Critical**: 3  
**High**: 5  
**Medium**: 4  
**Low**: 2
