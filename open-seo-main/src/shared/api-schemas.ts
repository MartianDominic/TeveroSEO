/**
 * Shared API Contract Schemas
 *
 * Central location for Zod schemas that define API contracts.
 * Used by both API endpoints and clients for validation.
 *
 * HIGH-API-01 FIX: Consistent error response format across services.
 * CRIT-API-01 FIX: Platform-specific credential validation.
 * MEDIUM-04 FIX: Standardized date serialization (ISO 8601).
 */
import { z } from "zod";
import { errorCodeSchema, type ErrorCode } from "./error-codes";

// ============================================================================
// Error Response Schema (HIGH-API-01 FIX)
// ============================================================================

/**
 * Standardized error response format for all API endpoints.
 * All API errors should be normalized to this format.
 */
export const ErrorResponseSchema = z.object({
  /** User-friendly error message (max 200 chars, sanitized) */
  error: z.string().max(200),
  /** Machine-readable error code for programmatic handling */
  code: errorCodeSchema,
  /** HTTP status code (for client reference) */
  status: z.number().int().min(100).max(599).optional(),
  /** Request correlation ID for tracing */
  correlationId: z.string().uuid().optional(),
  /** Validation error details (only for VALIDATION_ERROR code) */
  details: z.array(z.object({
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
  })).optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Create a standardized error response.
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  options?: {
    status?: number;
    correlationId?: string;
    details?: Array<{ path: Array<string | number>; message: string }>;
  }
): ErrorResponse {
  return {
    error: message.slice(0, 200),
    code,
    status: options?.status,
    correlationId: options?.correlationId,
    details: options?.details,
  };
}

/**
 * Create a standardized error Response object.
 * HIGH-API-05 FIX: 422 for validation errors, 400 for malformed requests.
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  options?: {
    correlationId?: string;
    details?: Array<{ path: Array<string | number>; message: string }>;
  }
): Response {
  const status = getStatusCodeForError(code);
  const body = createErrorResponse(code, message, {
    ...options,
    status,
  });

  return Response.json(body, { status });
}

/**
 * Map error codes to HTTP status codes.
 * HIGH-API-05 FIX: Consistent status code mapping.
 */
export function getStatusCodeForError(code: ErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
    case "AUTH_CONFIG_MISSING":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "GONE":
      return 410;
    case "PAYMENT_REQUIRED":
      return 402;
    case "VALIDATION_ERROR":
      return 422; // HIGH-API-05: Use 422 for validation errors
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
    case "RATE_LIMIT":
      return 429;
    case "AUDIT_CAPACITY_REACHED":
    case "BACKLINKS_NOT_ENABLED":
    case "BACKLINKS_BILLING_ISSUE":
    case "CONFIG_ERROR":
      return 400;
    case "SERVICE_UNAVAILABLE":
      return 503;
    case "EXTERNAL_SERVICE_ERROR":
    case "GSC_API_ERROR":
    case "DOKOBIT_API_ERROR":
      return 502;
    case "CRAWL_TARGET_BLOCKED":
      return 403;
    case "CONTRACT_INVALID_STATE":
      return 409;
    default:
      return 500;
  }
}

// ============================================================================
// Pagination Schemas (HIGH-API-04, MEDIUM-01 FIX)
// ============================================================================

/**
 * Cursor-based pagination request parameters.
 * HIGH-API-04 FIX: Consistent pagination across endpoints.
 */
