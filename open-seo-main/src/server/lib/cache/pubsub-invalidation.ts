/**
 * Redis Pub/Sub Cache Invalidation
 *
 * CRIT-CACHE-01 FIX: Cross-instance L1 cache invalidation.
 *
 * Problem: In multi-instance deployments, each instance maintains its own
 * in-memory L1 cache. When one instance invalidates L2 (Redis), other
 * instances continue serving stale L1 data for up to 1 hour.
 *
 * Solution: Use Redis Pub/Sub to broadcast invalidation messages across
 * all instances. Each instance subscribes to the invalidation channel
 * and clears matching L1 entries when it receives a message.
 *
 * Architecture:
 * - Publisher: Called when L2 cache is updated/invalidated
 * - Subscriber: Listens for invalidation messages and clears L1
 * - Message format: { type: CacheType, keys: string[], patterns: string[], source: string, timestamp: number }
 *
 * UNIFIED CHANNEL: All services now use tevero:cache:invalidate.
 * This module handles type="serp" messages.
 *
 * Usage:
 *   // At startup
 *   await startInvalidationSubscriber();
 *
 *   // When invalidating cache
 *   await publishInvalidation(['osm:serp:client-123:*']);
 *
 *   // At shutdown
 *   await stopInvalidationSubscriber();
 */

import Redis from "ioredis";
import { createLogger } from "@/server/lib/logger";
import {
  UNIFIED_INVALIDATION_CHANNEL,
  generateInstanceId,
  type CacheType,
  type UnifiedInvalidationMessage,
} from "@tevero/shared-cache";

const log = createLogger({ module: "cache-pubsub" });

// ============================================================================
// Configuration
// ============================================================================

/**
 * Unified channel for all cache invalidation messages.
 * @deprecated Use UNIFIED_INVALIDATION_CHANNEL from @tevero/shared-cache
 */
export const INVALIDATION_CHANNEL = UNIFIED_INVALIDATION_CHANNEL;

/** Cache type for this module - handles SERP cache invalidation */
const CACHE_TYPE: CacheType = "serp";

/** Unique instance identifier for preventing self-processing */
const INSTANCE_ID = process.env.INSTANCE_ID ?? generateInstanceId("osm");

// ============================================================================
// Message Types
// ============================================================================

/**
 * Legacy message format for backwards compatibility.
 * @deprecated Use UnifiedInvalidationMessage from @tevero/shared-cache
 */
export interface InvalidationMessage {
  /** Cache keys to invalidate (exact match) */
  keys: string[];
  /** Glob patterns to match for invalidation */
  patterns: string[];
  /** Source instance ID (to avoid self-processing) */
  source: string;
  /** Timestamp for debugging */
  timestamp: number;
  /** Optional reason for debugging */
  reason?: string;
}

// Re-export unified types for callers migrating to new format
export type { UnifiedInvalidationMessage, CacheType } from "@tevero/shared-cache";

// ============================================================================
// Invalidation Handlers Registry
// ============================================================================

/**
 * Handler function type for processing invalidation messages.
 * Returns number of entries cleared.
 */
export type InvalidationHandler = (message: InvalidationMessage) => number;

const handlers: InvalidationHandler[] = [];

/**
 * Register a handler for cache invalidation messages.
 * Call this during module initialization for each L1 cache.
 *
 * @param handler - Function to call when invalidation message is received
 *
 * @example
 * ```ts
 * import { serpMemoryCache } from './serp-cache';
 * import { registerInvalidationHandler } from './pubsub-invalidation';
 *
 * registerInvalidationHandler((message) => {
 *   let cleared = 0;
 *   for (const key of message.keys) {
 *     if (serpMemoryCache.delete(key)) cleared++;
 *   }
 *   for (const pattern of message.patterns) {
 *     cleared += serpMemoryCache.clearPattern(pattern);
 *   }
 *   return cleared;
 * });
 * ```
 */
export function registerInvalidationHandler(handler: InvalidationHandler): void {
  handlers.push(handler);
  log.debug("Registered invalidation handler", { totalHandlers: handlers.length });
}

/**
 * Unregister all handlers. Mainly for testing.
 */
export function clearInvalidationHandlers(): void {
  handlers.length = 0;
}

