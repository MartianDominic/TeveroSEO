/**
 * Redis-backed Token Bucket Rate Limiter for distributed systems.
 *
 * Unlike in-memory rate limiters, this implementation shares state across
 * all workers via Redis, ensuring consistent rate limiting in multi-process
 * deployments (BullMQ workers, multiple Node.js instances).
 *
 * Uses the token bucket algorithm with Redis for atomic operations.
 *
 * M-13 FIX: Added fail-closed mode for sensitive endpoints and health checks.
 */

import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "redis-rate-limiter" });

/**
 * Rate limiter behavior when Redis is unavailable.
 * - "fail-open": Allow request through (default, preserves availability)
 * - "fail-closed": Block request (use for sensitive endpoints)
 */
export type FailMode = "fail-open" | "fail-closed";

/**
 * Configuration options for rate limiter.
 */
export interface RateLimiterOptions {
  /** Rate limiter name (used as Redis key prefix) */
  name: string;
  /** Tokens added per second */
  tokensPerSecond: number;
  /** Maximum burst capacity (defaults to tokensPerSecond) */
  maxBurst?: number;
  /** Behavior when Redis is unavailable (defaults to fail-open) */
  failMode?: FailMode;
}

/**
 * Redis-backed token bucket rate limiter.
 *
 * All state is stored in Redis, making it shared across all workers/processes.
 * Uses Lua scripting for atomic token acquisition to prevent race conditions.
 *
 * M-13 FIX: Added fail-closed mode support for sensitive endpoints.
 */
export class RedisRateLimiter {
  private readonly key: string;
  private readonly maxTokens: number;
  private readonly refillRatePerMs: number;
  private readonly refillRatePerSecond: number;
  private readonly failMode: FailMode;
  private readonly name: string;

  /**
   * Create a new Redis-backed rate limiter.
   *
   * @param name - Unique name for this rate limiter (e.g., "dataforseo")
   * @param tokensPerSecond - Rate of token refill per second
   * @param maxBurst - Maximum tokens that can accumulate (default: tokensPerSecond)
   * @param failMode - Behavior when Redis unavailable (default: fail-open)
   */
  constructor(
    name: string,
    tokensPerSecond: number,
    maxBurst?: number,
    failMode: FailMode = "fail-open"
  ) {
    this.name = name;
    this.key = `ratelimit:${name}`;
    this.maxTokens = maxBurst ?? tokensPerSecond;
    this.refillRatePerSecond = tokensPerSecond;
    this.refillRatePerMs = tokensPerSecond / 1000;
    this.failMode = failMode;
  }

  /**
   * Create rate limiter with options object (preferred for new code).
   */
  static create(options: RateLimiterOptions): RedisRateLimiter {
    return new RedisRateLimiter(
      options.name,
      options.tokensPerSecond,
      options.maxBurst,
      options.failMode ?? "fail-open"
    );
  }

