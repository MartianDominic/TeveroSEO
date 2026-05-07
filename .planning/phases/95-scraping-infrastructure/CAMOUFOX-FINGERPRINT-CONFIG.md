# Camoufox Enterprise Fingerprint Configuration

> **Purpose:** World-class fingerprint configuration for Tier T2.5 (Camoufox + Geonode residential) in the tiered scraping system
> **Research Date:** 2026-05-07

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [BrowserForge Integration](#2-browserforge-integration)
3. [OS and Browser Version Distribution](#3-os-and-browser-version-distribution)
4. [Screen Resolution Configuration](#4-screen-resolution-configuration)
5. [WebGL and Canvas Fingerprinting](#5-webgl-and-canvas-fingerprinting)
6. [Navigator and Window Properties](#6-navigator-and-window-properties)
7. [Audio and Font Fingerprinting](#7-audio-and-font-fingerprinting)
8. [Complete TypeScript Configuration](#8-complete-typescript-configuration)
9. [Geonode Proxy Integration](#9-geonode-proxy-integration)
10. [Detection Risks and Mitigations](#10-detection-risks-and-mitigations)

---

## 1. Architecture Overview

### How Camoufox Differs from Other Anti-Detect Solutions

Camoufox is a **custom-compiled Firefox fork** with C++ level modifications, not a configured browser profile or JavaScript injection wrapper.

**Key architectural advantages:**

| Approach | Detection Risk | Why |
|----------|---------------|-----|
| JS Injection (Puppeteer/Playwright) | HIGH | `Object.getOwnPropertyDescriptor` reveals overwritten properties |
| Configured Profile | MEDIUM | Properties still reflect real hardware |
| **Camoufox C++ Interception** | LOW | Native code modification, undetectable via JS |

**How it works:**
1. MaskConfig C++ singleton intercepts property reads at implementation level
2. Properties like `navigator.hardwareConcurrency` are dynamically overridden
3. All hijacked objects appear native to JavaScript inspection
4. Playwright's internal code is sandboxed and isolated from page context

### Current Status Warning (May 2026)

Camoufox is under active development after a maintenance gap. Version v146.0.1-beta.25 is experimental. Key issues:
- Some config overrides (platform, hardwareConcurrency, oscpu) may be silently ignored
- Base Firefox version has caused fingerprint inconsistencies
- Production use requires testing against target sites

---

## 2. BrowserForge Integration

### How Camoufox Uses BrowserForge

BrowserForge is a Bayesian generative network that mimics real-world traffic distributions. Camoufox uses it internally to:

1. Generate statistically accurate device profiles
2. Match real-world OS/browser/screen distributions
3. Ensure fingerprint components are mutually consistent

### What BrowserForge Auto-Generates vs What We Control

| Property | Auto-Generated | Can Override | Recommendation |
|----------|---------------|--------------|----------------|
| User-Agent | Yes | Yes | Let auto-generate (version-matched) |
| Screen dimensions | Yes | Yes (via Screen constraints) | Constrain to common resolutions |
| Navigator properties | Yes | Yes (via config) | Override only if needed |
| WebGL vendor/renderer | Yes | Yes (via webgl_config) | Use auto-generated for consistency |
| Fonts | Yes (OS-matched) | Yes (via fonts config) | Add variance with custom fonts |
| Timezone/Locale | Yes (via geoip) | Yes | Use geoip=true with proxy |

### Fingerprint Consistency Within Session

Camoufox maintains consistency by:
- Using same random seed per session for canvas noise
- Locking fingerprint properties for session duration
- Preventing window resize to avoid dimension inconsistencies

**Critical:** Do NOT rotate fingerprints mid-session. Generate once at launch and reuse.

### Constraining to Common Screen Resolutions

```typescript
import { Camoufox } from 'camoufox-js';

// BrowserForge Screen constraints
const screenConstraints = {
  // These are the common resolutions to target
  // BrowserForge will generate within these bounds
  max_width: 1920,
  max_height: 1080,
  min_width: 1366,
  min_height: 768
};
```

**Target resolutions by market share (2026):**

| Resolution | Global Share | Notes |
|------------|-------------|-------|
| 1920x1080 | ~23% | Most common, safe default |
| 1366x768 | ~10% | Second most common, older laptops |
| 2560x1440 | ~10% | Growing, wealthier markets |
| 1440x900 | ~4% | MacBooks, older displays |
| 1536x864 | ~4% | Windows laptops with scaling |

---

## 3. OS and Browser Version Distribution

### Real-World OS Traffic Distribution

| OS | Desktop Share (2025) | Camoufox Weight |
|----|---------------------|-----------------|
| Windows | 70% | 0.70 |
| macOS | 15% | 0.15 |
| Linux | 5% | 0.05 |

**BrowserForge handles this automatically** - it weights fingerprint generation to match real traffic.

### Should Fingerprint OS Match Binary OS?

**Yes, strongly recommended.**

| Scenario | Risk |
|----------|------|
| Windows fingerprint on Linux binary | DETECTABLE - Font metrics, GPU strings mismatch |
| macOS fingerprint on Windows binary | DETECTABLE - Font rendering differs |
| Matched OS/binary | SAFE - Consistent throughout |

Camoufox bundles fonts for Windows 11, macOS Sonoma, and Linux (Tor bundle), but rendering still differs.

### Safe Firefox Versions to Emulate

**Rule:** Camoufox only generates fingerprints matching its own Firefox version to prevent UA mismatch detection.

| Version Range | Risk | Notes |
|---------------|------|-------|
| Current stable (150) | SAFE | Most users auto-update |
| 1-2 versions behind (148-149) | SAFE | Realistic update lag |
| 3-6 versions behind (144-147) | LOW RISK | Some enterprise users |
| ESR versions (115, 128, 140) | SAFE | Enterprise deployments |
| Very old (<115) | HIGH RISK | Suspicious, likely bot |

**Recommendation:** Let Camoufox use its native version. If rotation needed, use multiple Camoufox binary versions.

---

## 4. Screen Resolution Configuration

### Window vs Screen Dimensions

Camoufox distinguishes between:
- **Screen:** Total display resolution (e.g., 1920x1080)
- **Window outer:** Browser window including chrome
- **Window inner:** Viewport (content area)

**Bot detection signal:** `outerWidth === innerWidth` indicates headless mode (no scrollbars/borders).

### Configuration Example

```typescript
const config = {
  // Screen dimensions (display)
  'screen.width': 1920,
  'screen.height': 1080,
  'screen.availWidth': 1920,
  'screen.availHeight': 1040, // Account for taskbar
  'screen.colorDepth': 24,
  'screen.pixelDepth': 24,
  
  // Window dimensions (must be smaller than screen)
  'window.outerWidth': 1920,
  'window.outerHeight': 1040,
  'window.innerWidth': 1903, // Account for scrollbar (~17px)
  'window.innerHeight': 969, // Account for browser chrome
  
  // Device pixel ratio
  'window.devicePixelRatio': 1, // 1 for 100% scaling, 2 for 200%
};
```

### Display Scaling Considerations

| Scaling | devicePixelRatio | Notes |
|---------|-----------------|-------|
| 100% | 1.0 | Most common |
| 125% | 1.25 | Windows laptops |
| 150% | 1.5 | HiDPI displays |
| 200% | 2.0 | Retina/4K displays |

**Known issue:** Camoufox windows may extend beyond screen with Windows scaling enabled.

---

## 5. WebGL and Canvas Fingerprinting

### WebGL: When to Enable vs Disable

**Default:** WebGL is DISABLED in Camoufox (`webgl.disabled: true`)

| Scenario | WebGL Setting | Why |
|----------|--------------|-----|
| Most scraping | DISABLED | Eliminates fingerprint vector |
| Sites requiring 3D/maps | ENABLED | Google Maps, etc. |
| Heavy anti-bot sites | DISABLED | Reduces attack surface |
| Light protection sites | ENABLED | Looks more "normal" |

**Detection risk when disabled:**
- Some sites check for WebGL presence
- Disabled WebGL is unusual for modern browsers
- May trigger suspicion on graphics-heavy sites

### WebGL Configuration (When Enabled)

```typescript
// Enable WebGL spoofing
const browser = await Camoufox({
  // Must match target OS
  os: 'windows',
  
  // Specific vendor/renderer pair
  // MUST be valid for target OS or causes leaks
  webgl_config: ['Google Inc. (Intel)', 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'],
});
```

### Safe GPU Vendor/Renderer Strings

**Windows (most common):**

| Vendor | Renderer | Market Share |
|--------|----------|-------------|
| Google Inc. (Intel) | ANGLE (Intel, Intel(R) UHD Graphics 630...) | ~35% |
| Google Inc. (NVIDIA) | ANGLE (NVIDIA, NVIDIA GeForce GTX 1060...) | ~25% |
| Google Inc. (AMD) | ANGLE (AMD, AMD Radeon RX 580...) | ~15% |

**macOS:**

| Vendor | Renderer |
|--------|----------|
| Apple | Apple M1 |
| Apple | Apple M2 |
| Intel Inc. | Intel(R) Iris(TM) Plus Graphics |

**Linux:**

| Vendor | Renderer |
|--------|----------|
| Intel | Mesa Intel(R) UHD Graphics 630 |
| NVIDIA Corporation | GeForce GTX 1060/PCIe/SSE2 |

**Critical:** Do NOT randomly assign WebGL values. WAFs hash fingerprints and compare against known-good datasets.

### Canvas Fingerprinting Protection

Camoufox uses a **patched Skia build** with modified subpixel rendering:

1. Randomizes anti-aliasing algorithm (not full canvas)
2. Uses same offsets per session (prevents leaks)
3. No visible artifacts (unlike noise injection)
4. Passes production canvas noise tests

**How it differs from noise injection:**
- Traditional: Add random pixels = easily detected
- Camoufox: Modify rendering pipeline = appears natural

---

## 6. Navigator and Window Properties

### Core Navigator Properties

```typescript
const navigatorConfig = {
  // User-Agent (auto-matched to Firefox version)
  'navigator.userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
  
  // Platform (must match OS)
  'navigator.platform': 'Win32', // 'MacIntel' for macOS, 'Linux x86_64' for Linux
  
  // Hardware (realistic values for desktop)
  'navigator.hardwareConcurrency': 8, // 4-16 typical for desktop
  // NOTE: deviceMemory is Chrome-only, not available in Firefox
  
  // OS/CPU info
  'navigator.oscpu': 'Windows NT 10.0; Win64; x64',
  
  // Language
  'navigator.language': 'en-US',
  'navigator.languages': ['en-US', 'en'],
  
  // Touch support (desktop = 0)
  'navigator.maxTouchPoints': 0,
  
  // Product info
  'navigator.product': 'Gecko',
  'navigator.productSub': '20030107', // Always this value for Firefox
  'navigator.vendor': '', // Empty for Firefox
  'navigator.vendorSub': '',
};
```

### navigator.webdriver Handling

**Camoufox sets `navigator.webdriver = false` at all times.**

Detection methods Camoufox defeats:
- Direct `navigator.webdriver` check
- Stack debugger reading detection
- ChromeDriver variable injection detection

### Connection and Battery APIs

```typescript
const connectionConfig = {
  // Network Information API (limited in Firefox)
  // Firefox doesn't expose navigator.connection like Chrome
  
  // Battery API (can be spoofed)
  'battery.charging': true,
  'battery.chargingTime': Infinity, // When fully charged
  'battery.dischargingTime': Infinity,
  'battery.level': 1.0, // 100%
};
```

**Note:** Firefox has limited Network Information API support compared to Chrome.

### Property Consistency Rules

| Property | Must Match |
|----------|-----------|
| userAgent OS | platform, oscpu |
| hardwareConcurrency | Realistic for device type |
| language | timezone, locale |
| maxTouchPoints | Device type (0 for desktop) |

---

## 7. Audio and Font Fingerprinting

### AudioContext Fingerprinting

Camoufox spoofs at C++ level:

```typescript
const audioConfig = {
  // Sample rate (common values)
  'AudioContext:sampleRate': 48000, // or 44100
  
  // Output latency
  'AudioContext:outputLatency': 0.01, // ~10ms typical
  
  // Channel count
  'AudioContext:maxChannelCount': 2, // Stereo
};
```

**Common values:**

| Property | Safe Values |
|----------|-------------|
| sampleRate | 44100, 48000 |
| outputLatency | 0.005 - 0.02 |
| maxChannelCount | 2 (stereo), 6 (5.1 surround) |

**Critical:** Audio fingerprint must align with other fingerprints. Random audio + stable canvas = bot flag.

### Font Fingerprinting Protection

Camoufox's multi-layer approach:

1. **Bundled OS fonts:** Windows 11 22H2, macOS Sonoma, Linux Tor bundle
2. **Metric fuzzing:** 0-0.1px random letter spacing
3. **OS-matched fonts:** Auto-loads fonts for spoofed User-Agent OS
4. **Custom fonts:** Optional additional fonts

```typescript
const fontConfig = {
  // Add custom fonts for variance
  fonts: [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Verdana'
  ],
};
```

### Font Mismatch Risk with OS

| Scenario | Risk | Detection |
|----------|------|-----------|
| Windows UA + Windows fonts | SAFE | Consistent |
| macOS UA + Windows fonts | HIGH | Font presence mismatch |
| Linux UA + Windows fonts | MEDIUM | Some overlap exists |

**Recommendation:** Always use OS-matched fonts. Let Camoufox auto-select.

---

## 8. Complete TypeScript Configuration

### Production-Ready Configuration for T2.5 Tier

```typescript
import { Camoufox, launchOptions } from 'camoufox-js';
import { firefox } from 'playwright-core';

// =============================================================================
// CAMOUFOX ENTERPRISE CONFIGURATION
// Tier T2.5: Camoufox + Geonode Residential
// =============================================================================

interface CamoufoxConfig {
  os: 'windows' | 'macos' | 'linux' | ('windows' | 'macos' | 'linux')[];
  geoip: boolean | string;
  humanize: boolean | number;
  proxy?: {
    server: string;
    username: string;
    password: string;
  };
  block_images?: boolean;
  block_webrtc?: boolean;
  block_webgl?: boolean;
  locale?: string[];
  timezone?: string;
  fonts?: string[];
  config?: Record<string, unknown>;
  i_know_what_im_doing?: boolean;
}

/**
 * Get weighted OS based on real-world distribution
 */
function getWeightedOS(): 'windows' | 'macos' | 'linux' {
  const rand = Math.random();
  if (rand < 0.70) return 'windows';  // 70% traffic
  if (rand < 0.90) return 'macos';    // 15% traffic  
  return 'linux';                      // 5% traffic
}

/**
 * Get common screen resolution based on market share
 */
function getWeightedScreenConfig(): { width: number; height: number } {
  const rand = Math.random();
  
  // Resolution distribution (2026 data)
  if (rand < 0.40) return { width: 1920, height: 1080 };  // 40% (overweighted for safety)
  if (rand < 0.55) return { width: 1366, height: 768 };   // 15%
  if (rand < 0.70) return { width: 2560, height: 1440 };  // 15%
  if (rand < 0.80) return { width: 1440, height: 900 };   // 10%
  if (rand < 0.90) return { width: 1536, height: 864 };   // 10%
  return { width: 1680, height: 1050 };                    // 10%
}

/**
 * Create enterprise-grade Camoufox configuration
 */
export async function createCamoufoxConfig(
  proxyConfig: { server: string; username: string; password: string },
  options?: Partial<CamoufoxConfig>
): Promise<CamoufoxConfig> {
  const os = options?.os ?? getWeightedOS();
  const screen = getWeightedScreenConfig();
  
  // Calculate realistic window dimensions
  const taskbarHeight = os === 'macos' ? 25 : 40;
  const chromeHeight = 80; // Browser toolbar + tabs
  const scrollbarWidth = 17;
  
  const config: CamoufoxConfig = {
    // Operating system (weighted distribution)
    os,
    
    // GeoIP matching with proxy IP
    geoip: true, // Auto-detect from proxy IP
    
    // Human-like cursor movement (up to 1.5s)
    humanize: 1.5,
    
    // Proxy configuration
    proxy: proxyConfig,
    
    // Resource blocking for performance
    block_images: false,      // Enable if bandwidth-constrained
    block_webrtc: true,       // Always block - prevents IP leaks
    block_webgl: true,        // Disable unless site requires it
    
    // Locale settings (should match geoip)
    locale: ['en-US', 'en'],
    
    // Custom configuration overrides
    config: {
      // Screen dimensions
      'screen.width': screen.width,
      'screen.height': screen.height,
      'screen.availWidth': screen.width,
      'screen.availHeight': screen.height - taskbarHeight,
      'screen.colorDepth': 24,
      'screen.pixelDepth': 24,
      
      // Window dimensions (smaller than screen)
      'window.outerWidth': screen.width,
      'window.outerHeight': screen.height - taskbarHeight,
      'window.innerWidth': screen.width - scrollbarWidth,
      'window.innerHeight': screen.height - taskbarHeight - chromeHeight,
      'window.devicePixelRatio': 1,
      
      // Hardware (realistic desktop values)
      'navigator.hardwareConcurrency': [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)],
      'navigator.maxTouchPoints': 0, // Desktop = no touch
      
      // Battery (plugged in desktop)
      'battery.charging': true,
      'battery.level': 1.0,
    },
    
    // Suppress warnings for manual config
    i_know_what_im_doing: true,
  };
  
  return config;
}

/**
 * Launch Camoufox with enterprise configuration
 */
export async function launchEnterpriseCamoufox(
  proxyConfig: { server: string; username: string; password: string }
) {
  const config = await createCamoufoxConfig(proxyConfig);
  
  const browser = await Camoufox(config);
  
  return browser;
}

// =============================================================================
// ALTERNATIVE: Using launchOptions with Playwright directly
// =============================================================================

export async function launchWithPlaywright(
  proxyConfig: { server: string; username: string; password: string }
) {
  const config = await createCamoufoxConfig(proxyConfig);
  
  const browser = await firefox.launch({
    ...await launchOptions(config),
    // Additional Playwright options
    headless: true,
    timeout: 30000,
  });
  
  return browser;
}
```

### Per-Site Configuration Overrides

```typescript
/**
 * Site-specific overrides for challenging targets
 */
const siteOverrides: Record<string, Partial<CamoufoxConfig>> = {
  // Google properties - enable WebGL for Maps
  'google.com': {
    block_webgl: false,
  },
  
  // Amazon - maximum stealth
  'amazon.com': {
    humanize: 2.0, // Slower, more human movements
    block_webgl: true,
    block_images: false, // They check image loading
  },
  
  // LinkedIn - conservative approach
  'linkedin.com': {
    humanize: 2.5,
    block_webgl: true,
    block_webrtc: true,
  },
  
  // Cloudflare-protected sites
  'cloudflare-protected': {
    humanize: true,
    block_webgl: false, // CF checks WebGL
    block_webrtc: true,
  },
};

export function getConfigForSite(
  domain: string,
  baseConfig: CamoufoxConfig
): CamoufoxConfig {
  const override = siteOverrides[domain] ?? {};
  return { ...baseConfig, ...override };
}
```

---

## 9. Geonode Proxy Integration

### Configuration for Geonode Residential

```typescript
interface GeonodeConfig {
  username: string;
  password: string;
  // Geonode endpoint formats
  endpoint: string;
  // Target country for geo-matching
  country?: string;
}

/**
 * Build Geonode proxy URL for Camoufox
 */
export function buildGeonodeProxy(config: GeonodeConfig): {
  server: string;
  username: string;
  password: string;
} {
  // Geonode residential endpoint
  // Format: http://username:password@premium-residential.geonode.com:PORT
  
  return {
    server: config.endpoint, // e.g., 'http://premium-residential.geonode.com:9000'
    username: config.username,
    password: config.password,
  };
}

/**
 * Full integration example
 */
async function scrapeWithGeonode(targetUrl: string) {
  const geonodeProxy = buildGeonodeProxy({
    username: process.env.GEONODE_USER!,
    password: process.env.GEONODE_PASS!,
    endpoint: 'http://premium-residential.geonode.com:9000',
    country: 'US',
  });
  
  const browser = await launchEnterpriseCamoufox(geonodeProxy);
  
  try {
    const page = await browser.newPage();
    
    // Navigate with realistic timing
    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    
    // Add human-like delay
    await page.waitForTimeout(1000 + Math.random() * 2000);
    
    const html = await page.content();
    return html;
    
  } finally {
    await browser.close();
  }
}
```

### GeoIP Matching Best Practices

| Setting | Description |
|---------|-------------|
| `geoip: true` | Auto-detect timezone/locale from proxy IP |
| `geoip: '1.2.3.4'` | Use specific IP for geo-matching |
| Timezone | Auto-set from IP geolocation |
| Locale | Auto-set from IP country |
| Language | Should match locale |

**Critical:** Fingerprint location MUST match proxy exit IP location.

---

## 10. Detection Risks and Mitigations

### What Camoufox DOES Protect Against

| Attack Vector | Protection Level | Method |
|---------------|-----------------|--------|
| navigator.webdriver | FULL | Always false at C++ level |
| Canvas fingerprinting | FULL | Patched Skia rendering |
| AudioContext fingerprinting | FULL | C++ property spoofing |
| WebGL fingerprinting | FULL | Database of real configs |
| Font enumeration | FULL | Bundled OS fonts + fuzzing |
| Playwright detection | FULL | Isolated sandbox |
| UA mismatch | FULL | Version-matched generation |
| Window dimension leaks | FULL | Locked dimensions |

### What Camoufox DOES NOT Protect Against

| Attack Vector | Risk | Mitigation |
|---------------|------|------------|
| TLS fingerprint (JA3/JA4) | HIGH | Use with residential proxy |
| HTTP/2 frame ordering | MEDIUM | Residential proxies help |
| TCP stack characteristics | MEDIUM | VPN/proxy masking |
| Behavioral analysis | HIGH | Use humanize + delays |
| IP reputation | HIGH | Quality residential IPs |
| CAPTCHA challenges | HIGH | External solver integration |

### Known Issues (v146.0.1-beta.25)

1. **Config overrides ignored:** `navigator.platform`, `navigator.hardwareConcurrency`, `navigator.oscpu` may be silently ignored
2. **Display scaling:** Windows 150%/200% scaling causes window boundary issues  
3. **Version gap:** Base Firefox version behind current stable
4. **Fingerprint drift:** Some inconsistencies with current real-world traffic

### Mitigation Strategies

```typescript
// 1. Always test fingerprint before production
async function validateFingerprint(browser: Browser) {
  const page = await browser.newPage();
  await page.goto('https://browserleaks.com/canvas');
  // Check for anomalies
  
  await page.goto('https://browserscan.net');
  // Verify bot detection score
  
  await page.goto('https://bot.sannysoft.com');
  // Check all green
}

// 2. Use session isolation
async function scrapeWithIsolation(urls: string[]) {
  for (const url of urls) {
    // New browser per domain = new fingerprint
    const browser = await launchEnterpriseCamoufox(proxy);
    try {
      const page = await browser.newPage();
      await page.goto(url);
      // ... scrape
    } finally {
      await browser.close();
    }
  }
}

// 3. Add realistic timing
async function humanizedNavigation(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  // Random delay 1-3 seconds
  await page.waitForTimeout(1000 + Math.random() * 2000);
  
  // Scroll like a human
  await page.evaluate(() => {
    window.scrollBy(0, 300 + Math.random() * 200);
  });
  
  await page.waitForTimeout(500 + Math.random() * 1000);
}
```

---

## Summary Configuration Checklist

### Enable

- [x] `geoip: true` - Match fingerprint to proxy IP location
- [x] `humanize: 1.5` - Human-like cursor movement
- [x] `block_webrtc: true` - Prevent IP leaks
- [x] `block_webgl: true` - Reduce fingerprint surface (unless needed)
- [x] `i_know_what_im_doing: true` - Enable manual config

### Configure

- [x] OS distribution weighted to real traffic (70% Windows)
- [x] Screen resolution from common values (1920x1080 dominant)
- [x] Hardware concurrency realistic (4-16 cores)
- [x] Window smaller than screen (account for chrome/taskbar)
- [x] Locale/timezone matching proxy exit IP

### Avoid

- [ ] Random WebGL values (use database or disable)
- [ ] Rotating fingerprints mid-session
- [ ] Mismatched OS/fonts/UA combinations
- [ ] devicePixelRatio inconsistent with resolution
- [ ] Very old Firefox versions (< 115)

---

## Sources

- [Camoufox Official Documentation](https://camoufox.com/)
- [Camoufox Fingerprint Injection](https://camoufox.com/fingerprint/)
- [Camoufox WebGL Configuration](https://camoufox.com/fingerprint/webgl/)
- [Camoufox Navigator Properties](https://camoufox.com/fingerprint/navigator/)
- [Camoufox GeoIP & Proxy Support](https://camoufox.com/python/geoip/)
- [Camoufox Stealth Overview](https://camoufox.com/stealth/)
- [GitHub - daijro/camoufox](https://github.com/daijro/camoufox)
- [GitHub - apify/camoufox-js](https://github.com/apify/camoufox-js)
- [camoufox-js npm package](https://www.npmjs.com/package/camoufox-js)
- [BrowserForge Integration](https://camoufox.com/python/browserforge/)
- [GitHub - daijro/browserforge](https://github.com/daijro/browserforge)
- [DeepWiki - Camoufox Configuration System](https://deepwiki.com/daijro/camoufox/4-browser-configuration)
- [DeepWiki - Camoufox Fingerprinting System](https://deepwiki.com/daijro/camoufox/3.3-webgl-configuration)
- [StatCounter Screen Resolution Stats](https://gs.statcounter.com/screen-resolution-stats/desktop/worldwide)
- [BrowserStack Common Screen Resolutions](https://www.browserstack.com/guide/common-screen-resolutions)
- [Firefox endoflife.date](https://endoflife.date/firefox)
- [Accio Operating System Market Share](https://www.accio.com/business/operating-system-market-share-trend)
