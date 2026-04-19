---
phase: 12-per-client-credentials-system
plan: 01
subsystem: database
tags: [oauth, credentials, migration, orm]
dependency_graph:
  requires: []
  provides: [client_oauth_tokens, client_oauth_properties, client_connect_invites]
  affects: [models/client.py]
tech_stack:
  added: []
  patterns: [TextArray TypeDecorator for cross-db ARRAY compatibility]
key_files:
  created:
    - AI-Writer/backend/alembic/versions/0012_create_client_oauth_tables.py
    - AI-Writer/backend/models/client_oauth.py
    - AI-Writer/backend/tests/test_client_oauth.py
  modified: []
decisions:
  - TextArray custom TypeDecorator for PostgreSQL ARRAY with SQLite JSON fallback
metrics:
  duration: 8m
  completed: 2026-04-19
---

# Phase 12 Plan 01: Database Foundation for Client OAuth Summary

Alembic migration 0012 and ORM models for per-client OAuth credential storage with Fernet encryption, UNIQUE(client_id, provider) constraint, and cascade delete relationships.

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 | test | eff93d3c | Add failing tests for client OAuth models (RED) |
| 2 | feat | 37ad54e4 | Create Alembic migration 0012 for client OAuth tables |
| 3 | feat | 8381cbc3 | Create ORM models for client OAuth tables |
| 4 | fix | 4bb90c59 | Add TextArray type for SQLite test compatibility (GREEN) |

## What Was Built

### Migration 0012

Three new tables created:

1. **client_oauth_tokens** - Encrypted OAuth tokens per client/provider
   - `id` CHAR(36) PRIMARY KEY
   - `client_id` FK to clients(id) ON DELETE CASCADE
   - `provider` TEXT NOT NULL (google, bing, wordpress, shopify, wix)
   - `access_token` LargeBinary NOT NULL (Fernet encrypted)
   - `refresh_token` LargeBinary nullable (Fernet encrypted)
   - `token_expiry` DateTime(timezone=True) nullable
   - `scopes` ARRAY(Text) nullable
   - `connected_by` TEXT NOT NULL (Clerk user ID for audit)
   - `connected_at` DateTime(timezone=True) DEFAULT NOW()
   - `is_active` Boolean DEFAULT TRUE
   - **UNIQUE constraint**: `uq_client_oauth_tokens_client_provider`

2. **client_oauth_properties** - Provider-specific key-value properties
   - `id` CHAR(36) PRIMARY KEY
   - `token_id` FK to client_oauth_tokens(id) ON DELETE CASCADE
   - `key` TEXT NOT NULL (gsc_site_url, ga4_property_id, gbp_location_id)
   - `value` TEXT NOT NULL

3. **client_connect_invites** - Magic link tokens for client self-authorization
   - `id` CHAR(36) PRIMARY KEY
   - `client_id` FK to clients(id) ON DELETE CASCADE
   - `token` TEXT UNIQUE NOT NULL (32-char random, URL-safe)
   - `created_by` TEXT NOT NULL (Clerk user ID)
   - `expires_at` DateTime(timezone=True) NOT NULL
   - `completed_at` DateTime(timezone=True) nullable
   - `scopes_requested` ARRAY(Text) nullable
   - **Index**: `ix_client_connect_invites_token` for fast lookup

### ORM Models

- `ClientOAuthToken` - Full column mapping with `client` and `properties` relationships
- `ClientOAuthProperty` - FK relationship to token with cascade delete
- `ClientConnectInvite` - FK relationship to client with `backref="connect_invites"`

### TextArray TypeDecorator

Custom SQLAlchemy type for cross-database compatibility:
- PostgreSQL: Uses native `ARRAY(Text)` type
- SQLite: Falls back to JSON text serialization
- Enables in-memory SQLite tests while production uses PostgreSQL arrays

## Tests

5 unit tests covering:
1. Token insertion with valid client_id
2. UNIQUE(client_id, provider) constraint enforcement
3. Cascade delete from token to properties
4. Unique token constraint on invites
5. Encrypted access_token stored as bytes (LargeBinary)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLite ARRAY type incompatibility**
- **Found during:** Task 4
- **Issue:** PostgreSQL ARRAY type not supported in SQLite test database
- **Fix:** Created TextArray TypeDecorator with dialect-aware implementation
- **Files modified:** AI-Writer/backend/models/client_oauth.py
- **Commit:** 4bb90c59

**2. [Rule 3 - Blocking] Missing model imports in tests**
- **Found during:** Task 4
- **Issue:** Client model relationships to publishing models caused SQLAlchemy mapper initialization failure
- **Fix:** Added imports for ClientPublishingSettings, ScheduledArticle, CsvImportBatch, ClientAnalyticsSnapshot
- **Files modified:** AI-Writer/backend/tests/test_client_oauth.py
- **Commit:** 4bb90c59

## Success Criteria Verification

- [x] Migration 0012 exists with correct revision chain (down_revision = "0011")
- [x] client_oauth_tokens table has UNIQUE(client_id, provider) constraint
- [x] client_oauth_properties table cascades delete on token_id FK
- [x] client_connect_invites table has unique index on token column
- [x] ORM models import without errors
- [x] All 5 unit tests pass

## Self-Check: PASSED

All created files exist and all commits verified in git log.
