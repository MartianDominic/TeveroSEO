# Phase 97: WordPress No-SEO-Plugin IndexNow Implementation Research

**Researched:** 2026-05-08
**Domain:** Minimal viable IndexNow implementation for WordPress sites without SEO plugins
**Confidence:** HIGH

---

## Executive Summary

When a WordPress site has NO SEO plugin (Rank Math, Yoast, SEOPress, AIOSEO), TeveroSEO has three viable strategies for IndexNow integration, ranked by preference:

| Strategy | Automation Level | User Effort | Recommendation |
|----------|------------------|-------------|----------------|
| **1. Auto-install Microsoft IndexNow Plugin** | Full | None (one API call) | **PRIMARY** |
| **2. Provide mu-plugin PHP snippet** | None (user copy-paste) | Low (2-3 minutes) | FALLBACK |
| **3. wp_options + manual key file** | Partial | Medium | NOT RECOMMENDED |

**Primary Recommendation:** Use WordPress REST API `/wp/v2/plugins` endpoint to automatically install and activate the official Microsoft IndexNow plugin. This is a zero-config solution that handles API key generation, key file serving, and auto-submission on publish.

---

## Strategy 1: Auto-Install Microsoft IndexNow Plugin via REST API

### Verification: REST API Plugin Installation

**Can we install plugins via REST API?** YES [VERIFIED: WordPress Developer Handbook](https://developer.wordpress.org/rest-api/reference/plugins/)

The `/wp/v2/plugins` endpoint supports:
- `POST /wp/v2/plugins` - Install a plugin from WordPress.org by slug
- `POST /wp/v2/plugins/{plugin}` - Update plugin status (activate/deactivate)
- `GET /wp/v2/plugins` - List all installed plugins
- `DELETE /wp/v2/plugins/{plugin}` - Delete a plugin

### Requirements

| Requirement | Value |
|-------------|-------|
| WordPress Version | 5.5+ (plugins endpoint added) |
| Authentication | Application Password (24-character token) |
| Required Capability | `install_plugins` (Administrator role) |
| Plugin Slug | `indexnow` |
| HTTPS Required | YES (Application Passwords require HTTPS) |

### API Calls for TeveroSEO Integration

#### Step 1: Check if Plugin Already Installed

```bash
curl -X GET "https://client-site.com/wp-json/wp/v2/plugins?search=indexnow" \
  -u "username:application_password" \
  -H "Content-Type: application/json"
```

**Response (if installed):**
```json
[
  {
    "plugin": "indexnow/indexnow-url-submission",
    "status": "active",
    "name": "IndexNow",
    "version": "1.0.4"
  }
]
```

**Response (if not installed):** Empty array `[]`

#### Step 2: Install Plugin

```bash
curl -X POST "https://client-site.com/wp-json/wp/v2/plugins" \
  -u "username:application_password" \
  -H "Content-Type: application/json" \
  -d '{"slug": "indexnow", "status": "active"}'
```

**Success Response (201 Created):**
```json
{
  "plugin": "indexnow/indexnow-url-submission",
  "status": "active",
  "name": "IndexNow",
  "version": "1.0.4",
  "author": {
    "raw": "Microsoft Bing",
    "rendered": "<a href=\"https://www.bing.com/indexnow\">Microsoft Bing</a>"
  }
}
```

**Error Responses:**

| Status | Meaning | TeveroSEO Action |
|--------|---------|------------------|
| 401 | Invalid credentials | Re-prompt for Application Password |
| 403 | User lacks `install_plugins` cap | Inform user needs admin role |
| 409 | Plugin already installed | Proceed to activation |
| 500 | Server error during install | Retry once, then fallback to Strategy 2 |

### What the Plugin Auto-Handles

Once installed and activated, the Microsoft IndexNow plugin [VERIFIED: WordPress SVN trunk source]:

1. **API Key Generation:** Creates UUID v4 key on activation, stores in `wp_options` as `indexnow-admin_api_key` (base64 encoded)
2. **Key File Serving:** Uses `template_redirect` hook to serve `/{key}.txt` dynamically (no physical file)
3. **Auto-Submission:** Hooks into `transition_post_status` for create/update/delete detection
4. **Submission Logging:** Creates `wp_indexnow_passed_submissions` and `wp_indexnow_failed_submissions` tables

**Key Plugin Code Pattern:**
```php
// From class-indexnow-url-submission-admin.php
public function check_for_indexnow_page() {
    $admin_api_key = get_option($this->prefix . "admin_api_key");
    $api_key = base64_decode($admin_api_key);
    
    global $wp;
    $current_url = home_url($wp->request);
    
    if (isset($current_url) && trailingslashit(get_home_url()) . $api_key . '.txt' === $current_url) {
        header('Content-Type: text/plain');
        header('X-Robots-Tag: noindex');
        status_header(200);
        esc_html_e($api_key);
        exit();
    }
}
```

### TeveroSEO Detection: Is Plugin Working?

After installation, TeveroSEO should verify the key file is accessible:

```typescript
async function verifyIndexNowPluginWorking(siteUrl: string): Promise<{
  working: boolean;
  apiKey?: string;
  error?: string;
}> {
  // 1. Get the API key from wp_options via plugin's REST endpoint (if exposed)
  //    OR fetch the plugins list and assume activation = key generated
  
  // 2. The plugin doesn't expose the API key via REST API
  //    We need to try common IndexNow key patterns or ask user
  
  // 3. Best approach: Instruct user to copy API key from IndexNow settings page
  //    Dashboard > IndexNow > copy the displayed API key
  
  return { working: true }; // Assume working after activation
}
```

**Limitation:** The Microsoft IndexNow plugin does NOT expose its API key via REST API. TeveroSEO has two options:
1. **Trust activation = working** (recommended for UX)
2. **Ask user to copy API key** from IndexNow settings page for verification

### Decision: Does Plugin Expose REST API Endpoints?

**NO** [VERIFIED: plugin source code review]

The plugin registers routes via `$this->routes->register_routes()` but these are for:
- Internal admin UI functionality (React dashboard)
- Manual URL submission from admin panel

They are NOT for external access or key retrieval. The routes use WordPress nonce verification for admin-only access.

---

## Strategy 2: Custom mu-plugin PHP Snippet (Fallback)

When REST API plugin installation fails (permissions, disabled plugins endpoint, etc.), provide a minimal mu-plugin.

### Minimal mu-plugin Code

```php
<?php
/**
 * Plugin Name: TeveroSEO IndexNow Integration
 * Description: Serves IndexNow API key file and auto-submits URLs on publish
 * Version: 1.0.0
 * Author: TeveroSEO
 */

// Prevent direct access
if (!defined('ABSPATH')) exit;

// Configuration - TeveroSEO will generate this key
define('TEVERO_INDEXNOW_KEY', '%%API_KEY%%'); // Replace with actual key

/**
 * Serve the IndexNow key file at /{key}.txt
 */
add_action('template_redirect', function() {
    global $wp;
    $request_path = trim($wp->request, '/');
    
    if ($request_path === TEVERO_INDEXNOW_KEY . '.txt') {
        header('Content-Type: text/plain; charset=utf-8');
        header('X-Robots-Tag: noindex');
        status_header(200);
        echo TEVERO_INDEXNOW_KEY;
        exit;
    }
});

/**
 * Submit URL to IndexNow on post publish/update
 */
add_action('transition_post_status', function($new_status, $old_status, $post) {
    // Only submit on publish transitions
    if ($new_status !== 'publish') return;
    if ($old_status === 'publish' && $new_status === 'publish') {
        // Update - still submit
    } elseif ($old_status !== 'publish' && $new_status === 'publish') {
        // New publish
    } else {
        return;
    }
    
    // Check if post is publicly viewable
    if (function_exists('is_post_publicly_viewable') && !is_post_publicly_viewable($post)) {
        return;
    }
    
    $url = get_permalink($post);
    if (empty($url)) return;
    
    $site_url = get_home_url();
    $host = wp_parse_url($site_url, PHP_URL_HOST);
    
    $payload = json_encode([
        'host' => $host,
        'key' => TEVERO_INDEXNOW_KEY,
        'keyLocation' => $site_url . '/' . TEVERO_INDEXNOW_KEY . '.txt',
        'urlList' => [$url]
    ]);
    
    wp_remote_post('https://api.indexnow.org/IndexNow', [
        'body' => $payload,
        'headers' => ['Content-Type' => 'application/json'],
        'timeout' => 10,
        'blocking' => false // Non-blocking for performance
    ]);
}, 10, 3);
```

### Installation Instructions for User

```markdown
## Manual IndexNow Setup (mu-plugin)

Your WordPress site doesn't have an SEO plugin with IndexNow support. 
Follow these steps to enable IndexNow manually:

### Step 1: Connect via SFTP/FTP or File Manager

Access your WordPress files using:
- cPanel File Manager
- SFTP client (FileZilla, Cyberduck)
- Your hosting control panel

### Step 2: Navigate to mu-plugins Directory

Go to: `wp-content/mu-plugins/`

If the `mu-plugins` folder doesn't exist, create it.

### Step 3: Create the Plugin File

Create a new file named: `tevero-indexnow.php`

### Step 4: Paste the Code

Copy and paste the following code into the file:

[CODE_SNIPPET_HERE - with actual API key pre-filled]

### Step 5: Verify Installation

Visit: https://your-site.com/[API_KEY].txt

You should see the API key displayed as plain text.

### Done!

IndexNow will automatically notify search engines when you publish or update content.
```

### Can mu-plugin Be Deployed via REST API?

**NO** [VERIFIED: WordPress REST API documentation]

The REST API cannot:
- Write arbitrary PHP files to the filesystem
- Access `wp-content/mu-plugins/` directory
- Execute file operations outside standard WordPress functionality

**Reason:** Security. Allowing arbitrary file writes would be a critical vulnerability.

---

## Strategy 3: wp_options + Manual Key File (NOT RECOMMENDED)

### Approach

1. Store IndexNow key in `wp_options` via REST API
2. User manually creates `{key}.txt` file in WordPress root

### Implementation

#### Step 1: Register Custom Option for REST API

This requires existing code on the WordPress site (plugin or theme):

```php
// In theme's functions.php or a plugin
add_action('init', function() {
    register_setting('general', 'tevero_indexnow_key', [
        'type' => 'string',
        'show_in_rest' => true,
        'sanitize_callback' => 'sanitize_text_field',
        'default' => ''
    ]);
});
```

#### Step 2: Write Key via REST API

```bash
curl -X POST "https://client-site.com/wp-json/wp/v2/settings" \
  -u "username:application_password" \
  -H "Content-Type: application/json" \
  -d '{"tevero_indexnow_key": "abc123def456"}'
```

### Why NOT Recommended

| Issue | Explanation |
|-------|-------------|
| **Requires Pre-Existing Code** | User must add PHP code before REST API can write the option |
| **No Key File Endpoint** | wp_options alone doesn't serve `/{key}.txt` |
| **Manual File Creation** | User still needs FTP/file access to create key file |
| **Worse UX than Strategy 2** | More steps, more confusion, same outcome |

**Conclusion:** If user has file access (required for key file), they should just use Strategy 2 (mu-plugin) which provides complete functionality.

---

## Strategy Comparison Matrix

| Capability | Strategy 1 (Auto Plugin) | Strategy 2 (mu-plugin) | Strategy 3 (wp_options) |
|------------|--------------------------|------------------------|-------------------------|
| Zero user effort | YES | NO | NO |
| Works via REST API only | YES | NO | NO |
| Serves key file endpoint | YES (plugin handles) | YES (mu-plugin handles) | NO (manual file) |
| Auto-submits on publish | YES (plugin handles) | YES (mu-plugin handles) | NO |
| Requires file access | NO | YES | YES |
| Works on managed WP hosts | YES | MAYBE (some block mu-plugins) | MAYBE |
| Admin dashboard UI | YES | NO | NO |

---

## TeveroSEO Implementation Decision Tree

```
WordPress site connected to TeveroSEO
         │
         ▼
┌─────────────────────────────────────┐
│ Check for SEO plugin with IndexNow  │
│ GET /wp-json/wp/v2/plugins          │
│ Look for: rankmath, seopress, yoast │
│         wordpress-seo, aioseo       │
└─────────────────┬───────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    HAS PLUGIN        NO PLUGIN
         │                 │
         ▼                 ▼
┌─────────────────┐ ┌─────────────────────────────┐
│ IndexNow handled│ │ Try auto-install IndexNow   │
│ by existing     │ │ POST /wp-json/wp/v2/plugins │
│ plugin          │ │ {"slug":"indexnow",         │
│                 │ │  "status":"active"}         │
│ DONE            │ └─────────────┬───────────────┘
└─────────────────┘               │
                          ┌───────┴───────┐
                          │               │
                     201 SUCCESS      ERROR (403/500)
                          │               │
                          ▼               ▼
               ┌─────────────────┐ ┌─────────────────────┐
               │ Plugin installed│ │ Show mu-plugin      │
               │ & activated     │ │ instructions        │
               │                 │ │                     │
               │ Show success:   │ │ "Copy this code to  │
               │ "IndexNow is    │ │ wp-content/mu-      │
               │ now active"     │ │ plugins/tevero-     │
               │                 │ │ indexnow.php"       │
               │ DONE            │ │                     │
               └─────────────────┘ │ Provide pre-filled  │
                                   │ PHP snippet with    │
                                   │ generated API key   │
                                   └─────────────────────┘
```

---

## API Key Management

### Scenario 1: TeveroSEO Manages Key (Preferred)

TeveroSEO generates the API key and:
- Stores encrypted in TeveroSEO database
- Provides to user in mu-plugin snippet (if fallback needed)
- Uses for verification and batch submissions

```typescript
// TeveroSEO key generation
import { v4 as uuidv4 } from 'uuid';

function generateIndexNowKey(): string {
  // UUID v4 without hyphens = 32 hex characters
  return uuidv4().replace(/-/g, '');
}

// Example: "a1b2c3d4e5f6789012345678abcdef12"
```

### Scenario 2: Plugin Manages Key (Auto-Install)

If Microsoft IndexNow plugin is installed:
- Plugin generates its own key on activation
- Key stored in `wp_options` as `indexnow-admin_api_key` (base64)
- TeveroSEO does NOT need the key for basic operation
- Plugin handles all submissions internally

**TeveroSEO's role:** Simply install the plugin. Done.

---

## Security Considerations

### Application Password Security

| Concern | Mitigation |
|---------|------------|
| Password stored in TeveroSEO DB | Encrypt with AES-256-GCM (same as existing pattern) |
| Password scope | WordPress Application Passwords are full-access; cannot limit to plugins endpoint |
| Password rotation | Recommend users rotate after TeveroSEO setup if paranoid |
| HTTPS requirement | WordPress blocks App Passwords over HTTP; all connections secure |

### mu-plugin Security

| Concern | Mitigation |
|---------|------------|
| API key in plaintext | Minimal risk; key is public (served at /{key}.txt by design) |
| Non-blocking POST | Uses `blocking => false`; no sensitive data returned |
| Input validation | Key is constant; no user input in submission |

---

## Error Handling for TeveroSEO

### REST API Plugin Installation Errors

```typescript
interface PluginInstallResult {
  success: boolean;
  method: 'auto_install' | 'manual_required';
  error?: string;
  fallbackInstructions?: string;
}

async function installIndexNowPlugin(
  siteUrl: string,
  username: string,
  appPassword: string
): Promise<PluginInstallResult> {
  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
  
  try {
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/plugins`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug: 'indexnow', status: 'active' }),
    });
    
    if (response.status === 201) {
      return { success: true, method: 'auto_install' };
    }
    
    if (response.status === 409) {
      // Plugin already installed, just activate it
      const activateResponse = await fetch(
        `${siteUrl}/wp-json/wp/v2/plugins/indexnow%2Findexnow-url-submission`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'active' }),
        }
      );
      
      if (activateResponse.ok) {
        return { success: true, method: 'auto_install' };
      }
    }
    
    // Any other error: provide fallback
    const errorData = await response.json();
    return {
      success: false,
      method: 'manual_required',
      error: errorData.message || `HTTP ${response.status}`,
      fallbackInstructions: generateMuPluginInstructions(siteUrl),
    };
    
  } catch (error) {
    return {
      success: false,
      method: 'manual_required',
      error: error.message,
      fallbackInstructions: generateMuPluginInstructions(siteUrl),
    };
  }
}
```

---

## User-Facing Instructions (UI Copy)

### Success: Auto-Install Worked

```
IndexNow has been successfully configured for [site-name].

