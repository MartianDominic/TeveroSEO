# Phase 12: Per-Client Credentials System - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `AI-Writer/backend/alembic/versions/0012_create_client_oauth_tables.py` | migration | batch | `0001_create_clients_and_client_settings_tables.py` | exact |
| `AI-Writer/backend/models/client_oauth.py` | model | CRUD | `models/client.py` | exact |
| `AI-Writer/backend/services/client_oauth_service.py` | service | request-response | `services/gsc_service.py` + `services/encryption.py` | exact |
| `AI-Writer/backend/api/client_oauth.py` | controller | request-response | `api/clients.py` | exact |
| `apps/web/src/app/connect/[token]/page.tsx` | page | request-response | `app/sign-in/[[...sign-in]]/page.tsx` | role-match |
| `apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx` | page | CRUD | `app/(shell)/clients/[clientId]/settings/page.tsx` | exact |
| `apps/web/src/app/api/invites/[token]/validate/route.ts` | api-route | request-response | `app/api/clients/[clientId]/route.ts` | exact |
| `apps/web/src/lib/clientOAuth.ts` | utility | request-response | `lib/server-fetch.ts` + `lib/clientSettings.ts` | exact |
| `AI-Writer/backend/scripts/migrate_credentials.py` | script | batch | N/A (one-time migration) | no-analog |
| `packages/types/src/oauth.ts` | types | N/A | `packages/types/src/index.ts` | exact |

## Pattern Assignments

### `AI-Writer/backend/alembic/versions/0012_create_client_oauth_tables.py` (migration, batch)

**Analog:** `AI-Writer/backend/alembic/versions/0001_create_clients_and_client_settings_tables.py`

**Imports pattern** (lines 1-8):
```python
"""create_client_oauth_tables

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
```

**Revision metadata pattern** (lines 10-14):
```python
revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
```

**Table creation pattern with FK and constraints** (lines 20-39):
```python
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
```

**Index creation pattern** (from `0007_create_client_analytics_snapshots.py` line 28):
```python
op.create_index('ix_client_connect_invites_token', 'client_connect_invites', ['token'])
```

**Downgrade pattern** (lines 69-71):
```python
def downgrade() -> None:
    op.drop_table("client_connect_invites")
    op.drop_table("client_oauth_properties")
    op.drop_table("client_oauth_tokens")
```

---

### `AI-Writer/backend/models/client_oauth.py` (model, CRUD)

**Analog:** `AI-Writer/backend/models/client.py`

**Imports pattern** (lines 1-26):
```python
"""
ORM models for per-client OAuth credentials.

All models live on SharedBase (shared PostgreSQL).
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    ARRAY,
)
from sqlalchemy.orm import relationship

from services.shared_db import SharedBase
```

**GUID type import** (line 23 of client.py):
```python
# Import GUID from models/client.py to reuse cross-DB compatible UUID type
from models.client import GUID, _utcnow
```

**Model definition pattern** (lines 65-87):
```python
class ClientOAuthToken(SharedBase):
    __tablename__ = "client_oauth_tokens"
    __table_args__ = (
        UniqueConstraint("client_id", "provider", name="uq_client_oauth_tokens_client_provider"),
    )

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        GUID(),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider = Column(Text, nullable=False)
    access_token = Column(LargeBinary, nullable=False)  # Fernet encrypted
    refresh_token = Column(LargeBinary, nullable=True)  # Fernet encrypted
    token_expiry = Column(DateTime(timezone=True), nullable=True)
    scopes = Column(ARRAY(Text), nullable=True)
    connected_by = Column(Text, nullable=False)  # Clerk user ID
    connected_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    is_active = Column(Boolean, nullable=False, default=True)

    client = relationship("Client", backref="oauth_tokens")
    properties = relationship("ClientOAuthProperty", back_populates="token", cascade="all, delete-orphan")
```

---

### `AI-Writer/backend/services/client_oauth_service.py` (service, request-response)

**Analog:** `AI-Writer/backend/services/gsc_service.py` + `AI-Writer/backend/services/encryption.py`

