# Unified Platform Infrastructure

## What This Is

A self-hosted infrastructure migration that moves open-seo-main from Cloudflare Workers (D1/KV/Workflows) to a VPS-deployed Node.js server backed by PostgreSQL and Redis. Combined with a shared Docker Compose setup, both open-seo-main and AI-Writer (an existing FastAPI + React platform) run on the same VPS under a unified Nginx reverse proxy, with GitHub Actions CI/CD auto-deploying both on push.

## Core Value

Both platforms run reliably on a single VPS, deploy automatically on every push, and share a PostgreSQL instance — zero manual intervention required.

## Requirements

### Validated

- ✓ AI-Writer runs on PostgreSQL via Docker Compose — existing (Phase 1 v1.0)
- ✓ AI-Writer has Nginx + Certbot SSL on VPS — existing (Phase 1 v1.0)
- ✓ open-seo-main has working Drizzle ORM schema — existing codebase
- ✓ open-seo-main has partial Dockerfile.selfhost — existing codebase

### Active

- [ ] open-seo-main Drizzle schema migrated from SQLite (`sqliteTable`) to PostgreSQL (`pgTable`)
- [ ] All `cloudflare:workers` imports removed from open-seo-main server code
- [ ] `env.KV.*` replaced with Redis (ioredis) with equivalent TTL semantics
- [ ] Cloudflare Workflows (`WorkflowEntrypoint`) replaced with BullMQ job queue on Redis
- [ ] open-seo-main runs as Node.js server (TanStack Start Node adapter) in Docker
- [ ] Shared docker-compose.vps.yml includes both platforms, shared PostgreSQL, Redis, Nginx, Certbot
- [ ] CI/CD: GitHub Actions pushes trigger SSH-based auto-deploy on VPS

### Out of Scope

- Cloudflare R2 → S3/MinIO migration — open-seo-main uses R2 for Lighthouse payloads; keeping R2 via HTTP API (no Cloudflare binding needed)
- Autumn/billing service migration — keep calling external Autumn API, no infrastructure change
- Web marketing site (`web/` subdirectory) — stays on Cloudflare Pages, no change
- open-seo-main auth migration — better-auth works in Node.js without changes
- Database consolidation into single schema — each app keeps its own PG database (open_seo + alwrity)

## Context

**open-seo-main stack:**
- TanStack Start + Vite + TanStack Router (full-stack React SSR)
- Drizzle ORM with SQLite/D1 dialect → migrating to PG
- better-auth for authentication (works in Node.js)
- Cloudflare-specific: D1 (database), KV (audit progress cache), Workflows (site audit job orchestration), R2 (Lighthouse payload storage)
- Server entry: `src/server.ts` exports `{ fetch, SiteAuditWorkflow }` as CF Worker module

**AI-Writer stack:**
- FastAPI (Python) backend + React/CRA frontend
- PostgreSQL via SQLAlchemy + Alembic
- Docker Compose at `/home/dominic/Documents/TeveroSEO/AI-Writer/`
- Existing: `docker-compose.yml`, `docker-compose.vps.yml`, `nginx/`, `certbot/`
- Deployed to VPS via manual SSH; no CI/CD currently

**Key Cloudflare bindings to replace:**
- `env.DB` (D1) → Drizzle PG client via `DATABASE_URL`
- `env.KV` (KV namespace) → ioredis with `REDIS_URL`; used only in `progress-kv.ts` for 30-min TTL audit crawl progress
- `env.SITE_AUDIT_WORKFLOW` (CF Workflows) → BullMQ queue on Redis; used in `AuditService.ts` to spawn site audit jobs
- `env.R2` (R2 bucket) → keep using R2 via HTTP SDK (`@cloudflare/workers-types` → `aws4fetch` or `@aws-sdk/client-s3`)

**Env sourcing:**
- CF Worker env comes from `cloudflare:workers` → must switch to `process.env` / dotenv
- The `src/server/lib/runtime-env.ts` already abstracts some env access — extend it

## Constraints

- **Tech Stack**: open-seo-main must stay on TanStack Start (no framework swap) — just change runtime target from CF Workers to Node.js
- **Drizzle**: must upgrade from `drizzle-orm/sqlite-core` to `drizzle-orm/pg-core`; all migrations must be regenerated
- **BullMQ**: requires Redis 6+; job steps must replicate CF Workflows' step-level retry semantics
- **Node.js version**: 22 (matches existing Dockerfile.selfhost)
- **No breaking UI changes**: migration is infrastructure-only; zero user-visible changes
- **Port allocation**: open-seo (3001), ai-writer-frontend (3000, internal), ai-writer-backend (8000, internal), postgres (5432, internal), redis (6379, internal)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep R2 for Lighthouse payloads | R2 HTTP API works from Node.js; migrating to MinIO adds complexity with no benefit | — Pending |
| BullMQ over Inngest/Trigger.dev | BullMQ is self-hosted, Redis already needed for KV replacement, proven with Node.js | — Pending |
| Single shared PG instance, two databases | Simpler ops than two PG containers; each app still has isolated schema | — Pending |
| CI/CD via GitHub Actions + SSH | Simplest path; no additional services needed | — Pending |
| TanStack Start Node adapter | Official adapter exists; no framework rewrite needed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 after initialization*
