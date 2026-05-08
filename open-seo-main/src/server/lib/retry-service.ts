/**
 * Retry Service with Exponential Backoff
 *
 * DUP-006 FIX: Consolidates retry logic duplicated across bridge/*.ts and oauth/*.ts.
 *
 * Provides a unified retry mechanism with:
 * - Configurable exponential backoff
 * - Customizable retry conditions
 * - Jitter for distributed systems
 * - Circuit breaker integration
 *
 * @module server/lib/retry-service
 */

import { createLogger } from "./logger";

const logger = createLogger({ module: "retry-service" });

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay between retries in milliseconds (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay between retries in milliseconds (default: 30000) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** Optional jitter factor (0-1) to randomize delays (default: 0.1) */
  jitter?: number;
  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
  /** Optional timeout per attempt in milliseconds */
  timeoutMs?: number;
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, "isRetryable" | "onRetry" | "timeoutMs">> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: 0.1,
};

/**
 * Result of a retry operation.
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Common HTTP errors that should trigger retries.
 */
const RETRYABLE_HTTP_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * Common network errors that should trigger retries.
 */
const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
]);

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Add jitter to a delay value.
 */
function addJitter(delay: number, jitterFactor: number): number {
  if (jitterFactor <= 0) return delay;
  const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, delay + jitter);
}

/**
 * Calculate delay for the next retry attempt.
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
  jitterFactor: number
): number {
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt);
  const boundedDelay = Math.min(exponentialDelay, maxDelay);
  return addJitter(boundedDelay, jitterFactor);
}

/**
 * Default function to determine if an error is retryable.
 */
export function isRetryableError(error: Error): boolean {
  // Check for HTTP status codes in error message or properties
  const errorAny = error as Error & { status?: number; statusCode?: number; code?: string };

  // Check HTTP status codes
  const status = errorAny.status ?? errorAny.statusCode;
  if (status && RETRYABLE_HTTP_STATUS_CODES.has(status)) {
    return true;
  }

  // Check network error codes
  if (errorAny.code && RETRYABLE_ERROR_CODES.has(errorAny.code)) {
    return true;
  }

  // Check error message patterns
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    "timeout",
    "timed out",
    "network error",
    "socket hang up",
    "connection reset",
    "connection refused",
    "too many requests",
    "rate limit",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Execute a function with automatic retries on failure.
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration (optional)
 * @returns Promise resolving to the function result
 * @throws The last error if all retries fail
 *
 * @example
 * // Basic usage
 * const result = await withRetry(
 *   () => fetchDataFromApi(),
 *   { maxRetries: 3 }
 * );
 *
 * @example
 * // With custom retry condition
 * const result = await withRetry(
 *   () => sendWebhook(payload),
 *   {
 *     maxRetries: 5,
 *     isRetryable: (error) => error.message.includes('503'),
 *     onRetry: (error, attempt) => logger.warn(`Retry ${attempt}`, { error })
 *   }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const opts: Required<Omit<RetryConfig, "isRetryable" | "onRetry" | "timeoutMs">> & Pick<RetryConfig, "isRetryable" | "onRetry" | "timeoutMs"> = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  const isRetryable = opts.isRetryable ?? isRetryableError;
  let lastError: Error = new Error("No attempts made");
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Execute with optional timeout
      if (opts.timeoutMs) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Operation timed out")), opts.timeoutMs)
        );
        return await Promise.race([fn(), timeoutPromise]);
      }
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt >= opts.maxRetries) {
        logger.debug("Max retries reached", { attempt: attempt + 1, error: lastError.message });
        throw lastError;
      }

      // Check if error is retryable
      if (!isRetryable(lastError)) {
        logger.debug("Error not retryable", { error: lastError.message });
        throw lastError;
      }

      // Calculate delay with jitter
      delay = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
        opts.jitter ?? 0.1
      );

      // Call onRetry callback
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt + 1, delay);
      }

      logger.debug("Retrying operation", {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        delayMs: delay,
        error: lastError.message,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Execute a function with retries and return a detailed result.
 *
 * Unlike withRetry, this doesn't throw on failure - it returns
 * a result object indicating success/failure.
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns RetryResult with success status and data/error
 */
export async function withRetryResult<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const opts: Required<Omit<RetryConfig, "isRetryable" | "onRetry" | "timeoutMs">> & Pick<RetryConfig, "isRetryable" | "onRetry" | "timeoutMs"> = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  const isRetryable = opts.isRetryable ?? isRetryableError;
  let lastError: Error = new Error("No attempts made");
  let totalDelayMs = 0;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const data = opts.timeoutMs
        ? await Promise.race([
            fn(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Operation timed out")), opts.timeoutMs)
            ),
          ])
        : await fn();

      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= opts.maxRetries || !isRetryable(lastError)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalDelayMs,
        };
      }

      delay = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
        opts.jitter ?? 0.1
      );
      totalDelayMs += delay;

      if (opts.onRetry) {
        opts.onRetry(lastError, attempt + 1, delay);
      }

      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: opts.maxRetries + 1,
    totalDelayMs,
  };
}

/**
 * Pre-configured retry configs for common use cases.
 */
export const RETRY_CONFIGS = {
  /** Fast retries for internal services (3 retries, 100ms initial delay) */
  FAST: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
  } as Partial<RetryConfig>,

  /** Standard API retries (3 retries, 1s initial delay) */
  STANDARD: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  } as Partial<RetryConfig>,

  /** Aggressive retries for critical operations (5 retries, 500ms initial) */
  AGGRESSIVE: {
    maxRetries: 5,
    initialDelayMs: 500,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  } as Partial<RetryConfig>,

  /** Patient retries for external APIs (3 retries, 2s initial, higher max) */
  EXTERNAL_API: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 2.5,
    jitter: 0.2,
  } as Partial<RetryConfig>,

  /** Webhook delivery (5 retries with longer backoff) */
  WEBHOOK: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 300000, // 5 minutes max
    backoffMultiplier: 3,
    jitter: 0.15,
  } as Partial<RetryConfig>,
} as const;
