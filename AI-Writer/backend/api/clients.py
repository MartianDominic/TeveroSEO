"""
REST API router for agency clients.

Endpoints (all require Clerk auth via get_current_user dependency):
  GET    /api/clients                   — list active clients, sorted by name
  POST   /api/clients                   — create client
  GET    /api/clients/{id}              — get client (includes settings, masks encrypted fields)
  PATCH  /api/clients/{id}              — update name / website_url
  POST   /api/clients/{id}/archive      — soft-delete (set is_archived=True)
  GET    /api/clients/{id}/settings     — get settings (encrypted credential fields omitted)
  PUT    /api/clients/{id}/settings     — upsert all settings fields

SECURITY RULES:
- wp_app_password and shopify_api_key are write-only: encrypted on write, NEVER in response.
- Archived clients return 404 (not 403) to avoid information leakage.
- All clients are visible to all authenticated team members (no per-user ownership).
"""

import uuid
from datetime import datetime
from typing import List, Optional, Dict

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from api.model_constants import ALLOWED_TEXT_MODELS, ALLOWED_IMAGE_MODELS
from middleware.auth_middleware import get_current_user
from middleware.authorization import require_client_access, grant_creator_access, get_user_clients
from models.client import Client, ClientSettings
from services.shared_db import get_shared_db
from services.encryption import encrypt_value, decrypt_value
from sqlalchemy import func

router = APIRouter()

# Resource limits to prevent abuse
MAX_CLIENTS_PER_USER = 100  # Maximum clients a single user can create


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

def validate_website_url_scheme(url: Optional[str]) -> Optional[str]:
    """
    Validate that website_url uses only http/https schemes.
    CRIT-SYNC-02: Prevents javascript:/data: URL injection attacks.

    Returns the URL if valid, raises ValueError if invalid scheme.
    """
    if url is None or url.strip() == "":
        return None

    url = url.strip()

    # Parse and validate scheme
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        scheme = parsed.scheme.lower()

        # Only allow http and https schemes
        if scheme not in ("http", "https"):
            raise ValueError(
                f"Invalid URL scheme '{scheme}'. Only http:// and https:// URLs are allowed."
            )

        # Ensure there's a valid netloc (domain)
        if not parsed.netloc:
            raise ValueError("Invalid URL: missing domain.")

        return url
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Invalid URL format: {url}")


class ClientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    website_url: Optional[str] = Field(None, max_length=500)

    @field_validator("website_url")
    @classmethod
    def validate_url_scheme(cls, v: Optional[str]) -> Optional[str]:
        """CRIT-SYNC-02: Validate URL scheme to prevent injection attacks."""
        return validate_website_url_scheme(v)


class ClientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    website_url: Optional[str] = Field(None, max_length=500)

    @field_validator("website_url")
    @classmethod
    def validate_url_scheme(cls, v: Optional[str]) -> Optional[str]:
        """CRIT-SYNC-02: Validate URL scheme to prevent injection attacks."""
        return validate_website_url_scheme(v)


class ClientResponse(BaseModel):
    id: str
    name: str
    website_url: Optional[str]
    is_archived: bool

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    brand_voice: Optional[str] = None
    image_prompt_template: Optional[str] = None
    text_model_override: Optional[str] = Field(None, max_length=100)
    image_model_override: Optional[str] = Field(None, max_length=100)
    # CMS credentials — write-only, never returned in responses
    wp_url: Optional[str] = Field(None, max_length=500)
    wp_username: Optional[str] = Field(None, max_length=255)
    wp_app_password: Optional[str] = None       # plaintext in → encrypted at rest
    shopify_store_url: Optional[str] = Field(None, max_length=500)
    shopify_api_key: Optional[str] = None       # plaintext in → encrypted at rest


class TestConnectionParams(BaseModel):
    """Parameters for testing CMS connection."""
    platform: str = Field(..., pattern="^(wordpress|shopify|wix|webhook)$")
    credentials: Dict[str, str] = Field(default_factory=dict)


