---
phase: 03-bullmq-redis-kv-replacement
plan: "03"
subsystem: audit-worker
tags: [bullmq, worker, dlq, graceful-shutdown, sandboxed-processor]
dependency_graph:
  requires: [03-01]
  provides: [audit-worker, audit-processor, dlq-handler]
  affects: [siteAuditWorkflow, audit-queue, failed-audits-queue]
tech_stack:
  added: [bullmq-sandboxed-processor, node-url-fileURLToPath]
  patterns: [sandboxed-processor, step-adapter, dlq-on-exhausted-retries, graceful-shutdown-race]
key_files:
  created:
    - open-seo-main/src/server/workers/audit-processor.ts
    - open-seo-main/src/server/workers/audit-worker.ts
  modified:
    - open-seo-main/src/server/workflows/SiteAuditWorkflow.ts
decisions:
  - "Used fileURLToPath(new URL('./audit-processor.js', import.meta.url)) for ESM-compatible processor path resolution"
  - "DLQ enqueue only when attemptsMade >= maxAttempts — not on every failed attempt"
  - "SiteAuditWorkflow reduced to type-only re-export rather than deleted to preserve AuditParams compat"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-17"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase 03 Plan 03: BullMQ Audit Worker Summary

BullMQ Worker + sandboxed processor replacing SiteAuditWorkflow stub, with step-level resume adapter, DLQ on exhausted retries, and 25s graceful shutdown.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create sandboxed processor (audit-processor.ts) | 57f79b5 | open-seo-main/src/server/workers/audit-processor.ts |
| 2 | Create BullMQ Worker with DLQ + graceful shutdown | 0859808 | open-seo-main/src/server/workers/audit-worker.ts |
| 3 | Remove Phase-2 SiteAuditWorkflow stub class | d1dfdc9 | open-seo-main/src/server/workflows/SiteAuditWorkflow.ts |

## What Was Built

### audit-processor.ts (74 lines)
Sandboxed BullMQ processor passed by file path to Worker constructor — BullMQ spawns it as a child process (BQ-04). Provides a `WorkflowStep` adapter whose `.do()` persists `job.data.step` enum via `job.updateData()` before each named step, enabling step-level resume semantics on retry. Calls `runAuditPhases()` from Phase-2 unchanged.

### audit-worker.ts (110 lines)
Exports `startAuditWorker` and `stopAuditWorker`. Worker configured with:
- `lockDuration: 120_000` (BQ-05)
- `maxStalledCount: 2` (BQ-06)
- Dedicated Redis connection via `createRedisConnection()` (BQ-03)
- Sandboxed processor path via `fileURLToPath(new URL('./audit-processor.js', import.meta.url))` (BQ-04)
- `on('failed')` handler enqueues `FailedAuditJobData` to `failedAuditsQueue` only when `attemptsMade >= maxAttempts` (BQ-07)
- `stopAuditWorker()`: races `worker.close()` with 25s timeout, force-closes on timeout (BQ-06)

### SiteAuditWorkflow.ts (reduced)
Class `SiteAuditWorkflow` deleted. File retained as type-only re-export: `export type { AuditJobData as AuditParams } from "@/server/queues/auditQueue"`. No remaining class importers in `src/`.

## Requirements Satisfied

| Requirement | Status |
|-------------|--------|
| BQ-01 Worker replaces SiteAuditWorkflow | Done |
| BQ-03 Dedicated Redis connection for Worker | Done |
| BQ-04 Lighthouse processor in sandbox (separate file by path) | Done |
| BQ-05 lockDuration >= 120_000 | Done |
| BQ-06 maxStalledCount: 2 + 25s graceful shutdown | Done |
| BQ-07 failed jobs -> failed-audits DLQ | Done |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The processor path resolves to `.js` (compiled output). `audit-worker.ts` is wired into `src/server.ts` by Plan 04 — that integration is intentionally deferred.

## Self-Check: PASSED

- open-seo-main/src/server/workers/audit-processor.ts: FOUND (74 lines >= 40)
- open-seo-main/src/server/workers/audit-worker.ts: FOUND (110 lines >= 80)
- open-seo-main/src/server/workflows/SiteAuditWorkflow.ts: FOUND (type-only, no class)
- Commit 57f79b5: audit-processor.ts
- Commit 0859808: audit-worker.ts
- Commit d1dfdc9: SiteAuditWorkflow.ts stub removal
- TypeScript: pnpm exec tsc --noEmit exits 0
- No cloudflare:workers imports in worker files
- No remaining SiteAuditWorkflow class consumers in src/
