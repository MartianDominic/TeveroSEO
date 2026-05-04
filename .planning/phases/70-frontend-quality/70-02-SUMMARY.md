---
phase: 70-frontend-quality
plan: 02
subsystem: apps/web
tags: [error-boundaries, loading-states, server-actions]
dependency_graph:
  requires: [70-01]
  provides: [error-boundaries, loading-skeletons, action-result-pattern]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [error-boundary, skeleton-loading, action-result]
key_files:
  created:
    - apps/web/src/app/connect/error.tsx
    - apps/web/src/app/c/[token]/error.tsx
    - apps/web/src/app/(dashboard)/command-center/error.tsx
    - apps/web/src/app/install/[token]/error.tsx
    - apps/web/src/app/invoices/[id]/pay/error.tsx
    - apps/web/src/app/invoices/[id]/success/error.tsx
    - apps/web/src/app/[locale]/c/[token]/error.tsx
    - apps/web/src/app/proposals/[token]/error.tsx
    - apps/web/src/app/p/[token]/error.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/audits/error.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/articles/error.tsx
    - apps/web/src/app/(shell)/intelligence/error.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/error.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/error.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/backlinks/error.tsx
    - apps/web/src/app/(shell)/dashboard/revenue/error.tsx
    - apps/web/src/app/(shell)/dashboard/tasks/error.tsx
    - apps/web/src/app/connect/enhance/error.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/audits/loading.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/articles/loading.tsx
    - apps/web/src/app/(shell)/intelligence/loading.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/loading.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/loading.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/backlinks/loading.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/loading.tsx
    - apps/web/src/app/(shell)/dashboard/revenue/loading.tsx
    - apps/web/src/app/(shell)/dashboard/tasks/loading.tsx
  modified:
    - apps/web/src/actions/seo/backlinks.ts
decisions:
  - Error boundaries use "use client" with reset() pattern and digest display
  - Loading states use Skeleton component with layout-matching structure
  - ActionResult<T> imported from action-auth.ts for type consistency
metrics:
  duration: 184s
  completed: 2026-05-04
---

# Phase 70 Plan 02: Next.js Patterns Summary

Error boundaries with reset() for 18 routes, skeleton loading for 9 high-traffic routes, ActionResult<T> pattern for server actions.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| f12880fc2 | feat | Add missing error.tsx files to 18 routes |
| c298631a1 | feat | Add Tier 1 loading.tsx skeleton files |
| e8a2f846e | refactor | Standardize server actions to ActionResult<T> pattern |

## Task Summary

### Task 1: Create Missing error.tsx Files

Created 18 error.tsx files with consistent pattern:
- "use client" directive for error handling
- reset() function for retry capability
- Error digest display for debugging
- Button component from @tevero/ui

### Task 2: Create Tier 1 loading.tsx Files

Created 9 loading.tsx skeleton files for high-traffic routes:
- Skeleton component for consistent loading states
- Layout-matched structure to prevent layout shift
- Grid patterns for card-heavy pages

### Task 3: Standardize Server Actions

Updated backlinks.ts to use ActionResult<T> pattern:
- Import ActionResult type from action-auth.ts
- Replace inline return types with ActionResult<T>
- Type-safe success/error discrimination

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] All 18 error.tsx files created and committed
- [x] All 9 loading.tsx files created and committed
- [x] backlinks.ts updated to ActionResult<T> pattern
- [x] Commits f12880fc2, c298631a1, e8a2f846e verified
