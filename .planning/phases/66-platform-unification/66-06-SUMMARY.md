---
phase: 66-platform-unification
plan: 06
subsystem: verification-ui
tags: [verification, polling, success, error, oauth-prompt, ui]
dependency_graph:
  requires: [66-02-pixel-verification]
  provides: [verification-screen, success-screen, error-screen, manual-check, use-verification-poll]
  affects: [connection-wizard, onboarding-flow]
tech_stack:
  added: []
  patterns: [polling-hook, state-machine, confetti-celebration, tdd]
key_files:
  created:
    - apps/web/src/hooks/use-verification-poll.ts
    - apps/web/src/hooks/__tests__/use-verification-poll.test.ts
    - apps/web/src/components/connect/verification-screen.tsx
    - apps/web/src/components/connect/__tests__/verification-screen.test.tsx
    - apps/web/src/components/connect/success-screen.tsx
    - apps/web/src/components/connect/error-screen.tsx
    - apps/web/src/components/connect/__tests__/error-screen.test.tsx
    - apps/web/src/components/connect/manual-check.tsx
    - apps/web/src/components/connect/__tests__/manual-check.test.tsx
  modified:
    - apps/web/src/components/connect/index.ts
decisions:
  - AbortController cleanup on unmount for proper fetch cancellation
  - Max 5 poll attempts (2.5 min total) before showing manual check
  - canvas-confetti for success celebration (already in deps)
  - Error types: timeout, domain_mismatch, technical
  - Copy never blames user (DESIGN.md Section 9)
metrics:
  duration: 8m
  completed: 2026-05-03T11:19:30Z
---

# Phase 66 Plan 06: Verification UI Summary

Real-time verification polling UI with success celebration, error handling, and OAuth enhancement prompts.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | useVerificationPoll hook | a10a32544 | use-verification-poll.ts |
| 2 | Verification + Success screens | e79ff7ee3 | verification-screen.tsx, success-screen.tsx |
| 3 | Error + Manual check screens | 399e604e5 | error-screen.tsx, manual-check.tsx |

## Key Deliverables

### useVerificationPoll Hook

Long-poll hook for real-time pixel verification:

- **startPolling()**: Initiates polling with 30s timeout per request
- **stopPolling()**: Cancels active request via AbortController
- **checkNow()**: Single verification request (no retry)
- **status**: pending | detected | verified | error
- **location**: GeoIP city/country from verification API
- **attempts**: Tracks retry count (max 5)

### VerificationScreen

Waiting state with real-time polling:

- Pulsing dots animation while polling
- "Open my website" external link button
- Troubleshooting tips after 1+ attempts
- Auto-transitions to success on detection

Success state with celebration:

- Confetti animation via canvas-confetti
- "You're connected!" message with location
- OAuth enhancement prompt for GSC
- "Go to Dashboard" CTA

### ErrorScreen

Three error types with appropriate UX:

| Type | Heading | Actions |
|------|---------|---------|
| timeout | "We can't see the helper yet" | Retry, Send to dev, Chat |
| domain_mismatch | "Found on different website" | Retry, Add as different site |
| technical | "Something went wrong" | Retry, Chat |

### ManualCheck

Single-request verification button:

- Loading state with spinning icon
- Success/pending/error feedback
- Disabled while checking

## Test Coverage

| File | Tests | Status |
|------|-------|--------|
| use-verification-poll.test.ts | 16 | Pass |
| verification-screen.test.tsx | 15 | Pass |
| error-screen.test.tsx | 16 | Pass |
| manual-check.test.tsx | 7 | Pass |
| **Total** | **54** | **Pass** |

## Architecture Decisions

### Polling Pattern

```
startPolling() -> fetch with 30s timeout
                      |
            +---------+---------+
            |                   |
         timeout            detected
            |                   |
    attempt++ < 5?         STOP + confetti
            |
    yes -> retry
    no  -> show manual check
```

### State Machine

```
pending -> detected (on first ping)
pending -> error (on network/API error)
detected -> verified (after audit)
```

### Copy Tone

Per DESIGN.md Section 9:
- Never blame the user
- Provide clear next steps
- Easy access to help

## Verification Results

- [x] Polling starts automatically after guide completion
- [x] Detection within 10 seconds triggers success
- [x] Success screen shows visitor location
- [x] OAuth enhancement prompt displays
- [x] Error screen provides actionable troubleshooting
- [x] Manual check works when auto-detect fails
- [x] Proper cleanup on unmount
- [x] Tests achieve 80%+ coverage (54 tests)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] use-verification-poll.ts exists (322 lines)
- [x] verification-screen.tsx exists (291 lines, min 80)
- [x] success-screen.tsx exists (163 lines, min 50)
- [x] error-screen.tsx exists (255 lines)
- [x] manual-check.tsx exists (121 lines)
- [x] Commits a10a32544, e79ff7ee3, 399e604e5 verified in git log
