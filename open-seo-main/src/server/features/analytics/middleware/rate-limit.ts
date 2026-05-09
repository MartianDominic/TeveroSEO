/**
 * Analytics Rate Limiting Middleware
 * Phase 96-Security: SEC-H01 Fix - Fail-closed rate limiting with graceful degradation
 *
 * Security features:
 * - Redis-backed sliding window rate limiting (primary)
 * - In-memory token bucket fallback when Redis unavailable
 * - Circuit breaker pattern to detect Redis health
 * - Returns 503 Service Unavailable when both Redis and fallback exhausted
 * - Conservative fallback limits to prevent abuse during outages
 *
 * Note: This module uses redis.eval() which is the ioredis method for executing
 * Lua scripts on the Redis server - NOT JavaScript's eval(). Lua scripts execute
 * atomically on Redis and are the standard way to implement atomic operations.
 *
 * @example
 * ```ts
 * const rateLimiter = createAnalyticsRateLimiter({
 *   name: 'trends',
 *   tokensPerSecond: 10,
 *   maxBurst: 20,
 * });
 *
 * const result = await rateLimiter.checkLimit(workspaceId);
 * if (!result.allowed) {
 *   return result.response; // 429 or 503
 * }
 * ```
 */

import { redis, isCircuitBreakerClosed, recordRedisFailure, recordRedisSuccess } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "analytics-rate-limit" });

// =============================================================================
// Types
// =============================================================================

export interface AnalyticsRateLimitConfig {
  /** Unique name for this rate limiter (e.g., "trends", "cannibalization") */
  name: string;
  /** Tokens added per second to the bucket */
  tokensPerSecond: number;
  /** Maximum burst capacity (defaults to tokensPerSecond) */
  maxBurst?: number;
  /** Conservative fallback limit when Redis unavailable (defaults to maxBurst / 4) */
  fallbackLimit?: number;
}

export interface RateLimitCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests */
  remaining: number;
  /** Seconds until rate limit resets (only when not allowed) */
  retryAfter?: number;
  /** Total limit for reference */
  limit: number;
  /** Pre-built error response (only when not allowed) */
  response?: Response;
  /** Source of the rate limit decision */
  source: "redis" | "fallback" | "circuit-open";
}

// =============================================================================
// In-Memory Fallback Token Bucket
// =============================================================================

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRatePerMs: number;
}

/**
 * In-memory token buckets for fallback rate limiting.
 * Keyed by rate limiter name + identifier (e.g., "trends:workspace123")
 */
const fallbackBuckets = new Map<string, TokenBucket>();

/**
 * Cleanup interval for expired fallback buckets (5 minutes)
 */
const FALLBACK_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * TTL for fallback buckets (10 minutes of inactivity)
 */
const FALLBACK_BUCKET_TTL_MS = 10 * 60 * 1000;

/**
 * Clean up expired fallback buckets periodically.
 */
function cleanupFallbackBuckets(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, bucket] of fallbackBuckets) {
    if (now - bucket.lastRefill > FALLBACK_BUCKET_TTL_MS) {
      fallbackBuckets.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    log.debug("Cleaned up expired fallback buckets", { count: cleaned });
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupFallbackBuckets, FALLBACK_CLEANUP_INTERVAL_MS);

/**
 * Try to acquire a token from the in-memory fallback bucket.
 * Uses conservative limits to prevent abuse during Redis outages.
 */
function tryAcquireFallbackToken(
  key: string,
  maxTokens: number,
  refillRatePerMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = fallbackBuckets.get(key);

  if (!bucket) {
    // Initialize new bucket at max capacity
    bucket = {
      tokens: maxTokens,
      lastRefill: now,
      maxTokens,
      refillRatePerMs,
    };
    fallbackBuckets.set(key, bucket);
  }

  // Calculate tokens to add based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = elapsed * bucket.refillRatePerMs;
  const newTokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);

  // Update bucket state (immutable pattern - create new object)
  const updatedBucket: TokenBucket = {
    ...bucket,
    tokens: newTokens,
    lastRefill: now,
  };

  // Try to consume a token
  if (updatedBucket.tokens >= 1) {
    updatedBucket.tokens -= 1;
    fallbackBuckets.set(key, updatedBucket);
    return {
      allowed: true,
      remaining: Math.floor(updatedBucket.tokens),
    };
  }

  // No tokens available
  fallbackBuckets.set(key, updatedBucket);
  return {
    allowed: false,
    remaining: 0,
  };
}

