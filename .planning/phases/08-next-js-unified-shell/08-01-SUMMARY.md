---
phase: 08-next-js-unified-shell
plan: "01"
subsystem: apps/web scaffold
tags: [nextjs, tailwind, pnpm, monorepo, typescript]
dependency_graph:
  requires: []
  provides:
    - pnpm workspace root (apps/*, packages/*)
    - apps/web Next.js 15 App Router scaffold
    - packages/ui stub (@tevero/ui)
    - packages/types stub (@tevero/types)
  affects:
    - All Phase 08 plans (depend on working Next.js build)
    - Phase 09 (populates packages/ui and packages/types)
tech_stack:
  added:
    - Next.js 15.1.6 (App Router)
    - React 19.0.0
    - TypeScript 5.7.3
    - Tailwind CSS 4.1.17 (v4 via @tailwindcss/postcss)
    - pnpm 10.26.0 workspaces
  patterns:
    - Next.js standalone output (Docker-ready)
    - Tailwind v4 @theme block with oklch color tokens
    - pnpm isolated node-linker
key_files:
  created:
    - pnpm-workspace.yaml
    - package.json (workspace root)
    - .npmrc
    - pnpm-lock.yaml
    - packages/ui/package.json
    - packages/ui/src/index.ts
    - packages/ui/tsconfig.json
    - packages/types/package.json
    - packages/types/src/index.ts
    - packages/types/tsconfig.json
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/next.config.ts
    - apps/web/postcss.config.mjs
    - apps/web/src/app/globals.css
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
    - apps/web/.env.example
    - apps/web/.gitignore
    - apps/web/.eslintrc.json
  modified: []
decisions:
  - React 19.0.0 used (Next.js 15 default; no peer issues encountered)
  - Tailwind v4 pinned at 4.1.17 (not 4.0.0 per plan — see deviations)
  - globals.css uses oklch() color space (Tailwind v4 native; replaces hsl() vars from CRA)
  - packages/ui and packages/types tsconfig.json uses standalone compilerOptions (not extending apps/web) to avoid circular reference during bootstrap
  - standalone output lives at .next/standalone/apps/web/server.js (monorepo path, normal for pnpm workspaces)
metrics:
  duration_seconds: 234
  completed_date: "2026-04-17"
  tasks_completed: 3
  files_created: 20
---

# Phase 08 Plan 01: pnpm Workspace + Next.js 15 Scaffold Summary

**One-liner:** pnpm workspaces monorepo with Next.js 15 App Router, Tailwind v4 oklch tokens, standalone output, and stub packages/ui + packages/types — build passing, TypeScript clean.

## React Version

React 19.0.0 was used as specified in the plan. Next.js 15.1.6 supports React 19 without issues. No peer-dep compromises were needed for the React version.

## Peer-Dep Compromises

None beyond the Tailwind version fix documented in Deviations below.

## Confirmed pnpm + Node Versions

- pnpm: 10.26.0 (matches `packageManager` field in root package.json)
- Node: v20.20.1 (satisfies `engines.node >= 20.11.0`)

## Standalone Output Path

In a pnpm workspace monorepo, Next.js standalone output preserves the workspace path structure:

```
apps/web/.next/standalone/apps/web/server.js   # monorepo path (correct)
```

This is expected behavior. The Dockerfile in plan 08-07 must `COPY .next/standalone/apps/web/ ./` (not `COPY .next/standalone/ ./`).

## Tailwind v4 Design Tokens

The `globals.css` uses Tailwind v4's `@theme` block with oklch() color space values, mapping the AI-Writer CRA design system (hsl CSS variables) to the new format. Key tokens: `--color-background`, `--color-foreground`, `--color-primary`, `--color-border`, `--color-muted`, `--color-card`, `--color-popover`, `--color-destructive`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Upgraded @tailwindcss/postcss and tailwindcss from 4.0.0 to 4.1.17**

- **Found during:** Task 3 (pnpm build)
- **Issue:** `@tailwindcss/postcss@4.0.0` threw `Error: Missing field 'negated' on ScannerOptions.sources` when used with Next.js 15.1.6's bundled postcss. This is a known incompatibility in the 4.0.0 initial release.
- **Fix:** Updated both `@tailwindcss/postcss` and `tailwindcss` to `4.1.17` (latest stable 4.x at execution time). The `@import "tailwindcss"` directive and `@theme` block work identically — no CSS changes needed.
- **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml`
- **Commit:** 54f63d9

**2. [Rule 2 - Missing] packages/ui and packages/types tsconfig.json use standalone compilerOptions**

- **Found during:** Task 1 planning
- **Issue:** The plan suggested `"extends": "../../apps/web/tsconfig.json"` for stub package tsconfigs, but apps/web doesn't exist yet during Task 1. Circular bootstrap dependency.
- **Fix:** Created standalone tsconfig.json files with identical compilerOptions (no `extends`). These will be updated to extend apps/web tsconfig in Phase 9 when the packages are populated.
- **Files modified:** `packages/ui/tsconfig.json`, `packages/types/tsconfig.json`
- **Commit:** 648e443

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `packages/ui/src/index.ts` | `export {};` | Phase 9 populates with extracted UI components |
| `packages/types/src/index.ts` | `export {};` | Phase 9 populates with shared TypeScript types |
| `apps/web/src/app/page.tsx` | `redirect("/clients")` | Plan 08-02 replaces with Clerk-aware routing |

These stubs are intentional and documented in the plan.

## Threat Flags

None. This plan creates no network endpoints, auth paths, or database access. The only security surface is the `.env.local` file with placeholder credentials — it is gitignored.

## Self-Check: PASSED

- [x] `pnpm-workspace.yaml` exists and contains `apps/*`
- [x] `apps/web/package.json` exists with `"next": "15.1.6"`
- [x] `apps/web/next.config.ts` exists with `output: "standalone"`
- [x] `apps/web/src/app/layout.tsx` exists (15 lines)
- [x] `apps/web/src/app/globals.css` contains `@import "tailwindcss"` (63 lines)
- [x] `packages/ui/package.json` exists with `"name": "@tevero/ui"`
- [x] `.next/standalone/apps/web/server.js` exists (standalone build output)
- [x] Task commits: 648e443 (chore), d8166a6 (feat), 54f63d9 (fix)