class VerifyAccessRequest(BaseModel):
    """Request body for verify-access endpoint."""
    userId: str = Field(..., min_length=1)
    orgId: Optional[str] = Field(None)


class VerifyAccessResponse(BaseModel):
    """Response for verify-access endpoint."""
    hasAccess: bool
    isMember: bool = True  # For backwards compatibility
    role: Optional[str] = None


class SettingsResponse(BaseModel):
    """
    Settings response schema.
    wp_app_password and shopify_api_key are intentionally absent — they are
    write-only and must never leave the backend in plaintext.
    """
    id: str
    client_id: str
    brand_voice: Optional[str]
    image_prompt_template: Optional[str]
    text_model_override: Optional[str]
    image_model_override: Optional[str]
    wp_url: Optional[str]
    wp_username: Optional[str]
    # wp_app_password_encrypted — omitted from response
    shopify_store_url: Optional[str]
    # shopify_api_key_encrypted — omitted from response

    class Config:
        from_attributes = True


class ClientDetailResponse(BaseModel):
    id: str
    name: str
    website_url: Optional[str]
    is_archived: bool
    settings: Optional[SettingsResponse]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helper
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


def _settings_to_response(s: ClientSettings) -> SettingsResponse:
    return SettingsResponse(
        id=str(s.id),
        client_id=str(s.client_id),
        brand_voice=s.brand_voice,
        image_prompt_template=s.image_prompt_template,
        text_model_override=s.text_model_override,
        image_model_override=s.image_model_override,
        wp_url=s.wp_url,
        wp_username=s.wp_username,
        shopify_store_url=s.shopify_store_url,
        # encrypted fields intentionally omitted
    )


def _client_to_response(c: Client) -> ClientResponse:
    return ClientResponse(
        id=str(c.id),
        name=c.name,
        website_url=c.website_url,
        is_archived=c.is_archived,
    )


def _client_to_detail(c: Client) -> ClientDetailResponse:
    return ClientDetailResponse(
        id=str(c.id),
        name=c.name,
        website_url=c.website_url,
        is_archived=c.is_archived,
        settings=_settings_to_response(c.settings) if c.settings else None,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=List[ClientResponse])
def list_clients(
    db: Session = Depends(get_shared_db),
    current_user: dict = Depends(get_current_user),
):
    """Return active (non-archived) clients the user has access to, sorted alphabetically."""
    # Get client IDs this user has access to
    clerk_user_id = current_user.get("clerk_user_id") or current_user.get("id")
    accessible_client_ids = get_user_clients(db, clerk_user_id)

    # Filter to only accessible, non-archived clients
    clients = (
        db.query(Client)
        .filter(
            Client.is_archived.is_(False),
            Client.id.in_(accessible_client_ids) if accessible_client_ids else False,
        )
        .order_by(Client.name)
        .all()
    )
    return [_client_to_response(c) for c in clients]


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_shared_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a new client. Name is required; website_url is optional.

    The creating user is automatically granted admin access to the new client.

    RESOURCE LIMIT: Users are limited to MAX_CLIENTS_PER_USER clients to prevent abuse.
    """
    clerk_user_id = current_user.get("clerk_user_id") or current_user.get("id")

    # RESOURCE LIMIT FIX: Check user's current client count before allowing creation
    current_client_count = len(get_user_clients(db, clerk_user_id))
    if current_client_count >= MAX_CLIENTS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Client limit reached. Maximum {MAX_CLIENTS_PER_USER} clients allowed per user."
        )

    # SECURITY FIX: HIGH-DB-02 - Add transaction rollback on error
    try:
        client = Client(name=payload.name, website_url=payload.website_url)
        db.add(client)
        db.commit()
        db.refresh(client)

        # Grant creator admin access to the new client
        grant_creator_access(db, client.id, clerk_user_id)

        return _client_to_response(client)
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating client: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{client_id}", response_model=ClientDetailResponse)
def get_client(
    client_id: str,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
    _authorized: bool = Depends(require_client_access),
):
    """Get a single active client including its settings (encrypted fields masked)."""
    client = _get_active_client_or_404(client_id, db)
    return _client_to_detail(client)


@router.patch("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: str,
    payload: ClientUpdate,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
    _authorized: bool = Depends(require_client_access),
):
    """Update a client's name and/or website_url. Only provided fields are changed."""
    # SECURITY FIX: HIGH-DB-02 - Add transaction rollback on error
    try:
        client = _get_active_client_or_404(client_id, db)
        if payload.name is not None:
            client.name = payload.name
        if payload.website_url is not None:
            client.website_url = payload.website_url
        db.commit()
        db.refresh(client)
        return _client_to_response(client)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating client: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{client_id}/archive", response_model=ClientResponse)
