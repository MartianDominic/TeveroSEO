---
phase: 02-cf-bindings-removal-schema-migration
plan: "03"
subsystem: open-seo-main
tags: [cloudflare-removal, nodejs, postgresql, drizzle, process-env, runtime-env]
dependency_graph:
  requires: [02-01]
  provides: [drizzle-node-postgres-singleton, process-env-runtime-adapter, startup-validation]
  affects:
    - open-seo-main/src/db/index.ts
    - open-seo-main/src/server/lib/runtime-env.ts
tech_stack:
  added: []
  patterns: [pg-pool-singleton, process-env-only-runtime, startup-fail-fast-validation]
key_files:
  modified:
    - open-seo-main/src/db/index.ts
    - open-seo-main/src/server/lib/runtime-env.ts
decisions:
  - Keep async signatures on getRequiredEnvValue/isHostedServerAuthMode/getWorkersBinding for backward-compat with existing callers
  - getWorkersBinding retained as throwing shim so stale callers surface loudly rather than silently returning undefined
  - Export pool alongside db so tests and graceful shutdown can call pool.end()
  - validateEnv uses aggregated error (all missing vars in one throw) rather than fail-on-first
metrics:
  duration: "~2 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 2
---

# Phase 2 Plan 03: DB Connection + Runtime Env Rewrite Summary

**One-liner:** Replaced Cloudflare D1 binding and Workers env adapter with a pg.Pool-backed Drizzle singleton and a pure process.env runtime module that validates required vars at startup.

## What Was Built

These two files are the foundation that every other server module imports. Plan 03 makes them Node.js-native so downstream plans can compile cleanly.

### Task 1 — src/db/index.ts (`41a07ea`)

- Replaced `drizzle-orm/d1` + `import("cloudflare:workers").env.DB` with `drizzle-orm/node-postgres` + `new Pool({ connectionString })`
- Reads `process.env.DATABASE_URL`; throws descriptive startup error if unset
- Pool configured with sensible defaults: max 10 connections, 30s idle timeout, 10s connect timeout
- Exports both `db` (Drizzle client) and `pool` (for graceful shutdown and test teardown in Phase 3/4)
- Zero `cloudflare:workers` or `drizzle-orm/d1` references remain

### Task 2 — src/server/lib/runtime-env.ts (`7a406f1`)

- Removed dynamic `import("cloudflare:workers")` codepath and all associated helpers (`workersEnvPromise`, `loadWorkersEnv`, `getWorkersEnv`, `isRecord`)
- `readEnv()` private helper: reads `process.env[name]`, trims whitespace, returns `undefined` for empty strings
- Preserved async signatures on `getRequiredEnvValue`, `isHostedServerAuthMode`, `getWorkersBinding` — existing callers need no changes
- `getWorkersBinding` now throws a descriptive error (shim) rather than silently returning undefined
- Added `getOptionalEnvValue` for optional env reads
- Added `validateEnv(required)` — aggregates all missing vars in one error throw for fail-fast startup
- Added `REQUIRED_ENV_HOSTED` and `REQUIRED_ENV_CORE` constants consumed by startup validator (Plan 05)
- Zero `cloudflare:workers` references remain

## Deviations from Plan

None — plan executed exactly as written. Both files match the verbatim replacement content specified in the plan.

## Known Stubs

None. Both files are pure infrastructure with no UI-facing data paths.

## Threat Flags

None. These changes reduce attack surface by removing the dynamic `import("cloudflare:workers")` codepath. The `validateEnv` function improves startup security posture by failing fast on misconfiguration rather than silently running with missing credentials.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| open-seo-main/src/db/index.ts | FOUND |
| open-seo-main/src/server/lib/runtime-env.ts | FOUND |
| `drizzle-orm/node-postgres` in db/index.ts | FOUND (count=1) |
| `from "pg"` in db/index.ts | FOUND (count=1) |
| `cloudflare:workers` in db/index.ts | ABSENT (count=0) |
| `drizzle-orm/d1` in db/index.ts | ABSENT (count=0) |
| `process.env.DATABASE_URL` in db/index.ts | FOUND (count=1) |
| `export const pool` in db/index.ts | FOUND (count=1) |
| `export const db = drizzle(pool, { schema })` in db/index.ts | FOUND (count=1) |
| `DATABASE_URL is required` error text | FOUND |
| `cloudflare:workers` in runtime-env.ts | ABSENT (count=0) |
| `workersEnvPromise\|loadWorkersEnv\|getWorkersEnv` | ABSENT (count=0) |
| `process.env[` in runtime-env.ts | FOUND (count=1) |
| `export async function getRequiredEnvValue` | FOUND (count=1) |
| `export async function isHostedServerAuthMode` | FOUND (count=1) |
| `export async function getWorkersBinding` | FOUND (count=1) |
| `export function validateEnv` | FOUND (count=1) |
| `REQUIRED_ENV_HOSTED` | FOUND (count=1) |
| `REQUIRED_ENV_CORE` | FOUND (count=1) |
| `isHostedAuthMode` (import + usage) | FOUND (count=2) |
| commit 41a07ea (task 1) | FOUND |
| commit 7a406f1 (task 2) | FOUND |
