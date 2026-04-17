---
phase: 7
plan: "07-01"
title: "open-seo query param client_id fallback"
subsystem: open-seo-main / server
tags: [auth, client-context, shell-integration, iframe, url-params]
completed: "2026-04-17T19:17:24Z"

dependency_graph:
  requires: []
  provides: [SHELL-04-server-side]
  affects:
    - open-seo-main/src/server/lib/client-context.ts
    - open-seo-main/src/serverFunctions/middleware.ts

tech_stack:
  added: []
  patterns:
    - "URL query param fallback after header-based resolution (header wins)"
    - "try/catch around new URL() for malformed URL tolerance"

key_files:
  modified:
    - open-seo-main/src/server/lib/client-context.ts
    - open-seo-main/src/server/lib/client-context.test.ts
    - open-seo-main/src/serverFunctions/middleware.ts

decisions:
  - "Header (X-Client-ID) takes precedence over URL query param; URL is fallback only — preserves existing API contract"
  - "Malformed URL string caught silently (returns null) rather than throwing 500 — aligns with T-07-04 threat mitigation"
  - "Error message generalized from 'Invalid X-Client-ID header' to 'Invalid client_id' since source may be either header or query param"

metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_modified: 3
---

# Phase 7 Plan 01: open-seo Query Param client_id Fallback — Summary

**One-liner:** Extended `resolveClientId()` with optional `url?: string` argument that reads `?client_id=` query param as fallback when `X-Client-ID` header is absent, enabling cross-origin iframe client context passing (SHELL-04).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend resolveClientId with URL fallback | d68d8a3 | client-context.ts, client-context.test.ts |
| 2 | Wire request URL into both middlewares | 5d576fa | middleware.ts |

## What Was Built

### Task 1: resolveClientId signature extension

- Added `CLIENT_ID_QUERY_PARAM = "client_id"` constant alongside `CLIENT_ID_HEADER`
- Updated `resolveClientId(headers, url?)` signature — backwards compatible (url is optional)
- When `X-Client-ID` header is absent and `url` is provided, reads `client_id` from URL search params via `new URL(url).searchParams.get(CLIENT_ID_QUERY_PARAM)`
- Malformed URL strings caught in try/catch and treated as no-signal (null), never throws 500
- Header takes strict precedence — if both header and URL param present, header UUID is used
- Error message updated from "Invalid X-Client-ID header" to "Invalid client_id" (source-agnostic)
- Updated JSDoc to document new URL-fallback behavior and SHELL-04 / threat model references
- 6 new test cases added (TDD — RED then GREEN):
  - resolves null when neither header nor URL carries client_id
  - resolves client_id from URL query param when header absent
  - throws FORBIDDEN when URL query param is malformed
  - throws FORBIDDEN when URL query param is unknown UUID
  - header wins when both header and URL param are present
  - tolerates malformed URL string without throwing

### Task 2: Middleware call site updates

- Both `requireAuthenticatedContext` and `requireProjectContext` destructure `url` from `getRequest()`
- Both pass `url` as second argument to `resolveClientId(headers, url)`
- Updated comments to reference `SHELL-04` alongside `AUTH-03`
- `pnpm tsc --noEmit` passes with zero errors

## Verification Results

- `pnpm vitest run src/server/lib/client-context.test.ts` — 11/11 tests pass
- `pnpm tsc --noEmit` — zero TypeScript errors
- `grep -n "client_id" open-seo-main/src/server/lib/client-context.ts` — shows both header + query-param paths
- `grep -cn "resolveClientId(headers, url)" middleware.ts` — returns 2 (both call sites updated)
- No remaining single-argument `resolveClientId(headers)` calls in `src/`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — implementation is fully wired. The URL fallback path is reachable in production through the updated middleware call sites.

## Threat Flags

No new security surface introduced beyond what the plan's threat model already covers.
All four STRIDE threats (T-07-01 through T-07-04) from the plan are mitigated as specified:
- T-07-01: UUID regex gate applied to both header and query param sources
- T-07-02: Parameterized SELECT id query (unchanged from Phase 6)
- T-07-03: Still gated by Clerk session upstream (no change to ensureUserMiddleware)
- T-07-04: try/catch around new URL() prevents malformed-URL 500 errors

## Self-Check: PASSED

- [x] `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/client-context.ts` — exists and modified
- [x] `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/client-context.test.ts` — exists and modified
- [x] `/home/dominic/Documents/TeveroSEO/open-seo-main/src/serverFunctions/middleware.ts` — exists and modified
- [x] Commit d68d8a3 exists in open-seo-main git log
- [x] Commit 5d576fa exists in open-seo-main git log
