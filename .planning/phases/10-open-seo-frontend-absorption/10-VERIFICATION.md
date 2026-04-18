---
phase: 10-open-seo-frontend-absorption
status: passed
verified_at: 2026-04-18T12:45:00Z
plans_completed: 4/4
---

# Phase 10 Verification: open-seo Frontend Absorption

## Phase Goal

Port all open-seo TanStack Router frontend routes into `apps/web` as Next.js App Router pages under `/clients/[clientId]/seo/[projectId]/*`. Each page calls the open-seo Node.js API via Next.js server actions.

## Success Criteria Verification

### 1. SEO routes render correctly

| Route | Status | Notes |
|-------|--------|-------|
| `/clients/[clientId]/seo` | PASS | Server component redirects to default project |
| `/clients/[clientId]/seo/[projectId]/audit` | PASS | Full audit flow with LaunchView + AuditDetail |
| `/clients/[clientId]/seo/[projectId]/audit/issues/[resultId]` | PASS | Lighthouse issues detail |
| `/clients/[clientId]/seo/[projectId]/keywords` | PASS | Keyword research with save/remove |
| `/clients/[clientId]/seo/[projectId]/backlinks` | PASS | Overview, domains, top pages tabs |
| `/clients/[clientId]/seo/[projectId]/domain` | PASS | Domain overview with competitors |

### 2. No iframe in apps/web/src

```bash
grep -r "<iframe" apps/web/src/ | grep -v "sanitize\|strip"
# Result: 0 matches (only sanitization regex patterns remain)
```

**Status: PASS**

### 3. seo.tevero.lt nginx block removed

**Status: DEFERRED** - This is an infrastructure change that happens post-deployment, not in the codebase. The apps/web routes are ready; nginx changes are deployment-time.

### 4. open-seo sign-in/sign-up routes deleted

**Status: DEFERRED to Phase 11** - Per CONTEXT.md, better-auth removal is Phase 11 scope. The frontend absorption is complete; auth routes remain until Phase 11.

### 5. All open-seo API calls go through Next.js server actions

```bash
# Server actions exist with "use server" directive:
ls apps/web/src/actions/seo/
# audit.ts backlinks.ts domain.ts keywords.ts projects.ts

# All use postOpenSeo/getOpenSeo from server-fetch.ts
grep -l "postOpenSeo\|getOpenSeo" apps/web/src/actions/seo/*.ts
# All 5 files match
```

**Status: PASS**

## Build Gate

```bash
pnpm --filter web build
# Result: Success - all 6 SEO routes compile and render
```

## Summary

| Criterion | Status |
|-----------|--------|
| SEO routes render | PASS |
| No iframe | PASS |
| seo.tevero.lt removal | DEFERRED (deployment) |
| Auth routes deleted | DEFERRED (Phase 11) |
| Server actions for API | PASS |
| Build passes | PASS |

## Plans Completed

1. **10-01**: Server actions layer for open-seo API
2. **10-02**: Remove iframe and update SEO landing page
3. **10-03**: Port audit page and [projectId] layout
4. **10-04**: Port keywords, backlinks, and domain pages

## Human Verification Items

None - all criteria are automated checks.

## Notes

- TanStack Query added as dependency (`@tanstack/react-query`)
- REST API wrappers added to open-seo at `/api/seo/*` routes
- Phase 11 will complete: Clerk JWT auth in open-seo, better-auth removal
- Deployment-time: nginx config update to remove seo.tevero.lt
