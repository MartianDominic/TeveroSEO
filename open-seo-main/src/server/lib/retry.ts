/**
 * Retry utilities for resilient API calls.
 *
 * Provides exponential backoff retry logic for transient failures.
 * Used by third-party API integrations (Anthropic, Stripe, etc.).
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Optional function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
}

/**
 * Default retryable error check.
 * Retries on network errors, timeouts, and 5xx/429 status codes.
 */
function defaultIsRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up")
  ) {
    return true;
  }

  // Rate limiting (429) or server errors (5xx)
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("overloaded") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  ) {
    return true;
  }

  // Anthropic-specific overloaded error
  if (message.includes("529") || message.includes("overloaded_error")) {
    return true;
  }

  return false;
}

/**
 * Execute a function with exponential backoff retry logic.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 *
 * @example
 * const response = await withRetry(
 *   () => anthropic.messages.create({ ... }),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    isRetryable = defaultIsRetryable,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const shouldRetry = attempt < maxRetries - 1 && isRetryable(lastError);

      if (!shouldRetry) {
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Create a timeout promise that rejects after specified milliseconds.
 *
 * @param ms - Timeout in milliseconds
 * @param operation - Description of the operation for error message
 * @returns Promise that rejects with timeout error
 */
export function createTimeoutPromise(
  ms: number,
  operation: string
): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`${operation} timeout after ${ms}ms`)),
      ms
    )
  );
}

/**
 * Execute a promise with a timeout.
 *
 * @param promise - Promise to execute
 * @param ms - Timeout in milliseconds
 * @param operation - Description for timeout error message
 * @returns Result of the promise
 * @throws Timeout error if promise doesn't resolve in time
 *
 * @example
 * const result = await withTimeout(
 *   oauth2Client.refreshAccessToken(),
 *   10000,
 *   "Token refresh"
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  return Promise.race([promise, createTimeoutPromise(ms, operation)]);
}
