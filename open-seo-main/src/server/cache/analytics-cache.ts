/**
 * Unified Analytics Cache Service
 * DATA-01, DATA-02, DATA-07 FIX: Single source of truth for analytics caching
 *
 * @see docs/architecture/gsc-data-flow.md for the complete GSC data architecture
 *
 * Features:
 * - Single Redis cache for all analytics data (eliminates double caching)
 * - Consistent key naming: `analytics:{type}:{workspaceId}:{siteId}`
 * - Unified 30-minute TTL (balances freshness vs API load)
 * - Cache metadata includes lastUpdated timestamp for freshness indicators
 * - Pub/sub invalidation support for cross-service coordination
 *
 * Usage:
 * ```ts
 * import { getAnalyticsCache } from '@/server/cache/analytics-cache';
 *
 * const cache = getAnalyticsCache();
 *
 * // Get with metadata
 * const result = await cache.get('dashboard', workspaceId, siteId);
 * if (result && !result.metadata.refreshAvailable) {
 *   return result; // Serve from cache
 * }
 *
 * // Set with data timestamp
 * await cache.set('dashboard', workspaceId, siteId, data, lastSyncTime);
 * ```
 */

import { redis } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/logger';

const log = createLogger({ module: 'analytics-cache' });

// =============================================================================
// Configuration
// =============================================================================

/**
 * Standard TTL for ALL analytics cache entries (30 minutes).
 *
 * This constant is the single source of truth for analytics cache TTL.
 * ALL analytics services MUST import and use this constant.
 *
 * Rationale:
 * - GSC data has 2-3 day processing latency, so shorter TTLs don't improve freshness
 * - 30 minutes balances freshness vs API/database load
 * - Consistent TTL prevents cache coherency issues across dashboard components
 *
 * DO NOT define custom TTL values in individual services.
 * Import this constant instead: import { ANALYTICS_CACHE_TTL_SECONDS } from '@/server/cache';
 */
export const ANALYTICS_CACHE_TTL_SECONDS = 30 * 60;

/** @deprecated Use ANALYTICS_CACHE_TTL_SECONDS instead */
const DEFAULT_CACHE_TTL_SECONDS = ANALYTICS_CACHE_TTL_SECONDS;

/** Cache key prefix for analytics data */
const CACHE_PREFIX = 'analytics:' as const;

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Metadata attached to all cached analytics data.
 * Provides freshness information to UI for user transparency.
 */
export interface CacheMetadata {
  /** ISO timestamp when data was cached */
  cachedAt: string;
  /** ISO timestamp of the source data (last GSC sync time) */
  dataAsOf: string;
  /** ISO timestamp when cache expires */
  staleAfter: string;
  /** Whether a manual refresh is available */
  refreshAvailable: boolean;
}

/**
 * Wrapper for cached data with metadata.
 */
export interface CachedData<T> {
  data: T;
  metadata: CacheMetadata;
}

/**
 * Cache types for analytics data.
 * Each type has its own namespace for easier invalidation.
 */
export type AnalyticsCacheType =
  | 'dashboard'
  | 'trends'
  | 'striking'
  | 'cannibalization'
  | 'clusters'
  | 'groups'
  | 'portfolio'
  | 'ctr-benchmark'
  | 'index-coverage';

/**
 * Options for cache operations.
 */
export interface CacheOptions {
  /** Custom TTL in seconds (overrides default) */
  ttlSeconds?: number;
  /** Whether to include stale data when returning cached results */
  returnStale?: boolean;
}

// =============================================================================
// Key Building
// =============================================================================

/**
 * Build a standardized cache key.
 *
 * Format: analytics:{type}:{workspaceId}:{siteId}[:{suffix}]
 *
 * @param type - Analytics data type
 * @param workspaceId - Workspace UUID
 * @param siteId - Site UUID or 'all' for workspace-level data
 * @param suffix - Optional additional key component (e.g., filter hash)
 */
function buildCacheKey(
  type: AnalyticsCacheType,
  workspaceId: string,
  siteId: string,
  suffix?: string
): string {
  const base = `${CACHE_PREFIX}${type}:${workspaceId}:${siteId}`;
  return suffix ? `${base}:${suffix}` : base;
}

