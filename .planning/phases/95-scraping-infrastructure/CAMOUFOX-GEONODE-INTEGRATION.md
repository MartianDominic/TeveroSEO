# Camoufox + Geonode Residential Proxy Integration Guide

> Research completed: 2026-05-07
> Purpose: World-class stealth scraping with optimal proxy configuration

## Table of Contents

1. [Geonode Authentication Methods](#1-geonode-authentication-methods)
2. [Geo-Targeting Configuration](#2-geo-targeting-configuration)
3. [Sticky vs Rotating Sessions](#3-sticky-vs-rotating-sessions)
4. [Bandwidth Optimization](#4-bandwidth-optimization)
5. [Error Handling](#5-error-handling)
6. [Geonode Endpoint URLs](#6-geonode-endpoint-urls)
7. [Complete TypeScript Configuration](#7-complete-typescript-configuration)
8. [Python Configuration](#8-python-configuration)
9. [Cost Analysis](#9-cost-analysis)

---

## 1. Geonode Authentication Methods

### Username:Password Authentication

**Recommended for Camoufox** - More portable and works across different servers.

```
Format: <username>:<password>@<hostname>:<port>
```

**Finding Your Credentials:**
1. Login to [Geonode Dashboard](https://app.geonode.com/login)
2. Navigate to Dashboard > Authentication details
3. Copy Username and API Key (used as password)

**Actual Credential Format (TeveroSEO):**
```
Host: proxy.geonode.io:9000
Username: geonode_{user_id}-type-residential
Password: {uuid-format-api-key}
```

**Important:** The username already includes `-type-residential` suffix. When adding geo-targeting or session parameters, append them AFTER this suffix:
```
geonode_XXXXX-type-residential-country-us-session-abc123-lifetime-30
```

### IP Whitelist Authentication

- Supports up to 20 whitelisted IP addresses
- Better for static infrastructure (e.g., dedicated VPS)
- No credentials needed in proxy URL

**When to Use Each:**

| Method | Best For | Pros | Cons |
|--------|----------|------|------|
| Username:Password | Dynamic IPs, multiple servers, Camoufox | Portable, no setup per machine | Credentials in config |
| IP Whitelist | Static VPS, simpler scripts | No credential management | Limited to 20 IPs, needs dashboard access |

**Recommendation:** Use **username:password** for Camoufox as it simplifies GeoIP matching and session management.

---

## 2. Geo-Targeting Configuration

### Username Parameter Format

All targeting parameters are appended to the username with `-` prefix.

**Note:** TeveroSEO's username already includes `-type-residential`, so parameters are appended after that:

```
# Base format (without -type-residential in username):
<username>-country-<code>-state-<name>-city-<name>-session-<id>-lifetime-<minutes>:<password>

# TeveroSEO format (username already has -type-residential):
geonode_XXXXX-type-residential-country-<code>-session-<id>-lifetime-<minutes>:<password>
```

### Country Targeting

```
username-country-us:password
username-country-gb:password
username-country-de:password
```

Uses 2-letter ISO country codes.

### State Targeting

```
username-country-us-state-california:password
username-country-us-state-newyork:password
```

**Note:** State names are lowercase with no spaces.

### City Targeting

```
username-country-us-city-newyork:password
username-country-us-city-losangeles:password
username-country-gb-city-london:password
```

**Important Restrictions:**
- City targeting is **Premium tier only**
- Cannot combine state + city (choose one)
- City names are lowercase with no spaces
- Some cities have limited IP availability

### Getting Available Cities

```bash
# Get available cities for a country
curl https://app.geonode.com/api/proxy/targeting/us/residential-premium
curl https://app.geonode.com/api/proxy/targeting/gb/residential-premium
```

### Matching Camoufox GeoIP to Proxy Location

**Critical for stealth:** Camoufox's `geoip` parameter must match your proxy's actual exit location.

```typescript
// CORRECT: Let Camoufox auto-detect proxy IP location
const browser = await Camoufox({
  geoip: true,  // Auto-detect based on proxy exit IP
  proxy: {
    server: 'http://proxy.geonode.io:9000',
    username: 'user-country-us-city-newyork',
    password: 'apikey123'
  }
});

// ALSO CORRECT: Manually specify known IP
const browser = await Camoufox({
  geoip: '203.0.113.45',  // Specific IP for precise fingerprinting
  proxy: { ... }
});
```

**How it works:**
- `geoip: true` - Camoufox makes a request through the proxy to detect exit IP
- Uses MaxMind GeoIP database to determine: longitude, latitude, timezone, country, locale
- Sets browser fingerprint to match (Intl API, navigator.language, timezone)

---

## 3. Sticky vs Rotating Sessions

### Session ID Format

```
username-session-<random_string>:<password>
```

### Session Lifetime Format

```
username-session-abc123-lifetime-30:<password>
```

Lifetime range: **3 minutes to 24 hours** (1440 minutes)

### Complete Sticky Session Example

```
geonode_user-country-us-city-newyork-session-crawl001-lifetime-60:api_key_here
```

This creates:
- US/New York exit IP
- Session ID: crawl001
- Duration: 60 minutes

### When to Use Each

| Scenario | Session Type | Rationale |
|----------|--------------|-----------|
| SEO crawling (same domain) | **Sticky (30-60 min)** | Consistent IP for full site crawl |
| Multi-page forms | **Sticky (10-30 min)** | Maintain session state |
| SERP scraping (many queries) | **Rotating** | Avoid per-IP rate limits |
| Price monitoring | **Rotating** | Different IP per product |
| Login/authenticated scraping | **Sticky (1-24 hours)** | Maintain auth cookies |
| Large-scale data extraction | **Rotating** | Maximum throughput |

### Rotating vs Sticky Ports

| Port Range | Type | Behavior |
|------------|------|----------|
| 9000-9010 | Rotating | New IP per request |
| 10000-10900 | Sticky | Same IP for session duration |

### Session Expiration Behavior

**What happens when a sticky session expires mid-crawl:**

1. Next request gets a **new IP** (session ID reused but new IP assigned)
2. No error is returned - request succeeds with different IP
3. May trigger anti-bot if site tracks IP consistency

**Mitigation:**
- Set session lifetime longer than expected crawl duration
- Monitor IP changes with periodic checks
- Use session ID rotation when IP changes detected

```typescript
// Monitor for IP changes
let currentIP: string | null = null;

async function checkIP(page: Page): Promise<boolean> {
  const response = await page.goto('https://api.ipify.org?format=json');
  const data = await response?.json();
  const newIP = data?.ip;
  
  if (currentIP && currentIP !== newIP) {
    console.warn(`IP changed: ${currentIP} -> ${newIP}`);
    return false; // IP changed
  }
  currentIP = newIP;
  return true;
}
```

---

## 4. Bandwidth Optimization

### Average Page Sizes

| Content Type | Size | Notes |
|--------------|------|-------|
| HTML only (no rendering) | **50-150 KB** | Best for SEO scraping |
| HTML with minimal JS | **100-200 KB** | Light pages |
| Full page (rendered) | **100-300 KB** | With JS execution |
| Modern web page (all assets) | **2-3 MB** | Images, CSS, fonts |

### Cost per 1000 Pages at $0.77/GB

| Page Type | Size Estimate | Cost per 1000 Pages |
|-----------|---------------|---------------------|
| HTML only | 100 KB | **$0.077** |
| Light rendering | 200 KB | **$0.154** |
| Full rendering | 300 KB | **$0.231** |
| Full assets | 2.5 MB | **$1.925** |

**SEO scraping target:** 100 KB average = **$0.077 per 1000 pages**

### Blocking Resources in Camoufox

**Built-in Option (Recommended):**

```typescript
const browser = await Camoufox({
  block_images: true,  // Built-in image blocking
  // Note: CSS/font blocking requires route interception
});
```

**Full Resource Blocking with Playwright Routes:**

```typescript
const browser = await Camoufox({
  block_images: true,
});

const page = await browser.newPage();

// Block additional resource types
await page.route('**/*', (route) => {
  const resourceType = route.request().resourceType();
  const blockedTypes = [
    'image',      // Already blocked by block_images, but belt & suspenders
    'stylesheet', // CSS files
    'font',       // Web fonts
    'media',      // Video/audio
  ];
  
  if (blockedTypes.includes(resourceType)) {
    return route.abort();
  }
  return route.continue();
});
```

**Firefox Preferences Method:**

```typescript
const browser = await Camoufox({
  firefox_user_prefs: {
    'permissions.default.image': 2,  // Block images
    'browser.display.use_document_fonts': 0,  // Block web fonts
  }
});
```

### Compression Handling

Geonode proxies handle compression transparently:
- Accept-Encoding: gzip, deflate, br (Brotli)
- Response decompression handled by browser
- **No special configuration needed** - Camoufox/Playwright handles this

### Bandwidth Savings Summary

| Optimization | Savings |
|--------------|---------|
| Block images | **60-70%** |
| Block CSS | **10-15%** |
| Block fonts | **5-10%** |
| Block media | **Variable** |
| **Total potential savings** | **75-85%** |

---

## 5. Error Handling

### Geonode HTTP Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| **200** | Success | Continue |
| **401** | Unauthorized | Check credentials |
| **403** | Forbidden | Bandwidth exceeded, domain blocked, or tier mismatch |
| **407** | Proxy Auth Required | Credentials not sent or malformed |
| **429** | Too Many Requests | Rate limited - back off |
| **502** | Bad Gateway | Target server issue - retry |
| **503** | Service Unavailable | Proxy overloaded - retry with backoff |
| **504** | Gateway Timeout | Target slow - increase timeout |

### Error Handling Strategy

```typescript
interface ProxyError {
  code: number;
  shouldRotate: boolean;
  shouldEscalate: boolean;
  retryDelay: number;
}

function handleProxyError(statusCode: number): ProxyError {
  switch (statusCode) {
    case 401:
    case 407:
      // Auth failure - don't retry, fix credentials
      return { code: statusCode, shouldRotate: false, shouldEscalate: false, retryDelay: 0 };
    
    case 403:
      // Bandwidth/quota - escalate to next tier
      return { code: statusCode, shouldRotate: false, shouldEscalate: true, retryDelay: 0 };
    
    case 429:
      // Rate limited - rotate IP and backoff
      return { code: statusCode, shouldRotate: true, shouldEscalate: false, retryDelay: 5000 };
    
    case 502:
    case 504:
      // Target issue - retry same IP
      return { code: statusCode, shouldRotate: false, shouldEscalate: false, retryDelay: 2000 };
    
    case 503:
      // Proxy overload - rotate and backoff
      return { code: statusCode, shouldRotate: true, shouldEscalate: false, retryDelay: 10000 };
    
    default:
      return { code: statusCode, shouldRotate: true, shouldEscalate: false, retryDelay: 1000 };
  }
}
```

### When to Rotate vs Escalate Tier

| Condition | Action |
|-----------|--------|
| Single 403/429 | Rotate IP within same tier |
| 3+ consecutive 403s | Escalate to next proxy tier |
| Auth failures (401/407) | Fix credentials, don't rotate |
| 502/504 errors | Retry same IP with backoff |
| IP blocked by target | Rotate IP |
| Captcha challenge | Escalate tier or use solver |

### IP Exhaustion Detection

```typescript
const failuresBySession = new Map<string, number>();
const MAX_FAILURES_PER_SESSION = 3;

function trackFailure(sessionId: string): boolean {
  const current = failuresBySession.get(sessionId) || 0;
  failuresBySession.set(sessionId, current + 1);
  
  if (current + 1 >= MAX_FAILURES_PER_SESSION) {
    console.warn(`Session ${sessionId} exhausted - rotating`);
    failuresBySession.delete(sessionId);
    return true; // Should create new session
  }
  return false;
}
```

---

## 6. Geonode Endpoint URLs

### Current Endpoints (2026)

| Service | Hostname | Protocol |
|---------|----------|----------|
| **Primary** | `proxy.geonode.io` | HTTP/HTTPS/SOCKS5 |
| **Legacy** | `premium-residential.geonode.com` | HTTP/HTTPS/SOCKS5 |

**Note:** `premium-residential.geonode.com` still works but `proxy.geonode.io` is the current recommended endpoint.

### Port Configuration

| Port Range | Session Type | Protocol |
|------------|--------------|----------|
| **9000-9010** | Rotating | HTTP/HTTPS |
| **10000-10900** | Sticky | HTTP/HTTPS |

**SOCKS5:** Use same ports, change protocol in connection string.

### Complete Connection Strings

**Rotating HTTP:**
```
http://username:password@proxy.geonode.io:9000
```

**Sticky HTTP (30 min session):**
```
http://username-session-abc123-lifetime-30:password@proxy.geonode.io:10000
```

**Rotating with US targeting:**
```
http://username-country-us:password@proxy.geonode.io:9000
```

**Sticky with NYC targeting (60 min):**
```
http://username-country-us-city-newyork-session-nyc001-lifetime-60:password@proxy.geonode.io:10000
```

**SOCKS5 Rotating:**
```
socks5://username:password@proxy.geonode.io:9000
```

---

## 7. Complete TypeScript Configuration

### Installation

```bash
npm install camoufox playwright
npx camoufox fetch  # Download browser binaries
```

### Full Configuration with All Options

```typescript
import { Camoufox } from 'camoufox';
import type { Page, BrowserContext } from 'playwright';

// =============================================================================
// GEONODE CONFIGURATION
// =============================================================================

interface GeonodeConfig {
  /**
   * Base username from Geonode dashboard.
   * TeveroSEO format: "geonode_XXXXX-type-residential"
   * Note: The -type-residential suffix is PART OF the username
   */
  username: string;
  /** UUID-format API key from Geonode dashboard */
  password: string;
  /** Proxy hostname - use "proxy.geonode.io" */
  hostname: string;
  // Targeting (appended AFTER -type-residential)
  country?: string;
  state?: string;
  city?: string;  // Premium tier only
  // Session
  sessionId?: string;
  lifetimeMinutes?: number;  // 3-1440 minutes
  // Protocol
  protocol: 'http' | 'https' | 'socks5';
  /** 9000-9010 rotating, 10000-10900 sticky */
  port: number;
}

function buildGeonodeProxyUrl(config: GeonodeConfig): string {
  let username = config.username;
  
  // Add targeting parameters
  if (config.country) {
    username += `-country-${config.country.toLowerCase()}`;
  }
  if (config.state) {
    username += `-state-${config.state.toLowerCase().replace(/\s+/g, '')}`;
  }
  if (config.city) {
    username += `-city-${config.city.toLowerCase().replace(/\s+/g, '')}`;
  }
  
  // Add session parameters
  if (config.sessionId) {
    username += `-session-${config.sessionId}`;
  }
  if (config.lifetimeMinutes) {
    username += `-lifetime-${config.lifetimeMinutes}`;
  }
  
  return `${config.protocol}://${username}:${config.password}@${config.hostname}:${config.port}`;
}

// =============================================================================
// CAMOUFOX BROWSER FACTORY
// =============================================================================

interface CamoufoxOptions {
  // Proxy
  proxy: GeonodeConfig;
  
  // Fingerprint
  os?: 'windows' | 'macos' | 'linux' | Array<'windows' | 'macos' | 'linux'>;
  locale?: string | string[];
  
  // Stealth
  geoip?: boolean | string;
  humanize?: boolean | number;
  
  // Performance
  blockImages?: boolean;
  blockWebRTC?: boolean;
  headless?: boolean | 'virtual';
  
  // Resource blocking
  blockStylesheets?: boolean;
  blockFonts?: boolean;
  blockMedia?: boolean;
}

async function createStealthBrowser(options: CamoufoxOptions) {
  const proxyUrl = buildGeonodeProxyUrl(options.proxy);
  
  const browser = await Camoufox({
    // Operating system fingerprint
    os: options.os ?? ['windows', 'macos'],
    
    // Locale settings
    locale: options.locale ?? ['en-US', 'en-GB'],
    
    // GeoIP matching (CRITICAL for stealth)
    geoip: options.geoip ?? true,
    
    // Human-like cursor movement
    humanize: options.humanize ?? 1.5,
    
    // Headless mode
    headless: options.headless ?? 'virtual',
    
    // Built-in resource blocking
    block_images: options.blockImages ?? true,
    block_webrtc: options.blockWebRTC ?? true,
    
    // Proxy configuration
    proxy: {
      server: `${options.proxy.protocol}://${options.proxy.hostname}:${options.proxy.port}`,
      username: buildProxyUsername(options.proxy),
      password: options.proxy.password,
    },
    
    // Firefox preferences for additional optimization
    firefox_user_prefs: {
      'permissions.default.image': options.blockImages ? 2 : 1,
      'browser.display.use_document_fonts': options.blockFonts ? 0 : 1,
      'media.autoplay.default': 5, // Block autoplay
      'dom.webnotifications.enabled': false,
    },
  });
  
  return browser;
}

function buildProxyUsername(config: GeonodeConfig): string {
  let username = config.username;
  
  if (config.country) username += `-country-${config.country.toLowerCase()}`;
  if (config.state) username += `-state-${config.state.toLowerCase().replace(/\s+/g, '')}`;
  if (config.city) username += `-city-${config.city.toLowerCase().replace(/\s+/g, '')}`;
  if (config.sessionId) username += `-session-${config.sessionId}`;
  if (config.lifetimeMinutes) username += `-lifetime-${config.lifetimeMinutes}`;
  
  return username;
}

// =============================================================================
// PAGE FACTORY WITH RESOURCE BLOCKING
// =============================================================================

async function createOptimizedPage(
  browser: BrowserContext,
  options: { blockStylesheets?: boolean; blockFonts?: boolean; blockMedia?: boolean }
): Promise<Page> {
  const page = await browser.newPage();
  
  // Set up resource blocking
  const blockedTypes: string[] = [];
  if (options.blockStylesheets) blockedTypes.push('stylesheet');
  if (options.blockFonts) blockedTypes.push('font');
  if (options.blockMedia) blockedTypes.push('media');
  
  if (blockedTypes.length > 0) {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (blockedTypes.includes(resourceType)) {
        return route.abort();
      }
      return route.continue();
    });
  }
  
  return page;
}

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

// Example 1: SEO Crawling (Sticky Session)
// Note: TeveroSEO username already includes -type-residential
async function seoCrawlExample() {
  const browser = await createStealthBrowser({
    proxy: {
      username: process.env.GEONODE_USERNAME!, // geonode_XXXXX-type-residential
      password: process.env.GEONODE_PASSWORD!,
      hostname: process.env.GEONODE_HOST || 'proxy.geonode.io',
      protocol: 'http',
      port: 10000, // Sticky port
      country: 'us',
      sessionId: `crawl-${Date.now()}`,
      lifetimeMinutes: 60,
    },
    os: 'windows',
    geoip: true,
    blockImages: true,
    headless: 'virtual',
  });
  
  const page = await createOptimizedPage(browser, {
    blockStylesheets: true,
    blockFonts: true,
  });
  
  await page.goto('https://example.com');
  const html = await page.content();
  
  await browser.close();
  return html;
}

// Example 2: SERP Scraping (Rotating)
async function serpScrapingExample() {
  const browser = await createStealthBrowser({
    proxy: {
      username: 'geonode_user123',
      password: 'your_api_key',
      hostname: 'proxy.geonode.io',
      protocol: 'http',
      port: 9000, // Rotating port
      country: 'us',
    },
    os: ['windows', 'macos'],
    geoip: true,
    blockImages: true,
    humanize: 2.0,
    headless: 'virtual',
  });
  
  const page = await createOptimizedPage(browser, {
    blockStylesheets: true,
    blockFonts: true,
    blockMedia: true,
  });
  
  await page.goto('https://www.google.com/search?q=seo+tools');
  // ... extract results
  
  await browser.close();
}

// Example 3: Geo-Targeted Scraping (NYC)
async function geoTargetedExample() {
  const browser = await createStealthBrowser({
    proxy: {
      username: 'geonode_user123',
      password: 'your_api_key',
      hostname: 'proxy.geonode.io',
      protocol: 'http',
      port: 10000,
      country: 'us',
      city: 'newyork',
      sessionId: 'nyc-session-001',
      lifetimeMinutes: 30,
    },
    locale: 'en-US',
    geoip: true, // Will auto-detect NYC coordinates
    blockImages: true,
  });
  
  // Browser fingerprint now matches NYC: timezone, coordinates, locale
  const page = await browser.newPage();
  await page.goto('https://local-business-site.com');
  
  await browser.close();
}

export {
  createStealthBrowser,
  createOptimizedPage,
  buildGeonodeProxyUrl,
  type GeonodeConfig,
  type CamoufoxOptions,
};
```

---

## 8. Python Configuration

### Installation

```bash
pip install -U 'camoufox[geoip]'
camoufox fetch
```

### Complete Python Implementation

```python
from camoufox.sync_api import Camoufox
from camoufox.async_api import AsyncCamoufox
from dataclasses import dataclass
from typing import Optional, List, Union, Literal
import asyncio

# =============================================================================
# GEONODE CONFIGURATION
# =============================================================================

@dataclass
class GeonodeConfig:
    username: str
    password: str
    hostname: str = "proxy.geonode.io"
    protocol: Literal["http", "https", "socks5"] = "http"
    port: int = 9000
    # Targeting
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    # Session
    session_id: Optional[str] = None
    lifetime_minutes: Optional[int] = None

    def build_username(self) -> str:
        """Build username with all targeting and session parameters."""
        username = self.username
        
        if self.country:
            username += f"-country-{self.country.lower()}"
        if self.state:
            username += f"-state-{self.state.lower().replace(' ', '')}"
        if self.city:
            username += f"-city-{self.city.lower().replace(' ', '')}"
        if self.session_id:
            username += f"-session-{self.session_id}"
        if self.lifetime_minutes:
            username += f"-lifetime-{self.lifetime_minutes}"
        
        return username
    
    def to_proxy_dict(self) -> dict:
        """Convert to Camoufox proxy configuration dict."""
        return {
            "server": f"{self.protocol}://{self.hostname}:{self.port}",
            "username": self.build_username(),
            "password": self.password,
        }
    
    def to_url(self) -> str:
        """Build complete proxy URL."""
        return f"{self.protocol}://{self.build_username()}:{self.password}@{self.hostname}:{self.port}"


# =============================================================================
# STEALTH BROWSER FACTORY
# =============================================================================

def create_stealth_browser(
    proxy: GeonodeConfig,
    *,
    os: Union[str, List[str]] = ["windows", "macos"],
    locale: Union[str, List[str]] = ["en-US", "en-GB"],
    geoip: Union[bool, str] = True,
    humanize: Union[bool, float] = 1.5,
    headless: Union[bool, Literal["virtual"]] = "virtual",
    block_images: bool = True,
    block_webrtc: bool = True,
):
    """
    Create a stealth Camoufox browser with Geonode proxy.
    
    Args:
        proxy: Geonode proxy configuration
        os: Target OS for fingerprint ('windows', 'macos', 'linux', or list)
        locale: Browser locale(s)
        geoip: True to auto-detect, or specific IP address
        humanize: True or max cursor movement duration in seconds
        headless: False, True, or 'virtual' (Linux with Xvfb)
        block_images: Block image requests
        block_webrtc: Block WebRTC to prevent IP leaks
    
    Returns:
        Camoufox browser context
    """
    return Camoufox(
        os=os,
        locale=locale,
        geoip=geoip,
        humanize=humanize,
        headless=headless,
        block_images=block_images,
        block_webrtc=block_webrtc,
        proxy=proxy.to_proxy_dict(),
        firefox_user_prefs={
            "permissions.default.image": 2 if block_images else 1,
            "browser.display.use_document_fonts": 0,  # Block web fonts
            "media.autoplay.default": 5,  # Block autoplay
            "dom.webnotifications.enabled": False,
        },
    )


async def create_stealth_browser_async(
    proxy: GeonodeConfig,
    **kwargs
):
    """Async version of create_stealth_browser."""
    return AsyncCamoufox(
        proxy=proxy.to_proxy_dict(),
        geoip=kwargs.get("geoip", True),
        humanize=kwargs.get("humanize", 1.5),
        headless=kwargs.get("headless", "virtual"),
        block_images=kwargs.get("block_images", True),
        block_webrtc=kwargs.get("block_webrtc", True),
        os=kwargs.get("os", ["windows", "macos"]),
        locale=kwargs.get("locale", ["en-US", "en-GB"]),
    )


# =============================================================================
# RESOURCE BLOCKING
# =============================================================================

def setup_resource_blocking(page, *, block_css=True, block_fonts=True, block_media=True):
    """Set up Playwright route to block additional resources."""
    blocked_types = []
    if block_css:
        blocked_types.append("stylesheet")
    if block_fonts:
        blocked_types.append("font")
    if block_media:
        blocked_types.append("media")
    
    def handle_route(route):
        if route.request.resource_type in blocked_types:
            route.abort()
        else:
            route.continue_()
    
    page.route("**/*", handle_route)


# =============================================================================
# USAGE EXAMPLES
# =============================================================================

def seo_crawl_example():
    """SEO crawling with sticky session."""
    import os
    import time
    
    # TeveroSEO: username already includes -type-residential
    proxy = GeonodeConfig(
        username=os.environ["GEONODE_USERNAME"],  # geonode_XXXXX-type-residential
        password=os.environ["GEONODE_PASSWORD"],
        hostname=os.environ.get("GEONODE_HOST", "proxy.geonode.io"),
        port=10000,  # Sticky port (10000-10900)
        protocol="http",
        country="us",
        session_id=f"crawl-{int(time.time())}",
        lifetime_minutes=60,
    )
    
    with create_stealth_browser(proxy, block_images=True) as browser:
        page = browser.new_page()
        setup_resource_blocking(page, block_css=True, block_fonts=True)
        
        page.goto("https://example.com")
        html = page.content()
        
        return html


def serp_scraping_example():
    """SERP scraping with rotating IPs."""
    proxy = GeonodeConfig(
        username="geonode_user123",
        password="your_api_key",
        hostname="proxy.geonode.io",
        port=9000,  # Rotating port
        protocol="http",
        country="us",
    )
    
    with create_stealth_browser(proxy, humanize=2.0) as browser:
        page = browser.new_page()
        setup_resource_blocking(page)
        
        page.goto("https://www.google.com/search?q=seo+tools")
        # Extract results...
        

def geo_targeted_example():
    """Geo-targeted scraping for NYC."""
    proxy = GeonodeConfig(
        username="geonode_user123",
        password="your_api_key",
        hostname="proxy.geonode.io",
        port=10000,
        protocol="http",
        country="us",
        city="newyork",
        session_id="nyc-001",
        lifetime_minutes=30,
    )
    
    # geoip=True will auto-detect NYC coordinates from proxy exit IP
    with create_stealth_browser(proxy, geoip=True, locale="en-US") as browser:
        page = browser.new_page()
        page.goto("https://local-business.com")
        # Browser fingerprint matches NYC: timezone, coordinates, locale


async def async_crawl_example():
    """Async crawling example."""
    proxy = GeonodeConfig(
        username="geonode_user123",
        password="your_api_key",
        port=10000,
        country="us",
        session_id="async-001",
        lifetime_minutes=30,
    )
    
    async with create_stealth_browser_async(proxy) as browser:
        page = await browser.new_page()
        await page.goto("https://example.com")
        html = await page.content()
        return html


if __name__ == "__main__":
    # Run sync example
    html = seo_crawl_example()
    print(f"Fetched {len(html)} bytes")
    
    # Run async example
    # html = asyncio.run(async_crawl_example())
```

---

## 9. Cost Analysis

### Geonode Pricing Tiers

| Plan | Base Price | Included GB | Extra GB Cost |
|------|------------|-------------|---------------|
| Trial | $5 | 10 GB | - |
| Standard | $50/mo | 50 GB | $1.00/GB |
| Business | $50/mo | 100 GB | $0.50/GB |
| Enterprise | $27,000/mo | High volume | $0.27/GB |

**For SEO scraping at $0.77/GB (approximate average):**

### Cost per 1000 Pages

| Optimization Level | Avg Page Size | Cost/1000 Pages |
|-------------------|---------------|-----------------|
| Full assets | 2.5 MB | $1.93 |
| Light rendering | 300 KB | $0.23 |
| HTML + minimal JS | 150 KB | $0.12 |
| **HTML only (optimized)** | **100 KB** | **$0.077** |
| Aggressive blocking | 50 KB | $0.039 |

### Monthly Cost Projections

| Pages/Month | Optimized (100KB) | Unoptimized (2.5MB) |
|-------------|-------------------|---------------------|
| 10,000 | $0.77 | $19.25 |
| 100,000 | $7.70 | $192.50 |
| 500,000 | $38.50 | $962.50 |
| 1,000,000 | $77.00 | $1,925.00 |

**Optimization ROI:** 25x cost reduction with proper resource blocking.

### Bandwidth Budget Calculator

```typescript
function calculateMonthlyCost(
  pagesPerMonth: number,
  avgPageSizeKB: number = 100,
  pricePerGB: number = 0.77
): { totalGB: number; cost: number } {
  const totalGB = (pagesPerMonth * avgPageSizeKB) / (1024 * 1024);
  const cost = totalGB * pricePerGB;
  return { totalGB, cost };
}

// Example: 500K pages/month with optimized scraping
const { totalGB, cost } = calculateMonthlyCost(500000, 100, 0.77);
// totalGB: 47.68 GB, cost: $36.72
```

---

## Quick Reference

### Proxy URL Templates

```bash
# Generic format
http://USER:PASS@proxy.geonode.io:9000

# TeveroSEO format (username already includes -type-residential)
# Rotating (new IP per request)
http://geonode_XXXXX-type-residential:PASS@proxy.geonode.io:9000

# Sticky (same IP for duration)
http://geonode_XXXXX-type-residential-session-ID-lifetime-MIN:PASS@proxy.geonode.io:10000

# With country targeting
http://geonode_XXXXX-type-residential-country-us:PASS@proxy.geonode.io:9000

# Full example (US/NYC, 60min sticky)
http://geonode_XXXXX-type-residential-country-us-city-newyork-session-abc123-lifetime-60:PASS@proxy.geonode.io:10000
```

### Camoufox Essential Options

```typescript
{
  geoip: true,           // Match fingerprint to proxy location
  block_images: true,    // Save ~60% bandwidth
  block_webrtc: true,    // Prevent IP leaks
  humanize: 1.5,         // Natural cursor movement
  headless: 'virtual',   // Linux with Xvfb
  os: ['windows', 'macos'],  // Common fingerprints
}
```

### Decision Matrix

| Scenario | Port | Session | Lifetime |
|----------|------|---------|----------|
| SERP scraping | 9000 | None | N/A |
| Site crawl | 10000 | Yes | 30-60 min |
| Login required | 10000 | Yes | 1-24 hours |
| Price monitoring | 9000 | None | N/A |
| Form submission | 10000 | Yes | 10-30 min |

---

## Sources

- [Geonode Proxy Authentication](https://docs.geonode.com/docs/guides/proxy-service-guide/proxy-authentication)
- [Geonode Session Type Documentation](https://docs.geonode.com/docs/guides/proxy-service-guide/session-type)
- [Geonode Geo-Targeting](https://docs.geonode.com/knowledge-base/proxy-service-guide/geo-targeting)
- [Geonode Protocol Configuration](https://docs.geonode.com/docs/guides/proxy-service-guide/protocol-type)
- [Geonode Error Handling](https://docs.geonode.com/docs/api-reference/error-handling)
- [Geonode Residential Pricing](https://geonode.com/pricing/residential-proxies)
- [Camoufox Documentation](https://camoufox.com/python/usage/)
- [Camoufox GitHub](https://github.com/daijro/camoufox)
- [Camoufox Stealth Features](https://camoufox.com/stealth/)
- [Camoufox NPM Package](https://socket.dev/npm/package/camoufox)
- [Sticky vs Rotating Proxies Guide](https://proxyway.com/guides/sticky-or-rotating-proxies)
- [Web Scraping Bandwidth Optimization](https://docs.apify.com/academy/node-js/optimizing-scrapers)
- [Average Web Page Size 2025](https://www.captaindns.com/en/blog/median-web-page-weight-2025)
- [Playwright Resource Blocking](https://scrapingant.com/blog/block-requests-playwright)
