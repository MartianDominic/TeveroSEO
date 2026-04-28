/**
 * Circuit Breaker pattern for graceful service degradation.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service failing, requests rejected immediately
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * Flow:
 * 1. Start CLOSED
 * 2. After `failureThreshold` failures -> OPEN
 * 3. After `resetTimeout` ms -> HALF_OPEN (test one request)
 * 4. If test succeeds -> CLOSED, if fails -> OPEN again
 */

export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 3) */
  failureThreshold: number;
  /** Time in ms to wait before attempting recovery (default: 60000) */
  resetTimeout: number;
  /** Name for logging/metrics (default: "unnamed") */
  name: string;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeout: 60000,
  name: "unnamed",
};

export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private failures = 0;
  private state: CircuitState = CircuitState.CLOSED;
  private lastFailureTime = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if circuit is open (rejecting requests).
   * Automatically transitions to HALF_OPEN after resetTimeout.
   */
  get isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Check if circuit allows requests (CLOSED or HALF_OPEN).
   */
  get allowsRequest(): boolean {
    return !this.isOpen;
  }

  /**
   * Current circuit state.
   */
  get currentState(): CircuitState {
    // Trigger state transition check
    void this.isOpen;
    return this.state;
  }

  /**
   * Current failure count.
   */
  get failureCount(): number {
    return this.failures;
  }

  /**
   * Circuit name for logging.
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Record a successful request. Resets failure count and closes circuit.
   */
  recordSuccess(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  /**
   * Record a failed request. Opens circuit after threshold reached.
   */
  recordFailure(): void {
    this.failures += 1;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Manually reset the circuit to CLOSED state.
   */
  reset(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
    this.lastFailureTime = 0;
  }

  /**
   * Execute a function with circuit breaker protection.
   * Throws CircuitOpenError if circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      throw new CircuitOpenError(this.config.name);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}

/**
 * Error thrown when attempting to execute on an open circuit.
 */
export class CircuitOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is open - rejecting request`);
    this.name = "CircuitOpenError";
  }
}
