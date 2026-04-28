/**
 * Redis client singleton for caching and BullMQ connection pooling.
 *
 * Used by:
 * - SERP cache (24h TTL)
 * - Keyword enrichment cache (7-day TTL)
 * - Embedding cache
 * - BullMQ workers and queues (shared connections)
 */

import Redis from "ioredis";

/**
 * Get Redis URL from environment with validation.
 * In production, REDIS_URL is required. In development, falls back to localhost.
 */
function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "REDIS_URL environment variable is required in production — set it in .env or the deployment environment.",
      );
    }
    console.warn(
      "[Redis] REDIS_URL not set, falling back to redis://localhost:6379 (development only)",
    );
    return "redis://localhost:6379";
  }
  return url;
}

const REDIS_URL = getRedisUrl();

// Create singleton Redis client for caching
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000); // Exponential backoff
  },
});

// Handle connection errors gracefully
redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

redis.on("connect", () => {
  console.log("Redis connected");
});

// ============================================================================
// Health Check & Startup Validation
// ============================================================================

/**
 * Validate Redis connection at startup.
 * Call this before starting the HTTP server to fail fast if Redis is unavailable.
 *
 * @throws Error if Redis is not reachable within the timeout
 */
export async function validateRedisConnection(timeoutMs: number = 5000): Promise<void> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Redis connection timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    await Promise.race([redis.ping(), timeoutPromise]);
    console.log("[Redis] Connection validated successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Redis unavailable at startup: ${message}. Ensure Redis is running and REDIS_URL is correct.`);
  }
}

/**
 * Check Redis health without throwing.
 * Useful for health check endpoints.
 *
 * @returns Object with status, latencyMs, and optional error
 */
export async function checkRedisHealth(): Promise<{
  status: "healthy" | "unhealthy";
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await redis.ping();
    return {
      status: "healthy",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// BullMQ Connection Pooling
// ============================================================================

/**
 * Connection pool for BullMQ workers and queues.
 * Each label gets a dedicated connection to prevent connection leaks.
 *
 * TOCTOU Race Prevention:
 * ioredis creates Redis objects synchronously (TCP connection happens async).
 * We use a single synchronous check-and-set operation to prevent duplicates.
 * The Map.get() + Map.set() pattern is atomic within a single JS event loop tick.
 */
const bullmqConnections = new Map<string, Redis>();

/**
 * Create a new BullMQ-optimized Redis connection.
 * Internal helper - use getSharedBullMQConnection() instead.
 */
function createBullMQConnection(label: string): Redis {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ blocking commands
    enableReadyCheck: false, // Faster connection for BullMQ
    retryStrategy: (times: number) => {
      if (times > 10) {
        console.error(`[Redis:${label}] Max retries exceeded`);
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  connection.on("error", (err) => {
    console.error(`[Redis:${label}] Connection error:`, err.message);
  });

  connection.on("ready", () => {
    console.log(`[Redis:${label}] Connected`);
  });

  connection.on("close", () => {
    console.log(`[Redis:${label}] Connection closed`);
    // Remove from pool when connection closes to allow recreation
    bullmqConnections.delete(label);
  });

  // Also handle 'end' event for when connection is fully terminated
  connection.on("end", () => {
    console.log(`[Redis:${label}] Connection ended`);
    bullmqConnections.delete(label);
  });

  return connection;
}

/**
 * Get or create a shared Redis connection for BullMQ workers.
 * Uses synchronous check-and-set within single event loop tick to prevent TOCTOU race.
 *
 * BullMQ requires specific Redis settings:
 * - maxRetriesPerRequest: null (required for blocking commands)
 * - enableReadyCheck: false (faster connection)
 *
 * @param label - Unique identifier for the connection (e.g., 'worker:audit', 'queue:ranking')
 * @returns Shared Redis connection for the given label
 */
export function getSharedBullMQConnection(label: string): Redis {
  // Return existing connection if available and ready
  const existing = bullmqConnections.get(label);
  if (existing) {
    // Check if connection is still alive
    if (existing.status === "ready" || existing.status === "connecting") {
      return existing;
    }
    // Connection ended - remove stale entry and create new
    // This deletion + creation happens in the same event loop tick (atomic)
    bullmqConnections.delete(label);
    console.log(`[Redis:${label}] Removed stale connection (status: ${existing.status})`);
  }

  // Create new connection and store atomically in same tick
  // No await means no yield to event loop, preventing TOCTOU race
  const connection = createBullMQConnection(label);
  bullmqConnections.set(label, connection);
  return connection;
}

/**
 * Close all Redis connections gracefully.
 * Call this during application shutdown.
 *
 * Closes:
 * - All BullMQ worker/queue connections
 * - Main caching Redis connection
 */
export async function closeRedis(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  // Close BullMQ connections
  Array.from(bullmqConnections.entries()).forEach(([label, connection]) => {
    if (connection.status !== "end") {
      closePromises.push(
        connection
          .quit()
          .then(() => console.log(`[Redis:${label}] Closed`))
          .catch((err) =>
            console.error(`[Redis:${label}] Close error:`, err.message)
          )
      );
    }
  });

  // Close main redis connection if it exists and is not already closed
  if (redis && redis.status !== "end") {
    closePromises.push(
      redis
        .quit()
        .then(() => console.log("[Redis:main] Closed"))
        .catch((err) => console.error("[Redis:main] Close error:", err.message))
    );
  }

  await Promise.all(closePromises);
  bullmqConnections.clear();
}

/**
 * Get the number of active BullMQ connections.
 * Useful for monitoring and debugging.
 */
export function getBullMQConnectionCount(): number {
  return bullmqConnections.size;
}

/**
 * Get labels of all active BullMQ connections.
 * Useful for monitoring and debugging.
 */
export function getBullMQConnectionLabels(): string[] {
  return Array.from(bullmqConnections.keys());
}
