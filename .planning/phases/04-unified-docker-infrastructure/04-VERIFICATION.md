---
phase: 04-unified-docker-infrastructure
verified: 2026-04-17T18:02:33Z
status: human_needed
score: 10/12 must-haves verified
human_verification:
  - test: "Full stack smoke test: docker compose -f docker-compose.vps.yml --env-file .env.vps up -d brings all 7 services to healthy state"
    expected: "docker compose ps shows all 7 services with Health=healthy within 3 minutes. curl http://localhost:3001/healthz (from within open-seo container) returns {\"status\":\"ok\"}. docker exec postgres psql -U postgres -c '\\l' lists both open_seo and alwrity databases."
    why_human: "Requires a Docker-capable machine with filled .env.vps secrets and either real or self-signed Let's Encrypt certs pre-loaded in the letsencrypt_conf volume. nginx will fail to start without SSL cert files at /etc/letsencrypt/live/app.openseo.so/fullchain.pem and /etc/letsencrypt/live/app.alwrity.com/fullchain.pem. Cannot verify locally without this setup."
  - test: "curl https://app.openseo.so/healthz returns { status: 'ok' }"
    expected: "HTTP 200, JSON body {\"status\":\"ok\"}, Content-Type: application/json"
    why_human: "Requires DNS resolution for app.openseo.so pointing to the VPS IP and a valid Let's Encrypt certificate. Cannot verify without live deployment."
  - test: "curl https://<ai-writer-domain>/api/health returns 200"
    expected: "HTTP 200 response from AI-Writer backend /health endpoint via the nginx /api/health alias"
    why_human: "Requires live VPS deployment with DNS, valid SSL cert, and a running AI-Writer backend service."
  - test: "init.sql idempotency: running against an already-initialized postgres volume does not fail"
    expected: "Postgres initdb only runs init.sql once (on empty volume). However, the plan noted init.sql does not use IF NOT EXISTS on CREATE ROLE or CREATE DATABASE — re-running manually will produce errors. This is expected behavior for the initdb pattern but warrants human confirmation the one-shot semantics are understood and acceptable."
    why_human: "The CREATE ROLE and CREATE DATABASE statements in init.sql lack IF NOT EXISTS guards, which means the script is not re-runnable. For the postgres:16-alpine initdb mechanism this is fine (runs only once on empty volume), but a human should confirm there is no operational scenario where this could be a problem."
---

# Phase 4: Unified Docker Infrastructure Verification Report

**Phase Goal:** Both platforms run on a single VPS behind one nginx, sharing PostgreSQL and Redis, with a single `docker compose up` command.
**Verified:** 2026-04-17T18:02:33Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `docker compose -f docker-compose.vps.yml config` validates without errors | VERIFIED | `docker compose config` exits 0 (confirmed by executing against actual file with .env.vps.example) |
| 2 | docker-compose.vps.yml contains exactly 7 services | VERIFIED | grep confirms: postgres, redis, open-seo, open-seo-worker, ai-writer-backend, ai-writer-frontend, nginx |
| 3 | All 7 services have a `healthcheck:` block | VERIFIED | `grep -c 'healthcheck:' docker-compose.vps.yml` returns 7 |
| 4 | open-seo and open-seo-worker have `condition: service_healthy` on postgres and redis | VERIFIED | Both services declare `condition: service_healthy` for postgres and redis depends_on (lines 69, 71, 94, 96) |
| 5 | postgres and redis have no `ports:` mapping | VERIFIED | Both services have no ports key; comment confirms intentional internal-only posture |
| 6 | nginx has `ports: ["80:80", "443:443"]` | VERIFIED | nginx service has exactly these two port bindings; no other host port mappings |
| 7 | docker/postgres/init.sql creates both `open_seo` and `alwrity` databases | VERIFIED | File contains `CREATE DATABASE open_seo OWNER open_seo_user` and `CREATE DATABASE alwrity OWNER alwrity_user` |
| 8 | docker/redis/redis.conf contains `maxmemory 512mb`, `maxmemory-policy noeviction`, `save 60 1000` | VERIFIED | All three directives present as exact lines |
| 9 | docker/nginx/nginx.conf routes `app.openseo.so` to open-seo and AI-Writer domain to ai-writer-frontend | VERIFIED | `proxy_pass http://open-seo:3001` and `proxy_pass http://ai-writer-frontend:80` both present; server_name app.openseo.so confirmed |
| 10 | open-seo-main/Dockerfile.vps is multi-stage (builder + runtime), CMD is exec-form | VERIFIED | `FROM node:22-alpine AS builder` and `FROM node:22-alpine AS runtime` present; `CMD ["node", ".output/server/index.mjs"]` is JSON array exec-form |
| 11 | open-seo-main/src/routes/healthz.ts returns `{ status: "ok" }` at GET /healthz | VERIFIED | File exists at correct path, contains `createFileRoute("/healthz")` and `JSON.stringify({ status: "ok" })`, registered in routeTree.gen.ts |
| 12 | DOCKER-01 through DOCKER-07 all covered by at least one plan | VERIFIED | 04-01 covers DOCKER-07; 04-02 covers DOCKER-01; 04-03 covers DOCKER-03, DOCKER-04, DOCKER-05; 04-04 covers DOCKER-02, DOCKER-03, DOCKER-04, DOCKER-05, DOCKER-06 |

