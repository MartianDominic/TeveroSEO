/**
 * CircuitBreaker Unit Tests
 * Phase 95-08: Test Coverage & Reliability
 *
 * Tests circuit breaker state transitions, error filtering,
 * and manual override capabilities.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker, CircuitOpenError, createCircuitBreaker } from "../CircuitBreaker";

// =============================================================================
// Test Helpers
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Tests
// =============================================================================

describe("CircuitBreaker", () => {
  let circuit: CircuitBreaker;
  let mockOperation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    circuit = new CircuitBreaker({
      name: "test-circuit",
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      volumeThreshold: 5,
    });
    mockOperation = vi.fn();
  });

  describe("Closed State", () => {
    it("should execute operations normally when closed", async () => {
      mockOperation.mockResolvedValue("success");

      const result = await circuit.execute(mockOperation);

      expect(result).toBe("success");
      expect(circuit.getState()).toBe("closed");
    });

    it("should transition to open after failure threshold", async () => {
      mockOperation.mockRejectedValue(new Error("fail"));

      // Build up volume
      for (let i = 0; i < 5; i++) {
        try {
          await circuit.execute(mockOperation);
        } catch {}
      }

      expect(circuit.getState()).toBe("open");
    });

    it("should reset failure count on success", async () => {
      mockOperation
        .mockRejectedValueOnce(new Error("fail"))
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce("success")
        .mockRejectedValueOnce(new Error("fail"))
        .mockRejectedValueOnce(new Error("fail"));

      // Two failures
      try {
        await circuit.execute(mockOperation);
      } catch {}
      try {
        await circuit.execute(mockOperation);
      } catch {}

      // Success - should reset count
      await circuit.execute(mockOperation);

      // Two more failures - should not trip (count reset)
      try {
        await circuit.execute(mockOperation);
      } catch {}
      try {
        await circuit.execute(mockOperation);
      } catch {}

      expect(circuit.getState()).toBe("closed");
    });

    it("should not open before volume threshold reached", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        volumeThreshold: 10, // Higher volume required
      });

      mockOperation.mockRejectedValue(new Error("fail"));

      // Only 5 failures - below volume threshold
      for (let i = 0; i < 5; i++) {
        try {
          await circuit.execute(mockOperation);
        } catch {}
      }

      expect(circuit.getState()).toBe("closed");
    });
  });

  describe("Open State", () => {
    it("should fail fast when open", async () => {
      // Trip the circuit
      mockOperation.mockRejectedValue(new Error("fail"));
      for (let i = 0; i < 10; i++) {
        try {
          await circuit.execute(mockOperation);
        } catch {}
      }

      mockOperation.mockClear();

      await expect(circuit.execute(mockOperation)).rejects.toThrow(CircuitOpenError);

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it("should transition to half-open after timeout", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 100,
        volumeThreshold: 1,
      });

      mockOperation.mockRejectedValueOnce(new Error("fail"));
      try {
        await circuit.execute(mockOperation);
      } catch {}

      expect(circuit.getState()).toBe("open");

      await sleep(150);

      mockOperation.mockResolvedValueOnce("success");
      await circuit.execute(mockOperation);

      expect(circuit.getState()).toBe("closed");
    });

    it("should provide time until retry in error", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 5000,
        volumeThreshold: 1,
      });

      mockOperation.mockRejectedValueOnce(new Error("fail"));
      try {
        await circuit.execute(mockOperation);
      } catch {}

      try {
        await circuit.execute(mockOperation);
        expect.fail("Should have thrown CircuitOpenError");
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        expect((error as CircuitOpenError).retryAfter).toBeGreaterThan(0);
        expect((error as CircuitOpenError).retryAfter).toBeLessThanOrEqual(5000);
      }
    });
  });

  describe("Half-Open State", () => {
    it("should transition to closed after success threshold", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 100,
        volumeThreshold: 1,
      });

      // Trip circuit
      mockOperation.mockRejectedValueOnce(new Error("fail"));
      try {
        await circuit.execute(mockOperation);
      } catch {}

      await sleep(150);

      // First success in half-open
      mockOperation.mockResolvedValue("success");
      await circuit.execute(mockOperation);
      expect(circuit.getState()).toBe("half-open");

      // Second success - should close
      await circuit.execute(mockOperation);
      expect(circuit.getState()).toBe("closed");
    });

    it("should transition back to open on failure in half-open", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 100,
        volumeThreshold: 1,
      });

      // Trip circuit
      mockOperation.mockRejectedValueOnce(new Error("fail"));
      try {
        await circuit.execute(mockOperation);
      } catch {}

      await sleep(150);

      // Fail in half-open
      mockOperation.mockRejectedValueOnce(new Error("fail"));
      try {
        await circuit.execute(mockOperation);
      } catch {}

      expect(circuit.getState()).toBe("open");
    });
  });

  describe("Error Filtering", () => {
    it("should not count filtered errors as failures", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 1000,
        volumeThreshold: 1,
        errorFilter: (error) => !error.message.includes("404"),
      });

      const notFoundError = new Error("404 Not Found");
      mockOperation.mockRejectedValue(notFoundError);

      // Many 404s shouldn't trip circuit
      for (let i = 0; i < 10; i++) {
        try {
          await circuit.execute(mockOperation);
        } catch {}
      }

      expect(circuit.getState()).toBe("closed");
    });

    it("should count non-filtered errors normally", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 1000,
        volumeThreshold: 1,
        errorFilter: (error) => !error.message.includes("404"),
      });

      const serverError = new Error("500 Server Error");
      mockOperation.mockRejectedValue(serverError);

      // Server errors should trip circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuit.execute(mockOperation);
        } catch {}
      }

      expect(circuit.getState()).toBe("open");
    });
  });

  describe("Manual Override", () => {
    it("should allow forcing circuit open", () => {
      expect(circuit.getState()).toBe("closed");

      circuit.forceOpen();

      expect(circuit.getState()).toBe("open");
    });

    it("should allow forcing circuit closed", async () => {
      // Trip circuit
      mockOperation.mockRejectedValue(new Error("fail"));
      for (let i = 0; i < 10; i++) {
        try {
          await circuit.execute(mockOperation);
        } catch {}
      }

      expect(circuit.getState()).toBe("open");

      circuit.forceClose();

      expect(circuit.getState()).toBe("closed");
    });
  });

  describe("Statistics", () => {
    it("should track total requests and failures", async () => {
      mockOperation
        .mockResolvedValueOnce("success")
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce("success");

      await circuit.execute(mockOperation);
      try {
        await circuit.execute(mockOperation);
      } catch {}
      await circuit.execute(mockOperation);

      const stats = circuit.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalFailures).toBe(1);
    });

    it("should track last success and failure timestamps", async () => {
      mockOperation.mockResolvedValueOnce("success").mockRejectedValueOnce(new Error("fail"));

      await circuit.execute(mockOperation);

      const statsAfterSuccess = circuit.getStats();
      expect(statsAfterSuccess.lastSuccess).toBeDefined();

      try {
        await circuit.execute(mockOperation);
      } catch {}

      const statsAfterFailure = circuit.getStats();
      expect(statsAfterFailure.lastFailure).toBeDefined();
    });

    it("should track state transition timestamps", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 100,
        volumeThreshold: 1,
      });

      mockOperation.mockRejectedValueOnce(new Error("fail"));
      try {
        await circuit.execute(mockOperation);
      } catch {}

      const statsWhenOpen = circuit.getStats();
      expect(statsWhenOpen.openedAt).toBeDefined();
      expect(statsWhenOpen.state).toBe("open");

      await sleep(150);

      mockOperation.mockResolvedValueOnce("success");
      await circuit.execute(mockOperation);

      const statsWhenClosed = circuit.getStats();
      expect(statsWhenClosed.closedAt).toBeDefined();
      expect(statsWhenClosed.state).toBe("closed");
    });
  });

  describe("State Change Events", () => {
    it("should emit state change events", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 100,
        volumeThreshold: 1,
      });

      const stateChanges: Array<{ old: string; new: string }> = [];
      circuit.onStateChange((oldState, newState) => {
        stateChanges.push({ old: oldState, new: newState });
      });

      mockOperation.mockRejectedValueOnce(new Error("fail"));
      try {
        await circuit.execute(mockOperation);
      } catch {}

      expect(stateChanges).toContainEqual({ old: "closed", new: "open" });
    });
  });

  describe("Factory Function", () => {
    it("should create circuit with defaults", () => {
      const circuit = createCircuitBreaker("my-circuit");

      expect(circuit.getState()).toBe("closed");

      const stats = circuit.getStats();
      expect(stats.state).toBe("closed");
    });

    it("should allow overriding defaults", () => {
      const circuit = createCircuitBreaker("my-circuit", {
        failureThreshold: 10,
        timeout: 60000,
      });

      expect(circuit.getState()).toBe("closed");
    });
  });

  describe("Edge Cases", () => {
    it("should handle synchronous errors", async () => {
      const syncError = new Error("Synchronous error");
      mockOperation.mockImplementation(() => {
        throw syncError;
      });

      await expect(circuit.execute(mockOperation)).rejects.toThrow("Synchronous error");
    });

    it("should not transition from state to itself", async () => {
      const stateChanges: Array<{ old: string; new: string }> = [];
      circuit.onStateChange((oldState, newState) => {
        stateChanges.push({ old: oldState, new: newState });
      });

      circuit.forceClose();
      circuit.forceClose(); // Should not emit

      expect(stateChanges.length).toBe(0); // Already closed
    });

    it("should handle listener errors gracefully", async () => {
      circuit = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 100,
        volumeThreshold: 1,
      });

      circuit.onStateChange(() => {
        throw new Error("Listener error");
      });

      mockOperation.mockRejectedValueOnce(new Error("fail"));

      // Should not throw despite listener error
      await expect(circuit.execute(mockOperation)).rejects.toThrow("fail");
      expect(circuit.getState()).toBe("open");
    });
  });
});
