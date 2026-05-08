/**
 * Geonode Residential Proxy Fetcher
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Handles HTTP requests through Geonode residential proxy network.
 * Supports geo-targeting, session persistence, and automatic retries.
 */

import { HttpsProxyAgent } from "https-proxy-agent";
import type { GeonodeConfig } from "../config/proxy-config";
import type {
  FetchResult,
  BaseFetchOptions,
  GeoTargetingOptions,
  SessionOptions,
  ConnectionTestResult,
} from "./types";
import { TIER_TO_NUMBER } from "./types";
import { getBandwidthTracker } from "../monitoring/BandwidthTracker";

// =============================================================================
// Types
// =============================================================================

export interface GeonodeFetchOptions
  extends BaseFetchOptions,
    GeoTargetingOptions,
    SessionOptions {}

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
// Default Headers
// =============================================================================

/**
 * Default headers for residential proxy requests.
 * Mimics a real browser to avoid detection.
 */
const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

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
      sessionLifetimeMin:
        options.sessionLifetimeMin ?? this.defaultSessionLifetime,
    });

    // Merge headers
    const headers: Record<string, string> = {
      ...DEFAULT_HEADERS,
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
          // @ts-expect-error - Node.js fetch supports agent option
          agent: proxy.agent,
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeoutId);

        const html = await response.text();
        const latencyMs = Date.now() - startTime;
        const responseBytes = Buffer.byteLength(html, "utf8");

        // Extract response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Track bandwidth usage (estimate request size: URL + headers ~500 bytes)
        const requestBytes = Buffer.byteLength(options.url, "utf8") + 500;
        getBandwidthTracker().recordUsage("geonode", requestBytes, responseBytes);

        return {
          success: response.ok,
          tier: TIER_TO_NUMBER.geonode,
          html: response.ok ? html : undefined,
          statusCode: response.status,
          error: response.ok ? undefined : `HTTP ${response.status}`,
          latencyMs,
          bytesTransferred: responseBytes,
          proxyUsed: `geonode:${proxy.modifiers.join(",")}`,
          headers: responseHeaders,
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
      tier: TIER_TO_NUMBER.geonode,
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
  ): "timeout" | "connection_reset" | undefined {
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
      return "connection_reset";
    }

    return undefined;
  }

  /**
   * Test proxy connectivity.
   * Useful for health checks and credential validation.
   */
  async testConnection(): Promise<ConnectionTestResult> {
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

  /**
   * Get the current proxy configuration (for debugging).
   */
  getConfig(): Omit<GeonodeConfig, "password"> {
    return {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      defaultCountry: this.config.defaultCountry,
      sessionLifetimeMin: this.config.sessionLifetimeMin,
    };
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

  // Import dynamically to avoid circular dependency
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

/**
 * Reset the singleton (for testing).
 */
export function resetGeonodeFetcher(): void {
  _geonodeFetcher = null;
}
