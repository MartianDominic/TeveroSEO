---
phase: 44
plan: 02
subsystem: packages/ui
tags: [components, extraction, v6-tokens, design-system]
dependency_graph:
  requires: [44-01]
  provides: [ProgressBar, status-config, format-time, CardActionMenu, StepIndicator]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [CVA-variants, v6-tokens, ARIA-accessibility]
key_files:
  created:
    - packages/ui/src/components/progress-bar.tsx
    - packages/ui/src/components/card-action-menu.tsx
  modified:
    - packages/ui/src/lib/status-config.ts
    - packages/ui/src/index.ts
    - packages/ui/src/components/today-feed-item.tsx
decisions:
  - Use CSS variable syntax (var(--token)) for v6 token classes in ProgressBar
  - Add getStatusConfig helper function for status lookup by config map
  - Fix formatTime export naming to match actual function names
metrics:
  duration: 6m
  completed: 2026-04-30T02:33:00Z
---

# Phase 44 Plan 02: Component Extraction Summary

Extracted 5 reusable components/utilities from scattered implementations into packages/ui with v6 design token integration.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extract ProgressBar with v6 tokens | 5d10b624a | progress-bar.tsx |
| 2 | Create unified status-config.ts | a26af4a89 | status-config.ts |
| 3 | Create format-time, CardActionMenu, StepIndicator | a26af4a89, aa7c2b63f | format-time.ts, card-action-menu.tsx, step-indicator.tsx |

## Components Delivered

### ProgressBar (`packages/ui/src/components/progress-bar.tsx`)

- **Props:** value, variant, size, showLabel, labelPosition
- **Variants:** default, success, warning, error, auto (threshold-based)
- **Sizes:** sm (h-1), md (h-2), lg (h-3)
- **v6 tokens:** bg-surface-3 track, bg-accent/success/warning fill
- **Accessibility:** role="progressbar", aria-valuenow/min/max

### StatusConfig (`packages/ui/src/lib/status-config.ts`)

- **PROSPECT_STATUS:** new, analyzing, analyzed, converted, archived
- **CLIENT_STATUS:** good, drop, no_gsc, stale (with icons)
- **ARTICLE_STATUS:** draft, planned, writing, review, published, archived
- **PIPELINE_STAGE:** idea, outline, draft, review, published
- **Helper:** getStatusConfig(configMap, status) for lookups

### Format Time (`packages/ui/src/lib/format-time.ts`)

- **formatRelativeTime:** "5m ago", "2h ago", "3d ago"
- **formatShortDate:** "Jan 1, 2024"
- **formatDateTime:** "Jan 1, 2024 3:45 PM"
- **formatTime:** "3:45 PM"

### CardActionMenu (`packages/ui/src/components/card-action-menu.tsx`)

- **Props:** actions, align, triggerClassName
- **Action interface:** label, icon, onClick, variant, disabled
- **Variants:** default, destructive
- **Accessibility:** aria-haspopup, aria-expanded, role="menu/menuitem"

### StepIndicator (`packages/ui/src/components/step-indicator.tsx`)

- **Props:** step (number | "done"), current, size
- **States:** done (checkmark), current (accent bg), pending (border)
- **Sizes:** sm (h-4 w-4), md (h-5 w-5)
- **v6 tokens:** bg-success-soft, bg-accent-soft, border-hairline

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added getStatusConfig function**
- **Found during:** Task 2 verification
- **Issue:** kanban.tsx (from 44-03) imported non-existent getStatusConfig
- **Fix:** Added getStatusConfig(configMap, status) helper to status-config.ts
- **Files modified:** packages/ui/src/lib/status-config.ts
- **Commit:** a26af4a89

**2. [Rule 3 - Blocking] Fixed formatTime import in TodayFeedItem**
- **Found during:** Overall verification
- **Issue:** today-feed-item.tsx used wrong function name formatShortTime
- **Fix:** Changed import and usage to formatTime
- **Files modified:** packages/ui/src/components/today-feed-item.tsx
- **Commit:** aa7c2b63f

## Deferred Issues

**typography.tsx TypeScript errors** - Untracked file from parallel 44-03 execution has JSX namespace errors. Logged to deferred-items.md for 44-03 to address.

## Verification

```bash
# ProgressBar export and v6 tokens
grep -q "export.*ProgressBar" packages/ui/src/index.ts  # PASS
grep -q "bg-\[var(--surface-3)\]" packages/ui/src/components/progress-bar.tsx  # PASS

# Status configs
grep -q "PROSPECT_STATUS" packages/ui/src/lib/status-config.ts  # PASS
grep -q "CLIENT_STATUS" packages/ui/src/lib/status-config.ts  # PASS
grep -q "ARTICLE_STATUS" packages/ui/src/lib/status-config.ts  # PASS

# Task 3 components
grep -q "formatRelativeTime" packages/ui/src/lib/format-time.ts  # PASS
grep -q "CardActionMenu" packages/ui/src/components/card-action-menu.tsx  # PASS
grep -q "StepIndicator" packages/ui/src/components/step-indicator.tsx  # PASS
```

## Self-Check: PASSED

- [x] packages/ui/src/components/progress-bar.tsx exists
- [x] packages/ui/src/lib/status-config.ts exists
- [x] packages/ui/src/lib/format-time.ts exists
- [x] packages/ui/src/components/card-action-menu.tsx exists
- [x] packages/ui/src/components/step-indicator.tsx exists
- [x] Commit 5d10b624a exists
- [x] Commit a26af4a89 exists
- [x] Commit aa7c2b63f exists
