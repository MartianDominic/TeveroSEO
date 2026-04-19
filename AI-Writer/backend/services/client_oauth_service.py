"""
Per-client OAuth Service for agency credentials.

This service handles OAuth flows for per-client credential storage,
enabling agency staff to connect Google (GSC + GA4 + GBP), Bing, and
other providers against client_id rather than user_id.

Key features:
- Combined Google OAuth scopes (GSC + GA4 + GBP in single flow)
- Magic link invite generation with 7-day TTL
- OAuth callback handling with invite token validation
- Encrypted token storage via Fernet

SECURITY CONTRACT:
- access_token and refresh_token are write-only (encrypted before storage)
- get_connections() NEVER returns decrypted tokens
- Invite tokens are single-use (completed_at set on first use)
"""

import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from loguru import logger
from sqlalchemy.orm import Session

from models.client_oauth import (
    ClientConnectInvite,
    ClientOAuthProperty,
    ClientOAuthToken,
)
from services.encryption import encrypt_value


# Reload environment variables to catch runtime .env updates
load_dotenv(override=True)


# Combined Google scopes for GSC + GA4 + GBP in single OAuth flow
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",  # GSC
    "https://www.googleapis.com/auth/analytics.readonly",  # GA4
    "https://www.googleapis.com/auth/business.manage",  # GBP
]


