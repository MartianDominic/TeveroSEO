---
phase: 70-frontend-quality
plan: 03
subsystem: frontend/ux
tags: [user-journey, error-handling, navigation, loading-states]
dependency_graph:
  requires: [70-02]
  provides: [client-switch-overlay, breadcrumb-component, error-recovery-ui, help-redirects]
  affects: [shell-layout, middleware, error-utils]
tech_stack:
  added: []
  patterns: [loading-overlay, middleware-redirects, accessible-breadcrumbs]
key_files:
  created:
    - apps/web/src/components/ui/client-switch-overlay.tsx
    - apps/web/src/components/ui/breadcrumb.tsx
  modified:
    - apps/web/src/stores/clientStore.ts
    - apps/web/src/hooks/use-clients.ts
    - apps/web/src/app/(shell)/layout.tsx
    - apps/web/middleware.ts
    - apps/web/src/components/ui/error-recovery.tsx
    - apps/web/src/lib/error-utils.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/app/api/clients/route.ts
    - apps/web/src/components/shell/AppShell.tsx
decisions:
  - Minimum 300ms overlay duration prevents jarring flash on fast client switches
  - Help redirects in middleware (not pages) for external URL handling
  - Breadcrumb uses aria-current=page for accessibility
  - safeParseJsonString for strings, safeParseJson for Response objects
  - Debug-level logging for localStorage errors (expected in private browsing)
metrics:
  duration_seconds: 377
  completed_at: "2026-05-04T10:46:00Z"
  tasks_completed: 5
  files_changed: 11
---

# Phase 70 Plan 03: User Journey Fixes Summary

Full-screen loading overlay during client switching with async state management and minimum duration.

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 | feat | baa1a128d | Add client switch loading overlay |
| 2 | feat | 498d9690c | Add help/support link redirects |
| 3 | feat | 1a394ed91 | Enhance error recovery UI with Try Again, Save Draft, Get Help |
| 4 | feat | fa6e6f5d0 | Implement accessible breadcrumb component |
| 5 | fix | 777e08068 | Replace empty catch blocks with proper error handling |

## Key Deliverables

### Task 1: Client Switch Loading Overlay
- Added `isSwitching` state to clientStore for tracking transitions
- Updated `useSetActiveClient` hook with async switching and minimum 300ms duration
- Created `ClientSwitchOverlay` component with spinner, backdrop blur, and ARIA attributes
- Integrated overlay into shell layout via ThemeProvider

### Task 2: Help/Support Link Redirects
- Added `HELP_REDIRECTS` mapping for /help, /support, and subpaths
- Created `getHelpRedirect` helper with locale-prefix support (e.g., /lt/help)
- Wildcard fallback: unmapped /help/* paths redirect to docs root
- Middleware processes redirects before auth checks

### Task 3: Error Recovery UI Enhancement
- Extended `FormErrorRecovery` with `onSaveDraft` callback and `supportUrl` prop
- Added `SubmissionErrorAlert` standalone component for form errors
- Includes loading states for retry and draft save operations
- Get Help links to /support (redirects to docs via middleware)

### Task 4: Breadcrumb Component
- Created accessible `Breadcrumb` component with `aria-label="Breadcrumb"`
- Last item uses `aria-current="page"` and is not linked
- Optional collapse for long paths with `maxItems` prop
- Added `buildBreadcrumbsFromPath` helper for dynamic routes
- Responsive truncation and home icon support

### Task 5: Empty Catch Block Replacement
- Added `safeParseJsonString<T>` utility for JSON string parsing with logging
- Added `getErrorMessage` utility for extracting messages from any error type
- Updated api-client.ts to log JSON parse failures at debug level
- Updated api/clients/route.ts to log malformed request bodies
- Updated AppShell.tsx to log localStorage errors (expected in private browsing)

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Addressed

- HIGH-UX-01: Loading overlay during client switch
- HIGH-UX-02: /help and /support redirect to docs
- HIGH-UX-03: Error recovery UI with Try Again, Save Draft, Get Help
- HIGH-ERROR-CATCH-01: Empty catch blocks replaced with safeParseJson

## Verification

- TypeScript: All files pass `tsc --noEmit`
- Build: Next.js build completes successfully (pre-existing lint warnings in unrelated files)
- Components: New UI components properly typed and exported

## Self-Check: PASSED

All created files exist:
- apps/web/src/components/ui/client-switch-overlay.tsx
- apps/web/src/components/ui/breadcrumb.tsx

All commits verified in git log.
