# Phase 1: CF Bindings Removal + Schema Migration — Research

**Researched:** 2026-04-17
**Domain:** Cloudflare Workers → Node.js runtime migration; Drizzle SQLite → PostgreSQL schema
**Confidence:** HIGH — all findings verified directly from codebase files

---

## Summary

Phase 1 is a brownfield surgery on a TanStack Start app currently wired to the Cloudflare Workers runtime. The work has three parallel tracks:

1. **CF bindings removal** — 22 source files import from `cloudflare:workers`. Every import must be replaced with `process.env` access before the Nitro adapter swap, or Rollup will fail on the bare `cloudflare:workers` specifier. The most complex files are `src/lib/auth.ts` (3 direct `env.*` reads) and `src/server/lib/runtime-env.ts` (dynamic import of the CF module — must become synchronous `process.env`).

2. **Vite/server entry swap** — `vite.config.ts` must drop `cloudflare({ viteEnvironment: { name: "ssr" } })` and add `nitroV2Plugin({ preset: "node-server" })`. `src/server.ts` must drop the CF Worker module format and the `SiteAuditWorkflow` re-export; the server entry pattern changes to `createServerEntry`.

3. **Schema migration** — Both schema files use `drizzle-orm/sqlite-core`. The migration rewrites every import, table constructor, and column type. There are 10 timestamp columns in `better-auth-schema.ts` alone (all `integer({ mode: "timestamp_ms" })` with SQLite-specific defaults), 2 boolean columns in `app.schema.ts`, 2 JSON-as-text columns, and 1 autoincrement integer primary key.

**Primary recommendation:** Work in this order — (a) replace all `cloudflare:workers` imports, (b) rewrite schemas, (c) swap vite adapter, (d) verify build. Running the adapter swap before imports are clean will produce a build error immediately.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CF-01 | All `cloudflare:workers` imports removed from `src/` | 22 files identified; complete list in "Files to Change" section |
| CF-02 | `@cloudflare/vite-plugin` removed; `@tanstack/nitro-v2-vite-plugin` with `preset: "node-server"` added | Exact `vite.config.ts` diff documented below |
| CF-03 | `src/server.ts` rewritten to Node.js-compatible server entry | Exact before/after documented below |
| CF-04 | All `env.*` CF binding accesses removed; replaced with Node.js equivalents | Per-file replacement map documented below |
| CF-05 | `runtime-env.ts` centralises all `process.env` access with startup validation | Current file analysed; rewrite pattern documented |
| CF-06 | `@cloudflare/workers-types` removed from tsconfig; no TS errors | tsconfig verified — types NOT in `types[]` array; only package.json devDep removal needed |
| DB-01 | Drizzle schema migrated from `sqlite-core` to `pg-core` | Both schema files fully read; column-by-column conversion table below |
| DB-02 | All `integer({ mode: "timestamp_ms" })` → `timestamp({ withTimezone: true, mode: "date" })` | 10 occurrences identified across `better-auth-schema.ts` |
| DB-03 | All `integer({ mode: "boolean" })` → native `boolean()` | 2 occurrences in `app.schema.ts` (auditPages) |
| DB-04 | All text JSON columns → `jsonb()` | 2 clear JSON columns: `audits.config`, `keywordMetrics.monthlySearches`; 4 more `*_json` named columns |
| DB-05 | `better-auth` adapter changed from `provider: "sqlite"` to `provider: "pg"` | In `src/lib/auth.ts` line 56 |
| DB-06 | Old `drizzle/` folder deleted; fresh PG migrations regenerated | 7 existing SQLite `.sql` files must be deleted |
| DB-07 | `drizzle-kit migrate` applies PG migrations to fresh PostgreSQL | Requires `DATABASE_URL` env var; `drizzle.config.ts` must be rewritten |
| DB-08 | `src/db/index.ts` uses `drizzle/node-postgres` with `pg.Pool` | Current file is 6 lines; exact rewrite documented below |
| BUILD-01 | `pnpm run build` succeeds with no errors | Blocked until CF imports removed + schema fixed + vite adapter swapped |
| BUILD-02 | `.output/server/index.mjs` produced; starts HTTP server | Nitro `node-server` preset emits this path |
| BUILD-03 | All routes return correct responses in Node.js mode | Depends on all CF env reads replaced with `process.env` |
</phase_requirements>

