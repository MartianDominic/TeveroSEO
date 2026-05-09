/**
 * Standard API Response Types and Helpers
 *
 * FIX CRIT-TYPE-01: Provides runtime type safety for API responses
 * FIX HIGH-API-01: Defines consistent response envelope pattern
 *
 * This module provides a unified API response format that works across:
 * - Next.js App Router (Response.json)
 * - Next.js API Routes (NextResponse)
 * - Express.js routes (res.json)
 *
 * Standard Response Envelope:
 * ```json
 * {
 *   "success": true,
 *   "data": T,
 *   "meta": { "total": 100, "page": 1, "limit": 10 }
 * }
 * ```
 *
 * Error Response Envelope:
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "User not found",
 *     "details": { "userId": "123" }
 *   }
 * }
 * ```
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Standard API error structure.
 * Machine-readable code + human-readable message + optional details.
 */
export interface ApiError {
  /** Machine-readable error code (e.g., "NOT_FOUND", "VALIDATION_ERROR") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional additional error details */
  details?: Record<string, unknown>;
}

/**
 * Standard API response envelope.
 * All API responses should use this format for consistency.
 */
export interface ApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data (present on success) */
  data?: T;
  /** Error details (present on failure) */
  error?: ApiError;
  /** Pagination metadata (for list responses) */
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
  /** ISO timestamp of response (optional, useful for debugging) */
  timestamp?: string;
}

/**
 * Pagination metadata for list responses.
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore?: boolean;
}

// =============================================================================
// Standard Error Codes
// =============================================================================

/**
 * Standard error codes used across all APIs.
 * Use these for consistent error handling.
 */
export const API_ERROR_CODES = {
  // Client errors (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",

  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * Map error codes to HTTP status codes.
 */
export const ERROR_CODE_HTTP_STATUS: Record<ApiErrorCode, number> = {
  [API_ERROR_CODES.BAD_REQUEST]: 400,
  [API_ERROR_CODES.VALIDATION_ERROR]: 422,
  [API_ERROR_CODES.UNAUTHORIZED]: 401,
  [API_ERROR_CODES.FORBIDDEN]: 403,
  [API_ERROR_CODES.NOT_FOUND]: 404,
  [API_ERROR_CODES.CONFLICT]: 409,
  [API_ERROR_CODES.RATE_LIMITED]: 429,
  [API_ERROR_CODES.INTERNAL_ERROR]: 500,
  [API_ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [API_ERROR_CODES.TIMEOUT]: 504,
};

// =============================================================================
// Response Factory Functions (Framework-Agnostic)
// =============================================================================

/**
 * Create a successful API response object.
 * Use with any framework: Response.json(), NextResponse.json(), res.json()
 *
 * @param data - The response data
 * @param meta - Optional pagination metadata
 * @returns Standardized success response object
 *
 * @example
 * ```ts
 * // Next.js App Router
 * return Response.json(successResponse(users, { total: 100, page: 1, limit: 10 }));
 *
 * // Express.js
 * res.json(successResponse(users, { total: 100, page: 1, limit: 10 }));
 * ```
 */
export function successResponse<T>(
  data: T,
  meta?: ApiResponse<T>["meta"]
): ApiResponse<T> {
  return { success: true, data, meta };
}

/**
 * Create a paginated success response.
 * Convenience wrapper for list endpoints.
 *
 * @param data - The response data array
 * @param pagination - Pagination info (total, page, limit)
 * @returns Standardized paginated response object
 *
 * @example
 * ```ts
 * return Response.json(paginatedResponse(users, { total: 100, page: 1, limit: 10 }));
 * ```
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: { total: number; page: number; limit: number }
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    meta: {
      ...pagination,
      hasMore: pagination.page * pagination.limit < pagination.total,
    },
  };
}

/**
 * Create an error API response object.
 * Use with any framework: Response.json(), NextResponse.json(), res.json()
 *
 * @param code - Machine-readable error code (use API_ERROR_CODES)
 * @param message - User-friendly error message
 * @param details - Optional additional error details
 * @returns Standardized error response object
 *
 * @example
 * ```ts
 * // Next.js App Router
 * return Response.json(
 *   errorResponse("NOT_FOUND", "User not found"),
 *   { status: 404 }
 * );
 *
 * // Express.js
 * res.status(404).json(errorResponse("NOT_FOUND", "User not found"));
 * ```
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details },
  };
}

/**
 * Create a validation error response.
 * Use for Zod or other schema validation failures.
 *
 * @param issues - Array of validation issues
 * @returns Standardized validation error response
 *
 * @example
 * ```ts
 * const result = schema.safeParse(body);
 * if (!result.success) {
 *   return Response.json(
 *     validationErrorResponse(result.error.issues.map(i => ({
 *       field: i.path.join('.'),
 *       message: i.message
 *     }))),
 *     { status: 422 }
 *   );
 * }
 * ```
 */
export function validationErrorResponse(
  issues: Array<{ field: string; message: string; code?: string }>
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: "Validation failed",
      details: { issues },
    },
  };
}

