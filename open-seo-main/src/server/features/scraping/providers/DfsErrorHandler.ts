/**
 * DataForSEO Error Handler
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 *
 * Handles DFS-specific error codes and implements:
 * - Retry strategy with exponential backoff
 * - Tier escalation on specific error types
 * - Circuit breaker for DFS service health
 */

import type {
  DfsMode,
  DfsRetryConfig,
  DfsErrorCode,
  CircuitState,
  CircuitBreakerConfig,
} from "./DataForSEOFetcher.types";
import {
  DFS_ERROR_CODES,
  RETRYABLE_DFS_ERRORS,
  ESCALATE_TIER_DFS_ERRORS,
  DEFAULT_DFS_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from "./DataForSEOFetcher.types";
import type { EscalationReason } from "@/db/domain-scrape-learning-schema";

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Classify a DFS error code into an escalation reason for domain learning.
 *
 * @param errorCode - DFS error code
 * @param statusCode - HTTP status code (optional)
 * @param errorMessage - Error message (optional)
 * @returns EscalationReason for domain learning
 */
export function classifyDfsError(
  errorCode: number | undefined,
  statusCode?: number,
  errorMessage?: string
): EscalationReason {
  // Map DFS error codes to escalation reasons
  if (errorCode) {
    switch (errorCode) {
      case 20002:
        return "rate_limited";
      case 50001:
        return "timeout"; // Target unreachable
      case 50002:
        return "timeout";
      case 50003:
        return "bot_detected"; // Target returned error
      case 50004:
        return "js_required";
      case 50005:
        return "js_required"; // Browser rendering failed
      case 50007:
        return "captcha";
      case 50008:
        return "bot_detected";
      default:
        break;
    }
  }

  // Map HTTP status codes
  if (statusCode) {
    if (statusCode === 429) return "rate_limited";
    if (statusCode === 403) return "ip_blocked";
    if (statusCode >= 500) return "connection_reset";
  }

  // Analyze error message
  if (errorMessage) {
    const msg = errorMessage.toLowerCase();
    if (msg.includes("timeout")) return "timeout";
    if (msg.includes("captcha")) return "captcha";
    if (msg.includes("blocked")) return "ip_blocked";
    if (msg.includes("javascript") || msg.includes("js")) return "js_required";
    if (msg.includes("empty") || msg.includes("no content")) return "empty_response";
    if (msg.includes("ssl") || msg.includes("tls")) return "ssl_error";
    if (msg.includes("dns")) return "dns_error";
    if (msg.includes("reset")) return "connection_reset";
  }

  // Default fallback
  return "bot_detected";
}

/**
 * Check if an error code is retryable.
 *
 * @param errorCode - DFS error code
 * @param config - Retry configuration
 * @returns True if the error should be retried
 */
export function isRetryableError(
  errorCode: number | undefined,
  config: DfsRetryConfig = DEFAULT_DFS_RETRY_CONFIG
): boolean {
  if (!errorCode) return false;
  return config.retryableCodes.includes(errorCode as DfsErrorCode);
}

/**
 * Check if an error should trigger tier escalation.
 *
 * @param errorCode - DFS error code
 * @param config - Retry configuration
 * @returns True if tier should be escalated
 */
export function shouldEscalateTier(
  errorCode: number | undefined,
  config: DfsRetryConfig = DEFAULT_DFS_RETRY_CONFIG
): boolean {
  if (!errorCode) return false;
  return config.escalateTierOn.includes(errorCode as DfsErrorCode);
}

/**
 * Get the human-readable error message for a DFS error code.
 *
 * @param errorCode - DFS error code
 * @returns Human-readable error message
 */
export function getDfsErrorMessage(errorCode: number): string {
  return DFS_ERROR_CODES[errorCode as DfsErrorCode] ?? `Unknown error (${errorCode})`;
}

// =============================================================================
// Tier Escalation
// =============================================================================

/**
 * Escalation order for DFS modes.
 */
const TIER_ESCALATION: Record<DfsMode, DfsMode> = {
  basic: "js",
  js: "browser",
  browser: "browser", // No further escalation
};

/**
 * Cost per page for each mode.
 */
const MODE_COSTS: Record<DfsMode, number> = {
  basic: 0.000125,
  js: 0.00125,
  browser: 0.00425,
};

/**
 * Escalate to the next tier.
 *
 * @param currentMode - Current DFS mode
 * @returns Next mode and its cost
 */
export function escalateTier(currentMode: DfsMode): {
  mode: DfsMode;
  cost: number;
  canEscalate: boolean;
} {
  const nextMode = TIER_ESCALATION[currentMode];
  return {
    mode: nextMode,
    cost: MODE_COSTS[nextMode],
    canEscalate: currentMode !== "browser",
  };
}

// =============================================================================
// Retry with Backoff
// =============================================================================

/**
 * Calculate delay for exponential backoff with jitter.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  config: DfsRetryConfig = DEFAULT_DFS_RETRY_CONFIG
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);

  // Add jitter (0-1000ms)
  const jitter = Math.random() * 1000;

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Execute a function with retry and backoff.
 *
 * @param fn - Function to execute
 * @param config - Retry configuration
 * @param onRetry - Callback for each retry (optional)
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: DfsRetryConfig = DEFAULT_DFS_RETRY_CONFIG,
  onRetry?: (attempt: number, error: Error, delay: number) => void
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Extract error code from error message if available
      const errorCodeMatch = lastError.message.match(/error code[:\s]*(\d+)/i);
      const errorCode = errorCodeMatch ? parseInt(errorCodeMatch[1], 10) : undefined;

      // Check if retryable
      if (!isRetryableError(errorCode, config)) {
        throw lastError;
      }

      // Don't delay after last attempt
      if (attempt < config.maxRetries) {
        const delay = calculateBackoffDelay(attempt, config);
        onRetry?.(attempt + 1, lastError, delay);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error("Max retries exceeded");
}

// =============================================================================
// Circuit Breaker
// =============================================================================

/**
 * Circuit breaker for DataForSEO service health.
 * Prevents cascading failures when DFS is having issues.
 */
export class DfsCircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailure: Date | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {
    this.config = config;
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * @param fn - Function to execute
   * @returns Result of the function
   * @throws Error if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should transition from open to half-open
    if (this.state === "open") {
      if (this.shouldAttemptReset()) {
        this.state = "half-open";
        this.successes = 0;
      } else {
        throw new Error(
          `DataForSEO circuit breaker is open. Retry after ${this.getResetTime()}ms`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful call.
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = "closed";
        this.successes = 0;
      }
    }
  }

  /**
   * Record a failed call.
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === "half-open") {
      // Any failure in half-open goes back to open
      this.state = "open";
      this.successes = 0;
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = "open";
      console.error(
        `[DataForSEO] Circuit breaker opened after ${this.failures} failures`
      );
    }
  }

  /**
   * Check if we should attempt to reset from open state.
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailure) return true;
    const elapsed = Date.now() - this.lastFailure.getTime();
    return elapsed >= this.config.recoveryTimeoutMs;
  }

  /**
   * Get time until reset is attempted (ms).
   */
  private getResetTime(): number {
    if (!this.lastFailure) return 0;
    const elapsed = Date.now() - this.lastFailure.getTime();
    return Math.max(0, this.config.recoveryTimeoutMs - elapsed);
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count.
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Check if the circuit is healthy (closed or half-open).
   */
  isHealthy(): boolean {
    return this.state !== "open";
  }

  /**
   * Manually reset the circuit to closed state.
   */
  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
  }
}

// =============================================================================
// Singleton Circuit Breaker
// =============================================================================

let _circuitBreaker: DfsCircuitBreaker | null = null;

/**
 * Get or create the DFS circuit breaker singleton.
 */
export function getDfsCircuitBreaker(): DfsCircuitBreaker {
  if (!_circuitBreaker) {
    _circuitBreaker = new DfsCircuitBreaker();
  }
  return _circuitBreaker;
}

/**
 * Reset the circuit breaker singleton (for testing).
 */
export function resetDfsCircuitBreaker(): void {
  if (_circuitBreaker) {
    _circuitBreaker.reset();
  }
  _circuitBreaker = null;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Error Builder
// =============================================================================

/**
 * Build a detailed error with DFS context.
 *
 * @param message - Base error message
 * @param context - Additional context
 * @returns Error with full context
 */
export function buildDfsError(
  message: string,
  context: {
    url?: string;
    mode?: DfsMode;
    errorCode?: number;
    statusCode?: number;
    attempt?: number;
  }
): Error {
  const parts = [message];

  if (context.url) parts.push(`URL: ${context.url}`);
  if (context.mode) parts.push(`Mode: ${context.mode}`);
  if (context.errorCode) {
    parts.push(`DFS Error: ${context.errorCode} (${getDfsErrorMessage(context.errorCode)})`);
  }
  if (context.statusCode) parts.push(`HTTP: ${context.statusCode}`);
  if (context.attempt !== undefined) parts.push(`Attempt: ${context.attempt + 1}`);

  return new Error(parts.join(" | "));
}
