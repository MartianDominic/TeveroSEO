/**
 * Standard API Response Types and Helpers
 *
 * FIX CRIT-TYPE-01: Provides runtime type safety for API responses
 * FIX HIGH-API-01: Defines consistent response envelope pattern
 *
 * Usage:
 * - All API endpoints should return responses wrapped with successResponse() or errorResponse()
 * - External API responses should be validated with Zod schemas using safeParse
 */

/**
 * Standard API response envelope.
 * All successful API responses should use this format.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
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

/**
 * Create a successful API response.
 *
 * @param data - The response data
 * @param meta - Optional pagination metadata
 * @returns Standardized success response
 *
 * @example
 * ```ts
 * return Response.json(successResponse(users, { total: 100, page: 1, limit: 10 }));
 * ```
 */
export function successResponse<T>(
  data: T,
  meta?: ApiResponse<T>["meta"]
): ApiResponse<T> {
  return { success: true, data, meta };
}

/**
 * Create an error API response.
 *
 * @param message - User-friendly error message
 * @param code - Machine-readable error code
 * @param details - Optional additional error details
 * @returns Standardized error response
 *
 * @example
 * ```ts
 * return Response.json(errorResponse("User not found", "NOT_FOUND"), { status: 404 });
 * ```
 */
export function errorResponse(
  message: string,
  code: string,
  details?: Record<string, unknown>
): ApiResponse<never> {
  return {
    success: false,
    error: { message, code, details },
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
