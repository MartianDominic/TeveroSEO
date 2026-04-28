# Technology Stack: CF Workers → Node.js Migration

**Project:** open-seo-main
**Researched:** 2026-04-17
**Overall confidence:** HIGH — all findings verified against installed packages, official docs, and official Nitro examples

---

## Migration Package Changes

### Add (production deps)

| Package | Version | Replaces | Purpose |
|---------|---------|---------|---------|
| `nitro` | `3.0.x-beta` | `@cloudflare/vite-plugin` | Nitro v3 vite plugin (Node.js build) |
| `@tanstack/nitro-v2-vite-plugin` | `1.154.9` | `@cloudflare/vite-plugin` | **Recommended stable alternative** — wraps nitropack v2 |
| `pg` | `8.20.0` | `@libsql/client` / D1 binding | PostgreSQL driver (node-postgres) |
| `drizzle-orm` | `^0.44.4` (already installed) | — | Already installed; only dialect changes |
| `bullmq` | `5.74.1` | `cloudflare:workers` Workflows | Job queue, replaces `WorkflowEntrypoint` |
| `ioredis` | `5.10.1` | `env.KV` | Redis client for KV replacement |

### Add (dev deps)

| Package | Purpose |
|---------|---------|
| `@types/pg` | TypeScript types for node-postgres |

### Remove

| Package | Reason |
|---------|--------|
| `@cloudflare/vite-plugin` | CF-specific; replaced by nitro plugin |
| `@cloudflare/workers-types` | No longer targeting CF runtime |
| `@libsql/client` | Was D1 local dev driver; PostgreSQL replaces this |
| `wrangler` | No longer deploying to CF Workers |

---

## 1. TanStack Start: Node.js Adapter

**Confidence: HIGH** — Verified against installed package source (`@tanstack/start-plugin-core@1.167.17`), Nitro official SSR example, and `node.school` deployment guide.

### The key finding

The existing `src/server.ts` is already correct and does not need to change. The only changes are in `vite.config.ts`: remove `@cloudflare/vite-plugin` and add a Nitro plugin.

### Two plugin options (both work)

**Option A — `@tanstack/nitro-v2-vite-plugin` (RECOMMENDED for stability)**

Uses Nitro v2 (stable `nitropack@^2.13.1`). Confirmed working for `node-server` preset. The `nitro` package (v3) is still beta as of April 2026.

```bash
pnpm add -D @tanstack/nitro-v2-vite-plugin
```

**Option B — `nitro/vite` (Nitro v3 alpha)**

The `nitro` package (v3 beta) exports a `nitro()` Vite plugin. The official Nitro SSR example uses `nitro()` with no preset argument and the default is `node-server`. This is what the `dev.to/ameistad` Haloy guide uses with `nitro()` and no config. Still marked as alpha/beta — may have rough edges.

```bash
pnpm add -D nitro
```

### vite.config.ts changes

Remove the `cloudflare()` import and plugin. Add the Nitro plugin. The rest is unchanged.

```typescript
// BEFORE
import { cloudflare } from "@cloudflare/vite-plugin";

plugins: [
  cloudflare({ viteEnvironment: { name: "ssr" } }),
  tanstackStart(),
  viteReact(),
  tailwindcss(),
]

// AFTER (using @tanstack/nitro-v2-vite-plugin — recommended)
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";

plugins: [
  tanstackStart(),
  viteReact(),
  tailwindcss(),
  nitroV2Plugin({ preset: "node-server" }),
]

// AFTER (using nitro/vite — if v3 has stabilised)
import { nitro } from "nitro/vite";

plugins: [
  tanstackStart(),
  viteReact(),
  tailwindcss(),
  nitro({ preset: "node-server" }),
]
```

The Nitro plugin also requires declaring the server entry in `vite.config.ts` environments. The Nitro SSR example shows this pattern:

```typescript
export default defineConfig({
  plugins: [ /* as above */ ],
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          input: "./src/server.ts",   // points to existing server.ts
        },
      },
    },
  },
});
```

### src/server.ts — what changes

The existing file:

```typescript
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
const fetch = createStartHandler(defaultStreamHandler);
export { SiteAuditWorkflow } from "./server/workflows/SiteAuditWorkflow";
export default { fetch };
```

Must become Nitro-compatible. The Nitro SSR example uses `@tanstack/react-start/server-entry`:

```typescript
// src/server.ts — Node.js / Nitro target
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
  fetch(request: Request) {
    return handler.fetch(request);
  },
});
```

