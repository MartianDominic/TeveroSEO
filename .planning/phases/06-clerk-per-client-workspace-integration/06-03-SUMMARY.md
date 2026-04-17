---
phase: 06-clerk-per-client-workspace-integration
plan: "03"
subsystem: open-seo-main/serverFunctions + audit feature
tags: [auth, client-id, middleware, audit, security, testing]
dependency_graph:
  requires: [06-01 (resolveClientId), 06-02 (audits.clientId column)]
  provides: [AUTH-01 doc, AUTH-02 doc, AUTH-03 wiring, AUTH-04 persist+filter]
  affects:
    - open-seo-main/src/serverFunctions/middleware.ts
    - open-seo-main/src/serverFunctions/audit.ts
    - open-seo-main/src/server/features/audit/services/AuditService.ts
    - open-seo-main/src/server/features/audit/repositories/AuditRepository.ts
    - open-seo-main/src/types/schemas/audit.ts
    - open-seo-main/src/middleware/ensureUser.ts
tech_stack:
  added: []
  patterns:
    - resolveClientId called once per request in middleware (not per handler)
    - mismatch guard pattern (header clientId vs query clientId)
    - opts-object pattern for optional filter args
key_files:
  created:
    - open-seo-main/src/server/features/audit/services/AuditService.test.ts
  modified:
    - open-seo-main/src/serverFunctions/middleware.ts
    - open-seo-main/src/serverFunctions/audit.ts
    - open-seo-main/src/server/features/audit/services/AuditService.ts
    - open-seo-main/src/server/features/audit/repositories/AuditRepository.ts
    - open-seo-main/src/types/schemas/audit.ts
    - open-seo-main/src/middleware/ensureUser.ts
decisions:
  - "resolveClientId called in both requireAuthenticatedContext and requireProjectContext — consistent client scoping across all authenticated routes"
  - "mismatch guard uses data.clientId !== context.clientId (both truthy) — allows header-only or query-only usage without error"
  - "effectiveClientId = data.clientId ?? context.clientId ?? null — query-supplied takes precedence over header"
  - "getStatus/getResults/getCrawlProgress/deleteAudit left unchanged — scoped by (auditId, projectId), adding clientId filter would break pre-Phase-6 audits with NULL client_id"
  - "Redis mock added to test file to prevent REDIS_URL env error during unit test collection"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-17"
  tasks_completed: 3
  tasks_total: 4
  files_created: 1
  files_modified: 6
---

# Phase 6 Plan 03: Client-ID Wiring — Middleware + Audit Service Summary

**One-liner:** `resolveClientId` wired into both server-function middlewares; `AuditService.startAudit` persists `client_id`; `AuditService.getHistory` filters by `client_id`; mismatch guard enforces AUTH-03/04; 4 unit tests green.

## What Was Built

### Task 1: Extend middleware to resolve and expose clientId

- Added `import { getRequest } from "@tanstack/react-start/server"` and `import { resolveClientId } from "@/server/lib/client-context"` to `serverFunctions/middleware.ts`.
- `requireAuthenticatedContext`: calls `resolveClientId(headers)` and attaches `clientId` to context.
- `requireProjectContext`: calls `resolveClientId(headers)` and attaches `clientId` alongside `project` and `projectId`.
- Both middlewares propagate `AppError("FORBIDDEN")` from `resolveClientId` without swallowing it — T-06-13 mitigated.
- Added AUTH-01/AUTH-02 doc comment above `ensureUserMiddleware` in `ensureUser.ts` — documents existing behavior, zero logic change.

### Task 2: Persist + filter client_id end-to-end

- `src/types/schemas/audit.ts`: Added `clientIdField = z.string().uuid().optional()` shared field; added to `startAuditSchema` and `getAuditHistorySchema`.
- `AuditRepository.createAudit`: Added `clientId?: string | null` to input type; writes `clientId: data.clientId ?? null` to the audits row (AUTH-04).
- `AuditRepository.getAuditsByProject`: Added `opts?: { clientId?: string | null }` second arg; builds `and(eq(projectId), eq(clientId))` where clause when `opts.clientId` is truthy; falls back to `eq(projectId)` only for legacy unscoped queries.
- `AuditService.startAudit`: Added `clientId?: string | null` to input type; passes `clientId: input.clientId ?? null` to `createAudit`.
- `AuditService.getHistory`: Added `opts?: { clientId?: string | null }` second arg; passes through to repository.
- `serverFunctions/audit.ts`:
  - Added `import { AppError } from "@/server/lib/errors"`.
  - `startAudit` handler passes `clientId: context.clientId` to service.
  - `getAuditHistory` handler: added mismatch guard (throws `FORBIDDEN` when `data.clientId !== context.clientId`); computes `effectiveClientId = data.clientId ?? context.clientId ?? null`; passes to `AuditService.getHistory`.

### Task 3: AuditService unit tests

Created `AuditService.test.ts` with 4 tests covering AUTH-04 requirements:

| Test | Description | Result |
|------|-------------|--------|
| startAudit persists clientId when provided | createAudit called with `{ clientId: CLIENT_A }` | PASS |
| startAudit persists null when clientId omitted | createAudit called with `{ clientId: null }` | PASS |
| getHistory passes clientId filter to repo | getAuditsByProject called with `("proj-1", { clientId: CLIENT_A })` | PASS |
| getHistory passes no filter when omitted | getAuditsByProject called with `("proj-1", undefined)` | PASS |

Mocks: AuditRepository, auditQueue, url-policy, progress-kv, redis.

### Task 4: Human verification checkpoint (pending)

Code tasks complete. Live verification of AUTH-01..04 requires a running instance — see checkpoint details below.

## Commits

