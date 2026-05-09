/**
 * Cache Types
 *
 * Phase 96 Type Unification: Single source of truth for cache types
 * used across analytics services.
 *
 * @module @tevero/types/cache
 */

// =============================================================================
// Cache Metadata
// =============================================================================

/**
 * Metadata attached to all cached data.
 * Provides freshness information to UI for user transparency.
 */
export interface CacheMetadata {
  /** ISO timestamp when data was cached */
  cachedAt: string;
  /** ISO timestamp of the source data (e.g., last GSC sync time) */
  dataAsOf: string;
  /** ISO timestamp when cache expires */
  staleAfter: string;
  /** Whether a manual refresh is available */
  refreshAvailable: boolean;
}

/**
 * Wrapper for cached data with metadata.
 * All cached responses should use this structure for consistency.
 *
 * @example
 * ```ts
 * const result: CachedData<TrendResult> = {
 *   data: trendResult,
 *   metadata: {
 *     cachedAt: new Date().toISOString(),
 *     dataAsOf: lastSyncTime.toISOString(),
 *     staleAfter: staleTime.toISOString(),
 *     refreshAvailable: false,
 *   },
 * };
 * ```
 */
export interface CachedData<T> {
  /** The cached data payload */
  data: T;
  /** Cache metadata */
  metadata: CacheMetadata;
}

// =============================================================================
// Cache Configuration
// =============================================================================

/**
 * Cache configuration options.
 */
export interface CacheConfig {
  /** Time-to-live in seconds */
  ttlSeconds: number;
  /** Cache key prefix */
  prefix?: string;
  /** Whether to return stale data while revalidating */
  staleWhileRevalidate?: boolean;
  /** Maximum age of stale data to return (seconds) */
  maxStaleAge?: number;
}

/**
 * Default cache configuration values.
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlSeconds: 30 * 60, // 30 minutes
  prefix: "cache:",
  staleWhileRevalidate: true,
  maxStaleAge: 24 * 60 * 60, // 24 hours
};

/**
 * Analytics cache TTL in seconds (30 minutes).
 *
 * This is the standard TTL for all analytics cache entries.
 * GSC data has 2-3 day processing latency, so shorter TTLs
 * don't improve freshness.
 */
export const ANALYTICS_CACHE_TTL_SECONDS = 30 * 60;

// =============================================================================
// Cache Types
// =============================================================================

/**
 * Cache types for analytics data.
 * Each type has its own namespace for easier invalidation.
 */
export type AnalyticsCacheType =
  | "dashboard"
  | "trends"
  | "striking"
  | "cannibalization"
  | "clusters"
  | "groups"
  | "portfolio"
  | "ctr-benchmark"
  | "index-coverage";

/**
 * Cache operation options.
 */
export interface CacheOptions {
  /** Custom TTL in seconds (overrides default) */
  ttlSeconds?: number;
  /** Whether to return stale data when cached results expire */
  returnStale?: boolean;
}

// =============================================================================
// Cache Result Types
// =============================================================================

/**
 * Result of a cache get operation.
 */
export type CacheGetResult<T> =
  | { hit: true; data: CachedData<T> }
  | { hit: false; data: null };

/**
 * Result of a cache set operation.
 */
export interface CacheSetResult {
  success: boolean;
  key: string;
  ttl: number;
}

/**
 * Result of a cache invalidation operation.
 */
export interface CacheInvalidateResult {
  success: boolean;
  keysDeleted: number;
}

// =============================================================================
// Cache Statistics
// =============================================================================

/**
 * Cache statistics for monitoring.
 */
export interface CacheStats {
  /** Total number of cached keys */
  totalKeys: number;
  /** Keys by cache type */
  byType: Record<string, number>;
  /** Cache hit rate (0-1) */
  hitRate?: number;
  /** Total memory usage in bytes */
  memoryBytes?: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create metadata for a fresh data response.
 * Use when returning data directly without caching.
 *
 * @param dataAsOf - Timestamp of the source data
 * @param ttlSeconds - TTL for freshness calculation
 * @returns Cache metadata
 */
export function createFreshMetadata(
  dataAsOf: Date,
  ttlSeconds: number = ANALYTICS_CACHE_TTL_SECONDS
): CacheMetadata {
  const now = new Date();
  return {
    cachedAt: now.toISOString(),
    dataAsOf: dataAsOf.toISOString(),
    staleAfter: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    refreshAvailable: false,
  };
}

/**
 * Wrap data with fresh metadata.
 *
 * @param data - Data to wrap
 * @param dataAsOf - Timestamp of the source data
 * @param ttlSeconds - TTL for freshness calculation
 * @returns Cached data wrapper
 */
export function wrapCachedData<T>(
  data: T,
  dataAsOf: Date,
  ttlSeconds?: number
): CachedData<T> {
  return {
    data,
    metadata: createFreshMetadata(dataAsOf, ttlSeconds),
  };
}

/**
 * Unwrap cached data to get just the data payload.
 *
 * @param cached - Cached data wrapper
 * @returns The data payload
 */
export function unwrapCachedData<T>(cached: CachedData<T>): T {
  return cached.data;
}

/**
 * Type guard to check if a value is CachedData.
 *
 * @param value - Value to check
 * @returns true if value is CachedData
 */
export function isCachedData<T>(value: unknown): value is CachedData<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "metadata" in value &&
    typeof (value as CachedData<T>).metadata === "object" &&
    "cachedAt" in (value as CachedData<T>).metadata
  );
}

/**
 * Assert that a value is CachedData (for testing).
 *
 * @param value - Value to assert
 * @throws Error if value is not CachedData
 */
export function assertIsCachedData<T>(value: unknown): asserts value is CachedData<T> {
  if (!isCachedData<T>(value)) {
    throw new Error("Expected CachedData wrapper but got: " + typeof value);
  }
}

/**
 * Check if cached data is stale.
 *
 * @param cached - Cached data to check
 * @returns true if data is past staleAfter timestamp
 */
export function isStale<T>(cached: CachedData<T>): boolean {
  return new Date(cached.metadata.staleAfter) < new Date();
}

/**
 * Check if cached data is fresh.
 *
 * @param cached - Cached data to check
 * @returns true if data is still fresh (not stale)
 */
export function isFresh<T>(cached: CachedData<T>): boolean {
  return !isStale(cached);
}
