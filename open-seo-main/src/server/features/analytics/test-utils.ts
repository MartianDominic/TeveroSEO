/**
 * Analytics Test Utilities
 * Helper functions for testing services that return CachedData wrappers.
 *
 * Services in this module return CachedData<T> wrappers with metadata:
 * { data: T, metadata: CacheMetadata }
 *
 * These utilities help tests handle the wrapper consistently.
 */

// Import from unified types package
import type { CachedData, CacheMetadata } from '@tevero/types/cache';

// Re-export for backward compatibility
export type { CachedData, CacheMetadata };

/**
 * Create a CachedData wrapper for test data.
 * Use this when mocking cache returns in tests.
 *
 * @param data - The data to wrap
 * @param options - Optional overrides for metadata
 */
export function wrapCachedData<T>(
  data: T,
  options: Partial<CacheMetadata> = {}
): CachedData<T> {
  const now = new Date();
  const defaultMetadata: CacheMetadata = {
    cachedAt: now.toISOString(),
    dataAsOf: now.toISOString(),
    staleAfter: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // 30 min default
    refreshAvailable: false,
    ...options,
  };

  return {
    data,
    metadata: defaultMetadata,
  };
}

/**
 * Unwrap CachedData to get the inner data.
 * Use this in test assertions when you only care about the data.
 *
 * @param cached - The CachedData wrapper
 * @returns The unwrapped data
 */
export function unwrapCachedData<T>(cached: CachedData<T>): T {
  return cached.data;
}

/**
 * Assert that a result is a valid CachedData wrapper.
 * Useful for verifying service returns the correct structure.
 *
 * @param result - The result to check
 */
export function assertIsCachedData<T>(result: unknown): asserts result is CachedData<T> {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('data' in result) ||
    !('metadata' in result)
  ) {
    throw new Error('Expected CachedData wrapper with data and metadata properties');
  }

  const metadata = (result as CachedData<T>).metadata;
  if (
    typeof metadata !== 'object' ||
    !('cachedAt' in metadata) ||
    !('dataAsOf' in metadata) ||
    !('staleAfter' in metadata) ||
    !('refreshAvailable' in metadata)
  ) {
    throw new Error('CachedData metadata missing required properties');
  }
}

/**
 * Create fresh metadata for test data.
 * Use when you need just the metadata without wrapping.
 *
 * @param options - Optional overrides
 */
export function createTestMetadata(options: Partial<CacheMetadata> = {}): CacheMetadata {
  const now = new Date();
  return {
    cachedAt: now.toISOString(),
    dataAsOf: now.toISOString(),
    staleAfter: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    refreshAvailable: false,
    ...options,
  };
}

/**
 * Create stale metadata for testing cache refresh scenarios.
 *
 * @param options - Optional overrides
 */
export function createStaleMetadata(options: Partial<CacheMetadata> = {}): CacheMetadata {
  const now = new Date();
  const pastDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
  return {
    cachedAt: pastDate.toISOString(),
    dataAsOf: pastDate.toISOString(),
    staleAfter: pastDate.toISOString(), // Already stale
    refreshAvailable: true,
    ...options,
  };
}
