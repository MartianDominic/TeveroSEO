/**
 * Webshare DC Proxy Fetcher (T1)
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Free datacenter proxy rotation through Webshare.
 * 10 proxy IPs, 1GB/month bandwidth free tier.
 *
 * Useful for:
 * - Sites with simple IP-based rate limiting
 * - When direct fetch hits 429s
 * - Distributing requests across multiple IPs
 */

import { HttpsProxyAgent } from "https-proxy-agent";
import type { FetchResult, BaseFetchOptions, ConnectionTestResult } from "./types";
import { TIER_TO_NUMBER } from "./types";
import {
  classifyError as sharedClassifyError,
  detectBotProtection as sharedDetectBotProtection,
  mapStatusCodeToEscalationReason,
} from "./ErrorClassifier";
import { getBandwidthTracker } from "../monitoring/BandwidthTracker";
import { validateScrapableUrlSimple } from "../../../lib/ssrf-validator";

// =============================================================================
// Types
// =============================================================================

export interface WebshareFetchOptions extends BaseFetchOptions {
  /** Specific proxy index to use (0-9 for free tier) */
  proxyIndex?: number;
}

export interface WebshareProxy {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface WebshareConfig {
  /** API key for fetching proxy list */
  apiKey: string;

  /** Cached proxy list */
  proxies?: WebshareProxy[];

