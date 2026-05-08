/**
 * CrUX API Rate Limiter
 * Phase 95-18: Resilience Hardening
 *
 * Tracks daily CrUX API usage in Redis to prevent quota exhaustion.
 * Free tier limit: 25,000 queries/day
 *
 * Features:
 * - Daily usage tracking with automatic reset at midnight UTC
 * - Warning at 80%, critical at 95%
 * - Alert deduplication per day
 * - Metrics export for Prometheus
 */

import { redis, REDIS_SERVICE_PREFIX } from "@/server/lib/redis";
import { getMetricsCollector } from "../monitoring/MetricsCollector";
import { createComponentLogger } from "../logging";

// =============================================================================
// Types
// =============================================================================

export interface CruxRateLimiterConfig {
  /** Daily request limit (default: 25000 for free tier) */
  dailyLimit: number;

  /** Warning threshold as percentage (default: 80) */
  warningThresholdPercent: number;

  /** Critical threshold as percentage (default: 95) */
  criticalThresholdPercent: number;
}

export interface CruxQuotaStatus {
  /** Current daily usage count */
  used: number;

  /** Daily limit */
  limit: number;

  /** Remaining requests */
  remaining: number;

  /** Usage percentage (0-100) */
  percentUsed: number;

  /** Whether quota is exhausted */
  isExhausted: boolean;

  /** Whether warning threshold is reached */
  isWarning: boolean;

  /** Whether critical threshold is reached */
  isCritical: boolean;

  /** Date for this quota period (YYYY-MM-DD) */
  date: string;
}

export interface CruxRateLimiterMetrics {
  /** Total requests today */
  requestsToday: number;

  /** Remaining quota */
  quotaRemaining: number;

  /** Daily limit */
  dailyLimit: number;

  /** Usage percentage */
  usagePercent: number;
}

// =============================================================================
// Constants
// =============================================================================

const CRUX_USAGE_KEY_PREFIX = `${REDIS_SERVICE_PREFIX}crux:usage:`;
const CRUX_ALERT_KEY_PREFIX = `${REDIS_SERVICE_PREFIX}crux:alert:`;
const SECONDS_PER_DAY = 86400;

const DEFAULT_CONFIG: CruxRateLimiterConfig = {
  dailyLimit: parseInt(process.env.CRUX_DAILY_LIMIT ?? "25000", 10),
  warningThresholdPercent: 80,
  criticalThresholdPercent: 95,
};

// =============================================================================
// Logger
// =============================================================================

const logger = createComponentLogger("crux-rate-limiter");

// =============================================================================
// CruxRateLimiter
// =============================================================================

export class CruxRateLimiter {
  private config: CruxRateLimiterConfig;

