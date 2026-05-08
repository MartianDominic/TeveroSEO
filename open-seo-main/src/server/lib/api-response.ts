/**
 * Standardized API Response Utilities
 * Ensures consistent response envelope format across all routes.
 *
 * DUP-007 FIX: This is the canonical error formatting module.
 * All API routes should use these utilities for consistent error responses.
 *
 * Standard envelope: { success: boolean, data?: T, error?: string, details?: any }
 *
 * Enhanced envelope (with request ID):
 * {
 *   success: boolean,
 *   data?: T,
 *   error?: { code: string, message: string, requestId?: string, details?: any }
 * }
 *
 * This module provides convenience wrappers for common HTTP response patterns.
 * For basic success/error responses, see also: ./response.ts
 */

import { ZodError } from "zod";
import { randomUUID } from "crypto";

/**
 * Standard error codes used across all API routes.
 */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Generate a request ID for correlation.
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Create a success response with data
 */
export function successResponse<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

/**
 * Create a created response (201)
 */
export function createdResponse<T>(data: T): Response {
  return Response.json({ success: true, data }, { status: 201 });
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  status = 400,
  details?: unknown
): Response {
  const body: { success: false; error: string; details?: unknown } = {
    success: false,
    error,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return Response.json(body, { status });
}

/**
 * Create a validation error response from Zod error
 */
export function validationErrorResponse(zodError: ZodError): Response {
  return Response.json(
    {
      success: false,
      error: "Validation failed",
      details: zodError.flatten(),
    },
    { status: 400 }
  );
}

/**
 * Create a not found response
 */
export function notFoundResponse(resource = "Resource"): Response {
  return Response.json(
    { success: false, error: `${resource} not found` },
    { status: 404 }
  );
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message = "Unauthorized"): Response {
  return Response.json(
    { success: false, error: message },
    { status: 401 }
  );
}

/**
 * Create a forbidden response
 */
export function forbiddenResponse(message = "Access denied"): Response {
  return Response.json(
    { success: false, error: message },
    { status: 403 }
  );
}

/**
 * Create a method not allowed response
 */
export function methodNotAllowedResponse(): Response {
  return Response.json(
    { success: false, error: "Method not allowed" },
    { status: 405 }
  );
}

/**
 * Create an internal server error response
 */
export function internalErrorResponse(
  message = "Internal server error"
): Response {
  return Response.json(
    { success: false, error: message },
    { status: 500 }
  );
}

// ============================================================================
// DUP-007 FIX: Enhanced Error Response Utilities with Request ID & Error Codes
// ============================================================================

/**
 * Enhanced API error structure with error code and request ID.
 */
export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

/**
 * Create a structured API error response with error code and optional request ID.
 *
 * @param code - Standard error code from ErrorCodes
 * @param message - Human-readable error message
 * @param requestId - Optional request ID for correlation
 * @param details - Optional additional error details
 * @returns Response with structured error body
 *
 * @example
 * return formatApiError(
 *   ErrorCodes.VALIDATION_ERROR,
 *   "Invalid date format",
 *   req.headers.get("x-request-id") ?? generateRequestId(),
 *   { field: "startDate", expected: "YYYY-MM-DD" }
 * );
 */
export function formatApiError(
  code: ErrorCode,
  message: string,
  requestId?: string,
  details?: unknown
): ApiError {
  const error: ApiError["error"] = {
    code,
    message,
  };

  if (requestId) {
    error.requestId = requestId;
  }

  if (details !== undefined) {
    error.details = details;
  }

  return {
    success: false,
    error,
  };
}

/**
 * Error code to HTTP status mapping.
 */
const ERROR_CODE_TO_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
};

/**
 * Create a Response with structured API error.
 *
 * @param code - Standard error code
 * @param message - Human-readable error message
 * @param requestId - Optional request ID for correlation
 * @param details - Optional additional error details
 * @returns Response object ready to return from route handler
 *
 * @example
 * // In a route handler
 * if (!client) {
 *   return apiErrorResponse(ErrorCodes.NOT_FOUND, "Client not found", requestId);
 * }
 */
export function apiErrorResponse(
  code: ErrorCode,
  message: string,
  requestId?: string,
  details?: unknown
): Response {
  const status = ERROR_CODE_TO_STATUS[code];
  const body = formatApiError(code, message, requestId, details);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (requestId) {
    headers["X-Request-Id"] = requestId;
  }

  return Response.json(body, { status, headers });
}

/**
 * Format a Zod validation error into structured API error.
 *
 * @param zodError - Zod error from validation
 * @param requestId - Optional request ID
 * @returns Response with structured validation error
 */
export function formatZodValidationError(
  zodError: ZodError,
  requestId?: string
): Response {
  // Zod 4 uses .issues, but we support both for backwards compatibility
  const issues = "issues" in zodError ? zodError.issues : (zodError as { errors?: unknown[] }).errors ?? [];
  const details = Array.isArray(issues)
    ? issues.map((e: { path?: (string | number)[]; message?: string }) => ({
        path: e.path?.join(".") || "body",
        message: e.message || "Invalid value",
      }))
    : zodError.flatten();

  return apiErrorResponse(
    ErrorCodes.VALIDATION_ERROR,
    "Request validation failed",
    requestId,
    details
  );
}

/**
 * Create a rate limit error response with Retry-After header.
 *
 * @param retryAfterSeconds - Seconds until the client can retry
 * @param requestId - Optional request ID
 * @returns Response with rate limit error and Retry-After header
 */
export function rateLimitErrorResponse(
  retryAfterSeconds: number,
  requestId?: string
): Response {
  const body = formatApiError(
    ErrorCodes.RATE_LIMITED,
    `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`,
    requestId,
    { retryAfter: retryAfterSeconds }
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Retry-After": String(retryAfterSeconds),
  };

  if (requestId) {
    headers["X-Request-Id"] = requestId;
  }

  return Response.json(body, { status: 429, headers });
}