  /** When proxies were last fetched */
  proxiesFetchedAt?: Date;
}

// =============================================================================
// Proxy List Management
// =============================================================================

/**
 * Fetch proxy list from Webshare API.
 * Free tier provides 10 DC proxies.
 */
async function fetchProxyList(apiKey: string): Promise<WebshareProxy[]> {
  const response = await fetch(
    "https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=25",
    {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Webshare API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    results?: Array<{
      proxy_address: string;
      port: number;
      username: string;
      password: string;
    }>;
  };

  if (!data.results || !Array.isArray(data.results)) {
    throw new Error("Webshare API returned invalid response");
  }

  return data.results.map(
    (p: {
      proxy_address: string;
      port: number;
      username: string;
      password: string;
    }) => ({
      host: p.proxy_address,
      port: p.port,
      username: p.username,
      password: p.password,
    })
  );
}

// =============================================================================
// Default Headers
// =============================================================================

/**
 * Default headers for DC proxy requests.
 * More browser-like than direct fetcher since we're masking our IP.
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
};

// =============================================================================
// Error Classification (using shared ErrorClassifier)
// =============================================================================

/**
 * Classify HTTP status code for escalation.
 * Delegates to shared ErrorClassifier utility.
 */
function classifyStatusCode(statusCode: number) {
  return mapStatusCodeToEscalationReason(statusCode);
}

/**
 * Classify fetch error for escalation.
 * Delegates to shared ErrorClassifier utility.
 */
function classifyError(error: Error) {
  return sharedClassifyError(error).escalationReason;
}

/**
 * Detect DC/ASN-based blocking.
 * Delegates to shared ErrorClassifier utility.
 */
function detectDcBlocking(html: string, headers: Headers) {
  const result = sharedDetectBotProtection(html, headers);
  return result?.escalationReason;
}

// =============================================================================
// Fetcher Class
// =============================================================================

export class WebshareFetcher {
  private apiKey: string;
  private proxies: WebshareProxy[] = [];
  private proxiesFetchedAt: Date | null = null;
  private currentProxyIndex = 0;
  private readonly cacheMaxAgeMs = 60 * 60 * 1000; // 1 hour

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Ensure proxy list is loaded and fresh.
   */
  private async ensureProxies(): Promise<void> {
    const now = new Date();
    const cacheExpired =
      !this.proxiesFetchedAt ||
      now.getTime() - this.proxiesFetchedAt.getTime() > this.cacheMaxAgeMs;

    if (this.proxies.length === 0 || cacheExpired) {
      this.proxies = await fetchProxyList(this.apiKey);
      this.proxiesFetchedAt = now;
    }
  }

  /**
   * Get next proxy in rotation.
   */
  private getNextProxy(): WebshareProxy {
    const proxy = this.proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  /**
   * Fetch a URL through Webshare DC proxy.
   */
  async fetch(options: WebshareFetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries ?? 2;
    const timeoutMs = options.timeoutMs ?? 20000;

    // SSRF Protection: Validate URL before any proxy setup
    try {
      validateScrapableUrlSimple(options.url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[WebshareFetcher] SSRF blocked URL: ${options.url} - Reason: ${errorMessage}`
      );
      return {
        success: false,
        tier: TIER_TO_NUMBER.webshare,
        error: `SSRF validation failed: ${errorMessage}`,
        errorType: "ssrf_blocked",
        latencyMs: Date.now() - startTime,
        bytesTransferred: 0,
      };
    }

    // Ensure we have proxies
    try {
      await this.ensureProxies();
    } catch (error) {
      return {
        success: false,
        tier: TIER_TO_NUMBER.webshare,
        error:
          error instanceof Error
            ? `Failed to fetch proxy list: ${error.message}`
            : "Failed to fetch proxy list",
        latencyMs: Date.now() - startTime,
        bytesTransferred: 0,
      };
    }

    if (this.proxies.length === 0) {
      return {
        success: false,
        tier: TIER_TO_NUMBER.webshare,
        error: "No proxies available",
        latencyMs: Date.now() - startTime,
        bytesTransferred: 0,
      };
    }

    // Select proxy
    const proxy =
      options.proxyIndex !== undefined
        ? this.proxies[options.proxyIndex % this.proxies.length]
        : this.getNextProxy();

    // Build proxy URL
    const proxyUrl = `http://${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@${proxy.host}:${proxy.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);

    // Build headers
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
          agent,
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
        getBandwidthTracker().recordUsage("webshare", requestBytes, responseBytes);

        // Check for DC blocking
        const dcBlocking = detectDcBlocking(html, response.headers);
        if (dcBlocking) {
          return {
            success: false,
            tier: TIER_TO_NUMBER.webshare,
            html: undefined,
            statusCode: response.status,
            error: `DC proxy blocked: ${dcBlocking}`,
            errorType: dcBlocking,
            latencyMs,
            bytesTransferred: responseBytes,
            proxyUsed: `webshare:${proxy.host}:${proxy.port}`,
            headers: responseHeaders,
          };
        }

        // Check for rate limiting
        const statusError = classifyStatusCode(response.status);
        if (statusError) {
          return {
            success: false,
            tier: TIER_TO_NUMBER.webshare,
            html: undefined,
            statusCode: response.status,
            error: `HTTP ${response.status}`,
            errorType: statusError,
            latencyMs,
            bytesTransferred: responseBytes,
            proxyUsed: `webshare:${proxy.host}:${proxy.port}`,
            headers: responseHeaders,
          };
        }

        // Check for empty response
        if (response.ok && html.length < 100) {
          return {
            success: false,
            tier: TIER_TO_NUMBER.webshare,
            html: undefined,
            statusCode: response.status,
            error: "Response too small",
            errorType: "empty_response",
            latencyMs,
            bytesTransferred: responseBytes,
            proxyUsed: `webshare:${proxy.host}:${proxy.port}`,
            headers: responseHeaders,
          };
        }

        return {
          success: response.ok,
          tier: TIER_TO_NUMBER.webshare,
          html: response.ok ? html : undefined,
          statusCode: response.status,
          error: response.ok ? undefined : `HTTP ${response.status}`,
          latencyMs,
          bytesTransferred: responseBytes,
          proxyUsed: `webshare:${proxy.host}:${proxy.port}`,
          headers: responseHeaders,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort
        if (lastError.name === "AbortError") {
          break;
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    return {
      success: false,
      tier: TIER_TO_NUMBER.webshare,
      error: lastError?.message ?? "Unknown error",
      errorType: lastError ? classifyError(lastError) : undefined,
      latencyMs: Date.now() - startTime,
      bytesTransferred: 0,
      proxyUsed: `webshare:${proxy.host}:${proxy.port}`,
    };
  }

  /**
   * Test proxy connectivity.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      await this.ensureProxies();

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
   * Get proxy count (for debugging).
   */
  getProxyCount(): number {
    return this.proxies.length;
  }

  /**
   * Force refresh proxy list.
   */
  async refreshProxies(): Promise<void> {
    this.proxies = await fetchProxyList(this.apiKey);
    this.proxiesFetchedAt = new Date();
    this.currentProxyIndex = 0;
  }
}

// =============================================================================
// Singleton Factory
// =============================================================================

let _webshareFetcher: WebshareFetcher | null = null;

/**
 * Get or create the Webshare fetcher singleton.
 * Returns null if Webshare is not configured.
 */
export function getWebshareFetcher(): WebshareFetcher | null {
  if (_webshareFetcher) {
    return _webshareFetcher;
  }

  const apiKey = process.env.WEBSHARE_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  _webshareFetcher = new WebshareFetcher(apiKey);
  return _webshareFetcher;
}

/**
 * Create a new Webshare fetcher (for testing).
 */
export function createWebshareFetcher(apiKey: string): WebshareFetcher {
  return new WebshareFetcher(apiKey);
}

/**
 * Reset the singleton (for testing).
 */
export function resetWebshareFetcher(): void {
  _webshareFetcher = null;
}
