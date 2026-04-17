---
phase: 02-cf-bindings-removal-schema-migration
plan: "06"
subsystem: open-seo-main
tags: [drizzle-migration, postgresql, build-verification, smoke-test, typescript-fixes]
dependency_graph:
  requires: [02-02, 02-03, 02-04, 02-05]
  provides: [pg-migrations, build-verified, smoke-test-passed, ts-clean]
  affects:
    - open-seo-main/drizzle/
    - open-seo-main/drizzle/meta/
    - open-seo-main/src/server/features/audit/repositories/AuditRepository.ts
    - open-seo-main/src/server/features/audit/services/AuditService.ts
    - open-seo-main/src/server/features/keywords/repositories/KeywordResearchRepository.ts
    - open-seo-main/src/server/features/keywords/services/research/saved-keywords.ts
    - open-seo-main/src/server/features/projects/services/projects.ts
    - open-seo-main/src/server/lib/audit/types.ts
    - open-seo-main/src/serverFunctions/lighthouse.ts
    - open-seo-main/src/client/features/audit/shared.tsx
    - open-seo-main/src/client/features/audit/launch/useLaunchController.ts
    - open-seo-main/src/types/keywords.ts
    - open-seo-main/src/types/vite-env.d.ts
    - open-seo-main/src/routes/_project/p/$projectId/saved.tsx
    - open-seo-main/package.json
    - open-seo-main/pnpm-lock.yaml
tech_stack:
  added: ["@noble/ciphers@2.1.1 (direct dep override)"]
  removed: []
  patterns: [drizzle-pg-migrations, promise-all-batching, jsonb-cast-pattern, date-object-pg-timestamps]
key_files:
  created:
    - open-seo-main/drizzle/0000_init.sql
    - open-seo-main/drizzle/meta/_journal.json
    - open-seo-main/drizzle/meta/0000_snapshot.json
  modified:
    - open-seo-main/src/server/features/audit/repositories/AuditRepository.ts
    - open-seo-main/src/server/features/audit/services/AuditService.ts
    - open-seo-main/src/server/features/keywords/repositories/KeywordResearchRepository.ts
    - open-seo-main/src/server/features/keywords/services/research/saved-keywords.ts
    - open-seo-main/src/server/features/projects/services/projects.ts
    - open-seo-main/src/server/lib/audit/types.ts
    - open-seo-main/src/serverFunctions/lighthouse.ts
    - open-seo-main/src/client/features/audit/shared.tsx
    - open-seo-main/src/client/features/audit/launch/useLaunchController.ts
    - open-seo-main/src/types/keywords.ts
    - open-seo-main/src/types/vite-env.d.ts
    - open-seo-main/src/routes/_project/p/$projectId/saved.tsx
    - open-seo-main/package.json
    - open-seo-main/pnpm-lock.yaml
  deleted:
    - open-seo-main/drizzle/0000_fantastic_vanisher.sql through 0006_magical_alex_wilder.sql (7 files)
    - open-seo-main/drizzle/meta/0001_snapshot.json through 0006_snapshot.json (6 files)
decisions:
  - Replace db.batch() (D1/SQLite-only API) with Promise.all for PG compatibility
  - parseAuditConfig and parseMonthlySearches updated to accept unknown (jsonb returns object, not string)
  - AuditService.getResults explicitly maps pages to typed shape to give client components proper types
  - formatDate/formatStartedAt updated to accept Date | string — DB now returns Date, not string
  - Add @noble/ciphers@2.1.1 as direct dep to prevent Nitro from picking up system's 1.3.0
  - SavedKeywordRow.createdAt/fetchedAt type changed from string to Date to match pg schema
metrics:
  duration: "~45 minutes"
  completed: "2026-04-17"
  tasks_completed: 3
  files_modified: 14
  files_created: 3
  files_deleted: 13
---

# Phase 2 Plan 06: Drizzle Migration Regeneration + Build Verification Summary

**One-liner:** Deleted 7 SQLite migrations, regenerated a fresh PostgreSQL migration (0000_init.sql — 14 tables, native booleans, jsonb, tz timestamps), applied to a local PG instance, fixed all 49 TypeScript type mismatches introduced by the schema migration, and verified pnpm build exits 0 with node .output/server/index.mjs returning HTTP 200.

## What Was Built

