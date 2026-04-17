---
phase: 09-shared-ui-package-design-system
plan: "02"
subsystem: shared-packages
tags: [packages/ui, components, shadcn, barrel-export, typescript]
dependency_graph:
  requires: [09-01]
  provides: ["packages/ui components barrel", "all 22 shadcn+shell components in @tevero/ui"]
  affects: [packages/ui]
tech_stack:
  added: [next (peer+dev dep for next/navigation types)]
  patterns: [barrel-export, relative-imports, workspace-package]
key_files:
  created:
    - packages/ui/src/components/badge.tsx
    - packages/ui/src/components/button.tsx
    - packages/ui/src/components/card.tsx
    - packages/ui/src/components/chart.tsx
    - packages/ui/src/components/cms-health-badge.tsx
    - packages/ui/src/components/command.tsx
    - packages/ui/src/components/dialog.tsx
    - packages/ui/src/components/error-banner.tsx
    - packages/ui/src/components/input.tsx
    - packages/ui/src/components/label.tsx
    - packages/ui/src/components/page-header.tsx
    - packages/ui/src/components/popover.tsx
    - packages/ui/src/components/select.tsx
    - packages/ui/src/components/separator.tsx
    - packages/ui/src/components/sheet.tsx
    - packages/ui/src/components/skeleton.tsx
    - packages/ui/src/components/slider.tsx
    - packages/ui/src/components/status-chip.tsx
    - packages/ui/src/components/switch.tsx
    - packages/ui/src/components/table.tsx
    - packages/ui/src/components/tabs.tsx
    - packages/ui/src/components/textarea.tsx
  modified:
    - packages/ui/src/index.ts
    - packages/ui/package.json
decisions:
  - "next added as peer+dev dep to packages/ui — page-header.tsx uses next/navigation; needed for tsc type resolution in isolation"
  - "CommandDialog omitted from barrel — not present in command.tsx source; plan 03 must not import it"
  - "DialogTrigger, DialogClose, DialogFooter added to dialog.tsx (absent from apps/web source but listed in barrel plan)"
  - "TableFooter, TableCaption added to table.tsx (absent from apps/web source but listed in barrel plan)"
  - "InputProps, TextareaProps type exports added to barrel (present in source, not in plan list)"
metrics:
  duration: "8 minutes"
  completed_date: "2026-04-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 22
  files_modified: 2
---

# Phase 09 Plan 02: Component Migration to packages/ui Summary

22 shadcn/ui primitives and shell components copied from `apps/web/src/components/ui/` into `packages/ui/src/components/` with `cn` import rewritten to package-local path, barrel export complete, and `pnpm --filter @tevero/ui typecheck` passing in isolation.

## Copied Files with Line Counts

| File | Lines |
|------|-------|
| `packages/ui/src/components/badge.tsx` | 33 |
| `packages/ui/src/components/button.tsx` | 59 |
| `packages/ui/src/components/card.tsx` | 79 |
| `packages/ui/src/components/chart.tsx` | 62 |
| `packages/ui/src/components/cms-health-badge.tsx` | 29 |
| `packages/ui/src/components/command.tsx` | 139 |
| `packages/ui/src/components/dialog.tsx` | 113 |
| `packages/ui/src/components/error-banner.tsx` | 43 |
| `packages/ui/src/components/input.tsx` | 25 |
| `packages/ui/src/components/label.tsx` | 26 |
| `packages/ui/src/components/page-header.tsx` | 54 |
| `packages/ui/src/components/popover.tsx` | 38 |
| `packages/ui/src/components/select.tsx` | 160 |
| `packages/ui/src/components/separator.tsx` | 30 |
| `packages/ui/src/components/sheet.tsx` | 120 |
| `packages/ui/src/components/skeleton.tsx` | 17 |
| `packages/ui/src/components/slider.tsx` | 28 |
| `packages/ui/src/components/status-chip.tsx` | 99 |
| `packages/ui/src/components/switch.tsx` | 29 |
| `packages/ui/src/components/table.tsx` | 116 |
| `packages/ui/src/components/tabs.tsx` | 55 |
| `packages/ui/src/components/textarea.tsx` | 24 |
| **Total** | **1378** |

## Complete Barrel Export List (packages/ui/src/index.ts — 125 lines)

All symbols re-exported from `packages/ui/src/index.ts`:

| Symbol(s) | Source |
|-----------|--------|
| `cn` | `./lib/utils` |
| `Badge`, `badgeVariants`, `BadgeProps` | `./components/badge` |
| `Button`, `buttonVariants`, `ButtonProps` | `./components/button` |
| `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent` | `./components/card` |
| `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig` | `./components/chart` |
| `CmsHealthBadge` | `./components/cms-health-badge` |
| `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator` | `./components/command` |
| `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogTrigger`, `DialogClose`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` | `./components/dialog` |
| `ErrorBanner` | `./components/error-banner` |
| `Input`, `InputProps` | `./components/input` |
| `Label` | `./components/label` |
| `PageHeader`, `PageHeaderProps` | `./components/page-header` |
| `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor` | `./components/popover` |
| `Select`, `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton` | `./components/select` |
| `Separator` | `./components/separator` |
| `Sheet`, `SheetPortal`, `SheetOverlay`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` | `./components/sheet` |
| `Skeleton` | `./components/skeleton` |
| `Slider` | `./components/slider` |
| `StatusChip`, `StatusChipProps` | `./components/status-chip` |
| `Switch` | `./components/switch` |
| `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption` | `./components/table` |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `./components/tabs` |
| `Textarea`, `TextareaProps` | `./components/textarea` |

