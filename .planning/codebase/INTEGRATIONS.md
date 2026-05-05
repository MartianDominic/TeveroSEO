# External Integrations

**Analysis Date:** 2026-05-05

## APIs & External Services

**Authentication:**
- Clerk - User authentication and session management
  - SDK: `@clerk/nextjs` (apps/web), `@clerk/backend` (open-seo-main), `fastapi_clerk_auth` (AI-Writer)
  - Env vars: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
  - Webhooks: `/api/webhooks/clerk` (user sync)
  - Uses Svix for webhook signature verification

**AI Providers:**
- Anthropic Claude - Content generation, voice analysis, proposal generation
  - SDK: `@anthropic-ai/sdk` (TS), via API (Python)
  - Env var: `ANTHROPIC_API_KEY`
  - Usage: `open-seo-main/src/server/features/proposals/`, `open-seo-main/src/server/features/keywords/`

- OpenAI - AI features, embeddings
  - SDK: `openai` (both TS and Python)
  - Env var: `OPENAI_API_KEY`
  - Usage: Keyword intelligence, content generation

- Google Gemini - Classification, translation
  - SDK: `@google/generative-ai` (TS), `google-genai` (Python)
  - Env var: `GEMINI_API_KEY`
  - Usage: `open-seo-main/src/server/features/keywords/classification/`

**SEO Data:**
- DataForSEO - SERP data, keyword research, backlink analysis
  - SDK: `dataforseo-client`
  - Env var: `DATAFORSEO_API_KEY`
  - Usage: `open-seo-main/src/server/lib/dataforseo*.ts`, `open-seo-main/src/server/features/briefs/`

**Payments & Billing:**
- Stripe - Payment processing, subscriptions
  - SDK: `stripe` (TS and Python)
  - Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Webhooks: `/api/webhooks/stripe`, `/api/stripe/webhook`
  - Usage: `open-seo-main/src/server/features/payments/`, `open-seo-main/src/server/features/invoices/`

- Autumn.js - Usage-based billing, feature access
  - SDK: `autumn-js`
  - Usage: `open-seo-main/src/server/billing/`, subscription management

**Email:**
- Resend - Transactional emails (alerts, reports, invitations)
  - SDK: `resend`
  - Env var: `RESEND_API_KEY`
  - Usage: `open-seo-main/src/services/alert-notifications.ts`, `open-seo-main/src/server/features/agreements/`

**Analytics & Monitoring:**
- Sentry - Error tracking, performance monitoring
  - SDK: `@sentry/nextjs` (apps/web), `sentry-sdk[fastapi]` (AI-Writer)
  - Env var: `SENTRY_DSN`
  - Config: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

- PostHog - Product analytics, event tracking
  - SDK: `posthog-node`, `posthog-js`
  - Env var: `POSTHOG_API_KEY`
  - Usage: `open-seo-main/src/server/lib/posthog.ts`, audit events

**Web Research:**
- Exa.ai - AI-powered web search
  - SDK: `exa-py`
  - Env var: `EXA_API_KEY`
  - Usage: AI-Writer research features

## Google Platform Integrations

**Google Search Console (GSC):**
- OAuth scope: `https://www.googleapis.com/auth/webmasters.readonly`
- SDK: `googleapis`, `google-auth-library`
- Usage: `open-seo-main/src/server/services/analytics/gsc-client.ts`
- Stores: OAuth tokens in `platform_connections` table

**Google Analytics 4 (GA4):**
- OAuth scope: `https://www.googleapis.com/auth/analytics.readonly`
- API: `analyticsdata.googleapis.com/v1beta`
- Usage: `open-seo-main/src/server/services/analytics/ga4-client.ts`

**Google Business Profile:**
- OAuth scope: `https://www.googleapis.com/auth/business.manage`
- APIs: `mybusinessbusinessinformation.googleapis.com`, `mybusiness.googleapis.com`
- Usage: `open-seo-main/src/server/features/platform-oauth/services/GoogleBusinessProfileService.ts`

**OAuth Configuration:**
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Provider: `open-seo-main/src/server/features/platform-oauth/providers/GoogleOAuthProvider.ts`

## Data Storage

**Databases:**
- PostgreSQL 16
  - `open_seo` database - SEO platform data
    - Connection: `DATABASE_URL` env var
    - ORM: Drizzle (`open-seo-main/src/db/`)
  - `alwrity` database - Content platform data
    - Connection: `DATABASE_URL` (AI-Writer), `ALWRITY_DATABASE_URL` (cross-service)
    - ORM: SQLAlchemy

