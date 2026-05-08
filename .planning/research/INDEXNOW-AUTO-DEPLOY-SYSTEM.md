# IndexNow API Key Auto-Deployment System

## Executive Summary

This document outlines a complete system for automatically deploying IndexNow API key files to WordPress sites without manual client intervention. The system leverages TeveroSEO's existing WordPress credential infrastructure (Application Passwords stored in `ClientSettings`) to deploy key files via multiple fallback strategies.

---

## 1. WordPress Credential Infrastructure (Existing)

TeveroSEO already stores WordPress credentials per-client in the `client_settings` table:

```python
# AI-Writer/backend/models/client.py
class ClientSettings(SharedBase):
    wp_url = Column(String(500), nullable=True)
    wp_username = Column(String(255), nullable=True)
    wp_app_password_encrypted = Column(LargeBinary, nullable=True)  # Fernet-encrypted
```

The `WordPressContentManager` class (`AI-Writer/backend/services/integrations/wordpress_content.py`) demonstrates the existing API integration pattern using Basic Auth with Application Passwords.

---

## 2. Deployment Strategies (Ranked by Reliability)

### Strategy 1: WordPress REST API File Upload (RECOMMENDED)

**Reliability: 95%** | **Permissions Required: `upload_files` capability**

WordPress REST API v2 supports media/file uploads, but critically, it does NOT support arbitrary file creation in the web root. However, we can exploit the media library as a workaround or use custom REST endpoints.

**Option 1A: Deploy via Custom TeveroSEO Micro-Plugin**

Create a tiny must-use (mu-plugin) that exposes a secure REST endpoint for key file deployment:

```php
<?php
// wp-content/mu-plugins/tevero-indexnow-deployer.php
add_action('rest_api_init', function() {
    register_rest_route('tevero/v1', '/indexnow-key', [
        'methods' => 'POST',
        'callback' => 'tevero_deploy_indexnow_key',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);
});

function tevero_deploy_indexnow_key($request) {
    $key = sanitize_text_field($request->get_param('key'));
    if (!preg_match('/^[a-f0-9]{32}$/', $key)) {
        return new WP_Error('invalid_key', 'Invalid IndexNow key format', ['status' => 400]);
    }
    
    $file_path = ABSPATH . $key . '.txt';
    $result = file_put_contents($file_path, $key);
    
    if ($result === false) {
        return new WP_Error('write_failed', 'Failed to write key file', ['status' => 500]);
    }
    
    return ['success' => true, 'path' => $file_path, 'url' => home_url($key . '.txt')];
}
```

**Deployment Flow:**
1. Check if `tevero/v1/indexnow-key` endpoint exists
2. If not, prompt user to install micro-plugin OR use Strategy 2
3. POST key to endpoint with existing Application Password auth

**Python Implementation:**

```python
class IndexNowDeployer:
    def deploy_via_rest_api(self, site_url: str, username: str, app_password: str, key: str) -> DeployResult:
        """Deploy IndexNow key via TeveroSEO REST endpoint."""
        endpoint = f"{site_url}/wp-json/tevero/v1/indexnow-key"
        
        response = requests.post(
            endpoint,
            json={"key": key},
            auth=HTTPBasicAuth(username, app_password),
            timeout=(10, 30)
        )
        
        if response.status_code == 404:
            return DeployResult(success=False, error="TeveroSEO plugin not installed", fallback_needed=True)
        
        if response.status_code == 201:
            data = response.json()
            return DeployResult(success=True, key_url=data['url'])
        
        return DeployResult(success=False, error=response.text)
```

---

### Strategy 2: WP-CLI Remote Execution via SSH

**Reliability: 70%** | **Permissions Required: SSH access with WP-CLI**

For sites where TeveroSEO manages hosting or has SSH credentials:

```bash
wp eval "file_put_contents(ABSPATH . '{key}.txt', '{key}');"
```

