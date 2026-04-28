/**
 * Rate limiting utilities for expensive server actions and API routes.
 * Uses Redis with sliding window algorithm for distributed rate limiting.
 *
 * Security: Prevents abuse of expensive operations (crawls, API calls, LLM usage).
 */

import { redis } from "@/lib/cache/redis-cache";

/**
 * Rate limit configuration for different operation types.
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Redis key prefix for this limiter */
  prefix: string;
}

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Number of remaining requests in the window */
  remaining: number;
  /** Unix timestamp when the window resets */
  resetAt: number;
  /** Total requests allowed in the window */
  limit: number;
}

/**
 * Rate limiter class using Redis sliding window algorithm.
 */
export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if an identifier is rate limited and record the request.
   * Uses a sliding window algorithm implemented with Redis sorted sets.
   */
  async limit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowSeconds * 1000;

    try {
      // Use a transaction for atomicity
      const pipeline = redis.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count current entries in the window
      pipeline.zcard(key);

      // Execute to get current count
      const results = await pipeline.exec();
      const currentCount = (results?.[1]?.[1] as number) ?? 0;

      if (currentCount >= this.config.maxRequests) {
        // Get the oldest entry to calculate reset time
        const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
        const oldestTimestamp = oldest?.[1] ? parseInt(oldest[1], 10) : now;
        const resetAt = oldestTimestamp + this.config.windowSeconds * 1000;

        return {
          success: false,
          remaining: 0,
          resetAt,
          limit: this.config.maxRequests,
        };
      }

      // Add current request to the window
      await redis.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry on the key
      await redis.expire(key, this.config.windowSeconds + 60);

      return {
        success: true,
        remaining: this.config.maxRequests - currentCount - 1,
        resetAt: now + this.config.windowSeconds * 1000,
        limit: this.config.maxRequests,
      };
    } catch (error) {
      // Log error but allow request through to avoid blocking on Redis issues
      // In production, you may want stricter behavior
      console.error("[rate-limit] Redis error, allowing request:", error);
      return {
        success: true,
        remaining: this.config.maxRequests,
        resetAt: now + this.config.windowSeconds * 1000,
        limit: this.config.maxRequests,
      };
    }
  }

  /**
   * Get current usage without recording a request.
   */
  async getUsage(identifier: string): Promise<{
    used: number;
    remaining: number;
    limit: number;
  }> {
    const key = `${this.config.prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowSeconds * 1000;

    try {
      // Clean up old entries
      await redis.zremrangebyscore(key, 0, windowStart);

      // Count current entries
      const used = await redis.zcard(key);

      return {
        used,
        remaining: Math.max(0, this.config.maxRequests - used),
        limit: this.config.maxRequests,
      };
    } catch {
      return {
        used: 0,
        remaining: this.config.maxRequests,
        limit: this.config.maxRequests,
      };
    }
  }
}

// Pre-configured rate limiters for different operation types

/**
 * Audit limiter: 5 audits per hour per user.
 * Audits involve crawling up to 10K pages - expensive operation.
 */
export const auditLimiter = new RateLimiter({
  maxRequests: 5,
  windowSeconds: 3600, // 1 hour
  prefix: "ratelimit:audit",
});

/**
 * API cost limiter: 100 external API calls per hour per user.
 * For DataForSEO, Google APIs, and other paid services.
 */
export const apiCostLimiter = new RateLimiter({
  maxRequests: 100,
  windowSeconds: 3600, // 1 hour
  prefix: "ratelimit:api-cost",
});

/**
 * LLM limiter: 50 LLM calls per hour per user.
 * For voice analysis, content generation, etc.
 */
export const llmLimiter = new RateLimiter({
  maxRequests: 50,
  windowSeconds: 3600, // 1 hour
  prefix: "ratelimit:llm",
});

/**
 * CPU intensive limiter: 30 operations per minute per user.
 * For pattern detection, report generation, exports.
 */
export const cpuIntensiveLimiter = new RateLimiter({
  maxRequests: 30,
  windowSeconds: 60, // 1 minute
  prefix: "ratelimit:cpu",
});

/**
 * Connection test limiter: 10 tests per minute per user.
 * Prevents SSRF abuse via CMS connection testing.
 */
export const connectionTestLimiter = new RateLimiter({
  maxRequests: 10,
  windowSeconds: 60, // 1 minute
  prefix: "ratelimit:connection",
});

/**
 * Export limiter: 10 exports per minute per user.
 * Prevents DoS via expensive export operations.
 */
export const exportLimiter = new RateLimiter({
  maxRequests: 10,
  windowSeconds: 60, // 1 minute
  prefix: "ratelimit:export",
});

/**
 * ML predictions limiter: 10 predictions per minute per user.
 * ML predictions involve expensive computations and API calls.
 */
export const mlPredictionsLimiter = new RateLimiter({
  maxRequests: 10,
  windowSeconds: 60, // 1 minute
  prefix: "ratelimit:ml-predictions",
});

/**
 * Helper to check rate limit and throw if exceeded.
 * Use in server actions for consistent error handling.
 */
export async function checkRateLimit(
  limiter: RateLimiter,
  identifier: string
): Promise<RateLimitResult> {
  const result = await limiter.limit(identifier);

  if (!result.success) {
    const resetInSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    const resetInMinutes = Math.ceil(resetInSeconds / 60);

    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${resetInMinutes} minute${resetInMinutes !== 1 ? "s" : ""}.`,
      result
    );
  }

  return result;
}

/**
 * Custom error class for rate limit violations.
 */
export class RateLimitError extends Error {
  public result: RateLimitResult;
  public statusCode = 429;

  constructor(message: string, result: RateLimitResult) {
    super(message);
    this.name = "RateLimitError";
    this.result = result;
  }
}

/**
 * Helper to create rate limit headers for API responses.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
