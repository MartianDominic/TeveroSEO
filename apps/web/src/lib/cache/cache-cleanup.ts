/**
 * Periodic cache cleanup utilities.
 * Prevents memory leaks in long-running processes by
 * periodically removing expired entries from in-memory caches.
 */

import { apiResponseCache, userProfileCache } from "./bounded-cache";

import { logger } from '@/lib/logger';
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic cache cleanup.
 * Call once at application startup.
 */
export function startCacheCleanup(intervalMs: number = 60000): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const apiPruned = apiResponseCache.prune();
    const userPruned = userProfileCache.prune();

    if (apiPruned > 0 || userPruned > 0) {
      logger.info(`[Cache] Pruned ${apiPruned + userPruned} expired entries`);
    }
  }, intervalMs);

  // Don't prevent process exit
  cleanupInterval.unref();
}

/**
 * Stop cache cleanup.
 * Call during graceful shutdown.
 */
export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): Record<string, { size: number; maxSize: number }> {
  return {
    apiResponseCache: apiResponseCache.stats(),
    userProfileCache: userProfileCache.stats(),
  };
}
