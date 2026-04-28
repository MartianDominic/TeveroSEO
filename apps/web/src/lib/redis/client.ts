/**
 * Redis client with connection pooling and retry strategy.
 * Uses singleton pattern for hot reload safety.
 */

import Redis from "ioredis";

// Global singleton for hot reload safety
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing required environment variable: REDIS_URL. " +
        "Set it in .env or the deployment environment before starting."
    );
  }

  const redis = new Redis(url, {
    // Connection pooling with retry
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 10) {
        console.error("[redis] Max retries reached, giving up");
        return null; // Stop retrying
      }
      // Exponential backoff: 50ms, 100ms, 150ms... up to 2000ms
      return Math.min(times * 50, 2000);
    },
    enableReadyCheck: true,
    lazyConnect: true,
    // Reconnect on specific errors
    reconnectOnError(err) {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  redis.on("error", (err) => {
    console.error("[redis] Connection error:", err.message);
  });

  redis.on("connect", () => {
    console.log("[redis] Connected");
  });

  redis.on("ready", () => {
    console.log("[redis] Ready");
  });

  return redis;
}

// Use singleton in development (hot reload), fresh in production
export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Graceful shutdown for Redis connection.
 * Call this before process exit to ensure clean disconnection.
 */
export async function closeRedis(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connect") {
    try {
      await redis.quit();
      console.log("[redis] Gracefully disconnected");
    } catch (err) {
      console.error("[redis] Error during disconnect:", err);
    }
  }
}

/**
 * Ensure Redis is connected and healthy.
 * Call this before operations that require Redis, or at startup.
 *
 * @returns true if connected and healthy, false otherwise
 */
export async function ensureRedisConnected(): Promise<boolean> {
  if (redis.status === "ready") {
    return true;
  }

  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error("[redis] Failed to connect:", error);
    return false;
  }
}

/**
 * Check Redis health without throwing.
 * Useful for health check endpoints.
 */
export async function checkRedisHealth(): Promise<{
  status: "healthy" | "unhealthy" | "disconnected";
  latencyMs?: number;
  error?: string;
}> {
  if (redis.status !== "ready") {
    return { status: "disconnected" };
  }

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

// Register shutdown handlers (only in Node.js environment)
if (typeof process !== "undefined" && process.on) {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[redis] Received ${signal}, shutting down...`);
    await closeRedis();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
