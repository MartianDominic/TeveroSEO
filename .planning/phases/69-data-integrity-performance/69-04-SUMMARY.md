---
phase: 69-data-integrity-performance
plan: 04
subsystem: infra
tags: [redis, bullmq, sqlalchemy, optimistic-locking, circuit-breaker, dead-letter-queue]

# Dependency graph
requires:
  - phase: 69-01
    provides: [transaction wrappers, saga pattern]
provides:
  - Optimistic locking for concurrent job claims
  - Job state machine with atomic transitions
  - Job deduplication via Redis distributed locks
  - Dead letter queue for failed job recovery
  - Shared circuit breaker across workers
affects: [background-jobs, worker-reliability, job-recovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optimistic locking with version field
    - Redis SET NX EX for atomic locks
    - Circuit breaker pattern with Redis state
    - Dead letter queue for failed job recovery

key-files:
  created:
    - AI-Writer/backend/services/job_state_machine.py
    - open-seo-main/src/server/lib/job-deduplication.ts
    - open-seo-main/src/server/lib/dead-letter-queue.ts
    - open-seo-main/src/server/lib/circuit-breaker.ts
    - open-seo-main/src/db/dead-letter-queue-schema.ts
  modified:
    - AI-Writer/backend/services/auto_publish_executor.py
    - open-seo-main/src/db/schema.ts

key-decisions:
  - "Optimistic locking via version field in WHERE clause (no pessimistic FOR UPDATE)"
  - "Redis SET NX EX for atomic lock acquisition (not separate SETNX + EXPIRE)"
  - "Lua scripts for atomic lock release/extend (ownership verification)"
  - "Circuit breaker state in Redis for cross-worker sharing"
  - "DLQ stores job data + metadata for replay capability"

patterns-established:
  - "Job deduplication: acquire lock before processing, release after completion"
  - "State machine validation: validate_transition() before UPDATE"
  - "Circuit breaker: execute() wrapper for automatic success/failure tracking"

requirements-completed: [CRIT-JOB-01, CRIT-JOB-02, HIGH-JOB-01, HIGH-JOB-02, HIGH-JOB-03]

# Metrics
duration: 2min
completed: 2026-05-04
---

# Phase 69 Plan 04: Background Job Reliability Summary

**Optimistic locking, job state machine, Redis deduplication, dead letter queue, and shared circuit breaker for worker reliability**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-04T09:56:38Z
- **Completed:** 2026-05-04T09:58:45Z
- **Tasks:** 5
- **Files modified:** 7

## Accomplishments

- Optimistic locking prevents concurrent job claims via version check in WHERE clause
- Job state machine ensures valid transitions with InvalidTransitionError for violations
- Redis distributed locks deduplicate jobs across workers with TTL and heartbeat support
- Dead letter queue stores failed jobs with error context for inspection and replay
- Circuit breaker shared via Redis opens after threshold failures, auto-recovers

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Optimistic Locking to Article Claims** - `27a21a20` (included in 69-03 commit with file creation)
2. **Task 2: Implement Job State Machine** - `2299e464` (feat)
3. **Task 3: Implement Job Deduplication** - `eb59eff1` (feat)
4. **Task 4: Implement Dead Letter Queue** - `d59e2d3d` (feat)
5. **Task 5: Implement Redis Circuit Breaker** - `5b895941` (feat)

## Files Created/Modified

### Created
- `AI-Writer/backend/services/job_state_machine.py` - JobStatus enum, VALID_TRANSITIONS, transition_job_status()
- `open-seo-main/src/server/lib/job-deduplication.ts` - acquireJobLock, releaseJobLock, extendJobLock, withJobLock
- `open-seo-main/src/server/lib/dead-letter-queue.ts` - moveToDeadLetter, replayFromDeadLetter, listDeadLetterJobs
- `open-seo-main/src/db/dead-letter-queue-schema.ts` - dead_letter_jobs table schema
- `open-seo-main/src/server/lib/circuit-breaker.ts` - RedisCircuitBreaker class with execute() wrapper

### Modified
- `AI-Writer/backend/services/auto_publish_executor.py` - _claim_article_optimistic with version check
- `open-seo-main/src/db/schema.ts` - Export dead-letter-queue-schema

## Decisions Made

1. **Optimistic over pessimistic locking** - Version field in WHERE clause is more efficient for low-contention scenarios than FOR UPDATE row locks
2. **Atomic SET NX EX** - Single Redis command for lock acquisition prevents race conditions vs separate SETNX + EXPIRE
3. **Lua scripts for ownership** - releaseJobLock/extendJobLock verify lockId ownership atomically to prevent releasing another worker's lock
4. **Redis state for circuit breaker** - Enables all workers to share failure count and circuit state, not just local memory
5. **DLQ with metadata** - Stores failure history, worker info, and processing duration for debugging

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all implementations aligned with acceptance criteria.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Job reliability infrastructure complete for Phase 70 (Frontend Quality)
- Circuit breaker can be applied to any external service calls
- DLQ provides recovery mechanism for failed jobs

---
*Phase: 69-data-integrity-performance*
*Completed: 2026-05-04*
