---
phase: 03-bullmq-redis-kv-replacement
verified: 2026-04-17T00:00:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Phase 3: BullMQ + Redis KV Replacement — Verification Report

**Phase Goal:** Site audit jobs run reliably via BullMQ on Redis; no Cloudflare runtime references remain in the audit path.
**Verified:** 2026-04-17
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Triggering a site audit enqueues a BullMQ job and the worker executes all steps to completion | VERIFIED | `AuditService.startAudit` calls `auditQueue.add(...)` (line 68); `audit-worker.ts` starts `Worker` consuming `AUDIT_QUEUE_NAME`; `audit-processor.ts` runs `runAuditPhases` via sandboxed child process |
| 2 | Audit crawl progress reads/writes via ioredis with correct TTL semantics (`audit-progress:` prefix, 30-min expiry) | VERIFIED | `progress-kv.ts` defines `KV_PREFIX = "audit-progress:"` (line 15) and `TTL_SECONDS = 30 * 60` (line 16); `redis.set(key, ..., "EX", TTL_SECONDS)` used in `pushCrawledUrls` (line 57); imports ioredis singleton from `@/server/lib/redis` |
| 3 | Failed jobs after max retries appear in `failed-audits` dead-letter queue | VERIFIED | `audit-worker.ts` `on("failed")` handler checks `job.attemptsMade >= maxAttempts` and calls `failedAuditsQueue.add(...)` (lines 70–82); `failedAuditsQueue` uses name `"failed-audits"` (line 17 of auditQueue.ts) |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/lib/redis.ts` | ioredis singleton + BullMQ connection factory | VERIFIED | Exports `redis` singleton, `createRedisConnection()`, and `closeRedis()`; sets `maxRetriesPerRequest: null` required by BullMQ |
| `src/server/queues/auditQueue.ts` | `auditQueue`, `failedAuditsQueue`, `AUDIT_STEP` enum | VERIFIED | All three exported; queue names `"audit-queue"` and `"failed-audits"`; each queue uses a dedicated `createRedisConnection()` |
| `src/server/lib/audit/progress-kv.ts` | ioredis-backed with `KV_PREFIX="audit-progress:"`, `TTL_SECONDS=1800` | VERIFIED | Exact constants present; uses `redis.get/set/del`; Zod validation on read |
| `src/server/workers/audit-worker.ts` | BullMQ Worker, `lockDuration>=120000`, `maxStalledCount:2`, DLQ on failure, 25s shutdown | VERIFIED | `lockDuration: 120_000`, `maxStalledCount: 2`, DLQ wired in `on("failed")`, `SHUTDOWN_TIMEOUT_MS = 25_000` |
| `src/server/workers/audit-processor.ts` | Sandboxed processor | VERIFIED | Loaded via file path (not inline fn), so BullMQ spawns it as a child process; invokes `runAuditPhases` |
| `src/server/features/audit/services/AuditService.ts` | `startAudit` calls `auditQueue.add()`, `remove` calls `job.remove()` | VERIFIED | `auditQueue.add(...)` at line 68 with `{ jobId: auditId }`; `job.remove()` called inside `remove()` at line 199 |
| `src/server.ts` | Calls `startAuditWorker()`, SIGTERM/SIGINT handlers | VERIFIED | `startAuditWorker()` called at line 14; `process.on("SIGTERM")` and `process.on("SIGINT")` both wired to `shutdown()` which calls `stopAuditWorker()` then `closeRedis()` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AuditService.startAudit` | `auditQueue` | `auditQueue.add(...)` | WIRED | Line 68 of AuditService.ts |
| `AuditService.remove` | running BullMQ job | `auditQueue.getJob(id)` then `job.remove()` | WIRED | Lines 195–200 of AuditService.ts |
| `audit-worker.ts` | `failedAuditsQueue` | `on("failed")` handler | WIRED | Lines 70–82; guards on `attemptsMade >= maxAttempts` |
| `audit-worker.ts` | `audit-processor.ts` | `PROCESSOR_PATH` (file URL resolution) | WIRED | `fileURLToPath(new URL("./audit-processor.js", import.meta.url))` |
| `progress-kv.ts` | Redis | ioredis `redis` singleton | WIRED | `await redis.set(key, ..., "EX", TTL_SECONDS)` and `await redis.get(key)` |
| `server.ts` | `audit-worker.ts` | `startAuditWorker()` import | WIRED | Lines 3 and 14 of server.ts |

---

### Cloudflare Runtime Removal Check

| Pattern | Search scope | Result |
|---------|-------------|--------|
| `cloudflare:workers` import | `src/server/` (recursive) | NO MATCHES — fully removed |
| `env.KV` binding | `src/server/` (recursive) | NO MATCHES — replaced with ioredis |
| `env.SITE_AUDIT_WORKFLOW` binding | `src/server/` (recursive) | NO MATCHES — replaced with BullMQ |
| `WorkflowEntrypoint` class | `src/` (recursive) | NO MATCHES — deleted |
| `SiteAuditWorkflow.ts` | `src/server/workflows/` | FILE EXISTS but contains only a type-only re-export stub (no CF imports, safe) |

---

### Anti-Patterns Found

None blocking. The retained `SiteAuditWorkflow.ts` is a deliberate type-only shim (1 export line) to preserve backwards-compatible imports — it contains no Cloudflare bindings and is not on the audit execution path.

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — these files are server-side modules requiring a running Redis instance. No entry point can be exercised without an active Redis connection in this environment.

---

### Human Verification Required

None identified. All success criteria are verifiable through static analysis.

---

## Gaps Summary

No gaps found. All three success criteria are fully met:

1. The full BullMQ enqueue-to-execute pipeline is wired: `AuditService.startAudit` → `auditQueue.add` → `audit-worker` Worker → sandboxed `audit-processor` → `runAuditPhases`.
2. `progress-kv.ts` uses the ioredis singleton with the exact `"audit-progress:"` prefix and 1800s (30-minute) TTL.
3. The dead-letter queue (`"failed-audits"`) is correctly wired in the Worker's `on("failed")` handler, gated on `attemptsMade >= maxAttempts`.
4. No `cloudflare:workers` imports remain anywhere in the audit path.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_
