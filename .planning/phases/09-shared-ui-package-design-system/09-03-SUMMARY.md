---
phase: 09-shared-ui-package-design-system
plan: "03"
subsystem: frontend/design-system
tags: [monorepo, workspace-packages, codemod, ui-consolidation]
dependency_graph:
  requires: [09-01, 09-02]
  provides: [single-source-of-truth-ui, shared-types]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [workspace-package-imports, transpilePackages, re-export-alias]
key_files:
  created: []
  modified:
    - apps/web/package.json
    - apps/web/next.config.ts
    - apps/web/src/app/(shell)/clients/[clientId]/intelligence/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/articles/new/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/articles/[articleId]/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/articles/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/calendar/page.tsx
    - apps/web/src/app/(shell)/clients/page.tsx
    - apps/web/src/app/(shell)/settings/page.tsx
    - apps/web/src/components/shell/AppShell.tsx
    - apps/web/src/components/shell/CommandPalette.tsx
    - apps/web/src/components/editor/ImageGenerationPanel.tsx
    - apps/web/src/components/ClientSwitcher/ClientSwitcher.tsx
    - apps/web/src/components/onboarding/AddClientModal.tsx
    - apps/web/src/stores/clientStore.ts
    - apps/web/src/app/api/clients/route.ts
    - apps/web/src/app/api/clients/[clientId]/route.ts
    - apps/web/src/lib/utils.ts
  deleted:
    - apps/web/src/components/ui/ (22 files: badge, button, card, chart, cms-health-badge, command, dialog, error-banner, input, label, page-header, popover, select, separator, sheet, skeleton, slider, status-chip, switch, table, tabs, textarea)
    - apps/web/src/types/client.ts
decisions:
  - "Kept apps/web/src/lib/utils.ts as a thin re-export of cn from @tevero/ui to avoid a second codemod wave for non-UI call sites"
  - "Rewrote API route files (api/clients/route.ts, api/clients/[clientId]/route.ts) that imported @/types/client — discovered these were not in the plan's file list but grep found them (deviation Rule 2)"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-18"
---

# Phase 09 Plan 03: Rewire apps/web to @tevero/ui and @tevero/types — Summary

Single source of truth achieved: all UI primitives in apps/web now import from `@tevero/ui`; Client type from `@tevero/types`; local copies deleted; `pnpm build` exits 0.

## What Was Done

### Task 1: Wire workspace dependencies (already done from earlier session work)

Both `apps/web/package.json` and `apps/web/next.config.ts` were already correct. Ran `pnpm install` at repo root to create symlinks:

- `apps/web/node_modules/@tevero/ui` — symlink confirmed
- `apps/web/node_modules/@tevero/types` — symlink confirmed

Commit: `b17a7fa2`

### Task 2: Codemod (18 files total)

**Pass A — UI imports (14 files):**

Each file had its scattered `from "@/components/ui/<name>"` imports collapsed into a single merged, alphabetically-sorted `from "@tevero/ui"` import block.

| File | Symbols rewritten |
|------|------------------|
| intelligence/page.tsx | Button, Input, PageHeader, StatusChip, Table*, Tabs* |
| articles/new/page.tsx | Button, Input, Label, PageHeader, Select*, Separator, Slider, StatusChip, Textarea |
| articles/[articleId]/page.tsx | Button, Input, Label, PageHeader, Select*, Separator, Skeleton, Slider, StatusChip, Textarea |
| articles/page.tsx | Button, ChartContainer, ChartTooltip*, PageHeader, Select*, Skeleton, StatusChip, Table* |
| clients/[clientId]/settings/page.tsx | Button, Input, Label, PageHeader, Select*, Separator, Skeleton, Slider, StatusChip, Switch, Tabs*, Textarea |
| clients/[clientId]/page.tsx | Button, CmsHealthBadge, ErrorBanner, PageHeader, Skeleton, StatusChip, Table* |
| calendar/page.tsx | Button, Dialog, DialogContent, ErrorBanner, PageHeader, Skeleton, StatusChip |
| clients/page.tsx | Button, PageHeader, Skeleton, StatusChip |
| settings/page.tsx | Button, Dialog, DialogContent, Input, Label, PageHeader, Select*, Separator, Skeleton, StatusChip, Table*, Tabs*, Textarea |
| AppShell.tsx | Command*, Popover* |
| CommandPalette.tsx | Command*, Dialog, DialogContent |
| ImageGenerationPanel.tsx | Button, Label, Select*, Separator, Textarea |
| ClientSwitcher.tsx | Command*, Popover* |
| AddClientModal.tsx | Button, Dialog*, Input, Label |