def archive_client(
    client_id: str,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
    _authorized: bool = Depends(require_client_access),
):
    """Soft-delete a client by setting is_archived=True. Does NOT delete the row."""
    # SECURITY FIX: HIGH-DB-02 - Add transaction rollback on error
    try:
        client = _get_active_client_or_404(client_id, db)
        client.is_archived = True
        db.commit()
        db.refresh(client)
        return _client_to_response(client)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error archiving client: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{client_id}/settings", response_model=SettingsResponse)
def get_settings(
    client_id: str,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
    _authorized: bool = Depends(require_client_access),
):
    """Get per-client settings. Encrypted credential values are omitted from response."""
    client = _get_active_client_or_404(client_id, db)
    if client.settings is None:
        raise HTTPException(status_code=404, detail="Settings not configured for this client")
    return _settings_to_response(client.settings)


@router.put("/{client_id}/settings", response_model=SettingsResponse)
def upsert_settings(
    client_id: str,
    payload: SettingsUpdate,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
    _authorized: bool = Depends(require_client_access),
):
    """
    Upsert all settings for a client.

    CMS credential plaintext (wp_app_password, shopify_api_key) is encrypted
    before storage and never returned in the response.
    """
    # SECURITY FIX: HIGH-DB-02 - Add transaction rollback on error
    try:
        client = _get_active_client_or_404(client_id, db)

        settings = client.settings
        if settings is None:
            settings = ClientSettings(client_id=client.id)
            db.add(settings)

        # Update non-sensitive fields
        if payload.brand_voice is not None:
            settings.brand_voice = payload.brand_voice
        if payload.image_prompt_template is not None:
            settings.image_prompt_template = payload.image_prompt_template
        # Model overrides support explicit null to CLEAR the override (MODEL-05)
        if "text_model_override" in payload.model_fields_set:
            settings.text_model_override = payload.text_model_override  # may be None
        if "image_model_override" in payload.model_fields_set:
            settings.image_model_override = payload.image_model_override  # may be None
        if payload.wp_url is not None:
            settings.wp_url = payload.wp_url
        if payload.wp_username is not None:
            settings.wp_username = payload.wp_username

        # Encrypt sensitive fields before storage
        if payload.wp_app_password is not None:
            settings.wp_app_password_encrypted = encrypt_value(payload.wp_app_password)
        if payload.shopify_store_url is not None:
            settings.shopify_store_url = payload.shopify_store_url
        if payload.shopify_api_key is not None:
            settings.shopify_api_key_encrypted = encrypt_value(payload.shopify_api_key)

        db.commit()
        db.refresh(settings)
        return _settings_to_response(settings)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating client settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# CMS Connection Test Helpers
# ---------------------------------------------------------------------------

def _normalize_wordpress_credentials(credentials: Dict[str, str]) -> Dict[str, str]:
    """
    Normalize WordPress credential field names.

    Frontend sends: siteUrl, username, applicationPassword
    Backend expects: wp_url, wp_username, wp_app_password

    Accepts both formats for backwards compatibility.
    """
    return {
        "wp_url": credentials.get("siteUrl") or credentials.get("wp_url", ""),
        "wp_username": credentials.get("username") or credentials.get("wp_username", ""),
        "wp_app_password": credentials.get("applicationPassword") or credentials.get("wp_app_password", ""),
    }


