# Roadmap: TeveroSEO Unified Platform

## Milestones

- ✅ **v1.0 Platform Unification** — Phases 1–7 (complete)
- ✅ **v2.0 Unified Product** — Phases 8–14 (complete 2026-04-19)
- ✅ **v3.0 Agency Intelligence** — Phases 15–25 + 18.5 (complete 2026-04-20)
- ✅ **v4.0 Prospecting & Sales** — Phases 26–30.5 (complete 2026-04-22)
- ✅ **v5.0 Autonomous SEO Pipeline** — Phases 31–40 (complete 2026-04-25)
- ✅ **v5.1 Production Hardening** — Phase 41 (complete 2026-04-26)
- ✅ **v7.0 Onboarding Excellence** — Phases 56–62 (complete 2026-05-01)
- ✅ **v7.1 Platform Intelligence** — Phases 63–66 (complete 2026-05-03)

## Phases

### Phase 1: AI-Writer Backend Cleanup
**Goal**: All legacy non-agency service directories removed from AI-Writer backend with no broken imports or test failures.
**Depends on**: Nothing (first phase)
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05, CLEAN-06, CLEAN-07
**Working directory**: `AI-Writer/`
**Success Criteria** (what must be TRUE):
  1. `grep -r "blog_writer\|podcast\|youtube\|story_writer\|linkedin" AI-Writer/backend/api/` returns zero matches
  2. `ls AI-Writer/backend/services/` shows no legacy directories (blog_writer, podcast, youtube, story_writer, linkedin)
  3. Backend starts without import errors: `docker compose run --rm ai-writer-backend python -c "from main import app"` succeeds
**Plans**: 4 plans
  - [x] 01-01-PLAN.md — Strip legacy routers and podcast-only demo mode from entry points, registries, logging, and startup scripts (Wave 1)
  - [x] 01-02-PLAN.md — Delete wrapper services/routers that bridge to legacy modules; inline exception/retry utilities; neutralize research_engine providers (Wave 1)
  - [x] 01-03-PLAN.md — Delete legacy scripts and model files; update services/database.py and test fixtures (Wave 1)
  - [x] 01-04-PLAN.md — Delete legacy service directories, API directories, and linkedin_image_generation.py (Wave 2)
  - [x] 01-05-PLAN.md — Verification: grep/ls checks, backend import smoke test, pytest run, produce VERIFICATION.md (Wave 3)

---

### Phase 2: CF Bindings Removal + Schema Migration
**Goal**: open-seo-main compiles and runs as a Node.js server with no Cloudflare runtime dependencies and a PostgreSQL-dialect Drizzle schema.
**Depends on**: Nothing (can run parallel with Phase 1)
**Requirements**: CF-01, CF-02, CF-03, CF-04, CF-05, CF-06, DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, BUILD-01, BUILD-02, BUILD-03
**Working directory**: `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. `grep -r "cloudflare:workers" open-seo-main/src/` returns zero matches
  2. `pnpm run build` completes with no TypeScript or Rollup errors and produces `.output/server/index.mjs`
  3. `node .output/server/index.mjs` starts an HTTP server and all routes return correct responses
  4. `drizzle-kit migrate` applies all PG-dialect migrations to a fresh PostgreSQL instance without errors
**Plans**: 6 plans
  - [x] 02-01-PLAN.md — Package + vite + drizzle + tsconfig + env.d.ts + wrangler removal (Wave 1, foundation)
  - [x] 02-02-PLAN.md — Migrate Drizzle schema from sqlite-core to pg-core, 14 tables, jsonb + boolean + timestamp tz (Wave 2)
  - [x] 02-03-PLAN.md — Rewrite src/db/index.ts for node-postgres pool; rewrite runtime-env.ts for process.env + validateEnv (Wave 2)
  - [x] 02-04-PLAN.md — Remove cloudflare:workers from auth, email, posthog, dataforseo, routes, middleware; swap better-auth to provider pg (Wave 3)
  - [x] 02-05-PLAN.md — Stub SiteAuditWorkflow + progress-kv (in-memory) + R2 (filesystem); rewrite src/server.ts as Node entry; stub AuditService (Wave 3)
  - [x] 02-06-PLAN.md — [BLOCKING] Regenerate PG migrations; drizzle-kit migrate against local PG; verify pnpm build + Node runtime (Wave 4, checkpoint)

---

### Phase 3: BullMQ + Redis KV Replacement
**Goal**: Site audit jobs run reliably via BullMQ on Redis; no Cloudflare runtime references remain in the audit path.
**Depends on**: Phase 2
**Requirements**: KV-01, KV-02, KV-03, BQ-01, BQ-02, BQ-03, BQ-04, BQ-05, BQ-06, BQ-07
**Working directory**: `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. Triggering a site audit enqueues a BullMQ job and the worker executes all steps to completion
  2. Audit crawl progress reads/writes via ioredis with correct TTL semantics (`audit-progress:` prefix, 30-min expiry)
  3. Failed jobs after max retries appear in `failed-audits` dead-letter queue
**Plans**: 4 plans
  - [x] 03-01-PLAN.md — Foundation: ioredis singleton + BullMQ Queue/DLQ definitions + REDIS_URL added to REQUIRED_ENV_CORE (Wave 1)
  - [x] 03-02-PLAN.md — Rewrite progress-kv.ts against ioredis singleton with audit-progress: prefix and 30-min TTL (Wave 2)
  - [x] 03-03-PLAN.md — BullMQ Worker + sandboxed processor (120s lock, maxStalledCount 2, DLQ on exhausted retries, 25s graceful shutdown) (Wave 2)
  - [x] 03-04-PLAN.md — Wire AuditService.startAudit/remove to auditQueue; start Worker + SIGTERM/SIGINT shutdown in src/server.ts (Wave 3)

---

### Phase 4: Unified Docker Infrastructure
**Goal**: Both platforms run on a single VPS behind one nginx, sharing PostgreSQL and Redis, with a single `docker compose up` command.
**Depends on**: Phase 2, Phase 3 (open-seo Node.js stable), Phase 1 (AI-Writer cleaned)
**Requirements**: DOCKER-01, DOCKER-02, DOCKER-03, DOCKER-04, DOCKER-05, DOCKER-06, DOCKER-07
**Working directory**: `/` (TeveroSEO root — new unified docker-compose.vps.yml)
**Success Criteria** (what must be TRUE):
  1. `docker compose -f docker-compose.vps.yml up -d` at TeveroSEO root brings all 7 services up healthy
  2. `curl https://app.openseo.so/healthz` returns `{ status: "ok" }`
  3. `curl https://<ai-writer-domain>/api/health` returns 200
  4. `docker compose -f docker-compose.vps.yml ps` shows all services as healthy
**Plans**: 4 plans
  - [x] 04-01-PLAN.md — Add /healthz route to open-seo-main for container healthcheck (Wave 1)
  - [x] 04-02-PLAN.md — Multi-stage Dockerfile.vps for open-seo with worker variant support (Wave 1)
  - [x] 04-03-PLAN.md — Supporting infra config files: postgres init SQL, nginx reverse proxy, redis config (Wave 1)
  - [x] 04-04-PLAN.md — Unified docker-compose.vps.yml wiring all 7 services with healthchecks + end-to-end smoke verification (Wave 2, checkpoint)

---

### Phase 5: CI/CD Pipeline
**Goal**: Both platforms auto-deploy to VPS on push to main with zero manual intervention; migrations run before new containers go live.
**Depends on**: Phase 4
**Requirements**: CI-01, CI-02, CI-03, CI-04, CI-05, CI-06
**Working directory**: TeveroSEO root (shared `.github/workflows/`)
**Success Criteria** (what must be TRUE):
  1. Pushing to `main` triggers deploy workflow; VPS shows new container within 5 minutes
  2. GitHub Actions workflow completes green with migration step before container swap
  3. `KNOWN_HOSTS` used; no `StrictHostKeyChecking=no`
  4. AI-Writer auto-deploys via separate parallel workflow
**Plans**: 3 plans
  - [x] 05-01-PLAN.md — Add `open-seo-migrate` one-shot service (migrate-entry.ts + Dockerfile.vps esbuild bundle + compose profile) (Wave 1)
  - [x] 05-02-PLAN.md — `.github/workflows/deploy-vps.yml` — SSH with KNOWN_HOSTS, migrate before container swap, rebuild open-seo + open-seo-worker (Wave 2)
  - [x] 05-03-PLAN.md — `.github/workflows/deploy-ai-writer.yml` — parallel SSH deploy for ai-writer-backend + ai-writer-frontend, no migration step (Wave 2)

---

