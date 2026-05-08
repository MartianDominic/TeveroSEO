/**
 * Circuit Breaker Types
 *
 * Types for implementing the circuit breaker pattern to prevent cascade failures
 * when external services (LLM APIs, embedding services, graph databases) fail.
 *
 * @see P3.G21 - Metrics emission for observability dashboards
 */

/**
 * Circuit breaker states following the standard pattern:
 * - CLOSED: Normal operation, requests flow through, failures are tracked
 * - OPEN: Circuit is tripped, requests are rejected immediately (fail fast)
 * - HALF_OPEN: Testing if service has recovered, allows limited requests
 */
export type CircuitState = "closed" | "open" | "half_open";

/**
 * State transition event emitted when circuit state changes.
 * Used for metrics collection and observability dashboards.
 */
export interface CircuitStateTransition {
  /** Circuit breaker name/identifier */
  name: string;
  /** Previous state before transition */
  fromState: CircuitState;
  /** New state after transition */
  toState: CircuitState;
  /** Timestamp of the transition (milliseconds since epoch) */
  timestamp: number;
  /** Duration spent in the previous state (milliseconds) */
  durationInPreviousStateMs: number;
  /** Reason for the transition */
  reason: "threshold_reached" | "timeout_elapsed" | "recovery_success" | "recovery_failure" | "manual_trip" | "manual_reset";
  /** Full stats at time of transition */
  stats: CircuitBreakerStats;
}

/**
 * Callback type for state change notifications.
 * Implementation should be non-blocking (fire-and-forget).
 */
export type OnStateChangeCallback = (transition: CircuitStateTransition) => void;

/**
 * Configuration for CircuitBreaker instances
 */
export interface CircuitBreakerConfig {
  /**
   * Unique name for this circuit breaker (used in metrics/logs)
   * @default "unnamed"
   */
  name?: string;

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

  /**
   * Callback invoked on state transitions for external metric systems.
   * Should be non-blocking. If not provided, transitions are logged to console.
   */
  onStateChange?: OnStateChangeCallback;
}

/**
 * Comprehensive metrics for monitoring circuit breaker health.
 * Extends CircuitBreakerStats with time-based metrics.
 */
export interface CircuitBreakerMetrics {
  /** Circuit breaker name/identifier */
  name: string;
  /** Current circuit state */
  state: CircuitState;
  /** Total number of failures since creation/reset */
  totalFailures: number;
  /** Total number of successes since creation/reset */
  totalSuccesses: number;
  /** Number of requests rejected while circuit is open */
  totalRejected: number;
  /** Number of state transitions since creation/reset */
  stateTransitionCount: number;
  /** Duration in current state (milliseconds) */
  currentStateDurationMs: number;
  /** Timestamp when circuit was created/reset */
  createdAt: number;
  /** Timestamp of last state transition (null if never transitioned) */
  lastTransitionAt: number | null;
  /** Number of times circuit has opened */
  openCount: number;
  /** Average time spent in OPEN state (milliseconds) */
  avgOpenDurationMs: number;
  /** Current runtime stats */
  stats: CircuitBreakerStats;
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

/**
 * Default logging callback for state transitions.
 * Logs structured JSON to console for observability.
 */
export function defaultStateChangeLogger(transition: CircuitStateTransition): void {
  const logData = {
    event: "circuit_breaker_state_change",
    circuit: transition.name,
    from: transition.fromState,
    to: transition.toState,
    reason: transition.reason,
    durationMs: transition.durationInPreviousStateMs,
    failures: transition.stats.failures,
    successes: transition.stats.successes,
    rejected: transition.stats.rejectedCount,
    timestamp: new Date(transition.timestamp).toISOString(),
  };

  if (transition.toState === "open") {
    console.warn("[CircuitBreaker]", JSON.stringify(logData));
  } else {
    console.info("[CircuitBreaker]", JSON.stringify(logData));
  }
}
