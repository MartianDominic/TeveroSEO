# Domain Pitfalls: CF Workers → Self-Hosted Node.js Migration

**Domain:** Cloudflare Workers to VPS Node.js (TanStack Start + Drizzle + BullMQ)
**Researched:** 2026-04-17
**Confidence:** MEDIUM-HIGH (most claims verified against official docs or issue trackers)

---

## 1. TanStack Start: Node.js Adapter Migration

### CRITICAL — `cloudflare:workers` imports leak into the client bundle

**What goes wrong:** Middleware files that import from `"cloudflare:workers"` at the module top level cause Rollup to fail the production build with `"Rollup failed to resolve import 'cloudflare:workers'"`. This occurs even when the import is only consumed inside `.server()` blocks. The CF-adapter Vite plugin previously masked this by externalising the module; without it the client bundler sees the bare import and dies.

**Why it happens:** TanStack Start's build pipeline analyses the full module graph of middleware at build time. Top-level imports are evaluated before tree-shaking can prune server-only paths. The issue was introduced or worsened in `@tanstack/react-start` ≥ 1.141 (tracked in [issue #6185](https://github.com/TanStack/router/issues/6185)).

**Warning signs:**
- Build error: `"Cannot find module 'cloudflare:workers'"` or Rollup unresolved import error
- Error originates from `src/middleware/` or `src/server/` files
- Build succeeds in dev (Vite dev server ignores it) but fails in `vite build`

**Prevention:**
1. Before switching the adapter, grep for all `cloudflare:workers` imports: `grep -r "cloudflare:workers" src/`
2. Replace every top-level `import { env } from "cloudflare:workers"` with `process.env` access before touching the adapter config
3. Remove `@cloudflare/vite-plugin` and `wrangler.jsonc` from `vite.config.ts`
4. Do NOT attempt to add `cloudflare:workers` to Vite's `external` list as a workaround — it causes secondary breakage with Node.js stream exports

**Phase affected:** Phase 1 (cf-bindings removal) — must be complete before any Node.js adapter build is attempted.

---

### CRITICAL — `env` object pattern does not exist in Node.js runtime

**What goes wrong:** All code that calls `env.DB`, `env.KV`, `env.SITE_AUDIT_WORKFLOW`, `env.R2` passes the CF Worker `env` argument around. In Node.js there is no equivalent — the `env` object is the CF request handler's second argument and simply does not exist. Any file that imports or expects this object will throw at runtime with `TypeError: Cannot read properties of undefined`.

**Why it happens:** CF Workers use a module export pattern: `export default { fetch(request, env, ctx) }`. The Node.js adapter replaces this with a standard HTTP server; there is no `env` argument. The `src/server/lib/runtime-env.ts` abstraction partially shields this but any code that bypasses it and reaches for `env.*` directly will fail silently until a request exercises that code path.

**Warning signs:**
- `TypeError: env is undefined` at request time (not at startup)
- Works fine in `wrangler dev` but crashes on first DB/KV/Queue call in Node.js
- Auth middleware or loaders that formerly called `getContext("cloudflare").env`

**Prevention:**
1. Centralise all env access in `src/server/lib/runtime-env.ts` — have it read from `process.env` only
2. Delete the CF Worker module export (`export default { fetch, SiteAuditWorkflow }`) from `src/server.ts` and replace with TanStack Start's `createServerEntry`
3. Grep for `getContext("cloudflare")` — every occurrence must be replaced
4. Search for `env\.DB`, `env\.KV`, `env\.R2`, `env\.SITE_AUDIT_WORKFLOW` across `src/` before claiming cleanup is done

**Phase affected:** Phase 1 (cf-bindings removal) and Phase 2 (server entry migration).

---

### MODERATE — `VITE_` prefix requirement for client-side env vars

**What goes wrong:** CF Workers made all `wrangler.toml` vars available to server-side code via the `env` argument. In TanStack Start + Node.js, the boundary is: `VITE_*` vars are baked into the client bundle at build time; all others are server-only `process.env`. Any var that was previously accessed on both client and server via the CF `env` object will be invisible on the client unless renamed with the `VITE_` prefix.

