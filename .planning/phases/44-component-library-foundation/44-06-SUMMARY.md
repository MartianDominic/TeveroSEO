---
phase: 44
plan: 06
subsystem: ui/components
tags: [ux-state, empty-state, error-state, loading-skeleton, data-wrapper]
dependency_graph:
  requires: [44-02, 44-04]
  provides: [EmptyState, ErrorState, LoadingSkeleton, DataStateWrapper]
  affects: [apps/web, packages/ui]
tech_stack:
  added: []
  patterns: [CVA-variants, composition-wrapper, CSS-opacity-animation]
key_files:
  created:
    - packages/ui/src/components/empty-state.tsx
    - packages/ui/src/components/error-state.tsx
    - packages/ui/src/components/loading-skeleton.tsx
    - packages/ui/src/components/data-state-wrapper.tsx
  modified:
    - packages/ui/src/index.ts
    - apps/web/src/app/globals.css
decisions:
  - EmptyState uses font-display for title with max-w-320px description
  - ErrorState has three variants: inline (compact), card (replacement), fullPage (centered)
  - LoadingSkeleton uses CSS opacity animation, not animate-pulse (per v6 spec)
  - DataStateWrapper priority: isLoading > isError > isEmpty > children(data)
metrics:
  duration: 2m
  completed: "2026-04-30T03:47:00Z"
  tasks: 3
  files: 6
requirements_completed: [SC-21, SC-22, SC-23]
---

# Phase 44 Plan 06: UX State Components Summary

Four UX state components for consistent loading, error, and empty data handling across all data views.

## One-Liner

EmptyState/ErrorState/LoadingSkeleton/DataStateWrapper with v6 tokens, CSS opacity animation, and composition pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create EmptyState component | 4e88dbe2b | empty-state.tsx |
| 2 | Create ErrorState component | 4e88dbe2b | error-state.tsx |
| 3 | Create LoadingSkeleton and DataStateWrapper | 4e88dbe2b | loading-skeleton.tsx, data-state-wrapper.tsx |

## Components Implemented

### EmptyState

- Centered flex layout with py-space-8, px-space-6
- 48px icon in text-text-3 color
- Title: font-display (Newsreader), type-h3, text-text-1
- Description: max-w-320px, type-body, text-text-2
- Action button using Button component with accent color
- Secondary action: text link with hover:underline
- Variants: default, search, first-time, filtered

### ErrorState

- **inline**: bg-error-soft, text-error, compact AlertCircle icon, single-line
- **card**: Centered AlertTriangle, title + message, retry button
- **fullPage**: Large 64px icon, h2 title, error code in font-mono, retry + report actions
- Default titles per variant ("Something went wrong", "We hit a snag")
- role="alert" for accessibility

### LoadingSkeleton

- **CRITICAL**: Uses CSS opacity animation, NOT animate-pulse
- Keyframes: skeleton-shimmer (0.5 -> 1 -> 0.5 opacity over 1.5s)
- Variants: text, card, table, chart, avatar, button
- Text variant: multiple lines with varying widths (100%, 90%, 75%, 60%, 85%)
- Table variant: configurable rows
- motion-reduce: animation disabled, static 70% opacity
- Respects prefers-reduced-motion media query

### DataStateWrapper

- Generic component supporting any data type
- Priority order: isLoading > isError > isEmpty > children(data)
- Default isEmpty: handles arrays, objects, null/undefined
- Customizable loading/error/empty components
- Renders children function with typed data

## Verification Results

- Task 1: PASS - EmptyState with font-display, max-w-320px
- Task 2: PASS - ErrorState with error-soft, inline/card/fullPage
- Task 3: PASS - LoadingSkeleton with skeleton-shimmer, DataStateWrapper

## Deviations from Plan

None - plan executed exactly as written.

## Key Design Decisions

1. **CSS Animation over animate-pulse**: Per design-system-v6.md, skeleton uses opacity shimmer (0.5 to 1) instead of Tailwind's scale-based animate-pulse
2. **Composition Pattern**: DataStateWrapper uses render props pattern for type-safe data rendering
3. **Accessibility First**: ErrorState uses role="alert", all components have focus management

## Exports Added to @tevero/ui

```typescript
export { EmptyState, emptyStateVariants } from "./components/empty-state";
export type { EmptyStateProps, EmptyStateAction } from "./components/empty-state";

export { ErrorState, errorStateVariants } from "./components/error-state";
export type { ErrorStateProps } from "./components/error-state";

export { LoadingSkeleton, loadingSkeletonVariants } from "./components/loading-skeleton";
export type { LoadingSkeletonProps } from "./components/loading-skeleton";

export { DataStateWrapper } from "./components/data-state-wrapper";
export type { DataStateWrapperProps } from "./components/data-state-wrapper";
```

## Self-Check: PASSED

- [x] packages/ui/src/components/empty-state.tsx exists
- [x] packages/ui/src/components/error-state.tsx exists
- [x] packages/ui/src/components/loading-skeleton.tsx exists
- [x] packages/ui/src/components/data-state-wrapper.tsx exists
- [x] Commit 4e88dbe2b exists
- [x] All components exported from packages/ui/src/index.ts
