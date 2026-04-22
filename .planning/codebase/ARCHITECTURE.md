# Architecture

**Analysis Date:** 2026-04-22

## Pattern Overview

**Overall:** Monorepo with Backend-for-Frontend (BFF) Pattern

**Key Characteristics:**
- pnpm workspace monorepo with apps and shared packages
- Next.js 15 App Router frontend with React 19
- Backend-for-Frontend API routes proxy to external microservices
- Zustand for client-side state management
- Server Actions for server-side data fetching with caching

## Layers

**Presentation Layer:**
- Purpose: React components and UI rendering
- Location: `apps/web/src/components/`
- Contains: React components organized by feature domain
- Depends on: `@tevero/ui` (shared components), Zustand stores, hooks
- Used by: Page components in `apps/web/src/app/`

**Page Layer (App Router):**
- Purpose: Route handling, layouts, and page composition
- Location: `apps/web/src/app/`
- Contains: Page.tsx files, layouts, loading states, route groups
- Depends on: Components, Server Actions, API routes
- Used by: Next.js router

**Server Actions Layer:**
- Purpose: Server-side data fetching with caching and business logic
- Location: `apps/web/src/actions/`
- Contains: `"use server"` functions for SSR data fetching
- Depends on: `lib/server-fetch.ts` for backend communication
- Used by: Page components (RSC), client components via useTransition

**API Routes Layer (BFF):**
- Purpose: HTTP API endpoints that proxy to backend microservices
- Location: `apps/web/src/app/api/`
- Contains: `route.ts` files with GET/POST/PUT/DELETE handlers
- Depends on: `lib/server-fetch.ts`, Clerk auth
- Used by: Client-side fetch, external integrations

**Backend Communication Layer:**
- Purpose: Authenticated HTTP client for microservice communication
- Location: `apps/web/src/lib/server-fetch.ts`
- Contains: `getFastApi`, `postFastApi` (AI-Writer), `getOpenSeo`, `postOpenSeo` (Open-SEO)
- Depends on: Clerk JWT tokens for auth
- Used by: Server Actions, API Routes

**State Management Layer:**
- Purpose: Client-side global state
- Location: `apps/web/src/stores/`
- Contains: Zustand stores with persistence middleware
- Depends on: `@tevero/types`, cookies for persistence
- Used by: Client components throughout the app

**Shared Packages:**
- `@tevero/ui`: Design system components (Button, Card, Dialog, etc.)
- `@tevero/types`: Shared TypeScript interfaces (Client, OAuth, Reports)

## Data Flow

**Server Component Data Fetching:**

1. Page component (RSC) calls Server Action
2. Server Action checks Redis cache via `cacheGet()`
3. On cache miss, calls `getFastApi()` or `getOpenSeo()`
4. Backend service returns data with Clerk JWT auth
5. Data cached in Redis with TTL and tags
6. Rendered server-side, hydrated on client

**Client Component Data Fetching:**

1. Client component fetches via `/api/*` route
2. API route handler receives request
3. Handler calls `getFastApi()` / `getOpenSeo()` with auth
4. Response proxied back to client
5. Component updates Zustand store if needed

**State Management:**

- Zustand stores for: active client, analytics, content calendar, article editor
- `clientStore` persisted to cookies for session continuity
- React Query (`@tanstack/react-query`) for server state caching

## Key Abstractions

**Client Entity:**
- Purpose: Represents an agency client (customer of the SEO agency)
- Examples: `@tevero/types/src/client.ts`, `apps/web/src/stores/clientStore.ts`
- Pattern: Active client stored in Zustand, synced to cookie

**Server Fetch Utilities:**
- Purpose: Authenticated HTTP clients for two backend services
- Examples: `apps/web/src/lib/server-fetch.ts`
- Pattern: Wrapper around fetch with Clerk JWT injection

**Cache Layer:**
- Purpose: Redis-based caching with tag-based invalidation
- Examples: `apps/web/src/lib/cache/redis-cache.ts`
- Pattern: `cacheGet`/`cacheSet` with TTL and workspace tags

**Dashboard Metrics:**
- Purpose: Pre-computed client metrics for portfolio view
- Examples: `apps/web/src/lib/dashboard/types.ts`
- Pattern: Typed interfaces for ClientMetrics, PortfolioSummary

## Entry Points

**Application Entry:**
- Location: `apps/web/src/app/layout.tsx`
- Triggers: Any page request
- Responsibilities: ClerkProvider wrapper, global CSS

**Shell Layout:**
- Location: `apps/web/src/app/(shell)/layout.tsx`
- Triggers: Authenticated routes under `(shell)/`
- Responsibilities: AppShell sidebar, ThemeProvider

**API Health Check:**
- Location: `apps/web/src/app/api/health/route.ts`
- Triggers: Health monitoring
- Responsibilities: Application status

**Main Dashboard:**
- Location: `apps/web/src/app/(shell)/dashboard/page.tsx`
- Triggers: `/dashboard` route
- Responsibilities: Agency command center, portfolio overview

## Error Handling

**Strategy:** Graceful degradation with fallback data

**Patterns:**
- Server Actions catch errors and return empty arrays/default objects
- API routes return appropriate HTTP status codes
- FastApiError class for typed error handling from backends
- ApiError class for client-side fetch errors
- Components show loading/error states via Skeleton components

## Cross-Cutting Concerns

**Logging:** Console-based error logging in catch blocks (no structured logging yet)

**Validation:** TypeScript interfaces for type safety; no runtime validation library

**Authentication:** 
- Clerk for user authentication
- ClerkProvider at root layout
- `auth()` from `@clerk/nextjs/server` for server-side token retrieval
- JWT passed to backend services via Authorization header

**Caching:**
- Redis-based cache in `lib/cache/`
- Tag-based invalidation for workspace/client scopes
- Default 5-minute TTL, configurable per call

**Real-time:**
- Socket.io client in `lib/websocket/socket-client.ts`
- Singleton socket instance with room-based events
- Activity feed for workspace-level events

---

*Architecture analysis: 2026-04-22*
