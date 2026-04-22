---
phase: 31-site-connection
plan: 04
subsystem: site-connections
tags: [api, routes, connections, platform-detection]
dependency_graph:
  requires:
    - 31-01 (ConnectionService, PlatformDetector services)
    - 31-03 (Platform adapters)
  provides:
    - REST API endpoints for site connection CRUD
    - Platform detection API endpoint
  affects:
    - apps/web proxy routes (31-02)
tech_stack:
  added: []
  patterns:
    - TanStack Start createFileRoute with server.handlers
    - Zod schema validation for request bodies
key_files:
  created:
    - open-seo-main/src/routes/api/connections/index.ts
    - open-seo-main/src/routes/api/connections/$id.ts
    - open-seo-main/src/routes/api/connections/$id.verify.ts
    - open-seo-main/src/routes/api/detect-platform.ts
  modified: []
decisions:
  - Used TanStack Start createFileRoute pattern for API routes (consistent with existing schedules routes)
  - Zod validation on all request inputs per threat model T-31-10
  - Generic error messages in responses, detailed logging server-side per T-31-12
metrics:
  duration_seconds: 236
  completed: 2026-04-22T19:52:00Z
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 0
---

# Phase 31 Plan 04: open-seo-main API Routes Summary

REST API endpoints for site connections CRUD and platform detection in TanStack Start backend.

## One-Liner

TanStack Start API routes exposing ConnectionService and PlatformDetector as REST endpoints.

## What Was Built

### API Endpoints Created

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/connections` | GET | List connections for a client (query: clientId) |
| `/api/connections` | POST | Create new connection with encrypted credentials |
| `/api/connections/:id` | GET | Get single connection by ID |
| `/api/connections/:id` | DELETE | Delete connection |
| `/api/connections/:id/verify` | POST | Verify connection credentials |
| `/api/detect-platform` | POST | Detect CMS platform from domain |

### Files Created

1. **`open-seo-main/src/routes/api/connections/index.ts`**
   - GET handler: Lists connections for clientId
   - POST handler: Creates connection with Zod-validated input

2. **`open-seo-main/src/routes/api/connections/$id.ts`**
   - GET handler: Returns single connection (404 if not found)
   - DELETE handler: Removes connection (204 on success)

3. **`open-seo-main/src/routes/api/connections/$id.verify.ts`**
   - POST handler: Verifies connection and updates status

4. **`open-seo-main/src/routes/api/detect-platform.ts`**
   - POST handler: Multi-probe platform detection

## Commits

| Hash | Type | Description |
|------|------|-------------|
| af4cd76 | feat | Connection CRUD API routes (GET, POST, DELETE, verify) |
| 333f651 | feat | Platform detection API route |
| 80fb18a | fix | Correct z.record signature for Zod validation |

## Integration Points

- **Upstream**: ConnectionService and PlatformDetector from Phase 31-01/31-03
- **Downstream**: apps/web proxy routes (31-02) call these endpoints

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod z.record() signature**
- **Found during:** Task 3 verification
- **Issue:** `z.record(z.unknown())` needs 2 arguments in current Zod version
- **Fix:** Changed to `z.record(z.string(), z.unknown())` matching codebase patterns
- **Files modified:** `open-seo-main/src/routes/api/connections/index.ts`
- **Commit:** 80fb18a

## Verification

```bash
# Route files exist
ls open-seo-main/src/routes/api/connections/*.ts open-seo-main/src/routes/api/detect-platform.ts
# Returns 4 files

# TypeScript check (no errors in new files)
pnpm --filter open-seo-main tsc --noEmit 2>&1 | grep -E "(connections|detect-platform)"
# No output = no errors in new files
```

## Security Considerations

- T-31-10 (Tampering): Zod schema validation on all request inputs
- T-31-12 (Information Disclosure): Generic error messages returned, detailed logs server-side
- Credentials never returned in API responses (ConnectionService strips them)

## Self-Check: PASSED

- [x] `open-seo-main/src/routes/api/connections/index.ts` exists
- [x] `open-seo-main/src/routes/api/connections/$id.ts` exists
- [x] `open-seo-main/src/routes/api/connections/$id.verify.ts` exists
- [x] `open-seo-main/src/routes/api/detect-platform.ts` exists
- [x] Commit af4cd76 exists
- [x] Commit 333f651 exists
- [x] Commit 80fb18a exists
