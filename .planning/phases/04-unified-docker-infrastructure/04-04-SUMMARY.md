---
phase: 4
plan: "04-04"
subsystem: infrastructure
tags: [docker, compose, nginx, postgres, redis, bullmq, worker, healthcheck]

dependency_graph:
  requires:
    - "04-01: /healthz route on open-seo HTTP server"
    - "04-02: open-seo-main/Dockerfile.vps multi-stage build"
    - "04-03: docker/postgres init SQL, docker/redis/redis.conf, docker/nginx config + Dockerfile"
  provides:
    - "docker-compose.vps.yml: unified 7-service orchestration at TeveroSEO root"
    - ".env.vps.example: template listing all required env vars"
    - "open-seo-main/src/worker-entry.ts: dedicated BullMQ worker entry (no HTTP server)"
    - "docker/nginx/nginx.conf: /api/health alias for ROADMAP SC #3"
  affects:
    - "Phase 5: CI/CD — docker-compose.vps.yml is the deployment target"
    - "Phase 6: Clerk auth — BETTER_AUTH_SECRET / BETTER_AUTH_URL env vars documented in .env.vps.example"

tech_stack:
  added:
    - "docker compose name: teveroseo (project-scoped named volumes and network)"
    - "esbuild --packages=external bundling for standalone worker entry point"
  patterns:
    - "service_healthy depends_on: open-seo + open-seo-worker wait for postgres + redis healthy before starting"
    - "Single image, two service modes: open-seo (HTTP) and open-seo-worker (BullMQ) share teveroseo/open-seo:latest"
    - "Worker liveness proxy: redis ping healthcheck since worker has no HTTP surface"
    - "Internal-only data layer: postgres and redis have no host port mappings"
    - "nginx healthcheck via dedicated port 8080 server block (no SSL required)"

key_files:
  created:
    - docker-compose.vps.yml
    - .env.vps.example
    - open-seo-main/src/worker-entry.ts
  modified:
    - docker/nginx/nginx.conf (added location = /api/health alias before /api/ catch-all)
    - docker/nginx/Dockerfile (added EXPOSE 8080)
    - open-seo-main/Dockerfile.vps (added esbuild step to compile worker-entry.ts)

key_decisions:
  - "open-seo-worker reuses teveroseo/open-seo:latest image (built by open-seo service) via command override — no separate Dockerfile needed"
  - "worker-entry.ts compiled with esbuild --packages=external so prod node_modules in runtime image satisfies all imports"
  - "AI-Writer backend DATABASE_URL uses alwrity_user role (matching init.sql) not alwrity user (from AI-Writer's own compose)"
  - "/api/health nginx alias added before /api/ catch-all so backend's /health endpoint is reachable at /api/health (ROADMAP SC #3)"
  - "open-seo healthcheck uses wget (available in node:22-alpine) rather than curl (not present by default)"
  - "ai-writer-backend healthcheck uses wget for same reason; nginx healthcheck uses curl (installed in docker/nginx/Dockerfile)"
  - "open-seo-worker depends on open-seo with condition: service_started (not service_healthy) — worker can start in parallel with HTTP server"

requirements_completed:
  - DOCKER-02
  - DOCKER-03
  - DOCKER-04
  - DOCKER-05
  - DOCKER-06

metrics:
  duration: "~15 minutes"
  completed: "2026-04-17T17:59:00Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 3
---

# Phase 4 Plan 04: Unified docker-compose.vps.yml Summary

**Unified 7-service docker-compose.vps.yml with DOCKER-06 healthchecks + service_healthy dependency conditions, dedicated BullMQ worker-entry.ts compiled to .output/worker-entry.mjs, and nginx /api/health alias for ROADMAP success criterion #3.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-17T17:44:00Z
- **Completed:** 2026-04-17T17:59:00Z
- **Tasks completed:** 2/3 (Task 3 is human-verify checkpoint pending VPS deployment)
- **Files created:** 3
- **Files modified:** 3

## Accomplishments

### Task 1: Patch nginx.conf + create worker entry (commits: c74f402, ec55368)

- `docker/nginx/nginx.conf`: added `location = /api/health` alias block before the `/api/` catch-all, proxying to `ai-writer-backend:8000/health` — satisfies ROADMAP SC #3 (`curl https://app.alwrity.com/api/health` returns 200)
- `docker/nginx/Dockerfile`: added `EXPOSE 8080` to document the internal healthcheck port
- `open-seo-main/src/worker-entry.ts`: new dedicated BullMQ worker entry — calls `validateEnv`, `startAuditWorker()`, registers SIGTERM/SIGINT handlers, and keeps process alive with a no-op `setInterval`. Does NOT start the HTTP server.
- `open-seo-main/Dockerfile.vps`: added `pnpm exec esbuild src/worker-entry.ts --bundle --platform=node --format=esm --target=node22 --outfile=.output/worker-entry.mjs --packages=external` step after `pnpm run build`, before `pnpm prune --prod`. The `--packages=external` flag leaves all node_modules imports unbundled so the runtime stage's pruned `node_modules/` satisfies them.

### Task 2: Write docker-compose.vps.yml + .env.vps.example (commit: db5a994)

`docker-compose.vps.yml` orchestrates all 7 services:

