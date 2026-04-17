---
phase: 08-next-js-unified-shell
plan: "04"
subsystem: shell-layout
tags: [appshell, clerk, zustand, next-navigation, route-group, fastapi-proxy, typescript]

dependency_graph:
  requires:
    - phase: 08-02
      provides: Clerk middleware + auth() in server context
    - phase: 08-03
      provides: clientStore, server-fetch, ui components (popover, command, dialog)
  provides:
    - AppShell (sidebar + topbar + command palette) as Next.js client component
    - ClientSwitcher standalone component with router.refresh() on select
    - ThemeProvider (dark/light) with localStorage guard
    - TeveroMark + TeveroLogo brand components
    - (shell) route group layout wrapping all signed-in pages
    - lib/active-client.ts server-only cookie reader
    - GET/POST /api/clients proxy route
    - GET/PATCH/DELETE /api/clients/[clientId] proxy route
    - GET /api/platform-secrets/status proxy route
  affects:
    - 08-05 (pages go under (shell)/clients/ — get AppShell automatically)
    - 08-06 (same — all pages in (shell) route group)

tech-stack:
  added: []
  patterns:
    - router.push cast via Parameters<typeof router.push>[0] for typedRoutes
    - router.refresh() after setActiveClient to force server component re-render
    - (shell) route group: parentheses in dir name, excluded from URL
    - server-only import in active-client.ts prevents accidental client-side import
    - AnyRoute = any with eslint-disable-line (no rule name) for redirect() cast
    - FastApiError catch pattern in route handlers (status passthrough)

key-files:
  created:
    - apps/web/src/components/shell/AppShell.tsx
    - apps/web/src/components/shell/TopBar.tsx
    - apps/web/src/components/shell/CommandPalette.tsx
    - apps/web/src/components/ClientSwitcher/ClientSwitcher.tsx
    - apps/web/src/components/ClientSwitcher/index.ts
    - apps/web/src/components/brand/TeveroLogo.tsx
    - apps/web/src/contexts/ThemeContext.tsx
    - apps/web/src/app/(shell)/layout.tsx
    - apps/web/src/app/(shell)/clients/layout.tsx
    - apps/web/src/lib/active-client.ts
    - apps/web/src/app/api/clients/route.ts
    - apps/web/src/app/api/clients/[clientId]/route.ts
    - apps/web/src/app/api/platform-secrets/status/route.ts
  modified: []

decisions:
  - "router.push typedRoutes cast: Parameters<typeof router.push>[0] on all dynamic route strings — same pattern as page-header.tsx from plan 08-03"
  - "router.refresh() after setActiveClient in both ClientSwitcherButton and standalone ClientSwitcher — necessary for server components reading cookie to re-render"
  - "ThemeContext: typeof window guard on localStorage.getItem in useState initializer to prevent SSR hydration mismatch"
  - "TeveroLogo.tsx uses plain <img> with eslint-disable comment for next/next/no-img-element — avoids Next.js Image optimizer for a tiny PNG icon"
  - "active-client.ts redirect cast uses AnyRoute=any with eslint-disable-line (not rule name) — matches page.tsx pattern; @typescript-eslint/no-explicit-any is not configured in this project's ESLint"
  - "FastAPI proxy routes: GET+POST on /api/clients; GET+PATCH+DELETE on /api/clients/[clientId] — covers full CRUD surface for downstream pages"

metrics:
  duration_seconds: 570
  completed_date: "2026-04-17"
  tasks_completed: 3
  files_created: 13
---

# Phase 08 Plan 04: AppShell Port + Route Group Layout + API Proxy Routes Summary

**One-liner:** AppShell sidebar+topbar+command-palette ported from CRA with Next.js router replacements, wired into a (shell) route group layout that auto-wraps signed-in pages, with three FastAPI proxy route handlers establishing the pattern for plans 08-05/06.

## Components Ported in Task 1

| Component | File | Key Changes |
|-----------|------|-------------|
| AppShell | shell/AppShell.tsx | useLocation→usePathname, useNavigate→useRouter, @clerk/clerk-react→@clerk/nextjs, apiClient.get→apiGet, router.push cast for typedRoutes |
| TopBar | shell/TopBar.tsx | Import paths updated to @/ aliases; "use client" added |
| CommandPalette | shell/CommandPalette.tsx | useNavigate→useRouter; router.refresh() on client select |
| ClientSwitcher | ClientSwitcher/ClientSwitcher.tsx | Standalone component; router.refresh() after setActiveClient |
| ClientSwitcher barrel | ClientSwitcher/index.ts | `export { ClientSwitcher }` |
| TeveroMark/TeveroLogo | brand/TeveroLogo.tsx | Pure SVG-equivalent PNG; no router deps; plain img tag |
| ThemeProvider/useTheme | contexts/ThemeContext.tsx | "use client"; typeof window guard on localStorage initializer |

## Router Import Swaps Applied

