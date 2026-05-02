/**
 * Revolut Merchant API Client
 * Phase 54-02: RevolutProvider Implementation
 *
 * Typed fetch wrapper for Revolut Merchant API.
 * Handles authentication, versioning, error handling, and rate limiting.
 */
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "RevolutClient" });

/**
 * Revolut API version header value.
 */
export const REVOLUT_API_VERSION = "2024-09-01";

/**
 * Base URLs for Revolut Merchant API.
 */
export const REVOLUT_BASE_URLS = {
  sandbox: "https://sandbox-merchant.revolut.com/api",
  production: "https://merchant.revolut.com/api",
} as const;

/**
 * Revolut order states.
 */
export type RevolutOrderState =
  | "pending"
  | "processing"
  | "authorised"
  | "completed"
  | "cancelled"
  | "failed";

/**
 * Revolut payment object within an order.
 */
export interface RevolutPayment {
  id: string;
  state: "pending" | "processing" | "captured" | "cancelled" | "failed";
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

/**
 * Revolut customer object.
 */
export interface RevolutCustomer {
  email?: string;
  full_name?: string;
  phone?: string;
}

/**
 * Revolut order response.
 */
export interface RevolutOrder {
  id: string;
  token: string;
  type: "payment";
  state: RevolutOrderState;
  checkout_url: string;
  amount: number;
  currency: string;
  description?: string;
  capture_mode: "automatic" | "manual";
  customer?: RevolutCustomer;
  metadata?: Record<string, string>;
  payments?: RevolutPayment[];
  created_at: string;
  updated_at: string;
}

/**
 * Create order request body.
 */
export interface CreateOrderRequest {
  amount: number;
  currency: string;
  description?: string;
  capture_mode?: "automatic" | "manual";
  customer?: RevolutCustomer;
  metadata?: Record<string, string>;
  redirect_url?: string;
}

/**
 * Revolut API error response.
 */
export interface RevolutApiError {
  code: number;
  message: string;
  details?: unknown;
}

/**
 * Error thrown for Revolut API failures.
 */
export class RevolutClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly apiError?: RevolutApiError
  ) {
    super(message);
    this.name = "RevolutClientError";
  }
}

/**
 * Rate limit error (429).
 */
export class RevolutRateLimitError extends RevolutClientError {
  constructor(
    public readonly retryAfterMs: number
  ) {
    super("Rate limit exceeded", 429);
    this.name = "RevolutRateLimitError";
  }
}

/**
 * Revolut API client configuration.
 */
export interface RevolutClientConfig {
  secretKey: string;
  sandbox?: boolean;
}

/**
 * Create a Revolut API client.
 */
export function createRevolutClient(config: RevolutClientConfig) {
  const baseUrl = config.sandbox
    ? REVOLUT_BASE_URLS.sandbox
    : REVOLUT_BASE_URLS.production;

  /**
   * Make an authenticated request to Revolut API.
   */
  async function request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.secretKey}`,
      "Revolut-Api-Version": REVOLUT_API_VERSION,
      "Content-Type": "application/json",
    };

    log.debug("Revolut API request", { method, path });

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
      log.warn("Revolut rate limit hit", { retryAfterMs });
      throw new RevolutRateLimitError(retryAfterMs);
    }

    // Parse response
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      log.error("Failed to parse Revolut response", new Error(`Invalid JSON: ${text.slice(0, 100)}`));
      throw new RevolutClientError(
        "Invalid JSON response from Revolut",
        response.status
      );
    }

    // Handle errors
    if (!response.ok) {
      const apiError = data as RevolutApiError | undefined;
      log.error("Revolut API error", new Error(`HTTP ${response.status}: ${apiError?.message ?? "Unknown error"}`));
      throw new RevolutClientError(
        apiError?.message ?? `HTTP ${response.status}`,
        response.status,
        apiError
      );
    }

    log.debug("Revolut API response", { status: response.status, path });
    return data as T;
  }

  return {
    /**
     * Create a new order.
     * POST /api/orders
     */
    async createOrder(req: CreateOrderRequest): Promise<RevolutOrder> {
      return request<RevolutOrder>("POST", "/orders", req);
    },

    /**
     * Retrieve an order by ID.
     * GET /api/orders/{orderId}
     */
    async getOrder(orderId: string): Promise<RevolutOrder> {
      return request<RevolutOrder>("GET", `/orders/${orderId}`);
    },

    /**
     * Get the base URL being used.
     */
    getBaseUrl(): string {
      return baseUrl;
    },
  };
}

export type RevolutClient = ReturnType<typeof createRevolutClient>;
