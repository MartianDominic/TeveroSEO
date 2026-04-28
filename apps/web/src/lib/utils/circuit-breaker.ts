/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily blocking requests to
 * failing services. After a cooldown period, allows a single test
 * request to probe if the service has recovered.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: After recovery timeout, allows one test request
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker('slack-webhook', {
 *   failureThreshold: 5,
 *   resetTimeout: 60000,
 * });
 *
 * try {
 *   const result = await breaker.execute(() => sendSlackMessage(msg));
 * } catch (e) {
 *   if (e instanceof CircuitOpenError) {
 *     // Service is unavailable, use fallback
 *   }
 * }
 * ```
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms before attempting recovery (default: 60000) */
  resetTimeout: number;
  /** Optional callback when circuit state changes */
  onStateChange?: (state: CircuitState, name: string) => void;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 60000,
};

/**
 * Error thrown when circuit breaker is open.
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly remainingMs: number,
  ) {
    super(
      `Circuit breaker '${circuitName}' is open. Service unavailable. ` +
      `Recovery in ${Math.ceil(remainingMs / 1000)}s.`
    );
    this.name = 'CircuitOpenError';
  }
}

/**
 * Circuit breaker for external service calls.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailure: number | null = null;
  private readonly options: CircuitBreakerOptions;
  private readonly name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Execute a function with circuit breaker protection.
   *
   * @param fn - Async function to execute
   * @returns Promise resolving to function result
   * @throws CircuitOpenError if circuit is open
   * @throws Original error if function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      const elapsed = Date.now() - (this.lastFailure ?? 0);
      if (elapsed > this.options.resetTimeout) {
        // Transition to half-open, allow test request
        this.setState('half-open');
      } else {
        // Still in cooldown, reject immediately
        throw new CircuitOpenError(
          this.name,
          this.options.resetTimeout - elapsed
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  /**
   * Record a successful operation.
   */
  private onSuccess(): void {
    this.failures = 0;
    if (this.state !== 'closed') {
      this.setState('closed');
    }
  }

  /**
   * Record a failed operation.
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.setState('open');
    }
  }

  /**
   * Update circuit state with optional callback.
   */
  private setState(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.options.onStateChange?.(newState, this.name);
    }
  }

  /**
   * Get current circuit state for monitoring.
   */
  getState(): {
    state: CircuitState;
    failures: number;
    threshold: number;
    lastFailure: number | null;
  } {
    return {
      state: this.state,
      failures: this.failures,
      threshold: this.options.failureThreshold,
      lastFailure: this.lastFailure,
    };
  }

  /**
   * Manually reset circuit to closed state.
   */
  reset(): void {
    this.failures = 0;
    this.lastFailure = null;
    this.setState('closed');
  }

  /**
   * Check if circuit is currently allowing requests.
   */
  isAllowingRequests(): boolean {
    if (this.state === 'closed' || this.state === 'half-open') {
      return true;
    }
    // Check if recovery timeout has passed
    const elapsed = Date.now() - (this.lastFailure ?? 0);
    return elapsed > this.options.resetTimeout;
  }
}

// ============================================================================
// Circuit Breaker Registry for Global Access
// ============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a named circuit breaker.
 *
 * @param name - Unique identifier for the circuit
 * @param options - Configuration options
 * @returns CircuitBreaker instance
 *
 * @example
 * ```typescript
 * const breaker = getCircuitBreaker('external-api', {
 *   failureThreshold: 3,
 *   resetTimeout: 30000,
 * });
 * ```
 */
export function getCircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  let breaker = circuitBreakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, options);
    circuitBreakers.set(name, breaker);
  }
  return breaker;
}

/**
 * Get all circuit breaker states for monitoring.
 */
export function getAllCircuitBreakerStates(): Record<
  string,
  ReturnType<CircuitBreaker['getState']>
> {
  const states: Record<string, ReturnType<CircuitBreaker['getState']>> = {};
  circuitBreakers.forEach((breaker, name) => {
    states[name] = breaker.getState();
  });
  return states;
}

/**
 * Reset all circuit breakers to closed state.
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach((breaker) => {
    breaker.reset();
  });
}
