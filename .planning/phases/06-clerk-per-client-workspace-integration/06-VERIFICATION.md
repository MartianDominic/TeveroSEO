# Phase 6 Verification

**Phase Goal:** open-seo-main authenticates requests and scopes all audit/keyword data by `client_id` from AI-Writer's client registry.
**Verified:** 2026-04-17

## Overall Result: PASS

## Success Criteria

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | AUTH-01: 401 for unauthed requests | PASS | `resolveHostedContext` throws `AppError("UNAUTHENTICATED")` when `getAuth().api.getSession()` returns no valid session (`hosted.ts:18`). `ensureUserMiddleware` is registered as `globalServerFunctionMiddleware` which is wired as `functionMiddleware` in `start.ts:5`. All server functions go through this path. |
| 2 | AUTH-02: userId/orgId in all API routes | PASS | `EnsuredUserContext` (`{ userId, userEmail, organizationId }`) is set by `resolveHostedContext` and validated via `ensuredUserContextSchema` in `serverFunctions/middleware.ts`. All server functions using `requireProjectContext` or `requireAuthenticatedContext` receive these three fields in `context`. |
| 3 | AUTH-03: X-Client-ID validated against alwrity.clients | PASS | `src/server/lib/client-context.ts` reads `x-client-id` header, applies UUID regex, queries `SELECT id FROM clients WHERE id = $1 AND is_archived = false LIMIT 1` against `alwrityPool` (`alwrity-db.ts`). Pool is created from `ALWRITY_DATABASE_URL`. `resolveClientId` is called in both `requireProjectContext` and `requireAuthenticatedContext` middleware, injecting `clientId` into context. Invalid/unknown headers throw `AppError("FORBIDDEN")`; absent header returns `null` (allowed). |
| 4 | AUTH-04: audit data scoped by client_id | PASS | `audits` table has nullable `client_id` column (`app.schema.ts:121`) with composite index `audits_client_id_started_at_idx`. Migration `drizzle/0001_audits_client_id.sql` applies `ALTER TABLE "audits" ADD COLUMN "client_id" text` and creates the index. `AuditRepository.createAudit` persists `clientId: data.clientId ?? null`. `AuditRepository.getAuditsByProject` filters `eq(audits.clientId, opts.clientId)` when `opts.clientId` is provided. `AuditService.startAudit` accepts and passes `clientId`. `audit.ts` server function passes `context.clientId` to `startAudit` and enforces a mismatch guard in `getAuditHistory` (`audit.ts:69-70`). |

## Key Files Verified

| File | Status | Notes |
|------|--------|-------|
| `open-seo-main/src/server/lib/client-context.ts` | Present, substantive | UUID validation + parameterized DB query + archived-client guard |
| `open-seo-main/src/server/lib/alwrity-db.ts` | Present, substantive | `pg.Pool` with `max: 4`, throws on missing `ALWRITY_DATABASE_URL` at module load |
| `open-seo-main/src/db/app.schema.ts` | Present, substantive | `clientId: text("client_id")` on `audits`, plus `audits_client_id_started_at_idx` index |
| `open-seo-main/drizzle/0001_audits_client_id.sql` | Present | `ALTER TABLE "audits" ADD COLUMN "client_id" text` + index |
| `open-seo-main/src/serverFunctions/middleware.ts` | Present, substantive | `requireProjectContext` and `requireAuthenticatedContext` both call `resolveClientId(headers)` and pass result into context |
| `open-seo-main/src/server/features/audit/services/AuditService.ts` | Present, substantive | `startAudit` accepts `clientId?: string \| null`, passes to `createAudit`; `getHistory` accepts `{ clientId }` opts |
| `open-seo-main/src/server/features/audit/repositories/AuditRepository.ts` | Present, substantive | `createAudit` persists `clientId`; `getAuditsByProject` conditionally filters by `clientId` |
| `open-seo-main/src/middleware/ensureUser.ts` | Present, substantive | `ensureUserMiddleware` dispatches to `resolveHostedContext` in hosted mode; throws `UNAUTHENTICATED` on missing session |
| `.env.vps.example` | Present | `ALWRITY_DATABASE_URL` documented with inline comment referencing AUTH-03 |
| `open-seo-main/src/server/lib/runtime-env.ts` | Present, substantive | `ALWRITY_DATABASE_URL` in both `REQUIRED_ENV_HOSTED` and `REQUIRED_ENV_CORE` |

## Notes

- The `UNAUTHENTICATED` error code surfaces as a 401 HTTP response through TanStack Start's server-function transport layer. The client-side route `_app/index.tsx:62` and `_project/p/$projectId/route.tsx:16` both handle `UNAUTHENTICATED` by redirecting to sign-in, confirming the code is propagated correctly end-to-end.
- `ALWRITY_DATABASE_URL` is validated at server startup via `validateEnv(REQUIRED_ENV_CORE)` in `server.ts:8`, meaning a missing var causes an immediate crash rather than a runtime failure on the first authenticated request.
- `alwrity-db.ts` also throws unconditionally at module load time if `ALWRITY_DATABASE_URL` is absent, providing a second fail-fast layer.
- `getAuditsByProject` with no `clientId` returns all audits for the project (unscoped), consistent with the context requirement that audits without `client_id` are accessible to authenticated users.
- Tests for `client-context.ts` exist at `src/server/lib/client-context.test.ts` and cover the FORBIDDEN-on-malformed-UUID and FORBIDDEN-on-unknown-UUID paths.
