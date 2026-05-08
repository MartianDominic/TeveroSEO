/**
 * @deprecated Use `@/server/features/scraping/resilience/CircuitBreaker` instead.
 * This implementation is kept for backward compatibility only.
 * The canonical CircuitBreaker is in scraping/resilience/ with additional features:
 * - volumeThreshold (prevents premature trips)
 * - successThreshold (configurable recovery)
 * - errorFilter (selective failure counting)
 * - State change listeners
 * - Manual overrides (forceOpen/forceClose)
 *
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascade failures when external services fail by:
 * - Tracking consecutive failures
 * - Opening circuit to reject requests immediately (fail fast)
 * - Testing recovery after timeout period
 * - Closing circuit when service recovers
 *
 * Thread-safety: Uses atomic state transitions via mutex pattern
 *
 * Observability (P3.G21):
 * - Emits metrics on state transitions via onStateChange callback
 * - Tracks state durations, failure/success counts, open count
 * - Provides getMetrics() for dashboard polling
 *
 * @see Fix 10 in .planning/keyword-intelligence/IMPLEMENTATION-FIXES.md
 */

import type {
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitBreakerMetrics,
  CircuitState,
  CircuitStateTransition,
  OnStateChangeCallback,
} from "../types/circuit-breaker";
import { CircuitBreakerOpenError, defaultStateChangeLogger } from "../types/circuit-breaker";

type RequiredConfig = Required<Omit<CircuitBreakerConfig, "onStateChange">> & {
  onStateChange: OnStateChangeCallback;
};

const DEFAULT_CONFIG: RequiredConfig = {
  name: "unnamed",
  failureThreshold: 3,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 1,
  onStateChange: defaultStateChangeLogger,
};

export class CircuitBreaker {
  private readonly config: RequiredConfig;

  // State managed internally
  private _state: CircuitState = "closed";
  private _failures = 0;
  private _successes = 0;
  private _lastFailure: number | null = null;
  private _lastOpened: number | null = null;
  private _rejectedCount = 0;
  private _halfOpenAttempts = 0;

  // Mutex for thread-safe state transitions
  private _transitionLock = false;
  private _pendingTransitions: Array<() => void> = [];

