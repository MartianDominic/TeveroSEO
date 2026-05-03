---
phase: 68
plan: 01
subsystem: auth
tags: [security, jwt, clerk, integration]
dependency_graph:
  requires: [67-03]
  provides: [clerk-verify, jwt-validation]
  affects: [client-context, api-routes]
tech_stack:
  added: ["@clerk/backend"]
  patterns: [jwt-validation, timing-safe-comparison]
key_files:
  created:
    - open-seo-main/src/server/lib/clerk-verify.ts
  modified:
    - open-seo-main/src/server/lib/client-context.ts
    - open-seo-main/src/server/lib/client-context.test.ts
    - open-seo-main/package.json
decisions:
  - Reuse existing verifyClerkJWT (jose-based) rather than duplicate with @clerk/backend
  - Add resolveClientContext() as primary API, deprecate resolveClientId()
  - Service user ID "service:internal" for internal service token bypass
metrics:
  duration: 5m
  completed: 2026-05-03T21:59:42Z
  tasks_completed: 2
  tests_added: 10
  tests_total: 21
---

# Phase 68 Plan 01: Auth Flow Fixes Summary

JWT auth with mandatory validation before trusting user identity headers.

## Completed Tasks

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Create Clerk Token Verifier | 08bb1f4 | clerk-verify.ts with verifyClerkToken, extractBearerToken |
| 2 | Update Client Context Resolution | 624af65 | JWT validation required, forged headers rejected |

## Key Deliverables

### clerk-verify.ts (New)

```typescript
export interface ClerkClaims {
  userId: string;
  orgId?: string;
  sessionId?: string;
  email: string;
}

export async function verifyClerkToken(token: string): Promise<ClerkClaims>
export function extractBearerToken(authHeader: string | null): string | null
export async function verifyRequestToken(request: Request): Promise<ClerkClaims>
```

### client-context.ts (Modified)

```typescript
export interface ResolvedContext {
  userId: string;
  clientId: string;
  orgId?: string;
}

// New primary API - requires JWT validation
export async function resolveClientContext(request: Request): Promise<ResolvedContext>

// Legacy - now also requires JWT (deprecated)
export async function resolveClientId(headers: Headers, url?: string): Promise<string | null>
```

## Security Improvements

| Issue | Fix | Status |
|-------|-----|--------|
| AUTH-HIGH-01 | JWT validation required before trusting headers | Fixed |
| AUTH-HIGH-02 | Forged X-User-Id without valid JWT rejected | Fixed |
| Internal bypass | Service token path preserved for service-to-service | Preserved |

## Auth Flow (After)

```
Request
  |
  v
[Internal Token?] --yes--> Timing-safe compare --> [Valid?] --yes--> Resolve client (no JWT)
  |                                                  |
  no                                                 no --> 403 FORBIDDEN
  |
  v
[Authorization Bearer?] --no--> 401 UNAUTHENTICATED
  |
  yes
  |
  v
[Verify JWT (JWKS)] --invalid--> 401 UNAUTHENTICATED
  |
  valid
  |
  v
[Resolve client ID] --> [Validate ownership] --> ResolvedContext
```

## Test Coverage

- 21 tests passing
- New tests for JWT validation (4)
- New tests for internal service token bypass (2)
- New tests for resolveClientContext (4)
- Existing tests updated with JWT mocking

## Deviations from Plan

### [Rule 2 - Missing Functionality] Reused existing clerk-jwt.ts

**Found during:** Task 1
**Issue:** Plan specified creating new @clerk/backend integration, but clerk-jwt.ts already provides equivalent JWT verification using jose library
**Fix:** Created clerk-verify.ts as a wrapper with standardized interface, reusing proven verifyClerkJWT
**Rationale:** jose is what @clerk/backend uses internally; avoiding duplicate code and potential inconsistencies
**Files:** clerk-verify.ts wraps clerk-jwt.ts

## Self-Check: PASSED

- [x] clerk-verify.ts exists: `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/clerk-verify.ts`
- [x] client-context.ts modified with JWT validation
- [x] Commit 08bb1f4 exists (Task 1)
- [x] Commit 624af65 exists (Task 2)
- [x] All tests pass (21/21)
