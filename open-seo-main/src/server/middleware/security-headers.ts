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
 */

const isProduction = process.env.NODE_ENV === "production";

/**
 * Build Content Security Policy header value.
 * Comprehensive CSP that allows the application to function
 * while blocking common attack vectors.
 */
function buildCSP(): string {
  const directives: Record<string, string[]> = {
    // Default: only allow resources from same origin
    "default-src": ["'self'"],

    // Scripts: self, inline (for TanStack), and eval (for dev/HMR)
    "script-src": isProduction
      ? ["'self'", "'unsafe-inline'"]
      : ["'self'", "'unsafe-eval'", "'unsafe-inline'"],

    // Styles: allow inline for component libraries (shadcn, Tailwind)
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
 */
function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    // Content Security Policy
    "Content-Security-Policy": buildCSP(),

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
 * @param handler - The original fetch handler
 * @returns A wrapped fetch handler that adds security headers
 *
 * @example
 * ```ts
 * import { withSecurityHeaders } from "@/server/middleware/security-headers";
 *
 * const fetch = createStartHandler(defaultStreamHandler);
 *
 * export default {
 *   fetch: withSecurityHeaders(fetch),
 * };
 * ```
 */
export function withSecurityHeaders(handler: FetchHandler): FetchHandler {
  return async (request: Request): Promise<Response> => {
    // Call the original handler
    const response = await handler(request);

    // Clone headers to make them mutable
    const headers = new Headers(response.headers);

    // Add security headers
    const securityHeaders = getSecurityHeaders();
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
