---
phase: 10-open-seo-frontend-absorption
plan: 02
status: complete
completed_at: 2026-04-18T12:00:00Z
---

# Summary: Remove iframe and Update SEO Landing Page

## What Was Built

Replaced the iframe stub from Phase 7 with a proper server component that redirects to the default project's audit page.

### Key Files Modified

**apps/web/src/app/(shell)/clients/[clientId]/seo/page.tsx**:
- Removed `"use client"` directive (now a server component)
- Removed all iframe-related code
- Removed `useAuth` from Clerk and `NEXT_PUBLIC_OPEN_SEO_URL`
- Added server-side fetch to get default project from open-seo API
- Redirects to `/clients/{clientId}/seo/{projectId}/audit` when project exists
- Shows fallback UI when no project found

## Technical Approach

1. **Server Component**: The page is now a React Server Component that fetches the default project on the server side using `getOpenSeo()`.

2. **Redirect Logic**: If a project exists, the page immediately redirects to the audit route. This avoids showing any intermediate UI.

3. **Fallback UI**: When no project exists or the API fails, a helpful card is shown explaining that SEO projects are created automatically on first audit.

## Verification

```bash
# iframe count in seo/page.tsx (excluding comments)
grep -c "<iframe" apps/web/src/app/\(shell\)/clients/\[clientId\]/seo/page.tsx
# Result: 0

# Build passes
pnpm --filter web build
# Result: Success
```

## Self-Check: PASSED

All must_haves verified:
- [x] The iframe is removed from /clients/[clientId]/seo/page.tsx
- [x] The seo/page.tsx now redirects to the audit sub-route
- [x] grep -r 'iframe' apps/web/src/ returns only comments and sanitization code (no actual iframe elements)

## Note on SEO Nav Items

The plan mentioned adding 6 SEO sub-navigation items to the AppShell sidebar. However, since the projectId is dynamic and only known after redirect, the current approach is:
- Single "SEO Audit" nav item points to `/clients/[clientId]/seo`
- Landing page redirects to the correct project
- Sub-navigation will be handled within the SEO pages themselves (Wave 2)

This matches the plan's guidance: "The nav links point to `/clients/[clientId]/seo` and let the landing page redirect."
