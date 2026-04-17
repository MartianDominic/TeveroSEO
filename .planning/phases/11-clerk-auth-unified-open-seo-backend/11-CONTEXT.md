# Phase 11: Clerk Auth Unified — open-seo Backend - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated

<domain>
## Phase Boundary

Replace better-auth in the open-seo Node.js backend with Clerk JWT verification. The `jose` package (already a dependency) verifies RS256 tokens against Clerk's JWKS endpoint. Drop `session`, `account`, `verification`, `jwks` better-auth tables via Drizzle migration. Add `clerk_user_id text UNIQUE` to the `user` table. All server functions that called `requireAuthenticatedContext` now validate a Clerk JWT from the `Authorization: Bearer` header. No user-facing change — Phase 10 already removed the auth UI.

</domain>

<decisions>
## Implementation Decisions

### JWT Verification
- Use `jose` (already in `open-seo-main/package.json` dependencies) — `createRemoteJWKSet` + `jwtVerify`
- JWKS URL: `https://{clerk_instance}.clerk.accounts.dev/.well-known/jwks.json` — derived from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Cache JWKS with `createRemoteJWKSet` (jose handles caching automatically via its JWKS client)
- New file: `open-seo-main/src/server/lib/clerk-jwt.ts` (~50 lines)

### Middleware Changes
- `open-seo-main/src/serverFunctions/middleware.ts` — `requireAuthenticatedContext`:
  - OLD: `getAuth().api.getSession({ headers })` (better-auth session cookie lookup)
  - NEW: extract `Authorization: Bearer <token>` header → `jwtVerify(token, JWKS)` → extract `sub` (Clerk user ID)
  - Lookup or create `user` row by `clerk_user_id`
- `requireProjectContext` — unchanged (already uses requireAuthenticatedContext output)

### Database Migration (Drizzle)
- Add column: `clerk_user_id text UNIQUE` to `user` table
- Drop tables: `session`, `account`, `verification`, `jwks` (better-auth internal tables)
- Keep tables: `user`, `organization`, `member`, `invitation` (business data)
- Backfill: existing `user` rows get `clerk_user_id = NULL` initially; auto-populated on first Clerk login

### better-auth Removal
- Remove `better-auth` from `package.json`
- Delete `src/server/lib/auth.ts` (better-auth init with `betterAuth({...})`)
- Delete `src/db/better-auth-schema.ts` (session/account/verification table defs)
- Delete `src/middleware/ensure-user/hosted.ts` (better-auth session resolver)
- Keep `src/middleware/ensure-user/index.ts` but rewrite to use Clerk JWT

### Environment Variables
- Remove: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OPEN_SEO_AUTH_MODE`
- Add: `CLERK_PUBLISHABLE_KEY` (to derive JWKS URL — same value as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`)
- Update `.env.vps.example` and `docker-compose.vps.yml`

### First-Login User Creation
- If `clerk_user_id` not found in `user` table: auto-create user row with `clerk_user_id`, `email`, `name` from JWT claims
- This handles agency staff logging in for the first time after migration

### Claude's Discretion
- Whether to keep the `user` table name or rename it to avoid confusion with better-auth semantics
- Exact error response shape for invalid/expired JWT (401 with JSON body)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `open-seo-main/src/server/lib/client-context.ts` — pattern for middleware resolvers; follow same pattern for clerk-jwt.ts
- `open-seo-main/src/serverFunctions/middleware.ts` — two middleware functions to update: requireAuthenticatedContext, requireProjectContext
- `jose` already in package.json — `createRemoteJWKSet`, `jwtVerify` are the two functions needed

### Established Patterns
- Drizzle migrations in `open-seo-main/drizzle/` — follow existing migration file naming
- `validateEnv` in `runtime-env.ts` — add `CLERK_PUBLISHABLE_KEY` to required env vars
- Error throwing pattern: `throw new AppError("UNAUTHORIZED")` — keep consistent

### Integration Points
- `apps/web` server actions pass `Authorization: Bearer <clerk_jwt>` — this phase makes open-seo accept it
- `X-Client-ID` header already wired (Phase 6) — unchanged
- Drizzle ORM + node-postgres pool — unchanged

</code_context>

<specifics>
## Specific Ideas

- `jose` createRemoteJWKSet is the right tool — handles JWKS caching and rotation automatically
- Drop better-auth tables cleanly — no migration path needed (no production users yet in better-auth)
- CLERK_PUBLISHABLE_KEY is public — safe to include in open-seo backend env

</specifics>

<deferred>
## Deferred Ideas

- Organization-level auth (team members accessing same client data) — post v2.0
- Clerk webhook for user deletion sync — post v2.0

</deferred>
