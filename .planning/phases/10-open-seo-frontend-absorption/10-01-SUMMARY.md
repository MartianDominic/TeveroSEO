---
phase: 10-open-seo-frontend-absorption
plan: 01
status: complete
completed_at: 2026-04-18T12:00:00Z
---

# Summary: Server Actions Layer for open-seo API

## What Was Built

Created the Next.js server actions layer in `apps/web/src/actions/seo/` that proxies all open-seo API calls. Additionally, added REST API wrappers in open-seo to expose the serverFunctions via HTTP endpoints.

### Key Files Created

**apps/web/src/actions/seo/** (5 files):
- `audit.ts` - 6 functions: startAudit, getAuditStatus, getAuditResults, getAuditHistory, getCrawlProgress, deleteAudit
- `keywords.ts` - 5 functions: researchKeywords, saveKeywords, getSavedKeywords, removeSavedKeyword, getSerpAnalysis
- `backlinks.ts` - 3 functions: getBacklinksOverview, getBacklinksReferringDomains, getBacklinksTopPages
- `domain.ts` - 1 function: getDomainOverview
- `projects.ts` - 1 function: getDefaultProject

**open-seo-main/src/routes/api/seo/** (6 files):
- `audits.ts` - REST API wrapper for audit serverFunctions
- `keywords.ts` - REST API wrapper for keyword serverFunctions
- `backlinks.ts` - REST API wrapper for backlinks serverFunctions
- `domain.ts` - REST API wrapper for domain serverFunctions
- `projects.ts` - REST API wrapper for project serverFunctions
- `-middleware.ts` - Shared auth middleware for Phase 10 (placeholder auth, real JWT validation in Phase 11)

## Technical Approach

1. **REST API Layer**: Created TanStack Router file routes in open-seo that wrap existing serverFunctions. These expose HTTP endpoints at `/api/seo/*` that can be called from Next.js.

2. **Server Actions**: Next.js server actions use the existing `postOpenSeo`/`getOpenSeo` helpers from `server-fetch.ts` to call the open-seo REST endpoints.

3. **Auth Flow**: For Phase 10, `client_id` is passed as a query parameter (Phase 7 mechanism). Phase 11 will add Clerk JWT validation.

## Verification

- All server action files have `"use server"` directive
- TypeScript compiles cleanly for both apps/web and open-seo-main
- `pnpm run build` passes for both projects

## Self-Check: PASSED

All must_haves verified:
- [x] Server actions for audit, keywords, backlinks, and domain exist
- [x] Each server action calls http://open-seo-api:3001 via postOpenSeo
- [x] client_id is passed as a query param on every request
- [x] No client-side fetch to open-seo
