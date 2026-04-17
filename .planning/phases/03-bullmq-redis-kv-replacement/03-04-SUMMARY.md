---
phase: 03-bullmq-redis-kv-replacement
plan: "04"
subsystem: audit-queue-wiring
tags: [bullmq, audit, queue, graceful-shutdown, node]
dependency_graph:
  requires: ["03-01", "03-02", "03-03"]
  provides: ["live-audit-enqueue", "worker-startup", "graceful-shutdown"]
  affects: ["open-seo-main/src/server/features/audit/services/AuditService.ts", "open-seo-main/src/server.ts"]
tech_stack:
  added: []
  patterns: ["BullMQ jobId deduplication", "try/catch rollback on enqueue failure", "SIGTERM/SIGINT idempotent shutdown guard"]
key_files:
  created: []
  modified:
    - open-seo-main/src/server/features/audit/services/AuditService.ts
    - open-seo-main/src/server.ts
decisions:
  - "jobId: auditId used for BullMQ deduplication (BQ-02) — second startAudit with same id is a no-op"
  - "Rollback via deleteAuditForProject if auditQueue.add fails — prevents orphaned DB rows when Redis is down"
  - "job.remove() wrapped in try/catch in remove() — best-effort cancellation; Worker failure is handled via DLQ"
  - "Worker runs in same process as HTTP server for Phase 3 dev simplicity; Docker Phase 4 can split to separate container"
  - "Shutdown order: stopAuditWorker -> closeRedis -> pool.end — ensures in-flight jobs finish DB/Redis writes before connections close"
  - "shuttingDown boolean guard prevents double-shutdown on platforms that fire SIGTERM twice"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 03 Plan 04: BullMQ Queue Wiring + Graceful Shutdown Summary

**One-liner:** Wire AuditService.startAudit to enqueue BullMQ jobs with jobId deduplication, cancel running jobs on remove(), and start the Worker with SIGTERM/SIGINT graceful shutdown in server.ts.

## What Was Built

### Task 1 — AuditService queue wiring (commit f447d00)

Replaced two Phase-2 stubs in `AuditService.ts`:

**startAudit:** Removed the error-throw-and-rollback stub. After `AuditRepository.createAudit()`, now constructs an `AuditJobData` payload with `step: AUDIT_STEP.DISCOVER` and calls `auditQueue.add(`audit-${auditId}`, jobData, { jobId: auditId })`. The `jobId: auditId` option enables BullMQ's built-in deduplication (BQ-02) — a second call with the same auditId is silently ignored by the queue. If enqueue fails (Redis down), a catch block rolls back via `AuditRepository.deleteAuditForProject` to prevent orphaned audit rows.

**remove:** Replaced the `CONFLICT` throw for running audits with `auditQueue.getJob(auditId)` followed by `job.remove()` wrapped in try/catch (best-effort; active jobs may reject removal, which is handled by the Worker's DLQ path).

### Task 2 — Worker startup + graceful shutdown (commit 72cfff9)

Rewrote `src/server.ts` to:
- Call `startAuditWorker()` at module load (runs Worker in same process as HTTP server)
- Install `process.on("SIGTERM")` and `process.on("SIGINT")` handlers
- Shutdown sequence: `stopAuditWorker()` (25s drain from Plan 03) → `closeRedis()` → `pool.end()` → `process.exit(0)`
- `shuttingDown` boolean guard prevents double-execution if signals fire in rapid succession

## Verification

```
pnpm exec tsc --noEmit  # exits 0
grep -c "Audits are disabled until Phase 3" AuditService.ts  # 0
grep -c "Running audits cannot be deleted until Phase 3" AuditService.ts  # 0
grep -c "auditQueue.add" AuditService.ts  # 1
grep -c "jobId: auditId" AuditService.ts  # 2 (add options + comment)
grep -c "startAuditWorker()" server.ts  # 1
grep -c "SIGTERM" server.ts  # 2
```

All checks passed.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All Phase-2 stubs have been replaced with live BullMQ queue integration.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Changes are internal to the process lifecycle and queue wiring. All threats from the plan's STRIDE register (T-03-15 through T-03-19) are mitigated as specified.

## Self-Check

Files exist:
- FOUND: open-seo-main/src/server/features/audit/services/AuditService.ts
- FOUND: open-seo-main/src/server.ts

Commits exist:
- f447d00: feat(03-04): wire AuditService to BullMQ queue + enqueue jobs
- 72cfff9: feat(03-04): start BullMQ worker in server.ts + SIGTERM/SIGINT graceful shutdown

## Self-Check: PASSED
