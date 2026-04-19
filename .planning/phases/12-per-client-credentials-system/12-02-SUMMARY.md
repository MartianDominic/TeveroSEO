---
phase: 12-per-client-credentials-system
plan: 02
subsystem: oauth-service
tags: [oauth, credentials, api, service, typescript]
dependency_graph:
  requires: [12-01]
  provides: [ClientOAuthService, client_oauth_router, oauth-types]
  affects: [main.py, @tevero/types]
tech_stack:
  added: []
  patterns: [combined-scopes-oauth, magic-link-invite, write-only-credentials]
key_files:
  created:
    - AI-Writer/backend/services/client_oauth_service.py
    - AI-Writer/backend/api/client_oauth.py
    - packages/types/src/oauth.ts
  modified:
    - AI-Writer/backend/main.py
    - packages/types/src/index.ts
decisions:
  - Combined Google OAuth scopes (GSC + GA4 + GBP) in single flow for better UX
  - OAuth state parameter format "type:identifier:random" for flow routing
  - 256-bit entropy tokens via secrets.token_urlsafe(32) producing 43-char strings
  - Write-only token pattern enforced via ConnectionResponse schema
metrics:
  duration: 4m
  completed: 2026-04-19
---

# Phase 12 Plan 02: ClientOAuthService + API Router Summary

Per-client OAuth service layer with magic link generation, combined Google OAuth flow (GSC + GA4 + GBP), encrypted token storage, and REST API endpoints for invite management and connection handling.

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 | feat | c3251789 | Add TypeScript types for OAuth connections and invites |
| 2 | feat | 8ddf3204 | Create ClientOAuthService for per-client OAuth management |
| 3 | feat | 8b0740c7 | Create REST API router for per-client OAuth |
| 4 | feat | 02dec2f7 | Register client_oauth router in main.py |

## What Was Built

### TypeScript Types (packages/types/src/oauth.ts)

Type definitions for frontend consumption:

- `OAuthProvider` - Union type for supported providers
- `OAuthConnection` - Connection metadata (excludes encrypted tokens)
- `InviteResponse` - Magic link creation response
- `InviteValidation` - Public endpoint response for /connect/[token]
- `InviteCreate` - Request payload for invite creation

### ClientOAuthService (AI-Writer/backend/services/client_oauth_service.py)

Service class with 7 core methods:

1. **`__init__`** - Loads Google client config from env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) or gsc_credentials.json fallback. Defines combined scopes.

2. **`create_invite()`** - Generates 256-bit random token (43-char base64url), sets 7-day TTL, inserts ClientConnectInvite row.

3. **`validate_invite()`** - Queries invite WHERE token = ? AND completed_at IS NULL AND expires_at > now.

4. **`get_oauth_url()`** - Builds Google OAuth Flow with combined scopes. State format: "invite:{token}:{random}" or "client:{client_id}:{random}".

5. **`handle_oauth_callback()`** - Parses state, validates invite if applicable, exchanges code for credentials, encrypts tokens with Fernet, upserts ClientOAuthToken.

6. **`get_connections()`** - Returns metadata only (NEVER decrypted tokens). Includes properties relationship.

7. **`revoke_connection()`** - Sets is_active=False for soft-delete with audit trail.

### API Router (AI-Writer/backend/api/client_oauth.py)

6 REST endpoints:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/clients/{client_id}/invites` | POST | Required | Create magic link invite |
| `/api/clients/{client_id}/connections` | GET | Required | List OAuth connections |
| `/api/clients/{client_id}/connections/{provider}` | DELETE | Required | Revoke connection |
| `/api/auth/google/start` | GET | Optional | Start OAuth (auth for direct, none for invite) |
| `/api/auth/google/callback` | GET | None | Handle OAuth callback (public) |
| `/api/invites/{token}/validate` | GET | None | Validate invite (public) |

Pydantic schemas enforce write-only token pattern - ConnectionResponse intentionally excludes access_token and refresh_token.

### Router Registration (main.py)

- Import added at top with other API routers
- Included with `/api` prefix and `client-oauth` tag
- Placed after today_workflow_router (maintains router order)

## Combined Google Scopes

Single OAuth flow requests all three:

```python
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",  # GSC
    "https://www.googleapis.com/auth/analytics.readonly",   # GA4
    "https://www.googleapis.com/auth/business.manage",      # GBP
]
```

## Security Patterns Implemented

1. **Write-only credentials** - Tokens encrypted before storage, never in GET responses
2. **Single-use invites** - `completed_at` set atomically on first use
3. **OAuth state validation** - State includes random component, flow type encoded
4. **7-day invite TTL** - Enforced at query level with `expires_at > now`
5. **256-bit token entropy** - `secrets.token_urlsafe(32)` for invite tokens
6. **Audit trail** - `connected_by` tracks Clerk user ID for all operations

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Verification

- [x] ClientOAuthService class with 7 methods
- [x] Combined Google scopes: webmasters.readonly, analytics.readonly, business.manage
- [x] Invite tokens are 256-bit cryptographically random (43-char base64url)
- [x] OAuth state parameter encodes flow type and identifier
- [x] Tokens encrypted with Fernet before database storage
- [x] 6 API endpoints registered and accessible
- [x] TypeScript types exported from @tevero/types

## Self-Check: PASSED

All created files exist:
- AI-Writer/backend/services/client_oauth_service.py
- AI-Writer/backend/api/client_oauth.py
- packages/types/src/oauth.ts

All commits verified in git log.