def _normalize_shopify_credentials(credentials: Dict[str, str]) -> Dict[str, str]:
    """
    Normalize Shopify credential field names.

    Frontend sends: storeDomain, accessToken
    Backend expects: shopify_store_url, shopify_access_token/shopify_api_key
    """
    return {
        "shopify_store_url": credentials.get("storeDomain") or credentials.get("shopify_store_url", ""),
        "shopify_access_token": credentials.get("accessToken") or credentials.get("shopify_access_token") or credentials.get("shopify_api_key", ""),
    }


def _normalize_wix_credentials(credentials: Dict[str, str]) -> Dict[str, str]:
    """
    Normalize Wix credential field names.

    Frontend sends: siteId, apiKey
    Backend expects: wix_site_id, wix_access_token
    """
    return {
        "wix_site_id": credentials.get("siteId") or credentials.get("wix_site_id", ""),
        "wix_access_token": credentials.get("apiKey") or credentials.get("wix_access_token", ""),
    }


def _normalize_webhook_credentials(credentials: Dict[str, str]) -> Dict[str, str]:
    """
    Normalize webhook credential field names.

    Frontend sends: webhookUrl, secret
    Backend expects: webhook_url, webhook_secret
    """
    return {
        "webhook_url": credentials.get("webhookUrl") or credentials.get("webhook_url", ""),
        "webhook_secret": credentials.get("secret") or credentials.get("webhook_secret", ""),
    }


async def _test_wordpress_connection(credentials: Dict[str, str]) -> Dict[str, any]:
    """Test WordPress REST API connection."""
    from services.url_validator import validate_url

    # Normalize field names for both frontend and backend formats
    normalized = _normalize_wordpress_credentials(credentials)
    url = normalized.get("wp_url", "").rstrip("/")
    username = normalized.get("wp_username")
    app_password = normalized.get("wp_app_password")

    if not all([url, username, app_password]):
        return {"success": False, "error": "Missing WordPress credentials (URL, username, or app password)"}

    # SSRF Protection: Validate WordPress URL before making request
    if not validate_url(url):
        return {
            "success": False,
            "error": "Invalid WordPress URL: URL must be a valid http/https URL "
            "and cannot target internal/private IP addresses (e.g., localhost, "
            "127.0.0.1, 10.x.x.x, 192.168.x.x, 169.254.169.254)"
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{url}/wp-json/wp/v2/users/me",
                auth=(username, app_password)
            )

            if response.status_code == 200:
                user_data = response.json()
                return {
                    "success": True,
                    "message": f"Connected as {user_data.get('name', username)}"
                }
            elif response.status_code == 401:
                return {"success": False, "error": "Invalid username or app password"}
            elif response.status_code == 403:
                return {"success": False, "error": "Access forbidden - check user permissions"}
            else:
                return {"success": False, "error": f"WordPress returned {response.status_code}"}
    except httpx.TimeoutException:
        return {"success": False, "error": "Connection timed out - check URL is correct"}
    except httpx.ConnectError:
        return {"success": False, "error": "Could not connect - check URL is correct"}
    except Exception as e:
        logger.error(f"WordPress connection test error: {e}")
        return {"success": False, "error": "An unexpected error occurred while testing the connection"}


