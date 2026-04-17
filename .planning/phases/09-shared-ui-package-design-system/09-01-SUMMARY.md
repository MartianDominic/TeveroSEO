---
phase: 09-shared-ui-package-design-system
plan: "01"
subsystem: shared-packages
tags: [packages/ui, packages/types, workspace, typescript, design-system]
dependency_graph:
  requires: []
  provides: ["@tevero/ui cn utility", "@tevero/types Client/Project/AuditStatus"]
  affects: [packages/ui, packages/types]
tech_stack:
  added: [class-variance-authority, clsx, tailwind-merge, cmdk, lucide-react, recharts, "@radix-ui/*"]
  patterns: [workspace-package, transpilePackages, barrel-export]
key_files:
  created:
    - packages/ui/src/lib/utils.ts
    - packages/types/src/client.ts
    - packages/types/src/project.ts
    - packages/types/src/audit.ts
  modified:
    - packages/ui/package.json
    - packages/ui/src/index.ts
    - packages/types/package.json
    - packages/types/src/index.ts
decisions:
  - "cn() duplicated in packages/ui and apps/web intentionally — plan 03 removes apps/web copy after import rewire"
  - "Client.is_archived added proactively per CONTEXT.md D-04 — wider than apps/web local type; plan 03 aligns"
  - "No tsup/build step — Next.js transpilePackages handles TS source directly (wired in plan 03)"
metrics:
  duration: "2 minutes"
  completed_date: "2026-04-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 4
---

# Phase 09 Plan 01: Bootstrap packages/ui and packages/types Summary

Bootstrap `packages/ui` and `packages/types` as valid, resolvable pnpm workspace packages — dependencies declared, `cn` utility in place, and shared TypeScript types (Client, Project, AuditStatus) extracted — without touching any apps/web files.

## Files Created

| File | Purpose |
|------|---------|
| `packages/ui/src/lib/utils.ts` | Canonical `cn()` helper (clsx + tailwind-merge) |
| `packages/types/src/client.ts` | `Client` interface with `is_archived: boolean` |
| `packages/types/src/project.ts` | `Project` interface mirroring open-seo project table |
| `packages/types/src/audit.ts` | `AuditStatus` union type |

## Files Modified

| File | Change |
|------|--------|
| `packages/ui/package.json` | Added `type:module`, `scripts.typecheck`, all runtime deps, React 19 as peer |
| `packages/ui/src/index.ts` | Replaced `export {}` placeholder with `export { cn } from "./lib/utils"` |
| `packages/types/package.json` | Added `type:module`, `scripts.typecheck`, exports shape |
| `packages/types/src/index.ts` | Replaced `export {}` placeholder with type barrel exports |

## Exact Dependency Versions (packages/ui/package.json)

```json
"@radix-ui/react-dialog": "^1.1.15",
"@radix-ui/react-label": "^2.1.8",
"@radix-ui/react-popover": "^1.1.15",
"@radix-ui/react-select": "^2.2.6",
"@radix-ui/react-separator": "^1.1.8",
"@radix-ui/react-slider": "^1.3.6",
"@radix-ui/react-slot": "^1.2.4",
"@radix-ui/react-switch": "^1.2.6",
"@radix-ui/react-tabs": "^1.1.13",
"class-variance-authority": "^0.7.1",
"clsx": "^2.1.1",
"cmdk": "^1.1.1",
"lucide-react": "^0.543.0",
"recharts": "^3.8.1",
"tailwind-merge": "^3.5.0"
```

## Verification Results

- `pnpm install` at repo root: passed (no errors, packages resolved)
- `pnpm --filter @tevero/ui typecheck`: passed (no TypeScript errors)
- `pnpm --filter @tevero/types typecheck`: passed (no TypeScript errors)
- `pnpm -r list --depth=-1 | grep @tevero`: both `@tevero/ui@0.0.0` and `@tevero/types@0.0.0` discovered

## Important: cn() Now Exists in Two Places

`packages/ui/src/lib/utils.ts` and `apps/web/src/lib/utils.ts` are currently identical copies. This is intentional — `apps/web` still imports its local copy (zero files changed in this plan). Plan 03 will switch all apps/web consumers to `import { cn } from "@tevero/ui"` and then remove the local copy.

## Important: Client Type is Wider Than apps/web's Local Type

`packages/types/src/client.ts` adds `is_archived: boolean` per CONTEXT.md D-04. The existing `apps/web/src/types/client.ts` does NOT have this field. Plan 03 will replace the local type with `import type { Client } from "@tevero/types"`.

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | `72c1f86c` | feat(09-01): finalize packages/ui package.json with all runtime deps |
| Task 2 | `cc778be9` | feat(09-01): add cn utility and barrel export to packages/ui/src |
| Task 3 | `8993442f` | feat(09-01): populate packages/types with Client, Project, AuditStatus |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no UI components exist in packages/ui yet (added by plan 02). The barrel export is minimal by design.
