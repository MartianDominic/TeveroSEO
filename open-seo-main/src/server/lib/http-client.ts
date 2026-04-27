/**
 * HTTP client with timeouts, retries, and circuit breaker.
 *
 * Provides a robust HTTP client for external API calls with:
 * - Configurable request timeouts (prevents hanging requests)
 * - Exponential backoff retries (handles transient failures)
 * - Circuit breaker pattern (prevents cascading failures)
 * - Request signing for webhooks (HMAC-SHA256)
 *
 * @example
 * ```typescript
 * // Using pre-configured clients
 * import { dataForSeoClient, serpApiClient } from '@/server/lib/http-client';
 *
 * const data = await dataForSeoClient.post('/v3/keywords', payload);
 *
 * // Creating a custom client
 * const client = new HttpClient({
 *   baseUrl: 'https://api.example.com',
 *   timeout: 30000,
 *   retries: 3,
 * });
 * ```
 */

import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "http-client" });

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HttpClientConfig {
  /** Base URL for all requests (e.g., 'https://api.example.com') */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Base delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Backoff multiplier for exponential delay (default: 2) */
  retryBackoff?: number;
  /** Default headers for all requests */
  headers?: Record<string, string>;
  /** Circuit breaker failure threshold (default: 5) */
  circuitBreakerThreshold?: number;
  /** Circuit breaker recovery time in milliseconds (default: 60000) */
  circuitBreakerRecoveryTime?: number;
}

export interface RequestOptions {
  /** Override timeout for this request */
  timeout?: number;
  /** Override retry count for this request */
  retries?: number;
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Additional headers for this request */
  headers?: Record<string, string>;
  /** Skip circuit breaker check (use with caution) */
  skipCircuitBreaker?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error thrown when an HTTP request returns a non-2xx status.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = "HttpError";
  }

  /** Check if this is a client error (4xx) */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** Check if this is a server error (5xx) */
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /** Check if this is a rate limit error (429) */
  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/**
 * Error thrown when a request times out.
 */
export class TimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly url: string,
  ) {
    super(`Request timed out after ${timeoutMs}ms: ${url}`);
    this.name = "TimeoutError";
  }
}