async def _test_shopify_connection(credentials: Dict[str, str]) -> Dict[str, any]:
    """Test Shopify Admin API connection."""
    from services.url_validator import validate_url

    # Normalize field names for both frontend and backend formats
    normalized = _normalize_shopify_credentials(credentials)
    store_url = normalized.get("shopify_store_url", "").rstrip("/")
    access_token = normalized.get("shopify_access_token")

    if not all([store_url, access_token]):
        return {"success": False, "error": "Missing Shopify credentials (store URL or access token)"}

    # SSRF Protection: Validate Shopify store URL before making request
    if not validate_url(store_url):
        return {
            "success": False,
            "error": "Invalid Shopify store URL: URL must be a valid http/https URL "
            "and cannot target internal/private IP addresses (e.g., localhost, "
            "127.0.0.1, 10.x.x.x, 192.168.x.x, 169.254.169.254)"
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{store_url}/admin/api/2024-01/shop.json",
                headers={"X-Shopify-Access-Token": access_token}
            )

            if response.status_code == 200:
                shop_data = response.json().get("shop", {})
                return {
                    "success": True,
                    "message": f"Connected to {shop_data.get('name', store_url)}"
                }
            elif response.status_code == 401:
                return {"success": False, "error": "Invalid access token"}
            elif response.status_code == 403:
                return {"success": False, "error": "Access forbidden - check API scope permissions"}
            else:
                return {"success": False, "error": f"Shopify returned {response.status_code}"}
    except httpx.TimeoutException:
        return {"success": False, "error": "Connection timed out - check store URL"}
    except httpx.ConnectError:
        return {"success": False, "error": "Could not connect - check store URL"}
    except Exception as e:
        logger.error(f"Shopify connection test error: {e}")
        return {"success": False, "error": "An unexpected error occurred while testing the connection"}


async def _test_wix_connection(credentials: Dict[str, str]) -> Dict[str, any]:
    """Test Wix API connection.

    Note: Wix API uses a fixed endpoint (www.wixapis.com), so SSRF validation
    is not needed here - the URL is not user-controlled. However, we validate
    the site_id format to prevent injection attacks.
    """
    # Normalize field names for both frontend and backend formats
    normalized = _normalize_wix_credentials(credentials)
    site_id = normalized.get("wix_site_id")
    access_token = normalized.get("wix_access_token")

    if not all([site_id, access_token]):
        return {"success": False, "error": "Missing Wix credentials (site ID or access token)"}

    # Validate site_id format (should be a GUID-like string, no special chars)
    # This prevents header injection attacks via wix-site-id header
    import re
    if not re.match(r'^[a-zA-Z0-9\-_]+$', site_id):
        return {
            "success": False,
            "error": "Invalid Wix site ID format: must contain only alphanumeric characters, hyphens, and underscores"
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://www.wixapis.com/site-properties/v4/site",
                headers={
                    "Authorization": access_token,
                    "wix-site-id": site_id
                }
            )

            if response.status_code == 200:
                site_data = response.json()
                display_name = site_data.get("site", {}).get("displayName") or site_data.get("displayName") or site_id
                return {
                    "success": True,
                    "message": f"Connected to {display_name}"
                }
            elif response.status_code == 401:
                return {"success": False, "error": "Invalid or expired access token"}
            elif response.status_code == 403:
                return {"success": False, "error": "Access forbidden - check site permissions"}
            else:
                return {"success": False, "error": f"Wix returned {response.status_code}"}
    except httpx.TimeoutException:
        return {"success": False, "error": "Connection timed out"}
    except Exception as e:
        logger.error(f"Wix connection test error: {e}")
        return {"success": False, "error": "An unexpected error occurred while testing the connection"}


async def _test_webhook_connection(credentials: Dict[str, str]) -> Dict[str, any]:
    """Test webhook endpoint with a ping."""
    from services.url_validator import validate_url

    # Normalize field names for both frontend and backend formats
    normalized = _normalize_webhook_credentials(credentials)
    webhook_url = normalized.get("webhook_url")

    if not webhook_url:
        return {"success": False, "error": "Missing webhook URL"}

    # SSRF Protection: Validate webhook URL before making request
    if not validate_url(webhook_url):
        return {
            "success": False,
            "error": "Invalid webhook URL: URL must be a valid http/https URL "
            "and cannot target internal/private IP addresses (e.g., localhost, "
            "127.0.0.1, 10.x.x.x, 192.168.x.x, 169.254.169.254)"
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                webhook_url,
                json={"type": "ping", "timestamp": datetime.utcnow().isoformat()}
            )

            if response.status_code in (200, 201, 202, 204):
                return {"success": True, "message": "Webhook responded successfully"}
            else:
                return {"success": False, "error": f"Webhook returned {response.status_code}"}
    except httpx.TimeoutException:
        return {"success": False, "error": "Webhook timed out"}
    except httpx.ConnectError:
        return {"success": False, "error": "Could not connect to webhook URL"}
    except Exception as e:
        logger.error(f"Webhook connection test error: {e}")
        return {"success": False, "error": "An unexpected error occurred while testing the connection"}