  constructor(config: Partial<CruxRateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get today's date in UTC as YYYY-MM-DD.
   */
  private getTodayKey(): string {
    return new Date().toISOString().split("T")[0];
  }

  /**
   * Build Redis key for today's usage counter.
   */
  private getUsageKey(): string {
    return `${CRUX_USAGE_KEY_PREFIX}${this.getTodayKey()}`;
  }

  /**
   * Build Redis key for today's alert flag.
   */
  private getAlertKey(level: "warning" | "critical"): string {
    return `${CRUX_ALERT_KEY_PREFIX}${level}:${this.getTodayKey()}`;
  }

  /**
   * Check if a request can be made (under quota).
   * Returns true if request is allowed, false if quota exhausted.
   */
  async canMakeRequest(): Promise<boolean> {
    try {
      const currentUsage = await this.getCurrentUsage();
      return currentUsage < this.config.dailyLimit;
    } catch (error) {
      // On Redis error, allow request (fail open)
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
      }, "Failed to check rate limit, allowing request");
      return true;
    }
  }

  /**
   * Record a CrUX API request.
   * Increments the daily counter and checks thresholds.
   */
  async recordRequest(): Promise<void> {
    try {
      const key = this.getUsageKey();

      // Increment counter with TTL (auto-expires at end of day + buffer)
      const newCount = await redis.incr(key);

      // Set TTL on first request of the day
      if (newCount === 1) {
        // Calculate seconds until end of day UTC + 1 hour buffer
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setUTCHours(23, 59, 59, 999);
        const secondsUntilEndOfDay = Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);
        await redis.expire(key, secondsUntilEndOfDay + 3600); // +1 hour buffer
      }

      // Update Prometheus metrics
      const metrics = getMetricsCollector();
      metrics.incrementCounter("scraping_crux_requests_total", {});
      metrics.setGauge("scraping_crux_quota_remaining", this.config.dailyLimit - newCount);

      // Check thresholds and send alerts
      await this.checkThresholds(newCount);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, "Failed to record CrUX request");
    }
  }

  /**
   * Get current daily usage count.
   */
  async getCurrentUsage(): Promise<number> {
    try {
      const count = await redis.get(this.getUsageKey());
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, "Failed to get CrUX usage");
      return 0;
    }
  }

  /**
   * Get remaining quota for today.
   */
  async getRemainingQuota(): Promise<number> {
    const used = await this.getCurrentUsage();
    return Math.max(0, this.config.dailyLimit - used);
  }

  /**
   * Get full quota status.
   */
  async getQuotaStatus(): Promise<CruxQuotaStatus> {
    const used = await this.getCurrentUsage();
    const remaining = Math.max(0, this.config.dailyLimit - used);
    const percentUsed = (used / this.config.dailyLimit) * 100;

    return {
      used,
      limit: this.config.dailyLimit,
      remaining,
      percentUsed,
      isExhausted: remaining === 0,
      isWarning: percentUsed >= this.config.warningThresholdPercent,
      isCritical: percentUsed >= this.config.criticalThresholdPercent,
      date: this.getTodayKey(),
    };
  }

  /**
   * Get metrics for Prometheus export.
   */
  async getMetrics(): Promise<CruxRateLimiterMetrics> {
    const used = await this.getCurrentUsage();
    const remaining = Math.max(0, this.config.dailyLimit - used);

    return {
      requestsToday: used,
      quotaRemaining: remaining,
      dailyLimit: this.config.dailyLimit,
      usagePercent: (used / this.config.dailyLimit) * 100,
    };
  }

  /**
   * Check thresholds and emit alerts (deduplicated per day).
   */
  private async checkThresholds(currentCount: number): Promise<void> {
    const percentUsed = (currentCount / this.config.dailyLimit) * 100;

    // Check critical threshold first
    if (percentUsed >= this.config.criticalThresholdPercent) {
      await this.emitAlert("critical", percentUsed, currentCount);
    } else if (percentUsed >= this.config.warningThresholdPercent) {
      await this.emitAlert("warning", percentUsed, currentCount);
    }
  }

  /**
   * Emit an alert, deduplicated per day.
   */
  private async emitAlert(
    level: "warning" | "critical",
    percentUsed: number,
    currentCount: number
  ): Promise<void> {
    const alertKey = this.getAlertKey(level);

    // Check if alert already sent today (SET NX returns null if key exists)
    const isNew = await redis.set(alertKey, "1", "EX", SECONDS_PER_DAY + 3600, "NX");

    if (isNew === "OK") {
      // First alert of this level today - log it
      const message = `CrUX API quota ${level.toUpperCase()}: ${percentUsed.toFixed(1)}% used (${currentCount}/${this.config.dailyLimit})`;

      if (level === "critical") {
        logger.error({
          level,
          percentUsed,
          currentCount,
          dailyLimit: this.config.dailyLimit,
          remaining: this.config.dailyLimit - currentCount,
        }, message);
      } else {
        logger.warn({
          level,
          percentUsed,
          currentCount,
          dailyLimit: this.config.dailyLimit,
          remaining: this.config.dailyLimit - currentCount,
        }, message);
      }

      // Update Prometheus metric
      const metrics = getMetricsCollector();
      metrics.incrementCounter("scraping_crux_alerts_total", { level });
    }
  }

  /**
   * Reset usage counter (for testing).
   */
  async resetUsage(): Promise<void> {
    await redis.del(this.getUsageKey());
    await redis.del(this.getAlertKey("warning"));
    await redis.del(this.getAlertKey("critical"));
  }
}

// =============================================================================
// Singleton
// =============================================================================

let _cruxRateLimiter: CruxRateLimiter | null = null;

/**
 * Get the global CruxRateLimiter singleton.
 */
export function getCruxRateLimiter(): CruxRateLimiter {
  if (!_cruxRateLimiter) {
    _cruxRateLimiter = new CruxRateLimiter();
  }
  return _cruxRateLimiter;
}

/**
 * Reset the global CruxRateLimiter (for testing).
 */
export function resetCruxRateLimiter(): void {
  _cruxRateLimiter = null;
}

/**
 * Create a new CruxRateLimiter with custom config (for testing).
 */
export function createCruxRateLimiter(
  config: Partial<CruxRateLimiterConfig>
): CruxRateLimiter {
  return new CruxRateLimiter(config);
}
