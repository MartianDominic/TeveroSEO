/**
 * Analytics Cache Invalidation Service
 * DATA-05 FIX: Coordinated cache invalidation across services
 *
 * Implements Redis pub/sub for cross-service cache invalidation:
 * - When GSC sync completes, publishes invalidation event
 * - All services subscribe to invalidation events
 * - Relevant cache keys are cleared on invalidation
 *
 * This ensures data consistency when:
 * - GSC sync job completes with new data
 * - User manually triggers a refresh
 * - Data is updated via admin actions
 * - AI-Writer syncs new client data
 *
 * Usage:
 * ```ts
 * // After GSC sync completes in worker
 * await publishCacheInvalidation(workspaceId, siteId, 'gsc_sync_complete');
 *
 * // At app startup
 * await subscribeToCacheInvalidations();
 *
 * // At shutdown
 * await unsubscribeFromCacheInvalidations();
 * ```
 */

import Redis from 'ioredis';
import { getAnalyticsCache } from './analytics-cache';
import { createLogger } from '@/server/lib/logger';
import type { AnalyticsCacheType } from './analytics-cache';

const log = createLogger({ module: 'cache-invalidation' });

// =============================================================================
// Configuration
// =============================================================================

/** Redis channel for analytics cache invalidation events */
const INVALIDATION_CHANNEL = 'analytics:cache:invalidate';

/** Unique instance identifier for preventing self-processing */
const INSTANCE_ID = process.env.INSTANCE_ID ?? `osm-${crypto.randomUUID().substring(0, 8)}`;

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Cache invalidation event structure.
 * Published via Redis pub/sub when cache needs to be cleared.
 */
export interface CacheInvalidationEvent {
  /** Workspace UUID */
  workspaceId: string;
  /** Site UUID (or 'all' for workspace-level invalidation) */
  siteId: string;
  /** Specific cache types to invalidate (undefined = all) */
  types?: AnalyticsCacheType[];
  /** Reason for invalidation (for logging/debugging) */
  reason: InvalidationReason;
  /** ISO timestamp when event was published */
  timestamp: string;
  /** Source instance ID (to optionally skip self-processing) */
  sourceInstance: string;
}

/**
 * Reasons for cache invalidation.
 */
export type InvalidationReason =
  | 'gsc_sync_complete'
  | 'ga4_sync_complete'
  | 'manual_refresh'
  | 'data_update'
  | 'site_connection_changed'
  | 'client_settings_changed'
  | 'admin_action';

/**
 * Handler function type for processing invalidation events.
 */
export type InvalidationHandler = (event: CacheInvalidationEvent) => Promise<void>;

// =============================================================================
// Publisher
// =============================================================================

let publisherRedis: Redis | null = null;

/**
 * Get or create the publisher Redis connection.
 * Uses a separate connection to avoid blocking the main client.
 */
function getPublisher(): Redis {
  if (!publisherRedis) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    publisherRedis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: false,
    });

    publisherRedis.on('error', (err) => {
      log.error('Publisher Redis error', err);
    });

    publisherRedis.on('connect', () => {
      log.debug('Publisher Redis connected');
    });
  }
  return publisherRedis;
}

/**
 * Publish a cache invalidation event.
 * Call this after syncing new data or when data changes.
 *
 * @param workspaceId - Workspace UUID
 * @param siteId - Site UUID (use 'all' for workspace-level)
 * @param reason - Reason for invalidation
 * @param types - Specific cache types (undefined = all)
 */
