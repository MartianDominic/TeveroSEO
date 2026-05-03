/**
 * Redis Pub/Sub utilities with error handling.
 * Uses separate connections for publisher and subscriber (Redis requirement).
 */

import Redis from "ioredis";

import { logger } from '@/lib/logger';
// Global singletons for hot reload safety
const globalForPubSub = globalThis as unknown as {
  subscriber: Redis | undefined;
  publisher: Redis | undefined;
};

function createPubSubClient(role: "subscriber" | "publisher"): Redis {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing required environment variable: REDIS_URL. " +
        "Set it in .env or the deployment environment before starting."
    );
  }

  const redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error(`[redis-pubsub] ${role}: Max retries reached`);
        return null;
      }
      return Math.min(times * 50, 2000);
    },
    lazyConnect: true,
  });

  redis.on("error", (err) => {
    logger.error(`[redis-pubsub] ${role} error`, { error: err.message });
  });

  redis.on("connect", () => {
    logger.info(`[redis-pubsub] ${role}: Connected`);
  });

  return redis;
}

// Separate connections for pub/sub (Redis requires this)
const subscriber = globalForPubSub.subscriber ?? createPubSubClient("subscriber");
const publisher = globalForPubSub.publisher ?? createPubSubClient("publisher");

if (process.env.NODE_ENV !== "production") {
  globalForPubSub.subscriber = subscriber;
  globalForPubSub.publisher = publisher;
}

// Message handler type
type MessageHandler = (message: string, channel: string) => void | Promise<void>;

// Channel handlers registry
const handlers = new Map<string, Set<MessageHandler>>();

// Track subscribed channels
const subscribedChannels = new Set<string>();

// Set up message listener once
let messageListenerAttached = false;

function ensureMessageListener(): void {
  if (messageListenerAttached) return;

  subscriber.on("message", async (channel, message) => {
    const channelHandlers = handlers.get(channel);
    if (!channelHandlers) return;

    for (const handler of channelHandlers) {
      try {
        await handler(message, channel);
      } catch (error) {
        logger.error(`[redis-pubsub] Handler error on ${channel}`, error instanceof Error ? error : { error: String(error) });
        // Continue with other handlers even if one fails
      }
    }
  });

  messageListenerAttached = true;
}

/**
 * Subscribe to a channel with a message handler.
 * Multiple handlers can be registered for the same channel.
 *
 * @param channel - Channel name to subscribe to
 * @param handler - Function to call when messages arrive
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = await subscribe('cache-invalidation', (message, channel) => {
 *   logger.debug(`Received on ${channel}: ${message}`);
 *   invalidateLocalCache(message);
 * });
 *
 * // Later, to unsubscribe:
 * await unsubscribe();
 * ```
 */
export async function subscribe(
  channel: string,
  handler: MessageHandler
): Promise<() => Promise<void>> {
  ensureMessageListener();

  // Initialize handlers set for this channel if needed
  if (!handlers.has(channel)) {
    handlers.set(channel, new Set());
  }

  // Add handler - use safe access instead of non-null assertion
  const channelHandlers = handlers.get(channel);
  if (channelHandlers) {
    channelHandlers.add(handler);
  }

  // Subscribe to Redis channel if not already subscribed
  if (!subscribedChannels.has(channel)) {
    try {
      await subscriber.subscribe(channel);
      subscribedChannels.add(channel);
      logger.info(`[redis-pubsub] Subscribed to ${channel}`);
    } catch (error) {
      logger.error(`[redis-pubsub] Subscribe error for ${channel}`, error instanceof Error ? error : { error: String(error) });
      // Safe access on error path as well
      const handlersOnError = handlers.get(channel);
      if (handlersOnError) {
        handlersOnError.delete(handler);
      }
      throw error;
    }
  }

  // Return unsubscribe function
  return async () => {
    await unsubscribe(channel, handler);
  };
}

/**
 * Unsubscribe a handler from a channel.
 * If no handlers remain, unsubscribes from the Redis channel.
 */
export async function unsubscribe(channel: string, handler: MessageHandler): Promise<void> {
  const channelHandlers = handlers.get(channel);
  if (!channelHandlers) return;

  channelHandlers.delete(handler);

  // If no more handlers, unsubscribe from Redis
  if (channelHandlers.size === 0) {
    handlers.delete(channel);
    subscribedChannels.delete(channel);

    try {
      await subscriber.unsubscribe(channel);
      logger.info(`[redis-pubsub] Unsubscribed from ${channel}`);
    } catch (error) {
      logger.error(`[redis-pubsub] Unsubscribe error for ${channel}`, error instanceof Error ? error : { error: String(error) });
    }
  }
}

/**
 * Publish a message to a channel.
 *
 * @param channel - Channel to publish to
 * @param message - Message string (typically JSON-serialized)
 * @returns Number of subscribers that received the message
 */
export async function publish(channel: string, message: string): Promise<number> {
  try {
    const subscriberCount = await publisher.publish(channel, message);
    return subscriberCount;
  } catch (error) {
    logger.error(`[redis-pubsub] Publish error for ${channel}`, error instanceof Error ? error : { error: String(error) });
    throw error;
  }
}

/**
 * Publish a typed message (JSON-serialized).
 */
export async function publishTyped<T>(channel: string, data: T): Promise<number> {
  return publish(channel, JSON.stringify(data));
}

/**
 * Get subscription stats for monitoring.
 */
export function getPubSubStats(): {
  subscribedChannels: string[];
  totalHandlers: number;
} {
  let totalHandlers = 0;
  handlers.forEach((h) => {
    totalHandlers += h.size;
  });

  return {
    subscribedChannels: Array.from(subscribedChannels),
    totalHandlers,
  };
}

/**
 * Close pub/sub connections gracefully.
 */
export async function closePubSub(): Promise<void> {
  try {
    // Unsubscribe from all channels
    if (subscribedChannels.size > 0) {
      await subscriber.unsubscribe(...subscribedChannels);
      subscribedChannels.clear();
      handlers.clear();
    }

    // Disconnect both clients
    if (subscriber.status === "ready" || subscriber.status === "connect") {
      await subscriber.quit();
    }
    if (publisher.status === "ready" || publisher.status === "connect") {
      await publisher.quit();
    }

    logger.info("[redis-pubsub] Connections closed");
  } catch (error) {
    logger.error("[redis-pubsub] Error during shutdown", error instanceof Error ? error : { error: String(error) });
  }
}

// Common channels for cache invalidation
export const channels = {
  cacheInvalidation: "tevero:cache:invalidation",
  clientUpdated: (clientId: string) => `tevero:client:${clientId}:updated`,
  workspaceUpdated: (workspaceId: string) => `tevero:workspace:${workspaceId}:updated`,
};
