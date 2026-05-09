"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";

import { logger } from '@/lib/logger';

import { Button } from "@tevero/ui";

// SECURITY: Never expose raw error messages to users in production
const USER_FRIENDLY_MESSAGE = "Something went wrong. Please try again.";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Send error to Sentry with digest for correlation
    Sentry.captureException(error, {
      extra: {
        digest: error.digest,
      },
      tags: {
        errorType: "app-error",
      },
    });

    // Also log locally for development debugging
    if (process.env.NODE_ENV === "development") {
      logger.error("[app-error]", {
        digest: error.digest,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground mt-2">{USER_FRIENDLY_MESSAGE}</p>
      {error.digest && (
        <p className="text-muted-foreground text-xs mt-1">
          Error ID: {error.digest}
        </p>
      )}
      {process.env.NODE_ENV === "development" && (
        <pre className="text-xs text-muted-foreground mt-2 max-w-md overflow-auto p-2 bg-muted rounded">
          {error.message}
        </pre>
      )}
      <Button onClick={reset} className="mt-4">
        Try again
      </Button>
    </div>
  );
}
