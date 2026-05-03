# Phase 67 Context: Database Consolidation

## Source Documents

- `.planning/UNIFIED_REMEDIATION_PLAN.md` - Phase 1 section
- `.planning/phases/DB-CONSOLIDATION-PLAN.md` - Full technical plan

## Linked Issues

| ID | Severity | Issue |
|----|----------|-------|
| CRITICAL-DB-002 | CRITICAL | Table collision: gsc_snapshots |
| CRITICAL-DB-005 | CRITICAL | Table collision: ga4_snapshots |
| HIGH-DB-001 | HIGH | clients.workspace_id nullable in alwrity |
| HIGH-DB-003 | HIGH | Cross-DB sync lacks rollback |
| HIGH-DB-004 | HIGH | Voice profiles linked differently |
| MED-DB-006 | MEDIUM | DateTime timezone inconsistency |
| MED-DB-007 | MEDIUM | No cross-database JOINs |

## Current State

- **open_seo**: Drizzle ORM, ~50 tables
- **alwrity**: SQLAlchemy, ~45 tables
- Both have `clients`, `gsc_snapshots`, `ga4_snapshots` tables

## Target State

- Single **tevero** database
- Namespace prefixes: shared_, seo_, content_, biz_, analytics_
- Drizzle owns shared/seo/biz/analytics tables
- SQLAlchemy owns content tables

## Key Decisions

- workspace_id NOT NULL (ORPHAN_ prefix for legacy nulls)
- Voice profiles merge with ownership check constraint
- TIMESTAMPTZ for all timestamps
- Zero-downtime via dual-write pattern
