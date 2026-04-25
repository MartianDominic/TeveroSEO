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
from models.client import Client, ClientSettings
from services.shared_db import get_shared_db
from services.encryption import encrypt_value, decrypt_value

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ClientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    website_url: Optional[str] = Field(None, max_length=500)


class ClientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    website_url: Optional[str] = Field(None, max_length=500)


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

    @field_validator("text_model_override")
    @classmethod
    def validate_text_model_override(cls, v):
        if v is not None and v not in ALLOWED_TEXT_MODELS:
            raise ValueError(
                f"Model '{v}' is not in the v2.0 allowed text model list. "
                f"Allowed: {ALLOWED_TEXT_MODELS}"
            )
        return v

    @field_validator("image_model_override")
    @classmethod
    def validate_image_model_override(cls, v):
        if v is not None and v not in ALLOWED_IMAGE_MODELS:
            raise ValueError(
                f"Model '{v}' is not in the v2.0 allowed image model list. "
                f"Allowed: {ALLOWED_IMAGE_MODELS}"
            )
        return v


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
    _current_user: dict = Depends(get_current_user),
):
    """Return all active (non-archived) clients sorted alphabetically by name."""
    clients = (
        db.query(Client)
        .filter(Client.is_archived.is_(False))
        .order_by(Client.name)
        .all()
    )
    return [_client_to_response(c) for c in clients]


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
):
    """Create a new client. Name is required; website_url is optional."""
    client = Client(name=payload.name, website_url=payload.website_url)
    db.add(client)
    db.commit()
    db.refresh(client)
    return _client_to_response(client)


@router.get("/{client_id}", response_model=ClientDetailResponse)
def get_client(
    client_id: str,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
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
):
    """Update a client's name and/or website_url. Only provided fields are changed."""
    client = _get_active_client_or_404(client_id, db)
    if payload.name is not None:
        client.name = payload.name
    if payload.website_url is not None:
        client.website_url = payload.website_url
    db.commit()
    db.refresh(client)
    return _client_to_response(client)


@router.post("/{client_id}/archive", response_model=ClientResponse)
def archive_client(
    client_id: str,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
):
    """Soft-delete a client by setting is_archived=True. Does NOT delete the row."""
    client = _get_active_client_or_404(client_id, db)
    client.is_archived = True
    db.commit()
    db.refresh(client)
    return _client_to_response(client)


@router.get("/{client_id}/settings", response_model=SettingsResponse)
def get_settings(
    client_id: str,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
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
):
    """
    Upsert all settings for a client.

    CMS credential plaintext (wp_app_password, shopify_api_key) is encrypted
    before storage and never returned in the response.
    """
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


# ---------------------------------------------------------------------------
# CMS Connection Test Helpers
# ---------------------------------------------------------------------------

async def _test_wordpress_connection(credentials: Dict[str, str]) -> Dict[str, any]:
    """Test WordPress REST API connection."""
    url = credentials.get("wp_url", "").rstrip("/")
    username = credentials.get("wp_username")
    app_password = credentials.get("wp_app_password")

    if not all([url, username, app_password]):
        return {"success": False, "error": "Missing WordPress credentials (URL, username, or app password)"}

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
        return {"success": False, "error": str(e)}


async def _test_shopify_connection(credentials: Dict[str, str]) -> Dict[str, any]:
    """Test Shopify Admin API connection."""
    store_url = credentials.get("shopify_store_url", "").rstrip("/")
    access_token = credentials.get("shopify_access_token") or credentials.get("shopify_api_key")

    if not all([store_url, access_token]):
        return {"success": False, "error": "Missing Shopify credentials (store URL or access token)"}

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
        return {"success": False, "error": str(e)}


async def _test_wix_connection(credentials: Dict[str, str]) -> Dict[str, any]:
    """Test Wix API connection."""
    site_id = credentials.get("wix_site_id")
    access_token = credentials.get("wix_access_token")

    if not all([site_id, access_token]):
        return {"success": False, "error": "Missing Wix credentials (site ID or access token)"}

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
        return {"success": False, "error": str(e)}


async def _test_webhook_connection(credentials: Dict[str, str]) -> Dict[str, any]:
    """Test webhook endpoint with a ping."""
    webhook_url = credentials.get("webhook_url")

    if not webhook_url:
        return {"success": False, "error": "Missing webhook URL"}

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
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Connection Test Endpoint
# ---------------------------------------------------------------------------

@router.post("/{client_id}/test-connection")
async def test_cms_connection(
    client_id: str,
    params: TestConnectionParams,
    db: Session = Depends(get_shared_db),
    _current_user: dict = Depends(get_current_user),
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
        logger.error(f"Connection test failed for {platform}: {e}")
        return {"success": False, "error": str(e)}
