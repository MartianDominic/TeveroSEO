---
phase: 6
title: Clerk + Per-Client Workspace Integration
type: feature
discuss_skipped: true
discuss_skip_reason: All decisions are technical — auth scoping, header passing, client_id validation. No user-facing UX design required beyond existing patterns.
---

# Phase 6 Context: Per-Client Workspace Integration

## Goal

open-seo-main authenticates requests and scopes all audit/keyword data by `client_id` from AI-Writer's client registry.

## Important Discovery

open-seo-main already has `better-auth` with `hosted` mode (email+password + organizations). It does NOT use Clerk. AI-Writer uses a `X-Client-ID` header pattern for client scoping (see `AI-Writer/backend/services/client_context.py`). The requirements mention "Clerk" but the actual implementation should:

1. Leverage the existing `better-auth` `ensureUserMiddleware` for authentication (AUTH-01, AUTH-02)
2. Add `client_id` scoping via `X-Client-ID` header validated against the AI-Writer `clients` table (AUTH-03, AUTH-04)

## Success Criteria

- Unauthenticated requests to open-seo API return 401; authenticated requests with valid session succeed (AUTH-01)
- `userId` and `orgId` available in all open-seo API routes via existing better-auth session (AUTH-02)
- `client_id` passed as `X-Client-ID` header from AI-Writer shell; validated against shared PostgreSQL `clients` table (AUTH-03)
- All open-seo audit/keyword data queries scoped by `client_id` (AUTH-04)

## Requirements Addressed

AUTH-01, AUTH-02, AUTH-03, AUTH-04

## Key Decisions (Claude's Discretion)

### Authentication (AUTH-01, AUTH-02)
- Use existing `ensureUserMiddleware` from `src/middleware/ensureUser.ts` — already handles 401 for unauthenticated requests in `hosted` mode
- No new auth layer needed — better-auth is already wired
- Verify `AUTH_MODE=hosted` is set in `.env.vps.example` and documented

### Client ID Scoping (AUTH-03)
- AI-Writer passes `X-Client-ID: <uuid>` header when embedding open-seo pages
- open-seo-main reads `X-Client-ID` from request headers in server functions
- Validates `client_id` exists in shared PostgreSQL `alwrity` database's `clients` table
- Invalid/missing `client_id` when provided → 403 (not 401, which is for auth)
- Missing `X-Client-ID` → allow request (not all flows require client context; only client-scoped endpoints require it)

### Client ID Validation
- Create `src/server/lib/client-context.ts` — reads `X-Client-ID` header, validates against AI-Writer DB
- AI-Writer DB connection: use same `DATABASE_URL` but `alwrity` database (separate pool or schema-qualified queries)
- Or: add a second `ALWRITY_DATABASE_URL` env var pointing to the `alwrity` PostgreSQL database
- clients table query: `SELECT id FROM clients WHERE id = $1` (simple existence check)
- Cache validation result per request (not across requests — no Redis needed for this)

### Audit Data Scoping (AUTH-04)
- `site_audits` and related tables need `client_id` column (nullable — existing audits have no client)
- Add `client_id` column to `site_audits` table via Drizzle migration
- `GET /api/audits?client_id=X` filters by `client_id`
- If `client_id` provided in query but doesn't match header → 403
- Audits without `client_id` are accessible only to authenticated users (not client-scoped)

### Working Directory
- `open-seo-main/` — all changes here
- Schema migration: `open-seo-main/drizzle/` (new migration file)

### Environment Variables
- `ALWRITY_DATABASE_URL` — connection string for AI-Writer's `alwrity` PostgreSQL database
- Add to `REQUIRED_ENV_CORE` in `src/server/lib/runtime-env.ts` (or `REQUIRED_ENV_HOSTED`)
- Document in `.env.vps.example`

### Wave Structure
- Wave 1: Schema migration (add client_id to site_audits) + client-context lib
- Wave 2: Wire client_id validation into API routes + audit service

### Existing Pattern Reference
- `AI-Writer/backend/services/client_context.py` — X-Client-ID header reading pattern
- `open-seo-main/src/middleware/ensureUser.ts` — existing auth middleware pattern
- `open-seo-main/src/server/features/audit/services/AuditService.ts` — audit service to scope
