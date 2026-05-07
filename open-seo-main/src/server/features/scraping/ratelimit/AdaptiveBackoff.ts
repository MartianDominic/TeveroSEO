/**
 * Adaptive Backoff for 429/503 Responses.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * When receiving rate limit (429) or service unavailable (503) responses,
 * the system increases per-domain delays with exponential backoff.
 *
 * Backoff Escalation:
 * | Consecutive Failures | Multiplier | Effective Rate | Duration |
 * |----------------------|------------|----------------|----------|
 * | 1                    | 1x         | 2 req/s        | 60s      |
 * | 2                    | 2x         | 1 req/s        | 120s     |
 * | 3                    | 4x         | 0.5 req/s      | 240s     |
 * | 4                    | 8x         | 0.25 req/s     | 480s     |
 * | 5+                   | 16x        | 0.125 req/s    | 960s     |
 */

import type Redis from "ioredis";

/**
 * Backoff state stored in Redis.
 */
export interface BackoffState {
  /** Current multiplier (1, 2, 4, 8, 16) */
  multiplier: number;

  /** Timestamp when backoff expires */
  until: number;

  /** Last HTTP status code that triggered backoff */
  lastError: number;

  /** Number of consecutive failures */
  consecutiveFailures: number;

  /** Timestamp of first failure in this backoff sequence */
  firstFailureAt: number;
}

/**
 * Configuration for adaptive backoff.
 */
export interface AdaptiveBackoffConfig {
  /** Maximum multiplier (default: 16) */
  maxMultiplier: number;

  /** Base duration for 429 errors in ms (default: 60000) */
  baseDuration429: number;

  /** Base duration for 503 errors in ms (default: 30000) */
  baseDuration503: number;

  /** Base duration for other errors in ms (default: 15000) */
  baseDurationOther: number;
}

/**
 * Default adaptive backoff configuration.
 */