**Score:** 12/12 truths verified in automated checks

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docker-compose.vps.yml` | Unified 7-service orchestration | VERIFIED | Exists at TeveroSEO root; contains all 7 services; `docker compose config` exits 0 |
| `.env.vps.example` | Template listing required env vars | VERIFIED | Lists POSTGRES_PASSWORD, OPEN_SEO_DB_PASSWORD, ALWRITY_DB_PASSWORD, BETTER_AUTH_SECRET, BETTER_AUTH_URL, REACT_APP_CLERK_PUBLISHABLE_KEY and others |
| `docker/postgres/init.sql` | Creates both databases + roles | VERIFIED | `CREATE DATABASE open_seo` and `CREATE DATABASE alwrity` present; pgcrypto extension enabled in both |
| `docker/postgres/init.sh` | Password injection companion | VERIFIED | Executable script using `:?` syntax for OPEN_SEO_DB_PASSWORD and ALWRITY_DB_PASSWORD |
| `docker/redis/redis.conf` | BullMQ-compatible Redis config | VERIFIED | maxmemory 512mb, maxmemory-policy noeviction, save 60 1000, appendonly no — all present as exact lines |
| `docker/nginx/nginx.conf` | Multi-domain SSL reverse proxy | VERIFIED | Routes app.openseo.so → open-seo:3001, app.alwrity.com → ai-writer-frontend:80 + /api/ → ai-writer-backend:8000; /api/health alias; /nginx-health on port 8080 |
| `docker/nginx/Dockerfile` | nginx:1.27-alpine with curl + 8080 | VERIFIED | FROM nginx:1.27-alpine; apk add curl; EXPOSE 80 443 8080 |
| `open-seo-main/Dockerfile.vps` | Multi-stage node:22-alpine build | VERIFIED | Two stages (builder/runtime); exec-form CMD; tini entrypoint; USER nodejs; esbuild step for worker-entry.mjs |
| `open-seo-main/.dockerignore` | Build context exclusions | VERIFIED | node_modules, .output, .git, .env* all present |
| `open-seo-main/src/routes/healthz.ts` | Container healthcheck endpoint | VERIFIED | createFileRoute("/healthz"); GET returns { status: "ok" } with 200 + application/json; registered in routeTree.gen.ts |
| `open-seo-main/src/worker-entry.ts` | Dedicated BullMQ worker entry | VERIFIED | Imports startAuditWorker/stopAuditWorker; registers SIGTERM/SIGINT handlers; no HTTP server start |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| open-seo service | postgres/redis healthchecks | `condition: service_healthy` | WIRED | Both depends_on entries use condition: service_healthy |
| open-seo-worker service | same Dockerfile.vps image | `image: teveroseo/open-seo:latest` + `command: ["node", ".output/worker-entry.mjs"]` | WIRED | Reuses built image; command override confirmed |
| nginx service | open-seo + ai-writer services | depends_on all three with service_healthy | WIRED | depends_on open-seo, ai-writer-frontend, ai-writer-backend all condition: service_healthy |
| postgres service | docker/postgres/init.sql + init.sh | `./docker/postgres:/docker-entrypoint-initdb.d:ro` | WIRED | bind mount present in compose volumes section |
| redis service | docker/redis/redis.conf | `./docker/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro` + command override | WIRED | Both mount and `command: ["redis-server", "/usr/local/etc/redis/redis.conf"]` present |
| docker/nginx/nginx.conf | open-seo:3001 | `proxy_pass http://open-seo:3001` | WIRED | Line 65 confirmed |
| docker/nginx/nginx.conf | ai-writer-frontend:80 | `proxy_pass http://ai-writer-frontend:80` | WIRED | Line 124 confirmed; correct port (not 3000) |
| docker/nginx/nginx.conf | ai-writer-backend:8000 | `proxy_pass http://ai-writer-backend:8000` + `/api/health` alias | WIRED | Lines 105 and 114 confirmed |
| Dockerfile.vps builder | worker-entry.mjs | `pnpm exec esbuild src/worker-entry.ts --outfile=.output/worker-entry.mjs --packages=external` | WIRED | esbuild step present in builder stage after pnpm run build |

