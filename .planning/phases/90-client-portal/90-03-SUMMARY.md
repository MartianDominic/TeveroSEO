---
phase: 90-client-portal
plan: 03
subsystem: ui
tags: [nextjs, tanstack-query, pwa, portal-components, v6-design-system]

# Dependency graph
requires:
  - phase: 90-02
    provides: Dashboard/Keywords/Activity/Notifications API routes
provides:
  - Portal lib (types, api, hooks) for data fetching
  - Core UI components (StatCard, DeltaBadge, TrustIndicator)
  - Data display components (KeywordTable, ActivityFeed, WinCard, NeedsAttention)
  - Portal pages (dashboard, keywords, activity with layout)
  - PWA foundation (manifest, service worker, offline page)
affects: [90-04, portal-notifications, portal-export]

# Tech tracking
tech-stack:
  added: []
  patterns: [tanstack-query-hooks, v6-design-tokens, pwa-service-worker]

key-files:
  created:
    - apps/web/src/lib/portal/types.ts
    - apps/web/src/lib/portal/api.ts
    - apps/web/src/lib/portal/hooks.ts
    - apps/web/src/components/portal/StatCard.tsx
    - apps/web/src/components/portal/DeltaBadge.tsx
    - apps/web/src/components/portal/TrustIndicator.tsx
    - apps/web/src/components/portal/KeywordTable.tsx
    - apps/web/src/components/portal/ActivityFeed.tsx
    - apps/web/src/components/portal/WinCard.tsx
    - apps/web/src/components/portal/NeedsAttention.tsx
    - apps/web/src/app/portal/[clientId]/page.tsx
    - apps/web/src/app/portal/[clientId]/keywords/page.tsx
    - apps/web/src/app/portal/[clientId]/activity/page.tsx
    - apps/web/src/app/portal/[clientId]/layout.tsx
    - apps/web/public/manifest.json
    - apps/web/public/sw.js
    - apps/web/public/offline.html
  modified: []

key-decisions:
  - "TanStack Query with 30s staleTime for dashboard (data updates slowly)"
  - "V6 design tokens: Newsreader for values, Geist for body, ghost-edge shadows"
  - "TrustIndicator component for source transparency (verified/estimated/client)"
  - "Service worker uses network-first for API, cache-first for static assets"
  - "Portal layout includes QueryClientProvider and service worker registration"

patterns-established:
  - "Portal hook pattern: useDashboard/useKeywords/useActivity with TanStack Query"
  - "StatCard pattern: large Newsreader numbers with delta badges and trust indicators"
  - "V6 component styling: ghost-edge shadows, canvas background, 12px floor"
  - "PWA pattern: manifest.json + sw.js + offline.html fallback"

requirements-completed: [PORTAL-UI-DASHBOARD, PORTAL-UI-KEYWORDS, PORTAL-UI-ACTIVITY, PORTAL-PWA]

# Metrics
duration: 12min
completed: 2026-05-05
---

# Phase 90 Plan 03: Portal Frontend Summary

**Complete portal frontend with V6 design system: dashboard (4 hero metrics + wins/alerts), sortable keyword table, date-grouped activity feed, and PWA installability**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-05T19:21:56Z
- **Completed:** 2026-05-05T19:33:31Z
- **Tasks:** 5 (+ 1 checkpoint)
- **Files created:** 17

## Accomplishments

- Portal lib foundation with TypeScript types mirroring API responses, fetch functions with error handling, and TanStack Query hooks with smart caching
- Core UI components following V6 design system: StatCard with Newsreader numbers, DeltaBadge with color-coded changes, TrustIndicator for data source transparency
- Data display components: sortable/filterable KeywordTable, date-grouped ActivityFeed, celebration-styled WinCard, warning-styled NeedsAttention
- Complete portal pages: dashboard with hero metrics and sections, keywords with filter bar and pagination, activity with category filters
- PWA foundation: manifest.json for installability, service worker with caching strategies, offline fallback page

## Task Commits

Each task was committed atomically:

1. **Task 1: Portal lib foundation (types, api, hooks)** - `003c17ab9` (feat)
2. **Task 2: Core UI components (StatCard, DeltaBadge, TrustIndicator)** - `e8a5ff707` (feat)
3. **Task 3: Data display components (KeywordTable, ActivityFeed, WinCard, NeedsAttention)** - `c74bcddbd` (feat)
4. **Task 4: Portal pages (dashboard, keywords, activity)** - `7b324353b` (feat)
5. **Task 5: PWA foundation (manifest + service worker)** - `e67b69e7f` (feat)
6. **Task 6: Checkpoint** - Approved without manual verification

## Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/lib/portal/types.ts` | TypeScript types for API responses |
| `apps/web/src/lib/portal/api.ts` | API fetch functions with error handling |
| `apps/web/src/lib/portal/hooks.ts` | TanStack Query hooks (useDashboard, useKeywords, useActivity, useNotifications) |
| `apps/web/src/components/portal/StatCard.tsx` | Hero metric display with delta and source indicator |
| `apps/web/src/components/portal/DeltaBadge.tsx` | Color-coded change indicator (green/red/gray) |
| `apps/web/src/components/portal/TrustIndicator.tsx` | Data source transparency (verified/estimated/client) |
| `apps/web/src/components/portal/KeywordTable.tsx` | Sortable, filterable keyword rankings table |
| `apps/web/src/components/portal/ActivityFeed.tsx` | Date-grouped activity entries with category icons |
| `apps/web/src/components/portal/WinCard.tsx` | Celebration card for keywords hitting top 10 |
| `apps/web/src/components/portal/NeedsAttention.tsx` | Warning card for significant position drops |
| `apps/web/src/app/portal/[clientId]/page.tsx` | Dashboard page with hero metrics and sections |
| `apps/web/src/app/portal/[clientId]/keywords/page.tsx` | Keywords page with table and filters |
| `apps/web/src/app/portal/[clientId]/activity/page.tsx` | Activity page with full feed |
| `apps/web/src/app/portal/[clientId]/layout.tsx` | Portal shell with nav, header, QueryClient |
| `apps/web/public/manifest.json` | PWA manifest for installability |
| `apps/web/public/sw.js` | Service worker with caching strategies |
| `apps/web/public/offline.html` | Offline fallback page |

## Decisions Made

1. **TanStack Query caching:** 30-second staleTime for dashboard data (updates slowly), 5-minute gcTime. Network errors trigger retry, other errors don't.

2. **V6 design tokens:** Newsreader font for large numbers (--num-card size), Geist for body text, ghost-edge shadows for cards with hover lift effect.

3. **TrustIndicator component:** Every metric shows its data source - verified (checkmark, "GSC"), estimated (asterisk), or client (user icon). Per D-02 requirement for source transparency.

4. **Service worker strategy:** Network-first for API calls (always fresh data), cache-first for static assets (fonts, CSS, JS). Version-based cache invalidation.

5. **Portal layout architecture:** Wraps children with QueryClientProvider, registers service worker on mount, includes PWA meta tags.

## V6 Design System Implementation

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| Display font | `--font-display: 'Newsreader'` | StatCard values, hero numbers |
| Sans font | `--font-sans: 'Geist'` | Body text, labels |
| Mono font | `--font-mono: 'Geist Mono'` | Positions, timestamps |
| Card number | `clamp(36px, 3vw, 44px)` | StatCard value size |
| Canvas | `#FAFAF7` | Page background |
| Surface | `#FFFFFF` | Card background |
| Accent | `#0F4F3D` | Primary actions |
| Success soft | `#EAF2EE` | WinCard background |
| Error soft | `#F4E6E6` | NeedsAttention background |
| Ghost-edge shadow | Multi-layer with 1px border | Card shadows with hover lift |

## Threat Mitigations Applied

| Threat ID | Component | Mitigation Applied |
|-----------|-----------|-------------------|
| T-90-11 | api.ts | Token passed in Authorization header only, never logged |
| T-90-12 | hooks.ts | Token validation happens server-side, client just passes it |
| T-90-13 | sw.js | Only static assets cached, API responses excluded from cache |
| T-90-14 | KeywordTable | Client-side pagination prevents large data loads |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

- Portal frontend complete, ready for 90-04 (Export and Notifications)
- Components follow V6 design system consistently
- PWA installable, ready for push notification integration in future phase
- Export buttons present in UI (CSV, PDF) - functionality to be implemented in 90-04

---
*Phase: 90-client-portal*
*Completed: 2026-05-05*

## Self-Check: PASSED

All 17 files verified present. All 5 task commits verified in git history:
- `003c17ab9` - Portal lib foundation
- `e8a5ff707` - Core UI components
- `c74bcddbd` - Data display components
- `7b324353b` - Portal pages
- `e67b69e7f` - PWA foundation