The `SiteAuditWorkflow` export is removed here — BullMQ workers are started separately as a long-running process, not exported from the server entry.

### Build output and run command

After `vite build`, Nitro emits `.output/server/index.mjs`.

```json
{
  "scripts": {
    "build": "vite build && tsc --noEmit",
    "start": "node .output/server/index.mjs"
  }
}
```

The existing `Dockerfile.selfhost` currently runs `vite preview` which is **not suitable for production SSR** (confirmed broken for SSR in multiple community reports). It must be replaced with `node .output/server/index.mjs`.

---

## 2. Drizzle ORM: SQLite → PostgreSQL Migration

**Confidence: HIGH** — Verified against drizzle-orm v0.44.x docs and column-types reference.

### Package changes

```bash
pnpm add pg
pnpm add -D @types/pg
pnpm remove @libsql/client   # was only used for local D1 dev
```

`drizzle-orm` is already installed at `^0.44.4`. No version change needed.

### db/index.ts

```typescript
// BEFORE
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";
export const db = drizzle(env.DB, { schema });

// AFTER
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});
export const db = drizzle({ client: pool, schema });
```

### Schema column-type mapping (exhaustive)

Every SQLite import from `drizzle-orm/sqlite-core` maps to a pg-core equivalent. The import statement changes from:

```typescript
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
```

to:

```typescript
import { pgTable, text, integer, real, boolean, timestamp, uniqueIndex, index, doublePrecision } from "drizzle-orm/pg-core";
```

**Column mapping table:**

| SQLite | PostgreSQL | Notes |
|--------|-----------|-------|
| `sqliteTable(...)` | `pgTable(...)` | Direct rename |
| `text("col")` | `text("col")` | Identical |
| `integer("col")` | `integer("col")` | Identical |
| `real("col")` | `real("col")` | Identical (4-byte float) |
| `integer("col", { mode: "boolean" })` | `boolean("col")` | PG has native boolean |
| `integer("col", { mode: "timestamp_ms" })` | `timestamp("col", { mode: "date" })` | See timestamp section |
| `integer("col").primaryKey({ autoIncrement: true })` | `integer("col").primaryKey().generatedAlwaysAsIdentity()` | PG SERIAL alternative |
| `text("col", { enum: [...] })` | `text("col")` + app-level enum OR `pgEnum(...)` | See enum section |

### Timestamp columns — critical difference

The `better-auth-schema.ts` uses `integer("col", { mode: "timestamp_ms" })` extensively with `sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`` as default. None of this works on PostgreSQL.

**Replace every `integer("col", { mode: "timestamp_ms" })` with:**

```typescript
// SQLite (existing)
createdAt: integer("created_at", { mode: "timestamp_ms" })
  .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
  .notNull(),

// PostgreSQL (replacement)
createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
  .defaultNow()
  .notNull(),
```

**For `updatedAt` with `$onUpdate`:**

```typescript
// PostgreSQL
updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date()),
```

**For nullable timestamps (e.g., `completedAt`):**

```typescript
// SQLite (existing)
completedAt: text("completed_at"),   // stored as text string

// PostgreSQL (replacement)
completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
```

**For `text`-stored timestamps in app.schema.ts** (e.g., `createdAt: text("created_at").default(sql\`(current_timestamp)\`)`):

```typescript
// PostgreSQL
createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
  .defaultNow()
  .notNull(),
```

### Enum columns

SQLite uses `text("col", { enum: ["a", "b"] })`. PostgreSQL supports this two ways:

```typescript
// Option 1: Keep as text with app validation (simpler, recommended for migration)
status: text("status").notNull().default("running"),

// Option 2: Native pgEnum (stricter, requires migration for each change)
const auditStatusEnum = pgEnum("audit_status", ["running", "completed", "failed"]);
status: auditStatusEnum("status").notNull().default("running"),
```

For this migration, Option 1 (keep as `text`) is recommended — zero schema churn.

### drizzle.config.ts replacement

Delete both `drizzle.config.ts` and `drizzle-prod.config.ts`. Replace with a single config:

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Regenerating migrations

The existing `drizzle/` folder contains SQLite SQL files. They must not be applied to PostgreSQL.

```bash
# 1. Delete all old SQLite migrations
rm -rf drizzle/

# 2. Generate fresh PostgreSQL migrations
DATABASE_URL=postgres://... pnpm drizzle-kit generate

# 3. Apply to PostgreSQL
DATABASE_URL=postgres://... pnpm drizzle-kit migrate
```

