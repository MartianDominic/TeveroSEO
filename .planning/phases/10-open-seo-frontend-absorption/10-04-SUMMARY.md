---
phase: 10-open-seo-frontend-absorption
plan: 04
status: complete
completed_at: 2026-04-18T12:30:00Z
---

# Summary: Port Keywords, Backlinks, and Domain Pages

## What Was Built

Created three additional SEO pages: keyword research, backlink analysis, and domain overview.

### Key Files Created

**Pages:**
- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/page.tsx`
  - Keyword research with seed keyword input
  - Location and result limit selectors
  - Results table with selection for saving
  - Saved keywords list with delete

- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/backlinks/page.tsx`
  - Target URL/domain input with scope selector
  - Tabbed view: Overview, Referring Domains, Top Pages
  - Overview stats: total backlinks, referring domains, domain rank, spam score
  - Domain and page lists with metrics

- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/domain/page.tsx`
  - Domain input for analysis
  - Overview stats: organic traffic, keywords, backlinks, domain rank
  - Traffic trend indicator
  - Top keywords table with positions
  - Organic competitors list

## Technical Approach

1. **TanStack Query**: All pages use useQuery/useMutation for data fetching
2. **Server Actions**: Call `@/actions/seo/keywords`, `@/actions/seo/backlinks`, `@/actions/seo/domain`
3. **URL State**: Search params synchronized with component state for shareable URLs
4. **@tevero/ui Components**: Full use of shared UI library

## Verification

- `pnpm --filter web build` passes with all routes
- No `@tanstack/react-router` imports in apps/web/src/
- All server action calls use `{ projectId, clientId, ...data }` shape

## Self-Check: PASSED

All must_haves verified:
- [x] GET /clients/[clientId]/seo/[projectId]/keywords renders the keyword research page
- [x] GET /clients/[clientId]/seo/[projectId]/backlinks renders the backlinks page
- [x] GET /clients/[clientId]/seo/[projectId]/domain renders the domain overview page
- [x] All three pages use TanStack Query for data fetching via server actions
- [x] No @tanstack/react-router imports in any ported file
