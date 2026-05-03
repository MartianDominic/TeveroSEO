/**
 * Standard Error Response Utilities for open-seo-main.
 *
 * FIX HIGH-CONTRACT-01: Unified error response format across all services.
 * FIX MED-CONTRACT-01: Include request_id in all error responses.
 *
 * Standard Error Response Schema:
 * {
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "User-friendly message",
 *     "request_id": "correlation-id",
 *     "details": {}  // optional, only in development
 *   }
 * }
 */

import { getRequest } from "@tanstack/react-start/server";

/**
 * Standard error codes used across all services.
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
 */
export interface StandardError {
  code: ErrorCode;
  message: string;
  request_id?: string;
  details?: Record<string, unknown>;
}

/**
 * Standard error response envelope.
 */
export interface ErrorResponse {
  error: StandardError;
}

/**
 * HTTP status to error code mapping.
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
 * Error code to HTTP status mapping.
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
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Extract request ID from current request context.
 */
export function getRequestId(): string {
  try {
    const request = getRequest();
    const requestId =
      request.headers.get("x-request-id") ||
      request.headers.get("x-correlation-id") ||
      request.headers.get("x-vercel-id") ||
      request.headers.get("cf-ray");

    if (requestId) {
      return requestId;
    }
  } catch {
    // Not in request context
  }

  // Generate new ID
  return crypto.randomUUID();
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

/**
 * Get HTTP status code for an error code.
 */
export function getHttpStatus(code: ErrorCode): number {
  return ERROR_CODE_TO_HTTP_STATUS[code] ?? 500;
}

/**
 * Create a standard error response.
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

  // Only include details in non-production
  if (details && !isProduction()) {
    error.details = details;
  }

  return { error };
}

/**
 * Standard error class that produces consistent error responses.
 *
 * Usage:
 *   throw new StandardAppError("NOT_FOUND", "Resource not found");
 */
export class StandardAppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly requestId: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "StandardAppError";
    this.code = code;
    this.statusCode = getHttpStatus(code);
    this.requestId = getRequestId();
    this.details = details;
  }

  /**
   * Convert to standard error response format.
   */
  toResponse(): ErrorResponse {
    return createErrorResponse(
      this.code,
      this.message,
      this.requestId,
      this.details
    );
  }

  /**
   * Convert to JSON for API responses.
   */
  toJSON(): ErrorResponse {
    return this.toResponse();
  }
}

/**
 * Convenience functions for common error types.
 */
export function notFoundError(
  message: string = "Resource not found"
): StandardAppError {
  return new StandardAppError("NOT_FOUND", message);
}

export function validationError(
  message: string = "Validation failed",
  details?: Record<string, unknown>
): StandardAppError {
  return new StandardAppError("VALIDATION_ERROR", message, details);
}

export function unauthorizedError(
  message: string = "Authentication required"
): StandardAppError {
  return new StandardAppError("UNAUTHORIZED", message);
}

export function forbiddenError(
  message: string = "Access denied"
): StandardAppError {
  return new StandardAppError("FORBIDDEN", message);
}

export function rateLimitError(
  message: string = "Rate limit exceeded. Please try again later."
): StandardAppError {
  return new StandardAppError("RATE_LIMITED", message);
}

export function internalError(
  message: string = "An internal error occurred. Please try again.",
  details?: Record<string, unknown>
): StandardAppError {
  return new StandardAppError("INTERNAL_ERROR", message, details);
}

export function conflictError(
  message: string = "Resource conflict"
): StandardAppError {
  return new StandardAppError("CONFLICT", message);
}

export function badRequestError(
  message: string = "Invalid request"
): StandardAppError {
  return new StandardAppError("BAD_REQUEST", message);
}
