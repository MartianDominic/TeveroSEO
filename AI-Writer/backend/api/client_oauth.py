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
- /api/invites/{token}/validate and /api/auth/google/callback are public (no auth required).
- All other endpoints require Clerk auth via get_current_user.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user, get_optional_user
from models.client import Client
from models.client_oauth import ClientConnectInvite
from services.client_oauth_service import ClientOAuthService
from services.shared_db import get_shared_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class InviteCreate(BaseModel):
    """Request body for creating a magic link invite."""

    scopes_requested: List[str] = Field(
        ..., description="List of requested scopes (e.g., ['google'])"
    )


class InviteResponse(BaseModel):
    """Response when creating a new magic link invite."""

    token: str
    url: str
    expires_at: str


class PropertyResponse(BaseModel):
    """Key-value property associated with an OAuth connection."""

    key: str
    value: str


class ConnectionResponse(BaseModel):
    """
    OAuth connection response schema.

    SECURITY: access_token and refresh_token are intentionally absent.
    They are write-only and must never leave the backend in plaintext.
    """

    id: str
    provider: str
    is_active: bool
    connected_by: str
    connected_at: Optional[str]
    token_expiry: Optional[str]
    scopes: Optional[List[str]]
    properties: List[PropertyResponse]

    class Config:
        from_attributes = True


class InviteValidationResponse(BaseModel):
    """Response when validating a magic link invite token."""

    valid: bool
    client_name: str
    scopes_requested: Optional[List[str]]
    expires_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_active_client_or_404(client_id: str, db: Session) -> Client:
    """
    Return the Client row or raise 404.

    Returns 404 for both missing AND archived clients to avoid info leakage.
    """
    try:
        uid = uuid.UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Client not found")

    client = db.query(Client).filter(Client.id == uid).first()
    if client is None or client.is_archived:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