export async function publishCacheInvalidation(
  workspaceId: string,
  siteId: string,
  reason: InvalidationReason,
  types?: AnalyticsCacheType[]
): Promise<void> {
  const event: CacheInvalidationEvent = {
    workspaceId,
    siteId,
    types,
    reason,
    timestamp: new Date().toISOString(),
    sourceInstance: INSTANCE_ID,
  };

  try {
    const publisher = getPublisher();
    const subscribers = await publisher.publish(
      INVALIDATION_CHANNEL,
      JSON.stringify(event)
    );

    log.info('Cache invalidation published', {
      workspaceId,
      siteId,
      reason,
      types: types ?? 'all',
      subscribers,
    });
  } catch (error) {
    // Non-fatal: cache will naturally expire via TTL
    log.warn('Failed to publish cache invalidation', {
      workspaceId,
      siteId,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// =============================================================================
// Subscriber
// =============================================================================

let subscriberRedis: Redis | null = null;
let isSubscribed = false;
const customHandlers: InvalidationHandler[] = [];

/**
 * Default handler that invalidates the analytics cache.
 */
async function defaultInvalidationHandler(event: CacheInvalidationEvent): Promise<void> {
  const cache = getAnalyticsCache();

  if (event.siteId === 'all') {
    await cache.invalidateAll(event.workspaceId);
  } else {
    await cache.invalidate(event.workspaceId, event.siteId, event.types);
  }
}

/**
 * Process an invalidation event.
 */
async function processInvalidationEvent(event: CacheInvalidationEvent): Promise<void> {
  const startTime = Date.now();

  try {
    // Run default handler
    await defaultInvalidationHandler(event);

    // Run any custom handlers
    for (const handler of customHandlers) {
      try {
        await handler(event);
      } catch (error) {
        log.warn('Custom invalidation handler failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const latencyMs = Date.now() - startTime;
    log.debug('Invalidation event processed', {
      workspaceId: event.workspaceId,
      siteId: event.siteId,
      reason: event.reason,
      latencyMs,
      sourceInstance: event.sourceInstance,
    });
  } catch (error) {
    log.error('Failed to process invalidation event', error instanceof Error ? error : undefined, {
      event,
    });
  }
}

/**
 * Subscribe to cache invalidation events.
 * Call this at application startup.
 *
 * @returns Promise that resolves when subscribed
 */
export async function subscribeToCacheInvalidations(): Promise<void> {
  if (isSubscribed) {
    log.warn('Already subscribed to cache invalidations');
    return;
  }

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  subscriberRedis = new Redis(url, {
    maxRetriesPerRequest: null, // Required for blocking subscribe
    retryStrategy: (times) => Math.min(times * 100, 3000),
    lazyConnect: false,
  });

  subscriberRedis.on('error', (err) => {
    log.error('Subscriber Redis error', err);
  });

  subscriberRedis.on('connect', () => {
    log.debug('Subscriber Redis connected');
  });

  // Subscribe to invalidation channel
  await subscriberRedis.subscribe(INVALIDATION_CHANNEL);
  isSubscribed = true;

  // Handle incoming messages
  subscriberRedis.on('message', (channel, data) => {
    if (channel !== INVALIDATION_CHANNEL) return;

    try {
      const event = JSON.parse(data) as CacheInvalidationEvent;
      // Process asynchronously to avoid blocking the message handler
      processInvalidationEvent(event).catch((error) => {
        log.error('Invalidation processing error', error instanceof Error ? error : undefined);
      });
    } catch (error) {
      log.warn('Failed to parse invalidation message', {
        error: error instanceof Error ? error.message : String(error),
        data,
      });
    }
  });

  log.info('Subscribed to cache invalidation events', { instanceId: INSTANCE_ID });
}

/**
 * Unsubscribe from cache invalidation events.
 * Call this during graceful shutdown.
 */
export async function unsubscribeFromCacheInvalidations(): Promise<void> {
  if (!isSubscribed || !subscriberRedis) {
    return;
  }

  try {
    await subscriberRedis.unsubscribe(INVALIDATION_CHANNEL);
    await subscriberRedis.quit();
    subscriberRedis = null;
    isSubscribed = false;
    log.info('Unsubscribed from cache invalidation events');
  } catch (error) {
    log.warn('Error unsubscribing from cache invalidations', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Close publisher connection.
 * Call this during graceful shutdown.
 */
export async function closeInvalidationPublisher(): Promise<void> {
  if (!publisherRedis) return;

  try {
    await publisherRedis.quit();
    publisherRedis = null;
    log.debug('Invalidation publisher closed');
  } catch (error) {
    log.warn('Error closing invalidation publisher', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Register a custom invalidation handler.
 * Called in addition to the default analytics cache invalidation.
 *
 * @param handler - Custom handler function
 */
export function registerInvalidationHandler(handler: InvalidationHandler): void {
  customHandlers.push(handler);
  log.debug('Custom invalidation handler registered', {
    totalHandlers: customHandlers.length,
  });
}

/**
 * Clear all custom handlers (for testing).
 */
export function clearInvalidationHandlers(): void {
  customHandlers.length = 0;
}

/**
 * Check if subscriber is active.
 */
export function isInvalidationSubscriberActive(): boolean {
  return isSubscribed;
}

/**
 * Get the instance ID.
 */
export function getInvalidationInstanceId(): string {
  return INSTANCE_ID;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Invalidate cache for a site after GSC sync.
 * Shorthand for publishCacheInvalidation with gsc_sync_complete reason.
 *
 * @param workspaceId - Workspace UUID
 * @param siteId - Site UUID
 */
export async function invalidateAfterGscSync(
  workspaceId: string,
  siteId: string
): Promise<void> {
  await publishCacheInvalidation(workspaceId, siteId, 'gsc_sync_complete');
}

/**
 * Invalidate cache for a site after GA4 sync.
 *
 * @param workspaceId - Workspace UUID
 * @param siteId - Site UUID
 */
export async function invalidateAfterGa4Sync(
  workspaceId: string,
  siteId: string
): Promise<void> {
  await publishCacheInvalidation(workspaceId, siteId, 'ga4_sync_complete');
}

/**
 * Invalidate all caches for a workspace.
 * Use when site connections or settings change.
 *
 * @param workspaceId - Workspace UUID
 * @param reason - Reason for invalidation
 */
export async function invalidateWorkspaceCache(
  workspaceId: string,
  reason: InvalidationReason = 'admin_action'
): Promise<void> {
  await publishCacheInvalidation(workspaceId, 'all', reason);
}

// =============================================================================
// Exports
// =============================================================================

export { INVALIDATION_CHANNEL, INSTANCE_ID };