**Warning signs:**
- Client-side code reading a config value gets `undefined` in production but worked in `wrangler dev`
- `import.meta.env.SOME_VAR` returns undefined

**Prevention:** Audit which env vars are read on the client. Only public, non-secret values belong there. Apply `VITE_` prefix and update references. Never put secrets behind `VITE_*`.

**Phase affected:** Phase 2 (Node.js adapter config).

---

### MODERATE — Hydration mismatch when server function context is different

**What goes wrong:** TanStack Start's SSR pipeline runs server functions to produce the initial HTML. If a server function's behaviour changes subtly between the CF Workers runtime and Node.js (e.g., different date formatting, different JSON serialisation of special values), the client-side rehydration will mismatch and trigger React's hydration error, silently replacing server HTML with client-rendered content or throwing console errors.

**Warning signs:**
- React console warning: `"Hydration failed because the server rendered HTML didn't match the client"`
- Page content flickers on load
- Occurs only after adapter switch, not in wrangler dev

**Prevention:** Run a visual diff of the SSR HTML output before and after the migration. Pay special attention to date/time formatting — CF Workers defaults UTC; ensure `TZ=UTC` in the Docker container.

**Phase affected:** Phase 2 and Phase 4 (QA/testing).

---

## 2. Drizzle ORM: SQLite → PostgreSQL Schema Migration

### CRITICAL — Old SQLite migration folder journal confuses `drizzle-kit generate`

**What goes wrong:** `drizzle-kit generate` reads the snapshot stored in `drizzle/meta/_journal.json` to compute the diff to the current schema. When you change `dialect` from `"sqlite"` to `"postgresql"` in `drizzle.config.ts`, the tool detects that the existing journal was produced by a different dialect. If the folder is not cleared first, the generator may produce nonsensical migrations, silently skip columns, or fail with `"relation already exists"` on the first `drizzle-kit migrate` run.

**Warning signs:**
- `drizzle-kit generate` produces a migration that attempts to create already-present tables
- Migration run fails with `ERROR: relation "users" already exists`
- `drizzle-kit generate` exits with no changes on a schema you clearly changed

**Prevention:**
1. Delete the entire `drizzle/` migrations folder before running `drizzle-kit generate` for the first time against PostgreSQL
2. The first PG migration will be a full `CREATE TABLE` snapshot — this is correct and expected
3. Apply it to a fresh PG database (do not try to apply it to a database that already has the tables from a manual `drizzle-kit push`)
4. If `drizzle-kit push` was used for quick testing, drop and recreate the database before doing the migration-based workflow

**Phase affected:** Phase 1 (schema migration).

---

### CRITICAL — `text` timestamps do not migrate to `timestamp` automatically

**What goes wrong:** D1/SQLite Drizzle schemas commonly use `text("created_at")` with a default of `sql\`(current_timestamp)\`` because SQLite has no native timestamp type. When you copy this pattern to a PostgreSQL schema (even inadvertently, or via `drizzle-kit pull`), the column type stays as `TEXT` in PG. Drizzle will not complain. Your TypeScript types will be `string | null`. But any code that tried to use `new Date(row.createdAt)` may receive strings formatted as `"YYYY-MM-DD HH:MM:SS"` (SQLite format) rather than ISO 8601, causing silent downstream formatting bugs.

In PostgreSQL, the correct type is `timestamp("created_at", { withTimezone: true }).defaultNow()`. The PG `mode: "string"` returns timestamps in `"YYYY-MM-DD HH:MM:SS.ssssss+00"` format, NOT ISO 8601 — so even after switching, comparison/parsing code written for CF Workflows' ISO strings will break unless you use `mode: "date"` or explicitly convert.

**Warning signs:**
- TypeScript type of a date column is `string` instead of `Date`
- Dates look correct in the DB but parsed JavaScript `Date` objects are off by hours
- Audit timestamps appear in SQLite `"YYYY-MM-DD HH:MM:SS"` format in API responses after PG migration

**Prevention:**
1. Grep for `text(` in schema files; any column named `*_at`, `*_date`, `*_time` should become `timestamp({ withTimezone: true })`
2. Use `mode: "date"` on all timestamp columns to get JavaScript `Date` objects back automatically
3. Write a one-off data migration script that casts the old text data to the new timestamp type: `ALTER TABLE foo ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz`
4. Set `TZ=UTC` in Docker to ensure consistent timezone behaviour