### better-auth adapter change

`src/lib/auth.ts` uses `drizzleAdapter(db, { provider: "sqlite" })`. Change to:

```typescript
database: drizzleAdapter(db, {
  provider: "pg",
}),
```

---

## 3. BullMQ: Replacing Cloudflare Workflows

**Confidence: HIGH** — Verified against official BullMQ docs (process-step-jobs, going-to-production, connections).

### Installation

```bash
pnpm add bullmq ioredis
```

BullMQ requires Redis 6+. The `ioredis` package is BullMQ's required connection client.

### Connection pattern

```typescript
// src/server/lib/queue/connection.ts
import IORedis from "ioredis";

// Use for Queue (can use default maxRetriesPerRequest)
export const queueConnection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,   // fail fast for enqueue operations
});

// Use for Worker (MUST have maxRetriesPerRequest: null)
export const workerConnection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,  // required by BullMQ workers
  enableOfflineQueue: true,
});
```

### Queue definition

```typescript
// src/server/lib/queue/audit-queue.ts
import { Queue } from "bullmq";
import { queueConnection } from "./connection";

export interface AuditJobData {
  auditId: string;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  startUrl: string;
  config: AuditConfig;
}

export const auditQueue = new Queue<AuditJobData>("site-audit", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 1,          // audit jobs are long-running; retry at step level, not job level
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
```

### Replacing `env.SITE_AUDIT_WORKFLOW.create()` in AuditService.ts

```typescript
// BEFORE
await env.SITE_AUDIT_WORKFLOW.create({
  id: auditId,
  params: { auditId, billingCustomer, projectId, startUrl, config },
});

// AFTER
await auditQueue.add("run-audit", {
  auditId,
  billingCustomer,
  projectId,
  startUrl,
  config,
}, {
  jobId: auditId,   // deterministic ID, mirrors CF Workflow instance ID
});
```

### Replacing `env.SITE_AUDIT_WORKFLOW.get(id).terminate()` in AuditService.ts

```typescript
// BEFORE
const instance = await env.SITE_AUDIT_WORKFLOW.get(audit.workflowInstanceId);
await instance.terminate();

// AFTER
const job = await auditQueue.getJob(audit.workflowInstanceId);
if (job) {
  await job.remove();                // remove from queue if waiting
  // Note: cannot kill an actively-running Worker mid-execution
  // Set a "cancelled" flag in DB and check it inside the worker at step boundaries
}
```

### Step-by-step worker: replacing `step.do()`

The CF Workflows `step.do("name", fn)` pattern maps to BullMQ's **Process Step Jobs** pattern. The critical mechanism: persist the current step in `job.data` after each step completes. On retry, resume from the saved step.

```typescript
// src/server/workers/audit-worker.ts
import { Worker, UnrecoverableError } from "bullmq";
import { workerConnection } from "../lib/queue/connection";
import type { AuditJobData } from "../lib/queue/audit-queue";

enum AuditStep {
  Idle = "idle",
  DiscoverUrls = "discover-urls",
  Crawl = "crawl",
  Lighthouse = "lighthouse",
  Finalize = "finalize",
  Done = "done",
}

export const auditWorker = new Worker<AuditJobData & { step: AuditStep }>(
  "site-audit",
  async (job) => {
    let step = job.data.step ?? AuditStep.Idle;

    // Discovery phase
    if (step === AuditStep.Idle || step === AuditStep.DiscoverUrls) {
      const discovery = await discoverUrls(job.data.startUrl, job.data.config.maxPages);
      await job.updateData({ ...job.data, step: AuditStep.Crawl, sitemapUrls: discovery.urls });
      step = AuditStep.Crawl;
    }

    // Crawl phase
    if (step === AuditStep.Crawl) {
      const pages = await runCrawlPhase(job.data);
      await job.updateData({ ...job.data, step: AuditStep.Lighthouse, pages });
      step = AuditStep.Lighthouse;
    }

    // Lighthouse phase
    if (step === AuditStep.Lighthouse) {
      const lhResults = await runLighthousePhase(job.data);
      await job.updateData({ ...job.data, step: AuditStep.Finalize, lighthouseResults: lhResults });
      step = AuditStep.Finalize;
    }

    // Finalize
    if (step === AuditStep.Finalize) {
      await finalizeAudit(job.data);
      await job.updateData({ ...job.data, step: AuditStep.Done });
    }
  },
  {
    connection: workerConnection,
    concurrency: 2,    // run at most 2 audits simultaneously
  },
);

// Required error handler to prevent unhandled promise rejections
auditWorker.on("failed", (job, err) => {
  console.error(`Audit job ${job?.id} failed:`, err);
});
```

