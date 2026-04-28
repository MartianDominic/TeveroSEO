/**
 * Circuit Breaker Types
 *
 * Types for implementing the circuit breaker pattern to prevent cascade failures
 * when external services (LLM APIs, embedding services, graph databases) fail.
 */

/**
 * Circuit breaker states following the standard pattern:
 * - CLOSED: Normal operation, requests flow through, failures are tracked
 * - OPEN: Circuit is tripped, requests are rejected immediately (fail fast)
 * - HALF_OPEN: Testing if service has recovered, allows limited requests
 */
export type CircuitState = "closed" | "open" | "half_open";

/**
 * Configuration for CircuitBreaker instances
 */
export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures before opening the circuit
   * @default 3
   */
  failureThreshold?: number;

  /**
   * Time in milliseconds to wait before transitioning from OPEN to HALF_OPEN
   * @default 60000
   */
  resetTimeout?: number;

  /**
   * Maximum number of test requests allowed in HALF_OPEN state
   * @default 1
   */
  halfOpenMaxAttempts?: number;
}

/**
 * Runtime statistics for monitoring circuit breaker health
 */
export interface CircuitBreakerStats {
  /** Current number of consecutive failures */
  failures: number;

  /** Total number of successful requests since last state change */
  successes: number;

  /** Current circuit state */
  state: CircuitState;

  /** Timestamp of the last recorded failure (milliseconds since epoch) */
  lastFailure: number | null;

  /** Timestamp when circuit was last opened (milliseconds since epoch) */
  lastOpened: number | null;

  /** Number of requests rejected while circuit is open */
  rejectedCount: number;

  /** Number of test requests made in HALF_OPEN state */
  halfOpenAttempts: number;
}

/**
 * Error thrown when circuit breaker is open and rejects a request
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string = "Circuit breaker is open",
    public readonly stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}
