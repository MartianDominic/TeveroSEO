---
phase: 02-cf-bindings-removal-schema-migration
plan: "01"
subsystem: open-seo-main
tags: [cloudflare-removal, nodejs, postgresql, drizzle, nitro, pnpm]
dependency_graph:
  requires: []
  provides: [pg-driver, nitro-build-target, drizzle-postgresql-config, typed-process-env]
  affects: [open-seo-main/package.json, open-seo-main/vite.config.ts, open-seo-main/drizzle.config.ts, open-seo-main/tsconfig.json, open-seo-main/src/env.d.ts]
tech_stack:
  added: [pg@8.20.0, "@tanstack/nitro-v2-vite-plugin@1.154.9", ioredis@5.10.1, bullmq@5.74.1, "@types/pg@8.20.0"]
  removed: ["@cloudflare/vite-plugin", "@cloudflare/workers-types", "@libsql/client", wrangler, cloudflare@5.x]
  patterns: [nitro-node-server-preset, drizzle-postgresql-dialect, nodejs-process-env-augmentation]
key_files:
  modified:
    - open-seo-main/package.json
    - open-seo-main/pnpm-lock.yaml
    - open-seo-main/vite.config.ts
    - open-seo-main/drizzle.config.ts
    - open-seo-main/tsconfig.json
    - open-seo-main/src/env.d.ts
    - open-seo-main/.env.example
  deleted:
    - open-seo-main/wrangler.jsonc
decisions:
  - Use @tanstack/nitro-v2-vite-plugin (stable v2 wrapper) over raw nitro v3 beta for node-server preset
  - Add ioredis + bullmq in Phase 2 (even though used in Phase 3) to avoid a second lockfile churn
  - Replace Cloudflare.Env namespace with NodeJS.ProcessEnv augmentation for idiomatic Node.js typing
  - Add "types": ["node"] to tsconfig so process/Buffer globals resolve without CF workers runtime
metrics:
  duration: "~12 minutes"
  completed: "2026-04-17"
  tasks_completed: 3
  files_modified: 8
---

# Phase 2 Plan 01: CF Build Config + Package Replacement Summary

**One-liner:** Replaced all Cloudflare build-time dependencies (vite plugin, workers-types, wrangler, D1 client) with Node.js equivalents — pg 8.20.0, @tanstack/nitro-v2-vite-plugin 1.154.9, ioredis, bullmq — and reconfigured Drizzle, Vite, TypeScript, and env types for PostgreSQL + Node.js runtime.

## What Was Built

This is the foundational plan for Phase 2. It eliminates every Cloudflare-specific build-time and type-system dependency so downstream plans (schema rewrite, CF binding removal from source code) can compile cleanly.

### Task 1 — package.json + lockfile (`41975e6`)

- Removed: `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `@libsql/client`, `wrangler`, `cloudflare@5.x` SDK
- Removed: top-level `"cloudflare": { "bindings": { ... } }` Wrangler descriptor block
- Added: `pg@8.20.0`, `@tanstack/nitro-v2-vite-plugin@1.154.9`, `ioredis@5.10.1`, `bullmq@5.74.1` (production)
- Added: `@types/pg@8.20.0` (dev)
- Scripts updated: `deploy` → no-op message, `db:migrate:local/prod` → `drizzle-kit migrate`, `auth:generate` → `--dialect pg`, `cf-typegen` removed
- `pnpm install` produced clean lockfile: +294 packages added, 65 removed

### Task 2 — vite.config.ts (`d12299b`)

- Import: `@cloudflare/vite-plugin` → `@tanstack/nitro-v2-vite-plugin`
- Plugin: `cloudflare({ viteEnvironment: { name: "ssr" } })` → `nitroV2Plugin({ preset: "node-server" })`
- All existing config preserved: env loading, port, devtools toggle, allowedHosts, envPrefix array

### Task 3 — drizzle.config.ts + wrangler.jsonc + tsconfig.json + env.d.ts + .env.example (`6c2aa1d`)

- `drizzle.config.ts`: `dialect: "sqlite"` + `getLocalD1Url()` from `@every-app/sdk/cloudflare/server` → `dialect: "postgresql"` + `process.env.DATABASE_URL`
- `wrangler.jsonc`: deleted entirely (CF Workers deploy metadata)
- `tsconfig.json`: added `"types": ["node"]` so `process`, `Buffer`, `NodeJS.*` resolve; no `@cloudflare/workers-types` was present
- `src/env.d.ts`: replaced `declare namespace Cloudflare { interface Env { R2: R2Bucket; ... } }` with `declare namespace NodeJS { interface ProcessEnv { DATABASE_URL?; REDIS_URL?; ... } }`; kept `ImportMetaEnv` for Vite client-side vars
- `.env.example`: rewrote to document all env vars: `DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, auth vars, PostHog, DataForSEO, Loops, Autumn

## Deviations from Plan

None — plan executed exactly as written.

## Commits (open-seo-main repo)

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `41975e6` | feat(02-01): replace CF deps with pg/nitro/ioredis/bullmq |
| 2 | `d12299b` | feat(02-01): replace CF vite plugin with nitroV2Plugin node-server preset |
| 3 | `6c2aa1d` | feat(02-01): replace CF config files with Node.js/PostgreSQL equivalents |

## Known Stubs

None. All changes are config/dependency-level — no stub values flow to UI rendering.

## Threat Flags

None. These are build-time config changes with no new network endpoints, auth paths, or trust boundary changes. `DATABASE_URL` and `REDIS_URL` are credentials read from environment, consistent with the project's existing secret management pattern.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| open-seo-main/package.json | FOUND |
| open-seo-main/vite.config.ts | FOUND |
| open-seo-main/drizzle.config.ts | FOUND |
| open-seo-main/tsconfig.json | FOUND |
| open-seo-main/src/env.d.ts | FOUND |
| open-seo-main/.env.example | FOUND |
| open-seo-main/wrangler.jsonc | CONFIRMED ABSENT |
| commit 41975e6 (task 1) | FOUND |
| commit d12299b (task 2) | FOUND |
| commit 6c2aa1d (task 3) | FOUND |
