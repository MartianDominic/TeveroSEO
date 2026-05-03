---
phase: 66-platform-unification
plan: 04
subsystem: ui
tags: [react, wizard, hooks, testing-library, vitest, shadcn-ui]

# Dependency graph
requires:
  - phase: 66-03
    provides: CMS detection API endpoints and platform detection logic
provides:
  - Multi-step connection wizard UI with state management
  - URL input, platform detection, and connection choice screens
  - Platform-specific step-by-step installation guides
  - API client for connection wizard endpoints
affects: [66-05, 66-06, 66-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Wizard state machine with useCallback transitions
    - API client pattern with typed error handling
    - Component testing with @testing-library/react

key-files:
  created:
    - apps/web/src/hooks/use-connection-wizard.ts
    - apps/web/src/lib/api/connect.ts
    - apps/web/src/components/connect/url-input.tsx
    - apps/web/src/components/connect/platform-detected.tsx
    - apps/web/src/components/connect/connection-choice.tsx
    - apps/web/src/components/connect/platform-guide.tsx
    - apps/web/src/components/connect/step-indicator.tsx
    - apps/web/src/app/connect/page.tsx
  modified: []

key-decisions:
  - "Used useState + useCallback for wizard state instead of useReducer for simpler debugging"
  - "Wizard state machine has 9 steps: url, detecting, choice, diy, developer, oauth, verifying, success, error"
  - "API client uses fetch with ConnectApiError class for typed error handling"
  - "Guide step code uses user's siteId from snippet prop for personalization"

patterns-established:
  - "Connection wizard pattern: State machine hook manages transitions, container page renders appropriate screen"
  - "API client pattern: Typed methods returning parsed JSON, throwing ConnectApiError on failure"
  - "Component testing pattern: Test user interactions, not implementation details"

requirements-completed: [P66-WIZARD-UI, P66-USER-JOURNEY]

# Metrics
duration: 45min
completed: 2026-05-03
---

# Phase 66 Plan 04: Connection Wizard UI Summary

**Multi-step connection wizard with URL input, CMS detection display, path choice, and platform-specific step-by-step guides using wizard state machine hook**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-03T10:37:00Z (estimated)
- **Completed:** 2026-05-03T11:22:34Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Wizard state hook manages all 9 steps with proper transitions
- URL input screen with https:// prefix and validation
- Platform detection screen with progress bar and feature badges
- Connection choice screen with DIY, Developer Handoff, and OAuth paths
- Platform guide with step-by-step instructions, screenshots, and copy-able code snippets
- 139 tests passing across 11 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create wizard state hook and API client** - `c5a1b240d` (feat)
2. **Task 2: Build wizard screens (URL input, detection, choice)** - `000bb7e85` (feat)
3. **Task 3: Build platform guide component** - `06f9e0c31` (test)

## Files Created/Modified
- `apps/web/src/hooks/use-connection-wizard.ts` - Central state management for wizard flow
- `apps/web/src/lib/api/connect.ts` - API client for detect, guide, verify, installation endpoints
- `apps/web/src/components/connect/url-input.tsx` - Screen 1: Website URL input
- `apps/web/src/components/connect/platform-detected.tsx` - Screen 2: Detection results display
- `apps/web/src/components/connect/connection-choice.tsx` - Screen 3: Path selection cards
- `apps/web/src/components/connect/platform-guide.tsx` - Screen 4: Step-by-step guide with screenshots
- `apps/web/src/components/connect/step-indicator.tsx` - Progress dots indicator
- `apps/web/src/components/connect/index.ts` - Barrel exports for connect components
- `apps/web/src/app/connect/page.tsx` - Wizard container page

## Decisions Made
- Used useState + useCallback instead of useReducer for wizard state (simpler debugging, no action type boilerplate)
- Wizard has 9 discrete steps covering all user paths (DIY, developer handoff, OAuth)
- API client throws typed ConnectApiError for consistent error handling
- Guide component accepts snippet prop to personalize code blocks with user's siteId
- Copy button shows "Copied!" feedback for 2 seconds using setTimeout

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Test double-call issue: mockResolvedValueOnce was consumed by first call, second call failed. Fixed by using mockResolvedValue for tests that make multiple calls.
- Connection choice multiple text matches: "I'll do it myself" appeared in multiple places. Fixed by using getAllByText instead of getByText.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wizard UI complete, ready for 66-05 (Developer Handoff) integration
- Verification screen needed in 66-06 to complete the flow
- All connection paths (DIY, developer, OAuth) have UI foundations

## Self-Check: PASSED

All files verified to exist:
- apps/web/src/hooks/use-connection-wizard.ts
- apps/web/src/lib/api/connect.ts
- apps/web/src/components/connect/url-input.tsx
- apps/web/src/components/connect/platform-detected.tsx
- apps/web/src/components/connect/connection-choice.tsx
- apps/web/src/components/connect/platform-guide.tsx
- apps/web/src/components/connect/step-indicator.tsx
- apps/web/src/app/connect/page.tsx

All commits verified:
- c5a1b240d (Task 1)
- 000bb7e85 (Task 2)
- 06f9e0c31 (Task 3)

---
*Phase: 66-platform-unification*
*Completed: 2026-05-03*
