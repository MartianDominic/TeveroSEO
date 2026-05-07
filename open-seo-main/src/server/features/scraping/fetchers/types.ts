/**
 * Fetcher Type Definitions
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Shared types for all fetcher implementations.
 */

import type { ScrapeTier, EscalationReason } from "@/db/domain-scrape-learning-schema";

// =============================================================================
// Fetch Result
// =============================================================================

/**
 * Result of a fetch operation at any tier.
 */
export interface FetchResult {
  /** Whether the fetch succeeded (2xx status and valid content) */
  success: boolean;

  /** Tier that was used (numeric for backward compatibility) */
  tier: number;

  /** Response HTML content */
  html?: string;

  /** HTTP status code */
  statusCode?: number;

  /** Error message if failed */
  error?: string;

  /** Classified error type for escalation decisions */
  errorType?: EscalationReason;

  /** Response latency in milliseconds */
  latencyMs: number;

  /** Response size in bytes */
  bytesTransferred: number;

  /** Proxy identifier used (for logging) */
  proxyUsed?: string;

  /** Response headers (when relevant) */
  headers?: Record<string, string>;
}

// =============================================================================
// Fetch Options
// =============================================================================

/**
 * Common fetch options for all tiers.
 */
export interface BaseFetchOptions {
  /** URL to fetch */
  url: string;

  /** Request timeout in milliseconds */
  timeoutMs?: number;

  /** Custom headers to include */
  headers?: Record<string, string>;

  /** Maximum number of retries */
  maxRetries?: number;
}

/**
 * Geo-targeting options for proxy tiers.
 */
export interface GeoTargetingOptions {
  /** ISO 3166-1 alpha-2 country code */
  country?: string;

  /** City name (lowercase, no spaces) */
  city?: string;

  /** Region/state code */
  region?: string;
}

/**
 * Session options for sticky proxy connections.
 */
export interface SessionOptions {
  /** Session ID for sticky IP assignment */
  sessionId?: string;

  /** Session lifetime in minutes */
  sessionLifetimeMin?: number;
}

// =============================================================================
// Tier Mapping
// =============================================================================

/**
 * Maps ScrapeTier strings to numeric tier values.
 * Used for backward compatibility with existing tier-based logic.
 */
export const TIER_TO_NUMBER: Record<ScrapeTier, number> = {
  direct: 0,
  webshare: 1,
  geonode: 2,
  camoufox: 2.5,
  dfs_basic: 3,
  dfs_js: 4,
  dfs_browser: 5,
};

/**
 * Maps numeric tiers to ScrapeTier strings.
 */
export const NUMBER_TO_TIER: Record<number, ScrapeTier> = {
  0: "direct",
  1: "webshare",
  2: "geonode",
  2.5: "camoufox",
  3: "dfs_basic",
  4: "dfs_js",
  5: "dfs_browser",
};

// =============================================================================
// Connection Test Result
// =============================================================================

/**
 * Result of a proxy connection test.
 */
export interface ConnectionTestResult {
  /** Whether the connection succeeded */
  success: boolean;

  /** Test latency in milliseconds */
  latencyMs: number;

  /** IP address returned (if successful) */
  ip?: string;

  /** Detected country (if available) */
  country?: string;

  /** Error message (if failed) */
  error?: string;
}
