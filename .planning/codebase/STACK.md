# Technology Stack

**Analysis Date:** 2026-04-22

## Languages

**Primary:**
- TypeScript 5.7.3 - All frontend and Node.js backend code
- JavaScript (ES2022 target) - Transpiled output

**Secondary:**
- Python 3.x - AI-Writer backend (FastAPI)

## Runtime

**Environment:**
- Node.js >=20.11.0 (required in root `package.json`)
- Node.js 22-alpine (Docker runtime images)

**Package Manager:**
- pnpm 10.26.0 (specified via `packageManager` field)
- Lockfile: `pnpm-lock.yaml` (present, 505KB)
- Workspace config: `pnpm-workspace.yaml`

## Monorepo Structure

**Workspaces:**
```
packages:
  - "apps/*"      # apps/web (Next.js 15)
  - "packages/*"  # types, ui
```

**Internal Packages:**
- `@tevero/web` - Main Next.js application (`apps/web`)
- `@tevero/types` - Shared TypeScript types (`packages/types`)
- `@tevero/ui` - Shared UI components (`packages/ui`)

## Frameworks

**Core:**
- Next.js 15.5.15 - Main web application (`apps/web`)
- React 19.1.6 - UI library
- TanStack Router 1.168.10 - Used in open-seo-main (Vite-based)

**Testing:**
- Vitest 4.1.4 - Unit/integration testing (`apps/web`)
- @testing-library/react 16.3.2 - React component testing
- @testing-library/jest-dom 6.9.1 - DOM matchers
- jsdom 29.0.2 - Test environment

**Build/Dev:**
- Vite - open-seo-main build tool
- Tailwind CSS 4.1.17 - Styling
- PostCSS via `@tailwindcss/postcss`
- ESLint 9.18.0 - Linting
- TypeScript 5.7.3 - Type checking

## Key Dependencies

**Critical (apps/web):**
- `@clerk/nextjs` ^6.39.2 - Authentication
- `@tanstack/react-query` ^5.99.0 - Server state management
- `zustand` ^5.0.12 - Client state management
- `ioredis` ^5.10.1 - Redis client for caching
- `socket.io-client` ^4.8.3 - WebSocket real-time updates

**UI Components:**
- `@radix-ui/*` - Headless UI primitives (dialog, popover, select, tabs, etc.)
- `lucide-react` ^0.543.0 - Icons
- `recharts` ^3.8.1 - Charts
- `class-variance-authority` ^0.7.1 - Component variants
- `cmdk` ^1.1.1 - Command palette
- `@dnd-kit/*` - Drag and drop
- `react-big-calendar` ^1.19.4 - Calendar component

**open-seo-main Critical:**
- `bullmq` 5.74.1 - Background job queues
- `drizzle-orm` ^0.44.4 - Database ORM
- `dataforseo-client` ^2.0.19 - SEO data API
- `googleapis` ^171.4.0 - Google APIs (GSC, GA4)
- `@anthropic-ai/sdk` ^0.90.0 - Claude AI
- `@google/generative-ai` ^0.24.1 - Gemini AI
- `cheerio` ^1.2.0 - HTML parsing
- `puppeteer` ^24.41.0 - Browser automation

**AI-Writer Backend (Python):**
- FastAPI 0.135.3 - API framework
- SQLAlchemy 2.0.49 - ORM
- Alembic >=1.13.0 - Migrations
- OpenAI 1.109.1 - OpenAI API
- google-genai 1.72.0 - Google AI
- Scrapy 2.15.0 - Web scraping
- Playwright - Browser automation

## Configuration

**TypeScript (`apps/web/tsconfig.json`):**
- Target: ES2022
- Module: ESNext
- Module resolution: bundler
- Strict mode: enabled
- Path alias: `@/*` → `./src/*`

**Next.js (`apps/web/next.config.ts`):**
- Output: standalone (Docker-optimized)
- Strict mode: enabled
- Typed routes: enabled
- Transpile packages: `@tevero/ui`, `@tevero/types`

**Vitest (`apps/web/vitest.config.ts`):**
- Environment: jsdom
- Globals: enabled
- Setup file: `./vitest.setup.ts`
- Pattern: `src/**/*.test.{ts,tsx}`

**Environment Variables Required:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk auth (public)
- `CLERK_SECRET_KEY` - Clerk auth (server)
- `AI_WRITER_BACKEND_URL` - Backend API (default: `http://ai-writer-backend:8000`)
- `OPEN_SEO_URL` - open-seo API (default: `http://open-seo:3001`)
- `REDIS_URL` - Redis connection for caching
- `NEXT_PUBLIC_WS_URL` - WebSocket server URL

## Platform Requirements

**Development:**
- Node.js >=20.11.0
- pnpm 10.26.0
- Docker (for full stack local dev)

**Production:**
- Docker with docker-compose
- VPS deployment via GitHub Actions
- Nginx reverse proxy with SSL (Let's Encrypt)
- Services: PostgreSQL 16, Redis 7

**Docker Services (docker-compose.vps.yml):**
1. `postgres` - PostgreSQL 16-alpine (shared database)
2. `redis` - Redis 7-alpine (caching, queues)
3. `open-seo` - Node.js API server (port 3001)
4. `open-seo-worker` - BullMQ background workers
5. `puppeteer-pdf` - Headless Chrome for PDF generation
6. `ai-writer-backend` - Python FastAPI (port 8000)
7. `ai-writer-frontend` - React SPA
8. `tevero-web` - Next.js 15 (port 3002)
9. `nginx` - Reverse proxy (ports 80, 443)

---

*Stack analysis: 2026-04-22*
