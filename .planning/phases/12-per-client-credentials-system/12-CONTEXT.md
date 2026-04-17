# Phase 12: Per-Client Credentials System - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated

<domain>
## Phase Boundary

Build the per-client OAuth credentials system. Agency staff connect Google (GSC + GA4 + GBP), Bing, and other providers per client — stored encrypted in PostgreSQL against `client_id`, not `user_id`. A magic-link invite page at `/connect/[token]` lets clients self-authorize Google without an account. Connection health visible at `/clients/[clientId]/connections`. Existing per-user GSC/Bing SQLite credentials migrated to per-client PostgreSQL.

</domain>

<decisions>
## Implementation Decisions

### New Database Tables (Alembic migration on AI-Writer FastAPI backend)
```sql
client_oauth_tokens
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
  provider          TEXT NOT NULL  -- 'google' | 'bing' | 'wordpress' | 'shopify' | 'wix'
  access_token      BYTEA NOT NULL  -- Fernet encrypted
  refresh_token     BYTEA           -- Fernet encrypted, nullable
  token_expiry      TIMESTAMPTZ
  scopes            TEXT[]
  connected_by      TEXT NOT NULL   -- Clerk user ID (audit trail)
  connected_at      TIMESTAMPTZ DEFAULT NOW()
  is_active         BOOLEAN DEFAULT TRUE
  UNIQUE(client_id, provider)

client_oauth_properties
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
  token_id          UUID NOT NULL REFERENCES client_oauth_tokens(id) ON DELETE CASCADE
  key               TEXT NOT NULL   -- 'gsc_site_url' | 'ga4_property_id' | 'gbp_location_id'
  value             TEXT NOT NULL

client_connect_invites
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
  token             TEXT UNIQUE NOT NULL  -- 32-char random, URL-safe
  created_by        TEXT NOT NULL         -- Clerk user ID
  expires_at        TIMESTAMPTZ NOT NULL  -- created_at + 7 days
  completed_at      TIMESTAMPTZ           -- NULL = not yet used
  scopes_requested  TEXT[]               -- which providers to ask for
```

### Google OAuth
- One OAuth 2.0 flow covers GSC + GA4 + GBP via combined scopes:
  - `https://www.googleapis.com/auth/webmasters.readonly`
  - `https://www.googleapis.com/auth/analytics.readonly`
  - `https://www.googleapis.com/auth/business.manage`
- Existing `gsc_service.py` OAuth flow extended to support per-client storage
- After OAuth callback: store tokens in `client_oauth_tokens` with `provider='google'`
- Store site URL, GA4 property ID, GBP location ID in `client_oauth_properties`

### Magic Link Flow
1. Agency staff clicks "Send invite" on `/clients/[clientId]/connections`
2. POST `/api/clients/{client_id}/invites` → creates `client_connect_invites` row, returns `token`
3. App shows shareable URL: `https://app.tevero.lt/connect/{token}`
4. Client visits URL (no login required) — Next.js renders branded `/connect/[token]/page.tsx`
5. Client clicks "Connect with Google" → OAuth redirect with `state={token}`
6. OAuth callback at `/api/auth/google/callback?code=...&state={token}` — validates token, stores credentials, marks `completed_at`
7. Client sees success page

### UI at `/clients/[clientId]/connections`
- Card per provider: Google (GSC+GA4+GBP), Bing, WordPress, Shopify, Wix
- Status: Connected ✓ (with connected-by, date, site URL) | Not connected (with Connect / Send invite buttons)
- Reconnect button for expired tokens
- For direct OAuth (agency staff): "Connect Google" opens OAuth popup/redirect immediately
- For client invite: "Send invite link" generates magic link, copies to clipboard

### Credential Migration
- Existing per-user GSC credentials in `gsc_credentials` SQLite → migrate to `client_oauth_tokens` per client
- Migration script: for each user who has GSC credentials, look up their most recently active client, store there
- Bing similarly
- Migration is best-effort (1:1 user→client not always deterministic) — show migration status to admin

### Encryption
- Continue using existing Fernet encryption from `AI-Writer/backend/services/encryption.py`
- Same `ENCRYPTION_KEY` env var
- `access_token` and `refresh_token` stored as BYTEA (encrypted bytes)

### Claude's Discretion
- Whether `/connect/[token]` page is in `apps/web` (Next.js) or a separate lightweight handler
- Exact design of the invite page (Tevero branding vs white-label)
- Whether to support multi-provider invite (one link authorizes Google + Bing) or single-provider per link

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AI-Writer/backend/services/gsc_service.py` — existing OAuth flow; extend for per-client storage
- `AI-Writer/backend/services/encryption.py` — Fernet encryption; reuse directly
- `AI-Writer/backend/services/integrations/bing_oauth.py` — extend for per-client storage
- `AI-Writer/backend/api/clients.py` — add new invite + connection endpoints here
- Existing `client_settings` table pattern — follow same upsert pattern

### Established Patterns
- Write-only credential pattern: accept plaintext in POST, encrypt before storage, never return in GET
- Alembic migrations: `AI-Writer/backend/alembic/versions/` — add new migration file
- OAuth state validation: state parameter tied to user/token for CSRF prevention

### Integration Points
- `apps/web` `/clients/[clientId]/connections` page calls FastAPI at `http://ai-writer-backend:8000`
- `/connect/[token]` page in apps/web is public (no Clerk auth required)
- OAuth callback hits FastAPI directly (or via Next.js API route that proxies)

</code_context>

<specifics>
## Specific Ideas

- One Google OAuth covers GSC + GA4 + GBP — huge UX win for clients
- Magic link is 7-day TTL, single-use — secure enough for OAuth delegation
- `client_oauth_tokens` has UNIQUE(client_id, provider) — one active token per provider per client
- Branded invite page at /connect/[token] — no Tevero account needed

</specifics>

<deferred>
## Deferred Ideas

- Multi-provider single invite link — post v2.0
- White-label invite page (agency logo) — post v2.0
- Webhook notifications when client connects — post v2.0
- Automated invite resend on expiry — post v2.0

</deferred>
