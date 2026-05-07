/**
 * Per-Domain Rate Limiter with Redis Sliding Window Algorithm.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Features:
 * - 2 req/sec per domain (configurable)
 * - Distributed state via Redis sorted sets
 * - Domain normalization (subdomains share limits)
 * - Blocking acquire with max wait timeout
 */

import type Redis from "ioredis";
import type { IRateLimiter, RateLimitStatus, RateLimiterConfig } from "../interfaces/IRateLimiter";

/**
 * Error thrown when rate limit wait time exceeds maxWaitMs.
 */
export class RateLimitExceededError extends Error {
  constructor(
    public readonly domain: string,
    public readonly waitedMs: number
  ) {
    super(`Rate limit exceeded for ${domain} after waiting ${waitedMs}ms`);
    this.name = "RateLimitExceededError";
  }
}

/**
 * Sleep utility for async delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default rate limiter configuration.
 */
const DEFAULT_CONFIG: RateLimiterConfig = {
  requestsPerWindow: 2,
  windowMs: 1000,
  maxWaitMs: 30_000,
  enableAdaptiveBackoff: true,
};

/**
 * Known compound TLDs for proper domain normalization.
 */
const KNOWN_COMPOUND_TLDS = [
  "co.uk",
  "com.au",
  "co.nz",
  "org.uk",
  "com.br",
  "co.jp",
  "co.kr",
  "com.mx",
  "co.in",
  "com.cn",
  "co.za",
  "com.ar",
  "com.tr",
  "co.th",
  "com.sg",
  "com.my",
  "co.id",
  "com.ph",
  "com.vn",
  "com.tw",
  "com.hk",
] as const;

/**
 * Redis-based sliding window rate limiter.
 *
 * Uses sorted sets to track request timestamps per domain.
 * This approach handles distributed workers correctly since all
 * workers share the same Redis state.
 */
export class RateLimiter implements IRateLimiter {
  private readonly redis: Redis;
  private readonly config: RateLimiterConfig;

  /**
   * Lua script for atomic sliding window check + insert.
   *
   * KEYS[1]: Rate limit key (e.g., "ratelimit:domain:example.com")
   * ARGV[1]: Current timestamp (ms)
   * ARGV[2]: Window start timestamp (ms)
   * ARGV[3]: Max requests per window
   * ARGV[4]: Request ID (unique per request)
   * ARGV[5]: Window size in ms
   *
   * Returns: 0 if request allowed, otherwise ms to wait
   *
   * Note: This uses Redis EVAL command for Lua scripting (safe server-side execution).
   */
  private readonly SLIDING_WINDOW_SCRIPT = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local windowStart = tonumber(ARGV[2])
    local maxRequests = tonumber(ARGV[3])
    local requestId = ARGV[4]
    local windowMs = tonumber(ARGV[5])

    -- Remove expired entries outside the current window
    redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

    -- Count requests in current window
    local count = redis.call('ZCARD', key)

