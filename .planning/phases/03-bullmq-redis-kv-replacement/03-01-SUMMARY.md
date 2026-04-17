---
phase: 03-bullmq-redis-kv-replacement
plan: "01"
subsystem: open-seo-main/server-infra
tags: [redis, ioredis, bullmq, queue, infrastructure, env-validation]
dependency_graph:
  requires: []
  provides:
    - open-seo-main/src/server/lib/redis.ts (singleton + Queue connection factory)
    - open-seo-main/src/server/queues/auditQueue.ts (audit-queue + failed-audits Queue)
    - REDIS_URL in REQUIRED_ENV_CORE startup validation
  affects:
    - open-seo-main/src/server/lib/runtime-env.ts (REQUIRED_ENV_CORE extended)
tech_stack:
  added:
    - ioredis@5.10.1 (already installed, now wired)
    - bullmq@5.74.1 Queue (already installed, now instantiated)
  patterns:
    - Singleton Redis client with process.exit on connection loss
    - BullMQ separate-connection-per-Queue/Worker pattern
    - Fail-fast env validation at startup
key_files:
  created:
    - open-seo-main/src/server/lib/redis.ts
    - open-seo-main/src/server/queues/auditQueue.ts
  modified:
    - open-seo-main/src/server/lib/runtime-env.ts
decisions:
  - "createRedisConnection() factory pattern chosen over passing singleton to BullMQ — BullMQ requires dedicated connections per Queue/Worker (BQ-03)"
  - "REDIS_URL read directly in redis.ts rather than via getRequiredEnvValue() — keeps Redis concerns in one file; validateEnv() provides the fail-fast startup check"
  - "AuditStep enum + job.data.step field chosen for CF Workflows -> BullMQ step-level retry mapping"
metrics:
  duration: "~10 minutes"
  completed: 2026-04-17
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase 03 Plan 01: BullMQ Redis Infrastructure Foundation Summary

**One-liner:** ioredis singleton + BullMQ Queue/Worker connection factory with `audit-queue` and `failed-audits` dead-letter queue definitions, plus fail-fast REDIS_URL startup validation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ioredis singleton and BullMQ connection factory | 69cd30e | open-seo-main/src/server/lib/redis.ts |
| 2 | Create BullMQ audit-queue and failed-audits dead-letter queue | a5b1cfb | open-seo-main/src/server/queues/auditQueue.ts |
| 3 | Add REDIS_URL to REQUIRED_ENV_CORE for fail-fast startup validation | 0c5de54 | open-seo-main/src/server/lib/runtime-env.ts |

## What Was Built

### redis.ts
Exports three items:
- `redis` — singleton ioredis client (for KV operations in progress-kv.ts and future plans). Throws at construction if `REDIS_URL` is unset. The `end` event triggers `process.exit(1)` after ioredis retries are exhausted.
- `createRedisConnection()` — factory that returns a new ioredis instance for each BullMQ Queue or Worker. Required because BullMQ mandates dedicated connections per Queue/Worker.
- `closeRedis()` — graceful shutdown helper calling `redis.quit()` (wired in Plan 04).

All connections use `maxRetriesPerRequest: null` and `enableReadyCheck: false` per BullMQ requirements.

### auditQueue.ts
Exports:
- `auditQueue` — BullMQ Queue for site audit jobs (3 attempts, exponential backoff: 10s/20s/40s)
- `failedAuditsQueue` — dead-letter Queue for terminally failed audit jobs (kept forever for debugging)
- `AUDIT_QUEUE_NAME = "audit-queue"` and `FAILED_AUDITS_QUEUE_NAME = "failed-audits"` name constants
- `AUDIT_STEP` enum and `AuditStep` type for CF Workflows -> BullMQ step-level retry mapping
- `AuditJobData` and `FailedAuditJobData` interfaces

Each Queue instantiates its own connection via `createRedisConnection()` per BQ-03.

### runtime-env.ts changes
`REQUIRED_ENV_CORE` extended: `["DATABASE_URL", "REDIS_URL"]`
`REQUIRED_ENV_HOSTED` extended: includes `"REDIS_URL"` alongside `"DATABASE_URL"`, `"BETTER_AUTH_SECRET"`, `"BETTER_AUTH_URL"`.

This ensures `validateEnv(REQUIRED_ENV_CORE)` at server startup produces a clear aggregated error if REDIS_URL is absent — before ioredis has a chance to emit connection errors.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exports are fully implemented infrastructure (no placeholder data, no mock values).

## Threat Surface

All mitigations from the plan's threat model are implemented:

| Threat | Status |
|--------|--------|
| T-03-01: redis.on("error") does not log REDIS_URL value — only the err object (ioredis scrubs URL) | Implemented |
| T-03-02: closeRedis() exported for graceful shutdown | Implemented — wiring deferred to Plan 04 |
| T-03-03: validateEnv(REQUIRED_ENV_CORE) includes REDIS_URL — process exits before accepting traffic | Implemented |
| T-03-04: Redis auth on internal network only | Accepted — deferred to Plan 04 docker-compose |

## Self-Check: PASSED

- open-seo-main/src/server/lib/redis.ts: FOUND
- open-seo-main/src/server/queues/auditQueue.ts: FOUND
- open-seo-main/src/server/lib/runtime-env.ts: MODIFIED (REDIS_URL present)
- Commit 69cd30e: FOUND
- Commit a5b1cfb: FOUND
- Commit 0c5de54: FOUND
- pnpm exec tsc --noEmit: PASS
- grep cloudflare:workers in new files: 0 matches (PASS)
