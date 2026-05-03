# Phase: Database Consolidation Plan

**Version:** 1.0  
**Status:** Planning Complete  
**Created:** 2026-05-03  
**Duration:** 3 Weeks  
**Priority:** CRITICAL - Foundation for SaaS Multi-Tenancy

---

## Executive Summary

TeveroSEO currently operates two separate PostgreSQL databases:
- **`open_seo`** (Drizzle ORM, TypeScript) - SEO audit platform, ~50 tables
- **`alwrity`** (SQLAlchemy, Python) - AI content generation, ~45 tables

This split causes 7+ CRITICAL/HIGH issues including table name collisions, schema mismatches, and impossible cross-database transactions. This plan consolidates both into a single **`tevero`** database while maintaining zero downtime.

### Issues Resolved by This Consolidation

| ID | Severity | Issue | Root Cause |
|----|----------|-------|------------|
| CRITICAL-DB-002 | CRITICAL | Table name collision: `gsc_snapshots` | Both DBs have same table name |
| CRITICAL-DB-005 | CRITICAL | Table name collision: `ga4_snapshots` | Both DBs have same table name |
| HIGH-DB-001 | HIGH | `clients.workspace_id` nullable in alwrity | Schema inconsistency |
| HIGH-DB-003 | HIGH | Cross-DB sync lacks rollback | No distributed transactions |
| HIGH-DB-004 | HIGH | Voice profiles linked differently | clientId vs userId FK |
| MED-DB-006 | MEDIUM | DateTime timezone inconsistency | Different ORM defaults |
| MED-DB-007 | MEDIUM | No cross-database JOINs possible | Split architecture |

---

## 1. Schema Design

### 1.1 Current State Analysis

**open_seo Database (Drizzle/TypeScript) - ~50 tables:**
```
Core Tables:
  - user, organization, member, invitation
  - clients (UUID PK, workspaceId NOT NULL)
  - projects, audits, audit_pages

Analytics:
  - seo_gsc_snapshots (renamed from gsc_snapshots)
  - seo_ga4_snapshots (renamed from ga4_snapshots)
  - gsc_query_snapshots

Voice/Content:
  - voice_profiles (clientId as UUID reference)
  - voice_analysis, voice_templates, voice_audit_log
  - content_protection_rules
  - briefs

Links:
  - link_graph, page_link_metrics, orphan_pages
  - link_opportunities, link_insertions

Business:
  - prospects, proposals, contracts, invoices
  - services, discount_codes
```

**alwrity Database (SQLAlchemy/Python) - ~45 tables:**
```
Core Tables:
  - clients (UUID PK, workspace_id NULLABLE) <-- CONFLICT
  - client_settings, client_publishing_settings

Analytics:
  - gsc_snapshots (original name) <-- CONFLICT
  - ga4_snapshots (original name) <-- CONFLICT
  - gsc_query_snapshots
  - client_analytics_snapshots

Personas/Voice:
  - writing_personas (user_id as String FK)
  - platform_personas
  - persona_analysis_results

Content:
  - scheduled_articles
  - csv_import_batches
  - publishing_logs
  - content_strategies, calendar_events

Planning:
  - content_recommendations
  - content_gap_analyses
  - ai_analysis_results
```

### 1.2 Namespace Strategy

Tables will be organized into logical namespaces using prefixes:

| Namespace | Prefix | Owner ORM | Tables |
|-----------|--------|-----------|--------|
| Shared | `shared_` | Both | clients, users, organizations |
| SEO | `seo_` | Drizzle | audits, link_graph, gsc/ga4 snapshots |
| Content | `content_` | SQLAlchemy | articles, personas, publishing |
| Analytics | `analytics_` | Both | snapshots, metrics |
| Business | `biz_` | Drizzle | prospects, proposals, invoices |

### 1.3 Unified Schema Design

#### A. Shared Clients Table (Single Source of Truth)

