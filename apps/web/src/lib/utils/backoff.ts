/**
 * Exponential Backoff Utilities
 *
 * Provides retry logic with exponential backoff and jitter
 * to prevent thundering herd problems when services recover.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withRetry(
 *   () => fetchExternalApi(),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 *
 * // With custom retry condition
 * const result = await withRetry(
 *   () => callApi(),
 *   {
 *     maxRetries: 5,
 *     shouldRetry: (error) => error.status === 429 || error.status >= 500,
 *   }
 * );
 * ```
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: unknown) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Calculate exponential backoff delay with optional jitter.
 *
 * Formula: min(baseDelay * multiplier^attempt + jitter, maxDelay)
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param options - Backoff configuration
 * @returns Delay in milliseconds
 */
export function exponentialBackoff(
  attempt: number,
  options: Partial<RetryOptions> = {}
): number {
  const {
    baseDelay = DEFAULT_RETRY_OPTIONS.baseDelay,
    maxDelay = DEFAULT_RETRY_OPTIONS.maxDelay,
    backoffMultiplier = DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    jitter = DEFAULT_RETRY_OPTIONS.jitter,
  } = options;

  // Calculate exponential delay
  const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt);

  // Add jitter (0-10% of delay) to prevent thundering herd
  const jitterAmount = jitter ? Math.random() * 0.1 * exponentialDelay : 0;

  // Cap at maximum delay
  return Math.min(exponentialDelay + jitterAmount, maxDelay);
}

/**
 * Sleep for specified milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default retry condition: retry on 5xx errors and rate limiting.
 */
function defaultShouldRetry(error: unknown): boolean {
  // Check for HTTP-like errors with status
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status;
    // Retry on 5xx server errors and 429 rate limiting
    return status >= 500 || status === 429;
  }

  // Check for common retryable error types
  if (error instanceof TypeError) {
    // Network errors often manifest as TypeErrors
    const message = error.message.toLowerCase();
    return (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('connection')
    );
  }

  // Check for timeout errors
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    return (
      name.includes('timeout') ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    );
  }

  return false;
}

/**
 * Execute a function with automatic retry using exponential backoff.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Promise resolving to function result
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_RETRY_OPTIONS.maxRetries,
    shouldRetry = defaultShouldRetry,
    onRetry,
    ...backoffOptions
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay and wait
      const delay = exponentialBackoff(attempt, backoffOptions);
      onRetry?.(attempt + 1, delay, error);
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retry wrapper with pre-configured options.
 *
 * @param defaultOptions - Default retry options
 * @returns Function that wraps async operations with retry logic
 *
 * @example
 * ```typescript
 * const retryFetch = createRetryWrapper({
 *   maxRetries: 5,
 *   baseDelay: 2000,
 *   onRetry: (attempt) => console.log(`Retry ${attempt}...`),
 * });
 *
 * const data = await retryFetch(() => fetch('/api/data'));
 * ```
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return function <T>(
    fn: () => Promise<T>,
    overrideOptions?: RetryOptions
  ): Promise<T> {
    return withRetry(fn, { ...defaultOptions, ...overrideOptions });
  };
}

/**
 * Parse Retry-After header value (supports both seconds and HTTP date).
 *
 * @param headerValue - Value from Retry-After header
 * @returns Delay in milliseconds, or null if invalid
 */
export function parseRetryAfterHeader(headerValue: string | null): number | null {
  if (!headerValue) return null;

  // Try parsing as number of seconds
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = Date.parse(headerValue);
  if (!isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? delay : null;
  }

  return null;
}

/**
 * Execute fetch with retry, respecting Retry-After headers.
 *
 * @param url - URL to fetch
 * @param init - Fetch options
 * @param retryOptions - Retry configuration
 * @returns Fetch Response
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = DEFAULT_RETRY_OPTIONS.maxRetries,
    onRetry,
    ...backoffOptions
  } = retryOptions;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...init,
        signal: init?.signal ?? controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting with Retry-After header
      if (response.status === 429) {
        const retryAfter = parseRetryAfterHeader(
          response.headers.get('Retry-After')
        );
        if (retryAfter && attempt < maxRetries) {
          onRetry?.(attempt + 1, retryAfter, new Error('Rate limited (429)'));
          await sleep(retryAfter);
          continue;
        }
      }

      // Retry on 5xx errors
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = exponentialBackoff(attempt, backoffOptions);
        onRetry?.(attempt + 1, delay, new Error(`Server error (${response.status})`));
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      // Check if it's an AbortError (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < maxRetries) {
          const delay = exponentialBackoff(attempt, backoffOptions);
          onRetry?.(attempt + 1, delay, error);
          await sleep(delay);
          continue;
        }
      }

      // Don't retry on non-network errors
      if (!defaultShouldRetry(error)) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = exponentialBackoff(attempt, backoffOptions);
        onRetry?.(attempt + 1, delay, error);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}
