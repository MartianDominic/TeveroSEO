/**
 * HTTP Conditional GET for L1 Delta Crawling
 *
 * Uses If-None-Match (ETag) and If-Modified-Since headers to skip
 * unchanged content without downloading the full response body.
 *
 * Per 64-RESEARCH.md Pattern 3:
 * - Accepts weak ETags (W/ prefix) per Cloudflare behavior
 * - Returns "unchanged" on 304 status
 * - Returns "changed" with response and new headers on 200
 * - Returns "error" on network failure or non-2xx/304
 *
 * @module conditional-get
 */

/**
 * Cached HTTP headers for conditional requests.
 */
export interface CachedHeaders {
  /** ETag value (may include W/ prefix for weak ETags) */
  etag: string | null;
  /** Last-Modified header value */
  lastModified: string | null;
}

/**
 * Result of a conditional GET request.
 */
export interface ConditionalGetResult {
  /** Status of the conditional request */
  status: "unchanged" | "changed" | "error";
  /** Response object (only present when status is "changed") */
  response?: Response;
  /** New headers to cache (only present when status is "changed") */
  headers?: CachedHeaders;
}

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30_000;

/** User-Agent for crawl requests */
const USER_AGENT = "TeveroSEO/1.0 (+https://teveroseo.com/bot)";

/**
 * Perform a conditional GET request.
 *
 * Sends If-None-Match and/or If-Modified-Since headers based on cached values.
 * Returns "unchanged" if server returns 304 Not Modified, avoiding body download.
 *
 * Per Cloudflare Pitfall 1: Accepts weak ETags (W/ prefix) as valid.
 * Cloudflare converts strong ETags to weak when applying transformations.
 *
 * @param url - URL to request
 * @param cached - Cached headers from previous request
 * @returns Conditional GET result with status and optional response
 *
 * @example
 * ```typescript
 * const cached = { etag: '"abc123"', lastModified: null };
 * const result = await conditionalGet("https://example.com/page", cached);
 *
 * if (result.status === "unchanged") {
 *   // Skip processing - content hasn't changed
 * } else if (result.status === "changed") {
 *   const html = await result.response.text();
 *   // Process new content
 * }
 * ```
 */
export async function conditionalGet(
  url: string,
  cached: CachedHeaders
): Promise<ConditionalGetResult> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
  };

  // Add conditional headers if we have cached values
  // Accepts both strong and weak ETags (Cloudflare uses W/ prefix)
  if (cached.etag) {
    headers["If-None-Match"] = cached.etag;
  }
  if (cached.lastModified) {
    headers["If-Modified-Since"] = cached.lastModified;
  }

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "follow",
    });

    // 304 Not Modified - content unchanged
    if (response.status === 304) {
      return { status: "unchanged" };
    }

    // 200 OK - content changed, return response and new headers
    if (response.ok) {
      return {
        status: "changed",
        response,
        headers: {
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
        },
      };
    }

    // Non-2xx status - treat as error
    return { status: "error" };
  } catch {
    // Network error, timeout, or abort - treat as error
    return { status: "error" };
  }
}

/**
 * Check if headers are available for conditional request.
 *
 * @param cached - Cached headers
 * @returns True if at least one header is available
 */
export function hasConditionalHeaders(cached: CachedHeaders | null): boolean {
  if (!cached) return false;
  return Boolean(cached.etag || cached.lastModified);
}
