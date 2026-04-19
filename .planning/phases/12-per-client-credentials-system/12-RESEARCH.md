# Phase 12: Per-Client Credentials System - Research

**Researched:** 2026-04-19
**Domain:** OAuth 2.0 credential management, magic link authentication, encrypted token storage
**Confidence:** HIGH

## Summary

Phase 12 builds a per-client OAuth credentials system enabling agency staff to connect Google (GSC + GA4 + GBP), Bing, and other providers against `client_id` rather than `user_id`. The existing per-user SQLite credential storage (in `gsc_service.py` and `bing_oauth.py`) migrates to a unified `client_oauth_tokens` table in PostgreSQL with Fernet encryption.

The magic-link invite flow at `/connect/[token]` allows clients to self-authorize Google without needing a Tevero account. This is a standard passwordless delegation pattern where a cryptographically random token with 7-day TTL acts as a bearer credential for a specific OAuth operation.

**Primary recommendation:** Extend the existing `gsc_service.py` OAuth flow to support per-client storage by adding a `client_id` parameter, then create a new `/connect/[token]` page in `apps/web` that initiates OAuth with `state={token}` for callback routing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New database tables (`client_oauth_tokens`, `client_oauth_properties`, `client_connect_invites`) via Alembic migration on AI-Writer FastAPI backend
- Google OAuth: One flow covers GSC + GA4 + GBP via combined scopes
- Magic link flow: 7-day TTL, single-use, `/connect/{token}` URL
- Encryption: Continue using existing Fernet encryption from `AI-Writer/backend/services/encryption.py`
- UI at `/clients/[clientId]/connections`: Card per provider with status, reconnect, invite buttons
- `UNIQUE(client_id, provider)` constraint on `client_oauth_tokens`

### Claude's Discretion
- Whether `/connect/[token]` page is in `apps/web` (Next.js) or a separate lightweight handler
- Exact design of the invite page (Tevero branding vs white-label)
- Whether to support multi-provider invite (one link authorizes Google + Bing) or single-provider per link

