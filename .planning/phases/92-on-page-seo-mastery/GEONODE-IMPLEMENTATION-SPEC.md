# Geonode Proxy Integration - Production Implementation Spec

**Date:** 2026-05-07  
**Status:** Ready for Implementation  
**Location:** `open-seo-main/src/server/features/scraping/`

---

## 1. Real Credential Format Analysis

**User-provided credentials:**
```
Host: proxy.geonode.io:9000
Username: geonode_y9ZVNlVjdE-type-residential
Password: 34000f84-a2dd-4ce9-9892-57413ad0862e
```

**Key observations:**

1. **Username already includes proxy type suffix**: `-type-residential`
   - This differs from Geonode docs that show adding `-type-` separately
   - The username is pre-configured for residential proxy access
   - Format: `geonode_{accountId}-type-{proxyType}`

2. **Proxy URL construction:**
   ```
   http://geonode_y9ZVNlVjdE-type-residential:34000f84-a2dd-4ce9-9892-57413ad0862e@proxy.geonode.io:9000
   ```

3. **Dynamic options are appended to username:**
   - Session persistence: `-session-{sessionId}`
   - Geo-targeting: `-country-us`, `-city-newyork`
   - Lifetime: `-lifetime-10m`

---

## 2. Environment Configuration

### 2.1 `.env` File Structure

Add to `open-seo-main/.env.example`:

```env
# =============================================================================
# PROXY SERVICES (REQUIRED for scraping escalation - Phase 92)
# =============================================================================
# These are required for the tiered scraping architecture.
# Without these, the system will only use direct fetch and DataForSEO.

# -----------------------------------------------------------------------------
# Webshare Free Proxy (T1) - Optional
# -----------------------------------------------------------------------------
# Free tier: 10 DC proxies, 1GB/month
# Get from https://www.webshare.io/ > API
# Leave empty to skip T1 and escalate directly to Geonode
# WEBSHARE_API_KEY=

# -----------------------------------------------------------------------------
# Geonode Residential Proxy (T2) - REQUIRED for cost optimization
# -----------------------------------------------------------------------------
# Starter plan: $1/GB residential bandwidth
# Get from https://geonode.com/dashboard
#
# GEONODE_HOST: Proxy host (default: proxy.geonode.io)
# GEONODE_PORT: Proxy port (default: 9000 for rotating, 9001 for sticky)
# GEONODE_USERNAME: Full username including type suffix
#   Format: geonode_{accountId}-type-residential
#   The username already includes the proxy type - do not add it again
# GEONODE_PASSWORD: API password (UUID format)
#
# SECURITY: Store password in secrets manager in production
#
GEONODE_HOST=proxy.geonode.io
GEONODE_PORT=9000
GEONODE_USERNAME=geonode_ACCOUNT_ID_HERE-type-residential
GEONODE_PASSWORD=

# Optional: Default geo-targeting
# ISO 3166-1 alpha-2 country code (e.g., us, gb, de)
# Leave empty for global rotation
# GEONODE_DEFAULT_COUNTRY=

# Optional: Session persistence (minutes)
# For sites that require session consistency
# Default: 0 (no persistence, rotating IPs)
# GEONODE_SESSION_LIFETIME_MIN=0
```

### 2.2 Actual `.env` Content (Masked)

```env
# Geonode Residential Proxy - Production
GEONODE_HOST=proxy.geonode.io
GEONODE_PORT=9000
GEONODE_USERNAME=geonode_y9ZVNlVjdE-type-residential
GEONODE_PASSWORD=********-****-****-****-************
```

---

## 3. Environment Validation Module

### File: `src/server/features/scraping/config/proxy-config.ts`

