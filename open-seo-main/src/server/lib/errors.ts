/**
 * Unified AppError for open-seo-main.
 *
 * CONSOLIDATION: This module now provides all error handling functionality
 * previously split across errors.ts and standard-error.ts:
 * - AppError class with HTTP status and request ID
 * - Error response formatting
 * - Convenience factory functions
 *
 * Usage:
 *   throw new AppError("NOT_FOUND", "User not found");
 *   throw AppError.notFound("User not found");
 */

import { getRequest } from "@tanstack/react-start/server";
import {
  isErrorCode,
  getHttpStatus,
  getSafeErrorMessage,
  type ErrorCode,
} from "@/shared/error-codes";

// Re-export ErrorCode and related utilities for convenience
export { type ErrorCode } from "@/shared/error-codes";
export {
  isErrorCode,
  getHttpStatus,
  deriveErrorCode,
  getSafeErrorMessage,
  ERROR_CODE_TO_HTTP_STATUS,
  HTTP_STATUS_TO_ERROR_CODE,
  shouldCaptureAppErrorCode,
} from "@/shared/error-codes";

// =============================================================================
// Request ID Extraction
// =============================================================================

/**
 * Extract request ID from current request context.
 * Falls back to generating a new UUID if not in request context.
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

// =============================================================================
// Standard Error Response Types
// =============================================================================

/**
 * Standard error response structure for API responses.
 */
export interface StandardErrorResponse {
  code: ErrorCode;
  message: string;
  request_id?: string;
  details?: Record<string, unknown>;
}

/**
 * Standard error response envelope.
 */
export interface ErrorResponse {
  error: StandardErrorResponse;
}

// =============================================================================
// AppError Class
// =============================================================================

/**
 * Check if running in production mode.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Application error with HTTP status code and request ID.
 *
 * Unified error class replacing both AppError and StandardAppError.
 * Provides consistent error responses across all services.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly requestId: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.statusCode = getHttpStatus(code);
    this.requestId = getRequestId();
    this.details = details;
  }

  /**
   * Convert to standard error response format.
   */
  toResponse(): ErrorResponse {
    const error: StandardErrorResponse = {
      code: this.code,
      message: this.message,
    };

    if (this.requestId) {
      error.request_id = this.requestId;
    }

    // Only include details in non-production
    if (this.details && !isProduction()) {
      error.details = this.details;
    }

    return { error };
  }

  /**
   * Convert to JSON for API responses.
   */
  toJSON(): ErrorResponse {
    return this.toResponse();
  }

  // ===========================================================================
  // Static Factory Methods (convenience functions from standard-error.ts)
  // ===========================================================================

  static badRequest(message = "Invalid request"): AppError {
    return new AppError("BAD_REQUEST", message);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError("UNAUTHORIZED", message);
  }

  static forbidden(message = "Access denied"): AppError {
    return new AppError("FORBIDDEN", message);
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError("NOT_FOUND", message);
  }

  static conflict(message = "Resource conflict"): AppError {
    return new AppError("CONFLICT", message);
  }

  static validation(message = "Validation failed", details?: Record<string, unknown>): AppError {
    return new AppError("VALIDATION_ERROR", message, details);
  }

  static rateLimited(message = "Rate limit exceeded. Please try again later."): AppError {
    return new AppError("RATE_LIMITED", message);
  }

  static internal(message = "An internal error occurred. Please try again.", details?: Record<string, unknown>): AppError {
    return new AppError("INTERNAL_ERROR", message, details);
  }

  static serviceUnavailable(message = "Service temporarily unavailable"): AppError {
    return new AppError("SERVICE_UNAVAILABLE", message);
  }
}

// =============================================================================
// Error Conversion Utilities
// =============================================================================

/**
 * Convert unknown error to AppError if possible.
 */
export function asAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  if (error instanceof Error && isErrorCode(error.message)) {
    return new AppError(error.message, error.message);
  }
  return null;
}

/**
 * Extract error code from unknown error.
 */
function toErrorCode(error: unknown): ErrorCode {
  return asAppError(error)?.code ?? "INTERNAL_ERROR";
}

/**
 * Convert error to client-safe error (strips internal details).
 */
export function toClientError(error: unknown): Error {
  const appError = asAppError(error);
  return new Error(appError?.code ?? toErrorCode(error));
}

/**
 * Create a standard error response from components.
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
): ErrorResponse {
  const error: StandardErrorResponse = {
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

// =============================================================================
// Legacy Compatibility: Convenience Functions (from standard-error.ts)
// =============================================================================

/** @deprecated Use AppError.notFound() instead */
export function notFoundError(message = "Resource not found"): AppError {
  return AppError.notFound(message);
}

/** @deprecated Use AppError.validation() instead */
export function validationError(message = "Validation failed", details?: Record<string, unknown>): AppError {
  return AppError.validation(message, details);
}

/** @deprecated Use AppError.unauthorized() instead */
export function unauthorizedError(message = "Authentication required"): AppError {
  return AppError.unauthorized(message);
}

/** @deprecated Use AppError.forbidden() instead */
export function forbiddenError(message = "Access denied"): AppError {
  return AppError.forbidden(message);
}

/** @deprecated Use AppError.rateLimited() instead */
export function rateLimitError(message = "Rate limit exceeded. Please try again later."): AppError {
  return AppError.rateLimited(message);
}

/** @deprecated Use AppError.internal() instead */
export function internalError(message = "An internal error occurred. Please try again.", details?: Record<string, unknown>): AppError {
  return AppError.internal(message, details);
}

/** @deprecated Use AppError.conflict() instead */
export function conflictError(message = "Resource conflict"): AppError {
  return AppError.conflict(message);
}

/** @deprecated Use AppError.badRequest() instead */
export function badRequestError(message = "Invalid request"): AppError {
  return AppError.badRequest(message);
}