### Deferred Ideas (OUT OF SCOPE)
- Multi-provider single invite link -- post v2.0
- White-label invite page (agency logo) -- post v2.0
- Webhook notifications when client connects -- post v2.0
- Automated invite resend on expiry -- post v2.0
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CREDS-01 | `client_oauth_tokens` table created via Alembic | Alembic migration pattern from existing migrations; GUID type from `models/client.py` |
| CREDS-02 | `client_connect_invites` table for magic link tokens | Standard token-based auth pattern with cryptographically random 32-char tokens |
| CREDS-03 | `client_oauth_properties` table for GSC site URL, GA4 property ID, GBP location | FK to `client_oauth_tokens(id)` with ON DELETE CASCADE |
| CREDS-04 | Google OAuth combines GSC + GA4 + GBP scopes in single flow | Verified: space-separated scopes work; scopes listed below |
| CREDS-05 | Fernet encryption for access_token and refresh_token | Existing `encryption.py` with `encrypt_value()` / `decrypt_value()` |
| CREDS-06 | Magic link `/connect/[token]` page public (no auth) | Middleware already allows `/connect/(.*)` as public route |
| CREDS-07 | OAuth callback validates invite token from state param | Standard OAuth state parameter pattern; token lookup before storing credentials |
| CREDS-08 | `/clients/[id]/connections` UI shows provider cards | Follow existing settings page pattern with StatusChip component |
| CREDS-09 | Reconnect button for expired tokens | Token refresh flow using refresh_token; fall back to re-auth |
| CREDS-10 | Migration script: per-user GSC/Bing credentials to per-client | Best-effort migration from SQLite to PostgreSQL |
| CREDS-11 | Audit trail: `connected_by` stores Clerk user ID | Standard audit pattern; Clerk user_id from auth middleware |
| CREDS-12 | Invite expiry at 7 days with single-use enforcement | `completed_at` NULL = unused; set on completion |
| CREDS-13 | Clear error page for expired/invalid tokens | User-friendly error handling, not 500 |
| CREDS-14 | Tokens stored against `client_id`, not `user_id` | Core architectural change; FK to `clients(id)` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OAuth credential storage | Database (PostgreSQL) | -- | Encrypted tokens persist in `client_oauth_tokens` |
| OAuth flow initiation | API (FastAPI) | -- | Server-side OAuth flows prevent credential exposure |
| OAuth callback handling | API (FastAPI) | -- | Token exchange must happen server-side |
| Magic link generation | API (FastAPI) | -- | Cryptographic token generation requires server |
| Magic link page render | Frontend (Next.js) | -- | `/connect/[token]` is a Next.js App Router page |
| Connection status UI | Frontend (Next.js) | -- | Client-side rendering with server data |
| Token encryption/decryption | API (FastAPI) | -- | Fernet key lives server-side only |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-auth | 2.49.2 | Google OAuth2 credential management | [VERIFIED: requirements.txt] Official Google library, handles token refresh |
| google-auth-oauthlib | 1.3.1 | OAuth2 flow for Google APIs | [VERIFIED: requirements.txt] Provides Flow class for authorization |
| google-api-python-client | 2.194.0 | Google API service builders | [VERIFIED: requirements.txt] Required for GSC, GA4, GBP API calls |
| cryptography | 46.0.7 | Fernet symmetric encryption | [VERIFIED: requirements.txt] Already in use for CMS credentials |
| secrets (stdlib) | 3.x | Cryptographic random token generation | [VERIFIED: Python stdlib] Used in existing `gsc_service.py` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sqlalchemy | 2.x | ORM for `client_oauth_tokens` model | [VERIFIED: codebase] Existing pattern in `models/client.py` |
| alembic | 1.x | Database migrations | [VERIFIED: codebase] Existing migration infrastructure |
| pydantic | 2.x | Request/response validation | [VERIFIED: codebase] Existing pattern in `api/clients.py` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fernet | AES-GCM via PyNaCl | More control, but Fernet is already established in codebase |
| SQLAlchemy GUID | Native PostgreSQL UUID | GUID type already exists in `models/client.py`, cross-DB compatible |
| Per-row encryption | Column-level encryption (pgcrypto) | Fernet at app layer is simpler, already implemented |

**Installation:** No new packages needed -- all dependencies already in requirements.txt.

**Version verification:**
- cryptography 46.0.7 [VERIFIED: 2026-04-19 via requirements.txt]
- google-auth 2.49.2 [VERIFIED: 2026-04-19 via requirements.txt]
- google-auth-oauthlib 1.3.1 [VERIFIED: 2026-04-19 via requirements.txt]

## Architecture Patterns

### System Architecture Diagram

```
                                    +-------------------+
                                    |   Agency Staff    |
                                    +--------+----------+
                                             |
                     +------------------+    |    +------------------+
                     | Direct Connect   |<---+--->| Send Invite Link |
                     +--------+---------+         +--------+---------+
                              |                            |
                              v                            v
                     +--------+---------+         +--------+---------+
                     | OAuth Flow       |         | Generate Token   |
                     | (with client_id) |         | (32-char random) |
                     +--------+---------+         +--------+---------+
                              |                            |
                              |                            v
                              |                   +--------+---------+
                              |                   | Store in         |
                              |                   | client_connect_  |
                              |                   | invites          |
                              |                   +--------+---------+
                              |                            |
                              |                            v
                              |                   +--------+---------+
                              |                   | Share URL with   |
                              |                   | client via email |
                              |                   +------------------+
                              |
                              |                            |
                              |                            v
                              |                   +--------+---------+
                              |                   | Client visits    |
                              |                   | /connect/[token] |
                              |                   +--------+---------+
                              |                            |
                              |                            v
                              |                   +--------+---------+
                              |                   | OAuth Flow       |
                              |                   | state={token}    |
                              +<-------------------+--------+---------+
                              |
                              v
                     +--------+---------+
                     | Google OAuth     |
                     | Consent Screen   |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Callback:        |
                     | /api/auth/google |
                     | /callback        |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Validate state:  |
                     | - If token: look |
                     |   up invite,     |
                     |   get client_id  |
                     | - If client_id:  |
                     |   direct flow    |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Exchange code    |
                     | for tokens       |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Encrypt tokens   |
                     | (Fernet)         |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Store in         |
                     | client_oauth_    |
                     | tokens           |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Fetch properties |
                     | (site URLs, etc) |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Store in         |
                     | client_oauth_    |
                     | properties       |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Redirect to      |
                     | success page     |
                     +------------------+
```

