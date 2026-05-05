# Codebase Structure

**Analysis Date:** 2026-05-05

## Directory Layout

```
TeveroSEO/
├── apps/
│   └── web/                    # Next.js 15 unified frontend shell
├── open-seo-main/              # TanStack Start SEO platform
├── AI-Writer/                  # FastAPI content generation backend
│   ├── backend/                # Python FastAPI server
│   └── frontend/               # React frontend (DEPRECATED)
├── packages/                   # Shared monorepo packages
│   ├── types/                  # @tevero/types - shared TypeScript types
│   ├── ui/                     # @tevero/ui - shadcn/ui component library
│   ├── utils/                  # @tevero/utils - shared utilities
│   └── sync/                   # @tevero/sync - client sync utilities
├── docker/                     # Docker configurations
│   ├── postgres/               # PostgreSQL init scripts
│   ├── redis/                  # Redis configuration
│   ├── nginx/                  # Nginx reverse proxy config
│   └── dev/                    # Development container configs
├── scripts/                    # Build and deployment scripts
├── docs/                       # Documentation and runbooks
├── e2e/                        # Root-level E2E tests (Playwright)
└── .planning/                  # Planning documents and roadmap
```

## Directory Purposes

**apps/web/ (Next.js Frontend):**
- Purpose: Unified shell for all TeveroSEO features
- Contains: App Router pages, Server Actions, React components
- Key files: `src/app/layout.tsx`, `src/app/(shell)/layout.tsx`
- Build: `pnpm --filter @tevero/web build`

**apps/web/src/app/:**
- Purpose: Next.js App Router pages and API routes
- Contains: Route groups, layouts, pages, API handlers
- Key patterns: `(shell)/` for authenticated routes, `api/` for REST endpoints

**apps/web/src/actions/:**
- Purpose: Server Actions for data mutations
- Contains: "use server" functions calling backend APIs
- Key files: `alerts.ts`, `changes.ts`, `webhooks.ts`, `voice.ts`

**apps/web/src/components/:**
- Purpose: React UI components organized by feature
- Contains: Feature-specific components, shared UI elements
- Key directories: `dashboard/`, `seo/`, `pipeline/`, `shell/`, `ui/`

**apps/web/src/lib/:**
- Purpose: Shared utilities, API clients, business logic
- Contains: Server fetch wrappers, auth helpers, caching, validation
- Key files: `server-fetch.ts`, `env.ts`, `query-keys.ts`, `dedup.ts`

**apps/web/src/stores/:**
- Purpose: Zustand state stores
- Contains: Client-side state management with persistence
- Key files: `clientStore.ts`, `proposalStore.ts`, `intelligenceStore.ts`

**open-seo-main/src/:**
- Purpose: TanStack Start full-stack application source
- Contains: Routes, server code, client components, database layer

**open-seo-main/src/routes/:**
- Purpose: TanStack Start file-based routing
- Contains: Page routes, API handlers, layouts
- Key files: `__root.tsx`, `_authenticated.tsx`, `api/` directory

**open-seo-main/src/server/:**
- Purpose: Server-side business logic
- Contains: Features, services, workers, queues, lib utilities

**open-seo-main/src/server/features/:**
- Purpose: Domain-driven feature modules
- Contains: 30+ feature directories (keywords, audit, linking, proposals, etc.)
- Pattern: Each feature has services, repositories, API handlers

**open-seo-main/src/server/queues/:**
- Purpose: BullMQ queue definitions
- Contains: Queue configs for async jobs
- Key files: `auditQueue.ts`, `analyticsQueue.ts`, `rankingQueue.ts`

**open-seo-main/src/server/workers/:**
- Purpose: BullMQ worker implementations
- Contains: Worker + Processor pairs for job execution
- Key files: `audit-worker.ts`, `analytics-worker.ts`, `dlq-worker.ts`

**open-seo-main/src/db/:**
- Purpose: Drizzle ORM database layer
- Contains: 50+ schema files, migrations, seeds
- Key files: `index.ts`, `schema.ts`, `*-schema.ts` files

**open-seo-main/src/client/:**
- Purpose: Client-side React code for TanStack Start
- Contains: Components, hooks, utilities, navigation
- Used when: Accessing open-seo-main directly (not via apps/web shell)

**AI-Writer/backend/:**
- Purpose: FastAPI Python backend for content generation
- Contains: Routers, services, models, middleware

**AI-Writer/backend/routers/:**
- Purpose: FastAPI route handlers
- Contains: Domain-specific API endpoints
- Key files: `seo_tools.py`, `image_studio.py`, `campaign_creator.py`

**AI-Writer/backend/services/:**
- Purpose: Business logic services
- Contains: 50+ service modules
- Key directories: `analytics/`, `cache/`, `llm_providers/`, `quality/`

**AI-Writer/backend/models/:**
- Purpose: SQLAlchemy ORM models and Pydantic schemas
- Contains: Database models, request/response schemas

**packages/types/src/:**
- Purpose: Shared TypeScript type definitions
- Contains: API types, entity types, event types
- Key files: `api.ts`, `client.ts`, `audit.ts`, `error.ts`

