/**
 * Internal API Client for Cross-Service Communication
 *
 * Provides secure, signed requests between apps/web and AI-Writer backend.
 *
 * Features:
 * - HMAC request signing with timestamps (prevents replay attacks)
 * - Correlation ID propagation for request tracing
 * - Configurable timeouts with AbortController
 * - Zod schema validation on responses
 * - Structured error handling
 *
 * Security:
 * - Requests signed with INTERNAL_API_KEY using HMAC-SHA256
 * - Timestamp included to prevent replay attacks (5-minute drift allowed)
 * - Correlation IDs for debugging and audit trails
 *
 * @see AI-Writer/backend/middleware/internal_auth.py for server-side verification
 */

import "server-only";
import { z } from "zod";
import * as crypto from "crypto";
import { getInternalApiKey, getAiWriterUrl } from "../env";

/**
 * Request options for internal API calls.
 */
export interface InternalApiRequestOptions<T> {
  /** HTTP method (default: GET) */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** Zod schema for response validation */
  schema?: z.ZodType<T>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Correlation ID for request tracing (auto-generated if not provided) */
  correlationId?: string;
}

/**
 * Error thrown by internal API client.
 * Contains structured information for debugging and error handling.
 */
export class InternalApiError extends Error {
  constructor(
    message: string,
    /** HTTP status code */
    public statusCode: number,
    /** Additional error details from the response */
    public details?: string,
    /** Correlation ID for tracing */
    public correlationId?: string
  ) {
    super(message);
    this.name = "InternalApiError";
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, InternalApiError.prototype);
  }

  /**
   * Check if this is a transient error that may succeed on retry.
   */
  isRetryable(): boolean {
    // 5xx errors and timeouts are generally retryable
    return this.statusCode >= 500 || this.statusCode === 408 || this.statusCode === 429;
  }
}

/**
 * Sign a request payload using HMAC-SHA256.
 *
 * The signature format is: HMAC(timestamp.payload, INTERNAL_API_KEY)
 * This prevents replay attacks as the signature is bound to the timestamp.
 *
 * @param payload - The request body as a string (empty string for GET)
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Hexadecimal signature string
 */
function signRequest(payload: string, timestamp: number): string {
  const apiKey = getInternalApiKey();
  if (!apiKey) {
    throw new InternalApiError(
      "INTERNAL_API_KEY is not configured",
      500,
      "Service-to-service authentication requires INTERNAL_API_KEY environment variable"
    );
  }

  const message = `${timestamp}.${payload}`;
  return crypto.createHmac("sha256", apiKey).update(message).digest("hex");
}

/**
 * Make a signed request to the internal API (AI-Writer backend).
 *
 * @param path - API endpoint path (e.g., "/internal/voice/profile")
 * @param options - Request options
 * @returns Parsed and validated response data
 *
 * @example
 * ```typescript
 * const response = await internalApiRequest("/internal/voice/profile", {
 *   method: "POST",
 *   body: { clientId: 123 },
 *   schema: VoiceProfileSchema,
 * });
 * ```
 */
export async function internalApiRequest<T>(
  path: string,
  options: InternalApiRequestOptions<T> = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    schema,
    timeout = 30000,
    correlationId = crypto.randomUUID(),
  } = options;

  const aiWriterUrl = getAiWriterUrl();
  const timestamp = Date.now();
  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = signRequest(bodyStr, timestamp);

  // Setup timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `${aiWriterUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Signature": signature,
        "X-Internal-Timestamp": timestamp.toString(),
        "X-Correlation-ID": correlationId,
      },
      body: bodyStr || undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetails: string | undefined;
      try {
        const errorBody = await response.text();
        errorDetails = errorBody.substring(0, 500); // Limit error details size
      } catch {
        // Ignore parsing errors for error details
      }

      throw new InternalApiError(
        `AI-Writer API error: ${response.status} ${response.statusText}`,
        response.status,
        errorDetails,
        correlationId
      );
    }

    const data = await response.json();

    // Validate response against schema if provided
    if (schema) {
      const result = schema.safeParse(data);
      if (!result.success) {
        console.error(
          `[internal-api] Response validation failed for ${path}:`,
          result.error.flatten()
        );
        throw new InternalApiError(
          "Invalid response format from AI-Writer",
          500,
          `Schema validation failed: ${result.error.message}`,
          correlationId
        );
      }
      return result.data;
    }

    return data as T;
  } catch (e) {
    if (e instanceof InternalApiError) {
      throw e;
    }

    if (e instanceof Error) {
      if (e.name === "AbortError") {
        throw new InternalApiError(
          `Request timeout after ${timeout}ms`,
          408,
          `Path: ${path}`,
          correlationId
        );
      }

      // Network errors
      throw new InternalApiError(
        `Failed to connect to AI-Writer: ${e.message}`,
        503,
        e.stack,
        correlationId
      );
    }

    throw new InternalApiError(
      "Unknown error during internal API request",
      500,
      String(e),
      correlationId
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Convenience methods for common HTTP methods.
 */
export const internalApi = {
  get: <T>(path: string, options?: Omit<InternalApiRequestOptions<T>, "method" | "body">) =>
    internalApiRequest<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body: unknown, options?: Omit<InternalApiRequestOptions<T>, "method" | "body">) =>
    internalApiRequest<T>(path, { ...options, method: "POST", body }),

  put: <T>(path: string, body: unknown, options?: Omit<InternalApiRequestOptions<T>, "method" | "body">) =>
    internalApiRequest<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(path: string, body: unknown, options?: Omit<InternalApiRequestOptions<T>, "method" | "body">) =>
    internalApiRequest<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: Omit<InternalApiRequestOptions<T>, "method" | "body">) =>
    internalApiRequest<T>(path, { ...options, method: "DELETE" }),
};