| Repo | Hash | Message |
|------|------|---------|
| open-seo-main | `c2b9c9a` | feat(06-03): wire resolveClientId into requireProjectContext + requireAuthenticatedContext; add AUTH-01/02 doc comment to ensureUser |
| open-seo-main | `5f6c17b` | feat(06-03): persist + filter client_id end-to-end — schema, repository, service, serverFn mismatch guard |
| open-seo-main | `c0ca9ee` | test(06-03): AuditService unit tests — clientId persistence and filter (AUTH-04) |

## Threat Model Coverage

| Threat | Mitigation Applied |
|--------|-------------------|
| T-06-09 Spoofing (forged session) | ensureUserMiddleware (unchanged) rejects invalid better-auth sessions with UNAUTHENTICATED |
| T-06-10 Tampering (client requests other client's audits) | getAuditHistory throws FORBIDDEN when data.clientId !== context.clientId |
| T-06-11 Info disclosure (history leaks across clients) | Repository filters WHERE client_id = $1; effective clientId derived from validated header |
| T-06-12 Repudiation (no record of audit ownership) | audits.client_id persisted at creation time via startAudit |
| T-06-13 DoS (spammed bad clientIds) | resolveClientId rejects in middleware before service work; bad IDs short-circuit with FORBIDDEN |
| T-06-14 EoP (getStatus/getResults bypass clientId) | Accepted — scoped by (auditId, projectId); documented for Phase 7 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added redis/progress-kv mocks to test file**
- **Found during:** Task 3 — test suite failed to collect because `progress-kv.ts` imports `redis.ts` which calls `getRedisUrl()` eagerly at module load time, throwing when `REDIS_URL` is absent.
- **Fix:** Added `vi.mock("@/server/lib/audit/progress-kv", ...)` and `vi.mock("@/server/lib/redis", ...)` to prevent the eager initialization from running during tests.
- **Files modified:** `AuditService.test.ts`
- **Commit:** `c0ca9ee`

## Human Verification Checkpoint (Task 4)

Task 4 is a `checkpoint:human-verify`. All code tasks (1-3) are complete and committed. The following manual verification steps need to be performed against a running instance:

**Prerequisites:**
- Docker compose running locally OR `pnpm run dev` with `DATABASE_URL`, `ALWRITY_DATABASE_URL`, `REDIS_URL` set
- At least one row in `alwrity.clients` (note UUID as `CLIENT_REAL`)
- Authenticated browser session — grab `Cookie` header as `$COOKIE`

**Step 1 — AUTH-01 (unauthenticated → UNAUTHENTICATED):**
```bash
curl -i -X POST http://localhost:3001/_serverFn/audit/getAuditHistory \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"any"}'
```
Expect: error code `UNAUTHENTICATED` (not FORBIDDEN, not INTERNAL_ERROR).

**Step 2 — AUTH-02 (authenticated → handler sees userId):**
Navigate to any project audit page in browser — confirm audit history table loads.

**Step 3 — AUTH-03 bad header (FORBIDDEN):**
```bash
curl -i -X POST http://localhost:3001/_serverFn/audit/getAuditHistory \
  -H 'Content-Type: application/json' \
  -H "Cookie: $COOKIE" \
  -H 'X-Client-ID: not-a-uuid' \
  -d '{"projectId":"<real projectId>"}'
```
Expect: `FORBIDDEN`.

**Step 4 — AUTH-03/04 happy path:**
```bash
curl -s -X POST http://localhost:3001/_serverFn/audit/getAuditHistory \
  -H 'Content-Type: application/json' \
  -H "Cookie: $COOKIE" \
  -H "X-Client-ID: $CLIENT_REAL" \
  -d '{"projectId":"<real projectId>"}' | jq .
```
Expect: array of audits (possibly empty), no error.

**Step 5 — AUTH-04 persist:**
Start audit through UI with X-Client-ID set. Then:
```bash
psql "$DATABASE_URL" -c "SELECT id, client_id FROM audits ORDER BY started_at DESC LIMIT 1;"
```
Expect: `client_id` = `$CLIENT_REAL`.

**Step 6 — AUTH-04 mismatch guard:**
```bash
curl -i -X POST http://localhost:3001/_serverFn/audit/getAuditHistory \
  -H 'Content-Type: application/json' \
  -H "Cookie: $COOKIE" \
  -H "X-Client-ID: $CLIENT_REAL" \
  -d '{"projectId":"<real projectId>","clientId":"$CLIENT_OTHER"}'
```
Expect: `FORBIDDEN` with "mismatch" message.

**Resume signal:** Type "approved" if all six steps behave as described, or describe which step failed.

## Known Stubs

None — all exports are fully implemented and tested.

## Threat Flags

None — no new network endpoints or auth paths introduced beyond what was planned.

## Self-Check: PASSED

- `open-seo-main/src/serverFunctions/middleware.ts` — contains `resolveClientId(headers)` (2 occurrences) and `clientId,`
- `open-seo-main/src/middleware/ensureUser.ts` — contains `AUTH-01` doc comment
- `open-seo-main/src/server/features/audit/repositories/AuditRepository.ts` — contains `clientId: data.clientId ?? null` and `eq(audits.clientId, opts.clientId)`
- `open-seo-main/src/server/features/audit/services/AuditService.ts` — contains `clientId?: string | null` and `clientId: input.clientId`
- `open-seo-main/src/serverFunctions/audit.ts` — contains `clientId mismatch` and `context.clientId`
- `open-seo-main/src/types/schemas/audit.ts` — contains `clientId: clientIdField`
- `open-seo-main/src/server/features/audit/services/AuditService.test.ts` — exists, 4/4 tests pass
- `pnpm exec tsc --noEmit` — exits 0
- Commits `c2b9c9a`, `5f6c17b`, `c0ca9ee` — verified in open-seo-main git log