| Service | Image / Build | Internal Port | Host Port | Healthcheck |
|---------|--------------|--------------|-----------|-------------|
| postgres | postgres:16-alpine | 5432 | none | pg_isready -U postgres |
| redis | redis:7-alpine | 6379 | none | redis-cli ping |
| open-seo | build: open-seo-main/Dockerfile.vps | 3001 | none | wget /healthz |
| open-seo-worker | image: teveroseo/open-seo:latest | — | none | node redis ping |
| ai-writer-backend | build: AI-Writer/backend | 8000 | none | wget /health |
| ai-writer-frontend | build: AI-Writer/frontend | 80 | none | wget / |
| nginx | build: docker/nginx | 80, 443, 8080 | 80:80, 443:443 | curl /nginx-health |

Key wiring:
- `open-seo` and `open-seo-worker` both `depends_on postgres/redis condition: service_healthy` (DOCKER-06)
- `nginx` depends_on `open-seo`, `ai-writer-frontend`, `ai-writer-backend` all `condition: service_healthy`
- `open-seo-worker` uses `image: teveroseo/open-seo:latest` (same image, no separate build) with `command: ["node", ".output/worker-entry.mjs"]`
- All services on `teveroseo-net` bridge network
- Named volumes: `postgres_data`, `redis_data`, `ai_writer_workspace`, `letsencrypt_conf`, `letsencrypt_www`

`.env.vps.example` documents all required env vars with safe placeholder defaults. `.env.vps` added to `.gitignore`.

## Task Commits

| Repo | Task | Hash | Message |
|------|------|------|---------|
| TeveroSEO | Task 1 (nginx) | c74f402 | feat(04-04): patch nginx /api/health alias + expose port 8080 |
| open-seo-main | Task 1 (worker) | ec55368 | feat(04-04): add worker-entry.ts + esbuild step in Dockerfile.vps |
| TeveroSEO | Task 2 | db5a994 | feat(04-04): add docker-compose.vps.yml + .env.vps.example |

## Checkpoint Pending: Task 3 (Smoke Test)

Task 3 is a `type="checkpoint:human-verify"` gate. The compose file validates syntactically (`docker compose config` exits 0), all 7 services are present, and healthcheck contracts are wired. Full smoke verification requires running on the actual VPS or a Docker-capable machine with:

1. Real or self-signed SSL certs in a `teveroseo_letsencrypt_conf` volume
2. A filled `.env.vps` with non-placeholder secrets
3. `docker compose -f docker-compose.vps.yml --env-file .env.vps up -d`
4. Waiting ~3 minutes for all services to become healthy
5. Verifying the 8 acceptance criteria in the plan's Task 3 `how-to-verify` block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] nginx.conf /api/health alias was missing (04-03 did not add it)**

- **Found during:** Task 1 verification
- **Issue:** Plan 04-03 wrote nginx.conf before the `/api/health` alias requirement was specified. The 04-04 plan explicitly calls for adding this alias.
- **Fix:** Added `location = /api/health { proxy_pass http://ai-writer-backend:8000/health; }` block before the `/api/` catch-all location in the app.alwrity.com HTTPS server block.
- **Files modified:** `docker/nginx/nginx.conf`
- **Commit:** c74f402

**2. [Rule 2 - Missing critical functionality] nginx.conf port fix already done by 04-03**

- **Observation:** Plan 04-04 Task 1 called for changing `ai-writer-frontend:3000` to `ai-writer-frontend:80`. Plan 04-03 had already applied this fix as a deviation (Rule 1 - Bug). No duplicate action needed.

**3. [Rule 1 - Bug] open-seo healthcheck: wget instead of curl**

- **Found during:** Task 2 (writing healthcheck tests)
- **Issue:** Plan specified `curl -fsS http://localhost:3001/healthz` but `node:22-alpine` does not ship curl. The AI-Writer backend image likewise lacks curl.
- **Fix:** Used `wget -qO-` for open-seo and ai-writer-backend healthchecks. nginx uses curl (installed via apk in docker/nginx/Dockerfile). Postgres uses pg_isready, redis uses redis-cli (both bundled in their images).
- **Files modified:** `docker-compose.vps.yml`
- **Commit:** db5a994

## Known Stubs

None. All service configurations, healthcheck commands, and environment variables are production-ready (no placeholder data flows to runtime behavior except `change_me_*` values in `.env.vps.example` which are intentionally placeholder documentation).

## Threat Flags

None. No new network endpoints or trust boundaries introduced. The compose file explicitly enforces the planned security posture: postgres and redis have no host port mappings (internal-only), nginx is the only publicly exposed service (ports 80/443).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `docker-compose.vps.yml` exists at TeveroSEO root | FOUND |
| `.env.vps.example` exists at TeveroSEO root | FOUND |
| `open-seo-main/src/worker-entry.ts` exists | FOUND |
| `docker/nginx/nginx.conf` contains `location = /api/health` | FOUND |
| `docker/nginx/nginx.conf` contains `proxy_pass http://ai-writer-frontend:80` | FOUND |
| `docker/nginx/Dockerfile` contains `EXPOSE 8080` | FOUND |
| `open-seo-main/Dockerfile.vps` contains `esbuild src/worker-entry.ts` | FOUND |
| All 7 services present in compose file | FOUND |
| `docker compose config` exits 0 | PASSED |
| Commit c74f402 (nginx patch) | FOUND |
| Commit ec55368 (worker-entry) | FOUND |
| Commit db5a994 (compose + env) | FOUND |
