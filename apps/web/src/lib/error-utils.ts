/**
 * Error handling utilities for safe client-side error exposure.
 *
 * FIX HIGH-CONTRACT-01: Unified error response format across all services.
 * FIX MED-CONTRACT-01: Include request_id in all error responses.
 *
 * SECURITY: Never expose raw error messages to clients in production.
 * Internal errors may leak sensitive information (stack traces, file paths,
 * database details, etc.)
 */

import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * Standard error codes used across all services.
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "BAD_GATEWAY"
  | "SERVICE_UNAVAILABLE"
  | "GATEWAY_TIMEOUT"
  | "SUBSCRIPTION_REQUIRED"
  | "QUOTA_EXCEEDED"
  | "RESOURCE_LOCKED"
  | "DUPLICATE_ENTRY"
  | "INVALID_STATE"
  | "DEPENDENCY_FAILED"
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
 * Check if we're in development mode.
 * Useful for conditionally showing debug information.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
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
 * Create a standard error response object.
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
  if (details && isDevelopment()) {
    error.details = details;
  }

  return { error };
}

/**
 * Create a NextResponse with standard error format.
 *
 * FIX HIGH-CONTRACT-01: Use this for all API route error responses.
 */
export function createErrorJsonResponse(
  code: ErrorCode,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
): NextResponse {
  const status = getHttpStatus(code);
  const body = createErrorResponse(code, message, requestId, details);

  const headers: Record<string, string> = {};
  if (requestId) {
    headers['X-Request-Id'] = requestId;
  }

  return NextResponse.json(body, { status, headers });
}

/**
 * Sanitize an error for safe client exposure.
 * In development, returns the actual error message for debugging.
 * In production, returns a generic message to prevent information leakage.
 */
export function sanitizeErrorForClient(error: unknown): string {
  // In development, show actual error for debugging
  if (isDevelopment()) {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  // Production: return generic messages to prevent information leakage
  return 'An error occurred. Please try again.';
}

/**
 * Log an error with structured context for debugging/monitoring.
 * In production, this should integrate with error tracking (Sentry, etc.)
 */
export function logError(context: string, error: unknown, requestId?: string): void {
  logger.error(`[${context}]${requestId ? ` [${requestId}]` : ''}`, {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    requestId,
  });
}

/**
 * Generate a request ID for correlation.
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Convenience error response creators.
 */
export function notFoundResponse(
  message: string = "Resource not found",
  requestId?: string
): NextResponse {
  return createErrorJsonResponse("NOT_FOUND", message, requestId);
}

export function validationErrorResponse(
  message: string = "Validation failed",
  requestId?: string,
  details?: Record<string, unknown>
): NextResponse {
  return createErrorJsonResponse("VALIDATION_ERROR", message, requestId, details);
}

export function unauthorizedResponse(
  message: string = "Authentication required",
  requestId?: string
): NextResponse {
  return createErrorJsonResponse("UNAUTHORIZED", message, requestId);
}

export function forbiddenResponse(
  message: string = "Access denied",
  requestId?: string
): NextResponse {
  return createErrorJsonResponse("FORBIDDEN", message, requestId);
}

export function rateLimitResponse(
  message: string = "Rate limit exceeded. Please try again later.",
  requestId?: string,
  retryAfter?: number
): NextResponse {
  const response = createErrorJsonResponse("RATE_LIMITED", message, requestId);
  if (retryAfter) {
    response.headers.set('Retry-After', String(retryAfter));
  }
  return response;
}

export function internalErrorResponse(
  message: string = "An internal error occurred. Please try again.",
  requestId?: string,
  details?: Record<string, unknown>
): NextResponse {
  return createErrorJsonResponse("INTERNAL_ERROR", message, requestId, details);
}

export function badRequestResponse(
  message: string = "Invalid request",
  requestId?: string
): NextResponse {
  return createErrorJsonResponse("BAD_REQUEST", message, requestId);
}

/**
 * Safely parse JSON from a Response object.
 *
 * FIX HIGH-ERR-04: Use this instead of response.json().catch(() => ({}))
 * to properly log parse failures while returning a typed fallback.
 *
 * @param response - The fetch Response to parse
 * @param fallback - Value to return if parsing fails (defaults to empty object)
 * @param context - Optional context string for error logging
 * @returns Parsed JSON or fallback value
 */
export async function safeParseJson<T = Record<string, unknown>>(
  response: Response,
  fallback: T = {} as T,
  context?: string
): Promise<T> {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    if (context) {
      logger.warn(`[${context}] Failed to parse JSON response`, {
        status: response.status,
        url: response.url,
        error: error instanceof Error ? error.message : 'Unknown parse error',
      });
    }
    return fallback;
  }
}

/**
 * Extract error message from a response body.
 *
 * Handles multiple error response formats:
 * - { error: { message: "..." } } - Standard format
 * - { error: "..." } - Simple string error
 * - { message: "..." } - Legacy format
 *
 * @param body - Parsed response body
 * @param defaultMessage - Default message if none found
 */
export function extractErrorMessage(
  body: Record<string, unknown>,
  defaultMessage: string = "An error occurred"
): string {
  // Standard format: { error: { message: "..." } }
  if (typeof body.error === 'object' && body.error !== null) {
    const errorObj = body.error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') {
      return errorObj.message;
    }
  }

  // Simple format: { error: "..." }
  if (typeof body.error === 'string') {
    return body.error;
  }

  // Legacy format: { message: "..." }
  if (typeof body.message === 'string') {
    return body.message;
  }

  return defaultMessage;
}
