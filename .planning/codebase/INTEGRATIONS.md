# External Integrations

**Analysis Date:** 2026-04-22

## APIs & External Services

**SEO Data:**
- DataForSEO - Keyword research, SERP data, backlinks analysis
  - SDK/Client: `dataforseo-client` ^2.0.19
  - Auth: `DATAFORSEO_API_KEY`
  - Used in: `open-seo-main`

**AI/LLM:**
- Anthropic Claude - Content generation, keyword opportunities
  - SDK/Client: `@anthropic-ai/sdk` ^0.90.0
  - Auth: API key (env var in open-seo)
  - Used in: `open-seo-main/src/server/lib/opportunity/`

- Google Gemini - Proposal generation, content analysis
  - SDK/Client: `@google/generative-ai` ^0.24.1
  - Auth: `GOOGLE_API_KEY`
  - Used in: `open-seo-main/src/server/lib/proposals/gemini.ts`

- OpenAI - Content generation (AI-Writer)
  - SDK/Client: `openai` 1.109.1 (Python)
  - Auth: OpenAI API key
  - Used in: `AI-Writer/backend`

**Google APIs:**
- Google Search Console (GSC) - Search performance data
  - SDK/Client: `googleapis` ^171.4.0
  - Auth: OAuth2 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
  - Client: `open-seo-main/src/server/services/analytics/gsc-client.ts`

- Google Analytics 4 (GA4) - Website analytics
  - SDK/Client: `googleapis` analyticsdata v1beta
  - Auth: OAuth2 (same as GSC)
  - Client: `open-seo-main/src/server/services/analytics/ga4-client.ts`

**Authentication:**
- Clerk - User authentication and session management
  - SDK/Client: `@clerk/nextjs` ^6.39.2
  - Auth: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - Middleware: `apps/web/src/middleware.ts`
  - Provider: `apps/web/src/app/layout.tsx`

## Data Storage

**Databases:**
- PostgreSQL 16-alpine (shared instance)
  - Databases: `open_seo`, `alwrity`
  - Connection: `DATABASE_URL` env var
  - ORM: Drizzle ORM (open-seo), SQLAlchemy (AI-Writer)
  - Migrations: drizzle-kit (open-seo), Alembic (AI-Writer)

**File Storage:**
- Local filesystem via Docker volumes
  - `reports_data:/data/reports` - Generated PDF reports
  - `branding_data:/data/branding` - Client branding assets (logos)
  - `ai_writer_workspace:/app/workspace` - AI-Writer working files

**Caching:**
- Redis 7-alpine
  - Connection: `REDIS_URL` (default: `redis://redis:6379`)
  - Client: `ioredis` 5.10.1
  - Implementation: `apps/web/src/lib/cache/redis-cache.ts`
  - Features: Tag-based invalidation, 5-minute default TTL

**Queue/Background Jobs:**
- BullMQ 5.74.1 (via Redis)
  - Queues location: `open-seo-main/src/server/queues/`
  - Queues defined:
    - `alertQueue` - Alert notifications
    - `analyticsQueue` - GA4/GSC sync jobs
    - `auditQueue` - Site audits
    - `dashboardMetricsQueue` - Dashboard metric calculations
    - `goalQueue` - Goal tracking updates
    - `portfolioAggregatesQueue` - Portfolio rollups
    - `prospectAnalysisQueue` - Prospect website analysis
    - `rankingQueue` - Keyword ranking checks
    - `reportQueue` - PDF report generation
    - `scheduleQueue` - Scheduled job orchestration
    - `webhookQueue` - Outbound webhook delivery

## Authentication & Identity

**Auth Provider:**
- Clerk (hosted)
  - Sign-in: `/sign-in` (`apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`)
  - Sign-up: `/sign-up` (`apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`)
  - Middleware protection: `apps/web/src/middleware.ts`
  - Public routes: `/sign-in`, `/sign-up`, `/connect/*`, `/api/health`