    if count < maxRequests then
      -- Allowed: add request timestamp and return 0 (no wait)
      redis.call('ZADD', key, now, requestId)
      redis.call('PEXPIRE', key, windowMs * 2)
      return 0
    else
      -- Denied: calculate wait time until oldest entry expires
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      if oldest[2] then
        local waitMs = tonumber(oldest[2]) - windowStart + 1
        return waitMs > 0 and waitMs or 1
      end
      return windowMs
    end
  `;

  constructor(redis: Redis, config: Partial<RateLimiterConfig> = {}) {
    this.redis = redis;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Acquire permission to make a request to the given domain.
   * Blocks until the rate limit allows the request.
   *
   * @param domain - The target domain (will be normalized)
   * @throws RateLimitExceededError if maxWaitMs exceeded
   */
  async acquire(domain: string): Promise<void> {
    const normalizedDomain = this.normalizeDomain(domain);
    const key = `ratelimit:domain:${normalizedDomain}`;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const startTime = Date.now();

    while (true) {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;

      // Redis EVAL executes Lua script server-side (not JavaScript eval)
      const waitMs = (await this.redis.call(
        "EVAL",
        this.SLIDING_WINDOW_SCRIPT,
        1,
        key,
        now.toString(),
        windowStart.toString(),
        this.config.requestsPerWindow.toString(),
        requestId,
        this.config.windowMs.toString()
      )) as number;

      if (waitMs === 0) {
        // Request allowed
        return;
      }

      // Check if we've waited too long
      if (Date.now() - startTime > this.config.maxWaitMs) {
        throw new RateLimitExceededError(normalizedDomain, Date.now() - startTime);
      }

      // Wait and retry (cap wait at 1s to allow checking timeout)
      await sleep(Math.min(waitMs, 1000));
    }
  }

  /**
   * Get current rate limit status for a domain.
   */
  async getStatus(domain: string): Promise<RateLimitStatus> {
    const normalizedDomain = this.normalizeDomain(domain);
    const key = `ratelimit:domain:${normalizedDomain}`;
    const backoffKey = `backoff:domain:${normalizedDomain}`;

    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Clean up expired entries first
    await this.redis.zremrangebyscore(key, "-inf", windowStart.toString());

    // Get count and oldest entry
    const [count, oldest] = await Promise.all([
      this.redis.zcard(key),
      this.redis.zrange(key, 0, 0, "WITHSCORES"),
    ]);

    // Get backoff status
    const backoffData = await this.redis.get(backoffKey);
    let backoffMultiplier = 1;
    if (backoffData) {
      try {
        const parsed = JSON.parse(backoffData);
        backoffMultiplier = parsed.multiplier || 1;
      } catch {
        // Ignore parse errors
      }
    }

    const effectiveLimit = Math.max(0.1, this.config.requestsPerWindow / backoffMultiplier);
    const isThrottled = count >= effectiveLimit;

    let nextAllowedAt: number | undefined;
    if (oldest.length >= 2 && isThrottled) {
      const oldestTimestamp = parseInt(oldest[1], 10);
      nextAllowedAt = oldestTimestamp + this.config.windowMs;
    }

    return {
      domain,
      normalizedDomain,
      requestsInWindow: count,
      windowMs: this.config.windowMs,
      maxRequests: this.config.requestsPerWindow,
      effectiveLimit,
      isThrottled,
      backoffMultiplier,
      nextAllowedAt,
    };
  }

  /**
   * Manually release a slot (not typically needed, slots auto-expire).
   */
  async release(domain: string): Promise<void> {
    const normalizedDomain = this.normalizeDomain(domain);
    const key = `ratelimit:domain:${normalizedDomain}`;

    // Remove the most recent entry (FIFO release)
    const entries = await this.redis.zrange(key, -1, -1);
    if (entries.length > 0) {
      await this.redis.zrem(key, entries[0]);
    }
  }

  /**
   * Get all domains currently being rate limited.
   */
  async getActiveDomains(): Promise<string[]> {
    const keys = await this.redis.keys("ratelimit:domain:*");
    return keys.map((key) => key.replace("ratelimit:domain:", ""));
  }

  /**
   * Normalize domain for rate limiting.
   * Subdomains share limits with their parent domain.
   *
   * @param domain - Domain to normalize (may include protocol)
   * @returns Normalized base domain
   */
  normalizeDomain(domain: string): string {
    // Remove protocol if present
    let hostname = domain.replace(/^https?:\/\//, "").split("/")[0];

    // Remove port if present
    hostname = hostname.split(":")[0];

    // Remove trailing dots
    hostname = hostname.replace(/\.+$/, "");

    // Convert to lowercase
    hostname = hostname.toLowerCase();

    // Extract base domain (handles subdomains)
    const parts = hostname.split(".");

    // Handle common cases
    if (parts.length >= 2) {
      // Check for compound TLDs (e.g., co.uk, com.au)
      const possibleCompoundTld = parts.slice(-2).join(".");

      if (KNOWN_COMPOUND_TLDS.includes(possibleCompoundTld as (typeof KNOWN_COMPOUND_TLDS)[number]) && parts.length >= 3) {
        // Compound TLD: return last 3 parts (e.g., example.co.uk)
        return parts.slice(-3).join(".");
      }

      // Standard case: return last 2 parts (e.g., example.com)
      return parts.slice(-2).join(".");
    }

    return hostname;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): RateLimiterConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (for testing or dynamic adjustment).
   */
  updateConfig(updates: Partial<RateLimiterConfig>): void {
    Object.assign(this.config, updates);
  }
}