/**
 * Build a pattern for matching cache keys.
 *
 * @param type - Analytics data type (or '*' for all types)
 * @param workspaceId - Workspace UUID
 * @param siteId - Site UUID (or '*' for all sites)
 */
function buildCachePattern(
  type: AnalyticsCacheType | '*',
  workspaceId: string,
  siteId: string = '*'
): string {
  return `${CACHE_PREFIX}${type}:${workspaceId}:${siteId}:*`;
}

// =============================================================================
// AnalyticsCache Class
// =============================================================================

/**
 * Unified analytics cache service.
 * Provides typed get/set with automatic metadata management.
 */
export class AnalyticsCache {
  private defaultTtl: number;

  constructor(ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS) {
    this.defaultTtl = ttlSeconds;
  }

  /**
   * Get cached analytics data with metadata.
   *
   * @param type - Analytics data type
   * @param workspaceId - Workspace UUID
   * @param siteId - Site UUID
   * @param suffix - Optional additional key component
   * @param options - Cache options
   * @returns Cached data with metadata, or null if not found/expired
   */
  async get<T>(
    type: AnalyticsCacheType,
    workspaceId: string,
    siteId: string,
    suffix?: string,
    options: CacheOptions = {}
  ): Promise<CachedData<T> | null> {
    const key = buildCacheKey(type, workspaceId, siteId, suffix);

    try {
      const raw = await redis.get(key);
      if (!raw) {
        log.debug('Cache miss', { key, type, workspaceId, siteId });
        return null;
      }

      const cached = JSON.parse(raw) as CachedData<T>;

      // Check if data is stale
      const isStale = new Date(cached.metadata.staleAfter) < new Date();

      if (isStale) {
        log.debug('Cache hit but stale', { key, staleAfter: cached.metadata.staleAfter });

        // Mark as refresh available
        const staleResult: CachedData<T> = {
          ...cached,
          metadata: {
            ...cached.metadata,
            refreshAvailable: true,
          },
        };

        // Return stale data if requested, otherwise null
        if (options.returnStale !== false) {
          return staleResult;
        }
        return null;
      }

      log.debug('Cache hit', { key, cachedAt: cached.metadata.cachedAt });
      return cached;
    } catch (error) {
      log.warn('Cache get failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Set analytics data in cache with metadata.
   *
   * @param type - Analytics data type
   * @param workspaceId - Workspace UUID
   * @param siteId - Site UUID
   * @param data - Data to cache
   * @param dataAsOf - Timestamp of the source data (e.g., last GSC sync time)
   * @param suffix - Optional additional key component
   * @param options - Cache options
   */
  async set<T>(
    type: AnalyticsCacheType,
    workspaceId: string,
    siteId: string,
    data: T,
    dataAsOf: Date,
    suffix?: string,
    options: CacheOptions = {}
  ): Promise<void> {
    const key = buildCacheKey(type, workspaceId, siteId, suffix);
    const now = new Date();
    const ttl = options.ttlSeconds ?? this.defaultTtl;

    const cached: CachedData<T> = {
      data,
      metadata: {
        cachedAt: now.toISOString(),
        dataAsOf: dataAsOf.toISOString(),
        staleAfter: new Date(now.getTime() + ttl * 1000).toISOString(),
        refreshAvailable: false,
      },
    };

    try {
      await redis.setex(key, ttl, JSON.stringify(cached));
      log.debug('Cache set', { key, ttl, dataAsOf: dataAsOf.toISOString() });
    } catch (error) {
      log.warn('Cache set failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Delete a specific cache entry.
   *
   * @param type - Analytics data type
   * @param workspaceId - Workspace UUID
   * @param siteId - Site UUID
   * @param suffix - Optional additional key component
   */
  async delete(
    type: AnalyticsCacheType,
    workspaceId: string,
    siteId: string,
    suffix?: string
  ): Promise<void> {
    const key = buildCacheKey(type, workspaceId, siteId, suffix);

    try {
      await redis.del(key);
      log.debug('Cache deleted', { key });
    } catch (error) {
      log.warn('Cache delete failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Invalidate cache entries for a specific site.
   *
   * @param workspaceId - Workspace UUID
   * @param siteId - Site UUID
   * @param types - Specific types to invalidate (default: all types)
   */
  async invalidate(
    workspaceId: string,
    siteId: string,
    types?: AnalyticsCacheType[]
  ): Promise<number> {
    const typesToInvalidate: AnalyticsCacheType[] = types ?? [
      'dashboard',
      'trends',
      'striking',
      'cannibalization',
      'clusters',
      'groups',
      'portfolio',
      'ctr-benchmark',
      'index-coverage',
    ];

    let totalDeleted = 0;

    for (const type of typesToInvalidate) {
      const pattern = buildCachePattern(type, workspaceId, siteId);

      try {
        const matchingKeys = await redis.keys(pattern);
        if (matchingKeys.length > 0) {
          await redis.del(...matchingKeys);
          totalDeleted += matchingKeys.length;
          log.debug('Cache keys invalidated', {
            pattern,
            count: matchingKeys.length,
          });
        }
      } catch (error) {
        log.warn('Cache invalidation failed', {
          pattern,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (totalDeleted > 0) {
      log.info('Cache invalidated', {
        workspaceId,
        siteId,
        types: typesToInvalidate,
        totalDeleted,
      });
    }

    return totalDeleted;
  }

  /**
   * Invalidate all cache entries for a workspace.
   *
   * @param workspaceId - Workspace UUID
   */
  async invalidateAll(workspaceId: string): Promise<number> {
    const pattern = `${CACHE_PREFIX}*:${workspaceId}:*`;

    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        log.info('All workspace caches invalidated', {
          workspaceId,
          count: keys.length,
        });
        return keys.length;
      }
      return 0;
    } catch (error) {
      log.warn('Workspace cache invalidation failed', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get cache statistics for a workspace.
   * Useful for debugging and monitoring.
   *
   * @param workspaceId - Workspace UUID
   */
  async getStats(workspaceId: string): Promise<{
    totalKeys: number;
    byType: Record<string, number>;
  }> {
    const pattern = `${CACHE_PREFIX}*:${workspaceId}:*`;

    try {
      const keys = await redis.keys(pattern);
      const byType: Record<string, number> = {};

      for (const key of keys) {
        // Extract type from key: analytics:{type}:{workspaceId}:{siteId}
        const parts = key.split(':');
        if (parts.length >= 2) {
          const type = parts[1];
          byType[type] = (byType[type] ?? 0) + 1;
        }
      }

      return {
        totalKeys: keys.length,
        byType,
      };
    } catch (error) {
      log.warn('Failed to get cache stats', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { totalKeys: 0, byType: {} };
    }
  }

  /**
   * Check if cache entry exists and is fresh.
   *
   * @param type - Analytics data type
   * @param workspaceId - Workspace UUID
   * @param siteId - Site UUID
   * @param suffix - Optional additional key component
   */
  async isFresh(
    type: AnalyticsCacheType,
    workspaceId: string,
    siteId: string,
    suffix?: string
  ): Promise<boolean> {
    const cached = await this.get(type, workspaceId, siteId, suffix, {
      returnStale: true,
    });

    if (!cached) return false;
    return !cached.metadata.refreshAvailable;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let cacheInstance: AnalyticsCache | null = null;

/**
 * Get the singleton AnalyticsCache instance.
 *
 * @param ttlSeconds - Optional custom TTL (only used on first call)
 */
export function getAnalyticsCache(ttlSeconds?: number): AnalyticsCache {
  if (!cacheInstance) {
    cacheInstance = new AnalyticsCache(ttlSeconds);
  }
  return cacheInstance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetAnalyticsCache(): void {
  cacheInstance = null;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create metadata for a fresh data response (when skipping cache).
 * Useful when returning fresh data directly from a service.
 *
 * @param dataAsOf - Timestamp of the source data
 * @param ttlSeconds - TTL for cache freshness calculation
 */
export function createFreshMetadata(
  dataAsOf: Date,
  ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS
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
 * @param ttlSeconds - TTL for cache freshness calculation
 */
export function wrapWithMetadata<T>(
  data: T,
  dataAsOf: Date,
  ttlSeconds?: number
): CachedData<T> {
  return {
    data,
    metadata: createFreshMetadata(dataAsOf, ttlSeconds),
  };
}

// =============================================================================
// Exports
// =============================================================================

export {
  buildCacheKey,
  buildCachePattern,
  DEFAULT_CACHE_TTL_SECONDS,
  CACHE_PREFIX,
};