**OAuth for Client Data Access:**
- Google OAuth2 - Client-granted access to GSC/GA4
  - Flow: Magic link invite → Google OAuth → Token storage
  - Implementation: `apps/web/src/lib/clientOAuth.ts`
  - Auth service: `open-seo-main/src/server/services/analytics/google-auth.ts`

## Monitoring & Observability

**Error Tracking:**
- None detected (consider adding Sentry)

**Analytics:**
- PostHog - Product analytics (open-seo-main)
  - SDK: `posthog-js` ^1.363.5, `posthog-node` ^5.28.5
  - Used in: `open-seo-main`

**Logs:**
- Console logging with structured format
- Docker logs aggregation
- Worker metrics tracking (in-memory)

## CI/CD & Deployment

**Hosting:**
- Self-hosted VPS
- Docker Compose orchestration
- Nginx reverse proxy with Let's Encrypt SSL

**CI Pipeline:**
- GitHub Actions
  - `deploy-vps.yml` - Main deployment (open-seo, workers)
  - `deploy-web.yml` - Tevero web app deployment
  - `deploy-ai-writer.yml` - AI-Writer deployment
  - Triggers: Push to `main` branch with path filters
  - Deploy flow: git pull → migrations → docker compose up

**Container Registry:**
- Local builds on VPS (no external registry)
- Images: `teveroseo/open-seo`, `teveroseo/tevero-web`, `teveroseo/puppeteer-pdf`

## Environment Configuration

**Required env vars (production):**

*Clerk Auth:*
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

*Database:*
- `POSTGRES_PASSWORD`
- `OPEN_SEO_DB_PASSWORD`
- `ALWRITY_DB_PASSWORD`
- `DATABASE_URL` (constructed from above)

*Redis:*
- `REDIS_URL`

*External APIs:*
- `DATAFORSEO_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_API_KEY` (for Gemini)

*Internal Services:*
- `INTERNAL_API_KEY` - Service-to-service auth
- `AI_WRITER_BACKEND_URL`
- `OPEN_SEO_URL`

**Secrets location:**
- `.env.vps` on VPS (not committed, in `.gitignore`)
- GitHub Actions secrets for CI/CD
- Example template: `.env.vps.example`

## Webhooks & Callbacks

**Incoming:**
- OAuth callback endpoints (Google OAuth flow)
- Health check endpoints (`/api/health`, `/healthz`)

**Outgoing:**
- Webhook delivery queue (`webhookQueue`)
- Custom webhook notifications to client-configured endpoints

## Real-time Communication

**WebSocket:**
- Socket.IO for activity feed
  - Server: open-seo (implied)
  - Client: `apps/web/src/lib/websocket/socket-client.ts`
  - Events: `activity:new`, workspace join/leave
  - URL: `NEXT_PUBLIC_WS_URL`

## Browser Automation

**Puppeteer Service:**
- Dedicated container: `puppeteer-pdf`
  - Image: `teveroseo/puppeteer-pdf`
  - Purpose: PDF report generation
  - Connection: `PUPPETEER_WS_ENDPOINT` (`ws://puppeteer-pdf:9222`)
  - Shared memory: 1GB (`shm_size`)

**Playwright (AI-Writer):**
- Python Playwright for web scraping
- Used in AI-Writer backend

## Internal Service Communication

**apps/web → open-seo:**
- HTTP REST API
- Base URL: `OPEN_SEO_URL` (default: `http://open-seo:3001`)
- Client: `apps/web/src/lib/server-fetch.ts` (`getOpenSeo`, `postOpenSeo`, etc.)
- Auth: Bearer token from Clerk

**apps/web → AI-Writer:**
- HTTP REST API
- Base URL: `AI_WRITER_BACKEND_URL` (default: `http://ai-writer-backend:8000`)
- Client: `apps/web/src/lib/server-fetch.ts` (`getFastApi`, `postFastApi`, etc.)
- Auth: Bearer token from Clerk

**open-seo → AI-Writer:**
- Internal HTTP API
- URL: `AIWRITER_INTERNAL_URL` (`http://ai-writer-backend:8000`)
- Auth: `INTERNAL_API_KEY` header

---

*Integration audit: 2026-04-22*
