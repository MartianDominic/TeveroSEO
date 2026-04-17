---
phase: 02-cf-bindings-removal-schema-migration
plan: "04"
subsystem: open-seo-main
tags: [cloudflare-removal, nodejs, process-env, better-auth, posthog, dataforseo, loops, middleware]
dependency_graph:
  requires: [02-03]
  provides: [cf-binding-free-app-libs, cf-binding-free-routes-middleware, node-compatible-error-handling]
  affects:
    - open-seo-main/src/lib/auth.ts
    - open-seo-main/src/server/email/loops.ts
    - open-seo-main/src/server/lib/posthog.ts
    - open-seo-main/src/server/lib/dataforseo.ts
    - open-seo-main/src/server/lib/dataforseoLighthouse.ts
    - open-seo-main/src/serverFunctions/config.ts
    - open-seo-main/src/routes/api/auth/$.ts
    - open-seo-main/src/routes/api/autumn/$.ts
    - open-seo-main/src/middleware/ensureUser.ts
    - open-seo-main/src/middleware/errorHandling.ts
    - open-seo-main/src/middleware/ensure-user/cloudflareAccess.ts
    - open-seo-main/src/server/lib/dataforseoClient.test.ts
tech_stack:
  added: []
  patterns: [process-env-reads, void-catch-fire-and-forget, async-getRequiredEnvValue, drizzle-pg-adapter]
key_files:
  modified:
    - open-seo-main/src/lib/auth.ts
    - open-seo-main/src/server/email/loops.ts
    - open-seo-main/src/server/lib/posthog.ts
    - open-seo-main/src/server/lib/dataforseo.ts
    - open-seo-main/src/server/lib/dataforseoLighthouse.ts
    - open-seo-main/src/serverFunctions/config.ts
    - open-seo-main/src/routes/api/auth/$.ts
    - open-seo-main/src/routes/api/autumn/$.ts
    - open-seo-main/src/middleware/ensureUser.ts
    - open-seo-main/src/middleware/errorHandling.ts
    - open-seo-main/src/middleware/ensure-user/cloudflareAccess.ts
    - open-seo-main/src/server/lib/dataforseoClient.test.ts
decisions:
  - better-auth drizzleAdapter switched to provider 'pg' matching PostgreSQL backend from Plan 02
  - posthog flush retuned from flushAt:1/flushInterval:0 (Workers per-request) to flushAt:20/flushInterval:10_000 (Node long-lived process)
  - loops.ts getHostedAuthEmailConfig made async to use await getRequiredEnvValue from runtime-env
  - waitUntil replaced with void ...catch() — same fire-and-forget semantics, Node-compatible
  - vi.mock('cloudflare:workers') removed from test — non-existent module would error in Node vitest
metrics:
  duration: "~5 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 12
---

# Phase 2 Plan 04: CF Bindings Removal — App Libraries, Routes, Middleware Summary

**One-liner:** Removed all `cloudflare:workers` imports from 12 app files — swapping `env.*` reads to `process.env.*`, better-auth adapter to `provider: "pg"`, `waitUntil` to `void ...catch()`, and PostHog flush settings for Node.js long-lived process lifetime.

## What Was Built

Plan 04 cleans the direct consumers of Cloudflare Worker bindings: the application libraries (auth, email, posthog, dataforseo), the server function config, the route handlers, and the middleware stack. After this plan, these 12 files compile cleanly in the Node.js target with zero CF runtime dependencies.

### Task 1 — Auth, Email, PostHog, DataForSEO, Config (`6938b61`)

**src/lib/auth.ts:**
- Deleted `import { env } from "cloudflare:workers"`
- `env.BETTER_AUTH_URL` → `process.env.BETTER_AUTH_URL`
- `env.BETTER_AUTH_SECRET` → `process.env.BETTER_AUTH_SECRET`
- `Reflect.get(env, name)` in `hasHostedAuthEmailConfig` → `process.env[name]`
- `drizzleAdapter(db, { provider: "sqlite" })` → `drizzleAdapter(db, { provider: "pg" })`

**src/server/email/loops.ts:**
- Deleted `import { env } from "cloudflare:workers"` and local `getRequiredEnv` helper
- Replaced with `import { getRequiredEnvValue } from "@/server/lib/runtime-env"`
- `getHostedAuthEmailConfig()` made `async`; callers already `await` the result so no other changes needed
- Both `sendHostedVerificationEmail` and `sendHostedPasswordResetEmail` now `await getHostedAuthEmailConfig()`

**src/server/lib/posthog.ts:**
- Deleted CF env import
- `env.POSTHOG_PUBLIC_KEY` / `env.POSTHOG_HOST` → `process.env.*`
- `flushAt: 1, flushInterval: 0` → `flushAt: 20, flushInterval: 10_000` (Node long-lived process batching)
- Removed "runs on Cloudflare Workers" from doc comment

**src/server/lib/dataforseo.ts:**
- Deleted CF env import
- `env.DATAFORSEO_API_KEY` → `process.env.DATAFORSEO_API_KEY ?? ""`

**src/server/lib/dataforseoLighthouse.ts:**
- Deleted CF env import
- `` `Basic ${env.DATAFORSEO_API_KEY?.trim() ?? ""}` `` → `` `Basic ${process.env.DATAFORSEO_API_KEY?.trim() ?? ""}` ``

