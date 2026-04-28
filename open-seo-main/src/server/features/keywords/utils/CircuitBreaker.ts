/**
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
 * @see Fix 10 in .planning/keyword-intelligence/IMPLEMENTATION-FIXES.md
 */

import type {
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitState,
} from "../types/circuit-breaker";
import { CircuitBreakerOpenError } from "../types/circuit-breaker";

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 3,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 1,
};

export class CircuitBreaker {
  private readonly config: Required<CircuitBreakerConfig>;

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

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Current circuit state
   */
  get state(): CircuitState {
    // Check if OPEN should transition to HALF_OPEN
    if (this._state === "open" && this.shouldTransitionToHalfOpen()) {
      this._state = "half_open";
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
   * Get current statistics for monitoring
   */
  get stats(): CircuitBreakerStats {
    return {
      failures: this._failures,
      successes: this._successes,
      state: this.state,
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
        this._state = "closed";
        this._failures = 0;
        this._halfOpenAttempts = 0;
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
        this.openCircuit();
      } else if (
        this._state === "closed" &&
        this._failures >= this.config.failureThreshold
      ) {
        // Threshold reached in CLOSED state
        this.openCircuit();
      }
    });
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.withLock(() => {
      this._state = "closed";
      this._failures = 0;
      this._successes = 0;
      this._lastFailure = null;
      this._lastOpened = null;
      this._rejectedCount = 0;
      this._halfOpenAttempts = 0;
    });
  }

  /**
   * Force circuit to open state (for manual intervention)
   */
  trip(): void {
    this.withLock(() => {
      this.openCircuit();
    });
  }

  // Private methods

  private openCircuit(): void {
    this._state = "open";
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

export { CircuitBreakerOpenError };
export type { CircuitBreakerConfig, CircuitBreakerStats, CircuitState };
