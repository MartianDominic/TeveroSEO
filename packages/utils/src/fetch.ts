/**
 * Fetch utilities with timeout support.
 *
 * @module @tevero/utils/fetch
 *
 * Provides a fetch wrapper with configurable timeout to prevent hanging requests.
 * Uses AbortController to cancel requests that exceed the timeout.
 *
 * Timeout guidelines for cross-service consistency:
 * - DEFAULT_TIMEOUT_MS (30s): Normal operations (CRUD, queries)
 * - LONG_RUNNING_TIMEOUT_MS (120s): Audits, content generation, bulk operations
 * - QUICK_CHECK_TIMEOUT_MS (5s): Health checks, feature flags
 */

/** Default timeout for normal operations (30 seconds) */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Timeout for long-running operations like audits and generation (120 seconds) */
export const LONG_RUNNING_TIMEOUT_MS = 120_000;

/** Timeout for quick health checks and feature flags (5 seconds) */
export const QUICK_CHECK_TIMEOUT_MS = 5_000;

/**
 * Custom error class for timeout scenarios.
 * Includes the timeout duration and optional URL for debugging.
 */
export class TimeoutError extends Error {
  constructor(
    public timeoutMs: number,
    url?: string
  ) {
    super(
      url
        ? `Request to ${url} timed out after ${timeoutMs}ms`
        : `Request timed out after ${timeoutMs}ms`
    );
    this.name = "TimeoutError";
  }
}

/**
 * Options for fetchWithTimeout, extending standard RequestInit.
 */
export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds. Defaults to 30 seconds. */
  timeout?: number;
}

/**
 * Fetch with automatic timeout using AbortController.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options plus optional timeout (default 30s)
 * @returns Promise resolving to Response
 * @throws TimeoutError if request exceeds timeout
 *
 * @example
 * ```typescript
 * import { fetchWithTimeout, LONG_RUNNING_TIMEOUT_MS } from "@tevero/utils";
 *
 * // Default 30s timeout
 * const res = await fetchWithTimeout("/api/data");
 *
 * // Custom 60s timeout for slow operations
 * const res = await fetchWithTimeout("/api/voice/analyze", { timeout: 60_000 });
 *
 * // Using predefined timeout constant
 * const res = await fetchWithTimeout("/api/audit", { timeout: LONG_RUNNING_TIMEOUT_MS });
 *
 * // 5s timeout for quick health checks
 * const res = await fetchWithTimeout("/health", { timeout: QUICK_CHECK_TIMEOUT_MS });
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(timeout, url);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
