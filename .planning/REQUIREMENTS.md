# Requirements: TeveroSEO Unified Platform

**Defined:** 2026-04-17
**Core Value:** One login, one client switcher, two powerful tools (content generation + SEO audits) running on a single self-hosted VPS with zero manual deploy steps.

---

## v1 Requirements — Platform Unification

### AI-Writer Backend Cleanup

- [ ] **CLEAN-01**: `backend/services/blog_writer/` directory deleted — no imports reference it
- [ ] **CLEAN-02**: `backend/services/podcast/` directory deleted — no imports reference it
- [ ] **CLEAN-03**: `backend/services/youtube/` directory deleted — no imports reference it
- [ ] **CLEAN-04**: `backend/services/story_writer/` directory deleted — no imports reference it
- [ ] **CLEAN-05**: `backend/services/linkedin/` directory deleted — no imports reference it
- [ ] **CLEAN-06**: All legacy API routes for removed services deleted; `grep -r "blog_writer\|podcast\|youtube\|story_writer\|linkedin" AI-Writer/backend/api/` returns zero matches
- [ ] **CLEAN-07**: `python -m pytest AI-Writer/backend/` passes with no import errors after cleanup

### CF Bindings Removal (open-seo-main)

- [ ] **CF-01**: All `cloudflare:workers` imports removed — `grep -r "cloudflare:workers" open-seo-main/src/` returns zero matches
- [ ] **CF-02**: `@cloudflare/vite-plugin` removed; `@tanstack/nitro-v2-vite-plugin` with `preset: "node-server"` in place
- [ ] **CF-03**: `src/server.ts` exports Node.js-compatible server entry (no CF Worker module format)
- [ ] **CF-04**: All `env.*` CF binding accesses removed; replaced with Node.js equivalents
- [ ] **CF-05**: `runtime-env.ts` validates all `process.env` vars at startup with clear error on missing
- [ ] **CF-06**: `@cloudflare/workers-types` removed from `tsconfig.json`; zero TypeScript errors

### Database Migration (open-seo-main)

- [ ] **DB-01**: Drizzle schema migrated from `sqlite-core` to `pg-core` (all tables, columns, indexes)
- [ ] **DB-02**: All timestamp columns → `timestamp({ withTimezone: true, mode: "date" })`
- [ ] **DB-03**: All boolean columns → native `boolean()`
- [ ] **DB-04**: All text JSON columns → `jsonb()`
- [ ] **DB-05**: better-auth Drizzle adapter → `provider: "pg"`
- [ ] **DB-06**: Fresh PG migrations regenerated with `drizzle-kit generate`
- [ ] **DB-07**: `drizzle-kit migrate` applies to fresh PostgreSQL instance without errors
- [ ] **DB-08**: `src/db/index.ts` uses `drizzle/node-postgres` with `pg.Pool` via `DATABASE_URL`

### Redis KV Replacement (open-seo-main)

- [ ] **KV-01**: `progress-kv.ts` uses ioredis; get/put/delete preserved with TTL via `EX`, prefix `audit-progress:`
- [ ] **KV-02**: Singleton ioredis client created on startup, shared across KV operations
- [ ] **KV-03**: Redis connection failure causes process exit with clear error

### BullMQ Audit Queue (open-seo-main)

- [ ] **BQ-01**: `SiteAuditWorkflow.ts` replaced with BullMQ worker (`src/server/workers/audit-worker.ts`)
- [ ] **BQ-02**: `AuditService.ts` uses `auditQueue.add(...)` with `jobId: auditId` for deduplication
- [ ] **BQ-03**: Separate ioredis connections for Queue and Worker
- [ ] **BQ-04**: Lighthouse runs in sandboxed processor (separate file path to Worker constructor)
- [ ] **BQ-05**: Worker `lockDuration` ≥ 120,000ms
- [ ] **BQ-06**: `maxStalledCount: 2`, graceful shutdown with 25s timeout
- [ ] **BQ-07**: Failed jobs route to dead-letter queue (`failed-audits`)

### Node.js Build (open-seo-main)

- [ ] **BUILD-01**: `pnpm run build` succeeds with no TypeScript or Rollup errors
- [ ] **BUILD-02**: `.output/server/index.mjs` starts a working HTTP server
- [ ] **BUILD-03**: All routes return correct responses in Node.js mode

### Unified Docker Infrastructure

- [ ] **DOCKER-01**: `open-seo-main/Dockerfile.vps` multi-stage build; SIGTERM handled via exec-form CMD
- [ ] **DOCKER-02**: Root `docker-compose.vps.yml` with 7 services: `open-seo`, `open-seo-worker`, `ai-writer-frontend`, `ai-writer-backend`, `postgres`, `redis`, `nginx`
- [ ] **DOCKER-03**: Shared `postgres` runs both `open_seo` and `alwrity` databases; init script creates both on fresh volume
- [ ] **DOCKER-04**: Redis configured with `maxmemory 512mb`, `maxmemory-policy noeviction`, `save 60 1000`
- [ ] **DOCKER-05**: nginx routes `app.openseo.so` → open-seo, AI-Writer domain → ai-writer-frontend; SSL on both
- [ ] **DOCKER-06**: All services have `healthcheck`; open-seo and open-seo-worker depend on postgres/redis healthy
- [ ] **DOCKER-07**: `GET /healthz` returns `{ status: "ok" }` from open-seo

