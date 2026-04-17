---
phase: 06-clerk-per-client-workspace-integration
plan: "01"
subsystem: open-seo-main/server/lib
tags: [auth, client-context, postgresql, security]
dependency_graph:
  requires: []
  provides: [alwrityPool, resolveClientId, CLIENT_ID_HEADER]
  affects: [open-seo-main/src/server/lib/runtime-env.ts, open-seo-main/src/server.ts, open-seo-main/src/worker-entry.ts]
tech_stack:
  added: [pg.Pool (alwrity connection), vitest unit tests]
  patterns: [dedicated sub-pool per external DB, UUID-first validation before DB round-trip]
key_files:
  created:
    - open-seo-main/src/server/lib/alwrity-db.ts
    - open-seo-main/src/server/lib/client-context.ts
    - open-seo-main/src/server/lib/client-context.test.ts
  modified:
    - open-seo-main/src/server/lib/runtime-env.ts
    - open-seo-main/.env.example
    - .env.vps.example
decisions:
  - "Dedicated pg.Pool (max 4) for alwrity DB — separate from open_seo pool, sized small since only reads clients table"
  - "UUID regex validation before DB round-trip — rejects garbage without incurring DB cost (T-06-04)"
  - "SELECT id FROM clients WHERE id = $1 AND is_archived = false — filters archived clients at query level"
  - "Missing X-Client-ID header returns null (not an error) — not all routes require client context"
  - "ALWRITY_DATABASE_URL added to both REQUIRED_ENV_CORE and REQUIRED_ENV_HOSTED for fail-fast startup (T-06-05)"
metrics:
  duration_minutes: 2
  completed_date: "2026-04-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 6 Plan 01: Client-Context Library Summary

**One-liner:** Dedicated `pg.Pool` for the alwrity DB + `resolveClientId()` helper that validates `X-Client-ID` header against `alwrity.clients` with UUID-first rejection, returning `string | null` or throwing `AppError("FORBIDDEN")`.

## What Was Built

### Task 1: Alwrity DB pool + env validation
- Created `open-seo-main/src/server/lib/alwrity-db.ts` — a dedicated `pg.Pool` instance using `ALWRITY_DATABASE_URL`, sized at `max: 4` (read-only client lookup, low throughput).
- Extended `REQUIRED_ENV_CORE` and `REQUIRED_ENV_HOSTED` in `runtime-env.ts` with `ALWRITY_DATABASE_URL`. The existing `validateEnv(REQUIRED_ENV_CORE)` call in `src/server.ts` and `src/worker-entry.ts` now enforces fail-fast startup without any code changes to those files.
- Documented `ALWRITY_DATABASE_URL` in `open-seo-main/.env.example` (local dev value) and `.env.vps.example` (VPS value with `${ALWRITY_DB_PASSWORD}` placeholder).

### Task 2: Client-context resolver
- Created `open-seo-main/src/server/lib/client-context.ts` exporting:
  - `CLIENT_ID_HEADER = "x-client-id"` — canonical header name constant.
  - `resolveClientId(headers: Headers): Promise<string | null>` — the resolver function.
- Logic: absent header → `null`; malformed UUID → `AppError("FORBIDDEN")`; valid UUID not in `clients` or archived → `AppError("FORBIDDEN")`; valid UUID in active clients → return UUID string.
- Created `client-context.test.ts` with 5 unit tests covering all branches (absent, malformed, valid-found, valid-not-found, header case insensitivity). All 5 pass.

## Commits

| Repo | Hash | Message |
|------|------|---------|
| open-seo-main | `219a26e` | feat(06-01): create alwrity-db pool + extend env validation |
| open-seo-main | `026b514` | feat(06-01): add client-context resolver — X-Client-ID → client_id | null |
| main | `2667178` | feat(06-01): add ALWRITY_DATABASE_URL to .env.vps.example |

## Threat Model Coverage

All 5 threats from the plan's STRIDE register are mitigated:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-06-01 Spoofing (X-Client-ID) | UUID regex + DB existence check before any data access |
| T-06-02 Tampering (SQL injection) | Parameterized query `$1` only — no string interpolation |
| T-06-03 Info disclosure (clients table) | `SELECT id` only — name/email never read or echoed |
| T-06-04 DoS (spammed bad IDs) | UUID regex rejects malformed input before DB round-trip; pool `connectionTimeoutMillis: 10_000` |
| T-06-05 EoP (missing env var) | `ALWRITY_DATABASE_URL` in `REQUIRED_ENV_CORE` → fail-fast on startup |

## Deviations from Plan

None — plan executed exactly as written. The `is_archived = false` filter in the SQL was already specified in the plan's code sample and was applied.

## Known Stubs

None — all exports are fully implemented and tested.

## Self-Check: PASSED

- `open-seo-main/src/server/lib/alwrity-db.ts` — exists, exports `alwrityPool`
- `open-seo-main/src/server/lib/client-context.ts` — exists, exports `resolveClientId` and `CLIENT_ID_HEADER`
- `open-seo-main/src/server/lib/client-context.test.ts` — exists, 5/5 tests pass
- `open-seo-main/src/server/lib/runtime-env.ts` — contains `ALWRITY_DATABASE_URL` in both `REQUIRED_ENV_CORE` and `REQUIRED_ENV_HOSTED` (count: 2)
- `open-seo-main/.env.example` — contains `ALWRITY_DATABASE_URL`
- `.env.vps.example` — contains `ALWRITY_DATABASE_URL`
- `pnpm exec tsc --noEmit` in open-seo-main — exits 0
- Commits `219a26e`, `026b514` (open-seo-main), `2667178` (main) — verified in git log
