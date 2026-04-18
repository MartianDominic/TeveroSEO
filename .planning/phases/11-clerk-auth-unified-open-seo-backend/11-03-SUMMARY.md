---
phase: 11-clerk-auth-unified-open-seo-backend
plan: 3
subsystem: auth
tags: [clerk, jwt, middleware, drizzle, bearer-token]

# Dependency graph
requires:
  - phase: 11-01
    provides: verifyClerkJWT function for JWT verification
  - phase: 11-02
    provides: clerk_user_id column on user table
provides:
  - Clerk JWT authentication middleware
  - Bearer token extraction from Authorization header
  - User lookup/creation by clerk_user_id
  - resolveUserContext function for all server functions
affects: [11-04, auth-middleware, server-functions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Bearer token extraction from Authorization header
    - User auto-creation from JWT claims on first login
    - Organization ID defaults to user ID for single-user case

key-files:
  created:
    - open-seo-main/src/middleware/ensure-user/clerk.ts
    - open-seo-main/src/middleware/ensure-user/index.ts
  modified:
    - open-seo-main/src/middleware/ensureUser.ts
  deleted:
    - open-seo-main/src/middleware/ensure-user/hosted.ts
    - open-seo-main/src/middleware/ensure-user/delegated.ts
    - open-seo-main/src/middleware/ensure-user/cloudflareAccess.ts

key-decisions:
  - "Organization ID defaults to user ID for single-user case (Clerk Organizations support deferred)"
  - "User auto-created on first JWT verification if not found by clerk_user_id"
  - "emailVerified set to true for Clerk-created users (Clerk handles email verification)"

patterns-established:
  - "Bearer token auth pattern: extract from Authorization header, verify via JWKS, lookup user"
  - "User auto-provisioning: JWT claims (sub, email, name) create user row on first request"

requirements-completed: [UNAUTH-05, UNAUTH-06]

# Metrics
duration: 2min
completed: 2026-04-18
---

# Phase 11 Plan 3: Auth Middleware Rewrite Summary

**Clerk JWT verification middleware replaces better-auth session cookies; all requests now authenticate via Bearer token**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-18T15:51:24Z
- **Completed:** 2026-04-18T15:53:42Z
- **Tasks:** 4
- **Files modified:** 6 (3 created, 1 modified, 3 deleted)

## Accomplishments

- Created clerk.ts resolver that extracts Bearer token and verifies Clerk JWT
- Implemented user lookup by clerk_user_id with auto-creation for new users
- Rewired ensure-user/index.ts to route all auth through Clerk resolver
- Removed all better-auth references from middleware layer
- Deleted deprecated hosted.ts, delegated.ts, and cloudflareAccess.ts resolvers

## Task Commits

Note: Tasks 1-3 were committed together by a previous execution:

1. **Task 1-3: Create clerk.ts, update index.ts, update ensureUser.ts** - `6da1f25` (feat)
2. **Task 4: Cleanup deprecated resolvers** - `a582adc` (chore)

## Files Created/Modified

- `open-seo-main/src/middleware/ensure-user/clerk.ts` - New Clerk JWT resolver with extractBearerToken, findOrCreateUserByClerkId, resolveClerkContext
- `open-seo-main/src/middleware/ensure-user/index.ts` - Routes all auth through Clerk resolver
- `open-seo-main/src/middleware/ensureUser.ts` - Simplified to call resolveUserContext (no auth mode switching)
- `open-seo-main/src/middleware/ensure-user/hosted.ts` - DELETED (better-auth session resolver)
- `open-seo-main/src/middleware/ensure-user/delegated.ts` - DELETED (local_noauth fixture resolver)
- `open-seo-main/src/middleware/ensure-user/cloudflareAccess.ts` - DELETED (legacy CF access resolver)

## Decisions Made

1. **Organization ID defaults to user ID** - For single-user case, organizationId equals dbUser.id. Clerk Organizations support can be added later by extracting org claims from JWT.

2. **User auto-creation on first request** - When JWT is valid but no user exists with matching clerk_user_id, a new user row is created from JWT claims (sub, email, name). emailVerified set to true since Clerk handles verification.

3. **db/index.ts unchanged** - The existing structure (importing from ./schema which re-exports both app.schema and better-auth-schema) already satisfies task 4's acceptance criteria. No modification needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - work was already partially completed by a previous execution. This execution:
1. Verified all acceptance criteria were met
2. Committed the cleanup of deprecated resolver files
3. Created this SUMMARY.md

## Next Phase Readiness

- Auth middleware fully converted to Clerk JWT
- Ready for 11-04: Remove better-auth package and all remaining references
- No blockers

## Self-Check: PASSED

- [x] 11-03-SUMMARY.md exists
- [x] Commit 6da1f25 exists (feat: rewrite auth middleware)
- [x] Commit a582adc exists (chore: remove deprecated resolvers)
- [x] clerk.ts exists
- [x] index.ts exists
- [x] hosted.ts deleted
- [x] delegated.ts deleted
- [x] cloudflareAccess.ts deleted

---
*Phase: 11-clerk-auth-unified-open-seo-backend*
*Plan: 3*
*Completed: 2026-04-18*