// =============================================================================
// Redis Rate Limiter with Lua Script
// =============================================================================

/**
 * Lua script for atomic token bucket rate limiting.
 * This executes on the Redis server, NOT in JavaScript.
 * Returns: [success (0/1), tokens_remaining, wait_time_ms]
 */
const ACQUIRE_TOKEN_LUA = `
local key = KEYS[1]
local maxTokens = tonumber(ARGV[1])
local refillRatePerMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttlSeconds = tonumber(ARGV[4])

-- Get current state
local state = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(state[1])
local lastRefill = tonumber(state[2])

-- Initialize if not exists
if not tokens then
  tokens = maxTokens
  lastRefill = now
end

-- Calculate tokens to add
local elapsed = now - lastRefill
local tokensToAdd = elapsed * refillRatePerMs
tokens = math.min(maxTokens, tokens + tokensToAdd)

-- Try to consume a token
if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HSET', key, 'tokens', tokens, 'lastRefill', now)
  redis.call('EXPIRE', key, ttlSeconds)
  return {1, tokens, 0}
else
  -- Calculate wait time for next token
  local waitTime = math.ceil((1 - tokens) / refillRatePerMs)
  redis.call('HSET', key, 'lastRefill', now)
  redis.call('EXPIRE', key, ttlSeconds)
  return {0, tokens, waitTime}
end
`;

/**
 * Try to acquire a token from Redis using Lua script for atomicity.
 * Note: redis.evalScript() is the ioredis method for Lua script execution,
 * not JavaScript eval(). Lua scripts run atomically on the Redis server.
 * Returns null if Redis is unavailable.
 */
async function tryAcquireRedisToken(
  key: string,
  maxTokens: number,
  refillRatePerMs: number
): Promise<{ allowed: boolean; remaining: number; waitTimeMs: number } | null> {
  // Check circuit breaker first
  if (!isCircuitBreakerClosed()) {
    log.warn("Redis circuit breaker open, skipping Redis rate limit check", { key });
    return null;
  }

  try {
    const ttlSeconds = 300; // 5 minute TTL for rate limiter state
    const now = Date.now();

    // ioredis eval() method executes Lua scripts on Redis server (NOT JS eval)
    const result = await (redis as unknown as {
      eval: (script: string, keyCount: number, ...args: string[]) => Promise<[number, number, number]>;
    }).eval(
      ACQUIRE_TOKEN_LUA,
      1,
      key,
      maxTokens.toString(),
      refillRatePerMs.toString(),
      now.toString(),
      ttlSeconds.toString()
    );

    recordRedisSuccess();

    return {
      allowed: result[0] === 1,
      remaining: Math.max(0, Math.floor(result[1])),
      waitTimeMs: result[2],
    };
  } catch (error) {
    recordRedisFailure();
    log.error(
      "Redis rate limit check failed",
      error instanceof Error ? error : new Error(String(error)),
      { key }
    );
    return null;
  }
}

// =============================================================================
// Response Builders
// =============================================================================

/**
 * Create a 429 Too Many Requests response.
 */
