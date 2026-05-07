/**
 * Retry Configuration for Scraping Jobs.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Error-specific retry policies with exponential backoff.
 */

import type { ScrapeErrorCode } from "./queue.types";

/**
 * Backoff configuration.
 */
export interface BackoffConfig {
  type: "exponential" | "fixed";
  delay: number; // Initial delay in ms
}

/**
 * Retry policy for a specific error type.
 */
export interface RetryPolicy {
  /** Maximum retry attempts */
  attempts: number;
  /** Backoff configuration */
  backoff: BackoffConfig;
}

/**
 * Default retry settings.
 */
export const DEFAULT_RETRY_CONFIG: RetryPolicy = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2_000, // 2s initial delay
  },
};

/**
 * Error-specific retry policies.
 *
 * Different error types warrant different retry strategies:
 * - RATE_LIMITED: More attempts, longer delays (server is telling us to slow down)
 * - BLOCKED: Few attempts (will escalate tier instead)
 * - TIMEOUT: Standard exponential backoff
 * - DNS_FAILURE: Few attempts with long fixed delay (DNS propagation)
 * - SSL_ERROR: Usually permanent, minimal retries
 */
export const ERROR_RETRY_POLICIES: Partial<Record<ScrapeErrorCode, RetryPolicy>> = {
  RATE_LIMITED: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5_000, // 5s initial (429s need longer waits)
    },
  },
  BLOCKED: {
    attempts: 2, // Will escalate tier, not retry same tier
    backoff: {
      type: "fixed",
      delay: 1_000,
    },
  },
  TIMEOUT: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3_000,
    },
  },
  DNS_FAILURE: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 10_000, // DNS propagation may take time
    },
  },
  SSL_ERROR: {
    attempts: 1, // Usually permanent
    backoff: {
      type: "fixed",
      delay: 0,
    },
  },
  CAPTCHA: {
    attempts: 2, // Will escalate to higher tier
    backoff: {
      type: "fixed",
      delay: 2_000,
    },
  },
  BOT_DETECTION: {
    attempts: 2, // Will escalate to higher tier
    backoff: {
      type: "fixed",
      delay: 3_000,
    },
  },
  PARSE_ERROR: {
    attempts: 1, // Usually not transient
    backoff: {
      type: "fixed",
      delay: 0,
    },
  },
  CONNECTION_REFUSED: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
  },
  INVALID_URL: {
    attempts: 0, // Never retry invalid URLs
    backoff: {
      type: "fixed",
      delay: 0,
    },
  },
};

/**
 * Get retry policy for an error code.
 *
 * @param errorCode - The error code to get policy for
 * @returns Retry policy for the error type
 */
export function getRetryPolicy(errorCode?: ScrapeErrorCode): RetryPolicy {
  if (!errorCode) {
    return DEFAULT_RETRY_CONFIG;
  }
  return ERROR_RETRY_POLICIES[errorCode] ?? DEFAULT_RETRY_CONFIG;
}

/**
 * Calculate delay for a specific retry attempt.
 *
 * @param attempt - Current attempt number (1-indexed)
 * @param baseDelay - Base delay in ms
 * @param type - Backoff type (exponential or fixed)
 * @returns Delay in ms (capped at 60s)
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  type: "exponential" | "fixed"
): number {
  if (type === "fixed") {
    return baseDelay;
  }

  // Exponential: 2s, 4s, 8s, 16s, 32s (capped at 60s)
  const delay = baseDelay * Math.pow(2, attempt - 1);

  // Add jitter to prevent thundering herd (+0-1s random)
  const jitter = Math.random() * 1000;

  return Math.min(delay + jitter, 60_000);
}

/**
 * Check if an error should trigger tier escalation.
 *
 * Some errors indicate the current tier isn't working for the domain
 * and should escalate to a higher tier rather than just retrying.
 *
 * @param errorCode - The error code to check
 * @returns True if error should trigger tier escalation
 */
export function shouldEscalateTier(errorCode: ScrapeErrorCode): boolean {
  const escalationTriggers: ScrapeErrorCode[] = [
    "BLOCKED",
    "CAPTCHA",
    "BOT_DETECTION",
    "RATE_LIMITED", // After multiple 429s, might need higher tier
  ];
  return escalationTriggers.includes(errorCode);
}

/**
 * Check if an error is permanent and should not be retried.
 *
 * @param errorCode - The error code to check
 * @returns True if error is permanent
 */
export function isPermanentError(errorCode: ScrapeErrorCode): boolean {
  const permanentErrors: ScrapeErrorCode[] = [
    "INVALID_URL",
    "SSL_ERROR",
    "PARSE_ERROR",
  ];
  return permanentErrors.includes(errorCode);
}
