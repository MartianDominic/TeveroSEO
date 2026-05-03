/**
 * Standardized API Response Helpers
 * Phase 68-03: API Contract Alignment
 *
 * All API endpoints should use these helpers for consistent response format:
 * - Success: { success: true, data: T }
 * - Error: { success: false, error: { message, code, details } }
 */

interface ErrorDetails {
  code?: string;
  field?: string;
  details?: unknown;
}

interface ApiResponseBody<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Create a successful API response.
 *
 * @param data - The response data
 * @returns Response object with JSON body
 *
 * @example
 * ```ts
 * return successResponse({ id: '123', name: 'Test' });
 * ```
 */
export function successResponse<T>(data: T): Response {
  const body: ApiResponseBody<T> = { success: true, data };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create an error API response.
 *
 * @param status - HTTP status code
 * @param message - User-friendly error message
 * @param details - Optional error details (code, field, additional info)
 * @returns Response object with JSON body
 *
 * @example
 * ```ts
 * return errorResponse(400, 'Validation failed', { code: 'VALIDATION_ERROR', details: errors });
 * return errorResponse(404, 'Webhook not found', { code: 'NOT_FOUND' });
 * return errorResponse(409, 'Version conflict', { code: 'VERSION_MISMATCH' });
 * ```
 */
export function errorResponse(
  status: number,
  message: string,
  details?: ErrorDetails
): Response {
  const body: ApiResponseBody<never> = {
    success: false,
    error: {
      message,
      code: details?.code,
      details: details?.details,
    },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Type guard to check if a response body is successful.
 */
export function isSuccessResponse<T>(
  body: ApiResponseBody<T>
): body is ApiResponseBody<T> & { data: T } {
  return body.success === true && body.data !== undefined;
}

/**
 * Type guard to check if a response body is an error.
 */
export function isErrorResponse<T>(
  body: ApiResponseBody<T>
): body is ApiResponseBody<T> & {
  error: NonNullable<ApiResponseBody<T>["error"]>;
} {
  return body.success === false && body.error !== undefined;
}
