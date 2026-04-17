# Phase 9: Shared UI Package + Design System - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure + design phase)

<domain>
## Phase Boundary

Extract all shadcn/ui components duplicated between `apps/web` (from Phase 8) and `open-seo-main` into a single `packages/ui` package. Establish one Tailwind v4 config as the canonical design system. Create `packages/types` for shared TypeScript types (Client, Project, etc.). After this phase, `apps/web` imports all UI primitives from `@tevero/ui` — no local `components/ui/` copies remain.

This phase does NOT port open-seo routes (Phase 10). It only extracts what already exists in apps/web into shared packages.

</domain>

<decisions>
## Implementation Decisions

### Package Structure
- `packages/ui/` — exported as `@tevero/ui` in pnpm workspace
- `packages/types/` — exported as `@tevero/types` in pnpm workspace
- Both use TypeScript, built with `tsc` (no bundler needed for internal packages in Next.js monorepo)
- `packages/ui/package.json`: `"main": "./src/index.ts"` with `tsconfig` path resolution (no build step needed — Next.js transpiles workspace packages)

### Components to Extract
All shadcn/ui primitives currently in `apps/web/src/components/ui/`:
button, card, input, label, select, textarea, badge, checkbox, dialog, dropdown-menu, popover, separator, sheet, slider, switch, tabs, tooltip, command, calendar, form, scroll-area, skeleton, sonner, table
Also: shared layout components (PageHeader, StatusChip) if they exist

### Tailwind Config
- Single `packages/ui/tailwind.config.ts` with design tokens (colors, spacing, radius, fonts)
- `apps/web/tailwind.config.ts` extends `@tevero/ui/tailwind.config`
- `open-seo-main` already has its own Tailwind v4 config; Phase 9 does NOT touch it (Phase 10 will align it)

### Shared Types (`packages/types`)
- `Client` — `{ id: string; name: string; website_url: string | null; is_archived: boolean }`
- `Project` — open-seo project shape
- `AuditStatus` — enum: running | completed | failed
- Export from `@tevero/types`

### Claude's Discretion
- Whether to use `tsup` for packages/ui build or rely on Next.js transpilePackages
- Exact set of types in packages/types beyond Client and Project

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/ui/` — all shadcn components copied from AI-Writer in Phase 8; extract these
- `open-seo-main/src/components/ui/` — parallel copies; compare for differences before extracting
- Both apps use: button, card, input, label, select, tabs, separator, badge, dialog, dropdown-menu, switch, tooltip

### Established Patterns
- shadcn/ui uses `cn()` utility (clsx + tailwind-merge) — goes into `packages/ui/src/lib/utils.ts`
- Radix UI primitives as peer dependencies
- `class-variance-authority` for component variants

### Integration Points
- `apps/web/package.json` adds `"@tevero/ui": "workspace:*"`
- `next.config.ts` adds `transpilePackages: ['@tevero/ui', '@tevero/types']`
- All `import { Button } from '@/components/ui/button'` → `import { Button } from '@tevero/ui'`

</code_context>

<specifics>
## Specific Ideas

- Internal workspace packages, no npm publish needed
- Next.js transpilePackages handles TypeScript source directly — no build step for packages
- Storybook deferred (not needed for v2.0)

</specifics>

<deferred>
## Deferred Ideas

- Storybook / component documentation — post v2.0
- Design token theming (dark mode) — post v2.0
- open-seo Tailwind alignment — Phase 10

</deferred>
