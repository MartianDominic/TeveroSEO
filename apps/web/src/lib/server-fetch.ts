import "server-only";
import { auth } from "@clerk/nextjs/server";

import { logger } from '@/lib/logger';

import { extractRequestContext, type RequestContext } from "./api/request-context";
import { getOpenSeoUrl, getAiWriterUrl } from "./env";
import {
  fetchWithTimeout,
  DEFAULT_TIMEOUT_MS,
  type FetchWithTimeoutOptions,
} from "./fetch-with-timeout";
import { toCamelCase, toSnakeCase } from "./utils/case-transform";
import {
  AI_WRITER_BREAKER,
  OPEN_SEO_BREAKER,
  CircuitOpenError,
  getServiceErrorMessage,
} from "./utils/service-circuit-breakers";

import type { ZodLikeSchema } from "./utils/type-guards";


/** Retry configuration for transient errors */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

/**
 * Check if an error is transient and should be retried.
 * Retries on 5xx server errors, network errors, and timeouts.
 * Does NOT retry on 4xx client errors.
 */
function isTransientError(status: number, error?: Error): boolean {
  // Server errors (5xx) are transient
  if (status >= 500 && status < 600) {
    return true;
  }
  // Network/timeout errors
  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("socket hang up") ||
      message.includes("fetch failed")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter.
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

const AI_WRITER_URL = getAiWriterUrl();
const OPEN_SEO_URL = getOpenSeoUrl();

/** Default server-side request timeout */
const SERVER_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

/**
 * Standardized error response format.
 * M-12 FIX: Unified error format across all backends.
 * HIGH-16 FIX: Consistent normalization layer for cross-app errors.
 */
export interface NormalizedError {
  /** User-friendly error message */
  error: string;
  /** Machine-readable error code for programmatic handling */
  code: string;
  /** HTTP status code */
  status: number;
  /** Source backend service */
  source: 'open-seo' | 'ai-writer' | 'unknown';
  /** Original error details (only in development) */
  details?: unknown;
}

/**
 * Legacy interface for backward compatibility.
 * @deprecated Use NormalizedError instead
 */
export interface SanitizedError {
  error: string;
  code?: string;
}

/**
 * Derive error code from HTTP status when backend doesn't provide one.
 * HIGH-03 FIX: Extract meaningful codes from status for open-seo-main responses.
 */
function deriveErrorCodeFromStatus(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'VALIDATION_ERROR';
    case 429: return 'RATE_LIMITED';
    case 500: return 'INTERNAL_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    case 504: return 'GATEWAY_TIMEOUT';
    default: return status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR';
  }
}

/**
 * Normalize backend error responses to a consistent format.
 * HIGH-16 FIX: Unified error normalization layer for cross-app error handling.
 * HIGH-03 FIX: Extracts code from status when open-seo-main omits it.
 *
 * Handles multiple formats:
 * - open-seo-main: {"error": "message"} (code derived from status)
 * - open-seo-main: {"error": "message", "code": "ERROR_CODE"}
 * - AI-Writer standard: {"error": "message", "code": "ERROR_CODE"}
 * - AI-Writer legacy: {"detail": "message"}
 * - AI-Writer validation: {"detail": [{"loc": [...], "msg": "...", "type": "..."}]}
 *
 * @param body - Raw error response body from backend
 * @param status - HTTP status code
 * @param source - Source backend service
 * @returns Normalized error object
 */
