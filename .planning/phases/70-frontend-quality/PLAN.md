# Phase 70: Frontend Quality

**Milestone:** v8.0 SaaS Hardening
**Duration:** 2 weeks
**Priority:** HIGH - UX & reliability

## Overview

React component fixes, Next.js pattern improvements, user journey fixes, and error handling standardization.

## Sub-Plans

| Plan | Name | Wave | Depends On |
|------|------|------|------------|
| 70-01 | React Component Fixes | 1 | None (parallel with 69) |
| 70-02 | Next.js Patterns | 1 | 70-01 |
| 70-03 | User Journey Fixes | 2 | 70-02 |

## Issues Resolved

- CRITICAL: Memory leak in success-screen.tsx
- CRITICAL: Infinite re-render in GlobalSettings
- HIGH: Index keys in reorderable lists (10 files)
- HIGH: Missing ARIA attributes (5 forms)
- HIGH: Missing error.tsx (18 routes)
- HIGH: Missing loading.tsx (59 routes)
- HIGH: Empty catch blocks (20+ locations)

---

## Plan 70-01: React Component Fixes

```yaml
---
phase: 70-frontend-quality
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/connect/success-screen.tsx
  - apps/web/src/app/(shell)/settings/components/*.tsx
  - apps/web/src/components/proposals/ServiceLineItems.tsx
  - apps/web/src/components/dashboard/PatternsPanel.tsx
  - apps/web/src/app/(shell)/clients/new/page.tsx
autonomous: true
requirements:
  - CRITICAL-MEMORY-01
  - CRITICAL-RENDER-01
  - HIGH-KEYS-01
  - HIGH-ARIA-01
must_haves:
  truths:
    - All setTimeout cleaned up on unmount
    - No infinite re-renders in settings tabs
    - Index keys replaced with stable IDs
    - Forms have aria-invalid and aria-describedby
  artifacts:
    - apps/web/src/components/connect/success-screen.tsx (fixed useEffect)
  key_links:
    - useEffect cleanup function
    - React key best practices
---
```

<objective>
Fix memory leaks, infinite re-renders, index keys, and ARIA accessibility issues in React components.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Fix Memory Leak in success-screen.tsx

- Add cleanup function to useEffect
- Clear all setTimeout on unmount

Files: `apps/web/src/components/connect/success-screen.tsx`

Acceptance:
- [ ] Cleanup returns clearTimeout for both timers
- [ ] No console warnings on unmount

### Task 2: Audit GlobalSettings Tab Components

- Check api-integrations-tab.tsx
- Check voice-templates-tab.tsx
- Check model-defaults-tab.tsx
- Fix object dependencies causing re-renders

Files: `apps/web/src/app/(shell)/settings/components/*.tsx`

Acceptance:
- [ ] Stable useEffect dependencies
- [ ] No infinite render loops

### Task 3: Replace Index Keys in Lists

Fix 10 files with index keys:
1. ServiceLineItems.tsx
2. PatternsPanel.tsx
3. PredictiveAlertsPanel.tsx
4. PortfolioHealthSummary.tsx
5. OpportunitiesPanel.tsx
6. AppShellNavItem.tsx
7. AppShellSidebar.tsx
8. error-screen.tsx
9. oauth-enhancement.tsx
10. ProposalPreview.tsx

Acceptance:
- [ ] All use stable IDs (item.id, item.href)

### Task 4: Add ARIA to Form Components

Fix 5 files:
1. clients/new/page.tsx
2. prospects/new/page.tsx
3. ProposalForm.tsx
4. KeywordImportForm.tsx
5. VoiceProfileForm.tsx

Acceptance:
- [ ] aria-invalid on error
- [ ] aria-describedby linking error messages

---

## Plan 70-02: Next.js Patterns

