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
  createSerpMemoryCache,
} from "@tevero/utils";

export type {
  BoundedCacheOptions,
  CacheEntry,
  CacheStats,
} from "@tevero/utils";
