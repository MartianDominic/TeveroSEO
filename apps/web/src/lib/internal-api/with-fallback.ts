/**
 * Fallback Utilities for Cross-Service Communication
 *
 * Provides resilient patterns for handling service failures gracefully.
 * When the primary service (AI-Writer) is unavailable, these utilities
 * enable fallback to cached data, default values, or alternative sources.
 *
 * Usage patterns:
 * - Cache fallback: Use cached data when live API fails
 * - Default fallback: Return sensible defaults on failure
 * - Degraded mode: Return partial data with a degraded flag
 *
 * @see client.ts for the primary internal API client
 */

import { logger } from '@/lib/logger';

import { InternalApiError } from "./client";

/**
 * Options for fallback behavior.
 */
export interface FallbackOptions<T> {
  /**
   * Determine if fallback should be used for this error.
   * Default: returns true for 5xx errors and timeouts.
   */
  shouldFallback?: (error: Error) => boolean;

  /**
   * Callback when fallback is used (for logging/monitoring).
   */
  onFallback?: (error: Error, fallbackValue: T) => void;

  /**
   * Timeout for the primary operation (in ms).
   * If provided, wraps primary in a timeout.
   */
  timeout?: number;
}

/**
 * Default function to determine if fallback should be used.
 * Returns true for server errors (5xx), timeouts, and network failures.
 */
export function defaultShouldFallback(error: Error): boolean {
  if (error instanceof InternalApiError) {
    // Fallback on server errors, timeouts, and service unavailable
    return error.statusCode >= 500 || error.statusCode === 408 || error.statusCode === 503;
  }

  // Network errors (fetch failures)
  if (error.message.includes("fetch") || error.message.includes("network")) {
    return true;
  }

  // Timeout errors
  if (error.name === "AbortError" || error.message.includes("timeout")) {
    return true;
  }

  return false;
}

/**
 * Execute primary operation with fallback on failure.
 *
 * @param primary - Primary async operation (usually API call)
 * @param fallback - Fallback async operation (cached data, defaults, etc.)
 * @param options - Configuration options
 * @returns Result from primary or fallback
 *
 * @example
 * ```typescript
 * const data = await withFallback(
 *   () => internalApi.get("/internal/voice/profile", { schema: VoiceProfileSchema }),
 *   () => getCachedVoiceProfile(),
 *   { shouldFallback: (e) => e instanceof InternalApiError && e.statusCode >= 500 }
 * );
 * ```
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  options: FallbackOptions<T> = {}
): Promise<T> {
  const { shouldFallback = defaultShouldFallback, onFallback, timeout } = options;

  try {
    // Optionally wrap primary in timeout
    if (timeout) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const result = await primary();
        clearTimeout(timeoutId);
        return result;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return await primary();
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    if (shouldFallback(error)) {
      logger.warn(`[withFallback] Primary operation failed, using fallback`, { detail: error.message });

      const fallbackValue = await fallback();

      if (onFallback) {
        onFallback(error, fallbackValue);
      }

      return fallbackValue;
    }

    // Don't fallback for client errors (4xx) - these indicate real problems
    throw error;
  }
}

/**
 * Result type that includes degraded status indicator.
 */
export interface DegradedResult<T> {
  data: T;
  /** True if data came from fallback source */
  isDegraded: boolean;
  /** Error that caused degradation, if any */
  error?: Error;
  /** Source of the data */
  source: "primary" | "fallback" | "cache";
}

/**
 * Execute operation with degraded mode support.
 * Always returns a result, but indicates if using fallback data.
 *
 * @param primary - Primary async operation
 * @param fallback - Fallback data or async operation
 * @param options - Configuration options
 * @returns Result with degraded status indicator
 *
 * @example
 * ```typescript
 * const result = await withDegradedMode(
 *   () => fetchLiveMetrics(),
 *   () => getCachedMetrics(),
 * );
 *
 * if (result.isDegraded) {
 *   showStaleDataWarning();
 * }
 * ```
 */
export async function withDegradedMode<T>(
  primary: () => Promise<T>,
  fallback: (() => Promise<T>) | (() => T) | T,
  options: FallbackOptions<T> = {}
): Promise<DegradedResult<T>> {
  const { shouldFallback = defaultShouldFallback } = options;

  try {
    const data = await primary();
    return {
      data,
      isDegraded: false,
      source: "primary",
    };
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    if (shouldFallback(error)) {
      const fallbackData =
        typeof fallback === "function" ? await (fallback as () => Promise<T> | T)() : fallback;

      return {
        data: fallbackData,
        isDegraded: true,
        error,
        source: "fallback",
      };
    }

    throw error;
  }
}

/**
 * Create a cached fallback function with TTL.
 *
 * @param fetcher - Function to fetch fresh data
 * @param ttlMs - Cache time-to-live in milliseconds
 * @returns Tuple of [cachingFetcher, getCachedValue]
 *
 * @example
 * ```typescript
 * const [fetchWithCache, getCached] = createCachedFallback(
 *   () => internalApi.get("/internal/settings"),
 *   5 * 60 * 1000 // 5 minutes
 * );
 *
 * // In your code:
 * const data = await withFallback(
 *   () => fetchWithCache(), // Primary: fetch and cache
 *   () => getCached(), // Fallback: use cached value
 * );
 * ```
 */
export function createCachedFallback<T>(
  fetcher: () => Promise<T>,
  ttlMs: number
): [fetchAndCache: () => Promise<T>, getCached: () => Promise<T>] {
  let cachedValue: T | undefined;
  let cacheTime: number | undefined;

  const fetchAndCache = async (): Promise<T> => {
    const value = await fetcher();
    cachedValue = value;
    cacheTime = Date.now();
    return value;
  };

  const getCached = async (): Promise<T> => {
    if (cachedValue === undefined) {
      throw new Error("No cached value available");
    }

    // Check if cache is stale (but still return it - better than nothing)
    if (cacheTime && Date.now() - cacheTime > ttlMs) {
      logger.warn("[cache] Returning stale cached value");
    }

    return cachedValue;
  };

  return [fetchAndCache, getCached];
}

/**
 * Retry configuration for transient failures.
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay between retries in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay between retries in ms (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Jitter factor 0-1 to randomize delays (default: 0.1) */
  jitter?: number;
}

/**
 * Execute operation with exponential backoff retry.
 *
 * @param operation - Async operation to retry
 * @param options - Retry configuration
 * @returns Result from successful attempt
 *
 * @example
 * ```typescript
 * const data = await withRetry(
 *   () => internalApi.post("/internal/content/generate", payload),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    jitter = 0.1,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      lastError = error;

      // Check if this error is retryable
      const isRetryable =
        error instanceof InternalApiError ? error.isRetryable() : defaultShouldFallback(error);

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(initialDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
      const jitterAmount = baseDelay * jitter * Math.random();
      const delay = baseDelay + jitterAmount;

      logger.warn(`[withRetry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms`, { detail: error.message });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This shouldn't be reached, but TypeScript doesn't know that
  throw lastError;
}