const DEFAULT_CONFIG: AdaptiveBackoffConfig = {
  maxMultiplier: 16,
  baseDuration429: 60_000,
  baseDuration503: 30_000,
  baseDurationOther: 15_000,
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
 * Adaptive backoff manager for rate-limited or unavailable domains.
 *
 * Tracks per-domain backoff state in Redis and provides methods to:
 * - Record failures and increase backoff
 * - Record successes and decrease backoff
 * - Get effective rate limits for domains
 */
export class AdaptiveBackoff {
  private readonly redis: Redis;
  private readonly config: AdaptiveBackoffConfig;

  constructor(redis: Redis, config: Partial<AdaptiveBackoffConfig> = {}) {
    this.redis = redis;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a failure for a domain, increasing backoff.
   *
   * @param domain - The domain that failed
   * @param statusCode - HTTP status code (429, 503, etc.)
   */
  async recordFailure(domain: string, statusCode: number): Promise<BackoffState> {
    const key = `backoff:domain:${this.normalizeDomain(domain)}`;
    const currentData = await this.redis.get(key);
    const now = Date.now();

    let state: BackoffState;

    if (currentData) {
      try {
        const current = JSON.parse(currentData) as BackoffState;
        // Double the multiplier on each failure, up to max
        const newMultiplier = Math.min(current.multiplier * 2, this.config.maxMultiplier);

        state = {
          multiplier: newMultiplier,
          until: now + this.getBackoffDuration(statusCode, newMultiplier),
          lastError: statusCode,
          consecutiveFailures: current.consecutiveFailures + 1,
          firstFailureAt: current.firstFailureAt,
        };
      } catch {
        // Parse error, start fresh
        state = this.createInitialState(statusCode, now);
      }
    } else {
      state = this.createInitialState(statusCode, now);
    }

    // Store with TTL based on backoff duration
    const ttlSeconds = Math.ceil((state.until - now) / 1000) + 60; // Add 60s buffer
    await this.redis.setex(key, ttlSeconds, JSON.stringify(state));

    return state;
  }

  /**
   * Record a success for a domain, decreasing backoff.
   *
   * @param domain - The domain that succeeded
   */
  async recordSuccess(domain: string): Promise<void> {
    const key = `backoff:domain:${this.normalizeDomain(domain)}`;
    const currentData = await this.redis.get(key);

    if (!currentData) {
      return; // No backoff state to clear
    }

    try {
      const current = JSON.parse(currentData) as BackoffState;

      // Reduce multiplier on success, but don't remove entirely
      // This prevents oscillation and provides "memory" of past issues
      const newMultiplier = Math.max(1, current.multiplier / 2);

      if (newMultiplier <= 1) {
        // Fully recovered, remove backoff state
        await this.redis.del(key);
      } else {
        // Partially recovered, reduce multiplier
        const now = Date.now();
        const state: BackoffState = {
          ...current,
          multiplier: newMultiplier,
          until: now + 300_000, // 5 min TTL for reduced state
        };
        await this.redis.setex(key, 300, JSON.stringify(state));
      }
    } catch {
      // Parse error, just delete the key
      await this.redis.del(key);
    }
  }

  /**
   * Get the effective rate limit for a domain.
   *
   * @param domain - The domain to check
   * @param baseLimit - The base rate limit (e.g., 2 req/sec)
   * @returns Effective limit after backoff adjustment
   */
  async getEffectiveLimit(domain: string, baseLimit: number): Promise<number> {
    const key = `backoff:domain:${this.normalizeDomain(domain)}`;
    const currentData = await this.redis.get(key);

    if (!currentData) {
      return baseLimit;
    }

    try {
      const state = JSON.parse(currentData) as BackoffState;
      const now = Date.now();

      if (now < state.until) {
        // Still in backoff period, reduce rate limit
        return Math.max(0.1, baseLimit / state.multiplier);
      }

      // Backoff expired but state still exists, use reduced multiplier
      return Math.max(0.5, baseLimit / Math.max(1, state.multiplier / 2));
    } catch {
      return baseLimit;
    }
  }

  /**
   * Get the current backoff state for a domain.
   *
   * @param domain - The domain to check
   * @returns BackoffState or null if no backoff
   */
  async getState(domain: string): Promise<BackoffState | null> {
    const key = `backoff:domain:${this.normalizeDomain(domain)}`;
    const currentData = await this.redis.get(key);

    if (!currentData) {
      return null;
    }

    try {
      return JSON.parse(currentData) as BackoffState;
    } catch {
      return null;
    }
  }

  /**
   * Check if a domain is currently in backoff.
   *
   * @param domain - The domain to check
   * @returns True if domain is in active backoff
   */
  async isInBackoff(domain: string): Promise<boolean> {
    const state = await this.getState(domain);
    if (!state) {
      return false;
    }
    return Date.now() < state.until;
  }

  /**
   * Get remaining backoff time for a domain in milliseconds.
   *
   * @param domain - The domain to check
   * @returns Remaining backoff time in ms, or 0 if not in backoff
   */
  async getRemainingBackoffMs(domain: string): Promise<number> {
    const state = await this.getState(domain);
    if (!state) {
      return 0;
    }
    return Math.max(0, state.until - Date.now());
  }

  /**
   * Clear backoff state for a domain.
   *
   * @param domain - The domain to clear
   */
  async clearBackoff(domain: string): Promise<void> {
    const key = `backoff:domain:${this.normalizeDomain(domain)}`;
    await this.redis.del(key);
  }

  /**
   * Get all domains currently in backoff.
   */
  async getBackoffDomains(): Promise<Array<{ domain: string; state: BackoffState }>> {
    const keys = await this.redis.keys("backoff:domain:*");
    const results: Array<{ domain: string; state: BackoffState }> = [];

    for (const key of keys) {
      const domain = key.replace("backoff:domain:", "");
      const state = await this.getState(domain);
      if (state && Date.now() < state.until) {
        results.push({ domain, state });
      }
    }

    return results.sort((a, b) => b.state.until - a.state.until);
  }

  /**
   * Create initial backoff state for a new failure.
   */
  private createInitialState(statusCode: number, now: number): BackoffState {
    const multiplier = 1;
    return {
      multiplier,
      until: now + this.getBackoffDuration(statusCode, multiplier),
      lastError: statusCode,
      consecutiveFailures: 1,
      firstFailureAt: now,
    };
  }

  /**
   * Calculate backoff duration based on status code and multiplier.
   */
  private getBackoffDuration(statusCode: number, multiplier: number): number {
    let baseDuration: number;

    if (statusCode === 429) {
      baseDuration = this.config.baseDuration429;
    } else if (statusCode === 503) {
      baseDuration = this.config.baseDuration503;
    } else {
      baseDuration = this.config.baseDurationOther;
    }

    return baseDuration * multiplier;
  }

  /**
   * Normalize domain for rate limiting.
   * Subdomains share limits with their parent domain.
   */
  private normalizeDomain(domain: string): string {
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

    if (parts.length >= 2) {
      const possibleCompoundTld = parts.slice(-2).join(".");

      if (KNOWN_COMPOUND_TLDS.includes(possibleCompoundTld as (typeof KNOWN_COMPOUND_TLDS)[number]) && parts.length >= 3) {
        return parts.slice(-3).join(".");
      }

      return parts.slice(-2).join(".");
    }

    return hostname;
  }
}
