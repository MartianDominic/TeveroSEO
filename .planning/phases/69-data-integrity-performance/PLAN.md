# Phase 69: Data Integrity & Performance

**Milestone:** v8.0 SaaS Hardening
**Duration:** 2.5 weeks
**Priority:** HIGH - Reliability & performance

## Overview

Transaction safety, constraint enforcement, query optimization, background job reliability, and idempotency patterns.

## Sub-Plans

| Plan | Name | Wave | Depends On |
|------|------|------|------------|
| 69-01 | Transaction Wrappers | 1 | 68-04 |
| 69-02 | Cascade & Constraints | 1 | 69-01 |
| 69-03 | Query Optimization | 2 | 67-03 |
| 69-04 | Background Job Reliability | 2 | 69-01 |

## Issues Resolved

- CRIT-TRANS-01: Missing transaction wrappers
- CRIT-JOB-01, CRIT-JOB-02: Optimistic locking, atomic state transitions
- HIGH-CASCADE-01: APIKey missing CASCADE
- HIGH-QUERY-01 to HIGH-QUERY-05: N+1, unbounded, missing indexes
- HIGH-JOB-01 to HIGH-JOB-05: Deduplication, DLQ, circuit breaker

---

## Plan 69-01: Transaction Wrappers

```yaml
---
phase: 69-data-integrity-performance
plan: 01
type: execute
wave: 1
depends_on: [68-04]
files_modified:
  - open-seo-main/src/server/lib/db-transaction.ts
  - open-seo-main/src/server/features/prospects/services/ProspectService.ts
  - open-seo-main/src/server/lib/saga.ts
autonomous: true
requirements:
  - CRIT-TRANS-01
must_haves:
  truths:
    - All multi-table operations use withTransaction()
    - Transaction failures roll back all changes
    - Webhook jobs enqueued after transaction commits
  artifacts:
    - open-seo-main/src/server/lib/db-transaction.ts (withTransaction)
    - open-seo-main/src/server/lib/saga.ts (executeSaga)
  key_links:
    - Drizzle db.transaction API
    - BullMQ addBulk for post-commit
---
```

<objective>
Implement standardized transaction handling with rollback safety and saga pattern for cross-service operations.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Create withTransaction Helper

Files: `open-seo-main/src/server/lib/db-transaction.ts`

Acceptance:
- [ ] Wraps Drizzle transaction
- [ ] Re-throws AppError, wraps others

### Task 2: Fix convertProspectToClient Transaction

Files: `open-seo-main/src/server/features/prospects/services/ProspectService.ts`

Acceptance:
- [ ] All operations in single transaction
- [ ] Webhook jobs collected and enqueued after commit

### Task 3: Implement Saga Pattern

Files: `open-seo-main/src/server/lib/saga.ts`

Acceptance:
- [ ] Compensation runs in reverse on failure
- [ ] Failed compensation logged to DLQ

---

## Plan 69-02: Cascade & Constraints

```yaml
---
phase: 69-data-integrity-performance
plan: 02
type: execute
wave: 1
depends_on: [69-01]
files_modified:
  - AI-Writer/backend/models/onboarding.py
  - AI-Writer/alembic/versions/xxxx_add_apikey_cascade.py
  - open-seo-main/src/server/features/clients/services/ClientService.ts
  - open-seo-main/drizzle/migrations/xxxx_add_status_constraints.sql
autonomous: true
requirements:
  - HIGH-CASCADE-01
must_haves:
  truths:
    - APIKey.session_id has ON DELETE CASCADE
    - Soft delete cascades to related entities
    - Status fields have CHECK constraints
  artifacts:
    - AI-Writer/alembic/versions/xxxx_add_apikey_cascade.py
    - open-seo-main/drizzle/migrations/xxxx_add_status_constraints.sql
  key_links:
    - Alembic op.create_foreign_key with ondelete
    - pgEnum for status fields
---
```

<objective>
Add missing CASCADE constraints, implement soft delete cascade, and add CHECK constraints for status fields.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Add CASCADE to APIKey.session_id

Files: `AI-Writer/backend/models/onboarding.py`, Alembic migration

Acceptance:
- [ ] Deleting OnboardingSession cascades to APIKey

### Task 2: Implement Soft Delete Cascades

Files: `open-seo-main/src/server/features/clients/services/ClientService.ts`

Acceptance:
- [ ] Client soft delete cascades to projects, audits, briefs
- [ ] Access cache invalidated

### Task 3: Add Status CHECK Constraints

Files: `open-seo-main/drizzle/migrations/xxxx_add_status_constraints.sql`

Acceptance:
- [ ] Prospect, audit, brief, job status constrained
- [ ] Drizzle schema uses pgEnum

---

## Plan 69-03: Query Optimization

