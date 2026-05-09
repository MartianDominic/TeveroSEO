/**
 * Circuit Breaker Pattern Implementation
 * Phase 95-08: Test Coverage & Reliability
 *
 * Protects against cascading failures by tracking error rates
 * and automatically failing fast when a service is unhealthy.
 *
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Too many failures, fail fast without calling service
 * - HALF_OPEN: Testing if service recovered, limited requests
 */

import { circuitLogger } from "../logging";
import {
  recordCircuitState,
  recordCircuitTransition,
  recordCircuitTimeInState,
} from "../monitoring/MetricsCollector";

export type CircuitState = "closed" | "open" | "half-open";

/**
 * Alias for CircuitState with underscore format (backward compatibility).
 * @deprecated Use CircuitState with hyphen format instead.
 */
export const CircuitStateCompat = {
  CLOSED: "closed" as const,
  OPEN: "open" as const,
  HALF_OPEN: "half-open" as const,
} as const;

export interface CircuitBreakerConfig {
  /** Name for logging and metrics */
  name: string;

  /** Number of failures before opening circuit */
  failureThreshold: number;

  /** Number of successes in half-open before closing */
  successThreshold: number;

  /** Time (ms) before transitioning from open to half-open */
  timeout: number;

  /**
   * Alias for timeout (backward compatibility).
   * @deprecated Use timeout instead.
   */
  resetTimeout?: number;

  /** Minimum requests before evaluating failure rate */
  volumeThreshold: number;

  /** Maximum requests allowed in half-open state for faster recovery detection (default: 3) */
  halfOpenMaxRequests?: number;

  /**
   * Alias for halfOpenMaxRequests (backward compatibility).
   * @deprecated Use halfOpenMaxRequests instead.
   */
  halfOpenMaxAttempts?: number;

  /** Optional filter to determine which errors count as failures */
  errorFilter?: (error: Error) => boolean;
}

export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  totalRequests: number;
  totalFailures: number;
  openedAt?: Date;
  halfOpenedAt?: Date;
  closedAt?: Date;
  /** Current number of requests in half-open state */
  halfOpenRequestCount: number;
}

/**
 * Error thrown when circuit is open.
 */
export class CircuitOpenError extends Error {
  constructor(
    public circuitName: string,
    public retryAfter: number
  ) {
    super(`Circuit ${circuitName} is open. Retry after ${retryAfter}ms`);
    this.name = "CircuitOpenError";
  }
}

/**
 * Circuit Breaker implementation.
 * Wraps operations and tracks success/failure rates.
 */
export class CircuitBreaker<_T = unknown> {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private halfOpenRequestCount = 0;
  private lastStateChange = Date.now();
  private stats: CircuitStats;
  private stateChangeListeners: Array<(oldState: CircuitState, newState: CircuitState) => void> =
    [];

  constructor(private config: CircuitBreakerConfig) {
    // Handle backward compatibility aliases
    if (config.resetTimeout !== undefined && config.timeout === undefined) {
      (this.config as CircuitBreakerConfig).timeout = config.resetTimeout;
    }
    if (config.halfOpenMaxAttempts !== undefined && config.halfOpenMaxRequests === undefined) {
      (this.config as CircuitBreakerConfig).halfOpenMaxRequests = config.halfOpenMaxAttempts;
    }
    this.stats = this.initStats();
  }

