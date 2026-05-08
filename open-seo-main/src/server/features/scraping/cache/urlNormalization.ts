/**
 * URL Normalization & Cache Key Generation
 * Phase 95-02: Multi-Level Caching
 * Phase 95-03: Consolidated from url-utils.ts and link-extractor.ts
 *
 * CANONICAL URL NORMALIZATION MODULE
 * All URL normalization should import from here.
 *
 * Features:
 * - Removes tracking parameters (utm_*, fbclid, gclid, etc.)
 * - Normalizes protocol, trailing slashes, case
 * - Generates deterministic cache keys via hashing
 * - Origin checking with www equivalence
 * - URL template detection for dynamic paths
 * - Click depth calculation utilities
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

// =============================================================================
// Origin & Same-Site Checking
// =============================================================================

/**
 * Get the effective port for a URL.
 * Returns the explicit port or the default for the protocol.
 */
function getEffectivePort(parsed: URL): string {
  if (parsed.port) return parsed.port;
  return parsed.protocol === "https:" ? "443" : "80";
}

/**
 * Check if two hostnames are equivalent, treating www as equivalent to non-www.
 */
function areEquivalentHostnames(a: string, b: string): boolean {
  const hostA = a.toLowerCase();
  const hostB = b.toLowerCase();
  if (hostA === hostB) return true;
  return hostA === `www.${hostB}` || hostB === `www.${hostA}`;
}

/**
 * Check if a URL belongs to the same crawl boundary as the origin.
 *
 * Rules:
 * - Hostname must match (www variants are equivalent)
 * - Same protocol/port is always allowed
 * - http -> https upgrade on default ports is allowed
 *
 * @param url - URL to check
 * @param origin - Origin URL to compare against
 * @returns true if URL is same origin
 */
export function isSameOrigin(url: string, origin: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const parsedOrigin = new URL(origin);

    if (!areEquivalentHostnames(parsedUrl.hostname, parsedOrigin.hostname)) {
      return false;
    }

    const originProtocol = parsedOrigin.protocol.toLowerCase();
    const urlProtocol = parsedUrl.protocol.toLowerCase();

    const originPort = getEffectivePort(parsedOrigin);
    const urlPort = getEffectivePort(parsedUrl);

    if (originProtocol === urlProtocol) {
      return originPort === urlPort;
    }

    // Allow http -> https upgrade on default ports
    const isHttpToHttpsUpgrade =
      originProtocol === "http:" &&
      urlProtocol === "https:" &&
      originPort === "80" &&
      urlPort === "443";

    return isHttpToHttpsUpgrade;
  } catch {
    return false;
  }
}

/**
 * Extract the origin (protocol + hostname + port) from a URL string.
 *
 * @param url - URL to extract origin from
 * @returns Origin string
 */
export function getOrigin(url: string): string {
  return new URL(url).origin;
}

// =============================================================================
// URL Template Detection
// =============================================================================

/**
 * Detect a URL template pattern by replacing path segments that look like
 * dynamic values (IDs, slugs, dates) with `:param`.
 *
 * Examples:
 *   /blog/my-great-post      -> /blog/:slug
 *   /products/12345          -> /products/:id
 *   /users/john-doe/settings -> /users/:slug/settings
 *   /posts/550e8400-e29b... -> /posts/:uuid
 *
 * @param pathname - URL pathname to analyze
 * @returns Template pattern with dynamic segments replaced
 */
export function detectUrlTemplate(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);

  const normalized = segments.map((segment) => {
    // Pure numeric IDs
    if (/^\d+$/.test(segment)) return ":id";
    // UUIDs
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        segment
      )
    )
      return ":uuid";
    // Date-like segments (2024-01-15)
    if (/^\d{4}-\d{2}-\d{2}$/.test(segment)) return ":date";
    // Slug-like: contains hyphens and is more than 2 segments (to avoid short
    // path parts like "my-account" that are likely fixed routes)
    if (segment.includes("-") && segment.split("-").length > 2) return ":slug";

    return segment;
  });

  return "/" + normalized.join("/");
}

