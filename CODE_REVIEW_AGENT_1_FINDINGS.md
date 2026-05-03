### Agent 1: Next.js App Router & RSC Architecture (apps/web)

**Status:** Complete
**Scope:** Server Components, Client Components, routing, layouts, middleware

#### Critical Issues

None identified.

#### High Priority Issues

1. **Large Client Component Page - Client Dashboard** (`apps/web/src/app/(shell)/clients/[clientId]/page.tsx:1`)
   - **Issue:** Entire 573-line page is marked `"use client"` which means all data fetching happens client-side. This page fetches analytics, publishing logs, and intelligence status via client-side API calls, losing RSC benefits.
   - **Impact:** Slower initial page load, larger client bundle, no server-side rendering of data, poor SEO for this internal page.
   - **Recommendation:** Refactor to server component for initial data fetch, extract interactive elements (polling, button handlers) into smaller client components.

2. **Proposal Builder Page - Full Client Component** (`apps/web/src/app/(shell)/prospects/[prospectId]/proposal/builder/page.tsx:1`)
   - **Issue:** 454-line page is entirely `"use client"` with multi-step wizard state. While interactivity justifies some client code, initial data fetch (services) could be server-rendered.
   - **Impact:** Services are fetched client-side on mount via `useEffect`, causing layout shift and slower perceived load.
   - **Recommendation:** Fetch `availableServices` in a server component wrapper, pass as prop to client wizard.

3. **AppShell is Fully Client-Side** (`apps/web/src/components/shell/AppShell.tsx:1`)
   - **Issue:** The entire navigation shell (665 lines) is a client component including static nav items, logo, and layout structure.
   - **Impact:** All children must hydrate through client shell. Static parts could be server-rendered.
   - **Observation:** This is partially justified by interactive features (command palette, keyboard shortcuts, client switcher), but the nav structure itself could be static.

#### Medium Priority Issues

1. **Inconsistent Parallel Route Groups**
   - **Issue:** The app uses `(shell)`, `(dashboard)`, and `[locale]` route groups, but `(dashboard)` only contains `command-center` while similar pages exist in `(shell)/dashboard`.
   - **Files:** `apps/web/src/app/(dashboard)/command-center/` vs `apps/web/src/app/(shell)/dashboard/`
   - **Impact:** Confusing structure, potential code duplication, inconsistent layout inheritance.
   - **Recommendation:** Consolidate dashboard routes under one route group.

2. **Limited Loading.tsx Coverage**
   - **Issue:** Only 6 loading.tsx files exist for 200+ routes. Missing for heavy pages like clients list, proposal builder, keyword imports.
   - **Files with loading.tsx:** `settings/`, `dashboard/`, `clients/[clientId]/analytics/`, `reports/`, `seo/`, `connections/`
   - **Impact:** No streaming/progressive loading on data-heavy pages, users see blank states.
   - **Recommendation:** Add loading.tsx to routes that fetch significant data.

3. **Client Components Ratio in /components**
   - **Issue:** 208 of 245 components (85%) are client components. While some interactivity is expected, this is high.
   - **Impact:** Large client bundle, more hydration work.
   - **Recommendation:** Audit for components that could be server components (display-only, no hooks).

4. **Middleware Locale Hardcoding** (`apps/web/middleware.ts:28-48`)
   - **Issue:** Locale routes (`/lt/`) are hardcoded in route matchers. Adding new locales requires updating multiple arrays.
   - **Recommendation:** Generate locale-prefixed routes dynamically from `routing.locales`.

5. **No Parallel Routes or Intercepting Routes Used**
   - **Issue:** App Router supports parallel routes (`@modal`) and intercepting routes for modals, but none are used.
   - **Impact:** Modal dialogs (e.g., add client, settings) require full navigation or client-side state management.
   - **Observation:** Not critical, but missed opportunity for better UX patterns.

