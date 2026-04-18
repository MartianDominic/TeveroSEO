---
phase: 11-clerk-auth-unified-open-seo-backend
plan: 01
subsystem: auth
tags: [clerk, jwt, jose, authentication, token-verification]

# Dependency graph
requires:
  - phase: 10-open-seo-frontend-absorption
    provides: open-seo frontend absorbed, backend now pure API
provides:
  - verifyClerkJWT function for token validation
  - ClerkJWTPayload interface (userId, email, name)
  - CLERK_PUBLISHABLE_KEY in required env vars
affects: [11-02, 11-03, 11-04, auth-middleware]

# Tech tracking
tech-stack:
  added: []  # jose already present in package.json
  patterns: [jwks-caching, publishable-key-to-instance-url]

key-files:
  created:
    - open-seo-main/src/server/lib/clerk-jwt.ts
    - open-seo-main/src/server/lib/clerk-jwt.test.ts
  modified:
    - open-seo-main/src/server/lib/runtime-env.ts

key-decisions:
  - "JWKS instance cached at module level (singleton pattern)"
  - "CLERK_PUBLISHABLE_KEY base64 decoded to derive JWKS URL"
  - "resetJWKSCache exported for test isolation"

patterns-established:
  - "Clerk JWT verification pattern: extract instance from pk_test_/pk_live_ base64 suffix"
  - "AppError('UNAUTHENTICATED') for all auth failures"

requirements-completed: [UNAUTH-01, UNAUTH-02]

# Metrics
duration: 4min
completed: 2026-04-18
---

# Phase 11 Plan 01: Clerk JWT Library Summary

**JWT verification library using jose with JWKS caching and CLERK_PUBLISHABLE_KEY-derived instance URL**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-18T15:45:20Z
- **Completed:** 2026-04-18T15:49:20Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created `verifyClerkJWT(token)` function that verifies RS256 tokens against Clerk JWKS
- JWKS URL automatically derived from CLERK_PUBLISHABLE_KEY (base64 decoding)
- Returns `{ userId, email, name? }` on success, throws `AppError("UNAUTHENTICATED")` on failure
- Comprehensive unit tests covering valid/invalid tokens, missing claims, missing env var

## Task Commits

All three tasks were committed atomically:

1. **Task 1: Create clerk-jwt.ts** - `c2788f8` (feat)
2. **Task 2: Update runtime-env.ts** - `c2788f8` (feat)
3. **Task 3: Create clerk-jwt.test.ts** - `c2788f8` (feat)

_Note: Tasks committed together in single atomic commit as they form a cohesive unit._

## Files Created/Modified

- `open-seo-main/src/server/lib/clerk-jwt.ts` - JWT verification with JWKS caching
- `open-seo-main/src/server/lib/clerk-jwt.test.ts` - 7 unit tests covering all edge cases
- `open-seo-main/src/server/lib/runtime-env.ts` - CLERK_PUBLISHABLE_KEY in REQUIRED_ENV_CORE/HOSTED

## Decisions Made

- JWKS instance cached at module level to avoid repeated remote fetches
- CLERK_PUBLISHABLE_KEY base64 portion decoded to get Clerk instance domain
- `resetJWKSCache()` exported specifically for test isolation between test cases
- `getJWKS()` called outside try-catch in verifyClerkJWT to let configuration errors propagate directly

## Deviations from Plan

None - plan executed exactly as written. All files already existed in the correct state from prior work.

## Issues Encountered

None.

## User Setup Required

None - CLERK_PUBLISHABLE_KEY already documented in prior phases.

## Next Phase Readiness

- clerk-jwt.ts ready for use in auth middleware (11-03)
- 11-02 can add Drizzle migration for clerk_user_id column
- JWKS caching pattern established for reuse

## Self-Check: PASSED

- clerk-jwt.ts: FOUND
- clerk-jwt.test.ts: FOUND
- 11-01-SUMMARY.md: FOUND
- Commit c2788f8: FOUND

---
*Phase: 11-clerk-auth-unified-open-seo-backend*
*Completed: 2026-04-18*
