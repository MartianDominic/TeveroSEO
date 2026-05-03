---
phase: 69-data-integrity-performance
plan: 02
subsystem: database
tags: [cascade, constraints, soft-delete, data-integrity]
dependency_graph:
  requires: [69-01]
  provides: [cascade-constraints, soft-delete-cascade, status-enums]
  affects: [clients, audits, contracts, schedules, connections]
tech_stack:
  added: []
  patterns: [soft-delete-cascade, conditional-ddl, transaction-wrapper]
key_files:
  created:
    - AI-Writer/backend/alembic/versions/0022_add_apikey_cascade.py
    - open-seo-main/drizzle/0070_add_status_constraints.sql
  modified:
    - AI-Writer/backend/models/onboarding.py
    - open-seo-main/src/server/features/clients/services/ClientService.ts
decisions:
  - Soft delete cascades to audits (archive), contracts (cancel), reportSchedules (disable), siteConnections (disconnect)
  - PostgreSQL ENUMs created for type safety but tables continue using CHECK constraints for flexibility
  - Conditional DDL pattern (IF NOT EXISTS) for idempotent migrations
metrics:
  duration_seconds: 368
  completed_date: "2026-05-03"
  tasks_completed: 3
  files_modified: 4
---

# Phase 69 Plan 02: Cascade & Constraints Summary

CASCADE constraints for referential integrity, soft delete cascade for clients, and status CHECK constraints.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7e299b2a (AI-Writer) | APIKey.session_id CASCADE FK + Alembic migration |
| 2 | c7762d9d9 | Soft delete cascade in ClientService with transaction |
| 3 | 61899960e | Status CHECK constraints + PostgreSQL ENUMs |

## Task 1: APIKey CASCADE

Added `ondelete='CASCADE'` to `APIKey.session_id` foreign key in AI-Writer:

```python
session_id = Column(Integer, ForeignKey('onboarding_sessions.id', ondelete='CASCADE'))
```

Alembic migration `0022_add_apikey_cascade.py` drops and recreates the FK constraint with CASCADE behavior. Deleting an `OnboardingSession` now automatically cascades to associated `APIKey` records.

## Task 2: Soft Delete Cascade

Enhanced `ClientService.softDelete()` to cascade soft deletes to related entities within a single transaction:

| Entity | Action | Field Updated |
|--------|--------|---------------|
| clients | soft delete | isDeleted=true, deletedAt=now |
| audits | archive | isArchived=true, archivedAt=now |
| contracts | cancel | status='cancelled' |
| reportSchedules | disable | enabled=false |
| siteConnections | disconnect | status='disconnected' |

All operations wrapped in `withTransaction()` for atomicity. Auth cache invalidated after successful cascade.

## Task 3: Status CHECK Constraints

Created migration `0070_add_status_constraints.sql` with:

**PostgreSQL ENUMs:**
- `audit_status`: pending, running, completed, failed, cancelled
- `brief_status`: draft, ready, generating, published
- `connection_status`: pending, active, error, disconnected
- `proposal_status`: draft, sent, viewed, accepted, signed, paid, onboarded, expired, declined
- `workflow_instance_status`: pending, running, paused, completed, failed, cancelled

**CHECK Constraints Added:**
- `chk_audit_status_valid` on `audits.status`
- `chk_site_connection_status_valid` on `site_connections.status`
- `chk_workflow_instance_status_valid` on `workflow_instances.status` (if table exists)
- `chk_proposal_status_valid` on `proposals.status`

All constraint additions use conditional DDL to avoid errors if already present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed schema field name mismatches**
- **Found during:** Task 2 implementation
- **Issue:** Plan referenced `schedules` table with `isActive` field; actual schema is `reportSchedules` with `enabled` field
- **Fix:** Updated imports and field references to match actual schema
- **Files modified:** ClientService.ts

**2. [Rule 2 - Missing] Site connections lack soft delete column**
- **Found during:** Task 2 implementation
- **Issue:** `siteConnections` table has no `isActive` column; uses `status` field
- **Fix:** Changed cascade action to set `status='disconnected'` instead of `isActive=false`
- **Files modified:** ClientService.ts

## Verification

- [x] APIKey model has ondelete='CASCADE' on session_id FK
- [x] Alembic migration 0022 exists and is valid
- [x] ClientService.softDelete cascades within transaction
- [x] Auth cache invalidated after soft delete
- [x] Migration 0070 creates PostgreSQL ENUMs
- [x] CHECK constraints use conditional DDL pattern

## Self-Check: PASSED

All files verified:
- AI-Writer/backend/alembic/versions/0022_add_apikey_cascade.py: FOUND
- open-seo-main/drizzle/0070_add_status_constraints.sql: FOUND
- Commits verified in git log
