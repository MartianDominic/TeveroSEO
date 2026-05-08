/**
 * Error Classifier Utility
 * Phase 95: Unified Scraping Infrastructure - P2.G14 Gap Closure
 *
 * Shared error classification logic for all fetcher implementations.
 * Classifies HTTP status codes, network errors, and timeouts into
 * standardized error types for escalation decisions and retry logic.
 *
 * Classification Rules:
 * - 429 = RATE_LIMITED (wait and retry)
 * - 403/451 = BLOCKED (escalate tier or skip)
 * - 5xx = RETRYABLE (server issues, retry with backoff)
 * - 4xx = PERMANENT (client error, don't retry)
 * - Timeouts = RETRYABLE
 * - Network errors = RETRYABLE
 */

import type { EscalationReason } from "@/db/domain-scrape-learning-schema";

// =============================================================================
// Error Type Definitions
// =============================================================================

/**
 * High-level error classification for retry/escalation decisions.
 */
export enum ErrorType {
  /** Error can be retried with backoff (5xx, timeouts, network issues) */
  RETRYABLE = "retryable",

  /** Error is permanent and should not be retried (4xx except 429/403) */
  PERMANENT = "permanent",

  /** Rate limited - wait for backoff then retry (429) */
  RATE_LIMITED = "rate_limited",

  /** Blocked by target (403, 451) - escalate tier */
  BLOCKED = "blocked",
}

/**
 * Result of error classification with detailed information.
 */
export interface ClassifiedError {
  /** High-level error type */
  type: ErrorType;

  /** Specific escalation reason for domain learning */
  escalationReason: EscalationReason;

  /** Whether this error should trigger tier escalation */
  shouldEscalate: boolean;

  /** Whether retry is recommended */
  shouldRetry: boolean;

  /** Recommended backoff duration in milliseconds */
  recommendedBackoffMs: number;

  /** Human-readable description */
  description: string;
}

// =============================================================================
// HTTP Status Code Classification
// =============================================================================

/**
 * Classify HTTP status code into error type.
 *
 * @param statusCode - HTTP response status code
 * @returns ClassifiedError with type and escalation reason
 */
export function classifyStatusCode(statusCode: number): ClassifiedError | null {
  // 2xx Success - not an error
  if (statusCode >= 200 && statusCode < 300) {
    return null;
  }

  // 429 Too Many Requests - Rate limited
  if (statusCode === 429) {
    return {
      type: ErrorType.RATE_LIMITED,
      escalationReason: "rate_limited",
      shouldEscalate: true,
      shouldRetry: true,
      recommendedBackoffMs: 30000, // 30 seconds default for rate limits
      description: "Rate limited by target server",
    };
  }

  // 403 Forbidden - IP/access blocked
  if (statusCode === 403) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "ip_blocked",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "Access forbidden - IP or request blocked",
    };
  }

  // 451 Unavailable for Legal Reasons - Geo/legal block
  if (statusCode === 451) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "geo_blocked",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "Content unavailable for legal reasons",
    };
  }

  // 503 Service Unavailable - Often bot detection
  if (statusCode === 503) {
    return {
      type: ErrorType.RETRYABLE,
      escalationReason: "bot_detected",
      shouldEscalate: true,
      shouldRetry: true,
      recommendedBackoffMs: 5000,
      description: "Service unavailable - possible bot detection",
    };
  }

  // 5xx Server Errors - Retryable
  if (statusCode >= 500 && statusCode < 600) {
    return {
      type: ErrorType.RETRYABLE,
      escalationReason: "connection_reset",
      shouldEscalate: false,
      shouldRetry: true,
      recommendedBackoffMs: 2000,
      description: `Server error (${statusCode})`,
    };
  }

  // 4xx Client Errors - Permanent (except 429, 403 handled above)
  if (statusCode >= 400 && statusCode < 500) {
    return {
      type: ErrorType.PERMANENT,
      escalationReason: "empty_response",
      shouldEscalate: false,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: `Client error (${statusCode})`,
    };
  }

  // 3xx Redirects that weren't followed - Permanent
  if (statusCode >= 300 && statusCode < 400) {
    return {
      type: ErrorType.PERMANENT,
      escalationReason: "empty_response",
      shouldEscalate: false,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: `Redirect not followed (${statusCode})`,
    };
  }

  // Unknown status code
  return {
    type: ErrorType.PERMANENT,
    escalationReason: "empty_response",
    shouldEscalate: false,
    shouldRetry: false,
    recommendedBackoffMs: 0,
    description: `Unknown status code (${statusCode})`,
  };
}

// =============================================================================
// Network/Fetch Error Classification
// =============================================================================