**Phase affected:** Phase 1 (schema migration).

---

### CRITICAL — `autoIncrement` → `serial` vs `integer().generatedAlwaysAsIdentity()`

**What goes wrong:** SQLite's `integer().primaryKey({ autoIncrement: true })` maps to `INTEGER PRIMARY KEY AUTOINCREMENT`. Drizzle's PG equivalent is either `serial("id").primaryKey()` or (preferred) `integer("id").primaryKey().generatedAlwaysAsIdentity()`. If you mistakenly use `integer().primaryKey()` without any sequence declaration, the column will be a plain integer PK with no auto-increment. Inserts that omit the `id` column will fail with `NOT NULL constraint` or produce duplicate keys.

`serial` works but is deprecated in favour of identity columns in PostgreSQL 10+. Using `serial` also creates a hidden sequence that Drizzle migrations don't manage explicitly, which can cause schema drift.

**Warning signs:**
- Insert without explicit `id` throws `ERROR: null value in column "id" violates not-null constraint`
- `drizzle-kit generate` emits a warning about `serial` deprecation
- Sequence counters jump unexpectedly after table restores

**Prevention:** Use `integer("id").primaryKey().generatedAlwaysAsIdentity()` for all new PK columns. Grep for `autoIncrement: true` in existing schema files and replace every occurrence.

**Phase affected:** Phase 1 (schema migration).

---

### MODERATE — JSON stored as SQLite `text` vs PostgreSQL `jsonb`

**What goes wrong:** SQLite has no JSON type; Drizzle schemas often use `text("metadata")` and manually `JSON.stringify` / `JSON.parse`. In PG, the idiomatic type is `jsonb("metadata")`. If the column type is left as `text` in PG, the data is stored and retrieved as a JSON string — your application code must manually parse it. If someone queries the column with PG JSON operators (`->`, `->>`), those will fail on a `text` column.

**Warning signs:**
- Application receives a stringified JSON value where an object is expected: `'{"key":"value"}'` instead of `{ key: "value" }`
- PG operator error: `operator does not exist: text -> unknown`

**Prevention:** Change `text("metadata")` to `jsonb("metadata").$type<YourType>()`. Remove manual `JSON.stringify` calls in the application layer — Drizzle's `jsonb` column handles serialisation automatically.

**Phase affected:** Phase 1 (schema migration).

---

### MODERATE — `drizzle-kit migrate` vs `drizzle-kit push` confusion in Docker

**What goes wrong:** `drizzle-kit push` directly syncs the schema to the database without creating migration files. It is convenient for development but dangerous in production because it can silently drop columns to match the schema. In a Docker-based production flow, running `push` during container startup will destroy data if the schema definition has columns removed or renamed.

**Warning signs:**
- Data disappears after a container restart
- `drizzle-kit push` logs show `ALTER TABLE ... DROP COLUMN`

**Prevention:**
- `push` is for local dev only — never in Docker production entrypoints
- Use `drizzle-kit generate` + `drizzle-kit migrate` (or programmatic `migrate()`) for production
- Add a check: if `NODE_ENV=production` and `drizzle-kit push` is in the startup command, that is a bug

**Phase affected:** Phase 3 (Docker build and deploy).

---

## 3. BullMQ: Queue and Worker Setup

### CRITICAL — Worker Redis connection must use `maxRetriesPerRequest: null`

**What goes wrong:** When you pass an ioredis instance to a BullMQ `Worker` without setting `maxRetriesPerRequest: null`, BullMQ throws an exception immediately on instantiation: `"WRONGTYPE Operation against a key holding the wrong kind of value"` or `"maxRetriesPerRequest must be null for blocking connection"`. Workers use Redis blocking commands (`BLPOP`-style operations); if the client retries with finite attempts, it breaks the blocking loop on every Redis hiccup.