---

### Data-Flow Trace (Level 4)

Not applicable. Phase 4 produces infrastructure configuration artifacts only — no components that render dynamic data from a backend. All artifacts are Docker, nginx, postgres, and Redis configuration files.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| docker-compose.vps.yml YAML syntax valid | `docker compose -f docker-compose.vps.yml --env-file .env.vps.example config` | exit 0 | PASS |
| healthz route registered in TanStack router | `grep -q "healthz" open-seo-main/src/routeTree.gen.ts` | found at line 14, 51, 52, 179, 204 | PASS |
| redis.conf has all 3 required directives | `grep -q '^maxmemory 512mb$'` + `noeviction` + `save 60 1000` | all found as exact lines | PASS |
| nginx.conf routes correct upstream ports | `grep 'proxy_pass http://ai-writer-frontend:80'` | found line 124 (not port 3000) | PASS |
| .gitignore excludes .env.vps | `grep '\.env\.vps' .gitignore` | found at line 4 | PASS |
| Full stack smoke test (all 7 services healthy) | `docker compose up -d` + wait + `docker compose ps` | Requires live VPS with SSL certs | SKIP |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOCKER-01 | 04-02 | Dockerfile.vps multi-stage build; exec-form CMD | SATISFIED | Dockerfile.vps: FROM node:22-alpine AS builder/runtime; CMD ["node", ".output/server/index.mjs"] exec-form |
| DOCKER-02 | 04-04 | Root docker-compose.vps.yml with exactly 7 services | SATISFIED | docker-compose.vps.yml contains all 7 named services |
| DOCKER-03 | 04-03, 04-04 | Shared postgres runs both open_seo and alwrity databases | SATISFIED | init.sql creates both databases; compose mounts ./docker/postgres at /docker-entrypoint-initdb.d |
| DOCKER-04 | 04-03, 04-04 | Redis configured with maxmemory 512mb, noeviction, save 60 1000 | SATISFIED | redis.conf contains all three directives as exact lines |
| DOCKER-05 | 04-03, 04-04 | nginx routes both domains with SSL | SATISFIED | nginx.conf has server blocks for app.openseo.so and app.alwrity.com with SSL termination |
| DOCKER-06 | 04-04 | All services have healthcheck; open-seo + worker depend on postgres/redis healthy | SATISFIED | 7 healthcheck blocks total; open-seo and open-seo-worker both have condition: service_healthy on postgres and redis |
| DOCKER-07 | 04-01 | GET /healthz returns { status: "ok" } from open-seo | SATISFIED | open-seo-main/src/routes/healthz.ts implements this exactly; registered in routeTree.gen.ts |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `docker/postgres/init.sql` | 6, 11 | `CREATE ROLE` without `IF NOT EXISTS` | Info | Script is not re-runnable. However, postgres:16-alpine only executes /docker-entrypoint-initdb.d files ONCE on empty volume — this is by design and documented in postgres image. Not a blocker for the intended use pattern, but if someone ever needs to manually re-run the script they will get errors. |
| `docker/nginx/nginx.conf` | comment L76 | `# ===== AI-Writer (placeholder domain — replace before deploy) =====` | Info | app.alwrity.com is documented as a placeholder domain. This is expected — final domain will be substituted before actual deployment. Documented intentionally. |

