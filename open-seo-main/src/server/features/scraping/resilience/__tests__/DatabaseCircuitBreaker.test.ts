/**
 * DatabaseCircuitBreaker Unit Tests
 * Phase 95: Gap Closure - GAP-S1, GAP-S3
 *
 * Tests database-specific circuit breaker functionality:
 * - State transitions (closed, open, half-open)
 * - Graceful degradation methods (executeOrNull, executeOrDefault)
 * - Slow query detection
 * - Health check functionality
 * - Singleton management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DatabaseCircuitBreaker,
  getDatabaseCircuitBreaker,
  resetDatabaseCircuitBreaker,
  createDatabaseCircuitBreaker,
  CircuitOpenError,
} from "../DatabaseCircuitBreaker";

// =============================================================================
// Test Helpers
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock the external dependencies
vi.mock("../monitoring/MetricsCollector", () => ({
  getMetricsCollector: () => ({
    setGauge: vi.fn(),
    recordDuration: vi.fn(),
  }),
  recordCircuitState: vi.fn(),
}));

vi.mock("../logging", () => ({
  createComponentLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

// =============================================================================
// Tests
// =============================================================================

describe("DatabaseCircuitBreaker", () => {
  let circuitBreaker: DatabaseCircuitBreaker;

  beforeEach(() => {
    // Reset singleton before each test
    resetDatabaseCircuitBreaker();

    // Create a new instance with fast settings for testing
    circuitBreaker = createDatabaseCircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      recoveryTimeoutMs: 100,
      healthCheckIntervalMs: 50,
      slowQueryThresholdMs: 50,
      volumeThreshold: 1, // Low volume threshold for faster testing
    });
  });

  afterEach(() => {
    // Clean up health checks after each test
    circuitBreaker.stopHealthChecks();
    resetDatabaseCircuitBreaker();
  });

  // ===========================================================================
  // execute() Tests
  // ===========================================================================

  describe("execute()", () => {
    it("should execute operation when circuit is closed", async () => {
      const result = await circuitBreaker.execute(async () => "success");
      expect(result).toBe("success");
      expect(circuitBreaker.getState()).toBe("closed");
    });

    it("should propagate operation results correctly", async () => {
      const data = { id: 1, name: "test" };
      const result = await circuitBreaker.execute(async () => data);
      expect(result).toEqual(data);
    });

    it("should open circuit after failure threshold", async () => {
      const failingOp = async () => {
        throw new Error("Connection refused");
      };

      // Execute failures until circuit opens
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreaker.execute(failingOp)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe("open");
    });

    it("should throw CircuitOpenError when circuit is open", async () => {
      circuitBreaker.forceOpen();

      await expect(circuitBreaker.execute(async () => "success")).rejects.toThrow(
        CircuitOpenError
      );
    });

    it("should transition to half-open after recovery timeout", async () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe("open");

      // Wait for recovery timeout
      await sleep(150);

      // Next call should attempt (circuit transitions to half-open)
      const result = await circuitBreaker.execute(async () => "recovered");
      expect(result).toBe("recovered");
      // After success in half-open, may need more successes to close
    });

    it("should re-open on half-open failure", async () => {
      circuitBreaker.forceOpen();
      await sleep(150);

      // Fail during half-open attempt
      await expect(
        circuitBreaker.execute(async () => {
          throw new Error("Still failing");
        })
      ).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe("open");
    });

    it("should not count non-recoverable errors as failures", async () => {
      // Unique constraint violations should not trip the circuit
      const constraintError = async () => {
        throw new Error("unique constraint violation on users_email_key");
      };

      // Execute many constraint errors
      for (let i = 0; i < 10; i++) {
        await expect(circuitBreaker.execute(constraintError)).rejects.toThrow();
      }

      // Circuit should still be closed
      expect(circuitBreaker.getState()).toBe("closed");
    });

    it("should count connection errors as failures", async () => {
      const connectionError = async () => {
        throw new Error("ECONNREFUSED");
      };

      // Execute connection errors
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreaker.execute(connectionError)).rejects.toThrow();
      }

      // Circuit should be open
      expect(circuitBreaker.getState()).toBe("open");
    });

    it("should count timeout errors as failures", async () => {
      const timeoutError = async () => {
        throw new Error("connection timeout");
      };

      for (let i = 0; i < 5; i++) {
        await expect(circuitBreaker.execute(timeoutError)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe("open");
    });
  });

  // ===========================================================================
  // executeOrNull() Tests
  // ===========================================================================

  describe("executeOrNull()", () => {
    it("should return result when circuit is closed", async () => {
      const result = await circuitBreaker.executeOrNull(async () => "success");
      expect(result).toBe("success");
    });

    it("should return null when circuit is open", async () => {
      circuitBreaker.forceOpen();

      const result = await circuitBreaker.executeOrNull(async () => "success");
      expect(result).toBeNull();
    });

    it("should propagate non-CircuitOpenError errors", async () => {
      const dbError = async () => {
        throw new Error("Query syntax error");
      };

      await expect(circuitBreaker.executeOrNull(dbError)).rejects.toThrow(
        "Query syntax error"
      );
    });

    it("should return null without calling operation when circuit is open", async () => {
      circuitBreaker.forceOpen();
      const operationMock = vi.fn().mockResolvedValue("should not be called");

      const result = await circuitBreaker.executeOrNull(operationMock);

      expect(result).toBeNull();
      expect(operationMock).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // executeOrDefault() Tests
  // ===========================================================================

  describe("executeOrDefault()", () => {
    it("should return result when circuit is closed", async () => {
      const result = await circuitBreaker.executeOrDefault(
        async () => "success",
        "default"
      );
      expect(result).toBe("success");
    });

    it("should return default when circuit is open", async () => {
      circuitBreaker.forceOpen();

      const result = await circuitBreaker.executeOrDefault(
        async () => "success",
        "default"
      );
      expect(result).toBe("default");
    });

    it("should return default value with correct type", async () => {
      circuitBreaker.forceOpen();

      const defaultArray = [1, 2, 3];
      const result = await circuitBreaker.executeOrDefault(
        async () => [4, 5, 6],
        defaultArray
      );
      expect(result).toBe(defaultArray);
    });

    it("should propagate non-CircuitOpenError errors", async () => {
      const dbError = async () => {
        throw new Error("Deadlock detected");
      };

      await expect(
        circuitBreaker.executeOrDefault(dbError, "default")
      ).rejects.toThrow("Deadlock detected");
    });
  });

  // ===========================================================================
  // Slow Query Detection Tests
  // ===========================================================================

  describe("slow query detection", () => {
    it("should track slow queries in statistics", async () => {
      // Execute a slow query (>50ms threshold)
      await circuitBreaker.execute(async () => {
        await sleep(60);
        return "slow";
      });

      const stats = circuitBreaker.getStats();
      expect(stats.slowQueries).toBe(1);
    });

    it("should not flag fast queries as slow", async () => {
      // Execute a fast query
      await circuitBreaker.execute(async () => {
        await sleep(10);
        return "fast";
      });

      const stats = circuitBreaker.getStats();
      expect(stats.slowQueries).toBe(0);
    });

    it("should track average latency", async () => {
      // Execute a few operations
      await circuitBreaker.execute(async () => {
        await sleep(20);
        return "op1";
      });
      await circuitBreaker.execute(async () => {
        await sleep(40);
        return "op2";
      });

      const stats = circuitBreaker.getStats();
      expect(stats.avgLatencyMs).toBeGreaterThan(20);
    });
  });

  // ===========================================================================
  // Health Check Tests
  // ===========================================================================

  describe("health checks", () => {
    it("should run health checks at specified interval", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue(true);
      circuitBreaker.startHealthChecks(healthCheckFn);

      await sleep(120);

      expect(healthCheckFn).toHaveBeenCalled();
      expect(healthCheckFn.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("should update lastHealthCheck after check runs", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue(true);
      circuitBreaker.startHealthChecks(healthCheckFn);

      await sleep(70);

      const stats = circuitBreaker.getStats();
      expect(stats.lastHealthCheck).not.toBeNull();
      expect(stats.lastHealthCheckSuccess).toBe(true);
    });

    it("should track health check failures", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue(false);
      circuitBreaker.startHealthChecks(healthCheckFn);

      await sleep(70);

      const stats = circuitBreaker.getStats();
      expect(stats.lastHealthCheckSuccess).toBe(false);
    });

    it("should handle health check errors gracefully", async () => {
      const healthCheckFn = vi.fn().mockRejectedValue(new Error("Health check error"));
      circuitBreaker.startHealthChecks(healthCheckFn);

      await sleep(70);

      const stats = circuitBreaker.getStats();
      expect(stats.lastHealthCheckSuccess).toBe(false);
    });

    it("should stop health checks when stopHealthChecks is called", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue(true);
      circuitBreaker.startHealthChecks(healthCheckFn);

      await sleep(30);
      const callCountBefore = healthCheckFn.mock.calls.length;

      circuitBreaker.stopHealthChecks();
      await sleep(100);

      // Should not have been called more times after stopping
      expect(healthCheckFn.mock.calls.length).toBeLessThanOrEqual(callCountBefore + 1);
    });

    it("should return false from runHealthCheck when no function configured", async () => {
      // Don't configure a health check function
      const result = await circuitBreaker.runHealthCheck();
      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // Statistics Tests
  // ===========================================================================

  describe("statistics", () => {
    it("should track success and failure counts", async () => {
      await circuitBreaker.execute(async () => "success");
      await expect(
        circuitBreaker.execute(async () => {
          throw new Error("Connection failed");
        })
      ).rejects.toThrow();

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalFailures).toBe(1);
    });

    it("should track circuit state correctly", async () => {
      expect(circuitBreaker.getStats().state).toBe("closed");

      circuitBreaker.forceOpen();
      expect(circuitBreaker.getStats().state).toBe("open");

      circuitBreaker.forceClose();
      expect(circuitBreaker.getStats().state).toBe("closed");
    });

    it("should reset statistics when resetStats is called", async () => {
      await circuitBreaker.execute(async () => {
        await sleep(60);
        return "slow";
      });

      circuitBreaker.resetStats();

      const stats = circuitBreaker.getStats();
      expect(stats.slowQueries).toBe(0);
      expect(stats.avgLatencyMs).toBe(0);
    });
  });

  // ===========================================================================
  // Manual Override Tests
  // ===========================================================================

  describe("manual overrides", () => {
    it("should allow forcing circuit open", () => {
      expect(circuitBreaker.getState()).toBe("closed");

      circuitBreaker.forceOpen();

      expect(circuitBreaker.getState()).toBe("open");
    });

    it("should allow forcing circuit closed", async () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe("open");

      circuitBreaker.forceClose();

      expect(circuitBreaker.getState()).toBe("closed");
    });

    it("should report correct allowing status", () => {
      expect(circuitBreaker.isAllowingRequests()).toBe(true);

      circuitBreaker.forceOpen();
      expect(circuitBreaker.isAllowingRequests()).toBe(false);

      circuitBreaker.forceClose();
      expect(circuitBreaker.isAllowingRequests()).toBe(true);
    });
  });

  // ===========================================================================
  // Singleton Tests
  // ===========================================================================

  describe("singleton management", () => {
    it("should return same instance from getDatabaseCircuitBreaker", () => {
      const instance1 = getDatabaseCircuitBreaker();
      const instance2 = getDatabaseCircuitBreaker();
      expect(instance1).toBe(instance2);
    });

    it("should reset singleton with resetDatabaseCircuitBreaker", () => {
      const instance1 = getDatabaseCircuitBreaker();
      resetDatabaseCircuitBreaker();
      const instance2 = getDatabaseCircuitBreaker();
      expect(instance1).not.toBe(instance2);
    });

    it("should stop health checks when singleton is reset", async () => {
      const instance = getDatabaseCircuitBreaker();
      const healthCheckFn = vi.fn().mockResolvedValue(true);
      instance.startHealthChecks(healthCheckFn);

      resetDatabaseCircuitBreaker();

      await sleep(100);
      const callCountAfterReset = healthCheckFn.mock.calls.length;

      await sleep(50);
      // Health checks should have stopped
      expect(healthCheckFn.mock.calls.length).toBe(callCountAfterReset);
    });
  });

  // ===========================================================================
  // Error Filter Tests
  // ===========================================================================

  describe("error filtering", () => {
    const recoverableErrors = [
      { msg: "ECONNREFUSED", type: "connection refused" },
      { msg: "ECONNRESET", type: "connection reset" },
      { msg: "ETIMEDOUT", type: "connection timeout" },
      { msg: "connection pool exhausted", type: "pool exhausted" },
      { msg: "deadlock detected", type: "deadlock" },
      { msg: "lock wait timeout exceeded", type: "lock timeout" },
      { msg: "could not connect to server", type: "connection failure" },
      { msg: "too many connections", type: "connection limit" },
    ];

    const nonRecoverableErrors = [
      { msg: "unique constraint violation", type: "unique constraint" },
      { msg: "foreign key constraint fails", type: "foreign key" },
      { msg: "not null constraint violation", type: "not null" },
      { msg: "check constraint violation", type: "check constraint" },
      { msg: "validation failed for field", type: "validation" },
    ];

    recoverableErrors.forEach(({ msg, type }) => {
      it(`should count ${type} errors as failures`, async () => {
        const errorOp = async () => {
          throw new Error(msg);
        };

        // Execute errors
        for (let i = 0; i < 5; i++) {
          await expect(circuitBreaker.execute(errorOp)).rejects.toThrow();
        }

        // Circuit should be open (errors counted as failures)
        expect(circuitBreaker.getState()).toBe("open");
      });
    });

    nonRecoverableErrors.forEach(({ msg, type }) => {
      it(`should NOT count ${type} errors as failures`, async () => {
        const errorOp = async () => {
          throw new Error(msg);
        };

        // Execute errors
        for (let i = 0; i < 10; i++) {
          await expect(circuitBreaker.execute(errorOp)).rejects.toThrow();
        }

        // Circuit should still be closed (errors not counted)
        expect(circuitBreaker.getState()).toBe("closed");
      });
    });
  });

  // ===========================================================================
  // Factory Function Tests
  // ===========================================================================

  describe("createDatabaseCircuitBreaker", () => {
    it("should create independent instances", () => {
      const cb1 = createDatabaseCircuitBreaker({ failureThreshold: 5 });
      const cb2 = createDatabaseCircuitBreaker({ failureThreshold: 10 });

      cb1.forceOpen();

      expect(cb1.getState()).toBe("open");
      expect(cb2.getState()).toBe("closed");

      cb1.stopHealthChecks();
      cb2.stopHealthChecks();
    });

    it("should allow custom configuration", () => {
      const cb = createDatabaseCircuitBreaker({
        failureThreshold: 10,
        recoveryTimeoutMs: 5000,
        slowQueryThresholdMs: 1000,
      });

      // Just verify it creates successfully
      expect(cb.getState()).toBe("closed");
      cb.stopHealthChecks();
    });
  });
});