// =============================================================================
// Relative URL Resolution
// =============================================================================

/**
 * Normalize a URL with optional base for resolving relative URLs.
 * Returns null for invalid or non-HTTP URLs (unlike normalizeUrl which throws).
 *
 * @param url - URL to normalize
 * @param base - Optional base URL for resolving relative URLs
 * @returns Normalized URL or null if invalid/non-HTTP
 */
export function normalizeUrlWithBase(url: string, base?: string): string | null {
  try {
    const parsed = new URL(url, base);

    // Only allow HTTP(S)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // Strip fragment
    parsed.hash = "";

    // Sort query params for consistent dedup
    parsed.searchParams.sort();

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove tracking parameters
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    // Remove trailing slash (but keep "/" for root)
    let normalized = parsed.toString();
    if (normalized.endsWith("/") && parsed.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    return null;
  }
}

// =============================================================================
// Click Depth Calculation
// =============================================================================

/**
 * Normalize URL for click depth calculation.
 * Ensures consistent URL comparison by:
 * - Removing trailing slashes (except root)
 * - Lowercasing hostname
 * - Removing fragments
 * - Sorting query parameters
 * - Normalizing protocol (http -> https if both exist in site)
 *
 * @param url - URL to normalize
 * @param siteUrls - Optional set of known site URLs for protocol normalization
 * @returns Normalized URL string
 */
export function normalizeUrlForClickDepth(
  url: string,
  siteUrls?: Set<string>
): string {
  const normalized = normalizeUrlWithBase(url);
  if (!normalized) return url;

  // If we have site URLs, check if the https version exists and prefer it
  if (siteUrls) {
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol === "http:") {
        const httpsVersion = normalized.replace("http://", "https://");
        if (siteUrls.has(httpsVersion)) {
          return httpsVersion;
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  return normalized;
}

/**
 * Build a click depth map with normalized URLs.
 * Performs BFS from the homepage to calculate the minimum number of clicks
 * to reach each page.
 *
 * @param linkGraph - Map of source URL -> array of target URLs (outbound links)
 * @param homepageUrl - The homepage URL to start BFS from
 * @returns Map of URL -> click depth
 */
export function buildClickDepthMap(
  linkGraph: Map<string, string[]>,
  homepageUrl: string
): Map<string, number> {
  const clickDepths = new Map<string, number>();
  const siteUrls = new Set<string>();

  // Collect all known URLs for normalization
  for (const [source, targets] of linkGraph) {
    siteUrls.add(source);
    for (const target of targets) {
      siteUrls.add(target);
    }
  }

  // Normalize the link graph
  const normalizedGraph = new Map<string, string[]>();
  for (const [source, targets] of linkGraph) {
    const normalizedSource = normalizeUrlForClickDepth(source, siteUrls);
    const normalizedTargets = targets.map((t) =>
      normalizeUrlForClickDepth(t, siteUrls)
    );
    normalizedGraph.set(normalizedSource, normalizedTargets);
  }

  // Normalize homepage
  const normalizedHomepage = normalizeUrlForClickDepth(homepageUrl, siteUrls);

  // BFS from homepage
  const queue: Array<{ url: string; depth: number }> = [
    { url: normalizedHomepage, depth: 0 },
  ];
  clickDepths.set(normalizedHomepage, 0);

  while (queue.length > 0) {
    const { url, depth } = queue.shift()!;
    const outboundLinks = normalizedGraph.get(url) ?? [];

    for (const targetUrl of outboundLinks) {
      if (!clickDepths.has(targetUrl)) {
        clickDepths.set(targetUrl, depth + 1);
        queue.push({ url: targetUrl, depth: depth + 1 });
      }
    }
  }

  return clickDepths;
}
