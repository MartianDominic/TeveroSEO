/**
 * Tests for API Metrics Collection
 * Phase 40: Gap Closure - Observability for API endpoints
 */
import { describe, it, expect, beforeEach } from "vitest";
import { metrics, recordRequestMetrics } from "./metrics";

describe("Metrics", () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe("increment", () => {
    it("should increment a counter by 1 by default", () => {
      metrics.increment("api.requests", { endpoint: "test" });
      const snapshot = metrics.getSnapshot();
      expect(snapshot.counters["api.requests{endpoint=test}"]).toBe(1);
    });

    it("should increment a counter by specified value", () => {
      metrics.increment("api.checks.passed", {}, 5);
      const snapshot = metrics.getSnapshot();
      expect(snapshot.counters["api.checks.passed"]).toBe(5);
    });

    it("should accumulate multiple increments", () => {
      metrics.increment("api.requests", { endpoint: "test" });
      metrics.increment("api.requests", { endpoint: "test" });
      metrics.increment("api.requests", { endpoint: "test" });
      const snapshot = metrics.getSnapshot();
      expect(snapshot.counters["api.requests{endpoint=test}"]).toBe(3);
    });

    it("should handle multiple labels", () => {
      metrics.increment("api.requests", { endpoint: "suggestions", status: "success", clientId: "abc" });
      const snapshot = metrics.getSnapshot();
      // Labels are sorted alphabetically
      expect(snapshot.counters["api.requests{clientId=abc,endpoint=suggestions,status=success}"]).toBe(1);
    });

    it("should handle no labels", () => {
      metrics.increment("api.total");
      const snapshot = metrics.getSnapshot();
      expect(snapshot.counters["api.total"]).toBe(1);
    });
  });

  describe("timing", () => {
    it("should record timing metrics", () => {
      metrics.timing("api.latency", 150, { endpoint: "test" });
      const snapshot = metrics.getSnapshot();
      const timingKey = "api.latency{endpoint=test}";
      expect(snapshot.timings[timingKey]).toBeDefined();
      expect(snapshot.timings[timingKey].count).toBe(1);
      expect(snapshot.timings[timingKey].sum).toBe(150);
      expect(snapshot.timings[timingKey].min).toBe(150);
      expect(snapshot.timings[timingKey].max).toBe(150);
    });

    it("should calculate min/max/sum correctly", () => {
      metrics.timing("api.latency", 100, { endpoint: "test" });
      metrics.timing("api.latency", 200, { endpoint: "test" });
      metrics.timing("api.latency", 50, { endpoint: "test" });
      const snapshot = metrics.getSnapshot();
      const timingKey = "api.latency{endpoint=test}";
      expect(snapshot.timings[timingKey].count).toBe(3);
      expect(snapshot.timings[timingKey].sum).toBe(350);
      expect(snapshot.timings[timingKey].min).toBe(50);
      expect(snapshot.timings[timingKey].max).toBe(200);
    });
  });

  describe("getSnapshot", () => {
    it("should return empty snapshot when no metrics recorded", () => {
      const snapshot = metrics.getSnapshot();
      expect(snapshot.counters).toEqual({});
      expect(snapshot.timings).toEqual({});
    });

    it("should return all recorded metrics", () => {
      metrics.increment("api.requests", { endpoint: "a" });
      metrics.increment("api.requests", { endpoint: "b" });
      metrics.timing("api.latency", 100, { endpoint: "a" });

      const snapshot = metrics.getSnapshot();
      expect(Object.keys(snapshot.counters)).toHaveLength(2);
      expect(Object.keys(snapshot.timings)).toHaveLength(1);
    });
  });

  describe("reset", () => {
    it("should clear all metrics", () => {
      metrics.increment("api.requests", { endpoint: "test" });
      metrics.timing("api.latency", 100, { endpoint: "test" });

      metrics.reset();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.counters).toEqual({});
      expect(snapshot.timings).toEqual({});
    });
  });
});

describe("recordRequestMetrics", () => {
  beforeEach(() => {
    metrics.reset();
  });

  it("should record success metrics", () => {
    const startTime = Date.now() - 100; // 100ms ago
    recordRequestMetrics("suggestions", startTime, "success");

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters["api.requests{endpoint=suggestions,status=success}"]).toBe(1);
    expect(snapshot.timings["api.latency{endpoint=suggestions}"]).toBeDefined();
    expect(snapshot.timings["api.latency{endpoint=suggestions}"].count).toBe(1);
  });

  it("should record error metrics", () => {
    const startTime = Date.now() - 50;
    recordRequestMetrics("run-checks", startTime, "error");

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters["api.requests{endpoint=run-checks,status=error}"]).toBe(1);
  });

  it("should record validation_error metrics", () => {
    const startTime = Date.now() - 10;
    recordRequestMetrics("content.validate", startTime, "validation_error");

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters["api.requests{endpoint=content.validate,status=validation_error}"]).toBe(1);
  });

  it("should include additional labels", () => {
    const startTime = Date.now() - 100;
    recordRequestMetrics("suggestions", startTime, "success", { clientId: "client123" });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters["api.requests{clientId=client123,endpoint=suggestions,status=success}"]).toBe(1);
  });
});