---

## Complete File Change Map

### Files with `cloudflare:workers` imports (22 files, verified by grep)

| File | What It Uses | Phase 1 Action | Notes |
|------|-------------|----------------|-------|
| `src/db/index.ts` | `env.DB` | Rewrite — use `drizzle/node-postgres` + `Pool` | DB-08 |
| `src/lib/auth.ts` | `env.BETTER_AUTH_URL`, `env.BETTER_AUTH_SECRET`, `env.*` (Loops vars), `env` object via `Reflect.get` | Rewrite all to `process.env.*` | DB-05, CF-04 |
| `src/middleware/ensureUser.ts` | `env.AUTH_MODE` | Replace with `process.env.AUTH_MODE` | CF-04 |
| `src/middleware/errorHandling.ts` | `waitUntil` from `cloudflare:workers` | Remove `waitUntil`; use fire-and-forget or drop | CF-01; `waitUntil` has no Node.js equivalent — the background task must either `void` the promise or be queued |
| `src/middleware/ensure-user/cloudflareAccess.ts` | `env.TEAM_DOMAIN`, `env.POLICY_AUD` | Replace with `process.env.*` | CF-04 |
| `src/routes/api/auth/$.ts` | `env.AUTH_MODE` | Replace with `process.env.AUTH_MODE` | CF-04 |
| `src/routes/api/autumn/$.ts` | `waitUntil` | Same as `errorHandling.ts` | CF-01 |
| `src/server/email/loops.ts` | `env.*` (Loops API keys) | Replace with `process.env.*` | CF-04 |
| `src/server/features/audit/services/AuditService.ts` | `env.SITE_AUDIT_WORKFLOW` | **Phase 2 work** — for Phase 1: remove import, add stub/throw | CF-01 blocker; must have zero `cloudflare:workers` imports for BUILD-01 |
| `src/server/lib/audit/progress-kv.ts` | `env.KV` | **Phase 2 work** — for Phase 1: remove import, add stub/throw | CF-01 blocker; same approach |
| `src/server/lib/dataforseo.ts` | `env.DATAFORSEO_API_KEY` | Replace with `process.env.DATAFORSEO_API_KEY` | CF-04 |
| `src/server/lib/dataforseoClient.test.ts` | `env.*` | Replace with `process.env.*` in test | CF-01 |
| `src/server/lib/dataforseoLighthouse.ts` | `env.DATAFORSEO_API_KEY` | Replace with `process.env.*` | CF-04 |
| `src/server/lib/posthog.ts` | `env.POSTHOG_PUBLIC_KEY`, `env.POSTHOG_HOST` | Replace with `process.env.*` | CF-04 |
| `src/server/lib/r2.ts` | `env.R2` | Replace with `cloudflare` SDK HTTP calls via `process.env` credentials | R2 stays on CF HTTP API; no binding needed |
| `src/server/lib/r2-cache.ts` | `env.R2` (via `r2.ts`) | Indirect dependency; fix via `r2.ts` | CF-04 |
| `src/server/lib/runtime-env.ts` | Dynamic `import("cloudflare:workers")` | Rewrite — remove CF fallback path; sync `process.env` only | CF-05 |
| `src/server/workflows/SiteAuditWorkflow.ts` | `WorkflowEntrypoint` | **Phase 2 work** — for Phase 1: delete file entirely (re-export in server.ts already removed) | CF-01 blocker |
| `src/server/workflows/siteAuditWorkflowCrawl.ts` | `env.*` (likely via workflow) | Verify import chain; may need stub for Phase 1 | Check before plan |
| `src/server/workflows/siteAuditWorkflowPhases.ts` | `env.*` (likely via workflow) | Same — Phase 2 target, stub for Phase 1 | Check before plan |
| `src/serverFunctions/audit.ts` | `waitUntil`, `env.AUTH_MODE` | Replace `env.AUTH_MODE` with `process.env`; drop `waitUntil` | CF-01, CF-04 |
| `src/serverFunctions/config.ts` | `env.DATAFORSEO_API_KEY` | Replace with `process.env.*` | CF-04 |