export function normalizeBackendError(
  body: unknown,
  status: number,
  source: 'open-seo' | 'ai-writer' | 'unknown' = 'unknown'
): NormalizedError {
  const isDev = process.env.NODE_ENV === 'development';

  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>;

    // Standard format: {"error": "message", "code": "ERROR_CODE"}
    // HIGH-03 FIX: Derive code from status when not provided (common in open-seo-main)
    if ('error' in obj && typeof obj.error === 'string') {
      const code = typeof obj.code === 'string'
        ? obj.code
        : deriveErrorCodeFromStatus(status);
      return {
        error: obj.error.slice(0, 200),
        code,
        status,
        source,
        details: isDev ? obj : undefined,
      };
    }

    // AI-Writer validation errors: {"detail": [{"loc": [...], "msg": "...", "type": "..."}]}
    if ('detail' in obj && Array.isArray(obj.detail)) {
      const firstError = obj.detail[0];
      if (firstError && typeof firstError === 'object' && 'msg' in firstError) {
        const msg = String((firstError as Record<string, unknown>).msg);
        return {
          error: msg.slice(0, 200),
          code: 'VALIDATION_ERROR',
          status,
          source,
          details: isDev ? obj.detail : undefined,
        };
      }
    }

    // AI-Writer legacy format: {"detail": "message"}
    if ('detail' in obj && typeof obj.detail === 'string') {
      return {
        error: obj.detail.slice(0, 200),
        code: 'LEGACY_ERROR',
        status,
        source,
        details: isDev ? obj : undefined,
      };
    }

    // Message-only format: {"message": "..."}
    if ('message' in obj && typeof obj.message === 'string') {
      return {
        error: obj.message.slice(0, 200),
        code: typeof obj.code === 'string' ? obj.code : 'BACKEND_ERROR',
        status,
        source,
        details: isDev ? obj : undefined,
      };
    }
  }

  // Fallback for unknown formats
  return {
    error: 'An error occurred',
    code: 'UNKNOWN_ERROR',
    status,
    source,
    details: isDev ? body : undefined,
  };
}

/**
 * Sanitize backend error responses to prevent information leakage.
 * @deprecated Use normalizeBackendError instead for full error context
 */
function sanitizeErrorBody(body: unknown): SanitizedError {
  const normalized = normalizeBackendError(body, 500, 'unknown');
  return {
    error: normalized.error,
    code: normalized.code,
  };
}

export class FastApiError extends Error {
  public sanitizedBody: SanitizedError;
  public normalizedError: NormalizedError;
  public errorCode: string;

  constructor(
    public status: number,
    public body: unknown,
    message: string,
    public source: 'open-seo' | 'ai-writer' | 'unknown' = 'unknown'
  ) {
    super(message);
    this.name = "FastApiError";
    // HIGH-16 FIX: Full error normalization with source tracking
    this.normalizedError = normalizeBackendError(body, status, source);
    // Legacy sanitized body for backward compatibility
    this.sanitizedBody = {
      error: this.normalizedError.error,
      code: this.normalizedError.code,
    };
    this.errorCode = this.normalizedError.code;
  }

  /**
   * Get a safe JSON representation for API responses.
   */
  toJSON(): NormalizedError {
    return this.normalizedError;
  }
}

// Re-export circuit breaker error for consumers
export { CircuitOpenError, getServiceErrorMessage };

// Re-export request context utilities for consumers (HIGH-API-02, MED-API-02)
export {
  extractRequestContext,
  extractRequestContextFromRequest,
  buildTracingHeaders,
  addTracingHeadersToResponse,
  type RequestContext,
} from "./api/request-context";

/**
 * Build authentication and tracing headers for cross-service requests.
 *
 * FIX CRIT-11: Always derive X-User-Id from verified Clerk auth context.
 * FIX HIGH-15: Always include X-Correlation-Id for cross-service tracing.
 * FIX HIGH-API-02: Propagate correlation ID from incoming request.
 * FIX MED-API-02: Propagate x-request-id from edge.
 *
 * @param requestContext - Optional request context with tracing IDs from incoming request
 * @returns Headers object with Authorization, X-User-Id, X-Correlation-Id, and X-Request-Id
 */