**src/serverFunctions/config.ts:**
- Deleted CF env import
- `Boolean(env.DATAFORSEO_API_KEY?.trim())` → `Boolean(process.env.DATAFORSEO_API_KEY?.trim())`

### Task 2 — Routes, Middleware, Vitest Test (`7324963`)

**src/routes/api/auth/$.ts:**
- Deleted CF env import; `isHostedAuthMode(env.AUTH_MODE)` → `isHostedAuthMode(process.env.AUTH_MODE)`

**src/routes/api/autumn/$.ts:**
- Deleted CF env import; `isHostedAuthMode(env.AUTH_MODE)` → `isHostedAuthMode(process.env.AUTH_MODE)`

**src/middleware/ensureUser.ts:**
- Deleted CF env import; `getAuthMode(env.AUTH_MODE)` → `getAuthMode(process.env.AUTH_MODE)`

**src/middleware/errorHandling.ts:**
- Deleted `import { waitUntil } from "cloudflare:workers"`
- Replaced `waitUntil(captureServerError(...))` with `void captureServerError(...).catch((err) => { console.error(...) })` — Node-compatible fire-and-forget; failed telemetry logs to stderr

**src/middleware/ensure-user/cloudflareAccess.ts:**
- Deleted CF env import
- `env.TEAM_DOMAIN` → `process.env.TEAM_DOMAIN` (two occurrences — condition + `getValidatedTeamDomain` argument)
- `env.POLICY_AUD?.trim()` → `process.env.POLICY_AUD?.trim()`
- JWKS/jose verification logic untouched (already runtime-agnostic)

**src/server/lib/dataforseoClient.test.ts:**
- Removed `vi.mock("cloudflare:workers", () => ({ waitUntil: vi.fn() }))` — the module does not exist in Node.js; mocking it in vitest would cause a resolution error. No test assertions relied on the mocked `waitUntil` beyond the mock declaration itself.

## Deviations from Plan

None — plan executed exactly as written. All 12 files match the verbatim replacement content specified in the plan.

## Known Stubs

None. All changes are infrastructure/binding replacements with no UI-facing data paths.

## Threat Flags

None. This plan reduces attack surface by eliminating the Cloudflare Workers runtime dependency. All secrets continue to be read from `process.env` (never logged). The `void ...catch(console.error)` pattern for PostHog telemetry ensures failed captures are visible in Docker logs (Phase 4) rather than silently swallowed.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| open-seo-main/src/lib/auth.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/lib/auth.ts — provider: "pg" | FOUND (count=1) |
| open-seo-main/src/lib/auth.ts — process.env.BETTER_AUTH_URL | FOUND (count=1) |
| open-seo-main/src/lib/auth.ts — process.env.BETTER_AUTH_SECRET | FOUND (count=1) |
| open-seo-main/src/lib/auth.ts — no Reflect.get | ABSENT (count=0) |
| open-seo-main/src/server/email/loops.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/server/email/loops.ts — getRequiredEnvValue | FOUND (count=4) |
| open-seo-main/src/server/lib/posthog.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/server/lib/posthog.ts — process.env.POSTHOG_PUBLIC_KEY | FOUND (count=1) |
| open-seo-main/src/server/lib/posthog.ts — flushAt: 20 | FOUND (count=1) |
| open-seo-main/src/server/lib/posthog.ts — flushInterval: 10_000 | FOUND (count=1) |
| open-seo-main/src/server/lib/dataforseo.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/server/lib/dataforseo.ts — process.env.DATAFORSEO_API_KEY | FOUND (count=1) |
| open-seo-main/src/server/lib/dataforseoLighthouse.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/server/lib/dataforseoLighthouse.ts — process.env.DATAFORSEO_API_KEY | FOUND (count=1) |
| open-seo-main/src/serverFunctions/config.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/serverFunctions/config.ts — process.env.DATAFORSEO_API_KEY | FOUND (count=1) |
| open-seo-main/src/routes/api/auth/$.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/routes/api/auth/$.ts — process.env.AUTH_MODE | FOUND (count=1) |
| open-seo-main/src/routes/api/autumn/$.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/routes/api/autumn/$.ts — process.env.AUTH_MODE | FOUND (count=1) |
| open-seo-main/src/middleware/ensureUser.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/middleware/ensureUser.ts — process.env.AUTH_MODE | FOUND (count=1) |
| open-seo-main/src/middleware/errorHandling.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/middleware/errorHandling.ts — no waitUntil | ABSENT (count=0) |
| open-seo-main/src/middleware/errorHandling.ts — void captureServerError | FOUND (count=1) |
| open-seo-main/src/middleware/ensure-user/cloudflareAccess.ts — no cloudflare:workers | ABSENT (count=0) |
| open-seo-main/src/middleware/ensure-user/cloudflareAccess.ts — process.env.TEAM_DOMAIN | FOUND (count=2) |
| open-seo-main/src/middleware/ensure-user/cloudflareAccess.ts — process.env.POLICY_AUD | FOUND (count=1) |
| open-seo-main/src/server/lib/dataforseoClient.test.ts — no cloudflare:workers mock | ABSENT (count=0) |
| commit 6938b61 (task 1) | FOUND |
| commit 7324963 (task 2) | FOUND |
