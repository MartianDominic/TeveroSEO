/**
 * Security Headers Middleware
 * Implements OWASP recommended security headers for all HTTP responses.
 *
 * This middleware wraps the fetch handler to add comprehensive security headers
 * that protect against:
 * - XSS attacks (Content-Security-Policy, X-XSS-Protection)
 * - Clickjacking (X-Frame-Options)
 * - MIME sniffing (X-Content-Type-Options)
 * - Information leakage (Referrer-Policy)
 * - Feature abuse (Permissions-Policy)
 * - Protocol downgrade (Strict-Transport-Security)
 *
 * SEC-01 FIX: Now uses nonce-based CSP for scripts instead of 'unsafe-inline'.
 * Nonces are generated per-request using crypto.randomBytes.
 */

import { randomBytes } from "crypto";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Generate a cryptographically secure nonce for CSP.
 * Returns a base64-encoded 16-byte random value.
 */
export function generateCspNonce(): string {
  return randomBytes(16).toString("base64");
}

/**
 * Build Content Security Policy header value with nonce support.
 * SEC-01 FIX: Uses nonce-based CSP instead of 'unsafe-inline' for scripts.
 *
 * @param nonce - The CSP nonce for inline scripts (generated per-request)
 * @returns CSP header value string
 */
function buildCSP(nonce?: string): string {
  // SEC-01 FIX: In production, use nonce instead of 'unsafe-inline'
  // In development, we still need 'unsafe-eval' for HMR
  const scriptSrc = isProduction
    ? nonce
      ? ["'self'", `'nonce-${nonce}'`]
      : ["'self'", "'unsafe-inline'"] // Fallback if nonce not provided
    : ["'self'", "'unsafe-eval'", "'unsafe-inline'"];

  const directives: Record<string, string[]> = {
    // Default: only allow resources from same origin
    "default-src": ["'self'"],

    // Scripts: self with nonce in production, eval allowed in dev
    "script-src": scriptSrc,

    // Styles: allow inline for component libraries (shadcn, Tailwind)
    // Note: style nonces are less critical than script nonces
    "style-src": ["'self'", "'unsafe-inline'"],

    // Images: self, data URIs, HTTPS sources, and blobs
    "img-src": ["'self'", "data:", "https:", "blob:"],

    // Fonts: self and data URIs
    "font-src": ["'self'", "data:"],

    // API/WebSocket connections
    "connect-src": [
      "'self'",
      // Clerk authentication
      "https://api.clerk.com",
      "https://*.clerk.accounts.dev",
      "wss://*.clerk.accounts.dev",
      // WebSocket for real-time updates (localhost only in development)
      ...(isProduction ? [] : ["ws://localhost:3002"]),
      "wss://api.teveroseo.com",
    ],

    // Disallow embedding in frames
    "frame-ancestors": ["'none'"],

    // Form submissions only to self
    "form-action": ["'self'"],

    // Base URI restrictions
    "base-uri": ["'self'"],

    // Disallow object/embed/applet
    "object-src": ["'none'"],

    // Worker sources
    "worker-src": ["'self'", "blob:"],

    // Media sources
    "media-src": ["'self'"],

    // Manifest
    "manifest-src": ["'self'"],
  };

  // Add upgrade-insecure-requests in production
  const cspParts = Object.entries(directives).map(
    ([key, values]) => `${key} ${values.join(" ")}`
  );

  if (isProduction) {
    cspParts.push("upgrade-insecure-requests");
  }

  return cspParts.join("; ");
}

/**
 * Get all security headers as a record.
 *
 * @param nonce - Optional CSP nonce for inline scripts
 */
function getSecurityHeaders(nonce?: string): Record<string, string> {
  const headers: Record<string, string> = {
    // Content Security Policy (SEC-01 FIX: nonce-based)
    "Content-Security-Policy": buildCSP(nonce),

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Clickjacking protection
    "X-Frame-Options": "DENY",

    // XSS Protection (legacy browsers)
    "X-XSS-Protection": "1; mode=block",

    // Referrer Policy
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions Policy (disable unused browser features)
    "Permissions-Policy": [
      "accelerometer=()",
      "ambient-light-sensor=()",
      "autoplay=()",
      "battery=()",
      "camera=()",
      "cross-origin-isolated=()",
      "display-capture=()",
      "document-domain=()",
      "encrypted-media=()",
      "fullscreen=()",
      "geolocation=()",
      "gyroscope=()",
      "keyboard-map=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=()",
      "publickey-credentials-get=()",
      "screen-wake-lock=()",
      "sync-xhr=()",
      "usb=()",
      "web-share=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  };

  // HSTS - only enable in production with HTTPS
  if (isProduction) {
    // max-age=31536000 = 1 year
    // includeSubDomains - apply to all subdomains
    // preload - allow inclusion in browser preload lists
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
}

/**
 * Check if the request path is for a sensitive endpoint.
 * Sensitive endpoints get additional cache-control headers.
 */
function isSensitiveEndpoint(path: string): boolean {
  const sensitivePatterns = [
    "/api/auth",
    "/api/user",
    "/api/oauth",
    "/api/internal",
    "/api/admin",
    "/api/client",
  ];
  return sensitivePatterns.some((pattern) => path.startsWith(pattern));
}

/**
 * Type for a fetch handler function.
 */
type FetchHandler = (request: Request) => Promise<Response> | Response;

/**
 * Wrap a fetch handler with security headers middleware.
 * This adds OWASP recommended security headers to all responses.
 *
 * SEC-01 FIX: Now generates per-request nonces for CSP.
 * The nonce is attached to the request for use by templates.
 *
 * @param handler - The original fetch handler
 * @returns A wrapped fetch handler that adds security headers
 *
 * @example
 * ```ts
 * import { withSecurityHeaders, generateCspNonce } from "@/server/middleware/security-headers";
 *
 * const fetch = createStartHandler(defaultStreamHandler);
 *
 * export default {
 *   fetch: withSecurityHeaders(fetch),
 * };
 *
 * // In templates, access the nonce via request header:
 * const nonce = request.headers.get('X-CSP-Nonce');
 * <script nonce={nonce}>...</script>
 * ```
 */
export function withSecurityHeaders(handler: FetchHandler): FetchHandler {
  return async (request: Request): Promise<Response> => {
    // SEC-01 FIX: Generate a per-request nonce for CSP
    const nonce = isProduction ? generateCspNonce() : undefined;

    // Attach nonce to request for templates to access
    // Clone request with nonce header so downstream handlers can use it
    let requestWithNonce = request;
    if (nonce) {
      const newHeaders = new Headers(request.headers);
      newHeaders.set("X-CSP-Nonce", nonce);
      requestWithNonce = new Request(request.url, {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        // @ts-expect-error - duplex is needed for body streams
        duplex: "half",
      });
    }

    // Call the original handler with nonce-aware request
    const response = await handler(requestWithNonce);

    // Clone headers to make them mutable
    const headers = new Headers(response.headers);

    // Add security headers (SEC-01 FIX: with nonce)
    const securityHeaders = getSecurityHeaders(nonce);
    for (const [key, value] of Object.entries(securityHeaders)) {
      headers.set(key, value);
    }

    // Add cache control for sensitive endpoints
    const url = new URL(request.url);
    if (isSensitiveEndpoint(url.pathname)) {
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");
    }

    // Return new response with security headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

// Export individual utilities for testing
export { buildCSP, getSecurityHeaders, isSensitiveEndpoint };
