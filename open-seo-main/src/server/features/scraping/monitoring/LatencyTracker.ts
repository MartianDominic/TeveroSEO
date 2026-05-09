/**
 * LatencyTracker - Rolling P95 Latency Alerting
 * Phase 95: Gap P3.G20 - No P95 latency alerts
 *
 * Tracks per-request latency using a circular buffer for efficient rolling window
 * calculations. Emits warnings when P95 exceeds configurable thresholds.
 *
 * Features:
 * - O(1) insert into circular buffer
 * - O(n log n) P95 calculation using sorted percentile method
 * - Configurable window size (default: 100 requests)
 * - Configurable threshold (default: 5s)
 * - Console warning emission for threshold breaches
 * - Prometheus-compatible metric exposure
 */

import { alertLogger } from "../logging";
import { getMetricsCollector } from "./MetricsCollector";

// =============================================================================
// Types
// =============================================================================

export interface LatencyTrackerConfig {
  /** Number of requests to track in rolling window (default: 100) */
  windowSize?: number;
  /** P95 threshold in milliseconds (default: 5000ms = 5s) */
  thresholdMs?: number;
  /** Minimum samples before alerting (default: 10) */
  minSamples?: number;
  /** Cooldown between alerts in milliseconds (default: 60000ms = 1 minute) */
  alertCooldownMs?: number;
}

export interface LatencyStats {
  /** P50 latency in milliseconds */
  p50Ms: number;
  /** P95 latency in milliseconds */
  p95Ms: number;
  /** P99 latency in milliseconds */
  p99Ms: number;
  /** Average latency in milliseconds */
  avgMs: number;
  /** Minimum latency in milliseconds */
  minMs: number;
  /** Maximum latency in milliseconds */
  maxMs: number;
  /** Number of samples in the current window */
  sampleCount: number;
  /** Whether P95 is currently exceeding threshold */
  isAboveThreshold: boolean;
  /** The configured threshold in milliseconds */
  thresholdMs: number;
}

// =============================================================================
// LatencyTracker
// =============================================================================

export class LatencyTracker {
  private readonly buffer: number[];
  private readonly windowSize: number;
  private readonly thresholdMs: number;
  private readonly minSamples: number;
  private readonly alertCooldownMs: number;

  private writeIndex: number = 0;
  private sampleCount: number = 0;
  private lastAlertTime: number = 0;
  private consecutiveBreaches: number = 0;

  constructor(config: LatencyTrackerConfig = {}) {
    this.windowSize = config.windowSize ?? 100;
    this.thresholdMs = config.thresholdMs ?? 5000;
    this.minSamples = config.minSamples ?? 10;
    this.alertCooldownMs = config.alertCooldownMs ?? 60000;

    // Pre-allocate buffer for efficiency
    this.buffer = new Array(this.windowSize).fill(0);
  }

  /**
   * Record a request latency.
   * O(1) time complexity for insertion.
   *
   * @param latencyMs - Request latency in milliseconds
   */
  record(latencyMs: number): void {
    // Write to circular buffer
    this.buffer[this.writeIndex] = latencyMs;
    this.writeIndex = (this.writeIndex + 1) % this.windowSize;

    if (this.sampleCount < this.windowSize) {
      this.sampleCount++;
    }

    // Check threshold after recording
    this.checkThreshold();

    // Update Prometheus gauge for real-time monitoring
    this.updatePrometheusMetrics();
  }

  /**
   * Get P95 latency from the current rolling window.
   * O(n log n) time complexity due to sorting.
   *
   * @returns P95 latency in milliseconds, or 0 if insufficient samples
   */
  getP95Latency(): number {
    return this.calculatePercentile(95);
  }