### Phase 6: Clerk + Per-Client Workspace Integration
**Goal**: open-seo-main authenticates via Clerk and scopes all audit/keyword data by `client_id` from AI-Writer's client registry.
**Depends on**: Phase 4 (unified infra running)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Working directory**: `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. Unauthenticated requests to open-seo API return 401; authenticated requests with valid Clerk session succeed
  2. `GET /api/audits?client_id=X` returns only audits for client X
  3. Passing an invalid `client_id` returns 403
**Plans**: 3 plans
  - [x] 06-01-PLAN.md — client-context lib + ALWRITY_DATABASE_URL env wiring (Wave 1, AUTH-03 foundation)
  - [x] 06-02-PLAN.md — [BLOCKING] Add client_id column + index to audits table via Drizzle migration (Wave 1, AUTH-04 foundation)
  - [x] 06-03-PLAN.md — Wire clientId through middleware + AuditService + serverFunctions + docs AUTH-01/02 (Wave 2, checkpoint)

---

### Phase 7: AppShell SEO Integration
**Goal**: SEO audit and keyword tools appear as a nav section in the AI-Writer AppShell; active client context passes automatically to open-seo pages.
**Depends on**: Phase 6
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05
**Working directory**: `AI-Writer/`
**Success Criteria** (what must be TRUE):
  1. "SEO Audit" nav item visible in AI-Writer sidebar; clicking it loads open-seo pages without a page reload
  2. Switching client in the switcher updates the `client_id` passed to open-seo pages
  3. open-seo pages use the same StatusChip, PageHeader, and CSS tokens as the rest of the shell
**Plans**: TBD (planning in progress)

---

## v2.0 Unified Product

> **Milestone goal**: One Next.js 15 app at `app.tevero.lt`. Single login via Clerk. All AI-Writer and SEO features as first-class routes. Per-client credentials (GSC, GA4, Bing) stored in PostgreSQL, collected via branded invite links. Nightly analytics sync across 100 clients with anomaly surfacing. Two backends (FastAPI + Node.js) unchanged — only the frontend shell is new.

---

### Phase 8: Next.js Unified Shell
**Goal**: A new Next.js 15 App Router app (`apps/web`) replaces both CRA frontends. All existing AI-Writer routes work. Clerk auth via `@clerk/nextjs` middleware. Both backends called server-side — zero cross-origin requests from the browser. Old CRA frontend retired.
**Depends on**: Phase 7 complete
**Requirements**: NEXT-01 through NEXT-10
**Working directory**: `apps/web/` (new), `docker/`, root
**Success Criteria** (what must be TRUE):
  1. `apps/web` builds with `next build` — zero TypeScript errors
  2. All 10 AI-Writer pages accessible at equivalent routes under `/clients/[id]/*` with Clerk protection
  3. `curl https://app.tevero.lt/api/health` proxied through Next.js server action returns 200
  4. `docker compose -f docker-compose.vps.yml up` replaces `ai-writer-frontend` container with `web` container; nginx updated
  5. Signing in with Clerk grants access; unauthenticated visits redirect to `/sign-in`
**Estimated effort**: 3 weeks
**Plans**: 6 plans
  - [x] 08-01-PLAN.md — pnpm workspace scaffold + Next.js 15 App Router + Tailwind v4 + standalone output (Wave 1)
  - [x] 08-02-PLAN.md — @clerk/nextjs v6 middleware + ClerkProvider + sign-in/sign-up pages + /api/health (Wave 2)
  - [x] 08-03-PLAN.md — clientStore + server-fetch + 22 shadcn/ui components (Wave 2)
  - [x] 08-04-PLAN.md — AppShell + ClientSwitcher + ThemeContext ported; (shell) route group layout; /api/clients, /api/clients/[id], /api/platform-secrets/status proxy routes (Wave 3)
  - [x] 08-05-PLAN.md — (Wave 3)
  - [x] 08-06-PLAN.md — (Wave 3)

---

### Phase 9: Shared UI Package + Design System
**Goal**: All ~50 duplicate shadcn/ui components extracted into `packages/ui`. Single Tailwind config. Both backends' frontends (open-seo routes ported in Phase 10) import from `packages/ui`. Design tokens consistent across entire product.
**Depends on**: Phase 8
**Requirements**: UI-01 through UI-08
**Working directory**: `packages/ui/` (new), `apps/web/`
**Success Criteria** (what must be TRUE):
  1. `packages/ui` exports all shared components — `grep -r "from.*components/ui"` in `apps/web/` returns zero matches (all imports from `@tevero/ui`)
  2. Single `tailwind.config.ts` in `packages/ui` extended by `apps/web`
  3. Storybook (or equivalent) renders all components in isolation
  4. `pnpm build` at monorepo root succeeds with no type errors
**Estimated effort**: 1 week
**Plans**: 3 plans
  - [x] 09-01-PLAN.md — Bootstrap packages/ui and packages/types as workspace packages (Wave 1)
  - [x] 09-02-PLAN.md — Copy 22 components into packages/ui/src/components/ with barrel export (Wave 2)
  - [x] 09-03-PLAN.md — Rewire apps/web imports to @tevero/ui; delete local components/ui/ copies (Wave 3)

---

### Phase 10: open-seo Frontend Absorption
**Goal**: All open-seo UI routes ported into `apps/web` as Next.js App Router pages under `/clients/[id]/seo/*`. open-seo Node.js backend called via server actions — no iframe, no second domain. `seo.tevero.lt` DNS record retired. better-auth sign-in/sign-up routes deleted. open-seo Node.js process kept as pure API backend.
**Depends on**: Phase 9
**Requirements**: ABSORB-01 through ABSORB-12
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. `/clients/[id]/seo/audit`, `/clients/[id]/seo/keywords`, `/clients/[id]/seo/backlinks`, `/clients/[id]/seo/domain`, `/clients/[id]/seo/saved`, `/clients/[id]/seo/ai` all render correctly
  2. `grep -r "iframe" apps/web/src/` returns zero matches
  3. `seo.tevero.lt` nginx block removed; only `app.tevero.lt` remains
  4. open-seo sign-in/sign-up routes (`_auth.sign-in.tsx`, `_auth.sign-up.tsx`) deleted from `open-seo-main/src/routes/`
  5. All open-seo API calls go through Next.js server actions; no cross-origin requests
**Estimated effort**: 2–3 weeks
**Plans**: 4 plans (4 complete)
  - [x] 10-01-PLAN.md — Server actions and API routes for open-seo backend (Wave 1)
  - [x] 10-02-PLAN.md — SEO audit page port (Wave 2)
  - [x] 10-03-PLAN.md — Keywords, backlinks, domain pages port (Wave 2)
  - [x] 10-04-PLAN.md — Saved items and AI recommendations pages port (Wave 3)

---

### Phase 11: Clerk Auth Unified — open-seo Backend
**Goal**: open-seo Node.js backend accepts Clerk JWTs. better-auth removed entirely. User logs in once via Clerk; all open-seo API calls authenticated with the same token. `session`, `account`, `verification` tables dropped. `clerk_user_id` column added to open-seo `user` table.
**Depends on**: Phase 10 (open-seo frontend absorbed; sign-in routes gone)
**Requirements**: UNAUTH-01 through UNAUTH-08
**Working directory**: `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. `curl https://app.tevero.lt/seo-api/healthz` with valid Clerk JWT in `Authorization: Bearer` returns 200; without token returns 401
  2. `grep -r "better-auth\|betterAuth" open-seo-main/src/` returns zero matches
  3. Drizzle migration drops `session`, `account`, `verification` tables; adds `clerk_user_id` to `user`
  4. `pnpm --filter open-seo-main tsc --noEmit` passes
  5. Existing audit + keyword data intact after migration (no data loss)
**Estimated effort**: 1–2 weeks
**Plans**: 4 plans
  - [x] 11-01-PLAN.md — Add Clerk JWT verification library (jose) (Wave 1)
  - [x] 11-02-PLAN.md — Drizzle migration: clerk_user_id column, drop session/account/verification tables (Wave 1)
  - [x] 11-03-PLAN.md — Rewrite auth middleware to use Clerk JWT (Wave 2)
  - [x] 11-04-PLAN.md — Remove better-auth package and all references (Wave 3)

---

### Phase 12: Per-Client Credentials System
**Goal**: Agency staff connect client Google (GSC + GA4 + GBP), Bing, and other OAuth providers per client — not per user. Credentials stored encrypted in PostgreSQL against `client_id`. Magic-link invite page (`/connect/[token]`) lets clients self-authorize without an account. Connection status visible at `/clients/[id]/connections`.
**Depends on**: Phase 11
**Requirements**: CREDS-01 through CREDS-14
**Working directory**: `apps/web/`, `AI-Writer/backend/`
**Success Criteria** (what must be TRUE):
  1. `client_oauth_tokens` and `client_connect_invites` tables created via Alembic migration
  2. `GET /clients/[id]/connections` shows connection status for Google, Bing, WordPress, Shopify, Wix
  3. Generating an invite link and visiting `/connect/[token]` completes Google OAuth and stores token against `client_id` (not user)
  4. Expired/invalid invite tokens return a clear error page — not a 500
  5. Existing per-user GSC/Bing credentials in SQLite migrated to per-client PostgreSQL
  6. `grep -r "gsc_credentials\|bing_oauth_tokens" AI-Writer/backend/services/` — old SQLite-backed credential tables replaced
**Estimated effort**: 3 weeks
**Plans**: 4 plans
  - [x] 12-01-PLAN.md — Alembic migration + ORM models for client_oauth_tokens, client_oauth_properties, client_connect_invites (Wave 1)
  - [x] 12-02-PLAN.md — ClientOAuthService + API router: invite generation, OAuth flow, callback handling (Wave 2)
  - [x] 12-03-PLAN.md — Next.js /connect/[token] magic link page + /clients/[id]/connections UI (Wave 3, checkpoint)
  - [x] 12-04-PLAN.md — Migration script: per-user SQLite credentials to per-client PostgreSQL (Wave 4, checkpoint)

---

### Phase 13: Analytics Data Layer
**Goal**: Nightly BullMQ workers sync GSC and GA4 data for every connected client into `gsc_snapshots` and `ga4_snapshots` tables. 90-day historical backfill on first connect. Token refresh handled automatically; failed refreshes flagged per client. Data available for all dashboard queries within 2h of connection.
**Depends on**: Phase 12
**Requirements**: ANALYTICS-01 through ANALYTICS-10
**Working directory**: `AI-Writer/backend/`, `open-seo-main/` (BullMQ workers)
**Success Criteria** (what must be TRUE):
  1. `gsc_snapshots` and `ga4_snapshots` tables created and populated for all clients with active Google tokens
  2. BullMQ job `sync-client-analytics` runs nightly at 02:00 UTC; `docker compose logs open-seo-worker` shows successful sync entries
  3. Token expiry within 24h triggers automatic refresh; failure sets `is_active=false` and surfaces in connection status UI
  4. 90-day backfill completes for a new connection within 10 minutes
  5. `SELECT COUNT(*) FROM gsc_snapshots WHERE client_id = $1` returns >= 30 rows after backfill
**Estimated effort**: 2 weeks
**Plans**: 4 plans
  - [x] 13-01-PLAN.md — Alembic migration 0013 + ORM models + internal API endpoint for token access (Wave 1)
  - [x] 13-02-PLAN.md — BullMQ analytics queue + worker infrastructure + aiwriter-api client (Wave 2)
  - [x] 13-03-PLAN.md — GSC/GA4 sync processor + google-auth token refresh + internal API token update endpoints (Wave 3)
  - [x] 13-04-PLAN.md — Drizzle schema + backfill trigger on OAuth callback (Wave 3)
  - [x] 13-05-PLAN.md — Server integration + docker-compose env vars + verification checkpoint (Wave 4)

---

### Phase 14: Analytics UX — Agency Dashboard + Per-Client Views
**Goal**: `/dashboard` shows all clients' organic traffic health at a glance with anomaly flags. `/clients/[id]/analytics` shows GSC + GA4 side by side with 30/90-day trend charts and top queries. Clients with no connection show inline "Send invite" CTA. Traffic drops >20% WoW auto-flagged at top of dashboard.
**Depends on**: Phase 13
**Requirements**: UX-01 through UX-12
**Working directory**: `apps/web/`
**Success Criteria** (what must be TRUE):
  1. `/dashboard` loads in < 1s (server-rendered, data from PostgreSQL snapshots — no live API calls)
  2. A client with a GSC token shows clicks, impressions, CTR, avg position for last 30 days
  3. A client with clicks down >20% WoW appears in a "Needs attention" section at dashboard top
  4. A client with no Google connection shows "Connect Google" / "Send invite link" CTA inline
  5. `/clients/[id]/analytics` renders GSC line chart + GA4 summary + top 10 queries table
  6. Recharts used for all charts; no additional charting library added
**Estimated effort**: 2 weeks
**Plans**: 4 plans (4 complete)
  - [x] 14-01-PLAN.md — TypeScript types + FastAPI dashboard endpoint + Dashboard nav item (Wave 1)
  - [x] 14-02-PLAN.md — Dashboard page with StatusBadge, DashboardTable, needs attention section (Wave 2)
  - [x] 14-03-PLAN.md — Chart components: GSCChart, GA4Chart, QueriesTable, DateRangeSelector, StatCard (Wave 2)
  - [x] 14-04-PLAN.md — Per-client analytics page with server action and human verification (Wave 3, checkpoint)

---

## v3.0 Agency Intelligence

> **Milestone goal**: Transform the platform from a data viewer into an actionable intelligence tool. Automated PDF reports with white-label branding. Daily rank tracking with drop alerts. AI-powered insights that surface opportunities and problems before they become crises. All AI features behind feature flags for controlled rollout.

---

### Phase 15: Report Generation Engine
**Goal**: Generate PDF reports from analytics data using Puppeteer. Report templates as React components rendered server-side. Reports stored in filesystem with metadata in PostgreSQL.
**Depends on**: Phase 14 complete
**Requirements**: RPT-01 through RPT-08
**Working directory**: `apps/web/`, `AI-Writer/backend/`
**Success Criteria** (what must be TRUE):
  1. `POST /api/reports/generate` with client_id creates a PDF report within 30 seconds
  2. Report includes: GSC summary, GA4 summary, top queries table, traffic trend chart
  3. PDF renders correctly in browser and prints cleanly
  4. Reports stored at `/data/reports/{client_id}/{date}.pdf` with metadata in `reports` table
  5. `GET /api/reports/{id}/download` returns the PDF with correct Content-Type
**Estimated effort**: 2 weeks
**Plans**: 4 plans (4 complete)
  - [x] 15-01-PLAN.md — Report template system and React components (Wave 1)
  - [x] 15-02-PLAN.md — Report data layer, BullMQ queue, API routes (Wave 1)
  - [x] 15-03-PLAN.md — BullMQ worker and Puppeteer PDF generation (Wave 2)
  - [x] 15-04-PLAN.md — Report UI pages at /clients/[clientId]/reports (Wave 3, checkpoint)

---

### Phase 16: Report Scheduling & White-Label
**Goal**: Schedule weekly/monthly reports via BullMQ. Email delivery via existing email service. White-label branding (logo, colors, footer) configurable per client.
**Depends on**: Phase 15
**Requirements**: RPT-09 through RPT-16
**Working directory**: `apps/web/`, `AI-Writer/backend/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. `report_schedules` table stores cron expressions per client
  2. BullMQ scheduler triggers report generation at configured times
  3. Generated reports emailed to configured recipients
  4. `client_branding` table stores logo_url, primary_color, footer_text per client
  5. Reports render with client branding when configured; fallback to Tevero branding
  6. `/clients/[id]/settings/branding` UI to upload logo and set colors
**Estimated effort**: 2 weeks
**Plans**: 4 plans (4 complete)
  - [x] 16-01-PLAN.md — Report scheduler BullMQ queue + worker (Wave 1)
  - [x] 16-02-PLAN.md — Email delivery integration with existing email service (Wave 1)
  - [x] 16-03-PLAN.md — Client branding schema + API + storage (Wave 2)
  - [x] 16-04-PLAN.md — Branding settings UI + report template branding injection (Wave 3)

---

### Phase 17: Rank Tracking History (Extends Existing)
**Goal**: Add daily rank history to existing `saved_keywords` system. BullMQ worker checks positions for all saved keywords daily. Rank history stored for trend analysis. Extends existing DataForSEO SERP integration.
**Depends on**: Phase 14 (analytics data layer exists)
**Requirements**: RANK-01 through RANK-08
**Working directory**: `open-seo-main/`, `apps/web/`
**Existing foundation** (already built):
  - `saved_keywords` table — keywords to track per project
  - `keyword_metrics` table — cached latest metrics
  - DataForSEO SERP live API — on-demand position checks
  - BullMQ infrastructure — audit + analytics workers
**Success Criteria** (what must be TRUE):
  1. `keyword_rankings` table stores daily position snapshots (FK to saved_keywords)
  2. `tracking_enabled` boolean added to `saved_keywords` (default true)
  3. BullMQ job `check-keyword-rankings` runs daily at 03:00 UTC for all tracking-enabled keywords
  4. Reuses existing DataForSEO SERP client with rate limiting
  5. `/clients/[id]/seo/keywords` extended with position history column and trend sparkline
  6. Keyword detail view shows 30/90-day position chart
**Estimated effort**: 1.5 weeks
**Plans**: 4 plans (4 complete)
  - [x] 17-01-PLAN.md — Drizzle schema: keyword_rankings table + tracking_enabled column (Wave 1)
  - [x] 17-02-PLAN.md — BullMQ ranking worker reusing existing SERP client (Wave 2)
  - [x] 17-03-PLAN.md — Rankings history UI: sparklines + detail charts (Wave 3)
  - [x] 17-04-PLAN.md — Rank drop alerts integration (Wave 4)

---

### Phase 18: Monitoring & Alerts
**Goal**: Alert system for ranking drops, backlink changes, and technical issues. Notifications via email and in-app. Alert rules configurable per client.
**Depends on**: Phase 17
**Requirements**: ALERT-01 through ALERT-10
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. `alert_rules` table stores threshold configs per client (e.g., "notify if rank drops >5")
  2. `alerts` table stores triggered alerts with severity and status
  3. Ranking worker checks thresholds and creates alerts automatically
  4. `/dashboard` shows alert count badge; clicking opens alert drawer
  5. `/clients/[id]/alerts` shows alert history with acknowledge/dismiss actions
  6. Email notifications sent for high-severity alerts
**Estimated effort**: 2 weeks
**Plans**: 4 plans (4 complete)
  - [x] 18-01-PLAN.md — Alert schema + rule engine (Wave 1)
  - [x] 18-02-PLAN.md — Alert creation in ranking/analytics workers (Wave 2)
  - [x] 18-03-PLAN.md — Alert notification service + email integration (Wave 2)
  - [x] 18-04-PLAN.md — Alert UI: dashboard badge, alert drawer, history page (Wave 3)

---

### Phase 18.5: Webhook Infrastructure
**Goal**: Multi-tenant webhook system for external integrations. Configure webhooks at global (platform), workspace (agency), or client level. Events cascade down hierarchy with override capability. Reliable delivery with retry and dead-letter handling.
**Depends on**: Phase 18 (alerts exist to trigger webhooks)
**Requirements**: HOOK-01 through HOOK-12
**Working directory**: `apps/web/`, `open-seo-main/`, `AI-Writer/backend/`

**Multi-tenant hierarchy**:
  - **Global** — Platform-wide events (new workspace signup, system alerts)
  - **Workspace** — Agency-level events (all clients' alerts to agency Slack)
  - **Client** — Per-client events (specific client alerts to their own endpoint)

**Event Taxonomy (Tiered Rollout)**:

*Tier 1 — Core (Phase 18.5, 25 events):*
| Category | Events |
|----------|--------|
| Ranking | `ranking.drop`, `ranking.gain`, `ranking.entered_top_10`, `ranking.exited_top_10`, `ranking.position_1`, `ranking.lost_position_1` |
| Backlinks | `backlink.new`, `backlink.lost`, `backlink.high_authority_new`, `backlink.high_authority_lost` |
| Traffic | `traffic.anomaly_up`, `traffic.anomaly_down` |
| Technical | `audit.completed`, `audit.critical_found`, `audit.issue_resolved` |
| Reports | `report.generated`, `report.delivered`, `report.failed` |
| Connections | `connection.new`, `connection.expired`, `connection.refresh_failed` |
| Alerts | `alert.triggered`, `alert.acknowledged`, `alert.resolved` |
| Sync | `sync.completed`, `sync.failed` |

*Tier 2 — Advanced (Future enhancement, ~35 events):*
| Category | Events |
|----------|--------|
| Ranking | `ranking.serp_feature_gained`, `ranking.serp_feature_lost`, `ranking.competitor_overtook`, `ranking.we_overtook`, `ranking.volatility` |
| Backlinks | `backlink.toxic_detected`, `backlink.velocity_anomaly`, `backlink.broken`, `backlink.anchor_alert` |
| Traffic | `traffic.milestone`, `traffic.source_shift`, `traffic.conversion_drop`, `traffic.conversion_spike`, `traffic.page_decay` |
| Technical | `crawl.error_spike`, `crawl.coverage_drop`, `crawl.deindexed`, `page.cwv_degraded`, `page.cwv_improved` |
| Content | `content.published`, `content.updated`, `content.cannibalization`, `content.decay`, `content.opportunity` |
| Local SEO | `local.review_new`, `local.review_negative`, `local.review_positive`, `local.listing_changed`, `local.pack_entered`, `local.pack_exited` |
| Competitor | `competitor.ranking_surge`, `competitor.content_published`, `competitor.backlink_campaign` |

*Tier 3 — Enterprise (Future, ~33 events):*
| Category | Events |
|----------|--------|
| AI Insights | `ai.insight_generated`, `ai.opportunity_detected`, `ai.anomaly_explained`, `ai.recommendation_ready`, `ai.content_ready`, `ai.risk_detected` |
| Business Ops | `client.onboarded`, `client.status_changed`, `client.health_score_changed`, `workspace.member_added`, `workspace.member_removed` |
| Team Workflow | `task.assigned`, `task.completed`, `task.overdue` |
| Infrastructure | `ssl.expiring`, `ssl.expired`, `uptime.down`, `uptime.recovered` |
| Billing | `billing.payment_failed`, `billing.subscription_renewed` |

**Webhook Payload Structure**:
```json
{
  "id": "evt_2xK9mNp4vR",
  "type": "ranking.entered_top_10",
  "version": "2024-04-01",
  "created_at": "2026-04-19T15:30:00Z",
  "idempotency_key": "rank-kw123-2026-04-19",
  "scope": {
    "level": "client",
    "workspace_id": "ws_agency123",
    "client_id": "cli_acme456"
  },
  "data": { /* event-specific payload */ },
  "context": {
    "project_name": "ACME Corp SEO",
    "client_name": "ACME Corporation",
    "workspace_name": "Tevero Agency"
  },
  "links": {
    "dashboard": "https://app.tevero.lt/clients/cli_acme456/seo/keywords",
    "api": "https://app.tevero.lt/api/keywords/kw_789"
  }
}
```

**Success Criteria** (what must be TRUE):
  1. `webhooks` table stores endpoint URL, secret, events array, scope (global/workspace/client), scope_id
  2. `webhook_deliveries` table logs all delivery attempts with status, response, retry count
  3. `webhook_events` table defines all available events with category, tier, and schema
  4. BullMQ `webhook-delivery` queue handles async delivery with exponential backoff (3 retries)
  5. Failed deliveries after max retries land in DLQ; visible in admin UI
  6. HMAC signature in `X-Webhook-Signature` header using SHA-256
  7. Idempotency keys prevent duplicate processing by receivers
  8. `/settings/webhooks` (global), `/workspaces/[id]/webhooks`, `/clients/[id]/webhooks` configuration UIs
  9. Event filtering: subscribe to specific events, categories, or wildcards (`ranking.*`)
  10. Test webhook button sends sample payload and shows response
  11. Webhook logs viewer with payload inspection and retry button
**Estimated effort**: 3 weeks
**Plans**: 4 plans
  - [x] 18.5-01-PLAN.md — Webhook schema + event registry + delivery queue (Wave 1)
  - [x] 18.5-02-PLAN.md — Webhook dispatcher: event emission → matching hooks → enqueue (Wave 2)
  - [x] 18.5-03-PLAN.md — HMAC signing + idempotency + retry logic + DLQ handling (Wave 2)
  - [x] 18.5-04-PLAN.md — Wire Tier 1 events: alerts, reports, rankings, connections (Wave 3)
  - [x] 18.5-05-PLAN.md — Configuration UI + logs viewer + test button (Wave 4)

---

### Phase 19: AI Insights — Report Summaries (Feature-Flagged)
**Goal**: AI-generated executive summaries for reports. AI-powered audit recommendations. All AI features behind `ai_features_enabled` flag per client.
**Depends on**: Phase 15 (reports exist), Phase 18 (alerts exist)
**Requirements**: AI-01 through AI-08
**Working directory**: `apps/web/`, `AI-Writer/backend/`
**Success Criteria** (what must be TRUE):
  1. `feature_flags` table with `ai_features_enabled` boolean per client
  2. `/clients/[id]/settings/features` toggle for AI features
  3. When enabled: reports include AI-generated "Executive Summary" section
  4. When enabled: audit findings include AI-generated "Recommended Fix" text
  5. When disabled: AI sections hidden, no API calls made
  6. AI calls go to existing AI-Writer LLM infrastructure
**Estimated effort**: 2 weeks
**Plans**: 4 plans
  - [ ] 19-01-PLAN.md — Feature flag schema + API + settings UI (Wave 1)
  - [ ] 19-02-PLAN.md — AI summary service: report data → executive summary (Wave 2)
  - [ ] 19-03-PLAN.md — AI audit recommendations: finding → fix suggestion (Wave 2)
  - [ ] 19-04-PLAN.md — Integrate AI sections into report template + audit UI (Wave 3)

---

### Phase 20: AI Content Briefs (Feature-Flagged)
**Goal**: Generate content briefs from SERP analysis. Analyze top-ranking pages and suggest outline, word count, headers. Bridge to AI-Writer content generation.
**Depends on**: Phase 19, Phase 17 (ranking data exists)
**Requirements**: AI-09 through AI-14
**Working directory**: `apps/web/`, `AI-Writer/backend/`
**Success Criteria** (what must be TRUE):
  1. `/clients/[id]/content-briefs` page lists briefs with status
  2. "Create Brief" button opens keyword selector; generates brief from SERP analysis
  3. Brief includes: target keyword, suggested H2s, competitor analysis, recommended word count
  4. "Generate Content" button sends brief to AI-Writer content pipeline
  5. Generated content appears in AI-Writer with link back to brief
  6. All functionality gated behind `ai_features_enabled` flag
**Estimated effort**: 2 weeks
**Plans**: 4 plans
  - [ ] 20-01-PLAN.md — Content brief schema + SERP analysis service (Wave 1)
  - [ ] 20-02-PLAN.md — Brief generation: analyze competitors, extract structure (Wave 2)
  - [ ] 20-03-PLAN.md — AI-Writer integration: brief → content generation (Wave 2)
  - [ ] 20-04-PLAN.md — Content briefs UI + generation flow (Wave 3)

---

### Phase 21: Agency Command Center
**Goal**: Transform `/dashboard` into a world-class agency command center with portfolio health overview, interactive hover insights, real-time activity feed, wins tracking, team workload visualization, and configurable views. The single screen where agency owners start their day.
**Depends on**: Phase 18.5 (events feed into activity stream), Phase 17 (ranking data)
**Requirements**: CMD-01 through CMD-18
**Working directory**: `apps/web/`, `AI-Writer/backend/`

**Dashboard Sections**:

1. **Portfolio Health Summary** (top row)
   - Total active clients, clients needing attention, wins this week
   - Portfolio-wide impressions/clicks totals
   - Average traffic change vs previous period
   - Keyword position distribution bars (% in Top 10 / Top 3 / #1)

2. **Needs Attention** (priority section)
   - Color-coded severity (red = critical, orange = warning, yellow = info)
   - Inline context (understand issue without clicking)
   - Quick actions: View, Snooze, Reconnect, Dismiss
   - Filter by type, client, severity, age

3. **Wins & Milestones**
   - Celebrate successes: #1 positions, Top 10 entries, traffic milestones
   - High-authority backlinks acquired
   - Share/export for team or client presentations

4. **Client Portfolio Table** (main section)
   | Column | Hover Reveals |
   |--------|---------------|
   | Health Score | Breakdown by category (traffic, rankings, technical, backlinks, content) + top issues |
   | Traffic Trend | 30-day sparkline + drop start date + affected pages |
   | Keywords Tracked | Category breakdown + recent changes |
   | Top 10 / Top 3 / #1 | Position distribution histogram + weekly movement |
   | Backlinks | New this month + quality breakdown |
   | Added Date | Client timeline/journey + tenure + milestones |

5. **Activity Feed** (real-time)
   - WebSocket-powered live updates
   - Filter by event type, client
   - Pause/resume feed

6. **Quick Stats Cards** (configurable)
   - Drag-and-drop card arrangement
   - 20+ metric options to choose from
   - Add/remove cards per user preference

7. **Team Workload** (for agencies with staff)
   - Clients per team member with capacity bar
   - Overload warnings

8. **Upcoming / Scheduled**
   - Reports due, audits scheduled, SSL expirations
   - Client calls/meetings (if calendar integrated)

**Data Model Additions**:
```sql
-- Pre-computed client metrics (background job updates every 5 min)
CREATE TABLE client_dashboard_metrics (
  client_id UUID PRIMARY KEY,
  health_score INTEGER,
  health_breakdown JSONB,
  traffic_current INTEGER,
  traffic_previous INTEGER,
  traffic_trend_pct DECIMAL(5,2),
  keywords_total INTEGER,
  keywords_top_10 INTEGER,
  keywords_top_3 INTEGER,
  keywords_position_1 INTEGER,
  keywords_distribution JSONB,
  backlinks_total INTEGER,
  backlinks_new_month INTEGER,
  alerts_open INTEGER,
  alerts_critical INTEGER,
  last_report_at TIMESTAMPTZ,
  last_audit_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity feed (event sourcing)
CREATE TABLE portfolio_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  client_id UUID,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved dashboard views
CREATE TABLE dashboard_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  layout JSONB,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Success Criteria** (what must be TRUE):
  1. `/dashboard` loads in < 1s for 100+ clients (server-rendered, pre-computed metrics)
  2. Portfolio health summary shows accurate totals with position distribution bars
  3. "Needs Attention" section surfaces clients with alerts, health < 60, or connection issues
  4. "Wins This Week" section shows milestones: #1 hits, Top 10 entries, traffic milestones, high-DA backlinks
  5. Client table supports sorting by any column + filtering by health/traffic/connection/tags
  6. Hovering any metric cell shows contextual popup with sparkline/breakdown (no extra click)
  7. Activity feed updates in real-time via WebSocket; supports filtering and pause
  8. Quick stats cards are drag-and-drop configurable; preferences persist per user
  9. Saved views: "My Clients", "Needs Attention", "New This Month", custom filters
  10. Export client list to CSV with selected columns
  11. Mobile-responsive: collapses to health summary + needs attention + swipeable client cards
  12. Background job computes `client_dashboard_metrics` every 5 minutes
**Estimated effort**: 3 weeks
**Plans**: 4 plans
Plans:
- [x] 21-01-PLAN.md — Dashboard metrics schema + BullMQ worker for 5-min pre-computation (Wave 1)
- [x] 21-02-PLAN.md — Portfolio health summary + needs attention + wins/milestones sections (Wave 2)
- [x] 21-03-PLAN.md — Client portfolio table with hover popovers + sorting + filtering (Wave 2)
- [x] 21-04-PLAN.md — Real-time activity feed (Socket.IO) + drag-and-drop quick stats cards (Wave 3)
- [x] 21-05-PLAN.md — Saved views + CSV export + team workload + mobile responsive layout (Wave 4)

---

### Phase 22: Goal-Based Metrics System
**Goal**: Replace arbitrary health score with goal-based tracking. Agencies select goal templates (e.g., "Keywords in Top 10"), configure target values per client, and the system tracks progress automatically.
**Depends on**: Phase 21
**Requirements**: GOAL-01 through GOAL-08
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. Goal templates seeded in database (9 standard templates)
  2. Per-client goal configuration UI working at `/clients/[id]/settings/goals`
  3. Goals computed automatically by BullMQ worker every 5 minutes
  4. Dashboard displays goal attainment percentage instead of health score
  5. Priority score computed for attention queue sorting (alerts × 1000 + goal gaps × 50 + traffic drops × 200)
**Estimated effort**: 3 days
**Plans**: 4 plans (5 complete)
  - [x] 22-01-PLAN.md — Schema & Templates: goal_templates, client_goals, goal_snapshots tables + seed data (Wave 1)
  - [x] 22-02-PLAN.md — Goal Computation Worker: BullMQ job, computation methods per template type (Wave 2)
  - [x] 22-03-PLAN.md — Goal Management API: CRUD endpoints, server actions (Wave 2)
  - [x] 22-04-PLAN.md — Goal Configuration UI: template selector, config form, wizard (Wave 3)
  - [x] 22-05-PLAN.md — Dashboard Integration: replace health score with goal attainment, update components (Wave 4)

---

### Phase 23: Performance & Scale
**Goal**: Optimize dashboard for 500-client portfolios with virtualization, server-side operations, and caching.
**Depends on**: Phase 22
**Requirements**: PERF-01 through PERF-08
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. Table renders 500 rows at 60fps using TanStack Virtual
  2. Initial load < 500ms with server-side filtering
  3. Filter/sort operations < 200ms via cursor pagination
  4. No memory growth on scroll (lazy sparklines)
  5. Redis caching with tag-based invalidation
**Estimated effort**: 2 days
**Plans**: 4 plans (4 complete)
  - [x] 23-01-PLAN.md — TanStack Virtual + Lazy Sparklines: VirtualizedTable, IntersectionObserver loading (Wave 1)
  - [x] 23-02-PLAN.md — Cursor Pagination + Server Filters: cursor encoding, FilterBar, usePaginatedClients hook (Wave 2)
  - [x] 23-03-PLAN.md — Redis Caching + Optimistic Updates: cacheGet/cacheSet/invalidateByTag, withCache wrapper (Wave 2)
  - [x] 23-04-PLAN.md — Portfolio Aggregates Table: pre-computed metrics, BullMQ worker, 5-min schedule (Wave 3)

---

### Phase 24: Power User Features
**Goal**: Add keyboard navigation, command palette, bulk operations, saved views, and export capabilities for power users managing large portfolios.
**Depends on**: Phase 23
**Requirements**: POWER-01 through POWER-10
**Working directory**: `apps/web/`
**Success Criteria** (what must be TRUE):
  1. Full keyboard navigation (j/k/Enter/Space//)
  2. Command palette with fuzzy search (Cmd+K)
  3. Bulk actions on 50+ selected clients work correctly
  4. Saved views persist across sessions per user
  5. Export works for filtered data (CSV + PDF)
**Estimated effort**: 2 days
**Plans**: 4 plans (4 complete)
  - [x] 24-01-PLAN.md — Keyboard Navigation + Command Palette: useTableKeyboardNav hook, cmdk integration (Wave 1)
  - [x] 24-02-PLAN.md — Bulk Operations: useRowSelection hook, shift-click range, BulkActionBar (Wave 2)
  - [x] 24-03-PLAN.md — Saved Views + Column Customization: saved_views schema, drag-and-drop columns (Wave 2)
  - [x] 24-04-PLAN.md — CSV/PDF Export: generateCSV, jspdf integration, ExportButton (Wave 3)

---

### Phase 25: Team & Intelligence
**Goal**: Add team management features (workload balancing, assignments) and intelligent insights (pattern detection, predictions, opportunity identification).
**Depends on**: Phase 24
**Requirements**: TEAM-01 through TEAM-12
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. Team dashboard shows member workloads with capacity utilization bars
  2. Workload balancing suggestions work via generateReassignmentSuggestions algorithm
  3. Pattern detection finds industry-wide trends (traffic drops, ranking changes)
  4. Goal projections show estimated completion with trend analysis
  5. Opportunities surface actionable insights (CTR improvements, ranking gaps, quick wins)
**Estimated effort**: 2 days
**Plans**: 4 plans (4 complete)
  - [x] 25-01-PLAN.md — Team Dashboard + Workload Balancing: clientAssignments, teamMemberMetrics schemas, TeamDashboard component (Wave 1)
  - [x] 25-02-PLAN.md — Cross-Client Pattern Detection: detectedPatterns schema, linearRegression, PatternsPanel (Wave 2)
  - [x] 25-03-PLAN.md — Predictive Alerts + Goal Projection: predictTrafficDecline, projectGoal, GoalProjectionCard (Wave 2)
  - [x] 25-04-PLAN.md — Opportunity Identification: CTR improvements, ranking gaps, quick wins algorithms (Wave 3)

---

## v4.0 Prospecting & Sales

Transform the platform from client-only analytics into a full sales pipeline tool. Analyze prospects BEFORE they become clients to demonstrate value and win deals.

---

### Phase 26: Prospect Data Model & Basic Analysis
**Goal**: Store prospects by domain (separate from clients), run basic keyword analysis to show what they currently rank for and their competitive landscape.
**Depends on**: Phase 21 (dashboard infrastructure), Phase 17 (ranking data patterns)
**Requirements**: PROSP-01 through PROSP-08
**Working directory**: `apps/web/`, `open-seo-main/`

**Example Use Case**:
> "helsinkisaunas.com sells saunas. Show me what keywords they rank for and who their competitors are."

**Data Model**:
```sql
-- Prospects: potential clients (not yet paying)
CREATE TABLE prospects (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  domain TEXT NOT NULL,
  company_name TEXT,
  contact_email TEXT,
  contact_name TEXT,
  industry TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new',  -- new, analyzing, analyzed, converted, archived
  source TEXT,                -- referral, cold_outreach, inbound, etc.
  assigned_to UUID,
  converted_client_id UUID,   -- links to clients.id after conversion
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis results (one per analysis run)
CREATE TABLE prospect_analyses (
  id UUID PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES prospects(id),
  analysis_type TEXT NOT NULL,  -- 'quick_scan', 'deep_dive', 'opportunity_discovery'
  status TEXT DEFAULT 'pending',
  target_region TEXT,           -- "EU", "US", "UK"
  target_language TEXT,         -- "en", "de", "fi"
  competitor_domains JSONB,
  domain_metrics JSONB,         -- authority, traffic, age
  organic_keywords JSONB,       -- what they currently rank for
  competitor_keywords JSONB,    -- competitor gap analysis
  cost_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**Success Criteria** (what must be TRUE):
  1. `prospects` and `prospect_analyses` tables exist with proper indexes
  2. `/prospects` page lists prospects with status badges and domain
  3. "Add Prospect" creates prospect record with domain validation
  4. "Analyze" triggers BullMQ job that calls DataForSEO
  5. Analysis shows: domain metrics, current keywords, top competitors
  6. Results cached in `prospect_analyses` with cost tracking
  7. Rate limiting: max 10 analyses/day per workspace
**Estimated effort**: 1 week
**Plans**: 4 plans (4 complete)
  - [x] 26-01-PLAN.md — Prospect schema + migrations + basic CRUD API (Wave 1)
  - [x] 26-02-PLAN.md — DataForSEO integration: keywordsForSite, competitorsDomain, domainRankOverview (Wave 2)
  - [x] 26-03-PLAN.md — BullMQ prospect-analysis queue + worker with rate limiting (Wave 2)
  - [x] 26-04-PLAN.md — Prospects UI: list, detail, analyze button, results display (Wave 3)

---

### Phase 27: Website Scraping & Business Understanding
**Goal**: Scrape prospect's website to understand what they actually sell. Works even when they have zero keyword rankings.
**Depends on**: Phase 26
**Requirements**: PROSP-09 through PROSP-14
**Working directory**: `apps/web/`, `open-seo-main/`

**Example Use Case**:
> "helsinkisaunas.com has zero rankings. Scrape their site → they sell barrel saunas, cabin saunas, Harvia heaters, offer installation in Helsinki."

**Scraping Strategy**:
```
Layer 1: Cheerio (free, fast, ~80% of sites)
Layer 2: DataForSEO On-Page API (JS sites, bot protection, ~$0.02/page)
Layer 3: User input fallback ("What do they sell?")

Pages to scrape:
1. Homepage - main value prop
2. /products or /shop - actual product list
3. /about - business description  
4. /services - what services offered
5. 1 category page - specific products
```

**AI Extraction**:
```json
{
  "products": ["barrel saunas", "cabin saunas", "infrared saunas"],
  "brands": ["Harvia", "Tylo", "Narvi"],
  "services": ["installation", "delivery", "maintenance"],
  "location": "Helsinki, Finland",
  "target": "residential"
}
```

**Success Criteria** (what must be TRUE):
  1. Cheerio scraper extracts title, meta, headings, content, links from static sites
  2. DataForSEO On-Page fallback handles JS-rendered sites
  3. Smart link detection finds /products, /about, /services pages
  4. AI extracts: products, brands, services, location, target market
  5. Scrape results stored in `prospect_analyses.scraped_content`
  6. Works for zero-ranking prospects (scraping doesn't need rankings)
  7. User input fallback when scraping fails completely
**Estimated effort**: 1 week
**Plans**: 3 plans
  - [ ] 27-01-PLAN.md — Cheerio scraper + smart link detection + content extraction (Wave 1)
  - [ ] 27-02-PLAN.md — DataForSEO On-Page fallback + hybrid scrape flow (Wave 1)
  - [ ] 27-03-PLAN.md — AI business extraction prompt + user input fallback UI (Wave 2)

---

### Phase 28: Keyword Gap & Opportunity Analysis
**Goal**: Show keywords competitors rank for that the prospect doesn't (gap analysis). Filter by achievability based on prospect's domain authority.
**Depends on**: Phase 27
**Requirements**: PROSP-15 through PROSP-20
**Working directory**: `apps/web/`, `open-seo-main/`
**Current state**: 60% — domainIntersection API, gap table, CSV export exist; missing DA-based achievability, filters, Quick Wins

**Example Use Case**:
> "helsinkisaunas.com has DA 25. Show keywords their competitors rank for that they don't, but only ones they could realistically rank for (difficulty < 45)."

**Analysis Types**:
- **Competitor Gap**: Keywords competitors have, prospect doesn't
- **Achievability Filter**: difficulty <= (domainAuthority + 20)
- **Quick Wins**: Low difficulty + decent volume + not ranking

**Success Criteria** (what must be TRUE):
  1. DataForSEO `domainIntersection` integration working
  2. Gap analysis shows: keyword, volume, difficulty, which competitors rank
  3. Achievability score calculated: `100 - max(0, difficulty - DA)`
  4. Filter controls: min volume, max difficulty, competitor selection
  5. "Quick Wins" tab highlights low-effort opportunities
  6. Export gap analysis to CSV
**Estimated effort**: 1 week
**Plans**: 4 plans
  - [x] 28-01-PLAN.md — DataForSEO domainIntersection + basic scoring (Wave 1) ✅ DONE
  - [ ] 28-02-PLAN.md — DA-based achievability formula: `100 - max(0, difficulty - DA)` (Wave 2) ⚠️ GAP
  - [ ] 28-03-PLAN.md — Gap analysis UI: filters (min volume, max difficulty, competitor selector) (Wave 2) ⚠️ GAP
  - [ ] 28-04-PLAN.md — Quick Wins tab + classification algorithm (Wave 3) ⚠️ GAP

---

### Phase 29: AI Opportunity Discovery ("Could Rank For")
**Goal**: Use AI + scraped content to generate keywords the prospect SHOULD target — even with zero existing rankings.
**Depends on**: Phase 27 (scraping), Phase 28 (gap analysis)
**Requirements**: PROSP-21 through PROSP-28
**Working directory**: `apps/web/`, `open-seo-main/`, `AI-Writer/backend/`
**Current state**: 55% — Services exist but NOT wired to processor; UI components in open-seo-main but NOT in apps/web

**CRITICAL GAP**: `OpportunityDiscoveryService` exists but is NEVER called in `prospect-analysis-processor.ts`. The `opportunity_discovery` analysis type does nothing.

**Example Use Case**:
> "helsinkisaunas.com sells barrel saunas, cabin saunas, Harvia heaters (from scrape). AI generates: 'barrel sauna prices', 'Harvia vs Tylo', 'sauna health benefits', 'sauna installation Helsinki', 'home spa ideas'."

**The AI Discovery Pipeline**:
```
1. BUSINESS CONTEXT (from Phase 27 scrape)
   - Products: barrel saunas, cabin saunas, infrared saunas
   - Brands: Harvia, Tylo, Narvi
   - Services: installation, delivery
   - Location: Helsinki, Finland

2. AI KEYWORD GENERATION (from actual products)
   - Product keywords: "buy barrel sauna", "cabin sauna prices"
   - Brand keywords: "Harvia sauna heater", "Tylo vs Harvia"
   - Service keywords: "sauna installation Helsinki"
   - Problem keywords: "home relaxation ideas", "muscle recovery"
   - Educational: "sauna health benefits", "how to use sauna"

3. VALIDATION (DataForSEO)
   - Get real volume/difficulty for AI suggestions
   - Filter by achievability (DA-based)

4. SCORING
   - achievability × value × relevance
   - Classify: quick_win, strategic, long_tail

5. SYNTHESIS
   - Executive summary for sales
   - Top opportunities with rationale
```

**Success Criteria** (what must be TRUE):
  1. AI generates keywords from scraped products/brands/services (not templates)
  2. Keywords are specific to THIS business (e.g., "Harvia" not generic "sauna brand")
  3. DataForSEO validates AI suggestions with real metrics
  4. Combined opportunity score: achievability × value × relevance
  5. Works for zero-ranking prospects (uses scrape data, not rankings)
  6. "Opportunity Discovery" tab shows AI-found keywords with rationale
  7. Executive summary generated for sales use
**Estimated effort**: 1.5 weeks
**Plans**: 4 plans
  - [x] 29-01-PLAN.md — AI keyword generation service (keywordGenerator.ts) ✅ DONE
  - [x] 29-02-PLAN.md — DataForSEO validation (volumeValidator.ts, dataforseoVolume.ts) ✅ DONE
  - [ ] 29-03-PLAN.md — **Wire OpportunityDiscoveryService into processor** (Wave 1) 🚨 CRITICAL
  - [ ] 29-04-PLAN.md — Keyword classification: quick_win, strategic, long_tail (Wave 2) ⚠️ GAP
  - [ ] 29-05-PLAN.md — Opportunity Discovery UI in apps/web + executive summary (Wave 3) ⚠️ GAP

---

### Phase 30: Prospect Conversion & Sales Tools
**Goal**: Convert prospects to clients with one click (migrate data). Generate sales reports/presentations from analysis.
**Depends on**: Phase 29
**Requirements**: PROSP-29 through PROSP-34
**Working directory**: `apps/web/`, `open-seo-main/`
**Current state**: 100% — Complete (conversion, shareable links, email templates, keyword import, analysis PDF)

**Conversion Flow**:
```
Prospect (helsinkisaunas.com)
    ↓ "Convert to Client"
Client record created
    ↓
Latest analysis imported to client intelligence
    ↓
Project created with ALL opportunity keywords
    ↓
GSC connected → FREE daily ranking updates
    ↓
Keywords show "ranked" or "not ranked yet" based on GSC
    ↓
Prospect marked as converted (linked)
```

**Key Data Flow**:
- **Prospects**: DataForSEO one-time analysis ($0.50-0.80) for opportunity discovery
- **Clients**: GSC (FREE!) provides ongoing ranking truth
- If keyword not in GSC → status: "not ranked yet"

**Sales Tools**:
- PDF report with opportunities + executive summary
- Shareable link (read-only, expires in 7 days)
- Email template with key findings

**Success Criteria** (what must be TRUE):
  1. "Convert to Client" creates client + project + imports analysis
  2. Top opportunity keywords auto-added to new project for tracking
  3. PDF export with: domain metrics, top opportunities, AI insights
  4. Shareable analysis link with expiration
  5. Email template generator for outreach
  6. Conversion tracking: which prospects became clients
**Estimated effort**: 1 week
**Plans**: 4 plans
  - [x] 30-01-PLAN.md — Prospect → Client conversion logic (onboarding.ts) ✅ DONE
  - [x] 30-02-PLAN.md — Shareable links with expiration (proposal token) ✅ DONE
  - [x] 30-03-PLAN.md — Conversion analytics dashboard ✅ DONE
  - [x] 30-04-PLAN.md — Import opportunity keywords to saved_keywords on conversion ✅ DONE
  - [x] 30-05-PLAN.md — Analysis PDF export (domain metrics, opportunities, AI insights) ✅ DONE

---

### Phase 30.5: Prospect Pipeline Automation
**Goal**: Operational automation for agencies managing 500+ prospects. Batch operations, queue-based bulk analysis, automated scoring, pipeline stage progression.
**Depends on**: Phase 30
**Requirements**: PROSP-35 through PROSP-42
**Working directory**: `apps/web/`, `open-seo-main/`

**The Problem**:
Phases 26-30 focus on single-prospect features. An agency with 500 prospects needs:
- Batch import (not one-by-one)
- Bulk analysis (queue all, not click each)
- Automated scoring and prioritization
- Pipeline stages with automatic progression
- Bulk actions (archive, tag, assign)

**Batch Operations**:
```
CSV Import → Parse → Validate → Create Prospects → Queue All for Analysis
           ↓
     500 prospects imported in 30 seconds
           ↓
     BullMQ processes analyses overnight
           ↓
     Morning: Sorted by opportunity score, ready to work
```

**Pipeline Stages & Automation**:
| Stage | Auto-Trigger | Actions |
|-------|--------------|---------|
| **new** | On creation | Queue for analysis |
| **analyzing** | Analysis started | Show progress |
| **scored** | Analysis complete | Calculate priority score |
| **qualified** | Score > threshold | Move to outreach queue |
| **contacted** | Email sent | Track response |
| **negotiating** | Response received | Manual stage |
| **converted** | Deal closed | Trigger conversion |
| **archived** | 30 days no activity | Auto-archive |

**Bulk Actions UI**:
- Select all / select by filter
- Bulk analyze (queue selected)
- Bulk tag / assign
- Bulk archive
- Bulk export to CSV

**Priority Scoring Algorithm**:
```typescript
priorityScore = (
  domainAuthority * 0.2 +           // Higher DA = more valuable
  organicTraffic * 0.15 +           // Traffic = money
  opportunityCount * 0.25 +         // More opportunities = more potential
  avgOpportunityScore * 0.25 +      // Quality of opportunities
  recencyBonus * 0.15               // Recent activity = warmer lead
)
```

**Success Criteria** (what must be TRUE):
  1. CSV import handles 500+ prospects with validation errors report
  2. "Analyze All" queues selected prospects with rate limiting (respects daily quota)
  3. Priority score computed automatically after analysis
  4. Pipeline stage progression based on configurable rules
  5. Bulk actions work on 100+ selected prospects
  6. `/prospects` list shows pipeline stage distribution chart
  7. Automated stage transitions logged for audit trail
  8. Daily digest email: new high-score prospects, stale prospects
**Estimated effort**: 1.5 weeks
**Plans**: 4 plans
  - [x] 30.5-01-PLAN.md — CSV import + validation + batch prospect creation ✅ DONE
  - [x] 30.5-02-PLAN.md — Bulk analysis queueing with quota management ✅ DONE
  - [x] 30.5-03-PLAN.md — Priority scoring algorithm + auto-compute after analysis ✅ DONE
  - [x] 30.5-04-PLAN.md — Pipeline stages schema + automation rules engine ✅ DONE
  - [x] 30.5-05-PLAN.md — Bulk actions UI + pipeline distribution chart ✅ DONE

---

## v5.0 Autonomous SEO Pipeline

> **Milestone goal**: Fully autonomous SEO platform. Client connects → system optimizes → rankings improve. Zero human oversight required for routine optimization. Auto-fix technical SEO, run 107 checks, apply safe fixes, flag complex issues. Internal linking automation. Brand voice preservation. Granular revert capability.
>
> **Revenue target**: 100 agencies × $500/month = $50k MRR → 1000 agencies = $500k MRR
>
> **Key insight**: 90% of pipeline is token-free. AI only for content generation and complex rewrites.

**Implementation Audit Summary** (2026-04-24 — UPDATED):
| Component | Current | Target | Gap |
|-----------|---------|--------|-----|
| Site Connection & Platform Detection | 95% | 100% | All adapters exist; minor UI polish |
| 107 SEO Checks | 85% | 100% | All 107 checks implemented; route uses mock data instead of real findings |
| Auto-Fix System | 75% | 100% | Backend complete; missing revert UI components |
| Keyword-to-Page Mapping | 55% | 100% | No mapping table or relevance calculation |
| Internal Linking | 92% | 100% | Full implementation; GSC stub in cannibalization service |
| Content Brief Generation | 75% | 100% | UI/wizard exist; SERP H2/word count extraction stubbed |
| Brand Voice Management | 85% | 100% | Full schema/services/UI; AI-Writer integration gaps |
| AI-Writer Integration (P39) | 35% | 100% | Token tracking only; missing quality gate, GSC submission, link insertion |

**Design Documents** (completed):
- `open-seo-main/docs/V1-SEO-IMPLEMENTATION-SPEC.md` — Full autonomous pipeline spec
- `open-seo-main/docs/MICRO-OPTIMIZATIONS-80-PERCENT.md` — 107 checks by tier
- `.planning/design/site-connection-audit-autoedit-revert-system.md` — Platform adapters + revert
- `.planning/design/brand-voice-management-system.md` — Voice modes + learning
- `.planning/design/internal-linking-automation-system.md` — Link graph + auto-link

---

### Phase 31: Site Connection & Platform Detection
**Goal**: Unified site connection model with platform auto-detection. Connects to WordPress, Shopify, Wix, Squarespace, Webflow, custom sites. Write permission verification. Encrypted credential storage.
**Depends on**: Phase 12 (per-client credentials system exists)
**Design doc**: `.planning/design/site-connection-audit-autoedit-revert-system.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**Current state**: 70% — Schema, adapters (WP, Shopify), detection service, encryption exist; missing Wix/Squarespace/Webflow adapters, API routes, UI wizard
**Requirements**: SC-01, SC-02, SC-04, SC-06
**Success Criteria** (what must be TRUE):
  1. `site_connections` table with: clientId, platform, credentials (encrypted), capabilities, status
  2. `detectPlatform(domain)` auto-detects WordPress, Shopify, Wix from headers/HTML
  3. Connection wizard guides user through OAuth or API key setup per platform
  4. Write permission verified before marking connection as active
  5. `/clients/[id]/connections` shows all connected platforms with status
  6. Platform adapters support: read content, write content, read meta, write meta
**Estimated effort**: 1.5 weeks
**Plans**: 4 plans
  - [x] 31-01-PLAN.md — Complete Wix, Squarespace, Webflow adapters + wire into ConnectionService (Wave 1)
  - [x] 31-02-PLAN.md — Create siteConnections.ts client library + Next.js API proxy routes (Wave 1)
  - [x] 31-03-PLAN.md — ConnectionWizard UI + PlatformCredentialsForm + SiteConnectionList (Wave 2)
  - [x] 31-04-PLAN.md — open-seo-main API routes for connections + platform detection (Wave 2)

---

### Phase 32: 107 SEO Checks Implementation
**Goal**: Integrate all 107 SEO checks into the audit workflow. Checks already exist by tier: Tier 1 (66 DOM/regex), Tier 2 (21 calculation), Tier 3 (13 API), Tier 4 (7 crawl). Need: runner infrastructure, workflow integration, findings persistence, UI.
**Depends on**: Phase 31 (site connection for content access)
**Design doc**: `open-seo-main/docs/MICRO-OPTIMIZATIONS-80-PERCENT.md`
**Working directory**: `open-seo-main/`, `apps/web/`
**Current state**: 85% — All 107 checks implemented (66 T1 + 21 T2 + 13 T3 + 7 T4). Schema exists at `dashboard-schema.ts:171-197`. Runner at `checks/runner.ts`. Scoring at `checks/scoring.ts`. UI exists but route uses mock data. FindingsRepository implemented in both codebases.
**Requirements**: SC-01, SC-02, SC-03, SC-04, SC-05, SC-06, SC-07, SC-08
**Remaining gaps**:
  - open-seo-main route (`audit/$pageId/index.tsx`) uses hardcoded mock data instead of real findings
  - apps/web check runner has ~40 of 107 with actual logic; rest return placeholder results
  - API route `/api/audit/findings` referenced but not found
**Success Criteria** (what must be TRUE):
  1. `audit_findings` table with: checkId, severity, autoEditable, editRecipe, field, value
  2. All 66 Tier 1 checks run during crawl phase (instant, free)
  3. All 21 Tier 2 checks run during finalize phase (light calculation)
  4. All 13 Tier 3 checks run with Lighthouse data
  5. All 7 Tier 4 checks run with site-wide crawl context
  6. `runAllChecks(url, keyword)` returns findings with scores
  7. On-page score calculated: 100-point scale with category breakdown
  8. Check results visible at `/clients/[id]/seo/audit/[pageId]`
**Estimated effort**: 2 weeks
**Plans**: 4 plans
  - [x] 32-01-PLAN.md — runAllChecks facade, FindingsRepository, CheckService (Wave 1)
  - [x] 32-02-PLAN.md — Tier 1 checks integration into crawl phase (Wave 2)
  - [x] 32-03-PLAN.md — Tier 2 checks integration into analyzing phase (Wave 2)
  - [x] 32-04-PLAN.md — Tier 3+4 checks with Lighthouse data and SiteContext (Wave 3)
  - [x] 32-05-PLAN.md — Findings UI at /clients/[id]/seo/audit/[pageId] + CSV export (Wave 4)

---

### Phase 33: Auto-Fix System with Granular Revert
**Goal**: Apply safe SEO fixes automatically. Track all changes with before/after snapshots. Granular revert by: single item, field, page, category, batch, date range, full site.
**Depends on**: Phase 31 (platform adapters), Phase 32 (check findings)
**Design doc**: `.planning/design/site-connection-audit-autoedit-revert-system.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**Current state**: 75% — Backend complete (6/8 criteria), UI gaps remain
**Verification**: `gaps_found` (6/8) — Missing revert UI route and components
**Success Criteria** (what must be TRUE):
  1. ✅ `site_changes` table with: before_value, after_value, field, status, revertedAt
  2. ✅ `change_backups` table stores full resource state for complex reverts
  3. ✅ Edit recipes defined for each auto-fixable check
  4. ✅ Safe fixes auto-applied: alt text, image dimensions, heading hierarchy, canonical, lazy loading
  5. ✅ Complex fixes flagged for review: content expansion, title rewrites, H1 changes
  6. ❌ Revert UI at `/clients/[id]/changes` with filter by category, date, status
  7. ❌ One-click revert for: single change, page, category, batch, date range
  8. ✅ Automatic revert triggers: traffic drop >20%, ranking drop >5 positions
**Estimated effort**: 2 weeks
**Plans**: 6 plans
  - [x] 33-01-PLAN.md — site_changes + change_backups + rollback_triggers schema (Wave 1)
  - [x] 33-02-PLAN.md — Edit recipe registry + safe recipes (alt, dimensions, canonical, lazy) (Wave 2)
  - [x] 33-03-PLAN.md — Platform adapter write methods + ChangeService with before/after tracking (Wave 2)
  - [x] 33-04-PLAN.md — RevertService + DependencyResolver: single, page, category, batch, date_range (Wave 3)
  - [~] 33-05-PLAN.md — Auto-revert triggers (BullMQ worker) + changes UI (Wave 4) — triggers done, UI gaps
  - [ ] 33-06-PLAN.md — Gap closure: API routes + server action fixes + connection fetching (Wave 1)

---

### Phase 34: Keyword-to-Page Mapping
**Goal**: Map keywords to target pages. Calculate relevance between keywords and existing pages. Flag keywords that need new content.
**Depends on**: Phase 26 (keyword data exists), Phase 10 (page inventory exists)
**Design doc**: `open-seo-main/docs/V1-SEO-IMPLEMENTATION-SPEC.md` (Phase 3)
**Working directory**: `open-seo-main/`, `apps/web/`
**Current state**: 55% — DataForSEO APIs complete, but no mapping table or relevance calculation
**Success Criteria** (what must be TRUE):
  1. `keyword_page_mapping` table with: keyword, targetUrl, action (optimize/create), relevance
  2. `calculateRelevance(keyword, page)` scores title/H1/content overlap
  3. `mapKeywordToPage()` implements decision logic: already ranking? best match? new content?
  4. Keyword aggregation service merges: GSC, DataForSEO, competitor analysis, prospect data
  5. `/clients/[id]/seo/keyword-mapping` shows all mappings with actions
  6. "Suggest Mapping" button auto-maps unmapped keywords
  7. Manual override: reassign keyword to different page
**Estimated effort**: 1 week
**Plans**: 4 plans
  - [ ] 34-01-PLAN.md — keyword_page_mapping schema + relevance algorithm (Wave 1)
  - [ ] 34-02-PLAN.md — mapKeywordToPage() decision logic (Wave 2)
  - [ ] 34-03-PLAN.md — Keyword aggregation service (Wave 2)
  - [ ] 34-04-PLAN.md — Mapping UI + suggest + manual override (Wave 3)

---

### Phase 35: Internal Linking Automation
**Goal**: Build link graph from crawl data. Detect opportunities (orphans, low links, missing exact-match). Auto-insert safe links. Velocity control. Cannibalization detection.
**Depends on**: Phase 32 (crawl data exists), Phase 33 (auto-fix infrastructure)
**Design doc**: `.planning/design/internal-linking-automation-system.md`
**Working directory**: `open-seo-main/`, `apps/web/`
**Current state**: 92% — Substantially complete. Schema at `link-schema.ts`. Services: VelocityService, LinkApplyService, LinkSuggestionService, CannibalizationService. BFS click depth at `click-depth.ts`. Anchor selection at `anchor-selector.ts` (50/25/25). UI at `/clients/[clientId]/seo/[projectId]/links/page.tsx`.
**Remaining gaps**:
  - GSC integration in CannibalizationService is stub (returns empty)
  - isTargetCannibalized in LinkSuggestionService hardcoded to return false
**Success Criteria** (what must be TRUE):
  1. `link_graph` table with: sourceUrl, targetUrl, anchorText, position, paragraphIndex
  2. `page_links` table with: inbound counts, click depth, opportunity score
  3. `orphan_pages` table detects pages with zero inbound links
  4. `link_opportunities` table stores detected opportunities with scoring
  5. Click depth computed via BFS from homepage; flag if >3
  6. Anchor text selection follows 50% exact / 25% branded / 25% misc
  7. Auto-insert when: wrap_existing, confidence ≥85%, <10 links on page
  8. Velocity control: max 3 links/page/day, 50/site/day
  9. Cannibalization detection prevents linking competing pages
  10. `/clients/[id]/seo/links` shows link health dashboard
**Estimated effort**: 2 weeks
**Plans**: 4 plans
  - [x] 35-01-PLAN.md — Link graph schema + extraction from crawl data (Wave 1)
  - [x] 35-02-PLAN.md — Opportunity detection: orphans, velocity, anchors, depth (Wave 2)
  - [x] 35-03-PLAN.md — Target selection + anchor text selection algorithms (Wave 2)
  - [x] 35-04-PLAN.md — Auto-insert integration + velocity control (Wave 3)
  - [x] 35-05-PLAN.md — Cannibalization detection + link health UI (Wave 4)

---

### Phase 36: Content Brief Generation
**Goal**: Generate content briefs from SERP analysis. Include target keyword, required H2s, competitor word counts, PAA questions. Voice mode selection.
**Depends on**: Phase 34 (keyword mapping shows what needs content)
**Design doc**: `open-seo-main/docs/V1-SEO-IMPLEMENTATION-SPEC.md` (Phase 5)
**Working directory**: `apps/web/`, `AI-Writer/backend/`
**Current state**: 75% — Schema at `brief-schema.ts`. SerpAnalyzer at `briefs/services/SerpAnalyzer.ts` (PAA works, H2/word count stubbed). BriefGenerator at `BriefGenerator.ts`. AIWriterClient at `AIWriterClient.ts`. Full 3-step wizard UI at `/clients/$clientId/briefs/new.tsx`.
**Remaining gaps**:
  - `extractCommonH2s()` returns empty array (TODO: implement via OnPage API or HTML parsing)
  - `calculateWordCountStats()` returns zeros (always defaults to 1800 words)
  - No 107 checks integration on generated content
**Success Criteria** (what must be TRUE):
  1. ✅ `content_briefs` table with: keyword, targetWordCount, requiredH2s, paaQuestions, voiceMode
  2. ⚠️ SERP analysis extracts: competitor word counts, common H2s, PAA questions — PAA works, H2s/word counts stubbed
  3. ✅ Brief generator creates constraints from SERP analysis
  4. ✅ Voice mode selector: preservation, application, best_practices
  5. ✅ `/clients/[id]/content-briefs` lists briefs with status (at `/clients/$clientId/briefs/`)
  6. ✅ "Create Brief" opens wizard: keyword → SERP analysis → brief preview → save
  7. ✅ "Generate Content" sends brief to AI-Writer pipeline
  8. ❌ Generated content runs 107 checks before flagging ready — NOT IMPLEMENTED
**Estimated effort**: 1.5 weeks
**Plans**: 4 plans
  - [x] 36-01-PLAN.md — content_briefs schema + SERP analysis service (Wave 1)
  - [~] 36-02-PLAN.md — Brief generation: competitor analysis, H2 extraction, PAA (Wave 2) — PAA done, H2/word count stubbed
  - [x] 36-03-PLAN.md — Brief wizard UI + voice mode selection (Wave 2)
  - [ ] 36-04-PLAN.md — AI-Writer integration + 107 checks on generated content (Wave 3) — integration exists, 107 checks missing

---

### Phase 37: Brand Voice Management
**Goal**: Full brand voice system with three modes: preservation (protect brand text), application (write in client voice), best_practices (use defaults). Voice learning from existing content.
**Depends on**: Phase 36 (content generation uses voice)
**Design doc**: `.planning/design/brand-voice-management-system.md`
**Working directory**: `apps/web/`, `AI-Writer/backend/`
**Current state**: 85% — Full schema at `voice-schema.ts` (40+ fields, exceeds 12 dimension requirement). VoiceAnalyzer + VoiceAnalysisService for learning. 8 industry templates at `industryTemplates.ts`. VoiceComplianceService with 5-dimension scoring (75+ gate). VoiceConstraintBuilder for prompt injection. Full UI at `/clients/[clientId]/settings/voice/`.
**Remaining gaps**:
  - AI-Writer has separate voice system not integrated with VoiceConstraintBuilder
  - Voice preview API endpoint implementation not found
  - voice_audit_log schema exists but no service writes to it
  - Learn Voice URL input has placeholder TODO
**Success Criteria** (what must be TRUE):
  1. ✅ `voice_profiles` table with: tone, formality, personality, vocabulary, writingMechanics (40+ fields)
  2. ✅ `voice_analysis` table stores AI analysis of existing content
  3. ✅ Voice learning: analyze 5-10 pages → extract 40+ dimensions → create profile
  4. ✅ Preservation mode: protect tagged content (`<!-- voice:protected -->`)
  5. ✅ Application mode: generate in client voice using profile
  6. ✅ Best practices mode: use default SEO-optimized voice
  7. ✅ `/clients/[id]/settings/voice` shows voice profile with edit
  8. ✅ "Learn Voice" button triggers analysis of existing content
  9. ⚠️ Voice preview: test generation before applying — UI exists, API endpoint missing
**Estimated effort**: 1.5 weeks
**Plans**: 4 plans
  - [x] 37-01-PLAN.md — voice_profiles + voice_analysis schema (Wave 1)
  - [x] 37-02-PLAN.md — Voice learning: content analysis → profile extraction (Wave 2)
  - [x] 37-03-PLAN.md — Three voice modes implementation (Wave 2)
  - [x] 37-04-PLAN.md — Voice settings UI + learning + preview (Wave 3)
  - [x] 37-05-PLAN.md — Backend voice services (VoiceComplianceService, VoiceConstraintBuilder, ProtectionRulesService)

---

### Phase 38: Autonomous Pipeline Orchestration
**Goal**: Wire all components into the autonomous loop. Daily/weekly/monthly triggers. Monitoring dashboard. Token budget tracking.
**Depends on**: Phases 31-37 (all components ready)
**Design doc**: `open-seo-main/docs/V1-SEO-IMPLEMENTATION-SPEC.md` (Autonomous Loop)
**Working directory**: `open-seo-main/`, `apps/web/`
**Success Criteria** (what must be TRUE):
  1. Daily loop: check GSC rankings, run 107 checks on top 10 pages, auto-fix safe issues
  2. Weekly loop: expand to next 50 pages, update keyword rankings, generate briefs for gaps
  3. Monthly loop: full site re-scan (<500 pages), competitor tracking, content freshness
  4. Triggered: traffic drop → investigate, ranking drop → check + suggest, new competitor → gap analysis
  5. `/dashboard` shows autonomous activity: fixes applied, issues flagged, content generated
  6. Token budget tracker: show AI spend per client, alert on unusual usage
  7. Pause/resume autonomy per client
  8. Activity log with all autonomous actions
**Estimated effort**: 1 week
**Plans**: 4 plans
  - [ ] 38-01-PLAN.md — BullMQ scheduled jobs: daily, weekly, monthly loops (Wave 1)
  - [ ] 38-02-PLAN.md — Triggered actions: drop detection, competitor alerts (Wave 2)
  - [ ] 38-03-PLAN.md — Autonomous dashboard + activity log (Wave 2)
  - [ ] 38-04-PLAN.md — Token budget tracking + pause/resume controls (Wave 3)

---

### Phase 39: AI-Writer Autonomous Integration
**Goal**: Wire all autonomous SEO systems INTO the AI-Writer content generation pipeline. Pre-generation brief enrichment, post-generation SEO validation, auto internal link insertion, 107 checks before publish.
**Depends on**: Phase 32 (107 checks), Phase 35 (internal linking), Phase 36 (briefs), Phase 37 (voice)
**Design doc**: NEW — Create `AI-WRITER-AUTONOMOUS-INTEGRATION.md`
**Working directory**: `AI-Writer/backend/`, `apps/web/`
**Current state**: See audit below

**AI-Writer Audit (2026-04-24 — UPDATED):**
| Feature | Status | Notes |
|---------|--------|-------|
| Brand voice injection | ✅ EXISTS | AI-Writer has own voice system |
| Voice templates | ✅ EXISTS | Separate from open-seo VoiceConstraintBuilder |
| ICP psychology | ✅ EXISTS | In article generation |
| Basic keyword targeting | ✅ EXISTS | In prompts |
| Word count control | ✅ EXISTS | target_word_count param |
| Structural elements (TOC, FAQ) | ✅ EXISTS | In article settings |
| CMS adapters (WP, Shopify, Wix) | ✅ EXISTS | auto_publish_executor.py |
| Auto-publish with retry | ✅ EXISTS | 15-min cycle, exponential backoff |
| Token usage tracking | ✅ EXISTS | UsageTrackingService + agent_usage_tracking.py |
| ContentBrief model | ⚠️ PARTIAL | Exists in open-seo-main, NOT in AI-Writer |
| SERP analysis before writing | ⚠️ PARTIAL | Data passed but not used in `_build_article_prompt()` |
| H2/H3 outline from SERP | ⚠️ PARTIAL | `suggested_h2s` passed but integration unclear |
| PAA questions in prompts | ⚠️ PARTIAL | Passed to API but not confirmed in prompt |
| Link suggestion service | ⚠️ PARTIAL | LinkGraphAgent exists, returns suggestions only |
| SEO analyzer framework | ⚠️ PARTIAL | 9 analyzers exist, not integrated with generation |
| Post-gen SEO validation | ❌ MISSING | No 107 checks on generated content |
| Internal link auto-insertion | ❌ MISSING | Suggestions only, no auto-insert into HTML |
| Quality gate (score >= 80) | ❌ MISSING | Simple boolean auto_publish, no scoring |
| GSC URL submission | ❌ MISSING | GSC service exists but no Indexing API |
| Link graph update on publish | ❌ MISSING | graph_builder() exists but not triggered |

**Component Completion:**
| Component | % | Key Files |
|-----------|---|-----------|
| ContentBrief model | 50% | open-seo: `brief-schema.ts`; AI-Writer: missing |
| Pre-gen SERP analysis | 70% | open-seo: `SerpAnalyzer.ts`, `analyzeSerpFn` |
| H2/H3 from SERP | 60% | Data stored, passed, usage unconfirmed |
| PAA integration | 30% | Passed but not in `_build_article_prompt()` |
| 107 SEO checks post-gen | 15% | 9 analyzers exist, no integration |
| Internal link auto-insert | 20% | LinkGraphAgent suggestions only |
| Quality gate >= 80 | 0% | Not implemented |
| GSC URL submission | 0% | Not implemented |
| Link graph updates | 10% | Framework exists, no trigger |
| Token tracking | 90% | UsageTrackingService fully implemented |

**Overall Phase 39: ~35% Complete**

**Integration Architecture:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI-WRITER AUTONOMOUS CONTENT PIPELINE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE A: Pre-Generation (NEW)                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ Content Brief│───▶│ SERP Analysis│───▶│ H2 Outline   │                   │
│  │ (Phase 36)   │    │ (DataForSEO) │    │ Generation   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                                       │                            │
│         ▼                                       ▼                            │
│  ┌──────────────┐                       ┌──────────────┐                    │
│  │ Voice Profile│                       │ PAA Questions│                    │
│  │ (Phase 37)   │                       │ Integration  │                    │
│  └──────────────┘                       └──────────────┘                    │
│                                                                              │
│  PHASE B: Generation (EXISTS - Enhanced)                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ article_generation_service.generate_article()                         │   │
│  │  + Enhanced prompt with: outline, PAA, entity targets, link targets  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  PHASE C: Post-Generation (NEW)                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ 107 SEO      │───▶│ Internal Link│───▶│ Quality Gate │                   │
│  │ Checks       │    │ Auto-Insert  │    │ (Score ≥80)  │                   │
│  │ (Phase 32)   │    │ (Phase 35)   │    │              │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ Auto-Fix     │    │ Link Graph   │    │ Approve or   │                   │
│  │ Safe Issues  │    │ Update       │    │ Flag Review  │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                                                                              │
│  PHASE D: Publishing (EXISTS - Enhanced)                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ auto_publish_executor.py                                              │   │
│  │  + Pre-publish validation (score check)                               │   │
│  │  + Post-publish sitemap ping                                          │   │
│  │  + GSC URL submission                                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Success Criteria** (what must be TRUE):
  1. Content brief data flows into `_build_article_prompt()` — outline, PAA, entities
  2. Generated content runs through 107 checks before status changes to `generated`
  3. Internal links auto-inserted into generated HTML (3-10 contextual links)
  4. SEO score ≥80 required for auto-publish; lower scores flagged for review
  5. Voice profile (Phase 37) used instead of basic `style_instructions`
  6. Post-publish: sitemap ping, GSC URL submission via API
  7. Link graph updated when new content published
  8. Token usage tracked per generation for budget monitoring
**Estimated effort**: 2 weeks
**Plans**: 4 plans
  - [ ] 39-01-PLAN.md — ContentBrief model + pre-generation enrichment service (Wave 1)
  - [ ] 39-02-PLAN.md — Enhanced prompt builder: outline, PAA, entities, link targets (Wave 2)
  - [ ] 39-03-PLAN.md — Post-generation 107 checks + auto-fix integration (Wave 2)
  - [ ] 39-04-PLAN.md — Internal link auto-insertion into generated content (Wave 3)
  - [ ] 39-05-PLAN.md — Quality gate + GSC submission + link graph update (Wave 4)

---

### Phase 40: v5.0 Gap Closure
**Goal**: Close all implementation gaps across Phases 32, 35, 36, 37, and 39 to achieve 100% completion of the Autonomous SEO Pipeline milestone.
**Depends on**: Phases 32, 35, 36, 37, 39 (partial implementations exist)
**Design doc**: `.planning/GAP-CLOSURE-V5.md`
**Working directory**: `open-seo-main/`, `AI-Writer/`, `apps/web/`
**Current state**: Plans ready, 0% executed

**Gaps Being Closed:**
| Phase | Component | Gap | Solution |
|-------|-----------|-----|----------|
| P32 | Findings API | Route uses mock data | Wire FindingsRepository to API |
| P35 | GSC Integration | CannibalizationService stub | Query gsc_snapshots table |
| P35 | Cannibalization | isTargetCannibalized returns false | Wire CannibalizationService |
| P36 | H2 Extraction | extractCommonH2s returns [] | DataForSEO OnPage API |
| P36 | Word Count | calculateWordCountStats returns 0 | Parse SERP HTML content |
| P37 | Voice Preview | API endpoint missing | Create /api/voice/{clientId}/preview |
| P37 | Voice Constraints | AI-Writer not connected | Create /api/voice/{clientId}/constraints |
| P37 | Voice Compliance | Quality gate needs endpoint | Create /api/voice/{clientId}/compliance |
| P39 | PAA Questions | Passed but not in prompts | Add to _build_article_prompt() |
| P39 | Content Validation | No 107 checks post-gen | Create /api/seo/content/validate |
| P39 | Quality Gate | Boolean auto_publish only | Score-based gate (≥80) |
| P39 | GSC Submission | No Indexing API | Add submit_url_for_indexing() |
| P39 | Link Auto-Insert | Suggestions only | InternalLinkInserter class |
| P39 | Link Graph Update | Not triggered on publish | Add update_link_graph() call |
| P39 | apps/web Proxy | Missing check proxy | Route /api/seo/content/validate |

**Success Criteria** (what must be TRUE):
  1. Phase 32 at 100% — Audit page shows real findings from FindingsRepository
  2. Phase 35 at 100% — Link suggestions use real GSC data, skip cannibalized targets
  3. Phase 36 at 100% — Brief wizard shows real SERP H2s and word counts
  4. Phase 37 at 100% — Voice preview API functional, AI-Writer uses constraints
  5. Phase 39 at 100% — Quality gate enforced, GSC submission on publish, links auto-inserted
  6. E2E test passes: Generate → Validate → Publish → GSC Submit flow
**Estimated effort**: 4 weeks (50-65 hours)
**Plans**: 4 plans
  - [ ] 40-01-PLAN.md — Foundation: P32/P35/P37 basics (8-10h)
  - [ ] 40-02-PLAN.md — SERP & Content: P36 extraction, validation (14-18h)
  - [ ] 40-03-PLAN.md — AI-Writer Core: voice, quality gate, GSC (12-18h)
  - [ ] 40-04-PLAN.md — Links & Final: auto-insert, graph update, E2E (15-20h)

---

## v5.1 Production Hardening

### Phase 41: Production Hardening
**Goal**: Remove all stub implementations, dead code, and mock data. Wire autonomous pipeline to existing services. Make system production-ready for client use.
**Depends on**: Phase 40 (Gap Closure complete)
**Requirements**: Based on MOCK-ENDPOINTS-AUDIT.md and SYSTEM-ARCHITECTURE-AUDIT.md findings
**Working directory**: TeveroSEO root (cross-cutting)
**Success Criteria** (what must be TRUE):
  1. `grep -r "generateMockTrafficData\|generateMockRankingData" apps/web/` returns zero matches
  2. `grep -r "_simulate_research" AI-Writer/backend/` returns zero matches
  3. Autonomous pipeline can detect GSC opportunities and trigger article generation
  4. Wix publishing shows real categories from API
  5. CMS connection test button works for WordPress/Shopify/Wix
  6. Dashboard errors throw instead of returning zeros
**Plans**: 4 plans (4 complete)
  - [x] 41-01-PLAN.md — Dead code removal + factory fixes (Wave 1)
  - [x] 41-02-PLAN.md — Pattern detection with real GSC data (Wave 2)
  - [x] 41-03-PLAN.md — Autonomous pipeline wiring (Wave 2)
  - [x] 41-04-PLAN.md — CMS integration polish (Wave 3)

---

## v5.2 Keyword Intelligence

### Phase 42: Keyword Intelligence Infrastructure
**Goal**: Build foundational infrastructure for intelligent keyword-to-page matching using knowledge graphs, GraphRAG, and hierarchical embeddings.
**Depends on**: Phase 41 (Production Hardening complete)
**Design docs**: `.planning/keyword-intelligence/` (18 documents)
**Working directory**: `open-seo-main/`
**Current state**: Research complete, architectural decisions made

**Technical Decisions (ADRs):**
| Decision | Choice | Reference |
|----------|--------|-----------|
| Graph Storage | FalkorDB (product catalog) + NetworkX (LightRAG) | ADR-001 |
| Embeddings | jina-embeddings-v3 @ 384-dim (Matryoshka) | ADR-002 |
| Task Routing | 60-70% to DataForSEO APIs, crawl only client sites | ADR-003 |

**Key Capabilities:**
| Component | Technology | Benefit |
|-----------|------------|---------|
| Product Catalog Graph | FalkorDB 4.14 | Sub-10ms traversals, graph-per-tenant |
| Entity Extraction | LightRAG v1.4.10 | 100 tokens/query GraphRAG |
| Semantic Matching | jina-v3 + DiskANN | 95%+ accuracy on Lithuanian |
| High-Speed Crawler | Crawlee + aiohttp | 83 pages/sec, delta sync |

**Cost Model:**
| Scenario | Cost/Prospect | Notes |
|----------|---------------|-------|
| Cold start (0% cache) | $0.50 | First in vertical |
| Mature cache (95% hit) | $0.025 | Cache flywheel engaged |
| Infrastructure | $49/mo | Hetzner CPX32 + CX52 |

**Success Criteria** (what must be TRUE):
  1. FalkorDB graph queries return in <10ms for 10k-node graphs
  2. LightRAG extracts entities from 500-page site in <5 minutes
  3. Embedding similarity search returns in <50ms for 100k vectors
  4. Crawler processes 500 products in <2 minutes
  5. Delta sync skips 80%+ unchanged pages (using seo_content_hash)
  6. Multi-tenant isolation verified (no cross-tenant data leakage)
  7. jina-v3 embeddings achieve >0.85 AUC-ROC on Lithuanian similarity
**Estimated effort**: 20 hours
**Plans**: 4 plans
  - [x] 42-01-PLAN.md — FalkorDB setup + product catalog graph schema (4h)
  - [x] 42-02-PLAN.md — LightRAG integration + entity extraction pipeline (6h)
  - [x] 42-03-PLAN.md — Hierarchical embeddings (jina-v3 @ 384-dim) + DiskANN (5h)
  - [x] 42-04-PLAN.md — Crawler (Crawlee + aiohttp) + delta sync (5h)

---

### Phase 43: Prospect Keyword Pipeline
**Goal**: Complete the prospect → komercinis → sutartele flow with intelligent keyword prioritization, page mapping, and recommendation generation.
**Depends on**: Phase 42 (42-01, 42-02, 42-03 required for page mapping)
**Design docs**: `.planning/PROSPECT-KEYWORD-PIPELINE-ANALYSIS.md`
**Working directory**: `open-seo-main/`, `apps/web/`
**Current state**: 60-70% exists (DataForSEO, prospect schema, proposal system)

**User Flow:**
```
Create Prospect → Analyze Keywords → View Priorities → Map Pages → Generate Proposal → Export CSV
```

**Prioritization Algorithm:**
```
compositeScore = (
  volumeScore * 0.15 +      // Search demand
  competitionScore * 0.10 + // Easier = higher
  relevanceScore * 0.25 +   // Product/category match
  focusScore * 0.35 +       // Business priorities (HIGHEST)
  positionScore * 0.15      // Current ranking opportunity
) * quickWinMultiplier
```

**Quick Win Detection:**
| Type | Criteria | Multiplier |
|------|----------|------------|
| Striking Distance | Position 11-30, volume >= 200, competition <= 0.7 | 1.3x |
| Low Hanging Fruit | Position 4-10, competition <= 0.5, volume >= 100 | 1.2x |
| Fresh Opportunity | Not ranking, relevance >= 0.9, volume >= 500, competition <= 0.4 | 1.15x |

**Tier Thresholds:**
| Tier | Score Range | Action |
|------|-------------|--------|
| Must-Do | 0.75 - 1.0 | Immediate |
| Should-Do | 0.50 - 0.749 | This Quarter |
| Nice-to-Have | 0.25 - 0.499 | Backlog |
| Ignore | < 0.25 | Skip |

**Existing Code (no work needed):**
| Component | Location | Status |
|-----------|----------|--------|
| DataForSEO integration | `open-seo-main/src/server/lib/dataforseo*.ts` | EXISTS |
| Prospect schema | `open-seo-main/src/db/prospect-schema.ts` | EXISTS |
| Proposal system | `open-seo-main/src/db/proposal-schema.ts` | EXISTS |
| Prospect UI | `apps/web/src/app/(shell)/prospects/` | EXISTS |

**Success Criteria** (what must be TRUE):
  1. CSV export works with Lithuanian headers (keyword, volume, tier, matched_page)
  2. Keywords display with tier badges in UI (must-do, should-do, nice-to-have)
  3. Quick wins highlighted with visual indicators (striking-distance, low-hanging-fruit)
  4. Page mapping shows keyword → URL matches with confidence scores
  5. Cannibalization warnings appear when multiple pages target same keyword
  6. Recommendations generate with clustered action steps and executive summary
  7. Full flow works: prospect → keywords → mapping → komercinis
  8. Cost per prospect < $0.10 at 95% cache hit rate
**Estimated effort**: 40 hours
**Plans**: 6 plans (5 complete, 1 deferred)
  - [x] 43-01-PLAN.md — Foundation: Entry Point Architecture + Keyword Schema (Wave 1)
  - [x] 43-02-PLAN.md — Quick Check + Competitor Spy Modes (Wave 2)
  - [x] 43-03-PLAN.md — CSV Import + Metric Detection (Wave 2)
  - [x] 43-04-PLAN.md — Prioritization Engine + UI (Wave 3)
  - [x] 43-05-PLAN.md — Scraping Customization + AI Extraction (Wave 3)
  - [ ] 43-06-PLAN.md — Proposal Generation + Copywriting AI (Wave 4) — DEFERRED to Phase 46-47 (UI requires design-system-v6)

---

## v6.0 Agency Pipeline & Design System

Transform the platform into a complete agency CRM with v6 design system compliance, proposal-to-payment flows, and professional reporting.

---

### Phase 44: Component Library Foundation
**Goal**: Establish the shared design token layer and component library that all v6 UI depends on. Design tokens from design-system-v6.md mapped to Tailwind, 41 extracted/new components, Storybook documentation, 80%+ test coverage.
**Depends on**: Phase 43 (keyword pipeline complete)
**Requirements**: All subsequent UI phases require this foundation
**Working directory**: `packages/ui/`, `apps/web/`
**Success Criteria** (what must be TRUE):
  1. CSS tokens file (`packages/ui/src/lib/tokens.css`) contains all v6 design tokens
  2. Tailwind config extended with token mappings (bg-canvas, text-accent, shadow-card, etc.)
  3. Geist/Newsreader fonts loading via next/font
  4. All 41 components implemented and exported from packages/ui
  5. Storybook stories for all components
  6. 80%+ test coverage verified
  7. No design system violations (12px floor, ghost-edge shadows, single accent color)
**Estimated effort**: 73 hours (~9 days)
**Plans**: 8 plans
  - [x] 44-01-PLAN.md — Tokens Foundation: CSS variables + Tailwind extension + font loading (Sprint 0A)
  - [ ] 44-02-PLAN.md — Extraction Tasks: ProgressBar, status-config, formatRelativeTime, CardActionMenu, StepIndicator (Sprint 0B)
  - [ ] 44-03-PLAN.md — New Primitives Part 1: Checklist, PipelineStageCard, KanbanColumn, TodayFeedItem (Sprint 0C)
  - [ ] 44-04-PLAN.md — New Primitives Part 2: EntityCard, StepWizard, SegmentedProgressBar, MetricCard, Typography (Sprint 0C)
  - [ ] 44-05-PLAN.md — v6/v7 Components: TierBreakdownTable, ConnectionStatusCard, DropCausesPanel, ReportPreviewCard, HealthGauge, OpsStrip (Sprint 5)
  - [ ] 44-06-PLAN.md — UX State Components: EmptyState, ErrorState, LoadingSkeleton, DataStateWrapper (Sprint 6)
  - [ ] 44-07-PLAN.md — Accessibility Foundation: Motion preferences, FocusTrap, SkipToMain, keyboard patterns, ARIA live (Sprint 7)
  - [ ] 44-08-PLAN.md — Stories & Tests: 14 Storybook stories + 14 unit test files + coverage verification (Sprint 0D)

---

### Phase 45: Data Foundation
**Goal**: Create database schema for agency pipeline: contracts, invoices, onboarding_checklists, pipeline_activities tables. Repository layer and Zod validation.
**Depends on**: Phase 44 (component library for later UI phases)
**Requirements**: Schema foundation for Phase 46-53 features
**Working directory**: `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. `contracts` table with state machine (draft → sent → signed → executed)
  2. `invoices` table with Stripe integration fields
  3. `onboarding_checklists` table with JSONB items structure
  4. `pipeline_activities` table for polymorphic activity feed
  5. Repository layer with CRUD + state transitions
  6. Zod schemas for API validation
  7. Migrations apply cleanly to fresh database
**Estimated effort**: 12 hours
**Plans**: 4 plans
  - [ ] 45-01-PLAN.md — Contract Schema: CONTRACT_STATE enum, e-signature fields, relations (Wave 1)
  - [ ] 45-02-PLAN.md — Invoice Schema: INVOICE_STATE enum, Stripe fields, line items JSONB (Wave 1)
  - [ ] 45-03-PLAN.md — Onboarding & Activity Schemas: checklists table, pipeline_activities polymorphic (Wave 2)
  - [ ] 45-04-PLAN.md — Repository Layer: CRUD services, state machine helpers, Zod validation (Wave 2)

---

### Phase 46-47: Proposal System
**Goal**: Complete proposal lifecycle from draft to accepted. Includes deferred 43-06 UI (proposal generation + copywriting AI) with v6 compliance.
**Depends on**: Phase 45 (data foundation), Phase 44 (component library)
**Requirements**: End-to-end proposal flow before contracts
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. Send proposal flow with email integration (Resend + Loops)
  2. Client-facing proposal page (public, token-based access)
  3. View tracking pixel/beacon for engagement signals
  4. Accept/reject flow with state transitions
  5. Proposal list with status indicators
  6. Activity logging to pipeline_activities
  7. Deferred 43-06 UI integrated: AI copywriting, recommendations display
  8. All UI follows v6 design system
**Estimated effort**: 24 hours
**Plans**: 3 plans
  - [ ] 46-01-PLAN.md — Email + Proposal List: Resend integration, proposal table UI (Wave 1)
  - [ ] 46-02-PLAN.md — Public View + Accept/Reject: client-facing page, view tracking, state transitions (Wave 2)
  - [ ] 47-01-PLAN.md — AI Recommendations + v6: deferred 43-06 UI, design compliance (Wave 3)

---

### Phase 48: Contract & Payment
**Goal**: E-signature integration (Dokobit) and Stripe invoicing for signed proposals. Automated flow: accepted → signed → paid.
**Depends on**: Phase 46-47 (proposal acceptance triggers contract)
**Requirements**: Payment before onboarding
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. Contract generated from accepted proposal
  2. E-signature flow via Dokobit (client_signed → fully_executed)
  3. Invoice created automatically after signing
  4. Stripe payment link sent with invoice
  5. Payment webhook updates invoice status
  6. State transitions: signed → paid triggers onboarding
  7. Contract and invoice views in prospect detail
**Estimated effort**: 20 hours
**Plans**: 4 plans
  - [x] 48-01-PLAN.md — Contract Generation: create from proposal, state machine, Dokobit integration (Wave 1)
  - [x] 48-02-PLAN.md — E-Signature Flow: signing UI, webhook handlers, signature records (Wave 2)
  - [x] 48-03-PLAN.md — Invoice & Stripe: invoice generation, payment links, webhook handlers (Wave 3)
  - [x] 48-04-PLAN.md — Payment → Onboarding Trigger: state transitions, onboarding checklist creation (Wave 4)

---

### Phase 49-51: Onboarding & Agency Dashboard
**Goal**: Automated onboarding with checklist system and agency command center dashboard with pipeline kanban, Today's tasks, MRR metrics.
**Depends on**: Phase 48 (payment triggers onboarding)
**Requirements**: Complete prospect → client conversion flow
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. Onboarding checklist auto-created on payment
  2. Service tier determines checklist items (starter/growth/enterprise)
  3. Auto-complete items via OAuth and system events
  4. Progress tracking with visual indicators
  5. Pipeline kanban with drag-and-drop between stages
  6. Today's tasks feed (what I need to do now)
  7. MRR metrics card with trend
  8. One-time payment tracking per client (setup fees, project work)
  9. Retention signals and churn risk indicators
  9. Prospect → client conversion on checklist completion
**Estimated effort**: 32 hours
**Plans**: 6 plans
  - [ ] 49-01-PLAN.md — Onboarding Engine: auto-create checklist, item completion service (Wave 1)
  - [ ] 49-02-PLAN.md — Checklist UI: progress view, item actions, OAuth triggers (Wave 2)
  - [ ] 50-01-PLAN.md — Pipeline Kanban: drag-and-drop, stage filtering, quick actions (Wave 3)
  - [ ] 50-02-PLAN.md — Today's Tasks Feed: priority algorithm, action buttons, filtering (Wave 3)
  - [ ] 51-01-PLAN.md — MRR & Retention: metrics calculation, dashboard card, trend sparklines (Wave 4)
  - [ ] 51-02-PLAN.md — Prospect Conversion: checklist completion → client creation, v6 compliance audit (Wave 4)

---

### Phase 52: v6 UI Compliance
**Goal**: Update Phase 43 UI components to v6 design system compliance. 23 files from keyword pipeline need token/shadow/typography updates.
**Depends on**: Phase 44 (component library provides tokens)
**Requirements**: All UI consistent before reports
**Working directory**: `apps/web/`
**Success Criteria** (what must be TRUE):
  1. All 23 Phase 43 UI files updated to use v6 tokens
  2. Ghost-edge shadows replace 1px borders on cards
  3. 12px minimum text floor enforced
  4. Newsreader/Geist typography applied
  5. Single emerald accent color
  6. No animate-pulse (use skeleton shimmer)
  7. prefers-reduced-motion respected
**Estimated effort**: 12 hours
**Plans**: 3 plans (3 complete)
  - [x] 52-01-PLAN.md — Keyword Pipeline v6: KeywordTable, ScoreWeightEditor, tier badges (Wave 1)
  - [x] 52-02-PLAN.md — Scrape Config v6: RuleEditor, SelectorDiscoveryPanel, FieldEditor (Wave 2)
  - [x] 52-03-PLAN.md — Import/Export v6: ColumnMapper, CSV preview, QuickCheck UI (Wave 3)

---

### Phase 53: Reports & PDF Generation
**Goal**: Client-facing PDF reports with scheduling and white-label branding. SEO, performance, and custom report types.
**Depends on**: Phase 51 (dashboard metrics for reports)
**Requirements**: Professional deliverables for agency clients
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. Report builder with section selection
  2. PDF generation via Puppeteer
  3. White-label branding (agency logo, colors, footer)
  4. Report scheduling (weekly/monthly)
  5. Email delivery with PDF attachment
  6. Report history per client
  7. Template system for report types
  8. Preview before generation
**Estimated effort**: 24 hours
**Plans**: 4 plans
  - [x] 53-01-PLAN.md — Report Builder: section selection, preview, data aggregation (Wave 1)
  - [x] 53-02-PLAN.md — PDF Generation: Puppeteer rendering, chart snapshots, white-label (Wave 2)
  - [x] 53-03-PLAN.md — Scheduling & Delivery: cron jobs, email with attachment, history tracking (Wave 3)
  - [x] 53-04-PLAN.md — Templates & Polish: report templates, UI refinements, v6 compliance (Wave 4)

---

### Phase 54: Multi-Provider Payments (Revolut + Stripe)
**Goal**: Extend Phase 48's Stripe-only payment integration to support multiple providers. Agencies choose which provider(s) prospects/clients see at checkout. Full Revolut Merchant API integration.
**Depends on**: Phase 48 (contract & payment system exists)
**Design doc**: `.planning/phases/54-multi-provider-payments/DESIGN.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**Success Criteria** (what must be TRUE):
  1. `workspace_payment_settings` table stores per-workspace provider config with encrypted credentials
  2. Revolut orders created via Merchant API with checkout_url returned
  3. Revolut webhooks verified (HMAC-SHA256) and ORDER_COMPLETED triggers invoice paid
  4. Workspace settings UI allows enabling/disabling providers, setting default
  5. When `allowClientChoice=true`, clients see provider selection at checkout
  6. RevolutCheckout widget renders and processes payments (cards, Apple Pay, Google Pay, Revolut Pay)
  7. E2E test passes: invoice → Revolut payment → webhook → onboarding triggered
**Estimated effort**: 34-44 hours
**Plans**: 5 plans
  - [x] 54-01-PLAN.md — Schema + Provider Abstraction: workspace_payment_settings, PaymentProvider interface, factory (Wave 1)
  - [x] 54-02-PLAN.md — RevolutProvider Implementation: orders API, webhook verification, status mapping (Wave 2)
  - [x] 54-03-PLAN.md — Webhook Handlers + InvoiceService: /api/webhooks/revolut, multi-provider handlePaymentSuccess (Wave 2)
  - [x] 54-04-PLAN.md — Payment Settings UI + Client Choice: provider cards, credential input, PaymentMethodSelector (Wave 3)
  - [x] 54-05-PLAN.md — Checkout Widget + E2E: RevolutCheckoutWidget, payment request buttons, full flow tests (Wave 4)

---

### Phase 55: Full Platform Internationalization (i18n)
**Goal**: Complete internationalization with Lithuanian as primary target. Claude→Gemini translation wrapper for top-notch Lithuanian localization. Multi-tenant language settings (workspace/prospect level). Text fitting for 20-40% longer translations.
**Depends on**: Phase 54 (invoices need translation)
**Design doc**: `.planning/phases/55-platform-i18n/DESIGN.md`
**Working directory**: `apps/web/`, `open-seo-main/`, `AI-Writer/`
**Success Criteria** (what must be TRUE):
  1. All UI strings extracted and translated to Lithuanian (~500 strings)
  2. Gemini Translation Service with caching achieves >80% cache hit rate
  3. Workspace language settings control default language + formality (jūs/tu)
  4. Prospect-level language override for outbound communications
  5. Proposals generate in prospect's preferred language with proper formality
  6. Agreements use pre-approved Lithuanian legal templates
  7. Language switcher in header, instant switch, preference persisted
  8. No text overflow in Lithuanian UI (short variants + responsive CSS)
  9. ICU plural forms work correctly for Lithuanian (one/few/many/other)
**Estimated effort**: 70-88 hours
**Plans**: 8 plans
  - [x] 55-01-PLAN.md — i18n Framework Setup: next-intl, i18next, routing, middleware (Wave 1)
  - [x] 55-02-PLAN.md — Gemini Translation Service: API wrapper, caching, quality validation (Wave 1)
  - [x] 55-03-PLAN.md — UI String Extraction & Translation: extract ~500 strings, batch translate (Wave 2)
  - [x] 55-04-PLAN.md — Multi-Tenant Language Settings: workspace/prospect preferences, resolution (Wave 2)
  - [x] 55-05-PLAN.md — Dynamic Content Translation: proposals, emails, reports (Wave 3)
  - [x] 55-06-PLAN.md — Agreements & Legal: Lithuanian templates, variable substitution (Wave 3)
  - [x] 55-07-PLAN.md — Language Switcher & UX: header switcher, prospect override, preview (Wave 4)
  - [x] 55-08-PLAN.md — Text Fitting & Polish: CSS adjustments, short variants, QA (Wave 4)

---

## v7.0 Onboarding Excellence

**Focus:** World-class prospect-to-client onboarding experience with template systems, drag-and-drop variables, multi-signer agreements, split payments, OAuth integrations, agency command center, engagement automation, and flawless user journeys. Full EN/LT i18n throughout.
**Phases:** 56-62 (7 phases, ~360-435 hours total)

### Phase 56: Prospect Input Excellence
**Goal**: Make the core value proposition real — "paste anything, get brilliant insights" with conversation dump parsing, confirmation flows, and real-time progress.
**Depends on**: Phase 55 (i18n complete)
**Design doc**: `.planning/phases/56-prospect-input-excellence/DESIGN.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**i18n**: All UI, forms, and AI outputs support EN/LT
**Success Criteria** (what must be TRUE):
  1. Add Prospect button is enabled and functional
  2. Three input modes work: website URL, website + context, conversation dump
  3. AI extraction from conversation produces: business name, industry, services, keywords
  4. Confirmation screen shows before analysis with edit capability
  5. Real-time progress feedback shows during analysis (SSE)
  6. Platform detection identifies WordPress, Shopify, Wix, etc.
**Estimated effort**: 40-50 hours
**Plans**: 4 plans
  - [ ] 56-01-PLAN.md — Schema + Add Prospect Modal + Website Input (Wave 1)
  - [ ] 56-02-PLAN.md — Conversation Extractor + AI Integration (Wave 1)
  - [ ] 56-03-PLAN.md — Confirmation Flow UI + Edit Capabilities (Wave 2)
  - [ ] 56-04-PLAN.md — Progress Feedback (SSE) + Polish (Wave 2)

---

### Phase 57: Proposal Editor Revolution
**Goal**: Transform proposal editing into Google Docs meets website builder — template system, inline editing, drag-and-drop variables, AI generation, auto-save, version history.
**Depends on**: Phase 56 (prospect input complete)
**Design doc**: `.planning/phases/57-proposal-editor-revolution/DESIGN.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**i18n**: All UI, templates, and variable labels support EN/LT
**Success Criteria** (what must be TRUE):
  1. Template selector when creating proposal
  2. Click any text to edit inline (TipTap editor)
  3. Drag variables from palette into content (colored chips)
  4. Drag sections to reorder with smooth animation
  5. Add custom sections (text, image, testimonial, case study, video)
  6. Auto-save within 2 seconds of last change
  7. Clone proposal creates full copy with one click
  8. View and restore previous versions
  9. AI generates personalized content from audit/prospect data
  10. Magic link generation for manual sending
  11. Variable resolution shows live preview values
**Estimated effort**: 60-70 hours
**Plans**: 8 plans (8/8 complete)
  - [x] 57-01-PLAN.md — Schema + Template CRUD + i18n Setup (Wave 1)
  - [x] 57-02-PLAN.md — Variable System + Resolution Service (Wave 1)
  - [x] 57-03-PLAN.md — Inline Editing (TipTap) + Variable Chips (Wave 2)
  - [x] 57-04-PLAN.md — Drag-and-Drop Sections (@dnd-kit) (Wave 2)
  - [x] 57-05-PLAN.md — Custom Sections + Add Section Menu (Wave 3)
  - [x] 57-06-PLAN.md — Auto-Save + Version History (Wave 3)
  - [x] 57-07-PLAN.md — AI Content Generation (Wave 4)
  - [x] 57-08-PLAN.md — Clone + Undo/Redo + Magic Link (Wave 4)

---

### Phase 58: Service Catalog & Extra Services
**Goal**: Enable structured service packages with add-on services (GMB SEO, Google Reviews, Website, CRM/Booking) as proposal line items.
**Depends on**: Phase 57 (proposal editor complete)
**Design doc**: `.planning/phases/58-service-catalog/DESIGN.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**i18n**: Service names, descriptions, and terms in EN/LT
**Success Criteria** (what must be TRUE):
  1. Service catalog exists with default templates (SEO tiers + add-ons)
  2. Agencies can create/edit/delete service templates
  3. Proposal builder shows service selector with packages and add-ons
  4. Prices can be customized per proposal
  5. Selected services appear in generated agreements
  6. Service terms auto-included in agreement
**Estimated effort**: 35-45 hours
**Plans**: 4 plans
  - [ ] 58-01-PLAN.md — Schema + Service Templates CRUD (Wave 1)
  - [ ] 58-02-PLAN.md — Service Selector Component (Wave 1)
  - [ ] 58-03-PLAN.md — Proposal Integration + Pricing (Wave 2)
  - [ ] 58-04-PLAN.md — Agreement Integration + Terms (Wave 2)

---

### Phase 59: Agreement & Signing Excellence
**Goal**: Create a 3-click signing experience with template system, multi-signer support, pre-signing capability, and polished client contract page.
**Depends on**: Phase 58 (service catalog complete)
**Design doc**: `.planning/phases/59-agreement-excellence/DESIGN.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**i18n**: All agreements, UI, and emails in EN/LT
**Success Criteria** (what must be TRUE):
  1. Template selector when creating agreement
  2. Drag-and-drop variables in template editor
  3. Configure 1-3 signers with roles (provider + client(s))
  4. Sequential signing (provider first) works
  5. Pre-signing flow: agency signs before sending to client
  6. Client contract page `/c/:token` renders beautifully
  7. Language toggle switches EN/LT seamlessly
  8. Multi-signer status tracking works
  9. Dokobit signing completes (Smart-ID, Mobile-ID)
  10. Success page shows with PDF download
  11. PDF has professional formatting with agency branding
**Estimated effort**: 55-65 hours
**Plans**: 8 plans
  - [ ] 59-01-PLAN.md — Schema + Template System + i18n (Wave 1)
  - [ ] 59-02-PLAN.md — Multi-Signer Architecture + Dokobit (Wave 1)
  - [ ] 59-03-PLAN.md — Variable Resolution Service (Wave 2)
  - [ ] 59-04-PLAN.md — Client Contract Page `/c/:token` (Wave 2)
  - [ ] 59-05-PLAN.md — Template Editor + Variable Drag-Drop (Wave 3)
  - [ ] 59-06-PLAN.md — Pre-Signing Flow (Wave 3)
  - [ ] 59-07-PLAN.md — PDF Generation + Branding (Wave 4)
  - [ ] 59-08-PLAN.md — Success Page + Status Tracking (Wave 4)

---

### Phase 60: Payment Flexibility & Split Payments
**Goal**: Enable split payments (2-3 installments) with clear UX for both agency configuration and client selection.
**Depends on**: Phase 59 (agreement flow complete)
**Design doc**: `.planning/phases/60-payment-flexibility/DESIGN.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**i18n**: Payment UI, emails, and reminders in EN/LT
**Success Criteria** (what must be TRUE):
  1. Split payment toggle in workspace settings
  2. Client can choose payment plan (full, 2 payments, 3 payments)
  3. First installment processed via Stripe/Revolut
  4. Payment schedule created with future installments
  5. Agency dashboard shows all installments with tracking
  6. Client can view their payment schedule
  7. Automated reminders sent before due dates
  8. Discount codes can be applied at checkout
**Estimated effort**: 45-55 hours
**Plans**: 5 plans
  - [ ] 60-01-PLAN.md — Schema + Payment Schedule Service (Wave 1)
  - [ ] 60-02-PLAN.md — Plan Selector UI + Checkout Flow (Wave 1)
  - [ ] 60-03-PLAN.md — Agency Dashboard + Tracking (Wave 2)
  - [ ] 60-04-PLAN.md — Discount Codes (Wave 2)
  - [ ] 60-05-PLAN.md — Reminders + Polish (Wave 3)

---

### Phase 61: Platform Integration Excellence
**Goal**: Implement OAuth for top 15 platforms with intelligent fallback, eliminating friction when prospects connect their websites.
**Depends on**: Phase 56 (prospect input complete)
**Design doc**: `.planning/phases/61-platform-integration/DESIGN.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**i18n**: Connection UI and error messages in EN/LT
**Platform Tiers**:
  - **Tier 1 (Must Have)**: Google Search Console, Google Analytics, Google Business Profile, WordPress.com, Shopify
  - **Tier 2 (Should Have)**: Wix, Squarespace, Webflow, HubSpot CMS
  - **Tier 3 (Nice to Have)**: BigCommerce, Magento, Drupal, Ghost, Bing Webmaster
  - **Tier 4 (Always)**: Universal fallback crawler with Puppeteer/Playwright for JS-heavy sites
**Success Criteria** (what must be TRUE):
  1. Google OAuth (GSC + GA + GBP) works end-to-end
  2. Shopify OAuth installs app and fetches data
  3. WordPress Application Passwords validated and stored
  4. Wix OAuth works for basic site data
  5. Token refresh runs automatically before expiry
  6. Fallback crawler handles JS-rendered sites (Puppeteer)
  7. Connection status visible in dashboard
  8. Manual sync triggers work
  9. Disconnect properly revokes tokens
  10. Encrypted token storage (AES-256-GCM)
**Estimated effort**: 55-65 hours
**Plans**: 6 plans
  - [x] 61-01-PLAN.md — Schema + Token Encryption + OAuth Base (Wave 1)
  - [x] 61-02-PLAN.md — Google OAuth (GSC, GA, GBP) (Wave 1)
  - [x] 61-03-PLAN.md — Shopify + Wix OAuth (Wave 2)
  - [x] 61-04-PLAN.md — WordPress App Passwords + Other Platforms (Wave 2)
  - [x] 61-05-PLAN.md — Fallback Crawler + Playwright (Wave 3)
  - [x] 61-06-PLAN.md — Token Refresh Worker + Dashboard UI (Wave 3)

---

### Phase 62: Agency Command Center & Pipeline Intelligence
**Goal**: Build the unified operations hub for agencies — real-time pipeline visibility, engagement workflow engine with anti-annoyance safeguards, smart alerts for at-risk deals, and win/loss analytics.
**Depends on**: Phase 56 (i18n complete), Phase 57 (proposals), Phase 59 (agreements)
**Design doc**: `.planning/phases/62-agency-command-center/DESIGN.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**i18n**: All dashboard UI, alerts, and workflow messages in EN/LT
**Core Features**:
  - **Pipeline Dashboard**: Today Bar, Pipeline Cards, Revenue Pipeline, Funnel Visualization
  - **Engagement Workflows**: Automated follow-up sequences with snooze ("follow up May 27th") support
  - **Anti-Annoyance**: Max 3 touches/week, 48h cooldown, skip on response
  - **Smart Alerts**: High-value stuck deals, win rate decline, contracts expiring
  - **Quick Actions**: Send reminder, mark lost, snooze, add note from anywhere
  - **Win/Loss Analytics**: Lost deal reasons, cycle time tracking, conversion funnels
**Success Criteria** (what must be TRUE):
  1. Dashboard loads all pipeline metrics in < 1.5s
  2. Today Action Bar shows overdue, due today, awaiting you, new counts
  3. Pipeline cards show real-time prospect/proposal/contract/invoice counts
  4. Engagement workflow starts automatically on proposal_sent trigger
  5. Snooze functionality works ("follow up on May 27th")
  6. Anti-annoyance safeguards prevent over-touching
  7. Smart alerts detect high-value stuck deals (> 7 days, > 5000 EUR)
  8. Activity feed updates in real-time via Socket.IO
  9. Quick actions execute from needs attention list
  10. Lost deal tracking captures reason and competitor
  11. All UI supports EN/LT language toggle
**Estimated effort**: 70-85 hours
**Plans**: 8 plans
  - [x] 62-01-PLAN.md — Database Schema + Migrations (Wave 1)
  - [x] 62-02-PLAN.md — Follow-up System + Rules Engine (Wave 1)
  - [x] 62-03-PLAN.md — Engagement Workflow Engine + BullMQ Workers (Wave 1)
  - [x] 62-04-PLAN.md — Pipeline Metrics Worker + Materialized Views (Wave 2)
  - [x] 62-05-PLAN.md — Command Center Dashboard Core (Wave 2)
  - [x] 62-06-PLAN.md — Needs Attention List + Quick Actions (Wave 2)
  - [x] 62-07-PLAN.md — Smart Alerts + Activity Feed (Socket.IO) (Wave 3)
  - [x] 62-08-PLAN.md — Win/Loss Analytics + i18n + E2E Tests (Wave 3)

---

## v7.1 Platform Intelligence

**Focus:** Advanced keyword intelligence, crawling infrastructure optimization, and GraphRAG foundation for intelligent retrieval. Enables 100-200 ON-POINT keywords per prospect with 98% cost reduction through singleflight and delta crawling.
**Phases:** 63-66 (4 phases, ~190 hours total)

### Phase 63: Keyword Intelligence
**Goal**: Generate 100-200 ON-POINT keywords per prospect using Grok 4.1 classification cascade, autocomplete APIs, and adaptive intent detection.
**Depends on**: Phase 62 (v7.0 complete)
**Context doc**: `.planning/phases/63-keyword-intelligence/63-CONTEXT.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**Key Features**:
  - **Grok 4.1 Classification**: $0.20/1M input, Pass 1 filters 80% of keywords
  - **Claude Sonnet Pass 2**: Handles remaining 20% uncertain keywords
  - **Negative Association Extraction**: Filter adjacent verticals automatically
  - **Human Confirmation Toggle**: Confirm/autonomous mode near input
  - **Adaptive Intent Detection**: Route by detected intent, not fixed pipeline
**Success Criteria** (what must be TRUE):
  1. 100-200 classified keywords per prospect (not 1000s)
  2. Pass 1 (Grok 4.1) filters 80% of keywords
  3. Adjacent verticals excluded via negative associations
  4. Confirmation toggle works in both modes
  5. Intent detection routes correctly for quick_check vs full_analysis
**Estimated effort**: 38 hours
**Plans**: 3 plans
  - [ ] 63-01-PLAN.md — Business Context + Classification Foundation (Wave 1)
  - [ ] 63-02-PLAN.md — Keyword Universe Builder + Integration (Wave 1)
  - [ ] 63-03-PLAN.md — Human Confirmation Toggle + Adaptive Intent (Wave 2)

---

### Phase 64: Crawling Infrastructure
**Goal**: Implement world-class crawling infrastructure with singleflight deduplication, delta crawling, and queue lane separation.
**Depends on**: Phase 63 (keyword intelligence complete)
**Context doc**: `.planning/phases/64-crawling-infrastructure/64-CONTEXT.md`
**Working directory**: `open-seo-main/`
**Key Features**:
  - **Crawl Singleflight**: Redis `SET NX EX` prevents 98% duplicate crawl cost
  - **Delta Crawling**: L0→L1→L2→L3 cascade skips unchanged content
  - **Queue Lanes**: Fast API (<1m SLA) vs Heavy Crawl (<15m SLA)
  - **Metrics Dashboard**: Real-time cost savings visualization
**Success Criteria** (what must be TRUE):
  1. Duplicate crawl requests coalesced (98% cost reduction)
  2. Delta crawling achieves 80%+ cache hit rate
  3. Fast lane completes in <1m, heavy lane in <15m
  4. Metrics dashboard shows real savings
**Estimated effort**: 34 hours
**Plans**: 4 plans
  - [x] 64-01-PLAN.md — Crawl Singleflight (Wave 1)
  - [x] 64-02-PLAN.md — Delta Crawling Cascade (Wave 1)
  - [x] 64-03-PLAN.md — Fast/Heavy Queue Lanes (Wave 2)
  - [x] 64-04-PLAN.md — Integration & E2E Testing (Wave 2)

---

### Phase 65: GraphRAG Foundation
**Goal**: Implement LightRAG + FalkorDB for per-tenant knowledge graphs enabling intelligent retrieval.
**Depends on**: Phase 64 (crawling infrastructure complete)
**Context doc**: `.planning/phases/65-graphrag-foundation/65-CONTEXT.md`
**Working directory**: `open-seo-main/`
**Key Features**:
  - **FalkorDB**: Per-tenant graph storage with Cypher queries
  - **LightRAG**: Lightweight RAG orchestration
  - **jina-embeddings-v3**: Lithuanian-optimized embeddings
  - **pgvector + pgvectorscale**: Vector storage with DiskANN indexes
  - **Hybrid Retrieval**: Vector similarity + graph traversal
**Success Criteria** (what must be TRUE):
  1. Per-tenant knowledge graphs created on workspace init
  2. Embeddings generated via jina-embeddings-v3
  3. GraphRAG retrieval returns relevant context
  4. Works on $50/mo VPS (CPU-only, no GPU)
  5. Retrieval latency <500ms p95
**Estimated effort**: 40 hours
**Plans**: 4 plans
  - [x] 65-01-PLAN.md — FalkorDB Schema + Per-Tenant Graphs (Wave 1)
  - [x] 65-02-PLAN.md — LightRAG Integration (Wave 1)
  - [ ] 65-03-PLAN.md — Retrieval Pipeline (Wave 2)
  - [ ] 65-04-PLAN.md — Integration & Testing (Wave 2)

---

### Phase 66: Platform Unification Excellence
**Goal**: Enable ANY website to connect to TeveroSEO in under 2 minutes via script-first onboarding. Provide the simplest possible integration with progressive OAuth enhancement for power users.
**Depends on**: Phase 65 (v7.1 complete), Phase 61 (OAuth services), Phase 31/33 (Write adapters), Phase 39 (CMS publishers)
**Context doc**: `.planning/phases/66-platform-unification/66-CONTEXT.md`
**Working directory**: `apps/web/`, `open-seo-main/`
**Key Features**:
  - **TeveroPixel Script**: <5KB async script, copy-paste one line, works on ANY website
  - **Real-time Verification**: Detect installation within 10 seconds
  - **Platform Detection**: Auto-detect CMS with 95%+ accuracy
  - **CMS-Specific Guides**: Step-by-step with screenshots for 15+ platforms
  - **Developer Handoff**: Magic link flow for non-technical users
  - **DOM Change Approval**: Inject meta/schema/links with user approval
  - **PlatformIntegrationFacade**: Unified API bridging P61 OAuth, P31/33 adapters, P39 publishers
**Success Criteria** (what must be TRUE):
  1. DIY connection < 2 minutes, developer handoff < 24 hours
  2. Pixel script < 5KB gzipped, load time < 100ms
  3. Verification detection < 10 seconds
  4. Platform detection accuracy > 95%
  5. DIY success rate > 70%, onboarding completion > 80%
**Estimated effort**: 78 hours
**Plans**: 11 plans
  - [ ] 66-01-PLAN.md — Database schema + pixel script generation (Wave 1)
  - [ ] 66-02-PLAN.md — Pixel collector endpoint + real-time verification (Wave 1)
  - [ ] 66-03-PLAN.md — Platform detection + CMS-specific guides (Wave 1)
  - [ ] 66-04-PLAN.md — Connection wizard UI (Wave 2)
  - [ ] 66-05-PLAN.md — Developer handoff flow + magic links (Wave 2)
  - [ ] 66-06-PLAN.md — Verification UI + success/error states (Wave 2)
  - [ ] 66-07-PLAN.md — DOM change approval system (Wave 3)
  - [ ] 66-08-PLAN.md — Pixel analytics dashboard (Wave 3)
  - [ ] 66-09-PLAN.md — PlatformIntegrationFacade + OAuth enhancement (Wave 3)
  - [ ] 66-10-PLAN.md — i18n (EN + LT translations) (Wave 4)
  - [ ] 66-11-PLAN.md — E2E tests + documentation (Wave 4)

---

## v8.0 SaaS Hardening

> Addresses 255 issues from 20-agent comprehensive code review. Database consolidation, integration fixes, security hardening, and SaaS production readiness.

### Phase 67: Database Consolidation
**Goal**: Consolidate `open_seo` and `alwrity` databases into unified `tevero` database with namespace prefixes and ORM coexistence.
**Depends on**: Phase 66 (v7.0 complete)
**Context doc**: `.planning/phases/67-database-consolidation/67-CONTEXT.md`
**Working directory**: `open-seo-main/`, `AI-Writer/`
**Key Features**:
  - **Unified Schema**: Single `tevero` database with namespace prefixes (shared_, seo_, content_, biz_, analytics_)
  - **ORM Coexistence**: Drizzle owns shared/seo/biz/analytics tables, SQLAlchemy owns content tables
  - **Zero-Downtime Migration**: Shadow write pattern for safe cutover
  - **Table Collision Fix**: Resolves gsc_snapshots and ga4_snapshots conflicts
**Success Criteria** (what must be TRUE):
  1. Single tevero database with all tables
  2. Both ORMs connect and operate correctly
  3. workspace_id NOT NULL on shared_clients
  4. TIMESTAMPTZ used consistently
  5. Zero data loss during migration
**Estimated effort**: 182 hours (3 weeks)
**Plans**: 3 plans
  - [ ] 67-01-PLAN.md — Schema Design (Wave 1)
  - [ ] 67-02-PLAN.md — Migration Scripts (Wave 1)
  - [ ] 67-03-PLAN.md — Cutover (Wave 2)

---

### Phase 68: Integration Hardening
**Goal**: Fix cross-service authentication, client context security, API contract alignment, and state management issues.
**Depends on**: Phase 67 (database consolidated)
**Context doc**: `.planning/phases/68-integration-hardening/68-CONTEXT.md`
**Working directory**: `open-seo-main/`, `apps/web/`
**Key Features**:
  - **JWT Verification**: Standardize Clerk JWT verification across services
  - **Client Context Security**: Fix empty X-Client-ID bypass vulnerability
  - **API Contract Alignment**: Zod schemas for all cross-service contracts
  - **State Management**: Fix race conditions in client switching
**Success Criteria** (what must be TRUE):
  1. All API routes validate JWT from Authorization header
  2. Empty X-Client-ID returns 400 error
  3. API contracts have Zod validation
  4. No race conditions during client switching
**Estimated effort**: 64 hours (2 weeks)
**Plans**: 4 plans
  - [ ] 68-01-PLAN.md — Auth Flow Fixes (Wave 1)
  - [ ] 68-02-PLAN.md — Client Context Security (Wave 1)
  - [ ] 68-03-PLAN.md — API Contract Alignment (Wave 2)
  - [ ] 68-04-PLAN.md — State Management Migration (Wave 2)

---

### Phase 69: Data Integrity & Performance
**Goal**: Implement transaction safety, constraint enforcement, query optimization, and background job reliability.
**Depends on**: Phase 68 (integration hardened)
**Context doc**: `.planning/phases/69-data-integrity-performance/69-CONTEXT.md`
**Working directory**: `open-seo-main/`
**Key Features**:
  - **Transaction Wrappers**: withTransaction() for all multi-table operations
  - **Cascade Rules**: Proper ON DELETE CASCADE/SET NULL
  - **Query Optimization**: Fix N+1 queries, add missing indexes
  - **Job Reliability**: Deduplication, DLQ, circuit breakers for BullMQ
**Success Criteria** (what must be TRUE):
  1. All multi-table operations use transactions
  2. APIKey deletions cascade correctly
  3. No N+1 queries in hot paths
  4. Failed jobs retry with exponential backoff
**Estimated effort**: 80 hours (2.5 weeks)
**Plans**: 4 plans
  - [ ] 69-01-PLAN.md — Transaction Wrappers (Wave 1)
  - [ ] 69-02-PLAN.md — Cascade & Constraints (Wave 1)
  - [ ] 69-03-PLAN.md — Query Optimization (Wave 2)
  - [ ] 69-04-PLAN.md — Background Job Reliability (Wave 2)

---

### Phase 70: Frontend Quality
**Goal**: Fix React component issues, Next.js patterns, user journey problems, and error handling.
**Depends on**: None (can run parallel with Phase 69)
**Context doc**: `.planning/phases/70-frontend-quality/70-CONTEXT.md`
**Working directory**: `apps/web/`
**Key Features**:
  - **Memory Leak Fixes**: Clean up setTimeout/intervals on unmount
  - **Infinite Re-render Fixes**: Fix GlobalSettings and similar components
  - **Error Boundaries**: Add error.tsx to 18 routes
  - **Loading States**: Add loading.tsx to 59 routes
  - **Accessibility**: ARIA attributes on all forms
**Success Criteria** (what must be TRUE):
  1. No memory leaks in React components
  2. No infinite re-renders
  3. All routes have error.tsx boundaries
  4. Forms have proper ARIA attributes
**Estimated effort**: 64 hours (2 weeks)
**Plans**: 3 plans
  - [ ] 70-01-PLAN.md — React Component Fixes (Wave 1)
  - [ ] 70-02-PLAN.md — Next.js Patterns (Wave 1)
  - [ ] 70-03-PLAN.md — User Journey Fixes (Wave 2)

---

### Phase 71: Security & Configuration
**Goal**: Consolidate configuration, harden security, and improve migration safety.
**Depends on**: Phase 67 (database consolidated)
**Context doc**: `.planning/phases/71-security-configuration/71-CONTEXT.md`
**Working directory**: All services
**Key Features**:
  - **Env Var Standardization**: Consistent naming convention
  - **Startup Validation**: Zod validation for all required env vars
  - **Security Headers**: CORS, CSP, rate limiting
  - **Migration Safety**: Rollback scripts for all migrations
**Success Criteria** (what must be TRUE):
  1. All env vars follow SERVICE_URL/SERVICE_API_KEY convention
  2. Missing required env vars fail at startup
  3. INTERNAL_API_KEY minimum 32 characters
  4. All migrations have rollback scripts
**Estimated effort**: 64 hours (2 weeks)
**Plans**: 3 plans
  - [ ] 71-01-PLAN.md — Configuration Consolidation (Wave 1)
  - [ ] 71-02-PLAN.md — Security Hardening (Wave 1)
  - [ ] 71-03-PLAN.md — Migration Safety (Wave 2)

---

### Phase 72: SaaS Readiness
**Goal**: Verify multi-tenancy, validate SEO checks, and set up production monitoring.
**Depends on**: Phases 67-71 (all hardening complete)
**Context doc**: `.planning/phases/72-saas-readiness/72-CONTEXT.md`
**Working directory**: All services
**Key Features**:
  - **Tenant Isolation**: E2E tests verifying workspace_id filtering
  - **SEO Checks Validation**: Consistent scoring across all 109 checks
  - **Monitoring**: Health checks, metrics, alerting
  - **Documentation**: API docs, deployment runbook
**Success Criteria** (what must be TRUE):
  1. All queries filter by workspace_id
  2. Cross-tenant access returns 403
  3. SEO check scores are consistent
  4. Health endpoints return service status
  5. Deployment runbook is complete
**Estimated effort**: 48 hours (1.5 weeks)
**Plans**: 3 plans
  - [ ] 72-01-PLAN.md — Multi-Tenancy Verification (Wave 1)
  - [ ] 72-02-PLAN.md — SEO Checks Validation (Wave 1)
  - [ ] 72-03-PLAN.md — Monitoring & Observability (Wave 2)

---