This is the Phase 2 gate plan — it proves that all the schema, CF binding removal, and stub changes from Plans 02-01 through 02-05 produce a working Node.js application.

### Catch-up: Plan 02-05 code commit

The Plan 02-05 source changes (workflow stubs, filesystem R2, in-memory KV, AuditService Phase-2 stubs, server.ts Node.js entry) were present in the working tree but had not been committed to the open-seo-main repo. Committed as `5d52826` before starting Plan 02-06 tasks.

### Task 1 — Delete SQLite migrations + generate PG migration (`a09d04e`)

- Deleted 7 old SQLite `.sql` migration files (0000_fantastic_vanisher through 0006_magical_alex_wilder)
- Deleted old `drizzle/meta/` snapshots (0001–0006) and stale journal
- Ran `drizzle-kit generate --name=init` against the pg-core schema
- Output: `drizzle/0000_init.sql` — 14 CREATE TABLE statements, 22 timestamp with time zone columns, 5 jsonb columns, 3 boolean columns
- Journal updated: `"dialect": "postgresql"`, no sqlite references

Sanity checks passed:
- `ls drizzle/*.sql | wc -l` = 1
- `grep -c "CREATE TABLE" drizzle/0000_init.sql` = 14
- `grep -c "timestamp with time zone" drizzle/0000_init.sql` = 22 (>= 14 required)
- `grep -c "jsonb" drizzle/0000_init.sql` = 5
- `grep -c "boolean" drizzle/0000_init.sql` = 3
- `grep '"dialect": "postgresql"' drizzle/meta/_journal.json` exits 0

### Task 2 — Apply migrations to local PostgreSQL (no file changes)

- Started `postgres:16-alpine` container on port 5435
- `drizzle-kit migrate` against `postgres://postgres:postgres@localhost:5435/open_seo` exited 0
- Verified 14 target tables created in `public` schema
- Spot-checked: `user.email_verified` = boolean, `audits.config` = jsonb, `user.created_at` = timestamp with time zone
- Container stopped and removed

### Task 3 — TypeScript fixes + build + smoke test (`d30e86d`)

**TypeScript errors fixed (49 → 0):**

The pg-core schema migration changed column types throughout the codebase — timestamps now return `Date` (not `string`), jsonb columns return `unknown` (not `string`), and the D1-specific `db.batch()` API no longer exists on NodePgDatabase.

| Fix | Files | Description |
|-----|-------|-------------|
| `db.batch()` removal | AuditRepository.ts, KeywordResearchRepository.ts | Replaced with `Promise.all()` — NodePgDatabase has no batch API |
| `completedAt`/`fetchedAt` string→Date | AuditRepository.ts, KeywordResearchRepository.ts | `new Date().toISOString()` → `new Date()` for timestamp columns |
| config/jsonb inserts | AuditRepository.ts | `JSON.stringify(config)` → `config` directly (jsonb accepts objects) |
| parseAuditConfig accepts unknown | types.ts | jsonb returns already-parsed object, not string |
| parseMonthlySearches accepts unknown | saved-keywords.ts | Same — handles both object and legacy string |
| AuditService.getResults page mapping | AuditService.ts | Explicit map with jsonb column casts gives client correct types |
| SavedKeywordRow Date types | types/keywords.ts | createdAt/fetchedAt: string → Date |
| formatDate/formatStartedAt | shared.tsx | Accept Date\|string |
| saved.tsx fetchedAt prop | saved.tsx | Accept Date\|string\|null |
| useLaunchController Phase-2 cast | useLaunchController.ts | cast through unknown for dead code path |
| ImportMetaEnv env vars | vite-env.d.ts | Added AUTH_MODE, POSTHOG_PUBLIC_KEY, POSTHOG_HOST |
| lighthouse.ts Date→string | lighthouse.ts | startedAt.toISOString() for buildLighthouseExportFile |

**Build result:**
- `pnpm run build` exits 0
- `.output/server/index.mjs` exists (353 B entry point, 19.5 MB total)

**Runtime dependency fix:**
Nitro was copying `@noble/ciphers@1.3.0` from the system's `/home/dominic/node_modules` instead of the project's `2.1.1`. Added `@noble/ciphers@2.1.1` as a direct dependency to ensure correct version resolution. Rebuilt — output now has `2.1.1`.

