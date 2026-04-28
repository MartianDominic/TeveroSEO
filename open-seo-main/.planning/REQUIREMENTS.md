# Requirements: Unified Platform Infrastructure

**Defined:** 2026-04-17
**Core Value:** Both platforms run reliably on a single VPS, deploy automatically on push, sharing a PostgreSQL instance — zero manual intervention required.

---

## v1 Requirements

### CF Bindings Removal

- [ ] **CF-01**: All `cloudflare:workers` imports removed from every file in `src/` (grep returns zero matches)
- [ ] **CF-02**: `@cloudflare/vite-plugin` removed from `vite.config.ts`; `@tanstack/nitro-v2-vite-plugin` with `preset: "node-server"` added in its place
- [ ] **CF-03**: `src/server.ts` rewritten to export a Node.js-compatible server entry (no `SiteAuditWorkflow` export, no CF Worker module format)
- [ ] **CF-04**: All `env.*` CF binding accesses (`env.DB`, `env.KV`, `env.SITE_AUDIT_WORKFLOW`, `env.R2`) removed from server code; replaced with Node.js equivalents
- [ ] **CF-05**: `runtime-env.ts` centralises all `process.env` access with startup validation (fails fast on missing required vars)
- [ ] **CF-06**: `@cloudflare/workers-types` removed from `tsconfig.json`; no TypeScript errors remain

### Database Migration

- [ ] **DB-01**: Drizzle schema fully migrated from `drizzle-orm/sqlite-core` to `drizzle-orm/pg-core` (all tables, columns, indexes)
- [ ] **DB-02**: All `integer({ mode: "timestamp_ms" })` columns converted to `timestamp({ withTimezone: true, mode: "date" })`
- [ ] **DB-03**: All `integer({ mode: "boolean" })` columns converted to native `boolean()`
- [ ] **DB-04**: All `text()` JSON columns converted to `jsonb()`
- [ ] **DB-05**: `better-auth` Drizzle adapter changed from `provider: "sqlite"` to `provider: "pg"`
- [ ] **DB-06**: Old `drizzle/` migration folder deleted and fresh PG migrations regenerated with `drizzle-kit generate`
- [ ] **DB-07**: `drizzle-kit migrate` successfully applies all PG migrations to a fresh PostgreSQL instance
- [ ] **DB-08**: `src/db/index.ts` uses `drizzle/node-postgres` with a `pg.Pool` connected via `DATABASE_URL`

### Redis KV Replacement

- [ ] **KV-01**: `progress-kv.ts` uses ioredis instead of `env.KV`; `get/put/delete` operations preserved with identical semantics (TTL via `EX`, prefix via `audit-progress:`)
- [ ] **KV-02**: A singleton ioredis client is created on startup and shared across KV operations
- [ ] **KV-03**: Redis connection failure at startup causes process exit with a clear error message

### BullMQ Audit Queue

- [ ] **BQ-01**: `SiteAuditWorkflow.ts` replaced with a BullMQ worker (`src/server/workers/audit-worker.ts`) implementing step-enum pattern for durable multi-step execution
- [ ] **BQ-02**: `AuditService.ts` replaces `env.SITE_AUDIT_WORKFLOW.create(...)` with `auditQueue.add(...)` using `jobId: auditId` for deduplication
- [ ] **BQ-03**: Two separate ioredis connections used: one for `Queue` (finite `maxRetriesPerRequest`) and one for `Worker` (`maxRetriesPerRequest: null`)
- [ ] **BQ-04**: Lighthouse execution runs in a sandboxed processor (separate file path passed to `Worker` constructor) to prevent event-loop blocking
- [ ] **BQ-05**: Worker `lockDuration` is set longer than max expected Lighthouse audit duration (120 000 ms minimum)
- [ ] **BQ-06**: Worker `maxStalledCount: 2` and graceful shutdown with 25s timeout before `process.exit(0)`
- [ ] **BQ-07**: Failed/exhausted jobs are routed to a dead-letter queue (`failed-audits`)

### Node.js Build

- [ ] **BUILD-01**: `pnpm run build` succeeds with no TypeScript errors and no CF-related import errors
- [ ] **BUILD-02**: `.output/server/index.mjs` is produced and starts a working HTTP server with `node .output/server/index.mjs`
- [ ] **BUILD-03**: All routes (auth, server functions, API) return correct responses in Node.js mode

### Docker Infrastructure