/**
 * Error thrown when the circuit breaker is open.
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly clientName: string,
    public readonly recoveryTime: number,
  ) {
    super(
      `Circuit breaker '${clientName}' is open - service unavailable. Recovery in ${Math.ceil(recoveryTime / 1000)}s`,
    );
    this.name = "CircuitBreakerOpenError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Circuit Breaker
// ─────────────────────────────────────────────────────────────────────────────

enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

/**
 * Circuit breaker to prevent cascading failures.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests rejected
 * - HALF_OPEN: After recovery time, allows one test request
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: CircuitState = CircuitState.CLOSED;

  constructor(
    private readonly name: string,
    private readonly failureThreshold: number,
    private readonly recoveryTime: number,
  ) {}

  /**
   * Check if circuit is open (rejecting requests).
   */
  isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.recoveryTime) {
        this.state = CircuitState.HALF_OPEN;
        log.info("Circuit breaker entering half-open state", {
          name: this.name,
        });
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Get remaining recovery time in milliseconds.
   */
  getRemainingRecoveryTime(): number {
    if (this.state !== CircuitState.OPEN) return 0;
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.recoveryTime - elapsed);
  }

  /**
   * Record a successful request.
   */
  recordSuccess(): void {
    this.failures = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      log.info("Circuit breaker closed after successful test request", {
        name: this.name,
      });
    }
    this.state = CircuitState.CLOSED;
  }

  /**
   * Record a failed request.
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      log.error("Circuit breaker opened due to failures", undefined, {
        name: this.name,
        failures: this.failures,
        threshold: this.failureThreshold,
      });
    }
  }

  /**
   * Get current state for monitoring.
   */
  getState(): {
    state: string;
    failures: number;
    threshold: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      threshold: this.failureThreshold,
    };
  }

  /**
   * Reset circuit breaker to closed state.
   */
  reset(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
    this.lastFailureTime = 0;
    log.info("Circuit breaker manually reset", { name: this.name });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HTTP client with timeouts, retries, and circuit breaker.
 */
export class HttpClient {
  private readonly config: Required<
    Omit<HttpClientConfig, "circuitBreakerThreshold" | "circuitBreakerRecoveryTime">
  >;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly clientName: string;

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? "",
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      retryBackoff: config.retryBackoff ?? 2,
      headers: config.headers ?? {},
    };

    // Extract client name from baseUrl for logging
    this.clientName = config.baseUrl
      ? new URL(config.baseUrl).hostname
      : "default";

    this.circuitBreaker = new CircuitBreaker(
      this.clientName,
      config.circuitBreakerThreshold ?? 5,
      config.circuitBreakerRecoveryTime ?? 60000,
    );
  }

  /**
   * Make a GET request.
   */
  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", path, undefined, options);
  }

  /**
   * Make a POST request.
   */
  async post<T>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.request<T>("POST", path, body, options);
  }

  /**
   * Make a PUT request.
   */
  async put<T>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.request<T>("PUT", path, body, options);
  }

  /**
   * Make a PATCH request.
   */
  async patch<T>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.request<T>("PATCH", path, body, options);
  }

  /**
   * Make a DELETE request.
   */
  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("DELETE", path, undefined, options);
  }

  /**
   * Internal request method with retry logic.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.config.baseUrl + path;

    // Check circuit breaker
    if (!options.skipCircuitBreaker && this.circuitBreaker.isOpen()) {
      throw new CircuitBreakerOpenError(
        this.clientName,
        this.circuitBreaker.getRemainingRecoveryTime(),
      );
    }

    const timeout = options.timeout ?? this.config.timeout;
    const retries = options.retries ?? this.config.retries;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.executeRequest<T>(
          method,
          url,
          body,
          timeout,
          options,
        );
        this.circuitBreaker.recordSuccess();
        return result;
      } catch (error) {
        lastError = error as Error;
        this.circuitBreaker.recordFailure();

        // Don't retry on non-retryable errors
        if (!this.isRetryable(error)) {
          throw error;
        }

        // Wait before retry with exponential backoff
        if (attempt < retries) {
          const delay =
            this.config.retryDelay *
            Math.pow(this.config.retryBackoff, attempt);
          const jitter = Math.random() * 0.1 * delay; // Add 0-10% jitter
          const totalDelay = Math.min(delay + jitter, 60000); // Cap at 60s

          log.warn("HTTP request failed, retrying", {
            attempt: attempt + 1,
            maxRetries: retries,
            delay: Math.round(totalDelay),
            url: this.sanitizeUrl(url),
            error:
              lastError instanceof Error ? lastError.message : String(lastError),
          });

          await this.sleep(totalDelay);
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  /**
   * Execute a single HTTP request with timeout.
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    body: unknown,
    timeout: number,
    options: RequestOptions,
  ): Promise<T> {
    const controller = new AbortController();

    // Combine with external signal if provided
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    // Set up timeout
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
          ...options.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new HttpError(response.status, errorBody, url);
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return undefined as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new TimeoutError(timeout, url);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Determine if an error is retryable.
   */
  private isRetryable(error: unknown): boolean {
    if (error instanceof HttpError) {
      // Retry on 5xx errors and rate limiting
      return error.status >= 500 || error.status === 429;
    }
    if (error instanceof TimeoutError) {
      return true;
    }
    // Network errors are retryable
    if (error instanceof TypeError && (error as Error).message.includes("fetch")) {
      return true;
    }
    return false;
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sanitize URL for logging (remove sensitive query params).
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.search) {
        return `${parsed.origin}${parsed.pathname}?[REDACTED]`;
      }
      return url;
    } catch {
      return "[INVALID_URL]";
    }
  }

  /**
   * Get circuit breaker state for monitoring.
   */
  getCircuitBreakerState(): {
    state: string;
    failures: number;
    threshold: number;
  } {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker to closed state.
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sign a payload using HMAC-SHA256 for webhook security.
 */
export async function signPayload(
  payload: unknown,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const keyData = encoder.encode(secret);

  // Import key for HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Sign the payload
  const signature = await crypto.subtle.sign("HMAC", key, data);

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a webhook signature.
 */
export async function verifyWebhookSignature(
  payload: unknown,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expectedSignature = await signPayload(payload, secret);
  return signature === expectedSignature;
}

export interface WebhookOptions {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Secret for HMAC-SHA256 signing */
  secret?: string;
  /** Number of retry attempts (default: 2) */
  retries?: number;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * Send a webhook with timeout and optional signing.
 */
export async function sendWebhook(
  url: string,
  payload: unknown,
  options: WebhookOptions = {},
): Promise<void> {
  const timeout = options.timeout ?? 10000;
  const retries = options.retries ?? 2;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Sign webhook if secret provided
  if (options.secret) {
    const signature = await signPayload(payload, options.secret);
    headers["X-Webhook-Signature"] = signature;
    headers["X-Webhook-Timestamp"] = Date.now().toString();
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new HttpError(response.status, errorBody, url);
      }

      return;
    } catch (error) {
      lastError = error as Error;

      if ((error as Error).name === "AbortError") {
        throw new TimeoutError(timeout, url);
      }

      // Retry on 5xx errors
      if (
        error instanceof HttpError &&
        error.status >= 500 &&
        attempt < retries
      ) {
        const delay = 1000 * Math.pow(2, attempt);
        log.warn("Webhook failed, retrying", {
          attempt: attempt + 1,
          maxRetries: retries,
          delay,
          url,
          status: error.status,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error("Webhook failed after retries");
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-configured Clients
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DataForSEO API client.
 * Timeout: 60s (API can be slow for large requests)
 * Retries: 2 (avoid excessive retries on expensive API)
 */
export const dataForSeoClient = new HttpClient({
  baseUrl: "https://api.dataforseo.com",
  timeout: 60000,
  retries: 2,
  retryDelay: 2000,
  circuitBreakerThreshold: 5,
  circuitBreakerRecoveryTime: 120000, // 2 minutes
});

/**
 * SERP API client.
 * Timeout: 30s
 * Retries: 3
 */
export const serpApiClient = new HttpClient({
  baseUrl: "https://serpapi.com",
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
});

/**
 * Loops email API client.
 * Timeout: 15s (email sending should be fast)
 * Retries: 2
 */
export const loopsClient = new HttpClient({
  baseUrl: "https://app.loops.so/api/v1",
  timeout: 15000,
  retries: 2,
  retryDelay: 1000,
});

/**
 * Jina AI API client.
 * Timeout: 30s
 * Retries: 2
 */
export const jinaClient = new HttpClient({
  baseUrl: "https://api.jina.ai",
  timeout: 30000,
  retries: 2,
  retryDelay: 1000,
});

/**
 * Anthropic Claude API client.
 * Timeout: 120s (LLM responses can be slow)
 * Retries: 2
 */
export const anthropicClient = new HttpClient({
  baseUrl: "https://api.anthropic.com",
  timeout: 120000,
  retries: 2,
  retryDelay: 2000,
  circuitBreakerThreshold: 3,
  circuitBreakerRecoveryTime: 60000,
});

/**
 * OpenAI API client.
 * Timeout: 120s (LLM responses can be slow)
 * Retries: 2
 */
export const openaiClient = new HttpClient({
  baseUrl: "https://api.openai.com",
  timeout: 120000,
  retries: 2,
  retryDelay: 2000,
  circuitBreakerThreshold: 3,
  circuitBreakerRecoveryTime: 60000,
});

/**
 * Generic external API client with default settings.
 * Timeout: 30s
 * Retries: 3
 */
export const externalApiClient = new HttpClient({
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
});
