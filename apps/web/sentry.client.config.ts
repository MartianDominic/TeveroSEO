/**
 * Sentry Client-Side Configuration
 *
 * This file configures Sentry error tracking for the browser (client-side).
 * It runs on page load and captures:
 * - Unhandled JavaScript errors
 * - Unhandled promise rejections
 * - Console errors (in production)
 * - Performance data (transactions and spans)
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

// Only initialize if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,

    // Performance monitoring: sample 10% of transactions in production
    // Increase during debugging, decrease for high-traffic apps
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session Replay for error debugging
    // Capture 10% of sessions for general monitoring
    replaysSessionSampleRate: 0.1,
    // Capture 100% of sessions where an error occurred
    replaysOnErrorSampleRate: 1.0,

    // Enable debug mode in development for troubleshooting
    debug: process.env.NODE_ENV === "development",

    // Disable sending errors during development (optional)
    // Set to false to test Sentry in development
    enabled: process.env.NODE_ENV === "production",

    // Release tracking (set via SENTRY_RELEASE or automatic detection)
    // release: process.env.SENTRY_RELEASE,

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions and noise
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // Network errors that are expected
      "Failed to fetch",
      "NetworkError",
      "Load failed",
      // User-initiated navigation
      "AbortError",
      // Third-party script errors
      /^Script error\.?$/,
      // Clerk SDK internal errors (handled by Clerk)
      /Clerk:/,
    ],

    // Filter out transactions from noisy sources
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
      // External analytics scripts
      /googletagmanager\.com/i,
      /google-analytics\.com/i,
      /analytics\.js/i,
    ],

    // Add integrations
    integrations: [
      // Capture breadcrumbs for debugging
      Sentry.breadcrumbsIntegration({
        console: true,
        dom: true,
        fetch: true,
        history: true,
        xhr: true,
      }),
      // HTTP client instrumentation for fetch requests
      Sentry.httpClientIntegration(),
      // Session Replay
      Sentry.replayIntegration({
        // Mask all text content for privacy
        maskAllText: true,
        // Block all media for performance
        blockAllMedia: true,
      }),
    ],

    // Before sending, enrich with additional context
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (
        process.env.NODE_ENV === "development" &&
        !process.env.SENTRY_DEBUG_ENABLED
      ) {
        return null;
      }

      // Add user context if available
      // Note: We don't add PII here; use Clerk's user ID if needed
      // Sentry.setUser({ id: userId });

      return event;
    },

    // Custom fingerprinting for better issue grouping
    beforeSendTransaction(event) {
      // Filter out health check transactions
      if (event.transaction?.includes("/api/health")) {
        return null;
      }
      return event;
    },
  });
}
