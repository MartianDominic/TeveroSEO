/**
 * Standardized API Response Utilities
 *
 * FIX-20: Code Quality & Cleanup
 * M-QUAL-01: Status code standardization (400 vs 422)
 * M-QUAL-03: Consistent error response format
 *
 * Standard status codes:
 * - 400: Bad Request - malformed JSON, missing required fields
 * - 422: Unprocessable Entity - validation errors (schema validation failed)
 * - 401: Unauthorized - missing or invalid auth
 * - 403: Forbidden - insufficient permissions
 * - 404: Not Found - resource doesn't exist
 * - 429: Too Many Requests - rate limit exceeded
 * - 500: Internal Server Error - unexpected server error
 */
import { NextResponse } from "next/server";

import type { ZodError, ZodIssue } from "zod";

/**
 * Standard error response format.
 * All API errors should use this envelope for consistency.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Standard success response format.
 */
export interface ApiSuccessResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

/**
 * Error codes for standard API errors.
 */
export const ERROR_CODES = {
  // Client errors (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",

  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Create a 400 Bad Request response.
 * Use for malformed JSON, missing required headers, etc.
 *
 * @example
 * ```ts
 * return badRequest("Invalid JSON body");
 * ```
 */
export function badRequest(message: string, details?: Record<string, unknown>): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.BAD_REQUEST,
        message,
        details,
      },
    },
    { status: 400 }
  );
}

/**
 * Create a 422 Unprocessable Entity response.
 * Use for validation errors from Zod or other schema validators.
 *
 * @example
 * ```ts
 * const result = schema.safeParse(body);
 * if (!result.success) {
 *   return validationError(result.error);
 * }
 * ```
 */
export function validationError(zodError: ZodError<unknown>): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Validation failed",
        details: {
          issues: formatZodIssues(zodError.issues),
        },
      },
    },
    { status: 422 }
  );
}

/**
 * Create a 422 Unprocessable Entity response with custom message.
 * Use when validation fails but you have a specific error message.
 *
 * @example
 * ```ts
 * return validationErrorMessage("Email domain is not allowed");
 * ```
 */
export function validationErrorMessage(
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message,
        details,
      },
    },
    { status: 422 }
  );
}

/**
 * Create a 401 Unauthorized response.
 * Use when authentication is required but missing or invalid.
 *
 * @example
 * ```ts
 * return unauthorized("Authentication required");
 * ```
 */
export function unauthorized(message = "Unauthorized"): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message,
      },
    },
    { status: 401 }
  );
}

/**
 * Create a 403 Forbidden response.
 * Use when user is authenticated but doesn't have permission.
 *
 * @example
 * ```ts
 * return forbidden("Access denied to this resource");
 * ```
 */
export function forbidden(message = "Forbidden"): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message,
      },
    },
    { status: 403 }
  );
}

/**
 * Create a 404 Not Found response.
 *
 * @example
 * ```ts
 * return notFound("Client not found");
 * ```
 */
export function notFound(message = "Not found"): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message,
      },
    },
    { status: 404 }
  );
}

/**
 * Create a 429 Too Many Requests response.
 *
 * @example
 * ```ts
 * return rateLimited("Rate limit exceeded", 60);
 * ```
 */
export function rateLimited(
  message = "Too many requests",
  retryAfterSeconds?: number
): NextResponse<ApiErrorResponse> {
  const headers: Record<string, string> = {};
  if (retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }

  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message,
        details: retryAfterSeconds ? { retryAfter: retryAfterSeconds } : undefined,
      },
    },
    { status: 429, headers }
  );
}

/**
 * Create a 409 Conflict response.
 * Use when the request conflicts with current state (e.g., duplicate entry).
 *
 * @example
 * ```ts
 * return conflict("Client with this domain already exists");
 * ```
 */
export function conflict(message: string, details?: Record<string, unknown>): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.CONFLICT,
        message,
        details,
      },
    },
    { status: 409 }
  );
}

/**
 * Create a 500 Internal Server Error response.
 * Use for unexpected errors. Never expose internal error details to clients.
 *
 * @example
 * ```ts
 * return internalError();
 * ```
 */
export function internalError(message = "Internal error"): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message,
      },
    },
    { status: 500 }
  );
}

/**
 * Create a 503 Service Unavailable response.
 *
 * @example
 * ```ts
 * return serviceUnavailable("Database connection failed");
 * ```
 */
export function serviceUnavailable(
  message = "Service temporarily unavailable"
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        message,
      },
    },
    { status: 503 }
  );
}

/**
 * Create a success response with optional metadata.
 *
 * @example
 * ```ts
 * return success(data);
 * return success(data, { total: 100, page: 1, limit: 10 });
 * ```
 */
export function success<T>(
  data: T,
  meta?: ApiSuccessResponse<T>["meta"]
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = { data };
  if (meta) {
    response.meta = meta;
  }
  return NextResponse.json(response);
}

/**
 * Create a 201 Created response for successful resource creation.
 *
 * @example
 * ```ts
 * return created(newClient);
 * ```
 */
export function created<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * Create a 202 Accepted response for async operations.
 *
 * @example
 * ```ts
 * return accepted({ jobId: "123", status: "queued" });
 * ```
 */
export function accepted<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ data }, { status: 202 });
}

/**
 * Create a 204 No Content response for successful deletions.
 *
 * @example
 * ```ts
 * return noContent();
 * ```
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// --- Utility Functions ---

/**
 * Format Zod issues into a consistent structure.
 */
function formatZodIssues(issues: ZodIssue[]): Array<{ field: string; message: string }> {
  return issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Parse JSON body safely and return appropriate response on failure.
 * Returns the parsed data or a BadRequest response.
 *
 * @example
 * ```ts
 * const result = await parseJsonBody<CreateClientInput>(req);
 * if (result instanceof NextResponse) {
 *   return result; // Bad request response
 * }
 * // result is now CreateClientInput
 * ```
 */
export async function parseJsonBody<T>(
  req: Request
): Promise<T | NextResponse<ApiErrorResponse>> {
  try {
    const data = await req.json() as T;
    return data;
  } catch {
    return badRequest("Invalid JSON body");
  }
}

/**
 * Validate data against a Zod schema and return appropriate response on failure.
 *
 * @example
 * ```ts
 * const result = await parseAndValidate(req, createClientSchema);
 * if (result instanceof NextResponse) {
 *   return result; // Validation error response
 * }
 * // result is now the validated data
 * ```
 */
export async function parseAndValidate<T>(
  req: Request,
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: ZodError<unknown> } }
): Promise<T | NextResponse<ApiErrorResponse>> {
  const body = await parseJsonBody<unknown>(req);
  if (body instanceof NextResponse) {
    return body;
  }

  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }

  return validationError(result.error);
}