export const PaginationRequestSchema = z.object({
  /** Opaque cursor for next page (signed with HMAC - MEDIUM-01 FIX) */
  cursor: z.string().optional(),
  /** Maximum items per page (default: 20, max: 100) */
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Sort direction */
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationRequest = z.infer<typeof PaginationRequestSchema>;

/**
 * Pagination response metadata.
 */
export const PaginationResponseSchema = z.object({
  /** Total number of items (if countable) */
  total: z.number().int().min(0).optional(),
  /** Cursor for next page (null if no more pages) */
  nextCursor: z.string().nullable(),
  /** Cursor for previous page (null if on first page) */
  prevCursor: z.string().nullable().optional(),
  /** Current page size */
  limit: z.number().int().min(1).max(100),
  /** Whether there are more pages */
  hasMore: z.boolean(),
});

export type PaginationResponse = z.infer<typeof PaginationResponseSchema>;

// ============================================================================
// Date/Time Schemas (MEDIUM-04 FIX)
// ============================================================================

/**
 * ISO 8601 date-time string validation.
 * MEDIUM-04 FIX: Standardize on ISO 8601 for all date fields.
 */
export const ISODateTimeSchema = z.string().refine(
  (val) => {
    const date = new Date(val);
    return !isNaN(date.getTime()) && val.includes("T");
  },
  { message: "Must be a valid ISO 8601 date-time string" }
);

/**
 * ISO 8601 date (without time) validation.
 */
export const ISODateSchema = z.string().refine(
  (val) => /^\d{4}-\d{2}-\d{2}$/.test(val),
  { message: "Must be a valid ISO 8601 date (YYYY-MM-DD)" }
);

/**
 * Coerce a Date object to ISO 8601 string.
 */
export function toISODateTimeString(date: Date): string {
  return date.toISOString();
}

/**
 * Coerce a Date object to ISO 8601 date string (no time).
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ============================================================================
// Platform Credential Schemas (CRIT-API-01 FIX)
// ============================================================================

/**
 * Google OAuth credentials schema.
 */
export const GoogleCredentialsSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expiry_date: z.number().int().positive(),
  token_type: z.literal("Bearer").optional(),
  scope: z.string().optional(),
});

export type GoogleCredentials = z.infer<typeof GoogleCredentialsSchema>;

/**
 * Shopify credentials schema.
 */
export const ShopifyCredentialsSchema = z.object({
  access_token: z.string().min(1),
  shop: z.string().regex(/^[a-zA-Z0-9-]+\.myshopify\.com$/),
});

export type ShopifyCredentials = z.infer<typeof ShopifyCredentialsSchema>;

/**
 * WordPress credentials schema.
 */
export const WordPressCredentialsSchema = z.object({
  /** WordPress REST API base URL */
  site_url: z.string().url(),
  /** Application password username */
  username: z.string().min(1),
  /** Application password (not user password) */
  app_password: z.string().min(1),
});

export type WordPressCredentials = z.infer<typeof WordPressCredentialsSchema>;

/**
 * WordPress OAuth credentials schema.
 */
export const WordPressOAuthCredentialsSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  site_url: z.string().url(),
  blog_id: z.number().int().positive().optional(),
});

export type WordPressOAuthCredentials = z.infer<typeof WordPressOAuthCredentialsSchema>;

/**
 * Wix credentials schema.
 */
export const WixCredentialsSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  site_id: z.string().min(1),
});

export type WixCredentials = z.infer<typeof WixCredentialsSchema>;

/**
 * Webflow credentials schema.
 */
export const WebflowCredentialsSchema = z.object({
  access_token: z.string().min(1),
  site_id: z.string().min(1),
});

export type WebflowCredentials = z.infer<typeof WebflowCredentialsSchema>;

/**
 * Squarespace credentials schema.
 */
export const SquarespaceCredentialsSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  site_id: z.string().min(1),
});

export type SquarespaceCredentials = z.infer<typeof SquarespaceCredentialsSchema>;

/**
 * Pixel tracking credentials schema (minimal - just pixel ID reference).
 */
export const PixelCredentialsSchema = z.object({
  pixel_id: z.string().uuid(),
  api_key: z.string().min(32).optional(),
});

export type PixelCredentials = z.infer<typeof PixelCredentialsSchema>;

/**
 * Custom platform credentials schema (flexible for unknown platforms).
 */
export const CustomCredentialsSchema = z.object({
  api_key: z.string().min(1).optional(),
  api_secret: z.string().min(1).optional(),
  access_token: z.string().min(1).optional(),
  base_url: z.string().url().optional(),
  custom_headers: z.record(z.string(), z.string()).optional(),
}).refine(
  (data) => data.api_key || data.access_token,
  { message: "Either api_key or access_token is required" }
);

export type CustomCredentials = z.infer<typeof CustomCredentialsSchema>;

/**
 * Platform-specific credential validation using discriminated union.
 * CRIT-API-01 FIX: Validates credentials based on platform type.
 */
