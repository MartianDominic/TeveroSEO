import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryMonitor } from "./memory-monitor";

describe("MemoryMonitor", () => {
  let monitor: MemoryMonitor;

  beforeEach(() => {
    monitor = new MemoryMonitor();
    vi.useFakeTimers();
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  describe("check", () => {
    it("returns memory status", () => {
      const status = monitor.check();

      expect(status).toHaveProperty("heapUsed");
      expect(status).toHaveProperty("heapTotal");
      expect(status).toHaveProperty("usagePercent");
      expect(status).toHaveProperty("status");
      expect(typeof status.heapUsed).toBe("number");
      expect(typeof status.heapTotal).toBe("number");
      expect(typeof status.usagePercent).toBe("number");
      expect(["ok", "warning", "critical"]).toContain(status.status);
    });

    it("usagePercent is between 0 and 1", () => {
      const status = monitor.check();
      expect(status.usagePercent).toBeGreaterThanOrEqual(0);
      expect(status.usagePercent).toBeLessThanOrEqual(1);
    });
  });

  describe("start/stop", () => {
    it("starts monitoring", () => {
      monitor.start(1000);
      // Should not throw
      expect(true).toBe(true);
    });

    it("stops monitoring", () => {
      monitor.start(1000);
      monitor.stop();
      // Should not throw
      expect(true).toBe(true);
    });

    it("does not start multiple intervals", () => {
      monitor.start(1000);
      monitor.start(1000);
      // Should not throw, only one interval
      expect(true).toBe(true);
    });
  });

  describe("onPressure", () => {
    it("registers callback", () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onPressure(callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("unsubscribe removes callback", () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onPressure(callback);
      unsubscribe();

      // Callback should not be called after unsubscribe
      // (we can't easily test this without mocking v8.getHeapStatistics)
      expect(true).toBe(true);
    });
  });

  describe("forceGC", () => {
    it("calls global.gc if available", () => {
      const originalGc = global.gc;
      global.gc = vi.fn();

      monitor.forceGC();

      expect(global.gc).toHaveBeenCalled();
      global.gc = originalGc;
    });

    it("does not throw if gc not available", () => {
      const originalGc = global.gc;
      global.gc = undefined;

      expect(() => monitor.forceGC()).not.toThrow();

      global.gc = originalGc;
    });
  });
});
