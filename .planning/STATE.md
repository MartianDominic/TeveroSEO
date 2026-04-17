---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Unified Product
status: Scoped — ready to plan Phase 08
last_updated: "2026-04-17T21:00:00.000Z"
last_activity: 2026-04-17
progress:
  total_phases: 14
  completed_phases: 7
  total_plans: 28
  completed_plans: 28
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** One Next.js app at app.tevero.lt. Single Clerk login. AI-Writer content tools + SEO tools as first-class routes. Per-client GSC/GA4 credentials via magic-link invites. Nightly analytics sync across 100 clients.

**Current focus:** v2.0 scoped — Phase 08 next (Next.js unified shell)

## Current Position

Phase: 08 (not yet started)
Plan: Not started
Status: Scoped — ready to plan Phase 08
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

## Next Up

Phase 08: Next.js Unified Shell — scaffold apps/web with Next.js 15 App Router + @clerk/nextjs, port all AI-Writer routes, retire CRA frontend, update docker-compose + nginx
