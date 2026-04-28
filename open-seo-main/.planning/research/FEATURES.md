# Feature Landscape: Self-Hosted Production Infrastructure

**Domain:** Self-hosted VPS deployment — Node.js SaaS SEO platform
**Researched:** 2026-04-17
**Overall confidence:** HIGH (all major claims verified against official docs or multiple current sources)

---

## 1. Production Node.js Server (TanStack Start)

### Table Stakes

**Process restart on crash**
Docker Compose `restart: unless-stopped` (or `always`) is the correct mechanism when running in Docker — not PM2. Inside a container, Docker IS the process supervisor. PM2 adds overhead and complexity for no benefit when Docker handles restarts. The pattern `pm2-runtime` inside Docker exists but is generally unnecessary for a single-process Node.js app.

**Graceful shutdown on SIGTERM/SIGINT**
Nitro (TanStack Start's server build layer) has built-in graceful shutdown. It listens on signals specified by `NITRO_SHUTDOWN_SIGNALS` (defaults to `'SIGINT SIGTERM'`) and waits up to 30 seconds before forcing `process.exit()`. No manual signal handling is needed in `server.ts` for basic shutdown. The server entry produced is `.output/server/index.mjs`, started with `node .output/server/index.mjs`.

**Health check endpoint — `/health`**
Nitro does NOT provide a built-in health check route. You must add one. The correct approach is a Nitro server route: create `server/routes/health.ts` that returns `{ status: 'ok' }` with HTTP 200. This file is auto-discovered by Nitro's routing system without any additional configuration. For deeper checks (DB + Redis reachability), return 503 with `{ status: 'unhealthy', checks: {...} }` so Docker and Nginx can distinguish liveness from readiness.

**Structured JSON logging**
Log to stdout in JSON. Use `pino` — it is the fastest Node.js logger, JSON-first, and Docker/Kubernetes-native (logs to stdout, platform collects them). Child loggers per component cost nothing at runtime and make filtering free in any aggregator. Never write to files in containers (ephemeral storage). The TanStack Start `server.ts` middleware chain is the right place to install a request logger.

**Environment variables from `process.env`**
The Cloudflare Worker model reads from `env.*` bindings, not `process.env`. The migration to Node requires switching to `process.env` / dotenv. The existing `src/server/lib/runtime-env.ts` abstraction is the correct place to centralize this — extend it to validate required vars at startup (fail fast with a clear error, not a silent undefined).

### Nice-to-Have

**`node_cluster` Nitro preset** — Uses Node.js cluster module to fork across CPU cores. Only useful if the TanStack Start app itself is CPU-bound (it's mostly I/O: SSR + DB queries). With Lighthouse jobs offloaded to BullMQ workers, the main app server is I/O-bound; `node_server` (single process) is sufficient for a VPS with modest traffic.

**PM2 ecosystem file** — Useful if you ever run the app outside Docker (e.g., bare-metal deploy). Not needed inside Docker Compose.

---

## 2. BullMQ Worker Operational Features

### Table Stakes

**Sandboxed processors for Lighthouse audits**
This is non-negotiable for CPU-bound jobs. BullMQ's default concurrency model runs jobs in the same Node.js event loop. When a job blocks the loop (e.g., running Lighthouse, which is CPU + puppeteer + page load), BullMQ cannot send lock-renewal heartbeats to Redis, causing the job to be marked "stalled" and retried — potentially running the same audit twice. Solution: define the Lighthouse processor in a separate file and pass its path to `new Worker(queue, './processors/lighthouse.js')`. BullMQ then spawns it as a child process (or worker thread via `useWorkerThreads: true` in v3.13+). Default stall threshold is 30 seconds; Lighthouse audits can exceed this easily.

**`lockDuration` tuning**
Set `lockDuration` to a value longer than your longest expected job. If a Lighthouse audit reliably completes in under 2 minutes, set `lockDuration: 120000` (ms). The default is too short for Lighthouse. This is set on the `Worker` constructor options.

**`maxStalledCount` safety net**
Default is 1: after one stall event, the job is failed permanently. For audits where transient failures are expected, consider setting `maxStalledCount: 2` so one stall doesn't discard the job, but don't set it high or you'll run audits repeatedly on genuine OOM crashes.

**Dead Letter Queue (DLQ) pattern**
BullMQ has no built-in DLQ, but the pattern is simple: in the Worker's `'failed'` event listener, if `job.attemptsMade >= job.opts.attempts`, move the job to a dedicated `failed-audits` queue for inspection. This prevents permanently-failed jobs from disappearing silently. The `failed-audits` queue can be monitored separately via Bull Board.

**Explicit job retention**
By default BullMQ removes completed/failed jobs immediately. Set `removeOnComplete: { count: 500 }` and `removeOnFail: { count: 200 }` so the last N jobs are visible in Bull Board without accumulating unbounded memory in Redis.

### Nice-to-Have

**Bull Board dashboard**
`@bull-board/express` (or `@bull-board/hono` if TanStack Start's server uses Hono internally) mounts a UI at a configurable path (e.g., `/admin/queues`). It shows queue depth, active/waiting/failed/completed counts, and allows manual retry of failed jobs. Mount it behind IP allowlist or basic auth — it has no built-in auth. The `@bull-board/h3` adapter is also available since Nitro uses H3 internally; check TanStack Start's Nitro version to pick the right adapter.

**Worker concurrency tuning**
For sandboxed workers, each `concurrency: N` spawns N child processes. On a single VPS with limited CPU, start at `concurrency: 2` for Lighthouse (each audit is already CPU-heavy). Monitor memory under load before increasing.

**`@bull-board/api` + `BullMQAdapter`** — Required packages; see npm `@bull-board/express` README for mounting pattern.

---

## 3. PostgreSQL Production in Docker

### Table Stakes

**`pg_isready` health check in Docker Compose**
The canonical health check for PostgreSQL in Docker Compose is:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```
Downstream services (open-seo app, AI-Writer) should have `depends_on: postgres: condition: service_healthy` so they do not start until PostgreSQL is ready. This replaces `wait-for-it.sh` scripts entirely.

**Named Docker volume (not bind mount) for data**
Use a named volume (`postgres_data:/var/lib/postgresql/data`) for the PostgreSQL data directory. Bind mounts to host paths introduce permission issues and are not portable across environments.

**Connection pooling — app-level via `pg` pool, NOT pgBouncer at this scale**
pgBouncer is the right choice at scale, but adds an extra container, configuration, and failure point. For a single VPS with two apps and modest traffic, configure the Drizzle/`pg` client's built-in connection pool (`max: 10` per app is safe). PostgreSQL's default `max_connections` is 100; two apps each with pool size 10 leaves plenty of headroom. Add pgBouncer when pool saturation appears in monitoring.

**Automated backup via `pg_dump` + cron**
Run a daily `pg_dump` cron job on the host (not inside the container) that pipes output through gzip and writes to a host directory with rotation:
```
0 2 * * * docker exec postgres pg_dump -U app open_seo | gzip > /backups/open_seo-$(date +\%F).sql.gz && find /backups -name "open_seo-*.sql.gz" -mtime +7 -delete
```
Retention: 7 daily backups minimum. Test restores periodically — an untested backup is not a backup.

**`POSTGRES_INITDB_ARGS` and separate databases**
The PROJECT.md decision to keep `open_seo` and `alwrity` as separate databases in one PostgreSQL container is sound. Use `docker-entrypoint-initdb.d/` init scripts to create both databases on first startup.

### Nice-to-Have

**pgBouncer sidecar** — Add when connection counts become the bottleneck. Transaction mode is appropriate for Drizzle ORM (which does not use advisory locks or server-side prepared statements in ways that break transaction pooling). Use `edoburu/pgbouncer` Docker image.

**WAL archiving / point-in-time recovery** — Needed for RPO < 24 hours. Out of scope for initial VPS launch; add in a later operational phase.

**Separate backup volume** — Keep backup files on a separate mounted volume (or push to S3/R2) so a disk failure on the main volume doesn't also lose backups.

---

## 4. Redis Production in Docker

### Table Stakes

**Persistence: RDB only (or disabled) for KV cache use case**
The project uses Redis exclusively as a KV cache with TTL semantics (30-min audit progress, BullMQ job storage). This use case does NOT need AOF persistence:
- AOF overhead (I/O, larger files) is not justified when all data is either BullMQ job metadata (reconstructable) or TTL audit progress (expendable).
- RDB snapshots every 60 seconds (`save 60 1000`) provide a lightweight backstop without the I/O penalty of AOF `everysec`.
- If you can tolerate losing in-progress audit state on a Redis crash (re-triggering the audit), disable persistence entirely with `save ""` — this gives the best performance.

Recommended config: `save 60 1000` (RDB) with AOF disabled. BullMQ jobs will be lost on crash but can be re-queued; audit progress TTL data is inherently short-lived.

**`maxmemory-policy: volatile-lru`**
Since all keys set by the application have TTLs (BullMQ keys, audit progress KV), `volatile-lru` is the correct eviction policy. This evicts the least-recently-used keys that have an expiry set, preserving any keys without TTLs (none in this case, but it is still safer than `allkeys-lru`). Set an explicit `maxmemory` limit (e.g., `maxmemory 512mb`) to prevent Redis from consuming all available VPS RAM.

**`requirepass` authentication**
Set `requirepass <strong-password>` in redis.conf and configure the `REDIS_URL` secret accordingly (`redis://:password@redis:6379`). Redis on a Docker internal network is not publicly exposed, but defense-in-depth is cheap here.

**Named Docker volume for data**
Even if persistence is minimal, use a named volume (`redis_data:/data`) so RDB snapshots persist across container recreations.

**Health check**
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 3
```
Redis ships with `redis-cli` in the same image, so no extra tooling is needed.

### Nice-to-Have

**AOF `appendfsync everysec`** — Appropriate if BullMQ job data (e.g., scheduled audits) must survive a Redis crash without re-queuing. At most 1 second of data loss. Adds I/O; enable if job durability becomes important.

**Separate Redis instance for BullMQ vs KV cache** — BullMQ and ioredis KV share the same Redis instance here. This is fine at low scale. Separate instances allow independent eviction policies (no-eviction for BullMQ, volatile-lru for KV) but add operational complexity.

**`maxmemory-policy: noeviction` for BullMQ queue** — BullMQ documentation recommends `noeviction` for the queue Redis instance so jobs are never silently dropped. Only relevant if running separate Redis instances.

---

## 5. Nginx Configuration for Two Apps

### Table Stakes

**Virtual host routing — two `server` blocks**
Open-seo (port 3001) and AI-Writer (port 3000 frontend + 8000 backend) require separate `server` blocks with `server_name` matching each domain/subdomain. Both proxy to Docker internal hostnames via `proxy_pass`.

**SSL termination with Certbot + Let's Encrypt auto-renewal**
The existing AI-Writer Nginx + Certbot setup is the template. The Certbot container runs `certbot renew --webroot` in a loop (every 12 hours), checking 30 days before expiry. Certificates are stored in a shared volume (`certbot_data`); Nginx reads from it. This is the standard `nginx` + `certbot/certbot` Docker Compose pattern. Let's Encrypt certs expire every 90 days; the 12-hour check loop gives ample renewal margin.

**Essential proxy headers**
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```
Without `X-Forwarded-Proto`, the Node.js app cannot distinguish HTTP from HTTPS, which breaks `better-auth` session cookies (they use `Secure` flag detection) and any redirect logic.

**gzip compression**
```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml application/json application/javascript text/javascript;
```
`gzip_proxied any` is critical for reverse proxy setups — without it, Nginx will not compress responses from upstream servers. JSON API responses (SEO audit payloads) compress significantly.

**WebSocket support — needed for TanStack Start**
TanStack Start uses Vite's HMR WebSocket in development, but in production the concern is SSR streaming and any potential WebSocket connections from the app. Nitro/H3 does not require WebSocket by default in `node_server` preset. Add the WebSocket upgrade headers preemptively:
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
# In location block:
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_read_timeout 3600s;
```
Without `proxy_http_version 1.1`, WebSocket upgrade headers are stripped. `proxy_read_timeout` must exceed 60s to prevent Nginx from killing long-lived SSE or WebSocket connections.

**HTTP → HTTPS redirect**
```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```
Required; without it HTTP requests are silently served unencrypted.

### Nice-to-Have

**`proxy_cache`** — Nginx response caching for static assets or SSR responses. Not needed initially; TanStack Start can handle its own caching at the app layer.

**Rate limiting via `limit_req_zone`** — Nginx-level rate limiting per IP. Useful for the audit trigger endpoints. Implement in a later operational hardening phase.

**`client_max_body_size`** — Increase if audit uploads or AI-Writer API payloads exceed the 1MB default. Depends on the apps' actual request sizes.

---

## 6. Observability Minimums

### Table Stakes

**Structured JSON logs to stdout (all services)**
Every container must write structured JSON logs to stdout. Docker captures these via its logging driver (`json-file` by default). For the Node.js app, use `pino` with default JSON output. For Nginx, configure `log_format` with JSON and write to `/dev/stdout`. Log aggregation (shipping logs to a centralized store) is a nice-to-have, but stdout-first is the foundation that makes everything else possible without app changes.

**Log levels: at minimum ERROR and WARN in production**
Do not log DEBUG in production — it creates noise and can expose sensitive data. Pino's level is set via env: `LOG_LEVEL=info`. Use `logger.error({ err }, 'audit failed')` to include stack traces in structured form. Never use `console.log` in production server code.

**Docker Compose `healthcheck` for every service**
Already covered per-service above, but reiterate: all four services (postgres, redis, open-seo, nginx) should have `healthcheck` definitions so `docker ps` and `docker compose ps` show actual readiness, not just "running". This is the cheapest possible monitoring for a self-hosted VPS.

**Crash alerting via Uptime monitoring**
Set up a free external uptime monitor (Better Uptime free tier, UptimeRobot, or similar) pinging the `/health` endpoint of each app every 60 seconds. This costs nothing and sends email/Slack alert within 5 minutes of a crash. For a VPS with no on-call infrastructure, this is the minimum viable incident detection.

**`docker compose logs -f --tail 100`-friendly log format**
In the absence of a log aggregator, the operator will read logs directly from Docker. Structured JSON is machine-readable but hard to read at a terminal. Install `pino-pretty` as a dev dependency and document the tail command: `docker compose logs -f open-seo | pino-pretty`. Do not use pretty-print in production (it is slow and not parseable); use it only via pipe in the terminal.

### Nice-to-Have

**Prometheus + Grafana stack** — `prom-client` in Node.js exposes `/metrics`; Grafana dashboards show request latency, error rate, BullMQ queue depth over time. Adds 3 containers and significant setup. Best deferred to a second operational milestone after the core migration is stable.

**Loki log aggregation** — Ships container logs to Grafana Loki for full-text search across all services. Requires a Promtail agent per host. High value for debugging intermittent issues; deferred alongside Prometheus.

**OpenTelemetry tracing** — Distributed traces through Nginx → Node → BullMQ worker → PostgreSQL. Requires an OTEL collector container. Powerful for diagnosing slow audits. Deferred until Prometheus/Loki is in place.

**`node --max-old-space-size=512` memory cap** — Set explicitly in the Docker CMD to prevent the Node.js process from consuming all VPS RAM during large Lighthouse audit batches. The Nitro entry point is `node .output/server/index.mjs`; prefix with the flag as needed.

**BullMQ queue depth metric** — Export queue depth (waiting + active job counts) as a Prometheus gauge. Critical for detecting audit backlog buildup before it affects user-facing response times. Implement when adding Prometheus.

---

## Feature Dependency Map

```
Docker Compose healthchecks
  └── postgres pg_isready → app depends_on service_healthy
  └── redis redis-cli ping → app depends_on service_healthy

Node.js server starts
  └── Nitro SIGTERM handler (built-in, no action needed)
  └── /health route (must add via server/routes/health.ts)
  └── pino logger (install + wire to request middleware)
  └── process.env validation at startup (extend runtime-env.ts)

BullMQ worker
  └── Sandboxed processor file (required for Lighthouse)
  └── lockDuration > max job duration
  └── DLQ: Worker 'failed' event → failed-audits queue
  └── Bull Board mount at /admin/queues (behind auth)

Nginx
  └── SSL via Certbot (existing pattern from AI-Writer)
  └── proxy headers (X-Forwarded-Proto critical for auth)
  └── WebSocket upgrade headers (preemptive)
  └── gzip (gzip_proxied any)

Redis
  └── maxmemory + volatile-lru policy (required)
  └── requirepass (required)
  └── RDB persistence save 60 1000 (or disabled)
```

---

## Anti-Features (Explicitly Avoid)

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| PM2 inside Docker container | Docker restart policy covers process supervision; PM2 adds complexity and doubles process management | Use `restart: unless-stopped` in Docker Compose |
| pgBouncer at launch | Adds a container and failure point before connection saturation is observed | Use `pg` pool `max: 10` per app; add pgBouncer when metrics show pool exhaustion |
| AOF persistence for KV cache Redis | TTL-based ephemeral data does not benefit from write-ahead logging; adds I/O overhead | RDB `save 60 1000` or disabled |
| BullMQ `concurrency > 2` for Lighthouse without profiling | Lighthouse runs Chrome; each instance uses 200-400MB RAM. On a 2GB VPS, 3 concurrent audits can OOM | Start at `concurrency: 2`, monitor memory under load |
| Console.log in production Node.js code | Synchronous, unstructured, no log levels, cannot be filtered | Use `pino` with child loggers |
| Nginx bind mount to host certs path without volume coordination | Cert renewal writes new files; Nginx must reload to pick them up | Use Certbot container with shared named volume + Nginx `reload` cron or signal |

---

## Sources

- [TanStack Start Hosting Guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) — Node.js deployment pattern, `node .output/server/index.mjs`
- [TanStack Start Server Entry Point](https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point) — Custom middleware and server route hooks
- [Nitro Node.js Runtime Docs](https://nitro.build/deploy/runtimes/node) — SIGTERM handling via `NITRO_SHUTDOWN_SIGNALS`, 30s shutdown timeout
- [BullMQ Concurrency](https://docs.bullmq.io/guide/workers/concurrency) — Local concurrency only for async; sandboxed required for CPU-bound
- [BullMQ Sandboxed Processors](https://docs.bullmq.io/guide/workers/sandboxed-processors) — Prevents stalled jobs from CPU blocking event loop
- [BullMQ Stalled Jobs](https://docs.bullmq.io/guide/jobs/stalled) — Default stall check 30s, `maxStalledCount` default 1
- [Bull Board GitHub](https://github.com/felixmosh/bull-board) — Express, H3, Hono adapters; route mounting pattern
- [Redis Persistence Docs](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) — RDB vs AOF trade-offs; caching use case recommendation
- [Redis Key Eviction Docs](https://redis.io/docs/latest/develop/reference/eviction/) — `volatile-lru` semantics and `maxmemory` behavior
- [pgBouncer Docker Hub (edoburu)](https://hub.docker.com/r/edoburu/pgbouncer/) — Docker Compose integration pattern
- [Nginx WebSocket Proxying](https://nginx.org/en/docs/http/websocket.html) — `Upgrade` header and `proxy_http_version 1.1` requirements
- [Docker Compose Startup Order](https://docs.docker.com/compose/how-tos/startup-order/) — `depends_on: condition: service_healthy` pattern
- [Pino Production Logging Guide (Better Stack)](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/) — JSON stdout, child loggers, production configuration