```sql
-- Unified clients table combining both schemas
CREATE TABLE shared_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    name VARCHAR(255) NOT NULL,
    domain TEXT,                          -- from open_seo: domain
    website_url VARCHAR(500),             -- from alwrity: website_url
    
    -- Workspace binding (REQUIRED for multi-tenant isolation)
    workspace_id TEXT NOT NULL,           -- FIX: Made NOT NULL
    
    -- Contact info
    contact_email TEXT,
    contact_name TEXT,
    industry TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'onboarding'
        CHECK (status IN ('onboarding', 'active', 'paused', 'churned', 'archived')),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- GSC OAuth (from open_seo)
    gsc_refresh_token TEXT,
    gsc_site_url TEXT,
    gsc_connected_at TIMESTAMPTZ,
    
    -- Conversion tracking (from open_seo)
    converted_from_prospect_id TEXT,
    
    -- Onboarding (from open_seo)
    kickoff_scheduled_at TIMESTAMPTZ,
    kickoff_completed_at TIMESTAMPTZ,
    onboarding_completed_at TIMESTAMPTZ,
    
    -- Metrics (from open_seo)
    baseline_metrics JSONB,
    target_keywords JSONB,
    
    -- Language (from open_seo)
    preferred_language TEXT,
    country TEXT,
    
    -- Timestamps (timezone-aware)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT uq_clients_workspace_domain UNIQUE (workspace_id, domain)
);

CREATE INDEX ix_shared_clients_workspace ON shared_clients(workspace_id);
CREATE INDEX ix_shared_clients_status ON shared_clients(status);
CREATE INDEX ix_shared_clients_active ON shared_clients(workspace_id, is_archived) 
    WHERE is_archived = FALSE;
```

#### B. Analytics Tables (Namespaced)

```sql
-- SEO GSC Snapshots (open_seo ownership, read by both)
CREATE TABLE seo_gsc_daily_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES shared_clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    site_url TEXT NOT NULL,
    clicks INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    ctr REAL NOT NULL DEFAULT 0,
    position REAL NOT NULL DEFAULT 0,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT uq_seo_gsc_daily_client_date UNIQUE (client_id, date)
);

-- Content Publishing Analytics (alwrity ownership, read by both)
CREATE TABLE content_publishing_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES shared_clients(id) ON DELETE CASCADE,
    snapshot_date TIMESTAMPTZ NOT NULL,
    articles_published INTEGER NOT NULL DEFAULT 0,
    total_word_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_content_analytics_client_date UNIQUE (client_id, snapshot_date)
);
```

#### C. Voice/Persona Tables (Consolidated)

```sql
-- Unified voice profiles (combining open_seo voice_profiles + alwrity writing_personas)
CREATE TABLE shared_voice_profiles (
    id TEXT PRIMARY KEY,
    
    -- Ownership (one must be set)
    client_id UUID REFERENCES shared_clients(id) ON DELETE SET NULL,
    user_id TEXT,  -- For user-level personas from AI-Writer
    
    -- Profile Basics
    voice_name TEXT,
    voice_status TEXT NOT NULL DEFAULT 'draft' 
        CHECK (voice_status IN ('draft', 'active', 'archived')),
    mode TEXT NOT NULL DEFAULT 'best_practices',
    
    -- Core Identity (from alwrity personas)
    archetype TEXT,
    core_belief TEXT,
    brand_voice_description TEXT,
    
    -- Tone & Personality (from open_seo)
    primary_tone TEXT DEFAULT 'professional',
    secondary_tones JSONB DEFAULT '[]',
    formality_level INTEGER DEFAULT 6 CHECK (formality_level BETWEEN 1 AND 10),
    personality_traits JSONB DEFAULT '[]',
    emotional_range TEXT DEFAULT 'moderate',
    
    -- Language Constraints
    required_phrases JSONB DEFAULT '[]',
    forbidden_phrases JSONB DEFAULT '[]',
    jargon_level TEXT DEFAULT 'moderate',
    industry_terms JSONB DEFAULT '[]',
    contraction_usage TEXT DEFAULT 'sometimes',
    
    -- Writing Mechanics
    sentence_length_avg INTEGER,
    paragraph_length_avg INTEGER,
    heading_style TEXT DEFAULT 'action',
    
    -- Linguistic Fingerprint (from alwrity)
    linguistic_fingerprint JSONB,
    platform_adaptations JSONB,
    
    -- SEO Integration
    keyword_density_tolerance INTEGER DEFAULT 3 
        CHECK (keyword_density_tolerance BETWEEN 1 AND 20),
    seo_vs_voice_priority INTEGER DEFAULT 6 
        CHECK (seo_vs_voice_priority BETWEEN 1 AND 10),
    
    -- AI Analysis
    confidence_score INTEGER,
    ai_analysis_version TEXT,
    analyzed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    
    CONSTRAINT chk_voice_ownership CHECK (
        (client_id IS NOT NULL) OR (user_id IS NOT NULL)
    )
);

CREATE INDEX ix_voice_profiles_client ON shared_voice_profiles(client_id);
CREATE INDEX ix_voice_profiles_user ON shared_voice_profiles(user_id);
```