**packages/ui/src/:**
- Purpose: Shared shadcn/ui component library
- Contains: 60+ reusable UI components
- Key files: `components/*.tsx`, `index.ts` (barrel export)

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx`: Next.js root layout
- `apps/web/src/app/(shell)/layout.tsx`: Authenticated shell layout
- `open-seo-main/src/routes/__root.tsx`: TanStack Start root
- `AI-Writer/backend/main.py`: FastAPI application entry

**Configuration:**
- `package.json`: Root monorepo config (pnpm workspaces)
- `pnpm-workspace.yaml`: Workspace package definitions
- `apps/web/next.config.ts`: Next.js configuration
- `open-seo-main/drizzle.config.ts`: Drizzle ORM config
- `AI-Writer/backend/config/`: Python service configs

**Database:**
- `open-seo-main/src/db/index.ts`: Database connection and exports
- `open-seo-main/src/db/schema.ts`: Main schema barrel export
- `open-seo-main/src/db/*-schema.ts`: Individual entity schemas
- `AI-Writer/backend/database/`: SQLAlchemy setup

**Authentication:**
- `apps/web/src/lib/auth/`: Clerk auth utilities
- `open-seo-main/src/server/lib/clerk-jwt.ts`: JWT verification
- `open-seo-main/src/server/lib/client-context.ts`: Client resolution
- `AI-Writer/backend/auth/`: FastAPI auth middleware

**API Communication:**
- `apps/web/src/lib/server-fetch.ts`: Backend API client with retry/circuit breaker
- `apps/web/src/lib/api-client.ts`: Client-side API utilities
- `apps/web/src/lib/internal-api/`: Internal service-to-service calls

**State Management:**
- `apps/web/src/stores/clientStore.ts`: Active client state
- `apps/web/src/lib/query-keys.ts`: TanStack Query key definitions
- `apps/web/src/hooks/`: Custom React hooks

**Testing:**
- `apps/web/src/test-utils/`: Test utilities for Next.js
- `open-seo-main/src/tests/`: Server-side test files
- `e2e/`: Root-level Playwright E2E tests

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `ClientList.tsx`)
- TypeScript modules: `kebab-case.ts` (e.g., `client-context.ts`)
- Test files: `*.test.ts` or `*.test.tsx`
- Schema files: `*-schema.ts` (e.g., `client-schema.ts`)
- Worker files: `*-worker.ts`, `*-processor.ts`

**Directories:**
- Feature modules: `kebab-case` (e.g., `command-center/`)
- Route groups: `(groupName)` for layouts, `_prefix` for special routes
- API routes: `api/` subdirectory

**Components:**
- Feature components: `src/components/{feature}/`
- Shared UI: `packages/ui/src/components/`

**Imports:**
- Path aliases: `@/` maps to `src/` in each app
- Package imports: `@tevero/types`, `@tevero/ui`, `@tevero/utils`

## Where to Add New Code

**New Feature (apps/web):**
- Primary code: `apps/web/src/app/(shell)/{feature}/`
- Components: `apps/web/src/components/{feature}/`
- Server Actions: `apps/web/src/actions/{feature}/`
- Tests: Co-located `*.test.ts` files

**New Feature (open-seo-main):**
- Implementation: `open-seo-main/src/server/features/{feature}/`
- API routes: `open-seo-main/src/routes/api/{feature}/`
- Database schema: `open-seo-main/src/db/{feature}-schema.ts`
- Queue/Worker: `open-seo-main/src/server/queues/`, `open-seo-main/src/server/workers/`

**New API Endpoint (AI-Writer):**
- Router: `AI-Writer/backend/routers/{feature}.py`
- Service: `AI-Writer/backend/services/{feature}.py`
- Models: `AI-Writer/backend/models/{feature}.py`

**New Shared Component:**
- Component: `packages/ui/src/components/{component}.tsx`
- Export: Add to `packages/ui/src/index.ts`
- Story: `packages/ui/src/stories/{component}.stories.tsx`

**New Shared Type:**
- Type definition: `packages/types/src/{domain}.ts`
- Export: Add to `packages/types/src/index.ts`

**Utilities:**
- Shared helpers (apps/web): `apps/web/src/lib/utils/`
- Shared helpers (open-seo-main): `open-seo-main/src/server/lib/`
- Shared across apps: `packages/utils/src/`

## Special Directories

**`.planning/`:**
- Purpose: Planning documents, roadmap, phase plans
- Generated: No (manually maintained)
- Committed: Yes

**`.claude/`, `.claire/`:**
- Purpose: AI assistant worktrees and configs
- Generated: Yes (by AI tools)
- Committed: Partially (config yes, worktrees no)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by pnpm)
- Committed: No

**`.next/`, `.vinxi/`, `.output/`:**
- Purpose: Build output directories
- Generated: Yes (by build tools)
- Committed: No

**`docker/`:**
- Purpose: Docker configurations for deployment
- Generated: No
- Committed: Yes
- Key files: `postgres/init.sql`, `redis/redis.conf`, `nginx/` configs

**`drizzle/`:**
- Purpose: Database migrations
- Generated: Yes (by drizzle-kit)
- Committed: Yes
- Location: `open-seo-main/drizzle/`

**`graphify-out/`:**
- Purpose: Knowledge graph output cache
- Generated: Yes (by graphify skill)
- Committed: No

---

*Structure analysis: 2026-05-05*