// ============================================================================
// Publisher
// ============================================================================

let publisherRedis: Redis | null = null;

/**
 * Get or create the publisher Redis connection.
 * Uses a separate connection to avoid blocking the main client.
 */
function getPublisher(): Redis {
  if (!publisherRedis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    publisherRedis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: false,
    });

    publisherRedis.on("error", (err) => {
      log.error("Publisher Redis error", err);
    });

    publisherRedis.on("connect", () => {
      log.debug("Publisher Redis connected");
    });
  }
  return publisherRedis;
}

/**
 * Publish cache invalidation message to all instances.
 * Call this after updating or invalidating L2 (Redis) cache.
 *
 * @param keys - Exact cache keys to invalidate
 * @param patterns - Glob patterns to match (e.g., "osm:serp:client-123:*")
 * @param reason - Optional reason for debugging
 *
 * @example
 * ```ts
 * // After invalidating SERP cache
 * await invalidateSerpCache(key);
 * await publishInvalidation([key], [], 'keyword_updated');
 *
 * // After invalidating all client caches
 * await publishInvalidation([], [`osm:*:${clientId}:*`], 'client_deleted');
 * ```
 */
export async function publishInvalidation(
  keys: string[] = [],
  patterns: string[] = [],
  reason?: string
): Promise<void> {
  if (keys.length === 0 && patterns.length === 0) {
    return; // Nothing to invalidate
  }

  // Use unified message format with type field
  const message: UnifiedInvalidationMessage = {
    type: CACHE_TYPE,
    keys,
    patterns,
    source: INSTANCE_ID,
    timestamp: Date.now(),
    reason,
  };

  try {
    const publisher = getPublisher();
    const subscribers = await publisher.publish(UNIFIED_INVALIDATION_CHANNEL, JSON.stringify(message));
    log.debug("Published invalidation", {
      type: CACHE_TYPE,
      keys: keys.length,
      patterns: patterns.length,
      reason,
      subscribers,
    });
  } catch (error) {
    // Non-fatal: other instances will still get invalidation via TTL
    log.warn("Failed to publish invalidation", {
      error: error instanceof Error ? error.message : String(error),
      keys: keys.length,
      patterns: patterns.length,
    });
  }
}

// ============================================================================
// Subscriber
// ============================================================================

let subscriberRedis: Redis | null = null;
let isSubscribed = false;

/**
 * Process an invalidation message by calling all registered handlers.
 * Only processes messages with type="serp" (this module's domain).
 */
function processInvalidationMessage(message: UnifiedInvalidationMessage): void {
  // Skip messages from self
  if (message.source === INSTANCE_ID) {
    log.debug("Ignoring self-published invalidation", { timestamp: message.timestamp });
    return;
  }

  // Filter by cache type - only process SERP invalidations
  if (message.type !== CACHE_TYPE) {
    log.debug("Ignoring invalidation for different cache type", {
      messageType: message.type,
      ourType: CACHE_TYPE,
    });
    return;
  }

  let totalCleared = 0;
  for (const handler of handlers) {
    try {
      // Convert to legacy format for existing handlers
      const legacyMessage: InvalidationMessage = {
        keys: message.keys,
        patterns: message.patterns,
        source: message.source,
        timestamp: message.timestamp,
        reason: message.reason,
      };
      const cleared = handler(legacyMessage);
      totalCleared += cleared;
    } catch (error) {
      log.error("Invalidation handler threw error", error instanceof Error ? error : undefined);
    }
  }

  log.debug("Processed invalidation", {
    type: message.type,
    keys: message.keys.length,
    patterns: message.patterns.length,
    reason: message.reason,
    cleared: totalCleared,
    sourceInstance: message.source,
    latencyMs: Date.now() - message.timestamp,
  });
}

/**
 * Start the invalidation subscriber.
 * Call this at application startup.
 *
 * @returns Promise that resolves when subscribed
 */
