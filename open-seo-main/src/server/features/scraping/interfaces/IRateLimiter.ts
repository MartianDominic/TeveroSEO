/**
 * Rate Limiter Interface.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

/**
 * Rate limiter configuration.
 */
export interface RateLimiterConfig {
  /** Max requests per window per domain. Default: 2 */
  requestsPerWindow: number;

  /** Window size in milliseconds. Default: 1000 */
  windowMs: number;

  /** Maximum time to wait for a slot. Default: 30000 */
  maxWaitMs: number;

  /** Enable adaptive backoff on 429/503. Default: true */
  enableAdaptiveBackoff: boolean;
}

/**
 * Rate limit status for a specific domain.
 */
export interface RateLimitStatus {
  /** Original domain provided */
  domain: string;

  /** Normalized domain (subdomains grouped) */
  normalizedDomain: string;

  /** Number of requests in current window */
  requestsInWindow: number;

  /** Window size in milliseconds */
  windowMs: number;

  /** Maximum requests allowed per window */
  maxRequests: number;

  /** Effective limit after adaptive backoff adjustments */
  effectiveLimit: number;

  /** Whether the domain is currently throttled */
  isThrottled: boolean;

  /** Current backoff multiplier (1 = no backoff) */
  backoffMultiplier: number;

  /** Timestamp when next request will be allowed (if throttled) */
  nextAllowedAt?: number;
}

/**
 * Rate limiter interface for per-domain request throttling.
 */
export interface IRateLimiter {
  /**
   * Acquire permission to make a request to the given domain.
   * Blocks until the rate limit allows the request.
   *
   * @param domain - The target domain (will be normalized)
   * @throws RateLimitExceededError if maxWaitMs exceeded
   */
  acquire(domain: string): Promise<void>;

  /**
   * Get current rate limit status for a domain.
   */
  getStatus(domain: string): Promise<RateLimitStatus>;

  /**
   * Manually release a slot (not typically needed, slots auto-expire).
   */
  release(domain: string): Promise<void>;

  /**
   * Get all domains currently being rate limited.
   */
  getActiveDomains(): Promise<string[]>;
}