async function buildServiceHeaders(
  requestContext?: RequestContext
): Promise<Record<string, string>> {
  const { getToken, userId } = await auth();
  const token = await getToken();

  // HIGH-API-02 & MED-API-02: Extract or generate tracing IDs
  // If no context provided, extract from current request headers
  const context = requestContext ?? await extractRequestContext();

  const headers: Record<string, string> = {
    // HIGH-API-02: Propagate correlation ID for distributed tracing
    "X-Correlation-Id": context.correlationId,
    // MED-API-02: Propagate request ID from edge
    "X-Request-Id": context.requestId,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // CRIT-11: Always derive X-User-Id from verified Clerk auth, never from client input
  if (userId) {
    headers["X-User-Id"] = userId;
  }

  // HIGH-12-01 FIX: Propagate X-Client-ID for cross-service client context
  // This ensures downstream services receive the client context from the original request
  if (context.clientId) {
    headers["X-Client-Id"] = context.clientId;
  }

  return headers;
}

export interface ServerFetchInit<T = unknown> extends RequestInit {
  /** Timeout in milliseconds. Defaults to 30 seconds. */
  timeout?: number;
  /** Optional Zod schema for response validation. If provided, validates the parsed JSON. */
  schema?: ZodLikeSchema<T>;
  /** Optional request context for tracing ID propagation (HIGH-API-02, MED-API-02) */
  requestContext?: RequestContext;
  /**
   * Automatically transform response keys from snake_case to camelCase.
   * FIX CRIT-API-02: Consistent naming convention at API boundary.
   * Default: true for AI-Writer (Python), false for open-seo-main (TypeScript).
   */
  transformResponse?: boolean;
  /**
   * Automatically transform request body keys from camelCase to snake_case.
   * FIX CRIT-API-02: Consistent naming convention at API boundary.
   * Default: true for AI-Writer (Python), false for open-seo-main (TypeScript).
   */
  transformRequest?: boolean;
}

/**
 * Core request implementation (without circuit breaker).
 * Used internally by requestWithCircuitBreaker.
 */
async function requestCore<T>(
  base: string,
  method: string,
  path: string,
  body?: unknown,
  init?: ServerFetchInit<T>,
): Promise<T> {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const { timeout = SERVER_TIMEOUT_MS, schema, requestContext, transformResponse, transformRequest, ...restInit } = init ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await buildServiceHeaders(requestContext)),
    ...((restInit?.headers as Record<string, string>) ?? {}),
  };

  // HIGH-16: Determine source for error normalization
  const source: 'open-seo' | 'ai-writer' = base === AI_WRITER_URL ? 'ai-writer' : 'open-seo';

  // CRIT-API-02 FIX: Automatic case transformation for AI-Writer (Python uses snake_case)
  // Default: transform for AI-Writer, don't transform for open-seo-main (TypeScript)
  const shouldTransformRequest = transformRequest ?? (source === 'ai-writer');
  const shouldTransformResponse = transformResponse ?? (source === 'ai-writer');

  // Transform request body if needed
  const transformedBody = shouldTransformRequest && body !== undefined
    ? toSnakeCase(body as Record<string, unknown>)
    : body;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        method,
        headers,
        body: transformedBody !== undefined ? JSON.stringify(transformedBody) : undefined,
        cache: restInit?.cache ?? "no-store",
        next: restInit?.next,
        timeout,
      } as FetchWithTimeoutOptions);
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
        // CRIT-API-02 FIX: Transform response keys from snake_case to camelCase
        if (shouldTransformResponse && parsed && typeof parsed === 'object') {
          parsed = toCamelCase(parsed as Record<string, unknown>);
        }
      } catch {
        parsed = text;
      }

      if (!res.ok) {
        // HIGH-16: Include source in error for proper normalization
        const error = new FastApiError(res.status, parsed, `${method} ${path} failed: ${res.status}`, source);

        // Check if this is a transient error that should be retried
        if (isTransientError(res.status) && attempt < RETRY_CONFIG.maxRetries - 1) {
          lastError = error;
          const delay = getBackoffDelay(attempt);
          await sleep(delay);
          continue;
        }

        throw error;
      }

      // If schema provided, validate the parsed response
      if (schema) {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          const errorMsg = `Response validation failed for ${method} ${path}: ${result.error.message}`;
          logger.warn(`[server-fetch] ${errorMsg}`);
          throw new FastApiError(res.status, parsed, errorMsg, source);
        }
        return result.data;
      }

      // CRIT-API-02 FIX: Log warning when schema is not provided
      // Without schema validation, type assertions bypass runtime validation
      // which can lead to runtime errors when API contracts change.
      if (process.env.NODE_ENV === 'development') {
        logger.warn(
          `[server-fetch] CRIT-API-02: No schema provided for ${method} ${path}. ` +
          `Response type assertion bypasses runtime validation. Pass a Zod schema for type safety.`
        );
      }

      // Without schema, return as T (maintains backward compatibility)
      // @deprecated - Callers should pass a schema for runtime type safety
      // CRIT-API-02: This pattern bypasses runtime validation and should be avoided
      return parsed as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry FastApiError with non-transient status codes
      if (error instanceof FastApiError && !isTransientError(error.status)) {
        throw error;
      }

      // Check if this is a transient network error that should be retried
      if (isTransientError(0, lastError) && attempt < RETRY_CONFIG.maxRetries - 1) {
        const delay = getBackoffDelay(attempt);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  // Should not reach here, but throw last error if we do
  throw lastError ?? new Error(`Request failed after ${RETRY_CONFIG.maxRetries} attempts`);
}

