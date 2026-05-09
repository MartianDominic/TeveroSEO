/**
 * Proxy Bandwidth Tracker
 * Phase 95-18: Resilience Hardening
 *
 * Tracks monthly bandwidth usage per proxy provider to prevent
 * unexpected overages or service cutoff.
 *
 * Supported Providers:
 * - Geonode: $0.77/GB, default 10GB monthly limit
 * - Webshare: $0.10/GB, default 50GB monthly limit (free tier: 1GB)
 *
 * Features:
 * - Monthly bandwidth tracking in Redis with automatic reset
 * - Warning at 75%, critical at 90%
 * - Cost estimation per provider
 * - Alert deduplication per month
 * - Prometheus metrics export
 */

import { redis, REDIS_SERVICE_PREFIX } from "@/server/lib/redis";
import { getMetricsCollector } from "./MetricsCollector";
import { createComponentLogger } from "../logging";

// =============================================================================
// Types
// =============================================================================

export type ProxyProvider = "geonode" | "webshare";

export interface ProviderConfig {
  /** Monthly bandwidth limit in bytes */
  limitBytes: number;

  /** Cost per GB in USD */
  costPerGb: number;

  /** Warning threshold as percentage (default: 75) */
  warningThresholdPercent: number;

  /** Critical threshold as percentage (default: 90) */
  criticalThresholdPercent: number;
}

export interface BandwidthTrackerConfig {
  geonode: ProviderConfig;
  webshare: ProviderConfig;
}

export interface ProviderBandwidthStatus {
  /** Provider name */
  provider: ProxyProvider;

  /** Bytes used this month */
  usedBytes: number;

  /** Monthly limit in bytes */
  limitBytes: number;

  /** Remaining bytes */
  remainingBytes: number;

  /** Usage percentage (0-100) */
  percentUsed: number;

  /** Estimated cost in USD */
  estimatedCostUsd: number;

  /** Whether quota is exhausted */
  isExhausted: boolean;

  /** Whether warning threshold is reached */
  isWarning: boolean;

  /** Whether critical threshold is reached */
  isCritical: boolean;

  /** Month for this data (YYYY-MM) */
  month: string;
}