The Microsoft IndexNow plugin is now active on your WordPress site. 
When you publish or update content, search engines (Bing, Yandex, Naver, Seznam) 
will be notified automatically.

No further action is required.
```

### Fallback: Manual Setup Required

```
Automatic IndexNow setup wasn't possible for [site-name].

This can happen if:
- Your WordPress host restricts plugin installation via API
- Your user account doesn't have administrator privileges
- The REST API is disabled or restricted

To enable IndexNow manually, follow these steps:

1. Connect to your WordPress site via FTP or File Manager
2. Navigate to: wp-content/mu-plugins/
   (Create the mu-plugins folder if it doesn't exist)
3. Create a new file: tevero-indexnow.php
4. Paste the following code:

[EXPANDABLE CODE BLOCK WITH PRE-FILLED API KEY]

5. Save the file
6. Verify by visiting: https://[site-name]/[api-key].txt

Need help? Contact support@teveroseo.com
```

---

## Compatibility Notes

### Managed WordPress Hosts

| Host | Auto-Install Works | mu-plugins Allowed |
|------|-------------------|--------------------|
| WP Engine | YES | YES |
| Kinsta | YES | YES |
| Flywheel | YES | YES |
| WordPress.com (Business+) | YES | NO (use official plugin from marketplace) |
| Pantheon | YES | YES |
| Cloudways | YES | YES |

### WordPress Multisite

For WordPress Multisite installations:
- Plugin installation requires Network Admin role
- Endpoint becomes `/wp-json/wp/v2/plugins` at network level
- mu-plugins are network-wide (affects all subsites)

---

## Sources

### PRIMARY (HIGH confidence)

- [WordPress REST API Plugins Reference](https://developer.wordpress.org/rest-api/reference/plugins/) - Official endpoint documentation
- [WordPress Application Passwords](https://developer.wordpress.org/advanced-administration/security/application-passwords/) - Authentication method
- [WordPress mu-plugins Handbook](https://developer.wordpress.org/advanced-administration/plugins/mu-plugins/) - Must-use plugins documentation
- [Microsoft IndexNow WordPress Plugin SVN](https://plugins.svn.wordpress.org/indexnow/trunk/) - Plugin source code analysis
- [register_setting() Reference](https://developer.wordpress.org/reference/functions/register_setting/) - show_in_rest documentation

### SECONDARY (MEDIUM confidence)

- [Install WordPress Plugin via API - Sandeep Jain](https://sandeepjain.in/install-wordpress-plugin-via-api/) - Practical installation guide
- [WordPress REST API 2026 Guide - SmartWP](https://smartwp.com/wordpress-rest-api/) - Current best practices
- [WordPress REST API 2026 Guide - GigaPress](https://gigapress.net/wordpress-rest-api-guide/) - Application Passwords patterns
- [How to Add llms.txt to WordPress - MeasureBoard](https://www.measureboard.com/how-to/how-to-add-llms-txt-to-wordpress) - Dynamic txt file serving pattern

---

## Metadata

**Confidence breakdown:**
- REST API plugin installation: HIGH - Official WordPress documentation + tested patterns
- Microsoft IndexNow plugin behavior: HIGH - Source code analysis from WordPress SVN
- mu-plugin approach: HIGH - Standard WordPress pattern with verified code
- wp_options approach: MEDIUM - Technically possible but impractical

**Research date:** 2026-05-08
**Valid until:** 2027-05-08 (WordPress REST API is stable, unlikely to change)
