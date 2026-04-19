# Roadmap: TeveroSEO Unified Platform

## Milestones

- ✅ **v1.0 Platform Unification** — Phases 1–7 (complete)
- ✅ **v2.0 Unified Product** — Phases 8–14 (complete 2026-04-19)
- 🚧 **v3.0 Agency Intelligence** — Phases 15–21 + 18.5 (in progress)

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
**Plans**: 5 plans
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
**Plans**: 5 plans
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
**Plans**: 4 plans (2 complete)
  - [x] 15-01-PLAN.md — Report template system and React components (Wave 1)
  - [x] 15-02-PLAN.md — Report data layer, BullMQ queue, API routes (Wave 1)
  - [ ] 15-03-PLAN.md — BullMQ worker and Puppeteer PDF generation (Wave 2)
  - [ ] 15-04-PLAN.md — Report UI pages at /clients/[clientId]/reports (Wave 3, checkpoint)

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
**Plans**: 4 plans (2 complete)
  - [x] 16-01-PLAN.md — Report scheduler BullMQ queue + worker (Wave 1)
  - [x] 16-02-PLAN.md — Email delivery integration with existing email service (Wave 1)
  - [ ] 16-03-PLAN.md — Client branding schema + API + storage (Wave 2)
  - [ ] 16-04-PLAN.md — Branding settings UI + report template branding injection (Wave 3)

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
**Plans**: 5 plans
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
**Plans**: 5 plans
Plans:
- [ ] 21-01-PLAN.md — Dashboard metrics schema + BullMQ worker for 5-min pre-computation (Wave 1)
- [ ] 21-02-PLAN.md — Portfolio health summary + needs attention + wins/milestones sections (Wave 2)
- [ ] 21-03-PLAN.md — Client portfolio table with hover popovers + sorting + filtering (Wave 2)
- [ ] 21-04-PLAN.md — Real-time activity feed (Socket.IO) + drag-and-drop quick stats cards (Wave 3)
- [ ] 21-05-PLAN.md — Saved views + CSV export + team workload + mobile responsive layout (Wave 4)
