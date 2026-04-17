---
plan: "04-03"
phase: 4
title: "Supporting infra config files: postgres init SQL, nginx reverse proxy, redis config"
subsystem: infrastructure
tags: [docker, postgres, redis, nginx, ssl, reverse-proxy]
completed: "2026-04-17"
duration_minutes: 15

dependency_graph:
  requires:
    - "04-CONTEXT.md: port allocation and service topology decisions"
    - "AI-Writer/nginx/conf.d/app.conf: nginx domain routing pattern"
    - "AI-Writer/docker-compose.yml: alwrity DB env var conventions"
  provides:
    - "docker/postgres/init.sql: dual-database init script for postgres:16-alpine initdb"
    - "docker/postgres/init.sh: password injection companion for initdb"
    - "docker/redis/redis.conf: BullMQ-compatible Redis config with 512mb cap"
    - "docker/nginx/nginx.conf: multi-domain SSL reverse proxy config"
    - "docker/nginx/Dockerfile: nginx:1.27-alpine image with curl for healthcheck"
  affects:
    - "04-04: docker-compose.vps.yml bind-mounts these files into postgres, redis, nginx services"

tech_stack:
  added:
    - "postgres:16-alpine initdb script pattern (SQL + shell companion)"
    - "Redis RDB persistence with noeviction policy"
    - "nginx multi-domain SSL termination with ACME challenge support"
  patterns:
    - "Two-file initdb pattern: init.sql (DDL) + init.sh (secrets injection) — alphabetical ordering ensures DDL before ALTER ROLE"
    - "nginx 8080 healthcheck server block — no SSL required for internal Docker healthcheck"

key_files:
  created:
    - docker/postgres/init.sql
    - docker/postgres/init.sh
    - docker/redis/redis.conf
    - docker/nginx/nginx.conf
    - docker/nginx/Dockerfile
  modified: []

decisions:
  - "Used two-file initdb pattern (init.sql + init.sh) to keep password literals out of VCS while honoring CONTEXT.md filename requirement"
  - "ai-writer-frontend proxied on port 80 (not 3000) — confirmed from AI-Writer/frontend/Dockerfile which exposes port 80 via nginx:alpine"
  - "Added port 8080 /nginx-health server block per task_context — no SSL needed for internal Docker compose healthcheck"
  - "Redis bind 0.0.0.0 + protected-mode no is safe because no host port is exposed in compose (internal network only)"

metrics:
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 0
  commits: 3
---

# Phase 4 Plan 03: Supporting infra config files — postgres init SQL, nginx reverse proxy, redis config

## One-liner

Dual-DB postgres init (SQL DDL + shell password injection), BullMQ-safe Redis config (noeviction + 512mb), and multi-domain nginx SSL reverse proxy with ACME challenge support and internal healthcheck endpoint.

## What Was Built

### Task 1: Postgres init SQL + shell companion (commit 9b363bc)

Two files mounted at `/docker-entrypoint-initdb.d/` in the shared postgres container:

- `docker/postgres/init.sql` — Creates `open_seo` (for open-seo-main) and `alwrity` (for AI-Writer) databases with dedicated roles (`open_seo_user`, `alwrity_user`). Enables `pgcrypto` extension in both databases. Runs first (alphabetical: `.sql` < `.sh`).
- `docker/postgres/init.sh` — Runs second; reads `OPEN_SEO_DB_PASSWORD` and `ALWRITY_DB_PASSWORD` from environment and issues `ALTER ROLE ... WITH PASSWORD` for each role. Fails loudly (`:?` syntax) if either env var is missing.

This two-file pattern satisfies DOCKER-03: both databases are created with dedicated roles, passwords never appear in VCS, and the postgres:16-alpine official image runs both files in alphabetical order on fresh volume init.

### Task 2: Redis config file (commit f6b00c8)

`docker/redis/redis.conf` enforces the exact DOCKER-04 spec:
- `maxmemory 512mb` — memory cap
- `maxmemory-policy noeviction` — BullMQ requirement (eviction causes silent job data loss)
- `save 60 1000` — RDB snapshot when 1000+ keys change within 60s
- `appendonly no` — RDB-only; AOF would double disk I/O for no benefit
- `bind 0.0.0.0` + `protected-mode no` — safe on internal compose network with no host port exposure

### Task 3: Nginx reverse proxy config + Dockerfile (commit e956bb5)

`docker/nginx/nginx.conf` routes two domains with full SSL + HTTP→HTTPS redirect:

| Domain | Upstream | Port |
|--------|----------|------|
| `app.openseo.so` | `open-seo` | 3001 |
| `app.alwrity.com` | `ai-writer-frontend` | 80 |
| `app.alwrity.com/api/` | `ai-writer-backend` | 8000 |

Additional server block on port 8080 serves `/nginx-health` (plain text, no SSL) for Docker compose healthcheck.

`docker/nginx/Dockerfile` uses `nginx:1.27-alpine` + installs `curl` via `apk add --no-cache curl` — needed because `nginx:alpine` doesn't ship curl but compose healthcheck uses `curl -f http://localhost:8080/nginx-health`.

Docker build verified: `docker build -f docker/nginx/Dockerfile -t tevero-nginx:test docker/nginx/` exits 0.

## Commits

| Hash | Message |
|------|---------|
| 9b363bc | feat(04-03): postgres init SQL + shell companion for DOCKER-03 |
| f6b00c8 | feat(04-03): Redis config enforcing DOCKER-04 spec |
| e956bb5 | feat(04-03): nginx reverse proxy config + Dockerfile for DOCKER-05 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added port 8080 /nginx-health endpoint**

- **Found during:** Task 3
- **Issue:** Plan body's nginx.conf template did not include the 8080 healthcheck endpoint specified in the task_context ("nginx also needs a /nginx-health endpoint on port 8080 for healthcheck")
- **Fix:** Added a dedicated `server { listen 8080; }` block with `location /nginx-health` returning 200. No SSL needed for this internal endpoint.
- **Files modified:** docker/nginx/nginx.conf
- **Commit:** e956bb5

**2. [Rule 1 - Bug] Corrected ai-writer-frontend port from 3000 to 80**

- **Found during:** Task 3
- **Issue:** Plan body specified `ai-writer-frontend:3000` but task_context noted "actual container port, not 3000". Checked `AI-Writer/frontend/Dockerfile` — it's `nginx:alpine` with `EXPOSE 80`.
- **Fix:** Used `proxy_pass http://ai-writer-frontend:80` instead of `:3000`.
- **Files modified:** docker/nginx/nginx.conf
- **Commit:** e956bb5

## Known Stubs

None. All files are complete configuration with no placeholder data flowing to runtime behavior except `app.alwrity.com` domain name which is explicitly documented as "placeholder domain — replace before deploy" in the nginx.conf comment.

## Threat Flags

None. These are configuration files only. No new network endpoints, auth paths, or schema changes were introduced beyond what the plan specifies. The nginx config properly validates SSL certs via Let's Encrypt and the Redis config uses noeviction (not a security boundary).

## Self-Check: PASSED

- docker/postgres/init.sql: EXISTS
- docker/postgres/init.sh: EXISTS (executable)
- docker/redis/redis.conf: EXISTS
- docker/nginx/nginx.conf: EXISTS
- docker/nginx/Dockerfile: EXISTS
- commit 9b363bc: EXISTS
- commit f6b00c8: EXISTS
- commit e956bb5: EXISTS
- docker build tevero-nginx:test: PASSED (exit 0)
