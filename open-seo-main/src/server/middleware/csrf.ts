/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for SPA architecture.
 *
 * Security model:
 * 1. Generate cryptographically secure CSRF token
 * 2. Store token in HttpOnly, SameSite=Strict cookie
 * 3. Require X-CSRF-Token header on state-changing requests
 * 4. Validate header matches cookie using timing-safe comparison
 *
 * Skip conditions:
 * - Safe HTTP methods (GET, HEAD, OPTIONS)
 * - API key authenticated requests (already use secret-based auth)
 * - Webhook endpoints (use signature verification)
 */
import { randomBytes, timingSafeEqual } from "crypto";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "csrf-middleware" });

const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_BYTES = 32; // 256 bits of entropy

/**
 * Generate a cryptographically secure CSRF token.
 * Uses crypto.randomBytes for high-entropy randomness.
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString("hex");
}

/**
 * Extract CSRF token from cookie header.
 * Handles multiple cookie formats and edge cases.
 */
export function getCsrfTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  // Parse cookies - handle edge cases like spaces and multiple =
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    cookies[key] = value;
  }

  return cookies[CSRF_COOKIE_NAME] ?? null;
}

/**
 * Extract CSRF token from request header.
 */
export function getCsrfTokenFromHeader(request: Request): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

/**
 * Result of CSRF token validation.
 */
export interface CsrfValidationResult {
  valid: boolean;
  error?: string;
  /** Whether validation was skipped (safe method, API key auth, etc.) */
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Check if request is authenticated via API key.
 * API key requests don't need CSRF protection as they use secret-based auth.
 */
function isApiKeyAuthenticated(request: Request): boolean {
  // Check x-api-key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader && apiKeyHeader.startsWith("oseo_")) {
    return true;
  }

  // Check Authorization header for API key (oseo_ prefix)
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      if (parts[1].startsWith("oseo_")) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if request is to a webhook endpoint.
 * Webhooks use signature verification instead of CSRF.
 */
function isWebhookRequest(request: Request): boolean {
  const url = new URL(request.url);
  const path = url.pathname;

  // Skip CSRF for webhook endpoints
  return (
    path.includes("/webhook") ||
    path.includes("/webhooks") ||
    path.startsWith("/api/stripe/webhook") ||
    path.startsWith("/api/clerk/webhook")
  );
}

/**
 * Validate CSRF token using double-submit cookie pattern.
 *
 * Skips validation for:
 * - Safe HTTP methods (GET, HEAD, OPTIONS)
 * - API key authenticated requests
 * - Webhook endpoints
 *
 * @param request - The incoming HTTP request
 * @returns Validation result with error details if invalid
 */
export function validateCsrfToken(request: Request): CsrfValidationResult {
  const method = request.method.toUpperCase();

  // Skip for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return { valid: true, skipped: true, skipReason: "safe_method" };
  }

  // Skip for API key authenticated requests
  if (isApiKeyAuthenticated(request)) {
    return { valid: true, skipped: true, skipReason: "api_key_auth" };
  }

  // Skip for webhook endpoints
  if (isWebhookRequest(request)) {
    return { valid: true, skipped: true, skipReason: "webhook" };
  }

  const cookieToken = getCsrfTokenFromCookie(request);
  const headerToken = getCsrfTokenFromHeader(request);

  if (!cookieToken) {
    log.warn("CSRF validation failed: no cookie token", {
      path: new URL(request.url).pathname,
      method,
    });
    return {
      valid: false,
      error: "CSRF cookie missing. Ensure cookies are enabled and refresh the page.",
    };
  }

  if (!headerToken) {
    log.warn("CSRF validation failed: no header token", {
      path: new URL(request.url).pathname,
      method,
    });
    return {
      valid: false,
      error: "CSRF header missing. Include X-CSRF-Token header in request.",
    };
  }

  // Timing-safe comparison to prevent timing attacks
  // First check lengths match to avoid Buffer.from issues
  if (cookieToken.length !== headerToken.length) {
    log.warn("CSRF validation failed: token length mismatch", {
      path: new URL(request.url).pathname,
      method,
      cookieLength: cookieToken.length,
      headerLength: headerToken.length,
    });
    return { valid: false, error: "Invalid CSRF token" };
  }

  const cookieBuffer = Buffer.from(cookieToken, "utf8");
  const headerBuffer = Buffer.from(headerToken, "utf8");

  if (!timingSafeEqual(cookieBuffer, headerBuffer)) {
    log.warn("CSRF validation failed: token mismatch", {
      path: new URL(request.url).pathname,
      method,
    });
    return { valid: false, error: "Invalid CSRF token" };
  }

  return { valid: true };
}

/**
 * Create a 403 Forbidden response for CSRF validation failures.
 *
 * @param error - Optional error message (defaults to generic message)
 * @returns Response with 403 status and JSON error body
 */
export function csrfErrorResponse(error?: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: error ?? "CSRF validation failed",
      code: "CSRF_VALIDATION_FAILED",
    }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Build the CSRF cookie string with security attributes.
 *
 * Cookie attributes:
 * - HttpOnly: Prevents JavaScript access (XSS protection)
 * - SameSite=Strict: Only sent with same-site requests (CSRF protection)
 * - Secure: Only sent over HTTPS (in production)
 * - Path=/: Available for all paths
 *
 * @param token - The CSRF token to set
 * @param secure - Whether to set Secure flag (default: true in production)
 * @returns Cookie string for Set-Cookie header
 */
export function buildCsrfCookie(token: string, secure = true): string {
  const isProduction = process.env.NODE_ENV === "production";
  const securePart = isProduction || secure ? "; Secure" : "";

  return `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict${securePart}`;
}

/**
 * Set CSRF cookie on a response.
 * Appends Set-Cookie header to existing response.
 *
 * @param response - The response to modify
 * @param token - The CSRF token to set
 * @returns The modified response with CSRF cookie
 */
export function setCsrfCookie(response: Response, token: string): Response {
  const cookie = buildCsrfCookie(token);
  response.headers.append("Set-Cookie", cookie);
  return response;
}

/**
 * Create a new response with CSRF cookie set.
 * Use this when you need to set the cookie on a new response.
 *
 * @param body - Response body (will be JSON stringified if object)
 * @param token - The CSRF token to set
 * @param init - Optional response init options
 * @returns New Response with CSRF cookie set
 */
export function responseWithCsrfCookie(
  body: unknown,
  token: string,
  init?: ResponseInit
): Response {
  const jsonBody = typeof body === "string" ? body : JSON.stringify(body);
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.append("Set-Cookie", buildCsrfCookie(token));

  return new Response(jsonBody, {
    ...init,
    headers,
  });
}

/**
 * CSRF protection guard for route handlers.
 * Call at the start of POST/PUT/PATCH/DELETE handlers.
 *
 * @param request - The incoming HTTP request
 * @returns null if valid, Response if invalid (return this from handler)
 *
 * @example
 * export async function POST({ request }: APIEvent) {
 *   const csrfError = csrfProtect(request);
 *   if (csrfError) return csrfError;
 *
 *   // Continue with handler logic...
 * }
 */
export function csrfProtect(request: Request): Response | null {
  const result = validateCsrfToken(request);

  if (!result.valid) {
    return csrfErrorResponse(result.error);
  }

  return null;
}

// Export constants for testing
export const COOKIE_NAME = CSRF_COOKIE_NAME;
export const HEADER_NAME = CSRF_HEADER_NAME;
