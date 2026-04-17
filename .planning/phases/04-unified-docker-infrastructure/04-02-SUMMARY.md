---
phase: 4
plan: "04-02"
subsystem: open-seo-main
tags: [docker, dockerfile, multi-stage, node, alpine, pnpm, tini]
dependency_graph:
  requires:
    - "03-04: BullMQ queue wiring + graceful shutdown (SIGTERM handler in server.ts)"
  provides:
    - "open-seo-main/Dockerfile.vps — multi-stage image build for VPS deployment"
    - "open-seo-main/.dockerignore — lean build context exclusion list"
  affects:
    - "04-04: docker-compose.vps.yml (references Dockerfile.vps for open-seo and open-seo-worker services)"
tech_stack:
  added:
    - "node:22-alpine (runtime base image)"
    - "tini (PID 1 signal relay)"
    - "pnpm prune --prod (dev dep stripping)"
  patterns:
    - "Multi-stage Docker build (builder -> runtime)"
    - "Exec-form CMD for SIGTERM propagation"
    - "Non-root container user (nodejs uid 1001)"
key_files:
  created:
    - open-seo-main/Dockerfile.vps
  modified:
    - open-seo-main/.dockerignore
decisions:
  - "Used tini as ENTRYPOINT for belt-and-suspenders PID 1 signal handling alongside exec-form CMD"
  - "Used node:22-alpine for both builder and runtime stages (smaller than node:22 full used in Dockerfile.selfhost)"
  - "Copied drizzle/ folder to runtime stage to support docker compose run --rm migration step"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-17T17:50:04Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 4 Plan 02: Multi-stage Dockerfile.vps for open-seo Summary

**One-liner:** Multi-stage node:22-alpine Dockerfile with tini entrypoint, exec-form CMD, and non-root user enabling SIGTERM propagation to the Phase 3 graceful shutdown handler.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write .dockerignore for open-seo-main | `1f3fe4a` | `open-seo-main/.dockerignore` |
| 2 | Write multi-stage Dockerfile.vps | `9e3b025` | `open-seo-main/Dockerfile.vps` |

(Both commits in `open-seo-main` sub-repo, which has its own git history.)

## What Was Built

### open-seo-main/.dockerignore

Replaces the existing minimal `.dockerignore` (which only had 10 entries) with a comprehensive exclusion list that keeps `docker build` context lean:

- `node_modules` — prevents 700MB+ directory being sent to Docker daemon
- `.output` — prevents a stale host build from corrupting the fresh builder install
- `.git`, `.env*` — security and noise exclusions
- `.wrangler`, `.vite`, `.cache`, `.pnpm-store` — tool-specific caches
- `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts` — test files not needed in production image
- `!.env.example` exception — preserves example env file for documentation

### open-seo-main/Dockerfile.vps

Multi-stage Dockerfile targeting VPS deployment:

**Stage 1 (builder, node:22-alpine):**
- Installs Alpine build tools (`libc6-compat python3 make g++`) for native npm deps
- Enables corepack for pnpm availability
- `COPY package.json pnpm-lock.yaml` then `pnpm install --frozen-lockfile` (cached layer)
- `COPY . .` then `pnpm run build` produces `.output/server/index.mjs` via Nitro v2
- `pnpm prune --prod` strips dev deps before runtime copy

**Stage 2 (runtime, node:22-alpine):**
- Installs `tini` for PID 1 reaping and signal forwarding
- Creates non-root `nodejs` user (uid 1001, gid 1001)
- Copies from builder with `--chown=nodejs:nodejs`: `.output/`, `node_modules/`, `package.json`, `drizzle/`
- `USER nodejs` — runs as non-root
- `EXPOSE 3001`
- `ENTRYPOINT ["/sbin/tini", "--"]`
- `CMD ["node", ".output/server/index.mjs"]` — exec-form ensures SIGTERM reaches node process

## Key Design Decisions

### Exec-form CMD (JSON array)
Shell-form CMD (`CMD node .output/server/index.mjs`) wraps execution in `sh -c`, which becomes PID 2 while `sh` is PID 1. Docker's SIGTERM is sent to PID 1, so the node process never receives it. Exec-form CMD (`CMD ["node", ...]`) makes node PID 2 under tini (PID 1), and tini forwards SIGTERM to all child processes. This is required for the Phase 3 graceful shutdown handler in `src/server.ts:43-48` to function correctly.

### Single image, two service modes
Same `Dockerfile.vps` image is used for both `open-seo` (HTTP server) and `open-seo-worker` (BullMQ worker) in `docker-compose.vps.yml`. The worker variant overrides CMD via compose `command:` directive — no separate Dockerfile needed.

### drizzle/ folder in runtime
The `drizzle/` migrations folder is copied into the runtime image so `drizzle-kit migrate` can be run as `docker compose run --rm open-seo ...` before app startup, per the 04-CONTEXT.md migration pattern.

## Build Verification

```
docker build -f Dockerfile.vps -t open-seo:test .  →  exit 0
docker image inspect open-seo:test --format '{{json .Config.Cmd}}'         → ["node",".output/server/index.mjs"]
docker image inspect open-seo:test --format '{{.Config.User}}'             → nodejs
docker image inspect open-seo:test --format '{{json .Config.Entrypoint}}'  → ["/sbin/tini","--"]
```

## Deviations from Plan

None — plan executed exactly as written. The `.dockerignore` was updated (not created) since a minimal version already existed; new content fully supersedes the old.

## Known Stubs

None. This plan produces Docker build artifacts only — no application logic, UI, or data sources.

## Threat Flags

None. The Dockerfile introduces no new network endpoints, auth paths, or trust boundaries. Security hardening is applied (non-root user, no secrets baked into image, production-only deps in runtime).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `open-seo-main/Dockerfile.vps` exists | FOUND |
| `open-seo-main/.dockerignore` exists | FOUND |
| `04-02-SUMMARY.md` exists | FOUND |
| Commit `1f3fe4a` (Task 1) | FOUND |
| Commit `9e3b025` (Task 2) | FOUND |
| `docker build` exit 0 | PASSED |
| Image CMD is exec-form JSON array | PASSED |
| Image user is `nodejs` | PASSED |
| Image entrypoint contains `tini` | PASSED |