```typescript
/**
 * Proxy Configuration Module
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Handles validation and construction of proxy configurations
 * for the tiered fetching system.
 */

import { z } from "zod";

// =============================================================================
// Geonode Configuration Schema
// =============================================================================

/**
 * Geonode proxy configuration schema.
 * Validates environment variables with sensible defaults.
 */
export const GeonodeConfigSchema = z.object({
  /**
   * Proxy host (without protocol).
   * Default: proxy.geonode.io
   */
  host: z.string().default("proxy.geonode.io"),

  /**
   * Proxy port.
   * 9000 = rotating residential
   * 9001 = sticky residential (session persistence)
   * 9002 = rotating datacenter
   * 9003 = sticky datacenter
   */
  port: z.coerce.number().int().min(1).max(65535).default(9000),

  /**
   * Full username including proxy type suffix.
   * Format: geonode_{accountId}-type-{proxyType}
   *
   * The username already contains the proxy type (residential/datacenter).
   * Do NOT add `-type-` again when constructing URLs.
   */
  username: z
    .string()
    .min(1, "GEONODE_USERNAME is required")
    .refine(
      (val) => val.includes("-type-"),
      "GEONODE_USERNAME must include proxy type suffix (e.g., -type-residential)"
    ),

  /**
   * API password (UUID format).
   * SECURITY: Should be stored in secrets manager in production.
   */
  password: z
    .string()
    .min(1, "GEONODE_PASSWORD is required")
    .refine(
      (val) => /^[a-f0-9-]{36}$/i.test(val),
      "GEONODE_PASSWORD should be a UUID (e.g., 34000f84-a2dd-4ce9-9892-57413ad0862e)"
    ),

  /**
   * Default country for geo-targeting (ISO 3166-1 alpha-2).
   * Empty = global rotation.
   */
  defaultCountry: z
    .string()
    .length(2)
    .optional()
    .transform((val) => val?.toLowerCase()),

  /**
   * Default session lifetime in minutes.
   * 0 = no persistence (rotating IPs per request).
   */
  sessionLifetimeMin: z.coerce.number().int().min(0).max(60).default(0),
});

export type GeonodeConfig = z.infer<typeof GeonodeConfigSchema>;

// =============================================================================
// Webshare Configuration Schema
// =============================================================================

/**
 * Webshare proxy configuration schema.
 * Optional - can be skipped if not using free DC proxies.
 */
export const WebshareConfigSchema = z.object({
  /**
   * Webshare API key.
   * Get from https://www.webshare.io/
   */
  apiKey: z.string().optional(),

  /**
   * Whether Webshare is enabled.
   * Automatically disabled if apiKey is not provided.
   */
  enabled: z.boolean().default(false),
});

export type WebshareConfig = z.infer<typeof WebshareConfigSchema>;

// =============================================================================
// Combined Proxy Configuration
// =============================================================================

/**
 * Combined proxy configuration for all tiers.
 */
export interface ProxyConfig {
  geonode: GeonodeConfig | null;
  webshare: WebshareConfig | null;

  /** Whether any proxy tier is configured */
  hasProxies: boolean;

  /** Configured tiers in escalation order */
  availableTiers: Array<"webshare" | "geonode">;
}

// =============================================================================
// Environment Loading
// =============================================================================

/**
 * Load and validate proxy configuration from environment.
 * Fails gracefully if proxies are not configured.
 */
export function loadProxyConfig(): ProxyConfig {
  // Try to load Geonode config
  let geonode: GeonodeConfig | null = null;
  const geonodeUsername = process.env.GEONODE_USERNAME?.trim();
  const geonodePassword = process.env.GEONODE_PASSWORD?.trim();

  if (geonodeUsername && geonodePassword) {
    try {
      geonode = GeonodeConfigSchema.parse({
        host: process.env.GEONODE_HOST,
        port: process.env.GEONODE_PORT,
        username: geonodeUsername,
        password: geonodePassword,
        defaultCountry: process.env.GEONODE_DEFAULT_COUNTRY,
        sessionLifetimeMin: process.env.GEONODE_SESSION_LIFETIME_MIN,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        // In production, log error but don't crash
        console.error(
          "[ProxyConfig] Invalid Geonode configuration:",
          error instanceof z.ZodError
            ? error.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
            : error
        );
      }
      // In development, allow missing config
    }
  }

  // Try to load Webshare config
  let webshare: WebshareConfig | null = null;
  const webshareApiKey = process.env.WEBSHARE_API_KEY?.trim();

  if (webshareApiKey) {
    webshare = {
      apiKey: webshareApiKey,
      enabled: true,
    };
  }

  // Determine available tiers
  const availableTiers: Array<"webshare" | "geonode"> = [];
  if (webshare?.enabled) availableTiers.push("webshare");
  if (geonode) availableTiers.push("geonode");

  return {
    geonode,
    webshare,
    hasProxies: availableTiers.length > 0,
    availableTiers,
  };
}

/**
 * Get validated proxy config, throwing if required proxies are missing.
 * Use this in production code that requires proxy access.
 */
export function getRequiredProxyConfig(): ProxyConfig {
  const config = loadProxyConfig();

  if (!config.geonode) {
    throw new Error(
      "Geonode proxy configuration is required for tiered scraping. " +
        "Set GEONODE_USERNAME and GEONODE_PASSWORD in environment."
    );
  }

  return config;
}

// =============================================================================
// Singleton Export
// =============================================================================

let _proxyConfig: ProxyConfig | null = null;

/**
 * Get proxy configuration (lazy-loaded singleton).
 */
export function getProxyConfig(): ProxyConfig {
  if (!_proxyConfig) {
    _proxyConfig = loadProxyConfig();
  }
  return _proxyConfig;
}

/**
 * Reload proxy configuration (for testing).
 */
export function reloadProxyConfig(): ProxyConfig {
  _proxyConfig = loadProxyConfig();
  return _proxyConfig;
}
```

