/**
 * Unified Rate Limiting Service
 *
 * DUP-001 FIX: Consolidates 3 duplicate rate limiting implementations:
 * - middleware/rate-limit.ts (sliding window)
 * - lib/redis-rate-limiter.ts (token bucket)
 * - GscBridgeService inline rate limiting
 *
 * SEC-002 FIX: Fail-CLOSED behavior when Redis unavailable.
 * Uses in-memory fallback with stricter limits (50% of normal) instead of
 * failing open and allowing unlimited requests.
 *
 * Features:
 * - Unified sliding window algorithm (most appropriate for HTTP rate limiting)
 * - Multiple rate limit tiers (strict, standard, relaxed)
 * - Fail-closed with in-memory fallback at degraded limits
 * - Metrics and monitoring for fallback usage
 * - Health checks for Redis connectivity
 *
 * NOTE: This file uses redis.eval() which is the standard ioredis method for
 * executing Lua scripts on the Redis server. This is NOT JavaScript eval() and
 * is safe - Lua scripts run atomically on the Redis server, not in Node.js.
 */

import { redis, isCircuitBreakerClosed, recordRedisFailure, recordRedisSuccess } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "rate-limit-service" });

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Rate limit tier determines how strict limits are.
 */
export type RateLimitTier = "strict" | "standard" | "relaxed";

/**
 * Fail behavior when Redis is unavailable.
 */
export type FailBehavior = "closed" | "degraded";

/**
 * Configuration for a rate limit check.
 */
export interface RateLimitConfig {
  /** Unique key for this rate limit bucket (e.g., "gsc-refresh:{clientId}") */
  key: string;
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Rate limit tier determines fallback behavior */
  tier: RateLimitTier;
  /** Custom fallback percentage (defaults based on tier) */
  fallbackPercentage?: number;
}

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** When the rate limit resets (Unix timestamp in ms) */
  resetAt: Date;
  /** Total limit for reference */
  limit: number;
  /** Current request count in the window */
  current: number;
  /** Seconds until rate limit resets (for Retry-After header) */
  retryAfter?: number;
  /** Whether this result came from the fallback limiter */
  fromFallback: boolean;
}

/**
 * Metrics for monitoring rate limit service health.
 */
export interface RateLimitMetrics {
  /** Total rate limit checks performed */
  totalChecks: number;
  /** Checks that used the fallback limiter */
  fallbackChecks: number;
  /** Checks that were blocked */
  blockedChecks: number;
  /** Checks that resulted in errors */
  errorChecks: number;
  /** Last Redis error timestamp */
  lastRedisError?: Date;
  /** Time since service started */
  uptimeMs: number;
}

// =============================================================================
// In-Memory Fallback Rate Limiter
// =============================================================================

interface FallbackEntry {
  count: number;
  windowStart: number;
  resetAt: number;
}

/**
 * In-memory fallback rate limiter for when Redis is unavailable.
 * Uses simple fixed-window algorithm for simplicity.
 *
 * IMPORTANT: This is per-process, so in multi-worker deployments,
 * the effective limit is divided across workers. This is acceptable
 * because it's a degraded mode - some protection is better than none.
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
        limit,
        current: 1,
        fromFallback: true,
      };
    }

    // Check if over limit
    if (entry.count >= limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
        limit,
        current: entry.count,
        retryAfter: Math.max(1, retryAfter),
        fromFallback: true,
      };
    }

    // Increment and allow
    entry.count++;
    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: new Date(entry.resetAt),
      limit,
      current: entry.count,
      fromFallback: true,
    };
  }

  /**
   * Get current usage without incrementing.
   */
  getStatus(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry || now > entry.resetAt) {
      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(now + windowMs),
        limit,
        current: 0,
        fromFallback: true,
      };
    }

    return {
      allowed: entry.count < limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: new Date(entry.resetAt),
      limit,
      current: entry.count,
      fromFallback: true,
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

  /**
   * Enforce max entries limit by removing expired or oldest entries.
   */
  private enforceMaxEntries(): void {
    if (this.entries.size <= this.maxEntries) {
      return;
    }

    const now = Date.now();
    const toDelete: string[] = [];

    // First pass: mark expired entries
    for (const [key, entry] of this.entries) {
      if (now > entry.resetAt) {
        toDelete.push(key);
      }
    }

    // Delete expired
    for (const key of toDelete) {
      this.entries.delete(key);
    }

    // If still over limit, delete oldest entries
    if (this.entries.size > this.maxEntries) {
      const excess = this.entries.size - this.maxEntries;
      const keys = Array.from(this.entries.keys()).slice(0, excess);
      for (const key of keys) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup of expired entries.
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.entries) {
        if (now > entry.resetAt) {
          this.entries.delete(key);
        }
      }
    }, 60000); // Cleanup every minute

    // Unref so it doesn't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop the cleanup interval.
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// =============================================================================
// Rate Limit Service Implementation
// =============================================================================

