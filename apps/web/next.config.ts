import type { NextConfig } from "next";
import path from "path";

/**
 * Security Headers Configuration
 * Implements OWASP recommended security headers for all routes.
 */
const securityHeaders = [
  // DNS Prefetch Control - Enable DNS prefetching for performance
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  // HSTS - Enforce HTTPS connections (1 year with subdomains and preload)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // Clickjacking Protection - Prevent embedding in iframes
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // MIME Sniffing Protection - Prevent browser from guessing content types
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // XSS Protection - Legacy browser XSS filter (modern browsers use CSP)
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  // Referrer Policy - Control referrer information sent with requests
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Permissions Policy - Disable unused browser features
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  },
  // Content Security Policy - Comprehensive CSP for Next.js apps
  {
    key: "Content-Security-Policy",
    value: [
      // Default: only allow same-origin resources
      "default-src 'self'",
      // Scripts: self, inline (for Next.js), and eval (for dev/HMR)
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      // Styles: self and inline (required for styled-jsx, Tailwind)
      "style-src 'self' 'unsafe-inline'",
      // Images: self, data URIs, HTTPS, and blob (for image previews)
      "img-src 'self' data: https: blob:",
      // Fonts: self and data URIs
      "font-src 'self' data:",
      // API/WebSocket connections
      "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev wss://*.clerk.accounts.dev https://api.teveroseo.com",
      // Prevent embedding in frames
      "frame-ancestors 'none'",
      // Form submissions only to self
      "form-action 'self'",
      // Base URI restrictions
      "base-uri 'self'",
      // Worker sources
      "worker-src 'self' blob:",
      // Object/embed/applet disabled
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ["@tevero/ui", "@tevero/types"],
  outputFileTracingRoot: path.join(__dirname, "../../"),

  /**
   * Apply security headers to all routes.
   * These headers protect against common web vulnerabilities.
   */
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