#### D. Content Pipeline Tables (alwrity ownership)

```sql
-- Scheduled articles (content pipeline)
CREATE TABLE content_scheduled_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES shared_clients(id) ON DELETE CASCADE,
    
    -- Content
    title VARCHAR(500) NOT NULL,
    keyword VARCHAR(255),
    content_html TEXT,
    content_markdown TEXT,
    meta_description VARCHAR(500),
    
    -- Status with lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN (
            'draft', 'generating', 'generated', 
            'pending_review', 'approved', 
            'publishing', 'published', 'failed'
        )),
    
    -- Publishing
    publish_date TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    publishing_started_at TIMESTAMPTZ,
    cms_post_id VARCHAR(255),
    cms_post_url VARCHAR(1000),
    
    -- Error handling
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_detail TEXT,
    
    -- Optimistic locking
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Brief context from open-seo
    brief_context JSONB,
    voice_profile_id TEXT REFERENCES shared_voice_profiles(id) ON DELETE SET NULL,
    
    -- Media
    featured_image_url VARCHAR(2000),
    
    -- Soft delete
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_content_articles_client ON content_scheduled_articles(client_id);
CREATE INDEX ix_content_articles_status ON content_scheduled_articles(status);
CREATE INDEX ix_content_articles_deleted ON content_scheduled_articles(is_deleted);
```

### 1.4 Tables: Merge vs Stay Separate

**MERGE into unified tables:**

| Current Tables | Unified Table | Rationale |
|----------------|---------------|-----------|
| `open_seo.clients` + `alwrity.clients` | `shared_clients` | Single source of truth for client identity |
| `open_seo.voice_profiles` + `alwrity.writing_personas` | `shared_voice_profiles` | Both represent brand voice |
| `open_seo.gsc_snapshots` + `alwrity.gsc_snapshots` | `seo_gsc_daily_snapshots` | CRITICAL-DB-002 fix |
| `open_seo.ga4_snapshots` + `alwrity.ga4_snapshots` | `seo_ga4_daily_snapshots` | CRITICAL-DB-005 fix |

**KEEP SEPARATE (namespaced):**

| Table | Namespace | Rationale |
|-------|-----------|-----------|
| `audits`, `audit_pages` | `seo_` | SEO-specific, no content equivalent |
| `link_graph`, `link_opportunities` | `seo_` | SEO-specific linking analysis |
| `scheduled_articles` | `content_` | Content-specific pipeline |
| `platform_personas` | `content_` | Content-specific persona details |
| `prospects`, `proposals` | `biz_` | Business/sales workflow |

---

## 2. ORM Coexistence Strategy

### 2.1 Connection Configuration

Both ORMs connect to the same `tevero` database:

```typescript
// open-seo-main/src/db/index.ts (Drizzle)
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool);
```

