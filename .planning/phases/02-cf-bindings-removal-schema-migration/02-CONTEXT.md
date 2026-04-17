---
phase: 2
title: CF Bindings Removal + Schema Migration
type: infrastructure
discuss_skipped: true
discuss_skip_reason: All success criteria are technical (compile/run checks) — no user-facing behavior or UX decisions required
---

# Phase 2 Context: CF Bindings Removal + Schema Migration

## Goal

open-seo-main compiles and runs as a Node.js server with no Cloudflare runtime dependencies and a PostgreSQL-dialect Drizzle schema.

## Success Criteria

- `pnpm build` passes with no CF-specific errors
- App starts with `node .output/server/index.mjs` (or equivalent)
- Zero `cloudflare:workers` / `env.BUCKET` / `env.KV` / Cloudflare-specific API references in source
- Drizzle schema uses `pg-core` dialect (not `sqlite-core`)
- All `@cloudflare/vite-plugin` / `@cloudflare/workers-types` / `wrangler.toml` references removed
- TanStack Start configured for Node.js server preset

## Known CF-Dependent Files

- `src/serverFunctions/config.ts` — uses `env.CLERK_*` bindings
- `src/serverFunctions/audit.ts` — CF bindings for audit trigger
- `src/server/email/loops.ts` — CF env bindings
- `src/server/features/audit/services/AuditService.ts` — CF bindings
- `src/server/lib/runtime-env.ts` — CF runtime env adapter
- `src/server/lib/dataforseoLighthouse.ts` — CF bindings
- `src/server/lib/r2-cache.ts` — Cloudflare R2 storage
- Various workflow files in `src/server/features/audit/workflows/`

## Key Decisions (Claude's Discretion)

- Replace CF env bindings with `process.env` reads
- Replace Cloudflare R2 with local filesystem or skip caching (Phase 4 introduces shared storage)
- Replace `@cloudflare/vite-plugin` with `@tanstack/start-vite-plugin` + `preset: "node-server"` via nitro
- Migrate Drizzle schema from `sqlite-core` to `pg-core` dialect (matching shared PostgreSQL)
- Remove `wrangler.toml` if present
- Keep BullMQ replacement for Phase 3; Phase 2 only removes the CF bindings from workflow triggers (stub them)
