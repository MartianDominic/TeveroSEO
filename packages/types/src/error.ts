/**
 * Standardized Error Response Types
 *
 * FIX HIGH-CONTRACT-01: Unified error response format across all services.
 * FIX HIGH-CONTRACT-02: Standardize AI-Writer to use {"error": {...}} format.
 * FIX MED-CONTRACT-01: Include request_id in all error responses.
 *
 * Schema:
 * {
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "User-friendly message",
 *     "request_id": "correlation-id",
 *     "details": {} // optional, only in development
 *   }
 * }
 */

/**
 * Standard error codes used across all services.
 * Use these codes for programmatic error handling.
 */
export type ErrorCode =
  // Client errors (4xx)
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  // Server errors (5xx)
  | "INTERNAL_ERROR"
  | "BAD_GATEWAY"
  | "SERVICE_UNAVAILABLE"
  | "GATEWAY_TIMEOUT"
  // Domain-specific errors
  | "SUBSCRIPTION_REQUIRED"
  | "QUOTA_EXCEEDED"
  | "RESOURCE_LOCKED"
  | "DUPLICATE_ENTRY"
  | "INVALID_STATE"
  | "DEPENDENCY_FAILED"
  // Legacy compatibility
  | "LEGACY_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Standard error response structure.
 * All services MUST return errors in this format.
 */
export interface StandardError {
  /** Machine-readable error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable error message (safe for display to users) */
  message: string;
  /** Request/correlation ID for debugging and log correlation */
  request_id?: string;
  /** Additional error details (only included in development mode) */
  details?: Record<string, unknown>;
}

/**
 * Standard error response envelope.
 * All error responses MUST use this structure.
 */
export interface ErrorResponse {
  error: StandardError;
}

/**
 * HTTP status code to error code mapping.
 * Use this when converting HTTP errors to standard error codes.
 */
export const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

/**
 * Error code to HTTP status code mapping.
 * Use this when converting error codes to HTTP responses.
 */
export const ERROR_CODE_TO_HTTP_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  SUBSCRIPTION_REQUIRED: 402,
  QUOTA_EXCEEDED: 429,
  RESOURCE_LOCKED: 423,
  DUPLICATE_ENTRY: 409,
  INVALID_STATE: 409,
  DEPENDENCY_FAILED: 424,
  LEGACY_ERROR: 500,
  UNKNOWN_ERROR: 500,
};

/**
 * Check if running in production mode.
 * Works in both Node.js and browser environments.
 */
function isProduction(): boolean {
  // Check for globalThis.process (Node.js)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = typeof globalThis !== "undefined" ? (globalThis as any).process : undefined;
  if (proc?.env?.NODE_ENV === "production") {
    return true;
  }
  // Check for import.meta.env (Vite)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = typeof import.meta !== "undefined" ? (import.meta as any).env : undefined;
  if (meta?.PROD || meta?.MODE === "production") {
    return true;
  }
  return false;
}

/**
 * Create a standard error response.
 *
 * @param code - Error code
 * @param message - User-friendly error message
 * @param requestId - Request/correlation ID for tracing
 * @param details - Additional details (only included if not in production)
 * @returns Standard error response object
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
): ErrorResponse {
  const error: StandardError = {
    code,
    message,
  };

  if (requestId) {
    error.request_id = requestId;
  }

  // Only include details in non-production environments
  if (details && !isProduction()) {
    error.details = details;
  }

  return { error };
}

/**
 * Derive error code from HTTP status code.
 *
 * @param status - HTTP status code
 * @returns Corresponding error code
 */
export function deriveErrorCode(status: number): ErrorCode {
  if (status in HTTP_STATUS_TO_ERROR_CODE) {
    return HTTP_STATUS_TO_ERROR_CODE[status];
  }
  return status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST";
}

/**
 * Get HTTP status code for an error code.
 *
 * @param code - Error code
 * @returns Corresponding HTTP status code
 */
export function getHttpStatus(code: ErrorCode): number {
  return ERROR_CODE_TO_HTTP_STATUS[code] ?? 500;
}