---

## 4. Geonode Fetcher Implementation

### File: `src/server/features/scraping/fetchers/GeonodeFetcher.ts`

```typescript
/**
 * Geonode Residential Proxy Fetcher
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Handles HTTP requests through Geonode residential proxy network.
 * Supports geo-targeting, session persistence, and automatic retries.
 */

import { HttpsProxyAgent } from "https-proxy-agent";
import type { GeonodeConfig } from "../config/proxy-config";
import type { FetchResult } from "../types";

// =============================================================================
// Types
// =============================================================================

export interface GeonodeFetchOptions {
  /** URL to fetch */
  url: string;

  /** Request timeout in milliseconds */
  timeoutMs?: number;

  /** Custom headers */
  headers?: Record<string, string>;

  /** Geo-targeting: ISO 3166-1 alpha-2 country code */
  country?: string;

  /** Geo-targeting: City name (lowercase, no spaces) */
  city?: string;

  /** Session ID for sticky sessions (null = rotating) */
  sessionId?: string | null;

  /** Session lifetime in minutes (only with sessionId) */
  sessionLifetimeMin?: number;

  /** Number of retries before failing */
  maxRetries?: number;
}

export interface GeonodeProxyUrl {
  /** Full proxy URL with auth */
  url: string;

  /** HTTP proxy agent for fetch() */
  agent: HttpsProxyAgent<string>;

  /** Username used (with modifiers) */
  username: string;

  /** Modifiers applied */
  modifiers: string[];
}

// =============================================================================
// URL Construction
// =============================================================================

/**
 * Build proxy URL with dynamic options.
 *
 * The username format from Geonode is:
 *   geonode_{accountId}-type-residential
 *
 * Additional options are appended AFTER the username:
 *   geonode_{accountId}-type-residential-country-us-session-abc123
 *
 * IMPORTANT: Do NOT add `-type-` again - it's already in the username.
 */
export function buildGeonodeProxyUrl(
  config: GeonodeConfig,
  options: {
    country?: string;
    city?: string;
    sessionId?: string;
    sessionLifetimeMin?: number;
  } = {}
): GeonodeProxyUrl {
  // Start with the base username (already includes -type-residential)
  let username = config.username;
  const modifiers: string[] = [];

  // Add geo-targeting
  if (options.country) {
    username += `-country-${options.country.toLowerCase()}`;
    modifiers.push(`country:${options.country.toLowerCase()}`);
  }
  if (options.city) {
    username += `-city-${options.city.toLowerCase().replace(/\s+/g, "")}`;
    modifiers.push(`city:${options.city.toLowerCase()}`);
  }

  // Add session persistence
  if (options.sessionId) {
    username += `-session-${options.sessionId}`;
    modifiers.push(`session:${options.sessionId}`);

    // Session lifetime (default 10 minutes if session is set)
    const lifetime = options.sessionLifetimeMin ?? 10;
    username += `-lifetime-${lifetime}m`;
    modifiers.push(`lifetime:${lifetime}m`);
  }

  // Construct full proxy URL
  // Format: http://username:password@host:port
  const proxyUrl = `http://${encodeURIComponent(username)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}`;

  return {
    url: proxyUrl,
    agent: new HttpsProxyAgent(proxyUrl),
    username,
    modifiers,
  };
}

