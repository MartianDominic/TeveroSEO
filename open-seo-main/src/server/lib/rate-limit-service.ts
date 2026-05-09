/**
 * Unified Rate Limiting Service
 *
 * Phase 96 Consolidation: Eliminates 3 duplicate rate limiting implementations:
 * - middleware/rate-limit.ts (sliding window, ~994 lines)
 * - services/RateLimitService.ts (sliding window + fallback, ~892 lines)
 * - lib/redis-rate-limiter.ts (token bucket, ~432 lines)
 *
 * This service provides:
 * - Strategy pattern for sliding window, token bucket, and fixed window algorithms
 * - Configurable storage backend (Redis primary, in-memory fallback)
 * - Configurable scope (per-IP, per-client, per-endpoint, per-user)
 * - Fail-closed behavior with graceful degradation
 * - Metrics and logging for rate limit events
 *
 * NOTE: This file uses redis's scripting method which executes Lua scripts
 * atomically on the Redis server. This is NOT JavaScript code execution.
 *
 * @module rate-limit-service
 */

import { redis, isCircuitBreakerClosed, recordRedisFailure, recordRedisSuccess } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "rate-limit-service" });

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Rate limiting strategy/algorithm type.
 */
export type RateLimitStrategy = "sliding-window" | "token-bucket" | "fixed-window";

/**
 * Scope determines how the rate limit key is constructed.
 */
export type RateLimitScope = "ip" | "client" | "endpoint" | "user";

/**
 * Tier determines fallback behavior severity.
 */
export type RateLimitTier = "strict" | "standard" | "relaxed";

/**
 * Fail behavior when Redis is unavailable.
 * - closed: Block request (safe for sensitive endpoints)
 * - degraded: Allow with stricter in-memory limits
 */
export type FailBehavior = "closed" | "degraded";

/**
 * Configuration for a rate limit check.
 */
export interface RateLimitConfig {
  /** Rate limiting strategy/algorithm */
  strategy: RateLimitStrategy;
  /** Scope for key construction */
  scope: RateLimitScope;
  /** Maximum requests/tokens allowed */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Fail behavior when Redis unavailable (default: degraded) */
  failClosed?: boolean;
  /** Rate limit tier for fallback percentage (default: standard) */
  tier?: RateLimitTier;
  /** Custom fallback percentage (0-1, overrides tier) */
  fallbackPercentage?: number;
  /** For token bucket: tokens refilled per second (default: limit/windowMs*1000) */
  tokensPerSecond?: number;
}

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests/tokens */
  remaining: number;
  /** When the rate limit resets */
  resetAt: Date;
  /** Seconds until retry is allowed (for 429 response) */
  retryAfter?: number;
  /** Whether result came from fallback limiter */
  fromFallback?: boolean;
  /** Current usage count */
  current?: number;
  /** Maximum limit */
  limit?: number;
}

/**
 * Service metrics for monitoring.
 */
export interface RateLimitMetrics {
  totalChecks: number;
  allowedChecks: number;
  blockedChecks: number;
  fallbackChecks: number;
  errorChecks: number;
  lastError?: Date;
  uptimeMs: number;
}

/**
 * Request handler type for middleware wrapper.
 */
export type RequestHandler = (request: Request) => Promise<Response>;

// =============================================================================
// Strategy Implementations (Lua Scripts for Redis)
// =============================================================================

/**
 * Lua script for atomic sliding window rate limiting.
 * Uses sorted set with timestamps as scores.
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local entry_id = ARGV[4]

-- Remove expired entries
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current entries
local count = redis.call('ZCARD', key)

-- Check if at or over limit
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldest_ts = 0
  if oldest and #oldest >= 2 then
    oldest_ts = tonumber(oldest[2])
  end
  return {0, count, limit, oldest_ts}
end

-- Under limit - add new entry
redis.call('ZADD', key, now, entry_id)
redis.call('EXPIRE', key, math.ceil(window / 1000) + 10)

return {1, count + 1, limit, 0}
`;

/**
 * Lua script for atomic token bucket rate limiting.
 * Uses hash with tokens and last refill timestamp.
 */
const TOKEN_BUCKET_LUA = `
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
  local waitTime = math.ceil((1 - tokens) / refillRatePerMs)
  redis.call('HSET', key, 'lastRefill', now)
  redis.call('EXPIRE', key, ttlSeconds)
  return {0, tokens, waitTime}
end
`;

