/**
 * Cache utilities barrel export.
 */

export {
  cacheGet,
  cacheSet,
  cacheInvalidate,
  cacheInvalidateByTag,
  cacheInvalidatePattern,
  invalidateClientCache,
  cacheKeys,
  cacheTags,
  type CacheOptions,
} from "./redis-cache";

export { withCache, hashParams } from "./with-cache";

// In-memory bounded cache utilities
export {
  BoundedCache,
  apiResponseCache,
  userProfileCache,
} from "./bounded-cache";

export {
  startCacheCleanup,
  stopCacheCleanup,
  getCacheStats,
} from "./cache-cleanup";

// Singleflight utilities for cache stampede prevention
export {
  singleflight,
  getCachedWithSingleflight,
  getInFlightCount,
  getInFlightKeys,
} from "./singleflight";

// DFI-007/DFI-012: Unified cache invalidation (Next.js + Redis)
// CRIT-CACHE-01: Cross-instance pub/sub invalidation
// HIGH-CACHE-01: Workspace transfer invalidation
export {
  invalidateClientData,
  invalidateWorkspaceData,
  invalidateWorkspaceTransfer,
  markCacheAsStale,
  isCacheStale,
  getStaleInfo,
  publishInvalidation,
  startInvalidationSubscriber,
  stopInvalidationSubscriber,
  isSubscriberActive,
  getInstanceId,
  type ClientDataCategory,
  type InvalidationMessage,
} from "./unified-invalidation";