### CI/CD Pipeline

- [ ] **CI-01**: `.github/workflows/deploy-vps.yml` triggers on push to main; SSHs to VPS; zero-downtime deploy
- [ ] **CI-02**: DB migrations run as separate `docker compose run --rm` step before new container goes live
- [ ] **CI-03**: `KNOWN_HOSTS` secret used (not `StrictHostKeyChecking=no`)
- [ ] **CI-04**: Dedicated `deploy` Linux user with `docker` group; ed25519 key pair
- [ ] **CI-05**: `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, `KNOWN_HOSTS` as GitHub Actions secrets
- [ ] **CI-06**: Separate parallel workflow for AI-Writer auto-deploy on push

### Clerk + Per-Client Integration (open-seo-main)

- [ ] **AUTH-01**: Clerk middleware added to open-seo-main Node.js server; unauthenticated requests → redirect
- [ ] **AUTH-02**: `userId` and `orgId` available in all open-seo API routes via Clerk session
- [ ] **AUTH-03**: `client_id` passed as query param or header from AI-Writer shell when loading SEO pages; validated against AI-Writer `clients` table
- [ ] **AUTH-04**: All open-seo audit/keyword data queries scoped by `client_id`

### AppShell SEO Integration

- [ ] **SHELL-01**: "SEO Audit" section added to AI-Writer sidebar nav (icon + label)
- [ ] **SHELL-02**: `/seo/*` routes in AI-Writer React app proxy to open-seo-main via nginx
- [ ] **SHELL-03**: open-seo pages render inside AI-Writer AppShell (same chrome, same client context)
- [ ] **SHELL-04**: Active client `client_id` passed to open-seo pages on navigation
- [ ] **SHELL-05**: open-seo pages use same shadcn/ui + Tailwind design tokens (status chips, page headers, typography)

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 to CLEAN-07 | Phase 1 | Pending |
| CF-01 to CF-06, DB-01 to DB-08, BUILD-01 to BUILD-03 | Phase 2 | Pending |
| KV-01 to KV-03, BQ-01 to BQ-07 | Phase 3 | Pending |
| DOCKER-01 to DOCKER-07 | Phase 4 | Pending |
| CI-01 to CI-06 | Phase 5 | Pending |
| AUTH-01 to AUTH-04 | Phase 6 | Pending |
| SHELL-01 to SHELL-05 | Phase 7 | Pending |
| CMD-01 to CMD-18 | Phase 21 | Pending |

---

## v3 Requirements — Agency Intelligence

### Agency Command Center (Phase 21)

- [ ] **CMD-01**: `client_dashboard_metrics` table pre-computes health scores, traffic trends, keyword distribution per client
- [ ] **CMD-02**: Health score algorithm uses weighted scoring (traffic 30%, rankings 25%, technical 20%, backlinks 15%, content 10%)
- [ ] **CMD-03**: Portfolio Health Summary section shows total clients, clients needing attention, wins this week, portfolio-wide totals
- [ ] **CMD-04**: Needs Attention section shows color-coded severity alerts (red=critical, orange=warning, yellow=info)
- [ ] **CMD-05**: Wins & Milestones section celebrates successes (#1 positions, Top 10 entries, traffic milestones, high-DA backlinks)
- [ ] **CMD-06**: Quick actions available inline: View, Snooze, Reconnect, Dismiss
- [ ] **CMD-07**: Client Portfolio Table supports sorting by any column + filtering by health/traffic/connection/tags
- [ ] **CMD-08**: Hovering any metric cell shows contextual popup with sparkline/breakdown (no extra click)
- [ ] **CMD-09**: Sparklines use Recharts, render on hover (lazy), show 30-day trend
- [ ] **CMD-10**: Activity Feed displays real-time workspace events
- [ ] **CMD-11**: Activity Feed uses WebSocket (Socket.IO) with workspace-level rooms for multi-tenant isolation
- [ ] **CMD-12**: BullMQ repeatable job computes `client_dashboard_metrics` every 5 minutes
- [ ] **CMD-13**: Quick Stats Cards show configurable metrics with 20+ options
- [ ] **CMD-14**: Quick Stats Cards are drag-and-drop rearrangeable using @dnd-kit
- [ ] **CMD-15**: Saved Views store filter configurations per user ("My Clients", "Needs Attention", custom filters)
- [ ] **CMD-16**: Export client list to CSV with selected columns
- [ ] **CMD-17**: Team Workload section shows clients per team member with capacity bar (for agencies with staff)
- [ ] **CMD-18**: Dashboard is mobile-responsive: collapses to health summary + needs attention + swipeable client cards