**Imports pattern** (from gsc_service.py lines 1-16):
```python
"""Per-client OAuth Service for agency credentials."""

import os
import secrets
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from loguru import logger
from sqlalchemy.orm import Session

from services.encryption import encrypt_value, decrypt_value
from models.client_oauth import ClientOAuthToken, ClientOAuthProperty, ClientConnectInvite
```

**OAuth URL generation pattern** (from gsc_service.py lines 236-284):
```python
def get_oauth_url(self, client_id: str, invite_token: Optional[str] = None) -> str:
    """Generate OAuth authorization URL with client context in state."""
    if not self.client_config:
        raise ValueError("OAuth client configuration not loaded")

    redirect_uri = os.getenv('OAUTH_REDIRECT_URI', 'http://localhost:8000/api/auth/google/callback')
    
    flow = Flow.from_client_config(
        self.client_config,
        scopes=self.scopes,
        redirect_uri=redirect_uri
    )
    
    # State format: type:identifier:random
    random_state = secrets.token_urlsafe(32)
    if invite_token:
        state = f"invite:{invite_token}:{random_state}"
    else:
        state = f"client:{client_id}:{random_state}"
    
    authorization_url, _ = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=state
    )
    
    logger.info(f"OAuth URL generated for {'invite' if invite_token else 'client'}: {client_id or invite_token}")
    return authorization_url
```

**OAuth callback handling pattern** (from gsc_service.py lines 286-336):
```python
def handle_oauth_callback(self, code: str, state: str, db: Session) -> bool:
    """Handle OAuth callback and store encrypted credentials."""
    logger.info(f"Handling OAuth callback with state: {state[:20]}...")
    
    # Parse state to determine flow type
    parts = state.split(':')
    if len(parts) < 2:
        logger.error(f"Invalid state format: {state}")
        return False
    
    flow_type = parts[0]
    
    if flow_type == "invite":
        invite_token = parts[1]
        # Validate invite token
        invite = db.query(ClientConnectInvite).filter(
            ClientConnectInvite.token == invite_token,
            ClientConnectInvite.completed_at.is_(None),
            ClientConnectInvite.expires_at > datetime.utcnow(),
        ).first()
        
        if not invite:
            logger.error("Invalid or expired invite link")
            return False
        
        client_id = invite.client_id
        connected_by = invite.created_by
        
        # Mark invite as used
        invite.completed_at = datetime.utcnow()
    elif flow_type == "client":
        # Direct flow requires current_user (handled at API layer)
        client_id = parts[1]
        connected_by = None  # Will be set by API layer
    else:
        logger.error(f"Unknown flow type: {flow_type}")
        return False
    
    # Exchange code for credentials
    # ... (token exchange logic)
```

**Encryption pattern** (from encryption.py lines 37-51):
```python
def store_oauth_token(
    self,
    db: Session,
    client_id: str,
    provider: str,
    access_token: str,
    refresh_token: Optional[str],
    token_expiry: Optional[datetime],
    scopes: List[str],
    connected_by: str,
) -> ClientOAuthToken:
    """Store encrypted OAuth tokens against client_id."""
    token_record = ClientOAuthToken(
        client_id=client_id,
        provider=provider,
        access_token=encrypt_value(access_token),
        refresh_token=encrypt_value(refresh_token) if refresh_token else None,
        token_expiry=token_expiry,
        scopes=scopes,
        connected_by=connected_by,
        is_active=True,
    )
    db.merge(token_record)  # Upsert due to UNIQUE(client_id, provider)
    db.commit()
    db.refresh(token_record)
    return token_record
```

**Magic link token generation** (from bing_oauth.py lines 72-113):
```python
def create_invite(
    self,
    db: Session,
    client_id: str,
    created_by: str,
    scopes_requested: List[str],
) -> Dict[str, Any]:
    """Create a magic link invite token."""
    token = secrets.token_urlsafe(32)  # 256-bit entropy
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    invite = ClientConnectInvite(
        client_id=client_id,
        token=token,
        created_by=created_by,
        expires_at=expires_at,
        scopes_requested=scopes_requested,
    )
    db.add(invite)
    db.commit()
    
    return {
        "token": token,
        "url": f"https://app.tevero.lt/connect/{token}",
        "expires_at": expires_at.isoformat(),
    }
```

