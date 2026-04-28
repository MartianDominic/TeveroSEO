/**
 * Redis utilities barrel export.
 *
 * This module provides:
 * - Connection management with pooling and retry
 * - Type-safe caching with Zod validation
 * - Key namespacing to prevent collisions
 * - Pattern-based cache invalidation
 * - Pub/Sub with error handling
 */

// Client and connection management
export {
  redis,
  closeRedis,
  ensureRedisConnected,
  checkRedisHealth,
} from "./client";

// Cache operations with namespacing and type safety
export {
  cacheGet,
  cacheGetUnsafe,
  cacheSet,
  cacheDelete,
  cacheInvalidateByTag,
  cacheInvalidatePattern,
  invalidateClientCache,
  invalidateWorkspaceCache,
  cacheKeys,
  cacheTags,
  type CacheOptions,
} from "./cache";

// Type-safe cache factory
export {
  createTypedCache,
  commonSchemas,
  clientCache,
  dashboardCache,
  patternsCache,
} from "./typed-cache";

// Pub/Sub utilities
export {
  subscribe,
  unsubscribe,
  publish,
  publishTyped,
  getPubSubStats,
  closePubSub,
  channels,
} from "./pubsub";