6. **Duplicate Default Export in PublicProposalView** (`apps/web/src/app/p/[token]/PublicProposalView.tsx:505`)
   - **Issue:** File has both named export and default export for the same component.
   - **Impact:** Minor, but could cause import confusion.

#### Observations (Good Patterns Found)

1. **Strong Error Boundary Coverage** - 47 error.tsx files provide comprehensive error handling across routes.

2. **Well-Structured Server Actions** (`apps/web/src/app/(shell)/dashboard/actions.ts`)
   - Clean separation of server actions with `"use server"`
   - Proper auth checks via `requireActionAuth()`
   - Input validation with Zod schemas
   - Graceful error handling with fallback values

3. **Good Suspense Usage in Command Center** (`apps/web/src/app/(dashboard)/command-center/page.tsx`)
   - Server component with data fetching
   - Suspense boundaries with skeleton fallbacks
   - Initial data passed to client components for hydration

4. **Middleware is Well-Architected** (`apps/web/middleware.ts`)
   - Rate limiting on auth routes BEFORE other processing
   - Session freshness checks for sensitive routes
   - Clean integration of next-intl with Clerk
   - Good documentation comments

5. **next.config.ts has Strong Security Headers** (`apps/web/next.config.ts`)
   - HSTS with preload
   - CSP with environment-aware script-src (no unsafe-eval in prod)
   - X-Frame-Options DENY
   - Permissions-Policy restricting browser APIs

6. **Proper Async Params Handling** (`apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx`)
   - Correctly uses `Promise<{ prospectId: string }>` for params
   - Awaits params before use

7. **WithErrorBoundary HOC** (`apps/web/src/components/with-error-boundary.tsx`)
   - Proper error boundary implementation
   - Named error boundaries for debugging
   - Logging to error tracking service

8. **Hydration Fix in AppShell** (`apps/web/src/components/shell/AppShell.tsx:414-427`)
   - Correct pattern: Initialize to consistent default, sync with localStorage after mount
   ```typescript
   const [collapsed, setCollapsed] = useState<boolean>(false);
   useEffect(() => {
     const stored = localStorage.getItem(COLLAPSED_KEY);
     if (stored === "true") setCollapsed(true);
   }, []);
   ```

9. **API Route Security** (`apps/web/src/app/api/clients/route.ts`)
   - CSRF validation on POST
   - Zod schema validation
   - Rate limiting per endpoint type
   - Proper error classification and responses

10. **i18n Routing Well Configured** (`apps/web/src/i18n/routing.ts`)
    - Clean locale-prefix strategy (`as-needed`)
    - Static params generation for locales

#### Files Reviewed

- `apps/web/middleware.ts` (143 lines)
- `apps/web/next.config.ts` (116 lines)
- `apps/web/src/app/layout.tsx` (43 lines)
- `apps/web/src/app/page.tsx` (11 lines)
- `apps/web/src/app/(shell)/layout.tsx` (19 lines)
- `apps/web/src/app/[locale]/layout.tsx` (42 lines)
- `apps/web/src/app/(shell)/dashboard/page.tsx` (178 lines)
- `apps/web/src/app/(shell)/clients/[clientId]/page.tsx` (573 lines)
- `apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx` (218 lines)
- `apps/web/src/app/(dashboard)/command-center/page.tsx` (101 lines)
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposal/builder/page.tsx` (454 lines)
- `apps/web/src/app/p/[token]/PublicProposalView.tsx` (506 lines)
- `apps/web/src/app/(shell)/dashboard/actions.ts` (309 lines)
- `apps/web/src/app/api/clients/route.ts` (88 lines)
- `apps/web/src/components/shell/AppShell.tsx` (665 lines)
- `apps/web/src/components/error-boundary.tsx` (106 lines)
- `apps/web/src/i18n/routing.ts` (23 lines)
- Full `apps/web/src/app/` directory structure scan (200+ route files)
