---
phase: 05-ci-cd-pipeline
plan: "01"
subsystem: open-seo / docker
tags: [migrations, docker-compose, ci-cd, drizzle, esbuild]
dependency_graph:
  requires: []
  provides: [open-seo-migrate-service, migrate-entry-mjs]
  affects: [docker-compose.vps.yml, open-seo-main/Dockerfile.vps]
tech_stack:
  added: []
  patterns: [one-shot-container, compose-profiles, esbuild-standalone-entry]
key_files:
  created:
    - open-seo-main/src/migrate-entry.ts
  modified:
    - open-seo-main/Dockerfile.vps
    - docker-compose.vps.yml
decisions:
  - "Used drizzle-orm/node-postgres/migrator (prod dep) not drizzle-kit (dev dep pruned at runtime)"
  - "profiles: [migrate] keeps migration service inert during normal docker compose up"
  - "restart: no ensures one-shot semantics — container exits after migrations complete"
  - "Reuse teveroseo/open-seo:latest image to avoid duplicate build context"
metrics:
  duration_minutes: 23
  completed_date: "2026-04-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 2
---

# Phase 5 Plan 01: Migration Container Summary

**One-liner:** Standalone drizzle-orm/node-postgres/migrator entry bundled via esbuild into a one-shot compose service behind `profiles: [migrate]` for CI-02 zero-downtime deploys.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create migrate-entry.ts | 29ccf29 (open-seo-main) | open-seo-main/src/migrate-entry.ts |
| 2 | Bundle migrate-entry via esbuild in Dockerfile.vps | d68c549 (open-seo-main) | open-seo-main/Dockerfile.vps |
| 3 | Add open-seo-migrate service to docker-compose.vps.yml | c87a310 (root) | docker-compose.vps.yml |

## What Was Built

### migrate-entry.ts

A standalone Node.js migration runner at `open-seo-main/src/migrate-entry.ts` that:
- Reads `DATABASE_URL` from env (exits 1 if missing)
- Creates a `pg.Pool` and `drizzle(pool)`
- Calls `migrate(db, { migrationsFolder: "./drizzle" })` from `drizzle-orm/node-postgres/migrator`
- Calls `pool.end()` then `process.exit(0)` on success, `process.exit(1)` on failure

Uses only production dependencies (`pg`, `drizzle-orm`) — never `drizzle-kit` which is pruned in the runtime image.

### Dockerfile.vps change

Inserted a second esbuild step after the existing `worker-entry.ts` build and before `pnpm prune --prod`:

```dockerfile
RUN pnpm exec esbuild src/migrate-entry.ts \
        --bundle --platform=node --format=esm --target=node22 \
        --outfile=.output/migrate-entry.mjs \
        --packages=external
```

Same flags as `worker-entry` — `--packages=external` keeps `drizzle-orm` and `pg` resolved from pruned prod `node_modules` at runtime.

### docker-compose.vps.yml change

New `open-seo-migrate` service added between `open-seo-worker` and the AI-Writer section:
- `profiles: ["migrate"]` — invisible to plain `docker compose up`
- `restart: "no"` — one-shot semantics, container exits after migrations
- `image: teveroseo/open-seo:latest` — reuses image built by `open-seo` service
- `command: ["node", ".output/migrate-entry.mjs"]`
- `depends_on: postgres: condition: service_healthy`
- `DATABASE_URL` matches same credentials as `open-seo` service

CI invokes via:
```bash
docker compose -f docker-compose.vps.yml --profile migrate run --rm open-seo-migrate
```

## Verification Results

- `open-seo-main/src/migrate-entry.ts` exists and TypeScript-checks clean (`tsc --noEmit`)
- No `drizzle-kit` imports in migrate-entry.ts
- `migrate-entry.mjs` esbuild step appears at line 36, before `pnpm prune --prod` at line 42
- `docker compose config --services` returns 7 services (migrate hidden without profile)
- `docker compose --profile migrate config --services` returns 8 services (migrate visible)
- Compose config validates cleanly with required env vars

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. The `open-seo-migrate` service operates entirely within the internal `teveroseo-net` Docker network. `DATABASE_URL` is sourced from `${OPEN_SEO_DB_PASSWORD}` env var — no secrets embedded in YAML. Consistent with T-05-02 (accepted, same posture as existing `open-seo` service).

## Self-Check: PASSED

- open-seo-main/src/migrate-entry.ts: FOUND
- open-seo-main/Dockerfile.vps: FOUND
- docker-compose.vps.yml: FOUND
- 05-01-SUMMARY.md: FOUND
- Commit 29ccf29 (migrate-entry.ts): FOUND
- Commit d68c549 (Dockerfile.vps): FOUND
- Commit c87a310 (docker-compose.vps.yml): FOUND