  /**
   * Get comprehensive latency statistics.
   */
  getStats(): LatencyStats {
    const samples = this.getSamples();

    if (samples.length === 0) {
      return {
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        sampleCount: 0,
        isAboveThreshold: false,
        thresholdMs: this.thresholdMs,
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((acc, val) => acc + val, 0);

    return {
      p50Ms: this.percentileFromSorted(sorted, 50),
      p95Ms: this.percentileFromSorted(sorted, 95),
      p99Ms: this.percentileFromSorted(sorted, 99),
      avgMs: sum / samples.length,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      sampleCount: samples.length,
      isAboveThreshold: this.percentileFromSorted(sorted, 95) > this.thresholdMs,
      thresholdMs: this.thresholdMs,
    };
  }

  /**
   * Check if P95 is currently above threshold.
   */
  isAboveThreshold(): boolean {
    if (this.sampleCount < this.minSamples) {
      return false;
    }
    return this.getP95Latency() > this.thresholdMs;
  }

  /**
   * Get the current threshold in milliseconds.
   */
  getThresholdMs(): number {
    return this.thresholdMs;
  }

  /**
   * Get the number of consecutive threshold breaches.
   */
  getConsecutiveBreaches(): number {
    return this.consecutiveBreaches;
  }

  /**
   * Reset the tracker (useful for testing or after major configuration changes).
   */
  reset(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
    this.sampleCount = 0;
    this.lastAlertTime = 0;
    this.consecutiveBreaches = 0;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get current samples from the circular buffer.
   */
  private getSamples(): number[] {
    if (this.sampleCount === 0) {
      return [];
    }

    if (this.sampleCount < this.windowSize) {
      // Buffer not yet full - return only filled portion
      return this.buffer.slice(0, this.sampleCount);
    }

    // Buffer is full - return all values
    return [...this.buffer];
  }

  /**
   * Calculate a percentile from the current samples.
   * O(n log n) due to sorting.
   */
  private calculatePercentile(percentile: number): number {
    const samples = this.getSamples();

    if (samples.length === 0) {
      return 0;
    }

    const sorted = [...samples].sort((a, b) => a - b);
    return this.percentileFromSorted(sorted, percentile);
  }

  /**
   * Calculate percentile from a pre-sorted array.
   * Uses linear interpolation for more accurate results.
   */
  private percentileFromSorted(sorted: number[], percentile: number): number {
    if (sorted.length === 0) {
      return 0;
    }

    if (sorted.length === 1) {
      return sorted[0];
    }

    // Calculate the index for the percentile
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    // Linear interpolation
    const fraction = index - lower;
    return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
  }

  /**
   * Check if P95 exceeds threshold and emit warning if needed.
   */
  private checkThreshold(): void {
    if (this.sampleCount < this.minSamples) {
      return;
    }

    const p95 = this.getP95Latency();
    const isAbove = p95 > this.thresholdMs;

    if (isAbove) {
      this.consecutiveBreaches++;
      this.emitWarningIfCooldownExpired(p95);
    } else {
      // Reset consecutive breaches when we go back below threshold
      if (this.consecutiveBreaches > 0) {
        alertLogger.info(
          {
            p95Ms: p95,
            thresholdMs: this.thresholdMs,
            previousBreaches: this.consecutiveBreaches,
          },
          "ScrapingService P95 latency recovered to below threshold"
        );
      }
      this.consecutiveBreaches = 0;
    }
  }

  /**
   * Emit warning if cooldown period has expired.
   */
  private emitWarningIfCooldownExpired(p95: number): void {
    const now = Date.now();

    if (now - this.lastAlertTime < this.alertCooldownMs) {
      return;
    }

    this.lastAlertTime = now;

    // Debug-level log for immediate visibility (structured logging preferred)
    alertLogger.debug(
      {
        p95Ms: p95,
        thresholdMs: this.thresholdMs,
        sampleCount: this.sampleCount,
        consecutiveBreaches: this.consecutiveBreaches,
      },
      'ScrapingService P95 latency alert triggered'
    );

    // Structured logging for observability
    alertLogger.warn(
      {
        metric: "osm_scraping_p95_latency_ms",
        value: p95,
        threshold: this.thresholdMs,
        sampleCount: this.sampleCount,
        consecutiveBreaches: this.consecutiveBreaches,
        windowSize: this.windowSize,
      },
      "ScrapingService P95 latency exceeded threshold"
    );
  }

  /**
   * Update Prometheus metrics for external monitoring.
   */
  private updatePrometheusMetrics(): void {
    const collector = getMetricsCollector();
    const stats = this.getStats();

    // Set rolling window P95 gauge
    collector.setGauge("osm_scraping_p95_latency_rolling_ms", stats.p95Ms);

    // Set threshold breach gauge (1 if above, 0 if below)
    collector.setGauge(
      "osm_scraping_p95_threshold_breach",
      stats.isAboveThreshold ? 1 : 0
    );

    // Set consecutive breaches counter
    collector.setGauge(
      "osm_scraping_p95_consecutive_breaches",
      this.consecutiveBreaches
    );
  }
}

// =============================================================================
// Singleton
// =============================================================================

let latencyTracker: LatencyTracker | null = null;

/**
 * Get the global LatencyTracker singleton.
 *
 * @param config - Optional configuration (only used on first call)
 */
export function getLatencyTracker(config?: LatencyTrackerConfig): LatencyTracker {
  if (!latencyTracker) {
    latencyTracker = new LatencyTracker(config);
  }
  return latencyTracker;
}

/**
 * Reset the global LatencyTracker (for testing).
 */
export function resetLatencyTracker(): void {
  latencyTracker = null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Record a scraping request latency.
 * Convenience function that uses the global singleton.
 *
 * @param latencyMs - Request latency in milliseconds
 */
export function recordLatency(latencyMs: number): void {
  getLatencyTracker().record(latencyMs);
}

/**
 * Get the current P95 latency.
 * Convenience function that uses the global singleton.
 *
 * @returns P95 latency in milliseconds
 */
export function getP95LatencyMs(): number {
  return getLatencyTracker().getP95Latency();
}

/**
 * Get comprehensive latency statistics.
 * Convenience function that uses the global singleton.
 */
export function getLatencyStats(): LatencyStats {
  return getLatencyTracker().getStats();
}
