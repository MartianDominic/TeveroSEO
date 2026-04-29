import "server-only";
import { auth } from "@clerk/nextjs/server";
import { getOpenSeoUrl, getAiWriterUrl } from "./env";
import {
  fetchWithTimeout,
  DEFAULT_TIMEOUT_MS,
  type FetchWithTimeoutOptions,
} from "./fetch-with-timeout";
import type { ZodLikeSchema } from "./utils/type-guards";
import {
  AI_WRITER_BREAKER,
  OPEN_SEO_BREAKER,
  CircuitOpenError,
  getServiceErrorMessage,
} from "./utils/service-circuit-breakers";

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
 */
export interface SanitizedError {
  error: string;
  code?: string;
}

/**
 * Sanitize backend error responses to prevent information leakage.
 * Handles both formats:
 * - open-seo-main: {"error": "message", "code": "ERROR_CODE"}
 * - AI-Writer (legacy): {"detail": "message"}
 *
 * M-12 FIX: Now extracts error codes when available.
 */
function sanitizeErrorBody(body: unknown): SanitizedError {
  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>;

    // Standard format: {"error": "message", "code": "ERROR_CODE"}
    if ('error' in obj) {
      const error = obj.error;
      if (typeof error === 'string' && error.length < 200) {
        const result: SanitizedError = { error };
        // Extract error code if present
        if ('code' in obj && typeof obj.code === 'string') {
          result.code = obj.code;
        }
        return result;
      }
    }

    // Legacy AI-Writer format: {"detail": "message"}
    if ('detail' in obj) {
      const detail = obj.detail;
      if (typeof detail === 'string' && detail.length < 200) {
        return { error: detail, code: 'LEGACY_ERROR' };
      }
    }
  }
  return { error: 'An error occurred', code: 'UNKNOWN_ERROR' };
}

export class FastApiError extends Error {
  public sanitizedBody: SanitizedError;
  public errorCode?: string;

  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = "FastApiError";
    // Sanitize body for safe client exposure
    this.sanitizedBody = sanitizeErrorBody(body);
    // M-12 FIX: Expose error code for programmatic handling
    this.errorCode = this.sanitizedBody.code;
  }
}

// Re-export circuit breaker error for consumers
export { CircuitOpenError, getServiceErrorMessage };

async function authHeader(): Promise<Record<string, string>> {
  const { getToken } = await auth();
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ServerFetchInit<T = unknown> extends RequestInit {
  /** Timeout in milliseconds. Defaults to 30 seconds. */
  timeout?: number;
  /** Optional Zod schema for response validation. If provided, validates the parsed JSON. */
  schema?: ZodLikeSchema<T>;
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
  const { timeout = SERVER_TIMEOUT_MS, schema, ...restInit } = init ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((restInit?.headers as Record<string, string>) ?? {}),
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: restInit?.cache ?? "no-store",
        next: restInit?.next,
        timeout,
      } as FetchWithTimeoutOptions);
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }

      if (!res.ok) {
        const error = new FastApiError(res.status, parsed, `${method} ${path} failed: ${res.status}`);

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
          console.warn(`[server-fetch] ${errorMsg}`);
          throw new FastApiError(res.status, parsed, errorMsg);
        }
        return result.data;
      }

      // Without schema, return as T (maintains backward compatibility)
      // Note: Callers should prefer passing a schema for type safety
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