**Warning signs:**
- BullMQ throws on worker instantiation, not on job processing
- Worker appears to start but never picks up jobs
- Redis reconnection causes the worker to stop processing permanently (tracked in [issue #2964](https://github.com/taskforcesh/bullmq/issues/2964))

**Prevention:**
```ts
// Correct: separate connections for Queue (fast-fail) and Worker (persistent)
const queueConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: 20 });
const workerConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableOfflineQueue: true });
const queue = new Queue("site-audit", { connection: queueConnection });
const worker = new Worker("site-audit", processor, { connection: workerConnection });
```
Never share a single ioredis connection between a `Queue` and a `Worker`.

**Phase affected:** Phase 2 (BullMQ implementation).

---

### CRITICAL — Redis must be configured with `maxmemory-policy noeviction`

**What goes wrong:** By default, many Redis configurations set `maxmemory-policy allkeys-lru` or similar eviction policies. BullMQ stores job metadata and queue state in Redis keys. If Redis evicts a job's key under memory pressure, BullMQ will silently lose that job — no error, no retry, it simply vanishes. This is especially insidious because it only manifests under load.

**Warning signs:**
- Jobs disappear without appearing in the `failed` set
- Queue length drops unexpectedly with no corresponding worker activity
- `redis-cli INFO keyspace` shows frequent evictions

**Prevention:** Add to Redis config (`redis.conf` or Docker command):
```
maxmemory-policy noeviction
```
Also enable AOF persistence to survive Redis restarts without job loss:
```
appendonly yes
appendfsync everysec
```

**Phase affected:** Phase 3 (Docker Compose setup).

---

### CRITICAL — Job data must be fully JSON-serialisable

**What goes wrong:** BullMQ serialises job data to Redis using `JSON.stringify`. If job data contains `undefined` values, `Date` objects, `Buffer`, circular references, class instances, or functions, the serialisation silently drops or corrupts those fields. A job added with `{ userId: 1, startedAt: new Date() }` will arrive in the worker with `startedAt` as an ISO string, not a `Date`. Fields set to `undefined` will be missing entirely.

**Warning signs:**
- Job processor receives different data shape than what was enqueued
- Dates arrive as strings; `instanceof Date` is false
- Optional fields that were `undefined` are missing (not `null`)

**Prevention:**
- Pass only plain serialisable data: strings, numbers, booleans, plain objects, arrays
- Convert `Date` to ISO string before enqueuing: `new Date().toISOString()`
- Validate job data shape with a Zod schema at the processor entry point
- Never pass DB entity objects or request objects as job data

**Phase affected:** Phase 2 (BullMQ implementation).

---

### CRITICAL — Long-running jobs will be marked stalled if they block the event loop

**What goes wrong:** BullMQ's stalled detection checks every 30 seconds (default `stalledInterval`) whether active workers have sent a heartbeat. If a job's processor performs synchronous CPU-intensive work (e.g., parsing a large HTML document synchronously) for more than ~30 seconds without yielding, the worker's internal heartbeat timer never fires, the job is marked stalled, and re-enqueued. The same job gets picked up again, starting a retry loop.

For the site audit workflow which involves crawling many URLs, individual job steps that process large payloads are at risk.

**Warning signs:**
- Jobs appear to run multiple times (duplicate audit results)
- BullMQ `stalled` event fires for jobs that are still technically processing
- Completed job count is lower than added job count

**Prevention:**
- Break large CPU work into smaller async steps, yielding between them (`await setImmediate()`)
- Use sandboxed processors (separate Node.js child processes) for CPU-heavy steps
- Increase `stalledInterval` only if you understand the implication (longer time to detect actually crashed workers)
- Set `maxStalledCount: 1` (default) — jobs that stall more than once fail permanently rather than retrying indefinitely

**Phase affected:** Phase 2 (BullMQ workflow design).

---

### MODERATE — Graceful shutdown: `worker.close()` has no built-in timeout

**What goes wrong:** `await worker.close()` waits indefinitely for active jobs to finish. If a job is stuck (network call that never resolves, infinite loop), the Node.js process will hang forever after receiving SIGTERM. Docker's default SIGKILL grace period is 10 seconds (`stop_grace_period`); after that, Docker sends SIGKILL, causing the job to be marked stalled rather than failed.

**Warning signs:**
- `docker compose down` hangs for 10 seconds then forcefully kills the container
- Jobs appear in the `stalled` set after every deployment

**Prevention:**
```ts
process.on('SIGTERM', async () => {
  const timeout = setTimeout(() => {
    console.error('Worker shutdown timed out — forcing exit');
    process.exit(1);
  }, 25_000); // slightly under Docker's stop_grace_period
  await worker.close();
  clearTimeout(timeout);
  process.exit(0);
});
```
Also set `stop_grace_period: 30s` in `docker-compose.vps.yml` for the open-seo service.

**Phase affected:** Phase 3 (Docker production config).

---

### MODERATE — Cloudflare Workflows step-level semantics differ from BullMQ

**What goes wrong:** CF Workflows provide `step.do()` which is idempotent and retried at the step level on failure — the workflow resumes from the last successful step. BullMQ has no equivalent concept natively. If you model a multi-step audit (crawl → analyse → score → store) as a single BullMQ job processor function, any failure reruns the entire job from scratch, including steps that already succeeded. This can cause duplicate writes or wasted compute.

**Prevention:**
- Model each step as a separate BullMQ job in a pipeline/flow
- Use BullMQ Flows (`FlowProducer`) to chain jobs with parent-child dependencies
- Store step-level progress in Redis (via the existing `progress-kv.ts` pattern) so a re-queued job can skip completed steps
- Do NOT attempt to replicate CF Workflows' exact step API — use BullMQ's native job chaining primitives

**Phase affected:** Phase 2 (workflow redesign).

---

## 4. `cloudflare:workers` Module Removal

### CRITICAL — Forgetting middleware files during cleanup

**What goes wrong:** The most common miss is authentication middleware. `src/middleware/authentication.ts` (or equivalent) typically imports `env` from `"cloudflare:workers"` to access the DB for session validation. This file is exercised on every authenticated request, so the failure is immediately visible — but only at runtime, not during the build if the import was already removed from direct usage.

The other common miss is anywhere `getContext("cloudflare")` is called inside TanStack router loaders, as this call returns `undefined` outside the CF runtime.

**Warning signs:**
- Every authenticated request returns 401 or 500 after migration
- Server-side loaders throw `Cannot read properties of undefined (reading 'env')`
- Log shows `getContext` returning `undefined`

**Checklist — scan these locations:**
```
src/middleware/
src/server/middleware/
src/server/lib/
src/routes/ (server functions, loaders, actions)
src/server.ts
```
Grep commands:
```bash
grep -r "cloudflare:workers" src/
grep -r "getContext.*cloudflare" src/
grep -r "env\.DB\|env\.KV\|env\.R2\|env\.SITE_AUDIT_WORKFLOW" src/
```

**Prevention:** Run all three greps and get zero results before considering this phase complete.

**Phase affected:** Phase 1 (cf-bindings removal).

---

### MODERATE — `@cloudflare/workers-types` still in tsconfig causes phantom type errors

**What goes wrong:** After removing CF bindings from application code, if `@cloudflare/workers-types` remains in `tsconfig.json`'s `types` array or `compilerOptions`, it injects CF-specific globals (`Request` extension, `KVNamespace`, `D1Database`, etc.) into the TypeScript environment. These conflict with the standard Node.js `@types/node` globals, producing confusing type errors in unrelated code.

**Warning signs:**
- TypeScript error: `Type 'Request' is not assignable to type 'Request'`
- Globals like `caches`, `fetch`, `Response` have unexpected CF-specific method signatures

**Prevention:** Remove `"@cloudflare/workers-types"` from `tsconfig.json` and `package.json` devDependencies after the migration. Replace with `@types/node`.

**Phase affected:** Phase 1 (cf-bindings removal).

---

## 5. Docker Production Pitfalls

### CRITICAL — pnpm symlinks break without `--shamefully-hoist` or explicit store config

**What goes wrong:** pnpm's default "isolated" node_modules layout uses symlinks into a content-addressed store. Inside Docker, the store lives in a different layer from `node_modules`. On some Docker BuildKit configurations, creating cross-device symlinks during `COPY --from=deps` fails with `WARN EXDEV: cross-device link not permitted`, and pnpm silently falls back to copying, massively inflating image build times. Worse: in some scenarios the symlinks in the final layer are broken, causing `MODULE_NOT_FOUND` errors at runtime.

**Warning signs:**
- Docker build takes 5+ minutes even with unchanged `pnpm-lock.yaml`
- `EXDEV: cross-device link not permitted` warnings in build output
- Node.js crashes at startup with `Cannot find module` for a package that is in `package.json`

**Prevention:**
```dockerfile
# In the deps stage, use copy import method to avoid cross-device symlink issues
RUN pnpm config set store-dir /root/.local/share/pnpm/store && \
    pnpm config set package-import-method copy && \
    pnpm install --frozen-lockfile --prod
```
Use multi-stage builds: `deps` stage installs everything, `builder` stage runs `vite build`, `runner` stage copies only `.output/` and `node_modules/`.

**Phase affected:** Phase 3 (Dockerfile).

---

### CRITICAL — `CMD ["npm", "start"]` or shell-form CMD does not forward SIGTERM

**What goes wrong:** If the Docker `CMD` uses npm, yarn, pnpm, or a shell script as the entrypoint (`CMD ["npm", "start"]`), the Node.js process becomes a child of the npm/shell process. When Docker sends SIGTERM to the container, it goes to PID 1 (npm/shell), which may not forward it to the Node.js child. Node.js never receives SIGTERM and cannot perform graceful shutdown. Docker waits 10 seconds, then sends SIGKILL — all in-flight requests and BullMQ jobs are cut off hard.

**Warning signs:**
- Container always takes exactly 10 seconds to stop (`docker compose down` pauses)
- BullMQ stalled jobs appear after every deployment
- Access logs show 502 errors during deployment windows

**Prevention:** Use exec form CMD with `node` directly:
```dockerfile
CMD ["node", ".output/server/index.mjs"]
```
If a wrapper script is needed, use `exec node ...` inside the script to replace the shell process.

**Phase affected:** Phase 3 (Dockerfile).

---

### CRITICAL — Node.js starts before Redis/Postgres are ready (startup race)

**What goes wrong:** Docker Compose's `depends_on` only waits for the container to start, not for the service inside it to be ready. The open-seo Node.js container will start and attempt to connect to Redis and PostgreSQL before those services finish initialising. The Drizzle migration step will fail with `ECONNREFUSED` or `connection refused`, and BullMQ worker instantiation will fail similarly.

**Warning signs:**
- Container crashes on first startup with `ECONNREFUSED 5432` or `ECONNREFUSED 6379`
- Works after manually running `docker compose restart open-seo`
- `docker compose logs` shows the crash happens within the first 2 seconds

**Prevention:**
```yaml
# docker-compose.vps.yml
open-seo:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy

postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
    timeout: 5s
    retries: 5

redis:
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
```

**Phase affected:** Phase 3 (Docker Compose).

---

### MODERATE — Image build copies devDependencies into production layer

**What goes wrong:** Running `pnpm install` without `--prod` in the final Docker stage installs all devDependencies (TypeScript, Vite, test frameworks, etc.) into the production image. This can push the image from ~200 MB to 800+ MB, slow deployments, and increase attack surface.

**Warning signs:**
- Docker image size exceeds 500 MB for a Next.js-class app
- `docker image inspect` shows `node_modules` with TypeScript, vite, etc.

**Prevention:** Use a three-stage Dockerfile: deps (full install), builder (vite build), runner (prod deps + `.output/` only). In the runner stage: `pnpm install --frozen-lockfile --prod --offline`.

**Phase affected:** Phase 3 (Dockerfile).

---

### MODERATE — Missing `.dockerignore` sends entire repo context including secrets

**What goes wrong:** Without `.dockerignore`, the Docker build context includes `.env`, `.env.local`, `node_modules/`, `.git/`, and any secrets on disk. This bloats context transfer, accidentally bakes secrets into the image layers, and can expose them via `docker history`.

**Prevention:** Ensure `.dockerignore` includes at minimum:
```
node_modules
.git
.env
.env.*
*.log
dist
.output
```

**Phase affected:** Phase 3 (Dockerfile).

---

## 6. CI/CD SSH Deployment Pitfalls

### CRITICAL — `StrictHostKeyChecking=no` is a man-in-the-middle vulnerability

**What goes wrong:** The most common "quick fix" for SSH GitHub Actions failures is to set `StrictHostKeyChecking no` in the SSH config. This disables host key verification entirely, making it trivially easy for a malicious server to impersonate the VPS. Any deployment — including one that copies secrets or code — would silently succeed against a spoofed host.

**Warning signs:**
- SSH config contains `StrictHostKeyChecking no` or `-o StrictHostKeyChecking=no` in the workflow
- `known_hosts` parameter is empty or missing in the GitHub Action

**Prevention:** Pre-generate the known_hosts entry from your VPS:
```bash
ssh-keyscan -H YOUR_VPS_IP >> known_hosts
```
Store the output as a GitHub Actions secret (`KNOWN_HOSTS`). In the workflow:
```yaml
- name: Setup SSH
  run: |
    mkdir -p ~/.ssh
    echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_ed25519
    chmod 600 ~/.ssh/id_ed25519
    echo "${{ secrets.KNOWN_HOSTS }}" >> ~/.ssh/known_hosts
```

**Phase affected:** Phase 4 (CI/CD setup).

---

### CRITICAL — `docker compose up --build` causes a downtime window

**What goes wrong:** The naive deployment command `docker compose up --build -d` stops the old container, builds the new image, and starts the new container — in sequence. The window between old container stop and new container start (typically 15-30 seconds for a Node.js build) results in 502 errors from Nginx for all users.

**Warning signs:**
- Users report brief outages exactly when deploys happen
- Nginx logs show 502s for ~20 seconds during deploys
- `docker compose up --build` output shows `Stopping open-seo...` before build is complete

**Prevention (choose one):**

Option A — Build first, then replace:
```bash
docker compose build open-seo
docker compose up -d --no-build open-seo
```

Option B — Use `docker rollout` (recommended for single-VPS setup):
```bash
docker rollout open-seo   # scales to 2, waits for health, removes old
```
Reference: [docker-rollout](https://github.com/wowu/docker-rollout)

Option C — Blue-green with two Compose profiles and Nginx upstream swap. Only warranted for stricter SLA requirements.

**Phase affected:** Phase 4 (CI/CD setup).

---

### MODERATE — SSH deploy user needs Docker group membership, not root

**What goes wrong:** Running Docker commands as root via SSH works but is a security anti-pattern. If the deploy user is added to `sudoers` with `NOPASSWD: docker`, a compromised GitHub Actions secret gives full root access to the VPS. If the user is not in the `docker` group, all `docker compose` commands fail with `permission denied while trying to connect to Docker daemon socket`.

**Warning signs:**
- `docker compose up` fails with `permission denied /var/run/docker.sock`
- Deploy script runs as `root` (check with `whoami` in a workflow debug step)

**Prevention:**
```bash
# On VPS
sudo useradd -m deploy
sudo usermod -aG docker deploy
# Generate SSH key: ssh-keygen -t ed25519 -C "github-actions-deploy"
# Add public key to /home/deploy/.ssh/authorized_keys
```
Use the `deploy` user in the GitHub Actions SSH connection, not root.

**Phase affected:** Phase 4 (CI/CD setup).

---

### MODERATE — Deployment atomicity: migrations run before the new code serves traffic

**What goes wrong:** If the CI/CD pipeline restarts the container and the new code starts serving requests before `drizzle-kit migrate` completes, the application will query columns or tables that do not yet exist. This produces 500 errors for the duration of the migration.

**Warning signs:**
- 500 errors immediately after container start, resolving after ~5 seconds
- DB error: `column "new_column" does not exist`

**Prevention:** Enforce migration-before-traffic in the Docker entrypoint or a startup script:
```bash
#!/bin/sh
node node_modules/.bin/drizzle-kit migrate   # blocks until complete
exec node .output/server/index.mjs           # then start serving
```
Combine with the health check `depends_on` pattern above so Nginx only receives traffic after the container is healthy.

**Phase affected:** Phase 3 and Phase 4.

---

### MINOR — SSH private key permissions cause silent auth failure

**What goes wrong:** SSH keys written to disk in GitHub Actions without `chmod 600` are rejected by the SSH client with `"Permissions 0644 for 'id_ed25519' are too open"`. The workflow fails with a generic authentication error that can be mistaken for a wrong key or wrong user.

**Warning signs:**
- SSH error: `bad permissions`, `UNPROTECTED PRIVATE KEY FILE`
- Workflow fails immediately on the SSH step, not during the deployment command

**Prevention:** Always `chmod 600` immediately after writing the key:
```yaml
run: |
  echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_ed25519
  chmod 600 ~/.ssh/id_ed25519
```

**Phase affected:** Phase 4 (CI/CD setup).

---

## Phase-Specific Quick Reference

| Phase | Topic | Highest-Risk Pitfall | Mitigation |
|-------|-------|---------------------|------------|
| 1 | CF bindings removal | `cloudflare:workers` leaking into client bundle | Grep + remove before adapter switch |
| 1 | Schema migration | Old SQLite journal corrupts PG migration generation | Delete `drizzle/` folder before first PG `generate` |
| 1 | Schema migration | `text` timestamps not converted to `timestamptz` | Audit all `*_at` columns; use `timestamp({ withTimezone: true })` |
| 2 | Node.js adapter | `env` object undefined at runtime | Centralise all env access in `runtime-env.ts` |
| 2 | BullMQ | `maxRetriesPerRequest` not null on Worker | Separate ioredis connections for Queue and Worker |
| 2 | BullMQ | Redis maxmemory eviction silently deletes jobs | Set `maxmemory-policy noeviction` in Redis config |
| 3 | Docker | `CMD ["npm", "start"]` blocks SIGTERM | Use `CMD ["node", ".output/server/index.mjs"]` |
| 3 | Docker | Startup race: app starts before PG/Redis ready | Use `healthcheck` + `depends_on: condition: service_healthy` |
| 3 | Drizzle | `push` in production entrypoint destroys data | Use `migrate` in entrypoint, never `push` |
| 4 | CI/CD | `StrictHostKeyChecking=no` | Pre-generate `known_hosts` from VPS; store as secret |
| 4 | CI/CD | `docker compose up --build` causes 30s downtime | Build first separately; use `docker rollout` |
| 4 | CI/CD | Migrations run after traffic starts | Run migration in entrypoint before `exec node` |

---

## Sources

- [TanStack Start: Hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [TanStack Start: Environment variables](https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables)
- [TanStack Router issue #6185: cloudflare:workers import in middleware breaks build](https://github.com/TanStack/router/issues/6185)
- [TanStack Router issue #5208: Cannot find module cloudflare:workers](https://github.com/TanStack/router/issues/5208)
- [TanStack Router issue #3468: Cloudflare env vars not passed to SSR](https://github.com/TanStack/router/issues/3468)
- [BullMQ: Going to production](https://docs.bullmq.io/guide/going-to-production)
- [BullMQ: Graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown)
- [BullMQ: Stalled jobs](https://docs.bullmq.io/guide/jobs/stalled)
- [BullMQ: Connections](https://docs.bullmq.io/guide/connections)
- [BullMQ issue #2964: Workers not working after Redis reconnection](https://github.com/taskforcesh/bullmq/issues/2964)
- [Drizzle ORM: PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg)
- [Drizzle ORM: Timestamp default value guide](https://orm.drizzle.team/docs/guides/timestamp-default-value)
- [Drizzle ORM issue #1587: invalid timestamp conversion with PostgreSQL UTC timezone](https://github.com/drizzle-team/drizzle-orm/issues/1587)
- [Drizzle ORM issue #4462: Migration folder gets out of sync](https://github.com/drizzle-team/drizzle-team/drizzle-orm/issues/4462)
- [pnpm: Working with Docker](https://pnpm.io/docker)
- [Node.js best practices: Graceful shutdown in Docker](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/docker/graceful-shutdown.md)
- [docker-rollout: Zero-downtime Docker Compose](https://github.com/wowu/docker-rollout)
- [oneuptime: BullMQ graceful shutdown](https://oneuptime.com/blog/post/2026-01-21-bullmq-graceful-shutdown/view)
- [Cloudflare: process.env support in Workers](https://developers.cloudflare.com/changelog/post/2025-03-11-process-env-support/)
