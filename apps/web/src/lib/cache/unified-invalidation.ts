/**
 * Unified Cache Invalidation
 *
 * DFI-007 FIX: revalidatePath only clears Next.js cache, not Redis.
 * This module provides unified invalidation that clears both caches.
 *
 * CRIT-CACHE-01 FIX: Added pub/sub for cross-instance L1 invalidation.
 * HIGH-CACHE-01 FIX: Workspace transfer invalidation support.
 *
 * Usage:
 *   import { invalidateClientData } from '@/lib/cache/unified-invalidation';
 *
 *   // After updating client data
 *   await invalidateClientData(clientId, ['dashboard', 'seo']);
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import {
  cacheInvalidateByTag,
  cacheInvalidatePattern,
  invalidateClientCache,
  cacheTags,
  redis,
} from './redis-cache';
import { logger } from '@/lib/logger';
import { apiResponseCache, userProfileCache } from './bounded-cache';

/**
 * Client data categories for selective invalidation.
 */
export type ClientDataCategory =
  | 'dashboard'
  | 'seo'
  | 'articles'
  | 'analytics'
  | 'settings'
  | 'connections'
  | 'changes'
  | 'reports'
  | 'alerts'
  | 'voice';

/**
 * Path patterns for Next.js revalidation by category.
 */
const CATEGORY_PATHS: Record<ClientDataCategory, string[]> = {
  dashboard: ['/clients/[clientId]'],
  seo: [
    '/clients/[clientId]/seo',
    '/clients/[clientId]/seo/keywords',
    '/clients/[clientId]/seo/backlinks',
    '/clients/[clientId]/seo/audit',
  ],
  articles: [
    '/clients/[clientId]/articles',
    '/clients/[clientId]/calendar',
  ],
  analytics: ['/clients/[clientId]/analytics'],
  settings: ['/clients/[clientId]/settings'],
  connections: ['/clients/[clientId]/connections'],
  changes: ['/clients/[clientId]/changes'],
  reports: ['/clients/[clientId]/reports'],
  alerts: ['/clients/[clientId]/alerts'],
  voice: ['/clients/[clientId]/voice'],
};

/**
 * Redis cache patterns by category.
 */
const CATEGORY_REDIS_PATTERNS: Record<ClientDataCategory, string[]> = {
  dashboard: ['dashboard:*', 'sparkline:*', 'goals:*'],
  seo: ['seo:*', 'keywords:*', 'backlinks:*', 'audit:*'],
  articles: ['articles:*', 'calendar:*'],
  analytics: ['analytics:*', 'predictions:*', 'opportunities:*'],
  settings: ['settings:*', 'publishing:*'],
  connections: ['connections:*', 'oauth:*'],
  changes: ['changes:*', 'reverts:*'],
  reports: ['reports:*'],
  alerts: ['alerts:*'],
  voice: ['voice:*'],
};

/**
 * DFI-007 FIX: Invalidate both Next.js and Redis caches for a client.
 *
 * @param clientId - The client ID to invalidate caches for
 * @param categories - Optional specific categories to invalidate. If not provided, invalidates all.
 */