export const PlatformCredentialsSchema = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("wordpress"),
    credentials: z.union([WordPressCredentialsSchema, WordPressOAuthCredentialsSchema]),
  }),
  z.object({
    platform: z.literal("shopify"),
    credentials: ShopifyCredentialsSchema,
  }),
  z.object({
    platform: z.literal("wix"),
    credentials: WixCredentialsSchema,
  }),
  z.object({
    platform: z.literal("squarespace"),
    credentials: SquarespaceCredentialsSchema,
  }),
  z.object({
    platform: z.literal("webflow"),
    credentials: WebflowCredentialsSchema,
  }),
  z.object({
    platform: z.literal("pixel"),
    credentials: PixelCredentialsSchema,
  }),
  z.object({
    platform: z.literal("custom"),
    credentials: CustomCredentialsSchema,
  }),
]);

export type PlatformCredentials = z.infer<typeof PlatformCredentialsSchema>;

/**
 * Validate credentials for a specific platform.
 * Returns the validated credentials or throws a validation error.
 */
export function validatePlatformCredentials(
  platform: string,
  credentials: unknown
): PlatformCredentials {
  const result = PlatformCredentialsSchema.safeParse({ platform, credentials });
  if (!result.success) {
    throw new Error(`Invalid credentials for platform ${platform}: ${result.error.message}`);
  }
  return result.data;
}

// ============================================================================
// Idempotency Schema (HIGH-API-02 FIX)
// ============================================================================

/**
 * Idempotency key header schema.
 * HIGH-API-02 FIX: Prevent duplicate payment sessions.
 */
export const IdempotencyKeySchema = z.string()
  .min(16)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Idempotency key must be alphanumeric with underscores/hyphens");

export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

/**
 * Extract idempotency key from request headers.
 */
export function extractIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("Idempotency-Key") ?? request.headers.get("X-Idempotency-Key");
  if (!key) return null;

  const result = IdempotencyKeySchema.safeParse(key);
  return result.success ? result.data : null;
}

// ============================================================================
// Cursor Signing (MEDIUM-01 FIX)
// ============================================================================

/**
 * MEDIUM-01 FIX: Sign pagination cursors with HMAC to prevent tampering.
 * Uses a simple format: base64(data).signature
 */
import { createHmac } from "crypto";

const CURSOR_SECRET = process.env.CURSOR_SECRET ?? process.env.SESSION_SECRET ?? "default-dev-secret";

/**
 * Create a signed cursor from pagination data.
 * Format: base64(JSON(data)).hmac_signature
 */
export function createSignedCursor(data: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", CURSOR_SECRET)
    .update(payload)
    .digest("base64url")
    .slice(0, 16); // Truncate to 16 chars for shorter URLs

  return `${payload}.${signature}`;
}

/**
 * Verify and decode a signed cursor.
 * Returns null if the signature is invalid or data cannot be parsed.
 */
export function verifySignedCursor<T = Record<string, unknown>>(cursor: string): T | null {
  const parts = cursor.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;

  // Verify signature
  const expectedSignature = createHmac("sha256", CURSOR_SECRET)
    .update(payload)
    .digest("base64url")
    .slice(0, 16);

  // Timing-safe comparison
  if (signature.length !== expectedSignature.length) {
    return null;
  }

  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return null;
  }

  // Decode payload
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

// ============================================================================
// Rate Limit Response Schema (MEDIUM-03)
// ============================================================================

/**
 * Rate limit headers for response.
 */
export const RateLimitHeadersSchema = z.object({
  "X-RateLimit-Limit": z.string(),
  "X-RateLimit-Remaining": z.string(),
  "X-RateLimit-Reset": z.string(),
  "Retry-After": z.string().optional(),
});

// ============================================================================
// Success Response Wrapper
// ============================================================================

/**
 * Standard success response wrapper.
 */
export function successResponse<T>(
  data: T,
  options?: {
    status?: number;
    headers?: Record<string, string>;
  }
): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...options?.headers,
  });

  return new Response(
    JSON.stringify({ success: true, data }),
    {
      status: options?.status ?? 200,
      headers,
    }
  );
}

/**
 * Paginated success response wrapper.
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationResponse,
  options?: {
    status?: number;
    headers?: Record<string, string>;
  }
): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...options?.headers,
  });

  return new Response(
    JSON.stringify({
      success: true,
      data,
      pagination,
    }),
    {
      status: options?.status ?? 200,
      headers,
    }
  );
}
