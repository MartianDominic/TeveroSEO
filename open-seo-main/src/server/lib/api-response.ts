/**
 * Standardized API Response Utilities
 * Ensures consistent response envelope format across all routes.
 *
 * Standard envelope: { success: boolean, data?: T, error?: string, details?: any }
 *
 * This module provides convenience wrappers for common HTTP response patterns.
 * For basic success/error responses, see also: ./response.ts
 */

import { ZodError } from "zod";

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
