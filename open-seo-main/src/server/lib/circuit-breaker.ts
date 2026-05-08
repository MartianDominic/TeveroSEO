/**
 * Redis-Backed Circuit Breaker
 *
 * Plan 69-04 Task 5: Shared circuit breaker state across workers.
 *
 * Unlike the in-memory circuit breaker in redis.ts (which only protects
 * a single worker), this implementation stores state in Redis so all
 * workers share the same failure count and circuit state.
 *
 * Circuit Breaker Pattern:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 * @module server/lib/circuit-breaker
 */

import { redis, REDIS_SERVICE_PREFIX } from "./redis";
import { createLogger } from "./logger";

const log = createLogger({ module: "circuit-breaker" });

/**
 * Circuit breaker states.
 */
export type CircuitState = "closed" | "open" | "half_open";

/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
  /** Name of the circuit (for Redis key namespacing) */
  name: string;
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting recovery (default: 30000) */
  resetTimeoutMs?: number;
  /** Number of test requests in half-open state (default: 3) */
  halfOpenRequests?: number;
  /** TTL for failure count in seconds (default: 60) */
  failureWindowSeconds?: number;
}

/**
 * Circuit breaker status for monitoring.
 */
export interface CircuitStatus {
  state: CircuitState;
  failures: number;
  halfOpenAttempts: number;
  openedAt: string | null;
  remainingResetMs: number;
}

/** Redis key prefix for circuit breakers */
const CIRCUIT_KEY_PREFIX = `${REDIS_SERVICE_PREFIX}circuit:` as const;

/**
 * Redis-backed Circuit Breaker.
 *
 * Provides shared circuit breaker state across all workers via Redis.
 * Automatically opens when failure threshold is reached and transitions
 * to half-open after reset timeout for testing recovery.
 *
 * @example
 * const breaker = new RedisCircuitBreaker({
 *   name: "external-api",
 *   failureThreshold: 5,
 *   resetTimeoutMs: 30000,
 * });
 *
 * // In request handler
 * if (await breaker.isOpen()) {
 *   throw new Error("Circuit breaker open - service unavailable");
 * }
 *
 * try {
 *   const result = await callExternalApi();
 *   await breaker.recordSuccess();
 *   return result;
 * } catch (err) {
 *   await breaker.recordFailure();
 *   throw err;
 * }
 */
