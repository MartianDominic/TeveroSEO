/**
 * Connection and message rate limiting for WebSocket connections.
 *
 * SECURITY: Limits per-user connections and message rates to prevent DoS.
 */

import { createLogger } from "@/server/lib/logger";
import { redis } from "@/server/lib/redis";
import type { ActivityEvent } from "./types";

const log = createLogger({ module: "connection-manager" });

/**
 * Maximum connections allowed per authenticated user.
 */
const USER_CONNECTION_LIMIT = 5;

/**
 * Message rate limit: 100 messages per minute per user.
 */
const MESSAGE_LIMIT = 100;
const MESSAGE_WINDOW_MS = 60000;

/**
 * Event buffer for catch-up mechanism.
 * Stores last N events per workspace for reconnecting clients.
 */
const EVENT_BUFFER_SIZE = 100;
const EVENT_BUFFER_TTL = 300; // 5 minutes

// In-memory tracking for user connections (socketId -> userId)
const socketToUser = new Map<string, string>();
// userId -> Set<socketId>
const userConnections = new Map<string, Set<string>>();

// In-memory message counters: userId -> { count, resetAt }
const messageCounters = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if a user can open a new connection.
 * Returns true if under the limit, false if at capacity.
 */
export function canConnect(userId: string): boolean {
  const connections = userConnections.get(userId);
  const currentCount = connections?.size ?? 0;

  if (currentCount >= USER_CONNECTION_LIMIT) {
    log.warn("User at connection limit", {
      userId,
      currentConnections: currentCount,
      limit: USER_CONNECTION_LIMIT,
    });
    return false;
  }

  return true;
}

/**
 * Register a new connection for a user.
 */
export function addConnection(userId: string, socketId: string): void {
  // Track socket -> user mapping
  socketToUser.set(socketId, userId);

  // Track user -> sockets mapping
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(socketId);

  log.debug("Connection added", {
    userId,
    socketId,
    totalConnections: userConnections.get(userId)!.size,
  });
}

/**
 * Remove a connection when socket disconnects.
 */
export function removeConnection(socketId: string): void {
  const userId = socketToUser.get(socketId);
  if (!userId) return;

  socketToUser.delete(socketId);

  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(socketId);
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }

  log.debug("Connection removed", {
    userId,
    socketId,
    remainingConnections: userConnections.get(userId)?.size ?? 0,
  });
}

/**
 * Get current connection count for a user.
 */
export function getUserConnectionCount(userId: string): number {
  return userConnections.get(userId)?.size ?? 0;
}

/**
 * Check if a user is within their message rate limit.
 * Returns true if message is allowed, false if rate limited.
 */
export function checkMessageLimit(userId: string): boolean {
  const now = Date.now();
  const counter = messageCounters.get(userId);

  // First message or window expired - reset counter
  if (!counter || now > counter.resetAt) {
    messageCounters.set(userId, { count: 1, resetAt: now + MESSAGE_WINDOW_MS });
    return true;
  }

  // At limit - reject
  if (counter.count >= MESSAGE_LIMIT) {
    log.warn("User message rate limit exceeded", {
      userId,
      count: counter.count,
      limit: MESSAGE_LIMIT,
      windowMs: MESSAGE_WINDOW_MS,
    });
    return false;
  }

  // Under limit - increment and allow
  counter.count++;
  return true;
}

/**
 * Store an event for catch-up on reconnect.
 * Uses Redis sorted set with timestamp as score.
 */
export async function bufferEvent(
  workspaceId: string,
  event: ActivityEvent
): Promise<void> {
  const key = `ws:events:${workspaceId}`;
  const now = Date.now();

  try {
    const pipeline = redis.pipeline();
    // Add event with timestamp score
    pipeline.zadd(key, now, JSON.stringify(event));
    // Trim to max size (keep newest)
    pipeline.zremrangebyrank(key, 0, -(EVENT_BUFFER_SIZE + 1));
    // Set TTL
    pipeline.expire(key, EVENT_BUFFER_TTL);
    await pipeline.exec();
  } catch (error) {
    log.warn("Failed to buffer event", {
      workspaceId,
      eventId: event.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get events since a given event ID for catch-up.
 * Returns events that occurred after the specified event.
 */
export async function getEventsSince(
  workspaceId: string,
  lastEventId: string | null
): Promise<ActivityEvent[]> {
  const key = `ws:events:${workspaceId}`;

  try {
    // Get all buffered events
    const events = await redis.zrange(key, 0, -1);

    if (!events || events.length === 0) {
      return [];
    }

    const parsed = events.map((e) => JSON.parse(e) as ActivityEvent);

    // If no lastEventId, return all buffered events
    if (!lastEventId) {
      return parsed;
    }

    // Find index of last received event and return everything after
    const lastIndex = parsed.findIndex((e) => e.id === lastEventId);
    if (lastIndex === -1) {
      // Event not found in buffer - return all (client is too far behind)
      return parsed;
    }

    return parsed.slice(lastIndex + 1);
  } catch (error) {
    log.warn("Failed to get events for catch-up", {
      workspaceId,
      lastEventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Periodic cleanup of stale message counters.
 * Call this from a setInterval to prevent memory growth.
 */
export function cleanupStaleCounters(): void {
  const now = Date.now();
  let cleaned = 0;

  const entries = Array.from(messageCounters.entries());
  for (const [userId, counter] of entries) {
    if (now > counter.resetAt) {
      messageCounters.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    log.debug("Cleaned stale message counters", { cleaned });
  }
}

// Cleanup interval handle for testing
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic cleanup of stale counters.
 */
export function startCleanupInterval(): void {
  if (cleanupIntervalId) return;
  cleanupIntervalId = setInterval(cleanupStaleCounters, 60000);
}

/**
 * Stop the periodic cleanup (for testing/shutdown).
 */
export function stopCleanupInterval(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

// Start cleanup on module load
startCleanupInterval();