**Note on `BacklinksTable.tsx`:** Grep matched because it uses `cell.getContext()` from TanStack Table — not a CF import. No action needed. [VERIFIED: grep + file read]

### Files NOT changing (schema files in `src/db/`)

`src/db/schema.ts` — barrel re-export only; no change to contents, only its dependencies change.

---

## Exact DB Initialization Rewrite (DB-08)

### Current `src/db/index.ts` [VERIFIED: file read]

```typescript
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

export const db = drizzle(env.DB, { schema });
```

### Replacement

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle({ client: pool, schema });
```

---

## Schema Column Conversions (DB-01 through DB-04)

### `src/db/better-auth-schema.ts` — All Changes Required [VERIFIED: file read]

**Import line change:**
```typescript
// BEFORE
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// AFTER
import { pgTable, text, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
```

**Table constructor:** Every `sqliteTable(` → `pgTable(`

**Timestamp columns (10 occurrences) — `integer({ mode: "timestamp_ms" })` → `timestamp`:**

| Table | Column | Current | Replacement |
|-------|--------|---------|-------------|
| `user` | `createdAt` | `integer("created_at", { mode: "timestamp_ms" }).default(sql\`(cast(unixepoch...))\`)` | `timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull()` |
| `user` | `updatedAt` | same + `.$onUpdate(...)` | `timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull().$onUpdate(() => new Date())` |
| `session` | `expiresAt` | `integer("expires_at", { mode: "timestamp_ms" }).notNull()` | `timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull()` |
| `session` | `createdAt` | same pattern | `timestamp("created_at", ...).defaultNow().notNull()` |
| `session` | `updatedAt` | same + `.$onUpdate` | `timestamp("updated_at", ...).defaultNow().notNull().$onUpdate(() => new Date())` |
| `account` | `accessTokenExpiresAt` | `integer("access_token_expires_at", { mode: "timestamp_ms" })` | `timestamp("access_token_expires_at", { withTimezone: true, mode: "date" })` |
| `account` | `refreshTokenExpiresAt` | same | `timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" })` |
| `account` | `createdAt` | standard pattern | `timestamp("created_at", ...).defaultNow().notNull()` |
| `account` | `updatedAt` | + `.$onUpdate` | `timestamp("updated_at", ...).defaultNow().notNull().$onUpdate(() => new Date())` |
| `verification` | `expiresAt` | `integer("expires_at", { mode: "timestamp_ms" }).notNull()` | `timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull()` |
| `verification` | `createdAt` | standard | `timestamp("created_at", ...).defaultNow().notNull()` |
| `verification` | `updatedAt` | + `.$onUpdate` | `timestamp("updated_at", ...).defaultNow().notNull().$onUpdate(() => new Date())` |
| `organization` | `createdAt` | `integer("created_at", { mode: "timestamp_ms" }).notNull()` | `timestamp("created_at", { withTimezone: true, mode: "date" }).notNull()` |
| `member` | `createdAt` | `integer("created_at", { mode: "timestamp_ms" }).notNull()` | `timestamp("created_at", { withTimezone: true, mode: "date" }).notNull()` |
| `invitation` | `expiresAt` | `integer("expires_at", { mode: "timestamp_ms" }).notNull()` | `timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull()` |
| `invitation` | `createdAt` | standard | `timestamp("created_at", ...).defaultNow().notNull()` |

**Boolean columns in `better-auth-schema.ts`:**

| Table | Column | Current | Replacement |
|-------|--------|---------|-------------|
| `user` | `emailVerified` | `integer("email_verified", { mode: "boolean" }).default(false).notNull()` | `boolean("email_verified").default(false).notNull()` |

---

### `src/db/app.schema.ts` — All Changes Required [VERIFIED: file read]

**Import line change:**
```typescript
// BEFORE
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// AFTER
import { pgTable, text, integer, real, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
```

**Table constructor:** Every `sqliteTable(` → `pgTable(`

**Timestamp (text-based) columns — `text("*_at").default(sql\`(current_timestamp)\`)` → `timestamp`:**

| Table | Column | Current | Replacement |
|-------|--------|---------|-------------|
| `delegatedUsers` | `createdAt` | `text("created_at").notNull().default(sql\`(current_timestamp)\`)` | `timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull()` |
| `projects` | `createdAt` | same | `timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull()` |
| `savedKeywords` | `createdAt` | same | `timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull()` |
| `keywordMetrics` | `fetchedAt` | same | `timestamp("fetched_at", { withTimezone: true, mode: "date" }).defaultNow().notNull()` |
| `audits` | `startedAt` | same | `timestamp("started_at", { withTimezone: true, mode: "date" }).defaultNow().notNull()` |
| `audits` | `completedAt` | `text("completed_at")` (nullable, no default) | `timestamp("completed_at", { withTimezone: true, mode: "date" })` |

**Boolean columns:**

| Table | Column | Current | Replacement |
|-------|--------|---------|-------------|
| `auditPages` | `hasStructuredData` | `integer("has_structured_data", { mode: "boolean" }).notNull().default(false)` | `boolean("has_structured_data").notNull().default(false)` |
| `auditPages` | `isIndexable` | `integer("is_indexable", { mode: "boolean" }).notNull().default(true)` | `boolean("is_indexable").notNull().default(true)` |

**Integer autoincrement PK:**

| Table | Column | Current | Replacement |
|-------|--------|---------|-------------|
| `keywordMetrics` | `id` | `integer("id").primaryKey({ autoIncrement: true })` | `integer("id").primaryKey().generatedAlwaysAsIdentity()` |

**JSON columns — `text` → `jsonb`:**

The following columns store JSON but are typed as `text`. They should become `jsonb`:

| Table | Column | Current | Replacement |
|-------|--------|---------|-------------|
| `audits` | `config` | `text("config").notNull().default("{}")` | `jsonb("config").notNull().default({}).$type<AuditConfig>()` |
| `keywordMetrics` | `monthlySearches` | `text("monthly_searches")` | `jsonb("monthly_searches").$type<MonthlySearchEntry[] \| null>()` |
| `auditPages` | `headingOrderJson` | `text("heading_order_json")` | `jsonb("heading_order_json").$type<HeadingEntry[] \| null>()` |
| `auditPages` | `imagesJson` | `text("images_json")` | `jsonb("images_json").$type<ImageEntry[] \| null>()` |
| `auditPages` | `hreflangTagsJson` | `text("hreflang_tags_json")` | `jsonb("hreflang_tags_json").$type<HreflangEntry[] \| null>()` |

**GOTCHA:** When converting `text("col")` that currently stores `JSON.stringify(value)` to `jsonb("col")`, remove manual `JSON.stringify`/`JSON.parse` calls in application code that writes/reads these columns. Drizzle's `jsonb` handles serialization automatically. Search for write sites: `AuditService.ts`, `siteAuditWorkflowCrawl.ts`, `siteAuditWorkflowPhases.ts`.

---

## Exact `vite.config.ts` Changes (CF-02) [VERIFIED: file read]

### Current plugins array (line 24–38):
```typescript
import { cloudflare } from "@cloudflare/vite-plugin";
// ...
plugins: [
  showDevtools ? devtools({ ... }) : null,
  cloudflare({ viteEnvironment: { name: "ssr" } }),   // REMOVE THIS LINE
  tsConfigPaths(),
  tanstackStart(),
  viteReact(),
  tailwindcss(),
],
```

### Replacement:
```typescript
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";
// ...
plugins: [
  showDevtools ? devtools({ ... }) : null,
  nitroV2Plugin({ preset: "node-server" }),             // ADD THIS LINE
  tsConfigPaths(),
  tanstackStart(),
  viteReact(),
  tailwindcss(),
],
```

The `loadEnv`, `port`, `allowedHosts`, `envPrefix`, `server`, and `preview` config blocks are unchanged.

**No `environments.ssr` block needed** for `@tanstack/nitro-v2-vite-plugin` — the plugin wraps nitropack v2 internally and reads the server entry from TanStack Start's own configuration. [ASSUMED — verify by checking `@tanstack/nitro-v2-vite-plugin` source or running a test build]

---

## Exact `src/server.ts` Changes (CF-03) [VERIFIED: file read]

### Current (6 lines):
```typescript
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
const fetch = createStartHandler(defaultStreamHandler);
export { SiteAuditWorkflow } from "./server/workflows/SiteAuditWorkflow";
export default { fetch };
```

### Replacement:
```typescript
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

const fetch = createStartHandler(defaultStreamHandler);

export default { fetch };
```

**Remove** the `SiteAuditWorkflow` re-export — that file is being deleted in Phase 1 (CF-01). The CF Worker module format (`export default { fetch }`) is acceptable for Nitro's `node-server` preset; Nitro wraps this in a standard Node.js HTTP server. [ASSUMED: verify this is compatible with `@tanstack/nitro-v2-vite-plugin` — the STACK.md research suggested a `createServerEntry` pattern but the existing `createStartHandler/defaultStreamHandler` pattern may also work]

**OPEN QUESTION from STATE.md:** Verify exact `createServerEntry` import signature in `@tanstack/react-start` v1.167.17 before finalizing server.ts. The current pattern (`createStartHandler`) may already be correct for Nitro v2.

---

## `runtime-env.ts` Rewrite (CF-05) [VERIFIED: file read]

### Current behavior:
- Tries `process.env` first
- Falls back to dynamic `import("cloudflare:workers")` to get `env.*`
- Exposes `getWorkersBinding(name)` for D1/KV/R2/Workflow objects

### Required new behavior (CF-05):
- Only `process.env` — no CF fallback
- Startup validation: throw clearly on missing required vars
- Remove `getWorkersBinding` — bindings are gone

### Required env vars to validate at startup:
| Variable | Used By | Required In |
|----------|---------|-------------|
| `DATABASE_URL` | `src/db/index.ts` | All modes |
| `BETTER_AUTH_URL` | `src/lib/auth.ts` | Hosted auth mode only |
| `BETTER_AUTH_SECRET` | `src/lib/auth.ts` | Hosted auth mode only |
| `AUTH_MODE` | `ensureUser.ts`, `routes/api/auth/$.ts`, `serverFunctions/audit.ts` | All modes (has default: `local_noauth`) |
| `DATAFORSEO_API_KEY` | `dataforseo.ts`, `dataforseoLighthouse.ts` | Optional (feature-gated) |
| `POSTHOG_PUBLIC_KEY` | `posthog.ts` | Optional |
| `POSTHOG_HOST` | `posthog.ts` | Optional |
| `LOOPS_API_KEY` | `loops.ts` | Hosted mode only |
| `LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID` | `loops.ts` | Hosted mode only |
| `LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID` | `loops.ts` | Hosted mode only |
| `TEAM_DOMAIN` | `cloudflareAccess.ts` | CF Access auth mode only |
| `POLICY_AUD` | `cloudflareAccess.ts` | CF Access auth mode only |
| R2 credentials (account ID, access key, secret) | `r2.ts` | Used when R2 features active |

### Rewrite pattern:
```typescript
// src/server/lib/runtime-env.ts — NEW
export function getRequiredEnvValue(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnvValue(name: string): string | undefined {
  return process.env[name];
}

// Startup validation — call this once at server boot
export function validateRequiredEnv(): void {
  const required = ["DATABASE_URL"];
  for (const name of required) {
    getRequiredEnvValue(name);  // throws if missing
  }
}
```

The `isHostedServerAuthMode()` helper is kept but simplified — it reads `process.env.AUTH_MODE` synchronously (no async needed without CF runtime).

---

## Package Changes (CF-02, CF-06, DB-08)

### Install:
```bash
pnpm add pg
pnpm add -D @types/pg @tanstack/nitro-v2-vite-plugin
```

### Remove:
```bash
pnpm remove @cloudflare/vite-plugin
pnpm remove -D @cloudflare/workers-types
pnpm remove -D @libsql/client
pnpm remove -D wrangler
```

**IMPORTANT:** `cloudflare` (the Cloudflare SDK, `"cloudflare": "^5.2.0"`) is in `dependencies` — this is NOT `@cloudflare/vite-plugin`. It is the HTTP API client used by `src/server/lib/r2.ts` for R2 operations. **Do NOT remove it.** R2 stays on the Cloudflare HTTP API (not a binding) — this package stays. [VERIFIED: package.json]

### `tsconfig.json` — No `types[]` array change needed [VERIFIED: file read]
`@cloudflare/workers-types` is not listed in `tsconfig.json` `compilerOptions.types`. Removing the devDependency package alone is sufficient for CF-06.

### `drizzle.config.ts` — Full rewrite:

**Current file** imports from `@every-app/sdk/cloudflare/server` to get a local D1 URL. Replace entirely:

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

**Check for `drizzle-prod.config.ts`:** `STACK.md` mentioned it but it was not found in the repo root. Verify with `ls *.config.ts` — if it exists, delete it too.

### `package.json` script changes:
```json
// REMOVE (CF-specific):
"db:migrate:local": "wrangler d1 migrations apply DB --local",
"db:migrate:prod": "wrangler d1 migrations apply DB --remote",
"deploy": "npm run db:migrate:prod && npm run build && wrangler deploy",
"cf-typegen": "wrangler types",

// ADD:
"db:migrate": "drizzle-kit migrate",
"start": "node .output/server/index.mjs"
```

---

## Migration Folder (DB-06, DB-07)

7 SQLite migration files exist in `drizzle/`:
- `0000_fantastic_vanisher.sql` through `0006_magical_alex_wilder.sql`
- `meta/` directory (contains `_journal.json`)

**Action:** Delete entire `drizzle/` folder before generating PG migrations.

```bash
rm -rf drizzle/
DATABASE_URL=postgres://... pnpm drizzle-kit generate
DATABASE_URL=postgres://... pnpm drizzle-kit migrate
```

---

## `waitUntil` Replacement (CF-01)

Two files use `waitUntil` from `cloudflare:workers`:
- `src/middleware/errorHandling.ts`
- `src/routes/api/autumn/$.ts` (also imports `env`)

`waitUntil` registers a background Promise to keep the Worker alive after response is sent. In Node.js this concept doesn't apply — the process stays alive.

**Replacement:** For each call site, inspect what promise is passed to `waitUntil`. If it's a fire-and-forget analytics/logging call, replace with `void promise` (unhandled). If it's a critical operation, await it before returning the response.

---

## `src/server/features/audit/services/AuditService.ts` — Phase 1 Stub Strategy

This file uses `env.SITE_AUDIT_WORKFLOW` (BullMQ target in Phase 2). For Phase 1, the file must have zero `cloudflare:workers` imports while the BullMQ implementation is not yet ready. Two options:

**Option A (recommended):** Stub the workflow methods to throw a `NotImplementedError`:
```typescript
// Remove: import { env } from "cloudflare:workers";
// Replace env.SITE_AUDIT_WORKFLOW.create(...) with:
throw new Error("Audit workflow not yet implemented — Phase 2");
```

**Option B:** Delete the method bodies and leave them as stubs. Less disruptive if any caller already handles errors.

Same approach for `progress-kv.ts` and the workflow files in `src/server/workflows/`.

---

## Common Pitfalls (Phase 1 Specific)

### CRITICAL — Build order matters
Do not swap the vite adapter (`cloudflare` → `nitroV2Plugin`) until ALL `cloudflare:workers` imports are removed. The CF adapter previously externalized this specifier; without it, Rollup fails immediately. [VERIFIED: PITFALLS.md]

### CRITICAL — `src/lib/auth.ts` uses `env` object directly (not via `runtime-env.ts`)
`auth.ts` has `import { env } from "cloudflare:workers"` at the top and accesses `env.BETTER_AUTH_URL`, `env.BETTER_AUTH_SECRET`, and uses `Reflect.get(env, name)` for Loops vars. These are **not** routed through `runtime-env.ts`. Replace each with `process.env.BETTER_AUTH_URL`, `process.env.BETTER_AUTH_SECRET`, and `process.env[name]` respectively. [VERIFIED: file read]

### CRITICAL — `organization.metadata` is `text`, not JSON-typed in schema
`organization.metadata` in `better-auth-schema.ts` is `text("metadata")` with no JSON semantics. Leave as `text` — `better-auth` treats this column as an opaque string.

### CRITICAL — `audits.config` default changes from string `"{}"` to object `{}`
When converting `text("config").default("{}")` to `jsonb("config").default({})`, the Drizzle default changes from a string to a JSONB literal. Ensure any insert code that sets `config: "{}"` is updated to `config: {}`. [ASSUMED — verify insert sites in AuditService.ts]

### MODERATE — `savedKeywords` index includes `createdAt` (was `text`, now `timestamp`)
`index("saved_keywords_project_created_idx").on(table.projectId, table.createdAt)` — the index still works after the type change but the generated migration SQL will show the column type change. This is expected. [VERIFIED: app.schema.ts]

### MODERATE — `@every-app/sdk` import in `drizzle.config.ts`
`drizzle.config.ts` imports from `@every-app/sdk/cloudflare/server`. After rewriting the config file this import disappears. Check if `@every-app/sdk` is used elsewhere in the codebase before deciding whether to remove it from `package.json`. It is listed in production `dependencies`. [VERIFIED: package.json — `"@every-app/sdk": "^0.1.14"`]

---

## Environment Availability

Step 2.6: SKIPPED for this phase — Phase 1 is purely code/schema changes. No external services needed during the migration itself (PostgreSQL is needed to run `drizzle-kit migrate` for DB-07 verification, but that is a verification step, not an implementation step).

---

## Validation Architecture

### Test Framework [VERIFIED: package.json]
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | None found (default Vitest config) |
| Quick run | `pnpm test` |
| Full suite | `pnpm run test:ci` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| CF-01 | Zero `cloudflare:workers` imports | Automated grep | `grep -r "cloudflare:workers" src/` returns 0 matches |
| CF-02 | Vite build uses nitro adapter | Build verification | `pnpm run build` — checks CF-02 implicitly |
| CF-03 | Server entry compatible | Build + smoke | `node .output/server/index.mjs` starts |
| CF-04 | All env reads via `process.env` | Automated grep | `grep -r "env\.DB\|env\.KV\|env\.R2\|env\.SITE_AUDIT_WORKFLOW" src/` → 0 |
| CF-05 | Missing var causes startup error | Unit test | Test `validateRequiredEnv()` throws without `DATABASE_URL` |
| CF-06 | No TS errors | `tsc --noEmit` | Part of `pnpm run build` already |
| DB-01–04 | Schema uses pg-core types | `tsc --noEmit` | Type errors surface wrong imports |
| DB-06 | Old migrations deleted | Manual verify | `ls drizzle/` — only PG files |
| DB-07 | Migrations apply cleanly | Manual run | `drizzle-kit migrate` against fresh PG |
| DB-08 | `db` uses node-postgres | `tsc --noEmit` + unit | Type of `db` matches `drizzle/node-postgres` |
| BUILD-01 | Build succeeds | `pnpm run build` | Zero errors |
| BUILD-02 | Output file exists | Post-build check | `ls .output/server/index.mjs` |
| BUILD-03 | Routes respond | Smoke test | `node .output/server/index.mjs` + curl |

### Wave 0 Gaps
- [ ] Unit test for `validateRequiredEnv()` in `runtime-env.ts` (covers CF-05) — new file needed at `src/server/lib/runtime-env.test.ts`

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `better-auth` unchanged |
| V3 Session Management | Yes | `better-auth` unchanged |
| V4 Access Control | Yes | `ensureUser.ts` middleware |
| V5 Input Validation | Yes | `zod` already in use |
| V6 Cryptography | No | No crypto changes |

**Phase 1 security notes:**
- `BETTER_AUTH_SECRET` must never appear in `process.env` logging
- `DATABASE_URL` contains credentials — `validateRequiredEnv()` must not log the value, only whether it is present
- R2 access credentials will be needed in environment when `r2.ts` is in use — document in `.env.open-seo.example`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@tanstack/nitro-v2-vite-plugin` does not require an `environments.ssr` block in `vite.config.ts` | vite.config.ts Changes | Build may fail without it — add the block as fallback |
| A2 | The existing `export default { fetch }` in `server.ts` is compatible with `nitroV2Plugin` (no `createServerEntry` needed) | server.ts Changes | May need `createServerEntry` pattern instead — test build to confirm |
| A3 | `audits.config` insert sites pass string `"{}"` that must become object `{}` after jsonb conversion | JSON columns | Silent type bug if not fixed — grep insert sites |
| A4 | `drizzle-prod.config.ts` does not exist in this repo | drizzle.config.ts | Non-issue if absent; delete if found |

---

## Open Questions

1. **`createServerEntry` vs `createStartHandler` in server.ts**
   - What we know: STACK.md found a `createServerEntry` import from `@tanstack/react-start/server-entry` in the Nitro SSR example
   - What's unclear: Whether the existing `createStartHandler/defaultStreamHandler` pattern in this codebase is equivalent or must be replaced
   - Recommendation: Run a test build with the existing pattern first; only switch to `createServerEntry` if the build fails or SSR does not work

2. **`siteAuditWorkflowCrawl.ts` and `siteAuditWorkflowPhases.ts` — full import scan**
   - What we know: They are in the `cloudflare:workers` grep results
   - What's unclear: What exactly they import and whether they can simply be deleted alongside `SiteAuditWorkflow.ts` or need stubs
   - Recommendation: Read both files before writing the plan tasks

3. **`waitUntil` call sites — what promises are registered**
   - What we know: `errorHandling.ts` and `serverFunctions/audit.ts` use `waitUntil`
   - What's unclear: Whether the promises are fire-and-forget (safe to `void`) or critical path
   - Recommendation: Read both call sites to determine correct replacement

---

## Sources

### Primary (HIGH confidence)
- `src/db/index.ts` — verified current DB initialization [VERIFIED: file read]
- `src/db/app.schema.ts` — verified all tables and columns [VERIFIED: file read]
- `src/db/better-auth-schema.ts` — verified all tables and columns [VERIFIED: file read]
- `vite.config.ts` — verified current adapter and plugin config [VERIFIED: file read]
- `src/server.ts` — verified current server entry format [VERIFIED: file read]
- `src/server/lib/runtime-env.ts` — verified current CF env loading [VERIFIED: file read]
- `drizzle.config.ts` — verified current dialect and schema path [VERIFIED: file read]
- `package.json` — verified installed packages [VERIFIED: file read]
- `tsconfig.json` — verified `@cloudflare/workers-types` not in `types[]` [VERIFIED: file read]
- grep output — 22 files with `cloudflare:workers` imports [VERIFIED: grep]
- `.planning/research/STACK.md` — migration patterns [CITED]
- `.planning/research/PITFALLS.md` — critical pitfalls [CITED]

### Tertiary (LOW confidence)
- `@tanstack/nitro-v2-vite-plugin` `environments` config requirement — not confirmed by direct source read [ASSUMED: A1]
- `createServerEntry` vs `createStartHandler` compatibility — not confirmed by build test [ASSUMED: A2]