// =============================================================================
// Fetcher Class
// =============================================================================

export class GeonodeFetcher {
  private config: GeonodeConfig;
  private defaultCountry?: string;
  private defaultSessionLifetime: number;

  constructor(config: GeonodeConfig) {
    this.config = config;
    this.defaultCountry = config.defaultCountry;
    this.defaultSessionLifetime = config.sessionLifetimeMin;
  }

  /**
   * Fetch a URL through Geonode residential proxy.
   */
  async fetch(options: GeonodeFetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries ?? 2;
    const timeoutMs = options.timeoutMs ?? 25000;

    // Build proxy configuration
    const proxy = buildGeonodeProxyUrl(this.config, {
      country: options.country ?? this.defaultCountry,
      city: options.city,
      sessionId: options.sessionId,
      sessionLifetimeMin: options.sessionLifetimeMin ?? this.defaultSessionLifetime,
    });

    // Default headers for residential proxy requests
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...options.headers,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(options.url, {
          method: "GET",
          headers,
          // @ts-expect-error - Node.js fetch supports agent
          agent: proxy.agent,
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeoutId);

        const html = await response.text();
        const latencyMs = Date.now() - startTime;

        return {
          success: response.ok,
          tier: 2, // GEONODE_RESIDENTIAL
          html: response.ok ? html : undefined,
          statusCode: response.status,
          error: response.ok ? undefined : `HTTP ${response.status}`,
          latencyMs,
          bytesTransferred: Buffer.byteLength(html, "utf8"),
          proxyUsed: `geonode:${proxy.modifiers.join(",")}`,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort (timeout)
        if (lastError.name === "AbortError") {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    return {
      success: false,
      tier: 2,
      error: lastError?.message ?? "Unknown error",
      errorType: this.classifyError(lastError),
      latencyMs: Date.now() - startTime,
      bytesTransferred: 0,
      proxyUsed: `geonode:${proxy.modifiers.join(",")}`,
    };
  }

  /**
   * Classify error for escalation decision.
   */
  private classifyError(
    error: Error | null
  ): "timeout" | "connection_refused" | undefined {
    if (!error) return undefined;

    if (
      error.name === "AbortError" ||
      error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT")
    ) {
      return "timeout";
    }

    if (
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ECONNRESET")
    ) {
      return "connection_refused";
    }

    return undefined;
  }

  /**
   * Test proxy connectivity.
   * Useful for health checks and credential validation.
   */
  async testConnection(): Promise<{
    success: boolean;
    latencyMs: number;
    ip?: string;
    country?: string;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const result = await this.fetch({
        url: "https://api.ipify.org?format=json",
        timeoutMs: 10000,
        maxRetries: 0,
      });

      if (!result.success || !result.html) {
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          error: result.error,
        };
      }

      const data = JSON.parse(result.html);

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        ip: data.ip,
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// =============================================================================
// Singleton Factory
// =============================================================================

let _geonodeFetcher: GeonodeFetcher | null = null;

/**
 * Get or create the Geonode fetcher singleton.
 * Throws if Geonode is not configured.
 */
export function getGeonodeFetcher(): GeonodeFetcher {
  if (_geonodeFetcher) {
    return _geonodeFetcher;
  }

  // Import here to avoid circular dependency
  const { getProxyConfig } = require("../config/proxy-config");
  const config = getProxyConfig();

  if (!config.geonode) {
    throw new Error(
      "Geonode proxy is not configured. Set GEONODE_USERNAME and GEONODE_PASSWORD."
    );
  }

  _geonodeFetcher = new GeonodeFetcher(config.geonode);
  return _geonodeFetcher;
}

/**
 * Create a new Geonode fetcher (for testing).
 */
export function createGeonodeFetcher(config: GeonodeConfig): GeonodeFetcher {
  return new GeonodeFetcher(config);
}
```

---

## 5. Integration with Domain Learning Service

### File: `src/server/features/scraping/fetchers/TieredFetcher.ts`

```typescript
/**
 * Tiered HTTP Fetcher
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Orchestrates fetch attempts across tiers:
 * T0: Direct fetch
 * T1: Webshare DC proxy (optional)
 * T2: Geonode residential proxy
 * T3+: DataForSEO (handled separately)
 */

import type { ScrapeTier } from "@/db/domain-scrape-learning-schema";
import type { FetchResult, EscalationReason } from "./types";
import { getProxyConfig, type ProxyConfig } from "../config/proxy-config";
import { GeonodeFetcher, createGeonodeFetcher } from "./GeonodeFetcher";
// import { WebshareFetcher } from './WebshareFetcher'; // TODO: Implement

// =============================================================================
// Types
// =============================================================================

export interface TieredFetchOptions {
  url: string;
  tier: ScrapeTier;
  timeoutMs?: number;
  headers?: Record<string, string>;
  geo?: {
    country?: string;
    region?: string;
  };
}

export interface TieredFetcherConfig {
  proxyConfig: ProxyConfig;
}

// =============================================================================
// Tiered Fetcher
// =============================================================================

export class TieredFetcher {
  private proxyConfig: ProxyConfig;
  private geonodeFetcher: GeonodeFetcher | null = null;

  constructor(config?: TieredFetcherConfig) {
    this.proxyConfig = config?.proxyConfig ?? getProxyConfig();

    // Initialize Geonode fetcher if configured
    if (this.proxyConfig.geonode) {
      this.geonodeFetcher = createGeonodeFetcher(this.proxyConfig.geonode);
    }
  }

  /**
   * Fetch a URL at the specified tier.
   */
  async fetch(options: TieredFetchOptions): Promise<FetchResult> {
    switch (options.tier) {
      case "direct":
        return this.fetchDirect(options);

      case "webshare":
        return this.fetchWebshare(options);

      case "geonode":
        return this.fetchGeonode(options);

      case "dfs_basic":
      case "dfs_js":
      case "dfs_browser":
        // DataForSEO tiers are handled by separate DFSFetcher
        throw new Error(
          `DataForSEO tier ${options.tier} should be handled by DFSFetcher`
        );

      default:
        throw new Error(`Unknown tier: ${options.tier}`);
    }
  }

  /**
   * T0: Direct fetch (no proxy).
   */
  private async fetchDirect(options: TieredFetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 15000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(options.url, {
        method: "GET",
        headers: {
          "User-Agent": "TeveroSEO/1.0 (+https://tevero.io/bot; contact@tevero.io)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          ...options.headers,
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      const html = await response.text();

      return {
        success: response.ok,
        tier: 0, // DIRECT
        html: response.ok ? html : undefined,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}`,
        latencyMs: Date.now() - startTime,
        bytesTransferred: Buffer.byteLength(html, "utf8"),
      };
    } catch (error) {
      return {
        success: false,
        tier: 0,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error && error.name === "AbortError" ? "timeout" : undefined,
        latencyMs: Date.now() - startTime,
        bytesTransferred: 0,
      };
    }
  }

  /**
   * T1: Webshare DC proxy.
   */
  private async fetchWebshare(options: TieredFetchOptions): Promise<FetchResult> {
    if (!this.proxyConfig.webshare?.enabled) {
      // Skip to next tier if Webshare not configured
      return {
        success: false,
        tier: 1,
        error: "Webshare not configured",
        errorType: "connection_refused",
        latencyMs: 0,
        bytesTransferred: 0,
      };
    }

    // TODO: Implement WebshareFetcher
    throw new Error("WebshareFetcher not yet implemented");
  }

  /**
   * T2: Geonode residential proxy.
   */
  private async fetchGeonode(options: TieredFetchOptions): Promise<FetchResult> {
    if (!this.geonodeFetcher) {
      return {
        success: false,
        tier: 2,
        error: "Geonode not configured",
        errorType: "connection_refused",
        latencyMs: 0,
        bytesTransferred: 0,
      };
    }

    return this.geonodeFetcher.fetch({
      url: options.url,
      timeoutMs: options.timeoutMs,
      headers: options.headers,
      country: options.geo?.country,
    });
  }

  /**
   * Check which tiers are available.
   */
  getAvailableTiers(): ScrapeTier[] {
    const tiers: ScrapeTier[] = ["direct"];

    if (this.proxyConfig.webshare?.enabled) {
      tiers.push("webshare");
    }

    if (this.geonodeFetcher) {
      tiers.push("geonode");
    }

    // DataForSEO tiers are always available (external service)
    tiers.push("dfs_basic", "dfs_js", "dfs_browser");

    return tiers;
  }

  /**
   * Test all configured proxy connections.
   */
  async testConnections(): Promise<Record<string, { success: boolean; latencyMs: number; ip?: string; error?: string }>> {
    const results: Record<string, { success: boolean; latencyMs: number; ip?: string; error?: string }> = {};

    // Test direct
    try {
      const directResult = await this.fetchDirect({
        url: "https://api.ipify.org?format=json",
        tier: "direct",
        timeoutMs: 10000,
      });
      results.direct = {
        success: directResult.success,
        latencyMs: directResult.latencyMs,
        ip: directResult.success && directResult.html ? JSON.parse(directResult.html).ip : undefined,
        error: directResult.error,
      };
    } catch (error) {
      results.direct = {
        success: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Test Geonode
    if (this.geonodeFetcher) {
      results.geonode = await this.geonodeFetcher.testConnection();
    }

    return results;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let _tieredFetcher: TieredFetcher | null = null;

export function getTieredFetcher(): TieredFetcher {
  if (!_tieredFetcher) {
    _tieredFetcher = new TieredFetcher();
  }
  return _tieredFetcher;
}
```

---

## 6. Secrets Management Strategy

### 6.1 Development Environment

```bash
# .env.local (git-ignored)
GEONODE_USERNAME=geonode_y9ZVNlVjdE-type-residential
GEONODE_PASSWORD=34000f84-a2dd-4ce9-9892-57413ad0862e
```

### 6.2 Production Environment (Recommended)

**Option A: HashiCorp Vault (Enterprise)**
```bash
# Reference secrets from Vault
vault kv put secret/teveroseo/geonode \
  username=geonode_y9ZVNlVjdE-type-residential \
  password=34000f84-a2dd-4ce9-9892-57413ad0862e

# In .env (CI/CD populates from Vault)
GEONODE_USERNAME=${VAULT_SECRET_GEONODE_USERNAME}
GEONODE_PASSWORD=${VAULT_SECRET_GEONODE_PASSWORD}
```

**Option B: AWS Secrets Manager / Parameter Store**
```bash
# Store secret
aws secretsmanager create-secret \
  --name teveroseo/geonode \
  --secret-string '{"username":"geonode_y9ZVNlVjdE-type-residential","password":"34000f84-a2dd-4ce9-9892-57413ad0862e"}'

# Load at runtime (add to server startup)
```

**Option C: Environment Variables (Current Setup)**
```bash
# PM2 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'open-seo',
    env: {
      GEONODE_USERNAME: process.env.GEONODE_USERNAME,
      GEONODE_PASSWORD: process.env.GEONODE_PASSWORD,
    },
  }],
};

# Set via server provider (Contabo, Railway, etc.)
# SECURITY: Never commit to git
```

### 6.3 Credential Rotation

The password is a UUID - if compromised:
1. Generate new credentials in Geonode dashboard
2. Update secrets manager / environment
3. Restart services
4. Monitor for unauthorized usage

---

## 7. Edge Cases & Configuration Changes

### 7.1 Changing Proxy Type

If user upgrades from residential to premium:

```env
# Before (residential)
GEONODE_USERNAME=geonode_y9ZVNlVjdE-type-residential

# After (premium residential)
GEONODE_USERNAME=geonode_y9ZVNlVjdE-type-premium
```

The config validation will handle this:
```typescript
// proxy-config.ts validates -type- prefix exists
.refine(
  (val) => val.includes("-type-"),
  "GEONODE_USERNAME must include proxy type suffix"
)
```

### 7.2 Geo-Targeting Override

For sites that block non-US IPs:

```env
# Default to US for all requests
GEONODE_DEFAULT_COUNTRY=us
```

Or per-request:
```typescript
await geonodeFetcher.fetch({
  url: "https://us-only-site.com",
  country: "us",
});
```

### 7.3 Session Persistence

For sites that require session consistency (login flows, multi-page scrapes):

```typescript
// Generate session ID per crawl job
const sessionId = `job_${jobId}`;

await geonodeFetcher.fetch({
  url: "https://example.com/page1",
  sessionId,
  sessionLifetimeMin: 30,  // Same IP for 30 minutes
});
```

---

## 8. Integration Tests

### File: `src/server/features/scraping/fetchers/GeonodeFetcher.test.ts`

```typescript
/**
 * Geonode Fetcher Integration Tests
 *
 * These tests require real Geonode credentials.
 * Set GEONODE_USERNAME and GEONODE_PASSWORD to run.
 */

import { describe, it, expect, beforeAll, skipIf } from "vitest";
import {
  GeonodeFetcher,
  createGeonodeFetcher,
  buildGeonodeProxyUrl,
} from "./GeonodeFetcher";
import { loadProxyConfig, type GeonodeConfig } from "../config/proxy-config";

// Skip if no credentials
const config = loadProxyConfig();
const hasCredentials = config.geonode !== null;

describe("buildGeonodeProxyUrl", () => {
  const mockConfig: GeonodeConfig = {
    host: "proxy.geonode.io",
    port: 9000,
    username: "geonode_testuser-type-residential",
    password: "test-uuid-password",
    sessionLifetimeMin: 0,
  };

  it("should build basic proxy URL", () => {
    const result = buildGeonodeProxyUrl(mockConfig);

    expect(result.url).toBe(
      "http://geonode_testuser-type-residential:test-uuid-password@proxy.geonode.io:9000"
    );
    expect(result.modifiers).toEqual([]);
  });

  it("should add country to username", () => {
    const result = buildGeonodeProxyUrl(mockConfig, { country: "US" });

    expect(result.username).toBe("geonode_testuser-type-residential-country-us");
    expect(result.modifiers).toContain("country:us");
  });

  it("should add session to username", () => {
    const result = buildGeonodeProxyUrl(mockConfig, {
      sessionId: "abc123",
      sessionLifetimeMin: 15,
    });

    expect(result.username).toContain("-session-abc123");
    expect(result.username).toContain("-lifetime-15m");
    expect(result.modifiers).toContain("session:abc123");
    expect(result.modifiers).toContain("lifetime:15m");
  });

  it("should combine multiple options", () => {
    const result = buildGeonodeProxyUrl(mockConfig, {
      country: "gb",
      city: "london",
      sessionId: "xyz",
    });

    expect(result.username).toBe(
      "geonode_testuser-type-residential-country-gb-city-london-session-xyz-lifetime-10m"
    );
  });
});

describe.skipIf(!hasCredentials)("GeonodeFetcher integration", () => {
  let fetcher: GeonodeFetcher;

  beforeAll(() => {
    if (config.geonode) {
      fetcher = createGeonodeFetcher(config.geonode);
    }
  });

  it("should test connection successfully", async () => {
    const result = await fetcher.testConnection();

    expect(result.success).toBe(true);
    expect(result.ip).toBeDefined();
    expect(result.latencyMs).toBeLessThan(10000);
  });

  it("should fetch through proxy", async () => {
    const result = await fetcher.fetch({
      url: "https://httpbin.org/headers",
      timeoutMs: 15000,
    });

    expect(result.success).toBe(true);
    expect(result.html).toBeDefined();
    expect(result.statusCode).toBe(200);
    expect(result.proxyUsed).toContain("geonode");
  });

  it("should handle geo-targeting", async () => {
    const result = await fetcher.fetch({
      url: "https://api.ipify.org?format=json",
      country: "us",
      timeoutMs: 15000,
    });

    expect(result.success).toBe(true);
    expect(result.proxyUsed).toContain("country:us");
  });

  it("should handle session persistence", async () => {
    const sessionId = `test_${Date.now()}`;

    // First request
    const result1 = await fetcher.fetch({
      url: "https://api.ipify.org?format=json",
      sessionId,
      sessionLifetimeMin: 5,
    });

    // Second request with same session
    const result2 = await fetcher.fetch({
      url: "https://api.ipify.org?format=json",
      sessionId,
      sessionLifetimeMin: 5,
    });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.html && result2.html) {
      // Same session should give same IP
      const ip1 = JSON.parse(result1.html).ip;
      const ip2 = JSON.parse(result2.html).ip;
      expect(ip1).toBe(ip2);
    }
  });

  it("should handle timeout gracefully", async () => {
    const result = await fetcher.fetch({
      url: "https://httpbin.org/delay/30", // 30 second delay
      timeoutMs: 1000, // 1 second timeout
      maxRetries: 0,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe("timeout");
  });
});
```

### Running Tests

```bash
# Unit tests (no credentials needed)
pnpm test src/server/features/scraping/fetchers/GeonodeFetcher.test.ts --filter "buildGeonodeProxyUrl"

# Integration tests (requires credentials)
GEONODE_USERNAME=geonode_xxx-type-residential \
GEONODE_PASSWORD=xxx-xxx-xxx \
pnpm test src/server/features/scraping/fetchers/GeonodeFetcher.test.ts --filter "GeonodeFetcher integration"
```

---

## 9. File Structure

```
open-seo-main/src/server/features/scraping/
├── config/
│   ├── proxy-config.ts          # Env validation and config loading
│   └── proxy-config.test.ts     # Config unit tests
├── fetchers/
│   ├── GeonodeFetcher.ts        # Geonode implementation
│   ├── GeonodeFetcher.test.ts   # Geonode tests
│   ├── WebshareFetcher.ts       # TODO: Webshare implementation
│   ├── TieredFetcher.ts         # Orchestrator
│   └── types.ts                 # Shared fetcher types
├── DomainLearningService.ts     # Uses TieredFetcher
├── index.ts                     # Public exports
└── types.ts                     # Domain types
```

---

## 10. Implementation Checklist

- [ ] Create `config/proxy-config.ts` with Zod schemas
- [ ] Create `fetchers/GeonodeFetcher.ts` with URL construction
- [ ] Create `fetchers/TieredFetcher.ts` orchestrator
- [ ] Update `.env.example` with Geonode variables
- [ ] Write unit tests for URL construction
- [ ] Write integration tests for proxy connectivity
- [ ] Update `DomainLearningService.performFetch()` to use TieredFetcher
- [ ] Add proxy health check endpoint for monitoring
- [ ] Document credential rotation procedure

---

## 11. Monitoring & Alerting

Add to existing monitoring:

```typescript
// Prometheus metrics
proxyBandwidthBytes.labels({ provider: "geonode" }).inc(bytesTransferred);
proxyRequestsTotal.labels({ provider: "geonode", status: "success" }).inc();
proxyLatencyMs.labels({ provider: "geonode" }).observe(latencyMs);

// Alert rules
// - geonode_error_rate > 10% for 5 minutes
// - geonode_bandwidth_daily > 500MB (cost alert)
// - geonode_latency_p95 > 5000ms for 10 minutes
```

---

**Next Steps:**
1. Create the config module
2. Implement GeonodeFetcher
3. Write tests
4. Integrate with DomainLearningService