---

### `AI-Writer/backend/api/client_oauth.py` (controller, request-response)

**Analog:** `AI-Writer/backend/api/clients.py`

**Imports pattern** (lines 1-31):
```python
"""
REST API router for per-client OAuth credentials.

Endpoints:
  POST   /api/clients/{client_id}/invites           - Create magic link invite
  GET    /api/clients/{client_id}/connections       - List OAuth connections
  DELETE /api/clients/{client_id}/connections/{provider} - Revoke connection
  GET    /api/auth/google/start                     - Start OAuth (direct or invite)
  GET    /api/auth/google/callback                  - Handle OAuth callback
  GET    /api/invites/{token}/validate              - Validate invite token (public)

SECURITY RULES:
- access_token and refresh_token are write-only: encrypted on write, NEVER in response.
- Invite validation endpoint is public (no auth required).
- All other endpoints require Clerk auth.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user, get_optional_user
from models.client import Client
from models.client_oauth import ClientOAuthToken, ClientConnectInvite
from services.shared_db import get_shared_db
from services.client_oauth_service import ClientOAuthService
```

**Pydantic response schema pattern** (from clients.py lines 92-112):
```python
class ConnectionResponse(BaseModel):
    """
    Connection response schema.
    access_token and refresh_token are intentionally absent -- they are
    write-only and must never leave the backend in plaintext.
    """
    id: str
    provider: str
    is_active: bool
    connected_by: str
    connected_at: str
    token_expiry: Optional[str]
    scopes: Optional[List[str]]
    properties: List[dict]  # [{key: str, value: str}]

    class Config:
        from_attributes = True


class InviteResponse(BaseModel):
    token: str
    url: str
    expires_at: str
```

**Helper function pattern** (from clients.py lines 129-143):
```python
def _get_active_client_or_404(client_id: str, db: Session) -> Client:
    """
    Return the Client row or raise 404.
    Returns 404 for both missing AND archived clients.
    """
    try:
        uid = uuid.UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Client not found")

    client = db.query(Client).filter(Client.id == uid).first()
    if client is None or client.is_archived:
        raise HTTPException(status_code=404, detail="Client not found")
    return client
```

**Endpoint with auth pattern** (from clients.py lines 198-209):
```python
@router.post("/{client_id}/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
def create_invite(
    client_id: str,
    payload: InviteCreate,
    db: Session = Depends(get_shared_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a magic link invite for client self-authorization."""
    client = _get_active_client_or_404(client_id, db)
    
    oauth_service = ClientOAuthService()
    invite = oauth_service.create_invite(
        db=db,
        client_id=str(client.id),
        created_by=current_user["clerk_user_id"],
        scopes_requested=payload.scopes_requested,
    )
    return invite
```

**Public endpoint pattern** (no auth dependency):
```python
@router.get("/invites/{token}/validate")
def validate_invite(
    token: str,
    db: Session = Depends(get_shared_db),
    # No get_current_user -- this is a public endpoint
):
    """Validate invite token and return client info (public endpoint)."""
    invite = db.query(ClientConnectInvite).filter(
        ClientConnectInvite.token == token,
        ClientConnectInvite.completed_at.is_(None),
        ClientConnectInvite.expires_at > datetime.utcnow(),
    ).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired invite")
    
    client = db.query(Client).filter(Client.id == invite.client_id).first()
    
    return {
        "valid": True,
        "client_name": client.name if client else "Unknown",
        "scopes_requested": invite.scopes_requested,
        "expires_at": invite.expires_at.isoformat(),
    }
```

---

### `apps/web/src/app/connect/[token]/page.tsx` (page, request-response)

**Analog:** `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx` (for layout) + `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx` (for data fetching)