/**
 * Classify a JavaScript Error into escalation reason.
 *
 * @param error - Error thrown during fetch
 * @returns ClassifiedError with type and escalation reason
 */
export function classifyError(error: Error): ClassifiedError {
  const message = error.message.toLowerCase();
  const name = error.name;

  // Abort/Timeout errors
  if (
    name === "AbortError" ||
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("aborted")
  ) {
    return {
      type: ErrorType.RETRYABLE,
      escalationReason: "timeout",
      shouldEscalate: true,
      shouldRetry: true,
      recommendedBackoffMs: 5000,
      description: "Request timed out",
    };
  }

  // Connection refused/reset
  if (message.includes("econnrefused") || message.includes("econnreset")) {
    return {
      type: ErrorType.RETRYABLE,
      escalationReason: "connection_reset",
      shouldEscalate: false,
      shouldRetry: true,
      recommendedBackoffMs: 2000,
      description: "Connection refused or reset",
    };
  }

  // DNS resolution errors
  if (message.includes("enotfound") || message.includes("getaddrinfo")) {
    return {
      type: ErrorType.PERMANENT,
      escalationReason: "dns_error",
      shouldEscalate: false,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "DNS resolution failed",
    };
  }

  // SSL/TLS errors
  if (
    message.includes("ssl") ||
    message.includes("certificate") ||
    message.includes("tls") ||
    message.includes("self signed") ||
    message.includes("unable to verify")
  ) {
    return {
      type: ErrorType.PERMANENT,
      escalationReason: "ssl_error",
      shouldEscalate: false,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "SSL/TLS handshake failed",
    };
  }

  // Network unreachable
  if (
    message.includes("enetunreach") ||
    message.includes("ehostunreach") ||
    message.includes("network")
  ) {
    return {
      type: ErrorType.RETRYABLE,
      escalationReason: "connection_reset",
      shouldEscalate: false,
      shouldRetry: true,
      recommendedBackoffMs: 5000,
      description: "Network unreachable",
    };
  }

  // Socket hang up
  if (message.includes("socket hang up") || message.includes("econnaborted")) {
    return {
      type: ErrorType.RETRYABLE,
      escalationReason: "connection_reset",
      shouldEscalate: false,
      shouldRetry: true,
      recommendedBackoffMs: 2000,
      description: "Connection aborted",
    };
  }

  // Proxy errors
  if (message.includes("proxy") || message.includes("407")) {
    return {
      type: ErrorType.RETRYABLE,
      escalationReason: "connection_reset",
      shouldEscalate: true,
      shouldRetry: true,
      recommendedBackoffMs: 5000,
      description: "Proxy connection failed",
    };
  }

  // Default: treat as retryable connection issue
  return {
    type: ErrorType.RETRYABLE,
    escalationReason: "connection_reset",
    shouldEscalate: false,
    shouldRetry: true,
    recommendedBackoffMs: 2000,
    description: error.message || "Unknown error",
  };
}

// =============================================================================
// Bot Protection Detection
// =============================================================================

/**
 * Detect bot protection from response HTML and headers.
 *
 * @param html - Response HTML body
 * @param headers - Response headers (fetch Headers or Record)
 * @returns ClassifiedError if bot protection detected, null otherwise
 */
export function detectBotProtection(
  html: string,
  headers: Headers | Record<string, string>
): ClassifiedError | null {
  const htmlLower = html.toLowerCase();

  // Helper to get header value
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    return headers[name] ?? headers[name.toLowerCase()] ?? null;
  };

  // Cloudflare detection
  const cfRay = getHeader("cf-ray");
  const cfMitigated = getHeader("cf-mitigated");

  if (
    cfRay ||
    cfMitigated ||
    htmlLower.includes("cloudflare") ||
    htmlLower.includes("checking your browser") ||
    htmlLower.includes("just a moment") ||
    htmlLower.includes("attention required")
  ) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "dc_detected",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "Cloudflare protection detected",
    };
  }

  // CAPTCHA detection
  if (
    htmlLower.includes("recaptcha") ||
    htmlLower.includes("hcaptcha") ||
    htmlLower.includes("g-recaptcha") ||
    htmlLower.includes("captcha-container")
  ) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "captcha",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "CAPTCHA challenge detected",
    };
  }

  // Akamai detection
  if (
    htmlLower.includes("akamai") ||
    htmlLower.includes("access denied") ||
    getHeader("x-akamai-session-info")
  ) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "bot_detected",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "Akamai bot protection detected",
    };
  }

  // Imperva/Incapsula detection
  if (
    htmlLower.includes("incapsula") ||
    htmlLower.includes("imperva") ||
    getHeader("x-iinfo")
  ) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "bot_detected",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "Imperva protection detected",
    };
  }

  // DataDome detection
  if (htmlLower.includes("datadome") || getHeader("x-datadome")) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "bot_detected",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "DataDome protection detected",
    };
  }

  // PerimeterX detection
  if (htmlLower.includes("perimeterx") || htmlLower.includes("px-captcha")) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "bot_detected",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "PerimeterX protection detected",
    };
  }

  // Generic bot detection phrases
  if (
    htmlLower.includes("are you a robot") ||
    htmlLower.includes("automated") ||
    htmlLower.includes("please verify") ||
    htmlLower.includes("human verification") ||
    htmlLower.includes("suspicious activity")
  ) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "bot_detected",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "Generic bot detection page",
    };
  }

  // DC/ASN blocking (datacenter IP detection)
  if (htmlLower.includes("datacenter") || htmlLower.includes("data center")) {
    return {
      type: ErrorType.BLOCKED,
      escalationReason: "dc_detected",
      shouldEscalate: true,
      shouldRetry: false,
      recommendedBackoffMs: 0,
      description: "Datacenter IP blocked",
    };
  }

  return null;
}

