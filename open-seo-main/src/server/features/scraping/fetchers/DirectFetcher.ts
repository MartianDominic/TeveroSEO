/**
 * Direct Fetcher (T0)
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Native fetch with polite rate limiting. Free tier that works for
 * most sites that don't have bot protection.
 *
 * Rate limiting: 1 request/second per domain (configurable).
 */

import type { FetchResult, BaseFetchOptions, ConnectionTestResult } from "./types";
import { TIER_TO_NUMBER } from "./types";
import type { EscalationReason } from "@/db/domain-scrape-learning-schema";

// =============================================================================
// Types
// =============================================================================

export interface DirectFetchOptions extends BaseFetchOptions {
  /** Whether to follow redirects (default: true) */
  followRedirects?: boolean;

  /** Accept compressed responses (default: true) */
  acceptCompression?: boolean;
}

// =============================================================================
// Rate Limiter
// =============================================================================

/**
 * Per-domain rate limiter using a simple token bucket.
 * Ensures we don't hit any single domain too fast.
 */
class DomainRateLimiter {
  private lastRequest: Map<string, number> = new Map();
  private readonly minIntervalMs: number;

  constructor(minIntervalMs = 1000) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Wait until it's safe to make a request to the given domain.
   */
  async waitFor(domain: string): Promise<void> {
    const lastTime = this.lastRequest.get(domain);
    if (lastTime !== undefined) {
      const elapsed = Date.now() - lastTime;
      if (elapsed < this.minIntervalMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.minIntervalMs - elapsed)
        );
      }
    }
    this.lastRequest.set(domain, Date.now());
  }

  /**
   * Get domain from URL for rate limiting.
   */
  static getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  /**
   * Clear rate limit state (for testing).
   */
  clear(): void {
    this.lastRequest.clear();
  }
}

// Singleton rate limiter
const rateLimiter = new DomainRateLimiter(1000);

// =============================================================================
// Default Headers
// =============================================================================

/**
 * Default headers that mimic a standard browser.
 * Less aggressive than proxy headers since we're identifying as a bot.
 */
