/**
 * Blocked Domain Tracker for Monitoring Dashboard.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

import type Redis from "ioredis";

/**
 * Reason why a domain is blocked.
 */
export type BlockReason = "rate_limited" | "blocked" | "captcha" | "error";

/**
 * Information about a blocked domain.
 */
export interface BlockedDomainInfo {
  /** Domain name */
  domain: string;

  /** Why the domain is blocked */
  reason: BlockReason;

  /** When the block started */
  blockedAt: number;

  /** When the block expires */
  blockedUntil: number;

  /** Number of consecutive failures */
  consecutiveFailures: number;

  /** Last HTTP status code that triggered the block */
  lastStatusCode?: number;

  /** Current backoff multiplier */
  backoffMultiplier: number;

  /** Time remaining in block (ms) */
  remainingMs: number;
}

/**
 * Summary statistics for blocked domains.
 */
export interface BlockedDomainStats {
  /** Total number of blocked domains */
  total: number;

  /** Count by reason */
  byReason: Record<BlockReason, number>;

  /** Domains with highest multipliers */
  mostBlocked: BlockedDomainInfo[];

  /** Average backoff multiplier */
  avgMultiplier: number;
}

/**
 * Tracks domains that are currently in backoff/blocked state.
 */
export class BlockedDomainTracker {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get all domains currently blocked.
   */
  async getBlockedDomains(): Promise<BlockedDomainInfo[]> {
    const keys = await this.redis.keys("backoff:domain:*");
    const blocked: BlockedDomainInfo[] = [];
    const now = Date.now();

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) continue;

      try {
        const parsed = JSON.parse(data) as {
          multiplier: number;
          until: number;
          lastError?: number;
          consecutiveFailures?: number;
          firstFailureAt?: number;
        };

        // Only include if still blocked
        if (parsed.until > now) {
          const domain = key.replace("backoff:domain:", "");
          blocked.push({
            domain,
            reason: this.classifyReason(parsed.lastError),
            blockedAt: parsed.firstFailureAt ?? parsed.until - (parsed.multiplier * 60_000),
            blockedUntil: parsed.until,
            consecutiveFailures: parsed.consecutiveFailures ?? Math.log2(parsed.multiplier) + 1,
            lastStatusCode: parsed.lastError,
            backoffMultiplier: parsed.multiplier,
            remainingMs: parsed.until - now,
          });
        }
      } catch {
        // Skip malformed entries
      }
    }

    // Sort by blocked until (most severe first)
    return blocked.sort((a, b) => b.blockedUntil - a.blockedUntil);
  }

  /**
   * Get summary statistics for blocked domains.
   */
  async getStats(): Promise<BlockedDomainStats> {
    const blocked = await this.getBlockedDomains();

    const byReason: Record<BlockReason, number> = {
      rate_limited: 0,
      blocked: 0,
      captcha: 0,
      error: 0,
    };

    let totalMultiplier = 0;

    for (const domain of blocked) {
      byReason[domain.reason]++;
      totalMultiplier += domain.backoffMultiplier;
    }

    return {
      total: blocked.length,
      byReason,
      mostBlocked: blocked.slice(0, 10), // Top 10 most blocked
      avgMultiplier: blocked.length > 0 ? totalMultiplier / blocked.length : 0,
    };
  }

  /**
   * Check if a specific domain is blocked.
   */
  async isBlocked(domain: string): Promise<boolean> {
    const normalizedDomain = this.normalizeDomain(domain);
    const key = `backoff:domain:${normalizedDomain}`;
    const data = await this.redis.get(key);

    if (!data) return false;

    try {
      const parsed = JSON.parse(data) as { until: number };
      return parsed.until > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Get block info for a specific domain.
   */
  async getBlockInfo(domain: string): Promise<BlockedDomainInfo | null> {
    const normalizedDomain = this.normalizeDomain(domain);
    const key = `backoff:domain:${normalizedDomain}`;
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      const parsed = JSON.parse(data) as {
        multiplier: number;
        until: number;
        lastError?: number;
        consecutiveFailures?: number;
        firstFailureAt?: number;
      };

      const now = Date.now();
      if (parsed.until <= now) return null;

      return {
        domain: normalizedDomain,
        reason: this.classifyReason(parsed.lastError),
        blockedAt: parsed.firstFailureAt ?? parsed.until - (parsed.multiplier * 60_000),
        blockedUntil: parsed.until,
        consecutiveFailures: parsed.consecutiveFailures ?? Math.log2(parsed.multiplier) + 1,
        lastStatusCode: parsed.lastError,
        backoffMultiplier: parsed.multiplier,
        remainingMs: parsed.until - now,
      };
    } catch {
      return null;
    }
  }

  /**
   * Manually unblock a domain.
   */
  async unblock(domain: string): Promise<boolean> {
    const normalizedDomain = this.normalizeDomain(domain);
    const key = `backoff:domain:${normalizedDomain}`;
    const result = await this.redis.del(key);
    return result > 0;
  }

  /**
   * Get domains that have been blocked the longest.
   */
  async getMostPersistentBlocks(limit: number = 10): Promise<BlockedDomainInfo[]> {
    const blocked = await this.getBlockedDomains();

    // Sort by backoff multiplier (severity)
    return blocked
      .sort((a, b) => b.backoffMultiplier - a.backoffMultiplier)
      .slice(0, limit);
  }

  /**
   * Get domains about to be unblocked (within next N minutes).
   */
  async getExpiringBlocks(withinMinutes: number = 5): Promise<BlockedDomainInfo[]> {
    const blocked = await this.getBlockedDomains();
    const threshold = Date.now() + withinMinutes * 60_000;

    return blocked.filter((d) => d.blockedUntil <= threshold);
  }

  /**
   * Classify block reason from HTTP status code.
   */
  private classifyReason(statusCode?: number): BlockReason {
    if (!statusCode) return "error";
    if (statusCode === 429) return "rate_limited";
    if (statusCode === 403) return "blocked";
    if (statusCode === 503) return "rate_limited";
    return "error";
  }

  /**
   * Normalize domain name.
   */
  private normalizeDomain(domain: string): string {
    return domain.toLowerCase().replace(/^www\./, "");
  }
}