export class RedisCircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenRequests: number;
  private readonly failureWindowSeconds: number;

  // Redis keys
  private readonly failuresKey: string;
  private readonly stateKey: string;
  private readonly openedAtKey: string;
  private readonly halfOpenAttemptsKey: string;

  constructor(config: CircuitBreakerConfig) {
    this.name = config.name;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 30000;
    this.halfOpenRequests = config.halfOpenRequests ?? 3;
    this.failureWindowSeconds = config.failureWindowSeconds ?? 60;

    const baseKey = `${CIRCUIT_KEY_PREFIX}${this.name}:`;
    this.failuresKey = `${baseKey}failures`;
    this.stateKey = `${baseKey}state`;
    this.openedAtKey = `${baseKey}opened_at`;
    this.halfOpenAttemptsKey = `${baseKey}half_open_attempts`;
  }

  /**
   * Get the current circuit state.
   *
   * Automatically transitions from OPEN to HALF_OPEN if reset timeout elapsed.
   */
  async getState(): Promise<CircuitState> {
    const [stateStr, openedAtStr] = await Promise.all([
      redis.get(this.stateKey),
      redis.get(this.openedAtKey),
    ]);

    const currentState = (stateStr as CircuitState) || "closed";

    // Check for automatic transition from OPEN to HALF_OPEN
    if (currentState === "open" && openedAtStr) {
      const openedAt = parseInt(openedAtStr, 10);
      const elapsed = Date.now() - openedAt;

      if (elapsed >= this.resetTimeoutMs) {
        // Transition to half-open
        await this.transitionToHalfOpen();
        return "half_open";
      }
    }

    return currentState;
  }

  /**
   * Check if the circuit is currently open (blocking requests).
   *
   * In HALF_OPEN state, returns false to allow test requests.
   */
  async isOpen(): Promise<boolean> {
    const state = await this.getState();
    return state === "open";
  }

  /**
   * Check if requests should be allowed.
   *
   * Returns true for CLOSED state and limited requests in HALF_OPEN.
   */
  async shouldAllowRequest(): Promise<boolean> {
    const state = await this.getState();

    if (state === "closed") {
      return true;
    }

    if (state === "open") {
      return false;
    }

    // HALF_OPEN: Allow limited test requests
    const attempts = await redis.get(this.halfOpenAttemptsKey);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;

    if (attemptCount < this.halfOpenRequests) {
      // Increment half-open attempt counter atomically
      await redis.incr(this.halfOpenAttemptsKey);
      return true;
    }

    return false;
  }

  /**
   * Record a successful operation.
   *
   * In HALF_OPEN state, transitions to CLOSED if enough successes.
   * In CLOSED state, resets failure counter.
   */
  async recordSuccess(): Promise<void> {
    const state = await this.getState();

    if (state === "half_open") {
      // Reset to closed after successful half-open request
      await this.close();
      log.info("Circuit breaker closed after successful recovery", { name: this.name });
    } else if (state === "closed") {
      // Reset failure count on success (sliding window)
      await redis.del(this.failuresKey);
    }
  }

  /**
   * Record a failed operation.
   *
   * Increments failure counter. Opens circuit if threshold reached.
   * In HALF_OPEN state, immediately reopens circuit.
   */
  async recordFailure(): Promise<void> {
    const state = await this.getState();

    if (state === "half_open") {
      // Failure in half-open immediately reopens
      await this.open();
      log.warn("Circuit breaker reopened - half-open test failed", { name: this.name });
      return;
    }

    if (state === "open") {
      // Already open, nothing to do
      return;
    }

    // CLOSED state: increment failures with TTL
    const failures = await redis.incr(this.failuresKey);

    // Set TTL on first failure (sliding window)
    if (failures === 1) {
      await redis.expire(this.failuresKey, this.failureWindowSeconds);
    }

    log.debug("Circuit breaker failure recorded", {
      name: this.name,
      failures,
      threshold: this.failureThreshold,
    });

    if (failures >= this.failureThreshold) {
      await this.open();
      log.error("Circuit breaker opened - threshold reached", undefined, {
        name: this.name,
        failures,
        threshold: this.failureThreshold,
      });
    }
  }

  /**
   * Execute a function with circuit breaker protection.
   *
   * Automatically records success/failure and respects circuit state.
   *
   * @param fn - Async function to execute
   * @returns Result of the function
   * @throws CircuitOpenError if circuit is open
   * @throws Original error if function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const allowed = await this.shouldAllowRequest();

    if (!allowed) {
      throw new CircuitOpenError(this.name);
    }

    try {
      const result = await fn();
      await this.recordSuccess();
      return result;
    } catch (error) {
      await this.recordFailure();
      throw error;
    }
  }

  /**
   * Get current circuit status for monitoring.
   */
  async getStatus(): Promise<CircuitStatus> {
    const [stateStr, failuresStr, openedAtStr, halfOpenStr] = await Promise.all([
      redis.get(this.stateKey),
      redis.get(this.failuresKey),
      redis.get(this.openedAtKey),
      redis.get(this.halfOpenAttemptsKey),
    ]);

    const state = (stateStr as CircuitState) || "closed";
    const failures = failuresStr ? parseInt(failuresStr, 10) : 0;
    const openedAt = openedAtStr ? parseInt(openedAtStr, 10) : null;
    const halfOpenAttempts = halfOpenStr ? parseInt(halfOpenStr, 10) : 0;

    let remainingResetMs = 0;
    if (state === "open" && openedAt) {
      const elapsed = Date.now() - openedAt;
      remainingResetMs = Math.max(0, this.resetTimeoutMs - elapsed);
    }

    return {
      state,
      failures,
      halfOpenAttempts,
      openedAt: openedAt ? new Date(openedAt).toISOString() : null,
      remainingResetMs,
    };
  }

  /**
   * Force the circuit to close (admin operation).
   */
  async forceClose(): Promise<void> {
    await this.close();
    log.warn("Circuit breaker force-closed", { name: this.name });
  }

  /**
   * Force the circuit to open (admin operation).
   */
  async forceOpen(): Promise<void> {
    await this.open();
    log.warn("Circuit breaker force-opened", { name: this.name });
  }

  // Private state transition methods

  private async open(): Promise<void> {
    const resetTimeoutSeconds = Math.ceil(this.resetTimeoutMs / 1000) + 10;

    await Promise.all([
      redis.set(this.stateKey, "open", "EX", resetTimeoutSeconds),
      redis.set(this.openedAtKey, Date.now().toString(), "EX", resetTimeoutSeconds),
      redis.del(this.halfOpenAttemptsKey),
    ]);
  }

  private async transitionToHalfOpen(): Promise<void> {
    const halfOpenTtl = 60; // 1 minute TTL for half-open state

    await Promise.all([
      redis.set(this.stateKey, "half_open", "EX", halfOpenTtl),
      redis.set(this.halfOpenAttemptsKey, "0", "EX", halfOpenTtl),
    ]);

    log.info("Circuit breaker transitioned to half-open", { name: this.name });
  }

  private async close(): Promise<void> {
    await Promise.all([
      redis.del(this.stateKey),
      redis.del(this.failuresKey),
      redis.del(this.openedAtKey),
      redis.del(this.halfOpenAttemptsKey),
    ]);
  }
}

