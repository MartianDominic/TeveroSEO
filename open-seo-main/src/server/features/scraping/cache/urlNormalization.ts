/**
 * URL Normalization & Cache Key Generation
 * Phase 95-02: Multi-Level Caching
 *
 * Normalizes URLs for consistent cache key generation:
 * - Removes tracking parameters (utm_*, fbclid, gclid, etc.)
 * - Normalizes protocol, trailing slashes, case
 * - Generates deterministic cache keys via hashing
 */

import { createHash } from "crypto";

// =============================================================================
// Constants
// =============================================================================

/**
 * Tracking parameters to strip from URLs.
 * These parameters don't affect page content.
 */
const TRACKING_PARAMS = new Set([
  // Google Analytics / Ads
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gclsrc",
  "dclid",
  // Facebook
  "fbclid",
  "fb_action_ids",
  "fb_action_types",
  "fb_source",
  "fb_ref",
  // Microsoft / Bing
  "msclkid",
  // Twitter / X
  "twclid",
  // LinkedIn
  "li_fat_id",
  // HubSpot
  "hsa_acc",
  "hsa_cam",
  "hsa_grp",
  "hsa_ad",
  "hsa_src",
  "hsa_tgt",
  "hsa_kw",
  "hsa_mt",
  "hsa_net",
  "hsa_ver",
  // Mailchimp
  "mc_cid",
  "mc_eid",
  // General tracking
  "_ga",
  "_gl",
  "ref",
  "ref_",
  "source",
  "affiliate",
  "aff_id",
  // Session / state
  "sessionid",
  "session_id",
  "PHPSESSID",
  "JSESSIONID",
  "sid",
  // Common misc
  "timestamp",
  "_t",
  "cb",
  "cachebuster",
  "nocache",
  "v",
  "_v",
]);

/**
 * URL parameters that should be sorted but kept.
 * Order shouldn't matter for these.
 */
const SORT_PARAMS = true;

// =============================================================================
// URL Normalization
// =============================================================================

/**
 * Normalize a URL for consistent cache key generation.
 *
 * Transformations:
 * 1. Parse and validate URL
 * 2. Lowercase hostname
 * 3. Remove default port (80/443)
 * 4. Remove trailing slash from path (except root)
 * 5. Remove tracking parameters
 * 6. Sort remaining parameters
 * 7. Remove fragment
 * 8. Reconstruct URL
 *
 * @param url - The URL to normalize
 * @returns Normalized URL string
 * @throws Error if URL is invalid
 */
export function normalizeUrl(url: string): string {
  // Handle relative URLs by assuming https
  if (url.startsWith("/")) {
    throw new Error("Cannot normalize relative URL without base");
  }

  // Add protocol if missing
  if (!url.includes("://")) {
    url = "https://" + url;
  }

  const parsed = new URL(url);

  // 1. Lowercase hostname
  parsed.hostname = parsed.hostname.toLowerCase();

  // 2. Remove default ports
  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }

  // 3. Normalize path
  let path = parsed.pathname;

  // Decode percent-encoded characters that don't need encoding
  path = decodeURIComponent(path);
  // Re-encode only necessary characters
  path = encodeURI(path);

  // Remove trailing slash (except for root)
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  // Handle empty path
  if (!path) {
    path = "/";
  }

  parsed.pathname = path;

  // 4. Remove tracking parameters and sort
  const params = new URLSearchParams();
  const sortedKeys: string[] = [];

  for (const [key, value] of parsed.searchParams.entries()) {
    const lowercaseKey = key.toLowerCase();
    if (!TRACKING_PARAMS.has(lowercaseKey)) {
      sortedKeys.push(key);
    }
  }

  // Sort keys for consistent ordering
  sortedKeys.sort();

  for (const key of sortedKeys) {
    const value = parsed.searchParams.get(key);
    if (value !== null) {
      params.append(key, value);
    }
  }

  parsed.search = params.toString() ? `?${params.toString()}` : "";

  // 5. Remove fragment
  parsed.hash = "";

  return parsed.toString();
}

/**
 * Normalize a URL, returning null if invalid instead of throwing.
 */
export function normalizeUrlSafe(url: string): string | null {
  try {
    return normalizeUrl(url);
  } catch {
    return null;
  }
}

// =============================================================================
// Cache Key Generation
// =============================================================================

/**
 * Generate a cache key from a normalized URL.
 *
 * Uses SHA-256 truncated to 16 characters for:
 * - Compact storage in Redis keys and DB indexes
 * - Negligible collision probability at scale
 * - Deterministic output for same input
 *
 * @param normalizedUrl - URL that has been normalized via normalizeUrl()
 * @returns 16-character hex hash
 */
export function getCacheKey(normalizedUrl: string): string {
  const hash = createHash("sha256").update(normalizedUrl).digest("hex");
  return hash.substring(0, 16);
}

/**
 * Generate a content hash for deduplication.
 *
 * Used to identify identical HTML content across different URLs.
 * Uses full SHA-256 (32 chars) for stronger collision resistance
 * since this affects storage deduplication.
 *
 * @param html - Raw HTML content
 * @returns 32-character hex hash
 */
export function getContentHash(html: string): string {
  const hash = createHash("sha256").update(html).digest("hex");
  return hash.substring(0, 32);
}

/**
 * Generate a hash for content comparison (shorter for quick checks).
 *
 * @param content - Any string content
 * @returns 8-character hex hash
 */
export function getQuickHash(content: string): string {
  const hash = createHash("sha256").update(content).digest("hex");
  return hash.substring(0, 8);
}

// =============================================================================
// URL Utilities
// =============================================================================

/**
 * Extract the domain from a URL.
 *
 * @param url - URL to extract domain from
 * @returns Domain (hostname) or null if invalid
 */
export function extractDomain(url: string): string | null {
  try {
    const normalized = normalizeUrl(url);
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

/**
 * Check if two URLs are the same after normalization.
 *
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns true if URLs normalize to the same value
 */
export function urlsMatch(url1: string, url2: string): boolean {
  try {
    return normalizeUrl(url1) === normalizeUrl(url2);
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a valid HTTP/HTTPS URL.
 *
 * @param url - URL to validate
 * @returns true if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Get URL path segments.
 *
 * @param url - URL to parse
 * @returns Array of path segments
 */
export function getPathSegments(url: string): string[] {
  try {
    const normalized = normalizeUrl(url);
    const path = new URL(normalized).pathname;
    return path.split("/").filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/**
 * Determine if URL is likely a homepage.
 *
 * @param url - URL to check
 * @returns true if URL appears to be a homepage
 */
export function isHomepage(url: string): boolean {
  try {
    const normalized = normalizeUrl(url);
    const parsed = new URL(normalized);
    return parsed.pathname === "/" && !parsed.search;
  } catch {
    return false;
  }
}
