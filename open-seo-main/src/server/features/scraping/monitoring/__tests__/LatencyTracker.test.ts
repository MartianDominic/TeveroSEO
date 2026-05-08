/**
 * LatencyTracker Tests
 * Phase 95: Gap P3.G20 - P95 Latency Alerting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  LatencyTracker,
  getLatencyTracker,
  resetLatencyTracker,
  recordLatency,
  getP95LatencyMs,
  getLatencyStats,
} from "../LatencyTracker";
import { resetMetricsCollector } from "../MetricsCollector";

describe("LatencyTracker", () => {
  beforeEach(() => {
    resetLatencyTracker();
    resetMetricsCollector();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("record()", () => {
    it("should record latency values", () => {
      const tracker = new LatencyTracker({ windowSize: 10 });

      tracker.record(100);
      tracker.record(200);
      tracker.record(300);

      const stats = tracker.getStats();
      expect(stats.sampleCount).toBe(3);
    });

    it("should use circular buffer correctly", () => {
      const tracker = new LatencyTracker({ windowSize: 3 });

      // Fill buffer
      tracker.record(100);
      tracker.record(200);
      tracker.record(300);

      // Overflow - should replace oldest
      tracker.record(400);

      const stats = tracker.getStats();
      expect(stats.sampleCount).toBe(3);
      expect(stats.minMs).toBe(200); // 100 was replaced
      expect(stats.maxMs).toBe(400);
    });
  });

  describe("getP95Latency()", () => {
    it("should return 0 when no samples", () => {
      const tracker = new LatencyTracker();
      expect(tracker.getP95Latency()).toBe(0);
    });

    it("should calculate P95 correctly with small sample", () => {
      const tracker = new LatencyTracker({ windowSize: 100 });

      // Add 20 values: 1-20
      for (let i = 1; i <= 20; i++) {
        tracker.record(i * 100);
      }

      // P95 of [100, 200, ..., 2000] should be around 1905
      // (95th percentile of 20 values at index 18.05)
      const p95 = tracker.getP95Latency();
      expect(p95).toBeGreaterThan(1800);
      expect(p95).toBeLessThan(2000);
    });

    it("should calculate P95 correctly with 100 samples", () => {
      const tracker = new LatencyTracker({ windowSize: 100 });

      // Add values 1-100
      for (let i = 1; i <= 100; i++) {
        tracker.record(i);
      }

      // P95 should be around 95-96
      const p95 = tracker.getP95Latency();
      expect(p95).toBeGreaterThanOrEqual(94);
      expect(p95).toBeLessThanOrEqual(96);
    });
  });

  describe("getStats()", () => {
    it("should return correct statistics", () => {
      const tracker = new LatencyTracker({
        windowSize: 10,
        thresholdMs: 5000,
      });

      tracker.record(100);
      tracker.record(200);
      tracker.record(300);
      tracker.record(400);
      tracker.record(500);

      const stats = tracker.getStats();

      expect(stats.sampleCount).toBe(5);
      expect(stats.minMs).toBe(100);
      expect(stats.maxMs).toBe(500);
      expect(stats.avgMs).toBe(300);
      expect(stats.thresholdMs).toBe(5000);
      expect(stats.isAboveThreshold).toBe(false);
    });

    it("should detect threshold breach", () => {
      const tracker = new LatencyTracker({
        windowSize: 10,
        thresholdMs: 1000,
        minSamples: 5,
      });

      // Add high latency values
      for (let i = 0; i < 10; i++) {
        tracker.record(2000);
      }

      const stats = tracker.getStats();
      expect(stats.isAboveThreshold).toBe(true);
    });
  });

  describe("isAboveThreshold()", () => {
    it("should return false when below min samples", () => {
      const tracker = new LatencyTracker({
        windowSize: 100,
        thresholdMs: 1000,
        minSamples: 10,
      });

      // Add 5 high latency values (below minSamples)
      for (let i = 0; i < 5; i++) {
        tracker.record(5000);
      }

      expect(tracker.isAboveThreshold()).toBe(false);
    });

    it("should return true when P95 exceeds threshold", () => {
      const tracker = new LatencyTracker({
        windowSize: 100,
        thresholdMs: 1000,
        minSamples: 10,
      });

      // Add 20 high latency values
      for (let i = 0; i < 20; i++) {
        tracker.record(5000);
      }

      expect(tracker.isAboveThreshold()).toBe(true);
    });

    it("should return false when P95 is below threshold", () => {
      const tracker = new LatencyTracker({
        windowSize: 100,
        thresholdMs: 5000,
        minSamples: 10,
      });

      // Add 20 low latency values
      for (let i = 0; i < 20; i++) {
        tracker.record(1000);
      }

      expect(tracker.isAboveThreshold()).toBe(false);
    });
  });

  describe("alerting", () => {
    it("should emit console warning when threshold exceeded", () => {
      const tracker = new LatencyTracker({
        windowSize: 100,
        thresholdMs: 1000,
        minSamples: 5,
        alertCooldownMs: 0, // No cooldown for testing
      });

      // Add high latency values
      for (let i = 0; i < 10; i++) {
        tracker.record(5000);
      }

      expect(console.warn).toHaveBeenCalled();
      expect((console.warn as any).mock.calls[0][0]).toContain("P95 latency alert");
    });

    it("should respect alert cooldown", () => {
      const tracker = new LatencyTracker({
        windowSize: 100,
        thresholdMs: 1000,
        minSamples: 5,
        alertCooldownMs: 60000, // 1 minute cooldown
      });

      // First batch of high latency values
      for (let i = 0; i < 10; i++) {
        tracker.record(5000);
      }

      const firstCallCount = (console.warn as any).mock.calls.length;

      // Second batch should not trigger due to cooldown
      for (let i = 0; i < 10; i++) {
        tracker.record(5000);
      }

      expect((console.warn as any).mock.calls.length).toBe(firstCallCount);
    });

    it("should track consecutive breaches", () => {
      const tracker = new LatencyTracker({
        windowSize: 100,
        thresholdMs: 1000,
        minSamples: 5,
        alertCooldownMs: 0,
      });

      // Add high latency values to trigger multiple breaches
      for (let i = 0; i < 20; i++) {
        tracker.record(5000);
      }

      expect(tracker.getConsecutiveBreaches()).toBeGreaterThan(0);
    });

    it("should reset consecutive breaches when recovered", () => {
      const tracker = new LatencyTracker({
        windowSize: 10,
        thresholdMs: 1000,
        minSamples: 5,
        alertCooldownMs: 0,
      });

      // Add high latency values
      for (let i = 0; i < 10; i++) {
        tracker.record(5000);
      }

      expect(tracker.getConsecutiveBreaches()).toBeGreaterThan(0);

      // Add low latency values to recover (will replace high values in circular buffer)
      for (let i = 0; i < 10; i++) {
        tracker.record(100);
      }

      expect(tracker.getConsecutiveBreaches()).toBe(0);
    });
  });

  describe("reset()", () => {
    it("should reset all state", () => {
      const tracker = new LatencyTracker({ windowSize: 10 });

      tracker.record(100);
      tracker.record(200);

      tracker.reset();

      const stats = tracker.getStats();
      expect(stats.sampleCount).toBe(0);
      expect(tracker.getConsecutiveBreaches()).toBe(0);
    });
  });

  describe("singleton functions", () => {
    it("getLatencyTracker() should return singleton", () => {
      const tracker1 = getLatencyTracker();
      const tracker2 = getLatencyTracker();

      expect(tracker1).toBe(tracker2);
    });

    it("recordLatency() should use singleton", () => {
      recordLatency(100);
      recordLatency(200);

      const stats = getLatencyStats();
      expect(stats.sampleCount).toBe(2);
    });

    it("getP95LatencyMs() should return correct value", () => {
      // Record some values
      for (let i = 1; i <= 20; i++) {
        recordLatency(i * 100);
      }

      const p95 = getP95LatencyMs();
      expect(p95).toBeGreaterThan(0);
    });

    it("resetLatencyTracker() should create new instance", () => {
      const tracker1 = getLatencyTracker();
      tracker1.record(100);

      resetLatencyTracker();

      const tracker2 = getLatencyTracker();
      expect(tracker2.getStats().sampleCount).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle single value", () => {
      const tracker = new LatencyTracker({ windowSize: 10 });
      tracker.record(500);

      const stats = tracker.getStats();
      expect(stats.p50Ms).toBe(500);
      expect(stats.p95Ms).toBe(500);
      expect(stats.p99Ms).toBe(500);
      expect(stats.avgMs).toBe(500);
    });

    it("should handle all same values", () => {
      const tracker = new LatencyTracker({ windowSize: 10 });

      for (let i = 0; i < 10; i++) {
        tracker.record(1000);
      }

      const stats = tracker.getStats();
      expect(stats.p50Ms).toBe(1000);
      expect(stats.p95Ms).toBe(1000);
      expect(stats.avgMs).toBe(1000);
    });

    it("should handle very large window", () => {
      const tracker = new LatencyTracker({ windowSize: 1000 });

      for (let i = 0; i < 500; i++) {
        tracker.record(i);
      }

      const stats = tracker.getStats();
      expect(stats.sampleCount).toBe(500);
    });
  });
});