export async function invalidateClientData(
  clientId: string,
  categories?: ClientDataCategory[]
): Promise<void> {
  const targetCategories = categories ?? (Object.keys(CATEGORY_PATHS) as ClientDataCategory[]);

  logger.info('[unified-invalidation] Invalidating client data', {
    clientId,
    categories: targetCategories,
  });

  // 1. Invalidate Redis cache (by tag and patterns)
  try {
    // Invalidate by client tag (catches all client-tagged entries)
    await cacheInvalidateByTag(cacheTags.client(clientId));

    // Invalidate category-specific patterns
    for (const category of targetCategories) {
      const patterns = CATEGORY_REDIS_PATTERNS[category];
      for (const pattern of patterns) {
        await cacheInvalidatePattern(`*:${clientId}:${pattern}`);
      }
    }

    logger.debug('[unified-invalidation] Redis cache invalidated', { clientId });
  } catch (error) {
    logger.error('[unified-invalidation] Redis invalidation failed', {
      clientId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue with Next.js invalidation even if Redis fails
  }

  // 2. Invalidate Next.js cache (revalidatePath for each category)
  try {
    for (const category of targetCategories) {
      const paths = CATEGORY_PATHS[category];
      for (const path of paths) {
        // Replace [clientId] placeholder with actual clientId
        const resolvedPath = path.replace('[clientId]', clientId);
        revalidatePath(resolvedPath, 'page');
      }
    }

    logger.debug('[unified-invalidation] Next.js cache invalidated', { clientId });
  } catch (error) {
    logger.error('[unified-invalidation] Next.js invalidation failed', {
      clientId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * DFI-007 FIX: Invalidate workspace-level caches.
 *
 * @param workspaceId - The workspace ID to invalidate caches for
 */
export async function invalidateWorkspaceData(workspaceId: string): Promise<void> {
  logger.info('[unified-invalidation] Invalidating workspace data', { workspaceId });

  try {
    // Invalidate Redis
    await cacheInvalidatePattern(`*:workspace:${workspaceId}:*`);
    await cacheInvalidatePattern(`portfolio:*:${workspaceId}`);
    await cacheInvalidatePattern(`clients:paginated:${workspaceId}:*`);

    // Invalidate Next.js
    revalidatePath('/dashboard', 'page');
    revalidatePath('/clients', 'page');
    revalidatePath('/reports', 'page');

    logger.debug('[unified-invalidation] Workspace cache invalidated', { workspaceId });
  } catch (error) {
    logger.error('[unified-invalidation] Workspace invalidation failed', {
      workspaceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * DFI-012 FIX: Mark cached data as stale after background refresh failure.
 *
 * This is called when a background refresh job fails. Instead of serving
 * potentially outdated data silently, we mark it as stale so the UI can
 * show a warning to the user.
 *
 * @param cacheKey - The Redis cache key to mark as stale
 */
export async function markCacheAsStale(cacheKey: string): Promise<void> {
  try {
    // Import redis client directly for this operation
    const { redis } = await import('@/lib/redis/client');

    // Get current cached value
    const currentValue = await redis.get(cacheKey);
    if (!currentValue) {
      return; // Nothing to mark as stale
    }

    // Parse and add stale marker
    const parsed = JSON.parse(currentValue);
    const staleData = {
      ...parsed,
      _stale: true,
      _staleAt: new Date().toISOString(),
      _staleReason: 'background_refresh_failed',
    };

    // Get remaining TTL and update with stale marker
    const ttl = await redis.ttl(cacheKey);
    if (ttl > 0) {
      await redis.setex(cacheKey, ttl, JSON.stringify(staleData));
    }

    logger.warn('[unified-invalidation] Marked cache as stale', {
      cacheKey,
      ttl,
    });
  } catch (error) {
    logger.error('[unified-invalidation] Failed to mark cache as stale', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * DFI-012 FIX: Check if cached data is marked as stale.
 *
 * @param data - The cached data object
 * @returns true if data is marked as stale
 */
export function isCacheStale(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  return '_stale' in data && (data as Record<string, unknown>)._stale === true;
}

/**
 * DFI-012 FIX: Get stale info from cached data.
 *
 * @param data - The cached data object
 * @returns Stale info or null if not stale
 */
export function getStaleInfo(data: unknown): { staleAt: string; reason: string } | null {
  if (!isCacheStale(data)) {
    return null;
  }
  const record = data as Record<string, unknown>;
  return {
    staleAt: (record._staleAt as string) ?? 'unknown',
    reason: (record._staleReason as string) ?? 'unknown',
  };
}

// ============================================================================
// CRIT-CACHE-01 FIX: Cross-Instance Pub/Sub Invalidation
// ============================================================================

/** Channel for cache invalidation messages */
const INVALIDATION_CHANNEL = 'tevero:cache:invalidate';

/** Unique instance identifier */
const INSTANCE_ID = process.env.INSTANCE_ID ?? `web-${Math.random().toString(36).slice(2, 10)}`;

export interface InvalidationMessage {
  keys: string[];
  patterns: string[];
  source: string;
  timestamp: number;
  reason?: string;
}

let subscriberRedis: typeof redis | null = null;
let isSubscribed = false;

/**
 * CRIT-CACHE-01 FIX: Publish cache invalidation to all instances.
 * Call this after invalidating Redis cache to notify other instances
 * to clear their in-memory caches.
 *
 * @param keys - Exact cache keys to invalidate
 * @param patterns - Glob patterns to match
 * @param reason - Optional reason for debugging
 */
export async function publishInvalidation(
  keys: string[] = [],
  patterns: string[] = [],
  reason?: string
): Promise<void> {
  if (keys.length === 0 && patterns.length === 0) return;

  const message: InvalidationMessage = {
    keys,
    patterns,
    source: INSTANCE_ID,
    timestamp: Date.now(),
    reason,
  };

  try {
    await redis.publish(INVALIDATION_CHANNEL, JSON.stringify(message));
    logger.debug('[unified-invalidation] Published invalidation', {
      keys: keys.length,
      patterns: patterns.length,
      reason,
    });
  } catch (error) {
    logger.warn('[unified-invalidation] Failed to publish invalidation', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Process an invalidation message by clearing local in-memory caches.
 */
function processInvalidationMessage(message: InvalidationMessage): void {
  // Skip messages from self
  if (message.source === INSTANCE_ID) return;

  let cleared = 0;

  // Clear matching entries from bounded caches
  for (const pattern of message.patterns) {
    cleared += apiResponseCache.clearPattern(pattern);
    cleared += userProfileCache.clearPattern(pattern);
  }

  // For exact keys, we can't easily clear from bounded caches without iterating
  // But we can clear the whole cache if many keys are invalidated
  if (message.keys.length > 50) {
    apiResponseCache.clear();
    userProfileCache.clear();
    cleared += message.keys.length;
  }

  logger.debug('[unified-invalidation] Processed invalidation', {
    keys: message.keys.length,
    patterns: message.patterns.length,
    cleared,
    source: message.source,
    latencyMs: Date.now() - message.timestamp,
  });
}

/**
 * Start the invalidation subscriber.
 * Call this at application startup (e.g., in instrumentation.ts).
 */
export async function startInvalidationSubscriber(): Promise<void> {
  if (isSubscribed) return;

  try {
    // Create a duplicate connection for subscribing
    subscriberRedis = redis.duplicate();

    await subscriberRedis.subscribe(INVALIDATION_CHANNEL);
    isSubscribed = true;

    subscriberRedis.on('message', (channel: string, data: string) => {
      if (channel !== INVALIDATION_CHANNEL) return;

      try {
        const message = JSON.parse(data) as InvalidationMessage;
        processInvalidationMessage(message);
      } catch (error) {
        logger.error('[unified-invalidation] Failed to parse message', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    logger.info('[unified-invalidation] Subscriber started', { instanceId: INSTANCE_ID });
  } catch (error) {
    logger.error('[unified-invalidation] Failed to start subscriber', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Stop the invalidation subscriber.
 * Call this during graceful shutdown.
 */
export async function stopInvalidationSubscriber(): Promise<void> {
  if (!isSubscribed || !subscriberRedis) return;

  try {
    await subscriberRedis.unsubscribe(INVALIDATION_CHANNEL);
    await subscriberRedis.quit();
    subscriberRedis = null;
    isSubscribed = false;
    logger.info('[unified-invalidation] Subscriber stopped');
  } catch (error) {
    logger.warn('[unified-invalidation] Error stopping subscriber', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if subscriber is active.
 */
export function isSubscriberActive(): boolean {
  return isSubscribed;
}

/**
 * Get the instance ID.
 */
export function getInstanceId(): string {
  return INSTANCE_ID;
}

// ============================================================================
// HIGH-CACHE-01 FIX: Workspace Transfer Invalidation
// ============================================================================

/**
 * HIGH-CACHE-01 FIX: Invalidate all caches when workspace ownership changes.
 * Call this when a client is transferred between workspaces.
 *
 * @param clientId - The client being transferred
 * @param fromWorkspaceId - Original workspace
 * @param toWorkspaceId - New workspace
 */
export async function invalidateWorkspaceTransfer(
  clientId: string,
  fromWorkspaceId: string,
  toWorkspaceId: string
): Promise<void> {
  logger.info('[unified-invalidation] Workspace transfer', {
    clientId,
    fromWorkspaceId,
    toWorkspaceId,
  });

  // Invalidate all client data
  await invalidateClientData(clientId);

  // Invalidate both workspaces
  await invalidateWorkspaceData(fromWorkspaceId);
  await invalidateWorkspaceData(toWorkspaceId);

  // Publish to other instances
  await publishInvalidation(
    [],
    [
      `*:${clientId}:*`,
      `*:workspace:${fromWorkspaceId}:*`,
      `*:workspace:${toWorkspaceId}:*`,
    ],
    'workspace_transfer'
  );
}