No blockers found. The info-level items are design decisions documented in comments, not code quality issues.

---

### Human Verification Required

#### 1. Full stack healthy startup

**Test:** Copy `.env.vps.example` to `.env.vps`, fill in real secrets (POSTGRES_PASSWORD, OPEN_SEO_DB_PASSWORD, ALWRITY_DB_PASSWORD, BETTER_AUTH_SECRET), generate self-signed Let's Encrypt placeholder certs per the Task 3 script in 04-04-PLAN.md, then run `docker compose -f docker-compose.vps.yml --env-file .env.vps up -d`. Wait up to 3 minutes and run `docker compose -f docker-compose.vps.yml ps`.

**Expected:** All 7 services show Health=healthy or State=running. No service restart loops.

**Why human:** nginx requires SSL cert files at `/etc/letsencrypt/live/app.openseo.so/fullchain.pem` and `/etc/letsencrypt/live/app.alwrity.com/fullchain.pem` to start. These cannot exist without a volume pre-seeded with real or self-signed certificates. Cannot verify in a purely local/static check.

#### 2. ROADMAP SC #2: /healthz reachable end-to-end

**Test:** From a running stack, run `docker compose -f docker-compose.vps.yml exec open-seo wget -qO- http://localhost:3001/healthz`.

**Expected:** `{"status":"ok"}` printed to stdout.

**Why human:** Requires a running container. The route exists and is registered (verified statically), but end-to-end HTTP response requires a live container.

#### 3. ROADMAP SC #3: AI-Writer /api/health via nginx

**Test:** From a running stack, run `docker compose -f docker-compose.vps.yml exec nginx curl -fsSk https://app.alwrity.com/api/health -H 'Host: app.alwrity.com' --resolve app.alwrity.com:443:127.0.0.1`.

**Expected:** HTTP 200 (content from AI-Writer backend /health endpoint).

**Why human:** Requires live AI-Writer backend container, SSL certs, and nginx running. The nginx /api/health alias is verified in the config statically, but runtime execution is needed.

#### 4. init.sql one-shot semantics confirmation

**Test:** Run `docker compose -f docker-compose.vps.yml exec postgres psql -U postgres -c '\l'` after initial stack startup.

**Expected:** Both `open_seo` and `alwrity` databases listed, owned by their respective roles.

**Why human:** Confirms the init.sql ran correctly during postgres container initialization. While the script is verified to contain the correct statements, runtime execution confirms the postgres initdb mechanism picked up both files (init.sql + init.sh) in the correct alphabetical order.

---

### Gaps Summary

No blocking gaps identified. All 12 must-have verifiable truths pass automated checks. The 4 items flagged for human verification are lifecycle checks that require a running stack — they cannot be verified by static analysis.

The one notable design note: `docker/postgres/init.sql` uses bare `CREATE ROLE` and `CREATE DATABASE` without `IF NOT EXISTS` guards. This matches the plan's intent (postgres initdb only runs these files once on an empty volume), but is not re-runnable. This is an info-level observation, not a gap.

---

_Verified: 2026-04-17T18:02:33Z_
_Verifier: Claude (gsd-verifier)_