### Step-level retry semantics vs CF Workflows

| CF Workflows | BullMQ equivalent |
|---|---|
| `step.do("name", fn)` — durably checkpoints | `job.updateData(...)` before advancing step |
| Automatic step retry on failure | Configure `attempts` + `backoff` on the job; worker resumes from last saved step |
| Named steps visible in dashboard | Steps are enum values stored in `job.data.step` |
| `step.do` retries the specific step | On retry, the `if (step === X)` guard re-runs only the incomplete step |

For **per-step retry config** (closest to CF's per-step retry):

```typescript
await auditQueue.add("run-audit", data, {
  jobId: auditId,
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 2000,    // 2s, 4s, 8s, 16s, 32s
  },
});
```

For steps that should **never retry** (e.g., a step that writes idempotently but is expensive):

```typescript
// Inside the worker processor, throw UnrecoverableError to skip remaining attempts
throw new UnrecoverableError("Finalization data integrity check failed");
```

### Worker startup

The worker must run as a long-lived process. It cannot be imported by the HTTP server — it must be a separate process started alongside the server:

```bash
# Start both server and worker
node .output/server/index.mjs &
node -r tsx/register src/server/workers/audit-worker.ts
```

Or via a separate Docker service (see Dockerfile section).

### Graceful shutdown

```typescript
process.on("SIGTERM", async () => {
  await auditWorker.close();   // waits for current job to finish
  process.exit(0);
});
process.on("SIGINT", async () => {
  await auditWorker.close();
  process.exit(0);
});
```

---

## 4. ioredis: Replacing Cloudflare KV

**Confidence: HIGH** — `progress-kv.ts` fully analyzed; ioredis API is well-established.

### Installation

```bash
pnpm add ioredis    # included in BullMQ section above
```

### Redis client for KV operations

BullMQ already creates Redis connections. Create a **separate** ioredis instance for KV operations to avoid cross-contaminating BullMQ's connection management:

```typescript
// src/server/lib/redis.ts
import IORedis from "ioredis";

export const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});
```

### progress-kv.ts full rewrite

The file uses three KV operations: `get(key, "text")`, `put(key, value, { expirationTtl })`, `delete(key)`. The ioredis equivalents:

```typescript
// BEFORE: env.KV.get(k, "text")
// AFTER:
const value = await redis.get(k);   // returns string | null

// BEFORE: env.KV.put(k, JSON.stringify(merged), { expirationTtl: TTL_SECONDS })
// AFTER: SET key value EX ttl_seconds
await redis.set(k, JSON.stringify(merged), "EX", TTL_SECONDS);

// BEFORE: env.KV.delete(key)
// AFTER:
await redis.del(key);
```

Full rewritten `progress-kv.ts`:

```typescript
// src/server/lib/audit/progress-kv.ts
import { redis } from "@/server/lib/redis";   // new singleton
import { z } from "zod";
import { jsonCodec } from "@/shared/json";

const KV_PREFIX = "audit-progress:";
const TTL_SECONDS = 30 * 60;
const MAX_ENTRIES = 300;

// ... (crawledUrlEntrySchema, parseCrawledEntries unchanged)

async function pushCrawledUrls(auditId: string, nextEntries: CrawledUrlEntry[]): Promise<void> {
  if (nextEntries.length === 0) return;
  const k = key(auditId);
  const existing = await redis.get(k);          // replaces env.KV.get(k, "text")
  const entries = parseCrawledEntries(existing);
  const merged = [...nextEntries, ...entries].slice(0, MAX_ENTRIES);
  await redis.set(k, JSON.stringify(merged), "EX", TTL_SECONDS);   // replaces env.KV.put(...)
}

async function getCrawledUrls(auditId: string): Promise<CrawledUrlEntry[]> {
  const data = await redis.get(key(auditId));   // replaces env.KV.get(key, "text")
  return parseCrawledEntries(data);
}

async function clear(auditId: string): Promise<void> {
  await redis.del(key(auditId));                // replaces env.KV.delete(key)
}
```

### CF KV → ioredis API mapping (complete)

| CF KV operation | ioredis equivalent |
|---|---|
| `env.KV.get(key, "text")` | `await redis.get(key)` → `string \| null` |
| `env.KV.get(key, "json")` | `JSON.parse(await redis.get(key) ?? "null")` |
| `env.KV.put(key, value, { expirationTtl: N })` | `await redis.set(key, value, "EX", N)` |
| `env.KV.put(key, value)` (no TTL) | `await redis.set(key, value)` |
| `env.KV.delete(key)` | `await redis.del(key)` |

Note: CF KV's minimum `expirationTtl` is 60 seconds. Redis has no minimum. The existing 30-minute TTL (`1800`) is well above any limit.

---

## 5. Docker: Production Dockerfile

**Confidence: HIGH** — Multi-stage Node.js 22 pattern; existing Dockerfile.selfhost analyzed.

The existing `Dockerfile.selfhost` has two problems:
1. Runs `vite preview` — not SSR-compatible.
2. Runs wrangler D1 migrations before build — wrong for PostgreSQL.

Replace with a multi-stage build:

```dockerfile
# ---- build stage ----
FROM node:22-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build produces .output/server/index.mjs via Nitro
RUN pnpm run build

# ---- runtime stage ----
FROM node:22-slim AS runtime

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable

# Copy only production deps + built output
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/.output ./.output

EXPOSE 3001

# Migrations are applied as a separate init container or docker-compose command,
# not inside the app startup — prevents failed migrations from crashing the server.
CMD ["node", ".output/server/index.mjs"]
```

### docker-compose service entry (for reference)

```yaml
open-seo:
  build:
    context: ./open-seo-main
    dockerfile: Dockerfile
  environment:
    PORT: 3001
    DATABASE_URL: postgres://openseo:password@postgres:5432/open_seo
    REDIS_URL: redis://redis:6379
    NODE_ENV: production
  ports:
    - "3001:3001"
  depends_on:
    - postgres
    - redis
  restart: unless-stopped
```

### Migrations as a separate step

```yaml
# In docker-compose, run migrations before starting the app service
open-seo-migrate:
  build: ./open-seo-main
  command: pnpm drizzle-kit migrate
  environment:
    DATABASE_URL: postgres://openseo:password@postgres:5432/open_seo
  depends_on:
    - postgres
```

---

## 6. `cloudflare:workers` import removal — all locations

**Confidence: HIGH** — All usages audited from grep.

Every `import { env } from "cloudflare:workers"` must be replaced with `process.env` access. The existing `runtime-env.ts` already has the right abstraction (`loadWorkersEnv` falls back gracefully). Extend it:

| File | CF binding used | Replacement |
|------|----------------|-------------|
| `src/db/index.ts` | `env.DB` | `process.env.DATABASE_URL` via `drizzle(node-postgres)` |
| `src/lib/auth.ts` | `env.BETTER_AUTH_URL`, `env.BETTER_AUTH_SECRET` | `process.env.BETTER_AUTH_URL`, `process.env.BETTER_AUTH_SECRET` |
| `src/server/lib/audit/progress-kv.ts` | `env.KV` | ioredis `redis` singleton |
| `src/server/features/audit/services/AuditService.ts` | `env.SITE_AUDIT_WORKFLOW` | BullMQ `auditQueue` |
| `src/server/workflows/SiteAuditWorkflow.ts` | `WorkflowEntrypoint` from `cloudflare:workers` | Delete file; replace with BullMQ worker |

---

## Sources

- TanStack Start Hosting docs: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- Nitro SSR + TanStack Start example: https://nitro.build/examples/vite-ssr-tss-react
- `node.school` — no .output directory fix: https://node.school/blog/tanstack-start-no-output-directory/
- `@tanstack/nitro-v2-vite-plugin` on npm: https://www.npmjs.com/package/@tanstack/nitro-v2-vite-plugin
- Deploy TanStack Start + PostgreSQL guide: https://dev.to/ameistad/deploy-tanstack-start-postgresql-to-your-own-server-with-haloy-5cda
- Drizzle PG column types: https://orm.drizzle.team/docs/column-types/pg
- Drizzle PG get-started: https://orm.drizzle.team/docs/get-started/postgresql-new
- Drizzle Kit generate: https://orm.drizzle.team/docs/drizzle-kit-generate
- BullMQ Process Step Jobs: https://docs.bullmq.io/patterns/process-step-jobs
- BullMQ Connections: https://docs.bullmq.io/guide/connections
- BullMQ Going to production: https://docs.bullmq.io/guide/going-to-production
- BullMQ Retrying Failing Jobs: https://docs.bullmq.io/guide/retrying-failing-jobs
