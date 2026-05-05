---
phase: 87-agency-business
plan: 01
subsystem: portal
tags: [portal, tokens, authentication, database]
dependency_graph:
  requires: [45-01]
  provides: [portal-tokens-schema, portal-token-service, portal-entry-route]
  affects: [87-02, 87-03, 89-01]
tech_stack:
  added: [nanoid]
  patterns: [token-based-auth, auth-level-routing]
key_files:
  created:
    - open-seo-main/src/db/portal-schema.ts
    - open-seo-main/src/db/client-settings-schema.ts
    - open-seo-main/drizzle/0075_portal_tokens.sql
    - open-seo-main/src/server/services/PortalTokenService.ts
    - open-seo-main/src/routes/api/portal/tokens.ts
    - open-seo-main/src/routes/api/portal/tokens.$clientId.ts
    - open-seo-main/src/routes/api/portal/revoke.$token.ts
    - open-seo-main/src/routes/portal/$token.tsx
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - nanoid 12 chars for URL-safe tokens (~10^21 entropy)
  - Default 30-day token expiry
  - Access tracking updates on every validation
  - Three auth levels matching CLIENT-PORTAL-SPEC.md
metrics:
  duration: 5m
  tasks: 4
  files_created: 8
  files_modified: 1
  tests: 27
  completed: "2026-05-05T17:03:00Z"
---

# Phase 87 Plan 01: Client Portal Foundation Summary

Token-based portal access with three auth levels and database schemas for client settings.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 87f313d | Portal database schemas (portal_tokens, portal_users, client_settings, notification_preferences) |
| 2 | e11d3cf | PortalTokenService with generate/validate/revoke/list methods |
| 3 | 3ed4985 | Portal API routes (POST, GET, DELETE) |
| 4 | cfc7b72 | Portal entry route with auth level routing |

## Implementation Details

### Database Schemas

**portal_tokens**: Shareable access tokens with expiry, revocation, access tracking
- token: varchar(32), nanoid 12 chars
- auth_level: token_only | email_verify | full_login
- expires_at, last_accessed_at, access_count

**portal_users**: Client contacts for email verification and full login
- email, clerk_user_id, email_verified_at

**client_settings**: Per-client configuration
- communication_style: high_touch | hybrid | self_service
- portal_enabled, notifications_enabled (OFF by default)
- keyword_lockin_enabled (ON by default)

**notification_preferences**: Digest and alert settings
- weekly_digest, monthly_report, milestone_alerts
- recipient_emails array

### PortalTokenService

- `generateToken(options)`: Creates nanoid token with configurable expiry
- `validateToken(token)`: Checks expiry/revocation, updates access tracking
- `revokeToken(token)`: Marks token as revoked with timestamp
- `listClientTokens(clientId)`: Returns all tokens for a client

### API Routes

- `POST /api/portal/tokens`: Generate new token (Zod validation)
- `GET /api/portal/tokens/:clientId`: List client tokens
- `DELETE /api/portal/revoke/:token`: Revoke token

### Portal Entry Route

`/portal/:token` validates token on load and routes to:
- `ClientPortalView`: token_only (direct access)
- `EmailVerificationView`: email_verify (OTP first)
- `LoginRequiredView`: full_login (Clerk auth)

Error pages for expired/revoked/not_found tokens.

## Deviations from Plan

None - plan executed exactly as written.

## Test Coverage

- 13 schema tests (portal-schema, client-settings-schema)
- 14 service tests (PortalTokenService)
- Total: 27 tests passing

## Self-Check: PASSED

- [x] portal-schema.ts exists
- [x] client-settings-schema.ts exists
- [x] PortalTokenService.ts exists
- [x] Portal routes exist
- [x] All 4 commits present
