---
phase: 44
plan: 01
subsystem: design-system
tags: [tokens, tailwind, fonts, testing]
dependency_graph:
  requires: []
  provides: [v6-tokens, font-loading, test-infrastructure]
  affects: [apps/web, packages/ui]
tech_stack:
  added: [next/font/google, vitest]
  patterns: [tailwind-v4-theme-inline, css-variables-to-utilities]
key_files:
  created:
    - packages/ui/src/lib/tokens.ts
    - packages/ui/vitest.config.ts
    - packages/ui/vitest.setup.ts
  modified:
    - apps/web/src/app/globals.css
    - apps/web/src/app/layout.tsx
    - packages/ui/src/index.ts
decisions:
  - Use @theme inline for Tailwind v4 token mapping (CSS-first approach)
  - Export all token categories as TypeScript const objects for type safety
  - Configure vitest with 80% coverage thresholds per project requirements
metrics:
  duration: 3m
  completed: 2026-04-30
  tasks: 3
  files: 6
---

# Phase 44 Plan 01: Token Foundation Summary

Tailwind v4 @theme inline mapping with v6 design tokens, Geist/Newsreader font loading via next/font, TypeScript token exports for programmatic access, and vitest test infrastructure for the UI package.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend globals.css with v6 @theme inline mapping | 6d316a9e5 | globals.css, tokens.css |
| 2 | Configure font loading via next/font | 179053203 | layout.tsx |
| 3 | Create TypeScript token exports and test infrastructure | 56683852a | tokens.ts, index.ts, vitest.config.ts, vitest.setup.ts |

## What Was Built

### 1. Tailwind v4 Token Mapping (globals.css)

Extended `apps/web/src/app/globals.css` with `@theme inline {}` block that maps all v6 CSS variables from `tokens.css` to Tailwind utility classes:

- **Colors:** canvas, surface-*, text-*, accent-*, semantic colors (success, error, warning, info)
- **Shadows:** shadow-card, shadow-lift, shadow-pop, shadow-cta, shadow-cta-hover
- **Radii:** radius-input, radius-button, radius-card, radius-modal, radius-pill
- **Spacing:** spacing-1 through spacing-9
- **Fonts:** font-sans, font-mono, font-display

Usage: `className="bg-canvas text-text-1 shadow-card rounded-card"`

### 2. Font Loading (layout.tsx)

Configured three fonts via `next/font/google`:

| Font | Variable | Purpose |
|------|----------|---------|
| Geist | --font-sans | Body text, UI labels |
| Geist_Mono | --font-mono | Code, timestamps, tabular data |
| Newsreader | --font-display | Headlines, display numerals |

Newsreader includes `axes: ['opsz']` for optical sizing support.

### 3. TypeScript Token Exports (tokens.ts)

Created `packages/ui/src/lib/tokens.ts` exporting:

```typescript
export const colors = { canvas: '#FAFAF7', accent: '#0F4F3D', ... } as const;
export const spacing = { space1: '4px', ... } as const;
export const radii = { input: '6px', card: '12px', ... } as const;
export const shadows = { card: '...', lift: '...', ... } as const;
export const typography = { ... } as const;
export const motion = { ... } as const;

export type ColorToken = keyof typeof colors;
// ... type helpers for all categories
```

### 4. Test Infrastructure

Created vitest configuration for `packages/ui`:

- **Environment:** jsdom for DOM testing
- **Setup:** jest-dom matchers via `@testing-library/jest-dom/vitest`
- **Coverage:** v8 provider with 80% thresholds (statements, branches, functions, lines)
- **Pattern:** `src/**/*.test.{ts,tsx}`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- Build: PASSED (`pnpm --filter @tevero/web build` completes successfully)
- Task 1 verification: PASSED (grep confirms @theme inline and @import)
- Task 2 verification: PASSED (grep confirms Geist_Mono, Newsreader, font-sans)
- Task 3 verification: PASSED (grep confirms exports, vitest.config.ts exists)

## Dependencies Note

The test infrastructure requires the following dev dependencies to be added to `packages/ui/package.json`:

```json
{
  "devDependencies": {
    "vitest": "^4.1.5",
    "@vitejs/plugin-react": "^4.x",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/user-event": "^14.x",
    "jsdom": "^26.x"
  }
}
```

These will be installed when running tests for the first time. The configuration files are ready.

## Next Steps

This plan provides the foundation for all subsequent Phase 44 plans:

1. **Plan 02:** Can now use `bg-canvas`, `shadow-card`, `text-accent` utilities
2. **Plan 03+:** Can import `{ colors, radii }` from `@tevero/ui` for type-safe tokens
3. **Component tests:** vitest infrastructure ready for `*.test.tsx` files

## Self-Check: PASSED

All files verified to exist:
- globals.css: FOUND
- layout.tsx: FOUND
- tokens.ts: FOUND
- index.ts: FOUND
- vitest.config.ts: FOUND
- vitest.setup.ts: FOUND

All commits verified:
- 6d316a9e5: FOUND
- 179053203: FOUND
- 56683852a: FOUND
