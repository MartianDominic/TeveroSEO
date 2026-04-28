/**
 * Circuit Breaker Tests
 *
 * Comprehensive test coverage for the CircuitBreaker pattern implementation.
 * Tests state machine transitions, timing behavior, and thread-safety.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CircuitBreaker, CircuitBreakerOpenError } from "./CircuitBreaker";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 60000,
      halfOpenMaxAttempts: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Initial State", () => {
    it("starts in CLOSED state", () => {
      expect(breaker.state).toBe("closed");
    });

    it("is not open initially", () => {
      expect(breaker.isOpen).toBe(false);
    });

    it("has zero failures and successes initially", () => {
      const stats = breaker.stats;
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.rejectedCount).toBe(0);
      expect(stats.lastFailure).toBeNull();
      expect(stats.lastOpened).toBeNull();
    });
  });

  describe("Failure Tracking", () => {
    it("tracks failures correctly", () => {
      breaker.recordFailure();
      expect(breaker.stats.failures).toBe(1);

      breaker.recordFailure();
      expect(breaker.stats.failures).toBe(2);
    });

    it("records lastFailure timestamp", () => {
      const now = Date.now();
      breaker.recordFailure();
      expect(breaker.stats.lastFailure).toBe(now);
    });

    it("stays closed below threshold", () => {
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.state).toBe("closed");
      expect(breaker.isOpen).toBe(false);
    });
  });

  describe("Opening Circuit", () => {
    it("opens after threshold failures", () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.state).toBe("open");
      expect(breaker.isOpen).toBe(true);
    });

    it("records lastOpened timestamp when opening", () => {
      const now = Date.now();

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.stats.lastOpened).toBe(now);
    });

    it("can be manually tripped", () => {
      breaker.trip();
      expect(breaker.state).toBe("open");
      expect(breaker.isOpen).toBe(true);
    });
  });

  describe("Rejecting Requests When Open", () => {
    beforeEach(() => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
    });

    it("rejects requests when OPEN", async () => {
      const fn = vi.fn().mockResolvedValue("result");

      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenError);
      expect(fn).not.toHaveBeenCalled();
    });

    it("increments rejectedCount on rejection", async () => {
      const fn = vi.fn().mockResolvedValue("result");

      try {
        await breaker.execute(fn);
      } catch {
        // Expected
      }

      expect(breaker.stats.rejectedCount).toBe(1);

      try {
        await breaker.execute(fn);
      } catch {
        // Expected
      }

      expect(breaker.stats.rejectedCount).toBe(2);
    });

    it("includes stats in CircuitBreakerOpenError", async () => {
      const fn = vi.fn().mockResolvedValue("result");

      try {
        await breaker.execute(fn);
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError);
        expect((error as CircuitBreakerOpenError).stats.state).toBe("open");
        expect((error as CircuitBreakerOpenError).stats.failures).toBe(3);
      }
    });
  });

  describe("HALF_OPEN State", () => {
    beforeEach(() => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
    });

    it("transitions to HALF_OPEN after timeout", () => {
      expect(breaker.state).toBe("open");

      vi.advanceTimersByTime(60000);

      expect(breaker.state).toBe("half_open");
      expect(breaker.isOpen).toBe(false);
    });

    it("allows one request in HALF_OPEN state", async () => {
      vi.advanceTimersByTime(60000);
      expect(breaker.state).toBe("half_open");

      const fn = vi.fn().mockResolvedValue("success");
      await breaker.execute(fn);

      expect(fn).toHaveBeenCalledOnce();
    });

    it("rejects additional requests beyond halfOpenMaxAttempts", async () => {
      vi.advanceTimersByTime(60000);

      // First request - allowed
      const slowFn = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve("result"), 100))
      );
      const firstRequest = breaker.execute(slowFn);

      // Second request - should be rejected
      const fn2 = vi.fn().mockResolvedValue("result");
      await expect(breaker.execute(fn2)).rejects.toThrow(CircuitBreakerOpenError);

      // Complete first request
      vi.advanceTimersByTime(100);
      await firstRequest;
    });
  });

  describe("Closing Circuit on HALF_OPEN Success", () => {
    beforeEach(() => {
      // Open the circuit then advance to HALF_OPEN
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      vi.advanceTimersByTime(60000);
    });

    it("closes on successful HALF_OPEN request", async () => {
      expect(breaker.state).toBe("half_open");

      const fn = vi.fn().mockResolvedValue("success");
      await breaker.execute(fn);

      expect(breaker.state).toBe("closed");
      expect(breaker.isOpen).toBe(false);
    });

    it("resets failure count on close", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      await breaker.execute(fn);

      expect(breaker.stats.failures).toBe(0);
    });

    it("resets halfOpenAttempts on close", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      await breaker.execute(fn);

      expect(breaker.stats.halfOpenAttempts).toBe(0);
    });
  });

  describe("Re-opening Circuit on HALF_OPEN Failure", () => {
    beforeEach(() => {
      // Open the circuit then advance to HALF_OPEN
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      vi.advanceTimersByTime(60000);
    });

    it("re-opens on HALF_OPEN failure", async () => {
      expect(breaker.state).toBe("half_open");

      const fn = vi.fn().mockRejectedValue(new Error("Still failing"));

      await expect(breaker.execute(fn)).rejects.toThrow("Still failing");

      expect(breaker.state).toBe("open");
      expect(breaker.isOpen).toBe(true);
    });

    it("updates lastOpened on re-open", async () => {
      const beforeReopen = Date.now();

      const fn = vi.fn().mockRejectedValue(new Error("Still failing"));
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(breaker.stats.lastOpened).toBe(beforeReopen);
    });
  });

  describe("Reset", () => {
    it("clears all state", () => {
      // Build up some state
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Reset
      breaker.reset();

      const stats = breaker.stats;
      expect(stats.state).toBe("closed");
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.lastFailure).toBeNull();
      expect(stats.lastOpened).toBeNull();
      expect(stats.rejectedCount).toBe(0);
      expect(stats.halfOpenAttempts).toBe(0);
    });

    it("allows requests after reset", async () => {
      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Reset
      breaker.reset();

      const fn = vi.fn().mockResolvedValue("result");
      const result = await breaker.execute(fn);

      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe("Execute Function", () => {
    it("returns function result on success", async () => {
      const fn = vi.fn().mockResolvedValue({ data: "test" });
      const result = await breaker.execute(fn);

      expect(result).toEqual({ data: "test" });
    });

    it("increments success count on success", async () => {
      const fn = vi.fn().mockResolvedValue("result");

      await breaker.execute(fn);
      await breaker.execute(fn);
      await breaker.execute(fn);

      expect(breaker.stats.successes).toBe(3);
    });

    it("propagates errors from function", async () => {
      const error = new Error("Function failed");
      const fn = vi.fn().mockRejectedValue(error);

      await expect(breaker.execute(fn)).rejects.toThrow("Function failed");
    });

    it("increments failure count on error", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      try {
        await breaker.execute(fn);
      } catch {
        // Expected
      }

      expect(breaker.stats.failures).toBe(1);
    });
  });

  describe("Concurrent Access", () => {
    it("handles concurrent requests in CLOSED state", async () => {
      const results: number[] = [];

      // Use immediate resolution for concurrent test
      const makeFn = (n: number) => async () => {
        results.push(n);
        return n;
      };

      const promises = [
        breaker.execute(makeFn(1)),
        breaker.execute(makeFn(2)),
        breaker.execute(makeFn(3)),
      ];

      await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(breaker.stats.successes).toBe(3);
    });

    it("handles concurrent failures correctly", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new Error("concurrent failure"));

      const promises = [
        breaker.execute(fn).catch(() => {}),
        breaker.execute(fn).catch(() => {}),
        breaker.execute(fn).catch(() => {}),
      ];

      await Promise.all(promises);

      expect(breaker.stats.failures).toBe(3);
      expect(breaker.state).toBe("open");
    });

    it("serializes state transitions with sequential failures", async () => {
      // Test that failures accumulate correctly even when concurrent
      const failingFn = vi.fn().mockRejectedValue(new Error("failure"));

      const promises = Array(5)
        .fill(null)
        .map(() => breaker.execute(failingFn).catch(() => {}));

      await Promise.all(promises);

      // Circuit should be open, failures should be counted
      expect(breaker.state).toBe("open");
      expect(breaker.stats.failures).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Custom Configuration", () => {
    it("respects custom failureThreshold", () => {
      const customBreaker = new CircuitBreaker({ failureThreshold: 5 });

      for (let i = 0; i < 4; i++) {
        customBreaker.recordFailure();
      }
      expect(customBreaker.state).toBe("closed");

      customBreaker.recordFailure();
      expect(customBreaker.state).toBe("open");
    });

    it("respects custom resetTimeout", () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
      });

      customBreaker.recordFailure();
      expect(customBreaker.state).toBe("open");

      vi.advanceTimersByTime(4999);
      expect(customBreaker.state).toBe("open");

      vi.advanceTimersByTime(1);
      expect(customBreaker.state).toBe("half_open");
    });

    it("respects custom halfOpenMaxAttempts", async () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        halfOpenMaxAttempts: 3,
      });

      customBreaker.recordFailure();
      vi.advanceTimersByTime(1000);

      const slowFn = () =>
        new Promise<string>((resolve) => setTimeout(() => resolve("ok"), 100));

      // Should allow 3 concurrent requests
      const p1 = customBreaker.execute(slowFn);
      const p2 = customBreaker.execute(slowFn);
      const p3 = customBreaker.execute(slowFn);

      // Fourth should be rejected
      await expect(customBreaker.execute(slowFn)).rejects.toThrow(
        CircuitBreakerOpenError
      );

      vi.advanceTimersByTime(100);
      await Promise.all([p1, p2, p3]);
    });

    it("uses defaults when no config provided", () => {
      const defaultBreaker = new CircuitBreaker();

      // Default failureThreshold is 3
      defaultBreaker.recordFailure();
      defaultBreaker.recordFailure();
      expect(defaultBreaker.state).toBe("closed");

      defaultBreaker.recordFailure();
      expect(defaultBreaker.state).toBe("open");

      // Default resetTimeout is 60000
      vi.advanceTimersByTime(59999);
      expect(defaultBreaker.state).toBe("open");

      vi.advanceTimersByTime(1);
      expect(defaultBreaker.state).toBe("half_open");
    });
  });

  describe("Edge Cases", () => {
    it("handles immediate success after failures below threshold", async () => {
      breaker.recordFailure();
      breaker.recordFailure();

      const fn = vi.fn().mockResolvedValue("success");
      await breaker.execute(fn);

      expect(breaker.state).toBe("closed");
      expect(breaker.stats.successes).toBe(1);
      // Failures not reset on success in CLOSED state
      expect(breaker.stats.failures).toBe(2);
    });

    it("handles rapid open/close cycles", async () => {
      for (let cycle = 0; cycle < 3; cycle++) {
        // Open circuit
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();
        expect(breaker.state).toBe("open");

        // Wait for HALF_OPEN
        vi.advanceTimersByTime(60000);
        expect(breaker.state).toBe("half_open");

        // Successful test closes circuit
        const fn = vi.fn().mockResolvedValue("success");
        await breaker.execute(fn);
        expect(breaker.state).toBe("closed");
      }
    });

    it("handles async function that returns undefined", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const result = await breaker.execute(fn);

      expect(result).toBeUndefined();
      expect(breaker.stats.successes).toBe(1);
    });

    it("handles function that throws non-Error", async () => {
      const fn = vi.fn().mockRejectedValue("string error");

      await expect(breaker.execute(fn)).rejects.toBe("string error");
      expect(breaker.stats.failures).toBe(1);
    });
  });
});