export interface BandwidthMetrics {
  geonode: {
    usedBytes: number;
    limitBytes: number;
    estimatedCostUsd: number;
    percentUsed: number;
  };
  webshare: {
    usedBytes: number;
    limitBytes: number;
    estimatedCostUsd: number;
    percentUsed: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

const BANDWIDTH_KEY_PREFIX = `${REDIS_SERVICE_PREFIX}bandwidth:`;
const BANDWIDTH_ALERT_KEY_PREFIX = `${REDIS_SERVICE_PREFIX}bandwidth_alert:`;
const BYTES_PER_GB = 1024 * 1024 * 1024;

const DEFAULT_CONFIG: BandwidthTrackerConfig = {
  geonode: {
    limitBytes: parseInt(process.env.GEONODE_MONTHLY_BANDWIDTH_GB ?? "10", 10) * BYTES_PER_GB,
    costPerGb: 0.77,
    warningThresholdPercent: 75,
    criticalThresholdPercent: 90,
  },
  webshare: {
    limitBytes: parseInt(process.env.WEBSHARE_MONTHLY_BANDWIDTH_GB ?? "50", 10) * BYTES_PER_GB,
    costPerGb: 0.10,
    warningThresholdPercent: 75,
    criticalThresholdPercent: 90,
  },
};

// =============================================================================
// Logger
// =============================================================================

const logger = createComponentLogger("bandwidth-tracker");

// =============================================================================
// BandwidthTracker
// =============================================================================

export class BandwidthTracker {
  private config: BandwidthTrackerConfig;

  constructor(config: Partial<BandwidthTrackerConfig> = {}) {
    this.config = {
      geonode: { ...DEFAULT_CONFIG.geonode, ...config.geonode },
      webshare: { ...DEFAULT_CONFIG.webshare, ...config.webshare },
    };
  }

  /**
   * Get current month as YYYY-MM.
   */
  private getCurrentMonth(): string {
    return new Date().toISOString().substring(0, 7);
  }

  /**
   * Build Redis key for monthly bandwidth counter.
   */
  private getBandwidthKey(provider: ProxyProvider): string {
    return `${BANDWIDTH_KEY_PREFIX}${provider}:${this.getCurrentMonth()}`;
  }

  /**
   * Build Redis key for monthly alert flag.
   */
  private getAlertKey(provider: ProxyProvider, level: "warning" | "critical"): string {
    return `${BANDWIDTH_ALERT_KEY_PREFIX}${provider}:${level}:${this.getCurrentMonth()}`;
  }

  /**
   * Record bandwidth usage for a provider.
   * Tracks both request and response sizes.
   *
   * @param provider - Proxy provider
   * @param requestBytes - Size of request in bytes
   * @param responseBytes - Size of response in bytes
   */
  async recordUsage(
    provider: ProxyProvider,
    requestBytes: number,
    responseBytes: number
  ): Promise<void> {
    try {
      const key = this.getBandwidthKey(provider);
      const totalBytes = requestBytes + responseBytes;

      // Increment counter with TTL (auto-expires after month + buffer)
      const newTotal = await redis.incrby(key, totalBytes);

      // Set TTL on first usage of the month (35 days buffer)
      if (newTotal === totalBytes) {
        await redis.expire(key, 35 * 24 * 60 * 60);
      }

      // Update Prometheus metrics
      const metrics = getMetricsCollector();
      metrics.addCounter("osm_scraping_proxy_bandwidth_bytes", totalBytes, { provider });

      const config = this.config[provider];
      const costUsd = (newTotal / BYTES_PER_GB) * config.costPerGb;
      metrics.setGauge("osm_scraping_proxy_bandwidth_cost_usd", costUsd, { provider });

      // Check thresholds and send alerts
      await this.checkThresholds(provider, newTotal);
    } catch (error) {
      logger.error({
        provider,
        error: error instanceof Error ? error.message : String(error),
      }, "Failed to record bandwidth usage");
    }
  }

  /**
   * Get current bandwidth usage for a provider.
   */
  async getUsage(provider: ProxyProvider): Promise<number> {
    try {
      const key = this.getBandwidthKey(provider);
      const bytes = await redis.get(key);
      return bytes ? parseInt(bytes, 10) : 0;
    } catch (error) {
      logger.error({
        provider,
        error: error instanceof Error ? error.message : String(error),
      }, "Failed to get bandwidth usage");
      return 0;
    }
  }

  /**
   * Get remaining bandwidth for a provider.
   */
  async getRemainingBandwidth(provider: ProxyProvider): Promise<number> {
    const used = await this.getUsage(provider);
    const config = this.config[provider];
    return Math.max(0, config.limitBytes - used);
  }

  /**
   * Check if a provider has bandwidth remaining.
   */
  async hasBandwidthRemaining(provider: ProxyProvider): Promise<boolean> {
    const remaining = await this.getRemainingBandwidth(provider);
    return remaining > 0;
  }

  /**
   * Get full bandwidth status for a provider.
   */
  async getStatus(provider: ProxyProvider): Promise<ProviderBandwidthStatus> {
    const used = await this.getUsage(provider);
    const config = this.config[provider];
    const remaining = Math.max(0, config.limitBytes - used);
    const percentUsed = (used / config.limitBytes) * 100;
    const estimatedCostUsd = (used / BYTES_PER_GB) * config.costPerGb;

    return {
      provider,
      usedBytes: used,
      limitBytes: config.limitBytes,
      remainingBytes: remaining,
      percentUsed,
      estimatedCostUsd,
      isExhausted: remaining === 0,
      isWarning: percentUsed >= config.warningThresholdPercent,
      isCritical: percentUsed >= config.criticalThresholdPercent,
      month: this.getCurrentMonth(),
    };
  }

  /**
   * Get bandwidth status for all providers.
   */
  async getAllStatus(): Promise<Map<ProxyProvider, ProviderBandwidthStatus>> {
    const results = new Map<ProxyProvider, ProviderBandwidthStatus>();

    for (const provider of ["geonode", "webshare"] as ProxyProvider[]) {
      results.set(provider, await this.getStatus(provider));
    }

    return results;
  }

  /**
   * Get metrics for Prometheus export.
   */
  async getMetrics(): Promise<BandwidthMetrics> {
    const geonodeStatus = await this.getStatus("geonode");
    const webshareStatus = await this.getStatus("webshare");

    return {
      geonode: {
        usedBytes: geonodeStatus.usedBytes,
        limitBytes: geonodeStatus.limitBytes,
        estimatedCostUsd: geonodeStatus.estimatedCostUsd,
        percentUsed: geonodeStatus.percentUsed,
      },
      webshare: {
        usedBytes: webshareStatus.usedBytes,
        limitBytes: webshareStatus.limitBytes,
        estimatedCostUsd: webshareStatus.estimatedCostUsd,
        percentUsed: webshareStatus.percentUsed,
      },
    };
  }

  /**
   * Check thresholds and emit alerts (deduplicated per month).
   */
  private async checkThresholds(provider: ProxyProvider, currentBytes: number): Promise<void> {
    const config = this.config[provider];
    const percentUsed = (currentBytes / config.limitBytes) * 100;

    // Check critical threshold first
    if (percentUsed >= config.criticalThresholdPercent) {
      await this.emitAlert(provider, "critical", percentUsed, currentBytes);
    } else if (percentUsed >= config.warningThresholdPercent) {
      await this.emitAlert(provider, "warning", percentUsed, currentBytes);
    }
  }

  /**
   * Emit an alert, deduplicated per month.
   */
  private async emitAlert(
    provider: ProxyProvider,
    level: "warning" | "critical",
    percentUsed: number,
    currentBytes: number
  ): Promise<void> {
    const alertKey = this.getAlertKey(provider, level);
    const config = this.config[provider];

    // Check if alert already sent this month (SET NX returns null if key exists)
    const isNew = await redis.set(alertKey, "1", "EX", 35 * 24 * 60 * 60, "NX");

    if (isNew === "OK") {
      // First alert of this level this month - log it
      const usedGb = (currentBytes / BYTES_PER_GB).toFixed(2);
      const limitGb = (config.limitBytes / BYTES_PER_GB).toFixed(2);
      const costUsd = ((currentBytes / BYTES_PER_GB) * config.costPerGb).toFixed(2);

      const message = `${provider} bandwidth ${level.toUpperCase()}: ${percentUsed.toFixed(1)}% used (${usedGb}GB/${limitGb}GB, ~$${costUsd})`;

      if (level === "critical") {
        logger.error({
          provider,
          level,
          percentUsed,
          usedBytes: currentBytes,
          limitBytes: config.limitBytes,
          estimatedCostUsd: parseFloat(costUsd),
        }, message);
      } else {
        logger.warn({
          provider,
          level,
          percentUsed,
          usedBytes: currentBytes,
          limitBytes: config.limitBytes,
          estimatedCostUsd: parseFloat(costUsd),
        }, message);
      }

      // Update Prometheus metric
      const metrics = getMetricsCollector();
      metrics.incrementCounter("osm_scraping_proxy_bandwidth_alerts_total", { provider, level });
    }
  }

  /**
   * Reset usage for a provider (for testing).
   */
  async resetUsage(provider: ProxyProvider): Promise<void> {
    await redis.del(this.getBandwidthKey(provider));
    await redis.del(this.getAlertKey(provider, "warning"));
    await redis.del(this.getAlertKey(provider, "critical"));
  }

  /**
   * Reset usage for all providers (for testing).
   */
  async resetAllUsage(): Promise<void> {
    await this.resetUsage("geonode");
    await this.resetUsage("webshare");
  }

  /**
   * Get configuration for a provider.
   */
  getProviderConfig(provider: ProxyProvider): ProviderConfig {
    return { ...this.config[provider] };
  }
}

// =============================================================================
// Singleton
// =============================================================================

let _bandwidthTracker: BandwidthTracker | null = null;

/**
 * Get the global BandwidthTracker singleton.
 */
export function getBandwidthTracker(): BandwidthTracker {
  if (!_bandwidthTracker) {
    _bandwidthTracker = new BandwidthTracker();
  }
  return _bandwidthTracker;
}

/**
 * Reset the global BandwidthTracker (for testing).
 */
export function resetBandwidthTracker(): void {
  _bandwidthTracker = null;
}

/**
 * Create a new BandwidthTracker with custom config (for testing).
 */
export function createBandwidthTracker(
  config: Partial<BandwidthTrackerConfig>
): BandwidthTracker {
  return new BandwidthTracker(config);
}
