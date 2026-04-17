# Phase 8: Next.js Unified Shell - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold `apps/web` as a Next.js 15 App Router application inside a new pnpm workspace. Port all 11 AI-Writer pages as App Router routes. Wire `@clerk/nextjs` middleware for route protection. All FastAPI backend calls made via Next.js server actions (no cross-origin browser requests). Replace `ai-writer-frontend` Docker container with `web` container. Update nginx to serve `app.tevero.lt` from the new container. Delete `AI-Writer/frontend/` at end of this phase.

This phase does NOT absorb open-seo frontend routes (Phase 10) or extract shared UI components (Phase 9). It is purely: new Next.js shell + port AI-Writer routes + retire CRA.

</domain>

<decisions>
## Implementation Decisions

### Monorepo Structure
- pnpm workspaces with root `pnpm-workspace.yaml`
- `apps/web/` — Next.js 15 App Router
- `apps/ai-writer-backend/` — rename from `AI-Writer/backend/` (symlink or move)
- `apps/open-seo-api/` — rename from `open-seo-main/` (symlink or move)
- `packages/ui/` — created in Phase 9 (stub only in Phase 8)
- `packages/types/` — created in Phase 9 (stub only in Phase 8)
- Note: actual file moves of backends deferred to avoid breaking CI/CD — Phase 8 adds workspace config and creates apps/web; existing dirs stay in place with workspace aliases

### Tailwind Version
- Tailwind v4 in `apps/web` (aligns with open-seo-main already on v4)
- Use `@tailwindcss/postcss` (v4 postcss plugin) or `@tailwindcss/vite` — Next.js 15 supports both
- AI-Writer/frontend Tailwind v3 becomes irrelevant after CRA retirement at end of phase

### Client State
- Port Zustand `clientStore` from CRA to `apps/web`
- Persist `activeClientId` in a cookie (`js-cookie` or `cookies-next`) so Next.js server components can read it via `cookies()` from `next/headers`
- Cookie name: `tevero-active-client-id`
- Keep same store shape: `{ clients, activeClientId, activeClient, fetchClients, setActiveClient, clearActiveClient }`

### CRA Retirement
- At end of Phase 8, after smoke tests pass: delete `AI-Writer/frontend/` directory
- Update `docker-compose.vps.yml`: remove `ai-writer-frontend` service, add `web` service
- Update nginx: `app.tevero.lt` proxies to `web:3000` (Next.js) instead of `ai-writer-frontend:80`
- Update GitHub Actions `deploy-ai-writer.yml` to build/deploy `apps/web` instead of `AI-Writer/frontend`

### Route Mapping
| CRA route | Next.js App Router route |
|---|---|
| `/` | `app/page.tsx` (redirect to `/clients`) |
| `/clients` | `app/clients/page.tsx` |
| `/clients/:clientId` | `app/clients/[clientId]/page.tsx` |
| `/clients/:clientId/calendar` | `app/clients/[clientId]/calendar/page.tsx` |
| `/clients/:clientId/intelligence` | `app/clients/[clientId]/intelligence/page.tsx` |
| `/clients/:clientId/settings` | `app/clients/[clientId]/settings/page.tsx` |
| `/clients/:clientId/analytics` | `app/clients/[clientId]/analytics/page.tsx` |
| `/clients/:clientId/articles` | `app/clients/[clientId]/articles/page.tsx` |
| `/clients/:clientId/articles/new` | `app/clients/[clientId]/articles/new/page.tsx` |
| `/clients/:clientId/articles/:articleId` | `app/clients/[clientId]/articles/[articleId]/page.tsx` |
| `/settings` | `app/settings/page.tsx` |
| `/clients/:clientId/seo` | `app/clients/[clientId]/seo/page.tsx` (iframe stub, replaced Phase 10) |
| `/sign-in` | `app/sign-in/[[...sign-in]]/page.tsx` (Clerk hosted) |

### Auth
- `@clerk/nextjs` middleware in `middleware.ts` — protect all routes except `/sign-in`, `/connect/*`, `/api/health`
- `clerkMiddleware()` from `@clerk/nextjs/server`
- Server actions use `auth()` from `@clerk/nextjs/server` to get userId + getToken()
- FastAPI calls: `Authorization: Bearer <clerk_jwt>` header added in every server action

### API Calls
- All API calls from browser go to Next.js server actions (never directly to FastAPI)
- Server actions call `http://ai-writer-backend:8000` (Docker internal hostname)
- Pass Clerk JWT via `Authorization: Bearer` header
- Replace axios API client with fetch in server actions; keep axios only for client components that need real-time updates (article editor)

### Docker + nginx
- New `Dockerfile` for `apps/web`: multi-stage, `node:20-alpine`, `pnpm install`, `next build`, `next start`
- `docker-compose.vps.yml`: add `web` service (port 3000), remove `ai-writer-frontend` service
- nginx: update `app.tevero.lt` location block to `proxy_pass http://web:3000`
- Keep `app.openseo.so` / `seo.tevero.lt` nginx block until Phase 10 removes it

### Claude's Discretion
- Exact shadcn/ui component set to copy into `apps/web/components/ui/` (copy from AI-Writer for now; extracted to packages/ui in Phase 9)
- Whether to use `next/font` for typography
- Exact healthcheck path (`/api/health` kept for nginx healthcheck compatibility)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AI-Writer/frontend/src/stores/clientStore.ts` — port directly, change persistence to cookie
- `AI-Writer/frontend/src/components/shell/AppShell.tsx` — port as client component with same NavItem structure
- `AI-Writer/frontend/src/components/ClientSwitcher/` — port as client component
- `AI-Writer/frontend/src/components/ui/` — copy to `apps/web/components/ui/` for now; Phase 9 extracts to packages/ui
- All 11 page files — port as Next.js page.tsx files; most are client components ('use client') due to hooks/state

### Established Patterns
- Route protection: `ProtectedRoute` wrapper → replace with Clerk middleware + `auth()` check
- API calls: axios with `REACT_APP_API_BASE_URL=/api` prefix → Next.js server actions calling `http://ai-writer-backend:8000`
- Clerk publishable key passed as build arg `REACT_APP_CLERK_PUBLISHABLE_KEY` → becomes `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` env var
- Zustand stores with `persist` middleware → keep pattern, change storage to cookie for `clientStore`

### Integration Points
- FastAPI at `ai-writer-backend:8000` (Docker internal) — all `/api/*` routes
- open-seo at `open-seo:3001` (Docker internal) — `/seo` iframe src (temporary until Phase 10)
- Clerk: `CLERK_SECRET_KEY` (server) + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (client)
- nginx: `proxy_pass http://web:3000` replaces `proxy_pass http://ai-writer-frontend:80`

</code_context>

<specifics>
## Specific Ideas

- pnpm workspaces monorepo structure (user confirmed)
- Tailwind v4 for alignment with open-seo (user confirmed)
- Zustand + cookie persist for activeClientId (user confirmed)
- CRA frontend deleted at end of Phase 8 (user confirmed)
- Keep `AI-Writer/backend/` and `open-seo-main/` in place for now — just add `apps/web/` and workspace config

</specifics>

<deferred>
## Deferred Ideas

- Shared `packages/ui` component extraction — Phase 9
- Shared `packages/types` TypeScript types — Phase 9
- open-seo frontend absorption — Phase 10
- better-auth removal from open-seo backend — Phase 11
- Analytics pages (GSC/GA4) — Phase 14
- Physical rename/move of `AI-Writer/backend/` to `apps/ai-writer-backend/` — deferred to avoid CI/CD churn; workspace aliases sufficient for Phase 8

</deferred>
