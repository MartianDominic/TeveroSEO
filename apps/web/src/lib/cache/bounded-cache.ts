/**
 * Bounded Cache - Re-export from shared package
 *
 * This file re-exports the consolidated BoundedCache from @tevero/utils.
 * Maintains backward compatibility with existing imports.
 *
 * @deprecated Import directly from '@tevero/utils' for new code:
 * ```ts
 * import { BoundedCache, createBoundedCache } from '@tevero/utils';
 * ```
 */

// Re-export all types and classes
export {
  BoundedCache,
  createBoundedCache,
  startPeriodicPruning,
  createApiResponseCache,
  createUserProfileCache,
} from "@tevero/utils";

export type {
  BoundedCacheOptions,
  CacheEntry,
  CacheStats,
} from "@tevero/utils";

// Singleton instances for backward compatibility
import { createApiResponseCache, createUserProfileCache } from "@tevero/utils";

/**
 * Shared API response cache instance.
 * 500 entries, 1 minute TTL.
 */
export const apiResponseCache = createApiResponseCache<unknown>();

/**
 * Shared user profile cache instance.
 * 100 entries, 5 minutes TTL.
 */
export const userProfileCache = createUserProfileCache<unknown>();
