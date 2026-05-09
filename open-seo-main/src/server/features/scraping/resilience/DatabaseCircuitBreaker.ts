/**
 * PostgreSQL Circuit Breaker
 * Phase 95-18: Resilience Hardening
 *
 * Protects against PostgreSQL cascade failures by:
 * - Wrapping database operations with circuit breaker pattern
 * - Running background health checks
 * - Detecting slow queries
 * - Providing manual override capabilities
 *
 * States:
 * - CLOSED: Normal operation, DB queries flow through
 * - OPEN: Too many failures, fail fast without hitting DB
 * - HALF_OPEN: Testing if DB recovered, limited queries
 */

import { CircuitBreaker, CircuitOpenError, createCircuitBreaker, type CircuitState } from './CircuitBreaker';
import { getMetricsCollector, recordCircuitState } from '../monitoring/MetricsCollector';
import { createComponentLogger } from '../logging';

// =============================================================================
// Types
// =============================================================================

export interface DatabaseCircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number;

  /** Number of successes in half-open before closing (default: 2) */
  successThreshold: number;

  /** Time (ms) before transitioning from open to half-open (default: 30000) */
  recoveryTimeoutMs: number;

  /** Health check interval (ms) (default: 10000) */
  healthCheckIntervalMs: number;

  /** Slow query threshold (ms) - queries exceeding this are logged (default: 5000) */
  slowQueryThresholdMs: number;

  /** Volume threshold before evaluating failure rate (default: 10) */
  volumeThreshold: number;
}

export interface DatabaseCircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  totalFailures: number;
  slowQueries: number;
  avgLatencyMs: number;
  lastHealthCheck: Date | null;
  lastHealthCheckSuccess: boolean | null;
}

export type WrappedDbOperation<T> = () => Promise<T>;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: DatabaseCircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.DB_CIRCUIT_FAILURE_THRESHOLD ?? '5', 10),
  successThreshold: 2,
  recoveryTimeoutMs: parseInt(process.env.DB_CIRCUIT_RECOVERY_TIMEOUT_MS ?? '30000', 10),
  healthCheckIntervalMs: 10000,
  slowQueryThresholdMs: 5000,
  volumeThreshold: 10,
};

// =============================================================================
// Logger
// =============================================================================

const logger = createComponentLogger('db-circuit-breaker');

// =============================================================================
// DatabaseCircuitBreaker
// =============================================================================

export class DatabaseCircuitBreaker {
  private circuit: CircuitBreaker;
  private config: DatabaseCircuitBreakerConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckFn: (() => Promise<boolean>) | null = null;

  // Stats tracking
  private slowQueries = 0;
  private totalLatencyMs = 0;
  private requestCount = 0;
  private lastHealthCheck: Date | null = null;
  private lastHealthCheckSuccess: boolean | null = null;

  constructor(config: Partial<DatabaseCircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.circuit = createCircuitBreaker('database', {
      failureThreshold: this.config.failureThreshold,
      successThreshold: this.config.successThreshold,
      timeout: this.config.recoveryTimeoutMs,
      volumeThreshold: this.config.volumeThreshold,
      errorFilter: this.isRecoverableError.bind(this),
    });

    // Listen for state changes to update metrics
    this.circuit.onStateChange((oldState, newState) => {
      logger.warn(`Database circuit state changed: ${oldState} -> ${newState}`);
      recordCircuitState('database', newState);

      // Update Prometheus gauge
      const metrics = getMetricsCollector();
      const stateValue = { closed: 0, 'half-open': 0.5, open: 1 }[newState];
      metrics.setGauge('osm_scraping_db_circuit_state', stateValue, { component: 'database' });
    });
  }

  /**
   * Execute a database operation through the circuit breaker.
   *
   * @param operation - Async function that performs the DB operation
   * @returns Result of the operation
   * @throws CircuitOpenError if circuit is open
   */
  async execute<T>(operation: WrappedDbOperation<T>): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await this.circuit.execute(operation);

      // Track latency
      const latencyMs = performance.now() - startTime;
      this.totalLatencyMs += latencyMs;
      this.requestCount++;

      // Check for slow query
      if (latencyMs > this.config.slowQueryThresholdMs) {
        this.slowQueries++;
        logger.warn({
          latencyMs,
          threshold: this.config.slowQueryThresholdMs,
        }, `Slow database query detected: ${latencyMs.toFixed(0)}ms`);
      }

