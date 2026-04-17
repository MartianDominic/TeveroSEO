---
phase: 4
title: Unified Docker Infrastructure
type: infrastructure
discuss_skipped: true
discuss_skip_reason: All success criteria are technical (Docker services, nginx, healthchecks) — no user-facing behavior or UX decisions required
---

# Phase 4 Context: Unified Docker Infrastructure

## Goal

Both platforms run on a single VPS behind one nginx, sharing PostgreSQL and Redis, with a single `docker compose up` command. All 7 services come up healthy on `docker compose -f docker-compose.vps.yml up -d`.

## Success Criteria

- `docker compose -f docker-compose.vps.yml up -d` at TeveroSEO root brings all 7 services up healthy
- `curl https://app.openseo.so/healthz` returns `{ status: "ok" }`
- `curl https://<ai-writer-domain>/api/health` returns 200
- `docker compose -f docker-compose.vps.yml ps` shows all services as healthy

## Requirements Addressed

DOCKER-01, DOCKER-02, DOCKER-03, DOCKER-04, DOCKER-05, DOCKER-06, DOCKER-07

## Key Decisions (Claude's Discretion)

### Services (7 total)
- `open-seo` — Node.js HTTP server (port 3001 internally, not exposed directly)
- `open-seo-worker` — BullMQ audit worker (same image as open-seo, different CMD)
- `ai-writer-frontend` — React/nginx static serving (port 3000 internal)
- `ai-writer-backend` — FastAPI (port 8000 internal)
- `postgres` — Shared PostgreSQL; init script creates both `open_seo` and `alwrity` databases
- `redis` — Shared Redis with `maxmemory 512mb`, `maxmemory-policy noeviction`, `save 60 1000`
- `nginx` — Reverse proxy on ports 80/443; routes by domain

### open-seo-main Dockerfile
- File: `open-seo-main/Dockerfile.vps`
- Multi-stage: builder (node:22-alpine, pnpm build) → runtime (node:22-alpine)
- CMD in exec-form for SIGTERM propagation: `["node", ".output/server/index.mjs"]`
- Worker variant: same image, CMD overridden in compose to `["node", ".output/server/index.mjs", "--worker-only"]` OR separate entrypoint
- Migrations run as separate `docker compose run --rm` init step before app starts

### Postgres Init Script
- `docker/postgres/init.sql` — creates both `open_seo` and `alwrity` DBs if they don't exist
- Mounted as `/docker-entrypoint-initdb.d/init.sql`

### Redis Config
- `maxmemory 512mb`, `maxmemory-policy noeviction`, `save 60 1000`
- Passed via command override in compose: `redis-server --maxmemory 512mb ...`

### nginx
- Config file: `docker/nginx/nginx.conf`
- Routes `app.openseo.so` → `open-seo:3001`
- Routes AI-Writer domain → `ai-writer-frontend:3000`
- SSL termination via Let's Encrypt certs mounted as volume
- HTTP → HTTPS redirect

### Health Checks
- `open-seo`: `curl -f http://localhost:3001/healthz` (requires `/healthz` route returning `{ status: "ok" }`)
- `open-seo-worker`: process alive check (no HTTP; use `["CMD", "sh", "-c", "redis-cli -h redis ping"]` or node process check)
- `postgres`: `pg_isready`
- `redis`: `redis-cli ping`
- `ai-writer-backend`: `curl -f http://localhost:8000/api/health`
- `ai-writer-frontend`: `curl -f http://localhost:3000/`

### /healthz Route
- Must be added to `open-seo-main/src/server.ts` (or a route file): `GET /healthz` → `{ status: "ok" }`
- Required by DOCKER-07

### Working Directory
- Root of TeveroSEO repo for `docker-compose.vps.yml`
- `open-seo-main/` for `Dockerfile.vps`
- `docker/` for nginx config and postgres init script

### Dependencies
- Phase 2 complete (open-seo-main Node.js + PG)
- Phase 3 complete (BullMQ + Redis wired)
- Phase 1 complete (AI-Writer cleaned)
- AI-Writer already has its own Dockerfile(s) — reference existing; do NOT rewrite

### Port Allocation (from CLAUDE.md constraints)
- open-seo: 3001 (external-facing via nginx)
- ai-writer-frontend: 3000 (internal)
- ai-writer-backend: 8000 (internal)
- postgres: 5432 (internal)
- redis: 6379 (internal)
- nginx: 80, 443 (external)
