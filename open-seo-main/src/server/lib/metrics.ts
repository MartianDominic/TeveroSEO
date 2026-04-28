/**
 * API Metrics Collection
 * Phase 40: Gap Closure - Observability for API endpoints
 *
 * Provides lightweight metrics collection for request counts, latencies, and error rates.
 * Logs metrics in structured format for external collection (Datadog, CloudWatch, etc.)
 */
import { createLogger } from "./logger";

const log = createLogger({ module: "metrics" });

export interface MetricLabels {
  endpoint?: string;
  status?: string;
  clientId?: string;
  method?: string;
  tier?: string;
  [key: string]: string | undefined;
}

interface MetricSnapshot {
  counters: Record<string, number>;
  timings: Record<string, { count: number; sum: number; min: number; max: number }>;
}

/**
 * Metrics collector for API observability.
 * Tracks counters (request counts, errors) and timings (latency histograms).
 */
class Metrics {
  private counters: Map<string, number> = new Map();
  private timings: Map<string, number[]> = new Map();

  /**
   * Increment a counter metric.
   * @param name - Metric name (e.g., "api.requests")
   * @param labels - Dimensional labels (endpoint, status, clientId)
   * @param value - Amount to increment (default 1)
   */
  increment(name: string, labels: MetricLabels = {}, value = 1): void {
    const key = this.makeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);

    // Structured log for external collection
    log.debug("metric.counter", { name, labels, value });
  }

  /**
   * Record a timing metric (latency, duration).
   * @param name - Metric name (e.g., "api.latency")
   * @param durationMs - Duration in milliseconds
   * @param labels - Dimensional labels
   */
  timing(name: string, durationMs: number, labels: MetricLabels = {}): void {
    const key = this.makeKey(name, labels);
    const timings = this.timings.get(key) ?? [];
    timings.push(durationMs);

    // Keep only last 1000 samples to prevent memory bloat
    if (timings.length > 1000) {
      timings.shift();
    }
    this.timings.set(key, timings);

    log.debug("metric.timing", { name, labels, durationMs });
  }

  /**
   * Get current snapshot of all metrics.
   * Useful for health endpoints or periodic export.
   */
  getSnapshot(): MetricSnapshot {
    const counters: Record<string, number> = {};
    Array.from(this.counters.entries()).forEach(([key, value]) => {
      counters[key] = value;
    });

    const timings: Record<string, { count: number; sum: number; min: number; max: number }> = {};
    Array.from(this.timings.entries()).forEach(([key, values]) => {
      if (values.length > 0) {
        timings[key] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    });

    return { counters, timings };
  }

  /**
   * Reset all metrics. Useful for testing or after export.
   */
  reset(): void {
    this.counters.clear();
    this.timings.clear();
  }

  /**
   * Build a metric key from name and labels.
   * Format: "name{label1=value1,label2=value2}"
   */
  private makeKey(name: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return labelStr ? `${name}{${labelStr}}` : name;
  }
}

/** Singleton metrics instance for application-wide collection */
export const metrics = new Metrics();

/**
 * Helper to record request metrics with standard labels.
 * Use at the end of request handlers.
 */
export function recordRequestMetrics(
  endpoint: string,
  startTime: number,
  status: "success" | "error" | "validation_error",
  additionalLabels: MetricLabels = {}
): void {
  const durationMs = Date.now() - startTime;
  const labels = { endpoint, status, ...additionalLabels };

  metrics.increment("api.requests", labels);
  metrics.timing("api.latency", durationMs, { endpoint });

  // Log slow requests (>1s) at info level for alerting
  if (durationMs > 1000) {
    log.info("slow_request", { endpoint, durationMs, status });
  }
}