/**
 * Error thrown when circuit is open and request is blocked.
 */
export class CircuitOpenError extends Error {
  readonly circuitName: string;

  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is open - service unavailable`);
    this.name = "CircuitOpenError";
    this.circuitName = circuitName;
  }
}

// =============================================================================
// Pre-configured Circuit Breakers
// =============================================================================

/**
 * Circuit breaker for external API calls.
 * Opens after 5 failures in 60 seconds, recovers after 30 seconds.
 */
export const externalApiBreaker = new RedisCircuitBreaker({
  name: "external-api",
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenRequests: 3,
  failureWindowSeconds: 60,
});

/**
 * Circuit breaker for database operations.
 * More sensitive: opens after 3 failures in 30 seconds.
 */
export const databaseBreaker = new RedisCircuitBreaker({
  name: "database",
  failureThreshold: 3,
  resetTimeoutMs: 15000,
  halfOpenRequests: 2,
  failureWindowSeconds: 30,
});

/**
 * Circuit breaker for third-party services (DataForSEO, etc).
 * Longer recovery time for external dependencies.
 */
export const thirdPartyBreaker = new RedisCircuitBreaker({
  name: "third-party",
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenRequests: 3,
  failureWindowSeconds: 120,
});

/**
 * Circuit breaker for Google Search Console API.
 * BMQ-003 FIX: Dedicated breaker for GSC API calls in job workers.
 *
 * Configuration rationale:
 * - failureThreshold: 5 (GSC has strict rate limits, 5 consecutive failures indicates quota/auth issue)
 * - resetTimeoutMs: 60000 (1 minute - GSC rate limits reset per minute)
 * - halfOpenRequests: 2 (conservative testing during recovery)
 * - failureWindowSeconds: 120 (2 minute window to accumulate failures)
 */
export const gscApiBreaker = new RedisCircuitBreaker({
  name: "gsc-api",
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenRequests: 2,
  failureWindowSeconds: 120,
});

/**
 * Get all circuit breaker statuses for monitoring dashboard.
 */
export async function getAllCircuitStatuses(): Promise<
  Record<string, CircuitStatus>
> {
  const [external, database, thirdParty, gscApi] = await Promise.all([
    externalApiBreaker.getStatus(),
    databaseBreaker.getStatus(),
    thirdPartyBreaker.getStatus(),
    gscApiBreaker.getStatus(),
  ]);

  return {
    "external-api": external,
    database: database,
    "third-party": thirdParty,
    "gsc-api": gscApi,
  };
}