```yaml
---
phase: 69-data-integrity-performance
plan: 03
type: execute
wave: 2
depends_on: [67-03]
files_modified:
  - open-seo-main/src/server/features/prospects/services/AnalysisService.ts
  - AI-Writer/backend/services/auto_publish_executor.py
  - open-seo-main/drizzle/migrations/xxxx_add_composite_indexes.sql
  - open-seo-main/src/server/lib/pagination.ts
autonomous: true
requirements:
  - HIGH-QUERY-01
  - HIGH-QUERY-02
  - HIGH-QUERY-03
  - HIGH-QUERY-04
  - HIGH-QUERY-05
must_haves:
  truths:
    - bulkQueueAnalysis runs in <500ms for 100 items
    - All list queries have LIMIT
    - Composite indexes on hot query patterns
    - Cursor-based pagination implemented
  artifacts:
    - open-seo-main/drizzle/migrations/xxxx_add_composite_indexes.sql
    - open-seo-main/src/server/lib/pagination.ts (buildCursorCondition)
  key_links:
    - CREATE INDEX CONCURRENTLY
    - packages/utils/src/pagination.ts cursor helpers
---
```

<objective>
Fix N+1 queries, add LIMIT to unbounded queries, create composite indexes, and implement cursor pagination.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Fix N+1 in bulkQueueAnalysis

Files: `open-seo-main/src/server/features/prospects/services/AnalysisService.ts`

Acceptance:
- [ ] Batch fetch all prospects
- [ ] Batch insert jobs
- [ ] Performance: 100 items < 500ms

### Task 2: Add LIMIT to Unbounded Queries

Files: `AI-Writer/backend/services/auto_publish_executor.py`, other services

Acceptance:
- [ ] BATCH_SIZE = 50 applied
- [ ] Max 100 enforced on list endpoints

### Task 3: Create Composite Indexes

Files: `open-seo-main/drizzle/migrations/xxxx_add_composite_indexes.sql`

Acceptance:
- [ ] idx_audits_client_status
- [ ] idx_briefs_client_status_created
- [ ] idx_seo_checks_audit_severity

### Task 4: Implement Cursor Pagination

Files: `open-seo-main/src/server/lib/pagination.ts`

Acceptance:
- [ ] buildCursorCondition helper
- [ ] CursorPaginationResult type

---

## Plan 69-04: Background Job Reliability

```yaml
---
phase: 69-data-integrity-performance
plan: 04
type: execute
wave: 2
depends_on: [69-01]
files_modified:
  - AI-Writer/backend/services/auto_publish_executor.py
  - AI-Writer/backend/services/job_state_machine.py
  - open-seo-main/src/server/lib/job-deduplication.ts
  - open-seo-main/src/server/lib/dead-letter-queue.ts
  - open-seo-main/src/server/lib/circuit-breaker.ts
  - open-seo-main/src/db/schema.ts
autonomous: true
requirements:
  - CRIT-JOB-01
  - CRIT-JOB-02
  - HIGH-JOB-01
  - HIGH-JOB-02
  - HIGH-JOB-03
must_haves:
  truths:
    - Optimistic locking prevents concurrent job claims
    - Job state transitions are atomic
    - Duplicate jobs are deduplicated via Redis
    - Failed jobs go to dead letter queue
    - Circuit breaker shared across workers
  artifacts:
    - AI-Writer/backend/services/job_state_machine.py (transition_job_status)
    - open-seo-main/src/server/lib/job-deduplication.ts (acquireJobLock)
    - open-seo-main/src/server/lib/dead-letter-queue.ts (moveToDeadLetter)
    - open-seo-main/src/server/lib/circuit-breaker.ts (RedisCircuitBreaker)
  key_links:
    - Redis SET NX EX for locks
    - dead_letter_jobs table schema
---
```

<objective>
Implement optimistic locking, atomic state transitions, job deduplication, dead letter queue, and shared circuit breaker.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Add Optimistic Locking to Article Claims

Files: `AI-Writer/backend/services/auto_publish_executor.py`

Acceptance:
- [ ] Version check in WHERE clause
- [ ] Returns None on version mismatch

### Task 2: Implement Job State Machine

Files: `AI-Writer/backend/services/job_state_machine.py`

Acceptance:
- [ ] VALID_TRANSITIONS defined
- [ ] Invalid transitions raise ValueError

### Task 3: Implement Job Deduplication

Files: `open-seo-main/src/server/lib/job-deduplication.ts`

Acceptance:
- [ ] Redis SET NX EX for atomic lock
- [ ] Release lock after completion

### Task 4: Implement Dead Letter Queue

Files: `open-seo-main/src/server/lib/dead-letter-queue.ts`, schema

Acceptance:
- [ ] dead_letter_jobs table created
- [ ] Jobs moved after max retries

### Task 5: Implement Redis Circuit Breaker

Files: `open-seo-main/src/server/lib/circuit-breaker.ts`

Acceptance:
- [ ] State shared across workers via Redis
- [ ] Half-open allows limited requests