**Minimal public page pattern** (from sign-in page lines 1-9):
```typescript
// apps/web/src/app/connect/[token]/page.tsx
// NOTE: This page is PUBLIC (no auth required) -- see middleware.ts "/connect/(.*)"

import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ token: string }>;
};

async function validateInvite(token: string) {
  const res = await fetch(
    `${process.env.AI_WRITER_BACKEND_URL}/api/invites/${token}/validate`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}
```

**Server component with data fetch pattern**:
```typescript
export default async function ConnectPage({ params }: PageProps) {
  const { token } = await params;
  const invite = await validateInvite(token);

  if (!invite || !invite.valid) {
    // Render user-friendly error, not 404
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md text-center p-8">
          <h1 className="text-2xl font-semibold text-foreground">
            Link Expired or Invalid
          </h1>
          <p className="mt-2 text-muted-foreground">
            This invite link has expired or has already been used.
            Please contact your agency for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Valid invite -- show connect button
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md text-center p-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Connect Your Accounts
        </h1>
        <p className="mt-2 text-muted-foreground">
          {invite.client_name} has invited you to connect your Google accounts.
        </p>
        <a
          href={`${process.env.NEXT_PUBLIC_AI_WRITER_URL}/api/auth/google/start?token=${token}`}
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Connect with Google
        </a>
      </div>
    </div>
  );
}
```

---

### `apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx` (page, CRUD)

**Analog:** `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx`

**Imports pattern** (from settings/page.tsx lines 1-50):
```typescript
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  RotateCcw,
  Link2,
  Link2Off,
  Copy,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";

import {
  Button,
  PageHeader,
  Skeleton,
  StatusChip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@tevero/ui";

import { useClientStore } from "@/stores/clientStore";
```

**Card-based provider display pattern** (following settings/page.tsx CMS card pattern lines 846-992):
```typescript
// Provider card with connection status
<div className="rounded-lg border border-border bg-card p-6">
  <div className="flex items-start justify-between mb-4">
    <div>
      <h3 className="text-sm font-medium text-foreground">Google</h3>
      <p className="text-xs text-muted-foreground">
        Search Console, Analytics, Business Profile
      </p>
    </div>
    <StatusChip status={connection?.is_active ? "connected" : "draft"} />
  </div>
  
  {connection?.is_active ? (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Connected by {connection.connected_by} on {formatDate(connection.connected_at)}
      </div>
      {connection.properties.map((prop) => (
        <div key={prop.key} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{prop.key}</span>
          <span className="text-foreground">{prop.value}</span>
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={handleReconnect}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reconnect
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDisconnect}>
          <Link2Off className="h-3.5 w-3.5 mr-1.5" />
          Disconnect
        </Button>
      </div>
    </div>
  ) : (
    <div className="space-y-3">
      <Button onClick={handleDirectConnect}>
        <Link2 className="h-4 w-4 mr-2" />
        Connect Google
      </Button>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleSendInvite}>
          Send invite link
        </Button>
        {inviteUrl && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyInvite}
            title="Copy invite link"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )}
</div>
```

**Toast notification pattern** (from settings/page.tsx lines 135-149):
```typescript
const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
  open: false,
  message: "",
  severity: "success",
});

const showToast = useCallback(
  (message: string, severity: "success" | "error" = "success") => {
    setToast({ open: true, message, severity });
    setTimeout(() => setToast((t) => ({ ...t, open: false })), 3000);
  },
  []
);
```

---

### `apps/web/src/app/api/invites/[token]/validate/route.ts` (api-route, request-response)

**Analog:** `apps/web/src/app/api/clients/[clientId]/route.ts`

**API route pattern** (from clients/[clientId]/route.ts lines 1-28):
```typescript
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function GET(_: Request, { params }: Params) {
  const { token } = await params;
  
  // NOTE: No auth required -- this is a public endpoint
  const res = await fetch(
    `${process.env.AI_WRITER_BACKEND_URL}/api/invites/${token}/validate`,
    { cache: "no-store" }
  );
  
  if (!res.ok) {
    return NextResponse.json(
      { valid: false, error: "Invalid or expired invite" },
      { status: res.status }
    );
  }
  
  const data = await res.json();
  return NextResponse.json(data);
}
```