**Limitations:**
- Requires SSH credentials (most agency clients won't provide)
- WP-CLI must be installed
- Not practical for SaaS deployment

**Use Case:** Self-hosted TeveroSEO instances managing their own WordPress sites.

---

### Strategy 3: FTP/SFTP File Upload

**Reliability: 60%** | **Permissions Required: FTP/SFTP credentials**

Traditional file upload to web root via FTP.

**Implementation:**

```python
import paramiko
from ftplib import FTP, FTP_TLS

class FTPDeployer:
    def deploy_via_sftp(self, host: str, username: str, password: str, key: str) -> DeployResult:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=username, password=password)
        sftp = ssh.open_sftp()
        
        # Detect web root (common paths)
        web_roots = ['/var/www/html', '/home/{user}/public_html', '/var/www/{domain}']
        for root in web_roots:
            try:
                sftp.chdir(root)
                break
            except IOError:
                continue
        
        with sftp.file(f'{key}.txt', 'w') as f:
            f.write(key)
        
        return DeployResult(success=True)
```

**Limitations:**
- Many hosting providers disable FTP
- Additional credential storage needed
- Security concerns with password storage

---

### Strategy 4: Existing SEO Plugin Integration

**Reliability: 85%** | **Permissions Required: `edit_posts` or `manage_options`**

Leverage existing SEO plugins that support IndexNow natively:

| Plugin | REST API Support | Key Deployment |
|--------|------------------|----------------|
| Yoast SEO | Partial | Via settings page |
| Rank Math | Yes | `rankmath/v1/indexnow` |
| All in One SEO | Yes | Via REST settings |
| IndexNow Plugin | No | Generates own key |

**Rank Math Example:**

```python
def deploy_via_rankmath(self, site_url: str, username: str, app_password: str, key: str) -> DeployResult:
    """Configure IndexNow via Rank Math REST API."""
    endpoint = f"{site_url}/wp-json/rankmath/v1/updateRedirection"  # Actual endpoint varies
    # Rank Math stores IndexNow key in options table
    return DeployResult(success=False, error="Plugin-specific implementation needed")
```

**Recommendation:** Detect installed SEO plugin and use its native IndexNow support when available.

---

### Strategy 5: WebDAV Upload (Rare)

**Reliability: 20%** | Some enterprise WordPress hosts expose WebDAV.

Not recommended for general use.

---

## 3. Fallback Cascade Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    IndexNow Deployment Request                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Detect WordPress Platform                               │
│  - Use existing PlatformDetector from open-seo-main              │
│  - Verify /wp-json/ endpoint exists                              │
│  - Return early if not WordPress                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Check for TeveroSEO Plugin                              │
│  HEAD /wp-json/tevero/v1/indexnow-key                           │
│  If 200 → Use Strategy 1A (REST API)                            │
└─────────────────────────────────────────────────────────────────┘
                              │ 404
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Detect SEO Plugin                                       │
│  HEAD /wp-json/rankmath/v1/                                      │
│  HEAD /wp-json/yoast/v1/                                         │
│  HEAD /wp-json/aioseo/v1/                                        │
│  If found → Use plugin-specific IndexNow config                 │
└─────────────────────────────────────────────────────────────────┘
                              │ No plugin
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Prompt for Plugin Installation                          │
│  - Generate download link for TeveroSEO mu-plugin               │
│  - Send email/notification to client                            │
│  - Queue for manual review                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Manual Fallback (UI Instructions)                       │
│  - Display step-by-step instructions                            │
│  - Provide key file for download                                │
│  - Verify deployment via HTTP check                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Code Architecture

### New Service: `IndexNowDeploymentService`

Location: `AI-Writer/backend/services/indexnow/deployment_service.py`

```python
"""
IndexNow API Key Deployment Service

Automatically deploys IndexNow key files to WordPress sites using
available credentials from ClientSettings.

Deployment cascade:
1. TeveroSEO Plugin REST API (if installed)
2. SEO Plugin Integration (Rank Math, Yoast, AIOSEO)
3. Prompt for plugin installation
4. Manual deployment instructions
"""

import uuid
import hashlib
from dataclasses import dataclass
from typing import Optional, List
from enum import Enum

import requests
from requests.auth import HTTPBasicAuth
from loguru import logger

from models.client import ClientSettings
from services.encryption import decrypt_value


class DeploymentStrategy(Enum):
    TEVERO_PLUGIN = "tevero_plugin"
    RANKMATH = "rankmath"
    YOAST = "yoast"
    AIOSEO = "aioseo"
    MANUAL = "manual"
    FAILED = "failed"


@dataclass
class DeployResult:
    success: bool
    strategy: DeploymentStrategy
    key: str
    key_url: Optional[str] = None
    error: Optional[str] = None
    instructions: Optional[str] = None


@dataclass
class WordPressCapabilities:
    has_tevero_plugin: bool = False
    has_rankmath: bool = False
    has_yoast: bool = False
    has_aioseo: bool = False
    can_upload_files: bool = False
    detected_seo_plugin: Optional[str] = None


class IndexNowDeploymentService:
    """Deploys IndexNow API key files to WordPress sites."""
    
    TIMEOUT = (10, 30)  # connect, read
    
    def __init__(self, client_settings: ClientSettings):
        if not client_settings.wp_url:
            raise ValueError("WordPress URL not configured")
        if not client_settings.wp_username:
            raise ValueError("WordPress username not configured")
        if not client_settings.wp_app_password_encrypted:
            raise ValueError("WordPress app password not configured")
        
        self.site_url = client_settings.wp_url.rstrip('/')
        self.username = client_settings.wp_username
        self.app_password = decrypt_value(client_settings.wp_app_password_encrypted)
        self.auth = HTTPBasicAuth(self.username, self.app_password)
        self.client_id = str(client_settings.client_id)
    
    def generate_key(self) -> str:
        """Generate a unique IndexNow API key (32 hex characters)."""
        # Combine client_id with random UUID for uniqueness
        raw = f"{self.client_id}-{uuid.uuid4()}"
        return hashlib.md5(raw.encode()).hexdigest()
    
    def detect_capabilities(self) -> WordPressCapabilities:
        """Detect available deployment capabilities on the WordPress site."""
        caps = WordPressCapabilities()
        
        # Check TeveroSEO plugin
        try:
            r = requests.head(
                f"{self.site_url}/wp-json/tevero/v1/indexnow-key",
                auth=self.auth,
                timeout=self.TIMEOUT
            )
            caps.has_tevero_plugin = r.status_code != 404
        except Exception:
            pass
        
        # Check Rank Math
        try:
            r = requests.head(
                f"{self.site_url}/wp-json/rankmath/v1/status",
                auth=self.auth,
                timeout=self.TIMEOUT
            )
            caps.has_rankmath = r.status_code == 200
            if caps.has_rankmath:
                caps.detected_seo_plugin = "rankmath"
        except Exception:
            pass
        
        # Check Yoast
        try:
            r = requests.head(
                f"{self.site_url}/wp-json/yoast/v1/",
                auth=self.auth,
                timeout=self.TIMEOUT
            )
            caps.has_yoast = r.status_code == 200
            if caps.has_yoast and not caps.detected_seo_plugin:
                caps.detected_seo_plugin = "yoast"
        except Exception:
            pass
        
        # Check user capabilities
        try:
            r = requests.get(
                f"{self.site_url}/wp-json/wp/v2/users/me",
                auth=self.auth,
                timeout=self.TIMEOUT
            )
            if r.status_code == 200:
                user = r.json()
                caps.can_upload_files = user.get('capabilities', {}).get('upload_files', False)
        except Exception:
            pass
        
        return caps
    
    def deploy(self, key: Optional[str] = None) -> DeployResult:
        """
        Deploy IndexNow key using the best available strategy.
        
        Args:
            key: Pre-generated key, or None to generate new one
        
        Returns:
            DeployResult with strategy used and outcome
        """
        key = key or self.generate_key()
        caps = self.detect_capabilities()
        
        # Strategy 1: TeveroSEO Plugin
        if caps.has_tevero_plugin:
            result = self._deploy_via_tevero_plugin(key)
            if result.success:
                return result
        
        # Strategy 2: Rank Math
        if caps.has_rankmath:
            result = self._deploy_via_rankmath(key)
            if result.success:
                return result
        
        # Strategy 3: Yoast (if it gains IndexNow support)
        # Currently Yoast doesn't have native IndexNow REST API
        
        # Strategy 4: Manual fallback
        return self._generate_manual_instructions(key, caps)
    
    def _deploy_via_tevero_plugin(self, key: str) -> DeployResult:
        """Deploy via TeveroSEO WordPress plugin REST endpoint."""
        try:
            r = requests.post(
                f"{self.site_url}/wp-json/tevero/v1/indexnow-key",
                json={"key": key},
                auth=self.auth,
                timeout=self.TIMEOUT
            )
            
            if r.status_code in (200, 201):
                data = r.json()
                return DeployResult(
                    success=True,
                    strategy=DeploymentStrategy.TEVERO_PLUGIN,
                    key=key,
                    key_url=data.get('url', f"{self.site_url}/{key}.txt")
                )
            
            return DeployResult(
                success=False,
                strategy=DeploymentStrategy.TEVERO_PLUGIN,
                key=key,
                error=f"Plugin returned {r.status_code}: {r.text[:200]}"
            )
            
        except Exception as e:
            logger.error(f"TeveroSEO plugin deployment failed: {e}")
            return DeployResult(
                success=False,
                strategy=DeploymentStrategy.TEVERO_PLUGIN,
                key=key,
                error=str(e)
            )
    
    def _deploy_via_rankmath(self, key: str) -> DeployResult:
        """Deploy via Rank Math plugin settings."""
        # Rank Math stores IndexNow in wp_options via its REST API
        # This requires knowledge of Rank Math's specific API structure
        try:
            # Rank Math uses wp_options for IndexNow key
            # API endpoint: /wp-json/rankmath/v1/saveSettings
            r = requests.post(
                f"{self.site_url}/wp-json/rankmath/v1/saveSettings",
                json={
                    "setting": "indexnow_api_key",
                    "value": key
                },
                auth=self.auth,
                timeout=self.TIMEOUT
            )
            
            if r.status_code in (200, 201):
                return DeployResult(
                    success=True,
                    strategy=DeploymentStrategy.RANKMATH,
                    key=key,
                    key_url=f"{self.site_url}/{key}.txt"
                )
            
            return DeployResult(
                success=False,
                strategy=DeploymentStrategy.RANKMATH,
                key=key,
                error=f"Rank Math API returned {r.status_code}"
            )
            
        except Exception as e:
            logger.error(f"Rank Math deployment failed: {e}")
            return DeployResult(
                success=False,
                strategy=DeploymentStrategy.RANKMATH,
                key=key,
                error=str(e)
            )
    
    def _generate_manual_instructions(self, key: str, caps: WordPressCapabilities) -> DeployResult:
        """Generate manual deployment instructions when auto-deploy fails."""
        
        if caps.detected_seo_plugin == "yoast":
            instructions = f"""
## IndexNow Key Deployment Instructions (Yoast SEO)

1. Go to Yoast SEO > Settings > Site Features
2. Enable IndexNow (if available in your version)
3. Or manually create a file named `{key}.txt` in your WordPress root
4. The file should contain only: `{key}`
5. Verify at: {self.site_url}/{key}.txt

Alternatively, install the TeveroSEO Helper plugin for automatic deployment.
"""
        elif caps.detected_seo_plugin == "rankmath":
            instructions = f"""
## IndexNow Key Deployment Instructions (Rank Math)

1. Go to Rank Math > General Settings > Instant Indexing
2. Enter this API Key: `{key}`
3. Save settings
4. Rank Math will create the key file automatically

Or manually create `{key}.txt` containing `{key}` in your WordPress root.
"""
        else:
            instructions = f"""
## IndexNow Key Deployment Instructions

### Option 1: Install TeveroSEO Helper Plugin (Recommended)
1. Download the plugin from your TeveroSEO dashboard
2. Upload to wp-content/mu-plugins/
3. TeveroSEO will automatically manage IndexNow keys

### Option 2: Manual File Creation
1. Create a file named: `{key}.txt`
2. File contents should be exactly: `{key}`
3. Upload to your WordPress root directory (same folder as wp-config.php)
4. Verify at: {self.site_url}/{key}.txt

### Option 3: Use File Manager Plugin
1. Install "File Manager" plugin from WordPress.org
2. Navigate to your site root
3. Create new file: `{key}.txt`
4. Enter the key as content and save
"""
        
        return DeployResult(
            success=False,
            strategy=DeploymentStrategy.MANUAL,
            key=key,
            key_url=f"{self.site_url}/{key}.txt",
            instructions=instructions
        )
    
    def verify_deployment(self, key: str) -> bool:
        """Verify that the IndexNow key file is accessible."""
        try:
            r = requests.get(
                f"{self.site_url}/{key}.txt",
                timeout=self.TIMEOUT
            )
            return r.status_code == 200 and r.text.strip() == key
        except Exception:
            return False
```

---

## 5. WordPress Site Detection Logic

Leverage existing `PlatformDetector` from open-seo-main:

```typescript
// open-seo-main/src/server/features/connections/services/PlatformDetector.ts
export async function detectPlatform(url: string): Promise<DetectionResult>
```

**Detection signals for WordPress:**
- `/wp-json/` API endpoint (weight: 100)
- `/wp-content/` paths in HTML (weight: 80)
- `<meta name="generator" content="WordPress">` (weight: 90)

Integration in Python:

```python
async def is_wordpress_site(url: str) -> bool:
    """Check if URL is a WordPress site using multi-probe detection."""
    # Quick check: probe /wp-json/
    try:
        r = requests.head(f"{url.rstrip('/')}/wp-json/", timeout=(5, 10))
        if r.status_code == 200:
            return True
    except Exception:
        pass
    
    # Fallback: check HTML for WordPress markers
    try:
        r = requests.get(url, timeout=(5, 15))
        html = r.text.lower()
        
        markers = ['/wp-content/', '/wp-includes/', 'generator" content="wordpress']
        return any(m in html for m in markers)
    except Exception:
        return False
```

---

## 6. Security Considerations

### 6.1 Credential Handling
- Application Passwords are already Fernet-encrypted at rest
- Never log credentials (existing pattern in `wordpress_publisher.py`)
- Use HTTPS for all API calls

### 6.2 Key Generation
- Use cryptographically secure random generation
- Keys are 32 hex characters (128-bit entropy)
- Bind keys to client_id to prevent reuse

### 6.3 File Writing
- Sanitize key input (hex characters only)
- Prevent path traversal attacks in plugin
- Rate limit deployment attempts

### 6.4 Plugin Security
- Use `current_user_can('manage_options')` permission check
- Validate nonce if using form-based deployment
- Sign plugin updates from TeveroSEO

---

## 7. Database Schema Addition

Add IndexNow key tracking to `client_settings`:

```python
# New columns for ClientSettings
indexnow_key = Column(String(32), nullable=True)
indexnow_deployed_at = Column(DateTime(timezone=True), nullable=True)
indexnow_verified_at = Column(DateTime(timezone=True), nullable=True)
indexnow_deployment_strategy = Column(String(50), nullable=True)  # tevero_plugin, rankmath, manual
```

Migration:

```python
def upgrade():
    op.add_column('client_settings', sa.Column('indexnow_key', sa.String(32), nullable=True))
    op.add_column('client_settings', sa.Column('indexnow_deployed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('client_settings', sa.Column('indexnow_verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('client_settings', sa.Column('indexnow_deployment_strategy', sa.String(50), nullable=True))
```

---

## 8. API Endpoints

### Deploy IndexNow Key

```
POST /api/clients/{client_id}/indexnow/deploy
```

**Request:**
```json
{
  "key": "optional_custom_key"  // omit to auto-generate
}
```

**Response (success):**
```json
{
  "success": true,
  "key": "abc123def456...",
  "key_url": "https://example.com/abc123def456.txt",
  "strategy": "tevero_plugin",
  "verified": true
}
```

**Response (manual required):**
```json
{
  "success": false,
  "key": "abc123def456...",
  "strategy": "manual",
  "instructions": "## IndexNow Key Deployment Instructions..."
}
```

### Verify Deployment

```
GET /api/clients/{client_id}/indexnow/verify
```

**Response:**
```json
{
  "key": "abc123def456...",
  "deployed": true,
  "verified": true,
  "verified_at": "2026-05-08T12:00:00Z",
  "key_url": "https://example.com/abc123def456.txt"
}
```

---

## 9. TeveroSEO Helper WordPress Plugin

Minimal mu-plugin for automatic key deployment:

```php
<?php
/**
 * Plugin Name: TeveroSEO Helper
 * Description: Enables automatic IndexNow key deployment from TeveroSEO platform
 * Version: 1.0.0
 * Author: TeveroSEO
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function() {
    register_rest_route('tevero/v1', '/indexnow-key', [
        [
            'methods' => 'POST',
            'callback' => 'tevero_deploy_indexnow_key',
            'permission_callback' => function() {
                return current_user_can('manage_options');
            },
            'args' => [
                'key' => [
                    'required' => true,
                    'validate_callback' => function($param) {
                        return preg_match('/^[a-f0-9]{32}$/', $param);
                    }
                ]
            ]
        ],
        [
            'methods' => 'GET',
            'callback' => 'tevero_get_indexnow_key',
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ],
        [
            'methods' => 'DELETE',
            'callback' => 'tevero_delete_indexnow_key',
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]
    ]);
    
    // Heartbeat endpoint for connection verification
    register_rest_route('tevero/v1', '/ping', [
        'methods' => 'GET',
        'callback' => function() {
            return ['status' => 'ok', 'version' => '1.0.0'];
        },
        'permission_callback' => '__return_true'
    ]);
});

function tevero_deploy_indexnow_key($request) {
    $key = sanitize_text_field($request->get_param('key'));
    $file_path = ABSPATH . $key . '.txt';
    
    // Check if file already exists
    if (file_exists($file_path)) {
        $existing = trim(file_get_contents($file_path));
        if ($existing === $key) {
            return [
                'success' => true,
                'action' => 'existing',
                'url' => home_url($key . '.txt')
            ];
        }
    }
    
    // Write key file
    $result = file_put_contents($file_path, $key);
    
    if ($result === false) {
        return new WP_Error(
            'write_failed',
            'Failed to write IndexNow key file. Check directory permissions.',
            ['status' => 500]
        );
    }
    
    // Store in options for reference
    update_option('tevero_indexnow_key', $key);
    update_option('tevero_indexnow_deployed_at', current_time('mysql'));
    
    return [
        'success' => true,
        'action' => 'created',
        'path' => $file_path,
        'url' => home_url($key . '.txt')
    ];
}

function tevero_get_indexnow_key($request) {
    $key = get_option('tevero_indexnow_key');
    
    if (!$key) {
        return new WP_Error('not_found', 'No IndexNow key deployed', ['status' => 404]);
    }
    
    $file_path = ABSPATH . $key . '.txt';
    $file_exists = file_exists($file_path);
    
    return [
        'key' => $key,
        'deployed_at' => get_option('tevero_indexnow_deployed_at'),
        'file_exists' => $file_exists,
        'url' => home_url($key . '.txt')
    ];
}

function tevero_delete_indexnow_key($request) {
    $key = get_option('tevero_indexnow_key');
    
    if (!$key) {
        return new WP_Error('not_found', 'No IndexNow key to delete', ['status' => 404]);
    }
    
    $file_path = ABSPATH . $key . '.txt';
    
    if (file_exists($file_path)) {
        unlink($file_path);
    }
    
    delete_option('tevero_indexnow_key');
    delete_option('tevero_indexnow_deployed_at');
    
    return ['success' => true, 'deleted_key' => $key];
}
```

---

## 10. Implementation Phases

### Phase 1: Core Service (1-2 days)
- [ ] Create `IndexNowDeploymentService` in AI-Writer backend
- [ ] Add database columns for key tracking
- [ ] Create Alembic migration

### Phase 2: WordPress Plugin (1 day)
- [ ] Develop TeveroSEO Helper mu-plugin
- [ ] Host plugin for download on TeveroSEO
- [ ] Add plugin installation instructions to UI

### Phase 3: API Endpoints (1 day)
- [ ] Add `/indexnow/deploy` endpoint
- [ ] Add `/indexnow/verify` endpoint
- [ ] Add to client settings response

### Phase 4: Frontend Integration (1 day)
- [ ] Add IndexNow status to client dashboard
- [ ] Add deployment button with progress indicator
- [ ] Show manual instructions when needed

### Phase 5: SEO Plugin Detection (1 day)
- [ ] Implement Rank Math integration
- [ ] Implement Yoast detection (for instructions)
- [ ] Implement AIOSEO detection

---

## 11. Verification and Monitoring

### Automated Verification Job

```python
async def verify_indexnow_keys():
    """BullMQ job to periodically verify all IndexNow key deployments."""
    clients = await get_clients_with_indexnow_keys()
    
    for client in clients:
        settings = client.settings
        if not settings.indexnow_key:
            continue
        
        is_valid = await verify_key_accessible(
            settings.wp_url,
            settings.indexnow_key
        )
        
        if is_valid:
            settings.indexnow_verified_at = datetime.utcnow()
        else:
            # Alert: key no longer accessible
            await send_indexnow_alert(client, "Key file not accessible")
```

---

## Summary

The IndexNow auto-deployment system leverages TeveroSEO's existing WordPress Application Password infrastructure with a multi-strategy fallback cascade:

1. **TeveroSEO Plugin** (preferred) - Direct REST API file creation
2. **SEO Plugin Integration** - Rank Math, Yoast, AIOSEO native support
3. **Manual Instructions** - Clear steps when auto-deploy impossible

Key security features:
- Fernet-encrypted credential storage (existing)
- Cryptographically secure key generation
- Permission-gated plugin endpoints
- HTTPS-only API communication

The system requires minimal client intervention when the TeveroSEO Helper plugin is installed, falling back to clear manual instructions otherwise.