**Caching:**
- Redis 7
  - Connection: `REDIS_URL`
  - Clients: `ioredis` (TS), `redis` (Python)
  - Usage: BullMQ job queues, session cache, rate limiting

**Graph Database:**
- FalkorDB - Knowledge graph storage
  - SDK: `falkordb`
  - Usage: `open-seo-main/src/server/lib/graph/`, keyword relationships
  - Fallback: PostgreSQL AGE extension

**File Storage:**
- Local filesystem (containerized volumes)
  - Reports: `/data/reports` (Docker volume: `reports_data`)
  - Branding assets: `/data/branding` (Docker volume: `branding_data`)
  - AI-Writer workspace: `/app/workspace` (Docker volume: `ai_writer_workspace`)

## Job Queues

**BullMQ (open-seo-main):**
- Redis-backed job queues
- Queues: audit, analytics, follow-up, pipeline, onboarding, portfolio-aggregates, dashboard-metrics
- Workers: `open-seo-main/src/server/workers/`
- DLQ: Dead letter queue for failed jobs

**APScheduler (AI-Writer):**
- In-process task scheduling
- Usage: Periodic data refresh, semantic health monitoring

## CMS Integrations

**WordPress:**
- REST API integration
- Validation: `/api/connections/wordpress/validate`
- OAuth: Per-client credentials

**Shopify:**
- OAuth flow: `/api/oauth/shopify/authorize`
- Usage: Content publishing

**Wix:**
- API integration (optional)
- Env var: `WIX_API_KEY`

**Generic Webhooks:**
- Custom webhook endpoints for third-party CMS

## Real-time Communication

**WebSockets:**
- Socket.io server (open-seo-main)
  - Port: `WS_PORT` (3003 in production)
  - Client: `socket.io-client`
  - Usage: Real-time audit progress, notifications

## PDF Generation

**Puppeteer:**
- Containerized Chromium browser
  - Container: `puppeteer-pdf`
  - Connection: `PUPPETEER_WS_ENDPOINT` (WebSocket)
  - Shared memory: 1GB
- Usage: Report PDF generation, chart snapshots
- Files: `open-seo-main/src/server/services/report/pdf-generator.ts`

## Security

**Encryption:**
- Asset signing: `ASSET_SIGNING_KEY`
- Site encryption: `SITE_ENCRYPTION_KEY`
- Fernet encryption: `FERNET_KEY` (AI-Writer credentials at rest)
- IP hashing: `IP_SALT`
- Personal code: `PERSONAL_CODE_SALT`

**Rate Limiting:**
- Middleware-based (AI-Writer)
- IP-based with Redis storage

## Webhooks (Incoming)

**Clerk User Events:**
- Endpoint: `/api/webhooks/clerk`
- Events: `user.created`, `user.updated`, `user.deleted`
- Verification: Svix signature

**Stripe Payment Events:**
- Endpoints: `/api/webhooks/stripe`, `/api/stripe/webhook`
- Events: Payment success, subscription updates
- Verification: Stripe signature

## Internal Service Communication

**Cross-Service APIs:**
- `INTERNAL_API_KEY` - Service-to-service authentication
- `AI_WRITER_URL` - AI-Writer backend URL
- `OPEN_SEO_URL` - open-seo-main URL
- Routes: `/internal/*` endpoints

**Service URLs (Production):**
- `http://ai-writer-backend:8000` (internal)
- `http://open-seo:3001` (internal)
- `http://tevero-web:3002` (internal)

## Environment Configuration

**Required env vars (production):**
```
# Authentication
CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET

# Database
DATABASE_URL (PostgreSQL)
REDIS_URL

# AI Providers
ANTHROPIC_API_KEY
GEMINI_API_KEY
OPENAI_API_KEY (optional)

# SEO Data
DATAFORSEO_API_KEY

# Payments
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

# Email
RESEND_API_KEY

# Security
INTERNAL_API_KEY
ASSET_SIGNING_KEY
SITE_ENCRYPTION_KEY
FERNET_KEY
IP_SALT

# Google OAuth
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

# Monitoring (optional)
SENTRY_DSN
POSTHOG_API_KEY
```

**Service Discovery (Docker):**
- All services on `teveroseo-net` bridge network
- DNS: container names resolve to internal IPs
- nginx handles external routing

---

*Integration audit: 2026-05-05*
