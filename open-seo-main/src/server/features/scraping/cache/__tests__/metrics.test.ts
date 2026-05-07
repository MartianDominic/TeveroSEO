/**
 * Cache Metrics Tests
 * Phase 95-02: Multi-Level Caching - Task 9
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CacheMetricsCollector,
  createMetricsCollector,
  exportPrometheusFormat,
  exportJsonFormat,
  calculateOverallHitRate,
  calculateWeightedLatency,
  formatBytes,
  formatRate,
  formatLatency,
  getDashboardQuery,
  CACHE_METRICS,
  DEFAULT_ALERT_THRESHOLDS,
  DASHBOARD_QUERIES,
} from "../metrics";
import type { CacheStats } from "../types";

// =============================================================================
// Test Helpers
// =============================================================================

function createMockStats(overrides: Partial<CacheStats> = {}): CacheStats {
  return {
    l1: {
      hits: 100,
      misses: 20,
      hitRate: 0.833,
      avgLatencyMs: 0.5,
      sizeBytes: 50 * 1024 * 1024,
      itemCount: 500,
    },
    l2: {
      hits: 50,
      misses: 30,
      hitRate: 0.625,
      avgLatencyMs: 3,
      sizeBytes: 1 * 1024 * 1024 * 1024,
      itemCount: 5000,
    },
    l3: {
      hits: 20,
      misses: 10,
      hitRate: 0.667,
      avgLatencyMs: 15,
    },
    l4: {
      hits: 5,
      misses: 5,
      hitRate: 0.5,
      avgLatencyMs: 150,
    },
    totalHitRate: 0.75,
    avgLatencyMs: 10,
    totalRequests: 240,
    lastResetAt: new Date("2026-05-07T12:00:00Z"),
    ...overrides,
  };
}

// =============================================================================
// Metric Definitions Tests
// =============================================================================

describe("Metric Definitions", () => {
  it("should have all required metrics defined", () => {
    const requiredMetrics = [
      "cache_hits_total",
      "cache_misses_total",
      "cache_hit_rate",
      "cache_hit_rate_total",
      "cache_latency_ms",
      "cache_latency_ms_total",
      "cache_size_bytes",
      "cache_items_total",
      "cache_requests_total",
      "cache_content_type_total",
      "cache_compression_ratio",
      "cache_invalidations_total",
      "cache_promotions_total",
    ];

    for (const name of requiredMetrics) {
      const metric = CACHE_METRICS.find((m) => m.name === name);
      expect(metric, `Missing metric: ${name}`).toBeDefined();
    }
  });

  it("should have proper types for each metric", () => {
    const counters = CACHE_METRICS.filter((m) => m.type === "counter");
    const gauges = CACHE_METRICS.filter((m) => m.type === "gauge");

    // Counters should be monotonically increasing metrics
    expect(counters.some((m) => m.name.includes("_total"))).toBe(true);

    // Gauges should be point-in-time metrics
    expect(gauges.some((m) => m.name.includes("_rate"))).toBe(true);
  });

  it("should have help text for all metrics", () => {
    for (const metric of CACHE_METRICS) {
      expect(metric.help).toBeTruthy();
      expect(metric.help.length).toBeGreaterThan(10);
    }
  });
});

// =============================================================================
// Alert Thresholds Tests
// =============================================================================

describe("Alert Thresholds", () => {
  it("should have default thresholds defined", () => {
    expect(DEFAULT_ALERT_THRESHOLDS.length).toBeGreaterThan(0);
  });

  it("should include critical low hit rate threshold", () => {
    const critical = DEFAULT_ALERT_THRESHOLDS.find(
      (t) => t.metric === "cache_hit_rate_total" && t.severity === "critical"
    );
    expect(critical).toBeDefined();
    expect(critical?.threshold).toBeLessThan(0.5);
  });

  it("should include high latency warning", () => {
    const latencyWarning = DEFAULT_ALERT_THRESHOLDS.find(
      (t) => t.metric === "cache_latency_ms_total" && t.severity === "warning"
    );
    expect(latencyWarning).toBeDefined();
  });

  it("should have descriptions for all thresholds", () => {
    for (const threshold of DEFAULT_ALERT_THRESHOLDS) {
      expect(threshold.description).toBeTruthy();
    }
  });
});

// =============================================================================
// Metrics Collector Tests
// =============================================================================

describe("CacheMetricsCollector", () => {
  let collector: CacheMetricsCollector;

  beforeEach(() => {
    collector = createMetricsCollector();
  });

  describe("content type recording", () => {
    it("should record content type occurrences", () => {
      collector.recordContentType("blog_post");
      collector.recordContentType("blog_post");
      collector.recordContentType("product");

      const snapshot = collector.collect(createMockStats());
      const contentTypeMetric = snapshot.metrics.find(
        (m) => m.definition.name === "cache_content_type_total"
      );

      expect(contentTypeMetric).toBeDefined();
      expect(contentTypeMetric?.values).toContainEqual(
        expect.objectContaining({
          labels: { content_type: "blog_post" },
          value: 2,
        })
      );
      expect(contentTypeMetric?.values).toContainEqual(
        expect.objectContaining({
          labels: { content_type: "product" },
          value: 1,
        })
      );
    });
  });

  describe("invalidation recording", () => {
    it("should record invalidation events", () => {
      collector.recordInvalidation("url_changed", "L1");
      collector.recordInvalidation("url_changed", "L2");
      collector.recordInvalidation("domain_updated", "L1");

      const snapshot = collector.collect(createMockStats());
      const invalidationMetric = snapshot.metrics.find(
        (m) => m.definition.name === "cache_invalidations_total"
      );

      expect(invalidationMetric).toBeDefined();
      expect(invalidationMetric?.values.length).toBe(3);
    });
  });

  describe("promotion recording", () => {
    it("should record cache level promotions", () => {
      collector.recordPromotion("L4", "L3");
      collector.recordPromotion("L3", "L2");
      collector.recordPromotion("L2", "L1");

      const snapshot = collector.collect(createMockStats());
      const promotionMetric = snapshot.metrics.find(
        (m) => m.definition.name === "cache_promotions_total"
      );

      expect(promotionMetric).toBeDefined();
      expect(promotionMetric?.values.length).toBe(3);
    });
  });

  describe("compression ratio recording", () => {
    it("should record and average compression ratios", () => {
      collector.recordCompressionRatio("L2", "lz4", 4.0);
      collector.recordCompressionRatio("L2", "lz4", 3.5);
      collector.recordCompressionRatio("L2", "lz4", 4.5);

      const snapshot = collector.collect(createMockStats());
      const compressionMetric = snapshot.metrics.find(
        (m) => m.definition.name === "cache_compression_ratio"
      );

      expect(compressionMetric).toBeDefined();
      expect(compressionMetric?.values[0].value).toBe(4.0); // average of 4+3.5+4.5
    });
  });

  describe("collect", () => {
    it("should collect all metrics from stats", () => {
      const snapshot = collector.collect(createMockStats());

      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.stats).toBeDefined();
      expect(snapshot.metrics.length).toBeGreaterThan(0);
    });

    it("should include per-level metrics", () => {
      const snapshot = collector.collect(createMockStats());

      // Check hits for each level
      const hitMetrics = snapshot.metrics.filter(
        (m) => m.definition.name === "cache_hits_total"
      );
      expect(hitMetrics.length).toBe(4); // L1, L2, L3, L4
    });

    it("should include total metrics", () => {
      const snapshot = collector.collect(createMockStats());

      const totalHitRate = snapshot.metrics.find(
        (m) => m.definition.name === "cache_hit_rate_total"
      );
      expect(totalHitRate).toBeDefined();
      expect(totalHitRate?.values[0].value).toBe(0.75);
    });
  });

  describe("alert checking", () => {
    it("should trigger alerts when thresholds are violated", () => {
      const lowHitRateStats = createMockStats({ totalHitRate: 0.25 });
      const snapshot = collector.collect(lowHitRateStats);

      expect(snapshot.alerts.length).toBeGreaterThan(0);
      // Should have both warning (< 0.5) and critical (< 0.3) alerts
      const criticalAlerts = snapshot.alerts.filter(
        (a) => a.threshold.severity === "critical"
      );
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it("should not trigger alerts when within thresholds", () => {
      const goodStats = createMockStats({
        totalHitRate: 0.85,
        avgLatencyMs: 5,
      });
      const snapshot = collector.collect(goodStats);

      const criticalAlerts = snapshot.alerts.filter(
        (a) => a.threshold.severity === "critical"
      );
      expect(criticalAlerts.length).toBe(0);
    });
  });

  describe("reset", () => {
    it("should clear all counters", () => {
      collector.recordContentType("blog_post");
      collector.recordInvalidation("url_changed", "L1");
      collector.recordPromotion("L4", "L3");

      collector.reset();

      const snapshot = collector.collect(createMockStats());

      // Should not have content type metrics after reset
      const contentTypeMetric = snapshot.metrics.find(
        (m) => m.definition.name === "cache_content_type_total"
      );
      expect(contentTypeMetric).toBeUndefined();
    });
  });

  describe("custom thresholds", () => {
    it("should support adding custom thresholds", () => {
      collector.addAlertThreshold({
        metric: "cache_requests_total",
        operator: ">",
        threshold: 100,
        severity: "warning",
        description: "High request volume",
      });

      const snapshot = collector.collect(
        createMockStats({ totalRequests: 500 })
      );
      const customAlert = snapshot.alerts.find(
        (a) => a.threshold.metric === "cache_requests_total"
      );
      expect(customAlert).toBeDefined();
    });

    it("should support removing thresholds", () => {
      collector.removeAlertThreshold("cache_hit_rate_total");

      const thresholds = collector.getAlertThresholds();
      const removed = thresholds.find(
        (t) => t.metric === "cache_hit_rate_total"
      );
      expect(removed).toBeUndefined();
    });
  });
});

// =============================================================================
// Prometheus Export Tests
// =============================================================================

describe("Prometheus Export", () => {
  let collector: CacheMetricsCollector;

  beforeEach(() => {
    collector = createMetricsCollector();
  });

  it("should export in valid Prometheus format", () => {
    const snapshot = collector.collect(createMockStats());
    const output = exportPrometheusFormat(snapshot);

    // Should have HELP lines
    expect(output).toContain("# HELP cache_hits_total");

    // Should have TYPE lines
    expect(output).toContain("# TYPE cache_hits_total counter");

    // Should have metric values
    expect(output).toMatch(/cache_hits_total\{level="L1"\} \d+/);
  });

  it("should format labeled metrics correctly", () => {
    collector.recordContentType("blog_post");
    const snapshot = collector.collect(createMockStats());
    const output = exportPrometheusFormat(snapshot);

    expect(output).toContain('cache_content_type_total{content_type="blog_post"}');
  });

  it("should format unlabeled metrics correctly", () => {
    const snapshot = collector.collect(createMockStats());
    const output = exportPrometheusFormat(snapshot);

    expect(output).toMatch(/cache_hit_rate_total 0\.\d+/);
  });
});

// =============================================================================
// JSON Export Tests
// =============================================================================

describe("JSON Export", () => {
  let collector: CacheMetricsCollector;

  beforeEach(() => {
    collector = createMetricsCollector();
  });

  it("should export complete JSON structure", () => {
    const snapshot = collector.collect(createMockStats());
    const json = exportJsonFormat(snapshot) as any;

    expect(json.timestamp).toBeDefined();
    expect(json.stats).toBeDefined();
    expect(json.stats.l1).toBeDefined();
    expect(json.stats.totalHitRate).toBeDefined();
    expect(json.alerts).toBeInstanceOf(Array);
  });

  it("should format dates as ISO strings", () => {
    const snapshot = collector.collect(createMockStats());
    const json = exportJsonFormat(snapshot) as any;

    expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(json.stats.lastResetAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should include alert details", () => {
    const lowHitRateStats = createMockStats({ totalHitRate: 0.2 });
    const snapshot = collector.collect(lowHitRateStats);
    const json = exportJsonFormat(snapshot) as any;

    expect(json.alerts.length).toBeGreaterThan(0);
    expect(json.alerts[0].metric).toBeDefined();
    expect(json.alerts[0].severity).toBeDefined();
    expect(json.alerts[0].currentValue).toBeDefined();
  });
});

// =============================================================================
// Dashboard Queries Tests
// =============================================================================

describe("Dashboard Queries", () => {
  it("should have all common queries defined", () => {
    expect(DASHBOARD_QUERIES.overallHitRate).toBeDefined();
    expect(DASHBOARD_QUERIES.levelHitRates).toBeDefined();
    expect(DASHBOARD_QUERIES.requestRate).toBeDefined();
    expect(DASHBOARD_QUERIES.costSavingsUsd).toBeDefined();
  });

  it("should format queries with time range", () => {
    const query = getDashboardQuery("requestRate", { timeRange: "15m" });
    expect(query).toContain("[15m]");
  });

  it("should return unmodified query for point-in-time metrics", () => {
    const query = getDashboardQuery("overallHitRate");
    expect(query).toBe("cache_hit_rate_total");
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe("calculateOverallHitRate", () => {
  it("should calculate correct hit rate", () => {
    const stats = createMockStats();
    // Total hits: 100 + 50 + 20 + 5 = 175
    // Total requests: 240
    // Rate: 175/240 = 0.729...

    const rate = calculateOverallHitRate(stats);
    expect(rate).toBeCloseTo(0.729, 2);
  });

  it("should return 0 for zero requests", () => {
    const stats = createMockStats({ totalRequests: 0 });
    const rate = calculateOverallHitRate(stats);
    expect(rate).toBe(0);
  });
});

describe("calculateWeightedLatency", () => {
  it("should calculate weighted average latency", () => {
    const stats = createMockStats();
    const latency = calculateWeightedLatency(stats);

    // Should be between min (0.5) and max (150)
    expect(latency).toBeGreaterThan(0);
    expect(latency).toBeLessThan(150);
  });

  it("should weight by hit+miss count", () => {
    // L1 has most activity (120), so should pull average toward L1's latency
    const stats = createMockStats();
    const latency = calculateWeightedLatency(stats);

    // With L1 having 120 requests and 0.5ms, it should pull average down
    expect(latency).toBeLessThan(50);
  });
});

describe("formatBytes", () => {
  it("should format bytes correctly", () => {
    expect(formatBytes(500)).toBe("500.00 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(1073741824)).toBe("1.00 GB");
  });

  it("should handle fractional values", () => {
    expect(formatBytes(1536)).toBe("1.50 KB");
    expect(formatBytes(2621440)).toBe("2.50 MB");
  });
});

describe("formatRate", () => {
  it("should format rates as percentages", () => {
    expect(formatRate(0.5)).toBe("50.00%");
    expect(formatRate(0.833)).toBe("83.30%");
    expect(formatRate(1)).toBe("100.00%");
    expect(formatRate(0)).toBe("0.00%");
  });
});

describe("formatLatency", () => {
  it("should format sub-millisecond latencies", () => {
    expect(formatLatency(0.5)).toBe("500us");
    expect(formatLatency(0.001)).toBe("1us");
  });

  it("should format millisecond latencies", () => {
    expect(formatLatency(5)).toBe("5.00ms");
    expect(formatLatency(15.5)).toBe("15.50ms");
  });

  it("should format second latencies", () => {
    expect(formatLatency(1500)).toBe("1.50s");
    expect(formatLatency(2000)).toBe("2.00s");
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe("createMetricsCollector", () => {
  it("should create collector with default thresholds", () => {
    const collector = createMetricsCollector();
    const thresholds = collector.getAlertThresholds();

    expect(thresholds.length).toBe(DEFAULT_ALERT_THRESHOLDS.length);
  });

  it("should create collector with custom thresholds", () => {
    const customThresholds = [
      {
        metric: "custom_metric",
        operator: ">" as const,
        threshold: 100,
        severity: "warning" as const,
        description: "Custom threshold",
      },
    ];

    const collector = createMetricsCollector(customThresholds);
    const thresholds = collector.getAlertThresholds();

    expect(thresholds.length).toBe(1);
    expect(thresholds[0].metric).toBe("custom_metric");
  });
});