  // Metrics tracking (P3.G21)
  private _createdAt: number = Date.now();
  private _lastTransitionAt: number | null = null;
  private _stateEnteredAt: number = Date.now();
  private _stateTransitionCount = 0;
  private _openCount = 0;
  private _totalOpenDurationMs = 0;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      onStateChange: config.onStateChange ?? DEFAULT_CONFIG.onStateChange,
    };
  }

  /**
   * Circuit breaker name (for identification in metrics/logs)
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Current circuit state
   */
  get state(): CircuitState {
    // Check if OPEN should transition to HALF_OPEN
    if (this._state === "open" && this.shouldTransitionToHalfOpen()) {
      this.transitionState("half_open", "timeout_elapsed");
      this._halfOpenAttempts = 0;
    }
    return this._state;
  }

  /**
   * Whether the circuit is currently rejecting requests
   */
  get isOpen(): boolean {
    const currentState = this.state; // Triggers potential state transition
    return currentState === "open";
  }

  /**
   * Get current statistics for monitoring.
   * Note: Uses _state directly to avoid triggering automatic state transitions.
   */
  get stats(): CircuitBreakerStats {
    return {
      failures: this._failures,
      successes: this._successes,
      state: this._state,
      lastFailure: this._lastFailure,
      lastOpened: this._lastOpened,
      rejectedCount: this._rejectedCount,
      halfOpenAttempts: this._halfOpenAttempts,
    };
  }

  /**
   * Execute a function through the circuit breaker
   *
   * @param fn - Async function to execute
   * @returns Promise resolving to the function result
   * @throws CircuitBreakerOpenError if circuit is open
   * @throws Original error if function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      const currentState = this.state;

      if (currentState === "open") {
        this._rejectedCount++;
        throw new CircuitBreakerOpenError(
          `Circuit breaker is open. Will retry after ${this.remainingTimeout()}ms`,
          this.stats
        );
      }

      if (currentState === "half_open") {
        if (this._halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
          // Already have max half-open attempts in flight, reject
          this._rejectedCount++;
          throw new CircuitBreakerOpenError(
            "Circuit breaker half-open max attempts reached",
            this.stats
          );
        }
        this._halfOpenAttempts++;
      }
    } finally {
      this.releaseLock();
    }

    // Execute function outside lock to prevent deadlock
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful operation
   * In HALF_OPEN state, closes the circuit
   */
  recordSuccess(): void {
    this.withLock(() => {
      if (this._state === "half_open") {
        // Successful test in HALF_OPEN - service recovered
        this.transitionState("closed", "recovery_success");
        this._failures = 0;
        this._halfOpenAttempts = 0;
        this._lastOpened = null; // Clear so next open uses fresh timestamp
      }
      this._successes++;
      // Don't reset failures on success in CLOSED state
      // to allow burst detection
    });
  }

  /**
   * Record a failed operation
   * Opens circuit if failure threshold reached
   */
  recordFailure(): void {
    this.withLock(() => {
      this._failures++;
      this._lastFailure = Date.now();

      if (this._state === "half_open") {
        // Failed test in HALF_OPEN - service still down
        this.openCircuit("recovery_failure");
      } else if (
        this._state === "closed" &&
        this._failures >= this.config.failureThreshold
      ) {
        // Threshold reached in CLOSED state
        this.openCircuit("threshold_reached");
      }
    });
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.withLock(() => {
      const previousState = this._state;
      if (previousState !== "closed") {
        this.transitionState("closed", "manual_reset");
      }
      this._failures = 0;
      this._successes = 0;
      this._lastFailure = null;
      this._lastOpened = null;
      this._rejectedCount = 0;
      this._halfOpenAttempts = 0;
      // Reset metrics tracking
      this._createdAt = Date.now();
      this._lastTransitionAt = null;
      this._stateEnteredAt = Date.now();
      this._stateTransitionCount = 0;
      this._openCount = 0;
      this._totalOpenDurationMs = 0;
    });
  }

  /**
   * Force circuit to open state (for manual intervention)
   */
  trip(): void {
    this.withLock(() => {
      this.openCircuit("manual_trip");
    });
  }

  /**
   * Get comprehensive metrics for observability dashboards.
   * Returns current state, counters, and time-based metrics.
   */
  getMetrics(): CircuitBreakerMetrics {
    const now = Date.now();
    const currentStateDuration = now - this._stateEnteredAt;
    const avgOpenDuration = this._openCount > 0
      ? this._totalOpenDurationMs / this._openCount
      : 0;

    return {
      name: this.config.name,
      state: this._state,
      totalFailures: this._failures,
      totalSuccesses: this._successes,
      totalRejected: this._rejectedCount,
      stateTransitionCount: this._stateTransitionCount,
      currentStateDurationMs: currentStateDuration,
      createdAt: this._createdAt,
      lastTransitionAt: this._lastTransitionAt,
      openCount: this._openCount,
      avgOpenDurationMs: Math.round(avgOpenDuration),
      stats: this.stats,
    };
  }

  // Private methods

  /**
   * Transition to a new state with metrics emission.
   * Non-blocking: callback is fire-and-forget.
   */
  private transitionState(
    toState: CircuitState,
    reason: CircuitStateTransition["reason"]
  ): void {
    const now = Date.now();
    const fromState = this._state;
    const durationInPreviousState = now - this._stateEnteredAt;

    // Track open state duration for avg calculation
    if (fromState === "open") {
      this._totalOpenDurationMs += durationInPreviousState;
    }

    // Update state
    this._state = toState;
    this._stateEnteredAt = now;
    this._lastTransitionAt = now;
    this._stateTransitionCount++;

    // Track open count
    if (toState === "open") {
      this._openCount++;
    }

    // Emit metric (fire-and-forget, non-blocking)
    const transition: CircuitStateTransition = {
      name: this.config.name,
      fromState,
      toState,
      timestamp: now,
      durationInPreviousStateMs: durationInPreviousState,
      reason,
      stats: { ...this.stats },
    };

    // Use queueMicrotask for true non-blocking behavior
    queueMicrotask(() => {
      try {
        this.config.onStateChange(transition);
      } catch {
        // Swallow errors from callback to prevent affecting circuit breaker operation
      }
    });
  }

  private openCircuit(reason: "threshold_reached" | "recovery_failure" | "manual_trip"): void {
    this.transitionState("open", reason);
    this._lastOpened = Date.now();
    this._halfOpenAttempts = 0;
  }

  private shouldTransitionToHalfOpen(): boolean {
    if (this._lastOpened === null) return false;
    return Date.now() - this._lastOpened >= this.config.resetTimeout;
  }

  private remainingTimeout(): number {
    if (this._lastOpened === null) return 0;
    const elapsed = Date.now() - this._lastOpened;
    return Math.max(0, this.config.resetTimeout - elapsed);
  }

  // Simple mutex implementation for thread-safe state transitions
  // In Node.js single-threaded event loop, this prevents interleaved async operations

  private async acquireLock(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this._transitionLock) {
        this._transitionLock = true;
        resolve();
      } else {
        this._pendingTransitions.push(() => {
          this._transitionLock = true;
          resolve();
        });
      }
    });
  }

  private releaseLock(): void {
    const next = this._pendingTransitions.shift();
    if (next) {
      next();
    } else {
      this._transitionLock = false;
    }
  }

  private withLock(fn: () => void): void {
    // Synchronous lock for simple operations
    // Since Node.js is single-threaded, synchronous code is already atomic
    fn();
  }
}

export { CircuitBreakerOpenError, defaultStateChangeLogger };
export type {
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitBreakerMetrics,
  CircuitState,
  CircuitStateTransition,
  OnStateChangeCallback,
};