  /**
   * Execute an operation through the circuit breaker.
   */
  async execute<R>(operation: () => Promise<R>): Promise<R> {
    if (this.state === "open") {
      if (this.shouldAttemptReset()) {
        this.transitionTo("half-open");
      } else {
        throw new CircuitOpenError(this.config.name, this.getTimeUntilRetry());
      }
    }

    // In half-open state, limit concurrent requests for faster recovery detection
    if (this.state === "half-open") {
      const maxRequests = this.config.halfOpenMaxRequests ?? 3;
      if (this.halfOpenRequestCount >= maxRequests) {
        throw new CircuitOpenError(this.config.name, 0);
      }
      this.halfOpenRequestCount++;
      this.stats.halfOpenRequestCount = this.halfOpenRequestCount;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics.
   */
  getStats(): CircuitStats {
    return {
      ...this.stats,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      halfOpenRequestCount: this.halfOpenRequestCount,
    };
  }

  /**
   * Manually force circuit open (for emergencies).
   */
  forceOpen(): void {
    this.transitionTo("open");
  }

  /**
   * Manually force circuit closed (for recovery).
   */
  forceClose(): void {
    this.transitionTo("closed");
  }

  /**
   * Reset circuit to initial closed state.
   * Alias for forceClose() for backward compatibility.
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.halfOpenRequestCount = 0;
    this.stats = this.initStats();
    this.transitionTo("closed");
  }

  /**
   * Check if circuit allows requests (not open).
   * @deprecated Use getState() !== "open" or wrap with execute() instead.
   */
  get allowsRequest(): boolean {
    // Check if we should transition from open to half-open
    if (this.state === "open" && this.shouldAttemptReset()) {
      this.transitionTo("half-open");
    }
    return this.state !== "open";
  }

  /**
   * Check if circuit is currently open.
   * @deprecated Use getState() === "open" or wrap with execute() instead.
   */
  get isOpen(): boolean {
    // Check if we should transition from open to half-open
    if (this.state === "open" && this.shouldAttemptReset()) {
      this.transitionTo("half-open");
    }
    return this.state === "open";
  }

  /**
   * Get current state as string.
   * @deprecated Use getState() instead.
   */
  get currentState(): CircuitState {
    // Check if we should transition from open to half-open
    if (this.state === "open" && this.shouldAttemptReset()) {
      this.transitionTo("half-open");
    }
    return this.state;
  }

  /**
   * Record a successful operation manually.
   * @deprecated Prefer using execute() which auto-records success/failure.
   */
  recordSuccess(): void {
    this.onSuccess();
  }

  /**
   * Record a failed operation manually.
   * @deprecated Prefer using execute() which auto-records success/failure.
   */
  recordFailure(): void {
    this.onFailure(new Error("Manual failure recorded"));
  }

  /**
   * Get current failure count.
   * @deprecated Use getStats().failures instead.
   */
  get failureCount(): number {
    return this.failures;
  }

  /**
   * Get circuit breaker name.
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Subscribe to state change events.
   */
  onStateChange(listener: (oldState: CircuitState, newState: CircuitState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private initStats(): CircuitStats {
    return {
      state: "closed",
      failures: 0,
      successes: 0,
      totalRequests: 0,
      totalFailures: 0,
      halfOpenRequestCount: 0,
    };
  }

  private onSuccess(): void {
    this.stats.lastSuccess = new Date();
    this.stats.totalRequests++;

    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo("closed");
      }
    } else if (this.state === "closed") {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  private onFailure(error: Error): void {
    // Check if this error should count as a failure
    if (this.config.errorFilter && !this.config.errorFilter(error)) {
      return;
    }

    this.stats.lastFailure = new Date();
    this.stats.totalFailures++;
    this.stats.totalRequests++;

    if (this.state === "half-open") {
      // Any failure in half-open state reopens circuit
      this.transitionTo("open");
    } else if (this.state === "closed") {
      this.failures++;

      // Check if we should open circuit
      if (
        this.failures >= this.config.failureThreshold &&
        this.stats.totalRequests >= this.config.volumeThreshold
      ) {
        this.transitionTo("open");
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;

    if (oldState === newState) {
      return;
    }

    // Calculate time spent in previous state for metrics
    const now = Date.now();
    const timeInPreviousState = (now - this.lastStateChange) / 1000; // Convert to seconds

    this.state = newState;
    this.lastStateChange = now;

    // Update stats based on new state
    switch (newState) {
      case "closed":
        this.failures = 0;
        this.successes = 0;
        this.stats.closedAt = new Date();
        break;
      case "open":
        this.stats.openedAt = new Date();
        break;
      case "half-open":
        this.successes = 0;
        this.halfOpenRequestCount = 0;
        this.stats.halfOpenRequestCount = 0;
        this.stats.halfOpenedAt = new Date();
        break;
    }

    // Record Prometheus metrics for the transition
    const tier = this.config.name;
    recordCircuitTransition(tier, oldState, newState);
    recordCircuitTimeInState(tier, oldState, timeInPreviousState);
    recordCircuitState(tier, newState);

    // Notify listeners
    this.emitStateChange(oldState, newState);
  }

  private emitStateChange(oldState: CircuitState, newState: CircuitState): void {
    for (const listener of this.stateChangeListeners) {
      try {
        listener(oldState, newState);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        circuitLogger.error({ circuitName: this.config.name, error: err.message, stack: err.stack }, 'State change listener error');
      }
    }
  }

  private shouldAttemptReset(): boolean {
    const timeSinceStateChange = Date.now() - this.lastStateChange;
    return timeSinceStateChange >= this.config.timeout;
  }

  private getTimeUntilRetry(): number {
    const timeSinceStateChange = Date.now() - this.lastStateChange;
    const remaining = this.config.timeout - timeSinceStateChange;
    return Math.max(0, remaining);
  }
}

/**
 * Create a circuit breaker with sensible defaults.
 *
 * @param name - Unique name for the circuit breaker
 * @param overrides - Configuration overrides. Supports both new (timeout, halfOpenMaxRequests)
 *                    and legacy (resetTimeout, halfOpenMaxAttempts) config options.
 */
export function createCircuitBreaker(
  name: string,
  overrides: Partial<Omit<CircuitBreakerConfig, "name">> = {}
): CircuitBreaker {
  // Support deprecated resetTimeout alias
  const timeout = overrides.resetTimeout ?? overrides.timeout ?? 30000;
  // Support deprecated halfOpenMaxAttempts alias
  const halfOpenMaxRequests = overrides.halfOpenMaxAttempts ?? overrides.halfOpenMaxRequests ?? 3;
  // Use volumeThreshold of 1 by default to match legacy behavior (no minimum volume required)
  const volumeThreshold = overrides.volumeThreshold ?? 1;

  return new CircuitBreaker({
    name,
    failureThreshold: overrides.failureThreshold ?? 5,
    successThreshold: overrides.successThreshold ?? 1, // Close on first success in half-open (legacy behavior)
    timeout,
    volumeThreshold,
    halfOpenMaxRequests,
    errorFilter: overrides.errorFilter,
  });
}