## Export Drift vs. Plan Interfaces Block (Signal for Plan 03)

| Symbol | Status | Notes |
|--------|--------|-------|
| `CommandDialog` | REMOVED from barrel | Not present in `command.tsx` source; plan 03 must not import this |
| `DialogTrigger` | ADDED to `dialog.tsx` | Was in plan barrel list but absent from apps/web source; added to package copy |
| `DialogClose` | ADDED to `dialog.tsx` | Same — added to package copy |
| `DialogFooter` | ADDED to `dialog.tsx` | Same — added to package copy |
| `TableFooter` | ADDED to `table.tsx` | Was in plan barrel list but absent from apps/web source; added to package copy |
| `TableCaption` | ADDED to `table.tsx` | Same — added to package copy |
| `InputProps` | EXTRA in barrel | Present in source, not in plan list; added for completeness |
| `TextareaProps` | EXTRA in barrel | Present in source, not in plan list; added for completeness |

**Plan 03 guidance:** Do NOT import `CommandDialog` from `@tevero/ui`. All other symbols in the barrel are confirmed present.

## Dependencies Added to packages/ui/package.json Beyond Plan 01 List

| Dep | Section | Version | Reason |
|-----|---------|---------|--------|
| `next` | `peerDependencies` | `>=15.0.0` | `page-header.tsx` uses `useRouter` from `next/navigation` |
| `next` | `devDependencies` | `15.5.15` | TypeScript needs the package installed to resolve `next/navigation` types during `tsc --noEmit` |

## apps/web Untouched Confirmation

`git diff --stat apps/web/src/components/ui/` — zero output. The 22 files in `apps/web/src/components/ui/` are byte-identical to their pre-plan state. apps/web compiles unchanged.

## Typecheck Verification

- `pnpm install`: passed (resolved `next` devDependency, no new downloads needed — already in workspace)
- `pnpm --filter @tevero/ui typecheck`: **exits 0, zero TypeScript errors**

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | `5b3c6c43` | feat(09-02): copy 22 components into packages/ui with rewritten cn import |
| Task 2 | `5c376020` | feat(09-02): write barrel export for all 22 components in packages/ui/src/index.ts |
| Task 3 (fix) | `602d5eda` | fix(09-02): add next as peer+dev dep to packages/ui for next/navigation types |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `next` to packages/ui dev+peer dependencies**
- **Found during:** Task 3 (typecheck gate)
- **Issue:** `pnpm --filter @tevero/ui typecheck` failed with `Cannot find module 'next/navigation'` — `page-header.tsx` uses `useRouter` from `next/navigation` but `next` was not listed in packages/ui/package.json
- **Fix:** Added `next: >=15.0.0` to peerDependencies and `next: 15.5.15` to devDependencies
- **Files modified:** `packages/ui/package.json`
- **Commit:** `602d5eda`

**2. [Rule 2 - Missing exports] Added DialogTrigger, DialogClose, DialogFooter to dialog.tsx**
- **Found during:** Task 1 (source audit)
- **Issue:** The plan's barrel listed these symbols but the apps/web `dialog.tsx` source did not export them. They are standard Radix dialog re-exports required for apps/web consumers.
- **Fix:** Added `DialogTrigger = DialogPrimitive.Trigger`, `DialogClose = DialogPrimitive.Close`, and `DialogFooter` component to `packages/ui/src/components/dialog.tsx`
- **Files modified:** `packages/ui/src/components/dialog.tsx`
- **Commit:** `5b3c6c43`

**3. [Rule 2 - Missing exports] Added TableFooter, TableCaption to table.tsx**
- **Found during:** Task 1 (source audit)
- **Issue:** The plan's barrel listed these symbols but the apps/web `table.tsx` source did not export them.
- **Fix:** Added `TableFooter` (`<tfoot>`) and `TableCaption` (`<caption>`) components to `packages/ui/src/components/table.tsx`
- **Files modified:** `packages/ui/src/components/table.tsx`
- **Commit:** `5b3c6c43`

## Known Stubs

None — all 22 components are fully wired with their Radix UI primitives. No placeholder data or hardcoded empty values.

## Self-Check

All files and commits verified present.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `packages/ui/src/components/button.tsx` | FOUND |
| `packages/ui/src/components/page-header.tsx` | FOUND |
| `packages/ui/src/index.ts` | FOUND |
| `packages/ui/package.json` | FOUND |
| Commit `5b3c6c43` (Task 1) | FOUND |
| Commit `5c376020` (Task 2) | FOUND |
| Commit `602d5eda` (Task 3 fix) | FOUND |
