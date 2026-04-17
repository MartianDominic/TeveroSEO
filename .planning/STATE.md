---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Unified Product
status: executing
last_updated: "2026-04-17T22:20:00.000Z"
last_activity: 2026-04-17
progress:
  total_phases: 14
  completed_phases: 8
  total_plans: 37
  completed_plans: 35
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** One Next.js app at app.tevero.lt. Single Clerk login. AI-Writer content tools + SEO tools as first-class routes. Per-client GSC/GA4 credentials via magic-link invites. Nightly analytics sync across 100 clients.

**Current focus:** Phase 09 — shared-ui-package-design-system

## Current Position

Phase: 09 (shared-ui-package-design-system) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-04-17

## Completed Phases (v1.0)

| Phase | Title | Status |
|-------|-------|--------|
| 01 | AI-Writer Backend Cleanup | ✅ Complete |
| 02 | CF Bindings Removal + Schema Migration | ✅ Complete |
| 03 | BullMQ + Redis KV Replacement | ✅ Complete |
| 04 | Unified Docker Infrastructure | ✅ Complete |
| 05 | CI/CD Pipeline | ✅ Complete |
| 06 | Clerk + Per-Client Workspace Integration | ✅ Complete |
| 07 | AppShell SEO Integration (iframe) | ✅ Complete |

## Upcoming Phases (v2.0)

| Phase | Title | Est. Effort | Status |
|-------|-------|-------------|--------|
| 08 | Next.js Unified Shell | 3 weeks | 🔲 Not started |
| 09 | Shared UI Package + Design System | 1 week | 🔲 Not started |
| 10 | open-seo Frontend Absorption | 2–3 weeks | 🔲 Not started |
| 11 | Clerk Auth Unified — open-seo Backend | 1–2 weeks | 🔲 Not started |
| 12 | Per-Client Credentials System | 3 weeks | 🔲 Not started |
| 13 | Analytics Data Layer | 2 weeks | 🔲 Not started |
| 14 | Analytics UX — Agency Dashboard | 2 weeks | 🔲 Not started |

## Sub-project Status

| Sub-project | Status | Notes |
|-------------|--------|-------|
| AI-Writer frontend (CRA) | 🔄 To be replaced | Phases 08–10 replace with Next.js |
| AI-Writer backend (FastAPI) | ✅ Stable | Unchanged in v2.0 |
| open-seo frontend (TanStack Start) | 🔄 To be absorbed | Phase 10 absorbs into apps/web |
| open-seo backend (Node.js/Nitro) | ✅ Stable | Unchanged except auth in Phase 11 |
| apps/web (Next.js) | 🔲 Not yet created | Phase 08 scaffolds this |
| packages/ui (shared components) | 🔲 Not yet created | Phase 09 extracts this |

## Decisions

- React 19.0.0 used (Next.js 15 default; no peer issues encountered) — [08-01]
- Tailwind v4 pinned at 4.1.17 (not 4.0.0 per plan — @tailwindcss/postcss 4.0.0 incompatible with Next.js 15.1.6) — [08-01]
- globals.css uses oklch() color space (Tailwind v4 native; replaces hsl() vars from CRA) — [08-01]
- packages/ui and packages/types tsconfig.json uses standalone compilerOptions (not extending apps/web) to avoid circular reference during bootstrap — [08-01]
- standalone output lives at .next/standalone/apps/web/server.js (monorepo path, normal for pnpm workspaces) — [08-01]
- Public route allowlist pattern: protect everything, explicitly exempt /sign-in(.*), /sign-up(.*), /connect/(.*), /api/health — [08-02]
- force-dynamic on root page.tsx to prevent build-time Clerk key validation error during static prerender — [08-02]
- typedRoutes moved from experimental to top-level (Next.js 15.5 promotes it) — [08-02]
- Valid-format placeholder key pk_test_Y2xlcmsuZXhhbXBsZS5jb20k used in .env.local so build succeeds without real keys — [08-02]
- Smoke test gracefully skips with exit 0 when only placeholder Clerk keys present (Clerk validates sk at runtime for all routes) — [08-02]
- cookieStorage adapter persists only activeClientId (not full clients array) to tevero-active-client-id cookie — [08-03]
- server-fetch marked server-only to prevent accidental client import; browser api-client calls only same-origin /api/* routes — [08-03]
- page-header useNavigate replaced with useRouter (next/navigation); backHref cast via Parameters<typeof router.push>[0] for typedRoutes — [08-03]
- 22 shadcn/ui components ported (plan said 23 — CRA source has 22, plan file list has 22; off-by-one in acceptance criteria) — [08-03]
- router.push typedRoutes cast: Parameters<typeof router.push>[0] on all dynamic route strings in shell components — [08-04]
- router.refresh() after setActiveClient in ClientSwitcherButton and standalone ClientSwitcher — necessary for server components reading cookie to re-render — [08-04]
- ThemeContext typeof window guard on localStorage initializer to prevent SSR hydration mismatch — [08-04]
- active-client.ts redirect cast uses AnyRoute=any with eslint-disable-line (matches page.tsx pattern; @typescript-eslint/no-explicit-any not in ESLint config) — [08-04]
- packages/ui and packages/types bootstrapped as workspace packages with direct TS source exports — no build step; transpilePackages wired in plan 03 — [09-01]
- Client.is_archived added proactively to @tevero/types (wider than apps/web local type); plan 03 aligns apps/web to use shared type — [09-01]
- cn() exists in both packages/ui/src/lib/utils.ts and apps/web/src/lib/utils.ts intentionally; plan 03 removes apps/web copy after import rewire — [09-01]

- next added as peer+dev dep to packages/ui — page-header.tsx uses next/navigation; needed for tsc type resolution in isolation — [09-02]
- CommandDialog omitted from @tevero/ui barrel — not present in command.tsx source; plan 03 must not import it — [09-02]
- DialogTrigger, DialogClose, DialogFooter added to dialog.tsx (absent from apps/web source but required by barrel plan) — [09-02]
- TableFooter, TableCaption added to table.tsx (absent from apps/web source but required by barrel plan) — [09-02]

## Next Up

Phase 09: Shared UI Package + Design System — plan 03 next (rewire apps/web imports to @tevero/ui)