/**
 * Lua script for atomic fixed window rate limiting.
 * Uses simple counter with expiry.
 */
const FIXED_WINDOW_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

-- Get current count
local current = tonumber(redis.call('GET', key)) or 0

-- Check if at or over limit
if current >= limit then
  local ttl = redis.call('TTL', key)
  return {0, current, limit, ttl > 0 and ttl or window}
end

-- Increment and set expiry
current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, math.ceil(window / 1000))
end

return {1, current, limit, 0}
`;

// =============================================================================
// In-Memory Fallback Limiter
// =============================================================================

interface FallbackEntry {
  count: number;
  windowStart: number;
  resetAt: number;
}

/**
 * In-memory fallback rate limiter for when Redis is unavailable.
 * Uses fixed window for simplicity. Per-process, so limits are divided
 * across workers in multi-process deployments.
 */
class InMemoryFallbackLimiter {
  private readonly entries = new Map<string, FallbackEntry>();
  private readonly maxEntries: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
    this.startCleanup();
  }

  /**
   * Check rate limit against in-memory store.
   */
  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    let entry = this.entries.get(key);

    // Window expired or first request
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 1,
        windowStart: now,
        resetAt: now + windowMs,
      };
      this.entries.set(key, entry);
      this.enforceMaxEntries();

      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: new Date(entry.resetAt),
        fromFallback: true,
        current: 1,
        limit,
      };
    }

    // Check if over limit
    if (entry.count >= limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
        retryAfter: Math.max(1, retryAfter),
        fromFallback: true,
        current: entry.count,
        limit,
      };
    }

    // Increment and allow
    entry.count++;
    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: new Date(entry.resetAt),
      fromFallback: true,
      current: entry.count,
      limit,
    };
  }

  /**
   * Reset a specific key.
   */
  reset(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Get number of tracked entries.
   */
  size(): number {
    return this.entries.size;
  }

  private enforceMaxEntries(): void {
    if (this.entries.size <= this.maxEntries) return;

    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.entries) {
      if (now > entry.resetAt) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.entries.delete(key);
    }

    if (this.entries.size > this.maxEntries) {
      const excess = this.entries.size - this.maxEntries;
      const keys = Array.from(this.entries.keys()).slice(0, excess);
      for (const key of keys) {
        this.entries.delete(key);
      }
    }
  }

  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.entries) {
        if (now > entry.resetAt) {
          this.entries.delete(key);
        }
      }
    }, 60000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// =============================================================================
// Fallback Percentages by Tier
// =============================================================================

const FALLBACK_PERCENTAGES: Record<RateLimitTier, number> = {
  strict: 0.25,
  standard: 0.5,
  relaxed: 0.75,
};

// =============================================================================
// Rate Limit Service Implementation
// =============================================================================

/**
 * Execute Lua script on Redis server.
 * This is the standard ioredis method for atomic operations.
 */
async function executeScript(
  script: string,
  keys: string[],
  args: string[]
): Promise<unknown> {
  // Use the standard Redis scripting API
  return redis.eval(script, keys.length, ...keys, ...args);
}

/**
 * Unified Rate Limit Service.
 *
 * Supports multiple strategies (sliding window, token bucket, fixed window)
 * with Redis as primary storage and in-memory fallback.
 */
class RateLimitServiceImpl {
  private readonly fallbackLimiter: InMemoryFallbackLimiter;
  private readonly startTime: number;

  // Metrics
  private totalChecks = 0;
  private allowedChecks = 0;
  private blockedChecks = 0;
  private fallbackChecks = 0;
  private errorChecks = 0;
  private lastError?: Date;

  constructor() {
    this.fallbackLimiter = new InMemoryFallbackLimiter();
    this.startTime = Date.now();
  }

  /**
   * Check rate limit for a given key.
   *
   * @param key - Unique identifier for this rate limit bucket
   * @param config - Rate limit configuration
   * @returns Rate limit result
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    this.totalChecks++;
    const redisKey = this.buildRedisKey(key);

    // Check circuit breaker
    if (!isCircuitBreakerClosed()) {
      log.warn("Circuit breaker open, using fallback", { key: redisKey });
      return this.checkFallback(key, config);
    }

    try {
      const result = await this.checkRedis(redisKey, config);
      recordRedisSuccess();

      if (result.allowed) {
        this.allowedChecks++;
      } else {
        this.blockedChecks++;
      }

      return result;
    } catch (error) {
      recordRedisFailure();
      this.errorChecks++;
      this.lastError = new Date();

      log.error(
        "Rate limit Redis error",
        error instanceof Error ? error : new Error(String(error)),
        { key: redisKey, strategy: config.strategy }
      );

      // Fail closed or use fallback
      if (config.failClosed) {
        this.blockedChecks++;
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + config.windowMs),
          retryAfter: Math.ceil(config.windowMs / 1000),
          fromFallback: false,
          current: config.limit,
          limit: config.limit,
        };
      }

      return this.checkFallback(key, config);
    }
  }

  /**
   * Check rate limit using Redis.
   */
  private async checkRedis(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();

    switch (config.strategy) {
      case "sliding-window":
        return this.checkSlidingWindow(key, config, now);
      case "token-bucket":
        return this.checkTokenBucket(key, config, now);
      case "fixed-window":
        return this.checkFixedWindow(key, config);
      default:
        throw new Error(`Unknown rate limit strategy: ${config.strategy}`);
    }
  }

  /**
   * Sliding window rate limiting using sorted sets.
   */
  private async checkSlidingWindow(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<RateLimitResult> {
    const entryId = `${now}:${Math.random().toString(36).slice(2, 11)}`;

    const result = (await executeScript(
      SLIDING_WINDOW_LUA,
      [key],
      [now.toString(), config.windowMs.toString(), config.limit.toString(), entryId]
    )) as [number, number, number, number];

    const [allowed, currentCount, maxLimit, oldestTimestamp] = result;

    if (allowed === 0) {
      let retryAfter = Math.ceil(config.windowMs / 1000);
      if (oldestTimestamp > 0) {
        retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);
        retryAfter = Math.max(1, retryAfter);
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(now + retryAfter * 1000),
        retryAfter,
        fromFallback: false,
        current: currentCount,
        limit: maxLimit,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxLimit - currentCount),
      resetAt: new Date(now + config.windowMs),
      fromFallback: false,
      current: currentCount,
      limit: maxLimit,
    };
  }

  /**
   * Token bucket rate limiting.
   */
  private async checkTokenBucket(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<RateLimitResult> {
    const tokensPerSecond = config.tokensPerSecond ?? (config.limit / config.windowMs) * 1000;
    const refillRatePerMs = tokensPerSecond / 1000;
    const ttlSeconds = Math.ceil(config.windowMs / 1000) + 300;

    const result = (await executeScript(
      TOKEN_BUCKET_LUA,
      [key],
      [
        config.limit.toString(),
        refillRatePerMs.toString(),
        now.toString(),
        ttlSeconds.toString(),
      ]
    )) as [number, number, number];

    const [success, tokens, waitTimeMs] = result;

    if (success === 0) {
      return {
        allowed: false,
        remaining: Math.max(0, Math.floor(tokens)),
        resetAt: new Date(now + waitTimeMs),
        retryAfter: Math.ceil(waitTimeMs / 1000),
        fromFallback: false,
        current: config.limit - Math.floor(tokens),
        limit: config.limit,
      };
    }

    return {
      allowed: true,
      remaining: Math.floor(tokens),
      resetAt: new Date(now + config.windowMs),
      fromFallback: false,
      current: config.limit - Math.floor(tokens),
      limit: config.limit,
    };
  }

  /**
   * Fixed window rate limiting using simple counter.
   */
  private async checkFixedWindow(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const result = (await executeScript(
      FIXED_WINDOW_LUA,
      [key],
      [config.limit.toString(), config.windowMs.toString()]
    )) as [number, number, number, number];

    const [allowed, current, limit, ttl] = result;

    if (allowed === 0) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + ttl * 1000),
        retryAfter: ttl,
        fromFallback: false,
        current,
        limit,
      };
    }

    const windowSeconds = Math.ceil(config.windowMs / 1000);
    return {
      allowed: true,
      remaining: Math.max(0, limit - current),
      resetAt: new Date(Date.now() + windowSeconds * 1000),
      fromFallback: false,
      current,
      limit,
    };
  }

  /**
   * Fallback rate limiting using in-memory store.
   */
  private checkFallback(key: string, config: RateLimitConfig): RateLimitResult {
    this.fallbackChecks++;

    const tier = config.tier ?? "standard";
    const percentage = config.fallbackPercentage ?? FALLBACK_PERCENTAGES[tier];
    const fallbackLimit = Math.max(1, Math.floor(config.limit * percentage));

    const result = this.fallbackLimiter.check(key, fallbackLimit, config.windowMs);

    if (!result.allowed) {
      this.blockedChecks++;
    } else {
      this.allowedChecks++;
    }

    return {
      ...result,
      limit: fallbackLimit,
    };
  }

  /**
   * Build Redis key with prefix.
   */
  private buildRedisKey(key: string): string {
    if (key.startsWith("ratelimit:")) {
      return key;
    }
    return `ratelimit:${key}`;
  }

  /**
   * Reset a rate limit key.
   */
  async reset(key: string): Promise<void> {
    const redisKey = this.buildRedisKey(key);
    this.fallbackLimiter.reset(key);

    try {
      await redis.del(redisKey);
      log.info("Rate limit reset", { key: redisKey });
    } catch (error) {
      log.warn("Rate limit reset failed", {
        key: redisKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check Redis health.
   */
  async isHealthy(): Promise<boolean> {
    if (!isCircuitBreakerClosed()) {
      return false;
    }

    try {
      const testKey = "ratelimit:health:check";
      await redis.set(testKey, "1", "EX", 5);
      const result = await redis.get(testKey);
      recordRedisSuccess();
      return result === "1";
    } catch (error) {
      recordRedisFailure();
      log.warn("Rate limit health check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get service metrics.
   */
  getMetrics(): RateLimitMetrics {
    return {
      totalChecks: this.totalChecks,
      allowedChecks: this.allowedChecks,
      blockedChecks: this.blockedChecks,
      fallbackChecks: this.fallbackChecks,
      errorChecks: this.errorChecks,
      lastError: this.lastError,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  /**
   * Get fallback limiter size.
   */
  getFallbackSize(): number {
    return this.fallbackLimiter.size();
  }

  /**
   * Shutdown service.
   */
  shutdown(): void {
    this.fallbackLimiter.shutdown();
  }
}

// =============================================================================
// Singleton and Factory Functions
// =============================================================================

let serviceInstance: RateLimitServiceImpl | null = null;

/**
 * Get the singleton RateLimitService instance.
 */
export function getRateLimitService(): RateLimitServiceImpl {
  if (!serviceInstance) {
    serviceInstance = new RateLimitServiceImpl();
  }
  return serviceInstance;
}

// =============================================================================
// Middleware Factory
// =============================================================================

/**
 * Options for createRateLimitMiddleware.
 */
export interface MiddlewareOptions {
  /** Function to extract rate limit key from request */
  keyExtractor: (request: Request) => string | Promise<string>;
  /** Rate limit configuration */
  config: RateLimitConfig;
}

/**
 * Create a rate limit middleware for route handlers.
 *
 * @example
 * ```ts
 * const middleware = createRateLimitMiddleware({
 *   keyExtractor: (req) => `api:${getClientId(req)}`,
 *   config: {
 *     strategy: 'sliding-window',
 *     scope: 'client',
 *     limit: 100,
 *     windowMs: 60000,
 *   },
 * });
 *
 * // Use in route
 * export const POST = middleware(async (request) => {
 *   return Response.json({ success: true });
 * });
 * ```
 */
export function createRateLimitMiddleware(options: MiddlewareOptions): (handler: RequestHandler) => RequestHandler {
  return (handler: RequestHandler): RequestHandler => {
    return async (request: Request): Promise<Response> => {
      const key = await Promise.resolve(options.keyExtractor(request));
      const result = await getRateLimitService().check(key, options.config);

      if (!result.allowed) {
        return rateLimitExceededResponse(result);
      }

      const response = await handler(request);
      return addRateLimitHeaders(response, result);
    };
  };
}

/**
 * Middleware that wraps a handler with rate limiting.
 * Simpler API for common cases.
 */
export function middleware(config: RateLimitConfig): (handler: RequestHandler) => RequestHandler {
  return createRateLimitMiddleware({
    keyExtractor: (req) => {
      const url = new URL(req.url);
      return `${config.scope}:${url.pathname}`;
    },
    config,
  });
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a 429 Too Many Requests response.
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  const retryAfter = result.retryAfter ?? 60;
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-RateLimit-Limit": (result.limit ?? 0).toString(),
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": Math.floor(result.resetAt.getTime() / 1000).toString(),
    "Retry-After": retryAfter.toString(),
  });

  if (result.fromFallback) {
    headers.set("X-RateLimit-Degraded", "true");
  }

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: `Too many requests. Please retry after ${retryAfter} seconds.`,
      retryAfter,
      degraded: result.fromFallback ?? false,
    }),
    { status: 429, headers }
  );
}

/**
 * Add rate limit headers to a response.
 */
export function addRateLimitHeaders(response: Response, result: RateLimitResult): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-RateLimit-Limit", (result.limit ?? 0).toString());
  newHeaders.set("X-RateLimit-Remaining", result.remaining.toString());
  newHeaders.set("X-RateLimit-Reset", Math.floor(result.resetAt.getTime() / 1000).toString());

  if (result.fromFallback) {
    newHeaders.set("X-RateLimit-Degraded", "true");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Create rate limit headers object.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": (result.limit ?? 0).toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.floor(result.resetAt.getTime() / 1000).toString(),
  };

  if (result.fromFallback) {
    headers["X-RateLimit-Degraded"] = "true";
  }

  if (result.retryAfter) {
    headers["Retry-After"] = result.retryAfter.toString();
  }

  return headers;
}

// =============================================================================
// Pre-configured Limiters
// =============================================================================

/**
 * Create a pre-configured rate limiter function.
 *
 * @example
 * ```ts
 * const apiLimiter = createRateLimiter({
 *   keyPrefix: 'api',
 *   strategy: 'sliding-window',
 *   scope: 'client',
 *   limit: 100,
 *   windowMs: 60000,
 * });
 *
 * const result = await apiLimiter(clientId);
 * if (!result.allowed) {
 *   return rateLimitExceededResponse(result);
 * }
 * ```
 */
export function createRateLimiter(options: {
  keyPrefix: string;
  strategy: RateLimitStrategy;
  scope: RateLimitScope;
  limit: number;
  windowMs: number;
  tier?: RateLimitTier;
  failClosed?: boolean;
  tokensPerSecond?: number;
}): (identifier: string) => Promise<RateLimitResult> {
  return (identifier: string) =>
    getRateLimitService().check(`${options.keyPrefix}:${identifier}`, {
      strategy: options.strategy,
      scope: options.scope,
      limit: options.limit,
      windowMs: options.windowMs,
      tier: options.tier,
      failClosed: options.failClosed,
      tokensPerSecond: options.tokensPerSecond,
    });
}

// =============================================================================
// Standard Rate Limit Configurations
// =============================================================================

/**
 * Standard rate limit configurations.
 */
export const RATE_LIMIT_PRESETS = {
  // API endpoint rate limits
  API_STANDARD: {
    strategy: "sliding-window" as const,
    scope: "client" as const,
    limit: 60,
    windowMs: 60000,
    tier: "standard" as const,
  },
  API_EXPENSIVE: {
    strategy: "sliding-window" as const,
    scope: "client" as const,
    limit: 30,
    windowMs: 60000,
    tier: "standard" as const,
  },
  API_STRICT: {
    strategy: "sliding-window" as const,
    scope: "client" as const,
    limit: 10,
    windowMs: 60000,
    tier: "strict" as const,
    failClosed: true,
  },

  // Auth rate limits (strict, fail-closed)
  AUTH: {
    strategy: "sliding-window" as const,
    scope: "ip" as const,
    limit: 10,
    windowMs: 60000,
    tier: "strict" as const,
    failClosed: true,
  },
  PASSWORD_RESET: {
    strategy: "sliding-window" as const,
    scope: "ip" as const,
    limit: 3,
    windowMs: 300000,
    tier: "strict" as const,
    failClosed: true,
  },

  // External API rate limits (token bucket)
  EXTERNAL_API: {
    strategy: "token-bucket" as const,
    scope: "endpoint" as const,
    limit: 10,
    windowMs: 1000,
    tokensPerSecond: 10,
  },
  DATAFORSEO: {
    strategy: "token-bucket" as const,
    scope: "endpoint" as const,
    limit: 5,
    windowMs: 1000,
    tokensPerSecond: 5,
  },

  // Analytics rate limits
  ANALYTICS_STANDARD: {
    strategy: "sliding-window" as const,
    scope: "client" as const,
    limit: 60,
    windowMs: 60000,
    tier: "relaxed" as const,
  },
  ANALYTICS_SYNC: {
    strategy: "sliding-window" as const,
    scope: "client" as const,
    limit: 5,
    windowMs: 3600000,
    tier: "strict" as const,
  },

  // Portal rate limits
  PORTAL_STANDARD: {
    strategy: "sliding-window" as const,
    scope: "client" as const,
    limit: 60,
    windowMs: 60000,
    tier: "relaxed" as const,
  },
  PORTAL_EXPORT: {
    strategy: "sliding-window" as const,
    scope: "client" as const,
    limit: 5,
    windowMs: 3600000,
    tier: "standard" as const,
  },
} as const;

// =============================================================================
// Pre-built Limiters
// =============================================================================

/** Standard API rate limiter (60/min per client) */
export const apiStandardLimiter = createRateLimiter({
  keyPrefix: "api:standard",
  ...RATE_LIMIT_PRESETS.API_STANDARD,
});

/** Expensive API rate limiter (30/min per client) */
export const apiExpensiveLimiter = createRateLimiter({
  keyPrefix: "api:expensive",
  ...RATE_LIMIT_PRESETS.API_EXPENSIVE,
});

/** Auth rate limiter (10/min per IP, fail-closed) */
export const authLimiter = createRateLimiter({
  keyPrefix: "auth",
  ...RATE_LIMIT_PRESETS.AUTH,
});

/** Password reset rate limiter (3/5min per IP, fail-closed) */
export const passwordResetLimiter = createRateLimiter({
  keyPrefix: "auth:password-reset",
  ...RATE_LIMIT_PRESETS.PASSWORD_RESET,
});

/** DataForSEO API rate limiter (5 req/sec, token bucket) */
export const dataForSeoLimiter = createRateLimiter({
  keyPrefix: "external:dataforseo",
  ...RATE_LIMIT_PRESETS.DATAFORSEO,
});

/** Analytics standard rate limiter (60/min per client) */
export const analyticsStandardLimiter = createRateLimiter({
  keyPrefix: "analytics:standard",
  ...RATE_LIMIT_PRESETS.ANALYTICS_STANDARD,
});

/** Analytics sync rate limiter (5/hour per client) */
export const analyticsSyncLimiter = createRateLimiter({
  keyPrefix: "analytics:sync",
  ...RATE_LIMIT_PRESETS.ANALYTICS_SYNC,
});

/** Portal standard rate limiter (60/min per client) */
export const portalStandardLimiter = createRateLimiter({
  keyPrefix: "portal:standard",
  ...RATE_LIMIT_PRESETS.PORTAL_STANDARD,
});

/** Portal export rate limiter (5/hour per client) */
export const portalExportLimiter = createRateLimiter({
  keyPrefix: "portal:export",
  ...RATE_LIMIT_PRESETS.PORTAL_EXPORT,
});

// =============================================================================
// Backward Compatibility Exports
// =============================================================================

/**
 * Legacy rateLimit function for backward compatibility.
 * Migrates to the new service using sliding window strategy.
 */
export async function rateLimit(options: {
  key: string;
  limit: number;
  window: number;
}): Promise<RateLimitResult> {
  return getRateLimitService().check(options.key, {
    strategy: "sliding-window",
    scope: "client",
    limit: options.limit,
    windowMs: options.window * 1000,
  });
}

/**
 * Legacy withRateLimit wrapper for backward compatibility.
 */
export function withRateLimit(
  options: {
    key: (request: Request) => string | Promise<string>;
    limit: number;
    window: number;
  },
  handler: RequestHandler
): RequestHandler {
  return async (request: Request): Promise<Response> => {
    const key = await Promise.resolve(options.key(request));
    const result = await rateLimit({
      key,
      limit: options.limit,
      window: options.window,
    });

    if (!result.allowed) {
      return rateLimitExceededResponse(result);
    }

    const response = await handler(request);
    return addRateLimitHeaders(response, result);
  };
}

// Export service type for type-only imports
export type { RateLimitServiceImpl as RateLimitService };