// =============================================================================
// Backoff Calculator
// =============================================================================

/**
 * Calculate exponential backoff duration.
 *
 * @param errorType - Type of error
 * @param attemptNumber - Current retry attempt (0-indexed)
 * @param options - Optional configuration
 * @returns Backoff duration in milliseconds
 */
export function getBackoffMs(
  errorType: ErrorType,
  attemptNumber: number,
  options: {
    /** Base delay in milliseconds (default: varies by error type) */
    baseDelayMs?: number;
    /** Maximum delay in milliseconds (default: 60000) */
    maxDelayMs?: number;
    /** Jitter factor 0-1 (default: 0.1) */
    jitterFactor?: number;
  } = {}
): number {
  const { maxDelayMs = 60000, jitterFactor = 0.1 } = options;

  // Base delay varies by error type
  let baseDelayMs = options.baseDelayMs;
  if (baseDelayMs === undefined) {
    switch (errorType) {
      case ErrorType.RATE_LIMITED:
        baseDelayMs = 10000; // 10 seconds for rate limits
        break;
      case ErrorType.BLOCKED:
        baseDelayMs = 0; // No retry for blocked
        break;
      case ErrorType.RETRYABLE:
        baseDelayMs = 1000; // 1 second for retryable
        break;
      case ErrorType.PERMANENT:
        baseDelayMs = 0; // No retry for permanent
        break;
      default:
        baseDelayMs = 1000;
    }
  }

  // No backoff for non-retryable errors
  if (errorType === ErrorType.BLOCKED || errorType === ErrorType.PERMANENT) {
    return 0;
  }

  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber);

  // Cap at maximum
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter to avoid thundering herd
  const jitter = cappedDelay * jitterFactor * (Math.random() - 0.5) * 2;

  return Math.round(cappedDelay + jitter);
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick check if an error is retryable.
 *
 * @param error - Error or HTTP status code
 * @returns true if the error should be retried
 */
export function isRetryable(error: Error | number): boolean {
  if (typeof error === "number") {
    const classified = classifyStatusCode(error);
    return classified?.shouldRetry ?? false;
  }
  return classifyError(error).shouldRetry;
}

/**
 * Quick check if an error should trigger tier escalation.
 *
 * @param error - Error or HTTP status code
 * @returns true if tier escalation is recommended
 */
export function shouldEscalateTier(error: Error | number): boolean {
  if (typeof error === "number") {
    const classified = classifyStatusCode(error);
    return classified?.shouldEscalate ?? false;
  }
  return classifyError(error).shouldEscalate;
}

/**
 * Get the escalation reason for an error.
 *
 * @param error - Error or HTTP status code
 * @returns EscalationReason for domain learning
 */
export function getEscalationReason(
  error: Error | number
): EscalationReason | undefined {
  if (typeof error === "number") {
    const classified = classifyStatusCode(error);
    return classified?.escalationReason;
  }
  return classifyError(error).escalationReason;
}

/**
 * Legacy compatibility: Map status code to simple escalation reason.
 * Used by fetchers that don't need full ClassifiedError.
 *
 * @param statusCode - HTTP status code
 * @returns EscalationReason or undefined if not an error
 */
export function mapStatusCodeToEscalationReason(
  statusCode: number
): EscalationReason | undefined {
  const classified = classifyStatusCode(statusCode);
  return classified?.escalationReason;
}

/**
 * Legacy compatibility: Classify error to simple escalation reason.
 * Used by fetchers that don't need full ClassifiedError.
 *
 * @param error - Error thrown during fetch
 * @returns EscalationReason
 */
export function mapErrorToEscalationReason(error: Error): EscalationReason {
  return classifyError(error).escalationReason;
}