class ClientOAuthService:
    """
    Service for per-client OAuth credential management.

    Supports both direct OAuth (agency staff connects) and
    magic link invite (client self-authorizes via /connect/[token]).
    """

    def __init__(self):
        """
        Initialize ClientOAuthService.

        Loads Google client configuration from environment variables
        or falls back to gsc_credentials.json file.
        """
        self.client_config = self._load_client_config()
        self.scopes = GOOGLE_SCOPES

        if self.client_config:
            logger.info("ClientOAuthService: Google OAuth client configuration loaded")
        else:
            logger.warning(
                "ClientOAuthService: Google OAuth client configuration not found. "
                "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
            )

    def _load_client_config(self) -> Optional[Dict[str, Any]]:
        """
        Load Google OAuth client configuration.

        Priority:
        1. Environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
        2. gsc_credentials.json file in backend directory

        Returns:
            Client config dict or None if not available.
        """
        # 1. Check environment variables (preferred)
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

        if client_id and client_secret:
            logger.debug("Loading Google OAuth config from environment variables")
            return {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "project_id": os.getenv("GOOGLE_PROJECT_ID", "alwrity"),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "redirect_uris": [
                        os.getenv(
                            "OAUTH_REDIRECT_URI",
                            "http://localhost:8000/api/auth/google/callback",
                        )
                    ],
                }
            }

        # 2. Fallback to credentials file
        services_dir = os.path.dirname(__file__)
        backend_dir = os.path.abspath(os.path.join(services_dir, os.pardir))
        credentials_file = os.path.join(backend_dir, "gsc_credentials.json")

        if os.path.exists(credentials_file):
            try:
                import json

                with open(credentials_file, "r") as f:
                    config = json.load(f)
                logger.debug(f"Loading Google OAuth config from {credentials_file}")
                return config
            except Exception as e:
                logger.warning(f"Failed to load gsc_credentials.json: {e}")

        return None

    def create_invite(
        self,
        db: Session,
        client_id: str,
        created_by: str,
        scopes_requested: List[str],
    ) -> Dict[str, Any]:
        """
        Create a magic link invite for client self-authorization.

        Args:
            db: Database session.
            client_id: UUID of the client.
            created_by: Clerk user ID of the agency staff creating the invite.
            scopes_requested: List of requested scopes (e.g., ["google"]).

        Returns:
            Dict with token, url, and expires_at.
        """
        # Generate 32-byte (256-bit) cryptographically random token
        # secrets.token_urlsafe(32) produces 43-char base64url string
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        invite = ClientConnectInvite(
            id=uuid.uuid4(),
            client_id=uuid.UUID(client_id),
            token=token,
            created_by=created_by,
            expires_at=expires_at,
            scopes_requested=scopes_requested,
        )
        db.add(invite)
        db.commit()
        db.refresh(invite)

        # Build the magic link URL
        app_url = os.getenv("APP_URL", "https://app.tevero.lt")
        url = f"{app_url}/connect/{token}"

        logger.info(
            f"Created invite for client {client_id} by {created_by}, "
            f"expires {expires_at.isoformat()}"
        )

        return {
            "token": token,
            "url": url,
            "expires_at": expires_at.isoformat(),
        }

    def validate_invite(
        self,
        db: Session,
        token: str,
    ) -> Optional[ClientConnectInvite]:
        """
        Validate a magic link invite token.

        Args:
            db: Database session.
            token: The invite token from the URL.

        Returns:
            ClientConnectInvite if valid, None otherwise.
        """
        now = datetime.now(timezone.utc)

        invite = (
            db.query(ClientConnectInvite)
            .filter(
                ClientConnectInvite.token == token,
                ClientConnectInvite.completed_at.is_(None),
                ClientConnectInvite.expires_at > now,
            )
            .first()
        )

        if invite:
            logger.debug(f"Invite token validated for client {invite.client_id}")
        else:
            logger.debug(f"Invite token invalid or expired: {token[:8]}...")

        return invite

    def get_oauth_url(
        self,
        client_id: str,
        invite_token: Optional[str] = None,
    ) -> str:
        """
        Generate Google OAuth authorization URL.

        The OAuth state parameter encodes the flow type:
        - Invite flow: "invite:{invite_token}:{random}"
        - Direct flow: "client:{client_id}:{random}"

        Args:
            client_id: UUID of the client (used for direct flow).
            invite_token: Optional invite token (for magic link flow).

        Returns:
            Google OAuth authorization URL.

        Raises:
            ValueError: If OAuth client configuration is not loaded.
        """
        if not self.client_config:
            raise ValueError("OAuth client configuration not loaded")

        redirect_uri = os.getenv(
            "OAUTH_REDIRECT_URI",
            "http://localhost:8000/api/auth/google/callback",
        )

        flow = Flow.from_client_config(
            self.client_config,
            scopes=self.scopes,
            redirect_uri=redirect_uri,
        )

        # Generate cryptographically random state component
        random_state = secrets.token_urlsafe(32)

        # State format: type:identifier:random
        if invite_token:
            state = f"invite:{invite_token}:{random_state}"
        else:
            state = f"client:{client_id}:{random_state}"

        authorization_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=state,
        )

        flow_type = "invite" if invite_token else "direct"
        logger.info(
            f"Generated OAuth URL for {flow_type} flow, "
            f"identifier={invite_token or client_id}"
        )

        return authorization_url

    def handle_oauth_callback(
        self,
        db: Session,
        code: str,
        state: str,
        connected_by_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Handle Google OAuth callback.

        Parses the state parameter to determine flow type (invite vs direct),
        validates the invite token if applicable, exchanges the code for
        credentials, and stores encrypted tokens.

        Args:
            db: Database session.
            code: Authorization code from Google.
            state: State parameter encoding flow type and identifier.
            connected_by_override: For direct flow, the Clerk user ID.

        Returns:
            Dict with success status, client_id, and provider.

        Raises:
            ValueError: If state is invalid or invite is expired/used.
        """
        logger.info(f"Handling OAuth callback with state: {state[:20]}...")

        # Parse state to determine flow type
        parts = state.split(":")
        if len(parts) < 2:
            logger.error(f"Invalid state format: {state}")
            raise ValueError("Invalid OAuth state parameter")

        flow_type = parts[0]
        identifier = parts[1]

        # Handle flow types
        if flow_type == "invite":
            # Magic link flow: validate invite token
            invite = self.validate_invite(db, identifier)
            if not invite:
                raise ValueError("Invalid or expired invite link")

            client_id = str(invite.client_id)
            connected_by = invite.created_by  # Audit: who sent the invite

            # Mark invite as used (single-use enforcement)
            invite.completed_at = datetime.now(timezone.utc)
            db.add(invite)

        elif flow_type == "client":
            # Direct flow: client_id from state, connected_by from override
            client_id = identifier
            if not connected_by_override:
                raise ValueError("Direct OAuth flow requires authenticated user")
            connected_by = connected_by_override

        else:
            logger.error(f"Unknown flow type: {flow_type}")
            raise ValueError(f"Unknown OAuth flow type: {flow_type}")

        # Exchange authorization code for credentials
        redirect_uri = os.getenv(
            "OAUTH_REDIRECT_URI",
            "http://localhost:8000/api/auth/google/callback",
        )

        flow = Flow.from_client_config(
            self.client_config,
            scopes=self.scopes,
            redirect_uri=redirect_uri,
        )

        flow.fetch_token(code=code)
        credentials: Credentials = flow.credentials

        # Store encrypted credentials
        self._store_oauth_token(
            db=db,
            client_id=client_id,
            provider="google",
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_expiry=credentials.expiry,
            scopes=list(credentials.scopes) if credentials.scopes else GOOGLE_SCOPES,
            connected_by=connected_by,
        )

        db.commit()

        logger.info(
            f"OAuth callback successful for client {client_id}, "
            f"flow_type={flow_type}, connected_by={connected_by}"
        )

        return {
            "success": True,
            "client_id": client_id,
            "provider": "google",
        }

    def _store_oauth_token(
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
        """
        Store encrypted OAuth tokens.

        Upserts based on UNIQUE(client_id, provider) constraint.
        Tokens are Fernet-encrypted before storage.

        Args:
            db: Database session.
            client_id: UUID of the client.
            provider: OAuth provider (e.g., "google").
            access_token: Plaintext access token (will be encrypted).
            refresh_token: Plaintext refresh token (will be encrypted).
            token_expiry: Token expiration datetime.
            scopes: List of granted scopes.
            connected_by: Clerk user ID for audit trail.

        Returns:
            The stored ClientOAuthToken record.
        """
        client_uuid = uuid.UUID(client_id)

        # Check for existing token (for upsert)
        existing = (
            db.query(ClientOAuthToken)
            .filter(
                ClientOAuthToken.client_id == client_uuid,
                ClientOAuthToken.provider == provider,
            )
            .first()
        )

        if existing:
            # Update existing token
            existing.access_token = encrypt_value(access_token)
            existing.refresh_token = (
                encrypt_value(refresh_token) if refresh_token else None
            )
            existing.token_expiry = token_expiry
            existing.scopes = scopes
            existing.connected_by = connected_by
            existing.connected_at = datetime.now(timezone.utc)
            existing.is_active = True
            db.add(existing)
            logger.info(f"Updated OAuth token for client {client_id}, provider {provider}")
            return existing

        # Create new token
        token_record = ClientOAuthToken(
            id=uuid.uuid4(),
            client_id=client_uuid,
            provider=provider,
            access_token=encrypt_value(access_token),
            refresh_token=encrypt_value(refresh_token) if refresh_token else None,
            token_expiry=token_expiry,
            scopes=scopes,
            connected_by=connected_by,
            is_active=True,
        )
        db.add(token_record)
        logger.info(f"Created OAuth token for client {client_id}, provider {provider}")
        return token_record

    def get_connections(
        self,
        db: Session,
        client_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Get active OAuth connections for a client.

        SECURITY: This method NEVER returns decrypted tokens.
        Only metadata (provider, connected_by, scopes, etc.) is returned.

        Args:
            db: Database session.
            client_id: UUID of the client.

        Returns:
            List of connection dicts with metadata and properties.
        """
        client_uuid = uuid.UUID(client_id)

        tokens = (
            db.query(ClientOAuthToken)
            .filter(
                ClientOAuthToken.client_id == client_uuid,
                ClientOAuthToken.is_active.is_(True),
            )
            .all()
        )

        connections = []
        for token in tokens:
            # Build properties list
            properties = [
                {"key": prop.key, "value": prop.value} for prop in token.properties
            ]

            connections.append(
                {
                    "id": str(token.id),
                    "provider": token.provider,
                    "is_active": token.is_active,
                    "connected_by": token.connected_by,
                    "connected_at": (
                        token.connected_at.isoformat() if token.connected_at else None
                    ),
                    "token_expiry": (
                        token.token_expiry.isoformat() if token.token_expiry else None
                    ),
                    "scopes": token.scopes,
                    "properties": properties,
                }
            )

        logger.debug(
            f"Retrieved {len(connections)} active connections for client {client_id}"
        )
        return connections

    def revoke_connection(
        self,
        db: Session,
        client_id: str,
        provider: str,
    ) -> bool:
        """
        Revoke (soft-delete) an OAuth connection.

        Sets is_active=False rather than deleting the row,
        preserving audit trail.

        Args:
            db: Database session.
            client_id: UUID of the client.
            provider: OAuth provider to revoke (e.g., "google").

        Returns:
            True if connection was found and revoked, False otherwise.
        """
        client_uuid = uuid.UUID(client_id)

        token = (
            db.query(ClientOAuthToken)
            .filter(
                ClientOAuthToken.client_id == client_uuid,
                ClientOAuthToken.provider == provider,
                ClientOAuthToken.is_active.is_(True),
            )
            .first()
        )

        if not token:
            logger.debug(
                f"No active connection found for client {client_id}, provider {provider}"
            )
            return False

        token.is_active = False
        db.add(token)
        db.commit()

        logger.info(
            f"Revoked OAuth connection for client {client_id}, provider {provider}"
        )
        return True
