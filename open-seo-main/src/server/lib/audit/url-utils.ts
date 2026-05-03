/**
 * URL normalization and utility functions for the site audit crawler.
 */

/**
 * Normalize a URL for deduplication:
 * - Resolve relative URLs against a base
 * - Strip fragments (#...)
 * - Sort query parameters
 * - Lowercase the hostname
 * - Remove trailing slash (except for root path "/")
 */
export function normalizeUrl(url: string, base?: string): string | null {
  try {
    const parsed = new URL(url, base);

    // Only crawl HTTP(S)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // Strip fragment
    parsed.hash = "";

    // Sort query params for consistent dedup
    parsed.searchParams.sort();

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

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

function getEffectivePort(parsed: URL): string {
  if (parsed.port) return parsed.port;
  return parsed.protocol === "https:" ? "443" : "80";
}

function areEquivalentHostnames(a: string, b: string): boolean {
  const hostA = a.toLowerCase();
  const hostB = b.toLowerCase();
  if (hostA === hostB) return true;
  return hostA === `www.${hostB}` || hostB === `www.${hostA}`;
}

/**
 * Check if a URL belongs to the same crawl boundary as the crawl target.
 *
 * Rules:
 * - Hostname must match exactly.
 * - Same protocol/port is always allowed.
 * - http -> https upgrade on default ports is allowed.
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
 * Detect a URL template pattern by replacing path segments that look like
 * dynamic values (IDs, slugs, dates) with `:param`.
 *
 * Examples:
 *   /blog/my-great-post      → /blog/:slug
 *   /products/12345           → /products/:id
 *   /users/john-doe/settings  → /users/:slug/settings
 */
export function detectUrlTemplate(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);

  const normalized = segments.map((segment) => {
    // Pure numeric IDs
    if (/^\d+$/.test(segment)) return ":id";
    // UUIDs
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        segment,
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

/**
 * Extract the origin (protocol + hostname + port) from a URL string.
 */
export function getOrigin(url: string): string {
  return new URL(url).origin;
}

/**
 * FIX-13 (MED-SEO-02): Normalize URL for click depth calculation.
 * Ensures consistent URL comparison by:
 * - Removing trailing slashes (except root)
 * - Lowercasing hostname
 * - Removing fragments
 * - Sorting query parameters
 * - Normalizing protocol (http -> https if both exist)
 *
 * @param url - URL to normalize
 * @param siteUrls - Optional set of known site URLs for protocol normalization
 * @returns Normalized URL string
 */
export function normalizeUrlForClickDepth(url: string, siteUrls?: Set<string>): string {
  const normalized = normalizeUrl(url);
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
 * FIX-13 (MED-SEO-02): Build a click depth map with normalized URLs.
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
    const normalizedTargets = targets.map((t) => normalizeUrlForClickDepth(t, siteUrls));
    normalizedGraph.set(normalizedSource, normalizedTargets);
  }

  // Normalize homepage
  const normalizedHomepage = normalizeUrlForClickDepth(homepageUrl, siteUrls);

  // BFS from homepage
  const queue: Array<{ url: string; depth: number }> = [{ url: normalizedHomepage, depth: 0 }];
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
