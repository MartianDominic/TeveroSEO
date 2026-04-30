---
phase: 46-47-proposal-system
plan: 01
subsystem: api, ui
tags: [resend, react-email, next.js, tanstack-start, proposal, email]

# Dependency graph
requires:
  - phase: 45-data-foundation
    provides: Contract, Invoice, Onboarding, Activity schemas
provides:
  - EmailService for sending proposal emails via Resend
  - ProposalEmail React Email template
  - POST /api/proposals/:id/send endpoint
  - Proposal list page with table view and quick actions
affects: [46-02, 47-01, contracts, payments]

# Tech tracking
tech-stack:
  added: []  # resend, react-email already in package.json
  patterns: [TanStack Start API route pattern, Next.js server actions pattern]

key-files:
  created:
    - open-seo-main/src/server/features/proposals/services/EmailService.ts
    - open-seo-main/src/server/features/proposals/services/EmailService.test.ts
    - open-seo-main/src/server/features/proposals/email-templates/ProposalEmail.tsx
    - open-seo-main/src/routes/api/proposals/[id]/send.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/proposals/page.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/proposals/actions.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/proposals/components/ProposalTable.tsx
  modified: []

key-decisions:
  - "AUTH_CONFIG_MISSING error code for missing RESEND_API_KEY (allows graceful 503 response)"
  - "Rate limit 20 sends per hour per user (prevent email spam)"
  - "Status badges use STATUS_MAP with 9 proposal statuses mapped to 4 Badge variants"

patterns-established:
  - "EmailService pattern: getResendClient validates API key, buildProposalUrl uses PUBLIC_URL env"
  - "Server action pattern: validate IDs with Zod, call validateProspectOwnership, revalidatePath after mutation"

requirements-completed: [PROP-01, PROP-02]

# Metrics
duration: 7min
completed: 2026-04-30
---

# Phase 46-47 Plan 01: Email Sending and Proposal List UI Summary

**Resend email integration for proposal sending with React Email template, TanStack Start API endpoint, and Next.js proposal list page with status badges and quick actions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-30T09:55:03Z
- **Completed:** 2026-04-30T10:02:00Z
- **Tasks:** 3
- **Files created:** 7

## Accomplishments

- EmailService with Resend integration, retry logic (3 attempts with exponential backoff), and proper error handling
- ProposalEmail React Email template with Lithuanian copy for agency branding
- POST /api/proposals/:id/send endpoint with authentication, rate limiting, and status validation
- Proposal list UI with table view, 9 status badges (draft/sent/viewed/accepted/signed/paid/onboarded/declined/expired), and quick actions (Edit/Send/Resend/View)
- 5 passing tests for EmailService covering happy path, missing API key, URL construction, and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EmailService with Resend integration** - `e2fd06103` (feat)
2. **Task 2: Create proposal send API endpoint** - `dcf7b74c0` (feat)
3. **Task 3: Create proposal list UI** - `616ef7b74` (feat)

## Files Created

- `open-seo-main/src/server/features/proposals/services/EmailService.ts` - Resend email sending with retry logic
- `open-seo-main/src/server/features/proposals/services/EmailService.test.ts` - 5 unit tests for EmailService
- `open-seo-main/src/server/features/proposals/email-templates/ProposalEmail.tsx` - React Email template
- `open-seo-main/src/routes/api/proposals/[id]/send.ts` - TanStack Start POST endpoint
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposals/page.tsx` - Next.js page with Suspense
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposals/actions.ts` - Server actions for proposals
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposals/components/ProposalTable.tsx` - Client component with status badges

## Decisions Made

- Used AUTH_CONFIG_MISSING error code for missing RESEND_API_KEY to differentiate from auth errors and return 503
- Rate limited proposal sends to 20 per hour per user to prevent email spam abuse
- STATUS_MAP in ProposalTable maps 9 statuses to 4 Badge variants (default, secondary, destructive, outline)
- Used `as never` cast for router.push URLs to satisfy Next.js strict typed routes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- TypeScript error with Next.js typed routes for dynamic URLs - resolved by extracting URL to variable and casting to `never`
- Zod error type has `issues` not `errors` property - corrected in API route validation

## User Setup Required

**Environment variables needed for email sending:**
- `RESEND_API_KEY` - Get from https://resend.com/api-keys
- `RESEND_FROM_EMAIL` - Verified sender email (default: proposals@tevero.io)
- `PUBLIC_URL` - Base URL for proposal links (default: https://app.tevero.io)

## Next Phase Readiness

- EmailService ready for use by proposal resend and follow-up automation
- Proposal list page ready, links to proposal builder (existing) and preview pages
- Send API endpoint ready for frontend integration
- Missing: /api/proposals/:id/resend endpoint needed for resend functionality (currently returns 404)

## Self-Check: PASSED

All 7 created files verified present. All 3 task commits verified in git history.

---
*Phase: 46-47-proposal-system*
*Completed: 2026-04-30*