```python
# AI-Writer/backend/services/shared_db.py (SQLAlchemy)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

### 2.2 Schema Ownership Boundaries

| Domain | Owner ORM | Migration Tool | Other ORM Access |
|--------|-----------|----------------|------------------|
| `shared_*` tables | **Drizzle** | Drizzle Kit | SQLAlchemy read/write |
| `seo_*` tables | **Drizzle** | Drizzle Kit | SQLAlchemy read-only |
| `content_*` tables | **SQLAlchemy** | Alembic | Drizzle read-only |
| `biz_*` tables | **Drizzle** | Drizzle Kit | SQLAlchemy read-only |
| `analytics_*` tables | **Drizzle** | Drizzle Kit | SQLAlchemy read/write |

### 2.3 Migration Tool Coordination

**Migration ownership tracking:**
```sql
CREATE TABLE _migration_ownership (
    table_name TEXT PRIMARY KEY,
    owner_orm TEXT NOT NULL CHECK (owner_orm IN ('drizzle', 'alembic')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Drizzle Kit config:**
```typescript
// drizzle.config.ts
export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  tablesFilter: ['shared_*', 'seo_*', 'biz_*', 'analytics_*'],
};
```

**Alembic env.py:**
```python
def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table":
        return name.startswith("content_")
    return True
```

**CI/CD Migration Order:**
```bash
#!/bin/bash
# 1. Run Drizzle migrations (shared + seo + biz + analytics)
cd open-seo-main && npm run db:migrate

# 2. Run Alembic migrations (content only)
cd ../AI-Writer/backend && alembic upgrade head

# 3. Verify schema consistency
npm run db:verify-schema
```

### 2.4 Cross-ORM Model Definitions

**SQLAlchemy reflecting Drizzle-owned tables:**
```python
# AI-Writer/backend/models/shared_models.py
from sqlalchemy import Table, MetaData
from sqlalchemy.orm import relationship
from services.shared_db import engine

metadata = MetaData()

shared_clients = Table(
    'shared_clients',
    metadata,
    autoload_with=engine,
)

class Client:
    __table__ = shared_clients
    
    scheduled_articles = relationship(
        "ScheduledArticle",
        back_populates="client",
        cascade="all, delete-orphan",
    )
```

**Drizzle referencing SQLAlchemy-owned tables:**
```typescript
// open-seo-main/src/db/content-schema-ref.ts
export const contentScheduledArticles = pgTable('content_scheduled_articles', {
  id: uuid('id').primaryKey(),
  clientId: uuid('client_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});
// Note: Read-only reference, not managed by Drizzle Kit
```

---

## 3. Migration Sequence

### 3.1 Pre-Migration Preparation (Day 1-2)

```sql
-- Step 0: Create the new database
CREATE DATABASE tevero WITH ENCODING 'UTF8';

-- Step 1: Enable required extensions
\c tevero
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Step 2: Create migration tracking
CREATE TABLE _migration_log (
    id SERIAL PRIMARY KEY,
    migration_name TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    checksum TEXT
);

-- Step 3: Create ownership tracking
CREATE TABLE _migration_ownership (
    table_name TEXT PRIMARY KEY,
    owner_orm TEXT NOT NULL CHECK (owner_orm IN ('drizzle', 'alembic')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.2 Migration Order with Dependencies

```
1. [DRIZZLE] 0001_create_shared_base.sql
   - shared_clients
   - shared_organizations
   - shared_users
   Dependencies: None

2. [DRIZZLE] 0002_create_seo_tables.sql
   - seo_audits, seo_audit_pages
   - seo_gsc_daily_snapshots, seo_ga4_daily_snapshots
   Dependencies: shared_clients

3. [DRIZZLE] 0003_create_voice_tables.sql
   - shared_voice_profiles
   - seo_voice_analysis, seo_content_protection_rules
   Dependencies: shared_clients

4. [DRIZZLE] 0004_create_link_tables.sql
   - seo_link_graph, seo_page_link_metrics
   - seo_orphan_pages, seo_link_opportunities
   Dependencies: shared_clients, seo_audits

5. [ALEMBIC] 0005_create_content_tables.py
   - content_scheduled_articles
   - content_publishing_logs
   - content_csv_import_batches
   Dependencies: shared_clients

6. [ALEMBIC] 0006_create_persona_tables.py
   - content_writing_personas
   - content_platform_personas
   Dependencies: shared_voice_profiles

7. [DRIZZLE] 0007_create_business_tables.sql
   - biz_prospects, biz_proposals
   - biz_contracts, biz_invoices
   Dependencies: shared_clients, shared_organizations
```

### 3.3 Data Transformation Scripts

**Transform 1: Clients Table Merge**
```sql
-- migrate_clients.sql
BEGIN;

-- Insert from open_seo.clients (primary source)
INSERT INTO tevero.shared_clients (
    id, name, domain, website_url, workspace_id,
    contact_email, contact_name, industry, status,
    gsc_refresh_token, gsc_site_url, gsc_connected_at,
    converted_from_prospect_id,
    kickoff_scheduled_at, kickoff_completed_at, onboarding_completed_at,
    baseline_metrics, target_keywords,
    preferred_language, country,
    created_at, updated_at, is_archived
)
SELECT 
    c.id, c.name, c.domain, c.domain AS website_url,
    c.workspace_id,
    c.contact_email, c.contact_name, c.industry,
    CASE c.status 
        WHEN 'onboarding' THEN 'onboarding'
        WHEN 'active' THEN 'active'
        WHEN 'paused' THEN 'paused'
        WHEN 'churned' THEN 'churned'
        ELSE 'onboarding'
    END,
    c.gsc_refresh_token, c.gsc_site_url, c.gsc_connected_at,
    c.converted_from_prospect_id,
    c.kickoff_scheduled_at, c.kickoff_completed_at, c.onboarding_completed_at,
    c.baseline_metrics, c.target_keywords,
    c.preferred_language, c.country,
    c.created_at, c.updated_at, COALESCE(c.is_deleted, FALSE)
FROM open_seo.clients c;

-- Merge alwrity clients that don't exist in open_seo
INSERT INTO tevero.shared_clients (
    id, name, website_url, workspace_id,
    status, is_archived, created_at, updated_at
)
SELECT 
    a.id, a.name, a.website_url,
    COALESCE(a.workspace_id, 'ORPHAN_' || a.id::text),
    CASE WHEN a.is_archived THEN 'archived' ELSE 'active' END,
    a.is_archived, a.created_at, a.updated_at
FROM alwrity.clients a
WHERE NOT EXISTS (
    SELECT 1 FROM tevero.shared_clients t WHERE t.id = a.id
);

COMMIT;
```

**Transform 2: Voice Profile Consolidation**
```sql
-- migrate_voice_profiles.sql
BEGIN;

-- Insert from open_seo.voice_profiles
INSERT INTO tevero.shared_voice_profiles (
    id, client_id, user_id,
    voice_name, voice_status, mode, archetype,
    primary_tone, secondary_tones, formality_level,
    personality_traits, emotional_range,
    required_phrases, forbidden_phrases,
    jargon_level, industry_terms, contraction_usage,
    sentence_length_avg, paragraph_length_avg, heading_style,
    keyword_density_tolerance, seo_vs_voice_priority,
    confidence_score, analyzed_at,
    created_at, updated_at, is_archived, archived_at
)
SELECT
    v.id, v.client_id, NULL,
    v.voice_name, v.voice_status, v.mode, v.archetype,
    v.primary_tone, v.secondary_tones, v.formality_level,
    v.personality_traits, v.emotional_range,
    v.required_phrases, v.forbidden_phrases,
    v.jargon_level, v.industry_terms, v.contraction_usage,
    v.sentence_length_avg, v.paragraph_length_avg, v.heading_style,
    v.keyword_density_tolerance, v.seo_vs_voice_priority,
    v.confidence_score, v.analyzed_at,
    v.created_at, v.updated_at, v.is_archived, v.archived_at
FROM open_seo.voice_profiles v;

-- Insert from alwrity.writing_personas (user-level)
INSERT INTO tevero.shared_voice_profiles (
    id, client_id, user_id,
    voice_name, voice_status, mode,
    archetype, core_belief, brand_voice_description,
    linguistic_fingerprint, platform_adaptations,
    confidence_score, ai_analysis_version, analyzed_at,
    created_at, updated_at, is_archived
)
SELECT
    'wp_' || w.id::text, NULL, w.user_id,
    w.persona_name,
    CASE WHEN w.is_active THEN 'active' ELSE 'archived' END,
    'application',
    w.archetype, w.core_belief, w.brand_voice_description,
    w.linguistic_fingerprint, w.platform_adaptations,
    (w.confidence_score * 100)::int,
    w.ai_analysis_version, w.analysis_date,
    w.created_at, w.updated_at, NOT w.is_active
FROM alwrity.writing_personas w;

COMMIT;
```

### 3.4 Rollback Points

Each migration phase has a corresponding rollback script:

```sql
-- rollback_clients.sql
BEGIN;

DELETE FROM tevero.shared_clients 
WHERE created_at > (
    SELECT MAX(executed_at) FROM tevero._migration_log 
    WHERE migration_name = 'migrate_clients'
);

INSERT INTO open_seo.clients SELECT * FROM open_seo.clients_backup_20260503;
INSERT INTO alwrity.clients SELECT * FROM alwrity.clients_backup_20260503;

INSERT INTO tevero._migration_log (migration_name, direction)
VALUES ('migrate_clients', 'down');

COMMIT;
```

---

## 4. Zero-Downtime Approach

### 4.1 Shadow Write Pattern (Week 1)

During migration, both old and new databases receive writes:

```
┌─────────────────┐         ┌─────────────────┐
│   open-seo-main │         │   AI-Writer     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ Write to BOTH             │ Write to BOTH
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│   open_seo DB   │◄───────►│   alwrity DB    │
│   (primary)     │  sync   │   (primary)     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ Shadow write              │ Shadow write
         ▼                           ▼
┌─────────────────────────────────────────────┐
│              tevero DB (new)                │
└─────────────────────────────────────────────┘
```

**TypeScript implementation:**
```typescript
// open-seo-main/src/db/dual-write.ts
export async function createClient(data: ClientInsert) {
  const result = await primaryDb.insert(clients).values(data).returning();
  
  if (process.env.SHADOW_WRITE_ENABLED === 'true') {
    shadowDb.insert(sharedClients).values({
      ...data,
    }).catch(err => {
      logger.error('Shadow write failed', { err, data });
    });
  }
  
  return result;
}
```

**Python implementation:**
```python
# AI-Writer/backend/services/dual_write.py
async def create_client(data: dict):
    with SessionLocal() as db:
        client = Client(**data)
        db.add(client)
        db.commit()
        db.refresh(client)
    
    if os.getenv("SHADOW_WRITE_ENABLED") == "true":
        asyncio.create_task(_shadow_write(client))
    
    return client

async def _shadow_write(client: Client):
    try:
        with TeveroSession() as db:
            shared = SharedClient(
                id=client.id,
                name=client.name,
                workspace_id=client.workspace_id or f"ORPHAN_{client.id}",
            )
            db.merge(shared)
            db.commit()
    except Exception as e:
        logger.error(f"Shadow write failed: {e}")
```

### 4.2 Gradual Read Migration (Week 2)

```
┌─────────────────────────────────────────────┐
│              Load Balancer                  │
│         (feature flag controlled)           │
└─────────────┬───────────────────┬───────────┘
              │                   │
     Read 90% │          Read 10% │
              ▼                   ▼
┌─────────────────┐     ┌─────────────────────┐
│ Old DBs         │     │ tevero DB           │
└─────────────────┘     └─────────────────────┘
```

**Feature flag configuration:**
```typescript
export const DB_READ_PERCENTAGE_TEVERO = {
  clients: 10,       // Start 10%
  voice_profiles: 0, // Not ready
  gsc_snapshots: 20, // Higher confidence
};

export function shouldReadFromTevero(table: string): boolean {
  const percentage = DB_READ_PERCENTAGE_TEVERO[table] ?? 0;
  return Math.random() * 100 < percentage;
}
```

### 4.3 Cutover Procedure (Week 3)

```
Day 1: Final Data Sync
├── Stop all writes to old databases
├── Run final incremental migration
├── Verify row counts match
└── Create point-in-time backup

Day 2: Switch Primary
├── Update DATABASE_URL to tevero
├── Deploy new application versions
├── Enable full writes to tevero
└── Monitor for errors

Day 3: Validation
├── Run integration tests
├── Compare query results (sample)
├── Monitor performance metrics
└── Keep old databases read-only for 7 days

Day 7: Cleanup
├── Archive old databases
├── Remove dual-write code
└── Update documentation
```

### 4.4 Verification Gates

| Gate | Check | Pass Criteria |
|------|-------|---------------|
| G1 | Row Count | Difference < 0.1% |
| G2 | Referential Integrity | 0 FK violations |
| G3 | Unique Constraints | 0 duplicate key errors |
| G4 | Null Checks | 0 NULL workspace_id (after ORPHAN_ fix) |
| G5 | Application Health | 200 OK |
| G6 | Query Performance | P95 < 100ms |

---

## 5. Risk Mitigation

### 5.1 Failure Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Shadow write fails | Error logs | Auto-retry with backoff |
| Data sync divergence | Hourly diff job | Pause cutover, investigate |
| Schema mismatch | Pre-cutover validation | Abort, fix schema |
| Performance degradation | P95 > 200ms alert | Immediate rollback |
| Referential integrity | FK errors | Hold migration, fix orphans |

### 5.2 Data Validation

**Pre-Migration:**
```python
def validate_clients():
    issues = []
    
    null_workspace = session.execute(
        "SELECT COUNT(*) FROM alwrity.clients WHERE workspace_id IS NULL"
    ).scalar()
    if null_workspace > 0:
        issues.append(f"CRITICAL: {null_workspace} NULL workspace_id")
    
    return issues
```

**Post-Migration:**
```sql
-- Check all clients migrated
SELECT 
    (SELECT COUNT(*) FROM open_seo.clients) as open_seo_count,
    (SELECT COUNT(*) FROM tevero.shared_clients) as tevero_count;

-- Verify no broken links
SELECT COUNT(*) as broken_links
FROM tevero.shared_voice_profiles v
WHERE v.client_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM tevero.shared_clients c WHERE c.id = v.client_id);
```

### 5.3 Performance Impact

| Metric | Current (Split DB) | Expected (Unified) |
|--------|-------------------|-------------------|
| Connection pool | 10+10 = 20 | 20 shared |
| Cross-service queries | 2 round trips | 1 round trip |
| Index memory | ~500MB per DB | ~800MB unified |

---

## 6. Effort Estimate

### 6.1 Task Breakdown

| Task | Hours | Skills |
|------|-------|--------|
| **Week 1** | | |
| Create tevero database | 2h | DBA |
| Write unified schema DDL | 8h | DBA, TS, Python |
| Configure Drizzle | 4h | TypeScript |
| Configure SQLAlchemy | 4h | Python |
| Implement dual-write (open-seo) | 8h | TypeScript |
| Implement dual-write (AI-Writer) | 8h | Python |
| Write migration scripts | 12h | SQL, DBA |
| Write rollback scripts | 6h | SQL, DBA |
| **Week 1 Subtotal** | **52h** | |
| | | |
| **Week 2** | | |
| Backup databases | 2h | DBA |
| Run clients migration | 4h | DBA |
| Validate clients | 4h | DBA, QA |
| Run voice profiles migration | 4h | DBA |
| Run analytics migration | 4h | DBA |
| Run content tables migration | 4h | DBA |
| Run business tables migration | 4h | DBA |
| Full validation suite | 8h | DBA, QA |
| Fix data issues | 8h | DBA |
| Staging shadow writes | 4h | DevOps |
| Integration testing | 8h | QA |
| **Week 2 Subtotal** | **54h** | |
| | | |
| **Week 3** | | |
| Final incremental sync | 4h | DBA |
| Execute cutover | 4h | DevOps, DBA |
| Monitor Day 1 | 8h | DevOps |
| Monitor Day 2 | 4h | DevOps |
| Fix production issues | 8h | Dev, DBA |
| Performance tuning | 8h | DBA |
| Remove dual-write code | 4h | Dev |
| Documentation | 4h | Tech Writer |
| Archive old databases | 2h | DBA |
| **Week 3 Subtotal** | **46h** | |
| | | |
| **Buffer (20%)** | **30h** | |
| **TOTAL** | **182h** | |

### 6.2 Team Requirements

| Role | Hours | Focus |
|------|-------|-------|
| Database Administrator | 60h | PostgreSQL, migrations |
| TypeScript Developer | 40h | Drizzle ORM |
| Python Developer | 30h | SQLAlchemy |
| DevOps Engineer | 30h | CI/CD, monitoring |
| QA Engineer | 22h | Testing, validation |

### 6.3 Timeline

```
Week 1 (Days 1-5):
├── Day 1: Database setup, schema design
├── Day 2-3: ORM configuration, dual-write
├── Day 4-5: Migration scripts, rollback scripts

Week 2 (Days 6-10):
├── Day 6: Backup, clients migration
├── Day 7: Voice profiles, analytics
├── Day 8: Content, business tables
├── Day 9: Validation, fixes
├── Day 10: Staging, integration tests

Week 3 (Days 11-15):
├── Day 11: Final sync, cutover prep
├── Day 12: Production cutover (2h window)
├── Day 13-14: Monitoring, fixes
├── Day 15: Cleanup, documentation
```

---

## Appendix A: Full Table Mapping

| Old Table (open_seo) | Old Table (alwrity) | New Table (tevero) | Action |
|---------------------|---------------------|-------------------|--------|
| clients | clients | shared_clients | MERGE |
| organization | - | shared_organizations | MIGRATE |
| user | - | shared_users | MIGRATE |
| voice_profiles | writing_personas | shared_voice_profiles | MERGE |
| seo_gsc_snapshots | gsc_snapshots | seo_gsc_daily_snapshots | MERGE |
| seo_ga4_snapshots | ga4_snapshots | seo_ga4_daily_snapshots | MERGE |
| - | scheduled_articles | content_scheduled_articles | MIGRATE |
| - | platform_personas | content_platform_personas | MIGRATE |
| audits | - | seo_audits | MIGRATE |
| link_graph | - | seo_link_graph | MIGRATE |
| prospects | - | biz_prospects | MIGRATE |
| proposals | - | biz_proposals | MIGRATE |

## Appendix B: Environment Variables

```bash
# .env.production (post-migration)
DATABASE_URL=postgresql://tevero:${POSTGRES_PASSWORD}@db:5432/tevero

# Legacy (read-only for verification)
OPEN_SEO_DATABASE_URL=postgresql://open_seo:${POSTGRES_PASSWORD}@db:5432/open_seo
ALWRITY_DATABASE_URL=postgresql://alwrity:${POSTGRES_PASSWORD}@db:5432/alwrity

# Feature flags
SHADOW_WRITE_ENABLED=false
DB_READ_PERCENTAGE_TEVERO=100
```

---

**Document Control:**
- Author: TeveroSEO Engineering
- Reviewers: DBA Team, Platform Team
- Status: Planning Complete