(`*` = multiple named exports from one component)

**Pass B — Client type imports (3 files, 2 discovered beyond plan's listed 1):**

- `apps/web/src/stores/clientStore.ts` — listed in plan
- `apps/web/src/app/api/clients/route.ts` — found by grep (deviation, auto-fixed)
- `apps/web/src/app/api/clients/[clientId]/route.ts` — found by grep (deviation, auto-fixed)

All rewritten: `from "@/types/client"` → `from "@tevero/types"`.

**Pass C — utils.ts thin re-export:**

`apps/web/src/lib/utils.ts` overwritten to:
```typescript
// Thin alias — canonical cn lives in @tevero/ui.
export { cn } from "@tevero/ui";
```

Existing call sites using `import { cn } from "@/lib/utils"` continue to work.

Commit: `a21e89ff`

### Task 3: Delete orphaned sources + build gate

Deleted:
- `apps/web/src/components/ui/` — 22 component files, 1,324 lines removed
- `apps/web/src/types/client.ts` — 1 file

Build results:
```
pnpm tsc --noEmit        → 0 errors (no output)
pnpm build               → Compiled successfully in 7.8s
                           33 routes built, all ƒ dynamic and ○ static
                           Zero type errors
```

Only output was 2 pre-existing ESLint warnings (react-hooks/exhaustive-deps on useMemo patterns in article editor pages — not introduced by this plan).

Commit: `797c310f`

## Files Rewritten

- **UI pass (Pass A):** 14 files
- **Client type pass (Pass B):** 3 files (clientStore.ts + 2 API routes)
- **utils.ts re-export (Pass C):** 1 file
- **Total files modified:** 20 (including package.json, next.config.ts)

## Deletions

- `apps/web/src/components/ui/` — 22 files deleted (badge, button, card, chart, cms-health-badge, command, dialog, error-banner, input, label, page-header, popover, select, separator, sheet, skeleton, slider, status-chip, switch, table, tabs, textarea)
- `apps/web/src/types/client.ts` — 1 file deleted

## pnpm Build Output

```
✓ Compiled successfully in 7.8s
✓ Generating static pages (5/5)
33 routes listed in build manifest
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing coverage] API routes also imported @/types/client**

- **Found during:** Task 2 Pass B grep scan
- **Issue:** `apps/web/src/app/api/clients/route.ts` and `apps/web/src/app/api/clients/[clientId]/route.ts` both had `import type { Client } from "@/types/client"` — not listed in the plan's file list but found by the grep audit
- **Fix:** Rewrote both to `from "@tevero/types"` — these would have broken at build time after `types/client.ts` was deleted
- **Files modified:** `apps/web/src/app/api/clients/route.ts`, `apps/web/src/app/api/clients/[clientId]/route.ts`
- **Commit:** a21e89ff

## Barrel Additions Needed

None. All symbols used by apps/web were already present in `packages/ui/src/index.ts` from plan 09-02. No missing exports were encountered during the build.

## Phase 9 Goal: Achieved

Phase 9 success criteria (CONTEXT.md D-05):
- `grep -r "from.*@/components/ui" apps/web/src` returns **zero matches** — confirmed
- Single source of truth for UI primitives: `packages/ui/src/index.ts`
- Single source of truth for Client type: `packages/types/src/index.ts`
- Tailwind v4 `@theme` tokens remain in `apps/web/src/app/globals.css` — no `packages/ui/tailwind.config.ts` needed (transpilePackages handles raw TS, Tailwind v4 reads `@theme` inline)
- Monorepo `pnpm build` exits 0 — confirmed

## Self-Check: PASSED

All key files present, both deleted targets confirmed gone, all 3 task commits verified in git log.