**Smoke test result:**
- Started `postgres:16-alpine` on port 5437, applied migrations
- `node .output/server/index.mjs` with `DATABASE_URL`, `AUTH_MODE=local_noauth`, `PORT=3103`
- Server bound port 3103 within 2 seconds
- `GET http://localhost:3103/` → **200 OK** (full HTML response)
- BUILD-01 (build exits 0): PASS
- BUILD-02 (server starts without throwing): PASS
- BUILD-03 (GET / returns < 500): PASS
- CF-01 (no cloudflare:workers in src/): PASS (0 matches)
- CF-06 (no @cloudflare in package.json): PASS (0 matches)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan 02-05 code uncommitted to open-seo-main**
- **Found during:** Pre-task verification
- **Issue:** The open-seo-main repo had Plans 02-05 changes in the working tree but not committed
- **Fix:** Committed as `5d52826` before starting Plan 02-06 tasks
- **Files modified:** src/server.ts, SiteAuditWorkflow.ts, progress-kv.ts, r2.ts, r2-cache.ts, AuditService.ts, audit.ts, siteAuditWorkflowPhases.ts, siteAuditWorkflowCrawl.ts, workflow-types.ts

**2. [Rule 1 - Bug] 49 TypeScript type errors from schema migration**
- **Found during:** Task 3 (pnpm run build → tsc --noEmit)
- **Issue:** SQLite schema returned strings for dates; pg-core returns Date objects. jsonb columns return unknown not string. D1's db.batch() doesn't exist on NodePgDatabase.
- **Fix:** 14 files updated (see table above)
- **Commit:** `d30e86d`

**3. [Rule 1 - Bug] @noble/ciphers version mismatch in Nitro output**
- **Found during:** Task 3 smoke test (GET / → 500, `managedNonce` not exported)
- **Issue:** Nitro was bundling system's `@noble/ciphers@1.3.0` (no `managedNonce`) instead of project's `2.1.1` (which has it). Root cause: system `/home/dominic/node_modules/@noble/ciphers` shadows project's transitive dep during Nitro's output bundling.
- **Fix:** Added `@noble/ciphers@2.1.1` as a direct dep in package.json; rebuilt. Output now has `2.1.1`.
- **Commit:** `d30e86d`

## Known Stubs

The following are intentional Phase-2 stubs carried over from Plan 02-05:

| Stub | File | Reason |
|------|------|--------|
| `AuditService.startAudit` throws | AuditService.ts | BullMQ queue wired in Phase 3 |
| `SiteAuditWorkflow.run` throws | SiteAuditWorkflow.ts | BullMQ worker in Phase 3 |
| `progress-kv` in-memory Map | progress-kv.ts | ioredis replacement in Phase 3 |
| `r2.ts` filesystem | r2.ts | Shared storage in Phase 4 |
| `r2-cache.ts` filesystem | r2-cache.ts | Shared storage in Phase 4 |

Audit endpoints return "Audits are disabled until Phase 3 wires the BullMQ queue" — this is by design and does not block the plan's BUILD-01/02/03 goals.

## Threat Flags

None. Changes are confined to schema migration artifacts, TypeScript type corrections, and build verification. No new network endpoints or auth paths introduced.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| open-seo-main/drizzle/0000_init.sql | FOUND |
| grep -c "CREATE TABLE" drizzle/0000_init.sql = 14 | CONFIRMED |
| grep '"dialect": "postgresql"' drizzle/meta/_journal.json | CONFIRMED |
| open-seo-main/.output/server/index.mjs | FOUND |
| pnpm exec tsc --noEmit = 0 errors | CONFIRMED |
| GET http://localhost:3103/ = 200 | CONFIRMED |
| grep -rn "cloudflare:workers" src/ = 0 | CONFIRMED |
| grep "@cloudflare" package.json = 0 | CONFIRMED |
| commit 5d52826 (02-05 catch-up) | FOUND |
| commit a09d04e (task 1 - migrations) | FOUND |
| commit d30e86d (task 3 - TS fixes + build) | FOUND |

## Checkpoint Status

**Task 4 (human-verify) reached — awaiting human verification.**

Plan is at checkpoint:human-verify. The automated tasks (1-3) are complete and all acceptance criteria met. Task 4 requires human visual confirmation before Phase 3 can begin.