### Recommended Project Structure
```
AI-Writer/backend/
├── alembic/versions/
│   └── 0012_create_client_oauth_tables.py    # New migration
├── models/
│   └── client_oauth.py                        # ORM models for 3 tables
├── services/
│   └── client_oauth_service.py               # Per-client OAuth logic
├── api/
│   └── clients.py                            # Add invite + connection endpoints

apps/web/src/app/
├── connect/
│   └── [token]/
│       └── page.tsx                          # Magic link landing page
├── api/
│   └── auth/
│       └── google/
│           └── callback/
│               └── route.ts                  # OAuth callback handler (or proxy to FastAPI)
├── (shell)/clients/[clientId]/
│   └── connections/
│       └── page.tsx                          # Connection status UI
```

### Pattern 1: Per-Client OAuth with State Parameter
**What:** Use OAuth state parameter to carry either `client_id` (direct flow) or `invite_token` (magic link flow)
**When to use:** All OAuth initiations for per-client credentials
**Example:**
```python
# Source: Existing gsc_service.py pattern extended
def get_oauth_url(self, client_id: str, invite_token: str = None) -> str:
    """Generate OAuth URL with client context in state."""
    random_state = secrets.token_urlsafe(32)
    
    if invite_token:
        # Magic link flow: state carries invite token
        state = f"invite:{invite_token}:{random_state}"
    else:
        # Direct flow: state carries client_id
        state = f"client:{client_id}:{random_state}"
    
    flow = Flow.from_client_config(
        self.client_config,
        scopes=self.scopes,
        redirect_uri=redirect_uri
    )
    
    authorization_url, _ = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=state
    )
    return authorization_url
```

### Pattern 2: Combined Google Scopes
**What:** Single OAuth consent screen for GSC + GA4 + GBP access
**When to use:** Google OAuth initiation
**Example:**
```python
# Source: Google OAuth2 Scopes documentation
# https://developers.google.com/identity/protocols/oauth2/scopes
GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/webmasters.readonly',  # GSC
    'https://www.googleapis.com/auth/analytics.readonly',   # GA4
    'https://www.googleapis.com/auth/business.manage',      # GBP
]

# Multiple scopes in single authorization request
flow = Flow.from_client_config(
    client_config,
    scopes=GOOGLE_SCOPES,  # Space-joined internally
    redirect_uri=redirect_uri
)
```
[VERIFIED: Google OAuth documentation confirms space-separated scopes work]

### Pattern 3: Magic Link Token Generation
**What:** Cryptographically secure, time-limited, single-use token
**When to use:** Generating invite links for client self-authorization
**Example:**
```python
# Source: Python secrets module + magic link best practices
import secrets
from datetime import datetime, timedelta

def create_invite(client_id: str, created_by: str, scopes: list[str]) -> dict:
    """Create a magic link invite token."""
    token = secrets.token_urlsafe(32)  # 256-bit entropy
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    invite = ClientConnectInvite(
        client_id=client_id,
        token=token,
        created_by=created_by,
        expires_at=expires_at,
        scopes_requested=scopes,
    )
    db.add(invite)
    db.commit()
    
    return {
        "token": token,
        "url": f"https://app.tevero.lt/connect/{token}",
        "expires_at": expires_at.isoformat(),
    }
```
[CITED: Magic link security best practices - 256-bit tokens, 7-30 day expiry industry standard]

