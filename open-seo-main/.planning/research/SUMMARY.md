# Research Summary: Unified Platform Infrastructure

**Synthesized from:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Date:** 2026-04-17
**Confidence:** HIGH

---

## Executive Summary

This is a brownfield runtime migration, not a greenfield build. The app code (TanStack Start, Drizzle ORM, better-auth, audit workflows) is substantially complete; the work is detaching it from Cloudflare's proprietary bindings (`D1`, `KV`, `SITE_AUDIT_WORKFLOW`, `@cloudflare/vite-plugin`) and running it on a self-hosted VPS alongside the existing AI-Writer service.

Every major technology decision is locked in by the existing codebase. Research identified exact migration paths, not new stack choices.

---

## Recommended Stack

| Package | Version | Role |
|---|---|---|
| `@tanstack/nitro-v2-vite-plugin` | `1.154.9` | Vite adapter (replaces `@cloudflare/vite-plugin`); preset: `node-server` |
| `pg` (node-postgres) | `8.20.0` | PostgreSQL driver (replaces D1 binding) |
| `drizzle-orm` | `^0.44.4` | Already installed; dialect + schema change |
| `bullmq` | `5.74.1` | Job queue (replaces `WorkflowEntrypoint`) |
| `ioredis` | `5.10.1` | Redis client (BullMQ + replaces `env.KV`) |
| `pino` | latest | Structured JSON logging |
| `postgres:16-alpine` | Docker image | Shared PG, two logical databases |
| `redis:7-alpine` | Docker image | Cache + BullMQ queue |
| `node:22-alpine` | Docker base | Runtime |

**Remove:** `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `@libsql/client`, `wrangler`

---

## Key Technical Decisions

### Redis eviction policy: `noeviction`
FEATURES.md recommended `volatile-lru`; PITFALLS.md overrides: BullMQ requires `noeviction` or jobs silently disappear. Both use the same Redis instance. Accept `noeviction` globally — BullMQ requirement wins; KV relies on TTL key semantics only.

### Worker process: separate Docker service
A BullMQ Worker that runs Lighthouse (CPU-heavy, 200-400MB) must be a sandboxed processor (separate child process) to prevent blocking the event loop and causing stall events. Run the worker as a second Docker service with the same image but different CMD.

### Drizzle migrations: delete and regenerate
The old `drizzle/` migration journal must be fully deleted before running `drizzle-kit generate` for PG. Do NOT attempt to migrate existing migrations — generate fresh PG-dialect migrations and apply to a fresh database.

### SIGTERM: always `CMD ["node", ".output/server/index.mjs"]`
Never `CMD ["npm", "start"]`. npm intercepts SIGTERM and causes 30s hard-kill on every deploy, creating stalled BullMQ jobs.

### `known_hosts` pre-generated, never `StrictHostKeyChecking=no`
Pre-generate with `ssh-keyscan -H $VPS_IP` and store as a GitHub Actions secret.

---

## Phased Build Order (4 phases)

### Phase 1: CF Bindings + Schema Migration
**Gate: nothing compiles until this is done.**
- Remove all `cloudflare:workers` imports (crash the Rollup client bundle if any remain)
- Swap `vite.config.ts`: `cloudflare()` → `nitroV2Plugin({ preset: "node-server" })`
- Rewrite `src/server.ts` (remove `SiteAuditWorkflow` export, use Node server entry)
- Rewrite `src/db/index.ts` to `drizzle/node-postgres` + `Pool`
- Rewrite all schema: `sqlite-core` → `pg-core`, convert timestamp/boolean/json columns
- Centralise env access in `runtime-env.ts`, add startup validation
- Delete `drizzle/` folder, regenerate PG migrations

### Phase 2: BullMQ + Redis KV Replacement
**Gate: audit service calls CF runtime bindings that throw in Node.js.**
- Install `bullmq`, `ioredis`
- Create two ioredis connections (Queue: finite retries; Worker: `maxRetriesPerRequest: null`)
- Replace `env.SITE_AUDIT_WORKFLOW.*` → BullMQ queue operations
- Replace `SiteAuditWorkflow` class → BullMQ worker with step-enum pattern
- Replace `progress-kv.ts` `env.KV.*` → ioredis TTL operations
- Sandboxed processor for Lighthouse phase, `lockDuration` > max audit duration
- Graceful shutdown handler (25s timeout), DLQ pattern

### Phase 3: Docker Compose + Infrastructure Assembly
**Gate: working app needs production wrapping.**
- Multi-stage `Dockerfile.vps` (pnpm + build → `node:22-alpine` + `.output/`)
- `docker-compose.vps.yml` (7 services on `vps-network`: open-seo, open-seo-worker, ai-writer-frontend, ai-writer-backend, postgres, redis, nginx+certbot)
- `infra/postgres/init-databases.sh` creates `open_seo` database alongside existing `alwrity`
- `nginx/conf.d/open-seo.conf` (HTTPS, WebSocket, `X-Forwarded-Proto`)
- Redis: `maxmemory 512mb`, `noeviction`, `save 60 1000`
- `/healthz` Nitro route, Docker `healthcheck` on all services, `depends_on: service_healthy`

### Phase 4: CI/CD + Deployment Pipeline
**Gate: manual deployment verified to work in Phase 3.**
- `.github/workflows/deploy-vps.yml` via `appleboy/ssh-action@v1.0.3`
- Deploy order: `git pull` → `docker compose build` → run migrations → `docker compose up -d --no-build` → health poll
- Zero-downtime pattern: build new image, then swap (not `--build` inline)
- Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, `KNOWN_HOSTS`
- Dedicated `deploy` Linux user on VPS with `docker` group membership

---

## Critical Pitfalls (bake into plans)

| # | Pitfall | Impact | Prevention |
|---|---|---|---|
| 1 | `cloudflare:workers` import in any file crashes Rollup client bundle | Build failure | Grep to zero before changing adapter |
| 2 | Old SQLite `drizzle/` journal corrupts PG `drizzle-kit generate` | Silent bad migrations | Delete entire `drizzle/` folder first |
| 3 | BullMQ Worker with `maxRetriesPerRequest` default crashes on init | No jobs processed | Always use `maxRetriesPerRequest: null` on Worker ioredis connection |
| 4 | Lighthouse worker blocks event loop → stall events → duplicate audits | Data integrity | Use sandboxed processor (file-path pattern) |
| 5 | `CMD ["npm", "start"]` swallows SIGTERM → 30s hard kill on each deploy | Stalled BullMQ jobs | Use exec-form `CMD ["node", ".output/server/index.mjs"]` |
| 6 | `StrictHostKeyChecking=no` in CI | MITM vulnerability | Pre-generate `known_hosts` via `ssh-keyscan` |

---

## Open Questions for Planning

1. **Nitro `@tanstack/react-start` server entry exact API in v1.167.17** — verify `createServerEntry` import signature hasn't changed before writing Phase 1 code
2. **Existing VPS postgres volume** — if `postgres_data` already exists with live AI-Writer data, `open_seo` database must be created manually (not via init script); confirm VPS state before Phase 3
3. **Lighthouse concurrency** — `concurrency: 2` recommended but each Chrome instance is 200-400MB; set based on actual VPS RAM
4. **BullMQ v5 sandboxed processor API** — interface changed v4→v5; verify exact `Worker` constructor before writing Phase 2 code
