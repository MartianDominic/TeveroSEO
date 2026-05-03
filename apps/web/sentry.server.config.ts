/**
 * Sentry Server-Side Configuration
 *
 * This file configures Sentry error tracking for the Node.js server.
 * It runs when the server starts and captures:
 * - Server-side errors in API routes and Server Components
 * - Unhandled exceptions in getServerSideProps, generateMetadata, etc.
 * - Server performance data
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

// Only initialize if DSN is configured
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,

    // Performance monitoring: sample 10% of transactions in production
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Enable debug mode in development for troubleshooting
    debug: process.env.NODE_ENV === "development",

    // Only send events in production (or when SENTRY_DEBUG_ENABLED is set)
    enabled:
      process.env.NODE_ENV === "production" ||
      process.env.SENTRY_DEBUG_ENABLED === "true",

    // Release tracking
    // release: process.env.SENTRY_RELEASE,

    // Filter out noisy errors
    ignoreErrors: [
      // Expected HTTP errors that shouldn't be tracked
      "NEXT_NOT_FOUND",
      "NEXT_REDIRECT",
      // Network timeouts that are expected with external services
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      // Rate limiting (handled gracefully)
      "Rate limit exceeded",
    ],

    // Integrations for server monitoring
    integrations: [
      // HTTP request tracing
      Sentry.httpIntegration(),
      // Database query tracing (if using supported ORMs)
      // Note: Add Prisma or Drizzle integration here if needed
    ],

    // Enrich events with server context
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Skip circuit breaker open errors (expected behavior)
      if (error instanceof Error && error.name === "CircuitOpenError") {
        // Still log as breadcrumb but don't send as error
        return null;
      }

      // Add additional context
      if (event.tags) {
        event.tags["runtime"] = "nodejs";
      }

      return event;
    },

    // Filter transactions for cleaner performance data
    beforeSendTransaction(event) {
      // Skip health check endpoints
      if (
        event.transaction?.includes("/api/health") ||
        event.transaction?.includes("/_next/")
      ) {
        return null;
      }

      return event;
    },
  });
}
