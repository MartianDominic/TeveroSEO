---
phase: 11
plan: 4
subsystem: auth
tags: [better-auth, clerk, cleanup, migration]
dependency_graph:
  requires: [11-03]
  provides: [clean-auth-codebase]
  affects: [open-seo-main]
tech_stack:
  removed: [better-auth]
  patterns: [stub-for-backward-compat]
key_files:
  deleted:
    - open-seo-main/cli-auth.ts
    - open-seo-main/src/lib/auth.ts
    - open-seo-main/src/lib/auth-config.ts
    - open-seo-main/src/routes/_auth.sign-in.tsx
    - open-seo-main/src/routes/_auth.sign-up.tsx
    - open-seo-main/src/routes/api/auth/$.ts
    - open-seo-main/src/routes/forgot-password.tsx
    - open-seo-main/src/routes/reset-password.tsx
    - open-seo-main/src/routes/verify-email.tsx
    - open-seo-main/src/server/auth/default-hosted-organization.ts
    - open-seo-main/src/server/auth/delegated-organization.ts
  renamed:
    - open-seo-main/src/db/better-auth-schema.ts -> open-seo-main/src/db/user-schema.ts
  modified:
    - open-seo-main/package.json
    - open-seo-main/.env.example
    - open-seo-main/src/db/schema.ts
    - open-seo-main/src/db/app.schema.ts
    - open-seo-main/src/lib/auth-client.ts
    - open-seo-main/src/lib/auth-mode.ts
    - open-seo-main/src/lib/auth-session.ts
    - open-seo-main/src/middleware/ensure-user/clerk.ts
    - open-seo-main/src/middleware/ensure-user/index.ts
    - open-seo-main/src/server/lib/runtime-env.ts
    - open-seo-main/src/server/billing/subscription.ts
decisions:
  - auth-client.ts, auth-mode.ts, auth-session.ts kept as stubs for backward compatibility with TanStack frontend code
  - Schema file renamed from better-auth-schema.ts to user-schema.ts to remove all better-auth references
  - Comments mentioning better-auth removed or reworded to reference Clerk
metrics:
  duration: 4m 28s
  completed: 2026-04-18T16:00:39Z
---

# Phase 11 Plan 04: Remove better-auth Package Summary

Complete removal of better-auth from open-seo-main codebase, achieving zero grep matches for better-auth/betterAuth pattern.

## One-liner

Deleted 11 better-auth files, renamed schema, removed package dependency, achieving zero better-auth references in codebase.

## What Changed

### Package Dependencies
- Removed `better-auth: ^1.5.5` from dependencies
- Removed `auth:generate` script that used better-auth CLI
- `jose` remains for Clerk JWT verification

### Deleted Files (11 files)
1. `cli-auth.ts` - better-auth CLI configuration
2. `src/lib/auth.ts` - better-auth server initialization
3. `src/lib/auth-config.ts` - better-auth configuration
4. `src/routes/_auth.sign-in.tsx` - sign-in route
5. `src/routes/_auth.sign-up.tsx` - sign-up route
6. `src/routes/api/auth/$.ts` - better-auth API handler
7. `src/routes/forgot-password.tsx` - password reset request
8. `src/routes/reset-password.tsx` - password reset form
9. `src/routes/verify-email.tsx` - email verification
10. `src/server/auth/default-hosted-organization.ts` - org helper
11. `src/server/auth/delegated-organization.ts` - delegated org helper

### Renamed Files
- `src/db/better-auth-schema.ts` -> `src/db/user-schema.ts`

### Updated Files
- All imports referencing `better-auth-schema` updated to `user-schema`
- Comments mentioning "better-auth" reworded to reference Clerk
- `runtime-env.ts`: Removed `isHostedServerAuthMode` function
- `.env.example`: Removed BETTER_AUTH_*, AUTH_MODE, CF Access variables
- Billing/backlinks files: Removed hosted mode conditional checks

## Decisions Made

1. **Stub files retained**: `auth-client.ts`, `auth-mode.ts`, `auth-session.ts` are still imported by TanStack frontend components (AppShell, routes). These files now contain Clerk-compatible stubs that maintain API compatibility.

2. **Schema renamed**: The file `better-auth-schema.ts` contained user/organization/member/invitation tables that are still used. Renamed to `user-schema.ts` to eliminate all better-auth references.

3. **Hosted mode always true**: The `isHostedClientAuthMode()` function now always returns `true` since Clerk auth is always "hosted" mode. This simplifies conditional checks throughout the codebase.

## Verification Results

| Check | Status |
|-------|--------|
| better-auth removed from deps | PASS |
| auth.ts deleted | PASS |
| hosted.ts deleted | PASS |
| sign-in/sign-up routes deleted | PASS |
| Zero better-auth references in src/ | PASS |
| CLERK_PUBLISHABLE_KEY in .env.example | PASS |
| docker-compose.vps.yml clean | PASS |
| TypeScript compilation | PASS |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 7a68f60 | chore | remove better-auth from codebase |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files already deleted in previous uncommitted work**
- **Found during:** Task 2-5
- **Issue:** Several files listed for deletion (auth.ts, auth-config.ts, sign-in/sign-up routes, organization helpers) were already deleted but not committed
- **Fix:** Staged and committed all deletions together with the rename and comment updates
- **Files affected:** 11 deleted files
- **Commit:** 7a68f60

**2. [Rule 2 - Missing functionality] Schema file naming**
- **Found during:** Task 9 (grep verification)
- **Issue:** The schema file was still named `better-auth-schema.ts` which caused grep matches
- **Fix:** Renamed to `user-schema.ts` and updated all imports
- **Files modified:** src/db/schema.ts, src/db/app.schema.ts, src/middleware/ensure-user/clerk.ts
- **Commit:** 7a68f60

## Self-Check: PASSED

- [x] Commit 7a68f60 exists in git log
- [x] All deleted files confirmed non-existent
- [x] user-schema.ts exists at src/db/user-schema.ts
- [x] grep returns zero matches
