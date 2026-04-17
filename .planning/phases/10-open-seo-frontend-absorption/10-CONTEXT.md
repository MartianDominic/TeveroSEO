# Phase 10: open-seo Frontend Absorption - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated

<domain>
## Phase Boundary

Port all open-seo TanStack Router frontend routes into `apps/web` as Next.js App Router pages under `/clients/[clientId]/seo/[projectId]/*`. Each page calls the open-seo Node.js API via Next.js server actions — no browser-to-open-seo direct calls. Delete open-seo's frontend shell (`_auth.*`, `_app/*`, `__root.tsx`, `_authenticated.tsx`). Remove the iframe from `SeoAuditPage`. Retire `seo.tevero.lt` nginx block. open-seo Node.js process becomes a pure API backend.

</domain>

<decisions>
## Implementation Decisions

### Route Mapping
| open-seo TanStack route | Next.js App Router route |
|---|---|
| `/_project/p/$projectId/audit` | `/clients/[clientId]/seo/[projectId]/audit/page.tsx` |
| `/_project/p/$projectId/audit/issues/$resultId` | `/clients/[clientId]/seo/[projectId]/audit/issues/[resultId]/page.tsx` |
| `/_project/p/$projectId/keywords` | `/clients/[clientId]/seo/[projectId]/keywords/page.tsx` |
| `/_project/p/$projectId/backlinks` | `/clients/[clientId]/seo/[projectId]/backlinks/page.tsx` |
| `/_project/p/$projectId/domain` | `/clients/[clientId]/seo/[projectId]/domain/page.tsx` |
| `/_project/p/$projectId/saved` | `/clients/[clientId]/seo/[projectId]/saved/page.tsx` |
| `/_project/p/$projectId/ai` | `/clients/[clientId]/seo/[projectId]/ai/page.tsx` |
| `/_app/billing` | `/settings/billing/page.tsx` |
| `/_app/help/dataforseo-api-key` | `/settings/help/dataforseo-api-key/page.tsx` |

### API Calls
- Server actions in `apps/web/src/actions/seo/` call `http://open-seo-api:3001` internally
- Pass Clerk JWT as `Authorization: Bearer` header (open-seo backend accepts Clerk JWTs after Phase 11)
- Pass `X-Client-ID: {clientId}` header for per-client scoping
- For Phase 10 (before Phase 11 lands): pass `?client_id={clientId}` query param as fallback (existing Phase 7 mechanism)

### open-seo Files to Delete
- `src/routes/_auth.sign-in.tsx`
- `src/routes/_auth.sign-up.tsx`
- `src/routes/_auth.tsx`
- `src/routes/_authenticated.tsx`
- `src/routes/_authenticated.subscribe.tsx`
- `src/routes/_app/billing.tsx`
- `src/routes/_app/help/dataforseo-api-key.tsx`
- `src/routes/_app/index.tsx`
- `src/routes/_app/route.tsx`
- `src/routes/_app/support.tsx`
- `src/routes/__root.tsx`
- `src/routes/forgot-password.tsx`
- `src/routes/reset-password.tsx`
- `src/routes/verify-email.tsx`
- `src/lib/auth-client.ts` (better-auth client)

### Nginx Changes
- Remove `seo.tevero.lt` server block from `docker/nginx/nginx.conf`
- Remove `app.openseo.so` server block
- Only `app.tevero.lt` remains, proxying to `web:3000`
- Add internal `location /seo-api/` proxy to `open-seo-api:3001` for server action internal calls (or keep Docker network direct — preferred)

### Docker Changes
- `open-seo` container continues running (API backend)
- Remove `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` env vars from docker-compose (Phase 11 completes this)
- open-seo container no longer needs port exposed externally (nginx no longer proxies directly to it)

### Component Porting Strategy
- Port open-seo route components as `'use client'` components in apps/web
- Use `@tevero/ui` components (from Phase 9) for all UI primitives
- TanStack Query (`useQuery`, `useMutation`) kept for client-side data fetching within these pages
- TanStack Table kept for keyword/backlink tables — it's framework-agnostic
- Remove TanStack Router imports; replace with Next.js `useParams`, `useRouter`

### Claude's Discretion
- Exact server action signatures for each SEO endpoint
- Whether to use React Server Components for initial data load or client-side fetch with TanStack Query
- Handling of BullMQ job polling (audit progress) — likely SSE or polling via client component

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `open-seo-main/src/routes/_project/p/$projectId/` — 7 route files to port
- `open-seo-main/src/serverFunctions/` — server function signatures define the API contract
- `open-seo-main/src/components/` — UI components; use @tevero/ui replacements where possible
- TanStack Query already in both apps — keep for client-side fetching

### Established Patterns
- open-seo uses `createServerFn()` from TanStack Start — these become Next.js server actions
- Audit progress polling via `getAuditStatus(auditId)` — needs client-side polling loop
- `useParams()` from TanStack Router → `useParams()` from `next/navigation`

### Integration Points
- `open-seo-api:3001` internal Docker hostname
- `X-Client-ID` header for client scoping (already wired from Phase 6/7)
- Clerk JWT for auth (Phase 11 wires this; Phase 10 uses query param fallback)

</code_context>

<specifics>
## Specific Ideas

- iframe removed from SeoAuditPage — replaced with proper routes
- seo.tevero.lt DNS record can be retired after this phase
- open-seo becomes headless API — its own React/TanStack frontend deleted

</specifics>

<deferred>
## Deferred Ideas

- better-auth removal from open-seo backend — Phase 11
- Clerk JWT auth in open-seo API calls — Phase 11 (Phase 10 uses query param fallback)

</deferred>
