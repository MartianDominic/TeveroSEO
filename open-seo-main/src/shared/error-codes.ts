/**
 * Unified Error Codes for open-seo-main.
 *
 * This module provides:
 * 1. ErrorCode - Zod-validated enum of all error codes
 * 2. HTTP status mappings - Bidirectional mapping between codes and HTTP status
 * 3. Error classification helpers - For logging and retry decisions
 *
 * CONSOLIDATION: This merges functionality from:
 * - Original error-codes.ts (business domain codes)
 * - standard-error.ts (HTTP mappings, response format)
 * - worker error-handler.ts ERROR_CODES (duplicate codes removed)
 */

import { z } from "zod";

// =============================================================================
// Error Code Definition
// =============================================================================

const ERROR_CODES = [
  // Authentication/Authorization (4xx)
  "UNAUTHENTICATED",
  "AUTH_CONFIG_MISSING",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "PERMISSION_DENIED",

  // Client errors (4xx)
  "BAD_REQUEST",
  "NOT_FOUND",
  "GONE",
  "CONFLICT",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "RATE_LIMIT", // Alias for RATE_LIMITED

  // Payment/Subscription (402/403)
  "PAYMENT_REQUIRED",
  "SUBSCRIPTION_REQUIRED",
  "QUOTA_EXCEEDED",

  // Resource state (4xx)
  "RESOURCE_LOCKED",
  "DUPLICATE_ENTRY",
  "INVALID_STATE",

  // Server errors (5xx)
  "INTERNAL_ERROR",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "DEPENDENCY_FAILED",

  // Domain-specific: Audit
  "AUDIT_CAPACITY_REACHED",
  "CRAWL_TARGET_BLOCKED",

  // Domain-specific: Backlinks
  "BACKLINKS_NOT_ENABLED",
  "BACKLINKS_BILLING_ISSUE",

  // Domain-specific: Database operations
  "ALERT_CREATE_FAILED",
  "ALERT_RULE_CREATE_FAILED",
  "DROP_EVENT_FAILED",
  "WEBHOOK_DELETE_FAILED",

  // Domain-specific: External APIs
  "EXTERNAL_SERVICE_ERROR",
  "GSC_API_ERROR",
  "DOKOBIT_API_ERROR",

  // Domain-specific: Contracts
  "CONTRACT_INVALID_STATE",

  // Domain-specific: Prospects
  "CONFIG_ERROR",
  "EXTRACTION_ERROR",

  // Legacy/Unknown
  "LEGACY_ERROR",
  "UNKNOWN_ERROR",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

// =============================================================================
// HTTP Status Mappings (merged from standard-error.ts)
// =============================================================================

/**
 * Error code to HTTP status mapping.
 * Used to derive the correct HTTP status when throwing AppError.
 */
export const ERROR_CODE_TO_HTTP_STATUS: Partial<Record<ErrorCode, number>> = {
  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  SUBSCRIPTION_REQUIRED: 402,
  FORBIDDEN: 403,
  PERMISSION_DENIED: 403,
  NOT_FOUND: 404,
  GONE: 410,
  CONFLICT: 409,
  DUPLICATE_ENTRY: 409,
  INVALID_STATE: 409,
  CONTRACT_INVALID_STATE: 409,
  VALIDATION_ERROR: 422,
  RESOURCE_LOCKED: 423,
  DEPENDENCY_FAILED: 424,
  RATE_LIMITED: 429,
  RATE_LIMIT: 429,
  QUOTA_EXCEEDED: 429,
  AUDIT_CAPACITY_REACHED: 429,

  // 5xx Server Errors
  INTERNAL_ERROR: 500,
  ALERT_CREATE_FAILED: 500,
  ALERT_RULE_CREATE_FAILED: 500,
  DROP_EVENT_FAILED: 500,
  WEBHOOK_DELETE_FAILED: 500,
  CONFIG_ERROR: 500,
  EXTRACTION_ERROR: 500,
  GSC_API_ERROR: 502,
  DOKOBIT_API_ERROR: 502,
  EXTERNAL_SERVICE_ERROR: 502,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  LEGACY_ERROR: 500,
  UNKNOWN_ERROR: 500,
};

/**
 * HTTP status to error code mapping (reverse lookup).
 */
export const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  402: "PAYMENT_REQUIRED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  410: "GONE",
  422: "VALIDATION_ERROR",
  423: "RESOURCE_LOCKED",
  424: "DEPENDENCY_FAILED",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

/**
 * Get HTTP status code for an error code.
 */
export function getHttpStatus(code: ErrorCode): number {
  return ERROR_CODE_TO_HTTP_STATUS[code] ?? 500;
}

/**
 * Derive error code from HTTP status code.
 */
export function deriveErrorCode(status: number): ErrorCode {
  if (status in HTTP_STATUS_TO_ERROR_CODE) {
    return HTTP_STATUS_TO_ERROR_CODE[status];
  }
  return status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST";
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Codes that should NOT be reported to error tracking (expected user errors).
 */
const NON_REPORTABLE_ERROR_CODES = new Set<ErrorCode>([
  "UNAUTHENTICATED",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "PAYMENT_REQUIRED",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "RATE_LIMIT",
]);

/**
 * Check if a string is a valid ErrorCode.
 */
export function isErrorCode(value: string): value is ErrorCode {
  return errorCodeSchema.safeParse(value).success;
}

/**
 * Determine if an error code should be captured/reported to error tracking.
 * Returns false for expected user errors (auth, not found, validation).
 */
export function shouldCaptureAppErrorCode(
  code: ErrorCode | null | undefined,
): boolean {
  return code == null || !NON_REPORTABLE_ERROR_CODES.has(code);
}

/**
 * Safe error messages for client-facing responses.
 * Never exposes internal details.
 */
export const SAFE_ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  INTERNAL_ERROR: "An unexpected error occurred. Please try again later.",
  VALIDATION_ERROR: "The request contains invalid data.",
  NOT_FOUND: "The requested resource was not found.",
  UNAUTHENTICATED: "Authentication is required to access this resource.",
  UNAUTHORIZED: "Authentication is required to access this resource.",
  FORBIDDEN: "You do not have permission to access this resource.",
  RATE_LIMITED: "Too many requests. Please try again later.",
  BAD_REQUEST: "The request could not be processed.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
  PAYMENT_REQUIRED: "Payment is required to access this feature.",
  SUBSCRIPTION_REQUIRED: "A subscription is required to access this feature.",
  QUOTA_EXCEEDED: "You have exceeded your quota. Please upgrade your plan.",
};

/**
 * Get safe, user-facing error message for a code.
 */
export function getSafeErrorMessage(code: ErrorCode): string {
  return SAFE_ERROR_MESSAGES[code] ?? "An error occurred. Please try again.";
}