/**
 * Lua script for atomic sliding window rate limiting.
 * Returns: [allowed (0/1), current_count, limit, oldest_timestamp_or_0]
 *
 * This script executes atomically on the Redis server via ioredis's eval() method.
 * It is NOT JavaScript eval() - Lua scripts are safe and run server-side.
 */
const RATE_LIMIT_LUA_SCRIPT = `
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
  -- Get oldest entry for retry-after calculation
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldest_ts = 0
  if oldest and #oldest >= 2 then
    oldest_ts = tonumber(oldest[2])
  end
  return {0, count, limit, oldest_ts}
end

-- Under limit - add new entry atomically
redis.call('ZADD', key, now, entry_id)
redis.call('EXPIRE', key, math.ceil(window / 1000) + 10)

return {1, count + 1, limit, 0}
`;

/**
 * Fallback limit percentages by tier.
 * Stricter tiers get more aggressive fallback limits.
 */
const FALLBACK_PERCENTAGES: Record<RateLimitTier, number> = {
  strict: 0.25, // 25% of normal limit
  standard: 0.5, // 50% of normal limit
  relaxed: 0.75, // 75% of normal limit
};

/**
 * Unified Rate Limit Service.
 *
 * Primary: Redis-based sliding window rate limiting.
 * Fallback: In-memory rate limiting with degraded limits.
 *
 * NEVER fails open - always rate limits, even if degraded.
 */
class RateLimitServiceImpl {
  private readonly fallbackLimiter: InMemoryFallbackLimiter;
  private readonly startTime: number;

  // Metrics
  private totalChecks = 0;
  private fallbackChecks = 0;
  private blockedChecks = 0;
  private errorChecks = 0;
  private lastRedisError?: Date;

  constructor() {
    this.fallbackLimiter = new InMemoryFallbackLimiter();
    this.startTime = Date.now();
  }

  /**
   * Check and update rate limit.
   *
   * @param config - Rate limit configuration
   * @returns Rate limit result with allowed status
   */
  async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    this.totalChecks++;

    const { key, limit, window, tier, fallbackPercentage } = config;
    const redisKey = this.buildRedisKey(key);
    const now = Date.now();
    const windowMs = window * 1000;

    // Generate unique entry ID
    const entryId = `${now}:${Math.random().toString(36).slice(2, 11)}`;

    // Check circuit breaker first
    if (!isCircuitBreakerClosed()) {
      log.warn("Circuit breaker open, using fallback rate limiter", { key: redisKey });
      return this.checkFallback(config, fallbackPercentage);
    }

    try {
      // Execute Lua script atomically via ioredis eval() - this is safe Redis Lua execution
      const result = await redis.eval(
        RATE_LIMIT_LUA_SCRIPT,
        1,
        redisKey,
        now.toString(),
        windowMs.toString(),
        limit.toString(),
        entryId
      ) as [number, number, number, number];

      recordRedisSuccess();

      const [allowed, currentCount, maxLimit, oldestTimestamp] = result;

      if (allowed === 0) {
        // Rate limit exceeded
        this.blockedChecks++;

        let retryAfter = window;
        if (oldestTimestamp > 0) {
          retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
          retryAfter = Math.max(1, Math.min(retryAfter, window));
        }

        log.warn("Rate limit exceeded", {
          key: redisKey,
          current: currentCount,
          limit: maxLimit,
          retryAfter,
          tier,
        });

        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(now + retryAfter * 1000),
          limit: maxLimit,
          current: currentCount,
          retryAfter,
          fromFallback: false,
        };
      }

      const remaining = Math.max(0, maxLimit - currentCount);

      log.debug("Rate limit check passed", {
        key: redisKey,
        current: currentCount,
        remaining,
        limit: maxLimit,
      });