const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (compatible; OpenSEOBot/1.0; +https://openseo.dev/bot)",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Classify HTTP status code or error for escalation.
 */
function classifyStatusCode(statusCode: number): EscalationReason | undefined {
  if (statusCode === 429) return "rate_limited";
  if (statusCode === 403) return "ip_blocked";
  if (statusCode === 503) return "bot_detected";
  return undefined;
}

/**
 * Classify fetch error for escalation.
 */
function classifyError(error: Error): EscalationReason {
  const message = error.message.toLowerCase();

  if (error.name === "AbortError" || message.includes("timeout") || message.includes("etimedout")) {
    return "timeout";
  }
  if (message.includes("econnrefused") || message.includes("econnreset")) {
    return "connection_reset";
  }
  if (message.includes("enotfound") || message.includes("getaddrinfo")) {
    return "dns_error";
  }
  if (message.includes("ssl") || message.includes("certificate") || message.includes("tls")) {
    return "ssl_error";
  }

  return "connection_reset"; // Default fallback
}

/**
 * Detect bot protection from response HTML.
 */
function detectBotProtection(html: string, headers: Headers): EscalationReason | undefined {
  const htmlLower = html.toLowerCase();

  // Cloudflare detection
  if (
    headers.get("cf-ray") ||
    headers.get("cf-mitigated") ||
    htmlLower.includes("cloudflare") ||
    htmlLower.includes("checking your browser") ||
    htmlLower.includes("just a moment")
  ) {
    return "dc_detected";
  }

  // CAPTCHA detection
  if (
    htmlLower.includes("recaptcha") ||
    htmlLower.includes("hcaptcha") ||
    htmlLower.includes("g-recaptcha")
  ) {
    return "captcha";
  }

  // Generic bot detection pages
  if (
    htmlLower.includes("access denied") ||
    htmlLower.includes("please verify") ||
    htmlLower.includes("are you a robot")
  ) {
    return "bot_detected";
  }

  return undefined;
}

// =============================================================================
// Fetcher Class
// =============================================================================

export class DirectFetcher {
  private defaultTimeout: number;
  private maxRetries: number;

  constructor(options: { timeoutMs?: number; maxRetries?: number } = {}) {
    this.defaultTimeout = options.timeoutMs ?? 15000;
    this.maxRetries = options.maxRetries ?? 1;
  }

  /**
   * Fetch a URL directly without proxy.
   */
  async fetch(options: DirectFetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeout;
    const maxRetries = options.maxRetries ?? this.maxRetries;

    // Rate limit by domain
    const domain = DomainRateLimiter.getDomain(options.url);
    await rateLimiter.waitFor(domain);

    // Build headers
    const headers: Record<string, string> = {
      ...DEFAULT_HEADERS,
      ...options.headers,
    };

    if (options.acceptCompression !== false) {
      headers["Accept-Encoding"] = "gzip, deflate";
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(options.url, {
          method: "GET",
          headers,
          signal: controller.signal,
          redirect: options.followRedirects !== false ? "follow" : "manual",
        });

        clearTimeout(timeoutId);

        const html = await response.text();
        const latencyMs = Date.now() - startTime;

        // Extract response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Check for bot protection in response
        const botProtection = detectBotProtection(html, response.headers);
        if (botProtection) {
          return {
            success: false,
            tier: TIER_TO_NUMBER.direct,
            html: undefined,
            statusCode: response.status,
            error: `Bot protection detected: ${botProtection}`,
            errorType: botProtection,
            latencyMs,
            bytesTransferred: Buffer.byteLength(html, "utf8"),
            headers: responseHeaders,
          };
        }

        // Check for rate limiting or blocking
        const statusError = classifyStatusCode(response.status);
        if (statusError) {
          return {
            success: false,
            tier: TIER_TO_NUMBER.direct,
            html: undefined,
            statusCode: response.status,
            error: `HTTP ${response.status}`,
            errorType: statusError,
            latencyMs,
            bytesTransferred: Buffer.byteLength(html, "utf8"),
            headers: responseHeaders,
          };
        }

        // Check for empty response
        if (response.ok && html.length < 100) {
          return {
            success: false,
            tier: TIER_TO_NUMBER.direct,
            html: undefined,
            statusCode: response.status,
            error: "Response too small (likely empty or error page)",
            errorType: "empty_response",
            latencyMs,
            bytesTransferred: Buffer.byteLength(html, "utf8"),
            headers: responseHeaders,
          };
        }

        return {
          success: response.ok,
          tier: TIER_TO_NUMBER.direct,
          html: response.ok ? html : undefined,
          statusCode: response.status,
          error: response.ok ? undefined : `HTTP ${response.status}`,
          errorType: response.ok ? undefined : classifyStatusCode(response.status),
          latencyMs,
          bytesTransferred: Buffer.byteLength(html, "utf8"),
          headers: responseHeaders,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort (timeout)
        if (lastError.name === "AbortError") {
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 500)
          );
        }
      }
    }

    return {
      success: false,
      tier: TIER_TO_NUMBER.direct,
      error: lastError?.message ?? "Unknown error",
      errorType: lastError ? classifyError(lastError) : undefined,
      latencyMs: Date.now() - startTime,
      bytesTransferred: 0,
    };
  }

  /**
   * Test direct connectivity.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      const result = await this.fetch({
        url: "https://httpbin.org/ip",
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
        ip: data.origin,
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

let _directFetcher: DirectFetcher | null = null;

/**
 * Get or create the direct fetcher singleton.
 */
export function getDirectFetcher(): DirectFetcher {
  if (!_directFetcher) {
    _directFetcher = new DirectFetcher();
  }
  return _directFetcher;
}

/**
 * Create a new direct fetcher (for testing).
 */
export function createDirectFetcher(
  options?: { timeoutMs?: number; maxRetries?: number }
): DirectFetcher {
  return new DirectFetcher(options);
}

/**
 * Reset the singleton (for testing).
 */
export function resetDirectFetcher(): void {
  _directFetcher = null;
}

/**
 * Clear rate limiter state (for testing).
 */
export function clearRateLimiter(): void {
  rateLimiter.clear();
}
