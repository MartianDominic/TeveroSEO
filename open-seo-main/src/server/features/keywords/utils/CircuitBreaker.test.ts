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

  describe("Metrics and Observability (P3.G21)", () => {
    it("has a configurable name", () => {
      const namedBreaker = new CircuitBreaker({ name: "my-api-breaker" });
      expect(namedBreaker.name).toBe("my-api-breaker");
    });

    it("defaults to 'unnamed' if no name provided", () => {
      expect(breaker.name).toBe("unnamed");
    });

    it("calls onStateChange callback on state transitions", async () => {
      const onStateChange = vi.fn();
      const customBreaker = new CircuitBreaker({
        name: "test-breaker",
        failureThreshold: 2,
        onStateChange,
      });

      // Trigger CLOSED -> OPEN
      customBreaker.recordFailure();
      customBreaker.recordFailure();

      // Allow microtask to run
      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

      expect(onStateChange).toHaveBeenCalledOnce();
      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test-breaker",
          fromState: "closed",
          toState: "open",
          reason: "threshold_reached",
        })
      );
    });

    it("includes full stats in state transition event", async () => {
      const onStateChange = vi.fn();
      const customBreaker = new CircuitBreaker({
        name: "stats-breaker",
        failureThreshold: 2,
        onStateChange,
      });

      customBreaker.recordFailure();
      customBreaker.recordFailure();

      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

      const transition = onStateChange.mock.calls[0][0];
      expect(transition.stats).toBeDefined();
      expect(transition.stats.failures).toBe(2);
      expect(transition.stats.state).toBe("open");
    });

    it("tracks state duration in transition events", async () => {
      const onStateChange = vi.fn();
      const customBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
        onStateChange,
      });

      // Open circuit
      customBreaker.recordFailure();
      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

      // Advance time and transition to half_open
      vi.advanceTimersByTime(5000);
      customBreaker.state; // Trigger state check

      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

      // Should have two transitions: closed->open, open->half_open
      expect(onStateChange).toHaveBeenCalledTimes(2);

      const halfOpenTransition = onStateChange.mock.calls[1][0];
      expect(halfOpenTransition.fromState).toBe("open");
      expect(halfOpenTransition.toState).toBe("half_open");
      expect(halfOpenTransition.durationInPreviousStateMs).toBe(5000);
    });

    it("provides getMetrics() for dashboard polling", () => {
      const metrics = breaker.getMetrics();

      expect(metrics).toHaveProperty("name");
      expect(metrics).toHaveProperty("state");
      expect(metrics).toHaveProperty("totalFailures");
      expect(metrics).toHaveProperty("totalSuccesses");
      expect(metrics).toHaveProperty("totalRejected");
      expect(metrics).toHaveProperty("stateTransitionCount");
      expect(metrics).toHaveProperty("currentStateDurationMs");
      expect(metrics).toHaveProperty("createdAt");
      expect(metrics).toHaveProperty("lastTransitionAt");
      expect(metrics).toHaveProperty("openCount");
      expect(metrics).toHaveProperty("avgOpenDurationMs");
      expect(metrics).toHaveProperty("stats");
    });

    it("tracks openCount correctly", async () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
      });

      expect(customBreaker.getMetrics().openCount).toBe(0);

      // First open
      customBreaker.recordFailure();
      expect(customBreaker.getMetrics().openCount).toBe(1);

      // Recover
      vi.advanceTimersByTime(1000);
      await customBreaker.execute(vi.fn().mockResolvedValue("ok"));
      expect(customBreaker.state).toBe("closed");

      // Second open
      customBreaker.recordFailure();
      expect(customBreaker.getMetrics().openCount).toBe(2);
    });

    it("calculates avgOpenDurationMs", async () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
      });

      // First open for 1000ms
      customBreaker.recordFailure();
      vi.advanceTimersByTime(1000);
      await customBreaker.execute(vi.fn().mockResolvedValue("ok"));

      // Second open for 2000ms
      customBreaker.recordFailure();
      vi.advanceTimersByTime(2000);
      customBreaker.state; // Trigger half_open transition

      const metrics = customBreaker.getMetrics();
      // Average of 1000 + 2000 = 1500ms
      expect(metrics.avgOpenDurationMs).toBe(1500);
    });

    it("tracks stateTransitionCount", async () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
      });

      expect(customBreaker.getMetrics().stateTransitionCount).toBe(0);

      // closed -> open
      customBreaker.recordFailure();
      expect(customBreaker.getMetrics().stateTransitionCount).toBe(1);

      // open -> half_open
      vi.advanceTimersByTime(1000);
      customBreaker.state;
      expect(customBreaker.getMetrics().stateTransitionCount).toBe(2);

      // half_open -> closed
      await customBreaker.execute(vi.fn().mockResolvedValue("ok"));
      expect(customBreaker.getMetrics().stateTransitionCount).toBe(3);
    });

    it("does not throw if onStateChange callback throws", async () => {
      const throwingCallback = vi.fn().mockImplementation(() => {
        throw new Error("Callback error");
      });

      const customBreaker = new CircuitBreaker({
        failureThreshold: 1,
        onStateChange: throwingCallback,
      });

      // Should not throw even though callback throws
      expect(() => customBreaker.recordFailure()).not.toThrow();

      // Allow microtask to run
      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

      expect(throwingCallback).toHaveBeenCalled();
      // Circuit should still be open
      expect(customBreaker.state).toBe("open");
    });

    it("emits metrics with correct reason for each transition type", async () => {
      const onStateChange = vi.fn();
      const customBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        onStateChange,
      });

      // threshold_reached
      customBreaker.recordFailure();
      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
      expect(onStateChange.mock.calls[0][0].reason).toBe("threshold_reached");

      // timeout_elapsed
      vi.advanceTimersByTime(1000);
      customBreaker.state;
      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
      expect(onStateChange.mock.calls[1][0].reason).toBe("timeout_elapsed");

      // recovery_success
      await customBreaker.execute(vi.fn().mockResolvedValue("ok"));
      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
      expect(onStateChange.mock.calls[2][0].reason).toBe("recovery_success");

      // manual_trip
      customBreaker.trip();
      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
      expect(onStateChange.mock.calls[3][0].reason).toBe("manual_trip");

      // manual_reset
      customBreaker.reset();
      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
      expect(onStateChange.mock.calls[4][0].reason).toBe("manual_reset");
    });

    it("emits recovery_failure when half_open test fails", async () => {
      const onStateChange = vi.fn();
      const customBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        onStateChange,
      });

      // Open circuit
      customBreaker.recordFailure();

      // Transition to half_open
      vi.advanceTimersByTime(1000);
      customBreaker.state;

      // Fail the test request
      await expect(
        customBreaker.execute(vi.fn().mockRejectedValue(new Error("fail")))
      ).rejects.toThrow();

      await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

      // Find the recovery_failure transition
      const recoveryFailureCall = onStateChange.mock.calls.find(
        (call) => call[0].reason === "recovery_failure"
      );
      expect(recoveryFailureCall).toBeDefined();
      expect(recoveryFailureCall![0].fromState).toBe("half_open");
      expect(recoveryFailureCall![0].toState).toBe("open");
    });
  });
});