/**
 * Type guard to check if an API response is successful.
 *
 * @param response - The API response to check
 * @returns true if the response indicates success
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard to check if an API response is an error.
 *
 * @param response - The API response to check
 * @returns true if the response indicates an error
 */
export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { error: NonNullable<ApiResponse<T>["error"]> } {
  return response.success === false && response.error !== undefined;
}

/**
 * Helper to safely handle unknown errors in catch blocks.
 * Converts any error to a message string without assuming type.
 *
 * FIX MED-TYPE-01: Proper error handling in catch blocks
 *
 * @param error - The caught error (unknown type)
 * @returns A safe error message string
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const message = getErrorMessage(error);
 *   logger.error(message);
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error object";
    }
  }
  return "Unknown error";
}

/**
 * Helper to get error stack trace safely.
 *
 * @param error - The caught error (unknown type)
 * @returns The stack trace or undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

// =============================================================================
// Express.js Helpers
// =============================================================================

/**
 * Express response helper type.
 * Use this for typing Express response objects.
 */
export interface ExpressResponseHelpers {
  /**
   * Send a success response.
   * Sets status 200 and returns standardized envelope.
   */
  success: <T>(data: T, meta?: ApiResponse<T>["meta"]) => void;

  /**
   * Send a created response (201).
   */
  created: <T>(data: T) => void;

  /**
   * Send an accepted response (202) for async operations.
   */
  accepted: <T>(data: T) => void;

  /**
   * Send a no content response (204).
   */
  noContent: () => void;

  /**
   * Send an error response with appropriate status code.
   */
  error: (code: ApiErrorCode, message: string, details?: Record<string, unknown>) => void;

  /**
   * Send a validation error response (422).
   */
  validationError: (issues: Array<{ field: string; message: string }>) => void;
}

/**
 * Create Express response helpers.
 * Wraps an Express response object with standardized methods.
 *
 * @param res - Express Response object
 * @returns Helper methods for standardized responses
 *
 * @example
 * ```ts
 * router.get('/users', (req, res) => {
 *   const api = createExpressHelpers(res);
 *   try {
 *     const users = await getUsers();
 *     api.success(users, { total: 100, page: 1, limit: 10 });
 *   } catch (err) {
 *     api.error('INTERNAL_ERROR', 'Failed to fetch users');
 *   }
 * });
 * ```
 */
export function createExpressHelpers(res: {
  status: (code: number) => { json: (body: unknown) => void; end: () => void };
  json: (body: unknown) => void;
}): ExpressResponseHelpers {
  return {
    success: <T>(data: T, meta?: ApiResponse<T>["meta"]) => {
      res.json(successResponse(data, meta));
    },

    created: <T>(data: T) => {
      res.status(201).json(successResponse(data));
    },

    accepted: <T>(data: T) => {
      res.status(202).json(successResponse(data));
    },

    noContent: () => {
      res.status(204).end();
    },

    error: (code: ApiErrorCode, message: string, details?: Record<string, unknown>) => {
      const status = ERROR_CODE_HTTP_STATUS[code] ?? 500;
      res.status(status).json(errorResponse(code, message, details));
    },

    validationError: (issues: Array<{ field: string; message: string }>) => {
      res.status(422).json(validationErrorResponse(issues));
    },
  };
}