---

## Shared Patterns

### Authentication (Clerk JWT)
**Source:** `AI-Writer/backend/middleware/auth_middleware.py`
**Apply to:** All FastAPI endpoints except `/api/invites/{token}/validate`

```python
from middleware.auth_middleware import get_current_user, get_optional_user

# Protected endpoint
@router.post("/{client_id}/invites")
def create_invite(
    # ...
    current_user: dict = Depends(get_current_user),
):
    connected_by = current_user["clerk_user_id"]
    # ...

# Public endpoint (no Depends(get_current_user))
@router.get("/invites/{token}/validate")
def validate_invite(token: str, db: Session = Depends(get_shared_db)):
    # No auth dependency -- public
    # ...
```

### Encryption (Fernet)
**Source:** `AI-Writer/backend/services/encryption.py`
**Apply to:** All credential storage in `client_oauth_service.py`

```python
from services.encryption import encrypt_value, decrypt_value

# Encrypt before storage
access_token_encrypted = encrypt_value(access_token_plaintext)
refresh_token_encrypted = encrypt_value(refresh_token_plaintext) if refresh_token_plaintext else None

# NEVER decrypt for API responses -- tokens are write-only
# Decryption only happens internally when making API calls to Google/Bing
```

### Database Session
**Source:** `AI-Writer/backend/services/shared_db.py`
**Apply to:** All FastAPI endpoints in `api/client_oauth.py`

```python
from services.shared_db import get_shared_db

@router.get("/{client_id}/connections")
def list_connections(
    client_id: str,
    db: Session = Depends(get_shared_db),
    current_user: dict = Depends(get_current_user),
):
    # Use db session for all queries
    # ...
```

### Next.js Middleware (Public Routes)
**Source:** `apps/web/src/middleware.ts`
**Apply to:** `/connect/(.*)` route (already configured)

```typescript
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/connect/(.*)",  // <-- Magic link pages are public
  "/api/health",
]);
```

### StatusChip Component
**Source:** `packages/ui/src/components/status-chip.tsx`
**Apply to:** Connection status display in `connections/page.tsx`

```typescript
import { StatusChip } from "@tevero/ui";

// Already has "connected" status variant
<StatusChip status={connection?.is_active ? "connected" : "draft"} />
```

### Server Fetch Utilities
**Source:** `apps/web/src/lib/server-fetch.ts`
**Apply to:** Authenticated API calls from Next.js API routes (NOT for public /connect page)

```typescript
import { getFastApi, postFastApi, deleteFastApi, FastApiError } from "@/lib/server-fetch";

// For authenticated routes
const connections = await getFastApi<Connection[]>(`/api/clients/${clientId}/connections`);

// For public routes (no auth), use plain fetch
const res = await fetch(`${process.env.AI_WRITER_BACKEND_URL}/api/invites/${token}/validate`);
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `AI-Writer/backend/scripts/migrate_credentials.py` | script | batch | One-time migration script; no existing migration script pattern |

**Migration script guidance from RESEARCH.md:**
- Best-effort migration from per-user SQLite to per-client PostgreSQL
- For each user with GSC credentials, look up their most recently active client
- Log migration status; allow manual fixup for ambiguous cases

---

## Metadata

**Analog search scope:** `AI-Writer/backend/`, `apps/web/src/`, `packages/`
**Files scanned:** 47
**Pattern extraction date:** 2026-04-19

### Key Patterns Identified

1. **Alembic migrations:** Use `CHAR(36)` for UUIDs, `LargeBinary` for encrypted fields, `sa.ForeignKey(..., ondelete="CASCADE")` for client FK
2. **OAuth state parameter:** Format `type:identifier:random` enables routing callbacks to correct flow (invite vs direct)
3. **Write-only credentials:** Encrypt on POST, NEVER include in GET responses
4. **Public endpoints:** Omit `Depends(get_current_user)` and document in docstring
5. **Magic link token:** Use `secrets.token_urlsafe(32)` for 256-bit entropy
6. **Client settings page pattern:** Card-based layout with StatusChip, useCallback for handlers, local toast state
