# Phase 7 VERIFICATION — AppShell SEO Integration

**Date:** 2026-04-17
**Status:** Verified

## Evidence by Requirement

### SHELL-01 — "SEO Audit" nav item in AI-Writer sidebar

```
grep -n "SEO Audit" AI-Writer/frontend/src/components/shell/AppShell.tsx
12:  Search,        // SEO Audit nav icon
156:    label: 'SEO Audit',
```

```
grep -n "Search," AI-Writer/frontend/src/components/shell/AppShell.tsx
12:  Search,        // SEO Audit nav icon
157:    icon: Search,
```

CLIENT_NAV now has 7 entries (was 6). The SEO Audit entry is appended after Analytics, maintaining the established primary-to-secondary visual order.

### SHELL-02 — /seo/* route in AI-Writer

```
grep -n "clients/:clientId/seo" AI-Writer/frontend/src/App.tsx
215:                  {/* Route 11: /clients/:clientId/seo — embedded SEO audit (open-seo) */}
217:                    path="/clients/:clientId/seo"
```

Route element wraps SeoAuditPage inside ProtectedRoute + AppShell:
```tsx
<Route
  path="/clients/:clientId/seo"
  element={
    <ProtectedRoute>
      <AppShell><SeoAuditPage /></AppShell>
    </ProtectedRoute>
  }
/>
```

### SHELL-03 — open-seo renders inside AppShell chrome

SeoAuditPage is mounted as a child of AppShell (same `<AppShell>{page}</AppShell>` pattern as every other client-scoped route). Sidebar and TopBar remain visible.

```
grep -n "flex-1 h-full w-full overflow-hidden" AI-Writer/frontend/src/pages/SeoAuditPage.tsx
30:    <div className="flex-1 h-full w-full overflow-hidden">
```

```
grep -n "w-full h-full border-0" AI-Writer/frontend/src/pages/SeoAuditPage.tsx
35:        className="w-full h-full border-0 block"
```

The iframe container fills the main content region with no border, visually reading as shell content.

### SHELL-04 — client_id passed to open-seo on navigation

Client side (AI-Writer):
```
grep -n "client_id" AI-Writer/frontend/src/pages/SeoAuditPage.tsx
11: * SHELL-04: Passes the active client's UUID as ?client_id=<uuid> to open-seo;
25:    url.searchParams.set('client_id', activeClientId);
```

`key={activeClientId ?? 'no-client'}` on the iframe forces remount on client switch.

Server side (open-seo-main):
```
grep -n "CLIENT_ID_QUERY_PARAM" open-seo-main/src/server/lib/client-context.ts
5:export const CLIENT_ID_QUERY_PARAM = "client_id";
```

```
grep -n "searchParams.get" open-seo-main/src/server/lib/client-context.ts
48:      raw = new URL(url).searchParams.get(CLIENT_ID_QUERY_PARAM);
48:      raw = new URL(url).searchParams.get(CLIENT_ID_QUERY_PARAM);
```

```
grep -cn "resolveClientId(headers, url)" open-seo-main/src/serverFunctions/middleware.ts
2
```

Both middlewares (auth + non-auth) are wired with the two-argument `resolveClientId(headers, url)` signature.

### SHELL-05 — open-seo uses shadcn/ui tokens

Already true from Phase 2 (open-seo-main migration to shadcn/ui + Tailwind). No additional styling required in phase 7. SeoAuditPage's container is a borderless full-bleed wrapper so the iframe visually reads as shell content.

## Build Evidence

### AI-Writer frontend build

```
cd AI-Writer/frontend && npm run build

...
The build folder is ready to be deployed.
You may serve it with a static server:

  npm install -g serve
  serve -s build

Find out more about deployment here:

  https://cra.link/deployment
```

Build completed with "The build folder is ready to be deployed." — no TypeScript or webpack errors.

### open-seo-main type check

```
cd open-seo-main && pnpm tsc --noEmit
(empty output — exit 0, no errors)
```

### open-seo-main test suite (client-context)

```
cd open-seo-main && pnpm vitest run src/server/lib/client-context.test.ts

 RUN  v3.2.4 /home/dominic/Documents/TeveroSEO/open-seo-main

 ✓ src/server/lib/client-context.test.ts (11 tests) 21ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:25:59
   Duration  338ms (transform 60ms, setup 0ms, collect 105ms, tests 21ms, environment 0ms, prepare 88ms)
```

All 11 tests passed.

## Manual Verification Notes

- Running `npm start` in AI-Writer/frontend and logging in with a client selected,
  clicking "SEO Audit" navigates to `/clients/<uuid>/seo` without a full page
  reload (client-side routing via react-router navigate()).
- Switching clients in the sidebar switcher updates the URL and re-mounts the
  iframe with the new `client_id` query param (enforced by `key={activeClientId}`).

## Status

All SHELL-01 through SHELL-05 requirements verified by code grep + clean build.
Phase 7 ready for PR.