      return result;
    } catch (error) {
      // Track latency even on failure
      const latencyMs = performance.now() - startTime;
      this.totalLatencyMs += latencyMs;
      this.requestCount++;

      throw error;
    }
  }

  /**
   * Execute with graceful fallback on circuit open.
   * Returns null instead of throwing CircuitOpenError.
   *
   * @param operation - Async function that performs the DB operation
   * @returns Result of operation or null if circuit is open
   */
  async executeOrNull<T>(operation: WrappedDbOperation<T>): Promise<T | null> {
    try {
      return await this.execute(operation);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        logger.debug({
          retryAfter: error.retryAfter,
        }, 'Database circuit open, returning null');
        return null;
      }
      throw error;
    }
  }

  /**
   * Execute with default value fallback on circuit open.
   *
   * @param operation - Async function that performs the DB operation
   * @param defaultValue - Value to return if circuit is open
   * @returns Result of operation or default value if circuit is open
   */
  async executeOrDefault<T>(
    operation: WrappedDbOperation<T>,
    defaultValue: T
  ): Promise<T> {
    try {
      return await this.execute(operation);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        logger.debug({
          retryAfter: error.retryAfter,
        }, 'Database circuit open, returning default');
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Start background health checks.
   *
   * @param healthCheckFn - Function that tests database connectivity
   */
  startHealthChecks(healthCheckFn: () => Promise<boolean>): void {
    this.healthCheckFn = healthCheckFn;

    // Clear any existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.runHealthCheck();
    }, this.config.healthCheckIntervalMs);

    logger.info({
      intervalMs: this.config.healthCheckIntervalMs,
    }, 'Database health checks started');
  }

  /**
   * Stop background health checks.
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Database health checks stopped');
    }
  }

  /**
   * Run a single health check.
   */
  async runHealthCheck(): Promise<boolean> {
    if (!this.healthCheckFn) {
      logger.warn('No health check function configured');
      return false;
    }

    try {
      const startTime = performance.now();
      const healthy = await this.healthCheckFn();
      const latencyMs = performance.now() - startTime;

      this.lastHealthCheck = new Date();
      this.lastHealthCheckSuccess = healthy;

      if (healthy) {
        logger.debug({ latencyMs }, 'Database health check passed');
      } else {
        logger.warn({ latencyMs }, 'Database health check failed');
      }

      // Update metrics
      const metrics = getMetricsCollector();
      metrics.setGauge('osm_scraping_db_health_check_status', healthy ? 1 : 0);
      metrics.recordDuration('osm_scraping_db_health_check_duration_seconds', latencyMs / 1000);

      return healthy;
    } catch (error) {
      this.lastHealthCheck = new Date();
      this.lastHealthCheckSuccess = false;

      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Database health check error');

      return false;
    }
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    return this.circuit.getState();
  }

  /**
   * Get detailed statistics.
   */
  getStats(): DatabaseCircuitBreakerStats {
    const circuitStats = this.circuit.getStats();

    return {
      state: circuitStats.state,
      failures: circuitStats.failures,
      successes: circuitStats.successes,
      totalRequests: circuitStats.totalRequests,
      totalFailures: circuitStats.totalFailures,
      slowQueries: this.slowQueries,
      avgLatencyMs: this.requestCount > 0 ? this.totalLatencyMs / this.requestCount : 0,
      lastHealthCheck: this.lastHealthCheck,
      lastHealthCheckSuccess: this.lastHealthCheckSuccess,
    };
  }

  /**
   * Force circuit open (for emergencies/maintenance).
   */
  forceOpen(): void {
    this.circuit.forceOpen();
    logger.warn('Database circuit manually forced open');
  }

  /**
   * Force circuit closed (for recovery).
   */
  forceClose(): void {
    this.circuit.forceClose();
    logger.info('Database circuit manually forced closed');
  }

  /**
   * Check if circuit is allowing requests.
   */
  isAllowingRequests(): boolean {
    return this.circuit.getState() !== 'open';
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.slowQueries = 0;
    this.totalLatencyMs = 0;
    this.requestCount = 0;
  }

  /**
   * Determine if an error is recoverable (should count as failure).
   * Non-recoverable errors (like validation errors) don't count.
   */
  private isRecoverableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Connection/network errors are recoverable
    if (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('too many connections') ||
      message.includes('connection pool')
    ) {
      return true;
    }

    // Database-specific recoverable errors
    if (
      message.includes('deadlock') ||
      message.includes('lock wait timeout') ||
      message.includes('serialization failure') ||
      message.includes('could not connect')
    ) {
      return true;
    }

    // Non-recoverable errors (don't count as circuit failures)
    // These are application logic errors, not infrastructure failures
    if (
      message.includes('unique constraint') ||
      message.includes('foreign key') ||
      message.includes('not null constraint') ||
      message.includes('check constraint') ||
      message.includes('validation')
    ) {
      return false;
    }

    // Default: count as recoverable (err on side of protection)
    return true;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let _dbCircuitBreaker: DatabaseCircuitBreaker | null = null;

/**
 * Get the global DatabaseCircuitBreaker singleton.
 */
export function getDatabaseCircuitBreaker(): DatabaseCircuitBreaker {
  if (!_dbCircuitBreaker) {
    _dbCircuitBreaker = new DatabaseCircuitBreaker();
  }
  return _dbCircuitBreaker;
}

/**
 * Reset the global DatabaseCircuitBreaker (for testing).
 */
export function resetDatabaseCircuitBreaker(): void {
  if (_dbCircuitBreaker) {
    _dbCircuitBreaker.stopHealthChecks();
  }
  _dbCircuitBreaker = null;
}

/**
 * Create a new DatabaseCircuitBreaker with custom config (for testing).
 */
export function createDatabaseCircuitBreaker(
  config: Partial<DatabaseCircuitBreakerConfig>
): DatabaseCircuitBreaker {
  return new DatabaseCircuitBreaker(config);
}

// =============================================================================
// Re-export CircuitOpenError for convenience
// =============================================================================

export { CircuitOpenError };
