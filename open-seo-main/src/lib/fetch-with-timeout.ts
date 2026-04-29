/**
 * Fetch wrapper with configurable timeout to prevent hanging requests.
 *
 * Uses AbortController to cancel requests that exceed the timeout.
 */

export const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

export class TimeoutError extends Error {
  constructor(public timeoutMs: number, url?: string) {
    super(
      url
        ? `Request to ${url} timed out after ${timeoutMs}ms`
        : `Request timed out after ${timeoutMs}ms`
    );
    this.name = "TimeoutError";
  }
}

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
 * // Default 30s timeout
 * const res = await fetchWithTimeout('/api/data');
 *
 * // Custom 60s timeout for slow operations
 * const res = await fetchWithTimeout('/api/briefs/analyze', { timeout: 60_000 });
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