export async function startInvalidationSubscriber(): Promise<void> {
  if (isSubscribed) {
    log.warn("Invalidation subscriber already started");
    return;
  }

  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  subscriberRedis = new Redis(url, {
    maxRetriesPerRequest: null, // Required for blocking subscribe
    retryStrategy: (times) => Math.min(times * 100, 3000),
    lazyConnect: false,
  });

  subscriberRedis.on("error", (err) => {
    log.error("Subscriber Redis error", err);
  });

  subscriberRedis.on("connect", () => {
    log.debug("Subscriber Redis connected");
  });

  // Subscribe to unified invalidation channel
  await subscriberRedis.subscribe(UNIFIED_INVALIDATION_CHANNEL);
  isSubscribed = true;

  // Handle incoming messages
  subscriberRedis.on("message", (channel, data) => {
    if (channel !== UNIFIED_INVALIDATION_CHANNEL) return;

    try {
      const message = JSON.parse(data) as UnifiedInvalidationMessage;
      processInvalidationMessage(message);
    } catch (error) {
      log.error("Failed to parse invalidation message", error instanceof Error ? error : undefined, { data });
    }
  });

  log.info("Cache invalidation subscriber started", {
    instanceId: INSTANCE_ID,
    channel: UNIFIED_INVALIDATION_CHANNEL,
    cacheType: CACHE_TYPE,
  });
}

/**
 * Stop the invalidation subscriber.
 * Call this during graceful shutdown.
 */
export async function stopInvalidationSubscriber(): Promise<void> {
  if (!isSubscribed || !subscriberRedis) {
    return;
  }

  try {
    await subscriberRedis.unsubscribe(UNIFIED_INVALIDATION_CHANNEL);
    await subscriberRedis.quit();
    subscriberRedis = null;
    isSubscribed = false;
    log.info("Cache invalidation subscriber stopped");
  } catch (error) {
    log.warn("Error stopping invalidation subscriber", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Close publisher connection.
 * Call this during graceful shutdown.
 */
export async function closePublisher(): Promise<void> {
  if (!publisherRedis) return;

  try {
    await publisherRedis.quit();
    publisherRedis = null;
    log.debug("Publisher Redis closed");
  } catch (error) {
    log.warn("Error closing publisher", {
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
// Cache Metrics
// ============================================================================

/** MED-CACHE-03 FIX: Cache hit/miss counters */
export interface CacheMetrics {
  hits: number;
  misses: number;
  invalidations: number;
  lastReset: number;
}

const metrics: Record<string, CacheMetrics> = {};

/**
 * Record a cache hit.
 * @param cacheName - Name of the cache (e.g., "serp", "keyword")
 */
export function recordCacheHit(cacheName: string): void {
  if (!metrics[cacheName]) {
    metrics[cacheName] = { hits: 0, misses: 0, invalidations: 0, lastReset: Date.now() };
  }
  metrics[cacheName].hits++;
}

/**
 * Record a cache miss.
 * @param cacheName - Name of the cache (e.g., "serp", "keyword")
 */
export function recordCacheMiss(cacheName: string): void {
  if (!metrics[cacheName]) {
    metrics[cacheName] = { hits: 0, misses: 0, invalidations: 0, lastReset: Date.now() };
  }
  metrics[cacheName].misses++;
}

/**
 * Record a cache invalidation.
 * @param cacheName - Name of the cache (e.g., "serp", "keyword")
 */
export function recordCacheInvalidation(cacheName: string): void {
  if (!metrics[cacheName]) {
    metrics[cacheName] = { hits: 0, misses: 0, invalidations: 0, lastReset: Date.now() };
  }
  metrics[cacheName].invalidations++;
}

/**
 * Get cache metrics for a specific cache.
 */
export function getCacheMetrics(cacheName: string): CacheMetrics | null {
  return metrics[cacheName] ?? null;
}

/**
 * Get all cache metrics.
 */
export function getAllCacheMetrics(): Record<string, CacheMetrics & { hitRate: number }> {
  const result: Record<string, CacheMetrics & { hitRate: number }> = {};
  for (const [name, m] of Object.entries(metrics)) {
    const total = m.hits + m.misses;
    result[name] = {
      ...m,
      hitRate: total > 0 ? m.hits / total : 0,
    };
  }
  return result;
}

/**
 * Reset metrics for a specific cache or all caches.
 */
export function resetCacheMetrics(cacheName?: string): void {
  if (cacheName) {
    delete metrics[cacheName];
  } else {
    Object.keys(metrics).forEach((key) => delete metrics[key]);
  }
}