      return {
        allowed: true,
        remaining,
        resetAt: new Date(now + windowMs),
        limit: maxLimit,
        current: currentCount,
        fromFallback: false,
      };
    } catch (error) {
      // SEC-002 FIX: Fail CLOSED, use fallback limiter with degraded limits
      recordRedisFailure();
      this.errorChecks++;
      this.lastRedisError = new Date();

      log.error(
        "Rate limit Redis error - using fallback limiter (FAIL CLOSED)",
        error instanceof Error ? error : new Error(String(error)),
        { key: redisKey, tier }
      );

      return this.checkFallback(config, fallbackPercentage);
    }
  }

  /**
   * Check rate limit status without incrementing.
   * Useful for monitoring and pre-flight checks.
   */
  async getStatus(config: RateLimitConfig): Promise<RateLimitResult> {
    const { key, limit, window } = config;
    const redisKey = this.buildRedisKey(key);
    const now = Date.now();
    const windowMs = window * 1000;
    const windowStart = now - windowMs;

    if (!isCircuitBreakerClosed()) {
      return this.fallbackLimiter.getStatus(key, this.getFallbackLimit(config), windowMs);
    }

    try {
      // Remove expired and count
      await redis.zremrangebyscore(redisKey, 0, windowStart);
      const currentCount = await redis.zcard(redisKey);
      recordRedisSuccess();

      const remaining = Math.max(0, limit - currentCount);

      return {
        allowed: currentCount < limit,
        remaining,
        resetAt: new Date(now + windowMs),
        limit,
        current: currentCount,
        fromFallback: false,
      };
    } catch (error) {
      recordRedisFailure();
      log.warn("Rate limit status check failed, using fallback", {
        key: redisKey,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.fallbackLimiter.getStatus(key, this.getFallbackLimit(config), windowMs);
    }
  }

  /**
   * Reset a rate limit key. Use only in tests or admin operations.
   */
  async resetLimit(key: string): Promise<void> {
    const redisKey = this.buildRedisKey(key);

    // Reset both Redis and fallback
    this.fallbackLimiter.reset(key);

    try {
      await redis.del(redisKey);
      log.info("Rate limit reset", { key: redisKey });
    } catch (error) {
      log.warn("Rate limit reset failed (Redis)", {
        key: redisKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if Redis is healthy for rate limiting.
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
   * Get current metrics for monitoring.
   */
  getMetrics(): RateLimitMetrics {
    return {
      totalChecks: this.totalChecks,
      fallbackChecks: this.fallbackChecks,
      blockedChecks: this.blockedChecks,
      errorChecks: this.errorChecks,
      lastRedisError: this.lastRedisError,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  /**
   * Get fallback limiter size (for monitoring).
   */
  getFallbackSize(): number {
    return this.fallbackLimiter.size();
  }

  /**
   * Shutdown the service (cleanup intervals).
   */
  shutdown(): void {
    this.fallbackLimiter.shutdown();
  }

  // --- Private Methods ---

  /**
   * Build the Redis key with prefix.
   */
  private buildRedisKey(key: string): string {
    if (key.startsWith("ratelimit:")) {
      return key;
    }
    return `ratelimit:${key}`;
  }

  /**
   * Calculate fallback limit based on tier.
   */
  private getFallbackLimit(config: RateLimitConfig): number {
    const percentage = config.fallbackPercentage ?? FALLBACK_PERCENTAGES[config.tier];
    return Math.max(1, Math.floor(config.limit * percentage));
  }

  /**
   * Check rate limit using fallback limiter.
   */
  private checkFallback(config: RateLimitConfig, customPercentage?: number): RateLimitResult {
    this.fallbackChecks++;

    const fallbackLimit = customPercentage
      ? Math.max(1, Math.floor(config.limit * customPercentage))
      : this.getFallbackLimit(config);

    const windowMs = config.window * 1000;
    const result = this.fallbackLimiter.check(config.key, fallbackLimit, windowMs);

    if (!result.allowed) {
      this.blockedChecks++;
    }

    // Update limit in result to show degraded limit
    return {
      ...result,
      limit: fallbackLimit,
    };
  }
}

// =============================================================================
// Singleton Export and Factory Functions
// =============================================================================

// Singleton instance
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

/**
 * Convenience function to check rate limit.
 * Equivalent to getRateLimitService().checkLimit(config).
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  return getRateLimitService().checkLimit(config);
}

/**
 * Create a rate limiter function for a specific configuration.
 * Returns a function that only needs the identifier.
 *
 * @example
 * ```ts
 * const gscRefreshLimiter = createRateLimiter({
 *   keyPrefix: "gsc-refresh",
 *   limit: 100,
 *   window: 86400, // 24 hours
 *   tier: "standard",
 * });
 *
 * const result = await gscRefreshLimiter(clientId);
 * if (!result.allowed) {
 *   return { error: "Rate limit exceeded" };
 * }
 * ```
 */
export function createRateLimiter(config: {
  keyPrefix: string;
  limit: number;
  window: number;
  tier: RateLimitTier;
  fallbackPercentage?: number;
}): (identifier: string) => Promise<RateLimitResult> {
  return (identifier: string) =>
    checkRateLimit({
      key: `${config.keyPrefix}:${identifier}`,
      limit: config.limit,
      window: config.window,
      tier: config.tier,
      fallbackPercentage: config.fallbackPercentage,
    });
}

// =============================================================================
// Pre-configured Rate Limiters
// =============================================================================

/**
 * Rate limit configurations for common use cases.
 */
export const RATE_LIMIT_CONFIGS = {
  // GSC Bridge - 100 calls/day/client (SEC-002 fix)
  GSC_BRIDGE: {
    keyPrefix: "gsc-bridge",
    limit: 100,
    window: 86400, // 24 hours
    tier: "standard" as RateLimitTier,
  },

  // Audit run checks - 10/min (resource intensive)
  AUDIT_RUN_CHECKS: {
    keyPrefix: "audit:run-checks",
    limit: 10,
    window: 60,
    tier: "standard" as RateLimitTier,
  },

  // Content validation - 10/min
  CONTENT_VALIDATE: {
    keyPrefix: "seo:content:validate",
    limit: 10,
    window: 60,
    tier: "standard" as RateLimitTier,
  },

  // Link suggestions - 30/min (lighter operation)
  LINK_SUGGESTIONS: {
    keyPrefix: "seo:links:suggestions",
    limit: 30,
    window: 60,
    tier: "relaxed" as RateLimitTier,
  },

  // Authentication - 10/min (strict)
  AUTH: {
    keyPrefix: "auth",
    limit: 10,
    window: 60,
    tier: "strict" as RateLimitTier,
  },

  // Password reset - 3/5min (very strict)
  PASSWORD_RESET: {
    keyPrefix: "auth:password-reset",
    limit: 3,
    window: 300,
    tier: "strict" as RateLimitTier,
  },

  // Signup - 5/5min (prevent enumeration)
  SIGNUP: {
    keyPrefix: "auth:signup",
    limit: 5,
    window: 300,
    tier: "strict" as RateLimitTier,
  },

  // Content generation - 20/min (AI operations)
  CONTENT_GENERATE: {
    keyPrefix: "content:generate",
    limit: 20,
    window: 60,
    tier: "standard" as RateLimitTier,
  },

  // Brief generation - 10/min (AI operations)
  BRIEF_GENERATE: {
    keyPrefix: "brief:generate",
    limit: 10,
    window: 60,
    tier: "standard" as RateLimitTier,
  },

  // Keyword enrichment - 30/min (external API)
  KEYWORD_ENRICH: {
    keyPrefix: "keyword:enrich",
    limit: 30,
    window: 60,
    tier: "standard" as RateLimitTier,
  },

  // SERP analysis - 20/min (external API)
  SERP_ANALYZE: {
    keyPrefix: "serp:analyze",
    limit: 20,
    window: 60,
    tier: "standard" as RateLimitTier,
  },

  // Admin endpoints - 10/min (strict)
  ADMIN: {
    keyPrefix: "admin",
    limit: 10,
    window: 60,
    tier: "strict" as RateLimitTier,
  },

  // Portal standard - 60/min
  PORTAL_STANDARD: {
    keyPrefix: "portal:standard",
    limit: 60,
    window: 60,
    tier: "relaxed" as RateLimitTier,
  },

  // Portal expensive - 30/min
  PORTAL_EXPENSIVE: {
    keyPrefix: "portal:expensive",
    limit: 30,
    window: 60,
    tier: "standard" as RateLimitTier,
  },

  // Portal export - 5/hour
  PORTAL_EXPORT: {
    keyPrefix: "portal:export",
    limit: 5,
    window: 3600,
    tier: "standard" as RateLimitTier,
  },

  // Analytics standard - 60/min
  ANALYTICS_STANDARD: {
    keyPrefix: "analytics:standard",
    limit: 60,
    window: 60,
    tier: "relaxed" as RateLimitTier,
  },

  // Analytics expensive - 30/min
  ANALYTICS_EXPENSIVE: {
    keyPrefix: "analytics:expensive",
    limit: 30,
    window: 60,
    tier: "standard" as RateLimitTier,
  },

  // Analytics sync - 5/hour (prevent quota exhaustion)
  ANALYTICS_SYNC: {
    keyPrefix: "analytics:sync",
    limit: 5,
    window: 3600,
    tier: "strict" as RateLimitTier,
  },

  // Scraping critical ops - 2/min
  SCRAPING_CRITICAL: {
    keyPrefix: "scraping:admin:critical",
    limit: 2,
    window: 60,
    tier: "strict" as RateLimitTier,
  },

  // Scraping state change - 5/min
  SCRAPING_STATE_CHANGE: {
    keyPrefix: "scraping:admin:state",
    limit: 5,
    window: 60,
    tier: "strict" as RateLimitTier,
  },

  // Scraping resource intensive - 10/min
  SCRAPING_RESOURCE: {
    keyPrefix: "scraping:admin:resource",
    limit: 10,
    window: 60,
    tier: "standard" as RateLimitTier,
  },

  // Default fallback - 60/min
  DEFAULT: {
    keyPrefix: "default",
    limit: 60,
    window: 60,
    tier: "relaxed" as RateLimitTier,
  },
} as const;

// Pre-configured limiters for common use cases
export const gscBridgeRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.GSC_BRIDGE);
export const auditRunChecksRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.AUDIT_RUN_CHECKS);
export const contentValidateRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.CONTENT_VALIDATE);
export const linkSuggestionsRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.LINK_SUGGESTIONS);
export const authRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.AUTH);
export const passwordResetRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.PASSWORD_RESET);
export const signupRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.SIGNUP);
export const contentGenerateRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.CONTENT_GENERATE);
export const briefGenerateRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.BRIEF_GENERATE);
export const keywordEnrichRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.KEYWORD_ENRICH);
export const serpAnalyzeRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.SERP_ANALYZE);
export const adminRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.ADMIN);
export const portalStandardRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.PORTAL_STANDARD);
export const portalExpensiveRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.PORTAL_EXPENSIVE);
export const portalExportRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.PORTAL_EXPORT);
export const analyticsStandardRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.ANALYTICS_STANDARD);
export const analyticsExpensiveRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.ANALYTICS_EXPENSIVE);
export const analyticsSyncRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.ANALYTICS_SYNC);
export const scrapingCriticalRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.SCRAPING_CRITICAL);
export const scrapingStateChangeRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.SCRAPING_STATE_CHANGE);
export const scrapingResourceRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.SCRAPING_RESOURCE);
export const defaultRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.DEFAULT);

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
    "X-RateLimit-Limit": result.limit.toString(),
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
      degraded: result.fromFallback,
    }),
    { status: 429, headers }
  );
}