### Pattern 4: Encrypted Token Storage
**What:** Fernet encryption for OAuth tokens before PostgreSQL storage
**When to use:** Storing access_token and refresh_token
**Example:**
```python
# Source: Existing encryption.py pattern
from services.encryption import encrypt_value, decrypt_value

def store_oauth_token(client_id: str, provider: str, access_token: str, 
                      refresh_token: str, connected_by: str):
    """Store encrypted OAuth tokens against client_id."""
    token_record = ClientOAuthToken(
        client_id=client_id,
        provider=provider,
        access_token=encrypt_value(access_token),      # BYTEA
        refresh_token=encrypt_value(refresh_token) if refresh_token else None,
        connected_by=connected_by,
        is_active=True,
    )
    db.merge(token_record)  # Upsert due to UNIQUE(client_id, provider)
    db.commit()
```
[VERIFIED: Existing `encryption.py` uses this exact pattern for WordPress credentials]

### Anti-Patterns to Avoid
- **Storing tokens unencrypted:** OAuth tokens are credentials; must be encrypted at rest
- **Returning encrypted tokens to frontend:** Write-only pattern; never expose tokens in GET responses
- **Using `user_id` for credential lookup:** This phase transitions to `client_id`; do not mix
- **Long-lived invite tokens:** 7-day max; single-use; set `completed_at` on consumption
- **OAuth state without validation:** Always store and validate state to prevent CSRF

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random token generation | Math.random() or UUID | `secrets.token_urlsafe(32)` | Cryptographically secure, 256-bit entropy |
| Token encryption | Custom AES wrapper | `cryptography.fernet.Fernet` | Already in codebase, proven secure |
| OAuth flow | Manual HTTP requests | `google-auth-oauthlib.Flow` | Handles PKCE, state, token exchange correctly |
| Token refresh | Manual refresh logic | `google.oauth2.credentials.Credentials.refresh()` | Handles edge cases, retry logic |

**Key insight:** OAuth is deceptively complex -- token refresh, scope increments, consent revocation, and error handling have many edge cases. The official Google libraries handle these; custom implementations invariably miss edge cases.

## Common Pitfalls

### Pitfall 1: OAuth State Parameter Validation
**What goes wrong:** Attacker can replay or forge OAuth callbacks without state validation
**Why it happens:** State stored in session/cookie but not validated against callback
**How to avoid:** Store state in database tied to client_id/token; validate before token exchange
**Warning signs:** OAuth callback accepts any state value; no database lookup

### Pitfall 2: Refresh Token Not Stored
**What goes wrong:** Google only returns refresh_token on first consent; subsequent re-auths don't include it
**Why it happens:** Forgetting to store refresh_token when initially granted
**How to avoid:** Always request `prompt='consent'` for magic link flows; store refresh_token immediately
**Warning signs:** `refresh_token` is None after callback; token expires with no way to refresh

### Pitfall 3: Invite Token Reuse
**What goes wrong:** Same invite link used multiple times, potentially by different people
**Why it happens:** Not setting `completed_at` on first use; not checking it before authorization
**How to avoid:** Atomic check-and-set: `WHERE token = ? AND completed_at IS NULL`
**Warning signs:** Multiple OAuth callbacks for same invite token

### Pitfall 4: Migration Data Loss
**What goes wrong:** Per-user credentials lost during migration to per-client
**Why it happens:** 1:1 user-to-client mapping not always deterministic
**How to avoid:** Best-effort migration with logging; show migration status to admin; allow manual fixup
**Warning signs:** Users report "disconnected" status after migration for previously connected accounts

### Pitfall 5: Scope Mismatch After Migration
**What goes wrong:** Tokens have GSC scope but analytics queries fail
**Why it happens:** Old tokens don't include new GA4/GBP scopes; scope check passes but API fails
**How to avoid:** Check `scopes` column; prompt reconnect if missing required scopes
**Warning signs:** API returns 403 despite valid token; scope mismatch in error response