/**
 * Request wrapper with circuit breaker protection.
 * Automatically selects the appropriate circuit breaker based on the base URL.
 *
 * Benefits:
 * - Prevents cascading failures when a backend service is down
 * - Fast-fails requests when circuit is open (no wasted timeout)
 * - Automatically recovers when service becomes healthy
 */
async function request<T>(
  base: string,
  method: string,
  path: string,
  body?: unknown,
  init?: ServerFetchInit<T>,
): Promise<T> {
  // Select appropriate circuit breaker based on target service
  const breaker = base === AI_WRITER_URL ? AI_WRITER_BREAKER : OPEN_SEO_BREAKER;

  return breaker.execute(() => requestCore<T>(base, method, path, body, init));
}

export const getFastApi = <T>(path: string, init?: ServerFetchInit<T>) =>
  request<T>(AI_WRITER_URL, "GET", path, undefined, init);
export const postFastApi = <T>(path: string, body: unknown, init?: ServerFetchInit<T>) =>
  request<T>(AI_WRITER_URL, "POST", path, body, init);
export const patchFastApi = <T>(path: string, body: unknown, init?: ServerFetchInit<T>) =>
  request<T>(AI_WRITER_URL, "PATCH", path, body, init);
export const putFastApi = <T>(path: string, body: unknown, init?: ServerFetchInit<T>) =>
  request<T>(AI_WRITER_URL, "PUT", path, body, init);
export const deleteFastApi = <T>(path: string, init?: ServerFetchInit<T>) =>
  request<T>(AI_WRITER_URL, "DELETE", path, undefined, init);

export const getOpenSeo = <T>(path: string, init?: ServerFetchInit<T>) =>
  request<T>(OPEN_SEO_URL, "GET", path, undefined, init);
export const postOpenSeo = <T>(path: string, body: unknown, init?: ServerFetchInit<T>) =>
  request<T>(OPEN_SEO_URL, "POST", path, body, init);
export const putOpenSeo = <T>(path: string, body: unknown, init?: ServerFetchInit<T>) =>
  request<T>(OPEN_SEO_URL, "PUT", path, body, init);
export const patchOpenSeo = <T>(path: string, body: unknown, init?: ServerFetchInit<T>) =>
  request<T>(OPEN_SEO_URL, "PATCH", path, body, init);
export const deleteOpenSeo = <T>(path: string, init?: ServerFetchInit<T>) =>
  request<T>(OPEN_SEO_URL, "DELETE", path, undefined, init);

/**
 * Pattern type returned by the open-seo patterns API.
 * Note: API returns 'patternType' not 'type' for the pattern classification.
 */
export interface OpenSeoPattern {
  id: string;
  workspaceId: string;
  patternType: string;
  status: string;
  title: string;
  description: string;
  affectedClientIds: string[];
  affectedCount: number;
  magnitude: number;
  direction: 'up' | 'down' | 'stable';
  confidence: number;
  startDate: string;
  endDate: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  dismissedAt: string | null;
}

/**
 * Fetch a pattern by ID from open-seo backend.
 * Used to validate workspace membership before modifying patterns.
 */
export async function getOpenSeoPattern(patternId: string): Promise<OpenSeoPattern> {
  return getOpenSeo<OpenSeoPattern>(`/api/patterns/${patternId}`);
}