```yaml
---
phase: 70-frontend-quality
plan: 02
type: execute
wave: 1
depends_on: [70-01]
files_modified:
  - apps/web/src/app/connect/error.tsx
  - apps/web/src/app/c/[token]/error.tsx
  - apps/web/src/app/(shell)/clients/[clientId]/audits/loading.tsx
  - apps/web/src/actions/seo/briefs.ts
autonomous: true
requirements:
  - HIGH-ERROR-01
  - HIGH-LOADING-01
must_haves:
  truths:
    - All 18 missing error.tsx files created
    - Tier 1 loading.tsx files created (9 routes)
    - Server actions use ActionResult<T> pattern
  artifacts:
    - 18 error.tsx files using PageErrorBoundary
    - 9 loading.tsx files for high-traffic routes
  key_links:
    - PageErrorBoundary component
    - ActionResult type pattern
---
```

<objective>
Add error.tsx and loading.tsx to all routes, standardize server action validation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Create Missing error.tsx Files

Create 18 files:
- apps/web/src/app/connect/error.tsx
- apps/web/src/app/c/[token]/error.tsx
- apps/web/src/app/(dashboard)/command-center/error.tsx
- apps/web/src/app/install/[token]/error.tsx
- apps/web/src/app/invoices/[id]/pay/error.tsx
- apps/web/src/app/invoices/[id]/success/error.tsx
- apps/web/src/app/[locale]/c/[token]/error.tsx
- apps/web/src/app/proposals/[token]/error.tsx
- apps/web/src/app/p/[token]/error.tsx
- Plus 9 more shell routes

Acceptance:
- [ ] All use PageErrorBoundary
- [ ] "use client" directive present

### Task 2: Create Tier 1 loading.tsx Files

Create 9 files for high-traffic routes:
- audits/loading.tsx
- articles/loading.tsx
- intelligence/loading.tsx
- seo/[projectId]/audit/loading.tsx
- seo/[projectId]/keywords/loading.tsx
- seo/[projectId]/backlinks/loading.tsx
- prospects/[prospectId]/loading.tsx
- dashboard/revenue/loading.tsx
- dashboard/tasks/loading.tsx

Acceptance:
- [ ] Skeleton loading states
- [ ] Matches page layout

### Task 3: Standardize Server Actions

Files: `apps/web/src/actions/seo/briefs.ts`, `keywords.ts`

Acceptance:
- [ ] All return ActionResult<T>
- [ ] Consistent error handling

---

## Plan 70-03: User Journey Fixes

```yaml
---
phase: 70-frontend-quality
plan: 03
type: execute
wave: 2
depends_on: [70-02]
files_modified:
  - apps/web/src/app/(shell)/layout.tsx
  - apps/web/src/middleware.ts
  - apps/web/src/app/(shell)/clients/new/page.tsx
  - apps/web/src/components/ui/breadcrumb.tsx
  - apps/web/src/lib/error-utils.ts
autonomous: true
requirements:
  - HIGH-UX-01
  - HIGH-UX-02
  - HIGH-UX-03
  - HIGH-ERROR-CATCH-01
must_haves:
  truths:
    - Loading overlay during client switch
    - /help and /support redirect to docs
    - Error recovery UI with Try Again, Save Draft, Get Help
    - Breadcrumb component for deep routes
    - Empty catch blocks replaced with safeParseJson
  artifacts:
    - apps/web/src/components/ui/breadcrumb.tsx
  key_links:
    - ClientSwitchingContext for loading state
---
```

<objective>
Fix user journey issues including loading states, broken links, error recovery, and navigation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Add Client Switch Loading Overlay

Files: `apps/web/src/app/(shell)/layout.tsx`

Acceptance:
- [ ] Full-screen overlay during switch
- [ ] No visual jitter

### Task 2: Fix Broken Help/Support Links

Files: `apps/web/src/middleware.ts`

Acceptance:
- [ ] /help/* redirects to docs
- [ ] /support redirects to support page

### Task 3: Add Error Recovery UI

Files: `apps/web/src/app/(shell)/clients/new/page.tsx`

Acceptance:
- [ ] Try Again button
- [ ] Save as Draft option
- [ ] Get Help link

### Task 4: Implement Breadcrumb Component

Files: `apps/web/src/components/ui/breadcrumb.tsx`

Acceptance:
- [ ] Works for nested routes
- [ ] Accessible navigation

### Task 5: Replace Empty Catch Blocks

Fix 20+ locations using safeParseJson from error-utils.ts

Acceptance:
- [ ] No silent error swallowing
- [ ] Errors logged appropriately
