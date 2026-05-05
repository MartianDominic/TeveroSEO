# Technology Stack

**Analysis Date:** 2026-05-05

## Languages

**Primary:**
- TypeScript 5.9.3 - All frontend apps and open-seo-main backend
- Python 3.11+ - AI-Writer backend (FastAPI)

**Secondary:**
- JavaScript (ES2022+) - Build scripts, config files
- SQL - PostgreSQL queries via Drizzle/SQLAlchemy

## Runtime

**Environment:**
- Node.js >=20.11.0 - apps/web, open-seo-main, packages
- Python 3.11+ - AI-Writer backend (Gunicorn + uvicorn)

**Package Manager:**
- pnpm 10.26.0 - monorepo package management
- pip/venv - Python dependencies
- Lockfiles: `pnpm-lock.yaml`, `requirements.lock`

## Frameworks

**apps/web (Next.js Frontend):**
- Next.js 15.5.15 (App Router, Server Components)
- React 19.1.6
- Tailwind CSS 4.1.17
- next-intl 4.11.0 (i18n)

**open-seo-main (SEO Platform):**
- TanStack Start 1.167.16 (full-stack React framework, Node.js target)
- TanStack Router 1.168.10
- TanStack Query 5.90.9
- React 19.0.0
- Tailwind CSS 4.1.16
- i18next 26.0.8 (i18n)

**AI-Writer (Content Platform):**
- FastAPI 0.135.3
- Pydantic 2.12.5
- Gunicorn 25.3.0 + uvicorn 0.44.0
- React (legacy frontend in `frontend/` directory)

**Testing:**
- Vitest 4.1.4 - Unit/integration tests (all TS projects)
- Playwright 1.59.1 - E2E tests
- pytest 9.0.3 - Python tests
- Testing Library (React, DOM)

**Build/Dev:**
- Vite 7.1.2 - open-seo-main bundler
- tsx 4.21.0 - TypeScript execution
- drizzle-kit 0.31.4 - DB migrations
- Alembic 1.13.0 - Python DB migrations

## Key Dependencies

**Critical (apps/web):**
- `@clerk/nextjs` 6.39.2 - Authentication
- `@sentry/nextjs` 10.51.0 - Error tracking
- `@tanstack/react-query` 5.99.0 - Data fetching/caching
- `@copilotkit/*` 1.56.5 - AI chat UI
- `zustand` 5.0.12 - Client state management
- `zod` 4.3.6 - Schema validation

**Critical (open-seo-main):**
- `drizzle-orm` 0.45.2 - Database ORM
- `bullmq` 5.74.1 - Job queues
- `stripe` 22.0.2 - Payment processing
- `autumn-js` 1.1.7 - Usage-based billing
- `puppeteer` 24.41.0 - PDF generation
- `dataforseo-client` 2.0.19 - SEO data API
- `@anthropic-ai/sdk` 0.90.0 - Claude AI
- `openai` 6.35.0 - OpenAI API
- `@google/generative-ai` 0.24.1 - Gemini AI
- `posthog-node` 5.28.5 - Analytics

**Critical (AI-Writer):**
- `sqlalchemy` 2.0.49 - Database ORM
- `openai` 1.109.1 - OpenAI API
- `google-genai` 1.72.0 - Gemini AI
- `sentry-sdk` 2.22.0 - Error tracking
- `fastapi_clerk_auth` 0.0.9 - Clerk integration
- `apscheduler` 3.11.2 - Task scheduling
- `exa-py` 1.9.1 - Web search API
- `sentence-transformers` 3.0.0 - Embeddings/reranking

**Infrastructure:**
- `ioredis` 5.10.1 - Redis client (TS)
- `redis` 7.4.0 - Redis client (Python)
- `pg` 8.20.0 - PostgreSQL client (TS)
- `psycopg2-binary` 2.9.0 - PostgreSQL client (Python)

**UI Components:**
- `@radix-ui/*` - Headless UI primitives
- `lucide-react` - Icons
- `recharts` 3.8.1 - Charts
- `@tiptap/*` 3.22.5 - Rich text editor
- `@dnd-kit/*` - Drag and drop
- `cmdk` 1.1.1 - Command palette

## Shared Packages

**@tevero/types:**
- Location: `packages/types/`
- Purpose: Shared TypeScript types across apps
- No runtime dependencies

**@tevero/ui:**
- Location: `packages/ui/`
- Purpose: Shared UI components (shadcn/ui based)
- Dependencies: Radix UI, Tailwind, Recharts, Lucide
- Storybook 8.6.18 for component development

**@tevero/utils:**
- Location: `packages/utils/`
- Purpose: Shared utility functions
- No runtime dependencies

**@tevero/sync:**
- Location: `packages/sync/`
- Purpose: Cross-service synchronization utilities
- Dependencies: Zod

## Configuration

**Environment:**
- `.env.vps.example` - Production env template (root)
- `.env.example` - AI-Writer env template
- Runtime: `NODE_ENV`, `ENV`, `ENVIRONMENT` variables
- Secret management via environment variables

**TypeScript:**
- `apps/web/tsconfig.json` - Next.js config (ES2022, bundler resolution)
- `open-seo-main/tsconfig.json` - TanStack Start config (ES2022, bundler resolution)
- Strict mode enabled across all projects
- Path aliases: `@/*` -> `./src/*`

**Build:**
- `vite.config.ts` - open-seo-main build
- `next.config.ts` - apps/web build
- `drizzle.config.ts` - Database migrations
- `vitest.config.ts` - Test configuration

**Linting:**
- ESLint 9.18.0 (apps/web)
- oxlint 1.50.0 (open-seo-main)
- Prettier 3.6.2 (formatting)

## Platform Requirements

**Development:**
- Node.js >=20.11.0
- Python 3.11+
- pnpm 10.26.0
- PostgreSQL 16
- Redis 7

**Production:**
- Docker Compose deployment
- nginx reverse proxy with SSL
- PostgreSQL 16-alpine container
- Redis 7-alpine container
- Puppeteer container for PDF generation

## Database Architecture

**PostgreSQL (shared instance):**
- `open_seo` database - Drizzle ORM (TypeScript)
- `alwrity` database - SQLAlchemy (Python)

**ORM Boundaries:**
- Drizzle owns: `shared_*`, `seo_*`, `biz_*`, `analytics_*` tables
- SQLAlchemy owns: `content_*` tables
- Legacy tables: non-prefixed (being migrated)

**Migrations:**
- Drizzle Kit (`drizzle/` directory)
- Alembic (AI-Writer migrations)

---

*Stack analysis: 2026-05-05*
