# Phase 68: Integration Hardening

**Milestone:** v8.0 SaaS Hardening
**Duration:** 2 weeks
**Priority:** CRITICAL - Security & reliability fixes

## Overview

Fix cross-service authentication, client context security, API contract alignment, and state management issues.

## Sub-Plans

| Plan | Name | Wave | Depends On |
|------|------|------|------------|
| 68-01 | Auth Flow Fixes | 1 | 67-03 |
| 68-02 | Client Context Security | 1 | 68-01 |
| 68-03 | API Contract Alignment | 2 | 68-01 |
| 68-04 | State Management Migration | 2 | 68-02 |

## Issues Resolved

- AUTH-HIGH-01, AUTH-HIGH-02: Inconsistent auth patterns
- CRITICAL-01: Empty X-Client-ID bypass
- HIGH-01: Race condition during client switching
- HIGH-02: Ownership cache TTL mismatch
- HIGH-03: apps/web missing defense-in-depth
- API-02, API-05, API-09, API-01: API contract issues
- HIGH-STATE-01, HIGH-STATE-02: State management issues

---

## Plan 68-01: Auth Flow Fixes

```yaml
---
phase: 68-integration-hardening
plan: 01
type: execute
wave: 1
depends_on: [67-03]
files_modified:
  - open-seo-main/src/server/lib/clerk-verify.ts
  - open-seo-main/src/server/lib/client-context.ts
autonomous: true
requirements:
  - AUTH-HIGH-01
  - AUTH-HIGH-02
must_haves:
  truths:
    - All API routes use JWT from Authorization Bearer header
    - open-seo-main validates Clerk JWT tokens directly
    - Forged X-User-Id without valid JWT is rejected
  artifacts:
    - open-seo-main/src/server/lib/clerk-verify.ts (verifyClerkToken)
  key_links:
    - Clerk @clerk/backend verifyToken
    - CLERK_SECRET_KEY env var
---
```

<objective>
Standardize JWT verification across services, eliminating trusted header bypass vulnerabilities.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Create Clerk Token Verifier

- Create `clerk-verify.ts` with verifyClerkToken function
- Use @clerk/backend verifyToken
- Extract userId and orgId from claims

Files: `open-seo-main/src/server/lib/clerk-verify.ts`

Acceptance:
- [ ] Verifies JWT signature
- [ ] Returns typed claims
- [ ] Throws AppError on invalid token

### Task 2: Update Client Context Resolution

- Modify `resolveClientId()` to require JWT validation
- Remove trust of X-User-Id header alone
- Keep internal service token path

Files: `open-seo-main/src/server/lib/client-context.ts`

Acceptance:
- [ ] Integration test: Forged X-User-Id rejected
- [ ] Internal service token still works

---

## Plan 68-02: Client Context Security

```yaml
---
phase: 68-integration-hardening
plan: 02
type: execute
wave: 1
depends_on: [68-01]
files_modified:
  - open-seo-main/src/serverFunctions/middleware.ts
  - open-seo-main/src/serverFunctions/briefs.ts
  - apps/web/src/lib/client-context/abort-manager.ts
  - apps/web/src/stores/clientStore.ts
  - open-seo-main/src/server/lib/ownership-subscriber.ts
  - apps/web/src/lib/auth/api-auth.ts
autonomous: true
requirements:
  - CRITICAL-01
  - HIGH-01
  - HIGH-02
  - HIGH-03
must_haves:
  truths:
    - Empty X-Client-ID returns 400 Bad Request
    - Client switch aborts in-flight requests
    - Cache invalidation within 100ms of revocation
    - Invalid client ID blocked at apps/web layer
  artifacts:
    - open-seo-main/src/serverFunctions/middleware.ts (requireClientContext)
    - apps/web/src/lib/client-context/abort-manager.ts
    - open-seo-main/src/server/lib/ownership-subscriber.ts
  key_links:
    - Redis pub/sub channel tevero:ownership:changes
---
```

<objective>
Fix client context security vulnerabilities including empty header bypass, race conditions, and cache invalidation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Add requireClientContext Middleware

- Create middleware that rejects empty/missing X-Client-ID
- Apply to briefs, voice, proposals, goals endpoints

Files: `open-seo-main/src/serverFunctions/middleware.ts`

Acceptance:
- [ ] Empty X-Client-ID returns 400
- [ ] Middleware applied to 4 endpoints

### Task 2: Implement AbortController for Client Switching

- Create abort-manager.ts with per-client AbortController
- Modify setActiveClient to abort previous client requests