| CRA pattern | Next.js pattern |
|-------------|----------------|
| `import { useNavigate } from 'react-router-dom'` | `import { useRouter } from 'next/navigation'` |
| `import { useLocation } from 'react-router-dom'` | `import { usePathname } from 'next/navigation'` |
| `navigate(path)` | `router.push(path as Parameters<typeof router.push>[0])` |
| `location.pathname` | `pathname` (from usePathname()) |
| `import { useAuth, UserButton } from '@clerk/clerk-react'` | `import { useAuth, UserButton } from '@clerk/nextjs'` |
| `apiClient.get<T>('/api/x')` | `apiGet<T>('/api/x')` from `@/lib/api-client` |
| `import { ... } from '../../lib/utils'` | `import { ... } from '@/lib/utils'` |
| `import { ... } from '../../stores/clientStore'` | `import { ... } from '@/stores'` |

## FastAPI Proxy Route Pattern (template for 08-05/06)

```ts
import { NextResponse } from "next/server";
import { getFastApi, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getFastApi<ResponseType>("/api/endpoint");
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

Plans 08-05 and 08-06 should follow this exact structure for each new route:
- `/api/articles` (GET list, POST create)
- `/api/articles/[articleId]` (GET, PATCH, DELETE)
- `/api/content-calendar` (GET, POST)
- `/api/analytics` (GET)
- Any additional per-client endpoints

## Task Commits

1. **Task 1: Port shell + brand + context** — `482ea25` (feat)
2. **Task 2: Route group layout + active-client** — `30154a3` (feat)
3. **Task 3: FastAPI proxy route handlers** — `fa063ee` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] typedRoutes cast required on all dynamic router.push calls**
- **Found during:** Task 1 (tsc --noEmit)
- **Issue:** All `router.push(dynamicString)` calls failed with `TS2345: Argument of type string is not assignable to RouteImpl<string>` because typedRoutes is enabled. Affected: AppShell (nav item click + client switcher), CommandPalette (3 calls), ClientSwitcher (2 calls).
- **Fix:** Cast all dynamic route strings via `as Parameters<typeof router.push>[0]` — same pattern established in plan 08-03's page-header.tsx.
- **Files modified:** AppShell.tsx, CommandPalette.tsx, ClientSwitcher.tsx
- **Commit:** 482ea25

**2. [Rule 1 - Bug] redirect() in active-client.ts needs same typedRoutes cast**
- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** `redirect("/clients")` failed with same TS2345 error.
- **Fix:** Added `type AnyRoute = any; // eslint-disable-line` (matching page.tsx pattern) and cast as `AnyRoute`.
- **Files modified:** active-client.ts
- **Commit:** 30154a3 (fixed in fa063ee)

**3. [Rule 1 - Bug] ESLint rule reference in eslint-disable-next-line was unconfigured**
- **Found during:** Task 3 (next build)
- **Issue:** `// eslint-disable-next-line @typescript-eslint/no-explicit-any` caused build failure — `@typescript-eslint/no-explicit-any` is not in this project's ESLint config. Same issue fixed in plan 08-03.
- **Fix:** Changed to `type AnyRoute = any; // eslint-disable-line` (bare disable, no rule name) — exact same pattern as page.tsx.
- **Files modified:** active-client.ts
- **Commit:** fa063ee

## Known Stubs

None — all components are fully wired. The `/api/clients` route handler resolves the stub documented in plan 08-03's SUMMARY.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: unauthenticated-proxy | apps/web/src/app/api/clients/route.ts | Route handler calls getFastApi which reads Clerk JWT via auth() — if Clerk auth() returns no token (unauthenticated request), the Authorization header is omitted; FastAPI's own auth check will reject. No additional Next.js auth guard needed here because middleware already protects all routes in (shell)/. Routes outside (shell)/ are NOT protected by middleware — but /api/clients is also outside the (shell)/ group (it's a top-level /api/ route). Middleware allowlist check: /api/clients is not in the public exemption list so it IS protected by clerkMiddleware(). |

## Self-Check: PASSED

- [x] `apps/web/src/components/shell/AppShell.tsx` exists, contains "use client" and usePathname/useRouter
- [x] `apps/web/src/components/shell/TopBar.tsx` exists
- [x] `apps/web/src/components/shell/CommandPalette.tsx` exists
- [x] `apps/web/src/components/ClientSwitcher/ClientSwitcher.tsx` exists, contains `router.refresh`
- [x] `apps/web/src/components/brand/TeveroLogo.tsx` exists
- [x] `apps/web/src/contexts/ThemeContext.tsx` exists
- [x] `apps/web/src/app/(shell)/layout.tsx` exists, contains `<AppShell>`
- [x] `apps/web/src/app/(shell)/clients/layout.tsx` exists
- [x] `apps/web/src/lib/active-client.ts` exists, contains `import "server-only"` and `ACTIVE_CLIENT_COOKIE`
- [x] `apps/web/src/app/api/clients/route.ts` exists, contains `getFastApi` and `runtime = "nodejs"`
- [x] `apps/web/src/app/api/clients/[clientId]/route.ts` exists
- [x] `apps/web/src/app/api/platform-secrets/status/route.ts` exists
- [x] Zero `react-router-dom` imports in apps/web/src
- [x] Zero `@clerk/clerk-react` imports in apps/web/src
- [x] `pnpm --filter @tevero/web exec tsc --noEmit` exits 0
- [x] `pnpm --filter @tevero/web build` exits 0
- [x] Task commits: 482ea25, 30154a3, fa063ee
