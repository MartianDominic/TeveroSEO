---
plan: 08-05
phase: 08-next-js-unified-shell
status: complete
completed: 2026-04-17
---

# Plan 08-05 Summary: First 5 AI-Writer Pages Port

## What Was Built

Ported the first batch of AI-Writer pages into `apps/web/(shell)` route group:

### Pages Created
- `apps/web/src/app/(shell)/clients/page.tsx` — ClientListPage with Add Client modal
- `apps/web/src/app/(shell)/clients/[clientId]/page.tsx` — ClientDashboardPage
- `apps/web/src/app/(shell)/clients/[clientId]/layout.tsx` — per-client layout with clientId context
- `apps/web/src/app/(shell)/clients/[clientId]/calendar/page.tsx` — ContentCalendarPage
- `apps/web/src/app/(shell)/clients/[clientId]/intelligence/page.tsx` — IntelligencePage
- `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx` — ClientSettingsPage
- `apps/web/src/app/(shell)/clients/[clientId]/analytics/page.tsx` — Analytics stub (Phase 14 full impl)

### Stores Ported
- `apps/web/src/stores/analyticsStore.ts` — analytics data Zustand store
- `apps/web/src/stores/contentCalendarStore.ts` — content calendar Zustand store
- `apps/web/src/stores/intelligenceStore.ts` — intelligence/keyword Zustand store

### API Proxy Routes Added
- `apps/web/src/app/api/content-calendar/route.ts` + event sub-routes
- `apps/web/src/app/api/analytics/[clientId]/route.ts`
- `apps/web/src/app/api/client-intelligence/[clientId]/route.ts`
- `apps/web/src/app/api/client-settings/[clientId]/route.ts`
- `apps/web/src/components/App/InitialRouteHandler.tsx` — client-aware redirect helper

### Supporting Components
- `apps/web/src/components/onboarding/AddClientModal.tsx`
- `apps/web/src/components/onboarding/GettingStartedCard.tsx`
- `apps/web/src/lib/clientSettings.ts`

## Key Decisions

- Analytics page is a stub — full implementation deferred to Phase 14 (analytics-ux-agency-dashboard)
- All stores use `apiGet/apiPost` from `@/lib/api-client` — no direct backend calls
- `useParams<{ clientId: string }>()` replaces react-router-dom `useParams`
- `router.push(path as Parameters<typeof router.push>[0])` pattern for typedRoutes compatibility

## Self-Check: PASSED

- Pages compile clean (`tsc --noEmit` in apps/web)
- No react-router-dom imports remain
- No @clerk/clerk-react imports remain
- All stores use workspace-scoped api-client pattern