  /**
   * Lua script for atomic token acquisition.
   * Returns: [success (0/1), tokens_remaining, wait_time_ms]
   *
   * The script:
   * 1. Gets current state (tokens, lastRefill)
   * 2. Calculates tokens to add based on elapsed time
   * 3. Attempts to consume a token
   * 4. Returns result atomically
   */
  private readonly acquireScript = `
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
   * Acquire a token, waiting if necessary.
   * Returns a promise that resolves when a token is available.
   *
   * @param maxWaitMs - Maximum time to wait for a token (default: 30000ms)
   * @throws Error if token cannot be acquired within maxWaitMs
   */
  async acquire(maxWaitMs = 30000): Promise<void> {
    const startTime = Date.now();
    const ttlSeconds = 300; // 5 minute TTL for rate limiter state

    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Note: redis.eval is the ioredis method for running Lua scripts on Redis server
        // This is NOT JavaScript eval() - it's safe and required for atomic Redis operations
        const result = await redis.eval(
          this.acquireScript,
          1,
          this.key,
          this.maxTokens.toString(),
          this.refillRatePerMs.toString(),
          Date.now().toString(),
          ttlSeconds.toString(),
        ) as [number, number, number];

        const [success, , waitTimeMs] = result;

        if (success === 1) {
          return; // Token acquired
        }

        // Wait before retrying
        const actualWait = Math.min(waitTimeMs, maxWaitMs - (Date.now() - startTime));
        if (actualWait <= 0) {
          break;
        }

        await this.sleep(actualWait);
      } catch (error) {
        // M-13 FIX: Respect fail mode when Redis is unavailable
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (this.failMode === "fail-closed") {
          log.error("Rate limiter Redis error, BLOCKING request (fail-closed mode)", undefined, {
            name: this.key,
            errorMsg,
          });
          throw new Error(
            `Rate limiter unavailable (fail-closed): Redis error for ${this.key}`
          );
        }

        // Fail-open: Allow the request but log a warning
        log.warn("Rate limiter Redis error, allowing request (fail-open mode)", {
          name: this.key,
          error: errorMsg,
        });
        return;
      }
    }

    throw new Error(
      `Rate limit exceeded: could not acquire token within ${maxWaitMs}ms for ${this.key}`,
    );
  }

  /**
   * Try to acquire a token without waiting.
   * Returns true if token was acquired, false otherwise.
   */
  async tryAcquire(): Promise<boolean> {
    try {
      const ttlSeconds = 300;
      // Note: redis.eval is the ioredis method for running Lua scripts on Redis server
      const result = await redis.eval(
        this.acquireScript,
        1,
        this.key,
        this.maxTokens.toString(),
        this.refillRatePerMs.toString(),
        Date.now().toString(),
        ttlSeconds.toString(),
      ) as [number, number, number];

      return result[0] === 1;
    } catch (error) {
      // M-13 FIX: Respect fail mode when Redis is unavailable
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (this.failMode === "fail-closed") {
        log.error("Rate limiter tryAcquire failed, BLOCKING request (fail-closed mode)", undefined, {
          name: this.key,
          errorMsg,
        });
        return false; // Block request
      }

      log.warn("Rate limiter tryAcquire failed, allowing request (fail-open mode)", {
        name: this.key,
        error: errorMsg,
      });
      return true; // Allow request
    }
  }

  /**
   * Get current rate limiter state for monitoring.
   */
  async getState(): Promise<{
    tokens: number;
    maxTokens: number;
    refillRatePerSecond: number;
  }> {
    try {
      const state = await redis.hgetall(this.key);
      const tokens = parseFloat(state.tokens || String(this.maxTokens));
      return {
        tokens: Math.max(0, Math.min(this.maxTokens, tokens)),
        maxTokens: this.maxTokens,
        refillRatePerSecond: this.refillRatePerSecond,
      };
    } catch {
      return {
        tokens: this.maxTokens,
        maxTokens: this.maxTokens,
        refillRatePerSecond: this.refillRatePerSecond,
      };
    }
  }

  /**
   * Reset rate limiter to full capacity.
   */
  async reset(): Promise<void> {
    try {
      await redis.del(this.key);
      log.info("Rate limiter reset", { name: this.key });
    } catch (error) {
      log.warn("Rate limiter reset failed", {
        name: this.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * M-13 FIX: Health check for Redis connectivity.
   * Returns true if Redis is reachable and rate limiter is functional.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const testKey = `${this.key}:health`;
      await redis.set(testKey, "1", "EX", 5);
      const result = await redis.get(testKey);
      return result === "1";
    } catch (error) {
      log.warn("Rate limiter health check failed", {
        name: this.key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get the fail mode for this rate limiter.
   */
  getFailMode(): FailMode {
    return this.failMode;
  }

  /**
   * Get the rate limiter name.
   */
  getName(): string {
    return this.name;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-configured Rate Limiters for External APIs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limiter for DataForSEO API.
 * 5 requests per second with burst capacity of 5.
 */
export const dataForSeoRateLimiter = new RedisRateLimiter("dataforseo", 5, 5);

/**
 * Rate limiter for Anthropic Claude API.
 * 10 requests per second with burst capacity of 10.
 */
export const anthropicRateLimiter = new RedisRateLimiter("anthropic", 10, 10);

/**
 * Rate limiter for OpenAI API.
 * 10 requests per second with burst capacity of 10.
 */
export const openaiRateLimiter = new RedisRateLimiter("openai", 10, 10);

/**
 * Rate limiter for SERP API.
 * 5 requests per second with burst capacity of 5.
 */
export const serpApiRateLimiter = new RedisRateLimiter("serpapi", 5, 5);

/**
 * Rate limiter for Jina AI API.
 * 10 requests per second with burst capacity of 10.
 */
export const jinaRateLimiter = new RedisRateLimiter("jina", 10, 10);

// ─────────────────────────────────────────────────────────────────────────────
// Fail-Closed Rate Limiters for Sensitive Endpoints (M-13)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limiter for authentication endpoints.
 * 5 requests per second, fail-closed to prevent auth abuse if Redis down.
 */
export const authRateLimiter = RedisRateLimiter.create({
  name: "auth",
  tokensPerSecond: 5,
  maxBurst: 10,
  failMode: "fail-closed",
});

/**
 * Rate limiter for payment/billing endpoints.
 * 3 requests per second, fail-closed to prevent abuse if Redis down.
 */
export const billingRateLimiter = RedisRateLimiter.create({
  name: "billing",
  tokensPerSecond: 3,
  maxBurst: 5,
  failMode: "fail-closed",
});

/**
 * Rate limiter for webhook endpoints.
 * 20 requests per second, fail-closed to prevent webhook flooding if Redis down.
 */
export const webhookRateLimiter = RedisRateLimiter.create({
  name: "webhook",
  tokensPerSecond: 20,
  maxBurst: 50,
  failMode: "fail-closed",
});

// ─────────────────────────────────────────────────────────────────────────────
// Health Check Utility (M-13)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check health of all rate limiters.
 * Returns status of each rate limiter's Redis connectivity.
 */
export async function checkRateLimiterHealth(): Promise<{
  healthy: boolean;
  limiters: Array<{ name: string; healthy: boolean; failMode: FailMode }>;
}> {
  const limiters = [
    dataForSeoRateLimiter,
    anthropicRateLimiter,
    openaiRateLimiter,
    serpApiRateLimiter,
    jinaRateLimiter,
    authRateLimiter,
    billingRateLimiter,
    webhookRateLimiter,
  ];

  const results = await Promise.all(
    limiters.map(async (limiter) => ({
      name: limiter.getName(),
      healthy: await limiter.isHealthy(),
      failMode: limiter.getFailMode(),
    }))
  );

  // Overall health: all fail-closed limiters must be healthy
  const failClosedUnhealthy = results.some(
    (r) => r.failMode === "fail-closed" && !r.healthy
  );

  return {
    healthy: !failClosedUnhealthy,
    limiters: results,
  };
}
