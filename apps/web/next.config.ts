import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

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
  // SECURITY: unsafe-eval is only allowed in development for HMR/hot-reload
  // Production uses strict CSP without unsafe-eval to prevent arbitrary JS execution
  {
    key: "Content-Security-Policy",
    value: [
      // Default: only allow same-origin resources
      "default-src 'self'",
      // Scripts: self, inline (for Next.js hydration)
      // unsafe-eval is conditionally added only in development (see below)
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline'",
      // Styles: self and inline (required for styled-jsx, Tailwind)
      "style-src 'self' 'unsafe-inline'",
      // Images: self, data URIs, HTTPS, and blob (for image previews)
      "img-src 'self' data: https: blob:",
      // Fonts: self and data URIs
      "font-src 'self' data:",
      // API/WebSocket connections (includes local dev WebSocket and production endpoints)
      "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev wss://*.clerk.accounts.dev https://api.teveroseo.com wss://ws.teveroseo.com ws://localhost:* wss://localhost:*",
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

// Wrap config with next-intl plugin
// The plugin expects the i18n request config at ./src/i18n/request.ts
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Sentry Configuration
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
const sentryConfig = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Organization and project for Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in production with auth token
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite
  // to circumvent ad-blockers (optional)
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: false,
};

// Apply plugins: first next-intl, then Sentry
const configWithIntl = withNextIntl(nextConfig);

// Only wrap with Sentry if DSN is configured
export default process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(configWithIntl, sentryConfig)
  : configWithIntl;