# ---------------------------------------------------------------------------
# Invite Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/clients/{client_id}/invites",
    response_model=InviteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invite(
    client_id: str,
    payload: InviteCreate,
    db: Session = Depends(get_shared_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Create a magic link invite for client self-authorization.

    The invite token is valid for 7 days and can only be used once.
    The invite URL format is: https://app.tevero.lt/connect/{token}
    """
    client = _get_active_client_or_404(client_id, db)

    oauth_service = ClientOAuthService()
    invite = oauth_service.create_invite(
        db=db,
        client_id=str(client.id),
        created_by=current_user["clerk_user_id"],
        scopes_requested=payload.scopes_requested,
    )

    return InviteResponse(
        token=invite["token"],
        url=invite["url"],
        expires_at=invite["expires_at"],
    )


@router.get("/invites/{token}/validate", response_model=InviteValidationResponse)
def validate_invite(
    token: str,
    db: Session = Depends(get_shared_db),
    # NOTE: No get_current_user - this is a PUBLIC endpoint for /connect/[token] page
):
    """
    Validate a magic link invite token (PUBLIC endpoint).

    Returns client name and requested scopes if the invite is valid.
    Used by the /connect/[token] page to display invite details before OAuth.
    """
    oauth_service = ClientOAuthService()
    invite = oauth_service.validate_invite(db=db, token=token)

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired invite")

    # Get client name for display
    client = db.query(Client).filter(Client.id == invite.client_id).first()
    client_name = client.name if client else "Unknown"

    return InviteValidationResponse(
        valid=True,
        client_name=client_name,
        scopes_requested=invite.scopes_requested,
        expires_at=invite.expires_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Connection Endpoints
# ---------------------------------------------------------------------------


@router.get("/clients/{client_id}/connections", response_model=List[ConnectionResponse])
def list_connections(
    client_id: str,
    db: Session = Depends(get_shared_db),
    current_user: dict = Depends(get_current_user),
):
    """
    List all active OAuth connections for a client.

    SECURITY: Encrypted tokens are never returned in the response.
    """
    client = _get_active_client_or_404(client_id, db)

    oauth_service = ClientOAuthService()
    connections = oauth_service.get_connections(db=db, client_id=str(client.id))

    return [
        ConnectionResponse(
            id=conn["id"],
            provider=conn["provider"],
            is_active=conn["is_active"],
            connected_by=conn["connected_by"],
            connected_at=conn["connected_at"],
            token_expiry=conn["token_expiry"],
            scopes=conn["scopes"],
            properties=[
                PropertyResponse(key=p["key"], value=p["value"])
                for p in conn["properties"]
            ],
        )
        for conn in connections
    ]


@router.delete(
    "/clients/{client_id}/connections/{provider}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_connection(
    client_id: str,
    provider: str,
    db: Session = Depends(get_shared_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Revoke (disconnect) an OAuth connection.

    This soft-deletes the connection (sets is_active=False) to preserve audit trail.
    """
    client = _get_active_client_or_404(client_id, db)

    oauth_service = ClientOAuthService()
    revoked = oauth_service.revoke_connection(
        db=db,
        client_id=str(client.id),
        provider=provider,
    )

    if not revoked:
        raise HTTPException(
            status_code=404,
            detail=f"No active {provider} connection found for this client",
        )

    logger.info(
        f"Connection revoked: client={client_id}, provider={provider}, "
        f"by={current_user['clerk_user_id']}"
    )

    # 204 No Content - no body
    return None


# ---------------------------------------------------------------------------
# OAuth Flow Endpoints
# ---------------------------------------------------------------------------


@router.get("/auth/google/start")
async def start_google_oauth(
    client_id: Optional[str] = Query(
        None, description="Client ID for direct OAuth flow"
    ),
    token: Optional[str] = Query(None, description="Invite token for magic link flow"),
    db: Session = Depends(get_shared_db),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """
    Start Google OAuth flow.

    Supports two flows:
    1. Direct flow: Agency staff connects for a client (requires auth + client_id)
    2. Invite flow: Client self-authorizes via magic link (requires token, no auth)

    Returns a redirect to Google's OAuth consent screen.
    """
    oauth_service = ClientOAuthService()

    if token:
        # Invite flow: validate token and use its client_id
        invite = oauth_service.validate_invite(db=db, token=token)
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid or expired invite link")

        authorization_url = oauth_service.get_oauth_url(
            client_id=str(invite.client_id),
            invite_token=token,
        )

    elif client_id:
        # Direct flow: requires authentication
        if not current_user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required for direct OAuth connection",
            )

        # Validate client exists and is active
        _get_active_client_or_404(client_id, db)

        authorization_url = oauth_service.get_oauth_url(
            client_id=client_id,
            invite_token=None,
        )

    else:
        raise HTTPException(
            status_code=400,
            detail="Either client_id or token query parameter is required",
        )

    return RedirectResponse(url=authorization_url)


@router.get("/auth/google/callback")
async def google_oauth_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="OAuth state parameter"),
    db: Session = Depends(get_shared_db),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """
    Handle Google OAuth callback (PUBLIC endpoint).

    Validates the state parameter to determine flow type:
    - Invite flow: validates invite token, stores credentials, marks invite as used
    - Direct flow: validates client_id, stores credentials

    Redirects to success page after completion.
    """
    oauth_service = ClientOAuthService()

    # Parse state to determine flow type
    parts = state.split(":")
    if len(parts) < 2:
        logger.error(f"Invalid OAuth state format: {state}")
        raise HTTPException(status_code=400, detail="Invalid OAuth state parameter")

    flow_type = parts[0]

    # For direct flow, extract connected_by from current_user
    connected_by_override = None
    if flow_type == "client":
        if not current_user:
            # This shouldn't happen if start was called correctly,
            # but handle gracefully
            logger.warning(
                "Direct OAuth callback received without authenticated user. "
                "Using state client_id as fallback."
            )
            # We'll let handle_oauth_callback raise ValueError
        else:
            connected_by_override = current_user["clerk_user_id"]

    try:
        result = oauth_service.handle_oauth_callback(
            db=db,
            code=code,
            state=state,
            connected_by_override=connected_by_override,
        )
    except ValueError as e:
        logger.error(f"OAuth callback error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    # Redirect to appropriate success page
    if flow_type == "invite":
        # Magic link flow: redirect to /connect/success
        return RedirectResponse(url="/connect/success")
    else:
        # Direct flow: redirect to client connections page
        client_id = result["client_id"]
        return RedirectResponse(
            url=f"/clients/{client_id}/connections?connected={result['provider']}"
        )