Files: `apps/web/src/lib/client-context/abort-manager.ts`, `apps/web/src/stores/clientStore.ts`

Acceptance:
- [ ] Rapid client switching cancels stale requests
- [ ] E2E test passes

### Task 3: Implement Redis Pub/Sub Cache Invalidation

- Create ownership-subscriber.ts subscribing to ownership changes
- Invalidate cache immediately on access revocation

Files: `open-seo-main/src/server/lib/ownership-subscriber.ts`

Acceptance:
- [ ] Cache invalidated within 100ms
- [ ] Integration test: revoke -> immediate rejection

### Task 4: Add Defense-in-Depth in apps/web

- Create validateClientAccessMiddleware
- Validate UUID format
- Pre-check ownership before backend call

Files: `apps/web/src/lib/auth/api-auth.ts`

Acceptance:
- [ ] Invalid UUID returns 400
- [ ] Access denied returns 403

---

## Plan 68-03: API Contract Alignment

```yaml
---
phase: 68-integration-hardening
plan: 03
type: execute
wave: 2
depends_on: [68-01]
files_modified:
  - open-seo-main/src/routes/api/webhooks.ts
  - open-seo-main/src/db/schema.ts
  - packages/types/src/events/client-events.ts
  - open-seo-main/src/server/lib/response.ts
autonomous: true
requirements:
  - API-02
  - API-05
  - API-09
  - API-01
must_haves:
  truths:
    - All POST/PATCH endpoints use Zod validation
    - Optimistic locking returns 409 on version mismatch
    - Event schema uses snake_case consistently
    - All endpoints return {success, data/error} envelope
  artifacts:
    - packages/types/src/events/client-events.ts (ClientEventSchema)
    - open-seo-main/src/server/lib/response.ts (errorResponse)
  key_links:
    - Zod for validation
    - version column for optimistic locking
---
```

<objective>
Standardize API contracts with Zod validation, optimistic locking, unified event schema, and consistent error envelope.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Add Zod Schemas to Webhook Endpoints

Files: `open-seo-main/src/routes/api/webhooks.ts`

Acceptance:
- [ ] createWebhookSchema validates all fields
- [ ] Validation errors return 400 with details

### Task 2: Implement Optimistic Locking

- Add version column to webhooks table
- Validate expectedVersion in WHERE clause

Files: `open-seo-main/src/db/schema.ts`, `open-seo-main/src/routes/api/webhooks.ts`

Acceptance:
- [ ] Stale version returns 409 Conflict

### Task 3: Unify Event Schema Format

- Create ClientEventSchema with snake_case keys
- Add api_version and source fields

Files: `packages/types/src/events/client-events.ts`

Acceptance:
- [ ] Both services use same schema

### Task 4: Standardize Error Envelope

- Create errorResponse helper
- Apply to all endpoints

Files: `open-seo-main/src/server/lib/response.ts`

Acceptance:
- [ ] All errors return {success: false, error: {...}}

---

## Plan 68-04: State Management Migration

```yaml
---
phase: 68-integration-hardening
plan: 04
type: execute
wave: 2
depends_on: [68-02]
files_modified:
  - apps/web/src/hooks/use-clients.ts
  - apps/web/src/lib/state/broadcast-sync.ts
  - apps/web/src/stores/clientStore.ts
autonomous: true
requirements:
  - HIGH-STATE-01
  - HIGH-STATE-02
must_haves:
  truths:
    - useClients() provides cached client list via TanStack Query
    - Client switch syncs across browser tabs
    - Logout in one tab logs out all tabs
  artifacts:
    - apps/web/src/hooks/use-clients.ts (useClients, useActiveClient)
    - apps/web/src/lib/state/broadcast-sync.ts
  key_links:
    - TanStack Query queryKey conventions
    - BroadcastChannel API
---
```

<objective>
Migrate to TanStack Query for server state and implement BroadcastChannel for multi-tab synchronization.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Create TanStack Query Hooks

- Implement useClients() with caching
- Implement useActiveClient() derived from store + query

Files: `apps/web/src/hooks/use-clients.ts`

Acceptance:
- [ ] 5-minute staleTime configured
- [ ] Old fetchClients calls migrated

### Task 2: Implement BroadcastChannel Sync

- Create broadcast-sync.ts with channel
- Sync CLIENT_CHANGED events across tabs
- Handle logout propagation

Files: `apps/web/src/lib/state/broadcast-sync.ts`, `apps/web/src/stores/clientStore.ts`

Acceptance:
- [ ] Client switch syncs to other tabs
- [ ] Logout syncs to all tabs