# ---------------------------------------------------------------------------
# Connection Test Endpoint
# ---------------------------------------------------------------------------

@router.post("/{client_id}/test-connection")
async def test_cms_connection(
    client_id: str,
    params: TestConnectionParams,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
    _authorized: bool = Depends(require_client_access),
):
    """
    Test CMS connection with provided credentials.

    Supports: wordpress, shopify, wix, webhook platforms.
    Returns success/error status with descriptive message.
    """
    # Validate client exists
    _get_active_client_or_404(client_id, db)

    platform = params.platform
    credentials = params.credentials

    try:
        if platform == "wordpress":
            return await _test_wordpress_connection(credentials)
        elif platform == "shopify":
            return await _test_shopify_connection(credentials)
        elif platform == "wix":
            return await _test_wix_connection(credentials)
        elif platform == "webhook":
            return await _test_webhook_connection(credentials)
        else:
            return {"success": False, "error": f"Unknown platform: {platform}"}
    except Exception as e:
        # SECURITY FIX: HIGH-ERR-06 - Log full error but return generic message
        logger.error(f"Connection test failed for {platform}: {e}", exc_info=True)
        return {"success": False, "error": "Connection test failed unexpectedly"}


# ---------------------------------------------------------------------------
# Access Verification Endpoint
# ---------------------------------------------------------------------------

@router.post("/{client_id}/verify-access", response_model=VerifyAccessResponse)
async def verify_client_access(
    client_id: str,
    payload: VerifyAccessRequest,
    db: Session = Depends(get_shared_db),
    current_user: Dict = Depends(get_current_user),
):
    """
    Verify that a user has access to a client.

    This endpoint is called by the frontend to validate client access
    before performing operations. It checks:
    1. User is authenticated via Bearer token (get_current_user dependency)
    2. UserId in request body matches authenticated user (prevents spoofing)
    3. Client exists and is not archived

    NOTE: Currently all authenticated users have access to all clients
    in the agency model. Future versions may implement per-client
    workspace membership via the member table.

    Returns:
        VerifyAccessResponse with hasAccess=true if user has access
    """
    # Validate userId is provided in request body
    if not payload.userId:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID is required"
        )

    # SECURITY: Verify that the userId in the request matches the authenticated user
    # This prevents a malicious user from checking access for other users
    authenticated_user_id = current_user.get('clerk_user_id') or current_user.get('id')
    if not authenticated_user_id:
        logger.error("Authenticated user missing clerk_user_id/id in token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )

    if payload.userId != authenticated_user_id:
        logger.warning(
            f"User ID mismatch in verify-access: "
            f"request.userId={payload.userId[:8]}***, "
            f"authenticated_user={authenticated_user_id[:8]}***"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID mismatch: cannot verify access for another user"
        )

    # Check client exists and is not archived
    try:
        client = _get_active_client_or_404(client_id, db)
    except HTTPException:
        # Return 404 for missing/archived clients
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # In the current agency model, all authenticated users have access
    # to all active clients. Future enhancement: check member table
    # for workspace-based access control.
    #
    # Example future implementation:
    # member = db.query(WorkspaceMember).filter(
    #     WorkspaceMember.workspace_id == client.workspace_id,
    #     WorkspaceMember.user_id == payload.userId
    # ).first()
    # if not member:
    #     return VerifyAccessResponse(hasAccess=False, isMember=False)

    return VerifyAccessResponse(
        hasAccess=True,
        isMember=True,
        role="member"  # Default role for agency model
    )
