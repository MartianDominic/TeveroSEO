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
 * UNIFIED CHANNEL: All services now use tevero:cache:invalidate.
 * This module handles type="analytics" messages.
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
import {
  UNIFIED_INVALIDATION_CHANNEL,
  generateInstanceId,
  type CacheType,
  type UnifiedInvalidationMessage,
} from '@tevero/shared-cache';

const log = createLogger({ module: 'cache-invalidation' });

// =============================================================================
// Configuration
// =============================================================================

/**
 * Unified channel for all cache invalidation messages.
 * @deprecated Use UNIFIED_INVALIDATION_CHANNEL from @tevero/shared-cache
 */
const INVALIDATION_CHANNEL = UNIFIED_INVALIDATION_CHANNEL;

/** Cache type for this module - handles analytics cache invalidation */
const CACHE_TYPE: CacheType = 'analytics';

/** Unique instance identifier for preventing self-processing */
const INSTANCE_ID = process.env.INSTANCE_ID ?? generateInstanceId('osm-analytics');

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
  // Build cache key patterns for this workspace/site
  const patterns: string[] = siteId === 'all'
    ? [`analytics:${workspaceId}:*`]
    : [`analytics:${workspaceId}:${siteId}:*`];

  // Use unified message format
  const message: UnifiedInvalidationMessage = {
    type: CACHE_TYPE,
    keys: [],
    patterns,
    source: INSTANCE_ID,
    timestamp: Date.now(),
    reason,
    workspaceId,
    siteId,
    analyticsCacheTypes: types,
  };

  try {
    const publisher = getPublisher();
    const subscribers = await publisher.publish(
      UNIFIED_INVALIDATION_CHANNEL,
      JSON.stringify(message)
    );

    log.info('Cache invalidation published', {
      type: CACHE_TYPE,
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
 * Process a unified invalidation message.
 * Only processes messages with type="analytics".
 */
async function processInvalidationMessage(message: UnifiedInvalidationMessage): Promise<void> {
  // Skip messages from self
  if (message.source === INSTANCE_ID) {
    log.debug('Ignoring self-published invalidation', { timestamp: message.timestamp });
    return;
  }

  // Filter by cache type - only process analytics invalidations
  if (message.type !== CACHE_TYPE) {
    log.debug('Ignoring invalidation for different cache type', {
      messageType: message.type,
      ourType: CACHE_TYPE,
    });
    return;
  }

  const startTime = Date.now();

  try {
    // Convert unified message to legacy event format for existing handlers
    const event: CacheInvalidationEvent = {
      workspaceId: message.workspaceId ?? '',
      siteId: message.siteId ?? 'all',
      types: message.analyticsCacheTypes as AnalyticsCacheType[] | undefined,
      reason: (message.reason as InvalidationReason) ?? 'admin_action',
      timestamp: new Date(message.timestamp).toISOString(),
      sourceInstance: message.source,
    };

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
      type: message.type,
      workspaceId: event.workspaceId,
      siteId: event.siteId,
      reason: event.reason,
      latencyMs,
      sourceInstance: event.sourceInstance,
    });
  } catch (error) {
    log.error('Failed to process invalidation event', error instanceof Error ? error : undefined, {
      message,
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

  // Subscribe to unified invalidation channel
  await subscriberRedis.subscribe(UNIFIED_INVALIDATION_CHANNEL);
  isSubscribed = true;

  // Handle incoming messages
  subscriberRedis.on('message', (channel, data) => {
    if (channel !== UNIFIED_INVALIDATION_CHANNEL) return;

    try {
      const message = JSON.parse(data) as UnifiedInvalidationMessage;
      // Process asynchronously to avoid blocking the message handler
      processInvalidationMessage(message).catch((error) => {
        log.error('Invalidation processing error', error instanceof Error ? error : undefined);
      });
    } catch (error) {
      log.warn('Failed to parse invalidation message', {
        error: error instanceof Error ? error.message : String(error),
        data,
      });
    }
  });

  log.info('Subscribed to cache invalidation events', {
    instanceId: INSTANCE_ID,
    channel: UNIFIED_INVALIDATION_CHANNEL,
    cacheType: CACHE_TYPE,
  });
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
    await subscriberRedis.unsubscribe(UNIFIED_INVALIDATION_CHANNEL);
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

/**
 * @deprecated Use UNIFIED_INVALIDATION_CHANNEL from @tevero/shared-cache
 */
export { INVALIDATION_CHANNEL, INSTANCE_ID };

// Re-export unified types for callers migrating to new format
export { UNIFIED_INVALIDATION_CHANNEL } from '@tevero/shared-cache';
export type { UnifiedInvalidationMessage, CacheType } from '@tevero/shared-cache';
