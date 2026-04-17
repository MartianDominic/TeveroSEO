---
phase: 7
plan: "07-03"
title: "Nav registration, route wiring, and phase verification"
subsystem: "AI-Writer frontend shell"
tags: [react-router, appshell, nav, seo-audit, verification]
dependency_graph:
  requires: ["07-01", "07-02"]
  provides: ["SHELL-01", "SHELL-02", "SHELL-03", "SHELL-04", "SHELL-05"]
  affects: ["AI-Writer/frontend/src/components/shell/AppShell.tsx", "AI-Writer/frontend/src/App.tsx"]
tech_stack:
  added: []
  patterns: ["ProtectedRoute + AppShell wrapping pattern", "CLIENT_NAV NavItem array extension"]
key_files:
  created:
    - .planning/phases/07-appshell-seo-integration/07-VERIFICATION.md
  modified:
    - AI-Writer/frontend/src/components/shell/AppShell.tsx
    - AI-Writer/frontend/src/App.tsx
decisions:
  - "SEO Audit nav entry appended after Analytics (bottom of client-scoped section)"
  - "Route 11 inserted immediately before catch-all to maintain route specificity order"
  - "Used git update-index --add for gitignored AI-Writer/ files per parallel agent protocol"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-17"
  tasks_completed: 3
  files_changed: 3
---

# Phase 7 Plan 03: Nav Registration, Route Wiring, and Phase Verification Summary

**One-liner:** Wired SeoAuditPage into AppShell CLIENT_NAV (Search icon, /clients/${id}/seo href) and registered the /clients/:clientId/seo React Router route inside ProtectedRoute + AppShell, with clean CRA build and all 11 client-context tests passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Search icon + SEO Audit to CLIENT_NAV | 6e839db | AppShell.tsx |
| 2 | Register /clients/:clientId/seo route in App.tsx | 91dd07c | App.tsx |
| 3 | Build verification + VERIFICATION.md | 6399864 | 07-VERIFICATION.md |

## What Was Built

### Task 1 — AppShell.tsx
- Added `Search` to the lucide-react import block (after `List,`)
- Appended `{ label: 'SEO Audit', icon: Search, href: (id) => \`/clients/${id}/seo\`, clientScoped: true }` to CLIENT_NAV
- CLIENT_NAV now has 7 entries (was 6); existing entries untouched

### Task 2 — App.tsx
- Added `import SeoAuditPage from './pages/SeoAuditPage';` (after ArticleLibraryPage import)
- Added Route 11: `/clients/:clientId/seo` element wrapped in `<ProtectedRoute><AppShell><SeoAuditPage /></AppShell></ProtectedRoute>`
- Route inserted before the catch-all redirect

### Task 3 — Verification
- AI-Writer frontend `npm run build` completed successfully ("build folder is ready to be deployed")
- `pnpm tsc --noEmit` in open-seo-main exits 0 (no TypeScript errors)
- `pnpm vitest run src/server/lib/client-context.test.ts` — 11/11 tests passed
- VERIFICATION.md created at `.planning/phases/07-appshell-seo-integration/07-VERIFICATION.md` with grep evidence for SHELL-01 through SHELL-05

## Deviations from Plan

None — plan executed exactly as written. AppShell.tsx and App.tsx staged via `git update-index --add` per the parallel agent protocol for gitignored files.

## Requirements Satisfied

| Requirement | Status |
|------------|--------|
| SHELL-01 — SEO Audit nav item in sidebar | Verified |
| SHELL-02 — /clients/:clientId/seo route exists | Verified |
| SHELL-03 — open-seo renders inside AppShell chrome | Verified |
| SHELL-04 — client_id flows from activeClientId to iframe to open-seo server | Verified |
| SHELL-05 — open-seo uses shadcn/ui tokens (Phase 2 satisfied) | Verified |

## Known Stubs

None. SeoAuditPage reads `REACT_APP_SEO_AUDIT_URL` from env (falls back to `https://app.openseo.so`); the env var is documented in `AI-Writer/frontend/env_template.txt` (from plan 07-02).

## Phase 7 Status

All three plans (07-01, 07-02, 07-03) complete. Phase 7 is ready for PR.

## Self-Check: PASSED

- `AI-Writer/frontend/src/components/shell/AppShell.tsx` modified: FOUND (commit 6e839db)
- `AI-Writer/frontend/src/App.tsx` modified: FOUND (commit 91dd07c)
- `.planning/phases/07-appshell-seo-integration/07-VERIFICATION.md` created: FOUND (commit 6399864)
