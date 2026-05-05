/**
 * Sentry Error Tracking Initialization
 *
 * Initializes Sentry for error monitoring and performance tracing.
 * Only activates when SENTRY_DSN environment variable is set.
 *
 * Features:
 * - Automatic error capturing
 * - Performance tracing for API routes
 * - Release tracking from package.json version
 * - Environment-aware configuration
 *
 * IMPORTANT: This module must be imported and initialized BEFORE other modules
 * to ensure proper instrumentation. Import it at the top of server.ts.
 */

import * as Sentry from "@sentry/node";
import { createLogger } from "./logger";

const log = createLogger({ module: "sentry" });

// Read version from package.json at build time
// Using import.meta for ESM compatibility
const PACKAGE_VERSION = "0.0.5"; // Manually sync with package.json version

let isInitialized = false;

/**
 * Initialize Sentry error tracking.
 * Only initializes if SENTRY_DSN environment variable is set.
 *
 * @returns true if Sentry was initialized, false otherwise
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    log.debug("Sentry DSN not configured, skipping initialization");
    return false;
  }

  if (isInitialized) {
    log.debug("Sentry already initialized, skipping");
    return true;
  }

  const environment = process.env.NODE_ENV || "development";
  const release = `open-seo@${PACKAGE_VERSION}`;

  try {
    Sentry.init({
      dsn,
      environment,
      release,

      // Performance tracing - sample 10% of transactions in production
      // Adjust based on traffic volume and Sentry quota
      tracesSampleRate: environment === "production" ? 0.1 : 1.0,

      // Enable sending default PII (IP, user info) - disable if GDPR concerns
      sendDefaultPii: false,

      // Only send errors in production, capture everything in dev for debugging
      beforeSend(event) {
        // Filter out certain errors if needed
        // Example: if (event.exception?.values?.[0]?.type === 'IgnoredError') return null;
        return event;
      },

      // Integration options
      integrations: [
        // HTTP integration is auto-enabled for tracing
        // Add additional integrations as needed
      ],
    });

    isInitialized = true;
    log.info("Sentry initialized", {
      environment,
      release,
      tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    });

    return true;
  } catch (error) {
    log.error(
      "Failed to initialize Sentry",
      error instanceof Error ? error : new Error(String(error)),
    );
    return false;
  }
}

/**
 * Capture an exception and send it to Sentry.
 * Safe to call even if Sentry is not initialized.
 *
 * @param error - The error to capture
 * @param context - Additional context to attach to the error
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>,
): void {
  if (!isInitialized) {
    return;
  }

  const errorObj = error instanceof Error ? error : new Error(String(error));

  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(errorObj);
    });
  } else {
    Sentry.captureException(errorObj);
  }
}

/**
 * Capture a message and send it to Sentry.
 * Safe to call even if Sentry is not initialized.
 *
 * @param message - The message to capture
 * @param level - Severity level (info, warning, error)
 * @param context - Additional context to attach
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, unknown>,
): void {
  if (!isInitialized) {
    return;
  }

  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureMessage(message, level);
    });
  } else {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Set user context for Sentry.
 * All subsequent events will be associated with this user.
 *
 * @param user - User information (id, email, username)
 */
export function setUser(user: { id?: string; email?: string; username?: string } | null): void {
  if (!isInitialized) {
    return;
  }
  Sentry.setUser(user);
}

/**
 * Add breadcrumb for debugging context.
 *
 * @param breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message?: string;
  level?: "debug" | "info" | "warning" | "error";
  data?: Record<string, unknown>;
}): void {
  if (!isInitialized) {
    return;
  }
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Start a new transaction for performance monitoring.
 *
 * @param name - Transaction name (e.g., "POST /api/audit")
 * @param op - Operation type (e.g., "http.server", "queue.process")
 * @returns Transaction object or undefined if Sentry not initialized
 */
export function startTransaction(
  name: string,
  op: string,
): ReturnType<typeof Sentry.startSpan> | undefined {
  if (!isInitialized) {
    return undefined;
  }

  return Sentry.startSpan(
    {
      name,
      op,
    },
    () => {
      // This callback receives the span
    },
  );
}

/**
 * Flush all pending events to Sentry.
 * Call this before shutting down the server.
 *
 * @param timeout - Maximum time to wait for flush (ms)
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!isInitialized) {
    return true;
  }

  try {
    return await Sentry.flush(timeout);
  } catch (error) {
    log.error("Failed to flush Sentry events", error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Check if Sentry is initialized and active.
 */
export function isSentryEnabled(): boolean {
  return isInitialized;
}

// Re-export Sentry for direct access when needed
export { Sentry };