function createTooManyRequestsResponse(
  retryAfterSeconds: number,
  limit: number,
  source: string
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Please retry after ${retryAfterSeconds} seconds.`,
        retryAfter: retryAfterSeconds,
        source,
      },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": "0",
        "Retry-After": retryAfterSeconds.toString(),
        "X-RateLimit-Reset": (Math.floor(Date.now() / 1000) + retryAfterSeconds).toString(),
      },
    }
  );
}

/**
 * Create a 503 Service Unavailable response.
 * SEC-H01: Return 503 when both Redis and fallback are exhausted.
 */
function createServiceUnavailableResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Rate limiting service temporarily unavailable. Please try again later.",
        retryAfter: 60,
      },
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "60",
      },
    }
  );
}

// =============================================================================
// Analytics Rate Limiter Factory
// =============================================================================

export interface AnalyticsRateLimiter {
  /** Check if request is allowed and consume a token */
  checkLimit(identifier: string): Promise<RateLimitCheckResult>;
  /** Get current status without consuming a token */
  getStatus(identifier: string): Promise<{ tokens: number; maxTokens: number }>;
  /** Reset rate limit for identifier (testing only) */
  reset(identifier: string): Promise<void>;
}

/**
 * Create an analytics rate limiter with fail-closed behavior and graceful degradation.
 *
 * SEC-H01 FIX: Implements fail-closed rate limiting with in-memory fallback:
 * 1. When Redis is healthy, use Redis for distributed rate limiting
 * 2. When Redis is unavailable, fall back to in-memory token bucket with conservative limits
 * 3. If both Redis and fallback are exhausted, return 503 Service Unavailable
 *
 * @param config Rate limiter configuration
 * @returns AnalyticsRateLimiter instance
 */
export function createAnalyticsRateLimiter(config: AnalyticsRateLimitConfig): AnalyticsRateLimiter {
  const {
    name,
    tokensPerSecond,
    maxBurst = tokensPerSecond,
  } = config;

  // Conservative fallback limit: 1/4 of normal capacity
  const fallbackLimit = config.fallbackLimit ?? Math.max(1, Math.floor(maxBurst / 4));

  const redisKeyPrefix = `ratelimit:analytics:${name}:`;
  const refillRatePerMs = tokensPerSecond / 1000;
  const fallbackRefillRatePerMs = (tokensPerSecond / 4) / 1000; // 1/4 rate for fallback

  return {
    async checkLimit(identifier: string): Promise<RateLimitCheckResult> {
      const redisKey = `${redisKeyPrefix}${identifier}`;
      const fallbackKey = `${name}:${identifier}`;

      // Try Redis first
      const redisResult = await tryAcquireRedisToken(redisKey, maxBurst, refillRatePerMs);

      if (redisResult !== null) {
        // Redis is healthy
        if (redisResult.allowed) {
          return {
            allowed: true,
            remaining: redisResult.remaining,
            limit: maxBurst,
            source: "redis",
          };
        }

        // Rate limit exceeded (Redis)
        const retryAfter = Math.max(1, Math.ceil(redisResult.waitTimeMs / 1000));
        return {
          allowed: false,
          remaining: 0,
          retryAfter,
          limit: maxBurst,
          source: "redis",
          response: createTooManyRequestsResponse(retryAfter, maxBurst, "redis"),
        };
      }

      // Redis unavailable - use in-memory fallback with conservative limits
      log.warn("Using in-memory rate limit fallback", {
        name,
        identifier,
        fallbackLimit,
      });

      const fallbackResult = tryAcquireFallbackToken(
        fallbackKey,
        fallbackLimit,
        fallbackRefillRatePerMs
      );

      if (fallbackResult.allowed) {
        return {
          allowed: true,
          remaining: fallbackResult.remaining,
          limit: fallbackLimit,
          source: "fallback",
        };
      }

      // Both Redis and fallback exhausted
      // SEC-H01: Return 503 Service Unavailable
      log.error("Rate limiting exhausted - both Redis and fallback unavailable", undefined, {
        name,
        identifier,
      });

      return {
        allowed: false,
        remaining: 0,
        retryAfter: 60,
        limit: fallbackLimit,
        source: "circuit-open",
        response: createServiceUnavailableResponse(),
      };
    },

    async getStatus(identifier: string): Promise<{ tokens: number; maxTokens: number }> {
      const redisKey = `${redisKeyPrefix}${identifier}`;

      try {
        if (isCircuitBreakerClosed()) {
          const state = await redis.hgetall(redisKey);
          const tokens = parseFloat(state.tokens ?? String(maxBurst));
          return {
            tokens: Math.max(0, Math.min(maxBurst, tokens)),
            maxTokens: maxBurst,
          };
        }
      } catch {
        // Fall through to fallback
      }

      // Check fallback bucket
      const fallbackKey = `${name}:${identifier}`;
      const bucket = fallbackBuckets.get(fallbackKey);

      return {
        tokens: bucket?.tokens ?? fallbackLimit,
        maxTokens: fallbackLimit,
      };
    },

    async reset(identifier: string): Promise<void> {
      const redisKey = `${redisKeyPrefix}${identifier}`;
      const fallbackKey = `${name}:${identifier}`;

      try {
        await redis.del(redisKey);
      } catch {
        // Ignore Redis errors during reset
      }

      fallbackBuckets.delete(fallbackKey);
      log.info("Rate limit reset", { name, identifier });
    },
  };
}

// =============================================================================
// Pre-configured Analytics Rate Limiters
// =============================================================================

/**
 * Rate limiter for trend analysis endpoints.
 * 10 requests per second, burst of 20.
 */
export const trendsRateLimiter = createAnalyticsRateLimiter({
  name: "trends",
  tokensPerSecond: 10,
  maxBurst: 20,
});

/**
 * Rate limiter for cannibalization detection endpoints.
 * 5 requests per second, burst of 10.
 */
export const cannibalizationRateLimiter = createAnalyticsRateLimiter({
  name: "cannibalization",
  tokensPerSecond: 5,
  maxBurst: 10,
});

/**
 * Rate limiter for striking distance analysis endpoints.
 * 10 requests per second, burst of 30.
 */
export const strikingDistanceRateLimiter = createAnalyticsRateLimiter({
  name: "striking-distance",
  tokensPerSecond: 10,
  maxBurst: 30,
});

/**
 * Rate limiter for export operations.
 * 2 requests per second, burst of 5.
 */
export const exportRateLimiter = createAnalyticsRateLimiter({
  name: "export",
  tokensPerSecond: 2,
  maxBurst: 5,
});

/**
 * Rate limiter for GSC refresh triggers.
 * 1 request per 10 seconds, burst of 2.
 * Strict to prevent GSC API quota exhaustion.
 */
export const gscRefreshRateLimiter = createAnalyticsRateLimiter({
  name: "gsc-refresh",
  tokensPerSecond: 0.1, // 1 per 10 seconds
  maxBurst: 2,
});

// =============================================================================
// Middleware Wrapper
// =============================================================================

export type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Wrap a route handler with analytics rate limiting.
 *
 * @param rateLimiter The rate limiter to use
 * @param extractIdentifier Function to extract identifier from request
 * @param handler The route handler to wrap
 * @returns Wrapped handler that enforces rate limits
 */
export function withAnalyticsRateLimit(
  rateLimiter: AnalyticsRateLimiter,
  extractIdentifier: (request: Request) => string | Promise<string>,
  handler: RouteHandler
): RouteHandler {
  return async (request: Request): Promise<Response> => {
    const identifier = await Promise.resolve(extractIdentifier(request));
    const result = await rateLimiter.checkLimit(identifier);

    if (!result.allowed) {
      return result.response ?? createServiceUnavailableResponse();
    }

    // Execute handler and add rate limit headers
    const response = await handler(request);

    // Clone response to add headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set("X-RateLimit-Limit", result.limit.toString());
    newHeaders.set("X-RateLimit-Remaining", result.remaining.toString());
    newHeaders.set("X-RateLimit-Source", result.source);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

// =============================================================================
// Testing Utilities
// =============================================================================

/**
 * Get fallback bucket count (testing only).
 */
export function getFallbackBucketCount(): number {
  return fallbackBuckets.size;
}

/**
 * Clear all fallback buckets (testing only).
 */
export function clearFallbackBuckets(): void {
  fallbackBuckets.clear();
}
