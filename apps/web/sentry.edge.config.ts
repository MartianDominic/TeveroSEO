/**
 * Sentry Edge Runtime Configuration
 *
 * This file configures Sentry for Edge Runtime functions (middleware, edge API routes).
 * It has a minimal configuration since Edge Runtime has limited APIs.
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

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Only send events in production
    enabled: process.env.NODE_ENV === "production",

    // Filter out expected errors
    ignoreErrors: [
      "NEXT_NOT_FOUND",
      "NEXT_REDIRECT",
    ],
  });
}
