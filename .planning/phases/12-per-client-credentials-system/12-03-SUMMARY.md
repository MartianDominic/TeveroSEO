---
phase: 12-per-client-credentials-system
plan: 03
subsystem: ui
tags: [next.js, oauth, clerk, tailwind, server-actions, magic-link]

# Dependency graph
requires:
  - phase: 12-02
    provides: ClientOAuthService, API router, TypeScript types for OAuth connections
provides:
  - Public magic link landing page at /connect/[token]
  - OAuth success confirmation page at /connect/success
  - Authenticated connections dashboard at /clients/[id]/connections
  - API client utilities for OAuth endpoints (fetchConnections, createInvite, revokeConnection)
affects: [12-04, 13-analytics-data-layer]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-actions-for-backend-calls, public-route-pattern]

key-files:
  created:
    - apps/web/src/lib/clientOAuth.ts
    - apps/web/src/app/connect/[token]/page.tsx
    - apps/web/src/app/connect/success/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx
  modified: []

key-decisions:
  - "Public invite validation uses direct fetch (no auth header); authenticated calls use Clerk JWT via server actions"
  - "Provider cards rendered for all 5 providers (Google, Bing, WordPress, Shopify, Wix) with availability flags"
  - "Google OAuth URL constructed from NEXT_PUBLIC_AI_WRITER_URL environment variable for client-side redirect"

patterns-established:
  - "Public route pattern: /connect/* pages use direct server-side fetch without Clerk auth"
  - "Toast notification pattern: local state with auto-dismiss timer (3s)"
  - "Connection status: StatusChip with 'connected' or 'draft' status"

requirements-completed: [CREDS-06, CREDS-08, CREDS-09, CREDS-13]

# Metrics
duration: 45min
completed: 2026-04-19
---

# Phase 12 Plan 03: Next.js OAuth Connection UI Summary

**Magic link landing page, OAuth success confirmation, and connections dashboard with provider status cards**

## Performance

- **Duration:** 45 min
- **Started:** 2026-04-19T10:00:00Z
- **Completed:** 2026-04-19T10:45:00Z
- **Tasks:** 5 (4 auto + 1 human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- Public magic link page at /connect/[token] validates invite tokens and shows Connect with Google button
- OAuth success confirmation at /connect/success provides clear completion message
- Connections dashboard at /clients/[id]/connections shows all 5 provider cards with status, properties, and action buttons
- API client utilities (clientOAuth.ts) wrap backend calls with proper auth handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create API client utilities for OAuth** - `db06a363` (feat)
2. **Task 2: Create magic link landing page** - `13f20df5` (feat)
3. **Task 3: Create OAuth success page** - `fb4b4f88` (feat)
4. **Task 4: Create connections dashboard page** - `3c8302f3` (feat)
5. **TypeScript fix: Prefix unused provider param** - `97b58dba` (fix)

## Files Created/Modified

- `apps/web/src/lib/clientOAuth.ts` - Server actions for OAuth API calls (fetchConnections, createInvite, revokeConnection, validateInvite, getGoogleOAuthUrl)
- `apps/web/src/app/connect/[token]/page.tsx` - Public magic link landing page with token validation and Google OAuth button
- `apps/web/src/app/connect/success/page.tsx` - Static success confirmation page with checkmark icon
- `apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx` - Authenticated dashboard with provider cards, status chips, and action handlers

## Decisions Made

- **Public vs authenticated fetch:** validateInvite uses plain fetch without auth headers (public endpoint); fetchConnections/createInvite/revokeConnection use Clerk JWT via authHeader() helper
- **Provider availability:** Google marked as available=true; Bing, WordPress, Shopify, Wix marked as available=false with "Coming soon" message
- **OAuth redirect URL:** Uses NEXT_PUBLIC_AI_WRITER_URL environment variable to construct client-side redirect to backend OAuth flow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript unused parameter warning**
- **Found during:** Task 4 (connections dashboard)
- **Issue:** handleDirectConnect and handleSendInvite had unused `provider` parameter causing TypeScript warning
- **Fix:** Prefixed parameter with underscore (_provider) to indicate intentionally unused
- **Files modified:** apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx
- **Verification:** TypeScript compiles without warnings
- **Committed in:** 97b58dba (fix)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript hygiene fix. No scope creep.

## Issues Encountered
None - all pages rendered correctly on first verification attempt.

## User Setup Required

None - no external service configuration required. OAuth flow uses existing AI-Writer backend configuration.

## Next Phase Readiness

- Magic link flow complete: agency can generate invite links, clients can self-authorize via /connect/[token]
- Connections dashboard ready: shows provider status for each client
- Plan 04 can proceed: Migration script for per-user SQLite credentials to per-client PostgreSQL
- Backend OAuth callback must redirect to /connect/success for full flow completion

## Self-Check: PASSED

- [x] apps/web/src/lib/clientOAuth.ts - FOUND
- [x] apps/web/src/app/connect/[token]/page.tsx - FOUND
- [x] apps/web/src/app/connect/success/page.tsx - FOUND
- [x] apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx - FOUND
- [x] Commit db06a363 - FOUND
- [x] Commit 13f20df5 - FOUND
- [x] Commit fb4b4f88 - FOUND
- [x] Commit 3c8302f3 - FOUND
- [x] Commit 97b58dba - FOUND

---
*Phase: 12-per-client-credentials-system*
*Completed: 2026-04-19*
