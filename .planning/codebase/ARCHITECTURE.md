# Architecture

**Analysis Date:** 2026-05-05

## Pattern Overview

**Overall:** Monorepo with Multi-Backend Federation

This is a unified SEO platform combining three applications through a shared frontend shell. The architecture follows a **federated backend pattern** where multiple services (Next.js, TanStack Start, FastAPI) operate independently but share authentication, data, and UI shell.

**Key Characteristics:**
- Unified frontend shell (Next.js) consuming multiple backend APIs
- Per-client context isolation using `client_id` as shared entity key
- BullMQ job queues for async processing in open-seo-main
- APScheduler for background jobs in AI-Writer
- Shared PostgreSQL with separate databases per service
- Shared Redis for caching and job queues

## Layers

**Frontend Shell (apps/web):**
- Purpose: Unified UI shell hosting all platform features
- Location: `apps/web/`
- Contains: Next.js 15 App Router, Server Components, Server Actions
- Depends on: open-seo-main API (port 3001), AI-Writer API (port 8000)
- Used by: End users via browser

**SEO Platform Backend (open-seo-main):**
- Purpose: SEO audits, keyword analysis, internal linking, proposals
- Location: `open-seo-main/`
- Contains: TanStack Start server, Drizzle ORM, BullMQ workers
- Depends on: PostgreSQL (open_seo db), Redis, DataForSEO API
- Used by: apps/web via REST API

**AI Content Backend (AI-Writer):**
- Purpose: Content generation, brand voice, publishing integrations
- Location: `AI-Writer/backend/`
- Contains: FastAPI server, SQLAlchemy ORM, APScheduler
- Depends on: PostgreSQL (alwrity db), Redis, OpenAI/Anthropic APIs
- Used by: apps/web via REST API, AI-Writer/frontend (deprecated)

**Shared Packages (packages/):**
- Purpose: Common types, UI components, utilities
- Location: `packages/`
- Contains: @tevero/types, @tevero/ui, @tevero/utils, @tevero/sync
- Depends on: None (pure libraries)
- Used by: apps/web, open-seo-main

## Data Flow

**Client-Scoped Request Flow:**

1. User authenticates via Clerk (shared tenant)
2. Frontend reads `activeClientId` from Zustand store (persisted to cookie)
3. Server action/API route extracts `X-Client-Id` header or cookie
4. Backend validates JWT + client ownership via `resolveClientContext()`
5. All queries scoped by `client_id` for tenant isolation

**SEO Audit Flow:**

1. User triggers audit from dashboard
2. `apps/web` server action calls `open-seo-main/api/audit`
3. open-seo-main enqueues job to `auditQueue` (BullMQ)
4. `audit-worker.ts` processes job via `audit-processor.ts`
5. Results written to PostgreSQL, client notified via WebSocket

**Content Generation Flow:**

1. User initiates article generation from apps/web
2. Server action calls AI-Writer `/api/article/generate`
3. AI-Writer calls LLM provider (OpenAI/Anthropic)
4. Content scored against brand voice profile
5. If score >= 80, eligible for auto-publish

**State Management:**

- **Client State (apps/web):** Zustand stores with persistence + TanStack Query
- **Server State:** PostgreSQL (Drizzle in open-seo-main, SQLAlchemy in AI-Writer)
- **Cache:** Redis for session data, rate limiting, job coordination
- **Real-time:** Socket.io for audit progress, alerts

## Key Abstractions

**Client Context:**
- Purpose: Multi-tenant isolation per client workspace
- Examples: `open-seo-main/src/server/lib/client-context.ts`, `apps/web/src/stores/clientStore.ts`
- Pattern: Request-scoped resolution with JWT validation + ownership verification

**BullMQ Queue System:**
- Purpose: Async job processing for SEO operations
- Examples: `open-seo-main/src/server/queues/*.ts`, `open-seo-main/src/server/workers/*.ts`
- Pattern: Queue + Worker + Processor separation with dead-letter handling

**Server Actions (apps/web):**
- Purpose: Server-side data mutations from React components
- Examples: `apps/web/src/actions/*.ts`
- Pattern: "use server" functions calling backend APIs with auth forwarding

**Feature Modules (open-seo-main):**
- Purpose: Domain-driven service organization
- Examples: `open-seo-main/src/server/features/keywords/`, `open-seo-main/src/server/features/audit/`
- Pattern: Repository + Service + API handler per domain

**Drizzle Schema:**
- Purpose: Type-safe PostgreSQL ORM layer
- Examples: `open-seo-main/src/db/*.ts` (50+ schema files)
- Pattern: Modular schema definitions with cross-schema relations

## Entry Points

**apps/web (Next.js):**
- Location: `apps/web/src/app/layout.tsx`
- Triggers: Browser navigation, HTTP requests to localhost:3000
- Responsibilities: ClerkProvider setup, theme initialization, routing

**open-seo-main (TanStack Start):**
- Location: `open-seo-main/src/routes/__root.tsx`
- Triggers: HTTP requests to localhost:3001
- Responsibilities: QueryClientProvider, PostHog analytics, route rendering

**AI-Writer Backend (FastAPI):**
- Location: `AI-Writer/backend/main.py`
- Triggers: HTTP requests to localhost:8000
- Responsibilities: Environment validation, Sentry init, router mounting, middleware

**BullMQ Workers:**
- Location: `open-seo-main/src/server/workers/*.ts`
- Triggers: Jobs enqueued to Redis queues
- Responsibilities: Async processing (audits, analytics, alerts, reports)

## Error Handling

**Strategy:** Layered error handling with circuit breakers

**Patterns:**
- **Circuit Breakers:** `apps/web/src/lib/utils/service-circuit-breakers.ts` wraps backend calls
- **Standard Errors:** `open-seo-main/src/server/lib/standard-error.ts` for typed error responses
- **Dead Letter Queue:** `open-seo-main/src/server/lib/dead-letter-queue.ts` for failed jobs
- **Retry with Backoff:** Server-fetch retries transient errors (5xx, network) with exponential backoff
- **Sentry Integration:** Both backends report errors to Sentry

## Cross-Cutting Concerns

**Logging:**
- apps/web: Custom logger at `apps/web/src/lib/logger.ts`
- open-seo-main: Logger at `open-seo-main/src/server/lib/logger.ts`
- AI-Writer: Loguru with structured logging at `AI-Writer/backend/logging_config.py`

**Validation:**
- Zod schemas throughout TypeScript codebase
- Pydantic models in FastAPI backend
- Request validation at API boundaries

**Authentication:**
- Clerk SDK shared across apps/web and open-seo-main
- JWT validation in both backends via `clerk-jwt.ts` / `fastapi_clerk_auth`
- Internal service-to-service auth via `X-Internal-Service-Token` header

**Rate Limiting:**
- Redis-backed rate limiter at `apps/web/src/lib/rate-limit.ts`
- Per-endpoint limits in AI-Writer middleware

**Tenant Isolation:**
- All queries include `client_id` WHERE clause
- Ownership validation before any data access
- `tenant-isolation.ts` enforces at query level

---

*Architecture analysis: 2026-05-05*