### Pitfall 6: Bing Refresh Token Rotation
**What goes wrong:** Bing rotates refresh tokens on every use; if you reuse the old one, you get `invalid_grant`
**Why it happens:** Bing's OAuth implementation differs from Google's (which keeps refresh tokens stable)
**How to avoid:** After every successful Bing token refresh, UPDATE the refresh_token column with the new value
**Warning signs:** `invalid_grant` errors after previously working refresh
**Source:** [CITED: Microsoft Bing Webmaster OAuth docs](https://learn.microsoft.com/en-us/bingwebmaster/oauth2)

## Code Examples

Verified patterns from official sources:

### Alembic Migration for New Tables
```python
# Source: Existing alembic pattern from 0001_create_clients_and_client_settings_tables.py
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    op.create_table(
        "client_oauth_tokens",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column("client_id", sa.CHAR(36), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("access_token", sa.LargeBinary(), nullable=False),
        sa.Column("refresh_token", sa.LargeBinary(), nullable=True),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scopes", sa.ARRAY(sa.Text()), nullable=True),
        sa.Column("connected_by", sa.Text(), nullable=False),
        sa.Column("connected_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.UniqueConstraint("client_id", "provider", name="uq_client_oauth_tokens_client_provider"),
    )
    
    op.create_table(
        "client_oauth_properties",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column("token_id", sa.CHAR(36), sa.ForeignKey("client_oauth_tokens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
    )
    
    op.create_table(
        "client_connect_invites",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column("client_id", sa.CHAR(36), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.Text(), unique=True, nullable=False),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scopes_requested", sa.ARRAY(sa.Text()), nullable=True),
    )
    
    # Index for fast token lookup
    op.create_index("ix_client_connect_invites_token", "client_connect_invites", ["token"])
```

### OAuth Callback Handler (FastAPI)
```python
# Source: Existing gsc_service.py callback pattern, extended
@router.get("/auth/google/callback")
def google_oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_shared_db),
    current_user: dict = Depends(get_current_user_optional),  # Optional for invite flow
):
    """Handle Google OAuth callback for both direct and invite flows."""
    
    # Parse state to determine flow type
    parts = state.split(":")
    if len(parts) < 2:
        raise HTTPException(400, "Invalid state parameter")
    
    flow_type = parts[0]
    
    if flow_type == "invite":
        # Magic link flow: validate invite token
        invite_token = parts[1]
        invite = db.query(ClientConnectInvite).filter(
            ClientConnectInvite.token == invite_token,
            ClientConnectInvite.completed_at.is_(None),
            ClientConnectInvite.expires_at > datetime.utcnow(),
        ).first()
        
        if not invite:
            raise HTTPException(400, "Invalid or expired invite link")
        
        client_id = invite.client_id
        connected_by = invite.created_by  # Audit: who sent the invite
        
        # Mark invite as used
        invite.completed_at = datetime.utcnow()
        
    elif flow_type == "client":
        # Direct flow: validate client_id
        if not current_user:
            raise HTTPException(401, "Authentication required for direct connection")
        client_id = parts[1]
        connected_by = current_user["user_id"]
    else:
        raise HTTPException(400, "Unknown flow type")
    
    # Exchange code for tokens
    flow = Flow.from_client_config(...)
    flow.fetch_token(code=code)
    credentials = flow.credentials
    
    # Encrypt and store
    store_oauth_token(
        client_id=client_id,
        provider="google",
        access_token=credentials.token,
        refresh_token=credentials.refresh_token,
        token_expiry=credentials.expiry,
        scopes=list(credentials.scopes),
        connected_by=connected_by,
        db=db,
    )
    
    db.commit()
    
    # Redirect to success page
    if flow_type == "invite":
        return RedirectResponse("/connect/success")
    else:
        return RedirectResponse(f"/clients/{client_id}/connections?connected=google")
```

### Next.js Magic Link Page
```typescript
// Source: Next.js App Router pattern
// apps/web/src/app/connect/[token]/page.tsx

import { notFound, redirect } from "next/navigation";

async function validateInvite(token: string) {
  const res = await fetch(
    `${process.env.AI_WRITER_BACKEND_URL}/api/invites/${token}/validate`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function ConnectPage({
  params,
}: {
  params: { token: string };
}) {
  const invite = await validateInvite(params.token);
  
  if (!invite) {
    // Render error page, not 404 (more user-friendly)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Link Expired or Invalid</h1>
          <p className="mt-2 text-muted-foreground">
            This invite link has expired or has already been used.
            Please contact your agency for a new link.
          </p>
        </div>
      </div>
    );
  }
  
  // Show connect page with client name and requested providers
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Connect Your Accounts</h1>
        <p className="mt-2 text-muted-foreground">
          {invite.client_name} has invited you to connect your Google accounts.
        </p>
        <a
          href={`${process.env.NEXT_PUBLIC_AI_WRITER_URL}/api/auth/google/start?token=${params.token}`}
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-primary-foreground"
        >
          Connect with Google
        </a>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-user SQLite credentials | Per-client PostgreSQL credentials | This phase | Credentials tied to client, not user; enables team access |
| Separate GSC + GA4 + GBP OAuth flows | Combined scopes in single flow | Always possible | One consent screen; better UX for clients |
| Password-based invite | Magic link with cryptographic token | Industry standard since 2020 | No password to manage; time-limited; single-use |

**Deprecated/outdated:**
- `google.oauth2.credentials.Credentials` with plain JSON storage: Use encrypted storage
- SQLite for credentials: Moving to PostgreSQL for all shared data
- `user_id` based credential lookup: Now `client_id` based
- `plus.business.manage` scope: Use `business.manage` instead [CITED: Google OAuth docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google allows combining GSC + GA4 + GBP scopes in single OAuth flow | Architecture Patterns | Would need separate OAuth flows per service |
| A2 | Fernet encryption key (`FERNET_KEY`) already configured in production | Code Examples | Would need key generation + deployment |
| A3 | Existing `clients` table has sufficient data to map migrated credentials | Common Pitfalls | Migration might orphan some credentials |

**Note:** A1 is verified per [Google OAuth2 Scopes documentation](https://developers.google.com/identity/protocols/oauth2/scopes) -- multiple scopes can be requested in a single authorization. A2 is verified by existing WordPress credential encryption in production. A3 is a known risk called out in CONTEXT.md as "best-effort migration."

## Open Questions

1. **GA4 property selection UI**
   - What we know: After Google OAuth, we can list GA4 properties via Admin API
   - What's unclear: Should property selection happen during OAuth callback or as a separate step?
   - Recommendation: Fetch properties immediately after OAuth; store primary property; allow change in settings

2. **GBP location selection**
   - What we know: GBP can have multiple locations per account
   - What's unclear: How to handle multi-location businesses?
   - Recommendation: Start with single location selection; store location_id in `client_oauth_properties`

3. **Token refresh scheduling**
   - What we know: Google access tokens expire in 1 hour; refresh tokens are long-lived
   - What's unclear: Should we proactively refresh or refresh on demand?
   - Recommendation: Refresh on demand when token is expired; Phase 13 (Analytics Data Layer) will add scheduled refresh

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Token storage | Yes | 15.x | -- |
| google-auth-oauthlib | OAuth flow | Yes | 1.3.1 | -- |
| cryptography | Fernet encryption | Yes | 46.0.7 | -- |
| FERNET_KEY env var | Token encryption | Yes (prod) | -- | Generate new key |
| GOOGLE_CLIENT_ID | OAuth | Yes | -- | Existing GSC config |
| GOOGLE_CLIENT_SECRET | OAuth | Yes | -- | Existing GSC config |

**Missing dependencies with no fallback:** None -- all dependencies already in place.

**Missing dependencies with fallback:**
- Bing credentials (BING_CLIENT_ID, BING_CLIENT_SECRET) -- optional; UI hides Bing option if not configured

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (Python backend) |
| Config file | None detected -- see Wave 0 |
| Quick run command | `pytest AI-Writer/backend/tests/ -x -v` |
| Full suite command | `pytest AI-Writer/backend/tests/ -v --tb=short` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CREDS-01 | client_oauth_tokens table created | integration | `alembic upgrade head && alembic current` | Pending Wave 0 |
| CREDS-02 | client_connect_invites table created | integration | `alembic upgrade head` | Pending Wave 0 |
| CREDS-05 | Tokens encrypted before storage | unit | `pytest tests/test_client_oauth.py::test_token_encryption -x` | Pending Wave 0 |
| CREDS-06 | Magic link token format 32-char URL-safe | unit | `pytest tests/test_client_oauth.py::test_invite_token_format -x` | Pending Wave 0 |
| CREDS-07 | OAuth callback validates state | integration | `pytest tests/test_client_oauth.py::test_callback_validates_state -x` | Pending Wave 0 |
| CREDS-12 | Single-use enforcement | integration | `pytest tests/test_client_oauth.py::test_invite_single_use -x` | Pending Wave 0 |
| CREDS-14 | UNIQUE(client_id, provider) enforced | integration | `pytest tests/test_client_oauth.py::test_unique_constraint -x` | Pending Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest AI-Writer/backend/tests/test_client_oauth.py -x -v`
- **Per wave merge:** `pytest AI-Writer/backend/tests/ -v --tb=short`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `AI-Writer/backend/tests/test_client_oauth.py` -- covers CREDS-05, CREDS-06, CREDS-07, CREDS-12, CREDS-14
- [ ] `AI-Writer/backend/tests/conftest.py` -- shared fixtures (test database, mock encryption key)
- [ ] pytest.ini or pyproject.toml `[tool.pytest.ini_options]` -- test configuration

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Magic link tokens; OAuth state validation |
| V3 Session Management | No | Not session-based; token-per-request |
| V4 Access Control | Yes | Clerk auth for direct flow; invite validation for magic link |
| V5 Input Validation | Yes | Pydantic schemas for all API endpoints |
| V6 Cryptography | Yes | Fernet (AES-128-CBC + HMAC-SHA256) for token storage |

### Known Threat Patterns for OAuth + Magic Links

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OAuth CSRF | Spoofing | State parameter validation; database-backed state storage |
| Token replay | Tampering | Single-use enforcement via `completed_at` column |
| Token brute force | Spoofing | 256-bit entropy; rate limiting on validation endpoint |
| Credential exfiltration | Information Disclosure | Fernet encryption at rest; write-only API pattern |
| Invite link forwarding | Elevation of Privilege | Single-use; 7-day expiry; audit trail via `connected_by` |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: requirements.txt] google-auth 2.49.2, google-auth-oauthlib 1.3.1, cryptography 46.0.7
- [VERIFIED: codebase] `AI-Writer/backend/services/encryption.py` -- Fernet pattern
- [VERIFIED: codebase] `AI-Writer/backend/services/gsc_service.py` -- existing OAuth flow
- [VERIFIED: codebase] `AI-Writer/backend/services/integrations/bing_oauth.py` -- per-user Bing OAuth
- [VERIFIED: codebase] `apps/web/src/middleware.ts` -- `/connect/(.*)` already public

### Secondary (MEDIUM confidence)
- [CITED: https://developers.google.com/identity/protocols/oauth2/scopes] Google OAuth2 scopes documentation
- [CITED: https://developers.google.com/webmaster-tools/v1/how-tos/authorizing] GSC authorization
- [CITED: https://developers.google.com/my-business/content/implement-oauth] GBP OAuth implementation
- [CITED: https://developers.google.com/analytics/devguides/reporting/data/v1] GA4 Data API
- [CITED: https://learn.microsoft.com/en-us/bingwebmaster/oauth2] Bing Webmaster OAuth2

### Tertiary (LOW confidence)
- None -- all critical claims verified against official sources or codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed and verified
- Architecture: HIGH -- extends existing OAuth patterns with clear state management
- Pitfalls: HIGH -- based on common OAuth/magic-link issues documented in security literature

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days -- OAuth standards are stable)
