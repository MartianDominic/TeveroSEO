/**
 * Cache Module Exports
 *
 * Unified caching infrastructure for analytics data.
 * Resolves DATA-01, DATA-02, DATA-05, DATA-07 issues.
 */

// Analytics cache
export {
  AnalyticsCache,
  getAnalyticsCache,
  resetAnalyticsCache,
  createFreshMetadata,
  wrapWithMetadata,
  buildCacheKey,
  buildCachePattern,
  ANALYTICS_CACHE_TTL_SECONDS,
  DEFAULT_CACHE_TTL_SECONDS,
  CACHE_PREFIX,
  type CacheMetadata,
  type CachedData,
  type AnalyticsCacheType,
  type CacheOptions,
} from './analytics-cache';

// Cache invalidation
export {
  publishCacheInvalidation,
  subscribeToCacheInvalidations,
  unsubscribeFromCacheInvalidations,
  closeInvalidationPublisher,
  registerInvalidationHandler,
  clearInvalidationHandlers,
  isInvalidationSubscriberActive,
  getInvalidationInstanceId,
  invalidateAfterGscSync,
  invalidateAfterGa4Sync,
  invalidateWorkspaceCache,
  INVALIDATION_CHANNEL,
  INSTANCE_ID,
  type CacheInvalidationEvent,
  type InvalidationReason,
  type InvalidationHandler,
} from './cache-invalidation';
