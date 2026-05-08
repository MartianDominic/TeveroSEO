/**
 * Unified Retry Utilities
 *
 * Canonical implementation for all retry logic across the system.
 * Provides exponential backoff, circuit breaker support, and flexible configuration.
 *
 * Used by:
 * - Third-party API integrations (Anthropic, Stripe, DataForSEO)
 * - BullMQ workers
 * - Scraping infrastructure
 *
 * @module lib/retry
 */

import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "retry" });

// =============================================================================
// Core Types
// =============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier?: number;
  /** Optional function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Optional callback for each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  /** Enable logging of retry attempts (default: false) */
  logRetries?: boolean;
  /** Operation name for logging context */
  operationName?: string;
}

// =============================================================================
// Default Error Classification
// =============================================================================

/**
 * Default retryable error check.
 * Retries on network errors, timeouts, and 5xx/429 status codes.
 */
export function defaultIsRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up") ||
    message.includes("dns")
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

  // DataForSEO retryable error codes
  if (
    message.includes("error code: 20002") || // Rate limit
    message.includes("error code: 60001") || // Internal server error
    message.includes("error code: 60002") || // Service unavailable
    message.includes("error code: 60003")    // Temporarily unavailable
  ) {
    return true;
  }

  return false;
}

// =============================================================================
// Backoff Calculation
// =============================================================================

/**
 * Calculate delay for exponential backoff with jitter.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap
 * @param multiplier - Backoff multiplier (default: 2)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  multiplier: number = 2
): number {
  // Exponential backoff: baseDelay * multiplier^attempt
  const exponentialDelay = baseDelayMs * Math.pow(multiplier, attempt);

  // Add jitter (10% of exponential delay)
  const jitter = Math.random() * 0.1 * exponentialDelay;

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

// =============================================================================
// Core Retry Function
// =============================================================================

/**
 * Execute a function with exponential backoff retry logic.
 *
 * This is the canonical retry implementation for the entire system.
 * Supports all retry patterns needed by workers, API clients, and scrapers.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 *
 * @example
 * // Basic usage
 * const response = await withRetry(
 *   () => anthropic.messages.create({ ... }),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 *
 * @example
 * // With logging and callbacks
 * const result = await withRetry(
 *   () => fetchExternalApi(),
 *   {
 *     maxRetries: 5,
 *     baseDelayMs: 2000,
 *     logRetries: true,
 *     operationName: 'DataForSEO fetch',
 *     onRetry: (attempt, error, delay) => {
 *       metrics.recordRetry('dfs', attempt);
 *     }
 *   }
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
    backoffMultiplier = 2,
    isRetryable = defaultIsRetryable,
    onRetry,
    logRetries = false,
    operationName = "operation",
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const isLastAttempt = attempt >= maxRetries - 1;
      const errorIsRetryable = isRetryable(lastError);

      if (isLastAttempt || !errorIsRetryable) {
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = calculateBackoffDelay(
        attempt,
        baseDelayMs,
        maxDelayMs,
        backoffMultiplier
      );

      // Log retry if enabled
      if (logRetries) {
        log.warn(`Retry attempt ${attempt + 1}/${maxRetries} for ${operationName}`, {
          error: lastError.message,
          nextDelayMs: Math.round(delay),
        });
      }

      // Call onRetry callback if provided
      onRetry?.(attempt + 1, lastError, delay);

      await sleep(delay);
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

// =============================================================================
// Retry with Timeout
// =============================================================================

/**
 * Execute a function with both retry and timeout logic.
 * Each attempt has its own timeout.
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout per attempt in milliseconds
 * @param options - Retry configuration
 * @returns Result of the function
 *
 * @example
 * const result = await withRetryAndTimeout(
 *   () => slowApiCall(),
 *   5000, // 5s timeout per attempt
 *   { maxRetries: 3 }
 * );
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  options: RetryOptions = {}
): Promise<T> {
  const operationName = options.operationName ?? "operation";
  return withRetry(
    () => withTimeout(fn(), timeoutMs, operationName),
    options
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a retryable error checker for specific error codes.
 * Useful for APIs that return numeric error codes.
 *
 * @param retryableCodes - Array of error codes that should trigger retry
 * @returns Function that checks if error contains any of the codes
 *
 * @example
 * const isDfsRetryable = createErrorCodeChecker([20002, 60001, 60002, 60003]);
 * await withRetry(fn, { isRetryable: isDfsRetryable });
 */
export function createErrorCodeChecker(
  retryableCodes: number[]
): (error: Error) => boolean {
  return (error: Error): boolean => {
    const message = error.message.toLowerCase();

    // First check default retryable conditions
    if (defaultIsRetryable(error)) {
      return true;
    }

    // Then check for specific error codes
    for (const code of retryableCodes) {
      if (
        message.includes(`error code: ${code}`) ||
        message.includes(`error code ${code}`) ||
        message.includes(`code: ${code}`) ||
        message.includes(`(${code})`)
      ) {
        return true;
      }
    }

    return false;
  };
}

// =============================================================================
// Legacy Compatibility Types
// =============================================================================

/**
 * Options type for backward compatibility with worker-style retry options.
 * Maps to RetryOptions internally.
 */
export interface WorkerRetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Adapt worker-style options to canonical RetryOptions.
 * Use this when migrating code that used the old worker withRetry signature.
 *
 * @param workerOpts - Worker-style retry options
 * @returns Canonical RetryOptions
 */
export function adaptWorkerOptions(workerOpts: WorkerRetryOptions): RetryOptions {
  return {
    maxRetries: workerOpts.maxAttempts,
    baseDelayMs: workerOpts.initialDelayMs,
    maxDelayMs: workerOpts.maxDelayMs,
    backoffMultiplier: workerOpts.backoffMultiplier,
    isRetryable: workerOpts.shouldRetry
      ? (err: Error) => workerOpts.shouldRetry!(err)
      : undefined,
  };
}