/**
 * Add rate limit headers to a successful response.
 */
export function addRateLimitHeaders(response: Response, result: RateLimitResult): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-RateLimit-Limit", result.limit.toString());
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
 * Create rate limit headers object for custom responses.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
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
// Route Handler Wrapper
// =============================================================================

/**
 * Route handler type.
 */
export type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Options for withRateLimit wrapper.
 */
export interface WithRateLimitOptions {
  /** Function to extract the rate limit key from the request */
  key: (request: Request) => string | Promise<string>;
  /** Maximum requests allowed */
  limit: number;
  /** Window in seconds */
  window: number;
  /** Rate limit tier */
  tier: RateLimitTier;
  /** Custom fallback percentage */
  fallbackPercentage?: number;
}

/**
 * Wrap a route handler with rate limiting.
 */
export function withRateLimit(
  options: WithRateLimitOptions,
  handler: RouteHandler
): RouteHandler {
  return async (request: Request): Promise<Response> => {
    const key = await Promise.resolve(options.key(request));

    const result = await checkRateLimit({
      key,
      limit: options.limit,
      window: options.window,
      tier: options.tier,
      fallbackPercentage: options.fallbackPercentage,
    });

    if (!result.allowed) {
      return rateLimitExceededResponse(result);
    }

    const response = await handler(request);
    return addRateLimitHeaders(response, result);
  };
}

// Export types for consumers
export type { RateLimitServiceImpl as RateLimitService };