- [ ] **DOCKER-01**: `Dockerfile.vps` (multi-stage: build + runtime) produces an image that starts the app on `PORT` with SIGTERM handled correctly via exec-form CMD
- [ ] **DOCKER-02**: `docker-compose.vps.yml` defines all 7 services on `vps-network`: `open-seo`, `open-seo-worker`, `ai-writer-frontend`, `ai-writer-backend`, `postgres`, `redis`, `nginx`
- [ ] **DOCKER-03**: Shared `postgres` service runs both `open_seo` and `alwrity` databases; `infra/postgres/init-databases.sh` creates `open_seo` on fresh volume
- [ ] **DOCKER-04**: `redis` service configured with `maxmemory 512mb`, `maxmemory-policy noeviction`, `save 60 1000`
- [ ] **DOCKER-05**: `nginx` service routes `app.openseo.so` to `open-seo` and `app.alwrity.com` (or configured domain) to `ai-writer-frontend`, both with SSL termination
- [ ] **DOCKER-06**: All services have Docker `healthcheck` defined; `open-seo` and `open-seo-worker` depend on `postgres: service_healthy` and `redis: service_healthy`
- [ ] **DOCKER-07**: `GET /healthz` returns `{ status: "ok" }` from the open-seo Node.js server

### CI/CD Pipeline

- [ ] **CI-01**: `.github/workflows/deploy-vps.yml` triggers on push to `main`; SSHs to VPS and deploys open-seo with zero-downtime pattern (build → migrate → up)
- [ ] **CI-02**: Database migrations run as a separate `docker compose run --rm` step before the new container goes live
- [ ] **CI-03**: Deployment uses pre-generated `KNOWN_HOSTS` secret (not `StrictHostKeyChecking=no`)
- [ ] **CI-04**: Dedicated `deploy` Linux user on VPS with `docker` group membership; ed25519 key pair used
- [ ] **CI-05**: `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, `KNOWN_HOSTS` set as GitHub Actions secrets

### Operational

- [ ] **OPS-01**: `pino` JSON structured logging wired to TanStack Start request middleware
- [ ] **OPS-02**: `.env.open-seo.example` documents all required environment variables with descriptions

---

## v2 Requirements (deferred)

### Observability

- **OBS-01**: Prometheus metrics endpoint + Grafana dashboard
- **OBS-02**: Loki log aggregation
- **OBS-03**: External uptime monitoring alert integration (PagerDuty/etc.)

### Operational Improvements

- **OPS-03**: Bull Board dashboard at `/admin/queues` behind auth
- **OPS-04**: Automated PostgreSQL backup script (pg_dump to S3/R2)
- **OPS-05**: pgBouncer connection pooler (when pool saturation observed)
- **OPS-06**: `docker rollout` (wowu/docker-rollout) for zero-downtime rolling updates

### AI-Writer CI/CD

- **CI-06**: Parallel GitHub Actions workflow for AI-Writer auto-deploy (currently manual SSH)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloudflare R2 → MinIO/S3 migration | R2 HTTP API works from Node.js without Cloudflare bindings; no migration needed |
| Marketing site (`web/`) migration | Stays on Cloudflare Pages; no VPS change |
| Database schema consolidation | Each app keeps its own PG database; unified schema adds unnecessary coupling |
| Autumn/billing infrastructure | External API; no infrastructure change needed |
| Auth system change (better-auth) | better-auth runs fine in Node.js; no change needed |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CF-01 | Phase 1 | Pending |
| CF-02 | Phase 1 | Pending |
| CF-03 | Phase 1 | Pending |
| CF-04 | Phase 1 | Pending |
| CF-05 | Phase 1 | Pending |
| CF-06 | Phase 1 | Pending |
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 1 | Pending |
| DB-04 | Phase 1 | Pending |
| DB-05 | Phase 1 | Pending |
| DB-06 | Phase 1 | Pending |
| DB-07 | Phase 1 | Pending |
| DB-08 | Phase 1 | Pending |
| BUILD-01 | Phase 1 | Pending |
| BUILD-02 | Phase 1 | Pending |
| BUILD-03 | Phase 1 | Pending |
| KV-01 | Phase 2 | Pending |
| KV-02 | Phase 2 | Pending |
| KV-03 | Phase 2 | Pending |
| BQ-01 | Phase 2 | Pending |
| BQ-02 | Phase 2 | Pending |
| BQ-03 | Phase 2 | Pending |
| BQ-04 | Phase 2 | Pending |
| BQ-05 | Phase 2 | Pending |
| BQ-06 | Phase 2 | Pending |
| BQ-07 | Phase 2 | Pending |
| DOCKER-01 | Phase 3 | Pending |
| DOCKER-02 | Phase 3 | Pending |
| DOCKER-03 | Phase 3 | Pending |
| DOCKER-04 | Phase 3 | Pending |
| DOCKER-05 | Phase 3 | Pending |
| DOCKER-06 | Phase 3 | Pending |
| DOCKER-07 | Phase 3 | Pending |
| OPS-01 | Phase 3 | Pending |
| OPS-02 | Phase 3 | Pending |
| CI-01 | Phase 4 | Pending |
| CI-02 | Phase 4 | Pending |
| CI-03 | Phase 4 | Pending |
| CI-04 | Phase 4 | Pending |
| CI-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 after initial definition*
